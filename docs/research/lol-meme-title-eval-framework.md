# LOL 原生梗称号评价框架（Explorer Round 1 — 产品与数据视角）

> 状态：Draft
> 来源：多源外部查证 + 项目内现有数据模型分析
> 目标：为 Deep Investigate 后续轮次提供可复用的审查框架与案例

---

## 1. 核心原则

### 1.1 梗的原义不能被算法误用

任何称号的触发规则必须满足 **"语义保真"** 原则：

| 原则 | 含义 | 违规示例 |
|------|------|----------|
| 原义锁定 | 触发条件必须与梗的原始语境一致 | 把 "奇迹行者" 授予高参团率打野 |
| 不可逆用 | 褒义梗不可因负面数据触发；贬义梗不可因正面数据触发 | 用 "天神下凡" 形容挂机送头的玩家 |
| 位置绑定 | 梗有明确位置归属的，不可跨位置触发 | 用上单梗 "369骰子" 评价辅助玩家 |
| 模式限定 | 梗在特定模式中有语义的，不可跨模式触发 | 排位梗用于大乱斗（需分开评估） |

### 1.2 产品无害化

- **黑称/外貌羞辱禁用**：涉及选手外貌、地域、种族、人身攻击的称号不得作为主称号。
- **褒贬明确标注**：每条称号必须在产品层标注 `sentiment`（positive/neutral/teasing/negative/forbidden）。
- **非主观授予**：称号由系统基于数据自动触发，不由用户手动选择或互相评价。

---

## 2. 称号数据结构

### 2.1 核心字段

```yaml
title_id: string            # 唯一标识，如 "miracle-walker"
display_name: string        # 展示文案，如 "奇迹行者"
display_name_short: string  # 短版（弹窗/列表），如 "奇迹行者"
sentiment: enum             # positive | neutral | teasing | negative | forbidden
category: enum              # player_meme | streamer_meme | caster_meme | community_meme

# 来源
origin: string              # 梗的原始出处（赛事/主播/解说/社区）
origin_year: int            # 梗诞生年份（近似）
origin_ref: string          # 可查证的原始参考链接（视频/文章/百科）
original_meaning: string    # 原始语境下的含义（50-100字）
current_meaning: string     # 当前社区通用理解（50-100字）

# 适配
target_position: [enum]     # 适用位置：top/jungle/mid/bottom/support/any
target_modes: [enum]        # 适用模式：ranked_solo/ranked_flex/normal/aram/arena
target_champions: [int]     # 适用英雄 ID（可选，如剑魔 → 天神下凡）

# 触发规则
trigger_metrics: [MetricRule]  # 核心触发指标及阈值
support_metrics: [MetricRule]  # 辅助证据（增强置信度）
counter_metrics: [MetricRule]  # 反证（一票否决/降权）
sample_min_games: int          # 最低样本场数
sample_window_days: int        # 样本时间窗口（天）
same_pos_min_games: int        # 同位置最低场数

# 标准化
baseline_model: enum           # 标准化基准：position_percentile | global_percentile | absolute
normalize_by: enum             # 标准化依据：same_position | same_mode | same_champion

# 评分
confidence_threshold: float    # 置信度门槛（0-1）
severity: enum                 # low | medium | high（称号在报告中的突出程度）

# 风险
risk_derogatory: bool          # 是否有贬损风险
risk_racial_appearance: bool   # 是否涉及外貌/种族
risk_outdated: bool            # 是否已过时
risk_controversial: bool       # 是否存在争议事件关联
known_black_names: [string]    # 已知黑称变体（用于审核排除）
mitigation: string             # 缓解措施说明

# 时效性
recognition_level: enum        # 认知度：core_fan | lpl_viewer | general_player | niche
half_life_status: enum         # 半衰期状态：rising | stable | fading | niche_stable
last_reviewed: date            # 最后审核日期

# 组合
title_type: enum               # primary（主称号）| sub_tag（副标签）| status（状态文案）| hidden（禁用）
pair_with: [string]            # 可搭配的 title_id（如 "天神下凡" 与 "及时雨" 互为正反面）
conflicts_with: [string]       # 互斥的 title_id
```

### 2.2 触发规则子结构 MetricRule

