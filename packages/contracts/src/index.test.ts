import { describe, expect, it } from "vitest";
import { Value } from "@sinclair/typebox/value";
import { AnalysisStatusV1Schema, CreateAnalysisRequestV1Schema, CreateAnalysisResponseV1Schema, LbtiReportV1Schema, RecoverAnalysisRequestV1Schema, RecoverAnalysisResponseV1Schema } from "./index.js";

const match = { occurredAt: "2026-07-01T10:00:00Z", queueId: 420, gameMode: "CLASSIC", durationSeconds: 1200, championId: 1, position: "TOP", won: true, kills: 1, deaths: 2, assists: 3, cs: 100, gold: 8000, championDamage: 10000, damageTaken: 9000, healing: 100, visionScore: 10, wardsPlaced: 5, wardsKilled: 1, items: [1001] };
const createAnalysisFixture = { schemaVersion: 1, locale: "zh-CN", generatedAt: "2026-07-24T10:00:00Z", clientVersion: "1.0.0", matches: Array.from({ length: 5 }, () => match) };
const reportFixture = { resultVersion: 1, typeCode: "unclassified", title: "尚未分类", confidence: 0, sample: { matchCount: 5, queues: [{ queueId: 420, count: 5 }], from: "2026-07-01T10:00:00Z", to: "2026-07-05T10:00:00Z" }, dimensions: [], summary: "确定性统计", strengths: [], risks: [], recommendations: [], limitations: ["规则尚未定义"], generatedAt: "2026-07-24T10:00:00Z" };

describe("CreateAnalysisRequestV1Schema", () => {
  it("accepts 5 and 100 sanitized matches", () => { for (const length of [5, 100]) expect(Value.Check(CreateAnalysisRequestV1Schema, { ...createAnalysisFixture, matches: Array.from({ length }, () => match) })).toBe(true); });
  it("rejects unknown and identity fields", () => expect(Value.Check(CreateAnalysisRequestV1Schema, { ...createAnalysisFixture, puuid: "identity" })).toBe(false));
  it.each([4, 101])("rejects %i matches", (length) => expect(Value.Check(CreateAnalysisRequestV1Schema, { ...createAnalysisFixture, matches: Array.from({ length }, () => match) })).toBe(false));
  it("rejects unknown or identity fields inside matches", () => expect(Value.Check(CreateAnalysisRequestV1Schema, { ...createAnalysisFixture, matches: createAnalysisFixture.matches.map((value, index) => index ? value : { ...value, gameId: 123 }) })).toBe(false));
  it.each([0, Number.POSITIVE_INFINITY, Number.NaN])("rejects invalid duration %s", (durationSeconds) => expect(Value.Check(CreateAnalysisRequestV1Schema, { ...createAnalysisFixture, matches: createAnalysisFixture.matches.map((value) => ({ ...value, durationSeconds })) })).toBe(false));
  it.each(["2026-99-99T99:99Z", "2025-02-29T10:00:00Z", "2026-07-01T24:00:00Z", "2026-07-01T10:60:00Z"])("rejects invalid UTC time %s", (generatedAt) => expect(Value.Check(CreateAnalysisRequestV1Schema, { ...createAnalysisFixture, generatedAt })).toBe(false));
});

describe("analysis management contracts", () => {
  const created = { analysisId: "ana_1", status: "queued", receiptToken: "r".repeat(32), pollAfterMs: 2000, inputExpiresAt: "2026-07-24T11:00:00Z", managementExpiresAt: "2026-07-25T10:00:00Z" };
  it("requires a management expiry on create responses", () => {
    expect(Value.Check(CreateAnalysisResponseV1Schema, created)).toBe(true);
    const { managementExpiresAt: _, ...missing } = created;
    expect(Value.Check(CreateAnalysisResponseV1Schema, missing)).toBe(false);
  });
  it("strictly validates receipt recovery requests and responses", () => {
    expect(Value.Check(RecoverAnalysisRequestV1Schema, { idempotencyKey: "123e4567-e89b-42d3-a456-426614174000" })).toBe(true);
    expect(Value.Check(RecoverAnalysisRequestV1Schema, { idempotencyKey: "bad", payload: {} })).toBe(false);
    expect(Value.Check(RecoverAnalysisResponseV1Schema, { analysisId: "ana_1", receiptToken: "r".repeat(32), pollAfterMs: 2000, managementExpiresAt: "2026-07-25T10:00:00Z" })).toBe(true);
  });
});

describe("status and report schemas", () => {
  it("rejects unknown status fields, including nested fields", () => {
    expect(Value.Check(AnalysisStatusV1Schema, { analysisId: "id", status: "queued", pollAfterMs: 1000, extra: true })).toBe(false);
    expect(Value.Check(AnalysisStatusV1Schema, { analysisId: "id", status: "completed", share: { url: "https://example.test", expiresAt: "2026-07-24T10:00:00Z", extra: true } })).toBe(false);
  });
  it("rejects unknown report fields and non-finite or out-of-range numbers", () => {
    expect(Value.Check(LbtiReportV1Schema, { ...reportFixture, extra: true })).toBe(false);
    for (const confidence of [Number.NaN, Number.POSITIVE_INFINITY, -1, 2]) expect(Value.Check(LbtiReportV1Schema, { ...reportFixture, confidence })).toBe(false);
  });
  it.each([
    "[click](https://evil.example)",
    "<script>",
    "ok [label](javascript:alert(1))",
    "[click][x]\n\n[x]: https://evil.example",
    "[x]: https://evil.example"
  ])("rejects unsafe report text %s", (title) => expect(Value.Check(LbtiReportV1Schema, { ...reportFixture, title })).toBe(false));
  it("rejects reference links split across report text fields", () => expect(Value.Check(LbtiReportV1Schema, { ...reportFixture, title: "[click][x]", summary: "[x]: https://evil.example" })).toBe(false));
  it("rejects invalid report timestamps", () => expect(Value.Check(LbtiReportV1Schema, { ...reportFixture, generatedAt: "2026-99-99T99:99:99Z" })).toBe(false));
});
