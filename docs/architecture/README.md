# 系统架构

## 1. 目标与边界

将当前单体 Tauri LCU 工具演进为一个 monorepo，覆盖三类运行时：

1. **LCU 桌面端**：在用户电脑上只读访问本地 LCU，提取并脱敏对局数据，经用户确认后上传。
2. **分析服务端**：验证上传数据、创建异步任务、调用大模型、校验结构化结果、生成临时访问凭据。
3. **结果网页**：通过临时链接读取并展示一次 LOL LBTI 分析结果。

系统不提供 Riot 账号登录，不把 LCU Token 上传到服务器，不公开原始对局数据，不允许大模型直接生成可执行 HTML。

> “LBTI”目前视为产品的分析报告名称。评分维度和解释规则应在实现前单独形成产品规范，不能仅依赖提示词临时决定。

## 2. 推荐技术栈

| 层 | 推荐 | 原因 |
|---|---|---|
| Monorepo | pnpm workspace + Turborepo | Web/API/shared 包统一脚本和缓存；Rust 继续由 Cargo 管理 |
| 桌面端 | Tauri 2 + Rust + TypeScript/Vite | 保留现有可靠的 LCU 读取代码；前端获得类型和构建体系 |
| Web | Next.js（App Router） | 适合结果页、服务端读取临时凭据及后续分享元数据 |
| API | Fastify + TypeScript | 明确的 schema、低耦合异步 API；不强绑 Next.js 进程 |
| Worker | 独立 Node.js worker | 大模型调用与 HTTP 请求解耦，可单独限流和扩容 |
| 数据库 | PostgreSQL | 任务状态、幂等、过期时间和审计元数据需要事务 |
| 队列 | MVP 使用 PostgreSQL job 表；扩容后 BullMQ/Redis | 初期减少基础设施；吞吐上升后替换队列适配器 |
| 对象存储 | 默认不用；超大载荷再引入 S3 兼容存储 | MVP 数据量可控，减少敏感数据副本 |
| Schema | TypeBox/JSON Schema | Fastify、前端类型、LLM 结构化输出共享一份契约 |
| 可观测性 | OpenTelemetry + 结构化日志 | 跨 API/worker 追踪；日志必须自动脱敏 |

如果团队更熟悉 Rust，API/worker 可改用 Axum，但不建议在 MVP 同时引入两套服务端语言；现有 LCU 连接部分继续使用 Rust 即可。

## 3. 目录结构

```text
lol-sbti/
├─ apps/
│  ├─ desktop/                  # Tauri 桌面应用
│  │  ├─ src/                   # Vite + TypeScript UI
│  │  └─ src-tauri/             # LCU discovery、采集、脱敏、上传
│  ├─ web/                      # Next.js 临时结果页面
│  ├─ api/                      # Fastify HTTP API
│  └─ worker/                   # 分析任务消费者与 LLM adapter
├─ packages/
│  ├─ contracts/                # API、事件、LLM 输出 JSON Schema
│  ├─ domain/                   # 纯函数：标准化、指标计算、结果校验
│  ├─ api-client/               # desktop/web 使用的类型安全客户端
│  ├─ ui/                       # web 与 desktop 可复用设计 token/组件
│  ├─ config-eslint/
│  └─ config-typescript/
├─ crates/
│  ├─ lcu-client/               # 本地发现、认证、只读 GET
│  └─ match-sanitizer/          # Rust 侧脱敏与上传 DTO 生成
├─ infra/
│  ├─ migrations/               # PostgreSQL migrations
│  ├─ docker/                   # 本地开发 compose
│  └─ deploy/                   # 部署模板，具体平台后定
├─ docs/
├─ pnpm-workspace.yaml
├─ turbo.json
└─ Cargo.toml                   # Rust workspace，仅包含 crates 和 Tauri backend
```

### 迁移规则

- 当前 `frontend/` 迁至 `apps/desktop/src/`。
- 当前 `src-tauri/` 迁至 `apps/desktop/src-tauri/`。
- LCU 通信与脱敏逻辑从 Tauri command 中抽离到 `crates/`，Tauri 层只负责编排。
- 桌面端只提供“上传并分析”主流程，不生成或保留本地 CSV；上传必须由用户主动确认，不在后台自动执行。

## 4. 组件关系

