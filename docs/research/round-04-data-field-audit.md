# Round 04 — 字段可用性审计：代码级逐项验证

> **状态**: Final
> **轮次**: Explorer Round 4 — 数据字段可用性审计
> **审计日期**: 2026-07-24
> **审计目标**: 核对 round-03-safe-computable-funnel.md 中 43 个 A/B 候选称号的触发字段在**当前代码与 LCU 接口**中的真实可获取性
> **审计方法**: 逐项对照 `apps/desktop/src-tauri/src/main.rs` 中的 CsvMatch 结构体、LCU 接口调用链、以及 `docs/architecture/api-and-jobs.md` 中的 UploadMatchV1 契约
> **原则**: 不假设任何字段存在；只认代码中实际提取、LCU 接口实际返回的数据；区分"CSV 已有"、"可由 CSV 推导"、"需外部静态引用表"、"需 LCU 未调用接口"、"完全不可获取"
>
> **前置文档**: GAP-C1/GAP-C2 已在 round-03-audit-gaps.md Verifier 轮中识别（champion_id 框架缺失 + 5/43 依赖未定义字段）。本轮的增量贡献是**代码级证实**：给出具体文件路径、行号、LCU endpoint 调用链证据，并**淘汰 8 个依赖不可获取字段的 A/B 候选**，**标记 5 个需外部引用表才能完整计算的候选**。

---

## 0. 审计基准：当前代码实际产出的字段

### 0.1 CsvMatch 结构体（main.rs:71-93）

代码证据文件: [`apps/desktop/src-tauri/src/main.rs`](../../apps/desktop/src-tauri/src/main.rs)

```rust
// main.rs:71-93
struct CsvMatch {
    match_time: String,                     // gameCreation → 格式化时间
    queue: String,                          // queueId → queue_name()
    game_mode: String,                      // gameMode 字符串
    result: String,                         // stats.win → "胜利"/"失败"
    champion: String,                       // championId → champion_names()
    kills: i64,                             // stats.kills
    deaths: i64,                            // stats.deaths
    assists: i64,                           // stats.assists
    kill_participation_percent: Option<f64>,// 计算：(kills+assists)/team_kills
    cs: i64,                                // totalMinionsKilled + neutralMinionsKilled
    gold: i64,                              // stats.goldEarned
    champion_damage: i64,                   // stats.totalDamageDealtToChampions
    damage_share_percent: Option<f64>,      // 计算：champion_damage/team_damage
    damage_taken: i64,                      // stats.totalDamageTaken
    healing: i64,                           // stats.totalHeal
    vision_score: i64,                      // stats.visionScore
    wards_placed: i64,                      // stats.wardsPlaced
    wards_killed: i64,                      // stats.wardsKilled
    position: String,                       // timeline.lane + "/" + timeline.role
    items: String,                          // item0-6 的 ID，管道分隔
    duration_minutes: f64,                  // gameDuration / 60
}
```

### 0.2 当前调用的 LCU 接口（main.rs 代码证据）

| # | 接口路径 | 调用位置 | 用途 |
|---|----------|----------|------|
| 1 | `GET /lol-summoner/v1/current-summoner` | main.rs:234 | 获取当前用户 puuid、gameName、tagLine、accountId、summonerId |
| 2 | `GET /lol-match-history/v1/products/lol/{puuid}/matches?begIndex={n}&endIndex={m}` | main.rs:425-428 | 分页获取对局历史列表 |
| 3 | `GET /lol-match-history/v1/games/{gameId}` | main.rs:490-491 | 获取单场对局详情（用于计算 team_kills/team_damage） |
| 4 | `GET /lol-game-data/assets/v1/champion-summary.json` | main.rs:299-300 | 获取 championId → champion name 映射 |

### 0.3 UploadMatchV1 契约字段（api-and-jobs.md:24-44）

```typescript
// api-and-jobs.md:24-44
type UploadMatchV1 = {
  occurredAt: string; queueId: number; gameMode: string;
  durationSeconds: number; championId: number; position: string | null;
  won: boolean; kills: number; deaths: number; assists: number;
  cs: number; gold: number; championDamage: number; damageTaken: number;
  healing: number; visionScore: number; wardsPlaced: number; wardsKilled: number;
  items: number[];
};
```

### 0.4 当前代码未调用但 LCU 可能存在的接口

| 接口 | 状态 | 可能提供的字段 |
|------|:----:|---------------|
| `/lol-ranked/v1/current-ranked-stats` | **未调用** | 当前段位（tier/division/leaguePoints） |
| `/lol-summoner/v1/summoner-profile` | **未调用** | summonerLevel、profileIconId |
| `/lol-match-history/v1/games/{gameId}` (更完整提取) | **已调用但未提取全部字段** | multiKill 统计、firstBlood、damage 细分、CC 分、summoner spells、runes、团队目标（dragon/baron/tower） |

### 0.5 确认不可获取的数据类型

以下数据类型在当前 LCU 接口中**不存在**（非"未提取"而是根本不在接口返回中）：

| 数据类型 | 证据 | 影响的候选 |
|----------|------|-----------|
| **对手持久化标识（opponent_id）** | LCU match history 的 participantIdentities 仅含 puuid/accountId/summonerId，无跨对局追踪能力。不存储原始 ID 是硬性脱敏要求（README.md:15） | 丞相、孟获 |
| **对手段位/MMR（对局时刻）** | match detail 返回的 participants 不含 rank/tier/division | 翻山、北伐 |
| **历史段位数据** | LCU 只提供当前 ranked stats，不提供历史段位 | 骑士归来 |
| **账号注册时间** | `/lol-summoner/v1/current-summoner` 不返回创建日期 | 御三家 |
| **晋级赛/保段赛标志** | match detail 不含 promo series 标记 | 燃烧自己 |
| **团灭/ACE 事件** | match detail 的 participants 仅含聚合 stats（deaths 总数），不含死亡时间线。teams 数组可能有团队 KDA 但无"同时死亡"事件 | 永不团灭 |
| **版本 meta 数据（T1/T2 英雄）** | 非 LCU 数据，属外部动态数据源 | 圣枪哥、纳尔圣经 |

