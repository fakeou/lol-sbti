import { rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const temporary = fileURLToPath(new URL("../.schema-check-dist/", import.meta.url));
try {
  const compile = spawnSync(process.execPath, [fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url)), "-p", "tsconfig.json", "--outDir", ".schema-check-dist"], { cwd: root, stdio: "inherit" });
  if (compile.error) throw compile.error;
  if (compile.status !== 0) process.exit(compile.status ?? 1);
  const check = spawnSync(process.execPath, ["scripts/export-create-analysis-schema.mjs", "--check", "--module=../.schema-check-dist/index.js"], { cwd: root, stdio: "inherit" });
  if (check.error) throw check.error;
  process.exitCode = check.status ?? 1;
} finally {
  await rm(temporary, { recursive: true, force: true });
}
