const fs = require("fs");
const path = require("path");

const DEFAULTS = {
  includeFolders: false,
  snapWidgets: true,
  snapGap: 12,
  theme: "tron",
  wallpaper: "grid",
  iconView: "grid",
  gridSize: 32,
  // LED pixel size vs wallpaper grid (1 = one grid cell).
  clockScale: 1,
  // Highlight color for lit LED cells (hex / rgba).
  clockLedColor: "#ffffff",
  // Show YYYY/MM/DD under the time.
  clockShowDate: true,
  // Code-rain glyph size (px) and speed multiplier.
  rainFontSize: 14,
  rainSpeed: 1,
  searchFontSize: 12,
  // Shared 2K / 4K layout ruler for every display.
  layoutMode: "2k",
  uiScale: 1,
  // Per-display independent layouts keyed by display.id
  displayLayouts: {},
  searchRoots: [],
  searchLocalDrives: true,
  migrateFiles: false,
  // Fixed programs that can be opened inside program containers.
  pinnedPrograms: [],
  // Random slow H/V grid-line sweep highlight.
  gridLineSweep: true,
  // Concurrent sweep lines (1–8).
  gridSweepCount: 3,
  // Trail length in grid cells (2–24).
  gridSweepLength: 8,
  // Motion speed multiplier (0.2–3).
  gridSweepSpeed: 1
};

function settingsPath(userData) {
  return path.join(userData, "organizer-settings.json");
}

function loadSettings(userData) {
  const file = settingsPath(userData);
  if (!fs.existsSync(file)) return { ...DEFAULTS, displayLayouts: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      ...DEFAULTS,
      ...raw,
      displayLayouts: raw.displayLayouts && typeof raw.displayLayouts === "object" ? raw.displayLayouts : {},
      uiScale: raw.uiScale === 0.72 ? 1 : (raw.uiScale ?? DEFAULTS.uiScale),
      layoutMode: raw.layoutMode === "4k" ? "4k" : "2k",
      clockScale: Number.isFinite(Number(raw.clockScale))
        ? Math.max(0.25, Math.min(2, Number(raw.clockScale)))
        : DEFAULTS.clockScale,
      clockLedColor: typeof raw.clockLedColor === "string" && raw.clockLedColor
        ? String(raw.clockLedColor).trim()
        : DEFAULTS.clockLedColor,
      clockShowDate: raw.clockShowDate !== false,
      rainFontSize: Number.isFinite(Number(raw.rainFontSize))
        ? Math.max(8, Math.min(72, Math.round(Number(raw.rainFontSize))))
        : DEFAULTS.rainFontSize,
      rainSpeed: Number.isFinite(Number(raw.rainSpeed))
        ? Math.max(0.1, Math.min(8, Number(raw.rainSpeed)))
        : DEFAULTS.rainSpeed,
      searchFontSize: Number.isFinite(Number(raw.searchFontSize))
        ? Math.max(8, Math.min(72, Math.round(Number(raw.searchFontSize))))
        : DEFAULTS.searchFontSize,
      searchRoots: Array.isArray(raw.searchRoots) ? raw.searchRoots.filter(Boolean) : [],
      searchLocalDrives: raw.searchLocalDrives !== false,
      migrateFiles: Boolean(raw.migrateFiles),
      pinnedPrograms: Array.isArray(raw.pinnedPrograms)
        ? raw.pinnedPrograms
          .filter((item) => item && item.path)
          .map((item) => ({
            id: String(item.id || `pin${Date.now()}`),
            name: String(item.name || "").trim() || require("path").basename(String(item.path)),
            path: String(item.path)
          }))
        : [],
      gridLineSweep: raw.gridLineSweep !== false,
      gridSweepCount: Number.isFinite(Number(raw.gridSweepCount))
        ? Math.max(1, Math.min(8, Math.round(Number(raw.gridSweepCount))))
        : DEFAULTS.gridSweepCount,
      gridSweepLength: Number.isFinite(Number(raw.gridSweepLength))
        ? Math.max(2, Math.min(24, Math.round(Number(raw.gridSweepLength))))
        : DEFAULTS.gridSweepLength,
      gridSweepSpeed: Number.isFinite(Number(raw.gridSweepSpeed))
        ? Math.max(0.2, Math.min(3, Math.round(Number(raw.gridSweepSpeed) * 20) / 20))
        : DEFAULTS.gridSweepSpeed
    };
  } catch {
    return { ...DEFAULTS, displayLayouts: {} };
  }
}

