const { app, BrowserWindow, ipcMain, dialog, shell, screen, Tray, Menu, nativeImage, clipboard, desktopCapturer } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { scanRoot, listFolder, importFiles, buildPlan, executePlan, undoLast } = require("./lib/organizer");
const { dirIcon } = require("./lib/icons");
const { loadSettings, saveSettings } = require("./lib/settings-store");
const { WALLPAPERS, listThemes, loadTheme, resolveThemeName } = require("./lib/themes");
const { applyAppWallpaper, restoreWallpaper, hideDesktopIcons, restoreDesktopIcons } = require("./lib/system-desktop");
const {
  pinWindowBottom,
  stopZOrderDaemon,
  ensureDaemon,
  prepareWindowForFileDrag,
  prepareWindowForFileDragSync,
  restoreWindowAfterFileDrag,
  cancelPreparedFileDrag,
  isFileDragActive,
  allowForeground
} = require("./lib/win32-zorder");
const { listDesktopShortcuts } = require("./lib/desktop-shortcuts");
const { listDrives } = require("./lib/drives");
const fileSearch = require("./lib/file-search");
const { loadNotes, addNote, updateNote, removeNote } = require("./lib/calendar-store");
const { getNetStatus, getTrafficSample, getCpuMetrics, getMemMetrics, getSysMetrics, loadGlobeGrid, getHardwareInfo, getTopProcesses } = require("./lib/net-info");
const fileOps = require("./lib/file-ops");
const clipboardFiles = require("./lib/clipboard-files");
const cursorChat = require("./lib/cursor-chat");
const win32Embed = require("./lib/win32-embed");
const {
  startOleFileDrag,
  warmOleDragDaemon,
  stopOleDragDaemon
} = require("./lib/win32-file-drag");

function repoRoot() {
  return path.join(__dirname, "..");
}