```yaml
metric: string              # 指标名（见 3.1 指标库）
operator: enum              # gt | lt | gte | lte | between | percentile_top | percentile_bottom
value: float                # 阈值（单值）
value_range: [float, float] # 区间值（between 时使用）
weight: float               # 权重（0-1，综合评分用）
required: bool              # 是否必要条件
```

---

## 3. 可用指标库（基于现有 CSV 字段）

### 3.1 单场可计算指标

| 指标名 | CSV 字段 | 说明 |
|--------|----------|------|
| `kills` | kills | 击杀数 |
| `deaths` | deaths | 死亡数 |
| `assists` | assists | 助攻数 |
| `kda` | — | (kills + assists) / max(deaths, 1) |
| `kill_participation` | kill_participation_percent | 参团率 % |
| `cs` | cs | 补刀数 |
| `cs_per_min` | — | cs / duration_minutes |
| `gold` | gold | 金币 |
| `gold_per_min` | — | gold / duration_minutes |
| `damage_dealt` | champion_damage | 对英雄伤害 |
| `damage_per_min` | — | champion_damage / duration_minutes |
| `damage_share` | damage_share_percent | 伤害占比 % |
| `damage_taken` | damage_taken | 承受伤害 |
| `healing` | healing | 治疗量 |
| `vision_score` | vision_score | 视野得分 |
| `wards_placed` | wards_placed | 放置守卫数 |
| `wards_killed` | wards_killed | 清除守卫数 |
| `result` | result | 胜利/失败 |
| `position` | position | 位置（TOP/JUNGLE/MID/BOTTOM/SUPPORT） |
| `queue` | queue | 队列类型 |
| `duration_minutes` | duration_minutes | 对局时长 |

### 3.2 聚合统计指标

| 指标名 | 计算方式 |
|--------|----------|
| `avg_kda` | 算术平均 KDA |
| `avg_kill_participation` | 平均参团率 |
| `avg_damage_share` | 平均伤害占比 |
| `win_rate` | 胜率 |
| `cs_per_min_avg` | 平均每分钟补刀 |
| `damage_per_min_avg` | 平均每分钟伤害 |
| `kda_variance` | KDA 方差（衡量稳定性） |
| `damage_share_variance` | 伤害占比方差 |
| `kda_percentile` | 同位置同模式 KDA 百分位 |
| `damage_percentile` | 同位置同模式伤害百分位 |
| `kill_participation_percentile` | 同位置同模式参团率百分位 |

---

## 4. 标准化方案

### 4.1 同位置同模式标准化

核心原则：**任何触发比较都应在同位置、同模式下进行。**

```
standardize(player_metric, metric_name, position, mode):
    population = all_players.filter(
        position == player.position AND
        mode == player.mode AND
        sample_size >= sample_min_games
    )
    return percentile(player_metric, population, metric_name)
```

**理由**：
- 不同位置 KDA 天然差异大（辅助参团率高但伤害低）
- 大乱斗和排位节奏完全不同
- 跨位置/跨模式比较会产生系统偏差

### 4.2 样本门槛

| 称号类型 | 最低同位置场数 | 最低总场数 | 窗口 |
|----------|:---:|:---:|------|
| 核心主称号（primary） | 15 | 30 | 90天 |
| 副标签（sub_tag） | 10 | 20 | 90天 |
| 状态文案（status） | 5 | 10 | 30天 |

低于门槛时应降级展示或显示"样本不足"而非强行匹配。

### 4.3 分数计算

```
titleScore = Σ(metric_i_match * weight_i) / Σ(weight_i)
where metric_i_match = 1 if metric_i meets threshold, else 0

finalConfidence = titleScore * sampleConfidence
where sampleConfidence = min(1, actual_games / sample_min_games)
```

---

## 5. 案例逐条审查

### 5.1 奇迹行者（还在刷野）