---

## 1. 字段可用性矩阵

### 1.1 LCU 原始字段（单场，直接从 JSON 读取）

| 字段 | CSV 列名 | 代码行号 | 数据类型 | 覆盖率（probe） |
|------|----------|----------|----------|:--------------:|
| gameCreation | match_time | main.rs:357-362 | i64 (ms timestamp) | — |
| queueId | queue | main.rs:382, 287-296 | i64 → 映射名 | — |
| gameMode | game_mode | main.rs:384-388 | string | — |
| gameDuration | duration_minutes | main.rs:415 | i64 (seconds) → f64 | 100% |
| stats.win | result | main.rs:389-393 | bool → "胜利"/"失败" | 100% |
| championId | champion | main.rs:362-365, 395-397 | i64 → champion name | 100% |
| stats.kills | kills | main.rs:353, 398 | i64 | 100% |
| stats.deaths | deaths | main.rs:399 | i64 | 100% |
| stats.assists | assists | main.rs:400 | i64 | 100% |
| stats.totalMinionsKilled | cs (part) | main.rs:403 | i64 | 100% |
| stats.neutralMinionsKilled | cs (part) | main.rs:403 | i64 | 100% |
| stats.goldEarned | gold | main.rs:404 | i64 | 100% |
| stats.totalDamageDealtToChampions | champion_damage | main.rs:355, 405 | i64 | 100% |
| stats.totalDamageTaken | damage_taken | main.rs:408 | i64 | 100% |
| stats.totalHeal | healing | main.rs:409 | i64 | 100% |
| stats.visionScore | vision_score | main.rs:410 | i64 | 100% |
| stats.wardsPlaced | wards_placed | main.rs:411 | i64 | 100% |
| stats.wardsKilled | wards_killed | main.rs:412 | i64 | 100% |
| timeline.lane | position (part) | main.rs:367 | string | 100% |
| timeline.role | position (part) | main.rs:368 | string | 100% |
| stats.item0–item6 | items | main.rs:374-379 | i64[] → pipe-separated IDs | 100% |
| participantIdentities[].player | (匹配用，不入 CSV) | main.rs:261-277 | puuid/accountId/summonerId | — |
| participant.teamId | (计算用，不入 CSV) | main.rs:328 | i64 | — |

> 覆盖率数据来源：`lcu-probe-report.json:16-31` — 35 场对局全部覆盖，MVP_PASS。

### 1.2 可聚合推导的跨场指标

以下指标由 CSV 单场字段经多场聚合计算得出，**不需额外数据源**：

| 聚合指标 | 所需 CSV 字段 | 计算方式 |
|----------|--------------|----------|
| `kda` (单场) | kills, deaths, assists | (kills+assists)/max(deaths,1) |
| `avg_kda` | kills, deaths, assists | avg(kda) over N matches |
| `kda_variance` | kills, deaths, assists | stddev(kda) over N matches |
| `damage_per_min` (单场) | champion_damage, duration_minutes | damage/minutes |
| `damage_per_min_avg` | champion_damage, duration_minutes | avg(dpm) over N matches |
| `cs_per_min` (单场) | cs, duration_minutes | cs/minutes |
| `cs_per_min_avg` | cs, duration_minutes | avg(cspm) over N matches |
| `win_rate` | result | count(胜利)/total |
| `avg_kills` / `avg_deaths` / `avg_assists` | kills, deaths, assists | avg over N matches |
| `damage_share_variance` | damage_share_percent | stddev over N matches |
| `kill_participation_variance` | kill_participation_percent | stddev over N matches |
| `win_streak` / `loss_streak` | result (time-ordered) | 连续相同 result 计数 |
| `hero_pool_size` | champion (distinct count) | count(distinct champion) |
| `champion_win_rate` | champion, result | per-champion 胜率 |
| `tilt_score` (KDA decay after losses) | result, kills, deaths, assists (time-ordered) | 败后 KDA 变化率 |

### 1.3 需外部静态引用表的字段

| 数据需求 | CSV 基础 | 缺失部分 | 获取方式 |
|----------|----------|----------|----------|
| 英雄类型分类（开团/保护/钩子/操作型） | champion name | 英雄→类型映射表 | 构建静态维表（champion_id → tags） |
| 装备 ID→名称映射 | items (item IDs) | item name/分类 | 构建静态维表或调用 LCU item assets API |
| 英雄别名（版本 meta T1/T2） | champion name | 版本 tier 列表 | 需外部 meta 数据源（非 LCU） |

---

## 2. 43 个 A/B 候选逐项审计

每个候选给出判定和证据。

### 判定符号

| 符号 | 含义 |
|:----:|------|
| ✅ | **可在当前 CSV 字段上完整计算**。所有触发指标均直接出现在 CSV 或可由 CSV 跨场聚合推导。 |
| ⚠️ | **需外部静态引用表**。基础数值字段在 CSV 中，但英雄类型/装备识别/版本 meta 需要静态维表或外部数据。**简化版可计算**（去掉需要外部数据的那部分条件）。 |
| ❌ | **不可计算**。至少一个必要触发指标依赖当前代码未获取、且 LCU 接口无法提供的字段。**从 A/B 名单淘汰，降入不可计算清单。** |

---

### 2.1 A 级：上单（Top）

#### A-TOP-01：369骰子 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | kills, deaths, assists, damage_share, result, position, duration_minutes |
| **CSV 状态** | 全部在 CsvMatch 中。kills(main.rs:353), deaths(:399), assists(:400), damage_share_percent(:406), result(:389-393), position(:367-369), duration_minutes(:415) |
| **聚合计算** | kda_variance: 对多场 kda 求 stddev。damage_share_variance: 对多场 damage_share_percent 求 stddev。 |
| **结论** | ✅ 完全可计算。KDA 和 damage_share 的方差均为标准统计操作。 |

