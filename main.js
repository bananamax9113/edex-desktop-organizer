const { app, BrowserWindow, ipcMain, dialog, shell, screen, Tray, Menu, nativeImage, clipboard } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");
const { scanRoot, listFolder, importFiles, buildPlan, executePlan, undoLast } = require("./lib/organizer");
const { dirIcon } = require("./lib/icons");
const { loadSettings, saveSettings } = require("./lib/settings-store");
const { WALLPAPERS, listThemes, loadTheme } = require("./lib/themes");
const { applyAppWallpaper, restoreWallpaper, hideDesktopIcons, restoreDesktopIcons } = require("./lib/system-desktop");
const { pinWindowBottom, stopZOrderDaemon, ensureDaemon } = require("./lib/win32-zorder");
const { listDesktopShortcuts } = require("./lib/desktop-shortcuts");
const { listDrives } = require("./lib/drives");
const fileSearch = require("./lib/file-search");
const { loadNotes, addNote, updateNote, removeNote } = require("./lib/calendar-store");
const { getNetStatus, getTrafficSample, getCpuMetrics, getMemMetrics, getSysMetrics, loadGlobeGrid, getHardwareInfo, getTopProcesses } = require("./lib/net-info");
const fileOps = require("./lib/file-ops");

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
  win.on("focus", () => pinAndKeepBounds(win));
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
    backgroundColor: "#00000000",
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
      win.setBackgroundColor("#00000000");
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
  const themeName = settings.theme || "tron";
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
  if (Object.keys(globalPatch).length) {
    settings = saveSettings(app.getPath("userData"), globalPatch);
  } else {
    settings = loadSettings(app.getPath("userData"));
  }

  const payload = {
    settings,
    theme: loadTheme(settings.theme || "tron"),
    themeName: settings.theme || "tron",
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
  return listFolder(root, options || {});
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

ipcMain.handle("list-desktop-shortcuts", () => listDesktopShortcuts(resolveDesktop()));
ipcMain.handle("list-desktop-files", async () => {
  const dir = resolveDesktop();
  if (!dir) return { items: [], total: 0, root: "" };
  return listFolder(dir, { systemIcons: true });
});

ipcMain.handle("create-folder", async (_e, parent) => fileOps.createFolder(parent));
ipcMain.handle("rename-item", async (_e, target, name) => fileOps.renameItem(target, name));
ipcMain.handle("trash-item", async (event, target) => {
  return fileOps.trashItem(target, getSenderWindow(event));
});
ipcMain.handle("set-item-tags", async (_e, target, tags) => {
  const next = await fileOps.writeTags(target, tags);
  return { ok: true, tags: next, path: target };
});

ipcMain.handle("open-path", async (_e, target) => {
  if (!target) return;
  const value = String(target);
  if (/^shell:/i.test(value) || value.includes("::{") || value.startsWith("::")) {
    spawn("explorer.exe", [value], { detached: true, stdio: "ignore" }).unref();
    return true;
  }
  await shell.openPath(value);
  return true;
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

ipcMain.on("set-mouse-ignore", (event, ignore) => {
  const win = getSenderWindow(event);
  if (!win || win.isDestroyed()) return;
  win.setIgnoreMouseEvents(Boolean(ignore), { forward: true });
  if (!ignore) pinAndKeepBounds(win);
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
