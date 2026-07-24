import { NextRequest } from "next/server";
import { proxyReportApi } from "../../../src/api-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return proxyReportApi(request, "/v1/share-sessions");
}
