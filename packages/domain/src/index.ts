import { CreateAnalysisRequestV1Schema, LbtiReportV1Schema, assertSchema, type CreateAnalysisRequestV1, type LbtiReportV1 } from "@lol-sbti/contracts";

export interface PerMatchMetrics {
  kda: number;
  csPerMinute: number;
  goldPerMinute: number;
  championDamagePerMinute: number;
  damageTakenPerMinute: number;
  visionScorePerMinute: number;
  durationMinutes: number;
  kills: number;
  deaths: number;
  assists: number;
  championDamage: number;
  damageTaken: number;
  healing: number;
  visionScore: number;
  wardsPlaced: number;
  won: boolean;
  championId: number;
  position: string | null;
  gameMode: string;
}

export interface DimensionResult {
  code: string;
  score: number;
  evidenceCodes: string[];
  explanation: string;
}

export interface ClassificationResult {
  typeCode: string;
  dimensions: DimensionResult[];
}

export interface AggregateMetricsV1 {
  algorithmVersion: 1;
  sample: { matchCount: number; queues: Array<{ queueId: number; count: number }>; modes: Array<{ gameMode: string; count: number }>; positions: Array<{ position: string | null; count: number }>; from: string; to: string };
  totals: { wins: number; kills: number; deaths: number; assists: number; cs: number; gold: number; championDamage: number; damageTaken: number; healing: number; visionScore: number; wardsPlaced: number; wardsKilled: number };
  averages: { winRate: number; kda: number; kills: number; deaths: number; assists: number; csPerMinute: number; goldPerMinute: number; championDamagePerMinute: number; damageTakenPerMinute: number; visionScorePerMinute: number };
  perMatch: PerMatchMetrics[];
  variance: { kda: number; championDamagePerMinute: number; csPerMinute: number };
  championUsage: Array<{ championId: number; count: number }>;
  primaryPosition: string | null;
  classification: ClassificationResult;
}

const round = (value: number) => Math.round(value * 10000) / 10000;
const clampInt = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const countBy = <T>(values: T[], key: (value: T) => string) => [...values.reduce((map, value) => map.set(key(value), (map.get(key(value)) ?? 0) + 1), new Map<string, number>())].sort(([a], [b]) => a.localeCompare(b));
const populationVariance = (values: number[]) => { if (values.length === 0) return 0; const mean = values.reduce((a, b) => a + b, 0) / values.length; return values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length; };
const fmt = (value: number) => Math.round(value * 10) / 10;
const ALISTAR_ID = 12;

