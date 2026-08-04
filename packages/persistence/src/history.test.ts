import {describe,expect,it} from "vitest";
import {MemoryRepository} from "./memory.js";

describe("cloud match history", () => {
  const match = (matchKey: string, occurredAt: string) => ({ matchKey, occurredAt: new Date(occurredAt), payload: { matchKey, occurredAt, championId: 1 } });
  it("deduplicates by match key and lists newest first", async () => {
    const repo = new MemoryRepository();
    await repo.createInstallation("i", "credential");
    expect(await repo.saveMatches("i", [match("a".repeat(64), "2026-07-01T10:00:00Z"), match("b".repeat(64), "2026-07-02T10:00:00Z")])).toBe(2);
    expect(await repo.saveMatches("i", [match("a".repeat(64), "2026-07-01T10:00:00Z")])).toBe(0);
    const viewer = await repo.createHistoryViewer("i");
    expect(viewer.length).toBeGreaterThanOrEqual(32);
    expect(await repo.createHistorySession(viewer, "session-token", new Date(Date.now() + 60_000))).toBe("created");
    const result = await repo.getMatchesBySession("session-token");
    expect(result?.installationId).toBe("i");
    expect(result?.matches.map((item) => (item as { occurredAt: string }).occurredAt)).toEqual(["2026-07-02T10:00:00Z", "2026-07-01T10:00:00Z"]);
  });
  it("rejects revoked or expired viewers and sessions", async () => {
    const repo = new MemoryRepository();
    await repo.createInstallation("i", "credential");
    const viewer = await repo.createHistoryViewer("i");
    expect(await repo.createHistorySession(viewer, "token", new Date(Date.now() - 1000))).toBe("created");
    expect(await repo.getMatchesBySession("token")).toBeUndefined();
    expect(await repo.deleteMatchesBySession("token")).toBe(false);
    const viewer2 = await repo.createHistoryViewer("i");
    expect(await repo.createHistorySession(viewer2, "token2", new Date(Date.now() + 60_000))).toBe("created");
    await repo.revokeHistoryViewer("i");
    expect(await repo.getMatchesBySession("token2")).toBeUndefined();
  });
  it("clears matches via session", async () => {
    const repo = new MemoryRepository();
    await repo.createInstallation("i", "credential");
    await repo.saveMatches("i", [match("a".repeat(64), "2026-07-01T10:00:00Z")]);
    const viewer = await repo.createHistoryViewer("i");
    await repo.createHistorySession(viewer, "token", new Date(Date.now() + 60_000));
    expect((await repo.getMatchesBySession("token"))?.matches).toHaveLength(1);
    expect(await repo.deleteMatchesBySession("token")).toBe(true);
    expect((await repo.getMatchesBySession("token"))?.matches).toHaveLength(0);
    expect(await repo.deleteMatchesBySession("token")).toBe(true);
  });
});
