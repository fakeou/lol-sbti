# 深度调查第5轮：打野冲突整合与统一修订（Explorer）

> **轮次**：Explorer Round 5 — 打野冲突整合与统一修订
> **状态**：Final
> **日期**：2026-07-24
> **来源**：综合 Round 4 三份材料（data-field-audit / schema-conflicts / jungle-memes）及 Round 3 审计通知结论
> **目标**：代码级复核 6 个新增打野候选；雷达哥语义代理降级；厂长/我就是天规则修正；建立打野冲突组体系；移除 CG-01 淘汰成员；明确奇迹行者 primary 为产品折中；裁决 CJB(D) 与 4396/2200(B) 的风险边界
> **原则**：所有字段判定以 `main.rs` CsvMatch 结构体为唯一真相源；冲突组互斥规则必须基于数据区间可区分；语义代理降级须给出代理强度评估

---

## 0. 前置材料清单

| 材料 | 文件 | 关键输出 |
|------|------|---------|
| **M1** | `round-04-data-field-audit.md` | Round 3 43项 A/B 候选代码级审计：30 ✅ + 5 ⚠️ + 8 ❌；打野位达 3 项全 ✅（奇迹行者/4396/正方形打野）；淘汰 8 项均为 Any 类 |
| **M2** | `round-04-schema-conflicts.md` | 统一 Schema + 6 冲突组设计（含 CG-01 五逆袭叙事 / CG-02 洛三元）；10 实例填充；YYDS 降 status；奇迹行者 evidence vs product 裁决 |
| **M3** | `round-04-jungle-memes.md` | 新增 18 项打野候选评估：4A+5B 推荐上线，3D 禁用，7 淘汰；语义覆盖矩阵与行为缺口分析 |
| **N1** | `round-03-audit-gaps.md` | GAP-E1/E2 证据诚实性；GAP-F3 反讽防火墙；GAP-F4 五逆袭叙事冗余；GAP-C1 champion_id 缺失；GAP-P1 打野位正面短缺 |
| **N2** | `round-03-safe-computable-funnel.md` | 43 A/B 候选漏斗；A-JG-01/B-JG-01/B-JG-02 为本文打野基准 |

---

## 1. 代码级复核：6 个新增打野候选

### 1.0 复核基准

所有字段可用性判定以 [`apps/desktop/src-tauri/src/main.rs`](../../apps/desktop/src-tauri/src/main.rs) 的 `CsvMatch` 结构体（L71-93）及实际 CSV 产出为唯一真相源。已确认可用的字段包括：

```
kills, deaths, assists, kill_participation_percent, cs, gold,
champion_damage, damage_share_percent, damage_taken, healing,
vision_score, wards_placed, wards_killed, damage_taken_on_team,
cc_score, duration_minutes, turret_kills, inhibitor_kills,
first_blood_kill, first_blood_assist, result, position, queue,
game_mode, match_time, champion, items
```

聚合指标（`cs_per_min_avg`、`avg_kda`、`kda_variance` 等）均可通过上述字段计算。

### 1.1 逐项复核

#### JG-NEW-01：绝食流（C-JG-01 → B 级 sub_tag）

| 项目 | 判定 |
|------|:----:|
| **触发字段** | `cs` + `duration_minutes` → `cs_per_min_avg`；`kill_participation_percent`；`assists`；`deaths` |
| **CSV 状态** | ✅ 全部存在于 CsvMatch（cs:403, duration_minutes:415, kill_participation_percent:401, assists:400, deaths:399） |
| **聚合需求** | `cs_per_min_avg = avg(cs / duration_minutes)` over N matches。`avg_kill_participation` 同理。无新字段依赖。 |
| **简化方案可行性** | `cs_per_min_avg < P25` + `kill_participation > P80` + `deaths ≤ P50` — 三个条件均直接可计算 |
| **缺失字段** | 无 |
| **结论** | ✅ **完全可计算，代码级确认通过。** |

**语义弱项说明**：简化方案用 `deaths ≤ P50` 区分"绝食"与"送头"，但无法真正判断"主动放弃发育换节奏"的意图（需要事件级打野等级差数据）。作为 B 级 sub_tag 可接受此精度损失。

---

#### JG-NEW-02：雷达哥（C-JG-03 → 降级，见 §2）

| 项目 | 判定 |
|------|:----:|
| **触发字段** | `vision_score`；`wards_placed`；`deaths`；`kill_participation_percent` |
| **CSV 状态** | ✅ 全部存在于 CsvMatch（vision_score:410, wards_placed:413, deaths:399, kill_participation_percent:401） |
| **结论** | ✅ **字段层面完全可计算。** 但语义代理强度问题导致产品层级降级（见 §2）。 |

---

#### JG-NEW-03：野王（C-JG-04 → B 级 sub_tag，仅褒义侧）

| 项目 | 判定 |
|------|:----:|
| **触发字段（褒义侧）** | `cs` + `duration_minutes` → `cs_per_min_avg`；`kill_participation_percent`；`kills` + `deaths` + `assists` → `avg_kda` |
| **CSV 状态** | ✅ 全部存在于 CsvMatch |
| **结论** | ✅ **完全可计算。** 褒义侧触发区间（cs_per_min_avg > P75 + kill_participation > P70 + avg_kda > P75）自洽。 |

**注意**：贬义侧（cs_per_min_avg > P75 + kill_participation < P30）与奇迹行者重叠 —— 已在 §4.1 冲突组 JG-A 中裁决为"奇迹行者优先覆盖"。

---

#### JG-NEW-04：宁王（C-JG-05 → B 级 sub_tag）

| 项目 | 判定 |
|------|:----:|
| **触发字段** | `kill_participation_percent`；`damage_share_percent`；`deaths` |
| **CSV 状态** | ✅ 全部存在于 CsvMatch（kill_participation_percent:401, damage_share_percent:406, deaths:399） |
| **结论** | ✅ **完全可计算。** |

---

#### JG-NEW-05：厂长（C-JG-06 → A 级 primary，规则修正见 §3.1）

| 项目 | 判定 |
|------|:----:|
| **触发字段** | `cs` + `duration_minutes` → `cs_per_min_avg`；`vision_score`；`kill_participation_percent`；`damage_share_percent`（反证用） |
| **CSV 状态** | ✅ 全部存在于 CsvMatch |
| **结论** | ✅ **完全可计算。** 规则修正见 §3.1。 |

---

#### JG-NEW-06：我就是天（C-JG-07 → B 级 sub_tag，规则修正见 §3.2）

| 项目 | 判定 |
|------|:----:|
| **触发字段** | `kill_participation_percent`；`damage_share_percent`；`kills` + `deaths` + `assists` → `avg_kda` |
| **CSV 状态** | ✅ 全部存在于 CsvMatch |
| **结论** | ✅ **完全可计算。** 规则修正见 §3.2。 |

---

### 1.2 复核汇总

