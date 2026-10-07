const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

function runPs(command, timeout = 8000) {
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

function hexRgb(hex, fallback) {
  const h = String(hex || "").replace("#", "");
  if (h.length < 6) return fallback;
  return [
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16)
  ];
}

function writeBmp(file, width, height, paint) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelBytes = rowSize * height;
  const buf = Buffer.alloc(54 + pixelBytes);
  buf.write("BM", 0);
  buf.writeUInt32LE(54 + pixelBytes, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(pixelBytes, 34);

  const row = Buffer.alloc(rowSize);
  for (let y = 0; y < height; y += 1) {
    row.fill(0);
    const srcY = height - 1 - y;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = paint(x, srcY, width, height);
      const o = x * 3;
      row[o] = b;
      row[o + 1] = g;
      row[o + 2] = r;
    }
    row.copy(buf, 54 + y * rowSize);
  }
  fs.writeFileSync(file, buf);
}

function gridTone(colors) {
  const bg = hexRgb(colors.light_black || colors.black, [5, 8, 13]);
  const grey = hexRgb(colors.grey, [38, 40, 40]);
  return {
    bg,
    line: [
      Math.round(bg[0] + (grey[0] - bg[0]) * 0.55),
      Math.round(bg[1] + (grey[1] - bg[1]) * 0.55),
      Math.round(bg[2] + (grey[2] - bg[2]) * 0.55)
    ]
  };
}

function allocBmp(width, height, bg) {
  const rowSize = Math.floor((24 * width + 31) / 32) * 4;
  const pixelBytes = rowSize * height;
  const buf = Buffer.alloc(54 + pixelBytes);
  buf.write("BM", 0);
  buf.writeUInt32LE(54 + pixelBytes, 2);
  buf.writeUInt32LE(54, 10);
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28);
  buf.writeUInt32LE(pixelBytes, 34);
  const row = Buffer.alloc(rowSize);
  for (let x = 0; x < width; x += 1) {
    const o = x * 3;
    row[o] = bg[2];
    row[o + 1] = bg[1];
    row[o + 2] = bg[0];
  }
  for (let y = 0; y < height; y += 1) row.copy(buf, 54 + y * rowSize);
  return { buf, rowSize, width, height };
}

function putPixel(buf, rowSize, width, height, x, y, rgb) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const o = 54 + (height - 1 - y) * rowSize + x * 3;
  buf[o] = rgb[2];
  buf[o + 1] = rgb[1];
  buf[o + 2] = rgb[0];
}

function strokeMonitorGrid(buf, rowSize, imgW, imgH, ox, oy, w, h, cell, line) {
  const c = roundCell(cell);
  for (let x = 0; x < w; x += 1) {
    if (x % c !== 0 && x !== w - 1) continue;
    for (let y = 0; y < h; y += 1) putPixel(buf, rowSize, imgW, imgH, ox + x, oy + y, line);
  }
  for (let y = 0; y < h; y += 1) {
    if (y % c !== 0 && y !== h - 1) continue;
    for (let x = 0; x < w; x += 1) putPixel(buf, rowSize, imgW, imgH, ox + x, oy + y, line);
  }
}

function writeSpanGridBmp(file, box, rects, baseCell, colors) {
  const { bg, line } = gridTone(colors);
  const { buf, rowSize, width, height } = allocBmp(box.w, box.h, bg);
  for (const r of rects) {
    strokeMonitorGrid(
      buf,
      rowSize,
      width,
      height,
      r.x - box.x,
      r.y - box.y,
      r.w,
      r.h,
      scaledGridCell(baseCell, r.w, r.h),
      line
    );
  }
  fs.writeFileSync(file, buf);
}

function writeMonitorGridBmp(file, w, h, cell, colors) {
  const { bg, line } = gridTone(colors);
  const { buf, rowSize, width, height } = allocBmp(w, h, bg);
  strokeMonitorGrid(buf, rowSize, width, height, 0, 0, w, h, cell, line);
  fs.writeFileSync(file, buf);
}

function runPsFile(script, args, timeout = 20000) {
  return new Promise((resolve) => {
    execFile("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      script,
      ...args
    ], {
      windowsHide: true,
      timeout,
      encoding: "utf8"
    }, (err, stdout) => {
      resolve(String(stdout || "").trim());
    });
  });
}

