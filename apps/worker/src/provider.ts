import { request as httpsRequest } from "node:https";
import type { RequestOptions } from "node:https";
import type { AnalysisSkill } from "@lol-sbti/analysis-skill";
import type { AggregateMetricsV1 } from "@lol-sbti/domain";

export interface ProviderResult {
  value: unknown;
  provider: string;
  modelId: string;
}

export interface AnalysisProvider {
  analyze(
    metrics: AggregateMetricsV1,
    skill: AnalysisSkill,
    signal: AbortSignal,
  ): Promise<ProviderResult>;
}

export class ProviderError extends Error {
  constructor(
    readonly code:
      | "MODEL_TIMEOUT"
      | "MODEL_RATE_LIMITED"
      | "MODEL_TEMPORARILY_UNAVAILABLE"
      | "MODEL_SCHEMA_INVALID"
      | "MODEL_AUTH_FAILED",
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = "ProviderError";
  }
}

export class FakeProvider implements AnalysisProvider {
  async analyze(
    metrics: AggregateMetricsV1,
    _skill: AnalysisSkill,
    _signal: AbortSignal,
  ) {
    return {
      provider: "fake",
      modelId: "deterministic-local",
      value: {
        resultVersion: 1,
        typeCode: metrics.classification.typeCode,
        title: metrics.classification.typeCode === "unclassified" ? "暂未匹配称号" : "分析完成",
        confidence: 0.5,
        sample: {
          matchCount: metrics.sample.matchCount,
          queues: metrics.sample.queues,
          from: metrics.sample.from,
          to: metrics.sample.to,
        },
        dimensions: metrics.classification.dimensions,
        summary: "基于聚合数据的确定性本地分析结果。",
        strengths: [],
        risks: [],
        recommendations: [],
        limitations: [
          "本报告基于有限对局统计生成，仅供娱乐参考，不代表专业评价或真实人格判断。",
        ],
        generatedAt: "2026-01-01T00:00:00Z",
      },
    };
  }
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const OUTPUT_MAX_TOKENS = 4096;
const OUTPUT_CONSTRAINTS =
  "这是严格的短输出任务：只输出一个完整、紧凑的 JSON 对象，不要 Markdown、代码围栏、解释或额外文字。不得添加 schema 外字段。dimensions 必须恰好 6 项；strengths、risks、recommendations 必须全部为空数组；limitations 必须只有 1 项；summary 不超过 40 个汉字；每个 dimension.explanation 不超过 20 个汉字；title 不超过 20 个汉字。所有字符串都要简短，确保 JSON 在输出结束前完整闭合。";

function readPositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseProviderEndpoint(value: string): URL {
  if (CONTROL_CHARACTERS.test(value)) {
    throw new Error("PROVIDER_ENDPOINT must not contain control characters");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    throw new Error("PROVIDER_ENDPOINT must be a valid HTTPS URL");
  }

  if (endpoint.protocol !== "https:") {
    throw new Error("PROVIDER_ENDPOINT must use HTTPS");
  }
  if (!endpoint.hostname) {
    throw new Error("PROVIDER_ENDPOINT must include a hostname");
  }
  if (endpoint.username || endpoint.password) {
    throw new Error("PROVIDER_ENDPOINT must not contain userinfo");
  }
  if (endpoint.search || endpoint.hash) {
    throw new Error("PROVIDER_ENDPOINT must not contain query or fragment");
  }

  return endpoint;
}

interface HttpsResponse {
  statusCode: number;
  body: string;
}

export class OpenAiCompatibleProvider implements AnalysisProvider {
  private readonly requestUrl: URL;

  constructor(
    endpoint: string,
    private readonly model: string,
    private readonly apiKey: string,
  ) {
    const validatedEndpoint = parseProviderEndpoint(endpoint);
    validatedEndpoint.pathname = `${validatedEndpoint.pathname.replace(/\/$/, "")}/chat/completions`;
    this.requestUrl = validatedEndpoint;
  }

  private request(body: string, signal: AbortSignal, timeoutMs: number): Promise<HttpsResponse> {
    const options: RequestOptions = {
      protocol: "https:",
      hostname: this.requestUrl.hostname,
      port: this.requestUrl.port || undefined,
      path: this.requestUrl.pathname,
      method: "POST",
      family: 4,
      servername: this.requestUrl.hostname,
      timeout: timeoutMs,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
      },
    };

    return new Promise((resolve, reject) => {
      const request = httpsRequest(options, (response) => {
        let responseBody = "";
        response.setEncoding("utf8");
        response.on("data", (chunk: string) => {
          responseBody += chunk;
        });
        response.once("error", reject);
        response.once("end", () => {
          resolve({ statusCode: response.statusCode ?? 0, body: responseBody });
        });
      });
      const abort = () => request.destroy(new Error("request aborted"));

      request.once("error", reject);
      request.setTimeout(timeoutMs, () => {
        reject(new ProviderError("MODEL_TIMEOUT", true));
        request.destroy();
      });
      if (signal.aborted) {
        abort();
      } else {
        signal.addEventListener("abort", abort, { once: true });
      }
      request.once("close", () => signal.removeEventListener("abort", abort));
      request.end(body);
    });
  }

  async analyze(
    metrics: AggregateMetricsV1,
    skill: AnalysisSkill,
    signal: AbortSignal,
  ) {
    const requestBody = JSON.stringify({
      model: this.model,
      messages: [
        { role: "system", content: `${skill.instructions}\n\n${OUTPUT_CONSTRAINTS}` },
        { role: "user", content: JSON.stringify(metrics) },
      ],
      response_format: { type: "json_object" },
      max_tokens: OUTPUT_MAX_TOKENS,
      reasoning_effort: "low",
      temperature: 0,
    });

    const timeoutMs = readPositiveInteger(process.env.PROVIDER_TIMEOUT_MS, DEFAULT_REQUEST_TIMEOUT_MS);
    let response: HttpsResponse;
    try {
      response = await this.request(requestBody, signal, timeoutMs);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      if (signal.aborted) throw new ProviderError("MODEL_TIMEOUT", true);
      throw new ProviderError("MODEL_TEMPORARILY_UNAVAILABLE", true);
    }

    if (response.statusCode === 429) {
      throw new ProviderError("MODEL_RATE_LIMITED", true);
    }
    if (response.statusCode >= 500) {
      throw new ProviderError("MODEL_TEMPORARILY_UNAVAILABLE", true);
    }
    if (response.statusCode === 401 || response.statusCode === 403) {
      throw new ProviderError("MODEL_AUTH_FAILED", false);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      // Native https.request never follows redirects, so every 3xx is rejected here.
      throw new ProviderError("MODEL_TEMPORARILY_UNAVAILABLE", false);
    }

    try {
      const body: any = JSON.parse(response.body);
      const choice = body?.choices?.[0];
      const content = choice?.message?.content;
      if (typeof content !== "string" || choice?.finish_reason === "length" || !content.trim()) {
        throw new Error("missing or incomplete content");
      }
      return {
        provider: "openai-compatible",
        modelId: this.model,
        value: JSON.parse(content),
      };
    } catch {
      throw new ProviderError("MODEL_SCHEMA_INVALID", true);
    }
  }
}
