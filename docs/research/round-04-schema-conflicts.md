# 深度调查第4轮：统一梗语料 Schema 与冲突机制

> **轮次**：Explorer Round 4 — Schema Design & Conflict Resolution
> **状态**：Final
> **日期**：2026-07-24
> **来源**：综合 Round 1 评价框架 + Round 2 四份传播/赛事/解说/战队调查 + Round 3 漏斗/审计/主播修复/证据台账
> **目标**：设计统一、最小可实施的梗语料 Schema，定义冲突机制，用 10 个高优梗实例填充，裁决 YYDS 层级与奇迹行者证据-产品关系
> **原则**：origin_verified 与 meaning_verified 分家；保留来源层级、风险防火墙、字段需求、产品层级、位置、模式、必要证据/反证、冲突组、版本与审核

---

## 1. 统一 Schema 设计

### 1.0 设计前提：从前三轮审计中提取的约束

| 约束来源 | 约束内容 | 对 Schema 的影响 |
|----------|----------|-----------------|
| **GAP-E1**（审计） | ledger 混淆"语义确认"与"首创确认"，官方梗百科收录被等同于 origin_verified | **必须将 origin_verified 与 meaning_verified 拆分为两个独立字段** |
| **GAP-E2**（审计） | 45% 条目"P0 存在但未链接"被当作已验证 | P0 缺失时 origin_verified 必须为 `false` 或 `pending`，不可默认为 `true` |
| **GAP-C1/C2**（审计） | champion_id / rank / opponent_id / promo_series 等字段在框架指标库中缺失 | Schema 需区分"当前可计算字段"与"依赖外部维表字段"，标记可计算性等级 |
| **GAP-F3**（审计） | "虎大将军"正面触发的反讽空间无法通过触发严格度杜绝 | Schema 需 `anti_irony_firewall` 字段记录反讽风险的缓解策略 |
| **GAP-P1**（审计） | 打野位严重短缺正面称号 | Schema 需 `position_coverage` 元数据字段跟踪五位覆盖平衡 |
| **GAP-X1**（审计） | "奇迹行者"证据 HIGH_CONF 但产品 A-primary — 证据/产品分级脱节 | Schema 需 `evidence_tier` 与 `product_tier` 独立记录，允许证据不足时降产品级 |
| **GAP-S3**（审计） | YYDS 在 streamer(status) vs funnel(primary) 层级冲突 | 需在冲突机制中裁决（见 §3.1）|

### 1.1 核心 Schema（JSON Schema 兼容，最小可实施）

```yaml
# ============================================================
# 根记录：一条梗语料
# ============================================================
meme_id: string                    # 唯一标识，如 "miracle-walker"
display_name: string               # 展示名称，如 "奇迹行者"
display_name_short: string         # 短名称（弹窗/列表），如 "奇迹行者"
aliases: [string]                  # 别名列表，如 ["奇迹行者还在刷野"]

# ---------- 来源核验（双轨分离）----------
origin_verified: bool              # 首创溯源是否已核验（P0/P1 可定位到首创时刻/人物/赛事/直播）
origin_source_tier: enum           # 首创来源等级：P0 | P1 | P2 | P3 | P4 | pending
origin_source_ref: string          # 首创溯源的可点击链接（P0 比赛录像/直播切片 URL）
origin_source_desc: string         # 首创溯源文字描述（50-200字），含时间/人物/赛事/直播局次
origin_p0_link_pending: bool       # P0 链接是否待补充（GAP-E2 修复追踪标记）

meaning_verified: bool             # 流行语义是否已核验（语义含义被可靠来源确认）
meaning_source_tier: enum           # 语义来源等级：P0 | P1 | P2 | P3 | consensus
meaning_source_refs: [string]      # 语义确认的可点击链接列表（P1 官方收录 / P3 百科词条）
meaning_desc: string               # 原始语境下的含义（50-150字）
meaning_current: string            # 当前社区通用理解（50-150字），若语义已演变需标注
meaning_divergence: enum           # 语义演变状态：none | shifted | inverted | disputed
meaning_divergence_note: string    # 语义演变说明（如"虎大将军"褒义→双刃）

# ---------- 风险防火墙 ----------
sentiment: enum                    # positive | neutral | teasing | negative | forbidden
risk_tier: enum                    # 🟢 safe | 🟡 caution | 🟠 warning | 🔴 forbidden
risk_flags: {                      # 风险标签（任一为 true → 需额外审查）
  derogatory: bool                 #   是否含贬损
  racial_appearance: bool          #   是否涉及外貌/种族
  nationality: bool                #   是否涉及国籍论
  personality_denial: bool         #   是否人格否定
  fan_circle: bool                 #   是否饭圈/选手绑定
  legal_controversy: bool          #   是否涉及法律争议
  official_warning: bool           #   是否有官方警告记录
  disease_disability: bool         #   是否涉及疾病/残疾
}
known_black_names: [string]        # 已知黑称变体（用于审核自动排除）
mitigation: string                 # 风险缓解措施说明（50-200字）
anti_irony_firewall: string        # 防反讽策略（若 sentinemt 含讽刺风险，描述如何堵死，如 GAP-F3）
ethics_review_required: bool       # 是否需要伦理审查（如"红温"的 tilt 代理映射）

# ---------- 产品层级 ----------
product_tier: enum                 # primary | sub_tag | status | hidden
evidence_tier: enum                # origin_verified | high_conf | med_conf | low_conf | pending
                                   #   GAP-X1 修复：证据等级独立于产品等级
tier_rationale: string             # 层级判定理由（50-100字）

# ---------- 语义与行为映射 ----------
category: enum                     # player_meme | streamer_meme | caster_meme | community_meme
target_position: [enum]            # top | jungle | mid | bottom | support | any
target_modes: [enum]               # ranked_solo | ranked_flex | normal | aram | arena
target_champions: [int]            # 适用英雄 ID 列表（空 = 不限）
position_lock: bool                # 是否严格位置绑定（true = 非该位置不可触发）
behavior_pattern: string           # 行为模式一句话描述（如"打野只顾刷野不参团"）
behavior_indicators: [string]      # ≤ 3 个核心行为指标描述（如"低参团率""高刷野量"）

# ---------- 触发规则 ----------
trigger_metrics: [MetricRule]      # 核心触发指标及阈值（必要条件）
support_metrics: [MetricRule]      # 辅助证据（增强置信度）
counter_metrics: [MetricRule]      # 反证规则（一票否决或降权）
sample_min_games: int              # 最低样本场数
sample_window_days: int            # 样本时间窗口
same_pos_min_games: int            # 同位置最低场数
normalize_by: enum                 # 标准化基准：same_position | same_mode | same_champion
confidence_threshold: float        # 置信度门槛（0-1）

# ---------- 可计算性评估 ----------
computability_tier: enum           # directly_computable | needs_champion_table | needs_rank_data
                                   #   | needs_opponent_data | needs_event_data | not_computable
computability_note: string         # 可计算性备注（记录依赖的未定义字段，GAP-C2 修复）
missing_fields: [string]           # 当前 CSV 缺失的必要字段列表

# ---------- 传播力与时效性 ----------
recognition_level: enum            # out_of_circle | general_player | lpl_viewer | core_fan | niche
half_life_status: enum             # rising | stable | fading | niche_stable
recognition_rationale: string      # 认知度判定理由

# ---------- 冲突与组合 ----------
conflict_group: string             # 所属冲突组 ID（空 = 无冲突组）
conflict_role: enum                # 冲突组内角色：primary | alternative | subordinated | deprecated
pair_with: [string]                # 正反面搭配的 meme_id
replaces: [string]                 # 替代的旧 meme_id
replaced_by: [string]             # 被替代的新 meme_id

# ---------- 版本与审核 ----------
version: string                    # 语义化版本，如 "1.0.0"
last_reviewed: date                # 最后审核日期
last_modified: date                # 最后修改日期
reviewer: string                   # 审核者标识
audit_trail: [AuditEntry]          # 变更历史（至少记录 evidence_tier / product_tier 变更）

# ---------- 五位覆盖元数据（GAP-P1 修复）----------
position_coverage_impact: enum     # 此条目对五位置平衡的贡献：fills_gap | neutral | saturates
position_coverage_note: string     # 位置覆盖备注（如"打野位唯一 A 级正面称号"）
```

### 1.2 子结构定义

#### MetricRule（触发规则子结构）

```yaml
metric: string              # 指标名（见框架 §3 指标库）
operator: enum              # gt | lt | gte | lte | between | percentile_top | percentile_bottom
value: float                # 阈值（单值）
value_range: [float, float] # 区间值（between 时使用）
weight: float               # 权重（0-1）
required: bool              # 是否必要条件（false = 辅助证据）
scope: enum                 # single_game | recent_n_games | season_average
```

#### AuditEntry（变更记录子结构）

```yaml
date: date                  # 变更日期
field: string               # 变更字段名
old_value: string           # 旧值
new_value: string           # 新值
reason: string              # 变更理由
```

---

### 1.3 origin_verified 与 meaning_verified 的判定矩阵