| 编号 | 候选 | 原推荐等级 | 代码级可计算 | 字段缺口 | 复核后等级 |
|:----:|------|:--------:|:----------:|:------:|:--------:|
| JG-NEW-01 | 绝食流 | B sub_tag | ✅ | 无 | **B sub_tag**（维持） |
| JG-NEW-02 | 雷达哥 | A primary | ✅ | 无 | **B sub_tag**（降级，§2） |
| JG-NEW-03 | 野王(褒义) | B sub_tag | ✅ | 无 | **B sub_tag**（维持，贬义侧移除） |
| JG-NEW-04 | 宁王 | B sub_tag | ✅ | 无 | **B sub_tag**（维持） |
| JG-NEW-05 | 厂长 | A primary | ✅ | 无 | **A primary**（规则修正，§3.1） |
| JG-NEW-06 | 我就是天 | B sub_tag | ✅ | 无 | **B sub_tag**（规则修正，§3.2） |

> **结论**：6 个新增打野候选全部通过代码级字段复核，无字段缺口。降级仅出于语义代理强度（雷达哥）或规则修正需要。

---

## 2. 雷达哥语义代理降级：A → B

### 2.1 问题诊断

M3（jungle-memes）将雷达哥推荐为 **A 级 primary**，理由是"纯褒义、无负面联想"。但该推荐忽略了一个关键问题：**触发条件使用的 `vision_score` 是语义代理，而非直接行为映射。**

| 维度 | 原始语义 | 当前代理 | 代理强度 |
|------|---------|---------|:-------:|
| **核心行为** | 预判对手打野位置 → 在正确时机反蹲/反制 | `vision_score > P85` + `wards_placed > P75` | 🟡 **中等** |
| **辅助行为** | 野区遭遇战预判获胜 | `deaths < P25`（不被打野抓死） | 🟡 **弱** — 低死亡 ≠ 预判成功（可能是对手打野不抓你） |
| **结果指标** | 反蹲成功率 | `kill_participation > P65`（参团高 = 反蹲/支援成功） | 🟡 **弱** — 高参团率也可能是无脑打架 |

**代理强度评估**：

- `vision_score` 和 `wards_placed` 描述的是"插眼量/清眼量"——这是**信息获取行为**，与 Karsa 的"雷达预判"有关联（获取信息 → 预判更准），但关联强度中等。一个插眼很多但判断力差的打野也可能拿到高 vision_score。
- `deaths < P25` 用于代理"不容易被抓"——但低死亡更可能是"打得怂"而非"反制成功"。
- 原始语义的核心——"像开了全图挂一样预判对手"——是 Karsa 的天赋级能力，无法用任何汇总指标精确捕获。

**语义代理强度等级**：

| 强度 | 定义 | 示例 |
|:----:|------|------|
| **强代理** | 指标与语义间的因果关系直接且排他 | `kill_participation < P25` → 参团少（奇迹行者） |
| **中代理** | 指标与语义存在关联但非因果，有替代解释 | `vision_score > P85` → 信息多（可能预判更准，也可能只是无脑插眼） |
| **弱代理** | 指标仅与语义有统计相关性，无因果链路 | `deaths < P25` → 低死亡（可能是怂，也可能真预判准） |

### 2.2 降级裁决

| 字段 | 裁决 |
|------|------|
| **原等级** | A 级 primary（M3 推荐） |
| **降级后** | **B 级 sub_tag** |
| **降级理由** | (1) 核心语义（"预判对手位置"）的代理为 `vision_score`，属于**中等强度代理**，不及"奇迹行者"的 `kill_participation`（强代理）；(2) `deaths < P25` 的"反打野预判"含义为弱代理；(3) 辅助证据 `kill_participation > P65` 与宁王/我就是天重叠，区分度不足 |
| **产品角色** | sub_tag。作为"意识型打野"的正面标签，搭配其他 primary 使用 |
| **展示名称** | **仅使用"雷达哥"**，禁止使用"窥屏打野"（即使作为内部标记）。"窥屏"含作弊隐喻，品牌风险不可接受 |
| **风险缓解** | 触发时 UI 附"野区意识出色"文案，不使用任何与"窥屏/作弊"相关的表述 |
| **升级条件** | 若未来获得事件级数据（反蹲成功率、野区遭遇战胜率），可重新评估升级为 A 级 primary |

### 2.3 修订后触发规则

```yaml
# 雷达哥 — B 级 sub_tag（降级后）
trigger_metrics:
  - metric: "vision_score"
    operator: "percentile_top"
    value: 85
    weight: 1.0
    required: true
    scope: "season_average"
  - metric: "wards_placed"
    operator: "percentile_top"
    value: 75
    weight: 0.5
    required: false
    scope: "season_average"
  - metric: "kill_participation"
    operator: "percentile_top"
    value: 65
    weight: 0.5
    required: false
    scope: "season_average"
counter_metrics:
  - metric: "deaths"
    operator: "percentile_top"
    value: 60
    weight: 1.0
    required: true
    scope: "season_average"
    note: "deaths > P60（容易被抓）→ 一票否决。反证原理：死得多的人不可能是'雷达'"
sample_min_games: 15
sample_window_days: 90
same_pos_min_games: 15
normalize_by: same_position
product_tier: sub_tag
```

---

## 3. 厂长 / 我就是天 规则修正

### 3.1 厂长（A 级 primary）规则修正

#### 3.1.1 M3 原始规则存在的问题

M3 给出的触发规则：
```
cs_per_min_avg > P80 + vision_score > P80 + kill_participation P40–P80
反证：damage_share < P20（4396区间）→ 不触发
```

**问题 1：kill_participation 区间有覆盖缺口。** `P40–P80` 作为 BETWEEN 条件，排除了 kill_participation > P80 的高参团打野。但厂长（Clearlove）在 S5 MSI 夺冠时期同样有高参团 carry 表现。过度限制区间会遗漏"既刷野高效、又积极参团"的全面型打野，而这恰恰是"厂长"称号最光荣的一面。

**问题 2：与 4396 的互斥逻辑不完整。** 当前反证仅检查 `damage_share < P20`（4396 区间），但未处理 `damage_share` 在 P20-P30 这个"灰色区间"——既不是典型的 4396（极低伤害），也不是典型的厂长（高伤害）。该区间的打野应触发什么？当前规则留下了一个决策真空。

**问题 3：产品文案缺失。** `display_name = "厂长"` 但 M3 未给出配套的 `display_name_short`、`aliases`、状态文案，也未明确 `mitigation` 中"要打得好才配得上厂长"的产品提示。

#### 3.1.2 修正规则

