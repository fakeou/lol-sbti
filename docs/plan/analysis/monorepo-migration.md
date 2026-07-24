# Monorepo 迁移分析

## 1. 模块拆分

| 模块 | 输入 | 输出 | 依赖 | 首个可验证交付 |
|---|---|---|---|---|
| `contracts` | 产品契约 | JSON Schema、TS 类型 | 无 | fixtures 通过 schema 测试 |
| `domain` | 脱敏 matches | 聚合指标、类型和证据 | contracts | 固定 fixture 得到稳定结果 |
| `lcu-client` | 本地 LCU | 内存中的原始对局 | reqwest/windows | 当前客户端集成测试 |
| `match-sanitizer` | LCU 数据 | `CreateAnalysisRequestV1` | contracts schema/codegen | 禁止字段泄露测试 |
| `desktop` | 用户操作 | 上传请求和状态 UI | Rust crates、api-client | 本地预览到创建任务 |
| `api` | HTTPS 请求 | 任务/分享 session | contracts、PostgreSQL | API contract 集成测试 |
| `worker` | queued job | validated report | domain、provider adapter | fixture → fake provider → DB result |
| `web` | share session | 响应式报告页 | contracts、API/DB boundary | 兑换链接到页面展示 |
| `infra` | 配置 | 本地/生产运行环境 | PostgreSQL | compose healthcheck + migration |

## 2. 集成链路枚举

每一条都需要真实边界集成测试，不能只保留 mock：

1. `LeagueClientUx.exe → lcu-client`：发现当前已登录实例并只读请求。
2. `lcu-client → match-sanitizer`：原始字段转成脱敏 V1 DTO。
3. `match-sanitizer → contracts`：Rust 输出通过共享 JSON Schema。
4. `desktop → api-client → API`：用户确认后创建幂等任务。
5. `API → PostgreSQL`：任务和加密输入原子写入。
6. `API → queue/job table → worker`：带租约 claim，崩溃可恢复。
7. `worker → domain`：确定性指标、类型、evidence。
8. `worker → LLM provider`：严格结构化输出、超时/重试。
9. `worker → validator → PostgreSQL`：事务保存报告和 ShareGrant。
10. `desktop → API status`：轮询、重启恢复、失败重试。
11. `desktop → OS browser`：打开临时 fragment URL。
12. `web → share-session API`：secret 兑换 HttpOnly cookie。
13. `web → report API`：有效 session 展示；过期/撤销拒绝。
14. `retention job → DB/backups`：输入与结果按策略删除。

## 3. 推荐交付阶段

### Phase 0：产品契约（必须先完成）

- 定义 LBTI 全称、类型、维度、支持模式和免责声明。
- 定义最小样本量与混合模式/位置的归一化方式。
- 决定模型供应商、地区、zero-retention 能力和预算。
- 确认输入、结果、链接、日志、备份保留期。

### Phase 1：monorepo 骨架与本地算法

- 建立 pnpm/Turbo/Cargo workspaces。
- 迁移现有桌面端，确保 LCU 连接不回归；删除 CSV 输出，收敛为上传分析流程。
- 建立 contracts、fixtures 和 sanitizer。
- 用确定性算法生成本地报告，先验证产品是否有解释价值。

### Phase 2：服务端异步闭环

- PostgreSQL migrations、安装凭据、API、job lease。
- desktop 上传与状态恢复。
- worker provider adapter、结构化输出和重试。
- 暂时在桌面端展示结果，先验证任务可靠性。

### Phase 3：临时 Web 报告

- ShareGrant、fragment exchange、HttpOnly session。
- 响应式报告 UI及过期/撤销/删除流程。
- 完整 CSP、no-referrer、no-store，无第三方资源。

### Phase 4：生产化

- 配额、预算熔断、可观测性、自动更新。
- 数据清理、备份过期和安全测试。
- API schema 兼容与旧客户端升级策略。

## 4. 任务拆分建议

| 顺序 | 任务 | 依赖 |
|---|---|---|
| 1 | `product-001` 冻结 LBTI 与隐私契约 | 无 |
| 2 | `repo-001` 创建 workspace 骨架和统一命令 | product-001 |
| 3 | `contracts-001` V1 schema + fixtures + codegen | repo-001 |
| 4 | `desktop-001` 迁移现有 Tauri，不改行为 | repo-001 |
| 5 | `lcu-001` 抽离 lcu-client/sanitizer | contracts-001, desktop-001 |
| 6 | `domain-001` 确定性指标与类型算法 | contracts-001 |
| 7 | `infra-001` PostgreSQL schema 与本地环境 | contracts-001 |
| 8 | `api-001` 安装注册、创建/查询任务 | infra-001 |
| 9 | `worker-001` job lease + provider + validation | domain-001, infra-001 |
| 10 | `integration-001` desktop → API → worker 闭环 | lcu-001, api-001, worker-001 |
| 11 | `share-001` ShareGrant/session 安全边界 | api-001 |
| 12 | `web-001` 报告页与状态页面 | share-001 |
| 13 | `e2e-001` 本地 LCU 到临时网页完整验证 | integration-001, web-001 |
| 14 | `ops-001` 保留清理、限流、预算、监控 | e2e-001 |

## 5. 迁移风险

- 当前工作区有“最近 100 场”未提交改动；迁移前应先决定提交或回退，避免架构迁移混入行为变更。
- 国服 LCU 已实测深分页可能只返回 50 条不重复记录；协议必须支持动态样本量，UI 显示实际数量。
- 不应一次性移动全部目录并同时改写业务。先创建 workspace，再做无行为变化的移动，随后逐模块抽离。
- Rust/TypeScript 契约不能手工维护两份；必须选 JSON Schema 生成或契约一致性测试。
- 如果产品类型定义不稳定，服务端 schema、算法、prompt 和 UI 都会反复返工，因此 Phase 0 是硬门槛。
