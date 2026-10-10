/**
 * Taskbar metrics for the bottom dock.
 * Win11 icon cluster is measured via UI Automation (classic MSTaskSwWClass is too narrow).
 */
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

let stripCache = { at: 0, value: null };
let pinsCache = { at: 0, value: null };
/** Sticky icon-strip width — never snap narrower on flaky remeasures. */
let stickyIconW = 0;
let stickyIconLeft = 0;
/** Skip expensive UIA PowerShell once we have a stable width. */
let stickyMeasuredAt = 0;

function tmpPath(prefix, ext) {
  return path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
}

function runPsJson(scriptBody, timeout = 9000) {
  const ps1 = tmpPath("edex-tb", ".ps1");
  const out = tmpPath("edex-tb-out", ".json");
  const outLit = out.replace(/'/g, "''");
  fs.writeFileSync(ps1, `${scriptBody}\n`.replace(/__OUT__/g, outLit), "utf8");
  return new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", ps1],
      { windowsHide: true, timeout, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
      () => {
        try { fs.unlinkSync(ps1); } catch { /* ignore */ }
        let data = null;
        try {
          if (fs.existsSync(out)) {
            const text = fs.readFileSync(out, "utf8").replace(/^\uFEFF/, "").trim();
            if (text) data = JSON.parse(text);
          }
        } catch {
          data = null;
        } finally {
          try { fs.unlinkSync(out); } catch { /* ignore */ }
        }
        resolve(data);
      }
    );
  });
}

function getElectron() {
  try {
    return require("electron");
  } catch {
    return null;
  }
}

function taskbarPinsDir() {
  return path.join(
    process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
    "Microsoft",
    "Internet Explorer",
    "Quick Launch",
    "User Pinned",
    "TaskBar"
  );
}

function countTaskbarPinsSync() {
  try {
    const dir = taskbarPinsDir();
    if (!fs.existsSync(dir)) return 0;
    return fs.readdirSync(dir).filter((n) => /\.lnk$/i.test(n)).length;
  } catch {
    return 0;
  }
}

/**
 * Measure primary taskbar band + icon-cluster width.
 * Prefers UI Automation button union (Win11); falls back to MSTaskSw / pin estimate.
 */
async function measureTaskbarStrip() {
  const now = Date.now();
  if (stripCache.value && now - stripCache.at < 1800) return stripCache.value;

  const out = tmpPath("edex-tb-out", ".json");
  const ps1 = path.join(__dirname, "taskbar-measure.ps1");
  const data = await new Promise((resolve) => {
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", ps1, "-OutFile", out],
      { windowsHide: true, timeout: 9000, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 },
      () => {
        let parsed = null;
        try {
          if (fs.existsSync(out)) {
            const text = fs.readFileSync(out, "utf8").replace(/^\uFEFF/, "").trim();
            if (text) parsed = JSON.parse(text);
          }
        } catch {
          parsed = null;
        } finally {
          try { fs.unlinkSync(out); } catch { /* ignore */ }
        }
        resolve(parsed);
      }
    );
  });

  const tray = rectArr(data?.tray);
  const taskSw = rectArr(data?.taskSw);
  const uia = rectArr(data?.uia);
  const value = {
    tray,
    taskSw,
    uia,
    uiaCount: Number(data?.uiaCount) || 0,
    uiaErr: data?.uiaErr || null
  };
  stripCache = { at: now, value };
  return value;
}

function rectArr(arr) {
  if (!Array.isArray(arr) || arr.length < 4) return null;
  const [x, y, w, h] = arr.map((n) => Number(n) || 0);
  if (w < 8 || h < 8) return null;
  return { x, y, w, h };
}

/**
 * Map a screen rect into CSS client coords.
 * @param {"physical"|"dip"} unit - Win32 GetWindowRect ≈ physical; UIA ≈ DIP.
 */
function screenToCss(win, display, rect, unit = "physical") {
  if (!rect || !win || win.isDestroyed()) return null;
  const bounds = win.getContentBounds();
  const sf = display?.scaleFactor || 1;
  const zoom = win.webContents.getZoomFactor() || 1 / sf;
  const cssW = bounds.width / zoom;
  const cssH = bounds.height / zoom;

  let v;
  if (unit === "dip") {
    // DIP → CSS: (dip - boundsDip) / zoom
    v = {
      x: (rect.x - bounds.x) / zoom,
      y: (rect.y - bounds.y) / zoom,
      w: rect.w / zoom,
      h: rect.h / zoom
    };
  } else {
    // Physical → CSS with zoom 1/sf equals physical offset from display origin.
    v = {
      x: rect.x - bounds.x * sf,
      y: rect.y - bounds.y * sf,
      w: rect.w,
      h: rect.h
    };
  }
  if (!(v.w > 40 && v.h > 12 && v.w < cssW * 1.08)) return null;
  if (v.y + v.h < cssH * 0.5) return null;
  return v;
}

