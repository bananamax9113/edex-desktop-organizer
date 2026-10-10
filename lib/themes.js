const fs = require("fs");
const path = require("path");

function resolveThemesDir() {
  const candidates = [
    path.join(__dirname, "..", "assets", "themes"),
    path.join(__dirname, "../../src/assets/themes")
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "tron.json"))) return dir;
  }
  return candidates[0];
}

const themesDir = resolveThemesDir();

/** Themes exposed in settings — apollo, tron, plus fluorescent green. */
const THEME_ALLOWLIST = ["apollo", "tron", "fluorescent"];

const WALLPAPERS = [
  { id: "grid", label: "原版網格" },
  { id: "solid", label: "純色背景" },
  { id: "scanlines", label: "掃描線" },
  { id: "radial", label: "輻射光暈" },
  { id: "hex", label: "六角場域" }
];

function listThemes() {
  return THEME_ALLOWLIST.filter((name) =>
    fs.existsSync(path.join(themesDir, `${name}.json`))
  );
}

function resolveThemeName(name) {
  const n = String(name || "tron").trim();
  if (THEME_ALLOWLIST.includes(n) && fs.existsSync(path.join(themesDir, `${n}.json`))) {
    return n;
  }
  return "tron";
}

function loadTheme(name) {
  const resolved = resolveThemeName(name);
  const file = path.join(themesDir, `${resolved}.json`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

module.exports = { WALLPAPERS, listThemes, loadTheme, resolveThemeName, themesDir, THEME_ALLOWLIST };
