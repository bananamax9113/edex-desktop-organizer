const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const { clipboard } = require("electron");
const cursorTerminal = require("./cursor-terminal");
const { fixTextEncoding, fixTurnText } = require("./text-encoding");

const MAX_CONTEXT_TURNS = 60;

function bridgePath(repoRoot) {
  return path.join(repoRoot, ".cursor", "chat-bridge.json");
}

/** Normalize Cursor/workspace roots like `/d:/edex` or `d:/edex` → `D:\edex`. */
function normalizeFsPath(input) {
  let value = String(input || "").trim();
  if (!value) return "";
  // URI / odd prefixes from some Cursor builds
  value = value.replace(/^file:\/\//i, "");
  value = value.replace(/^\/([A-Za-z]):(\/|\\)/, "$1:$2");
  value = value.replace(/\//g, "\\");
  const m = value.match(/^([A-Za-z]):\\(.*)$/);
  if (m) return `${m[1].toUpperCase()}:\\${m[2]}`;
  return value;
}

function projectSlugFromRoot(root) {
  const value = normalizeFsPath(root);
  const m = value.match(/^([A-Za-z]):\\(.*)$/);
  if (m) {
    return `${m[1].toLowerCase()}-${m[2].replace(/[\\/]+/g, "-")}`.replace(/-+/g, "-").replace(/^-|-$/g, "");
  }
  return value
    .replace(/[\\/]+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function transcriptsRoot(workspaceRoots = [], repoRoot) {
  const roots = [...(workspaceRoots || [])];
  if (repoRoot) roots.push(repoRoot);
  for (const root of roots) {
    const slug = projectSlugFromRoot(root);
    const candidate = path.join(os.homedir(), ".cursor", "projects", slug, "agent-transcripts");
    if (fs.existsSync(candidate)) return candidate;
  }
  // Fallback: common Windows drive letter for this repo.
  const fallback = path.join(os.homedir(), ".cursor", "projects", "d-edex", "agent-transcripts");
  return fallback;
}

function resolveProjectInfo(workspaceRoots = [], repoRoot, transcriptPath = "") {
  const roots = [...(Array.isArray(workspaceRoots) ? workspaceRoots : []), repoRoot]
    .map(normalizeFsPath)
    .filter(Boolean);

  // Infer workspace from Cursor transcript path: .../projects/<slug>/agent-transcripts/...
  if (transcriptPath) {
    const norm = normalizeFsPath(transcriptPath);
    const m = norm.match(/\.cursor\\projects\\([^\\]+)\\agent-transcripts/i);
    if (m) {
      const slug = m[1];
      for (const root of roots) {
        if (projectSlugFromRoot(root) === slug) {
          return projectMeta(root, slug);
        }
      }
      // Best-effort: open the matching project folder if roots were malformed.
      const guessed = roots[0] || normalizeFsPath(repoRoot);
      return projectMeta(guessed, slug);
    }
  }

  const root = roots[0] || normalizeFsPath(repoRoot);
  return projectMeta(root, projectSlugFromRoot(root));
}

function projectMeta(root, slug) {
  const normalized = normalizeFsPath(root);
  const folder = normalized ? path.basename(normalized.replace(/[\\/]+$/, "")) : "";
  let name = folder || slug || "unknown";
  let packageName = "";
  if (normalized) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(normalized, "package.json"), "utf8"));
      packageName = String(pkg.productName || pkg.name || "").trim();
      if (packageName) name = packageName;
    } catch {
      // ignore
    }
  }
  // If only slug like d-edex, show edex as a readable fallback.
  if (!packageName && !folder && slug && /-[^-]+$/.test(slug)) {
    const tail = slug.replace(/^[a-z]-/, "").replace(/-/g, "/");
    name = path.basename(tail) || slug;
  }
  return {
    projectName: name,
    projectFolder: folder || name,
    projectPath: normalized || "",
    projectSlug: slug || "",
    packageName
  };
}

function extractUserText(raw) {
  const text = String(raw || "");
  const m = text.match(/<user_query>\s*([\s\S]*?)\s*<\/user_query>/i);
  if (m) return m[1].trim();
  return text
    .replace(/<\/?timestamp>[\s\S]*?<\/timestamp>/gi, "")
    .replace(/<\/?[^>]+>/g, "")
    .trim();
}

function extractAssistantText(parts) {
  const texts = (parts || [])
    .filter((p) => p && p.type === "text" && p.text)
    .map((p) => String(p.text));
  if (!texts.length) return "";
  return texts.join("\n").trim();
}