| 字段 | 值 |
|------|-----|
| **来源查证** | [起点中文网问答](https://m.qidian.com/ask/qosdylwiqhv)、[B站视频](https://www.bilibili.com/video/BV1tm4y1v7C7/)、[LOL官方视频中心](https://lol.qq.com/v/v2/detail.shtml?docid=3845649808433353910) |
| **原始语境** | 前职业选手 zz1tai（姿态）在青铜局遇到 ID 为"奇迹行者"的死歌打野，全程只刷野不抓人不参团。姿态多次喊"奇迹行者还在刷野！"成为名场面。 |
| **核心语义** | 打野玩家只顾刷野，不gank、不参团、不支援。 |
| **适配位置** | **仅 jungle（打野）** |
| **适配模式** | 排位（单双排/灵活）、匹配模式。**不适用大乱斗**（无打野位）。 |
| **触发条件** | |
| — 必要条件 | 位置 = jungle |
| — 核心指标 | `avg_kill_participation` < 同位置同模式 P25（参团率低于后25%） |
| — 辅助证据 | `cs_per_min_avg` > 同位置 P75（刷野量高于前25%） |
| — 反证 | 若 `avg_kill_participation` ≥ P40，**一票否决** |
| **样本门槛** | 同位置 ≥ 15 场 |
| **褒贬风险** | **teasing（轻度调侃）**，有一定负面含义但属游戏内行为描述，不涉及人身攻击。 |
| **认知度** | **lpl_viewer** 级别。姿态粉丝和LOL社区广泛传播，"奇迹行者还在刷野"已成为打野不抓人的通用弹幕。 |
| **时效性** | **stable**。2023年起源，至今活跃于弹幕文化。 |
| **产品角色** | **primary（主称号）**。语义清晰、数据可测、认知度高。 |
| **风险缓解** | 仅在同位置参团率显著偏低时触发，且作为"需要改进"的洞察而非永久标签。 |

### 5.2 369骰子

| 字段 | 值 |
|------|-----|
| **来源查证** | [萌娘百科](https://zh.moegirl.org.cn/%E7%99%BD%E5%AE%B6%E6%B5%A9)、[知乎](https://zhuanlan.zhihu.com/p/2032557116884504815)、[虎扑](https://voice.hupu.com/bbs/60411356) |
| **原始语境** | 选手 369（白家浩）因其极不稳定的发挥被观众称为"骰子型上单"。摇到"3"时拉跨送头，"6"时平稳过渡，"9"时战神级别表现。Karsa 曾在队内批评中说出圣经级发言，进一步固化了梗。 |
| **核心语义** | 上单玩家表现极度不稳定，上下限差距大。 |
| **适配位置** | **仅 top（上单）** |
| **适配模式** | 排位（单双排/灵活）。大乱斗不适用（无对线稳定性概念）。 |
| **触发条件** | |
| — 必要条件 | 位置 = top |
| — 核心指标 | `kda_variance` > 同位置 P80（KDA 方差极大）**且** `damage_share_variance` > 同位置 P70 |
| — 辅助证据 | 单场KDA既有极高（>5.0）也有极低（<1.0）的出现 |
| — 反证 | 若 `win_rate` > 60% **且** `kda_variance` 在 P50-P70，降权为 neutral；高方差但高胜率可能是"高风险高回报"打法的正常表现 |
| **样本门槛** | 同位置 ≥ 15 场 |
| **褒贬风险** | **teasing**，偏中性调侃。原梗描述选手风格而非品质，但暗示不稳定。产品层建议区分"3状态"和"9状态"的子标签。 |
| **认知度** | **lpl_viewer** 级别。LPL观众广泛认知。 |
| **时效性** | **stable**。369选手仍活跃，梗持续在赛事解说中使用。 |
| **产品角色** | **primary（主称号）**，搭配 **sub_tag**：状态好时显示"今天摇到 9"，状态差时显示"今天摇到 3"。 |

#### 子标签设计

| 子标签 | 触发条件 | sentiment |
|--------|----------|-----------|
| "今天摇到 9" | 最近5场 `avg_kda` > 同位置 P85 且 `win_rate` ≥ 80% | positive |
| "今天摇到 6" | 最近5场表现介于 P40-P60 | neutral |
| "今天摇到 3" | 最近5场 `avg_kda` < 同位置 P25 且 `win_rate` ≤ 40% | teasing |

### 5.3 天神下凡 ↔ 马头

#### 5.3.1 天神下凡

| 字段 | 值 |
|------|-----|
| **来源查证** | [萌娘百科](https://zh.moegirl.org.cn/%E5%A7%9C%E6%89%BF%E9%8C%B2)、[新浪游戏](https://games.sina.cn/gn/ol/2018-10-27/detail-ifxeuwws8720808.d.html)、[B站视频](https://www.bilibili.com/video/BV1wh4y1a7yd/)、[LOL官方视频](https://lol.qq.com/v/v2/detail.shtml?type=1&docid=16448246280632820135) |
| **原始语境** | 2018年S8世界赛半决赛 IG vs G2，TheShy 使用剑魔在河道小龙处一打四反杀，LPL解说喊出"天神下凡一锤四"。此战后剑魔"天神下凡"成为 TheShy 最具标志性的名场面。 |
| **核心语义** | 在关键团战中打出远超预期的毁灭性表现，以一己之力扭转战局。 |
| **适配位置** | top/jungle/mid（上单/打野/中单）。ADC和辅助较难触发此语义。 |
| **适配模式** | 排位（单双排/灵活）。大乱斗节奏差异大，不适合此语义。 |
| **触发条件** | |
| — 必要条件 | 位置 ∈ {top, jungle, mid} |
| — 核心指标 | 近20场中存在 ≥ 3 场：`kills ≥ 5` **且** `damage_share ≥ 40%` **且** `kill_participation ≥ 70%` **且** `result = 胜利` |
| — 辅助证据 | `damage_per_min_avg` > 同位置 P80 |
| — 反证 | 若上述高光场次中 `deaths ≥ kills/2`（不够碾压），降权 |
| **样本门槛** | 同位置 ≥ 15 场 |
| **褒贬风险** | **positive**。纯粹褒义，表彰高光carry。 |
| **认知度** | **general_player** 级别。S8 IG夺冠是中国LOL玩家的集体记忆，"天神下凡"是公认的LPL顶级名场面。 |
| **时效性** | **stable**。2018年起源，虽有时效稀释但仍属经典梗，持续被引用。 |
| **产品角色** | **primary（主称号）**。 |

#### 5.3.2 马头

| 字段 | 值 |
|------|-----|
| **来源查证** | [QQ News](https://news.qq.com/rain/a/20250516A01F3M00)、[知乎](https://zhuanlan.zhihu.com/p/1943618014974051345)、[维基学院](https://zh.wikiversity.org/wiki/%E4%B8%AD%E5%9B%BD%E5%A4%A7%E9%99%86%E7%BD%91%E7%BB%9C%E7%94%A8%E8%AF%AD%E5%88%97%E8%A1%A8)、[维基百科](https://zh.wikipedia.org/zh-hans/%E5%A7%9C%E6%89%BF%E9%8C%B2) |
| **原始语境** | "马头" 是 TheShy 的黑称，源于其脸型偏长（马脸），由主播炫神等人推动传播。IG 官方曾投诉相关主播使用此称呼。2025年官方进一步警告直播间使用该黑称。 |
| **核心语义** | 对选手姜承録（TheShy）外貌的贬损称呼，无游戏行为含义。 |
| **适配位置** | N/A — **禁用** |
| **适配模式** | N/A — **禁用** |
| **褒贬风险** | **forbidden**。明确涉及外貌羞辱，已被官方警告。 |
| **风险等级** | 🔴 **最高** — 外貌羞辱、人身攻击、官方警告记录。 |
| **产品角色** | **hidden（禁用）**。不得在任何产品层出现。 |

**⚠️ "马头" 风险评估结论**：
- 涉及外貌（脸型），属于人身攻击范畴
- 已被IG官方投诉、LPL官方警告
- 无游戏行为映射（纯粹人身攻击）
- **结论：禁止作为称号、标签、状态文案或任何产品文案出现**

**"马头" 与 "天神下凡" 的正反面关系**：
- 社区中 "天神下凡"（褒义）和 "马头/及时雨"（贬义）是 TheShy 同一选手的一体两面
- 产品中可保留 "天神下凡" 作为正面称号，但 **不应设计与之对应的反面称号为 "马头"**
- 可选反面方案：使用行为描述的 "状态低迷" 而非人身攻击的称呼

### 5.4 左手 / 右手

| 字段 | 值 |
|------|-----|
| **来源查证** | [LOL官方文章](https://lol.qq.com/news/detail_m.html?docid=14425924133848284231)、[18183](https://www.18183.com/xinwen/202305/4671404.html)、[NGA](https://nga.178.com/read.php?tid=35923016)、[B站](https://www.bilibili.com/video/BV1Zs4y137bR/) |
| **原始语境** | Knight（卓定）是左撇子，左手持鼠标右手按键盘，加之实力出众，被LPL观众称为"黄金左手"或简称"左手"。Chovy 因与 Knight 风格相似、打法细腻且同为顶级中单，被LPL观众镜像称为"右手"。两人被合称"左手和右手"或"世另我"。 |
| **核心语义** | **"左手"**：中单位置个人实力超群、操作细腻、对线压制力强，但有时大赛隐身。**"右手"**：镜像语义——Chovy的同款评价体系，在LCK对应的中文圈梗。 |
| **适配位置** | **仅 mid（中单）** |
| **适配模式** | 排位（单双排/灵活） |
| **触发条件（左手）** | |
| — 必要条件 | 位置 = mid |
| — 核心指标 | `cs_per_min_avg` > 同位置 P80 **且** `damage_per_min_avg` > 同位置 P75 |
| — 辅助证据 | `avg_kda` > 同位置 P70；常用英雄为发条/岩雀/艾克/辛德拉等传统中单 |
| — 反证 | 若 `kill_participation` < 同位置 P30（过于单机），降权/不触发 |
| **触发条件（右手）** | 同"左手"条件——两者语义镜像，数据条件应相同 |
| **样本门槛** | 同位置 ≥ 15 场 |
| **褒贬风险** | **positive/neutral**。表面褒义（实力强），但隐含"大赛软手"的社区调侃。产品层可设计触发时附带"Chovy也在努力"的积极状态文案。 |
| **认知度** | **lpl_viewer** 级别。左手Knight为LPL顶级中单，右手梗在LPL观众中认知度较高。 |
| **时效性** | **stable**。两人均活跃于顶级联赛。 |
| **产品角色** | **primary（主称号）**。因"左手/右手"已有深层社区意义（镜像、世另我），适合作为独特的中单称号。 |
| **注意** | Knight 使用左手鼠标是生理特征（左撇子），梗本身不含贬义。但产品应避免对不同用手习惯的用户做区别对待。 |

---

## 6. 主称号 vs 副标签 vs 状态文案 分工

| 类型 | 定义 | 展示位置 | 持久性 | 示例 |
|------|------|----------|--------|------|
| **Primary（主称号）** | 基于长期数据的核心行为画像，反映玩家整体风格 | 报告顶部 Hero 区域 | 长期稳定（随数据变化缓慢更新） | "奇迹行者"、"天神下凡"、"左手"、"369骰子" |
| **Sub Tag（副标签）** | 基于近期数据的动态状态，反映当前/短期趋势 | 主称号下方，可附带小图标 | 短期（每 5-10 场更新） | "今天摇到 9"、"状态火热"、"连败中" |
| **Status（状态文案）** | 单场/极短期的即时状态，鼓励/提醒性质 | 弹窗、通知、过渡页面 | 极短（单场或当天） | "刚才那把你就是天神下凡！"、"这把需要更多参团" |
| **Hidden（禁用）** | 因风险原因禁止展示的称号 | 不展示 | N/A | "马头"、所有外貌黑称 |

### 设计原则

1. **主称号唯一**：每个报告周期只展示一个主称号，避免信息过载。
2. **副标签补充**：副标签可以搭配主称号，丰富语义层次。例如主称号"369骰子" + 副标签"今天摇到 9"。
3. **状态即时**：状态文案可以实时更新，用于激励或提醒。
4. **降级策略**：数据不足时，降级到状态文案（"多打几把就能看出你的风格了！"），而非强行匹配主称号。

---

## 7. 褒贬风险分级

| 风险等级 | 标识 | 含义 | 行动 |
|----------|------|------|------|
| 🟢 Safe | positive | 明确褒义，无争议 | 可直接用于主称号 |
| 🟡 Caution | neutral/teasing | 中性或轻度调侃，可能有少量争议 | 可用，需在 UI 中附幽默化解文案 |
| 🟠 Warning | negative | 偏负面，可能让部分用户不适 | 仅用于"需要改进"的洞察区，不作为主称号；附带改善建议 |
| 🔴 Forbidden | forbidden | 人身攻击、外貌羞辱、种族歧视、官方警告 | 禁止任何形式的产品展示 |

---

## 8. 认知度与时效性矩阵

| 认知度 \ 时效性 | rising（上升） | stable（稳定） | fading（衰减） | niche_stable（小众稳定） |
|:---:|:---:|:---:|:---:|:---:|
| **general_player** | ⭐⭐⭐ 优先 | ⭐⭐⭐ 优先 | ⭐⭐ 可保留 | — |
| **lpl_viewer** | ⭐⭐⭐ 优先 | ⭐⭐ 可用 | ⭐ 低优 | ⭐ 低优 |
| **core_fan** | ⭐⭐ 可用 | ⭐ 低优 | — | ⭐ 低优 |
| **niche** | — | — | — | ❌ 不推荐 |

- **优先**：general_player × stable/rising（如"天神下凡"）
- **可用**：lpl_viewer × stable（如"奇迹行者"、"369骰子"）
- **低优**：认知度衰减或极小众
- **不推荐**：niche × fading/niche_stable

---

## 9. 可执行审查表（Checklist）

对每个候选称号，逐一通过以下检查项：

### A. 来源核验
- [ ] A1 梗有明确的原始出处（赛事/主播/解说/社区文章/视频）
- [ ] A2 原始出处可被外部查证（链接可用）
- [ ] A3 原始含义与当前社区理解一致
- [ ] A4 原始出处不涉及捏造或虚假信息

### B. 语义保真
- [ ] B1 核心语义可以用 ≤ 3 个游戏指标描述
- [ ] B2 触发条件与原始语境的行为模式一致
- [ ] B3 反证规则可以排除误触发场景
- [ ] B4 梗的"褒义/贬义"方向与触发数据的方向一致

### C. 位置与模式适配
- [ ] C1 梗有明确的目标位置（top/jungle/mid/bottom/support/any）
- [ ] C2 梗有明确的目标模式（排位/匹配/大乱斗等）
- [ ] C3 标准化基准为同位置同模式
- [ ] C4 不会跨位置/跨模式误触发

### D. 数据可计算
- [ ] D1 所有指标在当前 CSV 字段中可计算或可派生
- [ ] D2 样本门槛明确（同位置最低场数、总场数、时间窗口）
- [ ] D3 阈值基于合理假设（可后续用实际数据校准）
- [ ] D4 分数计算公式无循环依赖

### E. 风险审查
- [ ] E1 不涉及外貌羞辱（如"马头"）
- [ ] E2 不涉及地域/种族/性别歧视
- [ ] E3 不涉及选手私生活/争议事件
- [ ] E4 不涉及已被官方警告的称呼
- [ ] E5 若有贬损含义，已设计缓解措施（如仅用于改进建议区）

### F. 产品适合性
- [ ] F1 已指定 title_type（primary/sub_tag/status/hidden）
- [ ] F2 已指定 sentiment
- [ ] F3 已指定 severity 和展示位置
- [ ] F4 recognition_level 和 half_life_status 已评估
- [ ] F5 与现有称号无语义冲突或高度重叠

---

## 10. 示例：审查表完整填写

### 示例 1：奇迹行者

```yaml
# === 来源核验 ===
A1: ✅ 姿态直播青铜局，ID"奇迹行者"的死歌打野
A2: ✅ 起点问答、B站视频、LOL官方视频中心均有记录
A3: ✅ 原始含义（打野不抓人）与当前理解一致
A4: ✅ 姿态本人直播名场面，无捏造

# === 语义保真 ===
B1: ✅ avg_kill_participation（参团率低）+ cs_per_min（刷野量高）
B2: ✅ 原始语境：死歌全程刷野不参团 → 触发条件：参团率低+刷野量高
B3: ✅ 参团率≥P40 时一票否决
B4: ✅ 梗为调侃（teasing），触发条件为行为描述（低参团率），方向一致

# === 位置与模式 ===
C1: ✅ jungle only
C2: ✅ 排位+匹配（排除大乱斗）
C3: ✅ 基准为同位置（打野）同模式
C4: ✅ 仅打野位触发

# === 数据可计算 ===
D1: ✅ kill_participation_percent 和 cs 均可用
D2: ✅ 同位置 ≥ 15 场，90天窗口
D3: ✅ P25参团率 + P75刷野量（可后续校准）
D4: ✅ 无循环依赖

# === 风险审查 ===
E1: ✅ 无外貌关联
E2: ✅ 无歧视内容
E3: ✅ 不涉及选手私生活
E4: ✅ 未被官方警告
E5: ✅ 用于改进建议区，附"多关注小地图，及时支援队友！"

# === 产品适合性 ===
F1: ✅ primary
F2: ✅ teasing
F3: ✅ medium severity，报告核心洞察区
F4: ✅ lpl_viewer × stable
F5: ✅ 与现有候选无冲突
```

### 示例 2：马头（审查 → 禁用）

```yaml
# === 来源核验 ===
A1: ✅ 源自 TheShy 脸型偏长，主播炫神等人推动
A2: ✅ 维基百科、维基学院、QQ News 等均有记录
A3: ✅ 含义为外貌贬损 → 与"天神下凡"的行为描述完全不同
A4: ✅ 真实存在

# === 语义保真 ===
B1: ❌ 无法用游戏指标描述（纯粹外貌攻击）
B2: ❌ 无游戏行为映射
B3: ❌ 无法设计反证
B4: ❌ 贬义方向与数据无关

# === 位置与模式 ===
C1-C4: N/A（无行为映射）

# === 数据可计算 ===
D1-D4: ❌ 完全不可计算

# === 风险审查 ===
E1: ❌ 明确涉及外貌羞辱（脸型）
E2: ✅ 暂未涉及地域/种族（但外貌本身已足够严重）
E3: ✅ 未涉及私生活
E4: ❌ IG官方投诉、LPL官方警告
E5: ❌ 无法缓解（本质为人身攻击，非行为描述）

# === 产品适合性 ===
F1: hidden（禁用）
F2: forbidden
F3-F5: N/A

# 最终判定: 🔴 FORBIDDEN — 禁止任何产品层使用
```

### 示例 3：天神下凡

```yaml
# === 来源核验 ===
A1: ✅ S8半决赛 IG vs G2，TheShy 剑魔河道一打四
A2: ✅ 新浪游戏、萌娘百科、B站、YouTube、LOL官方视频
A3: ✅ 原始含义（carry全场、毁灭性表现）与当前理解一致
A4: ✅ S8世界赛实况

# === 语义保真 ===
B1: ✅ kills ≥ 5 + damage_share ≥ 40% + kill_participation ≥ 70%
B2: ✅ 原始语境：剑魔一打四扭转战局 → 触发条件：高击杀+高伤害占比+高参团率
B3: ✅ 若 deaths ≥ kills/2 降权（不够碾压）
B4: ✅ 褒义方向与触发数据方向一致

# === 位置与模式 ===
C1: ✅ top/jungle/mid
C2: ✅ 排位
C3: ✅ 同位置同模式
C4: ✅ 仅上中野触发

# === 数据可计算 ===
D1: ✅ kills, damage_share, kill_participation, result, deaths 均可用
D2: ✅ 同位置 ≥ 15 场
D3: ✅ 阈值可后续用数据校准
D4: ✅ 无循环依赖

# === 风险审查 ===
E1: ✅ 无外貌关联
E2: ✅ 无歧视内容
E3: ✅ 不涉及选手私生活
E4: ✅ 未被官方警告
E5: ✅ 纯粹褒义，无需特殊缓解

# === 产品适合性 ===
F1: ✅ primary
F2: ✅ positive
F3: ✅ high severity，报告 Hero 区
F4: ✅ general_player × stable
F5: ⚠️ 需注意不与"369骰子/摇到9"语义重叠（两者都描述carry表现但角度不同：369侧重稳定性，"天神下凡"侧重单场爆发）
```

---

## 11. 后续轮次建议

以下问题需要后续 explorer/verifier 轮次覆盖：

1. **阈值校准**：当前阈值（P25/P75等）为假设值，需用真实对局数据验证分布。
2. **更多候选梗**：本框架覆盖了4个案例，但完整的梗库需覆盖全部10个维度（赛事、主播、解说、五位置等）。
3. **冲突检测**：多个主称号同时触发时的优先级和互斥规则。
4. **用户研究**：真实用户对"被授予称号"的接受度测试。
5. **灰度策略**：首批上线范围、A/B测试方案、用户反馈收集机制。
6. **Chovy/LCK梗的文化适配**："右手"虽在LPL中文圈流传，但Chovy是LCK选手，需确认中文用户认知度是否足够。
