param(
  [Parameter(Mandatory = $true)][string]$OutFile
)

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class EdexTbM {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindow(string c, string w);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h, EnumProc cb, IntPtr l);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
  public static string Cls(IntPtr h) {
    var sb = new StringBuilder(256);
    GetClassName(h, sb, sb.Capacity);
    return sb.ToString();
  }
  public static int[] Rect(IntPtr h) {
    RECT r; if (!GetWindowRect(h, out r)) return null;
    return new int[]{ r.L, r.T, r.R - r.L, r.B - r.T };
  }
  public static IntPtr FindChild(IntPtr root, string want) {
    IntPtr found = IntPtr.Zero;
    EnumChildWindows(root, (h, l) => {
      if (Cls(h) == want) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@

$tray = [EdexTbM]::FindWindow('Shell_TrayWnd', $null)
$trayRect = if ($tray -ne [IntPtr]::Zero) { [EdexTbM]::Rect($tray) } else { @(0, 0, 0, 0) }
$sw = [IntPtr]::Zero
if ($tray -ne [IntPtr]::Zero) {
  $sw = [EdexTbM]::FindChild($tray, 'MSTaskListWClass')
  if ($sw -eq [IntPtr]::Zero) { $sw = [EdexTbM]::FindChild($tray, 'MSTaskSwWClass') }
}
$swRect = if ($sw -ne [IntPtr]::Zero) { [EdexTbM]::Rect($sw) } else { $null }

$uiaL = 0; $uiaT = 0; $uiaR = 0; $uiaB = 0; $uiaN = 0
$uiaErr = $null
try {
  Add-Type -AssemblyName UIAutomationClient -ErrorAction Stop
  Add-Type -AssemblyName UIAutomationTypes -ErrorAction Stop
  $auto = [System.Windows.Automation.AutomationElement]::RootElement
  $trayCond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::ClassNameProperty, 'Shell_TrayWnd')
  $trayEl = $auto.FindFirst([System.Windows.Automation.TreeScope]::Children, $trayCond)
  if ($trayEl) {
    $tb = $trayEl.Current.BoundingRectangle
    $all = $trayEl.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
    # Size filters scale with UIA tray height (DPI / virtual coord quirks).
    $minW = [math]::Max(18.0, $tb.Height * 0.28)
    $maxW = [math]::Max(96.0, $tb.Height * 1.6)
    $minH = [math]::Max(16.0, $tb.Height * 0.28)
    $maxH = [math]::Max(80.0, $tb.Height * 1.2)
    # Keep Start … Settings; only trim the far notification/clock strip.
    $notifyCut = $tb.Left + $tb.Width * 0.955
    # Win11 often has small gaps between Start / apps / search — merge those runs.
    $gapMax = [math]::Max(140.0, $tb.Height * 2.4)
    $box = New-Object System.Collections.Generic.List[object]
    foreach ($el in $all) {
      try {
        $r = $el.Current.BoundingRectangle
        if ($r.Width -lt $minW -or $r.Width -gt $maxW) { continue }
        if ($r.Height -lt $minH -or $r.Height -gt $maxH) { continue }
        $top = [math]::Max($r.Top, $tb.Top)
        $bot = [math]::Min($r.Top + $r.Height, $tb.Top + $tb.Height)
        if (($bot - $top) -lt ($r.Height * 0.35)) { continue }
        $cx = $r.Left + $r.Width * 0.5
        if ($cx -lt $tb.Left -or $cx -gt $notifyCut) { continue }
        $box.Add([pscustomobject]@{ L = $r.Left; T = $r.Top; R = ($r.Left + $r.Width); B = ($r.Top + $r.Height) }) | Out-Null
      } catch {}
    }
    if ($box.Count -ge 4) {
      # Prefer full union of in-band icon hits (Start … Settings), not a middle sub-run.
      $sorted = @($box | Sort-Object L)
      $minL = $sorted[0].L
      $minT = $sorted[0].T
      $maxR = $sorted[0].R
      $maxB = $sorted[0].B
      foreach ($b in $sorted) {
        if ($b.L -lt $minL) { $minL = $b.L }
        if ($b.T -lt $minT) { $minT = $b.T }
        if ($b.R -gt $maxR) { $maxR = $b.R }
        if ($b.B -gt $maxB) { $maxB = $b.B }
      }
      $uiaN = $sorted.Count
      # Map UIA virtual coords → Win32 physical tray space.
      $scaleX = 1.0
      $scaleY = 1.0
      if ($tb.Width -gt 1 -and $trayRect[2] -gt 1) { $scaleX = [double]$trayRect[2] / [double]$tb.Width }
      if ($tb.Height -gt 1 -and $trayRect[3] -gt 1) { $scaleY = [double]$trayRect[3] / [double]$tb.Height }
      $uiaL = [int][math]::Round($minL * $scaleX)
      $uiaT = [int][math]::Round($trayRect[1])
      $uiaR = [int][math]::Round(($maxR - $minL) * $scaleX)
      $uiaB = [int][math]::Round([math]::Max($trayRect[3], ($maxB - $minT) * $scaleY))
    }
  }
} catch {
  $uiaN = 0
  $uiaErr = $_.Exception.Message
}

$result = [ordered]@{
  tray = $trayRect
  taskSw = $swRect
  uia = $(if ($uiaN -gt 0) { @($uiaL, $uiaT, $uiaR, $uiaB) } else { $null })
  uiaCount = $uiaN
  uiaErr = $uiaErr
}
($result | ConvertTo-Json -Compress) | Set-Content -LiteralPath $OutFile -Encoding utf8
