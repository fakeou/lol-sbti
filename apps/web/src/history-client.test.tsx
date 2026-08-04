// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HistoryClient } from "./history-client";

const viewerToken = "v".repeat(43);
const matches = [
  { occurredAt: "2026-07-28T10:00:00Z", queueId: 450, gameMode: "ARAM", durationSeconds: 1260, championId: 1, position: null, won: true, kills: 10, deaths: 3, assists: 8, cs: 120, gold: 8000, championDamage: 10000, damageTaken: 9000, healing: 100, visionScore: 10, wardsPlaced: 5, wardsKilled: 1, items: [1001, 1004], matchKey: "a".repeat(64) },
  { occurredAt: "2026-07-27T12:00:00Z", queueId: 420, gameMode: "CLASSIC", durationSeconds: 1800, championId: 2, position: "TOP", won: false, kills: 1, deaths: 2, assists: 3, cs: 200, gold: 9000, championDamage: 11000, damageTaken: 12000, healing: 50, visionScore: 8, wardsPlaced: 4, wardsKilled: 2, items: [1001], matchKey: "b".repeat(64) }
];
function response(status: number, body?: unknown) { return Promise.resolve(new Response(body ? JSON.stringify(body) : null, { status, headers: { "content-type": "application/json" } })); }

afterEach(() => { cleanup(); vi.restoreAllMocks(); history.replaceState(null, "", "/"); });

describe("cloud match history viewer", () => {
  it("exchanges the fragment token, lists matches and renders stats", async () => {
    history.replaceState(null, "", `/history#${viewerToken}`);
    const replace = vi.spyOn(history, "replaceState");
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response(204))
      .mockImplementationOnce(() => response(200, { matches }));
    vi.stubGlobal("fetch", fetchMock);
    render(<HistoryClient />);
    expect(await screen.findByRole("heading", { name: "我的云端战绩" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/v1/history-sessions", expect.objectContaining({ method: "POST", credentials: "same-origin", body: JSON.stringify({ viewerToken }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/v1/match-history", expect.objectContaining({ credentials: "same-origin" }));
    expect(replace).toHaveBeenCalledWith(null, "", "/history");
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("极地大乱斗")).toBeInTheDocument();
    expect(screen.getByText("安妮")).toBeInTheDocument();
    expect(screen.getByText("奥拉夫")).toBeInTheDocument();
    expect(screen.getByText("上单 · 经典对局")).toBeInTheDocument();
    expect(screen.getAllByText("KDA").length).toBeGreaterThan(0);
  });

  it("shows the invalid state when the fragment is missing or malformed and there is no session", async () => {
    const fetchMock = vi.fn(() => response(404));
    vi.stubGlobal("fetch", fetchMock);
    render(<HistoryClient />);
    expect(await screen.findByRole("heading", { name: "链接无效或已失效" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shows existing cloud matches without a fragment when the session cookie is valid", async () => {
    const fetchMock = vi.fn(() => response(200, { matches }));
    vi.stubGlobal("fetch", fetchMock);
    render(<HistoryClient />);
    expect(await screen.findByRole("heading", { name: "我的云端战绩" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/v1/match-history", expect.objectContaining({ credentials: "same-origin" }));
  });

  it("shows expired state when the viewer token was revoked", async () => {
    history.replaceState(null, "", `/history#${viewerToken}`);
    vi.stubGlobal("fetch", vi.fn(() => response(410)));
    render(<HistoryClient />);
    expect(await screen.findByRole("heading", { name: "暂时无法载入战绩" })).toBeInTheDocument();
    expect(screen.getByText(/已过期或被撤销/)).toBeInTheDocument();
  });

  it("clears all matches after confirmation", async () => {
    history.replaceState(null, "", `/history#${viewerToken}`);
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => response(204))
      .mockImplementationOnce(() => response(200, { matches }))
      .mockImplementationOnce(() => response(204))
      .mockImplementationOnce(() => response(204))
      .mockImplementationOnce(() => response(200, { matches: [] }));
    vi.stubGlobal("fetch", fetchMock);
    render(<HistoryClient />);
    await screen.findByRole("heading", { name: "我的云端战绩" });
    screen.getByRole("button", { name: "清空全部战绩" }).click();
    await waitFor(() => expect(screen.getByText("暂无记录。")).toBeInTheDocument());
    expect(confirmSpy).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/v1/match-history", expect.objectContaining({ method: "DELETE" }));
  });
});
