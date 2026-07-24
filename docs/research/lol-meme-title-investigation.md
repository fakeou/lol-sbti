# LPL 中文圈 LOL 梗称号体系 — 结构化调查报告

> **状态**：终审 PASS — R1–R10 全链路闭合
> **编制日期**：2026-07-24
> **审查轮次**：共 10 轮（R1–R9 探索与裁决 + R10 发布包与闭合审计）
> **终审结论**：Verifier PASS（见 [round-10-verifier-pass.md](./round-10-verifier-pass.md)）；[round-10-closure-audit.md](./round-10-closure-audit.md) 为闭合边界审计
> **关联文档**：本报告为 [研究计划](./lol-meme-title-research-plan.md) 的最终产出，同时关联 [分级梗库草案](./lol-meme-title-catalog.md)、[可计算字段规范](./lol-meme-title-schema.md)、[产品交接说明](./lol-meme-title-handoff.md)

---

## 1. 执行摘要

**核心问题**：如何从十余年 LPL 中文圈赛事、直播、解说与社区文化中，筛选出有传播力且能可靠映射玩家对局行为的 LOL 原生梗称号？

**调查规模**：审查 **107 项候选**，产出 **21 个产品卡**（20 个称号 + 1 个状态文案）。

**最终成果**：

| 分组 | 数量 | 含义 | v1 上线决策 |
|:-----|:----:|------|:----------|
| 🟢 默认开启 | **5** | 安全、传播力强、字段可算、无需自嘲开关 | 全员默认可见（3 项 origin ⚠️ 需灰度） |
| 🟡 需自嘲开关 | **7** | 含调侃/人身攻击历史/伦理审查前置 | 用户主动开启后解锁 |
| 🔵 仅状态 | **1** | post-game 一次性状态文案 | 直接上线 |
| 🟠 证据待补 | **3** | 语义优秀但证据链或代理精度有缺口 | v1 暂不触发，v1.1 补证后评估 |
| ⬛ 绝不展示 | **17** | 安全禁用/语义淘汰/数据门槛淘汰 | 任何版本均不触发 |

> **v1 可直接上线的 12 项**：5 默认 + 6 自嘲（红温排外，需伦理审查前置） + 1 仅状态 = **12 项可安全上线**。

**关键事实**：打野位 A 级正面 primary = **0**——这是中文 LOL 梗生态的自然反映，不接受凑数方案。

---

## 2. 当前状态量化

### 2.1 最终发布包位置分布

R1–R10 共形成 21 个研究产品卡；其中 16 项进入 R10 最终发布包（含 1 个状态文案）。下表仅统计这 16 项，其他研究卡保留在观察池或淘汰台账中：

| 位置 | 默认开启 | 自嘲开关 | 仅状态 | 证据待补 | 合计 |
|:---:|:------|:------|:-----:|:------|:----:|
| **Top 上单** | 369骰子, 世一上 | 纳尔圣经 | — | — | 3 |
| **Jungle 打野** | 绝食流 | 4396 | — | 奇迹行者, 雷达哥 | 4 |
| **Mid 中单** | — | 虎大将军, 2200 | — | 左手 | 3 |
| **Bottom ADC** | — | 暴毙AD | — | — | 1 |
| **Support 辅助** | 护国神牛 | 疯牛病 | — | — | 2 |
| **Any 跨位置** | 天神下凡 | 红温(伦理审查) | YYDS | — | 3 |

来源：[round-10-release-pack-v2.md](./round-10-release-pack-v2.md) §0.3、[round-10-closure-audit.md](./round-10-closure-audit.md) §6.3

### 2.2 三层分级体系

| 层级 | 数量 | 定义 | 准入标准 |
|:----|:----:|------|:--------|
| **核心层（Core）** | 7 | 不需要知道"谁"就能理解——梗本身即为行为描述 | 三道门-门1：原生行为语义 |
| **实验层（Experimental）** | 13 | 起源于选手/主播，但字面中含可独立理解的锚点 | 三道门-门2：独立语义锚点存在 |
| **状态层（Status-only）** | 1 | 一次性 post-game 文案，不进入称号系统 | 仅作单局反馈 |

来源：[round-09-tier-reconciliation.md](./round-09-tier-reconciliation.md) §7

### 2.3 淘汰项统计

三种淘汰类型共处理 **17 项**：

