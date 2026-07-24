---
id: desktop-002
scope: desktop-analysis
status: ready
depends-on: [backend-001, web-001]
---

# objective

将桌面端收敛为完整分析客户端：采集实际可用 5–100 场、在 Rust 侧生成与 V1 schema 一致且不含禁止标识的上传 DTO、展示实际样本和隐私确认、注册安装实例、幂等上传、持久化非秘密任务恢复信息、查询分析进度、重试/取消删除、打开临时报告链接并可撤销。删除 CSV、本地战绩文件和 `--export-once` 等导出能力。安装凭据使用 Windows Credential Manager；开发测试允许显式注入内存 credential store。

# context

- `docs/architecture/README.md`
- `docs/architecture/api-and-jobs.md`
- `docs/architecture/security-and-privacy.md`
- `docs/architecture/ui-layout.md`
- `docs/plan/tasks/backend-001.md`

# path

- `apps/desktop/`
- `crates/lcu-client/`
- `crates/match-sanitizer/`
- `Cargo.toml`
- `Cargo.lock`
- `package.json`
- `pnpm-lock.yaml`
- `docs/plan/tasks/desktop-002.md`

不得触碰研究文件。

# verification

- LCU token和身份字段不能出现在可序列化上传类型、日志、磁盘或错误文本。
- sanitizer输出通过共享V1 JSON Schema fixture一致性测试；5/100边界及实际50场均可用。
- 用户上传前看到实际场数、时间、模式、上传/不上传字段、保留期和模型披露，并主动确认。
- API base URL默认仅允许HTTPS；localhost开发需显式开关；限制跳转/禁止把凭据发往非配置源。
- 安装凭据写Windows Credential Manager；receipt/share secret不持久化；只保存analysisId/idempotencyKey等非秘密恢复信息。
- 支持queued/processing/validating/completed/failed/410状态、退避轮询、重试、删除/撤销和系统浏览器打开链接。
- 不存在 CSV、本地战绩文件或 `--export-once` 入口；应用主流程只有预览确认、上传分析和打开临时报告。
- Rust单元/集成测试、前端DOM测试、cargo/pnpm全套检查通过；真实LCU smoke test不泄露数据。
