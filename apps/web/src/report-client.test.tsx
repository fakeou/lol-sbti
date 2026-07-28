// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Report, ReportClient } from "./report-client";
import { mockReport } from "./mock-report";

const secret = "s".repeat(43);
const report = {
  resultVersion: 1, typeCode: "TACTICIAN", title: "冷静的战术执行者", confidence: .72,
  sample: { matchCount: 50, queues: [{ queueId: 420, count: 50 }], from: "2026-06-28T00:00:00Z", to: "2026-07-23T00:00:00Z" },
  dimensions: [{ code: "teamwork", score: 84, evidenceCodes: ["kp"], explanation: "你会持续参与团队资源交换。" }],
  summary: "你倾向于在信息充分后推进。", strengths: ["稳定协作"], risks: ["可能错过窗口"], recommendations: ["提前标记下一处资源"], limitations: ["样本只覆盖近期对局"], generatedAt: "2026-07-24T00:00:00Z"
};
afterEach(() => { cleanup(); vi.restoreAllMocks(); history.replaceState(null, "", "/"); });
function response(status: number, body?: unknown) { return Promise.resolve(new Response(body ? JSON.stringify(body) : null, { status, headers: { "content-type": "application/json" } })); }

describe("temporary report lifecycle", () => {
  it("renders a local mock report without requesting a temporary-report session", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<Report report={mockReport} />);
    expect(screen.getByRole("heading", { name: /冷静的战术执行者/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /对局能力雷达/ })).toBeInTheDocument();
    expect(screen.getAllByText("生存")).toHaveLength(2);
    expect(screen.getAllByText("经济")).toHaveLength(2);
    expect(screen.getAllByText("输出")).toHaveLength(2);
    expect(screen.getByText("团队之眼")).toBeInTheDocument();
    expect(screen.getByText("你的优势")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("exchanges fragment for cookie, removes it only after success, then renders plain report text", async () => {
    history.replaceState(null, "", `/r/pub_test#${secret}`);
    const replace = vi.spyOn(history, "replaceState");
    const fetchMock = vi.fn().mockImplementationOnce(() => response(204)).mockImplementationOnce(() => response(200, report));
    vi.stubGlobal("fetch", fetchMock);
    render(<ReportClient publicId="pub_test" />);
    expect(screen.getByText("正在打开临时报告…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /冷静的战术执行者/ })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/v1/share-sessions", expect.objectContaining({ method: "POST", credentials: "same-origin", body: JSON.stringify({ publicId: "pub_test", secret }) }));
    expect(replace).toHaveBeenCalledWith(null, "", "/r/pub_test");
    expect(window.location.hash).toBe("");
    expect(localStorage.length).toBe(0); expect(sessionStorage.length).toBe(0);
    expect(document.querySelector("script[src], link[href^='http'], img[src^='http']")).toBeNull();
    expect(screen.getByText("你会持续参与团队资源交换。")).toHaveTextContent("你会持续参与团队资源交换。");
  });
  it("uses an existing HttpOnly session when there is no fragment", async () => {
    history.replaceState(null, "", "/r/pub_test");
    const fetchMock = vi.fn().mockImplementation(() => response(200, report)); vi.stubGlobal("fetch", fetchMock);
    render(<ReportClient publicId="pub_test" />); await screen.findByText("对局能力雷达");
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(fetchMock.mock.calls[0]?.[0]).toBe("/v1/public/reports/pub_test");
  });
  it.each([[404,"链接无效或已失效"],[410,"这份报告已过期或被撤销"],[500,"暂时无法载入报告"]])("renders %s state", async (status, message) => {
    history.replaceState(null, "", "/r/pub_test"); vi.stubGlobal("fetch", vi.fn(() => response(status as number)));
    render(<ReportClient publicId="pub_test" />); expect(await screen.findByRole("heading", { name: message as string })).toBeInTheDocument();
  });
  it("clears malformed fragments without sending them", async () => {
    history.replaceState(null, "", "/r/pub_test#short"); const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    render(<ReportClient publicId="pub_test" />); await screen.findByText("链接无效或已失效");
    expect(location.hash).toBe(""); expect(fetchMock).not.toHaveBeenCalled();
  });
  it("keeps a valid secret available when exchange fails", async () => {
    history.replaceState(null, "", `/r/pub_test#${secret}`); vi.stubGlobal("fetch", vi.fn(() => response(500)));
    render(<ReportClient publicId="pub_test" />); await screen.findByText("暂时无法载入报告");
    expect(location.hash).toBe(`#${secret}`);
  });
  it("shows insufficient-field components instead of invented content", async () => {
    history.replaceState(null, "", "/r/pub_test"); const sparse = { ...report, dimensions: [], strengths: [], risks: [], recommendations: [] };
    vi.stubGlobal("fetch", vi.fn(() => response(200, sparse))); render(<ReportClient publicId="pub_test" />);
    await waitFor(() => expect(screen.getAllByText(/样本.*不足/).length).toBeGreaterThanOrEqual(4));
  });
  it.each([
    ["missing property", (({ title: _title, ...value }) => value)(report)],
    ["wrong type", { ...report, confidence: "high" }],
    ["unknown property", { ...report, unexpected: true }],
    ["out of range", { ...report, dimensions: [{ ...report.dimensions[0], score: 101 }] }],
    ["invalid date", { ...report, generatedAt: "not-a-date" }],
    ["invalid JSON", undefined]
  ])("fails closed for malformed report: %s", async (_name, malformed) => {
    history.replaceState(null, "", "/r/pub_test");
    vi.stubGlobal("fetch", vi.fn(() => malformed === undefined
      ? Promise.resolve(new Response("{", { status: 200, headers: { "content-type": "application/json" } }))
      : response(200, malformed)));
    render(<ReportClient publicId="pub_test" />);
    expect(await screen.findByRole("heading", { name: "暂时无法载入报告" })).toBeInTheDocument();
  });
});