| 淘汰类型 | 数量 | 触发条件 | 可恢复性 | 示例 |
|:--------|:----:|:--------|:------:|:-----|
| 🔴 安全禁用 | 11 | L1 安全红线：外貌/人格/国籍/种族攻击 | ❌ 不可恢复 | 马头、CJB、精忠报国 |
| 🟠 语义淘汰 | 4 | 三道门-门2失败：脱离选手后零语义残余 | ❌ 不可恢复 | 厂长、灯皇、接Q辣舞 |
| 🟡 数据门槛淘汰 | 2 | L2 字段不可获取 | ✅ 可恢复 | 翻山、永不团灭 |

来源：[round-09-tier-reconciliation.md](./round-09-tier-reconciliation.md) §2、[round-10-closure-audit.md](./round-10-closure-audit.md) §3

### 2.4 证据强度分布

对全部 21 个产品卡运用四类验证强度标签标注（来自 [round-10-closure-audit.md](./round-10-closure-audit.md) §0.2）：

| 验证强度 | 数量 | 占比 | 含义 |
|:------|:----:|:----:|------|
| 🟢 Verified | **8** | 38% | origin ✅ + meaning ✅，可通过 WebFetch 或人工定位到 P0/P1 原创来源 |
| 🟡 Community Consensus | **8** | 38% | origin ⚠️/❌，但 meaning ✅ 经多源交叉验证 |
| 🟠 Weak Evidence | **4** | 19% | origin ❌ + meaning ⚠️，依赖单一来源或仅存口述记忆 |
| 🔴 Unverifiable | **1** | 5% | origin ❌ + meaning ❌ 或全部来源不可访问（拉扯圣经） |

**v1 可上线的 12 项中**：6 项 🟢 Verified（50%），6 项 🟡 Community Consensus（50%），0 项 🟠 Weak Evidence，0 项 🔴 Unverifiable。

---

## 3. 核心认知纠正

本项目全程纠正了若干对 LPL 梗的常见误解。以下按用户点名梗逐一说明。

### 3.1 左手 / 右手

> **常见误解**："左手"和"右手"是对称的一对梗，地位相当。

**实际结论**（R4→R7→R8→R9→R10 五轮一致）：

| 维度 | 左手 | 右手 |
|:-----|:-----|:-----|
| **裁决** | 实验层 A primary | 🔴 语义淘汰 |
| **独立梗基础** | ✅ 左撇子（生理特征，LOL 官方"Golden Left Hand" P1 来源） | ❌ 仅为"左手"的镜像衍生 |
| **认知度** | 高（>75%） | 低（<60%） |
| **语义锚点** | 生理锚点——客观上可观察的特征 | 无独立起源，纯镜像 |

**分界线**：左手有独立生理锚点（左撇子）+ 官方 P1 来源；右手无独立起源，纯镜像衍生，认知度不足。右手保留为左手的 aliases 引用。

> **纠正**：左手 ≠ 右手。"左手"是唯一的生理特征锚点梗，在人物外号中独树一帜。

来源：[round-10-closure-audit.md](./round-10-closure-audit.md) §4.1、[round-09-tier-reconciliation.md](./round-09-tier-reconciliation.md) §7.2

### 3.2 马头 / 及时雨 / 宋江

> **常见误解**："这些只是社区调侃，风险不大。"

**实际结论**（R1 安全禁用，全程未翻转）：

- **马头**：H1 外貌攻击 + IG 俱乐部正式投诉 + LPL 官方警告 —— 三重理由充分
- **及时雨 / 宋江**：姓名谐音人身攻击 + EDG 道歉案例 —— LPL 语境已固化为黑称体系
- **裁决**：🔴 安全禁用，不可恢复。防火墙完整。

> **纠正**：这不是"社区调侃"——是有公记录的官方警告级黑称。产品不应触碰。

来源：[round-10-closure-audit.md](./round-10-closure-audit.md) §4.2、§1.5

### 3.3 奇迹行者

> **常见误解**："奇迹行者是最强打野梗，应该主推。"

**实际结论**（R4→R8→R9→R10）：

- **层级**：核心层（语义直接描述游戏行为——打野只刷不参团）
- **产品级**：B sub_tag（P0 缺失制约）
- **证据**：🟡 Partial Origin —— P3 三源交叉验证但 P0 原始直播录像未定位
- **v1 状态**：证据待补 🟠。补证路径：人工定位姿态直播回放中"奇迹行者"名场面的具体时间戳
- **最优先人工补证目标**——这是 R1–R9 全程唯一的核心层 highest priority 但证据欠完整的案例

> **纠正**：核心层资格无争议（语义自明），但 P0 缺失使其产品级封顶 B sub_tag。在人工补证完成前 v1 暂不触发。P0 补证失败？接受 P3 为最高证据等级，产品级永久 B。