#### A-TOP-02：圣枪哥 — ⚠️

| 项目 | 证据 |
|------|------|
| **必要字段** | champion_id, result, damage_share, position **+ 版本 T1-T2 meta 数据** |
| **CSV 状态** | champion name(main.rs:394-397) 在 CSV 中，可通过 hero_pool_size + champion_win_rate 检测"冷门英雄高胜率"。damage_share(:406), result(:389), position(:367) 均可用。 |
| **缺失** | **版本 T1-T2 英雄分类**。CSV 和 LCU 均不提供"当前版本哪些英雄是强势"的数据。这是外部动态数据源。 |
| **简化方案** | 去掉版本 meta 条件，改为"使用非主流近战上单（如奎因/卢锡安/男枪等远程）且 win_rate ≥ 60% 且 ≥ 15 场"。远程/近战分类可通过静态维表解决。 |
| **结论** | ⚠️ 简化版可计算（去掉版本 meta 条件，用英雄类型替代）。完整版不可计算。 |

---

### 2.2 A 级：打野（Jungle）

#### A-JG-01：奇迹行者（还在刷野）— ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | kill_participation_percent, cs, duration_minutes, position |
| **CSV 状态** | kill_participation_percent(main.rs:401-402), cs(:403), duration_minutes(:415), position(:367) 均在 CSV 中。 |
| **聚合计算** | avg_kill_participation = avg(kill_participation_percent) over N matches。cs_per_min_avg = avg(cs/duration_minutes)。 |
| **结论** | ✅ 完全可计算。 |

---

### 2.3 A 级：中单（Mid）

#### A-MID-01：左手 / 黄金左手 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | cs, duration_minutes, champion_damage, kills, deaths, assists, kill_participation_percent, position |
| **CSV 状态** | 全部 8 个字段均在 CsvMatch 中（见 §0.1）。 |
| **聚合计算** | cs_per_min_avg, damage_per_min_avg, avg_kda, avg_kill_participation 均可聚合。 |
| **结论** | ✅ 完全可计算。 |

#### A-MID-02：虎大将军（正面触发）— ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | damage_share, kills, result, position |
| **CSV 状态** | damage_share_percent(main.rs:406), kills(:353), result(:389), position(:367) 均可用。 |
| **结论** | ✅ 完全可计算。单场极值检测（damage_share > P90 + kills > P85 + result = 胜利）。 |

#### A-MID-03：燃烧自己 — ⚠️

| 项目 | 证据 |
|------|------|
| **必要字段** | kills, deaths, assists, damage_share, result, queue **+ 晋级赛/保段赛识别** |
| **CSV 状态** | kills/deaths/assists/damage_share/result/queue 均在 CSV 中。近 10 场 avg_kda 较赛季平均提升 50% 可计算。 |
| **缺失** | **晋级赛/保段赛标志**。queue 字段(main.rs:382) 只返回模式名（"单双排"/"灵活排位"等），不包含"当前是否在打晋级赛"的信息。LCU 的 match detail 也不返回 promo series 状态。 |
| **简化方案** | 去掉"晋级赛/保段赛"条件，改为"近 10 场 avg_kda 较赛季平均提升 ≥ 50% + damage_share > P75"。此时语义从"关键局爆发"变为"近期状态爆发"。 |
| **结论** | ⚠️ 简化版可计算（去掉关键局检测）。完整版不可计算。 |

---

### 2.4 A 级：ADC（Bottom）

#### A-BOT-01：暴毙AD — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | deaths, champion_damage, duration_minutes, damage_share, kills, assists, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **结论** | ✅ 完全可计算。 |

#### A-BOT-02：尺帝 / 尺子 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | damage_share, kills, deaths, assists, result, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **结论** | ✅ 完全可计算。 |

#### A-BOT-03：灯皇 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | damage_share, deaths, kills, assists, result, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **结论** | ✅ 完全可计算。 |

---

### 2.5 A 级：辅助（Support）

#### A-SUP-01：洛神（开团型辅助）— ⚠️

| 项目 | 证据 |
|------|------|
| **必要字段** | kill_participation_percent, assists, damage_taken, deaths, position, champion_id **+ 英雄类型分类（开团型 vs 保护型）** |
| **CSV 状态** | kill_participation_percent(:401), assists(:400), damage_taken(:408), deaths(:399), position(:367), champion name(:395-397) 均在 CSV。 |
| **缺失** | **英雄类型分类**。需要知道 champion 属于"开团型"（洛/牛头/日女/泰坦/芮尔）还是"保护型"（璐璐/风女/索拉卡）。CSV 中只有 champion name，无类型标签。这不是 LCU 数据——需要构建静态 champion→tags 维表。 |
| **简化方案** | 构建静态英雄分类维表（约 20 个辅助英雄手打分类即可）。成本低，一次性。 |
| **结论** | ⚠️ 需静态维表。champion name 已在 CSV，加一张维表即可完整计算。 |

#### A-SUP-02：大满贯 / 铁人 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | kills, deaths, assists, result, vision_score, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **聚合计算** | kda CV = σ/μ，需 ≥ 30 场计算。position 场数统计。win_rate。 |
| **结论** | ✅ 完全可计算。 |

#### A-SUP-03：冠军洛 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | kill_participation_percent, assists, deaths, result, champion_id, position |
| **CSV 状态** | 全部字段可用。champion 通过 name 识别"洛"（main.rs:395-397）。 |
| **结论** | ✅ 完全可计算。不需要英雄分类维表——只需要知道"是不是洛"（字符串匹配即可）。 |

#### A-SUP-04：护国神牛 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | assists, deaths, damage_taken, healing, champion_id, position |
| **CSV 状态** | 全部字段可用。champion 通过 name 识别"牛头"（字符串匹配）。 |
| **结论** | ✅ 完全可计算。 |