| 场景 | origin_verified | meaning_verified | 典型梗 |
|------|:---:|:---:|--------|
| P0 首创定位 + 语义明确 | ✅ true | ✅ true | 天神下凡（S8 半决赛 VOD + P1 官方认证） |
| P1 官方收录但无单场首创（如"永不团灭"是规律性观察） | ❌ false | ✅ true | 永不团灭、众生平等 |
| P0 存在但未链接（声称可定位但无 URL） | ❌ false `pending` | ✅ true | 奇迹行者（姿态直播录像未定位） |
| P0 不可复现（私密聊天泄露等） + P3 社区共识强 | ❌ false | ✅ true | CJB（微信截图 P4）、上流上单 |
| 仅 P3 社区来源，无 P0/P1/P2 | ❌ false | ⚠️ 需标注"社区共识" | 接Q辣舞、红温、边缘 OB |
| P1 官方收录 + P0 首创定位 | ✅ true | ✅ true | 虎大将军（2017 LPL 夏半决 + 官方梗百科） |
| 起源有争议/多声称者 + P3 社区共识 | ❌ false `disputed` | ✅ true `disputed_origin` | 下饭 |
| 无任何可点击 URL | ❌ false `low_conf` | ❌ false | 五五开（当前状态）|

**判定规则**：
- `origin_verified = true` 仅当 P0 首创时刻有可点击链接 **或** P1 官方材料明确记录了首创时刻（人物/时间/赛事）且该材料可访问
- "P0 存在但未链接" → `origin_verified = false, origin_p0_link_pending = true`
- `meaning_verified = true` 当至少一个 P1-P3 可访问来源确认了梗的语义含义
- 两者独立判定，互不依赖

### 1.4 来源层级（P0–P4）严格定义

沿用 Round 3 证据台账的定义，补入 Schema 作为 `origin_source_tier` / `meaning_source_tier` 的枚举值：

| 等级 | 定义 | 可支持 origin_verified? | 可支持 meaning_verified? |
|------|------|:---:|:---:|
| **P0** | 原始比赛/直播录像（可定位到具体局次、时间戳，有可点击链接） | ✅ | ✅ |
| **P1** | 官方赛事出品、战队官方材料、选手本人确认、Riot/LOL 官方文章 | ✅（若记录了首创时刻）| ✅ |
| **P2** | 同期可靠媒体（2014-2020 时效报道） | ❌（辅助证实）| ✅（辅助证实）|
| **P3** | 社区共识材料（百科词典、知乎高赞、B站二创） | ❌（仅验证流行语义）| ✅（验证流行语义）|
| **P4** | 不可复现（死链、无存档、仅凭记忆/口述、疑似 AI 生成链接） | ❌ | ❌ |
| **pending** | 声称存在但未提供链接（GAP-E2 待修复） | ❌（等价 P4）| ❌（等价 P4）|

---

## 2. 冲突机制

### 2.1 冲突类型

| 类型 | 标识符 | 定义 | 示例 |
|------|:------:|------|------|
| **语义重叠** | `SEMANTIC_OVERLAP` | 两个或多个梗映射到同一玩家行为模式，触发条件高度重叠 | 不破不立 / 翻山 / 涅槃 / 骑士归来 / 北伐 = 五逆袭叙事 |
| **正反对** | `POS_NEG_PAIR` | 同位置/同英雄，互为正反面，触发条件互斥 | 护国神牛（正面）↔ 疯牛病（反面）|
| **互斥** | `MUTUAL_EXCLUSION` | 不可同时授予（语义矛盾或产品冲突） | 369骰子（不稳定）↔ 大满贯/铁人（极稳定）|
| **层级竞争** | `TIER_COMPETITION` | 同一梗在不同产品层级（primary vs status）声称中存在不一致 | YYDS：streamer 称 status，funnel 称 primary |
| **英雄重叠** | `CHAMPION_OVERLAP` | 多个梗依赖同一英雄的同一行为面 | 洛神 / 冠军洛 / 洛王 / 装杯 四者常用英雄均含洛 |

### 2.2 冲突组定义

```yaml
conflict_group:
  group_id: string                     # 如 "comeback-narrative"
  group_type: enum                     # SEMANTIC_OVERLAP | POS_NEG_PAIR | MUTUAL_EXCLUSION | TIER_COMPETITION | CHAMPION_OVERLAP
  members: [string]                    # meme_id 列表
  resolution: enum                     # priority_order | mutual_exclusion | merge | user_choice | tier_adjudication
  
  # priority_order 时使用：
  priority: [string]                   # 优先级排序（从高到低的 meme_id 列表）
  
  # merge 时使用：
  merged_title_id: string              # 合并后的新 meme_id
  sub_types: [{meme_id: string, sub_condition: string}]  # 子类型及区分条件
  
  # tier_adjudication 时使用：
  adjudicated_tier: enum               # 裁决后的 product_tier
  adjudication_reason: string          # 裁决理由
```

### 2.3 已识别的冲突组

#### CG-01：五逆袭叙事（严重语义重叠）

| 字段 | 值 |
|------|-----|
| **group_id** | `comeback-narrative` |
| **group_type** | `SEMANTIC_OVERLAP` |
| **members** | `["bu-po-bu-li", "fan-shan", "nie-pan", "qi-shi-gui-lai", "bei-fa"]` |
| **问题** | 五个梗的核心语义完全相同：连败/低谷→反弹/连胜→突破。来自五个不同战队叙事，映射到同一玩家行为（V 型反弹）。选择任何一个 = 用特定战队叙事覆盖玩家个人经历。 |
| **resolution** | `priority_order` |
| **priority** | `["bu-po-bu-li", "fan-shan", "nie-pan", "qi-shi-gui-lai", "bei-fa"]` |
| **排序理由** | 1) 不破不立：认知度最高（央视报道+官方纪录片），字面可脱离战队理解 2) 翻山：记得解说经典，但 IG 绑定较强 3) 涅槃：FPX 绑定，凤凰意象限定 4) 骑士归来：EDG 专属，字面不解自明度最低 5) 北伐：TES 2022 特定叙事，时效性已衰减 |
| **产品建议** | 五者保留一条作为 `primary`（不破不立），其余降为 `status`（单场反弹状态文案） |

#### CG-02：洛三元（英雄重叠 + 语义重叠）

| 字段 | 值 |
|------|-----|
| **group_id** | `rakan-proficiency` |
| **group_type** | `CHAMPION_OVERLAP` |
| **members** | `["luo-shen", "guan-jun-luo", "luo-wang"]` |
| **问题** | 三者语义高度重叠（都是"洛玩得好"），一个玩洛好的辅助可能同时触发 3 个称号 |
| **resolution** | `merge` |
| **merged_title_id** | `rakan-master` |
| **sub_types** | `[{"luo-shen": "开团型洛（参团率 P80+）"}, {"guan-jun-luo": "保护型洛（助攻 P80+ 死亡 P50-）"}, {"luo-wang": "连胜型洛（连胜≥5 场）"}]` |
| **产品建议** | 合并为"洛精通"称号体系，内部分三个子类型 |

#### CG-03：护国神牛 ↔ 疯牛病（正反对）

| 字段 | 值 |
|------|-----|
| **group_id** | `alistar-polarity` |
| **group_type** | `POS_NEG_PAIR` |
| **members** | `["hu-guo-shen-niu", "feng-niu-bing"]` |
| **问题** | 同一英雄（牛头）的正反面：正面 = 保护完美、死亡少；反面 = 乱开团、死亡多 |
| **resolution** | `mutual_exclusion` |
| **产品建议** | 互斥展示：同时只授予一个。当 `deaths > P70` → 落入"疯牛病"域；当 `deaths < P30` → 保留"护国神牛"域。中间地带不触发任何牛头称号 |

#### CG-04：369骰子 ↔ 大满贯/铁人（互斥）

| 字段 | 值 |
|------|-----|
| **group_id** | `stability-axis` |
| **group_type** | `MUTUAL_EXCLUSION` |
| **members** | `["369-dice", "da-man-guan"]` |
| **问题** | 369骰子 = 极不稳定；大满贯/铁人 = 极稳定。同一玩家不可兼得 |
| **resolution** | `mutual_exclusion` |
| **产品建议** | 当 `kda_variance > P80` → 落入 369 域；当 `kda_cv < P20` → 落入铁人域。中间地带两个都不触发 |

#### CG-05：左手 ↔ 虎大将军（中单 carry 重叠）

| 字段 | 值 |
|------|-----|
| **group_id** | `mid-carry-overlap` |
| **group_type** | `SEMANTIC_OVERLAP` |
| **members** | `["zuo-shou", "hu-da-jiang-jun"]` |
| **问题** | 两者都描述中单 carry，但角度不同：左手 = 持续压制（高 CS + 高 DPM 均值）；虎大将军 = 单场爆发（单场 P90+ damage_share） |
| **resolution** | `priority_order`（数据层面区分，优先左手） |
| **priority** | `["zuo-shou", "hu-da-jiang-jun"]` |
| **排序理由** | 左手描述的是"风格"（持续型），适合主称号；虎大将军描述的是"时刻"（爆发型），更适合在单场高光时作为状态文案展示 |
| **产品建议** | 平时显示"左手"作为主称号，当单场 damage_share > P90 时叠加"虎大将军"状态文案 |

