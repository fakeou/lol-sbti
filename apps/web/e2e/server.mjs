import { createServer } from "node:http";
import { spawn } from "node:child_process";

const apiPort = 3444;
const webPort = 3443;
const report = {
  resultVersion: 1, typeCode: "TACTICIAN", title: "冷静的战术执行者", confidence: .72,
  sample: { matchCount: 50, queues: [{ queueId: 420, count: 50 }], from: "2026-06-28T00:00:00Z", to: "2026-07-23T00:00:00Z" },
  dimensions: [{ code: "teamwork", score: 84, evidenceCodes: ["kp"], explanation: "你会持续参与团队资源交换。" }],
  summary: "你倾向于在信息充分后推进。", strengths: ["稳定协作"], risks: ["可能错过窗口"], recommendations: ["提前标记下一处资源"], limitations: ["样本只覆盖近期对局"], generatedAt: "2026-07-24T00:00:00Z"
};
const requests = [];
const api = createServer(async (req, res) => {
  let body = ""; for await (const chunk of req) body += chunk;
  requests.push({ method: req.method, url: req.url, cookie: req.headers.cookie ?? "", referer: req.headers.referer ?? "", body });
  if (req.method === "POST" && req.url === "/v1/share-sessions") {
    res.writeHead(204, { "Set-Cookie": "report_session=valid; Path=/; HttpOnly; Secure; SameSite=Lax" }); return res.end();
  }
  const id = req.url?.split("/").pop();
  if (req.method === "GET" && req.url?.startsWith("/v1/public/reports/")) {
    if (id === "missing") { res.writeHead(404); return res.end(); }
    if (id === "gone") { res.writeHead(410); return res.end(); }
    if (!req.headers.cookie?.includes("report_session=valid")) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(report));
  }
  if (req.url === "/__requests") { res.writeHead(200, { "content-type": "application/json" }); return res.end(JSON.stringify(requests)); }
  res.writeHead(404); res.end();
});
api.listen(apiPort, "127.0.0.1");

const child = spawn(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["exec", "next", "start", "-p", String(webPort)], {
  cwd: new URL("..", import.meta.url), shell: process.platform === "win32", stdio: "inherit",
  env: { ...process.env, REPORT_API_ORIGIN: `http://127.0.0.1:${apiPort}` }
});
const stop = () => { child.kill(); api.close(); };
process.on("SIGINT", stop); process.on("SIGTERM", stop); child.on("exit", (code) => { api.close(); process.exit(code ?? 0); });