#### A-SUP-05：洛王 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | kill_participation_percent, assists, result, champion_id, position |
| **CSV 状态** | 全部字段可用。连胜检测通过 result 序列 + champion 过滤实现。 |
| **结论** | ✅ 完全可计算。 |

#### A-SUP-06：勾股定理 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | kill_participation_percent, assists, deaths, champion_id, position |
| **CSV 状态** | 全部字段可用。钩子英雄识别：champion name 匹配"锤石/机器人/泰坦/派克"即可（4个字符串，不需维表）。 |
| **结论** | ✅ 完全可计算。 |

#### A-SUP-07：装杯 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | assists, vision_score, deaths, champion_id, position |
| **CSV 状态** | 全部字段可用。操作型辅助（洛/锤石/娜美/派克/巴德）识别通过 name 匹配（5个字符串）。 |
| **结论** | ✅ 完全可计算。 |

---

### 2.6 A 级：无固定位置（Any）

#### A-ANY-01：天神下凡 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | kills, damage_share, kill_participation_percent, result, champion_damage, duration_minutes, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **结论** | ✅ 完全可计算。 |

#### A-ANY-02：永远滴神 / YYDS — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | kills, deaths, assists, damage_share, result, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **结论** | ✅ 完全可计算。 |

#### A-ANY-03：不破不立（EDG 叙事）— ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | result, kills, deaths, assists, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **聚合计算** | 连续 ≥ 5 败 → 随后 5 场 win_rate ≥ 80%。纯 result 序列检测。 |
| **结论** | ✅ 完全可计算。 |

#### A-ANY-04：翻山 — ❌

| 项目 | 证据 |
|------|------|
| **必要字段** | result, position **+ "下克上"对局检测（对手段位高于本方）+ 段位变化数据** |
| **缺失** | (1) **对手段位**: LCU match detail 的 participants 不返回 rank/tier/division。当前代码未提取对手段位数据。即使从 LCU 其他接口获取当前段位，也无法获取每场对局时刻对手的段位。(2) **段位变化**: 需要 rank 历史和排名数据，LCU 不提供。 |
| **证据** | main.rs 仅从 match detail 中提取 teamId(:328), participant stats(:326-416)，摘要部分不入 CSV 的对手段位不在提取列表中。api-and-jobs.md:24-44 的 UploadMatchV1 也不含 rank/opponent_rank 字段。 |
| **结论** | ❌ **淘汰。** "下克上"是此梗的核心触发条件（funnel 明确列出），不可简化替代。 |

#### A-ANY-05：涅槃（FPX 叙事）— ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | result, kill_participation_percent, assists, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **聚合计算** | 前5场 win_rate ≤ 40% + 后5场 win_rate ≥ 70% + kill_participation 提升 ≥ 15%。纯 result 序列 + 指标对比。 |
| **结论** | ✅ 完全可计算。 |

#### A-ANY-06：骑士归来（EDG 叙事）— ❌

| 项目 | 证据 |
|------|------|
| **必要字段** | result, kills, deaths, assists, position **+ 历史最高段位 + 当前段位** |
| **缺失** | **历史段位**数据。LCU 不提供历史段位时间序列。当前代码未调用任何 ranked 接口。即使未来调用 `/lol-ranked/v1/current-ranked-stats`，也只能获取当前段位，无法获取"历史最高"。 |
| **证据** | 当前代码仅调用 4 个 LCU 接口（§0.2），均不涉及 ranked stats。README.md:14-15 明确"不保存…原始接口响应"，无历史数据持久化。 |
| **结论** | ❌ **淘汰。** "突破历史最高段位"是此梗的核心触发条件，不可简化。 |

#### A-ANY-07：北伐（TES 叙事）— ❌

| 项目 | 证据 |
|------|------|
| **必要字段** | result, kills, deaths, assists, position **+ 排名/段位变化数据 + 对手段位（连胜对手不强则不触发）** |
| **缺失** | (1) **排名/段位变化**: 同 A-ANY-06，LCU 无历史段位。(2) **对手段位**: 同 A-ANY-04，match detail 不返参对手段位。 |
| **证据** | main.rs 和 api-and-jobs.md 中均无 rank 相关字段。 |
| **结论** | ❌ **淘汰。** "排名触底→连胜反弹"需要 rank 时间序列，不可计算。 |

#### A-ANY-08：御三家 — ❌

| 项目 | 证据 |
|------|------|
| **必要字段** | **account_age（账号注册时间 ≥ 3年）**, **rank（当前段位 ≥ 铂金）**, total_games, position, result |
| **缺失** | (1) **账号注册时间**: LCU 的 `/lol-summoner/v1/current-summoner` 返回字段不含注册日期。main.rs:234 调用此接口后仅提取 puuid/gameName/tagLine(:244-254)，不涉及创建时间。(2) **段位**: CSV 不包含。未调用 ranked 接口。 |
| **证据** | main.rs:232-241 `current_connection()` 调用 summoner endpoint，但后续 display_name(:243-255) 只取 gameName/tagLine/displayName。api-and-jobs.md UploadMatchV1 不含 account_age 或 rank。 |
| **结论** | ❌ **淘汰。** 两个核心字段均不可获取。 |

#### A-ANY-09：四皇 — ❌

| 项目 | 证据 |
|------|------|
| **必要字段** | result, kills, deaths, assists, position, **rank（当前段位 ≥ 大师）** |
| **缺失** | **段位**数据。同上，CSV 不含，LCU 未调用 ranked 接口。 |
| **证据** | api-and-jobs.md:24-44 UploadMatchV1 不含 rank。 |
| **结论** | ❌ **淘汰。** "段位 ≥ 大师"是此梗的必要条件（funnel 明确列出），不可绕过。 |

#### A-ANY-10：丞相（七擒孟获）— ❌