function formatToolEdit(name, input = {}) {
  const filePath = String(input.path || input.target_notebook || input.file_path || "");
  let text = "";
  if (name === "StrReplace") {
    text = String(input.new_string || input.old_string || "").slice(0, 80000);
  } else if (name === "Write") {
    text = String(input.contents || "").slice(0, 80000);
  } else if (name === "EditNotebook") {
    text = String(input.new_string || input.old_string || "").slice(0, 80000);
  }
  return {
    role: "code",
    path: filePath,
    tool: name,
    text: text || "// (updated)",
    lang: langFromPath(filePath),
    source: "transcript"
  };
}

function langFromPath(filePath) {
  const ext = String(filePath || "").split(".").pop()?.toLowerCase() || "";
  const map = {
    js: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    css: "css",
    scss: "css",
    less: "css",
    html: "html",
    htm: "html",
    json: "json",
    md: "markdown",
    py: "python",
    ps1: "powershell",
    sh: "shell",
    bash: "shell",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    h: "c",
    cpp: "cpp",
    hpp: "cpp",
    xml: "xml",
    yml: "yaml",
    yaml: "yaml",
    sql: "sql"
  };
  return map[ext] || ext || "text";
}

function parseTranscriptFile(filePath, limit = MAX_CONTEXT_TURNS) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  let raw = "";
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }
  const turns = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const role = obj.role === "assistant" ? "assistant" : obj.role === "user" ? "user" : "";
    if (!role) continue;
    const parts = obj.message?.content || [];
    if (role === "user") {
      const joined = parts.filter((p) => p?.type === "text").map((p) => p.text).join("\n");
      const text = extractUserText(joined);
      if (text) turns.push({ role: "user", text: text.slice(0, 10000), source: "transcript" });
      continue;
    }
    const text = extractAssistantText(parts);
    if (text) turns.push({ role: "assistant", text: text.slice(0, 50000), source: "transcript" });
    for (const part of parts) {
      if (part?.type !== "tool_use") continue;
      const name = String(part.name || "");
      if (!["Write", "StrReplace", "EditNotebook"].includes(name)) continue;
      turns.push(formatToolEdit(name, part.input || {}));
    }
  }
  return turns.slice(-limit);
}

function resolveTranscriptPath(conv, transcriptsDir) {
  if (conv?.transcriptPath && fs.existsSync(conv.transcriptPath)) return conv.transcriptPath;
  const id = conv?.id;
  if (!id || !transcriptsDir) return "";
  const direct = path.join(transcriptsDir, id, `${id}.jsonl`);
  if (fs.existsSync(direct)) return direct;
  return "";
}

function readBridge(repoRoot) {
  const file = bridgePath(repoRoot);
  try {
    if (!fs.existsSync(file)) {
      return {
        ok: true,
        version: 2,
        status: "idle",
        prompt: "",
        reply: "",
        turns: [],
        tabs: [],
        conversations: {},
        updatedAt: 0,
        path: file
      };
    }
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return { ok: true, ...data, path: file };
  } catch (err) {
    return {
      ok: false,
      error: err.message || "read failed",
      status: "error",
      prompt: "",
      reply: "",
      turns: [],
      tabs: [],
      conversations: {},
      updatedAt: 0,
      path: file
    };
  }
}