function makeDragIcon() {
  // Opaque RGBA bitmap — reliable for Electron startDrag on Windows.
  const size = 32;
  const buf = Buffer.alloc(size * size * 4, 0);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const edge = x <= 1 || y <= 1 || x >= size - 2 || y >= size - 2;
      const body = x >= 7 && x <= 24 && y >= 5 && y <= 26;
      if (!edge && !body) continue;
      buf[i] = 170;
      buf[i + 1] = 210;
      buf[i + 2] = 230;
      buf[i + 3] = 255;
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

const dragIcon = makeDragIcon();
let dragIconPath = "";
/** Pointer-down arming: capture hits so Chromium can fire dragstart. */
let fileDragArmed = false;
/** Inside startDrag/OLE: click-through so Explorer/WeChat under cursor get DragEnter. */
let fileDragInFlight = false;

function applyFileDragMouseMode(win) {
  if (!win || win.isDestroyed()) return;
  if (fileDragInFlight || isFileDragActive()) {
    // Fullscreen overlay must not steal OLE hit-tests from Explorer.
    win.setIgnoreMouseEvents(true, { forward: true });
    return;
  }
  if (fileDragArmed) {
    win.setIgnoreMouseEvents(false);
    return;
  }
  win.setIgnoreMouseEvents(true, { forward: true });
}

function ensureDragIconPath() {
  if (dragIconPath && fs.existsSync(dragIconPath)) return dragIconPath;
  try {
    dragIconPath = path.join(os.tmpdir(), "edex-file-drag-icon.png");
    fs.writeFileSync(dragIconPath, dragIcon.toPNG());
  } catch {
    dragIconPath = "";
  }
  return dragIconPath;
}

app.commandLine.appendSwitch("enable-transparent-visuals");

/** @type {Map<number, BrowserWindow>} */
const windows = new Map();
let currentRoot;
let settings;
let syncing = false;
let syncTimer = null;
let quitting = false;
let tray = null;

function makeTrayIcon() {
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const edge = x <= 1 || y <= 1 || x >= size - 2 || y >= size - 2;
      buf[i] = edge ? 170 : 5;
      buf[i + 1] = edge ? 207 : 8;
      buf[i + 2] = edge ? 209 : 13;
      buf[i + 3] = 255;
    }
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

function createTray() {
  if (tray) return;
  tray = new Tray(makeTrayIcon());
  tray.setToolTip("eDEX 桌面整理");
  const menu = Menu.buildFromTemplate([
    {
      label: "顯示容器",
      click: () => {
        for (const win of windows.values()) {
          if (!win.isDestroyed()) showBehindApps(win);
        }
        refitExistingWindows();
      }
    },
    {
      label: "重新對齊顯示器",
      click: () => syncAllWindows()
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => app.quit()
    }
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => {
    for (const win of windows.values()) {
      if (!win.isDestroyed()) showBehindApps(win);
    }
    refitExistingWindows();
  });
}

function resolveDesktop() {
  try {
    const dir = app.getPath("desktop");
    if (dir && fs.existsSync(dir)) return dir;
  } catch {
    // fall through
  }
  const fallback = path.join(os.homedir(), "Desktop");
  return fs.existsSync(fallback) ? fallback : (app.getPath("desktop") || fallback);
}

function listDisplays() {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((display, index) => {
    const { x, y, width, height } = display.bounds;
    const scale = display.scaleFactor || 1;
    const physW = Math.round(width * scale);
    const physH = Math.round(height * scale);
    return {
      index,
      id: display.id,
      primary: display.id === primaryId,
      bounds: { x, y, width, height },
      size: { width, height },
      physicalSize: { width: physW, height: physH },
      scaleFactor: scale,
      label: `顯示器 ${index + 1}（${physW}×${physH}${display.id === primaryId ? "，主螢幕" : ""}）`
    };
  });
}

function displayScale(display) {
  return display?.scaleFactor || 1;
}

function applyPhysicalZoom(win, display) {
  if (!win || win.isDestroyed()) return;
  const sf = displayScale(display || findDisplay(getWindowDisplayId(win)));
  // Undo Windows DPI so a 4K panel is 3840×2160 CSS px, not 2K DIP.
  win.webContents.setZoomFactor(1 / sf);
  win.webContents.setVisualZoomLevelLimits(1, 1);
}

function findDisplay(displayId) {
  const id = Number(displayId);
  return screen.getAllDisplays().find((d) => d.id === id) || screen.getPrimaryDisplay();
}

function getSenderWindow(event) {
  return BrowserWindow.fromWebContents(event.sender);
}

function getWindowDisplayId(win) {
  for (const [id, w] of windows.entries()) {
    if (w === win) return id;
  }
  return screen.getPrimaryDisplay().id;
}

function fitWindowToDisplay(win, display) {
  if (!win || win.isDestroyed() || !display) return;
  const { x, y, width, height } = display.bounds;
  win.setFullScreen(false);
  win.setBounds({ x, y, width, height });
  applyPhysicalZoom(win, display);
  pinAndKeepBounds(win, display);
  console.log(`[edex] fit display=${display.id} ${x},${y} ${width}x${height}`);
}

async function pinAndKeepBounds(win, display) {
  if (!win || win.isDestroyed()) return;
  if (isFileDragActive()) return;
  const target = display || findDisplay(getWindowDisplayId(win));
  await pinWindowBottom(win);
  if (win.isDestroyed() || !target) return;
  win.setBounds({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height
  });
  applyPhysicalZoom(win, target);
}

function showBehindApps(win) {
  if (!win || win.isDestroyed()) return;
  try {
    win.showInactive();
  } catch {
    win.show();
  }
  pinAndKeepBounds(win);
}

function bindDesktopZOrder(win) {
  win.on("show", () => pinAndKeepBounds(win));
  // Focus fires on every click — only re-pin z-order, never setBounds (that stuttered the UI).
  win.on("focus", () => {
    if (isFileDragActive()) return;
    pinWindowBottom(win).catch(() => {});
  });
}

function createWindowForDisplay(display, index) {
  const existing = windows.get(display.id);
  if (existing && !existing.isDestroyed()) {
    fitWindowToDisplay(existing, display);
    return existing;
  }

  const { x, y, width, height } = display.bounds;
  const scale = display.scaleFactor || 1;
  const win = new BrowserWindow({
    title: `桌面整理 - 顯示器 ${index + 1}`,
    x,
    y,
    width,
    height,
    show: false,
    frame: false,
    thickFrame: false,
    transparent: true,
    // Near-clear (not fully 00): Windows layered windows ignore hits on 0-alpha pixels,
    // which breaks file drag gestures on "transparent" icon boxes.
    backgroundColor: "#01000000",
    hasShadow: false,
    resizable: false,
    movable: false,
    fullscreenable: false,
    autoHideMenuBar: true,
    skipTaskbar: display.id !== screen.getPrimaryDisplay().id,
    roundedCorners: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      zoomFactor: 1 / scale,
      additionalArguments: [
        `--edex-display-id=${display.id}`,
        `--edex-display-index=${index}`,
        `--edex-primary=${display.id === screen.getPrimaryDisplay().id ? "1" : "0"}`,
        `--edex-width=${width}`,
        `--edex-height=${height}`,
        `--edex-scale=${scale}`
      ]
    }
  });

  windows.set(display.id, win);
  bindDesktopZOrder(win);

  win.loadFile(path.join(__dirname, "src", "index.html"), {
    query: {
      displayId: String(display.id),
      index: String(index),
      primary: display.id === screen.getPrimaryDisplay().id ? "1" : "0",
      width: String(width),
      height: String(height),
      scale: String(scale)
    }
  });

  win.webContents.on("did-finish-load", () => {
    applyPhysicalZoom(win, findDisplay(display.id));
  });
  win.webContents.on("did-fail-load", (_e, code, desc) => {
    console.error("did-fail-load", display.id, code, desc);
  });
  win.webContents.on("render-process-gone", (_e, details) => {
    console.error("render-process-gone", display.id, details);
  });

  win.webContents.on("render-process-gone", (_e, details) => {
    console.error(`renderer gone display=${display.id}`, details);
  });

  win.once("ready-to-show", () => {
    fitWindowToDisplay(win, findDisplay(display.id));
    if (!win.isDestroyed()) {
      win.setBackgroundColor("#01000000");
      win.setIgnoreMouseEvents(true, { forward: true });
      showBehindApps(win);
    }
  });

  win.on("closed", () => {
    if (windows.get(display.id) === win) windows.delete(display.id);
  });

  return win;
}

function notifyDisplay(win, display, index) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("display-info", {
    displays: listDisplays(),
    displayId: display.id,
    index,
    bounds: display.bounds,
    scaleFactor: display.scaleFactor || 1,
    physicalSize: {
      width: Math.round(display.bounds.width * (display.scaleFactor || 1)),
      height: Math.round(display.bounds.height * (display.scaleFactor || 1))
    }
  });
}

function refitExistingWindows() {
  for (const [id, win] of windows.entries()) {
    if (win.isDestroyed()) {
      windows.delete(id);
      continue;
    }
    const display = screen.getAllDisplays().find((d) => d.id === id);
    if (display) fitWindowToDisplay(win, display);
  }
}