| 项目 | 证据 |
|------|------|
| **必要字段** | result, kills, deaths, assists, **opponent_id（对手追踪 → 对同一对手最近 5 次交手 win_rate = 100%）** |
| **缺失** | **对手持久化标识**。LCU match detail 的 participantIdentities 中有 puuid/accountId/summonerId（main.rs:262-276 用于定位当前玩家），但这些是**每场局内的临时标识**。系统硬性要求不保存这些 ID（README.md:14），且不同对局的同一对手没有持久化 opponent_id。 |
| **证据** | main.rs:419-461 `recent_games()` 使用 HashSet gameId 去重，不跟踪对手。README.md:14: "不保存 Token、PUUID、召唤师 ID、Account ID、原始对局 ID或原始接口响应"。api-and-jobs.md:49-52: "不含 gameId、PUUID、Account ID、Summoner ID、队友/对手身份"。 |
| **结论** | ❌ **淘汰。** 对手追踪需要跨对局的对手身份持久化，与项目安全设计冲突。funnel 自身在 §10.3 也标注为"需要技术预研的能力"。 |

#### A-ANY-11：黑暗势力 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | kill_participation_percent, kills, deaths, assists, duration_minutes, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **结论** | ✅ 完全可计算。 |

---

### 2.7 B 级：上单（Top）

#### B-TOP-01：纳尔圣经 — ⚠️

| 项目 | 证据 |
|------|------|
| **必要字段** | champion_id, cs, duration_minutes, damage_share, position **+ 版本 T2 以上 meta 数据** |
| **CSV 状态** | champion name(:395), cs(:403), duration_minutes(:415), damage_share(:406), position(:367) 均可用。hero_pool_size 可计算（distinct champion count）。 |
| **缺失** | **版本 T2 英雄分类**，与 A-TOP-02 圣枪哥相同问题。 |
| **简化方案** | 去掉"存在版本 T2 以上英雄从未使用"的条件，改为"近 20 场使用 ≤ 4 个不同英雄 + cs_per_min_avg < P30 或 damage_share < P30"。此时语义从"练不出版本英雄"变为"英雄池极浅且数据差"，语义有偏移但方向一致。 |
| **结论** | ⚠️ 简化版可计算。完整版需要版本 meta 数据（不可获取）。 |

#### B-TOP-02：拉扯圣经 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | deaths, kills, assists, damage_share, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **结论** | ✅ 完全可计算。 |

#### B-TOP-03：世一上 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | kills, deaths, assists, damage_share, result, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **结论** | ✅ 完全可计算。 |

---

### 2.8 B 级：打野（Jungle）

#### B-JG-01：4396 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | champion_damage, duration_minutes, kill_participation_percent, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **结论** | ✅ 完全可计算。 |

#### B-JG-02：正方形打野 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | cs, duration_minutes, kill_participation_percent, kills, deaths, assists, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **结论** | ✅ 完全可计算。 |

---

### 2.9 B 级：中单（Mid）

#### B-MID-01：2200 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | champion_damage, duration_minutes, kill_participation_percent, assists, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **结论** | ✅ 完全可计算。 |

#### B-MID-02：虎三件 — ⚠️

| 项目 | 证据 |
|------|------|
| **必要字段** | **item_purchases（出装数据 → 检测中亚沙漏+女妖面纱/水银饰带）**, damage_share, deaths, position |
| **CSV 状态** | items 字段(main.rs:374-379) 包含 item0–item6 的**最终装备 ID**（管道分隔的数字字符串）。damage_share(:406), deaths(:399), position(:367) 均在 CSV。 |
| **缺失** | **装备 ID→名称映射**。items CSV 列存储的是数字 ID（如 3157 = 中亚沙漏），需要静态维表将 ID 映射到装备名称。这不是 LCU 数据——但可通过类似 champion-summary 的 LCU item assets API 获取，或构建静态映射表。 |
| **注意** | items 是**最终出装**（比赛结束时的装备），不是 purchase timeline。检测"购买了中亚+女妖"是可行的（检查 items 列表中是否含这两个 ID）。但无法判断购买顺序。 |
| **结论** | ⚠️ 需静态装备 ID→名称维表。items 原始 ID 已在 CSV，加一张维表即可计算。funnel 自身 §10.3 也已标注此项需"技术预研确认"。 |

---

### 2.10 B 级：ADC（Bottom）

#### B-BOT-01：接Q辣舞 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | deaths, champion_damage, duration_minutes, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **注意** | funnel 自身标注"代理有偏"（死亡数≠接技能数），但数据层面可计算。这是语义精度问题，非字段可用性问题。 |
| **结论** | ✅ 完全可计算（语义有偏问题属产品层面，非本审计范围）。 |

---

### 2.11 B 级：辅助（Support）

#### B-SUP-01：冥王 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | deaths, kill_participation_percent, assists, vision_score, result, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **结论** | ✅ 完全可计算。 |

#### B-SUP-02：疯牛病 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | kill_participation_percent, deaths, assists, damage_taken, champion_id, position |
| **CSV 状态** | 全部字段可用。champion 通过 name 匹配"牛头"（字符串匹配）。 |
| **结论** | ✅ 完全可计算。 |

#### B-SUP-03：撕破伤口 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | kills, deaths, assists, damage_share, kill_participation_percent, champion_id, position |
| **CSV 状态** | 全部字段可用。高操作辅助（锤石/洛/派克/巴德）识别通过 name 匹配。 |
| **结论** | ✅ 完全可计算。 |

#### B-SUP-04：死神 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | deaths, assists, kill_participation_percent, damage_taken, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **结论** | ✅ 完全可计算。 |

---

### 2.12 B 级：无固定位置（Any）

#### B-ANY-01：边缘OB — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | kill_participation_percent, damage_share, deaths, position |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **结论** | ✅ 完全可计算。 |

#### B-ANY-02：红温 — ✅

