import type { CreateAnalysisRequestV1, UploadMatchV1 } from "@lol-sbti/contracts";

const match = (index: number): UploadMatchV1 => ({
  occurredAt: `2026-07-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
  queueId: index < 3 ? 420 : 450,
  gameMode: index < 3 ? "CLASSIC" : "ARAM",
  durationSeconds: 1200 + index * 60,
  championId: 10 + index,
  position: (["TOP", "JUNGLE", "MIDDLE", null, "BOTTOM"] as const)[index],
  won: index % 2 === 0,
  kills: index + 2,
  deaths: index,
  assists: index + 4,
  cs: 100 + index * 10,
  gold: 8000 + index * 500,
  championDamage: 12000 + index * 1000,
  damageTaken: 10000 + index * 900,
  healing: 500 + index * 100,
  visionScore: 10 + index * 3,
  wardsPlaced: 5 + index,
  wardsKilled: index,
  items: [1001, 2003]
});

export const createAnalysisFixture: CreateAnalysisRequestV1 = {
  schemaVersion: 1,
  locale: "zh-CN",
  generatedAt: "2026-07-24T10:00:00Z",
  clientVersion: "1.0.0",
  matches: Array.from({ length: 5 }, (_, index) => match(index))
};