来源：[round-10-closure-audit.md](./round-10-closure-audit.md) §4.3、[round-09-tier-reconciliation.md](./round-09-tier-reconciliation.md) §4

### 3.4 369骰子

> **常见误解**："369 是选手 ID 绑定，新玩家看不懂。"

**实际结论**（R4→R8→R9→R10）：

- **层级**：实验层 A primary
- **独立语义**：「骰子」= 不确定性（通识概念）——任何人看到"369骰子"都能理解"上下限差距大"
- **origin**：🟢 Verified（P0+P1，369 比赛录像可定位）
- **风险**：⚠️ "369"数字绑定选手 ID。不了解 369 的玩家无法从数字理解来源

> **纠正**："369"数字绑定是弱项，但"骰子"独立语义补足。"369骰子"是实验层中 origin 最强 + 语义最自洽的组合。A primary 维持。

来源：[round-10-closure-audit.md](./round-10-closure-audit.md) §4.4

### 3.5 天神下凡

> **常见误解**：无——这是全程唯一从头到尾无争议的旗舰级产品卡。

**实际结论**（R1→R9→R10 全程一致）：

- **层级**：核心层 A primary
- **origin**：🟢 Verified —— P0 S8 半决赛 IG vs G2 第2场 VOD + P1 LOL 官方认证 + P2 搜狐同期报道——三项独立来源交叉验证
- **语义**：「天神下凡」= 团战 1v4 carry —— 完全自明，零选手知识依赖
- **反讽风险**：SF5=10 —— 社区使用 >90% 正面
- **认知度**：>90%

> **确认**：天神下凡是全程唯一从 R1 到 R9 从未被质疑、从未被降级、从未有来源争议的旗舰。核心层第一优先。

来源：[round-10-closure-audit.md](./round-10-closure-audit.md) §4.5、[round-09-tier-reconciliation.md](./round-09-tier-reconciliation.md) §7.1

### 3.6 暴毙AD

> **常见误解**："暴毙AD 和 红温 一样需要自嘲开关保护，甚至更危险。"

**实际结论**（R8 补位→R9 调和→R10 v2）：

- **层级**：实验层 **A primary**（R9 调和裁决维持——L1–L3 全绿 + L5 高认知度）
- **origin**：🟠 Community Consensus —— 无 P0 首创时刻，wiki 404。但语义完全自明（"暴毙"+"AD"字面自明，任何 LOL 玩家均可理解）
- **自嘲开关**：**必须**（R9 调和从"否"调整为"建议开启"，R10 v2 升级为必须）
- **安全分级**：A 🟡（轻微调侃性，非人格攻击）

> **纠正**：暴毙AD 的语义自明度极高（远高于红温），origin ❌ 被语义强度抵消。R9 维持 A primary 是合理的——这不是"危险梗"，是"调侃梗"。

来源：[round-10-release-pack-v2.md](./round-10-release-pack-v2.md) §1.2、§3.2

### 3.7 红温

> **常见误解**："红温已经泛化为通用词，没问题。"

**实际结论**（R8 补位→R9 调和→R10 v2）：

- **层级**：实验层 B sub_tag
- **origin**：🟠 Community Consensus —— ❌ tool_unavailable（Uzi 直播名场面无法通过 WebFetch 定位），但社区共识极强
- **前置条件**：🔴 **ETHICS_REVIEW_REQUIRED**（GAP-D2，R3 审计标记）
- **审查维度**：将"源于嘲讽特定选手心态"的梗系统化授予普通玩家，是否构成对原选手的二次伤害？普通玩家收到后是否产生被冒犯感？
- **v1 状态**：审查通过前**不发布**

> **纠正**：红温不是"安全的通用词"。它源于对 Uzi 的嘲讽，将其系统化授予普通玩家需要独立伦理审查。这不是"技术问题"，是"伦理问题"。

来源：[round-10-release-pack-v2.md](./round-10-release-pack-v2.md) §1.1、§3.1、[round-09-tier-reconciliation.md](./round-09-tier-reconciliation.md) §5.3

### 3.8 厂长 — 为什么淘汰

> **常见误解**："厂长是 LPL 最有名的打野梗，为什么不保留？"

**实际结论**（R4–R7 A primary → R8 移除 trigger）：

| 维度 | 厂长 | 雷达哥（对比） |
|:-----|:-----|:-----|
| **字面语义** | "工厂管理者"→ 与打野无关 | "雷达"→ 探测/预知（通识概念） |
| **脱离选手后** | 零语义残余（SF4=3） | "雷达"独立语义存在 |
| **理解链** | 需要两跳 LPL 知识 | 不需要 LPL 知识 |

