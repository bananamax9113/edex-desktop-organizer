const { contextBridge, ipcRenderer, webUtils } = require("electron");

function argValue(prefix) {
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const displayId = Number(argValue("--edex-display-id=") || 0);
const displayIndex = Number(argValue("--edex-display-index=") || 0);
const isPrimary = argValue("--edex-primary=") === "1";
const launchWidth = Number(argValue("--edex-width=") || 0);
const launchHeight = Number(argValue("--edex-height=") || 0);
const launchScale = Number(argValue("--edex-scale=") || 1);

contextBridge.exposeInMainWorld("edex", {
  displayId,
  displayIndex,
  isPrimary,
  launchWidth,
  launchHeight,
  launchScale,
  bootstrap: () => ipcRenderer.invoke("get-bootstrap"),
  saveSettings: (patch) => ipcRenderer.invoke("save-settings", patch),
  saveDisplayLayout: (layout) => ipcRenderer.invoke("save-display-layout", layout),
  transferWidget: (targetDisplayId, widget) =>
    ipcRenderer.invoke("transfer-widget", { targetDisplayId, widget }),
  getTheme: (name) => ipcRenderer.invoke("get-theme", name),
  pickFolder: () => ipcRenderer.invoke("pick-folder"),
  scan: (root) => ipcRenderer.invoke("scan", root),
  listFolder: (root, options) => ipcRenderer.invoke("list-folder", root, options || {}),
  listDesktopShortcuts: () => ipcRenderer.invoke("list-desktop-shortcuts"),
  listDesktopFiles: () => ipcRenderer.invoke("list-desktop-files"),
  listDrives: () => ipcRenderer.invoke("list-drives"),
  searchFiles: (query, limit) => ipcRenderer.invoke("search-files", query, limit),
  searchStatus: () => ipcRenderer.invoke("search-status"),
  searchRebuild: () => ipcRenderer.invoke("search-rebuild"),
  pickSearchRoot: () => ipcRenderer.invoke("pick-search-root"),
  addSearchRoot: (target) => ipcRenderer.invoke("add-search-root", target),
  removeSearchRoot: (target) => ipcRenderer.invoke("remove-search-root", target),
  setSearchLocal: (enabled) => ipcRenderer.invoke("set-search-local", enabled),
  revealPath: (target) => ipcRenderer.invoke("reveal-path", target),
  plan: (scan, options) => ipcRenderer.invoke("plan", scan, options),
  organize: (scan, options) => ipcRenderer.invoke("organize", scan, options),
  undo: () => ipcRenderer.invoke("undo"),
  importFiles: (dest, files) => ipcRenderer.invoke("import-files", dest, files),
  pathForFile: (file) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return file?.path || "";
    }
  },
  getCalendarNotes: () => ipcRenderer.invoke("get-calendar-notes"),
  addCalendarNote: (dateKey, text) => ipcRenderer.invoke("add-calendar-note", dateKey, text),
  updateCalendarNote: (dateKey, id, text) => ipcRenderer.invoke("update-calendar-note", dateKey, id, text),
  removeCalendarNote: (dateKey, id) => ipcRenderer.invoke("remove-calendar-note", dateKey, id),
  copyText: (text) => ipcRenderer.invoke("copy-text", text),
  createFolder: (parent) => ipcRenderer.invoke("create-folder", parent),
  renameItem: (target, name) => ipcRenderer.invoke("rename-item", target, name),
  trashItem: (target) => ipcRenderer.invoke("trash-item", target),
  setItemTags: (target, tags) => ipcRenderer.invoke("set-item-tags", target, tags),
  openPath: (target) => ipcRenderer.invoke("open-path", target),
  refitDisplay: () => ipcRenderer.invoke("refit-display"),
  quitApp: () => ipcRenderer.invoke("quit-app"),
  setMouseIgnore: (ignore) => ipcRenderer.send("set-mouse-ignore", ignore),
  getNetStatus: () => ipcRenderer.invoke("get-net-status"),
  getNetTraffic: () => ipcRenderer.invoke("get-net-traffic"),
  getCpuMetrics: () => ipcRenderer.invoke("get-cpu-metrics"),
  getMemMetrics: () => ipcRenderer.invoke("get-mem-metrics"),
  getSysMetrics: () => ipcRenderer.invoke("get-sys-metrics"),
  getHardwareInfo: () => ipcRenderer.invoke("get-hardware-info"),
  getTopProcesses: () => ipcRenderer.invoke("get-top-processes"),
  getGlobeGrid: () => ipcRenderer.invoke("get-globe-grid"),
  onDisplaysChanged: (fn) => {
    ipcRenderer.on("display-info", (_e, payload) => fn(payload));
  },
  onSettingsUpdated: (fn) => {
    ipcRenderer.on("settings-updated", (_e, payload) => fn(payload));
  },
  onReceiveWidget: (fn) => {
    ipcRenderer.on("receive-widget", (_e, widget) => fn(widget));
  }
});
