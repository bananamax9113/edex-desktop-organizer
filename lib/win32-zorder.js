const { spawn } = require("child_process");

let ps = null;
let starting = null;
let seq = 0;
const pending = new Map();

function hwndOf(win) {
  if (!win || win.isDestroyed()) return "";
  const buf = win.getNativeWindowHandle();
  if (!buf || !buf.length) return "";
  return (buf.length >= 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0))).toString();
}

function script() {
  return `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class EdexZ {
  const int GWL_EXSTYLE = -20;
  const int WS_EX_NOACTIVATE = unchecked((int)0x08000000);
  const uint SWP_NOSIZE = 0x0001;
  const uint SWP_NOMOVE = 0x0002;
  const uint SWP_NOZORDER = 0x0004;
  const uint SWP_NOACTIVATE = 0x0010;
  const uint SWP_NOOWNERZORDER = 0x0200;
  const uint SWP_FRAMECHANGED = 0x0020;
  const uint SWP_NOSENDCHANGING = 0x0400;
  static readonly IntPtr HWND_BOTTOM = new IntPtr(1);
  [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int i, int v);
  [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int nCmdShow);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  const int SW_RESTORE = 9;
  static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
  static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
  public static void AllowFg() { AllowSetForegroundWindow(-1); }
  public static void ForceFg(IntPtr hwnd) {
    if (hwnd == IntPtr.Zero) return;
    AllowSetForegroundWindow(-1);
    ShowWindow(hwnd, SW_RESTORE);
    IntPtr fg = GetForegroundWindow();
    uint fgPid; uint fgTid = GetWindowThreadProcessId(fg, out fgPid);
    uint cur = GetCurrentThreadId();
    if (fgTid != 0 && fgTid != cur) AttachThreadInput(cur, fgTid, true);
    BringWindowToTop(hwnd);
    SetForegroundWindow(hwnd);
    // Brief topmost flash so Explorer clears a fullscreen overlay that stole z-order on click.
    SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE);
    SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE);
    if (fgTid != 0 && fgTid != cur) AttachThreadInput(cur, fgTid, false);
  }
  public static void Pin(IntPtr hwnd) {
    if (hwnd == IntPtr.Zero) return;
    int ex = GetWindowLong(hwnd, GWL_EXSTYLE);
    SetWindowLong(hwnd, GWL_EXSTYLE, ex | WS_EX_NOACTIVATE);
    SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0, SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE | SWP_NOOWNERZORDER);
  }
  // Clear WS_EX_NOACTIVATE for OLE drag, but keep HWND_BOTTOM so WeChat/IM
  // windows stay above our fullscreen overlay and receive DragEnter.
  public static void PrepareDrag(IntPtr hwnd) {
    if (hwnd == IntPtr.Zero) return;
    int ex = GetWindowLong(hwnd, GWL_EXSTYLE);
    SetWindowLong(hwnd, GWL_EXSTYLE, ex & ~WS_EX_NOACTIVATE);
    SetWindowPos(hwnd, HWND_BOTTOM, 0, 0, 0, 0,
      SWP_NOSIZE | SWP_NOMOVE | SWP_NOACTIVATE | SWP_NOOWNERZORDER | SWP_FRAMECHANGED | SWP_NOSENDCHANGING);
  }
}
"@
[Console]::OutputEncoding = [Text.Encoding]::UTF8
while (($line = [Console]::In.ReadLine()) -ne $null) {
  $t = $line.Trim()
  if ($t -eq 'quit') { break }
  if (-not $t) { continue }
  $parts = $t.Split(' ', 3)
  $id = $parts[0]
  $cmd = if ($parts.Length -ge 2) { $parts[1] } else { 'pin' }
  $hwndRaw = if ($parts.Length -ge 3) { $parts[2] } else { if ($parts.Length -ge 2) { $parts[1] } else { '' } }
  # Backward compatible: "id hwnd" => pin
  if ($parts.Length -eq 2 -and $cmd -match '^-?\\d+$') {
    $hwndRaw = $cmd
    $cmd = 'pin'
  }
  try {
    if ($cmd -eq 'fg') {
      [EdexZ]::AllowFg()
      Write-Output ('ok ' + $id)
      continue
    }
    if ($cmd -eq 'raisePath') {
      $target = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($hwndRaw))
      try { $targetNorm = [IO.Path]::GetFullPath($target).TrimEnd([char]0x5C).ToLowerInvariant() } catch { $targetNorm = $target.TrimEnd('\\').ToLowerInvariant() }
      $deadline = [Environment]::TickCount + 2200
      $raised = $false
      while (-not $raised -and [Environment]::TickCount -lt $deadline) {
        try {
          $sh = New-Object -ComObject Shell.Application
          foreach ($w in @($sh.Windows())) {
            try {
              $loc = $null
              try { $loc = $w.Document.Folder.Self.Path } catch {}
              if (-not $loc) { continue }
              $locNorm = [IO.Path]::GetFullPath($loc).TrimEnd([char]0x5C).ToLowerInvariant()
              if ($locNorm -eq $targetNorm) {
                [EdexZ]::ForceFg([IntPtr][Int64]$w.HWND)
                $raised = $true
                break
              }
            } catch {}
          }
        } catch {}
        if (-not $raised) { Start-Sleep -Milliseconds 80 }
      }
      Write-Output ('ok ' + $id)
      continue
    }
    $hwnd = [IntPtr][Int64]$hwndRaw
    if ($cmd -eq 'raise') { [EdexZ]::ForceFg($hwnd) }
    elseif ($cmd -eq 'drag') { [EdexZ]::PrepareDrag($hwnd) }
    else { [EdexZ]::Pin($hwnd) }
    Write-Output ('ok ' + $id)
  } catch {
    Write-Output ('err ' + $id)
  }
}
`;
}