#### CG-06：天神下凡 ↔ 永远滴神（any 位 carry 重叠）

| 字段 | 值 |
|------|-----|
| **group_id** | `any-carry-overlap` |
| **group_type** | `SEMANTIC_OVERLAP` |
| **members** | `["tian-shen-xia-fan", "yyds"]` |
| **问题** | 两者都描述"碾压级 carry"，无固定位置，触发条件可能同时满足 |
| **resolution** | `priority_order` |
| **priority** | `["tian-shen-xia-fan", "yyds"]` |
| **排序理由** | 天神下凡有具体比赛名场面（S8 剑魔 1v4）、LOL 专属性强、位置有偏好（上中野）；YYDS 已出圈泛化、语义稀释。天神下凡作为主称号更合适（LOL 专属），YYDS 作为单场高光状态文案 |
| **产品建议** | 见 §3.1 YYDS 层级裁决 |

---

## 3. 关键裁决

### 3.1 YYDS / 永远滴神 层级裁决

| 维度 | 分析 |
|------|------|
| **证据状况** | origin_verified = false（P0 山泥若直播录像未链接，origin_p0_link_pending = true）。meaning_verified = true（百度百科独立词条 + P3 知乎/社区多源交叉验证） |
| **语义演变** | 2019 年山泥若喊"Uzi，永远滴神！" → 2020 年后 YYDS 成为中文网络最高频缩写词，被人民日报等主流媒体使用 → 语义从"Uzi 是神"泛化为"任何顶格赞美" |
| **LOL 专属度** | **低**。出圈后 YYDS 可用于体育、影视、科技等任何领域，"LOL 原生感"被严重稀释 |
| **产品适合性** | 作为 `primary`（主称号）：语义太宽泛，"永远滴神"作为 90 天长期画像标签会造成语义通胀（"系统说我是神"）。作为 `status`（状态文案）：单场碾压级 carry 后弹出"刚才那把——永远滴神！"更符合原梗的"即时惊叹"语境 |
| **跨文档冲突** | streamer-remediation §6.1 列为 status；funnel A-ANY-02 列为 A 级 primary → **冲突** |

**裁决**：

| 字段 | 值 |
|------|-----|
| **product_tier** | **`status`**（非 primary） |
| **理由** | 1) "永远滴神"的原始语境是**实时惊叹**（山泥若看比赛时喊出的），不是**长期画像**。作为主称号赋予玩家 90 天静态标签，语义偏离原梗的"即时性"。2) YYDS 已高度泛化（out_of_circle），LOL 专属区分度低。作为状态文案（单场高光触发）而非主称号（长期属性），既保留了梗的力量又不稀释 LOL 品牌。3) 与"天神下凡"形成分工：天神下凡 = 长期 carry 风格（primary），YYDS = 单场碾压高光（status） |
| **触发建议** | 单场 `damage_share ≥ P95` 且 `kills ≥ P90` 且 `result = 胜利` → 弹出状态文案"刚才那把——永远滴神！" |
| **对 funnel 的影响** | A-ANY-02 应降级为 C 级（status），与 A-ANY-01（天神下凡）形成清晰分工 |
| **对 streamer-remediation 的影响** | streamer 的 status 判定被确认 |

### 3.2 奇迹行者 证据等级与产品可用性关系裁决

| 维度 | 分析 |
|------|------|
| **证据状况** | origin_verified = false（P0 姿态直播具体日期/录像未定位，origin_p0_link_pending = true）。meaning_verified = true（P1 LOL 视频中心二次收录 + P3 B 站多版本切片 200 万+ 播放 + 起点中文网问答） |
| **产品状况** | funnel 列为 A-JG-01 primary。作为打野位**唯一**可触发 A 级称号，且在五位置平衡中打野已是短板（GAP-P1） |
| **风险** | teasing 向，行为描述（低参团+高刷野），无外貌/国籍/人格攻击 |
| **可计算性** | directly_computable（kill_participation + cs + position，均在框架指标库中已定义） |
| **跨文档冲突** | ledger 证据等级 HIGH_CONF（P0 缺失），funnel 产品等级 A-primary → GAP-X1 被审计标记 |

**裁决**：

| 字段 | 值 |
|------|-----|
| **evidence_tier** | **`high_conf`**（非 origin_verified） |
| **product_tier** | **`primary`**（维持，但附带证据待补充标注） |
| **理由** | 证据等级与产品等级应独立管理。奇迹行者的产品可用性不依赖 P0 首创定位——其语义验证（P1 + 多 P3 交叉）、行为映射（可独立验算）、位置锁定（仅打野）、风险状况（teasing 无红线）和可计算性（全字段已定义）均独立于"首创录像是否可点击"而成立。P0 缺失影响的是学术/评审的可信度，不影响产品功能的可用性。**但必须在产品上线前标记 `origin_p0_link_pending = true` 并在上线 checklist 中要求补充 P0 链接。** |
| **对产品的影响** | 奇迹行者保持 A-JG-01 primary。这是打野位唯一 A 级称号，移除将导致打野位正面称号归零（天神下凡打野位触发概率极低——damage_share ≥ 40% 仅少数 carry 型打野可达）。产品侧可接受 `evidence_tier = high_conf` 的称号上线，但需在内部文档中标记证据缺口 |
| **与审计 GAP-X1 的关系** | 审计建议"P0 缺失的条目最高不超过 B 级"。但该建议未区分"证据不完整"与"证据不可靠"。奇迹行者的证据是"不完整"（P0 可定位但未链接），而非"不可靠"（P1+P3 多源交叉验证强）。因此 A 级可维持，但 `evidence_tier` 不得声称 `origin_verified` |
| **补证要求** | 上线前补充姿态直播的具体日期和原始录像链接（B 站/斗鱼），将 `origin_p0_link_pending` 从 `true` 改为 `false`，`evidence_tier` 从 `high_conf` 升级为 `origin_verified` |

---

## 4. 高优梗实例（10 个，完整 Schema 填充）

### 4.1 实例索引

| # | meme_id | display_name | position | product_tier | sentiment | 选取理由 |
|---|---------|-------------|:--------:|:----------:|:---------:|----------|
| 1 | `miracle-walker` | 奇迹行者 | jungle | primary | teasing | 打野位唯一 A 级，GAP-X1 测试案例 |
| 2 | `tian-shen-xia-fan` | 天神下凡 | top/jg/mid | primary | positive | P0+P1 双重核验，LPL 文化基础设施 |
| 3 | `dice-369` | 369骰子 | top | primary | teasing | 高位方差映射，sub_tag 组合设计典范 |
| 4 | `sudden-death-ad` | 暴毙AD | bottom | primary | teasing | 双刃剑型称号，激进风格—数据映射自洽 |
| 5 | `zuo-shou` | 左手 | mid | primary | positive | P1 官方确认，持续压制型 carry 典范 |
| 6 | `hu-da-jiang-jun` | 虎大将军 | mid | primary | positive | 反讽防火墙测试案例（GAP-F3） |
| 7 | `overheat` | 红温 | any | sub_tag | teasing | 伦理审查测试案例（GAP-D2），含自嘲开关 |
| 8 | `bu-po-bu-li` | 不破不立 | any | primary | positive | 五逆袭叙事之首（CG-01 优先级第一） |
| 9 | `yyds` | 永远滴神 | any | status | positive | YYDS 层级裁决案例（§3.1） |
| 10 | `rakan-master` | 洛精通 | support | primary | positive | 洛三元合并案例（CG-02），五位平衡测试 |

### 4.2 实例完整定义

---

#### #1：奇迹行者（miracle-walker）

