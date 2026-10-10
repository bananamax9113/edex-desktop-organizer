const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const cache = new Map();

function getElectron() {
  try {
    return require("electron");
  } catch {
    return null;
  }
}

function tmpPath(prefix, ext) {
  return path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
}

function escapePsLiteral(value) {
  return String(value || "").replace(/'/g, "''");
}

function displayName(name, isDirectory = false) {
  const raw = String(name || "").trim();
  if (!raw || isDirectory) return raw;
  if (/\.lnk$/i.test(raw) || /\.url$/i.test(raw)) {
    return raw.replace(/\.(lnk|url)$/i, "");
  }
  const ext = path.extname(raw);
  if (!ext || ext.length > 8) return raw;
  if (raw === ext) return raw;
  return raw.slice(0, -ext.length);
}

function parseIconLocation(raw) {
  const value = String(raw || "").trim();
  if (!value || value === ",0") return null;
  // IconLocation: "C:\Path\app.exe,0" or "%SystemRoot%\System32\shell32.dll,3"
  // ",0" means “use target default icon”
  const comma = value.lastIndexOf(",");
  let file = value;
  let index = 0;
  if (comma >= 0) {
    const maybeIdx = value.slice(comma + 1).trim();
    if (/^-?\d+$/.test(maybeIdx)) {
      file = value.slice(0, comma).trim().replace(/^"|"$/g, "");
      index = Number(maybeIdx);
    }
  }
  file = file.replace(/^"|"$/g, "");
  try {
    file = file.replace(/%([^%]+)%/g, (_, name) => process.env[name] || process.env[name.toUpperCase()] || `%${name}%`);
  } catch {
    // keep
  }
  if (!file) return null;
  return { dll: file, index: Number.isFinite(index) ? index : 0 };
}

function buildJobs(paths, metaByPath = {}) {
  return paths.map((orig) => {
    const s = String(orig || "");
    const low = s.toLowerCase();
    if (low.includes("20d04fe0-3aea-1069-a2d8-08002b30309d") || low === "shell:mycomputerfolder") {
      return { orig, dll: "C:\\Windows\\System32\\imageres.dll", index: 104, path: "" };
    }
    if (low.includes("645ff040-5081-101b-9f08-00aa002f954e") || low === "shell:recyclebinfolder") {
      return { orig, dll: "C:\\Windows\\System32\\imageres.dll", index: 50, path: "" };
    }
    const meta = metaByPath[s] || metaByPath[s.toLowerCase()] || {};
    const fromLoc = parseIconLocation(meta.iconLocation);
    if (fromLoc && fromLoc.dll) {
      return {
        orig,
        path: s,
        target: meta.targetPath || "",
        dll: fromLoc.dll,
        index: fromLoc.index
      };
    }
    return {
      orig,
      path: s,
      target: meta.targetPath || "",
      dll: "",
      index: 0
    };
  });
}

function runPsFile(ps1, timeout = 30000) {
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
      maxBuffer: 32 * 1024 * 1024
    }, () => resolve());
  });
}

