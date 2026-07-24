# LOL 梗称号 — 最小可实施 Schema（v1）

> **来源**：综合 R04 schema-conflicts / R05 jungle-remediation / R10 release-pack-v2 / R10 closure-audit / R04 data-field-audit
> **原则**：origin_verified 与 meaning_verified 双轨分离；不堆砌字段——仅保留 v1 触发/展示/安全/版本所需的最小集合
> **最后更新**：2026-07-24

---

## 1. 双轨证据体系

```
origin_verified（首创可追溯）
  ✅ P0/P1 → 原始比赛录像/直播/官方出品可定位到首创时刻
  ⚠️ P3   → 仅有社区来源（bilibili wiki 等），无 P0/P1
  ❌       → 无任何可验证来源，或来源描述被证伪

meaning_verified（语义可验证）
  ✅       → ≥2 个独立 P3 来源交叉验证，或语义完全自明
  ⚠️       → 单一 P3 来源或仅社区口述记忆
  ❌       → 无任何可验证来源或来源自相矛盾
```

**四象限分布**（21 项产品卡）：

|  | meaning ✅ | meaning ⚠️ | meaning ❌ |
|:--|:----|:----|:----|
| **origin ✅** | 🟢 Verified: 8 项 | — | — |
| **origin ⚠️** | 🟡 Community Consensus: 8 项 | — | — |
| **origin ❌** | 🟠 Weak Evidence: 4 项 | 🔴 Unverifiable: 1 项 | — |

---

## 2. 最小可实施 Schema

```yaml
# ============================================================
# 一条梗语料根记录（v1 必要字段，共 22 字段）
# ============================================================

# --- 标识 ---
meme_id: string                    # 唯一标识，如 "tianshen-xiafan"
display_name: string               # 展示名称，如 "天神下凡"
aliases: [string]                  # 别名列表，如 ["奇迹行者还在刷野"]

# --- 位置 ---
position: enum                     # Top | Jungle | Mid | Bottom | Support | Any

# --- 双轨证据 ---
origin_verified: bool              # 首创是否可追溯到 P0/P1
origin_tier: enum                  # P0 | P1 | P3 | pending
origin_ref: string                 # 首创来源摘要
meaning_verified: bool             # 语义是否多源交叉验证或完全自明
meaning_tier: enum                 # verified | community_consensus | weak | unverifiable
meaning_ref: string                # 语义来源摘要
verification_strength: enum        # verified | community_consensus | weak_evidence | unverifiable
                                   # （Closure Audit 验证强度标签）

# --- 产品分层 ---
product_tier: enum                 # A_primary | B_primary | B_sub_tag | status_only
evidence_tier: enum                # high_conf | medium_conf | low_conf
                                   # （与 product_tier 独立——证据不足时降产品级但不改证据评分）

# --- 触发（v1 仅依赖 CsvMatch 已有字段）---
trigger_group: string              # 触发逻辑的描述性标识
computed_fields: [string]          # 依赖的 CsvMatch 字段名列表
                                   # 当前 CsvMatch 原始字段仅包括：match_time, queue, game_mode,
                                   #   result, champion, kills, deaths, assists,
                                   #   kill_participation_percent, cs, gold, champion_damage,
                                   #   damage_share_percent, damage_taken, healing, vision_score,
                                   #   wards_placed, wards_killed, position, items, duration_minutes
                                   # 可从上述字段聚合派生 KDA、每分钟指标、均值和跨场方差；
                                   # 不得假设存在 timeline、控制时长、推塔、首杀或对手段位字段。
counter_evidence: string           # 反证条件——满足则不触发（如天神下凡要求 result=胜利）

# --- 冲突组 ---
conflict_group_id: string|null     # 互斥冲突组 ID（如 CG-JG 打野冲突组）
conflict_role: enum|null           # primary | secondary
                                   # 同组内 primary 触发后 secondary 不展示

# --- 安全 & 开关 ---
self_mock_switch: enum             # required | suggested | none
                                   # required: 用户主动开启后才触发
                                   # suggested: 默认关闭，建议开启
                                   # none: 默认开启，无需开关
ethics_review_required: bool       # ETHICS_REVIEW_REQUIRED 标记——审查通过前禁止上线
risk_level: enum                   # low | medium | high
anti_irony_firewall: string        # 反讽风险缓解策略简述

# --- 版本 & 发布 ---
release_group: enum                # default_on | self_mock_gated | status_only | evidence_pending | disabled | pending_data
grayscale_rollback_condition: string  # 灰度期间触发撤回的条件
version: string                    # 语义化版本，如 "1.0.0"
changelog: string                  # 变更记录摘要
status: enum                       # active | pending_review | deprecated | disabled
```