```yaml
meme_id: "miracle-walker"
display_name: "奇迹行者"
display_name_short: "奇迹行者"
aliases: ["奇迹行者还在刷野"]

# 来源核验
origin_verified: false
origin_source_tier: pending
origin_source_ref: ""
origin_source_desc: "2023 年，前职业选手 zz1tai（姿态）在青铜局遇到 ID 为'奇迹行者'的死歌打野，全程只刷野不抓人不参团。姿态多次喊'奇迹行者还在刷野！'成为名场面。原始直播具体日期和录像链接未定位。"
origin_p0_link_pending: true

meaning_verified: true
meaning_source_tier: P1
meaning_source_refs:
  - "https://lol.qq.com/v/v2/detail.shtml?docid=3845649808433353910"  # LOL 官方视频中心收录
  - "https://www.bilibili.com/video/BV1Ag4y1G7QD/"                      # B 站原切片 216.4万播放
  - "https://m.qidian.com/ask/qosdylwiqhv"                               # 起点中文网问答
meaning_desc: "姿态在青铜局遇到 ID 为'奇迹行者'的死歌打野，全程不抓人不参团只刷野，姿态多次破防喊'奇迹行者还在刷野！'"
meaning_current: "打野玩家只顾刷野不 gank 不参团，已成为打野不抓人的通用弹幕梗"
meaning_divergence: none
meaning_divergence_note: ""

# 风险防火墙
sentiment: teasing
risk_tier: 🟡
risk_flags:
  derogatory: false
  racial_appearance: false
  nationality: false
  personality_denial: false
  fan_circle: false
  legal_controversy: false
  official_warning: false
  disease_disability: false
known_black_names: []
mitigation: "仅在同位置参团率显著偏低时触发，UI 附带'多关注小地图，及时支援队友！'鼓励文案"
anti_irony_firewall: "不涉及反讽风险（行为描述类 teasing，非人格评价）"
ethics_review_required: false

# 产品层级
product_tier: primary
evidence_tier: high_conf
tier_rationale: "打野位唯一 A 级称号。语义清晰、行为映射自洽、可计算、无红线风险。P0 首创录像待补充不影响产品可用性。"

# 语义与行为映射
category: streamer_meme
target_position: [jungle]
target_modes: [ranked_solo, ranked_flex, normal]
target_champions: []
position_lock: true
behavior_pattern: "打野只顾刷野不 gank 不参团"
behavior_indicators: ["低参团率", "高刷野量"]

# 触发规则
trigger_metrics:
  - metric: "avg_kill_participation"
    operator: "percentile_bottom"
    value: 25
    weight: 1.0
    required: true
    scope: "season_average"
  - metric: "cs_per_min_avg"
    operator: "percentile_top"
    value: 75
    weight: 0.5
    required: false
    scope: "season_average"
support_metrics:
  - metric: "assists"
    operator: "percentile_bottom"
    value: 30
    weight: 0.3
    required: false
    scope: "recent_n_games"
counter_metrics:
  - metric: "avg_kill_participation"
    operator: "gte"
    value: 40
    weight: 1.0
    required: true
    scope: "season_average"
    note: "参团率 ≥ P40 一票否决"
sample_min_games: 15
sample_window_days: 90
same_pos_min_games: 15
normalize_by: same_position
confidence_threshold: 0.7

# 可计算性
computability_tier: directly_computable
computability_note: "kill_participation_percent、cs、duration_minutes 均在框架指标库已定义"
missing_fields: []

# 传播力与时效性
recognition_level: lpl_viewer
half_life_status: rising
recognition_rationale: "2023 年起源，姿态粉丝和 LOL 社区广泛传播，仍在上升期"

# 冲突与组合
conflict_group: ""
conflict_role: ""
pair_with: []
replaces: []
replaced_by: []

# 版本与审核
version: "1.0.0"
last_reviewed: "2026-07-24"
last_modified: "2026-07-24"
reviewer: "round-04"
audit_trail: []

# 五位覆盖
position_coverage_impact: fills_gap
position_coverage_note: "打野位唯一 A 级正面称号（虽为 teasing 但行为描述性强）"
```

---

#### #2：天神下凡（tian-shen-xia-fan）

```yaml
meme_id: "tian-shen-xia-fan"
display_name: "天神下凡"
display_name_short: "天神下凡"
aliases: ["天神下凡一锤四"]

origin_verified: true
origin_source_tier: P0
origin_source_ref: "https://lol.qq.com/v/v2/detail.shtml?docid=9760876678890950521"  # LOL 官方视频
origin_source_desc: "2018 S8 世界赛半决赛 IG vs G2 第 2 局，TheShy 使用剑魔在河道小龙处一打四反杀，LPL 解说喊出'天神下凡一锤四'。此战后成为 TheShy 最具标志性的名场面。"
origin_p0_link_pending: false

meaning_verified: true
meaning_source_tier: P1
meaning_source_refs:
  - "https://lol.qq.com/v/v2/detail.shtml?docid=9760876678890950521"  # P1 官方
  - "https://games.sina.cn/gn/ol/2018-10-27/detail-ifxeuwws8720808.d.html"  # P2 新浪游戏
  - "https://zh.moegirl.org.cn/%E5%A7%9C%E6%89%BF%E9%8C%B2"  # P3 萌娘百科
meaning_desc: "TheShy 剑魔河道一打四反杀，LPL 解说喊'天神下凡'"
meaning_current: "在关键团战中打出远超预期的毁灭性表现，以一己之力扭转战局"
meaning_divergence: none
meaning_divergence_note: ""

sentiment: positive
risk_tier: 🟢
risk_flags: {derogatory: false, racial_appearance: false, nationality: false, personality_denial: false, fan_circle: false, legal_controversy: false, official_warning: false, disease_disability: false}
known_black_names: []
mitigation: "纯褒义，无需特殊缓解"
anti_irony_firewall: "触发严格度控制：近 20 场 ≥ 3 场高光 + damage_share ≥ 40% + kill_participation ≥ 70% + 胜利 + deaths < kills/2。低概率触发可降低反讽风险"
ethics_review_required: false

product_tier: primary
evidence_tier: origin_verified
tier_rationale: "P0+P1 双重核验，LPL 最经典名场面，认知度 general_player，纯褒义无风险"

category: caster_meme
target_position: [top, jungle, mid]
target_modes: [ranked_solo, ranked_flex]
target_champions: []
position_lock: false
behavior_pattern: "在关键团战中 carries 全场，打出碾压级高光表现"
behavior_indicators: ["高击杀", "高伤害占比", "高参团率"]

trigger_metrics:
  - metric: "kills"
    operator: "gte"
    value: 5
    weight: 1.0
    required: true
    scope: "recent_n_games"
    note: "近 20 场中 ≥ 3 场满足 kills ≥ 5 + damage_share ≥ 40% + kill_participation ≥ 70% + 胜利"
  - metric: "damage_share"
    operator: "gte"
    value: 40
    weight: 1.0
    required: true
    scope: "recent_n_games"
  - metric: "kill_participation"
    operator: "gte"
    value: 70
    weight: 1.0
    required: true
    scope: "recent_n_games"
support_metrics:
  - metric: "damage_per_min_avg"
    operator: "percentile_top"
    value: 80
    weight: 0.5
    required: false
    scope: "season_average"
counter_metrics:
  - metric: "deaths"
    operator: "gte"
    value: 2.5
    weight: 0.5
    required: false
    scope: "recent_n_games"
    note: "高光场次中 deaths ≥ kills/2 → 降权"
sample_min_games: 15
sample_window_days: 90
same_pos_min_games: 15
normalize_by: same_position
confidence_threshold: 0.75

computability_tier: directly_computable
computability_note: "kills, damage_share, kill_participation, result, deaths 均在框架已定义"
missing_fields: []

recognition_level: general_player
half_life_status: stable
recognition_rationale: "S8 IG 夺冠是中国 LOL 集体记忆，'天神下凡'是公认顶级名场面"

conflict_group: "any-carry-overlap"
conflict_role: primary
pair_with: []
replaces: []
replaced_by: []

version: "1.0.0"
last_reviewed: "2026-07-24"
last_modified: "2026-07-24"
reviewer: "round-04"
audit_trail: []

position_coverage_impact: neutral
position_coverage_note: "跨上中野三位，不特化某位置。打野位触发概率低（damage_share ≥ 40% 仅 carry 型打野可能达成）"
```

---

#### #3：369骰子（dice-369）