/** 從 DLL 按索引提取圖示（本機／回收桶等） */
async function extractDllIcons(entries = []) {
  const need = entries.filter((e) => e && e.key && e.dll);
  if (!need.length) return {};
  const listFile = tmpPath("edex-dll-icons", ".json");
  const outFile = tmpPath("edex-dll-icons-out", ".json");
  const ps1 = tmpPath("edex-dll-icons", ".ps1");
  fs.writeFileSync(listFile, JSON.stringify(need), "utf8");
  fs.writeFileSync(ps1, `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class EdexDllIcon {
  [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
  public static extern int ExtractIconEx(string lpszFile, int nIconIndex, IntPtr[] phIconLarge, IntPtr[] phIconSmall, int nIcons);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool DestroyIcon(IntPtr hIcon);
}
"@
$parsed = Get-Content -LiteralPath '${escapePsLiteral(listFile)}' -Encoding UTF8 -Raw | ConvertFrom-Json
$jobs = New-Object System.Collections.Generic.List[object]
if ($parsed -is [System.Array]) { foreach ($x in $parsed) { [void]$jobs.Add($x) } }
elseif ($null -ne $parsed) { [void]$jobs.Add($parsed) }
$rows = New-Object System.Collections.Generic.List[object]
foreach ($job in $jobs) {
  try {
    $dll = [Environment]::ExpandEnvironmentVariables([string]$job.dll)
    $idx = [int]$job.index
    $key = [string]$job.key
    if (-not $dll -or -not (Test-Path -LiteralPath $dll)) { continue }
    $large = New-Object IntPtr[] 1
    [void][EdexDllIcon]::ExtractIconEx($dll, $idx, $large, $null, 1)
    if ($large[0] -eq [IntPtr]::Zero) { continue }
    $icon = [System.Drawing.Icon]::FromHandle($large[0])
    $bmp = $icon.ToBitmap()
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $rows.Add([pscustomobject]@{ key = $key; b64 = [Convert]::ToBase64String($ms.ToArray()) }) | Out-Null
    $ms.Dispose(); $bmp.Dispose(); $icon.Dispose()
    [void][EdexDllIcon]::DestroyIcon($large[0])
  } catch {}
}
$json = if ($rows.Count -eq 0) { '[]' } else { ($rows | ConvertTo-Json -Compress -Depth 3) }
[System.IO.File]::WriteAllText('${escapePsLiteral(outFile)}', $json, [System.Text.UTF8Encoding]::new($false))
`, "utf8");

  await runPsFile(ps1, 20000);
  try { fs.unlinkSync(listFile); } catch { /* ignore */ }
  try { fs.unlinkSync(ps1); } catch { /* ignore */ }

  const map = {};
  try {
    const raw = fs.existsSync(outFile)
      ? fs.readFileSync(outFile, "utf8").replace(/^\uFEFF/, "").trim()
      : "";
    const parsed = raw ? JSON.parse(raw) : [];
    const rows = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
    for (const row of rows) {
      if (row?.key && row?.b64) map[row.key] = `data:image/png;base64,${row.b64}`;
    }
  } catch {
    // ignore
  }
  try { fs.unlinkSync(outFile); } catch { /* ignore */ }
  return map;
}

const SPECIAL_DLL_ICONS = {
  thispc: { dll: "C:\\Windows\\System32\\imageres.dll", index: 104 },
  recycle: { dll: "C:\\Windows\\System32\\imageres.dll", index: 50 }
};

async function extractViaShell(jobs) {
  if (!jobs.length) return {};
  const listFile = tmpPath("edex-icons", ".json");
  const outFile = tmpPath("edex-icons-out", ".json");
  const ps1 = tmpPath("edex-icons", ".ps1");
  fs.writeFileSync(listFile, JSON.stringify(jobs), "utf8");

  const script = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Drawing
try {
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class EdexShellIcon {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public struct SHFILEINFO {
    public IntPtr hIcon;
    public int iIcon;
    public uint dwAttributes;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=260)] public string szDisplayName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=80)] public string szTypeName;
  }
  [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
  public static extern IntPtr SHGetFileInfo(string pszPath, uint fa, ref SHFILEINFO psfi, uint cb, uint flags);
  [DllImport("shell32.dll", CharSet=CharSet.Unicode)]
  public static extern int ExtractIconEx(string lpszFile, int nIconIndex, IntPtr[] phIconLarge, IntPtr[] phIconSmall, int nIcons);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool DestroyIcon(IntPtr hIcon);
  public const uint SHGFI_ICON = 0x100;
  public const uint SHGFI_LARGEICON = 0x0;
  public const uint SHGFI_USEFILEATTRIBUTES = 0x10;
  public const uint SHGFI_ICONLOCATION = 0x1000;
  public const uint FILE_ATTRIBUTE_DIRECTORY = 0x10;
  public static IntPtr GetIcon(string path, bool asDir) {
    SHFILEINFO info = new SHFILEINFO();
    uint flags = SHGFI_ICON | SHGFI_LARGEICON;
    SHGetFileInfo(path, 0, ref info, (uint)Marshal.SizeOf(info), flags);
    if (info.hIcon == IntPtr.Zero) {
      uint fa = asDir ? FILE_ATTRIBUTE_DIRECTORY : 0x80u;
      SHGetFileInfo(path, fa, ref info, (uint)Marshal.SizeOf(info), flags | SHGFI_USEFILEATTRIBUTES);
    }
    return info.hIcon;
  }
  public static IntPtr GetDllIcon(string dll, int index) {
    if (string.IsNullOrEmpty(dll)) return IntPtr.Zero;
    IntPtr[] large = new IntPtr[1];
    // index >= 0: icon index in file; index < 0: icon resource id
    ExtractIconEx(dll, index, large, null, 1);
    return large[0];
  }
}
"@
} catch {}

