import { EventEmitter } from "node:events";
import { request as httpsRequest } from "node:https";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FakeProvider,
  OpenAiCompatibleProvider,
  ProviderError,
} from "./provider.js";

vi.mock("node:https", () => ({ request: vi.fn() }));

const mockHttpsRequest = vi.mocked(httpsRequest);
const metrics: any = {
  classification: { typeCode: "unclassified", dimensions: [
    { code: "aggression", score: 50, evidenceCodes: ["avg_kills"], explanation: "test aggression" },
    { code: "teamwork", score: 50, evidenceCodes: ["avg_assists"], explanation: "test teamwork" },
    { code: "consistency", score: 50, evidenceCodes: ["kda_stdev"], explanation: "test consistency" },
    { code: "vision_control", score: 50, evidenceCodes: ["avg_vision_per_min"], explanation: "test vision" },
    { code: "economy", score: 50, evidenceCodes: ["avg_cs_per_min"], explanation: "test economy" },
    { code: "survivability", score: 50, evidenceCodes: ["avg_deaths"], explanation: "test survivability" },
  ] },
  sample: { matchCount: 5, queues: [{ queueId: 420, count: 5 }], from: "2026-01-01T00:00:00Z", to: "2026-01-02T00:00:00Z" },
};
const skill: any = { version: "1", contentHash: "sha256:x", instructions: "trusted instructions" };
const createProvider = (endpoint = "https://provider.example/v1") =>
  new OpenAiCompatibleProvider(endpoint, "model", "test-key");

function respond(statusCode: number, body: string, error?: Error) {
  mockHttpsRequest.mockImplementation((_options: any, callback: any) => {
    const request = new EventEmitter() as any;
    request.setTimeout = vi.fn();
    request.destroy = vi.fn((error?: Error) => error && request.emit("error", error));
    request.end = vi.fn(() => {
      if (error) {
        request.emit("error", error);
        return;
      }
      const response = new EventEmitter() as any;
      response.statusCode = statusCode;
      response.setEncoding = vi.fn();
      callback(response);
      response.emit("data", body);
      response.emit("end");
      request.emit("close");
    });
    return request;
  });
}

afterEach(() => vi.clearAllMocks());

describe("providers", () => {
  it("returns deterministic fake data", async () => {
    const provider = new FakeProvider();
    expect(await provider.analyze(metrics, skill, new AbortController().signal)).toEqual(
      await provider.analyze(metrics, skill, new AbortController().signal),
    );
  });

  it("uses IPv4 HTTPS with SNI, a timeout, the validated hostname/path, and no redirect support", async () => {
    respond(200, JSON.stringify({ choices: [{ message: { content: "{}" } }] }));
    await createProvider("https://provider.example:8443/openai/v1/").analyze(metrics, skill, new AbortController().signal);

    expect(mockHttpsRequest).toHaveBeenCalledOnce();
    const [options] = mockHttpsRequest.mock.calls[0] as any[];
    expect(options).toMatchObject({
      protocol: "https:", hostname: "provider.example", port: "8443",
      path: "/openai/v1/chat/completions", method: "POST", family: 4,
      servername: "provider.example", timeout: 30_000,
    });
    expect(options.headers.authorization).toBe("Bearer test-key");
    expect(options.headers["content-type"]).toBe("application/json");
    const request = mockHttpsRequest.mock.results[0].value as any;
    expect(request.end).toHaveBeenCalledOnce();
    const body = JSON.parse(request.end.mock.calls[0][0]);
    expect(body.messages[0].content).toBe(skill.instructions);
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.max_tokens).toBeGreaterThanOrEqual(1024);
    expect(body.temperature).toBe(0);
  });

  it.each([
    ["http://provider.example", "HTTPS"], ["ftp://provider.example", "HTTPS"],
    ["https://user:password@provider.example", "userinfo"],
    ["https://provider.example?target=https://evil.example", "query"],
    ["https://provider.example#https://evil.example", "fragment"],
    ["https://provider.example:invalid", "valid HTTPS URL"], ["https://provider.example/\nheader", "control characters"],
  ])("rejects unsafe endpoint %s without exposing the key", (endpoint, reason) => {
    expect(() => createProvider(endpoint)).toThrow(reason);
    try { createProvider(endpoint); } catch (error) { expect(String(error)).not.toContain("test-key"); }
  });

  it.each([301, 302, 307, 308])("rejects HTTP redirect %i without following it", async (status) => {
    respond(status, "", undefined);
    await expect(createProvider().analyze(metrics, skill, new AbortController().signal)).rejects.toMatchObject({
      code: "MODEL_TEMPORARILY_UNAVAILABLE", retryable: false,
    });
  });

  it.each([[429, "MODEL_RATE_LIMITED", true], [500, "MODEL_TEMPORARILY_UNAVAILABLE", true], [401, "MODEL_AUTH_FAILED", false]])(
    "classifies HTTP %i", async (status, code, retryable) => {
      respond(status as number, "");
      await expect(createProvider().analyze(metrics, skill, new AbortController().signal)).rejects.toMatchObject({ code, retryable });
    },
  );

  it("classifies HTTPS connection errors as retryable temporary failures without exposing the key", async () => {
    respond(0, "", new Error("connect ETIMEDOUT provider.example"));
    await expect(createProvider().analyze(metrics, skill, new AbortController().signal)).rejects.toMatchObject({
      code: "MODEL_TEMPORARILY_UNAVAILABLE", retryable: true,
    });
  });

  it.each([
    "", "not json", JSON.stringify({ choices: [{ message: { content: "" } }] }),
    JSON.stringify({ choices: [{ finish_reason: "length", message: { content: "{\"partial\":true}" } }] }),
    JSON.stringify({ choices: [{ message: { content: "not json" } }] }),
  ])("classifies invalid successful response body as retryable schema errors", async (body) => {
    respond(200, body);
    await expect(createProvider().analyze(metrics, skill, new AbortController().signal)).rejects.toMatchObject({
      code: "MODEL_SCHEMA_INVALID", retryable: true,
    });
  });

  it("keeps provider errors typed", async () => {
    respond(200, "{}");
    await expect(createProvider().analyze(metrics, skill, new AbortController().signal)).rejects.toBeInstanceOf(ProviderError);
  });
});
