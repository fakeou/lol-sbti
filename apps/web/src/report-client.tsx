"use client";

import type { LbtiReportV1 } from "@lol-sbti/contracts";
import React, { useEffect, useState } from "react";
import { exchangeSecret, fetchReport, readFragmentSecret, ReportRequestError, type ReportFailure } from "./report-api";

type View = { state: "loading" } | { state: "error"; kind: ReportFailure } | { state: "ready"; report: LbtiReportV1 };
const queueNames: Record<number, string> = { 420: "单双排", 440: "灵活排位", 450: "极地大乱斗" };
const dimensionNames: Record<string, string> = { aggression: "进攻倾向", teamwork: "团队协作", consistency: "稳定程度", resilience: "逆风韧性", vision: "视野控制" };
const date = (value: string) => new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(new Date(value));

export function ReportClient({ publicId }: { publicId: string }) {
  const [view, setView] = useState<View>({ state: "loading" });
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const secret = readFragmentSecret(window.location.hash);
        if (secret) {
          await exchangeSecret(publicId, secret);
          history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
        } else if (window.location.hash) {
          history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
          throw new ReportRequestError("invalid");
        }
        const report = await fetchReport(publicId);
        if (active) setView({ state: "ready", report });
      } catch (error) {
        if (active) setView({ state: "error", kind: error instanceof ReportRequestError ? error.kind : "api" });
      }
    })();
    return () => { active = false; };
  }, [publicId]);

  if (view.state === "loading") return <Loading />;
  if (view.state === "error") return <ErrorView kind={view.kind} />;
  return <Report report={view.report} />;
}

function Header() {
  return <header className="top"><a className="brand" href="#main" aria-label="LOL-SBTI，跳至报告">LOL<span>—</span>SBTI</a><p><b aria-hidden="true">●</b> 临时报告 · 请勿公开转发</p></header>;
}
function Loading() {
  return <><Header /><main id="main" className="shell" aria-busy="true" aria-live="polite"><p className="eyebrow">正在建立安全会话</p><h1>正在打开临时报告…</h1><div className="skeleton" /><div className="skeleton short" /><p className="muted">验证完成后，报告会自动显示。</p></main></>;
}
function ErrorView({ kind }: { kind: ReportFailure }) {
  const gone = kind === "gone", api = kind === "api";
  return <><Header /><main id="main" className="shell error" role="main"><p className="error-code" aria-hidden="true">{gone ? "410" : api ? "!" : "404"}</p><p className="eyebrow">报告不可用</p><h1>{gone ? "这份报告已过期或被撤销" : api ? "暂时无法载入报告" : "链接无效或已失效"}</h1><p>{gone ? "为了保护你的数据，这份临时报告无法恢复。你可以回到桌面端重新生成。" : api ? "服务暂时没有响应。请稍后刷新页面重试。" : "请确认你使用了完整的临时链接。出于安全考虑，我们不会说明链接的哪一部分有误。"}</p>{api && <button onClick={() => location.reload()}>重新载入</button>}</main></>;
}
function SectionList({ title, items, ordered = false }: { title: string; items: string[]; ordered?: boolean }) {
  if (!items.length) return <section className="card insufficient"><h2>{title}</h2><p>此部分样本信息不足，未生成结论。</p></section>;
  const Tag = ordered ? "ol" : "ul";
  return <section className="card"><h2>{title}</h2><Tag>{items.map((item, i) => <li key={i}>{item}</li>)}</Tag></section>;
}
export function Report({ report }: { report: LbtiReportV1 }) {
  return <><Header /><main id="main" className="shell report"><section className="hero" aria-labelledby="report-title"><p className="eyebrow">你的 LBTI 类型</p><h1 id="report-title"><span>{report.typeCode}</span> {report.title}</h1><p className="summary">{report.summary}</p><dl className="facts"><div><dt>可信度</dt><dd>{Math.round(report.confidence * 100)}%</dd></div><div><dt>分析样本</dt><dd>{report.sample.matchCount} 场</dd></div><div><dt>样本区间</dt><dd>{date(report.sample.from)}—{date(report.sample.to)}</dd></div></dl></section><div className="grid"><section className="card dimensions"><h2>维度画像</h2>{report.dimensions.length ? report.dimensions.map(d => <div className="dimension" key={d.code}><div><h3>{dimensionNames[d.code] ?? d.code}</h3><strong>{Math.round(d.score)} / 100</strong></div><progress max="100" value={d.score} aria-label={`${dimensionNames[d.code] ?? d.code}：${Math.round(d.score)} 分`} /><p>{d.explanation}</p></div>) : <p>维度样本不足，未生成评分。</p>}</section><aside className="card sample"><h2>样本构成</h2><ul>{report.sample.queues.map(q => <li key={q.queueId}><span>{queueNames[q.queueId] ?? `队列 ${q.queueId}`}</span><strong>{q.count} 场</strong></li>)}</ul><p>生成于 <time dateTime={report.generatedAt}>{date(report.generatedAt)}</time></p></aside></div><div className="split"><SectionList title="你的优势" items={report.strengths} /><SectionList title="需要留意" items={report.risks} /></div><SectionList title="下一局可以尝试" items={report.recommendations} ordered /><section className="notice"><h2>局限与免责声明</h2>{report.limitations.map((x, i) => <p key={i}>{x}</p>)}<p>这是基于有限战绩与 AI 归纳的娱乐性报告，不代表现实人格、心理诊断或官方评级。</p></section></main><footer>LOL-SBTI · 临时、只读、重视隐私</footer></>;
}