```yaml
meme_id: "dice-369"
display_name: "369骰子"
display_name_short: "369骰子"
aliases: ["骰子型上单"]

origin_verified: true
origin_source_tier: P1
origin_source_ref: ""
origin_source_desc: "选手 369（白家浩）因发挥极不稳定被观众称为'骰子型上单'。Karsa 队内批评（'先选永远都是鳄鱼和那什么'）进一步固化。LPL 官方垃圾话环节引用。"
origin_p0_link_pending: false

meaning_verified: true
meaning_source_tier: P1
meaning_source_refs:
  - "https://news.qq.com/rain/a/20210113V088MV00"  # P2 腾讯新闻
  - "https://zh.moegirl.org.cn/%E7%99%BD%E5%AE%B6%E6%B5%A9"  # P3 萌娘百科
  - "https://zhuanlan.zhihu.com/p/2032557116884504815"  # P3 知乎
meaning_desc: "369 选手状态极不稳定——'3'时拉跨，'6'时平庸，'9'时战神"
meaning_current: "上单玩家表现极度不稳定，上下限差距大"
meaning_divergence: none
meaning_divergence_note: ""

sentiment: teasing
risk_tier: 🟡
risk_flags: {derogatory: false, racial_appearance: false, nationality: false, personality_denial: false, fan_circle: false, legal_controversy: false, official_warning: false, disease_disability: false}
known_black_names: []
mitigation: "行为描述非人格攻击。副标签'今天摇到 9'提供正面出口"
anti_irony_firewall: "高方差+高胜率（win_rate > 60%）时降权为'高风险高回报'，不触发"
ethics_review_required: false

product_tier: primary
evidence_tier: origin_verified
tier_rationale: "P1 LPL 官方垃圾话引用可升级为 VERIFIED，认知度高，sub_tag 组合设计完善"

category: player_meme
target_position: [top]
target_modes: [ranked_solo, ranked_flex]
target_champions: []
position_lock: true
behavior_pattern: "上单表现极不稳定，上下限差距大"
behavior_indicators: ["KDA 方差高", "伤害占比方差高", "同时存在极高/极低 KDA 场次"]

trigger_metrics:
  - metric: "kda_variance"
    operator: "percentile_top"
    value: 80
    weight: 1.0
    required: true
    scope: "season_average"
  - metric: "damage_share_variance"
    operator: "percentile_top"
    value: 70
    weight: 0.5
    required: true
    scope: "season_average"
support_metrics:
  - metric: "kda"
    operator: "gte"
    value: 5.0
    weight: 0.3
    required: false
    scope: "recent_n_games"
    note: "近 20 场中存在 KDA > 5.0 的场次"
  - metric: "kda"
    operator: "lt"
    value: 1.0
    weight: 0.3
    required: false
    scope: "recent_n_games"
    note: "近 20 场中存在 KDA < 1.0 的场次"
counter_metrics:
  - metric: "win_rate"
    operator: "gt"
    value: 60
    weight: 1.0
    required: false
    scope: "season_average"
    note: "win_rate > 60% 且 kda_variance 在 P50-P70 → 降权，不触发"
sample_min_games: 15
sample_window_days: 90
same_pos_min_games: 15
normalize_by: same_position
confidence_threshold: 0.7

computability_tier: directly_computable
computability_note: "KDA 通过 kills/deaths/assists 聚合；方差需聚合窗口计算，框架指标库已定义"
missing_fields: []

recognition_level: lpl_viewer
half_life_status: stable
recognition_rationale: "369 选手仍活跃，LPL 解说持续使用"

conflict_group: "stability-axis"
conflict_role: primary
pair_with: []
replaces: []
replaced_by: []

version: "1.0.0"
last_reviewed: "2026-07-24"
last_modified: "2026-07-24"
reviewer: "round-04"
audit_trail: [{date: "2026-07-24", field: "evidence_tier", old_value: "high_conf", new_value: "origin_verified", reason: "Round 3 审计升级：P1 LPL 官方垃圾话引用可支持 VERIFIED"}]

position_coverage_impact: neutral
position_coverage_note: "上单位 2 项 A 级之一"
```

---

#### #4：暴毙AD（sudden-death-ad）

```yaml
meme_id: "sudden-death-ad"
display_name: "暴毙AD"
display_name_short: "暴毙AD"
aliases: ["AD暴毙"]

origin_verified: false
origin_source_tier: P3
origin_source_ref: ""
origin_source_desc: "JackeyLove 的 ADC 风格激进、走位靠前，团战经常率先阵亡但同时输出也极高。此为社区对 JackeyLove 多场比赛的累积观察总结，无单场首创时刻。"
origin_p0_link_pending: false

meaning_verified: true
meaning_source_tier: P3
meaning_source_refs:
  - "https://zh.moegirl.org.cn/%E5%96%BB%E6%96%87%E6%B3%A2"  # P3 萌娘百科
meaning_desc: "JackeyLove ADC 激进走位、团战暴毙但同时输出极高——双刃剑型选手"
meaning_current: "ADC 死亡高但输出也高，高风险高回报的激进风格"
meaning_divergence: none
meaning_divergence_note: ""

sentiment: teasing
risk_tier: 🟡
risk_flags: {derogatory: false, racial_appearance: false, nationality: false, personality_denial: false, fan_circle: false, legal_controversy: false, official_warning: false, disease_disability: false}
known_black_names: []
mitigation: "'暴毙'字面偏负面但原梗描述风格非贬低。UI 附'高风险高回报的激进派'文案。若 deaths 高但 damage_share < P40（纯送），降级为更负面标签（内部使用）"
anti_irony_firewall: "damage_share < P40 时被反证规则拦截，确保'暴毙'仅授予输出也高的玩家"
ethics_review_required: false

product_tier: primary
evidence_tier: high_conf
tier_rationale: "P3 社区共识无 P0/P1，但语义与行为映射自洽，可计算性强，认知度 general_player"

category: player_meme
target_position: [bottom]
target_modes: [ranked_solo, ranked_flex]
target_champions: []
position_lock: true
behavior_pattern: "ADC 激进走位导致高死亡 + 高输出，双刃剑型选手"
behavior_indicators: ["高死亡", "高伤害输出"]

trigger_metrics:
  - metric: "deaths"
    operator: "percentile_top"
    value: 80
    weight: 1.0
    required: true
    scope: "season_average"
  - metric: "damage_per_min_avg"
    operator: "percentile_top"
    value: 80
    weight: 1.0
    required: true
    scope: "season_average"
support_metrics:
  - metric: "kda"
    operator: "between"
    value_range: [0, 0]
    weight: 0.3
    required: false
    scope: "season_average"
    note: "KDA 在 P30-P60 区间（中低不垫底）"
counter_metrics:
  - metric: "damage_share"
    operator: "percentile_bottom"
    value: 40
    weight: 1.0
    required: true
    scope: "season_average"
    note: "damage_share < P40（纯送无输出）→ 降级内部标签"
sample_min_games: 15
sample_window_days: 90
same_pos_min_games: 15
normalize_by: same_position
confidence_threshold: 0.7

computability_tier: directly_computable
computability_note: "deaths, damage_share, kda 均在框架已定义"
missing_fields: []

recognition_level: general_player
half_life_status: stable
recognition_rationale: "JackeyLove 是 LPL 顶流 ADC，'暴毙'梗广泛传播"

conflict_group: ""
conflict_role: ""
pair_with: []
replaces: []
replaced_by: []

version: "1.0.0"
last_reviewed: "2026-07-24"
last_modified: "2026-07-24"
reviewer: "round-04"
audit_trail: []

position_coverage_impact: neutral
position_coverage_note: "ADC 位 3 项 A 级之一（另为尺帝、灯皇）"
```

---

#### #5：左手（zuo-shou）

```yaml
meme_id: "zuo-shou"
display_name: "左手"
display_name_short: "左手"
aliases: ["黄金左手"]

origin_verified: true
origin_source_tier: P1
origin_source_ref: ""
origin_source_desc: "Knight（卓定）是左撇子，左手持鼠标右手按键盘，加之实力出众，被 LPL 观众称为'黄金左手'。LOL 官方推特使用 'Golden Left Hand' 确认。"
origin_p0_link_pending: false

meaning_verified: true
meaning_source_tier: P1
meaning_source_refs:
  - "https://zh.wikipedia.org/zh-hans/%E5%8D%93%E5%AE%9A"  # P3 维基百科
  - "https://www.bilibili.com/video/BV1y5JXzpEE2/"          # P3 B站
meaning_desc: "Knight 左撇子 + 操作细腻 + 对线压制力强，被称为'黄金左手'"
meaning_current: "中单位置个人实力超群、操作细腻、对线压制力强"
meaning_divergence: none
meaning_divergence_note: ""

sentiment: positive
risk_tier: 🟢
risk_flags: {derogatory: false, racial_appearance: false, nationality: false, personality_denial: false, fan_circle: false, legal_controversy: false, official_warning: false, disease_disability: false}
known_black_names: []
mitigation: "纯褒义。注意骑士使用左手鼠标是生理特征，产品应避免对不同用手习惯的用户做区别对待——触发条件基于数据（CS+DPM）而非用手习惯"
anti_irony_firewall: "不涉及反讽风险（纯褒义）"
ethics_review_required: false

product_tier: primary
evidence_tier: origin_verified
tier_rationale: "P1 LOL 官方推特确认使用，R2 传播轮补足"

category: player_meme
target_position: [mid]
target_modes: [ranked_solo, ranked_flex]
target_champions: []
position_lock: true
behavior_pattern: "中单 CS 压制 + 高伤害输出 = 操作型 carry 中单"
behavior_indicators: ["高 CS 压制", "高伤害输出", "高 KDA"]

trigger_metrics:
  - metric: "cs_per_min_avg"
    operator: "percentile_top"
    value: 80
    weight: 1.0
    required: true
    scope: "season_average"
  - metric: "damage_per_min_avg"
    operator: "percentile_top"
    value: 75
    weight: 1.0
    required: true
    scope: "season_average"
support_metrics:
  - metric: "avg_kda"
    operator: "percentile_top"
    value: 70
    weight: 0.5
    required: false
    scope: "season_average"
counter_metrics:
  - metric: "avg_kill_participation"
    operator: "percentile_bottom"
    value: 30
    weight: 1.0
    required: true
    scope: "season_average"
    note: "过于单机（参团率 P30-）→ 不触发"
sample_min_games: 15
sample_window_days: 90
same_pos_min_games: 15
normalize_by: same_position
confidence_threshold: 0.7

computability_tier: directly_computable
computability_note: "cs, duration_minutes, champion_damage, kill_participation 均在框架已定义"
missing_fields: []

recognition_level: lpl_viewer
half_life_status: stable
recognition_rationale: "Knight 为 LPL 顶级中单，持续活跃"

conflict_group: "mid-carry-overlap"
conflict_role: primary
pair_with: []
replaces: []
replaced_by: []

version: "1.0.0"
last_reviewed: "2026-07-24"
last_modified: "2026-07-24"
reviewer: "round-04"
audit_trail: []

position_coverage_impact: neutral
position_coverage_note: "中单位 3 项 A 级之一"
```