> **纠正**：分界线在于字面词汇是否携带独立语义。"厂长"不携带（工厂管理者 ≠ 打野）；"雷达"携带（探测装置 → 预判能力）。保留为 aliases 彩蛋，但不作为称号触发。

来源：[round-10-closure-audit.md](./round-10-closure-audit.md) §3.3、[round-09-tier-reconciliation.md](./round-09-tier-reconciliation.md) §7.4

---

## 4. 候选对比

### 4.1 旗舰称号对比（A 级 primary）

| 称号 | 位置 | 层级 | 安全 | 自嘲 | 证据 | SF4 选手剥离度 | 核心优势 | 关键风险 |
|:-----|:---:|:----:|:---:|:---:|:----:|:------------:|:--------|:--------|
| **天神下凡** | Any | 核心 | A 🟢 | 否 | 🟢 Verified | 10 | 最强来源 + 完全自明 | 无 |
| **369骰子** | Top | 实验 | A 🟢 | 否 | 🟢 Verified | 7 | origin ✅ + 骰子独立语义 | 369 数字绑定 |
| **暴毙AD** | Bottom | 实验 | A 🟡 | 必须 | 🟠 Community | 6 | 语义自明度极高 | origin ❌ wiki 404 |
| **左手** | Mid | 实验 | A 🟢 | 否 | 🟢 Verified | 5 | 生理锚点独特性 | 映射需社区知识 |

### 4.2 高传播力称号对比（B 级）

| 称号 | 位置 | 产品级 | 自嘲 | 证据 | 传播力抓手 | 核心制约 |
|:-----|:---:|:------:|:---:|:----:|:--------|:--------|
| **4396** | Jungle | B primary | 必须 | 🟢 Verified | 数字梗易记 + Clearlove 知名度 | 人身攻击历史 |
| **2200** | Mid | B sub_tag | 必须 | 🟢 Verified | 数字嘲讽梗 + 绝对阈值 | 对 Xiaohu 的人身攻击 |
| **虎大将军** | Mid | B primary | 必须 | 🟢 Verified | 米勒解说名句 + 官方梗百科 | SF5=3 反讽风险 >60% |
| **世一上** | Top | B sub_tag | 否 | 🟡 Partial | "世界第一"完全自明 | SF5=5 反讽风险 ~40-50% |
| **红温** | Any | B sub_tag | 必须 | 🟠 Community | 已泛化中文通用词 | ETHICS_REVIEW_REQUIRED |
| **护国神牛** | Support | B sub_tag | 否 | 🟡 Partial | 辅助位最佳原生梗 | origin ⚠️ P3 only |
| **疯牛病** | Support | B sub_tag | 必须 | 🟡 Partial | 英雄行为梗自明 | 疾病隐喻 T2 冒犯率 |

### 4.3 证据待补 vs 绝不展示

| 分类 | 称号 | 缺什么 | 补证路径 |
|:----|:-----|:-----|:--------|
| 🟠 证据待补 | **奇迹行者** | P0 直播时间戳 | 人工定位姿态直播回放 |
| 🟠 证据待补 | **雷达哥** | L2 事件级数据 | LCU timeline 反蹲事件 |
| 🟠 证据待补 | **左手** | 用户理解度验证 | Phase 3 用户验证 |
| ⬛ 语义淘汰 | 厂长/灯皇/接Q辣舞/右手 | 字面无游戏语义 | 不恢复。aliases 彩蛋 |
| ⬛ 安全禁用 | 马头/CJB/精忠报国等 11 项 | L1 安全红线 | 永不恢复 |
| ⬛ 数据淘汰 | 翻山/永不团灭 | 字段不可获取 | 获字段后可恢复 |

来源：[round-10-release-pack-v2.md](./round-10-release-pack-v2.md) §5–§6、[round-10-closure-audit.md](./round-10-closure-audit.md) §1.4–§1.6

---

## 5. 来源与风险

### 5.1 来源质量四象限

|  | meaning ✅ | meaning ⚠️ | meaning ❌ |
|:--|:----|:----|:----|
| **origin ✅** | 🟢 Verified: 8 项 | — | — |
| **origin ⚠️** | 🟡 Community Consensus: 12 项 | — | — |
| **origin ❌** | 🟠 Weak Evidence: 4 项 | 🔴 Unverifiable: 1 项 | — |

**关键发现**：

