const fs = require("fs");
const path = require("path");

function resolveAsset(...parts) {
  const candidates = [
    path.join(__dirname, "..", "assets", ...parts),
    path.join(__dirname, "../../src/assets", ...parts)
  ];
  const hit = candidates.find((file) => fs.existsSync(file));
  if (!hit) {
    throw new Error(`Cannot find asset ${parts.join("/")}`);
  }
  return hit;
}

const icons = JSON.parse(fs.readFileSync(resolveAsset("icons", "file-icons.json"), "utf8"));
const matchIcon = require(resolveAsset("misc", "file-icons-match.js"));

/** match.js 鍵名 → file-icons.json 實際鍵 */
const ALIASES = {
  word: "microsoft-word",
  excel: "microsoft-excel",
  powerpoint: "microsoft-powerpoint",
  "icon-file-pdf": "adobe-acrobat",
  pdf: "adobe-acrobat",
  zip: "archive",
  rar: "archive",
  "7z": "archive",
  gzip: "archive",
  model: "3d-model",
  dwg: "3d-model",
  dxf: "3d-model",
  "icon-file-text": "file",
  text: "file",
  txt: "file",
  md: "file",
  document: "file",
  audio: "file",
  music: "file"
};

function pack(icon, key) {
  if (!icon) return null;
  return {
    key,
    width: icon.width,
    height: icon.height,
    svg: icon.svg
  };
}

function lookup(name) {
  if (!name) return null;
  const aliased = ALIASES[name] || ALIASES[String(name).toLowerCase()];
  const candidates = [
    name,
    aliased,
    name.replace(/^icon-file-/, ""),
    name.replace(/^icon-/, ""),
    aliased && String(aliased).replace(/^icon-file-/, ""),
    aliased && String(aliased).replace(/^icon-/, "")
  ].filter(Boolean);
  for (const key of candidates) {
    if (icons[key]) return icons[key];
  }
  return null;
}

function resolveIcon(name, isDirectory) {
  if (isDirectory) return pack(icons.dir, "dir");
  const matched = matchIcon(name);
  const found = lookup(matched);
  if (found) return pack(found, matched);
  // 再依副檔名直接對應一次
  const ext = path.extname(String(name || "")).toLowerCase().replace(".", "");
  if (ext) {
    const byExt = lookup(ext) || lookup(ALIASES[ext]);
    if (byExt) return pack(byExt, ext);
  }
  return pack(icons.file || icons.other, "file");
}

function dirIcon() {
  return pack(icons.dir, "dir");
}

module.exports = { resolveIcon, dirIcon, icons };