function Resolve-LnkInfo([string]$path) {
  $info = @{ dll = $null; index = 0; target = $null }
  try {
    $w = New-Object -ComObject WScript.Shell
    $s = $w.CreateShortcut($path)
    $loc = [string]$s.IconLocation
    if ($loc) {
      $comma = $loc.LastIndexOf(',')
      $file = if ($comma -ge 0) { $loc.Substring(0, $comma).Trim().Trim('"') } else { $loc.Trim().Trim('"') }
      $file = [Environment]::ExpandEnvironmentVariables($file)
      $idx = if ($comma -ge 0) { [int]$loc.Substring($comma + 1) } else { 0 }
      if ($file) { $info.dll = $file; $info.index = $idx }
    }
    $t = [string]$s.TargetPath
    if ($t) { $info.target = [Environment]::ExpandEnvironmentVariables($t) }
  } catch {}
  return $info
}

function Resolve-UrlInfo([string]$path) {
  $info = @{ dll = $null; index = 0; target = $null }
  try {
    Get-Content -LiteralPath $path -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_ -match '^IconFile=(.+)$') { $info.dll = [Environment]::ExpandEnvironmentVariables($Matches[1].Trim().Trim('"')) }
      if ($_ -match '^IconIndex=(.+)$') { $info.index = [int]$Matches[1] }
      if ($_ -match '^URL=(.+)$') { $info.target = $Matches[1].Trim() }
    }
  } catch {}
  return $info
}

function Save-Icon($h, [string]$key, $rows) {
  if ($null -eq $h -or $h -eq [IntPtr]::Zero) { return $false }
  try {
    $icon = [System.Drawing.Icon]::FromHandle([IntPtr]$h)
    $bmp = $icon.ToBitmap()
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $rows.Add([pscustomobject]@{ key = $key; b64 = [Convert]::ToBase64String($ms.ToArray()) }) | Out-Null
    $ms.Dispose(); $bmp.Dispose(); $icon.Dispose()
    [EdexShellIcon]::DestroyIcon([IntPtr]$h) | Out-Null
    return $true
  } catch {
    try { [EdexShellIcon]::DestroyIcon([IntPtr]$h) | Out-Null } catch {}
    return $false
  }
}

$parsed = Get-Content -LiteralPath '${escapePsLiteral(listFile)}' -Encoding UTF8 -Raw | ConvertFrom-Json
$jobs = New-Object System.Collections.Generic.List[object]
if ($parsed -is [System.Array]) { foreach ($x in $parsed) { [void]$jobs.Add($x) } }
elseif ($null -ne $parsed) { [void]$jobs.Add($parsed) }
$rows = New-Object System.Collections.Generic.List[object]