function writeBridge(repoRoot, data) {
  const file = bridgePath(repoRoot);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const next = { ...data, updatedAt: Date.now() };
  fs.writeFileSync(file, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function titleFromPrompt(prompt) {
  const line = String(prompt || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean);
  if (!line) return "未命名對話";
  return line.length > 28 ? `${line.slice(0, 28)}…` : line;
}

function listDiskTabs(transcriptsDir) {
  if (!transcriptsDir || !fs.existsSync(transcriptsDir)) return [];
  const out = [];
  for (const name of fs.readdirSync(transcriptsDir)) {
    const dir = path.join(transcriptsDir, name);
    let st;
    try {
      st = fs.statSync(dir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    const file = path.join(dir, `${name}.jsonl`);
    if (!fs.existsSync(file)) continue;
    let mtime = st.mtimeMs;
    try {
      mtime = fs.statSync(file).mtimeMs;
    } catch {
      // keep dir mtime
    }
    let title = "對話";
    const turns = parseTranscriptFile(file, 4);
    const firstUser = turns.find((t) => t.role === "user");
    if (firstUser) title = titleFromPrompt(firstUser.text);
    out.push({
      id: name,
      title,
      updatedAt: mtime,
      transcriptPath: file,
      fromDisk: true
    });
  }
  return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function mergeTabs(bridge, diskTabs, selectedId) {
  const map = new Map();
  for (const t of diskTabs) {
    map.set(t.id, {
      id: t.id,
      title: t.title,
      mode: "",
      status: "idle",
      updatedAt: t.updatedAt || 0,
      active: false,
      selected: false,
      fromDisk: true
    });
  }
  const convs = bridge.conversations || {};
  for (const c of Object.values(convs)) {
    const prev = map.get(c.id) || {};
    const pending = Boolean(c.pending) || String(c.id || "").startsWith("pending-");
    const title = pending
      ? (c.title || "新對話")
      : c.title && c.title !== "對話" && c.title !== "新對話" && c.title !== "未命名對話"
        ? c.title
        : (prev.title || titleFromPrompt(c.prompt) || "對話");
    map.set(c.id, {
      id: c.id,
      title,
      mode: c.mode || "",
      status: c.status || "idle",
      updatedAt: Math.max(c.updatedAt || 0, prev.updatedAt || 0),
      active: c.id === bridge.activeId,
      selected: false,
      pending,
      fromDisk: Boolean(prev.fromDisk)
    });
  }
  for (const t of bridge.tabs || []) {
    if (!map.has(t.id)) {
      map.set(t.id, { ...t, selected: false });
    }
  }
  const selected = selectedId || bridge.selectedId || bridge.activeId || "";
  return [...map.values()]
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 24)
    .map((t) => ({ ...t, selected: t.id === selected, active: t.id === bridge.activeId }));
}

function buildContext(bridge, selectedId, transcriptsDir) {
  const id = selectedId || bridge.selectedId || bridge.activeId || "";
  const conv = (bridge.conversations && bridge.conversations[id]) || null;
  const transcriptFile = resolveTranscriptPath(
    { id, transcriptPath: conv?.transcriptPath || bridge.transcriptPath },
    transcriptsDir
  );
  const transcriptTurns = parseTranscriptFile(transcriptFile);
  const liveTurns = Array.isArray(conv?.turns)
    ? conv.turns
    : id && id === (bridge.selectedId || bridge.activeId)
      ? bridge.turns || []
      : [];
  const liveEdits = Array.isArray(conv?.edits)
    ? conv.edits
    : Array.isArray(bridge.edits)
      ? bridge.edits
      : [];

  // Prefer richer transcript context; append newer live turns/edits not yet in transcript.
  const normalizeTurns = (list) => (list || []).map((t) => fixTurnText(t));
  const fixedTranscript = normalizeTurns(transcriptTurns);
  const fixedLive = normalizeTurns(liveTurns);
  const context = fixedTranscript.length ? [...fixedTranscript] : [...fixedLive];
  if (fixedTranscript.length && fixedLive.length) {
    for (const turn of fixedLive.slice(-6)) {
      const text = String(turn.text || "");
      // Skip near-duplicates (same role + overlapping prefix) to avoid garbled live doubles
      const dup = context.some(
        (t) =>
          t.role === turn.role &&
          (t.text === text ||
            (text && t.text && (t.text.startsWith(text.slice(0, 24)) || text.startsWith(String(t.text).slice(0, 24)))))
      );
      if (!dup) context.push({ ...turn, source: turn.source || "live" });
    }
  }

  for (const edit of liveEdits.slice(-24)) {
    const keyPath = fixTextEncoding(edit.path || "");
    const keyText = fixTextEncoding(edit.text || "");
    if (!context.some((t) => (t.role === "code" || t.role === "edit") && t.path === keyPath && t.text === keyText)) {
      context.push({
        role: "code",
        path: keyPath,
        tool: edit.tool || "edit",
        text: keyText,
        lang: edit.lang || langFromPath(keyPath),
        at: edit.at,
        source: edit.source || "hook"
      });
    }
  }

  return {
    id,
    title: fixTextEncoding(conv?.title || titleFromPrompt(conv?.prompt || bridge.prompt) || "對話"),
    mode: conv?.mode || bridge.mode || "",
    model: conv?.model || bridge.model || "",
    status: conv?.status || bridge.status || "idle",
    prompt: fixTextEncoding(conv?.prompt || (id === bridge.activeId ? bridge.prompt : "") || ""),
    reply: fixTextEncoding(conv?.reply || (id === bridge.activeId ? bridge.reply : "") || ""),
    attachments: conv?.attachments || bridge.attachments || [],
    transcriptPath: transcriptFile || "",
    turns: fixedLive,
    edits: liveEdits,
    context: context.slice(-MAX_CONTEXT_TURNS)
  };
}

function isPendingId(id) {
  return String(id || "").startsWith("pending-");
}

function purgePendingConversations(bridge) {
  if (!bridge.conversations) return;
  for (const id of Object.keys(bridge.conversations)) {
    if (isPendingId(id) || bridge.conversations[id]?.pending) {
      delete bridge.conversations[id];
    }
  }
  if (Array.isArray(bridge.tabs)) {
    bridge.tabs = bridge.tabs.filter((t) => !isPendingId(t?.id) && !t?.pending);
  }
}

/** When Cursor reports a new activeId after "+" , adopt it and drop placeholders. */
function resolvePendingNewChat(repoRoot, bridge) {
  const pending = bridge.pendingNewChat;
  if (!pending) return bridge;
  const active = String(bridge.activeId || "").trim();
  const prev = String(pending.previousActiveId || "").trim();
  const age = Date.now() - (pending.at || 0);

  if (active && !isPendingId(active) && active !== prev) {
    purgePendingConversations(bridge);
    bridge.selectedId = active;
    delete bridge.pendingNewChat;
    writeBridge(repoRoot, bridge);
    return readBridge(repoRoot);
  }

  // Give hooks time to fire; drop wait flag after 90s but keep placeholder tab.
  if (age > 90000) {
    delete bridge.pendingNewChat;
    writeBridge(repoRoot, bridge);
    return readBridge(repoRoot);
  }
  return bridge;
}

function injectCursorMode(mode) {
  if (process.platform !== "win32") {
    return { ok: false, message: "目前僅支援 Windows 自動操作 Cursor" };
  }
  const scriptPath = path.join(__dirname, "inject-cursor-prompt.ps1");
  const result = spawnSync(
    "powershell.exe",
    [
      "-NoProfile",
      "-STA",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      scriptPath,
      "-Mode",
      mode
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 15000,
      maxBuffer: 1024 * 1024
    }
  );
  const out = String(result.stdout || "").trim();
  if (result.status === 0 && /\bOK\b/i.test(out)) {
    return { ok: true, message: mode === "newchat" ? "已在 Cursor 開啟新對話" : "已發送到 Cursor（未搶焦點）" };
  }
  if (out.includes("NO_WINDOW")) {
    return { ok: false, message: "找不到 Cursor 視窗，請先打開 Cursor" };
  }
  return {
    ok: false,
    message: (result.stderr || out || "無法自動操作 Cursor").toString().trim() || "無法自動操作 Cursor"
  };
}

function createNewConversation(repoRoot) {
  const bridge = readBridge(repoRoot);
  const previousActiveId = String(bridge.activeId || "").trim();
  const previousSelectedId = String(bridge.selectedId || "").trim();
  purgePendingConversations(bridge);
  const pendingId = `pending-${Date.now().toString(36)}`;
  if (!bridge.conversations) bridge.conversations = {};
  bridge.conversations[pendingId] = {
    id: pendingId,
    title: "新對話",
    mode: bridge.mode || "",
    model: bridge.model || "",
    status: "idle",
    prompt: "",
    reply: "",
    turns: [],
    attachments: [],
    transcriptPath: "",
    updatedAt: Date.now(),
    createdAt: Date.now(),
    pending: true
  };
  bridge.selectedId = pendingId;
  bridge.pendingNewChat = {
    at: Date.now(),
    previousActiveId,
    previousSelectedId,
    pendingId
  };
  bridge.status = "idle";
  writeBridge(repoRoot, bridge);

  const injected = injectCursorMode("newchat");
  return {
    ok: Boolean(injected.ok),
    message: injected.message,
    snapshot: getSnapshot(repoRoot)
  };
}

function getSnapshot(repoRoot) {
  let bridge = readBridge(repoRoot);
  bridge = resolvePendingNewChat(repoRoot, bridge);
  const tRoot = transcriptsRoot(bridge.workspaceRoots || [], repoRoot);
  const diskTabs = listDiskTabs(tRoot);
  let selectedId = bridge.selectedId || bridge.activeId || "";
  if (!selectedId && diskTabs[0]) selectedId = diskTabs[0].id;
  const tabs = mergeTabs(bridge, diskTabs, selectedId);
  if (!selectedId && tabs[0]) selectedId = tabs[0].id;
  const selected = buildContext({ ...bridge, selectedId }, selectedId, tRoot);
  const project = resolveProjectInfo(
    bridge.workspaceRoots || [],
    repoRoot,
    selected.transcriptPath || bridge.transcriptPath || ""
  );
  // Prefer freshly resolved package/product name; only fall back to bridge cache.
  if (!project.packageName && bridge.projectName) {
    project.projectName = bridge.projectName;
  }
  if (!project.projectPath && bridge.projectPath) {
    project.projectPath = normalizeFsPath(bridge.projectPath);
  }
  if (!project.projectFolder && bridge.projectFolder) {
    project.projectFolder = bridge.projectFolder;
  }
  const termPack = cursorTerminal.listTerminals(bridge.workspaceRoots || [], repoRoot);
  const alerts = (Array.isArray(bridge.alerts) ? bridge.alerts.slice(-12) : []).map((a) => ({
    ...a,
    message: fixTextEncoding(a?.message || "")
  }));
  const termUpdated = termPack.items.reduce((m, t) => Math.max(m, t.updatedAt || 0), 0);

  return {
    ok: bridge.ok !== false,
    error: bridge.error,
    path: bridge.path,
    updatedAt: Math.max(
      bridge.updatedAt || 0,
      ...diskTabs.map((t) => t.updatedAt || 0),
      termUpdated,
      0
    ),
    activeId: bridge.activeId || "",
    selectedId,
    status: selected.status,
    prompt: selected.prompt,
    reply: selected.reply,
    model: selected.model,
    mode: selected.mode,
    conversationId: selected.id,
    transcriptPath: selected.transcriptPath,
    attachments: selected.attachments,
    turns: selected.turns,
    edits: selected.edits || [],
    context: selected.context,
    tabs,
    alerts,
    contextUsage: bridge.contextUsage || null,
    terminals: termPack.items,
    terminalsDir: termPack.dir,
    lastEvent: bridge.lastEvent || "",
    workspaceRoots: bridge.workspaceRoots || [],
    ...project
  };
}

function dismissAlert(repoRoot, alertId) {
  const bridge = readBridge(repoRoot);
  const id = String(alertId || "").trim();
  if (!id || !Array.isArray(bridge.alerts)) return getSnapshot(repoRoot);
  bridge.alerts = bridge.alerts.filter((a) => a.id !== id);
  bridge.updatedAt = Date.now();
  writeBridge(repoRoot, bridge);
  return getSnapshot(repoRoot);
}

function clearAlerts(repoRoot) {
  const bridge = readBridge(repoRoot);
  bridge.alerts = [];
  bridge.updatedAt = Date.now();
  writeBridge(repoRoot, bridge);
  return getSnapshot(repoRoot);
}

function killCursorTerminal(repoRoot, pid) {
  const result = cursorTerminal.killTerminal(pid);
  return { ...result, snapshot: getSnapshot(repoRoot) };
}

function sendCursorTerminalInput(repoRoot, text, opts = {}) {
  const bridge = readBridge(repoRoot);
  const terms = cursorTerminal.listTerminals(bridge.workspaceRoots || [], repoRoot).items;
  const selected =
    (opts.terminalId && terms.find((t) => t.id === String(opts.terminalId))) ||
    terms.find((t) => t.running) ||
    terms[0];
  const fallbackCwd = normalizeFsPath((bridge.workspaceRoots || [])[0] || repoRoot);
  const result = cursorTerminal.sendTerminalInput(text, {
    cwd: opts.cwd || selected?.cwd || fallbackCwd
  });
  return { ...result, snapshot: getSnapshot(repoRoot) };
}

function selectConversation(repoRoot, conversationId) {
  const bridge = readBridge(repoRoot);
  const id = String(conversationId || "").trim();
  if (!id) return getSnapshot(repoRoot);
  bridge.selectedId = id;
  if (!bridge.conversations) bridge.conversations = {};
  const tRoot = transcriptsRoot(bridge.workspaceRoots || [], repoRoot);
  const disk = listDiskTabs(tRoot).find((t) => t.id === id);
  if (!bridge.conversations[id]) {
    bridge.conversations[id] = {
      id,
      title: disk?.title || "對話",
      mode: "",
      model: "",
      status: "idle",
      prompt: "",
      reply: "",
      turns: [],
      attachments: [],
      transcriptPath: disk?.transcriptPath || "",
      updatedAt: disk?.updatedAt || Date.now(),
      createdAt: Date.now()
    };
  } else if (disk?.title && (!bridge.conversations[id].title || bridge.conversations[id].title === "對話")) {
    bridge.conversations[id].title = disk.title;
    if (disk.transcriptPath) bridge.conversations[id].transcriptPath = disk.transcriptPath;
  }
  writeBridge(repoRoot, bridge);
  return getSnapshot(repoRoot);
}

function titleFromText(text) {
  const line = String(text || "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find(Boolean);
  if (!line) return "未命名對話";
  return line.length > 28 ? `${line.slice(0, 28)}…` : line;
}

function recordOutbound(repoRoot, text, conversationId) {
  const bridge = readBridge(repoRoot);
  let id = String(conversationId || bridge.selectedId || bridge.activeId || "").trim();
  const prompt = String(text || "").trim();
  if (!prompt) throw new Error("訊息不能為空");

  // Sending from a "+" placeholder: prefer Cursor's real new activeId if hooks already fired.
  if (isPendingId(id) || bridge.conversations?.[id]?.pending) {
    const prev = String(bridge.pendingNewChat?.previousActiveId || "").trim();
    const active = String(bridge.activeId || "").trim();
    if (active && !isPendingId(active) && active !== prev) {
      purgePendingConversations(bridge);
      delete bridge.pendingNewChat;
      id = active;
      bridge.selectedId = active;
    } else {
      // Keep placeholder until hooks assign a real conversation id.
      id = String(bridge.pendingNewChat?.pendingId || id);
    }
  }

  if (!bridge.conversations) bridge.conversations = {};
  if (id) {
    if (!bridge.conversations[id]) {
      bridge.conversations[id] = {
        id,
        title: titleFromText(prompt),
        mode: bridge.mode || "",
        model: bridge.model || "",
        status: "outbound",
        prompt: "",
        reply: "",
        turns: [],
        attachments: [],
        transcriptPath: "",
        updatedAt: Date.now(),
        createdAt: Date.now()
      };
    }
    const conv = bridge.conversations[id];
    conv.prompt = prompt;
    conv.status = "outbound";
    conv.updatedAt = Date.now();
    if (!conv.title || conv.title === "對話" || conv.title === "新對話" || conv.title === "未命名對話") {
      conv.title = titleFromText(prompt);
    }
    conv.turns = Array.isArray(conv.turns) ? conv.turns : [];
    conv.turns.push({ role: "user", text: prompt.slice(0, 12000), at: Date.now(), source: "organizer" });
    if (conv.turns.length > MAX_CONTEXT_TURNS) conv.turns = conv.turns.slice(-MAX_CONTEXT_TURNS);
    bridge.selectedId = id;
    bridge.activeId = bridge.activeId || id;
  }

  bridge.status = "outbound";
  bridge.prompt = prompt;
  bridge.lastOutbound = { text: prompt, at: Date.now(), conversationId: id || "" };
  bridge.updatedAt = Date.now();
  writeBridge(repoRoot, bridge);

  const pendingPath = path.join(repoRoot, ".cursor", "outbound-prompt.txt");
  fs.mkdirSync(path.dirname(pendingPath), { recursive: true });
  fs.writeFileSync(pendingPath, prompt, "utf8");

  return { bridge: getSnapshot(repoRoot), pendingPath, conversationId: id, prompt };
}

/**
 * Paste clipboard into Cursor chat and submit.
 * Does not leave Cursor in the foreground; restores minimize state after send.
 */
function injectPromptIntoCursorIde() {
  return injectCursorMode("chat");
}

function sendPrompt(repoRoot, text, conversationId) {
  const recorded = recordOutbound(repoRoot, text, conversationId);
  clipboard.writeText(recorded.prompt);
  const injected = injectPromptIntoCursorIde();
  return {
    ok: Boolean(injected.ok),
    message: injected.message,
    clipboard: true,
    snapshot: recorded.bridge,
    conversationId: recorded.conversationId
  };
}

module.exports = {
  bridgePath,
  getSnapshot,
  selectConversation,
  createNewConversation,
  parseTranscriptFile,
  transcriptsRoot,
  resolveProjectInfo,
  recordOutbound,
  injectPromptIntoCursorIde,
  sendPrompt,
  dismissAlert,
  clearAlerts,
  killCursorTerminal,
  sendCursorTerminalInput
};
