import { FormatRegistry, Type, type Static, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const StrictObject = <T extends Record<string, TSchema>>(properties: T) =>
  Type.Object(properties, { additionalProperties: false });

const UTC_FORMAT = "lol-sbti-utc-timestamp";
if (!FormatRegistry.Has(UTC_FORMAT)) {
  FormatRegistry.Set(UTC_FORMAT, (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?Z$/.exec(value);
    if (!match) return false;
    const [, year, month, day, hour, minute, second = "0", milliseconds = "0"] = match;
    const parts = [year, month, day, hour, minute, second].map(Number);
    const date = new Date(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!, parts[3]!, parts[4]!, parts[5]!, Number(milliseconds.padEnd(3, "0"))));
    return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1]! - 1 && date.getUTCDate() === parts[2]
      && date.getUTCHours() === parts[3] && date.getUTCMinutes() === parts[4] && date.getUTCSeconds() === parts[5];
  });
}
const UtcTimestamp = Type.String({ format: UTC_FORMAT, maxLength: 30 });
const SafeText = Type.String({ minLength: 1, maxLength: 500, pattern: "^(?![\\s\\S]*\\[[^\\]\\r\\n]*\\]\\s*\\([^\\)\\r\\n]*\\))(?![\\s\\S]*\\[[^\\]\\r\\n]*\\]\\s*\\[[^\\]\\r\\n]*\\])(?![\\s\\S]*(?:^|\\r?\\n)[ \\t]{0,3}\\[[^\\]\\r\\n]+\\]:)[^<>]*$" });
const Identifier = Type.String({ minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9_-]+$" });

export const UploadMatchV1Schema = StrictObject({
  occurredAt: UtcTimestamp,
  queueId: Type.Integer({ minimum: 0, maximum: 10000 }),
  gameMode: Type.Union([Type.Literal("CLASSIC"), Type.Literal("ARAM"), Type.Literal("URF"), Type.Literal("CHERRY")]),
  durationSeconds: Type.Integer({ minimum: 1, maximum: 10800 }),
  championId: Type.Integer({ minimum: 1, maximum: 10000 }),
  position: Type.Union([Type.Literal("TOP"), Type.Literal("JUNGLE"), Type.Literal("MIDDLE"), Type.Literal("BOTTOM"), Type.Literal("UTILITY"), Type.Null()]),
  won: Type.Boolean(),
  kills: Type.Integer({ minimum: 0, maximum: 100 }),
  deaths: Type.Integer({ minimum: 0, maximum: 100 }),
  assists: Type.Integer({ minimum: 0, maximum: 200 }),
  cs: Type.Integer({ minimum: 0, maximum: 2000 }),
  gold: Type.Integer({ minimum: 0, maximum: 100000 }),
  championDamage: Type.Integer({ minimum: 0, maximum: 1000000 }),
  damageTaken: Type.Integer({ minimum: 0, maximum: 1000000 }),
  healing: Type.Integer({ minimum: 0, maximum: 1000000 }),
  visionScore: Type.Integer({ minimum: 0, maximum: 1000 }),
  wardsPlaced: Type.Integer({ minimum: 0, maximum: 1000 }),
  wardsKilled: Type.Integer({ minimum: 0, maximum: 1000 }),
  items: Type.Array(Type.Integer({ minimum: 0, maximum: 10000 }), { maxItems: 10 })
});
export type UploadMatchV1 = Static<typeof UploadMatchV1Schema>;

export const CreateAnalysisRequestV1Schema = StrictObject({
  schemaVersion: Type.Literal(1),
  locale: Type.Union([Type.Literal("zh-CN"), Type.Literal("en-US")]),
  generatedAt: UtcTimestamp,
  clientVersion: Type.String({ minLength: 1, maxLength: 64, pattern: "^[A-Za-z0-9._+-]+$" }),
  matches: Type.Array(UploadMatchV1Schema, { minItems: 5, maxItems: 100 })
});
export type CreateAnalysisRequestV1 = Static<typeof CreateAnalysisRequestV1Schema>;

export const CreateAnalysisResponseV1Schema = StrictObject({
  analysisId: Identifier,
  status: Type.Literal("queued"),
  receiptToken: Type.String({ minLength: 32, maxLength: 512 }),
  pollAfterMs: Type.Integer({ minimum: 250, maximum: 60000 }),
  inputExpiresAt: UtcTimestamp,
  managementExpiresAt: UtcTimestamp
});
export type CreateAnalysisResponseV1 = Static<typeof CreateAnalysisResponseV1Schema>;

export const RecoverAnalysisRequestV1Schema = StrictObject({
  idempotencyKey: Type.String({ pattern: "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$" })
});
export type RecoverAnalysisRequestV1 = Static<typeof RecoverAnalysisRequestV1Schema>;

export const RecoverAnalysisResponseV1Schema = StrictObject({
  analysisId: Identifier,
  receiptToken: Type.String({ minLength: 32, maxLength: 512 }),
  pollAfterMs: Type.Integer({ minimum: 250, maximum: 60000 }),
  managementExpiresAt: UtcTimestamp
});
export type RecoverAnalysisResponseV1 = Static<typeof RecoverAnalysisResponseV1Schema>;

const ShareSchema = StrictObject({ url: Type.String({ minLength: 1, maxLength: 2048, pattern: "^https://" }), expiresAt: UtcTimestamp });
const ErrorSchema = StrictObject({ code: Type.String({ minLength: 1, maxLength: 64, pattern: "^[A-Z0-9_]+$" }), retryable: Type.Boolean() });
export const AnalysisStatusV1Schema = Type.Union([
  StrictObject({ analysisId: Identifier, status: Type.Union([Type.Literal("accepted"), Type.Literal("queued"), Type.Literal("processing"), Type.Literal("validating"), Type.Literal("retry_wait")]), stage: Type.Optional(Type.String({ minLength: 1, maxLength: 64 })), pollAfterMs: Type.Integer({ minimum: 250, maximum: 60000 }) }),
  StrictObject({ analysisId: Identifier, status: Type.Literal("completed"), share: ShareSchema }),
  StrictObject({ analysisId: Identifier, status: Type.Literal("failed"), error: ErrorSchema }),
  StrictObject({ analysisId: Identifier, status: Type.Union([Type.Literal("expired"), Type.Literal("deleted")]) })
]);
export type AnalysisStatusV1 = Static<typeof AnalysisStatusV1Schema>;

const CountSchema = StrictObject({ queueId: Type.Integer({ minimum: 0, maximum: 10000 }), count: Type.Integer({ minimum: 1, maximum: 100 }) });
const DimensionSchema = StrictObject({
  code: Identifier,
  score: Type.Number({ minimum: 0, maximum: 100 }),
  evidenceCodes: Type.Array(Identifier, { minItems: 1, maxItems: 20, uniqueItems: true }),
  explanation: SafeText
});
export const LbtiReportV1Schema = StrictObject({
  resultVersion: Type.Literal(1),
  typeCode: Identifier,
  title: SafeText,
  confidence: Type.Number({ minimum: 0, maximum: 1 }),
  sample: StrictObject({ matchCount: Type.Integer({ minimum: 5, maximum: 100 }), queues: Type.Array(CountSchema, { minItems: 1, maxItems: 100 }), from: UtcTimestamp, to: UtcTimestamp }),
  dimensions: Type.Array(DimensionSchema, { maxItems: 20 }),
  summary: SafeText,
  strengths: Type.Array(SafeText, { maxItems: 10 }),
  risks: Type.Array(SafeText, { maxItems: 10 }),
  recommendations: Type.Array(SafeText, { maxItems: 10 }),
  limitations: Type.Array(SafeText, { minItems: 1, maxItems: 10 }),
  generatedAt: UtcTimestamp
});
export type LbtiReportV1 = Static<typeof LbtiReportV1Schema>;

export class ContractValidationError extends Error {
  readonly issues: string[];
  constructor(issues: string[]) { super(`Contract validation failed: ${issues.join("; ")}`); this.name = "ContractValidationError"; this.issues = issues; }
}

export function assertSchema<T extends TSchema>(schema: T, value: unknown): asserts value is Static<T> {
  const issues = [...Value.Errors(schema, value)].map((error) => `${error.path || "/"}: ${error.message}`);
  if (issues.length) throw new ContractValidationError(issues);
}