| 项目 | 证据 |
|------|------|
| **必要字段** | result, kills, deaths, assists, position（按时间序列分析 tilt 模式） |
| **CSV 状态** | 全部字段在 CsvMatch 中。 |
| **聚合计算** | 连续 ≥ 3 场失败 → 检测后续 KDA 下降。纯 result 序列 + KDA 变化率。 |
| **注意** | funnel 自身标注"代理有偏"（情绪状态≠表现下降），但数据层面可计算。 |
| **结论** | ✅ 完全可计算。 |

#### B-ANY-03：永不团灭 — ❌

| 项目 | 证据 |
|------|------|
| **必要字段** | deaths, result, duration_minutes, position **+ 团灭事件检测（同一时间点队友全部死亡而自己存活）** |
| **缺失** | **团灭/ACE 事件数据**。LCU match detail 返回的 participants[].stats 只有聚合 deaths 值（总死亡次数），不含死亡时间线。teams 数组可能有团队击杀数但不含"同时死亡"事件。无法从当前数据中检测"团队 ace 时刻只有某玩家存活"。 |
| **证据** | main.rs:326-351 — 代码从 match detail 中提取 team members 用于计算 team_kills 和 team_damage，但仅使用 kills 和 totalDamageDealtToChampions。无 death timeline 或 team ace 检测。 |
| **funnel 自身** | funnel B-ANY-03 的 ⚠️ 标注承认："若无法获取团灭事件，降级为不可计算→淘汰或降级 C"。round-03-audit-gaps.md GAP-C3 也指出应标记 PENDING_DATA_AVAILABILITY。 |
| **结论** | ❌ **淘汰。** 团灭事件检测需要的事件级数据在 LCU match detail 中不可用。funnel 自身的"简化方案（团队 ace 后玩家存活）"同样无法实现。 |

#### B-ANY-04：孟获（七擒孟获）— ❌

| 项目 | 证据 |
|------|------|
| **必要字段** | result, **opponent_id（对手追踪 → 对同一对手最近 5 次交手 win_rate = 0%）** |
| **缺失** | **对手持久化标识**。与 A-ANY-10 丞相相同问题。 |
| **证据** | 同 A-ANY-10（见 §2.6）。 |
| **结论** | ❌ **淘汰。** 对手追踪不可用。与"丞相"互为对手标签，同时淘汰。 |

---

## 3. 汇总：43 个 A/B 候选审计结果

### 3.1 审计结论分布

| 结论 | 数量 | 含义 |
|:----:|:----:|------|
| ✅ 完全可计算 | **30** | 所有触发字段均在 CSV 中或可由 CSV 聚合推导 |
| ⚠️ 需外部引用表 | **5** | 基础数值字段可用，但英雄分类/装备识别/版本 meta 需静态维表；简化版可计算 |
| ❌ 不可计算（淘汰） | **8** | 至少一个必要触发字段无法从当前代码或 LCU 获取 |

### 3.2 ✅ 完全可计算（30 项）

| # | ID | 名称 | 位置 | 等级 |
|---|-----|------|------|:----:|
| 1 | A-TOP-01 | 369骰子 | Top | A |
| 2 | A-JG-01 | 奇迹行者（还在刷野） | Jungle | A |
| 3 | A-MID-01 | 左手 / 黄金左手 | Mid | A |
| 4 | A-MID-02 | 虎大将军（正面触发） | Mid | A |
| 5 | A-BOT-01 | 暴毙AD | Bottom | A |
| 6 | A-BOT-02 | 尺帝 / 尺子 | Bottom | A |
| 7 | A-BOT-03 | 灯皇 | Bottom | A |
| 8 | A-SUP-02 | 大满贯 / 铁人 | Support | A |
| 9 | A-SUP-03 | 冠军洛 | Support | A |
| 10 | A-SUP-04 | 护国神牛 | Support | A |
| 11 | A-SUP-05 | 洛王 | Support | A |
| 12 | A-SUP-06 | 勾股定理 | Support | A |
| 13 | A-SUP-07 | 装杯 | Support | A |
| 14 | A-ANY-01 | 天神下凡 | Any | A |
| 15 | A-ANY-02 | 永远滴神 / YYDS | Any | A |
| 16 | A-ANY-03 | 不破不立（EDG 叙事） | Any | A |
| 17 | A-ANY-05 | 涅槃（FPX 叙事） | Any | A |
| 18 | A-ANY-11 | 黑暗势力 | Any | A |
| 19 | B-TOP-02 | 拉扯圣经 | Top | B |
| 20 | B-TOP-03 | 世一上 | Top | B |
| 21 | B-JG-01 | 4396 | Jungle | B |
| 22 | B-JG-02 | 正方形打野 | Jungle | B |
| 23 | B-MID-01 | 2200 | Mid | B |
| 24 | B-BOT-01 | 接Q辣舞 | Bottom | B |
| 25 | B-SUP-01 | 冥王 | Support | B |
| 26 | B-SUP-02 | 疯牛病 | Support | B |
| 27 | B-SUP-03 | 撕破伤口 | Support | B |
| 28 | B-SUP-04 | 死神 | Support | B |
| 29 | B-ANY-01 | 边缘OB | Any | B |
| 30 | B-ANY-02 | 红温 | Any | B |

### 3.3 ⚠️ 需外部引用表（5 项）

| # | ID | 名称 | 缺失的外部数据 | 简化方案可行性 |
|---|-----|------|---------------|:------------:|
| 1 | A-TOP-02 | 圣枪哥 | 版本 T1-T2 英雄 meta 分类 | ✅ 用"远程/近战"替代"版本 T1-T2" |
| 2 | A-MID-03 | 燃烧自己 | 晋级赛/保段赛识别 | ✅ 去掉关键局检测，改为"近期状态爆发" |
| 3 | A-SUP-01 | 洛神 | 英雄类型分类（开团型 vs 保护型） | ✅ 构建静态 champion→tags 维表 |
| 4 | B-TOP-01 | 纳尔圣经 | 版本 T2 英雄 meta 分类 | ✅ 去掉版本条件，保留英雄池 + 数据差 |
| 5 | B-MID-02 | 虎三件 | 装备 ID→名称映射 | ✅ 构建静态 item→name 维表或调用 LCU item API |

