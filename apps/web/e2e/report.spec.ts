import { expect, test } from "@playwright/test";

const secret = "s".repeat(43);

test("production CSP hydrates, exchanges fragment, persists secure cookie and sends no leaks", async ({ page, context, request }) => {
  const consoleErrors: string[] = [];
  const thirdParty: string[] = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("request", req => { if (new URL(req.url()).origin !== "http://localhost:3443") thirdParty.push(req.url()); });

  const response = await page.goto(`/r/pub_test#${secret}`);
  expect(response?.status()).toBe(200);
  const csp = response?.headers()["content-security-policy"] ?? "";
  expect(csp).toContain("script-src 'self' 'nonce-");
  expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  const nonce = /script-src 'self' 'nonce-([^']+)'/.exec(csp)?.[1];
  expect(nonce).toBeTruthy();
  const html = await response!.text();
  const inlineNonces = [...html.matchAll(/<script(?:\s[^>]*)?\snonce="([^"]+)"(?:\s[^>]*)?>/g)].map(match => match[1]);
  expect(inlineNonces.length).toBeGreaterThan(0);
  expect(inlineNonces.every(value => value === nonce)).toBe(true);

  await expect(page.getByRole("heading", { name: /冷静的战术执行者/ })).toBeVisible();
  expect(page.url()).toBe("http://localhost:3443/r/pub_test");
  const cookies = await context.cookies();
  const session = cookies.find(cookie => cookie.name === "report_session");
  expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax" });

  const log = await (await request.get("http://127.0.0.1:3444/__requests")).json();
  const exchange = log.find((entry: { url: string }) => entry.url === "/v1/share-sessions");
  const report = log.find((entry: { url: string }) => entry.url === "/v1/public/reports/pub_test");
  expect(JSON.parse(exchange.body)).toEqual({ publicId: "pub_test", secret });
  expect(report.cookie).toContain("report_session=valid");
  expect(log.every((entry: { url: string; referer: string }) => !entry.url.includes(secret) && !entry.referer.includes(secret) && !entry.referer.includes("#"))).toBe(true);
  expect(thirdParty).toEqual([]);
  expect(consoleErrors.filter(error => /content security policy|refused to/i.test(error))).toEqual([]);
});

for (const [publicId, heading] of [["missing", "链接无效或已失效"], ["gone", "这份报告已过期或被撤销"]] as const) {
  test(`API semantic state for ${publicId}`, async ({ page }) => {
    const response = await page.goto(`/r/${publicId}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  });
}