function syncAllWindows() {
  if (quitting) return;
  syncing = true;
  try {
    const displays = screen.getAllDisplays();
    if (!displays.length) return;

    const liveIds = new Set(displays.map((d) => d.id));
    for (const [id, win] of [...windows.entries()]) {
      if (!liveIds.has(id)) {
        if (!win.isDestroyed()) win.close();
        windows.delete(id);
      }
    }

    displays.forEach((display, index) => {
      const win = createWindowForDisplay(display, index);
      fitWindowToDisplay(win, display);
      // Ensure hidden windows become visible after load/refit.
      if (!win.isDestroyed() && !win.isVisible()) {
        win.once("ready-to-show", () => {
          if (!win.isDestroyed()) showBehindApps(win);
        });
        // ready-to-show may have already fired
        setTimeout(() => {
          if (!win.isDestroyed() && !win.isVisible()) showBehindApps(win);
        }, 300);
      }
      notifyDisplay(win, display, index);
    });

    console.log(`[edex] displays=${displays.length} windows=${windows.size}`);
  } finally {
    setTimeout(() => {
      syncing = false;
    }, 500);
  }
}

function scheduleSync(reason) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    console.log(`[edex] sync (${reason})`);
    syncAllWindows();
    scheduleWallpaper();
  }, reason === "metrics" ? 250 : 50);
}

function scheduleWallpaper() {
  clearTimeout(scheduleWallpaper.timer);
  scheduleWallpaper.timer = setTimeout(() => {
    applyAppWallpaper(
      app.getPath("userData"),
      loadTheme(settings.theme || "tron"),
      settings.wallpaper || "grid",
      settings.gridSize
    ).catch((err) => console.error("desktop wallpaper", err));
  }, 400);
}

function broadcast(channel, payload) {
  for (const win of windows.values()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function rezoomAllWindows() {
  for (const [id, win] of windows.entries()) {
    if (win.isDestroyed()) continue;
    const display = screen.getAllDisplays().find((d) => d.id === id);
    applyPhysicalZoom(win, display);
    pinWindowBottom(win);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    scheduleSync("second-instance");
    for (const win of windows.values()) {
      if (!win.isDestroyed()) showBehindApps(win);
    }
  });

  app.whenReady().then(async () => {
    settings = loadSettings(app.getPath("userData"));
    currentRoot = resolveDesktop();
    createTray();
    await ensureDaemon();
    warmOleDragDaemon();
    fileSearch.configure({
      roots: settings.searchRoots || [],
      includeLocal: settings.searchLocalDrives !== false
    });
    fileSearch.rebuild().catch((err) => console.error("file-search", err));
    syncAllWindows();
    setTimeout(() => syncAllWindows(), 600);
    scheduleWallpaper();
    hideDesktopIcons(app.getPath("userData")).catch((err) => console.error("desktop icons", err));

    screen.on("display-added", () => scheduleSync("added"));
    screen.on("display-removed", () => scheduleSync("removed"));
    screen.on("display-metrics-changed", () => {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => {
        refitExistingWindows();
        scheduleWallpaper();
      }, 200);
    });
  });

  app.on("before-quit", async (event) => {
    if (!quitting) {
      event.preventDefault();
      quitting = true;
      try { tray?.destroy(); } catch { /* ignore */ }
      tray = null;
      stopZOrderDaemon();
      stopOleDragDaemon();
      try { await win32Embed.releaseAllEmbeds(); } catch { /* ignore */ }
      try { win32Embed.stopEmbedDaemon(); } catch { /* ignore */ }
      try {
        await restoreDesktopIcons(app.getPath("userData"));
        await restoreWallpaper(app.getPath("userData"));
      } catch (err) {
        console.error("restore desktop", err);
      }
      app.quit();
      return;
    }
  });

  app.on("window-all-closed", () => {
    if (syncing || quitting) return;
    // Keep alive briefly during display reconfiguration races.
    setTimeout(() => {
      if (windows.size === 0 && !syncing) app.quit();
    }, 400);
  });
}

ipcMain.handle("get-bootstrap", (event) => {
  const win = getSenderWindow(event);
  const displayId = getWindowDisplayId(win);
  const display = findDisplay(displayId);
  const displays = listDisplays();
  const meta = displays.find((d) => d.id === displayId) || displays[0];
  const themeName = resolveThemeName(settings.theme || "tron");
  if (settings.theme !== themeName) {
    settings = saveSettings(app.getPath("userData"), { theme: themeName });
  }
  const layout = settings.displayLayouts?.[String(displayId)] || null;

  return {
    username: os.userInfo().username,
    desktop: resolveDesktop(),
    root: currentRoot,
    hostname: os.hostname(),
    platform: process.platform,
    settings,
    displays,
    displayId,
    displayIndex: meta?.index ?? 0,
    primary: Boolean(meta?.primary),
    bounds: display.bounds,
    scaleFactor: display.scaleFactor || 1,
    physicalSize: {
      width: Math.round(display.bounds.width * (display.scaleFactor || 1)),
      height: Math.round(display.bounds.height * (display.scaleFactor || 1))
    },
    displayLayout: layout,
    dirIcon: dirIcon(),
    themes: listThemes(),
    wallpapers: WALLPAPERS,
    theme: loadTheme(themeName),
    themeName
  };
});

