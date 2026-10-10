const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { resolveIcon } = require("./icons");
const { decorateItems, displayName } = require("./system-icons");
const { readTags } = require("./file-ops");
const { categorize } = require("./categories");
const { resolveShortcutMeta } = require("./clipboard-files");

const SKIP = new Set(["desktop.ini", "thumbs.db", "iconcache.db"]);

const THIS_PC = {
  id: "thispc",
  name: "本機",
  path: "shell:MyComputerFolder",
  clsid: "20d04fe0-3aea-1069-a2d8-08002b30309d"
};

const RECYCLE = {
  id: "recycle",
  name: "回收桶",
  path: "shell:RecycleBinFolder",
  clsid: "645ff040-5081-101b-9f08-00aa002f954e"
};

function tmpPath(prefix, ext = ".json") {
  return path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
}

function runPsScript(scriptBody, timeout = 20000) {
  const ps1 = tmpPath("edex-desk", ".ps1");
  fs.writeFileSync(ps1, `${scriptBody}\n`, "utf8");
  return new Promise((resolve) => {
    execFile("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      ps1
    ], {
      windowsHide: true,
      timeout,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024
    }, () => {
      try { fs.unlinkSync(ps1); } catch { /* ignore */ }
      resolve();
    });
  });
}

function readJsonFile(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").trim();
    if (!text) return fallback;
    return JSON.parse(text);
  } catch {
    return fallback;
  } finally {
    try { fs.unlinkSync(file); } catch { /* ignore */ }
  }
}

