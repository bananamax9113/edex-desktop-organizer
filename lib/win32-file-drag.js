const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

let ps = null;
let starting = null;
let seq = 0;
const pending = new Map();
let ready = false;

/** No-op kept for API compatibility — never spawnSync on the drag path. */
function releaseMouseCaptureSync() {
  // ReleaseCapture runs inside the warm OLE daemon only.
}

function script() {
  return `
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class EdexCap2 {
  [DllImport("user32.dll")] public static extern bool ReleaseCapture();
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int v);
}
"@
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Start-FileOleDrag([string]$jsonPath, [string]$reqId) {
  $json = Get-Content -LiteralPath $jsonPath -Raw -Encoding UTF8
  $paths = @($json | ConvertFrom-Json)
  if (-not $paths -or $paths.Count -lt 1) { return 'EMPTY' }
  $shell = $null
  try { $shell = New-Object -ComObject WScript.Shell } catch {}
  $sc = New-Object System.Collections.Specialized.StringCollection
  foreach ($p in $paths) {
    $path = [string]$p
    if (-not $path) { continue }
    if ($path -match '\\.lnk$' -and $shell) {
      try {
        $t = [string]$shell.CreateShortcut($path).TargetPath
        if ($t -and (Test-Path -LiteralPath $t)) { $path = $t }
      } catch {}
    }
    if (Test-Path -LiteralPath $path) { [void]$sc.Add($path) }
  }
  if ($sc.Count -lt 1) { return 'EMPTY' }

  # Release Chromium capture while overlay still has ignore=false (armed).
  [void][EdexCap2]::ReleaseCapture()
  $down = $false
  for ($i = 0; $i -lt 50; $i++) {
    if (([EdexCap2]::GetAsyncKeyState(0x01) -band 0x8000) -ne 0) { $down = $true; break }
    Start-Sleep -Milliseconds 12
    [void][EdexCap2]::ReleaseCapture()
  }
  if (-not $down) {
    return 'ERR:請按住滑鼠左鍵不放再拖出容器'
  }

  # Signal Electron: flip to click-through BEFORE DoDragDrop so Explorer/WeChat get hits.
  Write-Output ($reqId + ' ARMED')
  Start-Sleep -Milliseconds 90
  [void][EdexCap2]::ReleaseCapture()

  $data = New-Object System.Windows.Forms.DataObject
  $data.SetFileDropList($sc)
  try {
    $effectBytes = [BitConverter]::GetBytes([int][System.Windows.Forms.DragDropEffects]::Copy)
    $ms = New-Object System.IO.MemoryStream
    [void]$ms.Write($effectBytes, 0, $effectBytes.Length)
    $null = $ms.Seek(0, 'Begin')
    $data.SetData('Preferred DropEffect', $false, $ms)
  } catch {}
  $f = New-Object System.Windows.Forms.Form
  $f.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
  $f.ShowInTaskbar = $false
  $f.TopMost = $true
  $f.Opacity = 0.01
  $f.Size = New-Object System.Drawing.Size(4, 4)
  $f.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
  $pos = [System.Windows.Forms.Cursor]::Position
  $f.Location = New-Object System.Drawing.Point(($pos.X - 2), ($pos.Y - 2))
  [void]$f.Show()
  try {
    $effects = [System.Windows.Forms.DragDropEffects]::Copy -bor [System.Windows.Forms.DragDropEffects]::Move
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $result = $f.DoDragDrop($data, $effects)
    $sw.Stop()
    if ($result.ToString() -eq 'None' -and $sw.ElapsedMilliseconds -lt 150) {
      return 'ERR:拖放未能啟動，請按住左鍵拖移後再試'
    }
    return ('OK:' + $result.ToString())
  } catch {
    return ('ERR:' + $_.Exception.Message)
  } finally {
    try { $f.Close() } catch {}
    try { $f.Dispose() } catch {}
  }
}

Write-Output 'ready'
while (($line = [Console]::In.ReadLine()) -ne $null) {
  $t = $line.Trim()
  if ($t -eq 'quit') { break }
  if (-not $t) { continue }
  $parts = $t.Split(' ', 2)
  $id = $parts[0]
  $payload = if ($parts.Length -ge 2) { $parts[1] } else { '' }
  try {
    $out = Start-FileOleDrag $payload $id
    Write-Output ($id + ' ' + $out)
  } catch {
    Write-Output ($id + ' ERR:' + $_.Exception.Message)
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
      const text = String(line).trim();
      if (!text) continue;
      if (text === "ready") {
        ready = true;
        continue;
      }
      const sp = text.indexOf(" ");
      if (sp < 0) continue;
      const id = text.slice(0, sp);
      const body = text.slice(sp + 1);
      const wait = pending.get(id);
      if (!wait) continue;
      if (/^ARMED$/i.test(body)) {
        try { wait.onArmed?.(); } catch { /* ignore */ }
        continue;
      }
      pending.delete(id);
      clearTimeout(wait.timer);
      wait.resolve(body);
    }
  });
}

async function ensureDaemon() {
  if (ps && !ps.killed && ready) return ps;
  if (starting) return starting;
  starting = new Promise((resolve, reject) => {
    ready = false;
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-Command", script()],
      { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] }
    );
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    attachStdout(child);
    const bootTimer = setTimeout(() => {
      ps = child;
      starting = null;
      resolve(child);
    }, 2500);
    child.on("exit", () => {
      clearTimeout(bootTimer);
      if (ps === child) ps = null;
      ready = false;
      for (const wait of pending.values()) {
        clearTimeout(wait.timer);
        wait.resolve("ERR:daemon-exit");
      }
      pending.clear();
    });
    const checkReady = setInterval(() => {
      if (ready) {
        clearInterval(checkReady);
        clearTimeout(bootTimer);
        ps = child;
        starting = null;
        resolve(child);
      }
    }, 50);
    child.on("error", (err) => {
      clearInterval(checkReady);
      clearTimeout(bootTimer);
      starting = null;
      reject(err);
    });
  });
  return starting;
}

function warmOleDragDaemon() {
  ensureDaemon().catch((err) => console.error("ole-drag daemon", err));
}

function normalizeFiles(paths) {
  return [...new Set((paths || []).map((p) => path.resolve(String(p || "").trim())).filter((p) => p && fs.existsSync(p)))];
}

/**
 * Async OLE file drag via warm STA PowerShell host.
 * onArmed fires after LBUTTON is confirmed, before DoDragDrop — flip click-through there.
 */
async function startOleFileDrag(paths, opts = {}) {
  if (process.platform !== "win32") {
    return { ok: false, message: "僅支援 Windows" };
  }
  const files = normalizeFiles(paths);
  if (!files.length) {
    return { ok: false, message: "沒有可拖放的檔案" };
  }

  const listPath = path.join(os.tmpdir(), `edex-ole-drag-${process.pid}-${Date.now().toString(36)}.json`);
  fs.writeFileSync(listPath, JSON.stringify(files), "utf8");

  try {
    const child = await ensureDaemon();
    if (!child || child.killed) {
      return { ok: false, message: "拖放服務未就緒" };
    }
    const id = String(++seq);
    const body = await new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        resolve("ERR:timeout");
      }, 120000);
      pending.set(id, { resolve, timer, onArmed: opts.onArmed });
      try {
        child.stdin.write(`${id} ${listPath}\n`);
      } catch (err) {
        clearTimeout(timer);
        pending.delete(id);
        resolve(`ERR:${err.message || "write-failed"}`);
      }
    });

    if (/^OK:/i.test(body)) {
      return { ok: true, message: "拖放完成", effect: body.slice(3) };
    }
    if (/EMPTY/i.test(body)) {
      return { ok: false, message: "沒有可拖放的檔案" };
    }
    return { ok: false, message: body.replace(/^ERR:/i, "").trim() || "拖放失敗" };
  } finally {
    try {
      fs.unlinkSync(listPath);
    } catch {
      // ignore
    }
  }
}

function stopOleDragDaemon() {
  try {
    if (ps && !ps.killed) {
      ps.stdin.write("quit\n");
      ps.kill();
    }
  } catch {
    // ignore
  }
  ps = null;
  ready = false;
  for (const wait of pending.values()) {
    clearTimeout(wait.timer);
    wait.resolve("ERR:stopped");
  }
  pending.clear();
}

module.exports = {
  startOleFileDrag,
  warmOleDragDaemon,
  stopOleDragDaemon,
  releaseMouseCaptureSync
};
