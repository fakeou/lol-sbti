import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FakeProvider,
  OpenAiCompatibleProvider,
  ProviderError,
} from "./provider.js";

const metrics: any = {
  classification: { typeCode: "unclassified", dimensions: [
    { code: "aggression", score: 50, evidenceCodes: ["avg_kills"], explanation: "test aggression" },
    { code: "teamwork", score: 50, evidenceCodes: ["avg_assists"], explanation: "test teamwork" },
    { code: "consistency", score: 50, evidenceCodes: ["kda_stdev"], explanation: "test consistency" },
    { code: "vision_control", score: 50, evidenceCodes: ["avg_vision_per_min"], explanation: "test vision" },
    { code: "economy", score: 50, evidenceCodes: ["avg_cs_per_min"], explanation: "test economy" },
    { code: "survivability", score: 50, evidenceCodes: ["avg_deaths"], explanation: "test survivability" },
  ] },
  sample: {
    matchCount: 5,
    queues: [{ queueId: 420, count: 5 }],
    from: "2026-01-01T00:00:00Z",
    to: "2026-01-02T00:00:00Z",
  },
};
const skill: any = {
  version: "1",
  contentHash: "sha256:x",
  instructions: "trusted instructions",
};

const createProvider = (endpoint = "https://provider.example/v1") =>
  new OpenAiCompatibleProvider(endpoint, "model", "test-key");

afterEach(() => vi.unstubAllGlobals());

describe("providers", () => {
  it("returns deterministic fake data", async () => {
    const provider = new FakeProvider();
    expect(
      await provider.analyze(metrics, skill, new AbortController().signal),
    ).toEqual(
      await provider.analyze(metrics, skill, new AbortController().signal),
    );
  });

  it("sends the key only to the validated HTTPS endpoint with redirects disabled", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "{}" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    await createProvider().analyze(
      metrics,
      skill,
      new AbortController().signal,
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("https://provider.example/v1/chat/completions");
    expect(init.redirect).toBe("manual");
    expect(init.headers.authorization).toBe("Bearer test-key");
    const body = JSON.parse(init.body);
    expect(body.messages[0].content).toBe(skill.instructions);
    expect(
      body.response_format.json_schema.schema.properties.sample.properties
        .matchCount.minimum,
    ).toBe(5);
    expect(body.response_format.json_schema.schema.additionalProperties).toBe(
      false,
    );
  });

  it.each([
    ["http://provider.example", "HTTPS"],
    ["ftp://provider.example", "HTTPS"],
    ["https://user:password@provider.example", "userinfo"],
    ["https://provider.example?target=https://evil.example", "query"],
    ["https://provider.example#https://evil.example", "fragment"],
    ["https://provider.example:invalid", "valid HTTPS URL"],
    ["https://provider.example/\nheader", "control characters"],
  ])("rejects unsafe endpoint %s without exposing the key", (endpoint, reason) => {
    expect(() => createProvider(endpoint)).toThrow(reason);
    try {
      createProvider(endpoint);
    } catch (error) {
      expect(String(error)).not.toContain("test-key");
    }
  });

  it("keeps an allowed path on the validated origin", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "{}" } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", mockFetch);

    await createProvider("https://provider.example:8443/openai/v1/").analyze(
      metrics,
      skill,
      new AbortController().signal,
    );

    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://provider.example:8443/openai/v1/chat/completions",
    );
  });

  it.each([301, 302, 307, 308])("rejects HTTP redirect %i", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("", {
          status,
          headers: { location: "https://evil.example/steal" },
        }),
      ),
    );

    await expect(
      createProvider().analyze(metrics, skill, new AbortController().signal),
    ).rejects.toMatchObject({
      code: "MODEL_TEMPORARILY_UNAVAILABLE",
      retryable: false,
    });
  });

  it.each([
    [429, "MODEL_RATE_LIMITED", true],
    [500, "MODEL_TEMPORARILY_UNAVAILABLE", true],
    [401, "MODEL_AUTH_FAILED", false],
  ])("classifies HTTP %i", async (status, code, retryable) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: status as number })),
    );
    await expect(
      createProvider().analyze(metrics, skill, new AbortController().signal),
    ).rejects.toMatchObject({ code, retryable });
  });

  it("classifies malformed bodies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
    );
    await expect(
      createProvider().analyze(metrics, skill, new AbortController().signal),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});