function attachStdout(child) {
  let buf = "";
  child.stdout.on("data", (chunk) => {
    buf += String(chunk);
    const lines = buf.split(/\r?\n/);
    buf = lines.pop() || "";
    for (const line of lines) {
      const m = String(line).trim().match(/^(ok|err)\s+(\S+)/);
      if (!m) continue;
      const resolve = pending.get(m[2]);
      if (resolve) {
        pending.delete(m[2]);
        resolve();
      }
    }
  });
}

async function ensureDaemon() {
  if (ps && !ps.killed) return ps;
  if (starting) return starting;
  starting = new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-STA", "-Command", script()], {
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    attachStdout(child);
    child.on("exit", () => {
      if (ps === child) ps = null;
      for (const resolve of pending.values()) resolve();
      pending.clear();
    });
    ps = child;
    starting = null;
    resolve(child);
  });
  return starting;
}

let dragDepth = 0;
let prepared = false;
let prepareGen = 0;

function sendDaemon(cmd, hwnd, timeoutMs = 2500) {
  return new Promise(async (resolve) => {
    try {
      const child = await ensureDaemon();
      if (!child || child.killed || (!hwnd && cmd !== "fg")) {
        resolve(false);
        return;
      }
      const id = String(++seq);
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve(false);
      }, timeoutMs);
      pending.set(id, () => {
        clearTimeout(timer);
        resolve(true);
      });
      child.stdin.write(`${id} ${cmd} ${hwnd || "0"}\n`);
    } catch (err) {
      console.error("z-order daemon", err);
      resolve(false);
    }
  });
}

function isFileDragActive() {
  return dragDepth > 0;
}

function allowForeground() {
  sendDaemon("fg", "0", 400).catch(() => {});
}

/** Force a native HWND (e.g. Explorer) above our overlay after a double-click open. */
function raiseNativeWindow(hwnd) {
  if (!hwnd) return Promise.resolve(false);
  return sendDaemon("raise", String(hwnd), 1200);
}

/** Find Explorer window for a folder path and raise it (warm daemon, no cold PS). */
function raiseExplorerPath(dirPath) {
  if (process.platform !== "win32" || !dirPath) return Promise.resolve(false);
  const b64 = Buffer.from(String(dirPath), "utf8").toString("base64");
  return sendDaemon("raisePath", b64, 2800);
}

async function pinWindowBottom(win, { force = false } = {}) {
  if (process.platform !== "win32") return;
  // During drag we still want HWND_BOTTOM so Explorer isn't covered; only skip
  // if a non-forced caller runs while depth>0 without needing a re-pin.
  if (dragDepth > 0 && !force) return;
  const hwnd = hwndOf(win);
  if (!hwnd) return;
  await sendDaemon("pin", hwnd);
}

/**
 * Async prepare for file drag — warm daemon clears WS_EX_NOACTIVATE, keeps HWND_BOTTOM.
 * Call on pointerdown before dragstart so startDrag is not blocked by PowerShell.
 */
async function prepareWindowForFileDrag(win) {
  if (process.platform !== "win32") return false;
  const hwnd = hwndOf(win);
  if (!hwnd) return false;
  const gen = ++prepareGen;
  prepared = true;
  const ok = await sendDaemon("drag", hwnd, 800);
  if (gen !== prepareGen) return false;
  return ok;
}

/**
 * Sync entry used from start-file-drag IPC.
 * Does NOT spawn a cold PowerShell (that froze the UI); relies on warm daemon + early prepare.
 */
function prepareWindowForFileDragSync(win) {
  if (process.platform !== "win32") return;
  const hwnd = hwndOf(win);
  if (!hwnd) return;
  dragDepth += 1;
  prepared = true;
  // Clear NOACTIVATE and force HWND_BOTTOM (PrepareDrag) — never spawnSync.
  sendDaemon("drag", hwnd, 600).catch(() => {});
}

function restoreWindowAfterFileDrag(win) {
  if (process.platform !== "win32") return;
  dragDepth = Math.max(0, dragDepth - 1);
  prepared = false;
  if (dragDepth > 0) return;
  if (!win || win.isDestroyed()) return;
  // Re-pin asynchronously so we don't block the drag IPC return path longer than needed.
  pinWindowBottom(win).catch(() => {});
}

/** Undo pointerdown prepare when the user never started an OLE drag. */
function cancelPreparedFileDrag(win) {
  if (process.platform !== "win32") return;
  if (dragDepth > 0) return;
  prepareGen += 1;
  if (!prepared) return;
  prepared = false;
  if (!win || win.isDestroyed()) return;
  pinWindowBottom(win).catch(() => {});
}

function stopZOrderDaemon() {
  try {
    if (ps && !ps.killed) {
      ps.stdin.write("quit\n");
      ps.kill();
    }
  } catch {
    // ignore
  }
  ps = null;
  dragDepth = 0;
  prepared = false;
  prepareGen = 0;
}

module.exports = {
  pinWindowBottom,
  stopZOrderDaemon,
  ensureDaemon,
  prepareWindowForFileDrag,
  prepareWindowForFileDragSync,
  restoreWindowAfterFileDrag,
  cancelPreparedFileDrag,
  isFileDragActive,
  allowForeground,
  raiseNativeWindow,
  raiseExplorerPath
};
