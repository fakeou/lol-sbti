import { describe, expect, it } from "vitest";
import { createAnalysisFixture } from "@lol-sbti/test-fixtures";
import { aggregateMetricsV1, validateReportV1 } from "./index.js";

const reportFor = (metrics: ReturnType<typeof aggregateMetricsV1>) => ({
  resultVersion: 1 as const, typeCode: "unclassified", title: "尚未分类", confidence: 0,
  sample: { matchCount: metrics.sample.matchCount, queues: metrics.sample.queues, from: metrics.sample.from, to: metrics.sample.to }, dimensions: [],
  summary: "当前仅提供确定性统计。", strengths: [], risks: [], recommendations: [], limitations: ["称号规则尚未定义。"], generatedAt: "2026-07-24T10:00:00Z"
});

describe("aggregateMetricsV1", () => {
  it("produces stable sample composition and common statistics", () => {
    expect(aggregateMetricsV1(createAnalysisFixture)).toEqual({
      algorithmVersion: 1,
      sample: { matchCount: 5, queues: [{ queueId: 420, count: 3 }, { queueId: 450, count: 2 }], modes: [{ gameMode: "ARAM", count: 2 }, { gameMode: "CLASSIC", count: 3 }], positions: [{ position: null, count: 1 }, { position: "BOTTOM", count: 1 }, { position: "JUNGLE", count: 1 }, { position: "MIDDLE", count: 1 }, { position: "TOP", count: 1 }], from: "2026-07-01T10:00:00Z", to: "2026-07-05T10:00:00Z" },
      totals: { wins: 3, kills: 20, deaths: 10, assists: 30, cs: 600, gold: 45000, championDamage: 70000, damageTaken: 59000, healing: 3500, visionScore: 80, wardsPlaced: 35, wardsKilled: 10 },
      averages: { winRate: 0.6, kda: 5, kills: 4, deaths: 2, assists: 6, csPerMinute: 5.4545, goldPerMinute: 409.0909, championDamagePerMinute: 636.3636, damageTakenPerMinute: 536.3636, visionScorePerMinute: 0.7273 },
      classification: { typeCode: "unclassified", dimensions: [] }
    });
  });
  it.each([5, 100])("accepts the %i-match boundary", (length) => { const request = { ...createAnalysisFixture, matches: Array.from({ length }, (_, index) => ({ ...createAnalysisFixture.matches[index % createAnalysisFixture.matches.length]! })) }; expect(aggregateMetricsV1(request).sample.matchCount).toBe(length); });
  it("rejects zero duration and non-finite/out-of-range runtime input", () => {
    for (const durationSeconds of [0, Number.POSITIVE_INFINITY]) {
      const request = { ...createAnalysisFixture, matches: createAnalysisFixture.matches.map((match) => ({ ...match, durationSeconds })) };
      expect(() => aggregateMetricsV1(request)).toThrow("Contract validation failed");
    }
  });
  it("is stable when match order changes", () => expect(aggregateMetricsV1({ ...createAnalysisFixture, matches: [...createAnalysisFixture.matches].reverse() })).toEqual(aggregateMetricsV1(createAnalysisFixture)));
});

describe("validateReportV1", () => {
  it("accepts a schema-valid report preserving deterministic fields", () => { const metrics = aggregateMetricsV1(createAnalysisFixture); expect(validateReportV1(reportFor(metrics), metrics).typeCode).toBe("unclassified"); });
  it("rejects tampered type code, sample size, and full queue composition", () => {
    const metrics = aggregateMetricsV1(createAnalysisFixture); const report = reportFor(metrics);
    expect(() => validateReportV1({ ...report, typeCode: "other" }, metrics)).toThrow("typeCode does not match");
    expect(() => validateReportV1({ ...report, sample: { ...report.sample, matchCount: 6 } }, metrics)).toThrow("sample does not match");
    expect(() => validateReportV1({ ...report, sample: { ...report.sample, queues: [...report.sample.queues].reverse() } }, metrics)).toThrow("sample does not match");
    expect(() => validateReportV1({ ...report, sample: { ...report.sample, queues: [{ queueId: 420, count: 5 }] } }, metrics)).toThrow("sample does not match");
  });
  it("rejects deterministic dimensions from the model", () => { const metrics = aggregateMetricsV1(createAnalysisFixture); expect(() => validateReportV1({ ...reportFor(metrics), dimensions: [{ code: "x", score: 50, evidenceCodes: ["kda"], explanation: "x" }] }, metrics)).toThrow("dimensions must remain empty"); });
});
