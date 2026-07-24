# LOL-SBTI 分析客户端

Windows Tauri 2 桌面客户端：只读连接当前英雄联盟 LCU，在本机筛选并脱敏最近 5–100 场可用对局；用户确认字段和保留策略后，客户端通过 HTTPS 上传数据，由服务端异步分析并返回限时报告链接。

仓库使用 pnpm workspace、Turborepo 与 Cargo workspace 管理。整体设计见 [架构设计](docs/architecture/README.md) 与 [接口和任务状态](docs/architecture/api-and-jobs.md)。

## 流程

1. 自动发现 `LeagueClientUx.exe`，只向 `127.0.0.1` 的 LCU 发起只读 GET 请求。
2. 在本机筛选、规范化并脱敏可用对局，预览实际场数、时间范围、模式和匿名跳过原因。
3. 明示上传字段、排除字段、保留期和模型用途；只有用户主动确认后才允许上传。
4. 注册安装实例并将安装凭据保存在 Windows Credential Manager。
5. 幂等创建服务端分析任务，轮询排队、处理、校验和完成状态。
6. 完成后通过系统浏览器打开临时报告；用户可撤销链接或删除任务。
7. 应用重启时只使用任务 ID、幂等键和管理期限恢复任务，不在本机保存分析输入或任务秘密。

## 隐私边界

- 不上传或持久化 LCU Token、PUUID、Account ID、Summoner ID、游戏显示名、原始对局 ID 或原始 LCU 响应；V1 不提供可选显示名字段。
- 上传 DTO 只包含 V1 分析所需的时间（分钟精度）、队列/模式、英雄/位置、胜负、KDA、经济、伤害、视野和装备等脱敏指标。
- 安装凭据保存在 Windows Credential Manager；任务 receipt 和报告 share secret 仅短期存在于内存。
- 本机恢复文件仅包含 `analysisId`、`idempotencyKey`、`managementExpiresAt`。
- 服务端输入在分析完成后删除（失败任务最多保留 1 小时）；报告和管理权限最长 24 小时，分享链接默认 30 分钟。

## 环境

需要 Windows WebView2、Visual Studio C++ Build Tools、Node.js、pnpm 9 和 Rust。Rust 工具链由 [rust-toolchain.toml](rust-toolchain.toml) 固定。

```powershell
pnpm install
```

生产 API 和报告 Web origin 默认必须使用 HTTPS。桌面端用 `REPORT_WEB_BASE_URL` 配置唯一可信报告 origin（只能包含 scheme/host/port，不能包含路径、凭据、query 或 fragment）；仅该 origin 下的 `/r/{publicId}#{shareSecret}` 可由系统浏览器打开。仅本地开发时可显式配置 localhost HTTP：

```powershell
$env:LOL_SBTI_API_BASE_URL = "http://localhost:3000"
$env:REPORT_WEB_BASE_URL = "http://localhost:3001"
$env:LOL_SBTI_ALLOW_LOCAL_HTTP = "1"
```

## 常用命令

```powershell
# 启动桌面端
pnpm desktop:dev

# 构建桌面端
pnpm desktop:build

# 全仓库验证
cargo fmt --check --all
cargo test --workspace --all-targets
cargo build --workspace --all-targets
pnpm test
pnpm typecheck
pnpm build
```

构建后的调试程序位于 `target\debug\lol-sbti.exe`。执行测试和开发时不要向真实服务上传 LCU 数据。
