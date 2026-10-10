const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const { dialog, shell } = require("electron");

const MACOS_TAGS = [
  { id: "red", label: "紅色", color: "#ff3b30" },
  { id: "orange", label: "橙色", color: "#ff9500" },
  { id: "yellow", label: "黃色", color: "#ffcc00" },
  { id: "green", label: "綠色", color: "#28cd41" },
  { id: "blue", label: "藍色", color: "#007aff" },
  { id: "purple", label: "紫色", color: "#af52de" },
  { id: "gray", label: "灰色", color: "#8e8e93" }
];

const TAG_IDS = new Set(MACOS_TAGS.map((t) => t.id));

function isVirtualPath(target) {
  const value = String(target || "");
  return !value || /^shell:/i.test(value) || value.includes("::{") || value.startsWith("::");
}

function adsPath(target) {
  return `${target}:edex.tags`;
}

function normalizeTags(list) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(list) ? list : []) {
    const id = String(raw || "").toLowerCase();
    if (!TAG_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

async function readTags(target) {
  if (isVirtualPath(target)) return [];
  try {
    const raw = await fsp.readFile(adsPath(target), "utf8");
    return normalizeTags(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function writeTags(target, tags) {
  if (isVirtualPath(target)) throw new Error("無法標記此項目");
  const next = normalizeTags(tags);
  const file = adsPath(target);
  if (!next.length) {
    await fsp.unlink(file).catch(() => {});
    return next;
  }
  await fsp.writeFile(file, JSON.stringify(next), "utf8");
  return next;
}

function uniqueName(dir, base) {
  let name = base;
  let n = 2;
  while (fs.existsSync(path.join(dir, name))) {
    name = `${base} (${n})`;
    n += 1;
  }
  return name;
}

async function createFolder(parent, folderName) {
  if (isVirtualPath(parent)) throw new Error("無法在此位置建立資料夾");
  await fsp.access(parent);
  const requested = String(folderName || "").trim();
  if (!requested) throw new Error("請輸入資料夾名稱");
  const base = safeBaseName(requested);
  const name = uniqueName(parent, base);
  const dest = path.join(parent, name);
  await fsp.mkdir(dest);
  return { ok: true, path: dest, name };
}

function safeBaseName(name) {
  const value = String(name || "").trim();
  if (!value) throw new Error("名稱不可空白");
  if (/[\\/:*?"<>|]/.test(value) || value === "." || value === "..") {
    throw new Error("名稱含有無效字元");
  }
  return value;
}

async function renameItem(target, newName) {
  if (isVirtualPath(target)) throw new Error("無法重新命名此項目");
  const name = safeBaseName(newName);
  const dir = path.dirname(target);
  const dest = path.join(dir, name);
  if (path.resolve(target) === path.resolve(dest)) {
    return { ok: true, path: target, name, oldPath: target };
  }
  if (fs.existsSync(dest)) throw new Error("已有相同名稱的項目");
  await fsp.rename(target, dest);
  return { ok: true, path: dest, name, oldPath: target };
}

async function trashItem(target, browserWindow) {
  if (isVirtualPath(target)) throw new Error("無法刪除此項目");
  const name = path.basename(target);
  const result = await dialog.showMessageBox(browserWindow || undefined, {
    type: "warning",
    buttons: ["取消", "移至回收桶"],
    defaultId: 1,
    cancelId: 0,
    title: "刪除",
    message: `確定將「${name}」移至回收桶？`
  });
  if (result.response !== 1) return { ok: false, cancelled: true };
  await shell.trashItem(target);
  return { ok: true, path: target };
}

module.exports = {
  MACOS_TAGS,
  isVirtualPath,
  readTags,
  writeTags,
  createFolder,
  renameItem,
  trashItem
};