```text
┌────────────────── 用户电脑 ──────────────────┐
│ LeagueClientUx.exe                           │
│       │ localhost HTTPS GET                  │
│       ▼                                      │
│ crates/lcu-client → match-sanitizer          │
│       │                 │                    │
│       │             本地预览/确认             │
│       └──────── apps/desktop ────────────────┼── HTTPS ──┐
└──────────────────────────────────────────────┘           │
                                                           ▼
┌──────────────────── 服务端 ────────────────────────────────┐
│ apps/api                                                   │
│  ├─ ingest validation ──► PostgreSQL                       │
│  ├─ job status                                             │
│  └─ temporary access token                                 │
│             │ claim job                                    │
│             ▼                                              │
│ apps/worker ──► LLM provider                               │
│             ◄── schema-constrained result                  │
│             └── domain validation ──► PostgreSQL            │
│                                      │                     │
│ apps/web ◄──── one-time/expiring cookie exchange ◄─────────┘
└─────────────────────────────────────────────────────────────┘
```

## 5. 核心数据流

```text
Desktop          API               DB/Queue          Worker/LLM          Web
   │ POST analyses  │                  │                  │               │
   ├───────────────►│ validate+store   │                  │               │
   │                ├─────────────────►│                  │               │
   │◄── 202 jobId ──┤                  │                  │               │
   │ GET job status │                  │ claim            │               │
   ├───────────────►│                  │─────────────────►│               │
   │                │                  │                  ├──► LLM        │
   │                │                  │◄── valid result ─┤               │
   │◄─ complete + linkExpiresAt ───────┤                  │               │
   │                │                                     │               │
User opens /r/token ────────────────────────────────────────────────────►│
                    │ hash token, consume/exchange, set HttpOnly cookie  │
                    │◄────────────────────────────────────────────────────┤
                    ├────────────────────────────────────────────────────►│
                    │                     sanitized result                │
```

## 6. 模块所有权

| 模块 | 创建/持有 | 调用 | 不负责 |
|---|---|---|---|
| `lcu-client` | 进程发现、短期内存 Token、LCU GET | localhost LCU | 上传、业务评分 |
| `match-sanitizer` | 上传 DTO、脱敏规则 | `lcu-client` 输出 | 网络、持久化 |
| `desktop` | 用户确认、上传进度、本地错误 | API client | 服务端任务执行 |
| `api` | 上传授权、任务生命周期、临时访问 | PostgreSQL、queue adapter | LLM 推理细节 |
| `worker` | prompt 版本、provider adapter、重试 | LLM、domain validator | 对公网提供结果 |
| `domain` | 确定性指标和结果不变量 | 无 I/O | LCU/HTTP/数据库 |
| `web` | 报告渲染和过期状态 | API/server data access | 接收原始上传 |
| `contracts` | 跨边界 schema/version | 被所有 TS 包引用 | 业务 I/O |

## 7. 关键设计决策

### 7.1 确定性计算优先于大模型

KDA、参团率、伤害占比、英雄/位置分布等由 `domain` 计算。LLM 只负责归纳、解释和生成建议。这样可测试、可复现，也降低幻觉风险。

### 7.2 异步任务而非长 HTTP 请求

LLM 分析可能持续数十秒或失败。上传接口仅创建任务并返回 `202`；桌面端轮询状态。后续可无痛切换 SSE，但 MVP 不需要维护长连接。

### 7.3 临时链接不是公开结果 ID

URL 使用 256-bit 随机 bearer token，只在创建时返回明文；数据库仅存 SHA-256 哈希。首次打开后把 token 兑换成短期 HttpOnly、Secure、SameSite=Lax cookie，并立即从地址栏移除 token。链接默认 30 分钟过期，结果默认 24 小时后删除。

### 7.4 上传身份与结果访问分离

桌面端首次启动通过安装实例注册获得可撤销的安装凭据（存 Windows Credential Manager），只允许创建和查看自己创建的任务状态。结果链接是独立、短期、只读权限。MVP 不需要用户账号系统。

### 7.5 契约版本化

上传使用 `schemaVersion`，LLM 使用 `promptVersion` 与 `modelId`，结果使用 `resultVersion`。不兼容变更通过新版本并行处理，旧任务不被新代码错误解释。

## 8. 任务状态机

```text
accepted → queued → processing → validating → completed
    │         │          │            │
    └─────────┴──────────┴────────────┴──► failed
                         │
                         └── retry_wait ──► queued

completed ── retention deadline ──► expired/deleted
```

- API 只能创建 `accepted`。
- worker 使用带租约的原子 claim 把 `queued` 攟为 `processing`。
- provider 超时、429、5xx 可指数退避重试；schema 错误可进行有限次数修复重试。
- 达到上限进入 `failed`，桌面端只看到安全错误码和可操作提示。

## 9. 非目标（MVP）

- Riot OAuth 或游戏账号体系。
- 永久公开报告、用户排行榜、社交分享索引。
- 在服务器保存 LCU Token、PUUID、Account ID、Summoner ID、游戏显示名或原始 LCU 响应。
- 让 LLM 直接决定可计算的数值指标。
- 让客户端直接持有 LLM provider key。
- 自动后台采集或未经确认持续上传。