function ensureWallScript(userData) {
  const cs = path.join(userData, "edex-wall-apply.cs");
  const ps1 = path.join(userData, "edex-wall-apply.ps1");
  fs.writeFileSync(cs, WALL_COM.trim(), "utf8");
  fs.writeFileSync(ps1, [
    "param($Mode,$Arg)",
    "$code = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'edex-wall-apply.cs'))",
    "Add-Type -TypeDefinition $code",
    "if ($Mode -eq 'List') { [WallApply]::List(); return }",
    "if ($Mode -eq 'Span') { [WallApply]::Span($Arg); return }",
    "$pack = [IO.File]::ReadAllText($Arg)",
    "[WallApply]::Apply($pack.Trim())"
  ].join("\r\n"), "utf8");
  return ps1;
}

function paintFor(style, colors, gridCell = 32) {
  const bg = hexRgb(colors.light_black || colors.black, [5, 8, 13]);
  const grey = hexRgb(colors.grey, [38, 40, 40]);
  const acc = [
    Number(colors.r ?? 170),
    Number(colors.g ?? 207),
    Number(colors.b ?? 209)
  ];
  const mix = (a, b, t) => [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
  const cell = Math.max(12, Math.min(96, Math.round(Number(gridCell) || 32)));

  if (style === "solid") {
    return () => bg;
  }
  if (style === "scanlines") {
    return (x, y) => (y % 3 === 0 ? mix(bg, acc, 0.08) : bg);
  }
  if (style === "radial") {
    return (x, y, w, h) => {
      const dx = (x - w / 2) / (w / 2);
      const dy = (y - h / 2) / (h / 2);
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      return mix(acc, bg, 0.55 + d * 0.45);
    };
  }
  if (style === "hex") {
    return (x, y) => {
      const hex = 48;
      const on = ((x + y * 2) % hex < 3) || ((x * 2 + y) % hex < 3);
      return on ? mix(bg, acc, 0.12) : bg;
    };
  }
  return (x, y) => {
    if (x % cell === cell - 1 || y % cell === cell - 1) return mix(bg, grey, 0.55);
    return bg;
  };
}

function backupFile(userData) {
  return path.join(userData, "wallpaper-backup.json");
}

async function backupWallpaper(userData) {
  const file = backupFile(userData);
  if (fs.existsSync(file)) return;
  const raw = await runPs(
    "(Get-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' | Select-Object Wallpaper,WallpaperStyle,TileWallpaper) | ConvertTo-Json -Compress"
  );
  let info = { Wallpaper: "", WallpaperStyle: "10", TileWallpaper: "0" };
  try {
    if (raw) info = { ...info, ...JSON.parse(raw) };
  } catch {
    // keep defaults
  }
  fs.writeFileSync(file, JSON.stringify(info, null, 2));
}

async function setWindowsWallpaper(imagePath, mode = "fill") {
  const abs = path.resolve(imagePath).replace(/'/g, "''");
  const style = mode === "tile" ? "0" : mode === "span" ? "22" : "10";
  const tile = mode === "tile" ? "1" : "0";
  await runPs(`
    Add-Type @"
using System.Runtime.InteropServices;
public class NativeWall {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@
    Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name WallpaperStyle -Value ${style}
    Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name TileWallpaper -Value ${tile}
    Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name Wallpaper -Value '${abs}'
    [NativeWall]::SystemParametersInfo(20, 0, '${abs}', 3) | Out-Null
  `, 15000);
}

function displayPhysicals() {
  try {
    const { screen } = require("electron");
    return screen.getAllDisplays().map((d) => {
      const dip = d.bounds;
      const scale = d.scaleFactor || 1;
      const mapped = typeof screen.dipToScreenRect === "function"
        ? screen.dipToScreenRect(null, dip)
        : null;
      const w = Math.max(Math.round(dip.width * scale), Number(mapped?.width) || 0);
      const h = Math.max(Math.round(dip.height * scale), Number(mapped?.height) || 0);
      const x = Number.isFinite(mapped?.x) ? mapped.x : Math.round(dip.x * scale);
      const y = Number.isFinite(mapped?.y) ? mapped.y : Math.round(dip.y * scale);
      return { x, y, w, h };
    });
  } catch {
    return [{ x: 0, y: 0, w: 1920, h: 1080 }];
  }
}

async function enumMonitorRects() {
  const raw = await runPs(`
Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class Mon {
  public delegate bool Cb(IntPtr h, IntPtr c, ref RECT r, IntPtr d);
  [StructLayout(LayoutKind.Sequential)]
  public struct RECT { public int L; public int T; public int R; public int B; }
  [DllImport("user32.dll")] public static extern bool EnumDisplayMonitors(IntPtr a, IntPtr b, Cb cb, IntPtr d);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr dpiContext);
  public static string List() {
    try { SetThreadDpiAwarenessContext(new IntPtr(-4)); } catch {}
    var s = new List<string>();
    EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, (IntPtr h, IntPtr c, ref RECT r, IntPtr d) => {
      s.Add((r.R-r.L).ToString() + "x" + (r.B-r.T).ToString() + "@" + r.L.ToString() + "," + r.T.ToString());
      return true;
    }, IntPtr.Zero);
    return string.Join(";", s.ToArray());
  }
}
"@
[Mon]::List()
  `);
  const parsed = String(raw || "").split(";").map((part) => {
    const m = part.trim().match(/^(\d+)x(\d+)@(-?\d+),(-?\d+)$/);
    if (!m) return null;
    return { w: Number(m[1]), h: Number(m[2]), x: Number(m[3]), y: Number(m[4]) };
  }).filter(Boolean);
  return parsed.length ? parsed : displayPhysicals();
}

function paintMonitorCell(colors, cell, width, height) {
  const bg = hexRgb(colors.light_black || colors.black, [5, 8, 13]);
  const grey = hexRgb(colors.grey, [38, 40, 40]);
  const line = [
    Math.round(bg[0] + (grey[0] - bg[0]) * 0.55),
    Math.round(bg[1] + (grey[1] - bg[1]) * 0.55),
    Math.round(bg[2] + (grey[2] - bg[2]) * 0.55)
  ];
  const c = roundCell(cell);
  return (x, y) => {
    const onX = x % c === 0 || x === width - 1;
    const onY = y % c === 0 || y === height - 1;
    return onX || onY ? line : bg;
  };
}

function uniqueRects(list) {
  const seen = new Set();
  return (list || []).filter((r) => {
    const w = Number(r?.w);
    const h = Number(r?.h);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 8 || h < 8) return false;
    const k = `${Number(r.x)}|${Number(r.y)}|${w}|${h}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function paintVirtualGrid(colors, cell, rects, originX, originY, layoutMode) {
  const bg = hexRgb(colors.light_black || colors.black, [5, 8, 13]);
  const grey = hexRgb(colors.grey, [38, 40, 40]);
  const line = [
    Math.round(bg[0] + (grey[0] - bg[0]) * 0.55),
    Math.round(bg[1] + (grey[1] - bg[1]) * 0.55),
    Math.round(bg[2] + (grey[2] - bg[2]) * 0.55)
  ];
  const mons = rects.map((r) => ({
    x: r.x - originX,
    y: r.y - originY,
    w: r.w,
    h: r.h,
    c: scaledGridCell(cell, r.w, r.h)
  }));
  return (x, y) => {
    const mon = mons.find((m) => x >= m.x && x < m.x + m.w && y >= m.y && y < m.y + m.h);
    if (!mon) return bg;
    const c = mon.c;
    const lx = x - mon.x;
    const ly = y - mon.y;
    const onX = lx % c === 0 || lx === mon.w - 1;
    const onY = ly % c === 0 || ly === mon.h - 1;
    return onX || onY ? line : bg;
  };
}

function roundCell(cell) {
  return Math.max(4, Math.min(96, Math.round(Number(cell) || 32)));
}

function primaryPhysical() {
  try {
    const { screen } = require("electron");
    const p = screen.getPrimaryDisplay();
    const dip = p.bounds;
    const scale = p.scaleFactor || 1;
    const phys = typeof screen.dipToScreenRect === "function"
      ? screen.dipToScreenRect(null, dip)
      : null;
    const w = Math.max(
      Math.round(dip.width * scale),
      Number(phys?.width) || 0
    );
    const h = Math.max(
      Math.round(dip.height * scale),
      Number(phys?.height) || 0
    );
    if (w > 4 && h > 4) return { w, h };
  } catch {
    // fall through
  }
  return { w: 3840, h: 2160 };
}

function scaledGridCell(baseCell, width, height) {
  const d = primaryPhysical();
  const w = Number(width);
  const h = Number(height);
  if (!(w > 4 && h > 4 && d.w > 4 && d.h > 4)) return roundCell(baseCell);
  const short = Math.min(w, h) / Math.min(d.w, d.h);
  const long = Math.max(w, h) / Math.max(d.w, d.h);
  const fit = Math.min(short, long, 1);
  const n = (Number(baseCell) || 32) * (Number.isFinite(fit) && fit > 0 ? fit : 1);
  return roundCell(n);
}

async function virtualScreenRect() {
  const raw = await runPs(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Virt {
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int n);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr c);
  public static string Run() {
    try { SetThreadDpiAwarenessContext(new IntPtr(-4)); } catch {}
    return GetSystemMetrics(76).ToString() + "," + GetSystemMetrics(77).ToString() + "," + GetSystemMetrics(78).ToString() + "," + GetSystemMetrics(79).ToString();
  }
}
"@
[Virt]::Run()
  `);
  const m = String(raw || "").trim().match(/^(-?\d+),(-?\d+),(\d+),(\d+)$/);
  if (!m) return null;
  return { x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) };
}

function boundsOf(rects) {
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  return {
    x: minX,
    y: minY,
    w: Math.max(...rects.map((r) => r.x + r.w)) - minX,
    h: Math.max(...rects.map((r) => r.y + r.h)) - minY
  };
}

async function applySpanGrid(userData, colors, cell) {
  const virt = await virtualScreenRect();
  const electron = uniqueRects(displayPhysicals());
  const com = uniqueRects(await enumMonitorRects());
  const lists = [electron, com].filter((list) => list.length);
  let used = lists[0] || [];
  if (virt && virt.w > 8 && virt.h > 8) {
    const matched = lists.find((list) => {
      const b = boundsOf(list);
      return Math.abs(b.w - virt.w) < 8 && Math.abs(b.h - virt.h) < 8;
    });
    if (matched) used = matched;
  }
  if (!used.length) return false;
  const box = virt && virt.w > 8 && virt.h > 8 ? virt : boundsOf(used);
  if (box.w < 8 || box.h < 8 || box.w * box.h > 32000000) return false;
  const out = path.join(userData, `edex-desktop-span-${Date.now()}-${box.w}x${box.h}.bmp`);
  writeSpanGridBmp(out, box, used, cell, colors);
  const ps1 = ensureWallScript(userData);
  const comOk = String(await runPsFile(ps1, ["Span", out], 20000) || "").includes("ok:");
  if (!comOk) await setWindowsWallpaper(out, "span");
  return true;
}

const WALL_COM = String.raw`
using System;
using System.Runtime.InteropServices;
using System.Text;
[StructLayout(LayoutKind.Sequential)]
public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
public enum DWPOS { Center=0, Tile=1, Stretch=2, Fit=3, Fill=4, Span=5 }
[ComImport, Guid("B92B56A9-8B55-4E14-9A89-DEC776F8F2A6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IDesktopWallpaper {
  void SetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitorID, [MarshalAs(UnmanagedType.LPWStr)] string wallpaper);
  void GetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitorID, out IntPtr wallpaper);
  void GetMonitorDevicePathAt(uint monitorIndex, out IntPtr monitorID);
  void GetMonitorDevicePathCount(out uint count);
  void GetMonitorRECT([MarshalAs(UnmanagedType.LPWStr)] string monitorID, out RECT displayRect);
  void SetBackgroundColor(uint color);
  void GetBackgroundColor(out uint color);
  void SetPosition(DWPOS position);
  void GetPosition(out DWPOS position);
  void SetSlideshow(IntPtr items);
  void GetSlideshow(out IntPtr items);
  void SetSlideshowOptions(int options, uint slideshowTick);
  void GetSlideshowOptions(out int options, out uint slideshowTick);
  void AdvanceSlideshow([MarshalAs(UnmanagedType.LPWStr)] string monitorID, int direction);
  void GetStatus(out int state);
  void Enable([MarshalAs(UnmanagedType.Bool)] bool enable);
}
[ComImport, Guid("C2CFDF39-5C4B-4651-9D14-A0C50779481C")]
public class DesktopWallpaperC {}
public static class WallApply {
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr dpiContext);
  public static string List() {
    try { SetThreadDpiAwarenessContext(new IntPtr(-4)); } catch {}
    var wp = (IDesktopWallpaper)new DesktopWallpaperC();
    uint n;
    wp.GetMonitorDevicePathCount(out n);
    var sb = new StringBuilder();
    for (uint i = 0; i < n; i++) {
      IntPtr pid;
      wp.GetMonitorDevicePathAt(i, out pid);
      string id = Marshal.PtrToStringUni(pid) ?? "";
      RECT rc;
      wp.GetMonitorRECT(id, out rc);
      if (sb.Length > 0) sb.Append('|');
      sb.Append(rc.Left).Append(';').Append(rc.Top).Append(';')
        .Append(rc.Right - rc.Left).Append(';').Append(rc.Bottom - rc.Top).Append(';')
        .Append(id.Replace("\\", "/"));
    }
    return sb.ToString();
  }
  public static string Apply(string json) {
    try { SetThreadDpiAwarenessContext(new IntPtr(-4)); } catch {}
    var wp = (IDesktopWallpaper)new DesktopWallpaperC();
    uint n;
    wp.GetMonitorDevicePathCount(out n);
    var maps = json.Replace("\r","\n").Split(new char[] {'\n','|'});
    int applied = 0;
    for (uint i = 0; i < n; i++) {
      IntPtr pid;
      wp.GetMonitorDevicePathAt(i, out pid);
      string id = Marshal.PtrToStringUni(pid) ?? "";
      if (i < maps.Length && maps[i].Length > 0) {
        wp.SetWallpaper(id, maps[i]);
        applied++;
      }
    }
    wp.SetPosition(DWPOS.Stretch);
    return applied > 0 ? "ok:" + applied.ToString() + "/" + n.ToString() : "fail";
  }
  public static string Span(string path) {
    try { SetThreadDpiAwarenessContext(new IntPtr(-4)); } catch {}
    var wp = (IDesktopWallpaper)new DesktopWallpaperC();
    wp.SetPosition(DWPOS.Span);
    wp.SetWallpaper(null, path);
    return "ok:span";
  }
}
`;

function nearestRect(target, list) {
  let best = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const r of list || []) {
    const d = Math.abs(Number(r.x) - Number(target.x)) + Math.abs(Number(r.y) - Number(target.y));
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

async function listWallpaperMonitors(userData) {
  const ps1 = ensureWallScript(userData);
  const raw = await runPsFile(ps1, ["List"], 12000);
  const line = String(raw || "")
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter((row) => row.includes(";"))
    .pop() || "";
  return line.split("|").map((row) => {
    const p = row.split(";");
    if (p.length < 4) return null;
    const x = Number(p[0]);
    const y = Number(p[1]);
    const w = Number(p[2]);
    const h = Number(p[3]);
    if (!(w > 8 && h > 8)) return null;
    return { x, y, w, h };
  }).filter(Boolean);
}

function cleanupWallFiles(userData, keep) {
  const keepSet = new Set((keep || []).map((file) => path.basename(file)));
  let names = [];
  try {
    names = fs.readdirSync(userData);
  } catch {
    return;
  }
  for (const name of names) {
    if (!/^edex-wall-\d/.test(name) && name !== "edex-desktop-wallpaper.bmp") continue;
    if (keepSet.has(name)) continue;
    try { fs.unlinkSync(path.join(userData, name)); } catch { /* ignore */ }
  }
}

async function applyPerMonitorGrid(userData, colors, cell) {
  const comMons = await listWallpaperMonitors(userData);
  const electron = uniqueRects(displayPhysicals());
  const mons = comMons.length ? comMons : electron;
  if (!mons.length) return false;
  const stamp = Date.now();
  const files = mons.map((mon, i) => {
    const el = nearestRect(mon, electron);
    const w = Math.max(Number(mon.w) || 0, Number(el?.w) || 0);
    const h = Math.max(Number(mon.h) || 0, Number(el?.h) || 0);
    const pitch = scaledGridCell(cell, w, h);
    const file = path.join(userData, `edex-wall-${stamp}-${i}-${w}x${h}.bmp`);
    writeMonitorGridBmp(file, w, h, pitch, colors);
    return file;
  });
  const packFile = path.join(userData, "edex-wall-pack.txt");
  fs.writeFileSync(packFile, files.join("\n"), "utf8");
  const ps1 = ensureWallScript(userData);
  const ok = await runPsFile(ps1, ["Apply", packFile], 20000);
  const hit = String(ok || "").match(/ok:(\d+)\/(\d+)/);
  const applied = hit ? Number(hit[1]) : 0;
  const total = hit ? Number(hit[2]) : 0;
  const all = applied > 0 && applied === total;
  if (all) cleanupWallFiles(userData, files);
  return all;
}

async function applyAppWallpaper(userData, theme, wallpaperId, gridCell = 32, layoutMode = "2k") {
  await backupWallpaper(userData);
  const colors = theme?.colors || {};
  const style = wallpaperId || "grid";
  const cell = Math.max(12, Math.min(96, Math.round(Number(gridCell) || 32)));
  const out = path.join(userData, "edex-desktop-wallpaper.bmp");
  if (style === "grid") {
    try {
      if (await applyPerMonitorGrid(userData, colors, cell)) return out;
    } catch (err) {
      console.error("per-monitor wallpaper", err);
    }
    try {
      if (await applySpanGrid(userData, colors, cell)) return out;
    } catch (err) {
      console.error("span wallpaper", err);
    }
    if (uniqueRects(displayPhysicals()).length > 1) return out;
    const pitch = scaledGridCell(cell, primaryPhysical().w, primaryPhysical().h);
    writeMonitorGridBmp(out, pitch, pitch, pitch, colors);
    await setWindowsWallpaper(out, "tile");
    return out;
  }
  const paint = paintFor(style, colors, cell);
  writeBmp(out, 2560, 1440, paint);
  await setWindowsWallpaper(out, "fill");
  return out;
}

async function restoreWallpaper(userData) {
  const file = backupFile(userData);
  if (!fs.existsSync(file)) return;
  let info = {};
  try {
    info = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return;
  }
  const prev = String(info.Wallpaper || "").replace(/'/g, "''");
  if (!prev) return;
  const style = String(info.WallpaperStyle ?? "10").replace(/[^\d]/g, "") || "10";
  const tile = String(info.TileWallpaper ?? "0").replace(/[^\d]/g, "") || "0";
  await runPs(`
    Add-Type @"
using System.Runtime.InteropServices;
public class NativeWall {
  [DllImport("user32.dll", CharSet = CharSet.Auto)]
  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@
    Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name WallpaperStyle -Value '${style}'
    Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name TileWallpaper -Value '${tile}'
    Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name Wallpaper -Value '${prev}'
    [NativeWall]::SystemParametersInfo(20, 0, '${prev}', 3) | Out-Null
  `, 10000);
  try { fs.unlinkSync(file); } catch { /* ignore */ }
}

async function toggleDesktopIconView() {
  await runPs(`
    Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DeskIcons {
  [DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string w);
  [DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr p, IntPtr c, string cn, string wn);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, int w, int l);
}
"@
    $prog = [DeskIcons]::FindWindow('Progman', 'Program Manager')
    $view = [DeskIcons]::FindWindowEx($prog, [IntPtr]::Zero, 'SHELLDLL_DefView', $null)
    if ($view -eq [IntPtr]::Zero) {
      $worker = [IntPtr]::Zero
      do {
        $worker = [DeskIcons]::FindWindowEx([IntPtr]::Zero, $worker, 'WorkerW', $null)
        $view = [DeskIcons]::FindWindowEx($worker, [IntPtr]::Zero, 'SHELLDLL_DefView', $null)
      } while ($view -eq [IntPtr]::Zero -and $worker -ne [IntPtr]::Zero)
    }
    if ($view -ne [IntPtr]::Zero) { [DeskIcons]::PostMessage($view, 0x111, 0x7402, 0) | Out-Null }
  `, 8000);
}

function iconsBackupFile(userData) {
  return path.join(userData, "desktop-icons-backup.json");
}

async function hideDesktopIcons(userData) {
  const file = iconsBackupFile(userData);
  if (fs.existsSync(file)) return;
  const raw = await runPs("(Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -ErrorAction SilentlyContinue).HideIcons");
  const wasHidden = Number(raw) === 1;
  fs.writeFileSync(file, JSON.stringify({ HideIcons: Number(raw) || 0, wasHidden }));
  await runPs("Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name HideIcons -Value 1");
  if (!wasHidden) await toggleDesktopIconView();
}

async function restoreDesktopIcons(userData) {
  const file = iconsBackupFile(userData);
  if (!fs.existsSync(file)) return;
  let info = { HideIcons: 0, wasHidden: false };
  try { info = JSON.parse(fs.readFileSync(file, "utf8")); } catch { /* ignore */ }
  await runPs(`Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -Name HideIcons -Value ${Number(info.HideIcons) || 0}`);
  if (!info.wasHidden) await toggleDesktopIconView();
  try { fs.unlinkSync(file); } catch { /* ignore */ }
}

module.exports = { applyAppWallpaper, restoreWallpaper, hideDesktopIcons, restoreDesktopIcons };
