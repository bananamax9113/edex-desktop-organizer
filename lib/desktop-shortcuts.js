const { execFile } = require("child_process");
const path = require("path");
const { resolveIcon } = require("./icons");
const { decorateItems, displayName } = require("./system-icons");
const { readTags } = require("./file-ops");

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

function runPs(command, timeout = 12000) {
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
      windowsHide: true,
      timeout,
      encoding: "utf8"
    }, (err, stdout) => {
      if (err) return resolve("");
      resolve(String(stdout || "").trim());
    });
  });
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
  const path = String(item.path || "").toLowerCase();
  const name = String(item.name || "");
  if (path.includes(spec.clsid)) return true;
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

function parseItems(raw) {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [data];
  } catch {
    return [];
  }
}

function isUnder(root, target) {
  if (!root || !target) return false;
  const a = path.resolve(String(root)).toLowerCase();
  const b = path.resolve(String(target)).toLowerCase();
  return b === a || b.startsWith(a + path.sep);
}

function isVirtualPath(target) {
  const value = String(target || "");
  return !value || /^shell:/i.test(value) || value.includes("::{") || value.startsWith("::");
}

async function listDesktopShortcuts(userDesktop) {
  const raw = await runPs(`
    $shell = New-Object -ComObject Shell.Application
    $folder = $shell.NameSpace(0)
    $list = @()
    if ($folder) {
      foreach ($it in $folder.Items()) {
        $list += @{
          name = [string]$it.Name
          path = [string]$it.Path
          isDirectory = [bool]$it.IsFolder
          type = [string]$it.Type
        }
      }
    }
    if ($list.Count -eq 0) { '[]' } else { $list | ConvertTo-Json -Compress -Depth 3 }
  `);
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

  for (const row of parseItems(raw)) {
    const name = String(row.name || "").trim();
    if (!name || SKIP.has(name.toLowerCase())) continue;
    if (looksLike(row, THIS_PC) || looksLike(row, RECYCLE)) continue;
    const isDirectory = Boolean(row.isDirectory);
    const itemPath = String(row.path || "");
    if (!isVirtualPath(itemPath) && userDesktop && !isUnder(userDesktop, itemPath)) continue;
    push({
      name,
      displayName: displayName(name, isDirectory),
      path: itemPath,
      isDirectory,
      sizeLabel: row.type || (isDirectory ? "資料夾" : "捷徑"),
      category: "shortcut",
      kind: "item",
      icon: resolveIcon(name, isDirectory),
      tags: await readTags(itemPath)
    });
  }

  items.sort((a, b) => {
    const rank = (item) => (item.kind === "thispc" ? 0 : item.kind === "recycle" ? 1 : 2);
    const d = rank(a) - rank(b);
    if (d) return d;
    return a.name.localeCompare(b.name, "zh-Hant");
  });

  const decorated = await decorateItems(items);
  return { items: decorated, total: decorated.length };
}

module.exports = { listDesktopShortcuts };
