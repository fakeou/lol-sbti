---
id: worker-002
scope: stepfun-provider
status: ready
depends-on: [backend-001]
---

# objective

使 OpenAI-compatible Worker 兼容 StepFun `step-3.7-flash`：请求使用 `response_format: { type: "json_object" }` 和足够的 token 预算，仍把模型 JSON 交给现有的严格 `LbtiReportV1` schema 与 domain 不变量校验。不能记录模型 key、请求正文或完整模型响应。保留 endpoint HTTPS、redirect 禁用、错误分类与其他 OpenAI-compatible provider 的安全边界。

# context

- `docs/architecture/api-and-jobs.md`
- `docs/architecture/security-and-privacy.md`
- `apps/worker/src/provider.ts`

# path

- `apps/worker/src/provider.ts`
- `apps/worker/src/provider.test.ts`
- `apps/worker/src/main.ts`
- `.env.example`

# verification

- StepFun fixture/mock 断言 `json_object`、`max_tokens >= 1024`、`temperature: 0`。
- content 空、finish_reason=length、无效 JSON 均返回 `MODEL_SCHEMA_INVALID` 且可重试。
- HTTPS endpoint、redirect、401/403/429/5xx 现有测试继续通过。
- `pnpm --filter @lol-sbti/worker test/build/typecheck` 通过。
- 不修改或输出密钥；不触碰 `docs/research/`。
