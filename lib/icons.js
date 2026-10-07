const icons = require("../../src/assets/icons/file-icons.json");
const matchIcon = require("../../src/assets/misc/file-icons-match.js");

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
