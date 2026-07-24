# 安全与隐私

## 1. 信任边界

```text
不受信任输入：LCU 响应、桌面端上传、URL token、LLM 输出
受控组件：API schema validator、domain rules、worker、数据库
秘密：LCU Token（仅本机内存）、安装凭据、receipt/share secret、LLM API key
```

任何跨边界数据必须重新校验。桌面端脱敏不能替代服务端验证；LLM 的结构化输出也不能被当作可信数据。

## 2. 数据分类

| 类别 | 示例 | 处理 |
|---|---|---|
| 禁止离开本机 | LCU Token、PUUID、Account ID、Summoner ID、原始 game ID/响应 | 仅短期内存；不日志、不持久化、不上传 |
| 用户可选 | 游戏显示名 | 默认关闭；上传前明确展示；报告可使用匿名昵称 |
| 分析输入 | 脱敏的单局指标 | TLS；服务端加密；最短保留 |
| 聚合结果 | 维度分数、类型、解释 | 仅临时链接可读；到期删除 |
| 运维元数据 | request ID、状态、延迟、错误码 | 不含正文或 secret；按运维策略保留 |

## 3. 默认保留策略

- 原始规范化输入：分析完成后立即删除；失败任务最多保留 1 小时用于自动重试。
- 聚合指标与最终报告：默认 24 小时。
- 分享链接：默认 30 分钟，可由产品在 10 分钟至 24 小时范围内配置。
- receipt token：报告删除时失效，最长 24 小时。
- 操作日志：30 天，但只能含 ID、状态、耗时和安全错误码。
- 数据库后台定时清理；备份同样有明确过期策略，不能让“删除”只删除主表。

具体时长在上线前需要产品和隐私政策共同确认。

## 4. 凭据规则

- 随机 secret 使用 CSPRNG，至少 256 bit。
- 数据库存 `SHA-256(secret + serverPepper)`，应用层二次验证比较使用常量时间函数。receipt/share 明文采用用途隔离 HMAC 可恢复派生，仅在认证响应中交付；数据库仍只存哈希。server pepper 轮换必须版本化并提供不短于最长 token TTL 的双读窗口。
- LLM key、数据库密码、server pepper 放入部署平台 secret manager/KMS，不进入 Git、镜像层、日志或前端 bundle。
- 桌面安装凭据存 Windows Credential Manager，不写明文配置。
- 桌面不得落盘完整脱敏分析请求、receipt 或 share secret；只允许保存 `analysisId`、`idempotencyKey` 与 `managementExpiresAt`。启动后用安装凭据调用恢复接口取得同一 receipt，再继续轮询；恢复记录在删除、410、expired/deleted 或管理期限到期时清除，撤销分享只清 share URL，不清 receipt/恢复元数据。
- 服务端数据库只保存幂等键哈希；恢复接口必须同时验证安装归属和 key hash，对不匹配、过期与不存在统一返回 404，并采用严格 schema、独立限流和正文/凭据日志脱敏。
- 所有 token 有用途、作用域和过期时间，禁止复用。

## 5. 临时链接安全

- 推荐 `/r/{publicId}#{secret}`，secret 位于 fragment。
- 桌面端以 `REPORT_WEB_BASE_URL` 配置唯一可信报告 origin（默认 HTTPS），接收状态响应和调用系统浏览器前都必须校验 scheme、host 与有效端口完全相同，拒绝 userinfo、query、控制字符、非 `/r/{publicId}` 路径及缺失/非法 fragment secret；系统浏览器调用继续使用参数 API，不拼接 shell 命令。
- fragment 兑换后立刻从地址栏清除并换取 HttpOnly session cookie。
- 报告页面设置：
  - `Content-Security-Policy: default-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'`
  - `Referrer-Policy: no-referrer`
  - `Cache-Control: private, no-store`
  - `X-Content-Type-Options: nosniff`
- 页面不加载第三方统计、广告、字体、错误追踪脚本或社交预览机器人资源。
- 分享页不可被搜索引擎索引；响应设置 `X-Robots-Tag: noindex, nofollow, noarchive`。
- 链接泄露仍等同于授权泄露；UI 必须提示用户不要公开转发。

## 6. 大模型安全

- 只把白名单数值和枚举发送给模型；不发送玩家名或任意自由文本。
- 使用结构化输出/JSON Schema，拒绝未知字段、HTML、Markdown URL和超长文本。
- 服务端 HTML 转义；Web 只能渲染普通文本或受控组件，不使用 `dangerouslySetInnerHTML`。
- prompt 版本化；输出记录 provider、model ID、算法版本和 prompt 版本。
- 优先选择支持 zero-retention/no-training 的供应商方案，并在用户上传确认页明确披露供应商与地区。
- LBTI 是娱乐性数据归纳，不宣称心理诊断、官方评级或真实人格判断。

## 7. 滥用与成本控制

- 安装实例、IP、时间窗多维限流；不使用永久硬件指纹。
- `matches <= 100`、请求体上限、字段长度上限和严格 content type。
- 每安装每日额度、全局模型预算、worker 并发和 provider 熔断。
- `Idempotency-Key` 防止用户重试导致重复扣费。
- 可疑流量可启用邀请码或 CAPTCHA，但不能降低正常用户隐私。

## 8. 日志和监控

允许：

```json
{"requestId":"...","analysisId":"...","stage":"validating","durationMs":1200,"errorCode":"MODEL_TIMEOUT"}
```

禁止：

- Authorization、Cookie、URL fragment、receipt/share secret。
- LCU 端口和 Token、进程命令行。
- 上传 payload、模型 prompt/response 全文、用户名。
- provider 原始错误中可能回显的请求正文。

日志库应提供集中 redaction；测试需验证 header、body 和错误对象不会泄露 secret。

## 9. 威胁与控制

| 威胁 | 主要控制 |
|---|---|
| LCU Token 泄露 | 仅本机内存；Rust 类型禁止序列化；日志 redaction |
| 伪造/超大上传 | 安装凭据、schema、上限、限流 |
| 任务重复消费 | 幂等键、租约、条件状态更新、事务写入 |
| 临时链接被猜测 | 256-bit secret、只存哈希、限速、过期/撤销 |
| 链接经 Referer 泄露 | fragment exchange、no-referrer、无第三方资源 |
| LLM prompt injection | 仅数值/枚举、隔离数据、严格输出 schema |
| LLM 幻觉或篡改分数 | 确定性算法计算，服务端不变量校验 |
| XSS | 普通文本渲染、长度限制、CSP、禁止模型 HTML |
| 成本攻击 | 配额、预算熔断、队列并发、幂等 |
| 数据删除不彻底 | 主库/备份统一保留策略、定时清理审计 |

## 10. 上线前安全门槛

- 完成数据流和威胁模型评审。
- 对 API 做越权、枚举、重放、限流和 payload fuzz 测试。
- 对临时链接做日志/Referer/浏览器历史泄露测试。
- 验证桌面端崩溃日志不包含 LCU 命令行或 Token。
- 验证 provider 数据保留设置与隐私政策一致。
- 增加用户删除、链接撤销和过期清理的端到端测试。
