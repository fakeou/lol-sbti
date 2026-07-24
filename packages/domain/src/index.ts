import { CreateAnalysisRequestV1Schema, LbtiReportV1Schema, assertSchema, type CreateAnalysisRequestV1, type LbtiReportV1 } from "@lol-sbti/contracts";

export interface AggregateMetricsV1 {
  algorithmVersion: 1;
  sample: { matchCount: number; queues: Array<{ queueId: number; count: number }>; modes: Array<{ gameMode: string; count: number }>; positions: Array<{ position: string | null; count: number }>; from: string; to: string };
  totals: { wins: number; kills: number; deaths: number; assists: number; cs: number; gold: number; championDamage: number; damageTaken: number; healing: number; visionScore: number; wardsPlaced: number; wardsKilled: number };
  averages: { winRate: number; kda: number; kills: number; deaths: number; assists: number; csPerMinute: number; goldPerMinute: number; championDamagePerMinute: number; damageTakenPerMinute: number; visionScorePerMinute: number };
  classification: { typeCode: "unclassified"; dimensions: [] };
}

const round = (value: number) => Math.round(value * 10000) / 10000;
const countBy = <T>(values: T[], key: (value: T) => string) => [...values.reduce((map, value) => map.set(key(value), (map.get(key(value)) ?? 0) + 1), new Map<string, number>())].sort(([a], [b]) => a.localeCompare(b));

export function aggregateMetricsV1(request: CreateAnalysisRequestV1): AggregateMetricsV1 {
  assertSchema(CreateAnalysisRequestV1Schema, request);
  const totals = request.matches.reduce((sum, match) => ({
    wins: sum.wins + Number(match.won), kills: sum.kills + match.kills, deaths: sum.deaths + match.deaths, assists: sum.assists + match.assists,
    cs: sum.cs + match.cs, gold: sum.gold + match.gold, championDamage: sum.championDamage + match.championDamage, damageTaken: sum.damageTaken + match.damageTaken,
    healing: sum.healing + match.healing, visionScore: sum.visionScore + match.visionScore, wardsPlaced: sum.wardsPlaced + match.wardsPlaced, wardsKilled: sum.wardsKilled + match.wardsKilled
  }), { wins: 0, kills: 0, deaths: 0, assists: 0, cs: 0, gold: 0, championDamage: 0, damageTaken: 0, healing: 0, visionScore: 0, wardsPlaced: 0, wardsKilled: 0 });
  const minutes = request.matches.reduce((sum, match) => sum + match.durationSeconds, 0) / 60;
  const count = request.matches.length;
  const dates = request.matches.map(({ occurredAt }) => occurredAt).sort();
  return {
    algorithmVersion: 1,
    sample: {
      matchCount: count,
      queues: countBy(request.matches, ({ queueId }) => String(queueId)).map(([queueId, amount]) => ({ queueId: Number(queueId), count: amount })),
      modes: countBy(request.matches, ({ gameMode }) => gameMode).map(([gameMode, amount]) => ({ gameMode, count: amount })),
      positions: countBy(request.matches, ({ position }) => position ?? "").map(([position, amount]) => ({ position: position || null, count: amount })),
      from: dates[0]!, to: dates.at(-1)!
    },
    totals,
    averages: { winRate: round(totals.wins / count), kda: round((totals.kills + totals.assists) / Math.max(1, totals.deaths)), kills: round(totals.kills / count), deaths: round(totals.deaths / count), assists: round(totals.assists / count), csPerMinute: round(totals.cs / minutes), goldPerMinute: round(totals.gold / minutes), championDamagePerMinute: round(totals.championDamage / minutes), damageTakenPerMinute: round(totals.damageTaken / minutes), visionScorePerMinute: round(totals.visionScore / minutes) },
    classification: { typeCode: "unclassified", dimensions: [] }
  };
}

export class ReportInvariantError extends Error { constructor(message: string) { super(message); this.name = "ReportInvariantError"; } }

export function validateReportV1(report: unknown, metrics: AggregateMetricsV1): LbtiReportV1 {
  assertSchema(LbtiReportV1Schema, report);
  if (report.typeCode !== metrics.classification.typeCode) throw new ReportInvariantError("typeCode does not match deterministic classification");
  if (report.sample.matchCount !== metrics.sample.matchCount || report.sample.from !== metrics.sample.from || report.sample.to !== metrics.sample.to || JSON.stringify(report.sample.queues) !== JSON.stringify(metrics.sample.queues)) throw new ReportInvariantError("sample does not match deterministic metrics");
  if (report.dimensions.length !== 0) throw new ReportInvariantError("dimensions must remain empty while classification is unclassified");
  return report;
}