---

## 3. 规则 & 约束速查

### 3.1 产品分层规则

| product_tier | 含义 | 准入门槛 |
|:------------|:-----|:--------|
| **A_primary** | 核心称号，全位或主位触发 | origin ✅ + meaning ✅ + 独立语义锚点成立；允许弱选手绑定，但需通过理解度验证与反讽审查 |
| **B_primary** | 次核心，有独立语义但来源弱或带选手绑定痕迹 | origin ⚠️/✅ + meaning ✅ + 语义自洽 |
| **B_sub_tag** | 次级标签，辅助叙事 | origin ⚠️/❌ 或可计算性弱 |
| **status_only** | 不触发，仅展示/彩蛋 | — |

### 3.2 冲突组互斥规则

同 `conflict_group_id` 内：
- `conflict_role=primary` 触发后，同组 `secondary` 不展示
- 互斥判定基于数据区间可区分（如 4396 要求 `champion_damage < X`，天神下凡要求 `champion_damage > Y`，区间不重叠即不冲突）
- 同一冲突组最多 1 个 primary

### 3.3 反证规则

`counter_evidence` 不为空时，需同时满足 trigger 条件和 `counter_evidence` 不成立才触发。
典型反证：
- 正面称号（天神下凡）要求 `result = 胜利`
- 负面嘲讽（4396）不要求结果——即使赢了也可能伤害极低

### 3.4 安全红线（永不可恢复）

以下类别 **✔️ 不可作为产品称号上线**：
- H1 外貌/人格/国籍/种族攻击（马头/洗澡狗/CJB/糯手/精忠报国/越南腐乳/永雏塔赞）
- H1 官方已警告/投诉（马头 → IG 投诉 + LPL 警告）
- H4 无游戏行为映射（看片哥/相公/哥哥/鞋王）
- L1 D 级黑称体系（及时雨/宋江）

### 3.5 语义淘汰规则（保留 aliases，不上线 trigger）

- 字面语义不携带游戏行为含义（厂长 = 工厂管理者 ≠ 打野）
- ID 谐音零语义残余（接Q辣舞 = JackeyLove 谐音）
- 认知度 <60% 且无独立梗基础（右手）

---

## 4. 冲突组清单

| CG-ID | 名称 | 位置 | 成员 | 互斥逻辑 |
|:------|:-----|:---:|:-----|:--------|
| **CG-JG-01** | 打野伤害冲突 | Jungle | 4396 (primary) / 奇迹行者 (secondary) | 4396 要求 `champion_damage < X`；奇迹行者要求 `kill_participation_percent < Y` 且 `cs > Z`。数据区间可区分——低伤不刷 ≠ 不参团猛刷。primary 触发后 secondary 不展示 |
| **CG-ANY-01** | 跨位 carry 冲突 | Any | 天神下凡 (primary) / 红温 (secondary) | 天神下凡要求 `champion_damage > P90` + 胜利；红温要求高死亡+低输出。区间自然互斥 |

---

## 5. 发布分组 & 开关矩阵