function escapePsLiteral(value) {
  return String(value || "").replace(/'/g, "''");
}

function iconComputer() {
  return {
    key: "thispc",
    width: 24,
    height: 24,
    svg: '<rect x="2" y="4" width="20" height="13" rx="1.5"/><rect x="9" y="17" width="6" height="2"/><rect x="6" y="19" width="12" height="1.6"/>'
  };
}

function iconRecycle() {
  return {
    key: "recycle",
    width: 24,
    height: 24,
    svg: '<path d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM8 9h2v9H8V9z"/>'
  };
}

function looksLike(item, spec) {
  const itemPath = String(item.path || "").toLowerCase();
  const name = String(item.name || "");
  if (itemPath.includes(spec.clsid)) return true;
  if (spec.id === "thispc") return /本機|此電腦|computer|this pc/i.test(name);
  if (spec.id === "recycle") return /回收|recycle|trash/i.test(name);
  return false;
}

function specialItem(spec) {
  return {
    name: spec.name,
    displayName: spec.name,
    path: spec.path,
    isDirectory: true,
    sizeLabel: "系統",
    category: "shortcut",
    kind: spec.id,
    icon: spec.id === "recycle" ? iconRecycle() : iconComputer()
  };
}

function isUnder(root, target) {
  if (!root || !target) return false;
  const a = path.resolve(String(root)).toLowerCase();
  const b = path.resolve(String(target)).toLowerCase();
  return b === a || b.startsWith(`${a}${path.sep}`);
}

function isVirtualPath(target) {
  const value = String(target || "");
  return !value || /^shell:/i.test(value) || value.includes("::{") || value.startsWith("::");
}

function listDesktopFs(userDesktop) {
  if (!userDesktop || !fs.existsSync(userDesktop)) return [];
  let entries = [];
  try {
    entries = fs.readdirSync(userDesktop, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.map((entry) => {
    const name = entry.name;
    if (!name || SKIP.has(name.toLowerCase())) return null;
    const full = path.join(userDesktop, name);
    let isDirectory = entry.isDirectory();
    try {
      if (entry.isSymbolicLink()) isDirectory = fs.statSync(full).isDirectory();
    } catch {
      // keep dirent flag
    }
    return {
      name,
      path: full,
      isDirectory,
      type: isDirectory ? "資料夾" : path.extname(name).replace(".", "").toUpperCase() || "檔案"
    };
  }).filter(Boolean);
}

async function listShellDesktopItems() {
  const outFile = tmpPath("edex-desk-items");
  await runPsScript(`
$ErrorActionPreference = 'SilentlyContinue'
$shell = New-Object -ComObject Shell.Application
$folder = $shell.NameSpace(0)
$list = New-Object System.Collections.Generic.List[object]
if ($folder) {
  foreach ($it in $folder.Items()) {
    $list.Add([pscustomobject]@{
      name = [string]$it.Name
      path = [string]$it.Path
      isDirectory = [bool]$it.IsFolder
      type = [string]$it.Type
    }) | Out-Null
  }
}
$json = if ($list.Count -eq 0) { '[]' } else { ($list | ConvertTo-Json -Compress -Depth 3) }
[System.IO.File]::WriteAllText('${escapePsLiteral(outFile)}', $json, [System.Text.UTF8Encoding]::new($false))
  `);
  const data = readJsonFile(outFile, []);
  return Array.isArray(data) ? data : (data ? [data] : []);
}

/** Sync Electron shortcut resolve — avoids PowerShell cold-start on every refresh. */
function enrichShortcutsSync(rows) {
  return rows.map((row) => {
    if (!/\.lnk$/i.test(String(row.path || ""))) return row;
    const meta = resolveShortcutMeta(row.path);
    if (!meta.target && !meta.iconLocation) return row;
    return {
      ...row,
      targetPath: meta.target || row.targetPath,
      iconLocation: meta.iconLocation || row.iconLocation
    };
  });
}

function iconSourceName(row) {
  const target = String(row.targetPath || "").trim();
  if (target) {
    const base = path.basename(target);
    if (base) return base;
  }
  return String(row.name || "");
}

/**
 * List desktop items.
 * @param {string} userDesktop
 * @param {{ includeShell?: boolean, decorate?: boolean|string }} [options]
 *   includeShell — also merge Shell.Application desktop (slow PowerShell; default false)
 *   decorate — true | "fast" | false (default "fast": Electron icons first, skip lnk PS)
 */
async function listDesktopShortcuts(userDesktop, options = {}) {
  const includeShell = Boolean(options.includeShell);
  const decorateMode = options.decorate === false
    ? false
    : (options.decorate === true ? "full" : "fast");

  const fsRows = listDesktopFs(userDesktop);
  const byPath = new Map();
  for (const row of fsRows) {
    byPath.set(path.resolve(row.path).toLowerCase(), { ...row });
  }

  if (includeShell) {
    const shellRows = await listShellDesktopItems().catch(() => []);
    for (const row of shellRows) {
      const itemPath = String(row.path || "");
      if (!itemPath || isVirtualPath(itemPath)) continue;
      if (userDesktop && !isUnder(userDesktop, itemPath)) continue;
      const key = path.resolve(itemPath).toLowerCase();
      const existing = byPath.get(key);
      if (existing) {
        if (row.type) existing.type = String(row.type);
        continue;
      }
      byPath.set(key, {
        name: String(row.name || path.basename(itemPath)).trim(),
        path: itemPath,
        isDirectory: Boolean(row.isDirectory),
        type: String(row.type || "")
      });
    }
  }

  const rows = enrichShortcutsSync([...byPath.values()]);

  const seen = new Set();
  const items = [];
  const push = (item) => {
    const key = `${String(item.name || "").toLowerCase()}|${String(item.path || "").toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    items.push(item);
  };

  push(specialItem(THIS_PC));
  push(specialItem(RECYCLE));

  const tagJobs = [];
  for (const row of rows) {
    const name = String(row.name || "").trim();
    if (!name || SKIP.has(name.toLowerCase())) continue;
    if (looksLike(row, THIS_PC) || looksLike(row, RECYCLE)) continue;
    const itemPath = String(row.path || "");
    if (!itemPath) continue;
    if (!isVirtualPath(itemPath) && userDesktop && !isUnder(userDesktop, itemPath)) continue;

    const isLnk = /\.lnk$/i.test(itemPath) || /\.url$/i.test(itemPath);
    const isDirectory = Boolean(row.isDirectory) && !isLnk;
    const iconName = iconSourceName(row);
    let targetIsDir = false;
    if (isLnk && row.targetPath) {
      try { targetIsDir = fs.statSync(row.targetPath).isDirectory(); } catch { /* ignore */ }
    }
    const category = isLnk
      ? "shortcuts"
      : categorize(iconName || name, isDirectory);

    const item = {
      name,
      displayName: displayName(name, isDirectory),
      path: itemPath,
      targetPath: row.targetPath || "",
      targetIsDirectory: Boolean(targetIsDir),
      iconLocation: row.iconLocation || "",
      isDirectory,
      sizeLabel: row.type || (isDirectory ? "資料夾" : isLnk ? "捷徑" : "檔案"),
      category,
      kind: isLnk ? "shortcut" : "item",
      icon: resolveIcon(iconName || name, isDirectory || targetIsDir),
      tags: []
    };
    items.push(item);
    tagJobs.push(
      readTags(itemPath).then((tags) => {
        item.tags = tags || [];
      }).catch(() => {
        item.tags = [];
      })
    );
  }

  await Promise.all(tagJobs);

  items.sort((a, b) => {
    const rank = (item) => (item.kind === "thispc" ? 0 : item.kind === "recycle" ? 1 : 2);
    const d = rank(a) - rank(b);
    if (d) return d;
    return String(a.displayName || a.name).localeCompare(String(b.displayName || b.name), "zh-Hant");
  });

  if (!decorateMode) {
    return { items, total: items.length };
  }

  return {
    items: await decorateItems(items, {
      skipLnkEnrich: true,
      preferElectron: decorateMode === "fast"
    }),
    total: items.length
  };
}

module.exports = { listDesktopShortcuts };