- **证据链最完整**（top 5）：天神下凡、4396、2200、369骰子、虎大将军
- **证据链最薄弱**（bottom 5）：拉扯圣经（🔴 Unverifiable）、装杯、暴毙AD、红温、正方形打野
- **12/21 产品卡的 origin 仅为 ⚠️**，依赖社区共识而非可复现的 P0/P1 来源
- **P0 VOD 精确时间戳普遍缺失**：即使是 🟢 Verified 项，其 P0 也只是"已知存在"而非"已逐秒验证"

来源：[round-10-closure-audit.md](./round-10-closure-audit.md) §2.2、§8

### 5.2 数据可计算性

所有 v1 上线的 12 项均已确认 CsvMatch 字段可用。字段审计来自 [round-04-data-field-audit.md](./round-04-data-field-audit.md)，基于 `apps/desktop/src-tauri/src/main.rs` 中 CsvMatch 结构体逐项验证。

**核心可用字段**：kills、deaths、assists、champion_damage、damage_share_percent、kill_participation_percent、damage_taken、healing、vision_score、wards_placed、cs、champion、position、result、duration_minutes、gold

**不可获取字段**（导致淘汰）：opponent_rank（翻山）、团灭事件数据（永不团灭）、comms 行为数据（限制红温/拉扯圣经/装杯的触发精度）

来源：[round-10-release-pack-v2.md](./round-10-release-pack-v2.md) §7

### 5.3 风险矩阵

| 风险等级 | 条目 | 风险类型 | 缓解措施 |
|:------|:-----|:------|:--------|
| 🔴 高 | **红温** | 伦理/法务：源于嘲讽选手心态 | ETHICS_REVIEW_REQUIRED 硬前置，审查通过前不发布 |
| 🔴 高 | **拉扯圣经** | 证据：origin ❌ + meaning ⚠️，全部来源不可访问 | 人工补证前不触发任何产品逻辑 |
| 🟡 中 | **世一上** | 反讽：SF5=5，~40-50% 社区反讽使用 | P90+ 极严格触发 + 调侃机制 + 灰度验证 |
| 🟡 中 | **虎大将军** | 反讽：SF5=3，>60% 社区反讽使用 | 仅正面触发方向锁定，数据差时不触发任何东西 |
| 🟡 中 | **疯牛病** | 冒犯：疾病隐喻 | 自嘲开关必须 + Phase 3 T2 冒犯率测试（n≥250） |
| 🟡 中 | **暴毙AD** | 调侃性语义在默认可见时的冒犯风险 | R10 v2 从默认移入自嘲开关 |
| 🟡 中 | **绝食流** | "绝食"字面负面 + MLXG 绑定 | 三阶段灰度 + 撤回条件 |
| 🟡 中 | **打野位 A 级 primary = 0** | 产品体验缺口 | 方案 D：天神下凡跨位覆盖 + UI 标注 |
| 🟡 中 | **中单位 v1 无默认开启项** | 中单是 LOL 最热门位置 | v1.1 优先补证左手使其进入默认 |

---

## 6. 算法与产品建议

### 6.1 触发字段映射

所有候选称号的触发条件已完全映射到 CsvMatch 真实可用字段。详细字段-称号映射见 [round-10-release-pack-v2.md](./round-10-release-pack-v2.md) §7。

### 6.2 产品组合机制

基于 [研究计划](./lol-meme-title-research-plan.md) §9 的设计：

| 机制 | 应用 | 示例 |
|:-----|:-----|:-----|
| **主称号（Primary）** | 长期展示在用户主页 | 天神下凡、369骰子、暴毙AD |
| **副标签（Sub-tag）** | 附加在主称号下的补充说明 | 绝食流、护国神牛、世一上 |
| **状态文案（Status）** | 单场 post-game 一次性展示 | YYDS |
| **自嘲开关** | 用户主动开启后解锁 B 级/调侃性称号 | 4396、红温、疯牛病 |
| **调侃机制** | 替代自嘲开关的非贬义表达 | 世一上："自信得像 Bin 哥" |
| **"另一面"互斥** | 同局不可同时触发对立称号 | 护国神牛 ↔ 疯牛病 |

### 6.3 上线路线图

| 阶段 | 范围 | 内容 | 时间线 |
|:----|:-----|:-----|:------|
| **v1 即时上线** | 12 项 | 5 默认（含 3 项灰度） + 6 自嘲 + 1 仅状态。红温排外 | 当前 |
| **v1.1 补证上线** | +3 项 | 奇迹行者、雷达哥、左手补证后上线 | 补证完成后 |
| **v1.x 伦理审查** | ±1 项 | 红温审查结果决定去留 | 审查完成后 |
| **季度审查** | 长期 | 跟踪中文 LOL 新生打野行为梗 | 每季度 |