| 分组 | 数量 | 含义 | 开关要求 | 上线条件 |
|:-----|:----:|:-----|:--------|:--------|
| 🟢 **default_on** | 5 | 安全、传播力强、无自嘲依赖 | none | v1 直接上线；origin ⚠️ 项先灰度 |
| 🟡 **self_mock_gated** | 7 | 含调侃历史、反讽或伦理风险 | required | 其中 6 项可在用户开启后上线；红温须先通过伦理审查 |
| 🔵 **status_only** | 1 | 单局即时惊叹，不形成长期称号 | none | v1 作为 post-game 状态展示 |
| 🟠 **evidence_pending** | 3 | 证据链或代理精度待补 | — | v1 暂不触发，v1.1 复审 |
| 🔴 **disabled** | 15 | 安全禁用 11 项 + 语义淘汰 4 项 | — | 永久不触发；安全禁用不得作为 aliases 展示 |
| 🟡 **pending_data** | 2 | 核心字段暂不可获取 | — | 字段可用后重新评审 |

### 5.1 🟢 默认开启（5 项）

| # | meme_id | position | product_tier | verification_strength | 关键风险 |
|:--:|:--------|:--------:|:-----------|:---------------------|:--------|
| 1 | tianshen-xiafan | Any | A_primary | 🟢 Verified | SF5=10，反讽风险极低 |
| 2 | 369-dice | Top | A_primary | 🟢 Verified | 「369」数字绑定选手 ID |
| 3 | jue-shi-liu | Jungle | B_sub_tag | 🟡 Community Consensus | MLXG 绑定；灰度监控「绝食」负面感知 |
| 4 | protect-country-cow | Support | B_sub_tag | 🟡 Community Consensus | 仅 Alistar；灰度监控反讽误解 |
| 5 | best-top | Top | B_sub_tag | 🟡 Community Consensus | 反讽风险，使用高阈值与撤回条件 |

### 5.2 🟡 需自嘲开关（7 项）

| # | meme_id | position | product_tier | 风险性质 | 备注 |
|:--:|:--------|:--------:|:-----------|:--------|:-----|
| 1 | red-warm | Any | B_sub_tag | 情绪/人身风险 | **ETHICS_REVIEW_REQUIRED；审查前不发布** |
| 2 | explode-ad | Bottom | A_primary | 强调侃 | origin 弱，用户主动开启后触发 |
| 3 | 4396 | Jungle | B_primary | 数字嘲讽 | P0 S6 VOD 可定位 |
| 4 | tiger-general | Mid | B_primary | 高反讽风险 | 仅正面高光触发 |
| 5 | 2200 | Mid | B_sub_tag | 数字嘲讽 | P0 S9 RNG vs FNC G4 |
| 6 | crazy-cow | Support | B_sub_tag | 疾病隐喻 | 需 T2 冒犯率测试 |
| 7 | gnar-bible | Top | B_sub_tag | 反讽/代理粗糙 | 依赖英雄职责维表 |

### 5.3 🔵 仅状态（1 项）

| # | meme_id | position | product_tier | 展示方式 |
|:--:|:--------|:--------:|:-----------|:--------|
| 1 | yyds | Any | status_only | 单局极致 carry 后显示，不写入长期画像 |

### 5.4 🟠 证据待补（3 项）

| # | meme_id | position | product_tier | 补证路径 |
|:--:|:--------|:--------:|:-----------|:--------|
| 1 | miracle-walker | Jungle | B_sub_tag | 人工定位姿态直播 P0 时间戳 |
| 2 | radar-bro | Jungle | B_sub_tag | 需要事件级数据验证 vision 代理精度 |
| 3 | left-hand | Mid | A_primary | 用户验证「左手→中单打法」理解度 |

### 5.5 不触发项

- **安全禁用 11 项**：永久移除，不能作为 aliases、彩蛋或状态文案展示。
- **语义淘汰 4 项**：厂长、灯皇、接Q辣舞、右手；不触发，可仅在内部来源台账中保留别名关系。
- **数据门槛淘汰 2 项**：翻山（需 `opponent_rank`）、永不团灭（需团灭事件数据）；字段可用后复审。

