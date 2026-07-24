# LOL-SBTI LCU 数据导出器

一个简洁的 Windows Tauri 2 桌面端，自动识别当前登录的英雄联盟 LCU 用户，并将最近最多 100 场对局导出为 CSV。

> 项目计划演进为包含桌面端、Web、API 和分析 Worker 的 monorepo，详见 [架构设计](docs/architecture/README.md) 与 [迁移分析](docs/plan/analysis/monorepo-migration.md)。

## 功能

- 自动发现 `LeagueClientUx.exe`，无需管理员权限；
- 自动显示 LCU 连接状态和当前游戏名；
- 单按钮导出最近最多 100 场对局；
- 对可用的单局详情计算参团率和伤害占比；
- CSV 包含时间、模式、胜负、英雄、K/D/A、参团率、补刀、金币、伤害、承伤、治疗、视野、位置和出装；
- 不保存 Token、PUUID、召唤师 ID、Account ID、原始对局 ID或原始接口响应；
- 只向 `127.0.0.1` 的 LCU 发送 GET 请求。

> 应用会分页读取并按对局 ID 去重；部分 LCU 可能在深分页时重复返回第一页，此时会停止分页，因此实际结果受本地客户端可返回的历史记录限制。

## 运行桌面端

需要 Windows WebView2、Visual Studio C++ Build Tools 和 Rust 1.88。项目已通过 `rust-toolchain.toml` 固定工具链。

```powershell
Set-Location .\src-tauri
cargo run
```

界面会自动检测客户端。点击“导出最近 100 场 CSV”后，文件写入应用启动时的当前目录：

```text
lcu-recent-matches.csv
```

如果希望 CSV 直接生成在仓库根目录，请从根目录启动已构建程序：

```powershell
.\src-tauri\target\debug\lol-sbti.exe
```

## 构建

```powershell
Set-Location .\src-tauri
cargo check
cargo build
```

如果需要打包安装程序，可安装 Tauri CLI 后运行 `tauri build`；当前配置默认关闭 bundle，仅构建桌面可执行文件。

## 无界面导出验证

```powershell
.\src-tauri\target\debug\lol-sbti.exe --export-once
```

成功时只输出 CSV 路径和导出场数。

## PowerShell 探针

仓库仍保留 [Test-LolLcu.ps1](Test-LolLcu.ps1)，用于独立验证 LCU 接口和字段覆盖率：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Test-LolLcu.ps1
```
