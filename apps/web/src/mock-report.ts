import type { LbtiReportV1 } from "@lol-sbti/contracts";

const generatedAt = "2026-07-28T12:00:00Z";

export const mockReport: LbtiReportV1 = {
  resultVersion: 1,
  typeCode: "TACTICIAN",
  title: "冷静的战术执行者",
  confidence: 0.78,
  sample: {
    matchCount: 50,
    queues: [
      { queueId: 420, count: 32 },
      { queueId: 440, count: 12 },
      { queueId: 450, count: 6 }
    ],
    from: "2026-06-28T00:00:00Z",
    to: "2026-07-28T00:00:00Z"
  },
  dimensions: [
    { code: "survival", score: 74, evidenceCodes: ["death_rate", "late_game_kda"], explanation: "你会把不必要的阵亡压低到可控范围，逆风时也会优先保住关键发育与团战位置。" },
    { code: "economy", score: 81, evidenceCodes: ["gold_per_minute", "cs_per_minute"], explanation: "你的补刀与资源转化较稳定，能把安全时间尽量换成装备成型速度。" },
    { code: "damage", score: 68, evidenceCodes: ["damage_share", "damage_per_minute"], explanation: "你会在确认资源和人数优势后果断跟进，让输出更集中地转化为有效团战收益。" },
    { code: "vision", score: 91, evidenceCodes: ["vision_score", "wards_placed"], explanation: "你的视野投入明显高于样本平均水平，能为队友提供相对清晰的行动空间。" },
    { code: "teamwork", score: 86, evidenceCodes: ["kill_participation", "objective_assists"], explanation: "你常能在小龙、先锋和推进节点与队友同步，团战中的参与率保持稳定。" }
  ],
  summary: "你更像一名以信息和节奏为核心的执行者：先稳住资源与阵型，再把优势转化为可持续的团队推进。",
  strengths: ["能在资源团前提前布置视野，降低队伍决策的不确定性。", "优势局不急于冒险，擅长把经济领先转成防御塔和中立资源。", "团战中关注队友位置，关键时刻的跟进和保护较为及时。"],
  risks: ["过度等待完整信息时，可能错过对手技能真空期的进攻窗口。", "逆风局倾向于保守清线，较少主动制造人数差机会。", "连续失利后对线期的换血意愿会明显下降。"],
  recommendations: ["下一局在第一条小龙刷新前 90 秒和队友共同规划河道视野。", "确认敌方关键控制技能进入冷却后，用一次小规模进攻测试对方的应对。", "逆风时选择一条安全边线补经济，同时提前标记下一处可争夺的资源。"],
  limitations: ["报告仅基于近期 50 场可读取对局，不能代表所有游戏习惯。", "不同英雄、位置和组队情况会显著影响这些指标。"],
  generatedAt
};

export const sparseMockReport: LbtiReportV1 = {
  ...mockReport,
  typeCode: "FLEX",
  title: "仍在成型的多面手",
  confidence: 0.43,
  dimensions: [],
  strengths: [],
  risks: [],
  recommendations: [],
  limitations: ["这个变体用于调试数据不足时的页面状态。"],
  generatedAt
};
