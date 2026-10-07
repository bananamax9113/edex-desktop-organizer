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
  return icons[name] || icons[name.replace(/^icon-file-/, "")] || icons[name.replace(/^icon-/, "")];
}

function resolveIcon(name, isDirectory) {
  const matched = matchIcon(name);
  const found = lookup(matched);
  if (found) return pack(found, matched);
  if (isDirectory) return pack(icons.dir, "dir");
  return pack(icons.file || icons.other, "file");
}

function dirIcon() {
  return pack(icons.dir, "dir");
}

module.exports = { resolveIcon, dirIcon, icons };