ipcMain.handle("save-settings", (event, patch) => {
  const win = getSenderWindow(event);
  const displayId = getWindowDisplayId(win);

  if (patch.displayLayout) {
    settings = saveSettings(app.getPath("userData"), {
      displayLayoutPatch: {
        displayId,
        layout: patch.displayLayout
      }
    });
    delete patch.displayLayout;
  }

  const globalPatch = { ...patch };
  delete globalPatch.displayLayout;
  delete globalPatch.displayLayoutPatch;
  if (Object.prototype.hasOwnProperty.call(globalPatch, "theme")) {
    globalPatch.theme = resolveThemeName(globalPatch.theme);
  }
  if (Object.keys(globalPatch).length) {
    settings = saveSettings(app.getPath("userData"), globalPatch);
  } else {
    settings = loadSettings(app.getPath("userData"));
  }

  const themeName = resolveThemeName(settings.theme || "tron");
  const payload = {
    settings,
    theme: loadTheme(themeName),
    themeName,
    displays: listDisplays()
  };

  // Sync appearance to every independent display page (layouts stay per-display).
  broadcast("settings-updated", payload);
  if (
    Object.prototype.hasOwnProperty.call(globalPatch, "uiScale")
    || Object.prototype.hasOwnProperty.call(globalPatch, "layoutMode")
  ) {
    rezoomAllWindows();
  }
  if (
    Object.prototype.hasOwnProperty.call(globalPatch, "theme")
    || Object.prototype.hasOwnProperty.call(globalPatch, "wallpaper")
    || Object.prototype.hasOwnProperty.call(globalPatch, "gridSize")
  ) {
    scheduleWallpaper();
  }
  return payload;
});

ipcMain.handle("save-display-layout", (event, layout) => {
  const win = getSenderWindow(event);
  const displayId = getWindowDisplayId(win);
  settings = saveSettings(app.getPath("userData"), {
    displayLayoutPatch: { displayId, layout }
  });
  return true;
});

ipcMain.handle("transfer-widget", (event, payload) => {
  const { targetDisplayId, widget } = payload || {};
  const target = windows.get(Number(targetDisplayId));
  if (!target || target.isDestroyed()) {
    return { ok: false, message: "目標顯示器不存在" };
  }
  if (widget?.type === "desktop") {
    const meta = listDisplays().find((d) => d.id === Number(targetDisplayId));
    if (!meta?.primary) {
      return { ok: false, message: "系統桌面僅能顯示在主顯示器" };
    }
  }
  target.webContents.send("receive-widget", widget);
  target.focus();
  return { ok: true };
});

ipcMain.handle("get-theme", (_e, name) => loadTheme(name || settings.theme || "tron"));