```yaml
meme_id: "chang-zhang"
display_name: "厂长"
display_name_short: "厂长"
aliases: ["你的野区我养猪", "诺言"]

origin_verified: true
origin_source_tier: P1
origin_source_ref: "百度百科'明凯'词条 + 萌娘百科 + LPL官方'仲夏夜之梦'文章（docid=12438641844144280607）"
origin_source_desc: "Clearlove（明凯）早期Rank名言'这么菜打什么职业，回家养猪吧'→社区反称其为'养猪场厂长'。S2-S5国内统治级打野，2015 MSI冠军（LPL首座官方国际赛事冠军）。"
origin_p0_link_pending: false

meaning_verified: true
meaning_source_tier: P1
meaning_current: "LPL传奇打野的代称——野区统治力、高效发育、视野控制"

sentiment: positive
risk_tier: 🟡
risk_flags: {derogatory: false, racial_appearance: false, nationality: false, personality_denial: false}
known_black_names: []
mitigation: "UI提示文案：'野区统治者——你的野区我养猪！' 仅高刷野+高视野+正战绩时触发，防止称号滥用稀释。禁止在damage_share < P20（4396区间）时展示任何'厂长'相关内容，包括状态文案。"
anti_irony_firewall: "damage_share < P25 → 一票否决。防止'4396了还叫厂长'的反讽场景。"

product_tier: primary
evidence_tier: origin_verified

category: player_meme
target_position: [jungle]
target_modes: [ranked_solo, ranked_flex]
position_lock: true

# === 修正后触发规则 ===
trigger_metrics:
  - metric: "cs_per_min_avg"
    operator: "percentile_top"
    value: 80
    weight: 1.0
    required: true
    scope: "season_average"
  - metric: "vision_score"
    operator: "percentile_top"
    value: 80
    weight: 0.8
    required: true
    scope: "season_average"
  - metric: "kill_participation"
    operator: "percentile_top"
    value: 40
    weight: 0.5
    required: false
    scope: "season_average"
    note: "修正：从 P40–P80 BETWEEN 改为 > P40（下限不变，取消上限）。高参团不排斥厂长称号。"
  - metric: "damage_share"
    operator: "percentile_top"
    value: 25
    weight: 1.0
    required: true
    scope: "season_average"
    note: "新增必要条件：damage_share > P25。用于封堵 P20-P30 灰色区间。4396 区间 (< P15) 已在 counter 中处理。"

counter_metrics:
  - metric: "damage_share"
    operator: "percentile_bottom"
    value: 20
    weight: 1.0
    required: true
    scope: "season_average"
    note: "damage_share < P20 → 一票否决。即 4396 区间触发时，绝对不能同时显示厂长。"

sample_min_games: 15
sample_window_days: 90
same_pos_min_games: 15
normalize_by: same_position
confidence_threshold: 0.7

conflict_group: "jg-clearlove-duality"  # 与 4396 的二元冲突组（§4.2）
conflict_role: positive_face
```

**修正要点**：

| 修正项 | 原规则 | 修正后 | 理由 |
|--------|--------|--------|------|
| kill_participation 上限 | P80 封顶 | **移除上限**（仅保留下限 P40） | 高参团+高刷野=全能型打野，理应是"厂长"的完美体现 |
| damage_share 必要条件 | 无（仅反证 < P20） | **新增 damage_share > P25** | 封堵 P20-P30 灰色区间，避免"伤害偏低但够不上 4396"的打野触发厂长 |
| 反证阈值 | damage_share < P20 | 维持 | 与 4396 触发条件（< P15）之间保留 P15-P20 安全缓冲区 |
| 展示文案 | 未定义 | "你的野区我养猪" 作为配套状态 | M3 C-JG-17 确认该文案安全可用 |

---

### 3.2 我就是天（B 级 sub_tag）规则修正

#### 3.2.1 M3 原始规则存在的问题

M3 给出的触发规则：
```
kill_participation > P85 + damage_share > P75 + avg_kda > P75
反证：kill_participation < P60 → 不够好；deaths > P65 → 不够"天"
```

**问题 1：缺少"多场连续高表现"的统治力检测。** "我就是天"的核心语义（Tian S9 FMVP）不仅是单场/统计上的"数据好"，而是 S9 整个赛季的**统治级表现**——多场连续碾压对手。仅靠三个百分位阈值无法区分"偶有高光"和"持续统治"。

**问题 2：反证存在逻辑漏洞。** `kill_participation < P60` 作为反证与必要条件（> P85）**不可能同时触发** —— 满足 >P85 的打野不可能 <P60。这条反证是空规则。

**问题 3：文案建议不足。** M3 建议"今天我就是天"而非"我就是天"，但未给出正式的产品字段。

#### 3.2.2 修正规则

```yaml
meme_id: "wo-jiu-shi-tian"
display_name: "今天我就是天"
display_name_short: "我就是天"
aliases: ["天神下凡（打野版）", "小天"]

origin_verified: true
origin_source_tier: P1
origin_source_ref: "萌娘百科'高天亮'词条 + S9 FMVP官方认证 + LPL 2021宣传片原片"
origin_source_desc: "Tian（高天亮），FPX S9冠军打野、FMVP。2021 LPL宣传片名言'我就是天'（与甄嬛传二创联动）。S9时期节奏型打野的代表（盲僧/奇亚娜/蜘蛛）。"
origin_p0_link_pending: false

meaning_verified: true
meaning_source_tier: P1
meaning_current: "打野节奏碾压对手、打出主宰级表现、自信爆棚"

sentiment: positive
risk_tier: 🟡
risk_flags: {derogatory: false, racial_appearance: false, nationality: false, personality_denial: false}
known_black_names: ["玉玉症", "3824"]  # 关联黑称，产品层绝不展示
mitigation: "使用'今天我就是天'作为展示名称，增加临时性/时效感降低狂傲感。不与Tian选手负面事件（心理健康问题等）做任何关联。"
anti_irony_firewall: "仅近N场高表现时触发，非永久标签。表现回落后自动消失，防止'不再是天了'的反讽。"

product_tier: sub_tag
evidence_tier: origin_verified

category: player_meme
target_position: [jungle]
target_modes: [ranked_solo, ranked_flex]
position_lock: true

# === 修正后触发规则 ===
trigger_metrics:
  - metric: "kill_participation"
    operator: "percentile_top"
    value: 85
    weight: 1.0
    required: true
    scope: "recent_n_games"
    note: "近 10 场 kill_participation > P85（非赛季平均，而是近期窗口）"
  - metric: "damage_share"
    operator: "percentile_top"
    value: 75
    weight: 1.0
    required: true
    scope: "recent_n_games"
  - metric: "avg_kda"
    operator: "percentile_top"
    value: 75
    weight: 0.8
    required: true
    scope: "recent_n_games"

support_metrics:
  - metric: "win_rate"
    operator: "gte"
    value: 60
    weight: 0.5
    required: true
    scope: "recent_n_games"
    note: "新增：近 10 场 win_rate ≥ 60%。'统治级表现'必须有胜率支撑。"

# === 新增统治力检测 ===
dominance_check:  # 新增字段，非原 Schema 标准字段
  description: "近 15 场中 ≥ 8 场 kill_participation > P70（超过半数场次参团率高）"
  required: true
  weight: 0.6
  note: "区分'偶有高光'和'持续统治'。单场爆发是天神下凡（A-ANY-01），持续碾压才是我就是天。"

counter_metrics:
  - metric: "deaths"
    operator: "percentile_top"
    value: 65
    weight: 1.0
    required: true
    scope: "recent_n_games"
    note: "deaths > P65 → 不够'天'。原反证 kill_participation < P60 与必要条件（> P85）逻辑互斥，已删除。"

sample_min_games: 20          # 因新增 dominance_check，最低样本量提高
sample_window_days: 60
same_pos_min_games: 15
normalize_by: same_position
confidence_threshold: 0.75

conflict_group: "jg-aggressive-style"  # 与宁王/绝食流的进攻型打野冲突组（§4.3）
conflict_role: alternative
priority: 2  # 高于宁王(3)，低于绝食流(1)（参 §4.3 优先级）
```