### 3.4 ❌ 不可计算 — 淘汰（8 项）

| # | ID | 名称 | 缺失字段 | 不可替代的原因 |
|---|-----|------|----------|---------------|
| 1 | A-ANY-04 | 翻山 | opponent_rank, rank 变化 | "下克上"是核心触发条件，不可移除 |
| 2 | A-ANY-06 | 骑士归来 | 历史最高段位 | "突破历史最高"是梗的语义核心 |
| 3 | A-ANY-07 | 北伐 | rank 时间序列, opponent_rank | "排名触底→强势反弹"需要排名数据 |
| 4 | A-ANY-08 | 御三家 | account_age, rank | 两个必要条件均不可获取 |
| 5 | A-ANY-09 | 四皇 | rank（≥ 大师） | rank 阈值是必要条件 |
| 6 | A-ANY-10 | 丞相 | opponent_id | 对手追踪与安全设计冲突 |
| 7 | B-ANY-03 | 永不团灭 | team ace/death timeline 事件 | LCU 不提供事件级死亡时间线 |
| 8 | B-ANY-04 | 孟获 | opponent_id | 与丞相同因 |

### 3.5 淘汰项与被依赖字段的对应关系

| 被依赖的不可获取字段 | 淘汰的候选 |
|---------------------|-----------|
| `opponent_id`（对手追踪） | 丞相(A-ANY-10), 孟获(B-ANY-04) |
| `rank / tier`（段位数据） | 翻山(A-ANY-04), 骑士归来(A-ANY-06), 北伐(A-ANY-07), 御三家(A-ANY-08), 四皇(A-ANY-09) |
| `account_age`（账号注册时间） | 御三家(A-ANY-08) |
| `opponent_rank`（对手段位） | 翻山(A-ANY-04), 北伐(A-ANY-07) |
| death timeline / team ace events | 永不团灭(B-ANY-03) |

---

## 4. 受影响的统计

### 4.1 位置覆盖变化

| 位置 | 原 A+B | 淘汰 | 降为⚠️ | 保持✅ | 实际可用 |
|------|:------:|:----:|:------:|:------:|:------:|
| **Top 上单** | 5 | 0 | 2 | 3 | 3 ✅ + 2 ⚠️ |
| **Jungle 打野** | 3 | 0 | 0 | 3 | 3 ✅ |
| **Mid 中单** | 5 | 0 | 1 | 4 | 4 ✅ + 1 ⚠️ |
| **Bottom ADC** | 4 | 0 | 0 | 4 | 4 ✅ |
| **Support 辅助** | 11 | 0 | 1 | 10 | 10 ✅ + 1 ⚠️ |
| **Any 无固定** | 15 | 8 | 0 | 7 | 7 ✅ |
| **总计** | **43** | **8** | **5** | **30** | **30 ✅ + 5 ⚠️** |

> 注：审计后打野位仍为 3 个（全部 ✅），辅助位从 11 降至 10 ✅ + 1 ⚠️。最严重的损失在 Any 类别（15→7）。

打野位具体覆盖：A-JG-01(✅ 奇迹行者) + A-ANY-01(✅ 天神下凡跨位) + B-JG-01(✅ 4396) + B-JG-02(✅ 正方形打野) = 4 个可触发称号（含跨位）。

### 4.2 原 funnel 声称的 43 → 实际可上线：30-35

- **严格口径**（仅 ✅）：**30 项**可立即实现
- **宽口径**（含 ⚠️ 简化版）：**35 项**（加 5 个简化版）
- 淘汰 8 项（均为 Any 类别），其中 6 项为 A 级（翻山、骑士归来、北伐、御三家、四皇、丞相）

---

## 5. 跨文档一致性确认

### 5.1 与 round-03-audit-gaps.md（Verifier）的一致性

| Verifier GAP | 本审计结论 | 一致性 |
|-------------|-----------|:------:|
| GAP-C1: champion_id 框架缺失 | ✅ 确认。champion 通过 name 字符串匹配可用，但英雄分类需维表。 | ✅ 一致 |
| GAP-C2: 5/43 依赖未定义字段 | ✅ 确认且**超额发现 8/43**。Verifier 关注框架层面；本审计在代码层面额外发现 3 个（A-ANY-04 翻山、A-ANY-07 北伐、B-ANY-03 永不团灭的实际不可计算性）。 | ✅ 一致+超额 |
| GAP-C3: 永不团灭应标记 PENDING | ✅ 确认。本审计直接判定 ❌（LCU 不提供 death timeline）。 | ✅ 一致（更强判定） |

### 5.2 与 funnel §10.3 "需技术预研"的一致性

funnel §10.3 列出 5 项需要技术预研的能力。本审计结论：

| funnel 预研项 | 本审计结论 | 备注 |
|--------------|-----------|------|
| 对手追踪（丞相/孟获） | ❌ 不可行 | 与项目安全设计冲突 |
| 段位历史（骑士归来/御三家） | ❌ 不可行 | LCU 不提供历史段位 |
| 出装数据（虎三件） | ⚠️ 可行（需维表） | item ID 已在 CSV 中 |
| 团灭检测（永不团灭） | ❌ 不可行 | LCU 不提供事件数据 |
| 连胜/连败模式（红温） | ✅ 可行 | 纯 result 序列分析 |

---

## 6. LCU 可扩展性：当前未提取但可获取的字段

以下字段在当前代码中**未提取到 CSV**，但**存在于 LCU match detail 返回的 JSON 中**，未来可扩展：

### 6.1 参赛者 stats 中的额外字段

