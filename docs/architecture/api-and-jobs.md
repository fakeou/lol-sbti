# 接口与任务状态

## 1. 契约原则

- 所有公网接口使用 `/v1` 版本前缀。
- 请求和响应由 `packages/contracts` 中的 JSON Schema 定义；默认拒绝未知字段。
- 上传只接受规范化、脱敏的数据，不接受原始 LCU JSON。
- 最大请求体建议 1 MiB，`matches` 接受 5–100 场；不足最低样本量时客户端应提示，服务端仍返回明确验证错误。
- 创建接口支持 `Idempotency-Key`，同一安装实例和 key 只能创建一个任务。
- `receiptToken`（管理任务）与 `shareSecret`（查看报告）必须是两种独立凭据。

## 2. 上传契约

```ts
type CreateAnalysisRequestV1 = {
  schemaVersion: 1;
  locale: "zh-CN" | "en-US";
  generatedAt: string;             // ISO 8601 UTC
  clientVersion: string;
  optionalDisplayName?: string;    // 用户明确同意时才发送
  matches: UploadMatchV1[];
};

type UploadMatchV1 = {
  occurredAt: string;
  queueId: number;
  gameMode: string;
  durationSeconds: number;
  championId: number;
  position: string | null;
  won: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  championDamage: number;
  damageTaken: number;
  healing: number;
  visionScore: number;
  wardsPlaced: number;
  wardsKilled: number;
  items: number[];
};
```

### 不变量

- 不含 `gameId`、PUUID、Account ID、Summoner ID、队友/对手身份。
- 数值均有 schema 上下界；未来新增字段不能静默改变 V1 含义。
- `occurredAt` 仅保留到分钟也足够分析时，应降低精度以减少可关联性。
- 自由文本不得直接拼入 system prompt；`gameMode` 和 `position` 映射到服务端白名单枚举。

## 3. HTTP API

### 3.1 注册安装实例

```http
POST /v1/installations
```

请求含客户端版本和一次性公钥/随机挑战，不含硬件指纹。响应为可撤销的安装凭据。桌面端把凭据存入 Windows Credential Manager；服务端只存哈希。生产环境可用设备授权或签名挑战加强滥用控制，但不应采集永久硬件指纹。

### 3.2 创建分析

```http
POST /v1/analyses
Authorization: Bearer <installationCredential>
Idempotency-Key: <uuid-v4>
Content-Type: application/json
```

```json
{
  "analysisId": "ana_01...",
  "status": "queued",
  "receiptToken": "random-secret",
  "pollAfterMs": 2000,
  "inputExpiresAt": "2026-07-25T10:00:00Z"
}
```

- 返回 `202 Accepted`。
- 数据库仅存 `receiptToken` 的哈希。
- 同一幂等键返回原任务，不重复调用模型或计费。`receiptToken` 由服务端 pepper、安装 ID 与幂等键通过 HMAC 确定性派生，因此首次响应丢失后可安全重放恢复；数据库仍只存其哈希。更换 pepper 会使未过期 receipt 失效，轮换时必须采用版本化双读窗口。

### 3.3 查询任务

```http
GET /v1/analyses/{analysisId}
Authorization: Bearer <receiptToken>
```

处理中：

```json
{
  "analysisId": "ana_01...",
  "status": "processing",
  "stage": "llm_analysis",
  "pollAfterMs": 3000
}
```

完成：

```json
{
  "analysisId": "ana_01...",
  "status": "completed",
  "share": {
    "url": "https://app.example/r/pub_01...#256-bit-secret",
    "expiresAt": "2026-07-25T10:30:00Z"
  }
}
```

失败：

```json
{
  "analysisId": "ana_01...",
  "status": "failed",
  "error": {
    "code": "MODEL_TEMPORARILY_UNAVAILABLE",
    "retryable": true
  }
}
```

错误响应不得包含 provider 原文、prompt、战绩正文或内部堆栈。

### 3.4 重试

```http
POST /v1/analyses/{analysisId}/retry
Authorization: Bearer <receiptToken>
```

仅 `failed + retryable` 可调用；服务端限制次数。重试复用同一 `analysisId` 并新增 job attempt，避免产生多个用户报告。

### 3.5 兑换临时链接

浏览器打开：

```text
https://app.example/r/{publicId}#{shareSecret}
```

URL fragment 不会随首个 HTTP 请求或 Referer 发送。结果页 JavaScript 将 secret 放入请求体：

