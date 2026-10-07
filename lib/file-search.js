const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { listDrives } = require("./drives");

const SKIP_DIRS = new Set([
  "windows",
  "winsxs",
  "syswow64",
  "$recycle.bin",
  "system volume information",
  "recovery",
  "config.msi",
  "node_modules",
  ".git",
  "csc",
  "temp",
  "tmp",
  "cache",
  "installer"
]);

const MAX_FILES = 450000;
const DIR_TIMEOUT = 8000;

let includeLocal = true;
let extraRoots = [];
let entries = [];
let indexing = false;
let generation = 0;
let indexedAt = 0;
let lastError = "";
let esPath = null;
let esChecked = false;

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function normalizeRoot(raw) {
  let value = String(raw || "").trim().replace(/\//g, "\\");
  if (!value) return "";
  if (/^[a-zA-Z]:$/.test(value)) return `${value}\\`;
  if (/^[a-zA-Z]:\\$/.test(value)) return value;
  return value.replace(/\\+$/, "");
}

function isUnc(value) {
  return /^\\\\[^\\]+\\/.test(String(value || ""));
}

function findEverythingCli() {
  if (esChecked) return esPath;
  esChecked = true;
  const names = ["es.exe", "es64.exe"];
  const dirs = [
    process.env.EVERYTHING_PATH,
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Everything"),
    path.join(process.env.ProgramFiles || "C:\\Program Files", "Everything 1.5a"),
    path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "Everything"),
    path.join(os.homedir(), "scoop", "apps", "everything", "current"),
    "C:\\Everything"
  ].filter(Boolean);
  for (const dir of dirs) {
    for (const name of names) {
      const full = path.join(dir, name);
      if (fs.existsSync(full)) {
        esPath = full;
        return esPath;
      }
    }
  }
  esPath = null;
  return esPath;
}

function skipDirName(name) {
  return SKIP_DIRS.has(String(name || "").toLowerCase());
}

function execBuffer(file, args, timeout = 8000) {
  return new Promise((resolve) => {
    execFile(file, args, {
      windowsHide: true,
      timeout,
      encoding: "buffer",
      maxBuffer: 8 * 1024 * 1024
    }, (err, stdout) => {
      if (err && !stdout?.length) return resolve(null);
      const buf = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout || "");
      if (!buf.length) return resolve(err ? null : "");
      let text = buf.toString("utf8");
      if (text.includes("\uFFFD") || /\x00/.test(text.slice(0, 8))) {
        text = buf.toString("utf16le");
      }
      resolve(text.replace(/^\uFEFF/, ""));
    });
  });
}

async function searchEverything(query, limit) {
  const cli = findEverythingCli();
  if (!cli) return null;
  let text = await execBuffer(cli, ["-n", String(limit), "-utf-8-bom", query], 6000);
  if (text == null) text = await execBuffer(cli, ["-n", String(limit), query], 6000);
  if (text == null) return null;
  return parseEsLines(text, limit);
}

function parseEsLines(text, limit) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit)
    .map((full) => {
      const base = full.split(/\\/).pop() || full;
      return {
        name: base,
        path: full,
        dir: full.slice(0, Math.max(0, full.length - base.length - 1)),
        source: "everything"
      };
    });
}

async function pathReachable(target) {
  try {
    await withTimeout(fs.promises.access(target, fs.constants.R_OK), 4000);
    return true;
  } catch {
    return false;
  }
}

async function collectRoots() {
  const roots = [];
  if (includeLocal) {
    try {
      const listing = await listDrives();
      for (const item of listing.items || []) {
        if (item.type === "網路") continue;
        if (item.path) roots.push(item.path);
      }
    } catch {
      const home = os.homedir();
      if (home) roots.push(home);
    }
    const home = os.homedir();
    if (home && !roots.some((r) => home.toLowerCase().startsWith(String(r).toLowerCase()))) {
      roots.push(home);
    }
  }
  for (const extra of extraRoots) {
    if (!roots.some((r) => String(r).toLowerCase() === extra.toLowerCase())) roots.push(extra);
  }
  return roots;
}

async function walkRoot(root, gen, bag) {
  const stack = [root];
  while (stack.length && gen === generation && bag.length < MAX_FILES) {
    const dir = stack.pop();
    let list;
    try {
      list = await withTimeout(fs.promises.readdir(dir, { withFileTypes: true }), DIR_TIMEOUT);
    } catch {
      continue;
    }
    for (const ent of list) {
      if (gen !== generation || bag.length >= MAX_FILES) return;
      const name = ent.name;
      if (!name || name === "." || name === "..") continue;
      if (ent.isSymbolicLink && ent.isSymbolicLink()) continue;
      const full = path.join(dir, name);
      if (ent.isDirectory()) {
        if (skipDirName(name)) continue;
        stack.push(full);
        bag.push({
          name,
          nameLower: name.toLowerCase(),
          path: full,
          pathLower: full.toLowerCase(),
          dir,
          isDir: true
        });
      } else if (ent.isFile()) {
        bag.push({
          name,
          nameLower: name.toLowerCase(),
          path: full,
          pathLower: full.toLowerCase(),
          dir,
          isDir: false
        });
      }
    }
    if (bag.length % 400 === 0) await new Promise((resolve) => setImmediate(resolve));
  }
}