### 6.4 origin ⚠️ 项灰度策略

三项 origin ⚠️ 默认开启项（绝食流、护国神牛、世一上）需要分阶段灰度上线，每阶段设定明确的监控指标和撤回条件。详细灰度方案见 [round-10-release-pack-v2.md](./round-10-release-pack-v2.md) §2.3–§2.5。

### 6.5 自嘲开关设计原则

- 默认关闭。用户在设置中手动开启「自嘲模式」后解锁。
- 所有 B 级需自嘲项（4396、2200、虎大将军、红温、疯牛病、纳尔圣经）统一由此开关控制。
- 暴毙AD 虽为 A 级 primary，但 R10 v2 将其从默认移入自嘲开关（调侃性语义）。
- **注意**：问卷中"假设你开启了自嘲" ≠ 真实开关体验（[round-06-validation-power.md](./round-06-validation-power.md) §6.1）。真实灰度验证需在 Phase 4 产品内 A/B 测试。

---

## 7. 验证记录

### 7.1 十轮探索链路

| 轮次 | 类型 | 核心产出 | 文档 |
|:----|:-----|:--------|:-----|
| **R1** | Explorer | 初始候选池 + 安全禁用（马头/及时雨/宋江） | 分散于多份 R1–R3 文档 |
| **R2** | Explorer | 赛事/主播/解说多角度补充 + 传播力评估 | [round-02-propagation.md](./round-02-propagation.md), [round-02-support-team.md](./round-02-support-team.md), [round-02-caster-official.md](./round-02-caster-official.md), [round-02-modern-esports.md](./round-02-modern-esports.md) |
| **R3** | Verifier + Explorer | 21 项 GAP 审计 + 安全漏斗 + 证据台账 + 主播调停 | [round-03-audit-gaps.md](./round-03-audit-gaps.md), [round-03-safe-computable-funnel.md](./round-03-safe-computable-funnel.md), [round-03-evidence-ledger.md](./round-03-evidence-ledger.md) |
| **R4** | Explorer | 字段可用性代码级审计 + Schema 冲突 + 打野专项 | [round-04-data-field-audit.md](./round-04-data-field-audit.md), [round-04-schema-conflicts.md](./round-04-schema-conflicts.md), [round-04-jungle-memes.md](./round-04-jungle-memes.md) |
| **R5** | Explorer | 产品卡草案 + 打野冲突调停 + 用户验证计划 | [round-05-product-cards.md](./round-05-product-cards.md), [round-05-jungle-conflict-remediation.md](./round-05-jungle-conflict-remediation.md), [round-05-user-validation-plan.md](./round-05-user-validation-plan.md) |
| **R6** | Explorer | SF 评分体系 + H1–H5 硬淘汰 + 用户验证统计功效 + 产品卡调和 | [round-06-semantic-boundary.md](./round-06-semantic-boundary.md), [round-06-validation-power.md](./round-06-validation-power.md), [round-06-product-card-reconciliation.md](./round-06-product-card-reconciliation.md) |
| **R7** | Explorer | L1–L6 统一决策矩阵 + 23 卡决策 | [round-07-unified-decision-matrix.md](./round-07-unified-decision-matrix.md), [round-07-priority-source-review.md](./round-07-priority-source-review.md) |
| **R8** | Explorer | 原生梗优先四层分类 + 八项裁决 + 剩余来源复核 | [round-08-native-meme-core.md](./round-08-native-meme-core.md), [round-08-remaining-source-review.md](./round-08-remaining-source-review.md) |
| **R9** | Explorer | L1–L6 六项调和最终分层 v2 + 打野位 A 级 primary 终极搜索 | [round-09-tier-reconciliation.md](./round-09-tier-reconciliation.md), [round-09-release-pack.md](./round-09-release-pack.md), [round-09-jungle-final-search.md](./round-09-jungle-final-search.md) |
| **R10** | Explorer + Verifier | 发布包 v2（修正 4 处 R9 v1 冲突）+ 闭合边界审计 + 独立终审 PASS | [round-10-release-pack-v2.md](./round-10-release-pack-v2.md), [round-10-closure-audit.md](./round-10-closure-audit.md), [round-10-verifier-pass.md](./round-10-verifier-pass.md) |

### 7.2 R3 审计 GAP 全部关闭

R3 出具的 21 项 GAP（7 🔴 + 12 🟡 + 2 🟢）在 R10 Closure Audit 中逐项确认处理状态：**18 项已完全处理，2 项因相关条目不在当前产品池中无需进一步行动，1 项通过字段确认解决。无遗留 GAP 阻塞 v1 发布。**

