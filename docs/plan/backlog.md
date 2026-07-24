# Backlog

## 产品决策

- 明确 “LBTI” 的全称、类型代码、维度和娱乐性定位。
- 决定支持排位/匹配/大乱斗中的哪些模式，是否分模式分析。
- 定义最小样本量、置信度和样本不足的 UI。
- 确认临时链接默认有效期（建议 30 分钟）和报告保留期（建议 24 小时）。
- 决定是否允许用户选择上传显示名、保存本地 PDF或重新生成链接。

## 技术决策

- 确认 LLM provider、模型、部署地区、zero-retention 与预算。
- 确认 API/worker 使用 Fastify + TypeScript，或改用统一 Rust 服务端。
- 确认 MVP 使用 PostgreSQL job table，达到何种吞吐后切换 Redis/BullMQ。
- 选择 Rust/TypeScript contracts 的 JSON Schema codegen 工具链。
- 选择生产部署平台、KMS/secret manager 和备份删除能力。

## 后续增强

- SSE 推送任务进度。
- 桌面端自动更新和 API 最低版本策略。
- 多语言报告。
- 用户账号与历史报告（不属于 MVP，需重新做隐私设计）。
