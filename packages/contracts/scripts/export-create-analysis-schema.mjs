import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const moduleArgument = process.argv.find((value) => value.startsWith("--module="))?.slice("--module=".length) ?? "../dist/index.js";
const { CreateAnalysisRequestV1Schema } = await import(moduleArgument);

const output = fileURLToPath(new URL("../../../crates/match-sanitizer/fixtures/create-analysis-request-v1.json", import.meta.url));
const schema = structuredClone(CreateAnalysisRequestV1Schema);
const utcPattern = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,3})?)?Z$";
function makePortable(value) {
  if (!value || typeof value !== "object") return;
  if (value.format === "lol-sbti-utc-timestamp") { delete value.format; value.pattern = utcPattern; }
  for (const child of Object.values(value)) makePortable(child);
}
makePortable(schema);
const generated = `${JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", ...schema }, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const existing = await readFile(output, "utf8").catch(() => "");
  if (existing !== generated) { console.error("Rust CreateAnalysis V1 schema artifact is stale; run the contracts build."); process.exit(1); }
} else {
  await mkdir(fileURLToPath(new URL("../../../crates/match-sanitizer/fixtures/", import.meta.url)), { recursive: true });
  await writeFile(output, generated, "utf8");
}
