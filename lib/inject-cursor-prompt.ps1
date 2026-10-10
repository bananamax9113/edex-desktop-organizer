# Inject clipboard into Cursor chat without leaving Cursor in the foreground.
# If Cursor was minimized, restore that minimized state after send.
param(
  [ValidateSet("chat", "terminal", "newchat")]
  [string]$Mode = "chat"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class CkSilent {
  public const int SW_RESTORE = 9;
  public const int SW_SHOWMINNOACTIVE = 7;

  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
}
"@

function Focus-WindowSilent([IntPtr]$hwnd) {
  $prev = [CkSilent]::GetForegroundWindow()
  $dummy = [uint32]0
  $targetTid = [CkSilent]::GetWindowThreadProcessId($hwnd, [ref]$dummy)
  $foreTid = [uint32]0
  if ($prev -ne [IntPtr]::Zero) {
    $foreTid = [CkSilent]::GetWindowThreadProcessId($prev, [ref]$dummy)
  }
  $curTid = [CkSilent]::GetCurrentThreadId()
  try {
    if ($foreTid -ne 0) { [void][CkSilent]::AttachThreadInput($curTid, $foreTid, $true) }
    if ($targetTid -ne 0) { [void][CkSilent]::AttachThreadInput($curTid, $targetTid, $true) }
    [void][CkSilent]::BringWindowToTop($hwnd)
    [void][CkSilent]::SetForegroundWindow($hwnd)
  } finally {
    if ($targetTid -ne 0) { [void][CkSilent]::AttachThreadInput($curTid, $targetTid, $false) }
    if ($foreTid -ne 0) { [void][CkSilent]::AttachThreadInput($curTid, $foreTid, $false) }
  }
}

$proc = Get-Process -Name "Cursor","cursor" -ErrorAction SilentlyContinue |
  Where-Object { $_.MainWindowHandle -ne [IntPtr]::Zero } |
  Sort-Object StartTime -Descending |
  Select-Object -First 1

if (-not $proc) {
  Write-Output "NO_WINDOW"
  exit 2
}

$hwnd = $proc.MainWindowHandle
$prevFg = [CkSilent]::GetForegroundWindow()
$wasIconic = [CkSilent]::IsIconic($hwnd)

try {
  if ($wasIconic) {
    [void][CkSilent]::ShowWindow($hwnd, [CkSilent]::SW_RESTORE)
    Start-Sleep -Milliseconds 160
  }

  Focus-WindowSilent $hwnd
  Start-Sleep -Milliseconds 220

  if ($Mode -eq "terminal") {
    # Ctrl+` — backtick must be doubled inside double-quoted PowerShell strings
    [System.Windows.Forms.SendKeys]::SendWait("^``")
    Start-Sleep -Milliseconds 280
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 140
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  } elseif ($Mode -eq "newchat") {
    # Focus chat/composer, then Ctrl+N → composer.createNew (Cursor New Chat)
    [System.Windows.Forms.SendKeys]::SendWait("^l")
    Start-Sleep -Milliseconds 360
    [System.Windows.Forms.SendKeys]::SendWait("^n")
    Start-Sleep -Milliseconds 200
  } else {
    [System.Windows.Forms.SendKeys]::SendWait("^l")
    Start-Sleep -Milliseconds 320
    [System.Windows.Forms.SendKeys]::SendWait("^a")
    Start-Sleep -Milliseconds 80
    [System.Windows.Forms.SendKeys]::SendWait("^v")
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  }

  # Let Electron process paste/submit before we steal focus back
  Start-Sleep -Milliseconds 350
} finally {
  if ($prevFg -ne [IntPtr]::Zero -and [CkSilent]::IsWindow($prevFg)) {
    [void][CkSilent]::SetForegroundWindow($prevFg)
  }
  if ($wasIconic -and [CkSilent]::IsWindow($hwnd)) {
    Start-Sleep -Milliseconds 80
    [void][CkSilent]::ShowWindow($hwnd, [CkSilent]::SW_SHOWMINNOACTIVE)
  }
}

Write-Output ("OK:" + $proc.Id)
exit 0
