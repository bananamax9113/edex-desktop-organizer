const path = require("path");

const CATEGORIES = [
  { id: "documents", label: "文件", folder: "文件", exts: [".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".xls", ".xlsx", ".csv", ".ppt", ".pptx", ".md"] },
  { id: "images", label: "圖片", folder: "圖片", exts: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".ico", ".heic", ".tif", ".tiff"] },
  { id: "videos", label: "影片", folder: "影片", exts: [".mp4", ".mkv", ".avi", ".mov", ".wmv", ".webm", ".m4v"] },
  { id: "audio", label: "音樂", folder: "音樂", exts: [".mp3", ".wav", ".flac", ".aac", ".ogg", ".m4a", ".wma"] },
  { id: "archives", label: "壓縮檔", folder: "壓縮檔", exts: [".zip", ".rar", ".7z", ".tar", ".gz", ".iso"] },
  { id: "shortcuts", label: "捷徑", folder: "捷徑", exts: [".lnk", ".url"] },
  { id: "apps", label: "應用程式", folder: "應用程式", exts: [".exe", ".msi", ".bat", ".cmd", ".ps1", ".appx"] },
  { id: "other", label: "其他", folder: "其他", exts: [] }
];

const SKIP_NAMES = new Set(["desktop.ini", "thumbs.db", ".ds_store"]);
const MANAGED_FOLDERS = new Set([...CATEGORIES.map((c) => c.folder), "資料夾"]);

function categorize(name, isDirectory) {
  if (isDirectory) return "folders";
  const ext = path.extname(name).toLowerCase();
  const match = CATEGORIES.find((c) => c.id !== "other" && c.exts.includes(ext));
  return match ? match.id : "other";
}

function folderFor(categoryId) {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  return cat ? cat.folder : "其他";
}

function extFolderFor(name) {
  const ext = path.extname(String(name || "")).replace(".", "").toUpperCase();
  return ext || "無副檔名";
}

function archiveRel(item) {
  if (item?.isDirectory) return ["資料夾"];
  const category = item?.category || categorize(item?.name, false);
  if (category === "shortcuts") return ["捷徑"];
  return [folderFor(category), extFolderFor(item?.name)];
}

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

module.exports = {
  CATEGORIES,
  SKIP_NAMES,
  MANAGED_FOLDERS,
  categorize,
  folderFor,
  extFolderFor,
  archiveRel,
  formatBytes
};
