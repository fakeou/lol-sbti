import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import { contentSecurityPolicy, reportSecurityHeaders } from "../middleware";

describe("report response security", () => {
  it("builds a per-request-compatible nonce policy without unsafe inline scripts", () => {
    const policy = contentSecurityPolicy("unique-nonce");
    expect(policy).toContain("script-src 'self' 'nonce-unique-nonce' 'strict-dynamic'");
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it("defines strict no-leak headers while leaving CSP dynamic", () => {
    const values = Object.fromEntries(reportSecurityHeaders.map(({ key, value }) => [key.toLowerCase(), value]));
    expect(values["referrer-policy"]).toBe("no-referrer");
    expect(values["cache-control"]).toContain("no-store");
    expect(values["x-robots-tag"]).toContain("noindex");
    expect(nextConfig.headers).toBeUndefined();
  });
});
