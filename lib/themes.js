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

const WALLPAPERS = [
  { id: "grid", label: "原版網格" },
  { id: "solid", label: "純色背景" },
  { id: "scanlines", label: "掃描線" },
  { id: "radial", label: "輻射光暈" },
  { id: "hex", label: "六角場域" }
];

function listThemes() {
  return fs.readdirSync(themesDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

function loadTheme(name) {
  const file = path.join(themesDir, `${name}.json`);
  if (!fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(path.join(themesDir, "tron.json"), "utf8"));
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

module.exports = { WALLPAPERS, listThemes, loadTheme, themesDir };