来源：[round-10-closure-audit.md](./round-10-closure-audit.md) §7.2

### 7.3 裁决翻转全程可追溯

R1→R9 全程 6 次裁决翻转均方向为更保守/更严格：

| 条目 | 原裁决（轮次） | 修正裁决（轮次） | 修正理由 |
|:-----|:------|:------|:-----|
| 厂长 | A primary (R4–R7) | 🔴 移除 trigger (R8) | 字面无游戏语义 |
| 灯皇 | A primary (R4–R7) | 🔴 移除 trigger (R8) | "灯"=Light ID 翻译 |
| 接Q辣舞 | R7 B sub_tag（错误回滚） | 🔴 移除 trigger (R8) | R6 原判恢复 |
| 纳尔圣经 | B primary (R8) | B sub_tag (R9) | L2 可计算性降级 |
| 拉扯圣经 | B primary (R8) | B sub_tag + 🔵 Unverifiable (R9) | L4 来源极弱 |
| 红温/世一上/绝食流 | 08-source 建议 Primary | 维持 sub_tag (R9) | L1–L6 调和驳回 |

**无一例在后期放宽标准。** 来源：[round-10-closure-audit.md](./round-10-closure-audit.md) §7.1

### 7.4 终审声明

> **R10 终审结论**：R1–R9 全链路裁决链已经闭合。107 项候选 → 21 项研究产品卡，其中 16 项进入最终发布包。多项结论的验证基础为社区共识而非可复现的原始源，因此必须保留证据徽标和补证状态。独立 Verifier 在第 10 轮给出 **PASS**，详见 [round-10-verifier-pass.md](./round-10-verifier-pass.md)。

来源：[round-10-closure-audit.md](./round-10-closure-audit.md) §9

---

## 8. 优先路线

### 8.1 v1 上线前（必须完成）

| 优先级 | 行动项 | 阻塞项 | 负责方 |
|:----:|:--------|:-----|:-----|
| 🥇 P0 | **红温 ETHICS_REVIEW** | 🔴 阻塞红温 v1 发布 | 法务团队 |
| 🥇 P0 | **拉扯圣经人工补证**（定位 TES 麦克疯 + 提取原文） | 🔴 阻塞拉扯圣经 v1 入选 | 产品团队/人工 |
| 🥇 P0 | **origin ⚠️ 三项灰度上线**（绝食流/护国神牛/世一上各三阶段灰度） | 🟡 不阻塞但需灰度 | 产品/运营 |

### 8.2 v1.1 补证（中优先级）

| 优先级 | 行动项 | 负责方 |
|:----:|:--------|:-----|
| 🥈 P1 | **奇迹行者 P0 直播时间戳人工定位** | 产品团队/人工 |
| 🥈 P1 | **Phase 3 用户验证：实验层独立语义锚点假设**（左手/雷达哥/世一上/绝食流/暴毙AD） | 用户研究 |
| 🥈 P1 | **疯牛病 T2 冒犯率测试**（n≥250） | 用户研究 |
| 🥈 P1 | **雷达哥 L2 事件级数据补证**（LCU timeline 反蹲事件） | 技术团队 |

### 8.3 长期（持续）

| 优先级 | 行动项 | 负责方 |
|:----:|:--------|:-----|
| 🥉 P2 | **P0 VOD 精确时间戳补充**（天神下凡/4396/2200/虎大将军） | 产品团队 |
| 🥉 P2 | **季度审查：中文 LOL 新生打野行为梗** | 产品团队 |
| 🥉 P2 | **自嘲开关产品内灰度 A/B 测试**（Phase 4） | 产品/技术 |
| 🥉 P2 | **bilibili wiki 验证页面本地缓存**（防拦截） | 运维 |

---

## 9. 盲点与局限

### 9.1 结构性盲点（无法通过进一步搜索解决）

