const { execFile } = require("child_process");
const { formatBytes } = require("./categories");
const { decorateItems } = require("./system-icons");

function runPs(command, timeout = 10000) {
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], {
      windowsHide: true,
      timeout,
      encoding: "utf8"
    }, (err, stdout) => {
      if (err) return resolve("");
      resolve(String(stdout || "").trim());
    });
  });
}

function parseJson(raw) {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [data];
  } catch {
    return [];
  }
}

async function listDrives() {
  const raw = await runPs(`
    Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3 OR DriveType=2 OR DriveType=4" |
      Select-Object DeviceID, VolumeName, FileSystem, Size, FreeSpace, DriveType |
      ConvertTo-Json -Compress
  `);
  const rows = parseJson(raw);
  const items = rows.map((row) => {
    const total = Number(row.Size) || 0;
    const free = Number(row.FreeSpace) || 0;
    const used = Math.max(0, total - free);
    const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
    const letter = String(row.DeviceID || "").replace(/\\$/, "");
    const label = String(row.VolumeName || "").trim();
    const type = Number(row.DriveType);
    const typeLabel = type === 2 ? "可移除" : type === 4 ? "網路" : "本機";
    return {
      id: letter || label,
      letter,
      name: label ? `${label} (${letter})` : letter,
      volumeName: label,
      fs: row.FileSystem || "",
      type: typeLabel,
      total,
      free,
      used,
      pct,
      totalLabel: formatBytes(total),
      freeLabel: formatBytes(free),
      usedLabel: formatBytes(used),
      path: letter ? `${letter}\\` : ""
    };
  }).filter((d) => d.letter);

  items.sort((a, b) => a.letter.localeCompare(b.letter, "en"));
  const decorated = await decorateItems(items);
  return { items: decorated, total: decorated.length };
}

module.exports = { listDrives };
