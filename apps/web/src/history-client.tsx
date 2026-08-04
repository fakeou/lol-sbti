"use client";

import type { HistoryMatchV1 } from "@lol-sbti/contracts";
import React, { useCallback, useEffect, useState } from "react";
import { championNames } from "./champion-names";

type View =
  | { state: "loading" }
  | { state: "invalid" }
  | { state: "error"; message: string }
  | { state: "ready"; matches: HistoryMatchV1[] };

const modeNames: Record<string, string> = {
  CLASSIC: "经典对局",
  ARAM: "极地大乱斗",
  URF: "无限火力",
  CHERRY: "斗魂竞技场"
};
const positionNames: Record<string, string> = {
  TOP: "上单",
  JUNGLE: "打野",
  MIDDLE: "中单",
  BOTTOM: "下路",
  UTILITY: "辅助"
};
const time = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(value));
const day = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(new Date(value));

export function HistoryClient() {
  const [view, setView] = useState<View>({ state: "loading" });
  const tokenRef = React.useRef<string | null>(null);

  const load = useCallback(async () => {
    setView({ state: "loading" });
    try {
      const fragment = tokenRef.current ?? "";
      if (!/^[A-Za-z0-9_-]{43}$/.test(fragment)) {
        setView({ state: "invalid" });
        return;
      }
      const session = await fetch("/v1/history-sessions", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ viewerToken: fragment })
      });
      if (!session.ok) {
        setView({ state: "error", message: session.status === 410 ? "此战绩链接已过期或被撤销，请回到桌面端重新打开。" : "此战绩链接无效，请确认使用了完整链接。" });
        return;
      }
      history.replaceState(null, "", "/history");
      const response = await fetch("/v1/match-history", { credentials: "same-origin" });
      if (!response.ok) {
        setView({ state: "error", message: "暂时无法载入战绩，请稍后刷新页面重试。" });
        return;
      }
      const body = (await response.json()) as { matches: HistoryMatchV1[] };
      setView({ state: "ready", matches: Array.isArray(body.matches) ? body.matches : [] });
    } catch {
      setView({ state: "error", message: "暂时无法载入战绩，请稍后刷新页面重试。" });
    }
  }, []);

  useEffect(() => {
    tokenRef.current = window.location.hash.replace(/^#/, "");
    void load();
  }, [load]);

  const clearAll = async () => {
    if (!window.confirm("确定清空云端保存的全部战绩吗？此操作不可恢复。")) return;
    try {
      const response = await fetch("/v1/match-history", { method: "DELETE", credentials: "same-origin" });
      if (!response.ok) throw new Error(String(response.status));
      await load();
    } catch {
      window.alert("清空失败，请稍后重试。");
    }
  };

  return (
    <>
      <header className="top"><a className="brand" href="#main" aria-label="LOL-SBTI，跳至战绩">LOL<span>—</span>SBTI</a><p><b aria-hidden="true">●</b> 云端战绩 · 请勿公开转发</p></header>
      <main id="main" className="shell history">
        {view.state === "loading" && <div className="card"><p className="eyebrow">CLOUD ARCHIVE</p><h1>正在打开云端战绩…</h1><div className="skeleton" /><p className="muted">验证完成后，战绩会自动显示。</p></div>}
        {view.state === "invalid" && <div className="card error"><p className="error-code" aria-hidden="true">404</p><p className="eyebrow">战绩不可用</p><h1>链接无效或已失效</h1><p>请从桌面客户端点击「查看云端战绩」重新打开，或确认使用了完整的链接。</p></div>}
        {view.state === "error" && <div className="card error"><p className="error-code" aria-hidden="true">!</p><p className="eyebrow">战绩不可用</p><h1>暂时无法载入战绩</h1><p>{view.message}</p></div>}
        {view.state === "ready" && <HistoryView matches={view.matches} onClear={clearAll} />}
      </main>
      <footer>LOL-SBTI · 云端战绩 · 可随时清空</footer>
    </>
  );
}

function HistoryView({ matches, onClear }: { matches: HistoryMatchV1[]; onClear: () => void }) {
  const won = matches.filter((match) => match.won).length;
  const winRate = matches.length ? Math.round((won / matches.length) * 100) : 0;
  const totalKills = matches.reduce((sum, match) => sum + match.kills, 0);
  const totalDeaths = matches.reduce((sum, match) => sum + match.deaths, 0);
  const totalAssists = matches.reduce((sum, match) => sum + match.assists, 0);
  const kda = totalDeaths ? ((totalKills + totalAssists) / totalDeaths).toFixed(2) : "∞";
  const modeCounts = new Map<string, number>();
  for (const match of matches) modeCounts.set(match.gameMode, (modeCounts.get(match.gameMode) ?? 0) + 1);
  const modes = [...modeCounts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <>
      <section className="card" aria-labelledby="history-title">
        <div className="section-heading"><div><p className="eyebrow">CLOUD ARCHIVE</p><h1 id="history-title">我的云端战绩</h1></div><button className="danger" onClick={onClear}>清空全部战绩</button></div>
        <dl className="facts">
          <div><dt>总场次</dt><dd>{matches.length}</dd></div>
          <div><dt>胜场</dt><dd>{won}</dd></div>
          <div><dt>胜率</dt><dd>{winRate}%</dd></div>
          <div><dt>平均 KDA</dt><dd>{kda}</dd></div>
        </dl>
        <ul className="mode-tags">{modes.map(([mode, count]) => <li key={mode}><span>{modeNames[mode] ?? mode}</span><strong>{count} 场</strong></li>)}</ul>
        {matches.length === 0 && <p className="metric-empty">还没有云端战绩。启动桌面客户端并连接英雄联盟后，战绩会自动同步到这里。</p>}
      </section>
      <section className="card" aria-label="对局列表">
        <h2>对局列表</h2>
        {matches.length === 0 ? <p className="metric-empty">暂无记录。</p> : (
          <ol className="match-list">
            {matches.map((match, index) => <li key={`${match.matchKey}-${index}`} className={match.won ? "match won" : "match lost"}>
              <div className="match-main">
                <span className="match-result" aria-hidden="true">{match.won ? "胜" : "负"}</span>
                <div className="match-champion">
                  <strong>{championNames[match.championId] ?? `英雄 ${match.championId}`}</strong>
                  <span>{positionNames[match.position ?? ""] ?? "—"} · {modeNames[match.gameMode] ?? match.gameMode}</span>
                </div>
                <div className="match-kda">
                  <strong>{match.kills}<i>/</i>{match.deaths}<i>/</i>{match.assists}</strong>
                  <span>KDA</span>
                </div>
                <dl className="match-stats">
                  <div><dt>补刀</dt><dd>{match.cs}</dd></div>
                  <div><dt>金币</dt><dd>{match.gold.toLocaleString()}</dd></div>
                  <div><dt>伤害</dt><dd>{match.championDamage.toLocaleString()}</dd></div>
                  <div><dt>视野</dt><dd>{match.visionScore}</dd></div>
                  <div><dt>时长</dt><dd>{Math.floor(match.durationSeconds / 60)}:{String(match.durationSeconds % 60).padStart(2, "0")}</dd></div>
                </dl>
              </div>
              <div className="match-meta">
                <time dateTime={match.occurredAt}>{day(match.occurredAt)}</time><span>{time(match.occurredAt)}</span>
                <ul className="item-list" aria-label="装备">{match.items.map((item) => <li key={item} title={`装备 ${item}`}>{item}</li>)}</ul>
              </div>
            </li>)}
          </ol>
        )}
      </section>
    </>
  );
}
