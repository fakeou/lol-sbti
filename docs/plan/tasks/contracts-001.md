---
id: contracts-001
scope: contracts-domain
status: ready
depends-on: [repo-001]
---

# objective

实现共享 V1 契约、脱敏战绩校验、确定性聚合指标，以及一个可替换的 `analysis skill` 文件接口。服务端未来只需加载用户提供的一份 skill 文档即可构建模型指令；skill 不得包含 provider 密钥、执行代码或绕过输出 schema。当前不实现称号/类型规则，使用明确的 `unclassified` 占位结果，避免与并行称号设计冲突。

# context

- `docs/architecture/README.md`
- `docs/architecture/api-and-jobs.md`
- `docs/architecture/security-and-privacy.md`
- `docs/plan/analysis/monorepo-migration.md`

# path

- `packages/contracts/`
- `packages/domain/`
- `packages/analysis-skill/`
- `packages/test-fixtures/`
- `package.json`
- `pnpm-lock.yaml`
- `turbo.json`
- `docs/architecture/api-and-jobs.md`
- `docs/plan/tasks/contracts-001.md`

不得修改或加入 `docs/research/`、`docs/investigation-round1-report.md`、`research_lpl_streamer_memes.md`。

# verification

- V1 上传、任务状态、结构化报告均有严格 runtime schema 和导出 TypeScript 类型。
- 上传 schema 拒绝未知字段、禁止身份字段，允许 5–100 场动态样本量。
- `domain` 对固定 fixture 生成稳定聚合指标，覆盖模式/位置样本构成及常用统计。
- `analysis-skill` 只加载 UTF-8 Markdown，限制大小，返回版本、内容哈希和指令文本；测试非法路径、超大/空文件和 secret-like frontmatter。
- 模型输出经 schema 和业务不变量校验，不能篡改确定性分数和样本量。
- `pnpm test`、`pnpm build`、类型检查通过。
