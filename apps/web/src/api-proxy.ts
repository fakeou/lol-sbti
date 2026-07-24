import { NextRequest, NextResponse } from "next/server";

function upstreamUrl(path: string): URL | null {
  const origin = process.env.REPORT_API_ORIGIN;
  if (!origin) return null;
  try {
    const url = new URL(path, origin);
    return url.origin === new URL(origin).origin ? url : null;
  } catch {
    return null;
  }
}

export async function proxyReportApi(request: NextRequest, path: string): Promise<NextResponse> {
  const url = upstreamUrl(path);
  if (!url) return NextResponse.json({ code: "API_UNAVAILABLE" }, { status: 503 });

  try {
    const headers = new Headers();
    const contentType = request.headers.get("content-type");
    const cookie = request.headers.get("cookie");
    if (contentType) headers.set("content-type", contentType);
    if (cookie) headers.set("cookie", cookie);

    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual"
    });
    const responseHeaders = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    const setCookie = upstream.headers.get("set-cookie");
    if (upstreamType) responseHeaders.set("content-type", upstreamType);
    if (setCookie) responseHeaders.set("set-cookie", setCookie);
    responseHeaders.set("cache-control", "private, no-store");
    return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch {
    return NextResponse.json({ code: "API_UNAVAILABLE" }, { status: 503 });
  }
}
