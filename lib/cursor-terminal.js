const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const { clipboard } = require("electron");

function projectSlugFromRoot(root) {
  const value = String(root || "").replace(/\//g, "\\");
  const m = value.match(/^([A-Za-z]):\\(.*)$/);
  if (m) {
    return `${m[1].toLowerCase()}-${m[2].replace(/[\\/]+/g, "-")}`.replace(/-+/g, "-").replace(/^-|-$/g, "");
  }
  return String(root || "")
    .replace(/[\\/]+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .toLowerCase();
}

function terminalsDir(workspaceRoots = [], repoRoot = "") {
  const roots = [...(workspaceRoots || [])];
  if (repoRoot) roots.push(repoRoot);
  for (const root of roots) {
    const slug = projectSlugFromRoot(root);
    const dir = path.join(os.homedir(), ".cursor", "projects", slug, "terminals");
    if (fs.existsSync(dir)) return dir;
  }
  const fallback = path.join(os.homedir(), ".cursor", "projects", "d-edex", "terminals");
  return fallback;
}

function parseTerminalFile(filePath) {
  let raw = "";
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  const id = path.basename(filePath, path.extname(filePath));
  let meta = {};
  let body = raw;
  if (raw.startsWith("---")) {
    const end = raw.indexOf("\n---", 3);
    if (end > 0) {
      const head = raw.slice(3, end).trim();
      body = raw.slice(end + 4).replace(/^\r?\n/, "");
      for (const line of head.split(/\r?\n/)) {
        const idx = line.indexOf(":");
        if (idx < 0) continue;
        const key = line.slice(0, idx).trim();
        const val = line.slice(idx + 1).trim();
        meta[key] = val;
      }
    }
  }
  let st;
  try {
    st = fs.statSync(filePath);
  } catch {
    st = null;
  }
  const pid = Number(meta.pid) || 0;
  const running = Boolean(pid && isPidAlive(pid) && !("exit_code" in meta) && meta.last_exit_code == null);
  const output = body.slice(-12000);
  return {
    id,
    file: filePath,
    pid,
    cwd: meta.cwd || "",
    lastCommand: meta.last_command || "",
    lastExitCode: meta.last_exit_code != null ? Number(meta.last_exit_code) : null,
    exitCode: meta.exit_code != null ? Number(meta.exit_code) : null,
    running,
    updatedAt: st?.mtimeMs || 0,
    output
  };
}

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function listTerminals(workspaceRoots, repoRoot) {
  const dir = terminalsDir(workspaceRoots, repoRoot);
  if (!fs.existsSync(dir)) return { dir, items: [] };
  const items = [];
  for (const name of fs.readdirSync(dir)) {
    // Cursor uses 1.txt, 2.txt style (and occasionally bare ids)
    if (!/\.txt$/i.test(name) && !/^\d+$/.test(name)) continue;
    const file = path.join(dir, name);
    let st;
    try {
      st = fs.statSync(file);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    const parsed = parseTerminalFile(file);
    if (parsed) items.push(parsed);
  }
  items.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return { dir, items: items.slice(0, 12) };
}

function killTerminal(pid) {
  const id = Number(pid);
  if (!id) return { ok: false, message: "無效 PID" };
  if (!isPidAlive(id)) return { ok: true, message: "進程已結束" };
  try {
    if (process.platform === "win32") {
      const r = spawnSync("taskkill", ["/PID", String(id), "/T", "/F"], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 8000
      });
      if (r.status === 0) return { ok: true, message: `已停止 PID ${id}` };
      return { ok: false, message: (r.stderr || r.stdout || "停止失敗").toString().trim() };
    }
    process.kill(id, "SIGTERM");
    return { ok: true, message: `已停止 PID ${id}` };
  } catch (err) {
    return { ok: false, message: err.message || "停止失敗" };
  }
}

function sendTerminalInput(text, opts = {}) {
  const value = String(text || "");
  if (!value.trim()) return { ok: false, message: "輸入不能為空" };
  if (process.platform !== "win32") {
    return { ok: false, message: "目前僅支援 Windows 終端注入" };
  }
  clipboard.writeText(value.endsWith("\n") ? value.slice(0, -1) : value);

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
      "terminal"
    ],
    { encoding: "utf8", windowsHide: true, timeout: 15000 }
  );
  const out = String(result.stdout || "").trim();
  if (result.status === 0 && /\bOK\b/i.test(out)) {
    return { ok: true, message: "已輸入到 Cursor 終端（未搶焦點）" };
  }
  if (out.includes("NO_WINDOW")) {
    return { ok: false, message: "找不到 Cursor 視窗" };
  }
  return {
    ok: false,
    message: (result.stderr || out || "終端輸入失敗").toString().trim() || "終端輸入失敗"
  };
}

module.exports = {
  terminalsDir,
  listTerminals,
  killTerminal,
  sendTerminalInput,
  parseTerminalFile
};