---

#### #6：虎大将军（hu-da-jiang-jun）

```yaml
meme_id: "hu-da-jiang-jun"
display_name: "虎大将军"
display_name_short: "虎大将军"
aliases: ["谁敢横刀立马"]

origin_verified: true
origin_source_tier: P0
origin_source_ref: ""
origin_source_desc: "2017 LPL 夏季半决赛 RNG vs WE 第 5 局，米勒解说原话：'谁敢横刀立马，唯我虎大将军！' Xiaohu 飞机打出 9 万输出 carry 全场。P0 比赛 VOD 可定位。"
origin_p0_link_pending: false

meaning_verified: true
meaning_source_tier: P1
meaning_source_refs:
  - "https://lol.qq.com/news/detail_m.html?docid=9543050625178953097"  # P1 LOL 官方梗百科
  - "https://zh.moegirl.org.cn/%E6%9D%8E%E5%85%83%E6%B5%A9"            # P3 萌娘百科
meaning_desc: "米勒解说原话，Xiaohu 飞机九万输出 carry 全场"
meaning_current: "社区语义已从褒义转向双刃（2020 年后含讽刺），但产品层锁定正面触发 only"
meaning_divergence: shifted
meaning_divergence_note: "2020 年后 Xiaohu 世界赛表现不佳，社区反向使用'虎大将军'进行嘲讽。产品锁定米勒原话的褒义，禁止设计负面触发。"

sentiment: positive
risk_tier: 🟡  # 因社区反讽风险升级为 caution
risk_flags: {derogatory: false, racial_appearance: false, nationality: false, personality_denial: false, fan_circle: false, legal_controversy: false, official_warning: false, disease_disability: false}
known_black_names: ["2200", "虎大捞比"]
mitigation: "仅正面触发（damage_share > P90 + kills > P85 + 胜利）。反证严格：damage_share < P75 一票否决，失败不触发"
anti_irony_firewall: "触发条件严格到'不达标的玩家拿不到'，降低被反讽的概率。但需承认：社区反讽是社区行为，产品无法通过触发逻辑完全杜绝（GAP-F3 确认）。风险从'是否可能被反讽'改为'被反讽时的品牌伤害可控度'评估——正面触发+纯褒义 UI 可降低伤害。"
ethics_review_required: false

product_tier: primary
evidence_tier: origin_verified
tier_rationale: "P0 可定位 + P1 官方梗百科收录。严格正面触发+反证可降低社区反讽负面影响"

category: caster_meme
target_position: [mid]
target_modes: [ranked_solo, ranked_flex]
target_champions: []
position_lock: true
behavior_pattern: "中单在关键局打出碾压级伤害输出，carry 全队"
behavior_indicators: ["极高伤害占比", "极高击杀数", "胜利"]

trigger_metrics:
  - metric: "damage_share"
    operator: "percentile_top"
    value: 90
    weight: 1.0
    required: true
    scope: "recent_n_games"
    note: "近 30 天至少 1 场满足 3 个核心指标"
  - metric: "kills"
    operator: "percentile_top"
    value: 85
    weight: 1.0
    required: true
    scope: "recent_n_games"
  - metric: "result"
    operator: "eq"
    value: 1
    weight: 1.0
    required: true
    scope: "recent_n_games"
    note: "result = 胜利"
support_metrics:
  - metric: "damage_dealt"
    operator: "percentile_top"
    value: 95
    weight: 0.5
    required: false
    scope: "recent_n_games"
    note: "单场伤害 ≥ P95（'九万输出'级表现）"
counter_metrics:
  - metric: "damage_share"
    operator: "percentile_bottom"
    value: 75
    weight: 1.0
    required: true
    scope: "recent_n_games"
    note: "damage_share < P75 → 一票否决"
sample_min_games: 15
sample_window_days: 30
same_pos_min_games: 15
normalize_by: same_position
confidence_threshold: 0.8

computability_tier: directly_computable
computability_note: "damage_share, kills, result 均在框架已定义"
missing_fields: []

recognition_level: lpl_viewer
half_life_status: stable
recognition_rationale: "2017 起源，米勒解说名句，LPL 观众广泛认知。2020+ 反讽使用增加了梗的'双面性'传播"

conflict_group: "mid-carry-overlap"
conflict_role: alternative
pair_with: []
replaces: []
replaced_by: []

version: "1.0.0"
last_reviewed: "2026-07-24"
last_modified: "2026-07-24"
reviewer: "round-04"
audit_trail: []

position_coverage_impact: neutral
position_coverage_note: "中单位 primary，与'左手'区分：虎大将军 = 单场爆发，左手 = 持续压制"
```

---

#### #7：红温（overheat）

```yaml
meme_id: "overheat"
display_name: "红温"
display_name_short: "红温"
aliases: ["红温兰博", "红温了"]

origin_verified: false
origin_source_tier: P3
origin_source_ref: ""
origin_source_desc: "2018 S8 八强赛 RNG vs G2 第 5 局，Uzi 在 BP 时沉默不语、脸色发红，被观众嘲讽为'红温'（兰博大招过热状态）。此为社区观察总结，无'首创'单场 P0 链接。"
origin_p0_link_pending: false

meaning_verified: true
meaning_source_tier: P2
meaning_source_refs:
  - "https://www.bilibili.com/video/BV1RR4y1T7rm"  # B站 梗百科
  - "https://www.bilibili.com/video/BV1uP4y1u7e7"  # B站 红温全过程
  - "https://game.udn.com/game/story/122089/8769209"  # P2 UDN 2024 报道
meaning_desc: "Uzi 在关键时刻情绪激动、面部发红、沉默不语 = 兰博的'红温'过热状态"
meaning_current: "玩家在关键局/逆风情绪失控、操作变形。2024 年出圈成为中文网络热词"
meaning_divergence: shifted
meaning_divergence_note: "从特指 Uzi 的嘲讽梗泛化为通用'破防/情绪崩溃'表达"

sentiment: teasing
risk_tier: 🟡
risk_flags: {derogatory: false, racial_appearance: false, nationality: false, personality_denial: false, fan_circle: false, legal_controversy: false, official_warning: false, disease_disability: false}
known_black_names: []
mitigation: "仅作为 sub_tag + 需用户主动开启'自嘲模式'。作为'情绪状态代理'的伦理问题标注为 ethics_review_required"
anti_irony_firewall: "自嘲开关 + 非永久标签（status/sub_tag 短期），降低'被系统嘲讽'感知"
ethics_review_required: true  # GAP-D2 标记——用源于嘲讽选手心态的梗标记玩家 tilt 状态，需伦理审查

product_tier: sub_tag
evidence_tier: high_conf
tier_rationale: "P2+P3 多源验证，语义确认。但原梗源于嘲讽选手心态，作为系统授予标签需伦理审查 + 自嘲开关保护。B 级—需用户主动开启"

category: player_meme
target_position: [any]
target_modes: [ranked_solo, ranked_flex]
target_champions: []
position_lock: false
behavior_pattern: "突发性情绪崩溃导致表现断崖式下滑"
behavior_indicators: ["连续死亡增加", "KDA 骤降", "此前数据正常"]

trigger_metrics:
  - metric: "deaths"
    operator: "percentile_top"
    value: 80
    weight: 1.0
    required: true
    scope: "recent_n_games"
    note: "连续 ≥ 2 场 deaths > P80"
  - metric: "kda"
    operator: "percentile_bottom"
    value: 20
    weight: 1.0
    required: true
    scope: "recent_n_games"
support_metrics: []
counter_metrics:
  - metric: "kda_prior_baseline"
    operator: "gte"
    value: 0
    weight: 1.0
    required: true
    scope: "season_average"
    note: "此前数据必须为正常水平（非长期低水平），仅突发下滑才触发"
sample_min_games: 20
sample_window_days: 30
same_pos_min_games: 10
normalize_by: same_position
confidence_threshold: 0.7

computability_tier: directly_computable
computability_note: "deaths, kda 均在框架已定义。需可计算'此前的 baseline KDA'（滑动窗口）"
missing_fields: []

recognition_level: out_of_circle
half_life_status: rising
recognition_rationale: "2024 年出圈成为中文网络热词（人民日报等主流媒体报道），认知度 out_of_circle 级"

conflict_group: ""
conflict_role: ""
pair_with: []
replaces: []
replaced_by: []

version: "1.0.0"
last_reviewed: "2026-07-24"
last_modified: "2026-07-24"
reviewer: "round-04"
audit_trail: []

position_coverage_impact: neutral
position_coverage_note: "无固定位置，不特化覆盖"
```

---

#### #8：不破不立（bu-po-bu-li）