**修正要点**：

| 修正项 | 原规则 | 修正后 | 理由 |
|--------|--------|--------|------|
| 展示名称 | "我就是天" | **"今天我就是天"** | 增加时效感，降低永久标签的狂傲感 |
| 统计口径 | season_average | **recent_n_games（近10场）** | "我就是天"描述的是近期状态，非赛季画像 |
| 胜率要求 | 无 | **新增 win_rate ≥ 60%** | 统治力必须有胜率支撑 |
| 统治力检测 | 无 | **新增 dominance_check** | 核心修正：持续高表现才是我就是天，单场高光是天神下凡 |
| 反证规则 | kill_participation < P60（空规则） | **删除该条** | 与必要条件逻辑互斥，无效 |
| sample_min_games | 隐含 15 | **20** | 新增 dominance_check 需更多样本 |
| product_tier | B sub_tag（原） | **维持 B sub_tag** | 语义正面但含"狂傲"色彩，适合 sub_tag 搭配使用 |

---

## 4. 打野冲突组体系

### 4.0 冲突组设计原则

1. **数据区间互斥**：同一冲突组内的称号必须在触发区间上可被百分位阈值区分，不可出现"同一玩家同时触发同组多个称号"的情况。
2. **优先级降维**：当区间接近时，按语义严重度规定优先级。高优先级触发后低优先级自动抑制。
3. **二选一互斥**：同一选手的正/反面称号（如厂长/4396）必须通过互斥逻辑确保不同时展示。
4. **跨组共存**：不同冲突组的称号可以共存（如玩家可以同时是 radar + 厂长）。

### 4.1 冲突组 JG-A：刷野-参团维度（farm-vs-participation）

**成员**：奇迹行者 | 正方形打野 | 野王（贬义侧 → 已移除，见 §4.1.3）

#### 4.1.1 冲突逻辑

这三个称号描述的是同一行为轴的两个极端——**刷野量与参团率的权衡**。核心区分维度为 `kill_participation` 百分位。

| 称号 | kill_participation | cs_per_min | 语义 | 严重度 | 产品层级 |
|------|:-----------------:|:----------:|------|:----:|:------:|
| **奇迹行者** | < P25 | > P75 | "只刷不帮"——完全局外人 | 🔴 最严重 | A primary |
| **正方形打野** | P30–P70 | > P75 | "高效刷+偶尔帮"——战术取舍 | 🟡 中性 | B sub_tag |
| **野王（贬义）** | P20–P45 | > P65 | "刷得不错但帮得少"——轻度调侃 | 🟠 负面 | ⬛ **已移除** |

#### 4.1.2 互斥规则

```
区间分配（kill_participation 百分位）：
  [0%  ─────── P25 ─────── P30 ──────────────────── P70 ─────── 100%]
   ← 奇迹行者 →|  缓冲区  |←── 正方形打野 ──→|    不触发此组     |

优先级：
  奇迹行者 > 正方形打野
  （当 kill_participation < P25 时，优先触发奇迹行者。
    因为"只刷不帮"是玩家的核心问题，正方形打野的"中性战术"描述在此不适用。）
```

- **缓冲区（P25–P30）**：不触发任何 JG-A 称号。此区间的打野既不够"只刷不帮"（参团率勉强可以），也达不到"正方形打野"要求的"中等参团"。产品上显示为无称号，属于正常区间。
- **正方形打野区间（P30–P70）**：需要 kill_participation 在 P30-P70 **且** cs_per_min > P75 才触发。参团率在此区间 + 高刷野 = 兼顾发育和支援的战术型打野。
- **冲突检测顺序**：每次评估时先检查是否触发奇迹行者（更严重），若触发则跳过正方形打野检查。

#### 4.1.3 野王（贬义侧）移除

M3 中 C-JG-04 的贬义触发侧（kill_participation P20-P45 + cs_per_min > P65）与奇迹行者（< P25）在 P20-P25 区间**重叠**，且与正方形打野（P30-P70）在 P30-P45 区间**重叠**。保留贬义侧会造成三向冲突。

**裁决**：**野王仅保留褒义侧触发**（cs_per_min > P75 + kill_participation > P70 + avg_kda > P75），贬义侧从 JG-A 中**移除**并标为 `deprecated`。贬义侧语义已被奇迹行者更精准覆盖（"只刷不帮"的判断力比"刷得不错但帮得少"更强）。

```yaml
# 野王 — 修订后
meme_id: "ye-wang"
# ...
product_tier: sub_tag  # B 级，仅褒义侧
# 贬义侧已移除，标记为 deprecated
deprecated_face: "negative"
deprecated_reason: "贬义侧（低参团+高刷野）的 kill_participation 区间 P20-P45 与奇迹行者(P0-P25)和正方形打野(P30-P70)冲突。贬义语义已被奇迹行者更精准覆盖。"
```

---

### 4.2 冲突组 JG-B：Clearlove 二元性（厂长 / 4396）

**成员**：厂长（A primary） | 4396（B primary 自嘲）

#### 4.2.1 冲突逻辑

厂长和 4396 是 **Clearlove 同一选手的一体两面**——前者是野区统治的象征，后者是伤害低迷的计量单位。在游戏行为层面，`damage_share` 决定了触发哪一面：

| 称号 | 触发条件 | 产品层级 | sentiment |
|------|---------|:------:|:---:|
| **厂长** | cs_per_min > P80 + vision_score > P80 + kill_participation > P40 **+ damage_share > P25** | A primary | positive |
| **4396** | damage_share < P15（或同位置 P10） | B primary（自嘲） | teasing |

#### 4.2.2 互斥规则

```
damage_share 百分位轴：
  [0% ── P15 ── P20 ── P25 ─────────────────────────── 100%]
   ← 4396 →| 安全缓冲 |←─── 厂长 ──────────────────────→
           |  P15-P25  |
           |  不触发   |
```

- **4396 区间**（damage_share < P15）：触发 4396（需自嘲开关）。**绝对不触发厂长**。
- **安全缓冲区**（P15 ≤ damage_share ≤ P25）：不触发任何 Clearlove 相关称号。伤害偏低但未到"计量单位"级别。防止边界抖动造成的称号闪烁。
- **厂长区间**（damage_share > P25 + 其他条件满足）：触发厂长。
- **双面展示禁止**：同一份玩家报告中，"厂长"和"4396"**绝对不能同时出现**。系统在触发检查时，先评估 4396 条件（更严格的负面条件），若命中则跳过厂长检查。

```yaml
# 冲突组定义
conflict_group: "jg-clearlove-duality"
conflict_type: "mutual_exclusion"     # 二元互斥
members:
  - meme_id: "chang-zhang"
    role: "positive_face"
    priority: 1                      # 正面优先，但被 4396 条件覆盖时降级
  - meme_id: "4396"
    role: "negative_face"
    priority: 2
exclusion_logic: "damage_share 区间互斥 + P15-P25 安全缓冲区"
cross_display_forbidden: true         # 禁止双面同时展示
```