ipcMain.handle("pick-folder", async (event) => {
  const win = getSenderWindow(event);
  const result = await dialog.showOpenDialog(win, {
    title: "選擇要整理的資料夾",
    defaultPath: currentRoot,
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  currentRoot = result.filePaths[0];
  return currentRoot;
});

ipcMain.handle("scan", async (_e, root) => {
  const target = root || currentRoot;
  if (!target) throw new Error("未選擇路徑");
  if (root) currentRoot = root;
  return scanRoot(target);
});

ipcMain.handle("list-folder", async (_e, root, options) => {
  if (!root) throw new Error("未選擇路徑");
  const opts = { systemIcons: "fast", ...(options || {}) };
  return listFolder(root, opts);
});

ipcMain.handle("list-drives", async () => listDrives());

ipcMain.handle("search-files", async (_e, query, limit) => fileSearch.search(query, limit));
ipcMain.handle("search-status", () => fileSearch.status());
ipcMain.handle("search-rebuild", async () => fileSearch.rebuild());
ipcMain.handle("pick-search-root", async (event) => {
  const win = getSenderWindow(event);
  const result = await dialog.showOpenDialog(win, {
    title: "選擇要索引的資料夾或網路磁碟",
    properties: ["openDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return result.filePaths[0];
});
ipcMain.handle("add-search-root", async (_e, target) => {
  const normalized = fileSearch.normalizeRoot(target);
  const roots = fileSearch.addRoot(normalized);
  const ok = await fileSearch.pathReachable(normalized);
  if (!ok) {
    fileSearch.removeRoot(normalized);
    throw new Error("無法存取此路徑，請確認本機或局域網磁碟已連線");
  }
  settings = saveSettings(app.getPath("userData"), { searchRoots: roots });
  fileSearch.configure({ roots, includeLocal: settings.searchLocalDrives !== false });
  fileSearch.rebuild().catch((err) => console.error("file-search", err));
  return { roots, ...fileSearch.status() };
});
ipcMain.handle("remove-search-root", async (_e, target) => {
  const roots = fileSearch.removeRoot(target);
  settings = saveSettings(app.getPath("userData"), { searchRoots: roots });
  fileSearch.configure({ roots, includeLocal: settings.searchLocalDrives !== false });
  fileSearch.rebuild().catch((err) => console.error("file-search", err));
  return { roots, ...fileSearch.status() };
});
ipcMain.handle("set-search-local", async (_e, enabled) => {
  settings = saveSettings(app.getPath("userData"), { searchLocalDrives: Boolean(enabled) });
  fileSearch.configure({
    roots: settings.searchRoots || [],
    includeLocal: settings.searchLocalDrives !== false
  });
  fileSearch.rebuild().catch((err) => console.error("file-search", err));
  return fileSearch.status();
});
ipcMain.handle("reveal-path", async (_e, target) => {
  if (!target) return false;
  shell.showItemInFolder(String(target));
  return true;
});

ipcMain.handle("plan", async (_e, scan, options) => buildPlan(scan, options));

ipcMain.handle("organize", async (_e, scan, options) => {
  return executePlan(scan, options, journalPath());
});

ipcMain.handle("import-files", async (_e, destDir, sources) => importFiles(destDir, sources || []));

ipcMain.handle("get-calendar-notes", () => loadNotes(app.getPath("userData")));
ipcMain.handle("add-calendar-note", (_e, dateKey, text) => addNote(app.getPath("userData"), dateKey, text));
ipcMain.handle("update-calendar-note", (_e, dateKey, id, text) => updateNote(app.getPath("userData"), dateKey, id, text));
ipcMain.handle("remove-calendar-note", (_e, dateKey, id) => removeNote(app.getPath("userData"), dateKey, id));
ipcMain.handle("copy-text", (_e, text) => {
  clipboard.writeText(String(text || ""));
  return true;
});

ipcMain.handle("get-cursor-chat-bridge", () => cursorChat.getSnapshot(repoRoot()));
ipcMain.handle("select-cursor-chat", (_e, conversationId) =>
  cursorChat.selectConversation(repoRoot(), conversationId)
);
ipcMain.handle("new-cursor-chat", () => {
  try {
    return cursorChat.createNewConversation(repoRoot());
  } catch (err) {
    return { ok: false, message: err.message || "無法新增對話" };
  }
});
ipcMain.handle("send-cursor-chat", (_e, payload = {}) => {
  const text = String(payload?.text || "").trim();
  if (!text) return { ok: false, message: "訊息不能為空" };
  try {
    return cursorChat.sendPrompt(repoRoot(), text, payload?.conversationId || "");
  } catch (err) {
    return { ok: false, message: err.message || "發送失敗" };
  }
});
ipcMain.handle("dismiss-cursor-chat-alert", (_e, alertId) =>
  cursorChat.dismissAlert(repoRoot(), alertId)
);
ipcMain.handle("clear-cursor-chat-alerts", () => cursorChat.clearAlerts(repoRoot()));
ipcMain.handle("kill-cursor-terminal", (_e, pid) =>
  cursorChat.killCursorTerminal(repoRoot(), pid)
);
ipcMain.handle("send-cursor-terminal", (_e, payload = {}) => {
  const text = String(payload?.text || "");
  if (!String(text).trim()) return { ok: false, message: "輸入不能為空" };
  try {
    return cursorChat.sendCursorTerminalInput(repoRoot(), text, {
      terminalId: payload?.terminalId || "",
      cwd: payload?.cwd || ""
    });
  } catch (err) {
    return { ok: false, message: err.message || "終端輸入失敗" };
  }
});

ipcMain.handle("clipboard-write-files", (_e, paths) => clipboardFiles.writeFiles(paths || []));
ipcMain.handle("clipboard-read-files", () => clipboardFiles.readFiles());

ipcMain.handle("prepare-file-drag", async (event) => {
  const win = getSenderWindow(event);
  if (!win || win.isDestroyed()) return false;
  try {
    return Boolean(await prepareWindowForFileDrag(win));
  } catch (err) {
    console.error("prepare-file-drag", err);
    return false;
  }
});

ipcMain.on("cancel-file-drag-prepare", (event) => {
  const win = getSenderWindow(event);
  if (win && !win.isDestroyed()) cancelPreparedFileDrag(win);
});

/** Official Electron startDrag — must run inside Chromium dragstart (sendSync). */
ipcMain.on("start-file-drag-electron", (event, paths) => {
  // Expand .lnk → real targets (WeChat/IM often reject shortcut files).
  const files = clipboardFiles.normalizeDragPaths(paths || []);
  if (!files.length) {
    event.returnValue = false;
    return;
  }
  const win = getSenderWindow(event);
  fileDragArmed = true;
  fileDragInFlight = true;
  try {
    if (win && !win.isDestroyed()) {
      prepareWindowForFileDragSync(win);
      // In-flight: click-through + HWND_BOTTOM so Explorer/WeChat receive DragEnter.
      // (ignore=false here covers the whole display and blocks Explorer drops.)
      applyFileDragMouseMode(win);
    }
    const iconPath = ensureDragIconPath();
    let icon = iconPath || dragIcon;
    // startDrag blocks until the user drops or cancels.
    if (files.length === 1) event.sender.startDrag({ file: files[0], icon });
    else event.sender.startDrag({ files, icon });
    event.returnValue = true;
  } catch (err) {
    console.error("start-file-drag-electron", err);
    event.returnValue = false;
  } finally {
    fileDragInFlight = false;
    fileDragArmed = false;
    if (win && !win.isDestroyed()) {
      restoreWindowAfterFileDrag(win);
      applyFileDragMouseMode(win);
    }
  }
});

/** OLE file drag — primary path for overlay → Explorer / other apps. */
ipcMain.handle("start-file-drag", async (event, paths) => {
  const files = clipboardFiles.normalizeDragPaths(paths || []);
  if (!files.length) {
    return { ok: false, message: "沒有可拖放的檔案" };
  }
  const win = getSenderWindow(event);
  fileDragArmed = true;
  fileDragInFlight = false;
  try {
    if (win && !win.isDestroyed()) {
      prepareWindowForFileDragSync(win);
      win.setBackgroundColor("#01000000");
      // Armed: ignore=false so GetAsyncKeyState still sees LBUTTON.
      applyFileDragMouseMode(win);
    }
    const ole = await startOleFileDrag(files, {
      onArmed: () => {
        // Daemon confirmed LBUTTON — now click-through so Explorer/WeChat get DragEnter.
        fileDragInFlight = true;
        if (win && !win.isDestroyed()) applyFileDragMouseMode(win);
      }
    });
    return {
      ok: Boolean(ole.ok),
      message: ole.message || (ole.ok ? "拖放完成" : "拖放失敗"),
      via: "ole"
    };
  } catch (err) {
    console.error("start-file-drag", err);
    return { ok: false, message: err.message || "拖放失敗" };
  } finally {
    fileDragInFlight = false;
    fileDragArmed = false;
    if (win && !win.isDestroyed()) {
      restoreWindowAfterFileDrag(win);
      applyFileDragMouseMode(win);
    }
  }
});

ipcMain.handle("list-desktop-shortcuts", (_e, options) => (
  listDesktopShortcuts(resolveDesktop(), options || { decorate: "fast" })
));
ipcMain.handle("list-desktop-files", async () => {
  const dir = resolveDesktop();
  if (!dir) return { items: [], total: 0, root: "" };
  const listing = await listFolder(dir, { systemIcons: "fast" });
  // Attach .lnk targets (sync, no PowerShell) for OS drag / WeChat drops / Ctrl+dblclick tabs.
  for (const item of listing.items || []) {
    if (!item?.path || !/\.lnk$/i.test(item.path)) continue;
    const target = clipboardFiles.resolveShortcutTarget(item.path);
    if (!target) continue;
    item.targetPath = target;
    try {
      item.targetIsDirectory = fs.statSync(target).isDirectory();
    } catch {
      item.targetIsDirectory = false;
    }
  }
  return listing;
});

ipcMain.handle("create-folder", async (_e, parent, folderName) => fileOps.createFolder(parent, folderName));
ipcMain.handle("rename-item", async (_e, target, name) => fileOps.renameItem(target, name));
ipcMain.handle("trash-item", async (event, target) => {
  return fileOps.trashItem(target, getSenderWindow(event));
});
ipcMain.handle("set-item-tags", async (_e, target, tags) => {
  const next = await fileOps.writeTags(target, tags);
  return { ok: true, tags: next, path: target };
});

function explorerExe() {
  return path.join(process.env.SystemRoot || "C:\\Windows", "explorer.exe");
}

/**
 * Unicode-safe open via PowerShell Invoke-Item, then force the new Explorer
 * (or matching folder window) above our fullscreen overlay.
 */
function invokeItem(targetPath, { raiseExplorer = false } = {}) {
  const literal = String(targetPath).replace(/'/g, "''");
  const raiseBlock = raiseExplorer
    ? `
Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class EdexRaise {
  [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int pid);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int nCmdShow);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
  static readonly IntPtr HWND_TOPMOST = new IntPtr(-1);
  static readonly IntPtr HWND_NOTOPMOST = new IntPtr(-2);
  public static void ForceFg(IntPtr hwnd) {
    if (hwnd == IntPtr.Zero) return;
    AllowSetForegroundWindow(-1);
    ShowWindow(hwnd, 9);
    IntPtr fg = GetForegroundWindow();
    uint fgPid; uint fgTid = GetWindowThreadProcessId(fg, out fgPid);
    uint cur = GetCurrentThreadId();
    if (fgTid != 0 && fgTid != cur) AttachThreadInput(cur, fgTid, true);
    BringWindowToTop(hwnd);
    SetForegroundWindow(hwnd);
    SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, 0x0001 | 0x0002);
    SetWindowPos(hwnd, HWND_NOTOPMOST, 0, 0, 0, 0, 0x0001 | 0x0002);
    if (fgTid != 0 && fgTid != cur) AttachThreadInput(cur, fgTid, false);
  }
}
"@
[EdexRaise]::AllowSetForegroundWindow(-1) | Out-Null
$before = @{}
try {
  $sh0 = New-Object -ComObject Shell.Application
  foreach ($w in @($sh0.Windows())) { try { $before[[int64]$w.HWND] = $true } catch {} }
} catch {}
Invoke-Item -LiteralPath '${literal}'
$targetNorm = '${literal}'
try { $targetNorm = [IO.Path]::GetFullPath('${literal}').TrimEnd([char]0x5C).ToLowerInvariant() } catch {}
$deadline = [Environment]::TickCount + 3000
$raised = $false
while (-not $raised -and [Environment]::TickCount -lt $deadline) {
  Start-Sleep -Milliseconds 120
  try {
    $sh = New-Object -ComObject Shell.Application
    $candidates = @()
    foreach ($w in @($sh.Windows())) {
      try {
        $hwnd = [int64]$w.HWND
        $loc = $null
        try { $loc = $w.Document.Folder.Self.Path } catch {}
        if (-not $loc) { continue }
        $locNorm = [IO.Path]::GetFullPath($loc).TrimEnd([char]0x5C).ToLowerInvariant()
        $isNew = -not $before.ContainsKey($hwnd)
        if ($locNorm -eq $targetNorm) {
          [EdexRaise]::ForceFg([IntPtr]$hwnd)
          $raised = $true
          break
        }
        if ($isNew) { $candidates += $hwnd }
      } catch {}
    }
    if (-not $raised -and $candidates.Count -gt 0) {
      [EdexRaise]::ForceFg([IntPtr]($candidates[-1]))
      $raised = $true
    }
  } catch {}
}
`
    : `Invoke-Item -LiteralPath '${literal}'`;
  return new Promise((resolve) => {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-STA",
        "-WindowStyle",
        "Hidden",
        "-Command",
        `[Console]::OutputEncoding = [Text.Encoding]::UTF8; ${raiseBlock}`
      ],
      { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }
    );
    let err = "";
    child.stderr.on("data", (chunk) => {
      err += String(chunk);
    });
    child.on("exit", (code) => {
      resolve({ ok: code === 0, message: err.trim() });
    });
    child.on("error", (e) => {
      resolve({ ok: false, message: e.message || "Invoke-Item failed" });
    });
  });
}

function pinAllOverlaysBottom() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win || win.isDestroyed()) continue;
    try {
      win.blur();
    } catch {
      // ignore
    }
    pinWindowBottom(win, { force: true }).catch(() => {});
  }
}

ipcMain.handle("open-path", async (event, target) => {
  if (!target) return { ok: false, message: "空路徑" };
  let value = String(target).trim();
  if (!value) return { ok: false, message: "空路徑" };
  fileDragArmed = false;
  fileDragInFlight = false;
  allowForeground();
  const win = getSenderWindow(event);
  // Click raised the overlay in z-order — pin every display back to HWND_BOTTOM
  // and click-through so Explorer can take the foreground.
  pinAllOverlaysBottom();
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w || w.isDestroyed()) continue;
    try {
      w.setIgnoreMouseEvents(true, { forward: true });
    } catch {
      // ignore
    }
  }
  console.log("[edex] open-path", value);
  try {
    if (/^shell:/i.test(value) || value.includes("::{") || value.startsWith("::")) {
      spawn(explorerExe(), [value], { detached: true, stdio: "ignore" }).unref();
      setTimeout(() => {
        allowForeground();
        pinAllOverlaysBottom();
      }, 350);
      return { ok: true, path: value };
    }
    if (/\.lnk$/i.test(value)) {
      const dest = clipboardFiles.resolveShortcutTarget(value);
      if (dest) value = dest;
    }
    const resolved = path.resolve(value);
    if (!fs.existsSync(resolved)) {
      return { ok: false, message: `路徑不存在：${resolved}`, path: resolved };
    }
    const isDir = fs.statSync(resolved).isDirectory();
    // Prefer Invoke-Item for Unicode paths; raise Explorer when opening a folder.
    const invoked = await invokeItem(resolved, { raiseExplorer: isDir });
    if (!invoked.ok) {
      const shellErr = await shell.openPath(resolved);
      if (shellErr) {
        console.error("open-path fallback", invoked.message || shellErr);
        return { ok: false, message: shellErr || invoked.message || "開啟失敗", path: resolved };
      }
    }
    allowForeground();
    pinAllOverlaysBottom();
    console.log("[edex] open-path ok", resolved, isDir ? "(dir)" : "(file)");
    return { ok: true, path: resolved, isDirectory: isDir };
  } catch (err) {
    console.error("open-path", err);
    return { ok: false, message: err.message || "開啟失敗" };
  } finally {
    setTimeout(() => {
      pinAllOverlaysBottom();
      if (!win || win.isDestroyed()) return;
      if (fileDragInFlight || isFileDragActive() || fileDragArmed) {
        applyFileDragMouseMode(win);
      }
    }, 500);
  }
});