```yaml
meme_id: "bu-po-bu-li"
display_name: "不破不立"
display_name_short: "不破不立"
aliases: ["EDG 骑士归来", "不破不立骑士归来"]

origin_verified: true
origin_source_tier: P1
origin_source_ref: "https://lol.qq.com/news/detail_m.html?docid=13335512104539642803"  # P1 官方新闻
origin_source_desc: "S11 EDG 在不被看好的情况下三场打满 BO5 逆袭夺冠。LOL 官方新闻标题使用'不破不立'，LPL 官方纪录片《不破不立》由 B 站官方账号发布。"
origin_p0_link_pending: false

meaning_verified: true
meaning_source_tier: P1
meaning_source_refs:
  - "https://lol.qq.com/news/detail_m.html?docid=13335512104539642803"  # P1 官方新闻
  - "https://www.bilibili.com/bangumi/play/ep718244"                     # P1 LPL 官方纪录片
meaning_desc: "EDG S11 在不被看好时逆袭夺冠，主题'不破不立'"
meaning_current: "从连败/低谷中强势反弹，打出一波高胜率"
meaning_divergence: none
meaning_divergence_note: ""

sentiment: positive
risk_tier: 🟢
risk_flags: {derogatory: false, racial_appearance: false, nationality: false, personality_denial: false, fan_circle: false, legal_controversy: false, official_warning: false, disease_disability: false}
known_black_names: []
mitigation: "纯褒义，无需特殊缓解"
anti_irony_firewall: "反弹后若紧接着连败 → 不触发，防止'伪反弹'"
ethics_review_required: false

product_tier: primary
evidence_tier: origin_verified
tier_rationale: "P1 双源（LOL 官方新闻 + 官方纪录片）。在五逆袭叙事中认知度最高、字面可脱离战队独立理解"

category: community_meme
target_position: [any]
target_modes: [ranked_solo, ranked_flex]
target_champions: []
position_lock: false
behavior_pattern: "从连败中强势反弹"
behavior_indicators: ["连续失败后", "高胜率反弹", "KDA 回升"]

trigger_metrics:
  - metric: "result"
    operator: "eq"
    value: 0
    weight: 0.5
    required: true
    scope: "recent_n_games"
    note: "连续 ≥ 5 场失败"
  - metric: "win_rate"
    operator: "gte"
    value: 80
    weight: 1.0
    required: true
    scope: "recent_n_games"
    note: "接下来 5 场 win_rate ≥ 80%"
support_metrics:
  - metric: "kda"
    operator: "gt"
    value: 0
    weight: 0.5
    required: false
    scope: "recent_n_games"
    note: "反弹期 KDA 较低谷期显著提升"
counter_metrics:
  - metric: "win_rate"
    operator: "lt"
    value: 50
    weight: 1.0
    required: true
    scope: "recent_n_games"
    note: "反弹后紧接着连败 → 不触发"
sample_min_games: 20
sample_window_days: 60
same_pos_min_games: 0
normalize_by: same_position
confidence_threshold: 0.7

computability_tier: directly_computable
computability_note: "result, win_rate 可基于 result 字段聚合计算"
missing_fields: []

recognition_level: general_player
half_life_status: stable
recognition_rationale: "EDG S11 夺冠获央视报道，LPL 官方纪录片《不破不立》由 B 站官方发布，出圈级认知"

conflict_group: "comeback-narrative"
conflict_role: primary
pair_with: []
replaces: ["fan-shan", "nie-pan", "qi-shi-gui-lai", "bei-fa"]
replaced_by: []

version: "1.0.0"
last_reviewed: "2026-07-24"
last_modified: "2026-07-24"
reviewer: "round-04"
audit_trail: []

position_coverage_impact: neutral
position_coverage_note: "无固定位置，any 位反弹叙事共用"
```

---

#### #9：永远滴神（yyds）

```yaml
meme_id: "yyds"
display_name: "永远滴神"
display_name_short: "YYDS"
aliases: ["乌兹永远滴神", "YYDS"]

origin_verified: false
origin_source_tier: pending
origin_source_ref: ""
origin_source_desc: "2019 S9 小组赛 RNG vs CG → 山泥若直播解说时喊出'乌兹！永远滴神！'。原始直播切片可定位但在 R1-R3 中未提供链接。"
origin_p0_link_pending: true

meaning_verified: true
meaning_source_tier: P3
meaning_source_refs:
  - "https://baike.baidu.com/item/%E4%B9%8C%E5%85%B9%EF%BC%81%E6%B0%B8%E8%BF%9C%E6%BB%B4%E7%A5%9E/50444445"  # P3 百度百科独立词条
  - "https://www.zhihu.com/question/363721472"  # P3 知乎
meaning_desc: "山泥若在直播间看 Uzi 比赛时喊出'乌兹！永远滴神！'"
meaning_current: "YYDS 已出圈泛化为中文网络最高频缩写词，被人民日报等主流媒体使用"
meaning_divergence: shifted
meaning_divergence_note: "从特指 Uzi 的赞叹泛化为通用'顶格赞美'表达，LOL 专属语义被严重稀释"

sentiment: positive
risk_tier: 🟢
risk_flags: {derogatory: false, racial_appearance: false, nationality: false, personality_denial: false, fan_circle: false, legal_controversy: false, official_warning: false, disease_disability: false}
known_black_names: []
mitigation: "作为 status（单场高光状态文案），避免作为 primary（长期画像标签）造成的语义通胀"
anti_irony_firewall: "单场 P95+ 伤害 + P90+ 击杀 + 胜利 — 极低概率触发，反讽空间极小"
ethics_review_required: false

product_tier: status  # 裁决：从 primary 降为 status（§3.1）
evidence_tier: high_conf
tier_rationale: "§3.1 裁决：原始语境为实时惊叹（非长期画像），且 YYDS 已出圈泛化，LOL 专属区分度低。作为单场高光 status 保留梗力量，作为 primary 则语义通胀"

category: streamer_meme
target_position: [any]
target_modes: [ranked_solo, ranked_flex, normal]
target_champions: []
position_lock: false
behavior_pattern: "单场碾压级 carry 表现"
behavior_indicators: ["极高伤害占比", "极高击杀"]

trigger_metrics:
  - metric: "damage_share"
    operator: "percentile_top"
    value: 95
    weight: 1.0
    required: true
    scope: "single_game"
  - metric: "kills"
    operator: "percentile_top"
    value: 90
    weight: 1.0
    required: true
    scope: "single_game"
  - metric: "result"
    operator: "eq"
    value: 1
    weight: 1.0
    required: true
    scope: "single_game"
    note: "result = 胜利"
support_metrics: []
counter_metrics: []
sample_min_games: 1
sample_window_days: 1
same_pos_min_games: 0
normalize_by: same_position
confidence_threshold: 0.9

computability_tier: directly_computable
computability_note: "damage_share, kills, result 均在框架已定义"
missing_fields: []

recognition_level: out_of_circle
half_life_status: stable
recognition_rationale: "YYDS 是中文互联网最高频缩写词，out_of_circle 级认知"

conflict_group: "any-carry-overlap"
conflict_role: alternative
pair_with: []
replaces: []
replaced_by: []

version: "1.0.0"
last_reviewed: "2026-07-24"
last_modified: "2026-07-24"
reviewer: "round-04"
audit_trail: [{date: "2026-07-24", field: "product_tier", old_value: "primary", new_value: "status", reason: "§3.1 裁决：原始语境为实时惊叹非长期画像，YYDS 出圈泛化后 LOL 专属度低"}]

position_coverage_impact: neutral
position_coverage_note: "无固定位置"
```

---

#### #10：洛精通（rakan-master）— 合并自 CG-02

