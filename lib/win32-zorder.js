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
  [DllImport("user32.dll", SetLastError=true)] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr h, int i, int v);
  public static void Pin(IntPtr hwnd) {
    if (hwnd == IntPtr.Zero) return;
    int ex = GetWindowLong(hwnd, -20);
    SetWindowLong(hwnd, -20, ex | unchecked((int)0x08000000));
    SetWindowPos(hwnd, new IntPtr(1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0010 | 0x0200);
  }
}
"@
[Console]::OutputEncoding = [Text.Encoding]::UTF8
while (($line = [Console]::In.ReadLine()) -ne $null) {
  $t = $line.Trim()
  if ($t -eq 'quit') { break }
  if (-not $t) { continue }
  $parts = $t.Split(' ', 2)
  $id = $parts[0]
  $hwndRaw = if ($parts.Length -gt 1) { $parts[1] } else { $parts[0] }
  try {
    $hwnd = [IntPtr][Int64]$hwndRaw
    [EdexZ]::Pin($hwnd)
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

async function pinWindowBottom(win) {
  if (process.platform !== "win32") return;
  const hwnd = hwndOf(win);
  if (!hwnd) return;
  try {
    const child = await ensureDaemon();
    if (!child || child.killed) return;
    const id = String(++seq);
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 2500);
      pending.set(id, () => {
        clearTimeout(timer);
        resolve();
      });
      child.stdin.write(`${id} ${hwnd}\n`);
    });
  } catch (err) {
    console.error("pin desktop", err);
  }
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
}

module.exports = { pinWindowBottom, stopZOrderDaemon, ensureDaemon };