function saveSettings(userData, next) {
  const current = loadSettings(userData);
  const merged = {
    ...current,
    ...next,
    clockScale: Number.isFinite(Number(next.clockScale ?? current.clockScale))
      ? Math.max(0.25, Math.min(2, Number(next.clockScale ?? current.clockScale)))
      : current.clockScale,
    clockShowDate: next.clockShowDate !== undefined ? Boolean(next.clockShowDate) : current.clockShowDate,
    rainFontSize: Number.isFinite(Number(next.rainFontSize ?? current.rainFontSize))
      ? Math.max(8, Math.min(72, Math.round(Number(next.rainFontSize ?? current.rainFontSize))))
      : current.rainFontSize,
    rainSpeed: Number.isFinite(Number(next.rainSpeed ?? current.rainSpeed))
      ? Math.max(0.1, Math.min(8, Number(next.rainSpeed ?? current.rainSpeed)))
      : current.rainSpeed,
    searchFontSize: Number.isFinite(Number(next.searchFontSize ?? current.searchFontSize))
      ? Math.max(8, Math.min(72, Math.round(Number(next.searchFontSize ?? current.searchFontSize))))
      : current.searchFontSize,
    layoutMode: (next.layoutMode ?? current.layoutMode) === "4k" ? "4k" : "2k",
    uiScale: Number.isFinite(Number(next.uiScale ?? current.uiScale))
      && Number(next.uiScale ?? current.uiScale) !== 0.72
      ? Math.max(0.4, Math.min(1.5, Number(next.uiScale ?? current.uiScale)))
      : current.uiScale,
    searchLocalDrives: next.searchLocalDrives !== undefined
      ? Boolean(next.searchLocalDrives)
      : current.searchLocalDrives,
    migrateFiles: next.migrateFiles !== undefined ? Boolean(next.migrateFiles) : current.migrateFiles,
    pinnedPrograms: next.pinnedPrograms !== undefined
      ? (Array.isArray(next.pinnedPrograms) ? next.pinnedPrograms : current.pinnedPrograms)
      : current.pinnedPrograms,
    gridLineSweep: next.gridLineSweep !== undefined
      ? Boolean(next.gridLineSweep)
      : current.gridLineSweep,
    gridSweepCount: Number.isFinite(Number(next.gridSweepCount ?? current.gridSweepCount))
      ? Math.max(1, Math.min(8, Math.round(Number(next.gridSweepCount ?? current.gridSweepCount))))
      : current.gridSweepCount,
    gridSweepLength: Number.isFinite(Number(next.gridSweepLength ?? current.gridSweepLength))
      ? Math.max(2, Math.min(24, Math.round(Number(next.gridSweepLength ?? current.gridSweepLength))))
      : current.gridSweepLength,
    gridSweepSpeed: Number.isFinite(Number(next.gridSweepSpeed ?? current.gridSweepSpeed))
      ? Math.max(0.2, Math.min(3, Math.round(Number(next.gridSweepSpeed ?? current.gridSweepSpeed) * 20) / 20))
      : current.gridSweepSpeed,
    displayLayouts: next.displayLayouts
      ? { ...current.displayLayouts, ...next.displayLayouts }
      : current.displayLayouts
  };
  // Allow full replace of one display layout via displayLayoutPatch
  if (next.displayLayoutPatch) {
    const { displayId, layout } = next.displayLayoutPatch;
    merged.displayLayouts = {
      ...merged.displayLayouts,
      [String(displayId)]: layout
    };
    delete merged.displayLayoutPatch;
  }
  fs.writeFileSync(settingsPath(userData), JSON.stringify(merged, null, 2), "utf8");
  return merged;
}

module.exports = { DEFAULTS, loadSettings, saveSettings };
