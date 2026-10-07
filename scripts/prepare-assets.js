const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const edexSrc = path.join(root, "..", "src", "assets");

const cssFiles = [
  "boot_screen.css",
  "modal.css",
  "mod_clock.css",
  "mod_sysinfo.css",
  "mod_netstat.css",
  "mod_globe.css",
  "mod_conninfo.css",
  "mod_ramwatcher.css",
  "mod_cpuinfo.css",
  "mod_hardwareInspector.css",
  "mod_toplist.css",
  "mod_coderain.css"
];

const miscFiles = [
  "file-icons-match.js",
  "grid.json",
  "boot_log.txt"
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(from, to) {
  ensureDir(path.dirname(to));
  if (!fs.existsSync(from)) return false;
  fs.copyFileSync(from, to);
  return true;
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return false;
  ensureDir(to);
  for (const name of fs.readdirSync(from)) {
    const src = path.join(from, name);
    const dest = path.join(to, name);
    if (fs.statSync(src).isDirectory()) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
  }
  return true;
}

const cssOut = path.join(root, "src", "assets", "css");
const vendorOut = path.join(root, "src", "assets", "vendor");
const themesOut = path.join(root, "assets", "themes");
const iconsOut = path.join(root, "assets", "icons");
const miscOut = path.join(root, "assets", "misc");
const rendererMiscOut = path.join(root, "src", "assets", "misc");

const alreadyReady = fs.existsSync(path.join(cssOut, "boot_screen.css"))
  && fs.existsSync(path.join(vendorOut, "encom-globe.js"))
  && fs.existsSync(path.join(themesOut, "tron.json"))
  && fs.existsSync(path.join(iconsOut, "file-icons.json"))
  && fs.existsSync(path.join(miscOut, "file-icons-match.js"))
  && fs.existsSync(path.join(miscOut, "grid.json"));

if (!fs.existsSync(edexSrc)) {
  if (alreadyReady) {
    console.log("[prepare-assets] using bundled assets");
    process.exit(0);
  }
  console.error("[prepare-assets] missing source assets and no bundled copy");
  process.exit(1);
}

let ok = 0;
for (const name of cssFiles) {
  if (copyFile(path.join(edexSrc, "css", name), path.join(cssOut, name))) ok += 1;
}
if (copyFile(path.join(edexSrc, "vendor", "encom-globe.js"), path.join(vendorOut, "encom-globe.js"))) ok += 1;
if (copyFile(path.join(edexSrc, "icons", "file-icons.json"), path.join(iconsOut, "file-icons.json"))) ok += 1;
for (const name of miscFiles) {
  if (copyFile(path.join(edexSrc, "misc", name), path.join(miscOut, name))) ok += 1;
  // Renderer fetch paths live under src/assets/misc
  if (name === "boot_log.txt") {
    copyFile(path.join(edexSrc, "misc", name), path.join(rendererMiscOut, name));
  }
}
copyDir(path.join(edexSrc, "themes"), themesOut);

console.log(`[prepare-assets] copied ${ok} files + themes/icons/misc -> organizer`);