| # | 盲点 | 性质 | 影响 | 缓解 |
|:--:|:-----|:----:|:-----|:-----|
| B1 | **打野位候选池自然枯竭** — 中文 LOL 圈不存在可泛化的打野位正面 A 级原生行为梗 | 🔴 结构性 | 打野位永远不会有 A 级正面 primary | 方案 D：天神下凡跨位覆盖 + UI 标注 + 季度审查 |
| B2 | **大量中文站点对自动化抓取不开放** — 百度百科/萌娘百科/知乎/百度贴吧全量拦截 | 🔴 基础设施 | 所有 P3 来源验证依赖 bilibili wiki 为唯一可靠的可自动抓取源 | 与运维协商白名单；本地缓存 |
| B3 | **P0 比赛录像的人头/眼观验证无法自动化** — VOD 存在但精确时间戳需人工逐秒定位 | 🔴 系统性 | 23/38 条目的 P0 仅为"已知存在"而非"已逐秒验证" | 接受"VOD 可定位但未精确时间戳"为 P0 工程等效状态 |
| B4 | **comms 行为数据（ping/打字/语音）不可获取** — 红温/拉扯圣经/装杯的精准触发均依赖 comms | 🟡 技术 | 这些称号的触发精度永远有限 | 接受精度上限，用 post-game 一次性反馈替代实时触发 |
| B5 | **选手 ID 绑定无法在产品中完全消解** — 369、左手、虎大将军、雷达哥、世一上、绝食流均含选手绑定痕迹 | 🟡 语义 | 部分玩家仍会联想到选手 | 在文案中去选手化表达 |

### 9.2 当前未知项

| # | 未知项 | 影响 | 解决方式 |
|:--:|:------|:----:|:--------|
| U1 | 拉扯圣经的完整原文文本 | 🔴 高 — 社区仅凭口述记忆传播 | 人工定位 TES 麦克疯 |
| U2 | 红温的伦理审查结果 | 🔴 高 — 审查是否通过、通过后产品级影响 | 法务团队审查 |
| U3 | 实验层称号的用户理解度（左手/虎大将军/雷达哥/世一上/绝食流） | 🟡 中 | Phase 3 用户验证 |
| U4 | 新生代打野梗的产生 | 🟡 中 | 季度审查 |

### 9.3 不为位置平衡而造梗

这是本项目的**红线声明**：

> **不接受任何形式的"为了位置平衡而制造或降级采纳普通词/通用比喻/原创描述短语"的行为。**
>
> 包括但不限于：将"野王""节奏发动机""控龙高手"作为产品称号；原创"野区统帅""节奏大师""龙族猎手"等非梗称号填补空缺。
>
> **理由**：
> 1. 产品定位是"LOL 社区梗称号系统"，不是"LOL 行为描述系统"
> 2. 发布伪梗（普通词披上梗的外衣）比空缺更损害产品信任
> 3. 空缺本身就是诚实——告诉用户"打野位的 LPL 梗确实偏负面/偏人物绑定，我们不会用假梗骗你"

来源：[round-10-closure-audit.md](./round-10-closure-audit.md) §6

---

## 10. 最后声明

### 10.1 什么是确定的

1. **核心层 7 项** — 原生行为梗的分类逻辑自洽。梗的语义直接来源于游戏行为描述，不需要任何选手知识。
2. **实验层 13 项** — 独立语义锚点成立。字面中包含可独立理解的语义成分。
3. **禁用层 4 项** — 语义淘汰不可恢复。不做去梗化替代。
4. **安全禁用 11 项** — L1 红线清晰。防火墙完整。
5. **数据门槛淘汰 2 项** — 可恢复——如果未来获得所需字段。
6. **v1 发布包 12 项** — 所有触发条件已对应到真实 CsvMatch 字段。
7. **打野位 A 级正面 primary = 0** — 不是筛选遗漏，是中文 LOL 梗生态的自然结果。

### 10.2 什么是有限的

1. **大量 origin 仅 ⚠️** — 12/21 产品卡的起源无法通过可访问的 P0/P1 来源验证，依赖社区共识。这不影响语义（meaning ✅），但影响"起源故事"的叙事准确性。
2. **P0 VOD 精确时间戳普遍缺失** — Closure 接受"已知存在但未逐秒验证"为工程等效状态。
3. **WebFetch 工具限制** — 百度百科/萌娘百科/知乎的拦截是结构性障碍。
4. **comms 行为数据不可获取** — 部分称号的触发精度永远有限。

### 10.3 什么是不会做的

> **不为位置平衡而造梗。不接受任何形式的去梗化替代。不接受降低"梗"的定义门槛来扩展候选池。**
>
> 当前 21 项产品卡是中文 LOL 梗生态在被严格审视后的真实映射——有的位置梗多、有的位置梗少，这不是 bug。诚实面对不等于放弃产品体验——空缺可以标注"即将上线"，比发布伪梗更能维持用户信任。

---

*本报告综合 R1–R10 全部探索与裁决轮次，基于 [round-10-release-pack-v2.md](./round-10-release-pack-v2.md) 和 [round-10-closure-audit.md](./round-10-closure-audit.md) 的终审结论编制。*
*终审状态：**PASS*** — R1–R10 全链路闭合，无遗留阻塞项。
