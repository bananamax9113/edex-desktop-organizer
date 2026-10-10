const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { clipboard, shell } = require("electron");

function normalizePaths(list) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const value = path.resolve(String(raw || "").trim());
    if (!value || seen.has(value.toLowerCase())) continue;
    if (!fs.existsSync(value)) continue;
    seen.add(value.toLowerCase());
    out.push(value);
  }
  return out;
}

/**
 * Resolve .lnk → target path (sync, no PowerShell).
 * WeChat / many IM apps reject shortcut files and need the real target.
 */
function resolveShortcutTarget(linkPath) {
  return resolveShortcutMeta(linkPath).target || "";
}

/** Sync .lnk metadata via Electron — no PowerShell. */
function resolveShortcutMeta(linkPath) {
  const file = path.resolve(String(linkPath || ""));
  if (!/\.lnk$/i.test(file) || !fs.existsSync(file)) {
    return { target: "", iconLocation: "" };
  }
  try {
    const info = shell.readShortcutLink(file);
    const targetRaw = String(info?.target || "").trim();
    const target = targetRaw && fs.existsSync(targetRaw) ? path.resolve(targetRaw) : targetRaw;
    const iconFile = String(info?.icon || "").trim();
    const iconIndex = Number.isFinite(Number(info?.iconIndex)) ? Number(info.iconIndex) : 0;
    const iconLocation = iconFile ? `${iconFile},${iconIndex}` : "";
    return { target: target || "", iconLocation };
  } catch {
    return { target: "", iconLocation: "" };
  }
}

/**
 * Paths for outbound OS drag.
 * Expands .lnk → target so chat apps (WeChat etc.) can accept the drop.
 * Uses Electron shell.readShortcutLink — never spawn PowerShell on this path.
 */
function normalizeDragPaths(list) {
  const out = [];
  const seen = new Set();
  for (const raw of normalizePaths(list)) {
    let value = raw;
    if (/\.lnk$/i.test(value)) {
      const target = resolveShortcutTarget(value);
      if (target) value = target;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    if (!fs.existsSync(value)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function runPowerShell(script) {
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 12000,
      maxBuffer: 4 * 1024 * 1024
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const msg = String(result.stderr || result.stdout || "PowerShell failed").trim();
    throw new Error(msg || "PowerShell failed");
  }
  return String(result.stdout || "").trim();
}

function writeFilesWin(paths) {
  const files = normalizePaths(paths);
  if (!files.length) throw new Error("沒有可複製的檔案");
  const b64 = Buffer.from(JSON.stringify(files), "utf8").toString("base64");
  runPowerShell(`
Add-Type -AssemblyName System.Windows.Forms
$json = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}'))
$paths = @($json | ConvertFrom-Json)
$sc = New-Object System.Collections.Specialized.StringCollection
foreach ($p in $paths) { [void]$sc.Add([string]$p) }
[System.Windows.Forms.Clipboard]::SetFileDropList($sc)
`);
  return { ok: true, count: files.length, paths: files };
}

function readFilesWin() {
  const out = runPowerShell(`
Add-Type -AssemblyName System.Windows.Forms
$list = [System.Windows.Forms.Clipboard]::GetFileDropList()
if (-not $list -or $list.Count -eq 0) { '' ; exit 0 }
$arr = New-Object System.Collections.Generic.List[string]
foreach ($p in $list) { [void]$arr.Add([string]$p) }
$arr | ConvertTo-Json -Compress
`);
  if (!out) return [];
  try {
    const parsed = JSON.parse(out);
    return normalizePaths(Array.isArray(parsed) ? parsed : [parsed]);
  } catch {
    return normalizePaths(out.split(/\r?\n/));
  }
}

function parseFileNameW(buf) {
  if (!buf || !buf.length) return [];
  const text = buf.toString("ucs2").replace(/\u0000+$/g, "");
  return normalizePaths(text ? [text] : []);
}

function parseHdrop(buf) {
  if (!buf || buf.length < 20) return [];
  const pFiles = buf.readUInt32LE(0);
  const fWide = buf.readUInt32LE(16);
  if (pFiles <= 0 || pFiles >= buf.length) return [];
  if (fWide) {
    const text = buf.slice(pFiles).toString("utf16le");
    return normalizePaths(text.split("\0").filter(Boolean));
  }
  const text = buf.slice(pFiles).toString("latin1");
  return normalizePaths(text.split("\0").filter(Boolean));
}

function readFilesElectron() {
  try {
    const hdrop = parseHdrop(clipboard.readBuffer("CF_HDROP"));
    if (hdrop.length) return hdrop;
  } catch {
    // ignore
  }
  try {
    const single = parseFileNameW(clipboard.readBuffer("FileNameW"));
    if (single.length) return single;
  } catch {
    // ignore
  }
  return [];
}

function writeFiles(paths) {
  if (process.platform === "win32") return writeFilesWin(paths);
  const files = normalizePaths(paths);
  if (!files.length) throw new Error("沒有可複製的檔案");
  if (process.platform === "darwin") {
    clipboard.writeBuffer(
      "public.file-url",
      Buffer.from(files.map((f) => `file://${encodeURI(f)}`).join("\n"), "utf8")
    );
    return { ok: true, count: files.length, paths: files };
  }
  clipboard.writeText(files.join("\n"));
  return { ok: true, count: files.length, paths: files };
}

function readFiles() {
  if (process.platform === "win32") {
    try {
      const viaPs = readFilesWin();
      if (viaPs.length) return viaPs;
    } catch {
      // fall through
    }
    return readFilesElectron();
  }
  if (process.platform === "darwin") {
    try {
      const raw = clipboard.read("public.file-url");
      if (raw) {
        return normalizePaths(
          raw
            .split(/\r?\n/)
            .map((line) => decodeURI(String(line || "").replace(/^file:\/\//i, "")))
        );
      }
    } catch {
      // ignore
    }
  }
  return readFilesElectron();
}

module.exports = {
  writeFiles,
  readFiles,
  normalizePaths,
  normalizeDragPaths,
  resolveShortcutTarget,
  resolveShortcutMeta
};