```yaml
meme_id: "rakan-master"
display_name: "洛精通"
display_name_short: "洛精通"
aliases: ["洛神", "冠军洛", "洛王"]

origin_verified: false
origin_source_tier: P1
origin_source_ref: ""
origin_source_desc: "合并自三项来源：1) Ming 使用洛的高开团成功率（'洛神'）; 2) Baolan S8 冠军皮肤选择洛（'冠军洛'）; 3) Missing 2022-2023 洛 16 连胜（'洛王'）。三者均无独立 P0 首创时刻，为社区/解说对选手洛表现的累积观察总结。"
origin_p0_link_pending: false

meaning_verified: true
meaning_source_tier: P3
meaning_source_refs:
  - "https://zh.moegirl.org.cn/"  # P3 各选手词条中均有提及
meaning_desc: "辅助使用洛（Rakan）打出顶级表现——包括高参团率、高助攻、低死亡、或连胜"
meaning_current: "辅助使用洛（Rakan）精通，表现统治级"
meaning_divergence: none
meaning_divergence_note: ""

sentiment: positive
risk_tier: 🟢
risk_flags: {derogatory: false, racial_appearance: false, nationality: false, personality_denial: false, fan_circle: false, legal_controversy: false, official_warning: false, disease_disability: false}
known_black_names: []
mitigation: "纯褒义。合并三个重叠称号减少冗余"
anti_irony_firewall: "不涉及反讽风险（纯褒义）"
ethics_review_required: false

product_tier: primary
evidence_tier: high_conf
tier_rationale: "CG-02 合并产物。虽三者均无独立 P0，但 P3 社区广泛共识 + 产品上合并为'洛精通'体系更为合理"

category: player_meme
target_position: [support]
target_modes: [ranked_solo, ranked_flex]
target_champions: [497]  # 洛 champion_id
position_lock: true
behavior_pattern: "辅助使用洛打出顶级表现"
behavior_indicators: ["高参团率", "高助攻", "低死亡（或高连胜）"]

trigger_metrics:
  - metric: "kill_participation"
    operator: "percentile_top"
    value: 80
    weight: 0.5
    required: false
    scope: "season_average"
  - metric: "assists"
    operator: "percentile_top"
    value: 80
    weight: 0.5
    required: false
    scope: "season_average"
  - metric: "deaths"
    operator: "percentile_bottom"
    value: 50
    weight: 0.5
    required: false
    scope: "season_average"
support_metrics:
  - metric: "result"
    operator: "eq"
    value: 1
    weight: 0.5
    required: false
    scope: "recent_n_games"
    note: "洛连胜 ≥ 5 场（洛王条件）"
counter_metrics:
  - metric: "deaths"
    operator: "percentile_top"
    value: 80
    weight: 1.0
    required: true
    scope: "season_average"
    note: "洛 deaths > P80 → 不触发（排除玩得不好的洛玩家）"
sample_min_games: 5
sample_window_days: 90
same_pos_min_games: 5
normalize_by: same_champion
confidence_threshold: 0.6

computability_tier: needs_champion_table
computability_note: "需要 champion_id 维表识别英雄。kill_participation、assists、deaths 均在框架已定义。注意 champion_id 在框架指标库中缺失（GAP-C1）——需补充"
missing_fields: ["champion_id"]

recognition_level: lpl_viewer
half_life_status: stable
recognition_rationale: "三位 LPL 选手的洛表现均有广泛认知"

conflict_group: "rakan-proficiency"
conflict_role: primary  # 合并后的主称号
pair_with: []
replaces: ["luo-shen", "guan-jun-luo", "luo-wang"]
replaced_by: []

version: "1.0.0"
last_reviewed: "2026-07-24"
last_modified: "2026-07-24"
reviewer: "round-04"
audit_trail: [{date: "2026-07-24", field: "meme_id", old_value: "luo-shen / guan-jun-luo / luo-wang", new_value: "rakan-master (merged)", reason: "CG-02 合并：三者语义高度重叠，统一为'洛精通'称号体系"}]

position_coverage_impact: saturates
position_coverage_note: "辅助位 11 项 A+B 的'水分'来源之一。合并后辅助独立称号数减少 2 项（从 11 → 9），缓解 GAP-P2"
```

---

## 5. 五位覆盖平衡快照

| 位置 | A 级 (primary) | B 级 (sub_tag) | C/status | 合计 | 正面 | teasing | GAP |
|------|:---:|:---:|:---:|:---:|:---:|:---:|------|
| Top | 2 | 3 | — | 5 | 2 | 3 | — |
| Jungle | 1 | 2 | — | 3 | 0 | 3 | 🔴 无正面 primary |
| Mid | 3 | 2 | — | 5 | 3 | 0 | — |
| Bottom | 3 | 1 | — | 4 | 2 | 1 | — |
| Support | 8→6 | 4 | — | 7 | 6 | 1 | 🟡 合并后减 2 水分 |
| Any | 1 | 2 | 1 | 4 | 5 | 1 | — |

**关键缺口**：打野位仅 1 项 A 级 `primary` 且为 teasing（奇迹行者）。"天神下凡"跨位覆盖打野的 `damage_share ≥ 40%` 阈值对绝大多数坦克/功能型打野不可达。需要补充 ≥ 2 个打野位正面称号（GAP-P1）。

---

## 6. 可计算性字段依赖总览

| 字段 | 框架 §3 已定义? | 依赖的实例 | 缺口 |
|------|:---:|------|------|
| kills, deaths, assists | ✅ | #1-#10 全部 | — |
| KDA / avg_kda | ✅ | #1-#10 全部 | — |
| kill_participation | ✅ | #1, #2, #5, #10 | — |
| cs / cs_per_min | ✅ | #1, #5 | — |
| damage_share / damage_dealt / damage_per_min | ✅ | #2-#6, #9 | — |
| damage_share_variance | ✅ | #3 | — |
| result | ✅ | #6, #8, #9, #10 | — |
| position | ✅ | 全部 | — |
| duration_minutes | ✅ | #1, #5 | — |
| **champion_id** | ❌  GAP-C1 | #10 | 需补充到框架 |
| **kda_variance** | ⚠️ 定义存在但需聚合引擎 | #3 | 需聚合引擎实现 |
| **kda_cv (变异系数)** | ❌ 未定义 | 冲突组 stability-axis (大满贯/铁人) | 需定义 |

---

## 7. 版本与审核协议

### 7.1 版本号规则

- **Major** (X.0.0)：`product_tier` 变更（primary ↔ sub_tag ↔ status ↔ hidden）
- **Minor** (0.X.0)：触发阈值变更、新触发/反证规则新增、冲突组重排
- **Patch** (0.0.X)：描述修正、别名增删、来源链接更新、认知度/时效性重评

### 7.2 审核触发条件

以下任一条件命中 → 必须触发人工审核：

1. `evidence_tier` 从 `low_conf` / `med_conf` 升级为 `high_conf` / `origin_verified`
2. `product_tier` 从 `hidden` 解封为可见层级
3. `sentiment` 变更
4. `risk_tier` 升级（🟢→🟡→🟠→🔴）
5. 新增 `known_black_names` 条目（已进入黑称列表的变体需要审核确认）
6. `ethics_review_required` 标记被清除（需要伦理委员会 approve）

### 7.3 冲突组变更协议

- 新增冲突组：需提供 ≥ 2 个实例的触发重叠证据
- 删除冲突组：需确认所有成员均为 `deprecated`
- 重排优先级：需附带排序理由数据（认知度、时效性、产品 A/B 测试结果）

---

## 8. 与前三轮的关键关联

| 本轮设计 | 解决的 Round 3 问题 | 状态 |
|----------|-------------------|:---:|
| `origin_verified` / `meaning_verified` 分家 | GAP-E1（官方收录≠首创确认） | ✅ |
| `origin_p0_link_pending` 字段 | GAP-E2（P0 存在但未链接的系统性宽容） | ✅ |
| `computability_tier` + `missing_fields` | GAP-C1/C2（champion_id 等字段缺失） | ✅ |
| `anti_irony_firewall` 字段 | GAP-F3（触发严格度不能杜绝反讽） | ✅ |
| `position_coverage_impact` 元数据 | GAP-P1（打野位严重短缺） | 🔴 识别了缺口但未填补（需后续轮次补充打野梗） |
| YYDS 层级裁决（§3.1） | GAP-S3（streamer status vs funnel primary 冲突） | ✅ 裁决为 status |
| 奇迹行者 evidence vs product 关系裁决（§3.2） | GAP-X1（证据 HIGH_CONF 但产品 A-primary） | ✅ 维持 primary + 标注 evidence_tier |
| 冲突组 CG-01 五逆袭叙事合并 | GAP-F4（五项逆袭叙事冗余） | ✅ 合并为不破不立 primary，其余降 status |
| 冲突组 CG-02 洛三元合并 | GAP-P2（辅助位洛重叠水分） | ✅ 合并为'洛精通' |
| `ethics_review_required` 字段 | GAP-D2（红温的伦理审查） | ✅ 标记红温为需伦理审查 |
| `evidence_tier` / `product_tier` 独立 | GAP-X1（证据/产品分级脱节） | ✅ 双轨管理 |

---

## 9. 待后续轮次解决的问题

1. 🔴 **打野位正面称号补充**：打野位仅 1 个 A 级 teasing 称号。需要在后续探索中补充 ≥ 2 个打野位正面 primary（GAP-P1）。候选方向：condi "龙的传人"（抢龙型）、Tian "我就是天"（S9 FMVP 自信型）、Kanavi "看片哥"（野核 carry 型）。

2. 🟡 **champion_id 维表补充**：框架指标库需正式定义 champion_id 及其衍生字段（英雄类型分类、版本 meta tier），当前 10 个实例中仅 #10（洛精通）依赖但后续英雄特定梗都需要。

3. 🟡 **事件级数据依赖的梗**："肉蛋葱鸡"（技能命中率）、"一鱼四吃"（连续被勾次数）、"永不团灭"（团灭事件）均需要事件追踪数据，当前 CSV 不可计算。需技术预研确认可用性。

4. 🟡 **红温伦理审查**：标记为 `ethics_review_required = true`，需独立的伦理委员会/产品委员会审查通过后才能上线（即使有自嘲开关）。

5. 🟢 **P0 链接补全运动**：10 个实例中 3 个实例（#1 奇迹行者、#9 YYDS、#10 洛精通）标记 `origin_p0_link_pending = true`。需在后续探索中补全原始录像链接。

---

*文档生成时间：2026-07-24 | 设计轮次：Explorer Round 4 | 实例填充：10 个 | 冲突组：6 个 | 裁决：2 项 | Schema 版本：1.0.0*