---

## 6. v1 可用计算字段（CsvMatch 真实产出）

代码级审计来源：[`apps/desktop/src-tauri/src/main.rs`](../../apps/desktop/src-tauri/src/main.rs) L71-93

```
基础指标:
  kills, deaths, assists, cs, gold,
  champion_damage, damage_taken, healing,
  vision_score, wards_placed, wards_killed

比率指标:
  kill_participation_percent  (kills+assists)/team_kills
  damage_share_percent        champion_damage/team_damage

对局元数据:
  duration_minutes, result, position, queue,
  game_mode, match_time, champion, items
```

**可推导聚合指标**：`cs_per_min_avg`、`avg_kda`、`kda_variance`、`damage_per_min` 等

**v1 不可获取字段**：`opponent_rank`、`promo_series`、`comms_data`（ping/打字/语音）、`team_fight_event`（团灭检测）

---

## 7. v1 触发开关 & 灰度回滚条件

| 开关 | 默认值 | 回滚条件 |
|:-----|:-----:|:--------|
| `feature.meme_title.enabled` | true | >5% 用户投诉冒犯 → 全局关闭 |
| `feature.meme_title.self_mock` | false | 用户可单独关闭全部嘲讽类 title |
| `feature.meme_title.red_warm` | false（硬阻断） | ETHICS_REVIEW 通过前不可上线 |
| `feature.meme_title.grayscale_pct` | 10%→50%→100% | 任一阶段 CTR < 2% 或投诉率 > 0.5% → 回滚至上一阶段 |

---

## 8. 版本字段约定

```yaml
version: "1.0.0"    # MAJOR.MINOR.PATCH
                     # MAJOR: 新增/移除产品级（A/B 升降）
                     # MINOR: 调整触发阈值或反证条件
                     # PATCH: 文案修正、aliases 更新、来源引用补充
```

---

## 9. 完整 YAML 示例

### 9.1 示例：天神下凡（旗舰级）

```yaml
meme_id: "tianshen-xiafan"
display_name: "天神下凡"
aliases: ["天神下凡一锤四"]
position: "Any"

# --- 双轨证据 ---
origin_verified: true
origin_tier: "P0"
origin_ref: "S8 半决赛 IG vs G2 第2场，TheShy 剑魔 1v4 团灭 G2"
meaning_verified: true
meaning_tier: "verified"
meaning_ref: "「天神下凡」= 团战 1v4+ carry — 语义完全自明，零选手知识依赖，社区使用 >90% 正面"
verification_strength: "verified"

# --- 产品分层 ---
product_tier: "A_primary"
evidence_tier: "high_conf"

# --- 触发 ---
trigger_group: "hypercarry_teamfight"
computed_fields:
  - "kills"
  - "deaths"
  - "assists"
  - "champion_damage"
  - "damage_share_percent"
  - "kill_participation_percent"
  - "result"
counter_evidence: "result != '胜利' 或 champion_damage < P90"

# --- 冲突组 ---
conflict_group_id: "CG-ANY-01"
conflict_role: "primary"

# --- 安全 & 开关 ---
self_mock_switch: "none"
ethics_review_required: false
risk_level: "low"
anti_irony_firewall: "SF5=10，社区使用 >90% 正面——反讽风险极低。仅胜利+高伤害可触发，排除了「送人头后玩梗」的误触发"

# --- 版本 & 发布 ---
release_group: "default_on"
grayscale_rollback_condition: "触发后 CTR < 5% 超过 7 天"
version: "1.0.0"
changelog: "R1→R9 全程无争议旗舰级产品卡。v1 默认开启。"
status: "active"
```

### 9.2 示例：369 骰子（实验层 A 级）