foreach ($job in $jobs) {
  $key = [string]$job.orig
  $ok = $false
  try {
    $dll = [string]$job.dll
    $src = [string]$job.path
    $target = [string]$job.target
    $idx = 0
    if ($job.index -ne $null -and "$($job.index)" -ne '') { $idx = [int]$job.index }

    if ($dll) {
      $dll = [Environment]::ExpandEnvironmentVariables($dll)
      $h = [EdexShellIcon]::GetDllIcon($dll, $idx)
      $ok = Save-Icon $h $key $rows
    }

    if (-not $ok -and $src -like '*.lnk') {
      $info = Resolve-LnkInfo $src
      if ($info.dll) {
        $h = [EdexShellIcon]::GetDllIcon([string]$info.dll, [int]$info.index)
        $ok = Save-Icon $h $key $rows
      }
      if (-not $ok -and $info.target) { $target = [string]$info.target }
    }

    if (-not $ok -and $src -like '*.url') {
      $info = Resolve-UrlInfo $src
      if ($info.dll) {
        $h = [EdexShellIcon]::GetDllIcon([string]$info.dll, [int]$info.index)
        $ok = Save-Icon $h $key $rows
      }
    }

    # Explorer-equivalent: SHGetFileInfo on the item itself (.lnk / folder / file)
    if (-not $ok -and $src) {
      $asDir = $false
      try { $asDir = (Test-Path -LiteralPath $src -PathType Container) } catch {}
      $h = [EdexShellIcon]::GetIcon($src, $asDir)
      $ok = Save-Icon $h $key $rows
    }

    if (-not $ok -and $target) {
      $asDir = $false
      try { $asDir = (Test-Path -LiteralPath $target -PathType Container) } catch {}
      $h = [EdexShellIcon]::GetIcon($target, $asDir)
      $ok = Save-Icon $h $key $rows
    }
  } catch {}
}

$json = if ($rows.Count -eq 0) { '[]' } else { ($rows | ConvertTo-Json -Compress -Depth 3) }
[System.IO.File]::WriteAllText('${escapePsLiteral(outFile)}', $json, [System.Text.UTF8Encoding]::new($false))
`;

  fs.writeFileSync(ps1, script, "utf8");
  await runPsFile(ps1, 45000);
  try { fs.unlinkSync(listFile); } catch { /* ignore */ }
  try { fs.unlinkSync(ps1); } catch { /* ignore */ }

  const map = {};
  try {
    const raw = fs.existsSync(outFile)
      ? fs.readFileSync(outFile, "utf8").replace(/^\uFEFF/, "").trim()
      : "";
    const parsed = raw ? JSON.parse(raw) : [];
    const rows = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
    for (const row of rows) {
      if (row?.key && row?.b64) map[row.key] = `data:image/png;base64,${row.b64}`;
    }
  } catch {
    // ignore
  }
  try { fs.unlinkSync(outFile); } catch { /* ignore */ }
  return map;
}

async function extractViaElectron(paths) {
  const electron = getElectron();
  const app = electron?.app;
  if (!app || typeof app.getFileIcon !== "function") return {};
  const map = {};
  await Promise.all(paths.map(async (p) => {
    try {
      const img = await app.getFileIcon(p, { size: "normal" });
      if (img && !img.isEmpty()) map[p] = img.toDataURL();
    } catch {
      // ignore
    }
  }));
  return map;
}

async function extractIcons(paths = [], metaByPath = {}, options = {}) {
  const unique = [...new Set(paths.filter(Boolean).map((p) => String(p)))];
  const missing = unique.filter((p) => !cache.has(p));
  if (!missing.length) {
    return Object.fromEntries(unique.map((p) => [p, cache.get(p) || ""]));
  }

  const preferElectron = Boolean(options.preferElectron);
  const plainOf = (list) => list.filter((p) => !/^shell:/i.test(p) && !p.includes("::{"));

  let shellMap = {};
  let electronMap = {};

  if (preferElectron) {
    // Fast path for drop/refresh: Electron getFileIcon avoids PowerShell cold-start.
    try {
      electronMap = await extractViaElectron(plainOf(missing));
    } catch {
      electronMap = {};
    }
    const still = missing.filter((p) => !electronMap[p]);
    if (still.length && still.length <= 24) {
      try {
        shellMap = await extractViaShell(buildJobs(still, metaByPath));
      } catch {
        shellMap = {};
      }
    }
  } else {
    try {
      shellMap = await extractViaShell(buildJobs(missing, metaByPath));
    } catch {
      shellMap = {};
    }
    const stillMissing = missing.filter((p) => !shellMap[p]);
    if (stillMissing.length) {
      try {
        electronMap = await extractViaElectron(plainOf(stillMissing));
      } catch {
        electronMap = {};
      }
    }
  }

  for (const p of missing) {
    cache.set(p, (preferElectron ? electronMap[p] || shellMap[p] : shellMap[p] || electronMap[p]) || "");
  }
  return Object.fromEntries(unique.map((p) => [p, cache.get(p) || ""]));
}

const SPECIAL_ICON_SOURCES = {
  thispc: "shell:MyComputerFolder",
  recycle: "shell:RecycleBinFolder"
};

async function enrichLnkMeta(items = []) {
  const need = items.filter((item) => {
    const p = String(item.path || "");
    return /\.lnk$/i.test(p) && (!item.iconLocation || !item.targetPath);
  });
  if (!need.length) return items;

  const listFile = tmpPath("edex-lnk-meta", ".json");
  const outFile = tmpPath("edex-lnk-meta-out", ".json");
  const ps1 = tmpPath("edex-lnk-meta", ".ps1");
  fs.writeFileSync(listFile, JSON.stringify(need.map((i) => i.path)), "utf8");
  fs.writeFileSync(ps1, `
