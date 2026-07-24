(function () {
  "use strict";

  const invoke = window.__TAURI__.core.invoke;

  // ---- DOM refs ----
  const lcuStatusEl = document.getElementById("lcu-status");
  const currentUserEl = document.getElementById("current-user");
  const exportBtn = document.getElementById("export-btn");
  const exportMsg = document.getElementById("export-message");

  // ---- helpers ----
  function setStatus(el, text, cls) {
    el.textContent = text;
    el.className = "value " + (cls || "");
  }

  function showMessage(text, type) {
    exportMsg.textContent = text;
    exportMsg.className = type || "";
  }

  // ---- refresh LCU status ----
  async function refreshStatus() {
    try {
      const data = await invoke("get_lcu_status");
      // data: { connected: bool, username: string }
      if (data && data.connected) {
        setStatus(lcuStatusEl, "已连接", "online");
        currentUserEl.textContent = data.username || "—";
        exportBtn.disabled = false;
      } else {
        setStatus(lcuStatusEl, "未连接", "offline");
        currentUserEl.textContent = "—";
        exportBtn.disabled = true;
      }
    } catch (err) {
      setStatus(lcuStatusEl, "获取失败", "offline");
      currentUserEl.textContent = "—";
      exportBtn.disabled = true;
      console.error("get_lcu_status error:", err);
    }
  }

  // ---- export ----
  async function handleExport() {
    exportBtn.disabled = true;
    showMessage("正在导出，请稍候…", "info");

    try {
      const result = await invoke("export_recent_matches");
      // result: { path: string, count: number }
      if (result && result.path) {
        showMessage(
          "导出成功！文件：" + result.path + "（共 " + result.count + " 场）",
          "success"
        );
      } else {
        showMessage("导出完成，但未返回文件信息", "success");
      }
    } catch (err) {
      showMessage("导出失败：" + (err.message || String(err)), "error");
      console.error("export_recent_matches error:", err);
    } finally {
      exportBtn.disabled = false;
    }
  }

  // ---- init ----
  exportBtn.addEventListener("click", handleExport);

  // immediate refresh + poll every 5s
  refreshStatus();
  setInterval(refreshStatus, 5000);
})();