---

### 4.3 冲突组 JG-C：进攻型打野（宁王 / 我就是天 / 绝食流）

**成员**：宁王（B sub_tag） | 我就是天（B sub_tag） | 绝食流（B sub_tag）

#### 4.3.1 冲突逻辑

三者都描述打野"积极进攻/高参团"行为，但风格有所不同：

| 称号 | 参团率 | 伤害 | 刷野量 | 核心语义 |
|------|:-----:|:---:|:-----:|------|
| **绝食流** | > P80 | — | **< P25** | 放弃发育换节奏 |
| **我就是天** | > P85 | > P75 | — | 节奏碾压、主宰级统治 |
| **宁王** | > P75 | > P70 | — | 积极进攻、敢打敢开 |

#### 4.3.2 互斥规则

此冲突组的区分维度不是单一的 kill_participation 轴，而是**多维度加权综合**。三者可能在 kill_participation 区间上有重叠，但通过其他条件区分：

```
触发优先级（高→低）：
  1. 我就是天（最严格，需 dominance_check + win_rate ≥ 60%）
  2. 绝食流（cs_per_min < P25 为硬性区分条件）
  3. 宁王（最宽松，兜底覆盖积极进攻型）
```

- **我就是天**：优先级最高。`kill_participation > P85 + damage_share > P75 + avg_kda > P75 + win_rate ≥ 60% + dominance_check`。仅在持续统治级表现时触发。
- **绝食流**：`kill_participation > P80 + cs_per_min < P25 + deaths ≤ P50`。cs_per_min < P25 是硬性区分条件——"低刷野+高参团"是绝食流的独家特征。我就是天和宁王都不要求低 cs_per_min，因此绝食流有独立的触发空间。
- **宁王**：`kill_participation > P75 + damage_share > P70 + deaths P30–P70`。作为兜底——当打野积极进攻但未达到"我就是天"的统治级，也非"绝食流"的低发育特征时，触发宁王。

**共存规则**：三者互斥——同一次评估中最多触发一个。按优先级顺序判定：先判定我就是天 → 绝食流 → 宁王。命中即停止。

```yaml
conflict_group: "jg-aggressive-style"
conflict_type: "priority_chain"      # 优先级链式互斥
members:
  - meme_id: "wo-jiu-shi-tian"
    role: "apex"
    priority: 1                       # 最高优先级
  - meme_id: "jue-shi-liu"
    role: "distinctive"
    priority: 2                       # 中等，cs_per_min 独立区分
  - meme_id: "ning-wang"
    role: "baseline"
    priority: 3                       # 兜底
exclusion_logic: "优先级链：命中即停止。三者不可同时触发。"
```

---

### 4.4 冲突组 JG-D：控图型打野（厂长 / 雷达哥 / 正方形打野）

**成员**：厂长（A primary） | 雷达哥（B sub_tag） | 正方形打野（B sub_tag）

#### 4.4.1 冲突逻辑

三者都有"高视野/高效发育"的语义，区分维度为 `vision_score` 和 `damage_share`：

| 称号 | vision_score | damage_share | kill_participation | 核心语义 |
|------|:----------:|:----------:|:-----------------:|------|
| **厂长** | > P80 | > P25 | > P40 | 野区统治+高效发育+控图 |
| **雷达哥** | > P85 | — | > P65 | 意识超群+预判准确 |
| **正方形打野** | — | — | P30–P70 | 路径高效+兼顾发育支援 |

#### 4.4.2 共存规则

此组**非互斥**——三者可以共存（跨组共存原则）。厂长与雷达哥可以同时触发（"野区统治+意识超群"是正向叠加）。厂长与正方形打野在 kill_participation 区间上有交集（P40-P70），但二者描述的打野风格不同——一个是"统治力"（正面），一个是"战术取舍"（中性），可以共存。

**唯一互斥**：正方形打野的 kill_participation 区间（P30-P70）与厂长 <P40 区间无交集——也就是说，如果一个打野 kill_participation < P40，正方形打野不会触发，只剩厂长。（但这实际上已被 JG-A 互斥规则覆盖，无需额外处理。）

```yaml
conflict_group: "jg-control-style"
conflict_type: "coexistence"         # 可共存组
members:
  - meme_id: "chang-zhang"
    role: "primary_dominant"
  - meme_id: "lei-da-ge"
    role: "complement_awareness"
  - meme_id: "zheng-fang-xing-da-ye"
    role: "complement_efficiency"
coexistence_note: "厂长与雷达哥可共存（野区统治+意识超群是正向叠加）。正方形打野与厂长在 kill_participation P40-P70 区间共存，描述角度不同（统治力 vs 战术取舍）。"
```

---

### 4.5 冲突组全景图

```
        kill_participation →
  低 ←────────────────────────────→ 高
  
  JG-A: 奇迹行者      │ 正方形打野          │
        (< P25)       │ (P30-P70)            │
                      │                      │
  JG-C:               │   绝食流(cs< P25)   │ 我就是天(最高)
                      │   宁王(兜底)        │
                      │                      │
  JG-D:    厂长(dmg>P25) + 雷达哥(vision>P85)
           └── 正方形打野 (共存) ──┘
```

---

## 5. 移除 CG-01 淘汰成员

### 5.1 背景

M2（schema-conflicts）§4 定义了 **CG-01：五逆袭叙事**冲突组，成员为：

| 编号 | meme_id | 名称 | Round 4 数据审计结果 |
|:----:|---------|------|:-------------------:|
| 1 | `bu-po-bu-li` | 不破不立 | ✅ 完全可计算 |
| 2 | `fan-shan` | 翻山 | ❌ **淘汰**（需要 opponent_rank 和 rank 变化数据） |
| 3 | `nie-pan` | 涅槃 | ✅ 完全可计算 |
| 4 | `qi-shi-gui-lai` | 骑士归来 | ❌ **淘汰**（需要历史最高段位） |
| 5 | `bei-fa` | 北伐 | ❌ **淘汰**（需要 rank 时间序列 + opponent_rank） |

### 5.2 移除操作

根据 M1（data-field-audit）§3.4-3.5 的代码级淘汰结论，`fan-shan`、`qi-shi-gui-lai`、`bei-fa` 三个称号因依赖不可获取字段（opponent_rank、历史段位、rank 时间序列）被正式判定为 **❌ 淘汰**。

**执行移除**：从 CG-01 冲突组中删除这三个淘汰成员。

### 5.3 修订后的 CG-01

