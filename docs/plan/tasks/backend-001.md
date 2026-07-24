---
id: backend-001
scope: api-worker
status: ready
depends-on: [contracts-001]
---

# objective

实现可运行的 Fastify API、PostgreSQL repository/migrations、数据库任务队列租约和独立 Worker。Worker 从 `ANALYSIS_SKILL_PATH` 加载一份 skill，通过可注入 provider 调用结构化模型；提供安全的 deterministic/fake provider 仅用于测试和本地开发。实现安装凭据、幂等创建、receipt 状态查询、有限重试、ShareGrant 创建和保留期清理。不得硬编码或记录任何 provider key。

# context

- `docs/architecture/README.md`
- `docs/architecture/api-and-jobs.md`
- `docs/architecture/security-and-privacy.md`
- `docs/plan/tasks/contracts-001.md`

# path

- `apps/api/`
- `apps/worker/`
- `packages/api-client/`
- `packages/persistence/`
- `infra/migrations/`
- `infra/docker/`
- `.env.example`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `turbo.json`
- `docs/plan/tasks/backend-001.md`

不得触碰研究文件。

# verification

- API 路由使用严格 schema，body/限流/凭据/幂等边界有测试。
- 凭据和 share secret 只存带 server pepper 的哈希；日志测试证明不会泄露 header/body/secret。
- PostgreSQL migration 包含 installations、analyses、analysis_jobs、share_grants、share_sessions。
- repository 有事务状态转换和带租约原子 claim；测试重复消费和幂等。
- Worker 有 provider timeout/429/5xx/schema error 分类、有限重试、预算/并发配置；模型结果必须经 contracts/domain 校验。
- OpenAI-compatible provider 仅从环境读取 endpoint/model/key；skill 作为 instructions，不允许绕过结构化输出。
- 本地 fake provider 能完成 API→job→worker→completed 集成测试。
- `pnpm test/build/typecheck` 通过；docker compose 配置可解析（如 Docker 不可用需明确）。