$ErrorActionPreference = 'SilentlyContinue'
$parsed = Get-Content -LiteralPath '${escapePsLiteral(listFile)}' -Encoding UTF8 -Raw | ConvertFrom-Json
$paths = New-Object System.Collections.Generic.List[object]
if ($parsed -is [System.Array]) { foreach ($x in $parsed) { [void]$paths.Add($x) } }
elseif ($null -ne $parsed) { [void]$paths.Add($parsed) }
$w = New-Object -ComObject WScript.Shell
$rows = New-Object System.Collections.Generic.List[object]
foreach ($p in $paths) {
  try {
    $s = $w.CreateShortcut([string]$p)
    $rows.Add([pscustomobject]@{
      path = [string]$p
      target = [string]$s.TargetPath
      icon = [string]$s.IconLocation
    }) | Out-Null
  } catch {}
}
$json = if ($rows.Count -eq 0) { '[]' } else { ($rows | ConvertTo-Json -Compress -Depth 4) }
[System.IO.File]::WriteAllText('${escapePsLiteral(outFile)}', $json, [System.Text.UTF8Encoding]::new($false))
`, "utf8");
  await runPsFile(ps1, 20000);
  try { fs.unlinkSync(listFile); } catch { /* ignore */ }
  try { fs.unlinkSync(ps1); } catch { /* ignore */ }

  const map = new Map();
  try {
    const raw = fs.existsSync(outFile)
      ? fs.readFileSync(outFile, "utf8").replace(/^\uFEFF/, "").trim()
      : "";
    const parsed = raw ? JSON.parse(raw) : [];
    const rows = Array.isArray(parsed) ? parsed : (parsed ? [parsed] : []);
    for (const row of rows) {
      map.set(path.resolve(String(row.path || "")).toLowerCase(), row);
    }
  } catch {
    // ignore
  }
  try { fs.unlinkSync(outFile); } catch { /* ignore */ }

  return items.map((item) => {
    const row = map.get(path.resolve(String(item.path || "")).toLowerCase());
    if (!row) return item;
    return {
      ...item,
      targetPath: item.targetPath || String(row.target || "").trim() || "",
      iconLocation: item.iconLocation || String(row.icon || "").trim() || ""
    };
  });
}

function targetIsDirectory(item) {
  const target = String(item?.targetPath || "").trim();
  if (!target) return false;
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function isThemeFolderItem(item) {
  if (!item) return false;
  if (item.kind === "thispc" || item.kind === "recycle") return false;
  if (item.isDirectory) return true;
  const isLnk = item.kind === "shortcut" || /\.(lnk|url)$/i.test(String(item.path || item.name || ""));
  return isLnk && targetIsDirectory(item);
}

async function decorateItems(items = [], options = {}) {
  const { resolveIcon, dirIcon } = require("./icons");
  const skipLnkEnrich = Boolean(options.skipLnkEnrich);
  const preferElectron = Boolean(options.preferElectron);
  if (!skipLnkEnrich) {
    items = await enrichLnkMeta(items);
  }

  const metaByPath = {};
  const paths = [];
  const specialJobs = [];
  for (const item of items) {
    if (item.kind === "thispc" || item.kind === "recycle") {
      const spec = SPECIAL_DLL_ICONS[item.kind];
      // Cached special icons skip another PowerShell round-trip.
      if (spec && !cache.has(`dll:${item.kind}`)) {
        specialJobs.push({ key: item.kind, dll: spec.dll, index: spec.index });
      }
      continue;
    }
    // 資料夾（含指向資料夾的捷徑）使用 eDEX 主題資料夾圖示
    if (isThemeFolderItem(item)) continue;

    const p = item.path;
    if (!p) continue;
    metaByPath[p] = {
      targetPath: item.targetPath || "",
      iconLocation: item.iconLocation || ""
    };
    metaByPath[String(p).toLowerCase()] = metaByPath[p];
    paths.push(p);
  }

  const [icons, specialIcons] = await Promise.all([
    extractIcons(paths, metaByPath, { preferElectron }),
    specialJobs.length ? extractDllIcons(specialJobs) : Promise.resolve({})
  ]);

  // Persist special DLL icons in the same cache for subsequent refreshes.
  for (const [key, dataUrl] of Object.entries(specialIcons || {})) {
    if (dataUrl) cache.set(`dll:${key}`, dataUrl);
  }

  return items.map((item) => {
    const label = item.displayName || displayName(item.name, item.isDirectory);

    if (isThemeFolderItem(item)) {
      return { ...item, displayName: label, icon: dirIcon() };
    }

    if (item.kind === "thispc" || item.kind === "recycle") {
      const dataUrl = specialIcons[item.kind] || cache.get(`dll:${item.kind}`) || "";
      if (dataUrl) {
        return {
          ...item,
          displayName: label,
          icon: { key: "sys", dataUrl, width: 32, height: 32 }
        };
      }
      // 保留 SVG 後備，勿降級成通用 file
      return { ...item, displayName: label, icon: item.icon };
    }

    const dataUrl = icons[item.path] || "";
    if (dataUrl) {
      return {
        ...item,
        displayName: label,
        icon: { key: "sys", dataUrl, width: 32, height: 32 }
      };
    }

    const target = String(item.targetPath || "").trim();
    const isLnk = item.kind === "shortcut" || /\.(lnk|url)$/i.test(String(item.path || item.name || ""));
    let fallback = item.icon;
    if (isLnk && target) {
      fallback = resolveIcon(path.basename(target), false) || fallback;
    } else if (!fallback || fallback.key === "file" || fallback.key === "link") {
      fallback = resolveIcon(String(item.name || ""), false) || fallback;
    }
    return { ...item, displayName: label, icon: fallback };
  });
}

module.exports = { displayName, extractIcons, decorateItems, parseIconLocation };
