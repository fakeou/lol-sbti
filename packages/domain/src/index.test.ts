import { describe, expect, it } from "vitest";
import { createAnalysisFixture } from "@lol-sbti/test-fixtures";
import { aggregateMetricsV1, validateReportV1 } from "./index.js";

const reportFor = (metrics: ReturnType<typeof aggregateMetricsV1>) => ({
  resultVersion: 1 as const, typeCode: metrics.classification.typeCode,
  title: metrics.classification.typeCode === "unclassified" ? "暂未匹配称号" : "分析完成",
  confidence: 0.5,
  sample: { matchCount: metrics.sample.matchCount, queues: metrics.sample.queues, from: metrics.sample.from, to: metrics.sample.to },
  dimensions: metrics.classification.dimensions,
  summary: "基于聚合数据的分析报告。", strengths: [], risks: [], recommendations: [],
  limitations: ["本报告基于有限对局统计和 AI 生成，仅供娱乐参考。"], generatedAt: "2026-07-24T10:00:00Z"
});

describe("aggregateMetricsV1", () => {
  it("produces stable sample composition and common statistics", () => {
    const result = aggregateMetricsV1(createAnalysisFixture);
    expect(result.sample).toEqual({
      matchCount: 5, queues: [{ queueId: 420, count: 3 }, { queueId: 450, count: 2 }],
      modes: [{ gameMode: "ARAM", count: 2 }, { gameMode: "CLASSIC", count: 3 }],
      positions: [{ position: null, count: 1 }, { position: "BOTTOM", count: 1 }, { position: "JUNGLE", count: 1 }, { position: "MIDDLE", count: 1 }, { position: "TOP", count: 1 }],
      from: "2026-07-01T10:00:00Z", to: "2026-07-05T10:00:00Z"
    });
    expect(result.totals).toEqual({ wins: 3, kills: 20, deaths: 10, assists: 30, cs: 600, gold: 45000, championDamage: 70000, damageTaken: 59000, healing: 3500, visionScore: 80, wardsPlaced: 35, wardsKilled: 10 });
    expect(result.averages).toEqual({ winRate: 0.6, kda: 5, kills: 4, deaths: 2, assists: 6, csPerMinute: 5.4545, goldPerMinute: 409.0909, championDamagePerMinute: 636.3636, damageTakenPerMinute: 536.3636, visionScorePerMinute: 0.7273 });
  });

  it("computes per-match, variance, champion usage and primary position", () => {
    const result = aggregateMetricsV1(createAnalysisFixture);
    expect(result.perMatch).toHaveLength(5);
    expect(result.perMatch[0].kda).toBe(6);
    expect(result.perMatch[0].csPerMinute).toBe(5);
    expect(result.perMatch[4].kda).toBe(3.5);
    expect(result.variance.kda).toBeGreaterThan(0);
    expect(result.variance.championDamagePerMinute).toBeGreaterThan(0);
    expect(result.variance.csPerMinute).toBeGreaterThan(0);
    expect(result.championUsage).toHaveLength(5);
    expect(result.primaryPosition).toBeTruthy();
  });

  it("produces six deterministic dimensions with valid scores", () => {
    const result = aggregateMetricsV1(createAnalysisFixture);
    expect(result.classification.dimensions).toHaveLength(6);
    const codes = result.classification.dimensions.map(d => d.code);
    expect(codes).toEqual(["aggression", "teamwork", "consistency", "vision_control", "economy", "survivability"]);
    for (const dim of result.classification.dimensions) {
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(100);
      expect(dim.evidenceCodes.length).toBeGreaterThanOrEqual(1);
      expect(dim.explanation.length).toBeGreaterThan(0);
    }
  });

  it("returns unclassified for the default fixture with mixed positions and small sample", () => {
    expect(aggregateMetricsV1(createAnalysisFixture).classification.typeCode).toBe("unclassified");
  });

  it.each([5, 100])("accepts the %i-match boundary", (length) => {
    const request = { ...createAnalysisFixture, matches: Array.from({ length }, (_, index) => ({ ...createAnalysisFixture.matches[index % createAnalysisFixture.matches.length]! })) };
    expect(aggregateMetricsV1(request).sample.matchCount).toBe(length);
  });

  it("rejects zero duration and non-finite/out-of-range runtime input", () => {
    for (const durationSeconds of [0, Number.POSITIVE_INFINITY]) {
      const request = { ...createAnalysisFixture, matches: createAnalysisFixture.matches.map((match) => ({ ...match, durationSeconds })) };
      expect(() => aggregateMetricsV1(request)).toThrow("Contract validation failed");
    }
  });

  it("is stable when match order changes", () => {
    const a = aggregateMetricsV1(createAnalysisFixture);
    const b = aggregateMetricsV1({ ...createAnalysisFixture, matches: [...createAnalysisFixture.matches].reverse() });
    expect(a.sample).toEqual(b.sample);
    expect(a.totals).toEqual(b.totals);
    expect(a.averages).toEqual(b.averages);
    expect(a.classification.typeCode).toBe(b.classification.typeCode);
    expect(a.classification.dimensions).toEqual(b.classification.dimensions);
  });
});

describe("validateReportV1", () => {
  it("accepts a schema-valid report preserving deterministic fields", () => {
    const metrics = aggregateMetricsV1(createAnalysisFixture);
    expect(validateReportV1(reportFor(metrics), metrics).typeCode).toBe("unclassified");
  });

  it("rejects tampered type code and sample", () => {
    const metrics = aggregateMetricsV1(createAnalysisFixture); const report = reportFor(metrics);
    expect(() => validateReportV1({ ...report, typeCode: "other" }, metrics)).toThrow("typeCode does not match");
    expect(() => validateReportV1({ ...report, sample: { ...report.sample, matchCount: 6 } }, metrics)).toThrow("sample does not match");
    expect(() => validateReportV1({ ...report, sample: { ...report.sample, queues: [...report.sample.queues].reverse() } }, metrics)).toThrow("sample does not match");
    expect(() => validateReportV1({ ...report, sample: { ...report.sample, queues: [{ queueId: 420, count: 5 }] } }, metrics)).toThrow("sample does not match");
  });

  it("rejects tampered dimension scores, codes, evidence and count", () => {
    const metrics = aggregateMetricsV1(createAnalysisFixture); const report = reportFor(metrics);
    expect(() => validateReportV1({ ...report, dimensions: report.dimensions.map((d, i) => i === 0 ? { ...d, score: d.score + 1 } : d) }, metrics)).toThrow("score does not match");
    expect(() => validateReportV1({ ...report, dimensions: report.dimensions.map((d, i) => i === 0 ? { ...d, code: "tampered" } : d) }, metrics)).toThrow("code does not match");
    expect(() => validateReportV1({ ...report, dimensions: [...report.dimensions, { code: "extra", score: 50, evidenceCodes: ["x"], explanation: "extra" }] }, metrics)).toThrow("dimensions count");
    expect(() => validateReportV1({ ...report, dimensions: report.dimensions.slice(0, -1) }, metrics)).toThrow("dimensions count");
  });
});
