---
id: repo-001
scope: monorepo-foundation
status: done
depends-on: []
---

# objective

建立 pnpm/Turborepo/Cargo monorepo 骨架，并将现有 Tauri 应用无行为变化地迁移到 `apps/desktop`。统一根目录开发命令，确保桌面端仍可构建、测试并连接当前 LCU。

# context

- `docs/architecture/README.md`
- `docs/plan/analysis/monorepo-migration.md`
- `docs/architecture/security-and-privacy.md`

# path

- `apps/desktop/`
- `Cargo.toml`
- `package.json`
- `pnpm-workspace.yaml`
- `turbo.json`
- `.gitignore`
- `README.md`
- `docs/plan/tasks/repo-001.md`

旧目录 `frontend/` 与 `src-tauri/` 在迁移完成后删除。不得修改或加入 `docs/research/`，该目录由其他并行工作持有。

# verification

- 根目录 Cargo workspace 可识别 `apps/desktop/src-tauri`。
- `cargo fmt --check --all`、`cargo test --workspace`、`cargo build -p lol-sbti` 通过。
- Tauri `frontendDist` 指向迁移后的桌面前端。
- 构建后的应用可启动；`--export-once` 继续可用。
- Git 中没有 `target`、CSV、probe report 或本地 secret。