```http
POST /v1/share-sessions
Content-Type: application/json

{ "publicId": "pub_01...", "secret": "..." }
```

API 校验哈希、过期时间、撤销状态和访问次数后，设置短期 `HttpOnly; Secure; SameSite=Lax` cookie。网页随后用 `history.replaceState` 清除 fragment，再请求报告。默认允许刷新页面，不做“一次打开即销毁”。`shareSecret` 由 server pepper 与不可预测的 `publicId` 通过用途隔离 HMAC 确定性派生：数据库只存哈希，receipt 状态查询可恢复并交付相同 fragment；pepper 轮换采用与 receipt 相同的版本化双读窗口。

### 3.6 获取结果

```http
GET /v1/public/reports/{publicId}
Cookie: report_session=...
```

返回已验证的结构化结果。过期/撤销统一返回 `410 Gone`，凭据错误返回通用 `404`，避免枚举 public ID。

### 3.7 撤销和删除

```http
DELETE /v1/analyses/{analysisId}/share
DELETE /v1/analyses/{analysisId}
Authorization: Bearer <receiptToken>
```

前者只撤销临时链接，后者进入删除流程并使所有 session 失效。

## 4. LBTI 报告契约

```ts
type LbtiReportV1 = {
  resultVersion: 1;
  typeCode: string;
  title: string;
  confidence: number;              // 0..1
  sample: {
    matchCount: number;
    queues: Array<{ queueId: number; count: number }>;
    from: string;
    to: string;
  };
  dimensions: Array<{
    code: string;
    score: number;                 // 0..100，由确定性算法生成
    evidenceCodes: string[];       // 引用可验证指标，不是自由编造证据
    explanation: string;           // LLM 文案，长度受限
  }>;
  summary: string;
  strengths: string[];
  risks: string[];
  recommendations: string[];
  limitations: string[];
  generatedAt: string;
};
```

模型只能生成 schema 允许的解释字段。`typeCode`、维度分数、样本量和 evidence 指标由 `packages/domain` 计算并注入，worker 必须校验模型不能篡改。

## 5. 数据表（逻辑模型）

```text
installations
- id, credential_hash, created_at, revoked_at, last_seen_at

analyses
- id, installation_id, status, schema_version, result_version
- receipt_hash, input_payload_encrypted, aggregate_metrics
- result_payload, created_at, input_expires_at, result_expires_at, deleted_at

analysis_jobs
- id, analysis_id, attempt, status, lease_until, owner_token, fence
- provider, model_id, prompt_version, error_code
- queued_at, started_at, finished_at

share_grants
- public_id, analysis_id, secret_hash
- expires_at, revoked_at, max_views, view_count

share_sessions
- session_hash, public_id, expires_at, revoked_at
```

敏感 JSON 字段使用应用层信封加密；密钥由部署环境的 KMS/secret manager 提供，不进入仓库。

## 6. Worker 执行契约

```text
claim job (atomic lease)
  → validate schema again
  → compute deterministic metrics
  → select algorithm/prompt version
  → call provider with timeout
  → validate strict JSON schema
  → content and invariant checks
  → transactionally save result + mark completed + create ShareGrant
  → delete raw input as soon as policy permits
```

### 重试分类

| 错误 | 策略 |
|---|---|
| provider 429/5xx/timeout | 指数退避 + jitter，最多 3 次 |
| provider schema 输出错误 | 最多 1 次结构修复重试 |
| 上传 schema/业务不变量错误 | 不重试，终态失败 |
| worker 崩溃/租约超时 | 任务重新入队，依靠幂等写入防重复 |
| 预算熔断 | 延迟重试或安全失败，不绕过预算 |

## 7. 状态转换

| 当前状态 | 操作者 | 下一状态 |
|---|---|---|
| `accepted` | API transaction | `queued` |
| `queued` | worker claim | `processing` |
| `processing` | worker | `validating` / `retry_wait` / `failed` |
| `validating` | worker transaction | `completed` / `retry_wait` / `failed` |
| `retry_wait` | scheduler | `queued` |
| `completed` | retention job | `expired` / `deleted` |

状态更新使用 owner token + 单调 fence + 未过期 lease 的条件更新。worker 在 provider 调用期间持续 heartbeat；旧 owner 的 validating、complete、fail/retry 写入必须失败。任何消费者重放都不得重复创建报告、链接或模型费用记录。