ipcMain.handle("pick-program", async (event) => {
  const win = getSenderWindow(event);
  const result = await dialog.showOpenDialog(win, {
    title: "選擇要嵌入的程式",
    properties: ["openFile"],
    filters: [
      { name: "程式／捷徑", extensions: ["exe", "lnk", "bat", "cmd", "msc"] },
      { name: "所有檔案", extensions: ["*"] }
    ]
  });
  if (result.canceled || !result.filePaths?.[0]) return null;
  const filePath = result.filePaths[0];
  const resolved = await win32Embed.resolveShortcut(filePath);
  return {
    path: filePath,
    targetPath: resolved.path || filePath,
    name: path.basename(filePath, path.extname(filePath)),
    args: resolved.args || ""
  };
});

ipcMain.handle("list-pinned-programs", () => {
  const list = Array.isArray(settings?.pinnedPrograms) ? settings.pinnedPrograms : [];
  return { items: list };
});

ipcMain.handle("save-pinned-programs", (_e, items) => {
  const next = Array.isArray(items)
    ? items.filter((item) => item && item.path).map((item, index) => ({
      id: String(item.id || `pin${Date.now()}_${index}`),
      name: String(item.name || path.basename(String(item.path))).trim(),
      path: String(item.path)
    }))
    : [];
  settings = saveSettings(app.getPath("userData"), { pinnedPrograms: next });
  {
    const themeName = resolveThemeName(settings.theme || "tron");
    broadcast("settings-updated", {
      settings,
      theme: loadTheme(themeName),
      themeName,
      displays: listDisplays()
    });
  }
  return { items: next };
});

