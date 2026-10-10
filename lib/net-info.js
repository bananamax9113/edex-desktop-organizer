const os = require("os");
const fs = require("fs");
const path = require("path");
const net = require("net");
const https = require("https");
const { execFile } = require("child_process");

function pickInterface() {
  const ifaces = os.networkInterfaces();
  const skip = /loopback|isatap|teredo|pseudo|vmware|virtualbox|hyper-v|vethernet|wsl|docker|bluetooth/i;
  const scored = [];
  for (const [name, list] of Object.entries(ifaces)) {
    for (const info of list || []) {
      if (info.family !== "IPv4" && info.family !== 4) continue;
      if (info.internal) continue;
      if (String(info.address).startsWith("169.254.")) continue;
      const n = String(name);
      let score = 2;
      if (skip.test(n)) score = 0;
      else if (/ethernet|eth\d|本地連線|區域連線/i.test(n)) score = 4;
      else if (/wi-?fi|wlan|wireless|wi-fi/i.test(n)) score = 3;
      scored.push({
        score,
        iface: n,
        ip4: info.address,
        mac: info.mac || ""
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.find((item) => item.score > 0) || scored[0] || null;
}

function pingMs(host = "1.1.1.1", port = 80, timeout = 1500) {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = net.connect({ host, port });
    const done = (ms) => {
      try { socket.destroy(); } catch { /* ignore */ }
      resolve(ms);
    };
    socket.setTimeout(timeout);
    socket.on("connect", () => done(Date.now() - started));
    socket.on("timeout", () => done(null));
    socket.on("error", () => done(null));
  });
}

function fetchExternalIp(localAddress) {
  return new Promise((resolve) => {
    const req = https.get({
      host: "myexternalip.com",
      path: "/json",
      port: 443,
      timeout: 2500,
      localAddress: localAddress || undefined
    }, (res) => {
      let raw = "";
      res.on("data", (c) => { raw += c; });
      res.on("end", () => {
        try {
          resolve(JSON.parse(raw).ip || null);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function getNetStatus() {
  const nic = pickInterface();
  if (!nic) {
    return {
      offline: true,
      iface: null,
      ip4: null,
      externalIp: null,
      ping: null,
      state: "OFFLINE"
    };
  }
  const [ping, externalIp] = await Promise.all([pingMs(), fetchExternalIp(nic.ip4)]);
  return {
    offline: false,
    iface: nic.iface,
    ip4: nic.ip4,
    mac: nic.mac,
    externalIp,
    ping,
    state: ping == null ? "LOCAL" : "ONLINE"
  };
}

function runPs(command, timeout = 4500) {
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
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

let lastTraffic = { t: 0, up: 0, down: 0, totalUp: 0, totalDown: 0 };
async function getTrafficSample() {
  const nic = pickInterface();
  const raw = await runPs(
    "Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface | Where-Object { $_.Name -notmatch 'Loopback|isatap|Teredo|Pseudo' } | Select-Object Name,BytesReceivedPersec,BytesSentPersec | ConvertTo-Json -Compress",
    3500
  );
  const rows = parseJson(raw);
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  const wanted = (nic?.iface || "").toLowerCase();
  let row = list.find((item) => String(item.Name || "").toLowerCase().includes(wanted.slice(0, 8))) || null;
  if (!row && list.length) {
    row = list.slice().sort((a, b) =>
      (Number(b.BytesReceivedPersec) + Number(b.BytesSentPersec)) -
      (Number(a.BytesReceivedPersec) + Number(a.BytesSentPersec))
    )[0];
  }
  const down = Number(row?.BytesReceivedPersec) || 0;
  const up = Number(row?.BytesSentPersec) || 0;
  lastTraffic.totalUp += up;
  lastTraffic.totalDown += down;
  lastTraffic = { t: Date.now(), up, down, totalUp: lastTraffic.totalUp, totalDown: lastTraffic.totalDown };
  return { upBps: up, downBps: down, totalUp: lastTraffic.totalUp, totalDown: lastTraffic.totalDown };
}

function cpuSnapshot() {
  return os.cpus().map((c) => {
    const t = c.times;
    return { model: c.model, speed: c.speed, idle: t.idle, total: t.user + t.nice + t.sys + t.idle + t.irq };
  });
}

let prevCpu = null;
function getCpuMetrics() {
  const snap = cpuSnapshot();
  const cores = snap.length;
  let percents = snap.map(() => 0);
  if (prevCpu && prevCpu.length === cores) {
    percents = snap.map((cur, i) => {
      const dt = cur.total - prevCpu[i].total;
      const di = cur.idle - prevCpu[i].idle;
      if (dt <= 0) return 0;
      return Math.max(0, Math.min(100, (1 - di / dt) * 100));
    });
  }
  prevCpu = snap;
  const avg = percents.reduce((a, b) => a + b, 0) / Math.max(1, cores);
  const speeds = snap.map((c) => c.speed / 1000);
  const fullName = String(snap[0]?.model || "CPU").trim();
  return {
    name: fullName.slice(0, 28),
    fullName,
    cores,
    percents,
    avg,
    speedMin: Math.min(...speeds),
    speedMax: Math.max(...speeds)
  };
}

function getMemMetrics() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    total,
    free,
    used,
    active: used,
    available: free
  };
}

function getSysMetrics() {
  const up = os.uptime();
  const h = Math.floor(up / 3600);
  const m = Math.floor((up % 3600) / 60);
  const s = Math.floor(up % 60);
  const now = new Date();
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  let type = os.platform();
  if (type === "win32") type = "win";
  if (type === "darwin") type = "macOS";
  return {
    year: now.getFullYear(),
    monthDay: `${months[now.getMonth()]} ${now.getDate()}`,
    uptime: `${h}:${m}:${s}`,
    type,
    power: "AC"
  };
}

let globeGridCache = null;
function loadGlobeGrid() {
  if (globeGridCache) return globeGridCache;
  const candidates = [
    path.join(__dirname, "../assets/misc/grid.json"),
    path.join(__dirname, "../../src/assets/misc/grid.json"),
    path.join(__dirname, "../../../src/assets/misc/grid.json"),
    path.join(__dirname, "../src/assets/misc/grid.json")
  ];
  const file = candidates.find((item) => fs.existsSync(item));
  if (!file) throw new Error("grid.json not found");
  globeGridCache = JSON.parse(fs.readFileSync(file, "utf8"));
  return globeGridCache;
}

const CHASSIS = {
  1: "OTHER", 3: "DESKTOP", 4: "LOW PROFILE", 6: "MINI TOWER", 7: "TOWER",
  8: "PORTABLE", 9: "LAPTOP", 10: "NOTEBOOK", 11: "HAND HELD", 13: "ALL IN ONE",
  14: "SUB NOTEBOOK", 30: "TABLET"
};

async function getHardwareInfo() {
  const raw = await runPs(
    "$cs = Get-CimInstance Win32_ComputerSystem; $ch = Get-CimInstance Win32_SystemEnclosure; @{ manufacturer = $cs.Manufacturer; model = $cs.Model; chassis = @($ch.ChassisTypes)[0] } | ConvertTo-Json -Compress",
    4000
  );
  const info = parseJson(raw) || {};
  const manufacturer = String(info.manufacturer || "UNKNOWN").trim();
  const model = String(info.model || os.hostname() || "UNKNOWN").trim();
  const chassis = CHASSIS[Number(info.chassis)] || (info.chassis ? String(info.chassis) : "DESKTOP");
  const trim = (str, ...filters) => str.split(/\s+/).filter((w) => w && !filters.includes(w)).slice(0, 2).join(" ");
  return {
    manufacturer: (trim(manufacturer) || "NONE").toUpperCase(),
    model: (trim(model, manufacturer) || "NONE").toUpperCase(),
    chassis: chassis.toUpperCase()
  };
}

async function getTopProcesses() {
  const raw = await runPs(
    "$all = Get-Process; $top = $all | Sort-Object WorkingSet64 -Descending | Select-Object -First 5; @{ tasks = $all.Count; list = @($top | ForEach-Object { @{ pid = $_.Id; name = $_.ProcessName; cpu = $_.CPU; mem = $_.WorkingSet64 } }) } | ConvertTo-Json -Compress -Depth 4",
    4500
  );
  const data = parseJson(raw) || {};
  const list = Array.isArray(data.list) ? data.list : data.list ? [data.list] : [];
  const total = os.totalmem();
  return {
    tasks: Number(data.tasks) || list.length,
    list: list.map((p) => ({
      pid: p.pid,
      name: String(p.name || "").slice(0, 18),
      cpu: Math.round((Number(p.cpu) || 0) * 10) / 10,
      mem: Math.round(((Number(p.mem) || 0) / Math.max(1, total)) * 1000) / 10
    }))
  };
}

module.exports = {
  getNetStatus,
  getTrafficSample,
  pickInterface,
  getCpuMetrics,
  getMemMetrics,
  getSysMetrics,
  loadGlobeGrid,
  getHardwareInfo,
  getTopProcesses
};