```yaml
conflict_group: "comeback-narrative"
conflict_type: "priority_chain"
status: "revised_r5"                  # Round 5 修订
members:
  - meme_id: "bu-po-bu-li"
    role: "primary"
    priority: 1
    note: "P1 双源（LOL官方新闻 + 官方纪录片）。五逆袭叙事中认知度最高、字面可脱离战队独立理解。computability: directly_computable"
  - meme_id: "nie-pan"
    role: "alternative"
    priority: 2
    note: "FPX S9叙事。computability: directly_computable。作为不破不立的替代选择，当玩家表达FPX粉丝身份偏好时可用。"

removed_members:                       # Round 5 新增
  - meme_id: "fan-shan"
    removal_reason: "M1 §3.4 淘汰：需要 opponent_rank 和 rank 变化数据（'下克上'是核心触发），两个字段均不可获取。main.rs 及 UploadMatchV1 均不含 rank/opponent_rank。"
    removal_date: "2026-07-24"
  - meme_id: "qi-shi-gui-lai"
    removal_reason: "M1 §3.4 淘汰：需要历史最高段位数据。LCU 不提供历史段位时间序列，当前代码未调用任何 ranked 接口。"
    removal_date: "2026-07-24"
  - meme_id: "bei-fa"
    removal_reason: "M1 §3.4 淘汰：需要 rank 时间序列 + opponent_rank（排名触底→强势反弹 + 连胜对手不强则不触发）。两个字段均不可获取。"
    removal_date: "2026-07-24"

exclusion_logic: "不破不立 与 涅槃 互斥。二选一，优先不破不立（认知度更高、P1 证据更强）。"
cross_display_forbidden: true
```

### 5.4 影响评估

| 影响维度 | 移除前 | 移除后 |
|---------|:----:|:----:|
| CG-01 成员数 | 5 | **2**（不破不立 + 涅槃） |
| 可计算率 | 40%（2/5） | **100%**（2/2） |
| 冲突复杂度 | 五向优先级排序 | **二选一，简单互斥** |
| Any 位 V型反弹叙事 | 3 个淘汰 / 2 个保留 | 覆盖率无变化（淘汰项本不可用） |

> 移除不产生新的行为覆盖缺口——淘汰的三项因字段不可获取，本身就无法上线。

---

## 6. 奇迹行者 primary 的产品折中声明

### 6.1 折中背景

M2（schema-conflicts）§3.2 对奇迹行者做了 evidence vs product 的裁决：

> **evidence_tier = high_conf**（P0 首创录像待补充，但 P2 + P3 多源验证充分）
> **product_tier = primary**（维持）

Round 5 需要**明确声明**：奇迹行者作为 A 级 primary 是一项**产品折中**，并非理想的纯 merit-based 选择。

### 6.2 折中分析

| 维度 | 理想 A 级 primary 标准 | 奇迹行者实际情况 | 差距 |
|------|----------------------|-----------------|:--:|
| **evidence_tier** | origin_verified（P0/P1 双重确认） | **high_conf**（P2+P3，P0 链接 pending） | 🟡 1 级差距 |
| **sentiment** | positive（纯褒义） | **teasing**（轻度调侃） | 🟡 打野位唯一 A 级却是 teasing |
| **选手关联风险** | 无争议 | 姿态直播切片，无风险 | ✅ |
| **可计算性** | 强代理 | **强代理**（kill_participation < P25 直接映射"不参团"） | ✅ |
| **认知度** | general_player × stable | lpl_viewer × rising | 🟡 1 级差距 |
| **打野位正面覆盖** | 应 ≥ 2 个正面 primary | 0 个正面 primary（只有奇迹行者 teasing） | 🔴 严重 |

### 6.3 折中声明

```yaml
product_compromise:
  meme_id: "miracle-walker"
  compromise_type: "position_coverage_forced"
  compromise_date: "2026-07-24"
  
  ideal_state:
    evidence_tier: "origin_verified"
    sentiment: "positive"
    recognition_level: "general_player"
    
  actual_state:
    evidence_tier: "high_conf"
    sentiment: "teasing"
    recognition_level: "lpl_viewer"
    
  compromise_rationale: |
    奇迹行者成为打野位唯一 A 级 primary 是产品折中的结果，非理想选择：
    
    1. **打野位正面 primary 真空**：Round 1-4 探索后，打野位仍无任何一个正面(positive)的 A 级 primary。
       厂长(A级、positive)在 Round 5 被晋升，但在此之前打野位仅奇迹行者独撑。
       即使加入厂长后，打野位的 A 级正面覆盖率仍显单薄（1 个 teasing + 1 个 positive）。
    
    2. **行为映射自洽性优秀**：尽管 evidence/产品/认知度均不达理想标准，
       奇迹行者的行为映射（低参团率+高刷野量）是打野位所有候选中最直接、最强代理的。
       这一优点在产品上不可替代——其他打野梗的语义代理均不如它清晰。
    
    3. **认知度处于上升期**：lpl_viewer × rising 而非 fading，意味着梗的传播力仍在增长。
       作为产品折中，上升期梗比 fading 梗有更长的产品生命周期。
    
    4. **teasing 属性在打野位具有行为指引价值**：'只刷不帮'是打野玩家最常见的被诟病行为。
       将 teasing 称号作为'A 级 primary'本质上是产品策略——用系统称号代替队友的指责，
       将'你为什么不抓人'转化为'你是奇迹行者——多关注小地图！'的行为指引。
    
  upgrade_path:
    condition: "P0 首创录像链接补充 + 打野位新增 ≥ 1 个正面 A 级 primary"
    target_state:
      evidence_tier: "origin_verified"
      product_tier: "primary"  # 维持，但不再承担'唯一A级'的被迫角色
    
  sunset_condition:
    description: "若打野位有 ≥ 2 个正面 A 级 primary 且其中至少一个认知度达 general_player，可考虑将奇迹行者降级为 B 级 sub_tag"
    trigger: "打野位 positive primary 数量 ≥ 2"
```

### 6.4 折中后的打野位 A 级覆盖

| A 级称号 | sentiment | 状态 | 说明 |
|---------|:---------:|:----:|------|
| **奇迹行者** | teasing | 维持 primary | 产品折中——打野位唯一高认知 teasing 称号，行为映射极强 |
| **厂长** | positive | **Round 5 新晋升 A primary** | 第一个正面 A 级打野称号。部分缓解折中压力，但尚未达到"≥2 正面"的升级条件 |

> 打野位仍需 ≥ 1 个正面 A 级 primary 才能触发奇迹行者的 sunset 条件。

---

## 7. CJB(D) 与 4396/2200(B) 的风险边界裁决

### 7.1 问题提出

CJB（冲击波/吹JB）和 4396/2200 都是"负面数据触发的称号"，但前者被判为 D 级禁用，后者被判为 B 级（需自嘲开关）。两者的风险边界在哪里？为什么同样是"数据不好看"，一个可以上线（带开关），另一个不可以？

### 7.2 风险维度对比