ipcMain.handle("list-embed-windows", async () => {
  const items = await win32Embed.listTopWindows(50);
  return { items };
});

function parentHwndOf(event) {
  const win = getSenderWindow(event);
  if (!win || win.isDestroyed()) return "";
  return win32Embed.hwndFromBuffer(win.getNativeWindowHandle());
}

/** Map renderer CSS host rect → physical screen pixels for docking. */
function mapCssBoundsToScreen(event, bounds = {}) {
  const win = getSenderWindow(event);
  if (!win || win.isDestroyed()) {
    return {
      x: Math.round(Number(bounds.x) || 0),
      y: Math.round(Number(bounds.y) || 0),
      w: Math.max(40, Math.round(Number(bounds.w) || 400)),
      h: Math.max(40, Math.round(Number(bounds.h) || 300))
    };
  }
  const zoom = win.webContents.getZoomFactor() || 1;
  const content = win.getContentBounds();
  const dipRect = {
    x: Math.round(content.x + (Number(bounds.x) || 0) * zoom),
    y: Math.round(content.y + (Number(bounds.y) || 0) * zoom),
    width: Math.max(40, Math.round((Number(bounds.w) || 400) * zoom)),
    height: Math.max(40, Math.round((Number(bounds.h) || 300) * zoom))
  };
  const display = screen.getDisplayMatching(win.getBounds());
  try {
    const physical = screen.dipToScreenRect(display, dipRect);
    return {
      x: Math.round(physical.x),
      y: Math.round(physical.y),
      w: Math.max(40, Math.round(physical.width)),
      h: Math.max(40, Math.round(physical.height))
    };
  } catch {
    const sf = display?.scaleFactor || 1;
    return {
      x: Math.round(dipRect.x * sf),
      y: Math.round(dipRect.y * sf),
      w: Math.max(40, Math.round(dipRect.width * sf)),
      h: Math.max(40, Math.round(dipRect.height * sf))
    };
  }
}