async function getTaskbarMetricsForWindow(win, display) {
  const electron = getElectron();
  const screen = electron?.screen;
  const disp = display || screen?.getPrimaryDisplay?.() || null;

  const bounds = win && !win.isDestroyed()
    ? win.getContentBounds()
    : { x: 0, y: 0, width: disp?.bounds?.width || 1280, height: disp?.bounds?.height || 720 };
  const sf = disp?.scaleFactor || 1;
  const zoom = (win && !win.isDestroyed() && win.webContents.getZoomFactor()) || 1 / sf;
  const cssW = Math.max(1, bounds.width / zoom);
  const cssH = Math.max(1, bounds.height / zoom);

  const db = disp?.bounds || { x: 0, y: 0, width: bounds.width, height: bounds.height };
  const wa = disp?.workArea || db;
  let trayH = Math.max(40, Math.round(((db.y + db.height) - (wa.y + wa.height)) / zoom));
  if (trayH < 28) trayH = 48;

  const ICON_SLOT = 46;
  const pinCount = Math.max(1, countTaskbarPinsSync());
  // Pinned + typical running extras (Win11 centered bar is wider than TaskBar folder count).
  let iconCount = Math.max(pinCount + 6, Math.round(pinCount * 1.55));
  let iconW = Math.min(cssW * 0.92, Math.max(ICON_SLOT * 10, iconCount * ICON_SLOT + 72));
  let iconLeft = (cssW - iconW) / 2;

  if (process.platform === "win32") {
    try {
      // UIA measure spawns PowerShell — avoid while hovering the tray (freezes UI).
      // Once sticky width exists, reuse it for ~45s.
      const canSkipUia = stickyIconW >= ICON_SLOT * 8 && (Date.now() - stickyMeasuredAt) < 45000;
      if (canSkipUia) {
        iconW = stickyIconW;
        iconLeft = Math.max(0, Math.min(cssW - iconW, stickyIconLeft || (cssW - iconW) / 2));
      } else {
        const measured = await measureTaskbarStrip();
        const trayCss = measured.tray ? screenToCss(win, disp, measured.tray, "physical") : null;
        if (trayCss?.h) trayH = Math.max(40, Math.min(72, Math.round(trayCss.h)));

        // Win11: only trust UIA union. MSTaskSwWClass is a leftover narrow HWND — never use it.
        const uiaCss = measured.uia ? screenToCss(win, disp, measured.uia, "physical") : null;
        if (uiaCss && uiaCss.w >= ICON_SLOT * 8) {
          const nextW = Math.min(cssW * 0.96, uiaCss.w);
          if (!stickyIconW || nextW >= stickyIconW * 0.94) {
            stickyIconW = Math.max(stickyIconW, nextW);
            stickyIconLeft = uiaCss.x;
            stickyMeasuredAt = Date.now();
          }
          iconW = stickyIconW;
          iconLeft = Math.max(0, Math.min(cssW - iconW, stickyIconLeft));
          if (measured.uiaCount >= 3) iconCount = measured.uiaCount;
        } else if (stickyIconW > 0) {
          iconW = stickyIconW;
          iconLeft = Math.max(0, Math.min(cssW - iconW, stickyIconLeft || (cssW - iconW) / 2));
        } else {
          iconW = Math.min(cssW * 0.9, Math.max(iconW, pinCount * ICON_SLOT + 160));
          iconLeft = (cssW - iconW) / 2;
        }
      }
    } catch {
      if (stickyIconW > 0) iconW = stickyIconW;
    }
  }

  const padX = 48;
  // Width follows icon cluster; renderer always screen-centers the card.
  const width = Math.min(cssW * 0.98, Math.max(ICON_SLOT * 10, iconW + padX * 2));
  // Taller than the bare tray so icons sit inside the dock, not on top of it.
  const height = Math.max(80, Math.min(110, trayH + 36));
  const left = (cssW - width) / 2;
  const top = cssH - height;

  return {
    edge: "bottom",
    tray: { x: 0, y: cssH - trayH, w: cssW, h: trayH },
    icons: { x: iconLeft, y: cssH - trayH, w: iconW, h: trayH },
    iconCount,
    workAreaBottom: cssH - trayH,
    cssW,
    cssH,
    dock: { x: left, y: top, w: width, h: height }
  };
}

async function listTaskbarPinnedApps() {
  const now = Date.now();
  if (pinsCache.value && now - pinsCache.at < 4000) return pinsCache.value;

  const dir = taskbarPinsDir();
  const items = [];
  try {
    if (!fs.existsSync(dir)) {
      pinsCache = { at: now, value: items };
      return items;
    }
    const names = fs.readdirSync(dir).filter((n) => /\.lnk$/i.test(n) && !SKIP_NAME.has(n.toLowerCase()));
    const electron = getElectron();
    for (const name of names) {
      const full = path.join(dir, name);
      let iconDataUrl = "";
      try {
        if (electron?.app?.getFileIcon) {
          const img = await electron.app.getFileIcon(full, { size: "normal" });
          if (img && !img.isEmpty()) iconDataUrl = img.toDataURL();
        }
      } catch {
        // ignore
      }
      items.push({
        id: `tb_${Buffer.from(full).toString("base64url").slice(0, 24)}`,
        name: name.replace(/\.lnk$/i, ""),
        path: full,
        iconDataUrl,
        source: "taskbar"
      });
    }
  } catch {
    // ignore
  }
  pinsCache = { at: now, value: items };
  return items;
}

const SKIP_NAME = new Set(["desktop.ini", "thumbs.db"]);

async function iconForPath(targetPath) {
  const electron = getElectron();
  if (!targetPath || !electron?.app?.getFileIcon) return "";
  try {
    const img = await electron.app.getFileIcon(String(targetPath), { size: "normal" });
    if (img && !img.isEmpty()) return img.toDataURL();
  } catch {
    // ignore
  }
  return "";
}

module.exports = {
  getTaskbarMetricsForWindow,
  listTaskbarPinnedApps,
  iconForPath,
  taskbarPinsDir,
  countTaskbarPinsSync,
  measureTaskbarStrip
};
