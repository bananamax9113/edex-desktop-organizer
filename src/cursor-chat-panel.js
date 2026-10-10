/* Cursor Agent chat mirror — compose, alerts, terminal, edits */

(function () {
  const POLL_MS = 800;
  const FONT_MIN = 0.9;
  const FONT_MAX = 2.2;
  const FONT_STEP = 0.1;
  const FONT_DEFAULT = 1.45;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function langFromPath(filePath) {
    const ext = String(filePath || "").split(".").pop()?.toLowerCase() || "";
    const map = {
      js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
      ts: "typescript", tsx: "typescript",
      css: "css", scss: "css", less: "css",
      html: "html", htm: "html",
      json: "json", md: "markdown", py: "python",
      ps1: "powershell", sh: "shell", bash: "shell",
      go: "go", rs: "rust", java: "java",
      c: "c", h: "c", cpp: "cpp", hpp: "cpp",
      yml: "yaml", yaml: "yaml", sql: "sql", xml: "xml"
    };
    return map[ext] || ext || "text";
  }

  const KW = {
    javascript: /\b(const|let|var|function|return|if|else|for|while|class|new|this|async|await|import|export|from|default|try|catch|throw|typeof|instanceof|of|in|switch|case|break|continue|null|undefined|true|false)\b/g,
    typescript: /\b(const|let|var|function|return|if|else|for|while|class|new|this|async|await|import|export|from|default|try|catch|throw|typeof|interface|type|extends|implements|public|private|protected|readonly|null|undefined|true|false)\b/g,
    python: /\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|raise|with|yield|async|await|True|False|None|and|or|not|in|is|pass|lambda)\b/g,
    css: /\b(important|from|to|var|rgb|rgba|hsl|url)\b/g,
    json: /\b(true|false|null)\b/g,
    shell: /\b(if|then|else|fi|for|do|done|in|case|esac|function|return|export|local|echo|cd|ls|cat|grep)\b/g,
    powershell: /\b(function|param|if|else|elseif|foreach|for|while|return|switch|try|catch|throw|New-Object|Write-Output|Write-Host|\$true|\$false|\$null)\b/gi,
    go: /\b(func|return|if|else|for|range|package|import|var|const|type|struct|interface|map|chan|go|defer|nil|true|false)\b/g,
    rust: /\b(fn|let|mut|return|if|else|for|while|loop|match|struct|enum|impl|trait|pub|use|mod|crate|self|Self|true|false|Some|None)\b/g,
    sql: /\b(SELECT|FROM|WHERE|AND|OR|INSERT|INTO|UPDATE|SET|DELETE|JOIN|LEFT|RIGHT|INNER|ON|AS|ORDER|BY|GROUP|LIMIT|VALUES|CREATE|TABLE|INDEX|NULL|NOT|TRUE|FALSE)\b/gi
  };

  function highlightCode(code, lang) {
    const src = String(code || "");
    const hashComment = lang === "python" || lang === "shell" || lang === "powershell" || lang === "yaml";
    const patterns = [];
    if (hashComment) {
      patterns.push({ type: "cmt", re: /#.*/g });
    } else {
      patterns.push({ type: "cmt", re: /\/\/.*|\/\*[\s\S]*?\*\//g });
    }
    patterns.push({ type: "str", re: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g });
    patterns.push({ type: "num", re: /\b\d+\.?\d*\b/g });

    const marks = [];
    for (const p of patterns) {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(src))) {
        marks.push({ start: m.index, end: m.index + m[0].length, type: p.type });
      }
    }
    marks.sort((a, b) => a.start - b.start || b.end - a.end);
    const taken = [];
    for (const mark of marks) {
      if (taken.some((t) => !(mark.end <= t.start || mark.start >= t.end))) continue;
      taken.push(mark);
    }

    const kwSrc = KW[lang] || (lang === "text" || lang === "markdown" ? null : KW.javascript);
    let out = "";
    let i = 0;
    const emitPlain = (chunk) => {
      if (!chunk) return "";
      let piece = esc(chunk);
      if (lang === "html" || lang === "xml") {
        piece = piece
          .replace(/(&lt;\/?)([\w-]+)/g, "$1<span class=\"tok-tag\">$2</span>")
          .replace(/\s([\w-:]+)=/g, " <span class=\"tok-attr\">$1</span>=");
      } else if (lang === "css") {
        piece = piece
          .replace(/(^|[\n{;]\s*)([.#]?[\w-]+)(?=\s*[{,])/g, "$1<span class=\"tok-sel\">$2</span>")
          .replace(/([\w-]+)(\s*:)/g, "<span class=\"tok-prop\">$1</span>$2");
      }
      if (kwSrc) {
        const kwRe = new RegExp(kwSrc.source, kwSrc.flags);
        piece = piece.replace(kwRe, "<span class=\"tok-kw\">$&</span>");
      }
      piece = piece.replace(/\b([A-Za-z_][\w]*)(?=\s*\()/g, "<span class=\"tok-fn\">$1</span>");
      return piece;
    };

    for (const mark of taken.sort((a, b) => a.start - b.start)) {
      if (mark.start < i) continue;
      out += emitPlain(src.slice(i, mark.start));
      const cls = mark.type === "cmt" ? "tok-cmt" : mark.type === "str" ? "tok-str" : "tok-num";
      out += `<span class="${cls}">${esc(src.slice(mark.start, mark.end))}</span>`;
      i = mark.end;
    }
    out += emitPlain(src.slice(i));
    return out;
  }

  function renderCodeBlock(code, lang, pathHint) {
    // Show full code from dialog (no artificial truncation for display)
    const body = String(code || "");
    const file = pathHint ? basename(pathHint) : "";
    return `<div class="cc-turn code">
      ${file ? `<div class="cc-code-path" title="${esc(pathHint || "")}">${esc(file)}</div>` : ""}
      <pre class="cc-code" data-lang="${esc(lang || "text")}"><code>${highlightCode(body, lang || "text")}</code></pre>
    </div>`;
  }

  function renderRichText(text) {
    const raw = String(text || "");
    const parts = [];
    const fence = /```([\w+-]*)\r?\n?([\s\S]*?)```/g;
    let last = 0;
    let m;
    let hasCode = false;
    while ((m = fence.exec(raw))) {
      hasCode = true;
      if (m.index > last) {
        const prose = raw.slice(last, m.index).trim();
        if (prose) parts.push(`<span class="cc-plain">${esc(prose)}</span>`);
      }
      const lang = (m[1] || "text").toLowerCase() || "text";
      // Full fenced code from assistant feedback
      parts.push(`<pre class="cc-code inline"><code>${highlightCode(m[2], lang)}</code></pre>`);
      last = m.index + m[0].length;
    }
    if (!hasCode) {
      return `<span class="cc-plain">${esc(raw.slice(0, 4000))}</span>`;
    }
    if (last < raw.length) {
      const prose = raw.slice(last).trim();
      if (prose) parts.push(`<span class="cc-plain">${esc(prose.slice(0, 2000))}</span>`);
    }
    return parts.join("") || `<span class="cc-plain">${esc(raw.slice(0, 4000))}</span>`;
  }

  function bodyHtml() {
    return `
      <div id="mod_cursor_chat" class="cc-root">
        <div class="cc-head">
          <span class="cc-title">CURSOR LINK</span>
          <span class="cc-meta">
            <em data-cc="mode">—</em>
            <em data-cc="model">—</em>
          </span>
          <span class="cc-font-tools">
            <button type="button" class="cc-font-btn" data-cc-font="-1" title="縮小字體">A−</button>
            <em data-cc="fontlabel">1.45×</em>
            <button type="button" class="cc-font-btn" data-cc-font="1" title="放大字體">A+</button>
          </span>
          <span class="cc-status" data-cc="status">IDLE</span>
        </div>
        <div class="cc-project-bar" data-cc="projectbar" title="">
          <span class="cc-project-label">PROJECT</span>
          <span class="cc-project" data-cc="project">—</span>
          <span class="cc-project-path" data-cc="projectpath"></span>
        </div>
        <div class="cc-alerts" data-cc="alerts" hidden></div>
        <div class="cc-tabs-row">
          <div class="cc-tabs" data-cc="tabs" title="選擇對話標籤"></div>
          <button type="button" class="cc-new-tab" data-cc-new title="新增對話">+</button>
        </div>
        <div class="cc-split">
          <div class="cc-context-block">
            <div class="cc-label-row">
              <div class="cc-label">CONTEXT · 當前對話上下文</div>
              <span class="cc-count" data-cc="ctxcount">0</span>
            </div>
            <div class="cc-context" data-cc="context"></div>
          </div>
          <div class="cc-term-block">
            <div class="cc-label-row">
              <div class="cc-label">TERMINAL · 當前終端</div>
              <span class="cc-term-meta" data-cc="termmeta">—</span>
            </div>
            <div class="cc-term-tabs" data-cc="termtabs"></div>
            <pre class="cc-term-out" data-cc="termout"></pre>
            <div class="cc-term-actions">
              <input class="cc-term-input" data-cc="terminput" type="text" placeholder="輸入終端命令…" autocomplete="off" spellcheck="false" />
              <button type="button" class="cc-term-btn" data-cc-term-send title="送入 Cursor 終端">執行</button>
              <button type="button" class="cc-term-btn danger" data-cc-term-stop title="停止當前終端進程">停止</button>
            </div>
          </div>
        </div>
        <div class="cc-attach" data-cc="attach"></div>
        <div class="cc-compose-block">
          <div class="cc-label-row">
            <div class="cc-label">COMPOSE · 輸入並發送到 Cursor</div>
            <span class="cc-hint" data-cc="sendhint">Ctrl+Enter 發送</span>
          </div>
          <textarea class="cc-compose" data-cc="compose" rows="4" placeholder="在此輸入要發送到 Cursor 當前對話的內容…"></textarea>
          <div class="cc-compose-actions">
            <button type="button" class="cc-send-btn" data-cc-send>發送到 Cursor</button>
          </div>
        </div>
        <div class="cc-foot">
          <span data-cc="updated">未聯動</span>
          <span data-cc="tabtitle">—</span>
        </div>
      </div>`;
  }

  function statusLabel(raw) {
    const s = String(raw || "idle").toLowerCase();
    if (s === "submitted" || s === "outbound") return "SENT";
    if (s === "replied") return "REPLY";
    if (s === "session") return "SESSION";
    if (s === "completed") return "DONE";
    if (s === "aborted") return "ABORT";
    if (s === "error") return "ERROR";
    if (s === "blocked") return "BLOCKED";
    if (s === "editing") return "EDIT";
    if (s === "ended") return "END";
    if (s === "sending") return "SEND";
    return s.toUpperCase() || "IDLE";
  }

  function fmtTime(ts) {
    if (!ts) return "—";
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return "—";
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  }

  function shortId(id) {
    const value = String(id || "");
    return value ? value.slice(0, 8) : "—";
  }

  function clampFont(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return FONT_DEFAULT;
    return Math.max(FONT_MIN, Math.min(FONT_MAX, Math.round(n * 10) / 10));
  }

  function readFontScale(appState) {
    const raw = appState?.layout?.cursorChat?.fontScale;
    return clampFont(raw == null ? FONT_DEFAULT : raw);
  }

  function applyFontScale(root, scale) {
    if (!root) return;
    const next = clampFont(scale);
    root.style.setProperty("--cc-scale", String(next));
    const label = root.querySelector('[data-cc="fontlabel"]');
    if (label) label.textContent = `${next.toFixed(1)}×`;
  }

  function basename(p) {
    const s = String(p || "").replace(/[/\\]+$/, "");
    const parts = s.split(/[/\\]/);
    return parts[parts.length - 1] || s;
  }

  function renderTabs(root, data) {
    const tabsEl = root.querySelector('[data-cc="tabs"]');
    if (!tabsEl) return;
    const tabs = Array.isArray(data.tabs) ? data.tabs : [];
    if (!tabs.length) {
      tabsEl.innerHTML = `<div class="cc-tab empty">尚無對話標籤</div>`;
      return;
    }
    const selected = data.selectedId || data.activeId || "";
    tabsEl.innerHTML = tabs
      .map((tab) => {
        const on = tab.id === selected || tab.selected ? " on" : "";
        const live = tab.active ? " live" : "";
        const pending = String(tab.id || "").startsWith("pending-") ? " pending" : "";
        return `<button type="button" class="cc-tab${on}${live}${pending}" data-cc-tab="${esc(tab.id)}" title="${esc(tab.title || tab.id)}">
          <b>${esc(tab.title || shortId(tab.id))}</b>
          <i>${pending ? "NEW" : esc(shortId(tab.id))}</i>
        </button>`;
      })
      .join("");
  }

  const CLIENT_USAGE_RE =
    /usage\s*limit|rate\s*limit|quota|exceeded|out of (requests|credits)|you've?\s+hit|hit\s+your|spend\s*limit|用量|額度|超出|無法繼續|无法继续|用尽|用盡|配额|配額|【已停止】/i;

  function renderAlerts(root, data) {
    const box = root.querySelector('[data-cc="alerts"]');
    if (!box) return;
    const alerts = Array.isArray(data.alerts) ? data.alerts : [];
    const usage = data.contextUsage;
    const rows = [...alerts];

    // Live context-window banner (淺紅色淨高提示)
    if (usage && Number(usage.percent) >= 75) {
      const pct = Math.round(Number(usage.percent));
      const critical = pct >= 90;
      if (!rows.some((a) => a.id === "ctx-usage-live" || a.source === "preCompact")) {
        rows.unshift({
          id: "ctx-usage-live",
          level: critical ? "error" : "warn",
          kind: "context",
          message: critical
            ? `上下文已使用約 ${pct}% —— 接近上限，對話可能被壓縮或無法繼續。`
            : `上下文已使用約 ${pct}%`,
          at: usage.at || Date.now()
        });
      }
    }

    // Status / reply based stop-usage tip (hooks may miss some Cursor UI-only stops)
    const status = String(data.status || "").toLowerCase();
    const replyText = String(data.reply || "");
    const blocked =
      status === "blocked" ||
      CLIENT_USAGE_RE.test(replyText) ||
      rows.some((a) => a.level === "error" && CLIENT_USAGE_RE.test(a.message || ""));
    if (blocked && !rows.some((a) => a.kind === "usage-stop" || /【已停止】|用量超出/.test(a.message || ""))) {
      rows.unshift({
        id: "usage-stop-live",
        level: "error",
        kind: "usage-stop",
        message: "【已停止】用量超出或無法繼續對話。請稍後重試、開新對話，或檢查 Cursor 方案／帳單。",
        at: Date.now()
      });
    }

    if (!rows.length) {
      box.innerHTML = "";
      box.hidden = true;
      root.classList.remove("has-alert", "has-usage-stop");
      return;
    }
    box.hidden = false;
    root.classList.add("has-alert");
    root.classList.toggle(
      "has-usage-stop",
      rows.some((a) => a.kind === "usage-stop" || a.level === "error")
    );
    box.innerHTML = rows
      .slice(-8)
      .map((a) => {
        const level = a.level === "warn" ? "warn" : "error";
        const kind = a.kind === "context" ? " context" : a.kind === "usage-stop" ? " usage-stop" : "";
        const label =
          a.kind === "usage-stop" || /【已停止】|用量/.test(a.message || "")
            ? "STOP"
            : a.kind === "context" || /上下文/.test(a.message || "")
              ? "CTX"
              : level === "error"
                ? "!"
                : "i";
        const ephemeral = !a.id || a.id === "ctx-usage-live" || a.id === "usage-stop-live";
        return `<div class="cc-alert ${level}${kind}" data-alert-id="${esc(a.id || "")}">
          <b>${label}</b>
          <span>${esc(a.message || "")}</span>
          ${!ephemeral ? `<button type="button" class="cc-alert-x" data-cc-alert-dismiss="${esc(a.id)}" title="關閉">×</button>` : ""}
        </div>`;
      })
      .join("");
  }

  function renderContext(root, data) {
    const box = root.querySelector('[data-cc="context"]');
    const count = root.querySelector('[data-cc="ctxcount"]');
    if (!box) return;
    const context = Array.isArray(data.context) ? data.context : [];
    if (count) count.textContent = String(context.length);
    if (!context.length) {
      box.innerHTML = `<div class="cc-empty">此對話尚無上下文。從下方輸入並發送到 Cursor 後會同步。</div>`;
      return;
    }
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 48;
    box.innerHTML = context
      .map((t) => {
        if (t.role === "code" || t.role === "edit") {
          const lang = t.lang || langFromPath(t.path);
          return renderCodeBlock(t.text, lang, t.path);
        }
        const role = t.role === "assistant" ? "AI" : "YOU";
        const cls = t.role === "assistant" ? "ai" : "user";
        const body = t.role === "assistant"
          ? renderRichText(t.text)
          : `<span class="cc-plain">${esc(String(t.text || "").slice(0, 2000))}</span>`;
        return `<div class="cc-turn ${cls}"><b>${role}</b><div class="cc-body">${body}</div></div>`;
      })
      .join("");
    if (nearBottom) box.scrollTop = box.scrollHeight;
  }

  function renderAttach(root, data) {
    const el = root.querySelector('[data-cc="attach"]');
    if (!el) return;
    const list = Array.isArray(data.attachments) ? data.attachments.filter((a) => a?.path) : [];
    if (!list.length) {
      el.innerHTML = "";
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.innerHTML = `<div class="cc-label">ATTACH · 標籤／附件</div>` + list
      .map((a) => {
        const name = String(a.path).split(/[/\\]/).pop();
        const kind = a.type || "file";
        return `<span class="cc-chip" title="${esc(a.path)}">${esc(kind)} · ${esc(name)}</span>`;
      })
      .join("");
  }

  function selectedTerminal(root, data) {
    const terms = Array.isArray(data.terminals) ? data.terminals : [];
    const prefer = root.dataset.termId || "";
    return terms.find((t) => t.id === prefer) || terms.find((t) => t.running) || terms[0] || null;
  }

  function renderTerminal(root, data) {
    const tabs = root.querySelector('[data-cc="termtabs"]');
    const out = root.querySelector('[data-cc="termout"]');
    const meta = root.querySelector('[data-cc="termmeta"]');
    const terms = Array.isArray(data.terminals) ? data.terminals : [];
    const term = selectedTerminal(root, data);
    if (term) root.dataset.termId = term.id;
    else delete root.dataset.termId;

    if (tabs) {
      if (!terms.length) {
        tabs.innerHTML = `<span class="cc-term-empty">無活動終端</span>`;
      } else {
        tabs.innerHTML = terms
          .map((t) => {
            const on = term && t.id === term.id ? " on" : "";
            const run = t.running ? " run" : "";
            const label = t.lastCommand
              ? String(t.lastCommand).slice(0, 28)
              : `T${t.id}`;
            return `<button type="button" class="cc-term-tab${on}${run}" data-cc-term="${esc(t.id)}" title="${esc(t.cwd || "")}">
              <b>${esc(label)}</b>
              <i>${t.running ? "RUN" : "IDLE"} · ${esc(String(t.pid || "—"))}</i>
            </button>`;
          })
          .join("");
      }
    }

    if (meta) {
      if (!term) meta.textContent = "—";
      else {
        const cwd = term.cwd ? basename(term.cwd) : "—";
        meta.textContent = `${term.running ? "RUN" : "IDLE"} · PID ${term.pid || "—"} · ${cwd}`;
        meta.title = term.cwd || "";
      }
    }

    if (out) {
      const text = term?.output || (terms.length ? "" : "等待 Cursor 終端輸出…\n（在 Cursor 中開啟終端後會自動同步）");
      const stick = out.scrollHeight - out.scrollTop - out.clientHeight < 40;
      out.textContent = text;
      if (stick) out.scrollTop = out.scrollHeight;
    }
  }

  function render(root, data) {
    if (!root || !data) return;
    const set = (key, text) => {
      const el = root.querySelector(`[data-cc="${key}"]`);
      if (el) el.textContent = text;
    };
    set("status", statusLabel(data.status));
    set("mode", data.mode ? String(data.mode).toUpperCase() : "—");
    set("model", data.model || "—");

    const projectName = data.projectName || data.projectFolder || data.projectSlug || "—";
    const projectEl = root.querySelector('[data-cc="project"]');
    const pathEl = root.querySelector('[data-cc="projectpath"]');
    const bar = root.querySelector('[data-cc="projectbar"]');
    if (projectEl) projectEl.textContent = projectName;
    if (pathEl) pathEl.textContent = data.projectPath || "";
    if (bar) bar.title = data.projectPath || data.projectSlug || projectName;

    set("updated", data.updatedAt ? `SYNC ${fmtTime(data.updatedAt)}` : "未聯動");
    const tab = (data.tabs || []).find((t) => t.id === data.selectedId) ||
      (data.tabs || []).find((t) => t.active);
    set("tabtitle", tab ? tab.title : shortId(data.selectedId || data.conversationId));

    renderAlerts(root, data);
    renderTabs(root, data);
    renderContext(root, data);
    renderAttach(root, data);
    renderTerminal(root, data);
    root.dataset.status = String(data.status || "idle");
    root.dataset.selectedId = data.selectedId || data.activeId || "";
    root._lastData = data;
  }

  function fingerprint(data) {
    if (!data) return "";
    const alertFp = (data.alerts || []).map((a) => `${a.id}:${a.at}`).join(",");
    const termFp = (data.terminals || [])
      .map((t) => `${t.id}:${t.updatedAt}:${(t.output || "").length}:${t.running ? 1 : 0}`)
      .join(",");
    const ctxTail = (data.context || [])
      .slice(-3)
      .map((t) => `${t.role}:${String(t.text || "").length}:${t.path || ""}`)
      .join(";");
    const tabFp = (data.tabs || []).map((t) => `${t.id}:${t.selected ? 1 : 0}`).join(",");
    return [
      data.updatedAt || 0,
      data.selectedId || "",
      data.activeId || "",
      data.projectName || "",
      data.status || "",
      (data.tabs || []).length,
      tabFp,
      (data.context || []).length,
      alertFp,
      termFp,
      ctxTail,
      data.contextUsage?.percent || ""
    ].join("|");
  }

  function toast(msg) {
    if (typeof window.toast === "function") window.toast(msg);
  }

  async function sendCompose(root) {
    const area = root.querySelector('[data-cc="compose"]');
    const btn = root.querySelector("[data-cc-send]");
    const text = String(area?.value || "").trim();
    if (!text) {
      toast("請先輸入內容");
      return;
    }
    if (root.dataset.status === "blocked") {
      toast("用量／上下文受限，請先處理紅色提示");
    }
    if (btn) btn.disabled = true;
    root.dataset.status = "sending";
    const statusEl = root.querySelector('[data-cc="status"]');
    if (statusEl) statusEl.textContent = "SEND";
    try {
      window.edex?.setMouseIgnore?.(false);
      const result = await window.edex?.sendCursorChat?.({
        text,
        conversationId: root.dataset.selectedId || ""
      });
      if (result?.ok) {
        if (area) area.value = "";
        toast(result.message || "已發送到 Cursor");
        if (result.snapshot) render(root, result.snapshot);
      } else {
        toast(result?.message || "發送失敗（內容已複製，可手動貼到 Cursor）");
      }
    } catch (err) {
      toast(err?.message || "發送失敗");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function sendTerm(root) {
    const input = root.querySelector('[data-cc="terminput"]');
    const text = String(input?.value || "");
    if (!text.trim()) {
      toast("請先輸入終端內容");
      return;
    }
    const data = root._lastData || {};
    const term = selectedTerminal(root, data);
    try {
      window.edex?.setMouseIgnore?.(false);
      const result = await window.edex?.sendCursorTerminal?.({
        text,
        terminalId: term?.id || root.dataset.termId || "",
        cwd: term?.cwd || ""
      });
      if (result?.ok) {
        if (input) input.value = "";
        toast(result.message || "已送入終端");
        if (result.snapshot) render(root, result.snapshot);
      } else {
        toast(result?.message || "終端輸入失敗");
      }
    } catch (err) {
      toast(err?.message || "終端輸入失敗");
    }
  }

  async function stopTerm(root) {
    const data = root._lastData || {};
    const term = selectedTerminal(root, data);
    if (!term?.pid) {
      toast("沒有可停止的終端進程");
      return;
    }
    try {
      const result = await window.edex?.killCursorTerminal?.(term.pid);
      toast(result?.message || (result?.ok ? "已停止" : "停止失敗"));
      if (result?.snapshot) render(root, result.snapshot);
    } catch (err) {
      toast(err?.message || "停止失敗");
    }
  }

  function bind(appState) {
    const root = document.getElementById("mod_cursor_chat");
    if (!root) return;
    if (appState?.cursorChatTimer) {
      clearInterval(appState.cursorChatTimer);
      appState.cursorChatTimer = null;
    }
    if (root.dataset.bound === "1") {
      applyFontScale(root, readFontScale(appState));
      return;
    }
    root.dataset.bound = "1";

    let lastFp = "";
    let selecting = false;
    applyFontScale(root, readFontScale(appState));

    const wireFocus = (el) => {
      el?.addEventListener("focus", () => window.edex?.setMouseIgnore?.(false));
      el?.addEventListener("pointerdown", () => window.edex?.setMouseIgnore?.(false));
    };
    const compose = root.querySelector('[data-cc="compose"]');
    const termInput = root.querySelector('[data-cc="terminput"]');
    wireFocus(compose);
    wireFocus(termInput);

    compose?.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        sendCompose(root);
      }
    });

    termInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        sendTerm(root);
      }
    });

    root.addEventListener("click", async (event) => {
      const dismiss = event.target.closest("[data-cc-alert-dismiss]");
      if (dismiss && root.contains(dismiss)) {
        event.preventDefault();
        event.stopPropagation();
        const id = dismiss.getAttribute("data-cc-alert-dismiss");
        try {
          const data = await window.edex?.dismissCursorChatAlert?.(id);
          if (data) {
            lastFp = fingerprint(data);
            render(root, data);
          }
        } catch { /* ignore */ }
        return;
      }

      const sendBtn = event.target.closest("[data-cc-send]");
      if (sendBtn && root.contains(sendBtn)) {
        event.preventDefault();
        event.stopPropagation();
        sendCompose(root);
        return;
      }

      const termSend = event.target.closest("[data-cc-term-send]");
      if (termSend && root.contains(termSend)) {
        event.preventDefault();
        event.stopPropagation();
        sendTerm(root);
        return;
      }

      const termStop = event.target.closest("[data-cc-term-stop]");
      if (termStop && root.contains(termStop)) {
        event.preventDefault();
        event.stopPropagation();
        stopTerm(root);
        return;
      }

      const termTab = event.target.closest("[data-cc-term]");
      if (termTab && root.contains(termTab)) {
        event.preventDefault();
        event.stopPropagation();
        root.dataset.termId = termTab.getAttribute("data-cc-term") || "";
        if (root._lastData) renderTerminal(root, root._lastData);
        return;
      }

      const fontBtn = event.target.closest("[data-cc-font]");
      if (fontBtn && root.contains(fontBtn)) {
        event.preventDefault();
        event.stopPropagation();
        const dir = Number(fontBtn.getAttribute("data-cc-font")) || 0;
        const next = clampFont(readFontScale(appState) + dir * FONT_STEP);
        if (appState?.layout?.cursorChat) {
          appState.layout.cursorChat = { ...appState.layout.cursorChat, fontScale: next };
        }
        applyFontScale(root, next);
        if (typeof window.persistLayout === "function") {
          try { window.persistLayout(); } catch { /* ignore */ }
        }
        return;
      }

      const newBtn = event.target.closest("[data-cc-new]");
      if (newBtn && root.contains(newBtn)) {
        event.preventDefault();
        event.stopPropagation();
        if (selecting) return;
        selecting = true;
        newBtn.disabled = true;
        try {
          window.edex?.setMouseIgnore?.(false);
          const result = await window.edex?.newCursorChat?.();
          if (result?.snapshot) {
            lastFp = fingerprint(result.snapshot);
            render(root, result.snapshot);
          }
          toast(result?.message || (result?.ok ? "已新增對話" : "新增對話失敗"));
        } catch (err) {
          toast(err?.message || "新增對話失敗");
        } finally {
          newBtn.disabled = false;
          selecting = false;
        }
        return;
      }

      const btn = event.target.closest("[data-cc-tab]");
      if (!btn || !root.contains(btn)) return;
      event.preventDefault();
      event.stopPropagation();
      const id = btn.getAttribute("data-cc-tab");
      if (!id || selecting) return;
      selecting = true;
      try {
        const data = await window.edex?.selectCursorChat?.(id);
        if (data) {
          lastFp = fingerprint(data);
          render(root, data);
        }
      } catch {
        // ignore
      } finally {
        selecting = false;
      }
    });

    const tick = async () => {
      const live = document.getElementById("mod_cursor_chat");
      if (!live) {
        if (appState?.cursorChatTimer) {
          clearInterval(appState.cursorChatTimer);
          appState.cursorChatTimer = null;
        }
        return;
      }
      if (selecting) return;
      try {
        const data = await window.edex?.getCursorChatBridge?.();
        if (!data) return;
        const fp = fingerprint(data);
        if (fp === lastFp) return;
        lastFp = fp;
        render(live, data);
      } catch {
        // ignore
      }
    };

    tick();
    if (appState) appState.cursorChatTimer = window.setInterval(tick, POLL_MS);
  }

  function unbind(appState) {
    if (appState?.cursorChatTimer) {
      clearInterval(appState.cursorChatTimer);
      appState.cursorChatTimer = null;
    }
    const root = document.getElementById("mod_cursor_chat");
    if (root) delete root.dataset.bound;
  }

  function setFontScale(appState, value) {
    const root = document.getElementById("mod_cursor_chat");
    const next = clampFont(value);
    if (appState?.layout?.cursorChat) {
      appState.layout.cursorChat = { ...appState.layout.cursorChat, fontScale: next };
    }
    applyFontScale(root, next);
    return next;
  }

  window.cursorChatPanel = {
    bodyHtml,
    bind,
    unbind,
    setFontScale,
    fontScale: (appState) => readFontScale(appState),
    FONT_MIN,
    FONT_MAX,
    FONT_DEFAULT
  };
})();
