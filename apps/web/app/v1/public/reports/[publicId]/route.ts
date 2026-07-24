import { NextRequest } from "next/server";
import { proxyReportApi } from "../../../../../src/api-proxy";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  return proxyReportApi(request, `/v1/public/reports/${encodeURIComponent(publicId)}`);
}