| 维度 | CJB（冲击波） | 4396 | 2200 |
|------|:-----------:|:----:|:----:|
| **字面语义** | "吹JB" = 名不副实、被高估 | 厂长 S6 盲僧输出 4396 = 伤害低 | Xiaohu S9 瑞兹输出 2200 = 伤害低 |
| **攻击对象** | **人格/能力否定**（"你被高估了""你在吹牛"） | **行为描述**（"这把伤害低"） | **行为描述**（"这把伤害低"） |
| **攻击性质** | 对玩家**价值/能力的全面否定** | 对单场/短期**伤害输出的具体描述** | 同左 |
| **是否可量化** | ❌ "被高估"是主观评价，无法用数据精确定义 | ✅ damage_share < P15 有明确的统计阈值 | ✅ champion_damage 极低有明确的统计阈值 |
| **可反驳性** | ❌ "你 CJB" 无法被数据反驳（是诛心） | ✅ "这把伤害低"是可以被其他指标（参团率、控图）部分平衡的 | ✅ 同左 |
| **社区语境** | 纯贬义，无正面或中性使用场景 | 贬义数字梗，但已成为 LOL 通用计量单位，含自嘲文化 | 同左，但认知度不及 4396 |
| **选手关联** | 无特定选手绑定（泛用否定词） | 特定选手（Clearlove）的一体两面——4396 和厂长共存 | 特定选手（Xiaohu）的一体两面——2200 和虎大将军共存 |

### 7.3 风险边界裁决

```
  数据描述 ←──────────────────────────→ 人格否定
  
  4396/2200              │              CJB
  "伤害低"               │              "被高估/吹牛"
  行为层面               │              人格层面
  可量化                 │              不可量化
  有反证空间             │              无反证空间
  B 级（自嘲开关）        │              D 级（禁用）
```

**边界线**：**"对玩家能力/价值的人格否定" vs "对玩家行为的描述性调侃"**

| 判定 | 条件 | 示例 |
|:---:|------|------|
| **D 级** | 字面即构成对玩家**人格/能力/价值的否定**："被高估""吹牛""菜""废物""不配" | CJB、糯手、小饱 |
| **B 级** | 描述**具体行为/数据**的负面称呼，可量化、有反证空间、有自嘲文化基础 | 4396、2200、暴毙AD（前提：高输出+高死亡的双刃剑语义） |
| **A 级** | 描述具体行为，sentiment 为 teasing 但不含贬损意图，行为映射极强 | 奇迹行者（"不参团"是可改进的行为，非人格评价） |

### 7.4 裁决结论

```yaml
risk_boundary_ruling:
  boundary_principle: |
    D 级与 B 级的核心分界线是"人格否定 vs 行为描述"。
    称号是否可上线取决于其字面语义是对玩家"是什么"的攻击还是对玩家"做了什么"的描述。
    
    4396/2200 可以说"你这把伤害低了"，因为伤害是可量化、可改进的行为指标。
    CJB 不能说"你被高估了"，因为"被高估"是对玩家价值的全面否定，且无法被数据证实或证伪。

  cjb_ruling:
    product_tier: hidden
    risk_tier: 🔴
    determination: "D 级禁用。字面语义为'吹JB'=被高估/名不副实=对玩家能力/价值的人格否定。不可上线，不可在自嘲模式下恢复。"
    rationale: |
      1. 人格否定不可缓解：自嘲开关可以接受'这把伤害低'(4396)但不应接受'你被高估了'(CJB)。
      2. 不可量化：无法用数据证明一个玩家是否'被高估'——这是主观判断。
      3. 无正向出口：4396/2200有对应的正面（厂长/虎大将军），CJB无正面配对。

  s4396_ruling:
    product_tier: primary
    risk_tier: 🟡
    determination: "B 级 primary（需自嘲开关）。damage_share < P15。反证：kill_participation > P60（功能型打野）降权。需用户主动开启自嘲模式。"
    rationale: |
      1. 行为可量化：damage_share < P15 有明确的统计阈值。
      2. 有正向出口：厂长（damage_share > P25 + 高刷野+高视野）为同一选手的正面。
      3. 自嘲文化基础：4396已成为LOL社区的自嘲梗，玩家在接受度调查中持中性态度。
      4. 双重保护：(a) 自嘲开关 — 用户主动选择；(b) 功能型打野反证 — 辅助型打野不触发。

  s2200_ruling:
    product_tier: sub_tag
    risk_tier: 🟡
    determination: "B 级 sub_tag（需自嘲开关）。champion_damage_per_min < P5 + kill_participation < P40。反证：若该场使用坦克/辅助型中单，降权。"
    rationale: |
      1. 同4396：行为可量化，有正向出口（虎大将军）。
      2. 认知度较弱：2200的认知度显著低于4396，作为sub_tag而非primary更合理。
      3. 反证保护：坦克中单（加里奥/泰坦等）的伤害天然低。
      4. 特殊注意：2200与Xiaohu绑定，且Xiaohu世界赛表现争议较大（2020年后反讽加剧）。
         产品上需与"虎大将军"做严格的互斥处理，类似厂长/4396二元组。

  comparison_summary:
    - "CJB 是说你是个骗子；4396 是说你这一把伤害低了。前者不可接受，后者可作为自嘲。"
    - "风险边界不在'数据好不好看'，而在'称号攻击的是行为还是人格'。"
```

### 7.5 统一风险边界速查表

| 攻击类型 | 风险等级 | 产品层级 | 示例 | 缓解措施 |
|---------|:------:|:------:|------|---------|
| **人格否定**（被高估/吹牛/不行/装） | 🔴 D | hidden | CJB、糯手、小饱 | 不可上线 |
| **外貌/种族/地域攻击** | 🔴 D | hidden | 马头、越南腐乳 | 不可上线 |
| **选手私生活/假赛关联** | 🔴 D | hidden | 龙的传人、越南首富、中野恩断义绝 | 不可上线 |
| **行为调侃-纯贬义（无可反驳空间）** | 🟠 D | hidden | 洗澡狗（纯身份攻击，无行为映射） | 不可上线 |
| **行为描述-负面（可量化+有反证）** | 🟡 B | primary/sub_tag（自嘲） | 4396、2200、暴毙AD | 自嘲开关 + 反证 + 正向出口 |
| **行为描述-中性调侃** | 🟡 A/B | primary/sub_tag | 奇迹行者、369骰子 | UI文案缓冲 |
| **行为描述-正面** | 🟢 A | primary/sub_tag | 厂长、雷达哥、天神下凡 | 无需缓解 |

---

## 8. 统一修订后的打野位称号总表

### 8.1 上线候选（A+B 级，含已有+新增+降级+修正）

| 优先级 | 编号 | 称号 | 等级 | 产品角色 | 触发条件（摘要） | Round 5 变更 |
|:-----:|:----:|------|:---:|:------:|------|:----------:|
| P0 | JG-01 | **奇迹行者** | A 🟡 | primary | kp < P25 + cs > P75 | 维持，声明为产品折中 |
| P0 | JG-02 | **厂长** | A 🟢 | primary | cs > P80 + vision > P80 + kp > P40 + dmg > P25 | **Round 5 新晋升 + 规则修正** |
| P1 | JG-03 | **4396** | B 🟡 | primary（自嘲） | dmg < P15 | 维持，明确与厂长的互斥 |
| P1 | JG-04 | **雷达哥** | B 🟢 | sub_tag | vision > P85 + wards > P75 + kp > P65 | **Round 5 从 A 降级为 B（语义代理降级）** |
| P1 | JG-05 | **我就是天** | B 🟡 | sub_tag | kp > P85 + dmg > P75 + kda > P75 + win≥60% + dominance | **Round 5 新晋升 + 规则修正** |
| P1 | JG-06 | **宁王** | B 🟡 | sub_tag | kp > P75 + dmg > P70 + deaths P30-P70 | Round 5 新晋升（维持 M3 推荐） |
| P1 | JG-07 | **绝食流** | B 🟡 | sub_tag | cs < P25 + kp > P80 + deaths ≤ P50 | Round 5 新晋升（维持 M3 推荐） |
| P1 | JG-08 | **野王（褒义）** | B 🟡 | sub_tag | cs > P75 + kp > P70 + kda > P75 | Round 5 新晋升（贬义侧移除） |
| P1 | JG-09 | **正方形打野** | B 🟡 | sub_tag | cs > P75 + kp P30-P70 | 维持（已有，M1 审计 ✅） |