async function rebuild() {
  const gen = ++generation;
  indexing = true;
  lastError = "";
  const bag = [];
  try {
    const roots = await collectRoots();
    for (const root of roots) {
      if (gen !== generation) return status();
      if (!(await pathReachable(root))) {
        lastError = `無法存取 ${root}`;
        continue;
      }
      await walkRoot(root, gen, bag);
    }
    if (gen === generation) {
      entries = bag;
      indexedAt = Date.now();
    }
  } catch (err) {
    lastError = err.message || String(err);
  } finally {
    if (gen === generation) indexing = false;
  }
  return status();
}

function configure(opts = {}) {
  if (Array.isArray(opts.roots)) {
    extraRoots = opts.roots.map(normalizeRoot).filter(Boolean);
  }
  if (typeof opts.includeLocal === "boolean") includeLocal = opts.includeLocal;
  findEverythingCli();
}

function addRoot(raw) {
  const root = normalizeRoot(raw);
  if (!root) throw new Error("路徑無效");
  if (!isUnc(root) && !/^[a-zA-Z]:\\/.test(root)) throw new Error("請輸入本機磁碟路徑或 \\\\伺服器\\分享 網路路徑");
  if (extraRoots.some((item) => item.toLowerCase() === root.toLowerCase())) return extraRoots.slice();
  extraRoots.push(root);
  return extraRoots.slice();
}

function removeRoot(raw) {
  const root = normalizeRoot(raw).toLowerCase();
  extraRoots = extraRoots.filter((item) => item.toLowerCase() !== root);
  return extraRoots.slice();
}

function score(entry, tokens) {
  const first = tokens[0] || "";
  let n = 0;
  if (entry.nameLower.startsWith(first)) n += 300;
  else if (entry.nameLower.includes(first)) n += 120;
  if (!entry.isDir) n += 8;
  n -= Math.min(80, entry.name.length);
  return n;
}

function searchIndex(query, limit, onlyExtra) {
  const tokens = String(query || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return [];
  const pathMode = tokens.some((t) => t.includes("\\") || t.includes("/"));
  const extraSet = extraRoots.map((r) => r.toLowerCase());
  const hits = [];
  for (const entry of entries) {
    if (onlyExtra) {
      const hay = entry.pathLower;
      if (!extraSet.some((root) => hay.startsWith(root.toLowerCase()))) continue;
    }
    const ok = tokens.every((token) => {
      const needle = token.replace(/\//g, "\\");
      if (needle.includes("*")) {
        const re = new RegExp("^" + needle.split("*").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$", "i");
        return re.test(entry.name);
      }
      if (pathMode) return entry.pathLower.includes(needle);
      return entry.nameLower.includes(needle);
    });
    if (!ok) continue;
    hits.push(entry);
    if (hits.length > 2500) break;
  }
  hits.sort((a, b) => score(b, tokens) - score(a, tokens));
  return hits.slice(0, limit).map((item) => ({
    name: item.name,
    path: item.path,
    dir: item.dir,
    isDir: Boolean(item.isDir),
    source: "index"
  }));
}

async function search(query, limit = 80) {
  const q = String(query || "").trim();
  const cap = Math.max(1, Math.min(200, Number(limit) || 80));
  if (!q) return { items: [], total: 0, ...status() };
  let items = [];
  const everything = await searchEverything(q, cap);
  if (everything != null) {
    items = everything;
    if (extraRoots.length) {
      const extra = searchIndex(q, cap, true);
      const seen = new Set(items.map((i) => i.path.toLowerCase()));
      for (const hit of extra) {
        if (seen.has(hit.path.toLowerCase())) continue;
        items.push(hit);
        seen.add(hit.path.toLowerCase());
      }
    }
  } else {
    items = searchIndex(q, cap, false);
  }
  return {
    items: items.slice(0, cap),
    total: items.length,
    ...status()
  };
}

function status() {
  return {
    indexing,
    count: entries.length,
    indexedAt,
    engine: findEverythingCli() ? "everything" : "index",
    roots: extraRoots.slice(),
    includeLocal,
    lastError
  };
}

function roots() {
  return extraRoots.slice();
}

module.exports = {
  configure,
  rebuild,
  search,
  status,
  addRoot,
  removeRoot,
  roots,
  normalizeRoot,
  pathReachable
};
