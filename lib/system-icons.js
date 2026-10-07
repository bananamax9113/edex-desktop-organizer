const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const cache = new Map();

function runPs(command, timeout = 20000) {
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
      windowsHide: true,
      timeout,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024
    }, (err, stdout) => {
      if (err) return resolve("");
      resolve(String(stdout || "").trim());
    });
  });
}

function displayName(name, isDirectory = false) {
  const raw = String(name || "").trim();
  if (!raw || isDirectory) return raw;
  if (/\.lnk$/i.test(raw) || /\.url$/i.test(raw)) {
    return raw.replace(/\.(lnk|url)$/i, "");
  }
  const ext = path.extname(raw);
  if (!ext || ext.length > 8) return raw;
  // Keep names that are only an extension-like token.
  if (raw === ext) return raw;
  return raw.slice(0, -ext.length);
}

function resolveIconPath(p) {
  const s = String(p || "");
  const low = s.toLowerCase();
  if (low.includes("20d04fe0-3aea-1069-a2d8-08002b30309d") || low === "shell:mycomputerfolder") {
    return { dll: "C:\\Windows\\System32\\imageres.dll", index: 104 };
  }
  if (low.includes("645ff040-5081-101b-9f08-00aa002f954e") || low === "shell:recyclebinfolder") {
    return { dll: "C:\\Windows\\System32\\imageres.dll", index: 50 };
  }
  return { path: s };
}

async function extractIcons(paths = []) {
  const unique = [...new Set(paths.filter(Boolean).map((p) => String(p)))];
  const missing = unique.filter((p) => !cache.has(p));
  if (!missing.length) {
    return Object.fromEntries(unique.map((p) => [p, cache.get(p) || ""]));
  }

  const jobs = missing.map((orig) => {
    const resolved = resolveIconPath(orig);
    return { orig, ...resolved };
  });
  const listFile = path.join(os.tmpdir(), `edex-icons-${Date.now()}.json`);
  fs.writeFileSync(listFile, JSON.stringify(jobs), "utf8");
  const escaped = listFile.replace(/'/g, "''");

  const raw = await runPs(`
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class EdexIcon {
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
  public static IntPtr GetIcon(string path) {
    SHFILEINFO info = new SHFILEINFO();
    IntPtr r = SHGetFileInfo(path, 0, ref info, (uint)Marshal.SizeOf(info), SHGFI_ICON | SHGFI_LARGEICON);
    if (info.hIcon == IntPtr.Zero) {
      SHGetFileInfo(path, 0x80, ref info, (uint)Marshal.SizeOf(info), SHGFI_ICON | SHGFI_LARGEICON | SHGFI_USEFILEATTRIBUTES);
    }
    return info.hIcon;
  }
  public static IntPtr GetDllIcon(string dll, int index) {
    IntPtr[] large = new IntPtr[1];
    ExtractIconEx(dll, index, large, null, 1);
    return large[0];
  }
}
"@
$jobs = @(Get-Content -LiteralPath '${escaped}' -Raw | ConvertFrom-Json)
$result = @{}
function Resolve-Lnk($path) {
  try {
    $w = New-Object -ComObject WScript.Shell
    $s = $w.CreateShortcut($path)
    $loc = [string]$s.IconLocation
    if ($loc) {
      $comma = $loc.LastIndexOf(',')
      $file = if ($comma -ge 0) { $loc.Substring(0, $comma).Trim().Trim('"') } else { $loc.Trim().Trim('"') }
      $file = [Environment]::ExpandEnvironmentVariables($file)
      $idx = if ($comma -ge 0) { [int]$loc.Substring($comma + 1) } else { 0 }
      if ($file -and (Test-Path -LiteralPath $file)) { return @{ dll = $file; index = $idx; path = $null } }
    }
    $t = [string]$s.TargetPath
    if ($t) { return @{ dll = $null; index = 0; path = $t } }
  } catch {}
  return $null
}
function Resolve-Url($path) {
  try {
    $file = $null; $idx = 0
    Get-Content -LiteralPath $path -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_ -match '^IconFile=(.+)$') { $file = $Matches[1].Trim().Trim('"') }
      if ($_ -match '^IconIndex=(.+)$') { $idx = [int]$Matches[1] }
    }
    if ($file -and (Test-Path -LiteralPath $file)) { return @{ dll = $file; index = $idx; path = $null } }
  } catch {}
  return $null
}
foreach ($job in $jobs) {
  $key = [string]$job.orig
  try {
    $h = [IntPtr]::Zero
    $dll = [string]$job.dll
    $src = [string]$job.path
    $idx = 0
    if ($job.index -ne $null -and $job.index -ne '') { $idx = [int]$job.index }
    if (-not $dll -and $src -like '*.lnk') {
      $resolved = Resolve-Lnk $src
      if ($resolved) {
        if ($resolved.dll) { $dll = $resolved.dll; $idx = [int]$resolved.index }
        elseif ($resolved.path) { $src = $resolved.path }
      }
    }
    if (-not $dll -and $src -like '*.url') {
      $resolved = Resolve-Url $src
      if ($resolved -and $resolved.dll) { $dll = $resolved.dll; $idx = [int]$resolved.index }
    }
    if ($dll) {
      $dll = [Environment]::ExpandEnvironmentVariables($dll)
      $h = [EdexIcon]::GetDllIcon($dll, $idx)
    }
    elseif ($src) { $h = [EdexIcon]::GetIcon($src) }
    if ($h -eq [IntPtr]::Zero -and [string]$job.path) { $h = [EdexIcon]::GetIcon([string]$job.path) }
    if ($h -eq [IntPtr]::Zero) { continue }
    $icon = [System.Drawing.Icon]::FromHandle($h)
    $bmp = $icon.ToBitmap()
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $result[$key] = [Convert]::ToBase64String($ms.ToArray())
    $ms.Dispose(); $bmp.Dispose(); $icon.Dispose()
    [EdexIcon]::DestroyIcon($h) | Out-Null
  } catch {}
}
if ($result.Count -eq 0) { '{}' } else { $result | ConvertTo-Json -Compress }
`, 25000);

  try { fs.unlinkSync(listFile); } catch { /* ignore */ }

  let map = {};
  try {
    map = raw ? JSON.parse(raw) : {};
  } catch {
    map = {};
  }
  for (const [p, b64] of Object.entries(map || {})) {
    if (b64) cache.set(p, `data:image/png;base64,${b64}`);
  }
  for (const p of missing) {
    if (!cache.has(p)) cache.set(p, "");
  }
  return Object.fromEntries(unique.map((p) => [p, cache.get(p) || ""]));
}

const SPECIAL_ICON_SOURCES = {
  thispc: "shell:MyComputerFolder",
  recycle: "shell:RecycleBinFolder"
};

async function decorateItems(items = []) {
  const paths = items.map((item) => {
    if (item.kind === "thispc") return SPECIAL_ICON_SOURCES.thispc;
    if (item.kind === "recycle") return SPECIAL_ICON_SOURCES.recycle;
    return item.path;
  }).filter(Boolean);
  const icons = await extractIcons(paths);
  return items.map((item) => {
    const key = item.kind === "thispc"
      ? SPECIAL_ICON_SOURCES.thispc
      : item.kind === "recycle"
        ? SPECIAL_ICON_SOURCES.recycle
        : item.path;
    const dataUrl = icons[key] || "";
    return {
      ...item,
      displayName: item.displayName || displayName(item.name, item.isDirectory),
      icon: dataUrl
        ? { key: "sys", dataUrl, width: 32, height: 32 }
        : item.icon
    };
  });
}

module.exports = { displayName, extractIcons, decorateItems };
