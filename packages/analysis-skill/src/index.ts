import { createHash } from "node:crypto";
import { open, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

export interface AnalysisSkill { version: string; contentHash: string; instructions: string }
export interface LoadAnalysisSkillOptions { rootDirectory: string; maxBytes?: number }
export class AnalysisSkillError extends Error { constructor(readonly code: "INVALID_PATH" | "INVALID_FILE" | "INVALID_FRONTMATTER" | "INVALID_CONTENT", message: string) { super(message); this.name = "AnalysisSkillError"; } }
const SECRET_KEY = /(?:api[_ -]?key|access[_ -]?token|client[_ -]?secret|password|credential|authorization)/i;
const SECRET_VALUE = /(?:\b(?:sk|pk|rk|api)[-_][A-Za-z0-9_-]{8,}\b|\bBearer\s+[A-Za-z0-9._~+/-]{8,}=*|-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\b(?:api[_ -]?key|access[_ -]?token|client[_ -]?secret|password|credential|authorization)\s*[:=]\s*\S+)/i;
const CODE_BLOCK = /(?:^|\r\n|[\r\n])[ \t]{0,3}(?:`{3,}|~{3,})/;
const SCHEMA_BYPASS = /(?:\b(?:ignore|disregard|forget|override|bypass|evade|disable)\b[\s\S]{0,80}\b(?:previous|prior|system|developer|instruction|constraint|schema|format|validation)\b|\b(?:arbitrary|extra|unrestricted)\s+(?:fields?|output)\b|忽略[\s\S]{0,40}(?:先前|系统|开发者|指令|约束|格式|模式|schema)|(?:绕过|禁用)[\s\S]{0,40}(?:校验|验证|约束|格式|模式|schema)|(?:任意|额外)字段)/i;

export async function loadAnalysisSkill(filePath: string, options: LoadAnalysisSkillOptions): Promise<AnalysisSkill> {
  const maxBytes = options.maxBytes ?? 64 * 1024;
  if (!isAbsolute(filePath) || extname(filePath).toLowerCase() !== ".md" || maxBytes < 1) throw new AnalysisSkillError("INVALID_PATH", "skill path must be an absolute Markdown path");
  const root = await realpath(resolve(options.rootDirectory)).catch(() => { throw new AnalysisSkillError("INVALID_PATH", "rootDirectory does not exist"); });
  const handle = await open(filePath, "r").catch(() => { throw new AnalysisSkillError("INVALID_PATH", "skill file does not exist"); });
  try {
    const target = await realpath(filePath).catch(() => { throw new AnalysisSkillError("INVALID_PATH", "skill file does not exist"); });
    const rel = relative(root, target);
    if (rel === "" || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel) || extname(target).toLowerCase() !== ".md") throw new AnalysisSkillError("INVALID_PATH", "skill file must be a Markdown file below rootDirectory");
    const [info, pathInfo] = await Promise.all([handle.stat(), stat(target)]);
    if (info.dev !== pathInfo.dev || info.ino !== pathInfo.ino) throw new AnalysisSkillError("INVALID_PATH", "skill file changed while being opened");
    if (!info.isFile() || info.size === 0 || info.size > maxBytes) throw new AnalysisSkillError("INVALID_FILE", info.size === 0 ? "skill file is empty" : "skill file exceeds size limit");
    const bytes = await handle.readFile();
    if (bytes.byteLength > maxBytes) throw new AnalysisSkillError("INVALID_FILE", "skill file exceeds size limit");
    let decoded: string;
    try { decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, ""); }
    catch { throw new AnalysisSkillError("INVALID_CONTENT", "skill file is not valid UTF-8"); }
    if (!decoded.trim()) throw new AnalysisSkillError("INVALID_CONTENT", "skill file is empty");
    if (SECRET_VALUE.test(decoded)) throw new AnalysisSkillError("INVALID_CONTENT", "provider secrets are not allowed");
    const parsed = parseFrontmatter(decoded);
    if (CODE_BLOCK.test(parsed.body)) throw new AnalysisSkillError("INVALID_CONTENT", "executable code blocks are not allowed");
    if (SCHEMA_BYPASS.test(parsed.body)) throw new AnalysisSkillError("INVALID_CONTENT", "instructions may not bypass higher-level constraints or the output schema");
    return { version: parsed.version, contentHash: `sha256:${createHash("sha256").update(bytes).digest("hex")}`, instructions: parsed.body.trim() };
  } finally {
    await handle.close();
  }
}

function parseFrontmatter(content: string): { version: string; body: string } {
  if (!content.startsWith("---\n")) throw new AnalysisSkillError("INVALID_FRONTMATTER", "YAML frontmatter is required");
  const end = content.indexOf("\n---\n", 4);
  if (end < 0) throw new AnalysisSkillError("INVALID_FRONTMATTER", "frontmatter is not terminated");
  const values = new Map<string, string>();
  for (const line of content.slice(4, end).split("\n")) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):\s*([^\r\n]+)$/.exec(line);
    if (!match) throw new AnalysisSkillError("INVALID_FRONTMATTER", "frontmatter must contain scalar key-value pairs");
    if (SECRET_KEY.test(match[1])) throw new AnalysisSkillError("INVALID_FRONTMATTER", "secret-like frontmatter keys are forbidden");
    if (values.has(match[1])) throw new AnalysisSkillError("INVALID_FRONTMATTER", "duplicate frontmatter key");
    values.set(match[1], match[2].trim().replace(/^(["'])(.*)\1$/, "$2"));
  }
  if (values.size !== 1 || !values.has("version") || !/^[A-Za-z0-9._-]{1,32}$/.test(values.get("version")!)) throw new AnalysisSkillError("INVALID_FRONTMATTER", "frontmatter must contain only a valid version");
  return { version: values.get("version")!, body: content.slice(end + 5) };
}