> 打野位总计：**9 项（2A + 7B）**。正面 A 级：厂长(1)；teasing A 级：奇迹行者(1)。较 Round 3（3 项）扩展至 9 项。

### 8.2 状态文案配套（C 级）

| 编号 | 称号 | 触发 | 配套使用 |
|:----:|------|------|---------|
| C-JG-01 | 你的野区我养猪 | cs > P85（或厂长称号激活时） | 厂长称号的配套 status |
| C-JG-02 | 翻过那座山 | 逆风翻盘局 | 跨位已有（Round 2），交叉引用 |

### 8.3 禁用（D 级）

| 称号 | 原因 | 判定来源 |
|------|------|---------|
| 龙的传人 | Condi 假赛关联 + 抢龙事件不可计算 | M3 → Round 5 确认 |
| 越南首富 | 菠菜暗示不可解耦 | M3 → Round 5 确认 |
| 中野恩断义绝 | 选手私生活/队内矛盾 | M3 → Round 5 确认 |
| 3824 | Tian 身高/外貌黑称 | M3 → Round 5 确认 |
| 玉玉症 | Tian 心理健康被恶搞 | M3 → Round 5 确认 |

### 8.4 淘汰（⬛，不可计算）

| 称号 | 原因 | 判定来源 |
|------|------|---------|
| 三过F6而不入 | 需要地图事件数据 | M3 → Round 5 确认 |
| 边缘OB | 需要团战事件数据 | M3 → Round 5 确认 |
| 挖掘机副系点什么 | 需要语音数据+无行为映射 | M3 → Round 5 确认 |
| 宁王圣经 | 无游戏行为映射 | M3 → Round 5 确认 |
| LPL三大野王 | 荣誉称号不可触发 | M3 → Round 5 确认 |
| LGD双王 | 复杂度过高 | M3 → Round 5 确认 |
| 你一枪我一枪 | 名场面式不可计算 | M3 → Round 5 确认 |

---

## 9. 打野位行为覆盖更新（上线后）

| 行为 | 覆盖称号（Round 5 修订后） | 覆盖质量 |
|:----:|------|:------:|
| 🟢 **刷野（正面）** | 厂长(A)、正方形打野(B)、野王褒义(B) | ✅ 充分（1A+2B） |
| 🟡 **刷野（负面）** | 奇迹行者(A) | ⚠️ 仅 teasing，无正面 alternative |
| 🟢 **控图** | 厂长(A)、雷达哥(B) | ✅ 充分（1A+1B） |
| 🟢 **反野** | 厂长(A)、正方形打野(B)、你的野区我养猪(C) | ✅ 充分 |
| 🟢 **gank/进攻** | 绝食流(B)、宁王(B)、我就是天(B) | ✅ 充分（3B，不同风格） |
| 🟡 **抢龙** | 无 | ❌ 仍为缺口。唯一候选(龙的传人)因假赛禁用+不可计算 |
| 🟢 **开团** | 绝食流(B)、宁王(B) | ⚠️ 间接覆盖 |
| 🟡 **保KDA/怂** | 4396(B-自嘲) | ⚠️ 仅覆盖伤害低面，非真·保KDA |

---

## 10. 变更摘要

| 变更类型 | 数量 | 明细 |
|:-------:|:---:|------|
| **A 级新晋升** | 1 | 厂长（primary，代码级复核通过 + 规则修正） |
| **A→B 降级** | 1 | 雷达哥（语义代理强度不足：vision_score 为中代理，deaths 为弱代理） |
| **B 级新确认** | 4 | 宁王、我就是天、绝食流、野王褒义面（全部通过代码级复核） |
| **规则修正** | 2 | 厂长（取消 kp 上限 + 新增 dmg > P25 必要条件）；我就是天（新增 dominance_check + win_rate + 删除空反证 + sample 提升） |
| **冲突组建立** | 4 | JG-A(刷野-参团)、JG-B(厂长/4396 二元)、JG-C(进攻型打野)、JG-D(控图共存) |
| **冲突组移除淘汰成员** | 1 | CG-01（五逆袭叙事）：移除 翻山/骑士归来/北伐，保留不破不立+涅槃 |
| **贬义侧移除** | 1 | 野王贬义侧（与奇迹行者/正方形打野区间冲突，语义已被覆盖） |
| **产品折中声明** | 1 | 奇迹行者 primary = 产品折中（evidence high_conf + teasing + lpl_viewer，非理想 A 级） |
| **风险边界裁决** | 1 | CJB(D) vs 4396/2200(B)：人格否定 vs 行为描述 |
| **打野位最终总计** | **9 项（2A+7B）** | 较 Round 3（3 项）+200%；较 Round 4 推荐（9 项）重组为 2A+7B |

---

## 11. 下一轮建议

1. 🔴 **抢龙行为覆盖**：设计原创安全替代方案（"龙团猎手""屠龙勇士"或轻量化已有弹幕梗），填补打野位最大行为缺口。
2. 🟡 **gank 专用梗追踪**：当前 gank 行为由 3 个综合型 B 级称号间接覆盖，缺少专用 A 级 gank 梗。关注 LPL 新生代打野（milkyway 等）是否产生相关梗。
3. 🟡 **事件级数据扩展**：若未来可从 LCU match detail 提取 doubleKills/tripleKills 等字段（M1 §6.1 可行性已确认），可重新评估 C 级名场面梗（天雷/地火/湮灭）的产品可行性。
4. 🟢 **厂长/4396 二元组产品文案设计**：需要在产品层明确"厂长"和"4396"作为一体两面的展示策略——包括动画过渡、自嘲开关的触发提示、以及"你的野区我养猪"状态文案的配套设计。
5. 🟢 **打野位正面 primary 补足**：当前仅厂长 1 个正面 A 级 primary。达到 ≥2 正面后可触发奇迹行者的 sunset 条件（降为 B）。候选方向：若"龙的传人"未来找到安全替代方案（如原创"龙团猎手"）且数据条件成熟，可作为第二正面 primary。

---

*编制日期：2026-07-24*
*输入材料：round-04-data-field-audit.md + round-04-schema-conflicts.md + round-04-jungle-memes.md + round-03-audit-gaps.md*
*代码复核基准：main.rs CsvMatch (L71-93) + LCU 接口调用链 (L232-491)*
*冲突组：4 个新增 + 1 个修订 (CG-01)*
*裁决：3 项（雷达哥降级 / CJB vs 4396/2200 边界 / 奇迹行者折中声明）*