| LCU 字段路径 | 用途 | 潜在候选 |
|-------------|------|---------|
| `stats.doubleKills` / `tripleKills` / `quadraKills` / `pentaKills` | 多杀统计 | C 级"天雷/地火/湮灭"等名场面检测 |
| `stats.firstBloodKill` / `stats.firstBloodAssist` | 一血 | 激进风格检测 |
| `stats.largestMultiKill` / `stats.largestKillingSpree` | 最高连杀 | carry 能力 |
| `stats.physicalDamageDealtToChampions` | 物理伤害 | 伤害类型细分 |
| `stats.magicDamageDealtToChampions` | 魔法伤害 | 伤害类型细分 |
| `stats.trueDamageDealtToChampions` | 真实伤害 | 伤害类型细分 |
| `stats.totalDamageDealt` | 总伤害（含非英雄） | 推塔/打野伤害 |
| `stats.totalTimeCCDealt` | 控制时间 | 功能性评估 |
| `stats.damageSelfMitigated` | 自减免伤害 | 坦度评估 |
| `stats.turretKills` / `stats.inhibitorKills` | 推塔 | 分带效率 |
| `stats.longestTimeSpentLiving` | 最长存活时间 | 生存能力 |
| `stats.perk0-5` | 符文 | 符文风格分析 |
| `stats.spell1Id` / `stats.spell2Id` | 召唤师技能 | 打法偏好 |

### 6.2 团队级字段

| LCU 字段路径 | 用途 |
|-------------|------|
| `teams[].baronKills` / `dragonKills` / `towerKills` | 团队目标控制 |
| `teams[].firstBaron` / `firstDragon` / `firstTower` / `firstInhibitor` | 先手优势 |

### 6.3 参赛者身份字段（当前不入 CSV 的安全原因）

| LCU 字段 | 安全限制 |
|----------|---------|
| `participantIdentities[].player.summonerName` | 不入 CSV（README.md:14）；仅用于本地匹配玩家身份 |

---

## 7. 审计建议

### 7.1 立即行动

1. **淘汰 8 项**从 A/B 上线名单中移除：翻山、骑士归来、北伐、御三家、四皇、丞相、永不团灭、孟获。转入不可计算清单。
2. **5 项 ⚠️ 项**需补充静态维表（champion→tags, item→name）后方可完整上线。在维表就位前，使用简化触发条件。
3. **30 项 ✅** 可直接进入阈值校准和工程实现。

### 7.2 中期行动

1. **扩充 CSV 字段**：考虑从 match detail 中额外提取 doubleKills/tripleKills/quadraKills/pentaKills、firstBlood、largestMultiKill 等字段，为 C 级名场面检测提供数据基础。
2. **构建静态维表**：champion→type（开团/保护/钩子/操作型/射手型/刺客型）和 item→name 映射表，一次性成本。
3. **评审是否接入 ranked 接口**：如果未来需要段位相关称号（四皇/御三家等的替代版），可调用 `/lol-ranked/v1/current-ranked-stats` 获取当前段位。但注意仍无法获取历史段位。

### 7.3 长期关注

1. **对手追踪**与**段位历史**在当前技术条件下不可行，不建议列入路线图。
2. 打野位正面称号仍然短缺（仅天神下凡跨位可触发），建议在下一轮探索中重点关注打野位可计算梗。

---

## 8. 证据索引

| 证据 | 文件路径 | 行号 | 内容 |
|------|----------|------|------|
| CsvMatch 结构体 | `apps/desktop/src-tauri/src/main.rs` | 71-93 | 全部 CSV 字段定义 |
| LCU 接口 #1 | `apps/desktop/src-tauri/src/main.rs` | 234 | `/lol-summoner/v1/current-summoner` |
| LCU 接口 #2 | `apps/desktop/src-tauri/src/main.rs` | 425-428 | `/lol-match-history/v1/products/lol/{puuid}/matches` |
| LCU 接口 #3 | `apps/desktop/src-tauri/src/main.rs` | 490-491 | `/lol-match-history/v1/games/{gameId}` |
| LCU 接口 #4 | `apps/desktop/src-tauri/src/main.rs` | 299-300 | `/lol-game-data/assets/v1/champion-summary.json` |
| team_kills 计算 | `apps/desktop/src-tauri/src/main.rs` | 328-342 | 团队聚合逻辑 |
| team_damage 计算 | `apps/desktop/src-tauri/src/main.rs` | 343-351 | 团队伤害聚合 |
| items 提取 | `apps/desktop/src-tauri/src/main.rs` | 374-379 | item0-item6 → pipe-separated IDs |
| kill_participation 计算 | `apps/desktop/src-tauri/src/main.rs` | 401-402 | 参团率公式 |
| damage_share 计算 | `apps/desktop/src-tauri/src/main.rs` | 406-407 | 伤害占比公式 |
| 脱敏要求 | `README.md` | 14-15 | 不保存 ID/Token 的硬性约束 |
| UploadMatchV1 契约 | `docs/architecture/api-and-jobs.md` | 24-44 | 上传数据结构（无 rank/opponent_id/account_age） |
| 字段覆盖率验证 | `lcu-probe-report.json` | 16-31 | 35 场 100% 覆盖率 |
| funnel 自身预研标注 | `docs/research/round-03-safe-computable-funnel.md` | 1140-1144 | §10.3 承认 5 项需技术预研 |
| Verifier GAP-C2 | `docs/research/round-03-audit-gaps.md` | 218-230 | 5/43 依赖未定义字段 |

---

> **审计完成时间**: 2026-07-24
> **审计员**: DimCode（Round 4 Explorer）
> **审计方法**: 逐行代码核对 + LCU 接口调用链追踪 + CSV 字段矩阵匹配
> **输入**: round-03-safe-computable-funnel.md（43 A/B 候选）
> **输出**: 30 ✅ 可上线 + 5 ⚠️ 需维表 + 8 ❌ 淘汰
> **可追溯**: 每项判定均有 `main.rs` 行号证据