ipcMain.handle("embed-launch", async (event, payload = {}) => {
  const appPath = String(payload.path || "").trim();
  if (!appPath) throw new Error("未指定程式");
  const screenBounds = mapCssBoundsToScreen(event, payload.bounds || {});
  return win32Embed.launchAndDock(appPath, screenBounds, {
    timeoutMs: Number(payload.timeoutMs) || 15000
  });
});

ipcMain.handle("embed-attach", async (event, payload = {}) => {
  const childHwnd = String(payload.hwnd || "").trim();
  if (!childHwnd) throw new Error("視窗無效");
  const screenBounds = mapCssBoundsToScreen(event, payload.bounds || {});
  const ok = await win32Embed.dockWindow(
    childHwnd,
    screenBounds.x,
    screenBounds.y,
    screenBounds.w,
    screenBounds.h
  );
  if (!ok) throw new Error("對齊視窗失敗");
  return { ok: true, hwnd: childHwnd, pid: Number(payload.pid) || 0 };
});

ipcMain.handle("embed-bounds", async (event, payload = {}) => {
  const childHwnd = String(payload.hwnd || "").trim();
  if (!childHwnd) return { ok: false };
  const screenBounds = mapCssBoundsToScreen(event, payload.bounds || {});
  const ok = await win32Embed.setDockBounds(
    childHwnd,
    screenBounds.x,
    screenBounds.y,
    screenBounds.w,
    screenBounds.h
  );
  return { ok };
});

ipcMain.handle("embed-release", async (_e, payload = {}) => {
  const childHwnd = String(payload?.hwnd || "").trim();
  if (!childHwnd) return { ok: false };
  const ok = await win32Embed.releaseEmbed(childHwnd);
  return { ok };
});

ipcMain.handle("embed-focus", async (_e, payload = {}) => {
  const childHwnd = String(payload?.hwnd || "").trim();
  if (!childHwnd) return { ok: false };
  const ok = await win32Embed.focusDock(childHwnd);
  return { ok };
});

ipcMain.handle("embed-capture", async (_e, payload = {}) => {
  const childHwnd = String(payload?.hwnd || "").trim();
  if (!childHwnd) return { ok: false, dataUrl: "" };
  const w = Math.max(80, Math.min(1400, Math.round(Number(payload.w) || 640)));
  const h = Math.max(60, Math.min(1000, Math.round(Number(payload.h) || 420)));
  try {
    const sources = await desktopCapturer.getSources({
      types: ["window"],
      thumbnailSize: { width: w, height: h },
      fetchWindowIcons: false
    });
    const match = sources.find((src) => {
      const id = String(src.id || "");
      return id === `window:${childHwnd}:0`
        || id.startsWith(`window:${childHwnd}:`)
        || id.includes(`:${childHwnd}:`);
    });
    const thumb = match?.thumbnail;
    if (thumb && !thumb.isEmpty()) {
      const dataUrl = thumb.toDataURL();
      if (dataUrl && dataUrl.length > 64) return { ok: true, dataUrl };
    }
  } catch { /* fallback below */ }
  const dataUrl = await win32Embed.captureWindowPng(childHwnd, w, h);
  return { ok: Boolean(dataUrl), dataUrl: dataUrl || "" };
});

ipcMain.handle("refit-display", (event) => {
  const win = getSenderWindow(event);
  const displayId = getWindowDisplayId(win);
  const display = findDisplay(displayId);
  fitWindowToDisplay(win, display);
  return {
    bounds: display.bounds,
    scaleFactor: display.scaleFactor || 1,
    physicalSize: {
      width: Math.round(display.bounds.width * (display.scaleFactor || 1)),
      height: Math.round(display.bounds.height * (display.scaleFactor || 1))
    }
  };
});

ipcMain.handle("quit-app", () => {
  app.quit();
  return true;
});

ipcMain.on("set-file-drag-armed", (event, armed) => {
  fileDragArmed = Boolean(armed);
  if (!armed) fileDragInFlight = false;
  applyFileDragMouseMode(getSenderWindow(event));
});

ipcMain.on("set-mouse-ignore", (event, ignore) => {
  const win = getSenderWindow(event);
  if (!win || win.isDestroyed()) return;
  // Armed / in-flight modes own hit-testing — don't let hover logic override.
  if (fileDragInFlight || isFileDragActive() || fileDragArmed) {
    applyFileDragMouseMode(win);
    return;
  }
  // Only toggle hit-testing — never pinAndKeepBounds here (setBounds on every
  // hover-enter made holding/dragging file icons feel extremely stuttery).
  win.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
});

/** Screen cursor → renderer CSS client coords (works even while click-through). */
ipcMain.on("get-cursor-client-point", (event) => {
  const win = getSenderWindow(event);
  if (!win || win.isDestroyed()) {
    event.returnValue = null;
    return;
  }
  try {
    const pt = screen.getCursorScreenPoint();
    const bounds = win.getContentBounds();
    const zoom = win.webContents.getZoomFactor() || 1;
    event.returnValue = {
      x: (pt.x - bounds.x) / zoom,
      y: (pt.y - bounds.y) / zoom
    };
  } catch {
    event.returnValue = null;
  }
});

ipcMain.handle("get-net-status", async () => getNetStatus());
ipcMain.handle("get-net-traffic", async () => getTrafficSample());
ipcMain.handle("get-cpu-metrics", () => getCpuMetrics());
ipcMain.handle("get-mem-metrics", () => getMemMetrics());
ipcMain.handle("get-sys-metrics", () => getSysMetrics());
ipcMain.handle("get-hardware-info", async () => getHardwareInfo());
ipcMain.handle("get-top-processes", async () => getTopProcesses());
ipcMain.handle("get-globe-grid", () => {
  try {
    return loadGlobeGrid();
  } catch (err) {
    console.error("globe grid", err);
    return { tiles: [] };
  }
});