```yaml
meme_id: "369-dice"
display_name: "369骰子"
aliases: ["骰子哥", "999感冒灵"]
position: "Top"

# --- 双轨证据 ---
origin_verified: true
origin_tier: "P0"
origin_ref: "369 选手比赛录像——多场对局发挥方差极大（单局 MVP ↔ 下局崩盘），社区将其发挥波动比喻为「掷骰子」"
meaning_verified: true
meaning_tier: "verified"
meaning_ref: "「骰子」= 不确定性（通识概念）。任何人看到「369骰子」都能理解「上下限差距大」。「369」数字绑定是弱项，但「骰子」独立语义补足"
verification_strength: "verified"

# --- 产品分层 ---
product_tier: "A_primary"
evidence_tier: "high_conf"

# --- 触发 ---
trigger_group: "variance_based"
computed_fields:
  - "kills"
  - "deaths"
  - "assists"
  - "champion_damage"
  - "cs"
  - "gold"
  - "damage_share_percent"
counter_evidence: "近 N 局 kda_variance < P80（发挥过于稳定，骰子不成立）"

# --- 冲突组 ---
conflict_group_id: null
conflict_role: null

# --- 安全 & 开关 ---
self_mock_switch: "none"
ethics_review_required: false
risk_level: "low"
anti_irony_firewall: "触发条件为发挥波动大而非固定负面——正面/负面均可触发，降低反讽空间。'骰子'描述的是不确定性而非人格否定"

# --- 版本 & 发布 ---
release_group: "default_on"
grayscale_rollback_condition: "用户反馈「369 数字绑定导致不理解」> 20% → 降为 B 级或添加解释文案"
version: "1.0.0"
changelog: "R4→R8→R9 维持 A primary。实验层中 origin 最强 + 语义最自洽的组合。v1 默认开启。"
status: "active"
```

### 9.3 示例：奇迹行者（证据待补，P0 缺失核心层）

```yaml
meme_id: "miracle-walker"
display_name: "奇迹行者"
aliases: ["奇迹行者还在刷野"]
position: "Jungle"

# --- 双轨证据 ---
origin_verified: false
origin_tier: "P3"
origin_ref: "P3 三源（bilibili wiki / 社区共识 / 弹幕文化）指向姿态直播——但原始直播录像 P0 未定位。GAP-X1 裁定：P0 缺失不得声称 origin_verified"
meaning_verified: true
meaning_tier: "community_consensus"
meaning_ref: "「打野只刷野不参团」——语义直接来源于游戏行为，多源交叉验证无争议。核心语义在社区中无分歧"
verification_strength: "community_consensus"

# --- 产品分层 ---
product_tier: "B_sub_tag"
evidence_tier: "medium_conf"

# --- 触发 ---
trigger_group: "afk_farming_jungle"
computed_fields:
  - "cs"
  - "duration_minutes"
  - "kill_participation_percent"
  - "assists"
  - "deaths"
counter_evidence: "kill_participation_percent > P50 或 assists > P50（参团积极，不成立）"

# --- 冲突组 ---
conflict_group_id: "CG-JG-01"
conflict_role: "secondary"

# --- 安全 & 开关 ---
self_mock_switch: "required"
ethics_review_required: false
risk_level: "medium"
anti_irony_firewall: "含轻度嘲讽（「只刷不参团」）。自嘲开关必须。P0 缺失制约产品级——evidence_tier=medium_conf，若 P0 补证失败则永久 B_sub_tag"

# --- 版本 & 发布 ---
release_group: "evidence_pending"
grayscale_rollback_condition: "P0 补证失败 → 接受 P3 作为最高证据等级，产品级永久 B_sub_tag"
version: "0.9.0"
changelog: "R4 核心层。R8 从 A 降 B（GAP-X1）。R9 归入证据待补。v1 暂不触发，P0 直播时间戳人工定位后 v1.1 评估上线。"
status: "pending_review"
```

---

*编制：R04–R10 全链路萃取。所有裁决以 R10 closure-audit 为最终闭合标注。*
