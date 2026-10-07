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
const alreadyReady = fs.existsSync(path.join(cssOut, "boot_screen.css"))
  && fs.existsSync(path.join(vendorOut, "encom-globe.js"))
  && fs.existsSync(path.join(themesOut, "tron.json"));

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
copyDir(path.join(edexSrc, "themes"), themesOut);

console.log(`[prepare-assets] copied ${ok} files + themes -> organizer`);
