import { assertSchema, LbtiReportV1Schema, type LbtiReportV1 } from "@lol-sbti/contracts";

export type ReportFailure = "invalid" | "gone" | "api";
export class ReportRequestError extends Error {
  constructor(readonly kind: ReportFailure) { super(kind); }
}

export function readFragmentSecret(hash: string): string | null {
  if (!hash.startsWith("#")) return null;
  const secret = hash.slice(1);
  return /^[A-Za-z0-9_-]{32,512}$/.test(secret) ? secret : null;
}

async function classify(response: Response): Promise<never> {
  throw new ReportRequestError(response.status === 410 ? "gone" : response.status === 404 ? "invalid" : "api");
}

export async function exchangeSecret(publicId: string, secret: string, fetcher: typeof fetch = fetch): Promise<void> {
  const response = await fetcher("/v1/share-sessions", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ publicId, secret })
  });
  if (!response.ok) await classify(response);
}

export async function fetchReport(publicId: string, fetcher: typeof fetch = fetch): Promise<LbtiReportV1> {
  const response = await fetcher(`/v1/public/reports/${encodeURIComponent(publicId)}`, {
    credentials: "same-origin",
    cache: "no-store"
  });
  if (!response.ok) await classify(response);
  try {
    const report: unknown = await response.json();
    assertSchema(LbtiReportV1Schema, report);
    return report;
  } catch {
    throw new ReportRequestError("api");
  }
}