export function aggregateMetricsV1(request: CreateAnalysisRequestV1): AggregateMetricsV1 {
  assertSchema(CreateAnalysisRequestV1Schema, request);
  const matches = request.matches;
  const count = matches.length;

  const totals = matches.reduce((sum, m) => ({
    wins: sum.wins + Number(m.won), kills: sum.kills + m.kills, deaths: sum.deaths + m.deaths, assists: sum.assists + m.assists,
    cs: sum.cs + m.cs, gold: sum.gold + m.gold, championDamage: sum.championDamage + m.championDamage, damageTaken: sum.damageTaken + m.damageTaken,
    healing: sum.healing + m.healing, visionScore: sum.visionScore + m.visionScore, wardsPlaced: sum.wardsPlaced + m.wardsPlaced, wardsKilled: sum.wardsKilled + m.wardsKilled
  }), { wins: 0, kills: 0, deaths: 0, assists: 0, cs: 0, gold: 0, championDamage: 0, damageTaken: 0, healing: 0, visionScore: 0, wardsPlaced: 0, wardsKilled: 0 });

  const minutes = matches.reduce((sum, m) => sum + m.durationSeconds, 0) / 60;
  const dates = matches.map(({ occurredAt }) => occurredAt).sort();
  const averages = {
    winRate: round(totals.wins / count), kda: round((totals.kills + totals.assists) / Math.max(1, totals.deaths)),
    kills: round(totals.kills / count), deaths: round(totals.deaths / count), assists: round(totals.assists / count),
    csPerMinute: round(totals.cs / minutes), goldPerMinute: round(totals.gold / minutes),
    championDamagePerMinute: round(totals.championDamage / minutes), damageTakenPerMinute: round(totals.damageTaken / minutes),
    visionScorePerMinute: round(totals.visionScore / minutes)
  };

  const perMatch: PerMatchMetrics[] = matches.map(m => {
    const durMin = m.durationSeconds / 60;
    return {
      kda: round((m.kills + m.assists) / Math.max(1, m.deaths)), csPerMinute: round(m.cs / durMin), goldPerMinute: round(m.gold / durMin),
      championDamagePerMinute: round(m.championDamage / durMin), damageTakenPerMinute: round(m.damageTaken / durMin), visionScorePerMinute: round(m.visionScore / durMin),
      durationMinutes: round(durMin), kills: m.kills, deaths: m.deaths, assists: m.assists, championDamage: m.championDamage, damageTaken: m.damageTaken,
      healing: m.healing, visionScore: m.visionScore, wardsPlaced: m.wardsPlaced, won: m.won, championId: m.championId, position: m.position, gameMode: m.gameMode
    };
  });

  const variance = {
    kda: round(populationVariance(perMatch.map(m => m.kda))),
    championDamagePerMinute: round(populationVariance(perMatch.map(m => m.championDamagePerMinute))),
    csPerMinute: round(populationVariance(perMatch.map(m => m.csPerMinute)))
  };

  const championUsage = countBy(matches, ({ championId }) => String(championId)).map(([id, cnt]) => ({ championId: Number(id), count: cnt }));

  const positionMap = new Map<string, number>();
  for (const m of matches) { if (m.position) positionMap.set(m.position, (positionMap.get(m.position) ?? 0) + 1); }
  const sortedPositions = [...positionMap.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const primaryPosition = sortedPositions.length > 0 ? sortedPositions[0][0] : null;

  const sample = {
    matchCount: count,
    queues: countBy(matches, ({ queueId }) => String(queueId)).map(([queueId, amount]) => ({ queueId: Number(queueId), count: amount })),
    modes: countBy(matches, ({ gameMode }) => gameMode).map(([gameMode, amount]) => ({ gameMode, count: amount })),
    positions: countBy(matches, ({ position }) => position ?? "").map(([position, amount]) => ({ position: position || null, count: amount })),
    from: dates[0]!, to: dates.at(-1)!
  };

  const kdaStdev = Math.sqrt(variance.kda);
  const dimensions = scoreDimensions(averages, kdaStdev, perMatch);
  const typeCode = classifyTitle({ count, averages, perMatch, variance, kdaStdev, championUsage, primaryPosition, winRate: averages.winRate });

  return { algorithmVersion: 1, sample, totals, averages, perMatch, variance, championUsage, primaryPosition, classification: { typeCode, dimensions } };
}

function scoreDimensions(avg: AggregateMetricsV1["averages"], kdaStdev: number, perMatch: PerMatchMetrics[]): DimensionResult[] {
  const avgWards = perMatch.reduce((sum, m) => sum + m.wardsPlaced, 0) / perMatch.length;
  return [
    { code: "aggression", score: clampInt(avg.kills * 8 + avg.championDamagePerMinute * 0.04), evidenceCodes: ["avg_kills", "avg_damage_per_min"], explanation: `场均击杀 ${fmt(avg.kills)}，每分钟伤害 ${fmt(avg.championDamagePerMinute)}` },
    { code: "teamwork", score: clampInt(avg.assists * 5 + avg.visionScorePerMinute * 30), evidenceCodes: ["avg_assists", "avg_vision_per_min"], explanation: `场均助攻 ${fmt(avg.assists)}，每分钟视野 ${fmt(avg.visionScorePerMinute)}` },
    { code: "consistency", score: clampInt(100 - kdaStdev * 15), evidenceCodes: ["kda_stdev"], explanation: `KDA 波动标准差 ${fmt(kdaStdev)}` },
    { code: "vision_control", score: clampInt(avg.visionScorePerMinute * 40 + avgWards * 3), evidenceCodes: ["avg_vision_per_min", "avg_wards_placed"], explanation: `每分钟视野 ${fmt(avg.visionScorePerMinute)}，场均插眼 ${fmt(avgWards)}` },
    { code: "economy", score: clampInt(avg.csPerMinute * 7 + avg.goldPerMinute * 0.06), evidenceCodes: ["avg_cs_per_min", "avg_gold_per_min"], explanation: `每分钟补刀 ${fmt(avg.csPerMinute)}，每分钟金币 ${fmt(avg.goldPerMinute)}` },
    { code: "survivability", score: clampInt(100 - avg.deaths * 8), evidenceCodes: ["avg_deaths"], explanation: `场均死亡 ${fmt(avg.deaths)}` }
  ];
}

interface ClassificationInput {
  count: number; averages: AggregateMetricsV1["averages"]; perMatch: PerMatchMetrics[];
  variance: AggregateMetricsV1["variance"]; kdaStdev: number;
  championUsage: Array<{ championId: number; count: number }>; primaryPosition: string | null; winRate: number;
}

function classifyTitle(input: ClassificationInput): string {
  const { count, averages, perMatch, kdaStdev, championUsage, primaryPosition, winRate } = input;
  const alistarMatches = championUsage.find(c => c.championId === ALISTAR_ID)?.count ?? 0;
  const distinctChampions = championUsage.length;
  const avgDurationMinutes = perMatch.reduce((sum, m) => sum + m.durationMinutes, 0) / perMatch.length;
  const matchesWith = (predicate: (m: PerMatchMetrics) => boolean) => perMatch.filter(predicate).length;

  const rules: Array<{ id: string; test: () => boolean }> = [
    { id: "yyds", test: () => count >= 5 && matchesWith(m => m.kills >= 10 && m.deaths <= 1 && m.won && m.championDamagePerMinute >= 1000) >= 1 },
    { id: "tianshen-xiafan", test: () => count >= 5 && matchesWith(m => m.kills >= 8 && m.deaths <= 2 && m.won && m.championDamagePerMinute >= 800) >= 1 },
    { id: "tiger-general", test: () => primaryPosition === "MIDDLE" && count >= 10 && averages.kills >= 6 && averages.championDamagePerMinute >= 750 && winRate >= 0.55 },
    { id: "best-top", test: () => primaryPosition === "TOP" && count >= 10 && averages.kda >= 4.0 && averages.championDamagePerMinute >= 700 && winRate >= 0.55 },
    { id: "left-hand", test: () => primaryPosition === "MIDDLE" && count >= 15 && averages.csPerMinute >= 7.0 && averages.championDamagePerMinute >= 650 && averages.kda >= 3.5 },
    { id: "369-dice", test: () => primaryPosition === "TOP" && count >= 15 && kdaStdev >= 2.5 },
    { id: "radar-bro", test: () => primaryPosition === "JUNGLE" && count >= 10 && averages.visionScorePerMinute >= 1.0 && averages.deaths <= 3.0 },
    { id: "protect-country-cow", test: () => primaryPosition === "UTILITY" && alistarMatches >= 3 && averages.deaths <= 4 && count >= 10 },
    { id: "jue-shi-liu", test: () => primaryPosition === "JUNGLE" && count >= 10 && averages.csPerMinute <= 3.5 && averages.visionScorePerMinute >= 0.7 && averages.deaths <= 5 },
    { id: "miracle-walker", test: () => primaryPosition === "JUNGLE" && count >= 10 && averages.csPerMinute >= 6.0 && averages.kda <= 2.5 && averages.assists <= 5 },
    { id: "4396", test: () => primaryPosition === "JUNGLE" && count >= 10 && averages.championDamagePerMinute <= 300 && avgDurationMinutes >= 20 },
    { id: "2200", test: () => primaryPosition === "MIDDLE" && count >= 5 && matchesWith(m => m.championDamage <= 5000 && m.durationMinutes >= 25) >= 1 },
    { id: "explode-ad", test: () => primaryPosition === "BOTTOM" && count >= 10 && averages.deaths >= 6.0 },
    { id: "red-warm", test: () => count >= 10 && matchesWith(m => m.deaths >= 6 && m.kills <= 2) >= 2 },
    { id: "crazy-cow", test: () => primaryPosition === "UTILITY" && alistarMatches >= 3 && averages.deaths >= 6.0 && averages.kda <= 2.0 && count >= 10 },
    { id: "gnar-bible", test: () => primaryPosition === "TOP" && count >= 15 && distinctChampions <= 4 && (averages.csPerMinute <= 4.0 || averages.championDamagePerMinute <= 400) }
  ];

  for (const rule of rules) { if (rule.test()) return rule.id; }
  return "unclassified";
}

export class ReportInvariantError extends Error { constructor(message: string) { super(message); this.name = "ReportInvariantError"; } }

export function validateReportV1(report: unknown, metrics: AggregateMetricsV1): LbtiReportV1 {
  assertSchema(LbtiReportV1Schema, report);
  if (report.typeCode !== metrics.classification.typeCode) throw new ReportInvariantError("typeCode does not match deterministic classification");
  if (report.sample.matchCount !== metrics.sample.matchCount || report.sample.from !== metrics.sample.from || report.sample.to !== metrics.sample.to || JSON.stringify(report.sample.queues) !== JSON.stringify(metrics.sample.queues)) throw new ReportInvariantError("sample does not match deterministic metrics");
  const expected = metrics.classification.dimensions;
  if (report.dimensions.length !== expected.length) throw new ReportInvariantError("dimensions count does not match deterministic classification");
  for (let i = 0; i < expected.length; i++) {
    if (report.dimensions[i].code !== expected[i].code) throw new ReportInvariantError(`dimension ${i} code does not match`);
    if (report.dimensions[i].score !== expected[i].score) throw new ReportInvariantError(`dimension ${i} score does not match`);
    if (JSON.stringify(report.dimensions[i].evidenceCodes) !== JSON.stringify(expected[i].evidenceCodes)) throw new ReportInvariantError(`dimension ${i} evidenceCodes do not match`);
  }
  return report;
}
