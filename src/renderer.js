const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const FILE_FORMAT_FILTERS = [
  { id: "documents", label: "文件" },
  { id: "images", label: "圖片" },
  { id: "videos", label: "影片" },
  { id: "audio", label: "音樂" },
  { id: "archives", label: "壓縮檔" },
  { id: "apps", label: "應用程式" },
  { id: "other", label: "其他" }
];

const DESK_FILTERS = [
  { id: "all", label: "全部" },
  { id: "folders", label: "文件夾" },
  { id: "icons", label: "圖標" },
  ...FILE_FORMAT_FILTERS
];

const RULES = [
  ["文件", "pdf doc xls ppt txt md"],
  ["圖片", "jpg png gif webp svg"],
  ["影片", "mp4 mkv avi mov"],
  ["音樂", "mp3 wav flac"],
  ["壓縮檔", "zip rar 7z"],
  ["捷徑", "lnk url"],
  ["應用程式", "exe msi"],
  ["其他", "未分類檔案"]
];

const DEFAULT_WIDGETS_PRIMARY = {
  clock: { x: 1.2, y: 2, w: 16, h: 8 },
  sysinfo: { x: 1.2, y: 13, w: 16, h: 8 },
  hw: { x: 1.2, y: 22, w: 16, h: 8 },
  cpu: { x: 1.2, y: 31, w: 16, h: 20 },
  ram: { x: 1.2, y: 52, w: 16, h: 16 },
  toplist: { x: 1.2, y: 69, w: 16, h: 18 },
  netstat: { x: 82, y: 2, w: 16.5, h: 12 },
  globe: { x: 82, y: 15, w: 16.5, h: 48 },
  conninfo: { x: 82, y: 64, w: 16.5, h: 23 },
  calendar: { x: 66, y: 2, w: 15, h: 38 },
  shortcuts: { x: 66, y: 42, w: 15, h: 28 },
  drives: { x: 66, y: 72, w: 15, h: 25 },
  filesearch: { x: 18, y: 82, w: 47, h: 16 }
};

// Plugins only default on primary — secondary starts empty.
const DEFAULT_WIDGETS_SECONDARY = {};

const DEFAULT_DESKTOP_PRIMARY = { x: 18, y: 2, w: 47, h: 78 };
const DEFAULT_DESKTOP_SECONDARY = { x: 8, y: 8, w: 84, h: 84 };

const PANEL_META = {
  clock: { title: "時鐘", box: { x: 1.2, y: 2, w: 16, h: 8 } },
  coderain: { title: "瀑布代碼", box: { x: 34, y: 64, w: 16, h: 22 } },
  sysinfo: { title: "系統", box: { x: 1.2, y: 13, w: 16, h: 8 } },
  hw: { title: "硬體", box: { x: 1.2, y: 22, w: 16, h: 8 } },
  cpu: { title: "處理器", box: { x: 1.2, y: 31, w: 16, h: 20 } },
  ram: { title: "記憶體", box: { x: 1.2, y: 52, w: 16, h: 16 } },
  toplist: { title: "進程", box: { x: 1.2, y: 69, w: 16, h: 18 } },
  netstat: { title: "網路狀態", box: { x: 82, y: 2, w: 16.5, h: 12 } },
  globe: { title: "地球視圖", box: { x: 82, y: 15, w: 16.5, h: 48 } },
  conninfo: { title: "網路流量", box: { x: 82, y: 64, w: 16.5, h: 23 } },
  calendar: { title: "日曆", box: { x: 66, y: 2, w: 15, h: 38 } },
  shortcuts: { title: "桌面捷徑", box: { x: 66, y: 42, w: 15, h: 28 } },
  drives: { title: "本機磁碟", box: { x: 66, y: 72, w: 15, h: 25 } },
  filesearch: { title: "快速搜尋", box: { x: 18, y: 82, w: 47, h: 16 } },
  cats: { title: "分類負載", box: { x: 1.2, y: 26, w: 16, h: 20 } },
  fill: { title: "空間", box: { x: 1.2, y: 47, w: 16, h: 12 } },
  rules: { title: "分類規則", box: { x: 82, y: 18, w: 16.5, h: 24 } },
  log: { title: "操作紀錄", box: { x: 1.2, y: 77, w: 16, h: 10 } }
};

const MACOS_TAGS = [
  { id: "red", label: "紅色", color: "#ff3b30" },
  { id: "orange", label: "橙色", color: "#ff9500" },
  { id: "yellow", label: "黃色", color: "#ffcc00" },
  { id: "green", label: "綠色", color: "#28cd41" },
  { id: "blue", label: "藍色", color: "#007aff" },
  { id: "purple", label: "紫色", color: "#af52de" },
  { id: "gray", label: "灰色", color: "#8e8e93" }
];

const fileStageCtx = new WeakMap();

const state = {
  bootstrap: null,
  settings: {},
  displays: [],
  displayId: null,
  displayIndex: 0,
  primary: true,
  bounds: null,
  scaleFactor: 1,
  physicalSize: null,
  themes: [],
  wallpapers: [],
  themeName: "tron",
  theme: null,
  scan: null,
  plan: null,
  includeFolders: false,
  iconView: "grid",
  busy: false,
  pathCards: [],
  activePathId: null,
  layout: { ...DEFAULT_WIDGETS_PRIMARY },
  desktopStage: { ...DEFAULT_DESKTOP_PRIMARY },
  desktopEnabled: true,
  desktopLocked: false,
  desktopFilter: "all",
  desktopGrouped: false,
  iconPositions: {},
  zTop: 10,
  clockTimer: null,
  calCursor: new Date(),
  calSelected: null,
  calNotes: {},
  desktopListing: null
};

function defaultWidgets() {
  return JSON.parse(JSON.stringify(state.primary ? DEFAULT_WIDGETS_PRIMARY : DEFAULT_WIDGETS_SECONDARY));
}

function defaultDesktop() {
  return { ...(state.primary ? DEFAULT_DESKTOP_PRIMARY : DEFAULT_DESKTOP_SECONDARY) };
}

function panelBody(id) {
  switch (id) {
    case "clock":
      return `
        <div id="mod_clock">
          <div id="mod_clock_led" class="led-matrix" aria-label="點陣時鐘"></div>
        </div>`;
    case "coderain":
      return `
        <div id="mod_coderain">
          <div id="mod_coderain_inner">
            <h1>CODE RAIN<i id="mod_coderain_meta">BOOT LOG / CMATRIX</i></h1>
            <section id="mod_coderain_stream">
              <canvas id="mod_coderain_canvas"></canvas>
            </section>
          </div>
        </div>`;
    case "sysinfo":
      return `
        <div id="mod_sysinfo">
          <div data-edex-sys>
            <h1 id="sys_year">—</h1>
            <h2 id="sys_month">—</h2>
          </div>
          <div data-edex-sys>
            <h1>UPTIME</h1>
            <h2 id="sys_uptime">0:0:0</h2>
          </div>
          <div data-edex-sys>
            <h1>TYPE</h1>
            <h2 id="sys_type">—</h2>
          </div>
          <div data-edex-sys>
            <h1>POWER</h1>
            <h2 id="sys_power">AC</h2>
          </div>
        </div>`;
    case "hw":
      return `
        <div id="mod_hardwareInspector">
          <div id="mod_hardwareInspector_inner">
            <div>
              <h1>MANUFACTURER</h1>
              <h2 id="mod_hardwareInspector_manufacturer">NONE</h2>
            </div>
            <div>
              <h1>MODEL</h1>
              <h2 id="mod_hardwareInspector_model">NONE</h2>
            </div>
            <div>
              <h1>CHASSIS</h1>
              <h2 id="mod_hardwareInspector_chassis">NONE</h2>
            </div>
          </div>
        </div>`;
    case "toplist":
      return `
        <div id="mod_toplist">
          <h1>TOP PROCESSES<i>PID | NAME | CPU | MEM</i></h1>
          <table id="mod_toplist_table"></table>
        </div>`;
    case "cats":
      return `<div id="category_bars"></div>`;
    case "fill":
      return `
        <div class="mod-fillmap">
          <h1>STORAGE MAP</h1>
          <div class="fill-label">桌面佔用 <span id="fill_label">0 B</span></div>
          <div id="fill_pointmap"></div>
        </div>`;
    case "ram":
      return `
        <div id="mod_ramwatcher">
          <div id="mod_ramwatcher_inner">
            <h1>MEMORY<i id="mod_ramwatcher_info"></i></h1>
            <div id="mod_ramwatcher_visual">
              <canvas id="mod_ramwatcher_gauge"></canvas>
              <div id="mod_ramwatcher_stack">
                <div class="ram-stack-track">
                  <i id="mod_ramwatcher_used_seg" class="ram-seg used"></i>
                  <i id="mod_ramwatcher_avail_seg" class="ram-seg avail"></i>
                  <i id="mod_ramwatcher_free_seg" class="ram-seg free"></i>
                </div>
                <div class="ram-stack-legend">
                  <span><em class="used"></em>USED <b id="mod_ramwatcher_used_pct">—</b></span>
                  <span><em class="avail"></em>AVAIL <b id="mod_ramwatcher_avail_pct">—</b></span>
                  <span><em class="free"></em>FREE <b id="mod_ramwatcher_free_pct">—</b></span>
                </div>
              </div>
            </div>
            <canvas id="mod_ramwatcher_wave"></canvas>
            <div id="mod_ramwatcher_swapcontainer">
              <h1>SWAP</h1>
              <progress id="mod_ramwatcher_swapbar" max="100" value="0"></progress>
              <h3 id="mod_ramwatcher_swaptext">0.0 GiB</h3>
            </div>
          </div>
        </div>`;
    case "cpu":
      return `
        <div id="mod_cpuinfo">
          <div id="mod_cpuinfo_innercontainer">
            <h1>CPU USAGE<i>—</i></h1>
            <div id="mod_cpuinfo_corebars" class="cpu-corebars"></div>
            <div class="cpu-chart-row">
              <h1># <em id="mod_cpuinfo_range0">1</em><br><i id="mod_cpuinfo_usagecounter0">Avg. --%</i></h1>
              <canvas id="mod_cpuinfo_canvas_0" height="60"></canvas>
            </div>
            <div class="cpu-chart-row">
              <h1># <em id="mod_cpuinfo_range1">N</em><br><i id="mod_cpuinfo_usagecounter1">Avg. --%</i></h1>
              <canvas id="mod_cpuinfo_canvas_1" height="60"></canvas>
            </div>
            <div class="cpu-meta-row">
              <div>
                <h1>CORES<br><i id="mod_cpuinfo_temp">—</i></h1>
              </div>
              <div>
                <h1>SPD<br><i id="mod_cpuinfo_speed_min">--GHz</i></h1>
              </div>
              <div>
                <h1>MAX<br><i id="mod_cpuinfo_speed_max">--GHz</i></h1>
              </div>
              <div>
                <h1>TASKS<br><i id="mod_cpuinfo_tasks">—</i></h1>
              </div>
            </div>
          </div>
        </div>`;
    case "netstat":
      return `
        <div id="mod_netstat">
          <div id="mod_netstat_inner">
            <h1>NETWORK STATUS<i id="mod_netstat_iname">Interface: —</i></h1>
            <div id="mod_netstat_innercontainer">
              <div><h1>STATE</h1><h2 id="mod_netstat_state">UNKNOWN</h2></div>
              <div><h1>IPv4</h1><h2 id="mod_netstat_ip">--.--.--.--</h2></div>
              <div><h1>PING</h1><h2 id="mod_netstat_ping">--ms</h2></div>
            </div>
          </div>
        </div>`;
    case "globe":
      return `
        <div id="mod_globe">
          <div id="mod_globe_innercontainer">
            <h1>WORLD VIEW<i>GLOBAL NETWORK MAP</i></h1>
            <h2>ENDPOINT LAT/LON<i class="mod_globe_headerInfo">0.0000, 0.0000</i></h2>
            <div id="mod_globe_canvas_placeholder"></div>
            <h3>OFFLINE</h3>
          </div>
        </div>`;
    case "conninfo":
      return `
        <div id="mod_conninfo">
          <div id="mod_conninfo_innercontainer">
            <h1>NETWORK TRAFFIC<i>UP / DOWN</i></h1>
            <h2>TOTAL<i>— / —</i></h2>
            <canvas id="mod_conninfo_canvas_top"></canvas>
            <canvas id="mod_conninfo_canvas_bottom"></canvas>
            <h3>OFFLINE</h3>
          </div>
        </div>`;
    case "rules":
      return `<div id="rules_list"></div>`;
    case "log":
      return `<div class="log" id="op_log">待命中。</div>`;
    case "calendar":
      return `
        <div class="cal-root">
          <div class="cal-toolbar">
            <button type="button" id="cal_prev">‹</button>
            <h1 id="cal_title">—</h1>
            <button type="button" id="cal_next">›</button>
          </div>
          <div class="cal-weekdays"><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span><span class="sun">日</span></div>
          <div id="cal_grid" class="cal-grid"></div>
        </div>`;
    case "shortcuts":
      return `<div id="shortcuts-stage" class="path-stage view-grid"></div>`;
    case "drives":
      return `<div id="drives-stage" class="drives-stage"></div>`;
    case "filesearch":
      return `
        <div class="fs-root">
          <div class="fs-toolbar">
            <input id="fs_query" type="search" spellcheck="false" placeholder="搜尋本機／局域網檔名…" />
            <button type="button" id="fs_go">搜尋</button>
          </div>
          <div class="fs-status" id="fs_status">輸入關鍵字開始搜尋</div>
          <div class="fs-results" id="fs_results"></div>
        </div>`;
    default:
      return "";
  }
}

function cardToolsHtml() {
  return `
    <span class="card-tools">
      <button type="button" class="card-tool more-btn" data-card-act="more" title="更多操作">⋯</button>
    </span>`;
}

function closeCardMenus() {
  document.querySelectorAll(".card-menu, .color-palette").forEach((m) => m.remove());
}

function openCardMenu(anchorBtn, items, pos) {
  closeCardMenus();
  const menu = document.createElement("div");
  menu.className = "card-menu";
  menu.innerHTML = items.map((item, i) => {
    if (item.sep) return `<div class="card-menu-sep"></div>`;
    if (item.kind === "tags") {
      const selected = new Set(item.tags || []);
      const dots = MACOS_TAGS.map((tag) => `
        <button type="button" class="macos-tag${selected.has(tag.id) ? " on" : ""}" data-tag="${tag.id}" title="${escapeHtml(tag.label)}" style="--tag:${tag.color}"></button>
      `).join("");
      return `<div class="macos-tags" data-tags-idx="${i}">
        <div class="macos-tags-label">標記</div>
        <div class="macos-tags-row">${dots}<button type="button" class="macos-tag none" data-tag="" title="無">×</button></div>
      </div>`;
    }
    return `<button type="button" data-menu-idx="${i}">${escapeHtml(item.label)}</button>`;
  }).join("");
  document.body.appendChild(menu);
  const mw = menu.offsetWidth;
  const mh = menu.offsetHeight;
  let left;
  let top;
  if (pos) {
    left = pos.x;
    top = pos.y;
  } else {
    const rect = anchorBtn.getBoundingClientRect();
    left = rect.right - mw;
    top = rect.bottom + 4;
  }
  if (left + mw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - mw - 8);
  if (left < 8) left = 8;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, (pos ? pos.y : top) - mh - 4);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  menu.querySelectorAll("[data-menu-idx]").forEach((btn) => {
    btn.onclick = (event) => {
      event.stopPropagation();
      const item = items[Number(btn.dataset.menuIdx)];
      closeCardMenus();
      item?.action?.();
    };
  });
  menu.querySelectorAll("[data-tags-idx]").forEach((box) => {
    const item = items[Number(box.dataset.tagsIdx)];
    let current = [...(item.tags || [])];
    box.addEventListener("pointerdown", (event) => event.stopPropagation());
    box.querySelectorAll("[data-tag]").forEach((btn) => {
      btn.onclick = async (event) => {
        event.stopPropagation();
        const id = btn.dataset.tag;
        if (!id) current = [];
        else if (current.includes(id)) current = current.filter((t) => t !== id);
        else current = [...current, id];
        box.querySelectorAll("[data-tag]").forEach((dot) => {
          if (!dot.dataset.tag) return;
          dot.classList.toggle("on", current.includes(dot.dataset.tag));
        });
        try {
          await item.onChange?.(current);
          item.tags = current;
        } catch (err) {
          toast(err.message || "無法更新標記");
        }
      };
    });
  });
  const dismiss = (event) => {
    if (!menu.contains(event.target) && event.target !== anchorBtn) {
      closeCardMenus();
      window.removeEventListener("pointerdown", dismiss, true);
    }
  };
  setTimeout(() => window.addEventListener("pointerdown", dismiss, true), 0);
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function setupDesktopClickThrough() {
  if (!window.edex?.setMouseIgnore) return;
  let ignoring = true;
  window.edex.setMouseIgnore(true);
  const hitTest = (target) => Boolean(
    target?.closest?.(".hud-card, .path-card, .desktop-card, .card-menu, .color-palette, #fab-bar, .modal_popup, .round-fab")
  );
  const sync = (event) => {
    const blocking = document.querySelector(".dragging, .card-menu, .modal_popup, .drop-target, .color-palette");
    const nextIgnore = !hitTest(event.target) && !blocking;
    if (nextIgnore === ignoring) return;
    ignoring = nextIgnore;
    window.edex.setMouseIgnore(nextIgnore);
  };
  document.addEventListener("pointermove", sync, true);
  document.addEventListener("pointerdown", sync, true);
  window.addEventListener("dragover", (event) => {
    if (![...event.dataTransfer.types].includes("Files")) return;
    if (hitTest(event.target)) {
      ignoring = false;
      window.edex.setMouseIgnore(false);
    }
  }, true);
}

function toast(message) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  el.style.left = "50%";
  el.style.top = "auto";
  el.style.bottom = "9vh";
  el.style.transform = "translateX(-50%)";
  setTimeout(() => el.remove(), 2400);
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function gridSize() {
  const cell = settingsGridSize();
  const fit = layoutFitScale();
  return Math.max(4, Math.round(cell * fit));
}

function settingsGridSize() {
  const raw = Number(state.settings?.gridSize);
  if (!Number.isFinite(raw)) return 32;
  return Math.max(12, Math.min(96, Math.round(raw)));
}

function clockScale() {
  const raw = Number(state.settings?.clockScale);
  if (!Number.isFinite(raw)) return 1;
  return Math.max(0.25, Math.min(2, Math.round(raw * 20) / 20));
}

function clockLedColor() {
  return toHex6(state.settings?.clockLedColor || "#ffffff");
}

function clockShowDate() {
  return state.settings?.clockShowDate !== false;
}

function wallpaperGridPx() {
  const raw = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--grid-size"));
  if (Number.isFinite(raw) && raw > 4) return raw;
  return gridSize();
}

function searchFontSize() {
  const raw = Number(state.settings?.searchFontSize);
  if (!Number.isFinite(raw)) return 12;
  return Math.max(8, Math.min(72, Math.round(raw)));
}

function rainFontSize() {
  const raw = Number(state.settings?.rainFontSize);
  if (!Number.isFinite(raw)) return 14;
  return Math.max(8, Math.min(72, Math.round(raw)));
}

function rainSpeed() {
  const raw = Number(state.settings?.rainSpeed);
  if (!Number.isFinite(raw)) return 1;
  return Math.max(0.1, Math.min(8, Math.round(raw * 10) / 10));
}

function applyClockMetrics() {
  const cell = Math.max(2, Math.round(gridSize() * clockScale()));
  document.documentElement.style.setProperty("--clock-scale", String(clockScale()));
  document.documentElement.style.setProperty("--clock-cell", `${cell}px`);
  document.documentElement.style.setProperty("--clock-led", clockLedColor());
  const host = document.getElementById("mod_clock_led");
  if (host) host.style.setProperty("--clock-led", clockLedColor());
}

function applyRainMetrics() {
  const font = rainFontSize();
  const speed = rainSpeed();
  document.documentElement.style.setProperty("--rain-font", `${font}px`);
  document.documentElement.style.setProperty("--rain-speed", String(speed));
  window.edexEffects?.setRainOptions?.({
    fontSize: font,
    speed
  });
  const meta = document.getElementById("mod_coderain_meta");
  if (meta) meta.textContent = `${font}PX · ${speed.toFixed(1)}×`;
}

/* 5×7 LED glyphs — lit cells map onto the wallpaper grid. */
const LED_GLYPHS = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "111", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  ":": ["0", "1", "0", "1", "0"],
  ".": ["0", "0", "0", "0", "1"],
  "/": ["001", "001", "010", "100", "100"],
  " ": ["0", "0", "0", "0", "0"]
};

const LED_ROWS = 5;

function snapGap() {
  return gridSize();
}

function alignGrid(value) {
  const g = gridSize();
  return Math.round(value / g) * g;
}

function gridCells(px) {
  return Math.max(0, Math.round(px / gridSize()));
}

function cellsPx(count) {
  return Math.max(0, Math.round(count)) * gridSize();
}

function alignGridSpan(size, minCells = 2) {
  const g = gridSize();
  const cells = Math.max(minCells, Math.round(Math.max(0, size) / g));
  return cells * g;
}

function snapExclusiveEdge(px) {
  return Math.round(px / gridSize()) * gridSize();
}

function gridLineOf(exclusiveEdge) {
  return snapExclusiveEdge(exclusiveEdge) - 1;
}

function pxFromBox(box) {
  const g = gridSize();
  if (Number.isFinite(Number(box?.gx)) && Number.isFinite(Number(box?.gw))) {
    return {
      x: cellsPx(box.gx),
      y: cellsPx(box.gy),
      w: cellsPx(Math.max(2, box.gw)),
      h: cellsPx(Math.max(2, box.gh))
    };
  }
  const x = alignGrid(pxFromVw(box?.x || 0));
  const y = alignGrid(pxFromVh(box?.y || 0));
  return {
    x,
    y,
    w: alignGridSpan(pxFromVw(box?.w || 16), 2),
    h: alignGridSpan(pxFromVh(box?.h || 10), 2)
  };
}

function boxToPx(box) {
  return pxFromBox(box);
}

function snapBoxVwVh(box) {
  const px = pxFromBox(box);
  return { ...box, ...pxToGridFields(px.x, px.y, px.w, px.h) };
}

function pxToGridFields(x, y, w, h) {
  const g = gridSize();
  const gx = gridCells(x);
  const gy = gridCells(y);
  const gw = Math.max(2, gridCells(w));
  const gh = Math.max(2, gridCells(h));
  return {
    gx,
    gy,
    gw,
    gh,
    x: vw(gx * g),
    y: vh(gy * g),
    w: vw(gw * g),
    h: vh(gh * g)
  };
}

function applyBoxPx(target, x, y, w, h) {
  Object.assign(target, pxToGridFields(x, y, w, h));
  return target;
}

function rectsTooClose(a, b) {
  const gap = gridSize();
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}

function otherCardRects(excludeEl) {
  return [...document.querySelectorAll(".hud-card, .path-card, .desktop-card")]
    .filter((el) => el && el !== excludeEl)
    .map((el) => ({
      x: alignGrid(el.offsetLeft),
      y: alignGrid(el.offsetTop),
      w: alignGridSpan(el.offsetWidth, 2),
      h: alignGridSpan(el.offsetHeight, 2)
    }));
}

function overlapsAny(rect, others) {
  return others.some((other) => rectsTooClose(rect, other));
}

function resolveMoveNoOverlap(el, x, y, w, h, fallback) {
  const g = gridSize();
  const ws = workspaceRect();
  const others = otherCardRects(el);
  x = alignGrid(x);
  y = alignGrid(y);
  w = alignGridSpan(w, 2);
  h = alignGridSpan(h, 2);
  const wanted = { x, y, w, h };
  if (!overlapsAny(wanted, others)) return { x, y, w, h };

  const candidates = [];
  if (fallback) candidates.push({ x: alignGrid(fallback.x), y: alignGrid(fallback.y) });
  others.forEach((o) => {
    candidates.push(
      { x: alignGrid(o.x + o.w + g), y: alignGrid(o.y) },
      { x: alignGrid(o.x - w - g), y: alignGrid(o.y) },
      { x: alignGrid(o.x), y: alignGrid(o.y + o.h + g) },
      { x: alignGrid(o.x), y: alignGrid(o.y - h - g) },
      { x: alignGrid(o.x + o.w + g), y },
      { x: alignGrid(o.x - w - g), y },
      { x, y: alignGrid(o.y + o.h + g) },
      { x, y: alignGrid(o.y - h - g) }
    );
  });

  let best = fallback ? { x: alignGrid(fallback.x), y: alignGrid(fallback.y), w, h } : wanted;
  let bestD = Infinity;
  candidates.forEach((c) => {
    if (c.x < 0 || c.y < 0 || c.x + w > ws.width + g || c.y + h > ws.height + g) return;
    const rect = { x: c.x, y: c.y, w, h };
    if (overlapsAny(rect, others)) return;
    const d = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = rect;
    }
  });
  if (overlapsAny(best, others) && fallback) {
    return { x: alignGrid(fallback.x), y: alignGrid(fallback.y), w, h };
  }
  return best;
}

function clampResizeNoOverlap(el, left, top, w, h, minW, minH) {
  const g = gridSize();
  w = alignGridSpan(w, gridCells(minW || g * 2));
  h = alignGridSpan(h, gridCells(minH || g * 2));
  const others = otherCardRects(el);
  others.forEach((o) => {
    const hitsX = left < o.x + o.w + g && left + w + g > o.x;
    const hitsY = top < o.y + o.h + g && top + h + g > o.y;
    if (!hitsX || !hitsY) return;
    if (left <= o.x && left + w + g > o.x) {
      w = alignGridSpan(Math.min(w, o.x - g - left), gridCells(minW || g * 2));
    }
    if (top <= o.y && top + h + g > o.y) {
      h = alignGridSpan(Math.min(h, o.y - g - top), gridCells(minH || g * 2));
    }
  });
  while (w > (minW || g * 2) && overlapsAny({ x: left, y: top, w, h }, others)) w -= g;
  while (h > (minH || g * 2) && overlapsAny({ x: left, y: top, w, h }, others)) h -= g;
  return {
    w: Math.max(minW || g * 2, w),
    h: Math.max(minH || g * 2, h)
  };
}

function snapAllLayoutToGrid() {
  Object.keys(state.layout).forEach((id) => {
    state.layout[id] = { ...state.layout[id], ...snapBoxVwVh(state.layout[id]) };
  });
  if (state.desktopStage) {
    state.desktopStage = { ...state.desktopStage, ...snapBoxVwVh(state.desktopStage) };
  }
  state.pathCards.forEach((card) => {
    Object.assign(card, snapBoxVwVh(card));
  });
  separateLayoutRects();
}

function separateLayoutRects() {
  const g = gridSize();
  const ws = workspaceRect();
  const entries = [];
  Object.keys(state.layout).forEach((id) => {
    if (!state.layout[id] || id === "status") return;
    entries.push({
      px: pxFromBox(state.layout[id]),
      apply: (px) => applyBoxPx(state.layout[id], px.x, px.y, px.w, px.h)
    });
  });
  if (state.desktopEnabled !== false && state.desktopStage) {
    entries.push({
      px: pxFromBox(state.desktopStage),
      apply: (px) => applyBoxPx(state.desktopStage, px.x, px.y, px.w, px.h)
    });
  }
  state.pathCards.forEach((card) => {
    entries.push({
      px: pxFromBox(card),
      apply: (px) => applyBoxPx(card, px.x, px.y, px.w, px.h)
    });
  });
  entries.forEach((entry, index) => {
    const others = entries.filter((_, i) => i !== index).map((item) => item.px);
    let { x, y, w, h } = entry.px;
    x = alignGrid(x);
    y = alignGrid(y);
    w = alignGridSpan(w, 2);
    h = alignGridSpan(h, 2);
    if (overlapsAny({ x, y, w, h }, others)) {
      let found = false;
      for (let dy = 0; dy < 48 && !found; dy += 1) {
        for (let dx = 0; dx < 48 && !found; dx += 1) {
          const cx = x + dx * g;
          const cy = y + dy * g;
          if (cx < 0 || cy < 0 || cx + w > ws.width || cy + h > ws.height) continue;
          if (!overlapsAny({ x: cx, y: cy, w, h }, others)) {
            x = cx;
            y = cy;
            found = true;
          }
        }
      }
    }
    entry.px = { x, y, w, h };
    entry.apply(entry.px);
  });
}

function workspaceRect() {
  const ws = document.getElementById("workspace");
  return {
    width: ws?.clientWidth || window.innerWidth,
    height: ws?.clientHeight || Math.floor(window.innerHeight * 0.86)
  };
}

function vw(px) {
  const den = layoutProfile().w * layoutFitScale();
  return den > 0 ? (px / den) * 100 : 0;
}

function vh(px) {
  const den = layoutProfile().h * layoutFitScale();
  return den > 0 ? (px / den) * 100 : 0;
}

function pxFromVw(v) {
  return (v / 100) * layoutProfile().w * layoutFitScale();
}

function pxFromVh(v) {
  return (v / 100) * layoutProfile().h * layoutFitScale();
}

const LAYOUT_PROFILES = {
  "2k": { id: "2k", label: "2K（2560×1440）", w: 2560, h: 1440 },
  "4k": { id: "4k", label: "4K（3840×2160）", w: 3840, h: 2160 }
};

function pageSize() {
  const phys = state.physicalSize;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  return {
    width: Math.max(cssW, phys?.width || 0),
    height: Math.max(cssH, phys?.height || 0)
  };
}

function defaultLayoutMode() {
  const primary = (state.displays || []).find((d) => d.primary) || state.displays?.[0];
  const width = Number(primary?.physicalSize?.width) || pageSize().width;
  const height = Number(primary?.physicalSize?.height) || pageSize().height;
  return (width >= 3200 || height >= 2000) ? "4k" : "2k";
}

function layoutMode() {
  const raw = state.settings?.layoutMode;
  if (raw === "4k" || raw === "2k") return raw;
  return defaultLayoutMode();
}

function layoutProfile() {
  return LAYOUT_PROFILES[layoutMode()];
}

function layoutFitScale() {
  const primary = (state.displays || []).find((d) => d.primary) || state.displays?.[0];
  const pw = Number(primary?.physicalSize?.width);
  const ph = Number(primary?.physicalSize?.height);
  const mine = state.physicalSize;
  const width = Number(mine?.width) || pageSize().width;
  const height = Number(mine?.height) || pageSize().height;
  if (!(pw > 4 && ph > 4 && width > 4 && height > 4)) return 1;
  const short = Math.min(width, height) / Math.min(pw, ph);
  const long = Math.max(width, height) / Math.max(pw, ph);
  const scale = Math.min(short, long);
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  return Math.min(1, scale);
}

function displayUiScale() {
  const raw = Number(state.settings?.uiScale);
  if (raw === 0.72 || !Number.isFinite(raw) || raw <= 0) return 1;
  return Math.max(0.4, Math.min(1.5, raw));
}

function applyUiMetrics() {
  const user = displayUiScale();
  const design = layoutProfile();
  const fit = layoutFitScale();
  document.documentElement.style.setProperty("--ui-scale", String(user * fit));
  document.documentElement.style.setProperty("--disp-h", `${design.h}px`);
  document.documentElement.style.setProperty("--disp-w", `${design.w}px`);
  document.documentElement.style.setProperty("--grid-size", `${gridSize()}px`);
  document.documentElement.style.setProperty("--snap-gap", `${gridSize()}px`);
  document.documentElement.style.setProperty("--search-font", `${searchFontSize()}px`);
  applyClockMetrics();
}

function applyTheme(theme, wallpaperId) {
  state.theme = theme;
  const c = theme.colors || {};
  document.documentElement.style.setProperty("--color_r", c.r ?? 170);
  document.documentElement.style.setProperty("--color_g", c.g ?? 207);
  document.documentElement.style.setProperty("--color_b", c.b ?? 209);
  document.documentElement.style.setProperty("--color_black", c.black || "#000000");
  document.documentElement.style.setProperty("--color_light_black", c.light_black || "#05080d");
  document.documentElement.style.setProperty("--color_grey", c.grey || "#262828");
  document.documentElement.style.setProperty("--color_red", c.red || "#ff3c3c");
  document.documentElement.style.setProperty("--color_yellow", c.yellow || "#ffd23c");
  document.documentElement.style.setProperty("--snap-gap", `${snapGap()}px`);
  applyUiMetrics();
  window.__edexTheme = theme;

  const wp = wallpaperId || state.settings.wallpaper || "grid";
  document.body.className = `desktop-shell wp-${wp}`;
}

function ledGlyph(ch) {
  return LED_GLYPHS[ch] || LED_GLYPHS[" "];
}

function pushLedCols(rows, count) {
  for (let i = 0; i < count; i += 1) rows.forEach((row) => row.push(0));
}

function buildLedLine(text) {
  const rows = Array.from({ length: LED_ROWS }, () => []);
  [...String(text || "")].forEach((ch, i) => {
    const glyph = ledGlyph(ch);
    const w = glyph[0].length;
    const prev = i ? text[i - 1] : "";
    if (ch === ":" || ch === ".") pushLedCols(rows, 2);
    else if (prev === ":" || prev === ".") pushLedCols(rows, 2);
    else if (i) pushLedCols(rows, 1);
    for (let r = 0; r < LED_ROWS; r += 1) {
      const bits = glyph[r] || "".padEnd(w, "0");
      for (let c = 0; c < w; c += 1) rows[r].push(bits[c] === "1" ? 1 : 0);
    }
  });
  return rows;
}

function buildLedMatrix(lines) {
  const blocks = (lines || []).filter(Boolean).map((line) => buildLedLine(line));
  if (!blocks.length) return [[]];
  const width = Math.max(...blocks.map((block) => block[0].length));
  const pad = (block) => block.map((row) => {
    const next = row.slice();
    while (next.length < width) next.push(0);
    return next;
  });
  const grid = [];
  blocks.forEach((block, i) => {
    if (i) grid.push(Array(width).fill(0));
    grid.push(...pad(block));
  });
  return grid;
}

function parseLedColor(color) {
  const s = String(color || "#ffffff").trim();
  const hex = s.replace(/^#/, "");
  if (/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return { r, g, b, css: `rgb(${r}, ${g}, ${b})` };
  }
  const fill = colorToFill(s) || "rgb(255,255,255)";
  const m = fill.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) {
    const r = Number(m[1]);
    const g = Number(m[2]);
    const b = Number(m[3]);
    return { r, g, b, css: `rgb(${r}, ${g}, ${b})` };
  }
  return { r: 255, g: 255, b: 255, css: "rgb(255, 255, 255)" };
}

function toHex6(color) {
  const parsed = parseLedColor(color);
  const h = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${h(parsed.r)}${h(parsed.g)}${h(parsed.b)}`;
}

function wallpaperGridCell() {
  return Math.max(1, Math.round(gridSize()));
}

function alignClockToWallpaperGrid() {
  const card = document.getElementById("card_clock");
  const host = document.getElementById("mod_clock_led");
  if (!card || !host || card.classList.contains("dragging")) return;
  const g = wallpaperGridCell();
  const scale = Number(state.scaleFactor) || 1;
  const originX = (Number(state.bounds?.x) || 0) * scale;
  const originY = (Number(state.bounds?.y) || 0) * scale;
  const rect = host.getBoundingClientRect();
  const worldX = originX + rect.left;
  const worldY = originY + rect.top;
  const dx = Math.round(worldX / g) * g - worldX;
  const dy = Math.round(worldY / g) * g - worldY;
  if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
    host.style.left = host.style.left || "0px";
    host.style.top = host.style.top || "0px";
    return;
  }
  const left = Number.parseFloat(host.style.left) || 0;
  const top = Number.parseFloat(host.style.top) || 0;
  host.style.left = `${Math.round(left + dx)}px`;
  host.style.top = `${Math.round(top + dy)}px`;
}

function renderClock() {
  const host = document.getElementById("mod_clock_led");
  if (!host) return;
  applyClockMetrics();
  const now = new Date();
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${Math.floor(now.getMilliseconds() / 100)}`;
  const date = `${now.getFullYear() % 100}/${now.getMonth() + 1}/${now.getDate()}`;
  const matrix = buildLedMatrix(clockShowDate() ? [time, date] : [time]);
  const rows = matrix.length;
  const cols = matrix[0]?.length || 0;
  if (!cols) return;

  const cell = Math.max(2, Math.round(wallpaperGridCell() * clockScale()));
  const led = clockLedColor();
  host.style.setProperty("--led-cell", `${cell}px`);
  host.style.setProperty("--clock-led", led);
  host.style.width = `${cols * cell}px`;
  host.style.height = `${rows * cell}px`;
  host.style.gridTemplateColumns = `repeat(${cols}, ${cell}px)`;
  host.style.gridTemplateRows = `repeat(${rows}, ${cell}px)`;

  const total = rows * cols;
  const layoutKey = `${cols}x${rows}`;
  if (host.dataset.ledLayout !== layoutKey || host.childElementCount !== total) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < total; i += 1) {
      frag.appendChild(document.createElement("span"));
    }
    host.replaceChildren(frag);
    host.dataset.ledLayout = layoutKey;
  }
  const nodes = host.children;
  let i = 0;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const on = Boolean(matrix[r][c]);
      nodes[i].className = on ? "on" : "";
      if (on) nodes[i].style.setProperty("background-color", led, "important");
      else nodes[i].style.removeProperty("background-color");
      i += 1;
    }
  }
  alignClockToWallpaperGrid();
}

function iconSvg(icon) {
  if (!icon) return "";
  if (icon.dataUrl) {
    return `<img class="sys-icon" src="${icon.dataUrl}" alt="" width="${icon.width || 32}" height="${icon.height || 32}" draggable="false" />`;
  }
  if (!icon.svg) return "";
  const color = "rgb(var(--color_r), var(--color_g), var(--color_b))";
  return `<svg viewBox="0 0 ${icon.width} ${icon.height}" fill="${color}">${icon.svg}</svg>`;
}

function itemLabel(item) {
  return item?.displayName || item?.name || "";
}

function currentDisplayLayout() {
  return {
    layout: state.layout,
    desktopStage: state.desktopStage,
    desktopEnabled: state.desktopEnabled !== false,
    desktopLocked: Boolean(state.desktopLocked),
    desktopFilter: state.desktopFilter || "all",
    desktopGrouped: Boolean(state.desktopGrouped),
    pathCards: state.pathCards.map((card) => ({
      id: card.id,
      path: card.path,
      x: card.x,
      y: card.y,
      w: card.w,
      h: card.h,
      gx: card.gx,
      gy: card.gy,
      gw: card.gw,
      gh: card.gh,
      locked: Boolean(card.locked),
      iconView: card.iconView === "list" ? "list" : "grid",
      bg: card.bg || ""
    })),
    desktopBg: state.desktopStage?.bg || "",
    iconPositions: state.iconPositions,
    iconView: state.iconView
  };
}

function persistLayout() {
  return window.edex.saveDisplayLayout(currentDisplayLayout());
}

function clearSnapGuides() {
  const box = document.getElementById("snap-guides");
  if (!box) return;
  box.classList.remove("on");
  box.innerHTML = "";
}

function showSnapGuides(guides) {
  const box = document.getElementById("snap-guides");
  if (!box) return;
  const g = gridSize();
  box.classList.add("on");
  box.style.backgroundSize = `${g}px ${g}px`;
  box.innerHTML = (guides || []).map((item) => {
    const pos = gridLineOf(item.line == null ? item.pos : item.line + 1);
    const cls = `snap-guide ${item.type}${item.ref ? " ref" : ""}${item.match ? " match" : ""}`;
    const label = item.label
      ? `<span class="snap-label">${escapeHtml(item.label)}</span>`
      : "";
    return item.type === "v"
      ? `<div class="${cls}" style="left:${pos}px">${label}</div>`
      : `<div class="${cls}" style="top:${pos}px">${label}</div>`;
  }).join("");
}

function collectSnapTargets(excludeEl) {
  const gap = snapGap();
  const ws = workspaceRect();
  const edgesX = [];
  const edgesY = [];
  document.querySelectorAll(".hud-card, .path-card, .desktop-card").forEach((el) => {
    if (el === excludeEl) return;
    const left = alignGrid(el.offsetLeft);
    const top = alignGrid(el.offsetTop);
    const right = left + alignGridSpan(el.offsetWidth, 2);
    const bottom = top + alignGridSpan(el.offsetHeight, 2);
    edgesX.push({ left, right });
    edgesY.push({ top, bottom });
  });
  return { edgesX, edgesY, gap, ws };
}

function referenceGuides(ws) {
  const midX = snapExclusiveEdge(ws.width / 2);
  const midY = snapExclusiveEdge(ws.height / 2);
  return [
    { type: "v", pos: midX, ref: true, label: "中" },
    { type: "h", pos: midY, ref: true, label: "中" }
  ];
}

function neighborDisplay(direction) {
  const mine = state.displays.find((d) => d.id === state.displayId);
  if (!mine) return null;
  const candidates = state.displays.filter((d) => d.id !== state.displayId);
  if (direction === "left") {
    return candidates
      .filter((d) => d.bounds.x + d.bounds.width <= mine.bounds.x + 48)
      .sort((a, b) => b.bounds.x - a.bounds.x)[0] || null;
  }
  if (direction === "right") {
    return candidates
      .filter((d) => d.bounds.x >= mine.bounds.x + mine.bounds.width - 48)
      .sort((a, b) => a.bounds.x - b.bounds.x)[0] || null;
  }
  if (direction === "up") {
    return candidates
      .filter((d) => d.bounds.y + d.bounds.height <= mine.bounds.y + 48)
      .sort((a, b) => b.bounds.y - a.bounds.y)[0] || null;
  }
  return candidates
    .filter((d) => d.bounds.y >= mine.bounds.y + mine.bounds.height - 48)
    .sort((a, b) => a.bounds.y - b.bounds.y)[0] || null;
}

async function maybeTransferCard(el, x, y, w, h, opts) {
  const g = gridSize();
  const ws = workspaceRect();
  let target = null;
  let placeX = g;
  let placeY = g;
  const outLeft = x <= -g || (opts.clientX != null && opts.clientX < 12);
  const outRight = x + w >= ws.width + g || (opts.clientX != null && opts.clientX > window.innerWidth - 12);
  const outUp = y <= -g || (opts.clientY != null && opts.clientY < 12);
  const outDown = y + h >= ws.height + g || (opts.clientY != null && opts.clientY > window.innerHeight - 12);
  if (outLeft) {
    target = neighborDisplay("left");
    placeX = Math.max(g, alignGrid(ws.width - w - g));
  } else if (outRight) {
    target = neighborDisplay("right");
    placeX = g;
  } else if (outUp) {
    target = neighborDisplay("up");
    placeY = Math.max(g, alignGrid(ws.height - h - g));
  } else if (outDown) {
    target = neighborDisplay("down");
    placeY = g;
  }
  if (!target || !opts.widgetType) return false;

  const placed = pxToGridFields(placeX, placeY, w, h);
  const widget = {
    type: opts.widgetType,
    id: opts.widgetId,
    data: opts.widgetData,
    ...placed
  };
  const result = await window.edex.transferWidget(target.id, widget);
  if (result?.ok) {
    opts.onTransferred?.();
    toast(`已移至 ${target.label}`);
    return true;
  }
  return false;
}

function magneticSnap(el, x, y, w, h, pointer) {
  const { edgesX, edgesY, gap, ws } = collectSnapTargets(el);
  const nearLeft = pointer && pointer.x < 40;
  const nearRight = pointer && pointer.x > window.innerWidth - 40;
  const nearTop = pointer && pointer.y < 40;
  const nearBottom = pointer && pointer.y > window.innerHeight - 40;
  w = alignGridSpan(w, 2);
  h = alignGridSpan(h, 2);
  let nextX = alignGrid(x);
  let nextY = alignGrid(y);
  const guides = [];
  const threshold = gap * 0.55;

  for (const edge of edgesX) {
    const dockRight = edge.right + gap;
    const dockLeft = edge.left - gap - w;
    if (Math.abs(nextX - dockRight) <= threshold) {
      nextX = dockRight;
      guides.push({ type: "v", pos: dockRight });
    } else if (Math.abs(nextX - dockLeft) <= threshold) {
      nextX = dockLeft;
      guides.push({ type: "v", pos: nextX + w });
    }
  }
  for (const edge of edgesY) {
    const dockBelow = edge.bottom + gap;
    const dockAbove = edge.top - gap - h;
    if (Math.abs(nextY - dockBelow) <= threshold) {
      nextY = dockBelow;
      guides.push({ type: "h", pos: dockBelow });
    } else if (Math.abs(nextY - dockAbove) <= threshold) {
      nextY = dockAbove;
      guides.push({ type: "h", pos: nextY + h });
    }
  }

  if (!(nearLeft || nearRight)) nextX = Math.max(0, Math.min(alignGrid(ws.width - w), nextX));
  if (!(nearTop || nearBottom)) nextY = Math.max(0, Math.min(alignGrid(ws.height - h), nextY));
  nextX = alignGrid(nextX);
  nextY = alignGrid(nextY);
  if (!(nearLeft || nearRight || nearTop || nearBottom)) {
    const resolved = resolveMoveNoOverlap(el, nextX, nextY, w, h, {
      x: el.offsetLeft,
      y: el.offsetTop
    });
    nextX = resolved.x;
    nextY = resolved.y;
  }
  guides.push(
    { type: "v", pos: nextX, match: true },
    { type: "v", pos: nextX + w, match: true },
    { type: "h", pos: nextY, match: true },
    { type: "h", pos: nextY + h, match: true }
  );
  return { x: nextX, y: nextY, guides: [...referenceGuides(ws), ...guides] };
}

function gridMinSize(px) {
  const g = gridSize();
  return Math.max(g * 2, alignGridSpan(px, 2));
}

function magneticResize(el, w, h, left, top, minWPx, minHPx) {
  const { edgesX, edgesY, gap, ws } = collectSnapTargets(el);
  const g = gridSize();
  const threshold = g * 0.55;
  const minW = gridMinSize(minWPx || g * 2);
  const minH = gridMinSize(minHPx || g * 2);
  let right = left + w;
  let bottom = top + h;
  const guides = [...referenceGuides(ws)];

  for (const edge of edgesX) {
    const dockToLeft = edge.left - gap;
    if (Math.abs(right - dockToLeft) <= threshold) {
      right = dockToLeft;
      guides.push({ type: "v", pos: dockToLeft, match: true });
    }
  }
  for (const edge of edgesY) {
    const dockAbove = edge.top - gap;
    if (Math.abs(bottom - dockAbove) <= threshold) {
      bottom = dockAbove;
      guides.push({ type: "h", pos: dockAbove, match: true });
    }
  }

  right = snapExclusiveEdge(right);
  bottom = snapExclusiveEdge(bottom);
  let nextW = Math.max(minW, right - left);
  let nextH = Math.max(minH, bottom - top);
  nextW = alignGridSpan(nextW, gridCells(minW));
  nextH = alignGridSpan(nextH, gridCells(minH));
  const maxW = alignGridSpan(Math.max(minW, snapExclusiveEdge(ws.width) - left), gridCells(minW));
  const maxH = alignGridSpan(Math.max(minH, snapExclusiveEdge(ws.height) - top), gridCells(minH));
  nextW = Math.min(maxW, nextW);
  nextH = Math.min(maxH, nextH);
  const clamped = clampResizeNoOverlap(el, left, top, nextW, nextH, minW, minH);
  nextW = clamped.w;
  nextH = clamped.h;
  guides.push({ type: "v", pos: left + nextW, match: true });
  guides.push({ type: "h", pos: top + nextH, match: true });
  return { w: nextW, h: nextH, guides };
}

function isCardLocked(el) {
  return el?.classList.contains("locked");
}

function makeInteractive(el, opts) {
  const handle = el.classList.contains("clock-bare") ? el : (el.querySelector(".card-title") || el);
  const resize = el.querySelector(".resize-handle");

  handle.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, .resize-handle, .view-toggle, .card-tools, .card-tool")) return;
    if (isCardLocked(el)) return;
    event.preventDefault();
    el.classList.add("dragging");
    el.style.zIndex = String(++state.zTop);
    const startX = event.clientX;
    const startY = event.clientY;
    const origX = alignGrid(el.offsetLeft);
    const origY = alignGrid(el.offsetTop);
    const w = alignGridSpan(el.offsetWidth, 2);
    const h = alignGridSpan(el.offsetHeight, 2);
    document.body.classList.add("is-card-dragging");
    el.style.left = `${origX}px`;
    el.style.top = `${origY}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    let lastRawX = 0;
    let lastClientX = startX;
    let lastClientY = startY;
    let lastX = origX;
    let lastY = origY;

    const move = (ev) => {
      let x = origX + (ev.clientX - startX);
      let y = origY + (ev.clientY - startY);
      lastRawX = ev.clientX - startX;
      lastClientX = ev.clientX;
      lastClientY = ev.clientY;
      const snapped = magneticSnap(el, x, y, w, h, { x: ev.clientX, y: ev.clientY });
      lastX = snapped.x;
      lastY = snapped.y;
      el.style.left = `${snapped.x}px`;
      el.style.top = `${snapped.y}px`;
      showSnapGuides(snapped.guides);
      opts.onMove?.(snapped.x, snapped.y, w, h);
    };
    const up = async () => {
      el.classList.remove("dragging");
      document.body.classList.remove("is-card-dragging");
      clearSnapGuides();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const x = lastX;
      const y = lastY;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      const transferred = await maybeTransferCard(el, x, y, w, h, {
        rawX: lastRawX,
        clientX: lastClientX,
        clientY: lastClientY,
        widgetType: opts.widgetType,
        widgetId: opts.widgetId,
        widgetData: opts.widgetData?.(),
        onTransferred: opts.onTransferred
      });
      if (!transferred) {
        opts.onEnd?.();
        persistLayout();
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });

  if (resize && opts.resizable !== false) {
    resize.addEventListener("pointerdown", (event) => {
      if (isCardLocked(el)) return;
      event.preventDefault();
      event.stopPropagation();
      window.edex?.setMouseIgnore?.(false);
      el.style.zIndex = String(++state.zTop);
      el.classList.add("dragging");
      document.body.classList.add("is-card-dragging");
      const startX = event.clientX;
      const startY = event.clientY;
      const g = gridSize();
      const left = alignGrid(el.offsetLeft);
      const top = alignGrid(el.offsetTop);
      const minW = gridMinSize(opts.minW || g * 4);
      const minH = gridMinSize(opts.minH || g * 3);
      const origW = alignGridSpan(el.offsetWidth, gridCells(minW));
      const origH = alignGridSpan(el.offsetHeight, gridCells(minH));
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.width = `${origW}px`;
      el.style.height = `${origH}px`;
      let lastW = origW;
      let lastH = origH;

      const move = (ev) => {
        const right = snapExclusiveEdge(left + origW + (ev.clientX - startX));
        const bottom = snapExclusiveEdge(top + origH + (ev.clientY - startY));
        const snapped = magneticResize(el, right - left, bottom - top, left, top, minW, minH);
        lastW = snapped.w;
        lastH = snapped.h;
        el.style.width = `${snapped.w}px`;
        el.style.height = `${snapped.h}px`;
        showSnapGuides(snapped.guides);
        opts.onMove?.(left, top, snapped.w, snapped.h);
      };
      const up = () => {
        el.classList.remove("dragging");
        document.body.classList.remove("is-card-dragging");
        clearSnapGuides();
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        const finalW = snapExclusiveEdge(left + lastW) - left;
        const finalH = snapExclusiveEdge(top + lastH) - top;
        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.width = `${Math.max(minW, finalW)}px`;
        el.style.height = `${Math.max(minH, finalH)}px`;
        opts.onMove?.(left, top, Math.max(minW, finalW), Math.max(minH, finalH));
        opts.onEnd?.();
        persistLayout();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }
}

async function boot() {
  document.getElementById("boot_screen")?.remove();
  applyTheme(state.theme || state.bootstrap?.theme, state.settings.wallpaper || "grid");
}

function styleFromBox(box) {
  const px = boxToPx(box);
  return `left:${px.x}px;top:${px.y}px;width:${px.w}px;height:${px.h}px;box-sizing:border-box`;
}

function panelHtml(id) {
  if (!state.layout[id] || !PANEL_META[id] || id === "status") return "";
  const locked = Boolean(state.layout[id].locked);
  const extra = id === "clock" ? " clock-bare" : "";
  return `
    <section class="hud-card${extra}${locked ? " locked" : ""}" id="card_${id}" data-panel-id="${id}" style="${styleFromBox(state.layout[id])}">
      <h3 class="card-title">
        <span class="card-title-text">${PANEL_META[id].title}</span>
        ${cardToolsHtml()}
      </h3>
      <div class="card-body">${panelBody(id)}</div>
      <div class="resize-handle"></div>
    </section>`;
}

function setCardLocked(el, locked) {
  el.classList.toggle("locked", locked);
  toast(locked ? "已鎖定容器" : "已解鎖容器");
}

async function setClockScale(value) {
  const next = Math.max(0.25, Math.min(2, Math.round(Number(value) * 20) / 20));
  if (!Number.isFinite(next)) {
    toast("請輸入 0.25–2.0 之間的數字");
    return;
  }
  state.settings = { ...state.settings, clockScale: next };
  applyClockMetrics();
  renderClock();
  try {
    const result = await window.edex.saveSettings({ clockScale: next });
    if (result?.settings) state.settings = { ...result.settings, clockScale: next };
  } catch {
    // Keep local value if save fails.
  }
  toast(`時鐘字格 ${next.toFixed(2)}×`);
}

async function setClockShowDate(show) {
  const next = Boolean(show);
  state.settings = { ...state.settings, clockShowDate: next };
  const host = document.getElementById("mod_clock_led");
  if (host) host.dataset.ledLayout = "";
  renderClock();
  try {
    const result = await window.edex.saveSettings({ clockShowDate: next });
    if (result?.settings) state.settings = { ...result.settings, clockShowDate: next };
  } catch {
    // keep local
  }
  toast(next ? "已顯示日期" : "已隱藏日期");
}

async function setClockLedColor(color) {
  const next = toHex6(color);
  state.settings = { ...state.settings, clockLedColor: next };
  applyClockMetrics();
  renderClock();
  try {
    const result = await window.edex.saveSettings({ clockLedColor: next });
    if (result?.settings) state.settings = { ...result.settings, clockLedColor: next };
  } catch {
    // Keep local value if save fails.
  }
  toast(`高亮已改為 ${next}`);
}

function pickClockLedColor(ctx) {
  closeCardMenus();
  window.edex?.setMouseIgnore?.(false);
  const palette = document.createElement("div");
  palette.className = "color-palette";
  const swatches = [
    { label: "白", color: "#ffffff" },
    { label: "主題色", color: rgbToHex(state.theme?.colors?.r, state.theme?.colors?.g, state.theme?.colors?.b) },
    ...themeColorSwatches().filter((s) => s.label !== "深底" && s.label !== "黑"),
    { label: "青", color: "#2ee6c7" },
    { label: "琥珀", color: "#ffb347" }
  ];
  const seen = new Set();
  const list = swatches.filter((item) => {
    const key = toHex6(item.color);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const current = clockLedColor();
  palette.innerHTML = `
    <div class="color-palette-title">時鐘高亮</div>
    <label class="color-palette-custom">自訂
      <input type="color" id="clock_led_picker" value="${escapeHtml(current)}">
    </label>
    <div class="color-palette-grid">
      ${list.map((item, i) => {
        const fill = toHex6(item.color);
        return `<button type="button" class="color-swatch" data-idx="${i}" title="${escapeHtml(item.label)}" style="background:${escapeHtml(fill)}"></button>`;
      }).join("")}
    </div>
  `;
  document.body.appendChild(palette);
  const rect = ctx.el?.getBoundingClientRect?.() || { right: 80, top: 80 };
  const pw = palette.offsetWidth;
  const ph = palette.offsetHeight;
  let left = rect.left;
  let top = rect.top + 36;
  if (left < 8) left = 8;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  if (top + ph > window.innerHeight - 8) top = Math.max(8, rect.top - ph - 8);
  palette.style.left = `${left}px`;
  palette.style.top = `${top}px`;

  const apply = (color) => {
    if (!color) return;
    setClockLedColor(color);
  };

  palette.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    window.edex?.setMouseIgnore?.(false);
  }, true);
  palette.querySelectorAll("[data-idx]").forEach((btn) => {
    const choose = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const item = list[Number(btn.dataset.idx)];
      if (item?.color) apply(item.color);
      closeCardMenus();
    };
    btn.addEventListener("click", choose);
  });
  const picker = palette.querySelector("#clock_led_picker");
  picker?.addEventListener("input", () => apply(picker.value));
  picker?.addEventListener("change", () => {
    apply(picker.value);
    closeCardMenus();
  });
  const dismiss = (event) => {
    if (palette.contains(event.target)) return;
    closeCardMenus();
    window.removeEventListener("pointerdown", dismiss, true);
  };
  setTimeout(() => window.addEventListener("pointerdown", dismiss, true), 0);
}

function fabBarHtml() {
  const addBtn = `<button type="button" class="round-fab" id="add-fab" title="添加容器">+</button>`;
  if (!state.primary) return addBtn;
  return `
    ${addBtn}
    <button type="button" class="round-fab" id="settings-fab" title="設定">⚙</button>
    <button type="button" class="round-fab danger" id="quit-fab" title="退出程式">⏻</button>
  `;
}

function menuItemsForCard(kind, ctx) {
  const locked = Boolean(ctx.locked);
  const items = [
    {
      label: locked ? "解鎖" : "鎖定",
      action: () => ctx.onLock?.()
    },
    {
      label: "背景顏色",
      action: () => pickCardBackground(ctx)
    },
    {
      label: "添加容器",
      action: () => openAddPicker()
    }
  ];
  const others = (state.displays || []).filter((d) => d.id !== state.displayId);
  if (others.length && ctx.widgetType) {
    items.push({ sep: true });
    others.forEach((d) => {
      items.push({
        label: `移至 ${d.label || `顯示器 ${d.id}`}`,
        action: async () => {
          const el = ctx.el;
          if (!el) return;
          if (isCardLocked(el)) {
            toast("請先解鎖再移動");
            return;
          }
          const box = pxToGridFields(el.offsetLeft, el.offsetTop, el.offsetWidth, el.offsetHeight);
          const result = await window.edex.transferWidget(d.id, {
            type: ctx.widgetType,
            id: ctx.widgetId,
            data: ctx.widgetData?.(),
            ...box
          });
          if (result?.ok) {
            ctx.onTransferred?.();
            toast(`已移至 ${d.label}`);
          } else {
            toast(result?.message || "無法移至該顯示器");
          }
        }
      });
    });
  }
  if (kind === "panel" && ctx.widgetId === "clock") {
    const accent = rgbToHex(state.theme?.colors?.r, state.theme?.colors?.g, state.theme?.colors?.b);
    items.push(
      { sep: true },
      {
        label: clockShowDate() ? "隱藏日期" : "顯示日期",
        action: () => setClockShowDate(!clockShowDate())
      },
      { label: "高亮：白", action: () => setClockLedColor("#ffffff") },
      { label: "高亮：主題色", action: () => setClockLedColor(accent) },
      { label: "高亮：紅", action: () => setClockLedColor("#ff3c3c") },
      { label: "高亮：黃", action: () => setClockLedColor("#ffd23c") },
      { label: "高亮：青", action: () => setClockLedColor("#2ee6c7") },
      {
        label: `自訂高亮（${clockLedColor()}）`,
        action: () => {
          const next = window.prompt("時鐘高亮色碼（#RRGGBB）", clockLedColor());
          if (next == null) return;
          setClockLedColor(next);
        }
      },
      {
        label: "時鐘較小",
        action: () => setClockScale(clockScale() - 0.05)
      },
      {
        label: "時鐘較大",
        action: () => setClockScale(clockScale() + 0.05)
      },
      {
        label: `字格 ${clockScale().toFixed(2)}×（可縮小）`,
        action: () => {
          const next = window.prompt("時鐘字格倍率（0.25–2.0，1.0 = 一格壁紙網格）", String(clockScale()));
          if (next == null) return;
          setClockScale(Number(next));
        }
      }
    );
  }
  if (kind === "panel" && ctx.widgetId === "shortcuts") {
    const view = state.layout.shortcuts?.iconView === "list" ? "list" : "grid";
    items.push(
      { sep: true },
      {
        label: view === "list" ? "切換為網格" : "切換為列表",
        action: () => toggleIconView("shortcuts")
      },
      {
        label: "重新整理",
        action: () => fillShortcutsStage()
      }
    );
  }
  if (kind === "panel" && ctx.widgetId === "drives") {
    items.push(
      { sep: true },
      {
        label: "重新整理",
        action: () => fillDrivesStage()
      }
    );
  }
  if (kind === "panel" && ctx.widgetId === "filesearch") {
    items.push(
      { sep: true },
      { label: "新增資料夾／網路磁碟", action: () => addSearchFolder() },
      { label: "新增局域網路徑", action: () => openLanPathPrompt() },
      { label: "管理搜尋路徑", action: () => openSearchRootsEditor() },
      { label: "重建索引", action: () => rebuildFileSearch() }
    );
  }
  if (kind === "desktop") {
    items.push(
      { sep: true },
      {
        label: state.iconView === "list" ? "切換為網格" : "切換為列表",
        action: () => toggleIconView("desktop")
      },
      {
        label: "重新掃描",
        action: () => doScan()
      },
      {
        label: "預覽整理",
        action: async () => {
          try {
            const scan = await window.edex.scan(state.bootstrap.desktop);
            state.scan = scan;
            await refreshPlan();
            const migrate = Boolean(state.settings?.migrateFiles);
            toast(migrate
              ? `預覽遷移 ${state.plan?.count || 0} 筆`
              : `預覽篩選 ${desktopItems().length} 項（按格式大類，不移動檔案）`);
          } catch (err) {
            toast(err.message || "無法預覽");
          }
        }
      },
      {
        label: "執行整理",
        action: () => runOrganize()
      },
      {
        label: "還原上次",
        action: async () => {
          const result = await window.edex.undo();
          toast(result.message);
          await doScan();
        }
      }
    );
  }
  if (kind === "path") {
    const view = ctx.iconView === "list" ? "list" : "grid";
    items.push(
      { sep: true },
      {
        label: view === "list" ? "切換為網格" : "切換為列表",
        action: () => toggleIconView("path", ctx.id)
      },
      { label: "啟用此路徑", action: () => setActivePath(ctx.id) },
      { label: "開啟資料夾", action: () => window.edex.openPath(ctx.path) },
      { label: "更換路徑", action: () => changePath(ctx.id) },
      { label: "重新掃描", action: () => scanCard(state.pathCards.find((c) => c.id === ctx.id)) }
    );
  }
  items.push(
    { sep: true },
    {
      label: "關閉容器",
      action: () => {
        if (locked) {
          toast("請先解鎖再關閉");
          return;
        }
        ctx.onClose?.();
      }
    }
  );
  return items;
}

function bindCardTools(el, getItems) {
  el.querySelectorAll('[data-card-act="more"]').forEach((btn) => {
    btn.addEventListener("pointerdown", (event) => event.stopPropagation());
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openCardMenu(btn, getItems());
    });
  });
  el.addEventListener("contextmenu", (event) => {
    if (event.target.closest(".path-stage, #desktop-stage, #shortcuts-stage, .desk-icon, .fs-row, .drives-stage, .drive-row")) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  });
}

function applyCardBg(el, color) {
  if (!el) return;
  const value = colorToFill(color);
  el.classList.toggle("has-custom-bg", Boolean(value));
  if (!value) {
    el.style.removeProperty("--card-bg");
    el.style.removeProperty("background");
    el.style.removeProperty("background-color");
    el.querySelectorAll(".card-title, .card-body, .path-stage, #desktop-stage").forEach((node) => {
      node.style.removeProperty("background");
      node.style.removeProperty("background-color");
    });
    return;
  }
  el.style.setProperty("--card-bg", value);
  el.style.background = value;
  el.style.backgroundColor = value;
  el.querySelectorAll(":scope > .card-title, :scope > .card-body").forEach((node) => {
    node.style.background = value;
    node.style.backgroundColor = value;
  });
}

function colorToFill(color) {
  if (color == null || color === false) return "";
  const s = String(color).trim();
  if (!s || s === "transparent" || s === "none") return "";
  const rgba = s.match(/^rgba\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/i);
  if (rgba) {
    return `rgba(${Math.round(Number(rgba[1]))}, ${Math.round(Number(rgba[2]))}, ${Math.round(Number(rgba[3]))}, ${Number(rgba[4])})`;
  }
  const rgb = s.match(/^rgb\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*\)/i);
  if (rgb) {
    return `rgb(${Math.round(Number(rgb[1]))}, ${Math.round(Number(rgb[2]))}, ${Math.round(Number(rgb[3]))})`;
  }
  const hex = s.replace("#", "");
  if (hex.length === 3) {
    const r = hex[0] + hex[0];
    const g = hex[1] + hex[1];
    const b = hex[2] + hex[2];
    return `#${r}${g}${b}`;
  }
  if (hex.length === 6 || hex.length === 8) return `#${hex.slice(0, 6)}`;
  const parsed = parseLedColor(s);
  if (parsed) return rgbToHex(parsed.r, parsed.g, parsed.b);
  return s;
}

function rgbToHex(r, g, b) {
  const h = (n) => Math.max(0, Math.min(255, Number(n) || 0)).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function themeColorSwatches() {
  const colors = state.theme?.colors || {};
  const term = state.theme?.terminal || {};
  const globe = state.theme?.globe || {};
  const accent = rgbToHex(colors.r, colors.g, colors.b);
  const list = [
    { label: "主題色", color: accent },
    { label: "主題色 55%", color: `rgba(${Number(colors.r) || 170}, ${Number(colors.g) || 207}, ${Number(colors.b) || 209}, 0.55)` },
    { label: "深底", color: colors.light_black || "#05080d" },
    { label: "黑", color: colors.black || "#000000" },
    { label: "灰", color: colors.grey || "#262828" },
    { label: "終端前景", color: term.foreground },
    { label: "終端背景", color: term.background },
    { label: "地球", color: globe.base },
    { label: "標記", color: globe.marker },
    { label: "紅", color: "#ff3c3c" },
    { label: "黃", color: "#ffd23c" }
  ].filter((item) => item.color);
  const seen = new Set();
  return list.filter((item) => {
    const key = String(item.color).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pickCardBackground(ctx) {
  closeCardMenus();
  window.edex?.setMouseIgnore?.(false);
  const palette = document.createElement("div");
  palette.className = "color-palette";
  const swatches = [...themeColorSwatches(), { label: "預設", color: "" }];
  const current = colorToFill(ctx.getBg?.()) || "#05080d";
  const pickerValue = current.startsWith("#") ? current : (toHex6(current) || "#05080d");
  palette.innerHTML = `
    <div class="color-palette-title">容器背景</div>
    <label class="color-palette-custom">自訂
      <input type="color" id="card_bg_picker" value="${escapeHtml(pickerValue)}">
    </label>
    <div class="color-palette-grid">
      ${swatches.map((item, i) => {
        const fill = item.color ? colorToFill(item.color) : "transparent";
        const extra = item.color ? "" : " none";
        return `<button type="button" class="color-swatch${extra}" data-idx="${i}" title="${escapeHtml(item.label)}" style="background:${escapeHtml(fill)}">${item.color ? "" : "×"}</button>`;
      }).join("")}
    </div>
  `;
  document.body.appendChild(palette);
  const rect = ctx.el?.getBoundingClientRect?.() || { right: 80, top: 80 };
  const pw = palette.offsetWidth;
  const ph = palette.offsetHeight;
  let left = rect.right - pw;
  let top = rect.top + 36;
  if (left < 8) left = 8;
  if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
  if (top + ph > window.innerHeight - 8) top = Math.max(8, rect.top - ph - 8);
  palette.style.left = `${left}px`;
  palette.style.top = `${top}px`;
  let picking = false;
  const paint = (color) => {
    ctx.setBg?.(color);
    applyCardBg(ctx.el, color);
    persistLayout();
  };
  palette.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    window.edex?.setMouseIgnore?.(false);
  }, true);
  palette.querySelectorAll("[data-idx]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const item = swatches[Number(btn.dataset.idx)];
      paint(item?.color || "");
      closeCardMenus();
    });
  });
  const picker = palette.querySelector("#card_bg_picker");
  picker?.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    picking = true;
    window.edex?.setMouseIgnore?.(false);
  });
  picker?.addEventListener("input", () => paint(picker.value));
  picker?.addEventListener("change", () => {
    paint(picker.value);
    picking = false;
    closeCardMenus();
  });
  const dismiss = (event) => {
    if (picking || palette.contains(event.target)) return;
    closeCardMenus();
    window.removeEventListener("pointerdown", dismiss, true);
  };
  setTimeout(() => window.addEventListener("pointerdown", dismiss, true), 0);
}

function bindFileDrop(el, getDest, onDone) {
  el.addEventListener("dragover", (event) => {
    if (![...event.dataTransfer.types].includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    el.classList.add("drop-target");
  });
  el.addEventListener("dragleave", (event) => {
    if (!el.contains(event.relatedTarget)) el.classList.remove("drop-target");
  });
  el.addEventListener("drop", async (event) => {
    event.preventDefault();
    el.classList.remove("drop-target");
    const dest = getDest?.();
    const files = [...(event.dataTransfer.files || [])]
      .map((f) => window.edex.pathForFile?.(f) || f.path)
      .filter(Boolean);
    if (!dest || !files.length) {
      toast("此容器無法接收檔案");
      return;
    }
    try {
      const result = await window.edex.importFiles(dest, files);
      toast(`已加入 ${result.count} 個項目`);
      await onDone?.();
    } catch (err) {
      toast(err.message || "加入失敗");
    }
  });
}

function closePanel(id) {
  delete state.layout[id];
  document.querySelectorAll(`#card_${id}, [data-panel-id="${id}"]`).forEach((el) => el.remove());
  persistLayout();
  toast(`已關閉「${PANEL_META[id]?.title || id}」`);
}

function closeDesktopCard() {
  state.desktopEnabled = false;
  document.getElementById("card_desktop")?.remove();
  persistLayout();
  toast("已關閉桌面容器");
}

function ensureDesktopCard() {
  if (state.desktopEnabled !== false) return;
  state.desktopEnabled = true;
  if (!state.desktopStage) state.desktopStage = defaultDesktop();
  persistLayout();
  rebuildWorkspace();
}

function addPanel(id) {
  if (!PANEL_META[id]) return;
  if (state.layout[id]) {
    toast("此顯示器已有該插件");
    return;
  }
  state.layout[id] = snapBoxVwVh({ ...PANEL_META[id].box });
  persistLayout();
  rebuildWorkspace();
  toast(`已添加「${PANEL_META[id].title}」`);
}

function openAddPicker() {
  document.getElementById("addPicker")?.closest(".modal_popup")?.remove();
  const missing = Object.keys(PANEL_META).filter((id) => id !== "status" && !state.layout[id]);
  const modal = document.createElement("div");
  modal.className = "modal_popup info";
  modal.innerHTML = `
    <h1>添加容器</h1>
    <h2>插件面板${state.primary ? "" : "（副螢幕可選加，預設不帶插件）"}</h2>
    <div class="action-row" id="addPicker">
      ${missing.length
        ? missing.map((id) =>
          `<button type="button" data-add-panel="${id}">${escapeHtml(PANEL_META[id].title)}</button>`
        ).join("")
        : "<span style='opacity:.6'>本顯示器插件已全部添加</span>"}
    </div>
    <h2>其他</h2>
    <div class="action-row">
      <button type="button" id="add-desktop" ${state.desktopEnabled !== false ? "disabled" : ""}>桌面容器</button>
      <button type="button" id="add-path">路徑容器</button>
    </div>
    <div style="margin-top:1.2vh;display:flex;justify-content:flex-end;">
      <button type="button" id="add-cancel">關閉</button>
    </div>
  `;
  document.body.appendChild(modal);
  placeCentered(modal, { width: Math.min(520, window.innerWidth * 0.45), topRatio: 0.18 });
  modal.querySelector("#add-cancel").onclick = () => modal.remove();
  modal.querySelectorAll("[data-add-panel]").forEach((btn) => {
    btn.onclick = () => {
      modal.remove();
      addPanel(btn.dataset.addPanel);
    };
  });
  modal.querySelector("#add-desktop").onclick = () => {
    modal.remove();
    ensureDesktopCard();
  };
  modal.querySelector("#add-path").onclick = async () => {
    modal.remove();
    await addPathCard();
  };
}

function buildLayout() {
  if (state.clockTimer) {
    clearInterval(state.clockTimer);
    cancelAnimationFrame(state.clockTimer);
    state.clockTimer = null;
  }
  window.edexEffects?.stop?.();
  delete state.layout.status;

  const panels = Object.keys(PANEL_META).map((id) => panelHtml(id)).join("");
  const deskLocked = Boolean(state.desktopLocked);
  const desktop = state.desktopEnabled === false ? "" : `
      <section class="desktop-card${deskLocked ? " locked" : ""}" id="card_desktop" style="${styleFromBox(state.desktopStage)}">
        <h3 class="card-title">
          <span class="card-title-text">系統桌面</span>
          ${cardToolsHtml()}
        </h3>
        <div class="card-body">
          <p class="path-text" title="${escapeHtml(state.bootstrap?.desktop || "")}">${escapeHtml(state.bootstrap?.desktop || "")}</p>
          <div class="desk-filter-bar">
            ${DESK_FILTERS.map((item) => `<button type="button" data-desk-filter="${item.id}">${item.label}</button>`).join("")}
          </div>
          <div id="desktop-stage" class="view-${state.iconView}"></div>
        </div>
        <div class="resize-handle"></div>
      </section>`;

  document.body.innerHTML = `
    <div id="workspace">
      <div id="snap-guides"></div>
      ${desktop}
      ${panels}
    </div>
    <div id="fab-bar">${fabBarHtml()}</div>
  `;

  const rules = document.getElementById("rules_list");
  if (rules) {
    rules.innerHTML = RULES.map(
      ([name, exts]) => `<div class="rule-line"><span>${escapeHtml(name)}</span><span>${escapeHtml(exts)}</span></div>`
    ).join("");
  }

  Object.keys(state.layout).forEach((id) => {
    if (id === "status") return;
    const el = document.getElementById(`card_${id}`);
    if (!el) return;
    bindCardTools(el, () => menuItemsForCard("panel", {
      el,
      locked: Boolean(state.layout[id]?.locked),
      widgetType: "panel",
      widgetId: id,
      widgetData: () => ({ panelId: id, box: state.layout[id] }),
      getBg: () => state.layout[id]?.bg || "",
      setBg: (color) => {
        state.layout[id] = { ...state.layout[id], bg: color };
        persistLayout();
      },
      onTransferred: () => {
        delete state.layout[id];
        el.remove();
        persistLayout();
        window.edexEffects?.stop?.();
        window.edexEffects?.start?.();
      },
      onLock: () => {
        state.layout[id] = { ...state.layout[id], locked: !state.layout[id].locked };
        setCardLocked(el, Boolean(state.layout[id].locked));
        persistLayout();
      },
      onClose: () => closePanel(id)
    }));
    applyCardBg(el, state.layout[id]?.bg);
    makeInteractive(el, {
      widgetType: "panel",
      widgetId: id,
      widgetData: () => ({ panelId: id, box: state.layout[id] }),
      onTransferred: () => {
        delete state.layout[id];
        el.remove();
        persistLayout();
        window.edexEffects?.stop?.();
        window.edexEffects?.start?.();
      },
      onMove: (x, y, w, h) => {
        applyBoxPx(state.layout[id], x, y, w, h);
      }
    });
  });

  const desk = document.getElementById("card_desktop");
  if (desk) {
    bindCardTools(desk, () => menuItemsForCard("desktop", {
      el: desk,
      locked: state.desktopLocked,
      widgetType: "desktop",
      widgetId: "desktop",
      widgetData: () => ({ box: state.desktopStage }),
      getBg: () => state.desktopStage?.bg || "",
      setBg: (color) => {
        state.desktopStage = { ...state.desktopStage, bg: color };
        persistLayout();
      },
      onTransferred: () => {
        state.desktopEnabled = false;
        persistLayout();
        desk.remove();
      },
      onLock: () => {
        state.desktopLocked = !state.desktopLocked;
        setCardLocked(desk, state.desktopLocked);
        persistLayout();
      },
      onClose: () => closeDesktopCard()
    }));
    applyCardBg(desk, state.desktopStage?.bg);
    bindDeskFilters(desk);
    bindFileDrop(desk, () => state.bootstrap.desktop, async () => {
      await loadDesktopListing();
      arrangeDesktop();
    });
    makeInteractive(desk, {
      minW: 280,
      minH: 200,
      widgetType: "desktop",
      widgetId: "desktop",
      widgetData: () => ({ box: state.desktopStage }),
      onTransferred: () => {
        state.desktopEnabled = false;
        persistLayout();
        desk.remove();
      },
      onMove: (x, y, w, h) => {
        applyBoxPx(state.desktopStage, x, y, w, h);
      },
      onEnd: () => persistLayout()
    });
  }

  bindShortcutsPanel();

  document.getElementById("add-fab")?.addEventListener("click", () => openAddPicker());
  if (state.primary) {
    document.getElementById("settings-fab")?.addEventListener("click", () => openSettings());
    document.getElementById("quit-fab")?.addEventListener("click", () => {
      if (window.confirm("確定退出桌面整理？")) window.edex.quitApp();
    });
  }

  applyClockMetrics();
  renderClock();
  if (state.clockTimer) {
    clearInterval(state.clockTimer);
    cancelAnimationFrame(state.clockTimer);
  }
  state.clockTimer = setInterval(renderClock, 100);
  window.__edexTheme = state.theme;
  applyRainMetrics();
  window.edexEffects?.start?.();
  applyRainMetrics();
  bindCalendar();
  fillShortcutsStage();
  fillDrivesStage();
  bindFileSearch();
}

function updateDesktopViewToggle() {
  // View toggle moved into the more-actions menu.
}

function toggleIconView(kind, pathId) {
  if (kind === "path") {
    const card = state.pathCards.find((item) => item.id === pathId);
    if (!card) return;
    card.iconView = card.iconView === "list" ? "grid" : "list";
    fillPathStage(card);
    persistLayout();
    toast(card.iconView === "list" ? "已切換為列表" : "已切換為網格");
    return;
  }
  if (kind === "shortcuts") {
    if (!state.layout.shortcuts) return;
    state.layout.shortcuts.iconView = state.layout.shortcuts.iconView === "list" ? "grid" : "list";
    fillShortcutsStage();
    persistLayout();
    toast(state.layout.shortcuts.iconView === "list" ? "已切換為列表" : "已切換為網格");
    return;
  }
  state.iconView = state.iconView === "list" ? "grid" : "list";
  arrangeDesktop();
  persistLayout();
  toast(state.iconView === "list" ? "已切換為列表" : "已切換為網格");
}

function localBounds() {
  return {
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: window.innerHeight
  };
}

function modalDialogWidth() {
  return Math.min(760, window.innerWidth * 0.62);
}

function placeCentered(el, opts = {}) {
  if (!el) return;
  const b = localBounds();
  const width = Math.min(opts.width || modalDialogWidth(), b.width * 0.92);
  const maxH = Math.floor(b.height * 0.9);
  el.style.width = `${width}px`;
  el.style.maxWidth = "92vw";
  el.style.maxHeight = `${maxH}px`;
  el.style.left = `${(b.width - width) / 2}px`;
  el.style.top = `${Math.max(16, (b.height - Math.min(el.offsetHeight || maxH, maxH)) / 2)}px`;
  el.style.transform = "none";
  el.classList.add("scrollable");
  // After layout, re-center using real height.
  requestAnimationFrame(() => {
    const h = Math.min(el.offsetHeight, maxH);
    el.style.top = `${Math.max(16, (b.height - h) / 2)}px`;
  });
}

function pathTitle(card, index) {
  return card.path ? card.path.split(/[/\\]/).filter(Boolean).pop() : `路徑 ${index + 1}`;
}

function listingItems(listing) {
  if (!listing) return [];
  return [...(listing.destFolders || []), ...(listing.items || [])];
}

function fillPathStage(card) {
  const stage = document.querySelector(`[data-path-stage="${card.id}"]`);
  if (!stage) return;
  const items = listingItems(card.listing || card.scan);
  const view = card.iconView === "list" ? "list" : "grid";
  const fileOpts = {
    destDir: card.path,
    onRefresh: () => scanCard(card)
  };
  stage.classList.toggle("view-list", view === "list");
  stage.classList.toggle("view-grid", view === "grid");
  if (!items.length) {
    stage.innerHTML = card.listingError
      ? `<p class="path-empty">${escapeHtml(card.listingError)}</p>`
      : `<p class="path-empty">${card.scanning ? "讀取中…" : "此資料夾沒有可顯示的項目"}</p>`;
    bindFileStage(stage, fileOpts);
    return;
  }
  fillIconStage(stage, items, { draggable: false, view, ...fileOpts });
}

async function scanCard(card) {
  if (!card?.path) return;
  if (card.scanning) {
    while (card.scanning) await delay(40);
    return;
  }
  card.scanning = true;
  card.listingError = "";
  fillPathStage(card);
    try {
    card.listing = await window.edex.listFolder(card.path);
    fillPathStage(card);
    if (card.id === state.activePathId) {
      try {
        card.scan = await window.edex.scan(card.path);
        state.scan = card.scan;
        await refreshPlan();
        renderStats();
        arrangeDesktop();
      } catch {
        // Listing can still show even if organize scan fails.
      }
      log(`掃描 ${card.path}：${card.listing.total} 個項目`);
    }
  } catch (err) {
    card.listing = { items: [], total: 0 };
    card.listingError = err.message || "無法讀取資料夾";
    fillPathStage(card);
    toast(card.listingError);
    log(`讀取失敗：${card.listingError}`);
  } finally {
    card.scanning = false;
    fillPathStage(card);
  }
}

function activeCard() {
  return state.pathCards.find((card) => card.id === state.activePathId) || state.pathCards[0];
}

function renderPathCards() {
  document.querySelectorAll(".path-card").forEach((el) => el.remove());
  const workspace = document.getElementById("workspace");
  state.pathCards.forEach((card, index) => {
    const el = document.createElement("section");
    const locked = Boolean(card.locked);
    el.className = `path-card${card.id === state.activePathId ? " active-path" : ""}${locked ? " locked" : ""}`;
    el.id = `path_${card.id}`;
    el.style.cssText = styleFromBox(card);
    el.innerHTML = `
      <h3 class="card-title">
        <span class="card-title-text">${escapeHtml(pathTitle(card, index))}</span>
        ${cardToolsHtml()}
      </h3>
      <div class="card-body">
        <p class="path-text" title="${escapeHtml(card.path)}">${escapeHtml(card.path)}</p>
        <div class="path-stage view-${card.iconView === "list" ? "list" : "grid"}" data-path-stage="${card.id}"></div>
      </div>
      <div class="resize-handle"></div>
    `;
    el.addEventListener("dblclick", () => setActivePath(card.id));
    workspace.appendChild(el);
    bindCardTools(el, () => menuItemsForCard("path", {
      el,
      id: card.id,
      path: card.path,
      locked: Boolean(card.locked),
      iconView: card.iconView,
      widgetType: "path",
      widgetId: card.id,
      widgetData: () => ({ path: card.path, box: { ...card }, locked: card.locked, iconView: card.iconView, bg: card.bg }),
      getBg: () => card.bg || "",
      setBg: (color) => {
        card.bg = color;
        persistLayout();
      },
      onTransferred: () => {
        state.pathCards = state.pathCards.filter((c) => c.id !== card.id);
        if (state.activePathId === card.id) {
          state.activePathId = state.pathCards[0]?.id || null;
        }
        el.remove();
        persistLayout();
        doScan();
      },
      onLock: () => {
        card.locked = !card.locked;
        setCardLocked(el, Boolean(card.locked));
        persistLayout();
      },
      onClose: () => {
        state.pathCards = state.pathCards.filter((c) => c.id !== card.id);
        if (state.activePathId === card.id) {
          state.activePathId = state.pathCards[0]?.id || null;
        }
        el.remove();
        persistLayout();
        doScan();
        toast("已關閉路徑容器");
      }
    }));
    makeInteractive(el, {
      minW: 280,
      minH: 220,
      widgetType: "path",
      widgetId: card.id,
      widgetData: () => ({ path: card.path, box: { ...card }, locked: card.locked }),
      onTransferred: () => {
        state.pathCards = state.pathCards.filter((c) => c.id !== card.id);
        if (state.activePathId === card.id) {
          state.activePathId = state.pathCards[0]?.id || null;
        }
        el.remove();
        persistLayout();
        doScan();
      },
      onMove: (x, y, w, h) => {
        applyBoxPx(card, x, y, w, h);
      },
      onEnd: () => {
        fillPathStage(card);
        persistLayout();
      }
    });
    applyCardBg(el, card.bg);
    bindFileDrop(el, () => card.path, async () => scanCard(card));
    fillPathStage(card);
    if (!card.listing) requestAnimationFrame(() => scanCard(card));
    else requestAnimationFrame(() => fillPathStage(card));
  });
}

async function setActivePath(id) {
  state.activePathId = id;
  renderPathCards();
  await doScan();
}

async function changePath(id) {
  const picked = await window.edex.pickFolder();
  if (!picked) return;
  const card = state.pathCards.find((item) => item.id === id);
  card.path = picked;
  persistLayout();
  renderPathCards();
  await scanCard(card);
}

function removePath(id) {
  state.pathCards = state.pathCards.filter((card) => card.id !== id);
  if (state.activePathId === id) state.activePathId = state.pathCards[0]?.id || null;
  persistLayout();
  renderPathCards();
  doScan();
}

async function addPathCard() {
  const picked = await window.edex.pickFolder();
  if (!picked) return;
  await addPathCardAt(picked);
}

async function addPathCardAt(folderPath) {
  const picked = String(folderPath || "").trim();
  if (!picked || isVirtualPath(picked)) {
    toast("無法將此項目加入為路徑容器");
    return;
  }
  const existing = state.pathCards.find(
    (card) => String(card.path || "").toLowerCase() === picked.toLowerCase()
  );
  if (existing) {
    await setActivePath(existing.id);
    toast("此路徑容器已存在");
    return;
  }
  const id = `p${Date.now()}`;
  const n = state.pathCards.length % 4;
  state.pathCards.push(snapBoxVwVh({
    id,
    path: picked,
    x: 18 + n * 2,
    y: 16 + n * 2,
    w: 46,
    h: 52,
    iconView: "grid"
  }));
  state.activePathId = id;
  persistLayout();
  renderPathCards();
  const card = state.pathCards.find((item) => item.id === id);
  await scanCard(card);
  toast(`已加入路徑容器 ${pathTitle(card, state.pathCards.length - 1)}`);
}

function desktopItems() {
  return listingItems(state.desktopListing);
}

async function loadDesktopListing() {
  try {
    state.desktopListing = await window.edex.listDesktopFiles();
  } catch {
    state.desktopListing = { items: [], total: 0 };
  }
}

async function fillDrivesStage() {
  const stage = document.getElementById("drives-stage");
  if (!stage) return;
  try {
    const listing = await window.edex.listDrives();
    const items = listing.items || [];
    if (!items.length) {
      stage.innerHTML = `<p class="path-empty">找不到本機磁碟</p>`;
      return;
    }
    stage.innerHTML = items.map((d) => `
      <button type="button" class="drive-row" data-path="${escapeHtml(d.path)}">
        ${iconSvg(d.icon) || `<svg class="drive-fallback" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="6" width="18" height="12" rx="1.5"/><rect x="5" y="9" width="4" height="2"/></svg>`}
        <div class="drive-main">
          <div class="drive-head">
            <span class="drive-name">${escapeHtml(d.name)}</span>
            <span class="drive-meta">${escapeHtml(d.freeLabel)} 可用 / ${escapeHtml(d.totalLabel)}</span>
          </div>
          <div class="drive-bar"><i style="width:${d.pct}%"></i></div>
          <div class="drive-foot">${escapeHtml(d.type)}${d.fs ? ` · ${escapeHtml(d.fs)}` : ""} · 已用 ${d.pct}%</div>
        </div>
      </button>
    `).join("");
    stage.querySelectorAll("[data-path]").forEach((btn) => {
      btn.addEventListener("dblclick", () => window.edex.openPath(btn.dataset.path));
    });
    bindFileStage(stage, {
      destDir: "",
      itemFromNode: (node) => {
        const target = node?.dataset?.path;
        if (!target) return null;
        return { path: target, name: node.querySelector(".drive-name")?.textContent || target, isDirectory: true, kind: "drive" };
      },
      onRefresh: () => fillDrivesStage()
    });
  } catch (err) {
    stage.innerHTML = `<p class="path-empty">${escapeHtml(err.message || "無法讀取磁碟")}</p>`;
  }
}

function formatSearchEngine(status) {
  const engine = status?.engine === "everything" ? "Everything" : "本機索引";
  const count = Number(status?.count) || 0;
  const extra = (status?.roots || []).length;
  const bits = [engine];
  if (status?.indexing) bits.push("索引中");
  else if (count) bits.push(`${count.toLocaleString()} 筆`);
  if (extra) bits.push(`${extra} 條局域網路徑`);
  if (status?.lastError) bits.push(status.lastError);
  return bits.join(" · ");
}

function bindFileSearch() {
  const input = document.getElementById("fs_query");
  const go = document.getElementById("fs_go");
  const results = document.getElementById("fs_results");
  if (!input || !results) return;
  let timer = 0;
  let token = 0;
  const run = async () => {
    const query = input.value.trim();
    const stamp = ++token;
    if (!query) {
      results.innerHTML = "";
      await refreshSearchStatus();
      return;
    }
    setText("fs_status", "搜尋中…");
    try {
      const payload = await window.edex.searchFiles(query, 80);
      if (stamp !== token) return;
      renderSearchResults(payload, query);
    } catch (err) {
      if (stamp !== token) return;
      results.innerHTML = `<p class="path-empty">${escapeHtml(err.message || "搜尋失敗")}</p>`;
      setText("fs_status", "搜尋失敗");
    }
  };
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, 160);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      clearTimeout(timer);
      run();
    }
  });
  go?.addEventListener("click", () => {
    clearTimeout(timer);
    run();
  });
  results.addEventListener("click", (event) => {
    const row = event.target.closest("[data-path]");
    if (!row) return;
    window.edex.openPath(row.dataset.path);
  });
  bindFileStage(results, {
    destDir: "",
    allowCreate: false,
    itemFromNode: (node) => {
      const target = node?.dataset?.path;
      if (!target) return null;
      const name = node.querySelector(".fs-name")?.textContent || target;
      return { path: target, name, isDirectory: false };
    },
    onRefresh: async () => {
      const q = document.getElementById("fs_query")?.value?.trim();
      if (q) document.getElementById("fs_go")?.click();
    }
  });
  refreshSearchStatus();
}

function renderSearchResults(payload, query) {
  const results = document.getElementById("fs_results");
  if (!results) return;
  const items = payload?.items || [];
  setText("fs_status", `${formatSearchEngine(payload)} · ${items.length} 筆結果`);
  if (!items.length) {
    results.innerHTML = `<p class="path-empty">沒有符合「${escapeHtml(query)}」的檔案</p>`;
    return;
  }
  results.innerHTML = items.map((item) => `
    <button type="button" class="fs-row" data-path="${escapeHtml(item.path)}" title="${escapeHtml(item.path)}">
      <span class="fs-name">${escapeHtml(item.name)}</span>
      <span class="fs-path">${escapeHtml(item.dir || item.path)}</span>
    </button>
  `).join("");
}

async function refreshSearchStatus() {
  const el = document.getElementById("fs_status");
  if (!el) return;
  try {
    const status = await window.edex.searchStatus();
    el.textContent = formatSearchEngine(status) + " · 輸入關鍵字搜尋";
  } catch {
    el.textContent = "搜尋尚未就緒";
  }
}

async function addSearchFolder() {
  const folder = await window.edex.pickSearchRoot();
  if (!folder) return;
  try {
    await window.edex.addSearchRoot(folder);
    toast(`已加入搜尋路徑 ${folder}`);
    refreshSearchStatus();
  } catch (err) {
    toast(err.message || "無法加入路徑");
  }
}

function openLanPathPrompt() {
  document.getElementById("lanPathEditor")?.closest(".modal_popup")?.remove();
  const modal = document.createElement("div");
  modal.className = "modal_popup info";
  modal.innerHTML = `
    <h1>局域網路徑</h1>
    <h2>例如 \\\\NAS\\share 或已對應的網路磁碟資料夾</h2>
    <table id="lanPathEditor">
      <tr><th>路徑</th><th><input id="lan_path_input" type="text" spellcheck="false" placeholder="\\\\伺服器\\分享" /></th></tr>
    </table>
    <div class="settings-footer">
      <button type="button" id="lan-cancel">取消</button>
      <button type="button" id="lan-ok">加入並索引</button>
    </div>`;
  document.body.appendChild(modal);
  const input = document.getElementById("lan_path_input");
  input?.focus();
  document.getElementById("lan-cancel").onclick = () => modal.remove();
  document.getElementById("lan-ok").onclick = async () => {
    const value = input.value.trim();
    if (!value) return toast("請輸入路徑");
    try {
      await window.edex.addSearchRoot(value);
      modal.remove();
      toast(`已加入 ${value}`);
      refreshSearchStatus();
    } catch (err) {
      toast(err.message || "無法加入路徑");
    }
  };
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") document.getElementById("lan-ok")?.click();
  });
}

async function openSearchRootsEditor() {
  document.getElementById("searchRootsEditor")?.closest(".modal_popup")?.remove();
  let status;
  try {
    status = await window.edex.searchStatus();
  } catch (err) {
    toast(err.message || "無法讀取搜尋路徑");
    return;
  }
  const roots = status.roots || [];
  const modal = document.createElement("div");
  modal.className = "modal_popup info";
  modal.innerHTML = `
    <h1>搜尋路徑</h1>
    <h2>${status.includeLocal ? "已包含本機磁碟" : "未索引本機磁碟"} · ${status.engine === "everything" ? "Everything 加速" : "檔名索引"}</h2>
    <div id="searchRootsEditor" class="fs-roots">
      ${roots.length
        ? roots.map((root) => `
          <div class="fs-root-row">
            <span>${escapeHtml(root)}</span>
            <button type="button" data-del-root="${escapeHtml(root)}">移除</button>
          </div>`).join("")
        : `<p class="cal-editor-empty">尚未加入局域網或額外資料夾，可在容器選單新增</p>`}
    </div>
    <div class="settings-footer">
      <button type="button" id="fs-local-toggle">${status.includeLocal ? "停用本機磁碟" : "啟用本機磁碟"}</button>
      <button type="button" id="fs-roots-close">關閉</button>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll("[data-del-root]").forEach((btn) => {
    btn.onclick = async () => {
      try {
        await window.edex.removeSearchRoot(btn.dataset.delRoot);
        toast("已移除路徑");
        modal.remove();
        openSearchRootsEditor();
        refreshSearchStatus();
      } catch (err) {
        toast(err.message || "無法移除");
      }
    };
  });
  document.getElementById("fs-local-toggle").onclick = async () => {
    await window.edex.setSearchLocal(!status.includeLocal);
    modal.remove();
    toast(status.includeLocal ? "已停用本機磁碟索引" : "已啟用本機磁碟索引");
    openSearchRootsEditor();
    refreshSearchStatus();
  };
  document.getElementById("fs-roots-close").onclick = () => modal.remove();
}

async function rebuildFileSearch() {
  toast("正在重建索引…");
  try {
    await window.edex.searchRebuild();
    toast("索引已重建");
    refreshSearchStatus();
  } catch (err) {
    toast(err.message || "重建失敗");
  }
}

function bindShortcutsPanel() {
  const el = document.getElementById("card_shortcuts");
  if (!el) return;
  bindFileDrop(el, () => state.bootstrap.desktop, async () => {
    await loadDesktopListing();
    arrangeDesktop();
    await fillShortcutsStage();
  });
}

async function fillShortcutsStage() {
  const stage = document.getElementById("shortcuts-stage");
  if (!stage) return;
  const view = state.layout.shortcuts?.iconView === "list" ? "list" : "grid";
  try {
    const listing = await window.edex.listDesktopShortcuts();
    fillIconStage(stage, listingItems(listing), {
      draggable: false,
      view,
      destDir: state.bootstrap?.desktop || "",
      onRefresh: () => fillShortcutsStage()
    });
  } catch (err) {
    stage.innerHTML = `<p class="path-empty">${escapeHtml(err.message || "無法讀取桌面捷徑")}</p>`;
    bindFileStage(stage, {
      destDir: state.bootstrap?.desktop || "",
      onRefresh: () => fillShortcutsStage()
    });
  }
}

function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function bindCalendar() {
  if (!document.getElementById("cal_grid")) return;
  document.getElementById("cal_prev")?.addEventListener("click", () => {
    state.calCursor.setMonth(state.calCursor.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById("cal_next")?.addEventListener("click", () => {
    state.calCursor.setMonth(state.calCursor.getMonth() + 1);
    renderCalendar();
  });
  refreshCalendar();
}

async function refreshCalendar() {
  try {
    state.calNotes = await window.edex.getCalendarNotes() || {};
  } catch {
    state.calNotes = {};
  }
  renderCalendar();
}

function mondayIndex(jsDay) {
  return (jsDay + 6) % 7;
}

function renderCalendar() {
  const grid = document.getElementById("cal_grid");
  const title = document.getElementById("cal_title");
  if (!grid || !title) return;
  const y = state.calCursor.getFullYear();
  const m = state.calCursor.getMonth();
  title.textContent = `${y} / ${m + 1}`;
  const start = mondayIndex(new Date(y, m, 1).getDay());
  const days = new Date(y, m + 1, 0).getDate();
  const today = dateKey(new Date());
  const cells = [];
  for (let i = 0; i < start; i++) {
    cells.push({ empty: true, sun: i === 6 });
  }
  for (let d = 1; d <= days; d++) {
    const key = `${y}-${pad(m + 1)}-${pad(d)}`;
    const jsDay = new Date(y, m, d).getDay();
    cells.push({
      empty: false,
      key,
      day: d,
      sun: jsDay === 0,
      holiday: window.edexMacauHolidays?.get(key) || "",
      notes: state.calNotes[key] || [],
      today: key === today,
      selected: key === state.calSelected
    });
  }
  while (cells.length < 42) {
    cells.push({ empty: true, sun: cells.length % 7 === 6 });
  }
  grid.innerHTML = cells.map((cell) => {
    if (cell.empty) {
      return `<span class="cal-cell empty${cell.sun ? " sun" : ""}"></span>`;
    }
    const cls = ["cal-cell"];
    if (cell.sun) cls.push("sun");
    if (cell.today) cls.push("today");
    if (cell.selected) cls.push("selected");
    if (cell.holiday) cls.push("holiday");
    if (cell.notes.length) cls.push("has-notes");
    const holiday = cell.holiday
      ? `<span class="cal-holiday" title="${escapeHtml(cell.holiday)}">${escapeHtml(cell.holiday)}</span>`
      : "";
    const previews = cell.notes.slice(0, 4).map((n, i) =>
      `<span class="cal-preview">${i + 1}. ${escapeHtml(n.text)}</span>`
    ).join("");
    const more = cell.notes.length > 4 ? `<span class="cal-preview more">+${cell.notes.length - 4}</span>` : "";
    return `<button type="button" class="${cls.join(" ")}" data-date="${cell.key}">
      <span class="cal-num">${cell.day}</span>
      ${holiday}
      <span class="cal-previews">${previews}${more}</span>
    </button>`;
  }).join("");
  grid.querySelectorAll("[data-date]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.calSelected = btn.dataset.date;
      grid.querySelectorAll(".cal-cell.selected").forEach((el) => el.classList.remove("selected"));
      btn.classList.add("selected");
    });
    btn.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openCalNoteEditor(btn.dataset.date);
    });
  });
}

function formatNotesForWeChat(dateKey, notes = []) {
  const lines = [`${dateKey} 事項`];
  if (!notes.length) {
    lines.push("（尚無事項）");
  } else {
    notes.forEach((n, i) => lines.push(`${i + 1}. ${n.text}`));
  }
  return lines.join("\n");
}

function openCalNoteEditor(key) {
  document.getElementById("calNoteEditor")?.closest(".modal_popup")?.remove();
  state.calSelected = key;
  const notes = state.calNotes[key] || [];
  const holiday = window.edexMacauHolidays?.get(key) || "";
  let editingId = null;
  const modal = document.createElement("div");
  modal.className = "modal_popup info cal-editor";
  modal.innerHTML = `
    <div class="cal-editor-head">
      <div class="cal-editor-heading">
        <h1>日曆事項</h1>
        <h2>${escapeHtml(key)}${holiday ? ` · ${escapeHtml(holiday)}` : ""}</h2>
      </div>
      <div class="cal-editor-actions">
        <button type="button" id="cal-note-wechat">複製到微信</button>
        <button type="button" id="cal-note-cancel">關閉</button>
      </div>
    </div>
    <div class="cal-editor-list" id="calNoteEditor">
      ${notes.length
        ? notes.map((n, i) => `
          <div class="cal-editor-item" data-edit="${escapeHtml(n.id)}">
            <span class="cal-editor-idx">${i + 1}.</span>
            <span class="cal-editor-text">${escapeHtml(n.text)}</span>
            <button type="button" data-edit-btn="${escapeHtml(n.id)}">編輯</button>
            <button type="button" data-del="${escapeHtml(n.id)}">刪除</button>
          </div>`).join("")
        : `<p class="cal-editor-empty">這天還沒有事項，可在下方輸入後新增</p>`}
    </div>
    <label class="cal-editor-label" for="cal_note_text" id="cal_note_label">新增事項</label>
    <textarea id="cal_note_text" rows="4" placeholder="輸入事項內容…"></textarea>
    <div class="cal-editor-add">
      <button type="button" id="cal-note-save">新增事項</button>
    </div>
  `;
  document.body.appendChild(modal);
  placeCentered(modal);
  window.edex?.setMouseIgnore?.(false);
  const input = modal.querySelector("#cal_note_text");
  const label = modal.querySelector("#cal_note_label");
  const saveBtn = modal.querySelector("#cal-note-save");
  input?.focus();

  const setEditMode = (id, text) => {
    editingId = id || null;
    modal.querySelectorAll(".cal-editor-item").forEach((el) => {
      el.classList.toggle("active", Boolean(id) && el.dataset.edit === id);
    });
    if (id) {
      label.textContent = "編輯事項";
      saveBtn.textContent = "儲存修改";
      input.value = text || "";
      input.focus();
    } else {
      label.textContent = "新增事項";
      saveBtn.textContent = "新增事項";
      input.value = "";
      input.focus();
    }
  };

  const close = () => modal.remove();
  modal.querySelector("#cal-note-cancel").onclick = close;

  const startEdit = (id) => {
    const note = (state.calNotes[key] || []).find((n) => n.id === id);
    if (note) setEditMode(id, note.text);
  };

  modal.querySelectorAll("[data-edit]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target.closest("[data-del]")) return;
      startEdit(row.dataset.edit);
    });
  });

  modal.querySelectorAll("[data-del]").forEach((btn) => {
    btn.onclick = async (event) => {
      event.stopPropagation();
      state.calNotes = await window.edex.removeCalendarNote(key, btn.dataset.del) || {};
      renderCalendar();
      close();
      openCalNoteEditor(key);
    };
  });

  modal.querySelector("#cal-note-wechat").onclick = async () => {
    const list = state.calNotes[key] || [];
    const text = formatNotesForWeChat(key, list);
    await window.edex.copyText(text);
    toast("已複製，可貼到微信");
  };

  const save = async () => {
    const text = input.value.trim();
    if (!text) {
      toast("請輸入事項內容");
      return;
    }
    let result;
    if (editingId) {
      result = await window.edex.updateCalendarNote(key, editingId, text);
    } else {
      result = await window.edex.addCalendarNote(key, text);
    }
    state.calNotes = result?.notes || result || {};
    renderCalendar();
    close();
    openCalNoteEditor(key);
  };
  saveBtn.onclick = save;
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    }
  });
}

function parentDir(target) {
  const value = String(target || "");
  const idx = Math.max(value.lastIndexOf("\\"), value.lastIndexOf("/"));
  return idx > 0 ? value.slice(0, idx) : "";
}

function isVirtualPath(target) {
  const value = String(target || "");
  return !value || /^shell:/i.test(value) || value.includes("::{") || value.startsWith("::");
}

function isDriveRoot(target) {
  return /^[a-zA-Z]:\\?$/.test(String(target || "").trim());
}

function tagDotsHtml(tags) {
  const list = Array.isArray(tags) ? tags : [];
  if (!list.length) return "";
  const dots = list.map((id) => {
    const tag = MACOS_TAGS.find((t) => t.id === id);
    if (!tag) return "";
    return `<i class="tag-dot" style="background:${tag.color}" title="${escapeHtml(tag.label)}"></i>`;
  }).join("");
  return dots ? `<span class="tag-dots">${dots}</span>` : "";
}

function bindFileStage(stage, opts) {
  fileStageCtx.set(stage, opts || {});
  if (stage.dataset.fileMenuBound) return;
  stage.dataset.fileMenuBound = "1";
  stage.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const ctx = fileStageCtx.get(stage) || {};
    const node = event.target.closest(".desk-icon, .fs-row, .drive-row");
    const item = node
      ? (ctx.itemFromNode?.(node) || itemFromIcon(node))
      : null;
    const menuItems = fileMenuItems(stage, item, ctx);
    if (!menuItems.length) return;
    openCardMenu(node || stage, menuItems, { x: event.clientX, y: event.clientY });
  });
}

function itemFromIcon(node) {
  if (!node?.dataset?.path) return null;
  let tags = [];
  try { tags = JSON.parse(node.dataset.tags || "[]"); } catch { tags = []; }
  return {
    path: node.dataset.path,
    name: node.dataset.name || node.querySelector("h3")?.textContent || "",
    isDirectory: node.dataset.dir === "1",
    kind: node.dataset.kind || "",
    tags
  };
}

function fileMenuItems(stage, item, ctx) {
  const destDir = ctx.allowCreate === false
    ? ""
    : (ctx.destDir || (item && !isVirtualPath(item.path) ? (item.isDirectory ? item.path : parentDir(item.path)) : ""));
  const items = [];
  if (item?.isDirectory && !isVirtualPath(item.path)) {
    items.push({
      label: "加入為路徑容器",
      action: () => addPathCardAt(item.path)
    });
  }
  if (destDir && !isVirtualPath(destDir)) {
    items.push({
      label: "新建資料夾",
      action: async () => {
        try {
          const created = await window.edex.createFolder(destDir);
          toast(`已建立 ${created.name}`);
          await ctx.onRefresh?.();
          const node = [...stage.querySelectorAll(".desk-icon")].find((el) => el.dataset.path === created.path);
          if (node) startRename(node, created, ctx.onRefresh);
        } catch (err) {
          toast(err.message || "無法建立資料夾");
        }
      }
    });
  }
  const canEdit = item && !isVirtualPath(item.path) && item.kind !== "drive" && !isDriveRoot(item.path);
  if (canEdit) {
    items.push(
      {
        label: "刪除",
        action: async () => {
          try {
            const result = await window.edex.trashItem(item.path);
            if (result?.cancelled) return;
            toast("已移至回收桶");
            await ctx.onRefresh?.();
          } catch (err) {
            toast(err.message || "無法刪除");
          }
        }
      },
      {
        label: "重新命名",
        action: () => {
          const node = [...stage.querySelectorAll(".desk-icon, .fs-row")].find((el) => el.dataset.path === item.path);
          if (node?.classList.contains("desk-icon")) startRename(node, item, ctx.onRefresh);
          else promptRename(item, ctx.onRefresh);
        }
      }
    );
    if (item.isDirectory) {
      items.push(
        { sep: true },
        {
          kind: "tags",
          tags: item.tags || [],
          onChange: async (tags) => {
            await window.edex.setItemTags(item.path, tags);
            const node = [...stage.querySelectorAll(".desk-icon")].find((el) => el.dataset.path === item.path);
            if (node) {
              node.dataset.tags = JSON.stringify(tags);
              const face = node.querySelector(".desk-icon-face");
              const dots = node.querySelector(".tag-dots");
              const html = tagDotsHtml(tags);
              if (dots && html) dots.outerHTML = html;
              else if (dots) dots.remove();
              else if (html && face) face.insertAdjacentHTML("beforeend", html);
              else if (html) node.querySelector("h3")?.insertAdjacentHTML("beforebegin", html);
            }
          }
        }
      );
    }
  }
  return items;
}

function promptRename(item, onRefresh) {
  const next = window.prompt("重新命名", item.name || "");
  if (next == null || next.trim() === item.name) return;
  window.edex.renameItem(item.path, next.trim()).then(async () => {
    toast("已重新命名");
    await onRefresh?.();
  }).catch((err) => toast(err.message || "無法重新命名"));
}

function startRename(node, item, onRefresh) {
  const title = node.querySelector("h3");
  if (!title) {
    promptRename(item, onRefresh);
    return;
  }
  const input = document.createElement("input");
  input.className = "icon-rename";
  input.value = item.name || title.textContent || "";
  title.replaceWith(input);
  input.focus();
  input.select();
  window.edex?.setMouseIgnore?.(false);
  let done = false;
  const finish = async (commit) => {
    if (done) return;
    done = true;
    const value = input.value.trim();
    if (!commit || !value || value === item.name) {
      await onRefresh?.();
      return;
    }
    try {
      await window.edex.renameItem(item.path, value);
      toast("已重新命名");
      await onRefresh?.();
    } catch (err) {
      toast(err.message || "無法重新命名");
      await onRefresh?.();
    }
  };
  input.addEventListener("pointerdown", (event) => event.stopPropagation());
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      finish(true);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    }
  });
  input.addEventListener("blur", () => finish(true));
}

function fillIconStage(stage, items, opts = {}) {
  const view = opts.view === "list" ? "list" : "grid";
  const listMode = view === "list";
  stage.classList.toggle("view-list", listMode);
  stage.classList.toggle("view-grid", !listMode);
  stage.innerHTML = "";
  const gap = snapGap();

  items.forEach((item) => {
    const node = document.createElement("div");
    node.className = "desk-icon";
    node.dataset.path = item.path;
    node.dataset.name = item.name || "";
    node.dataset.dir = item.isDirectory ? "1" : "0";
    node.dataset.kind = item.kind || "";
    node.dataset.tags = JSON.stringify(item.tags || []);
    const label = itemLabel(item);
    node.innerHTML = `<span class="desk-icon-face">${iconSvg(item.icon)}${tagDotsHtml(item.tags)}</span><h3 title="${escapeHtml(item.name || label)}">${escapeHtml(label)}</h3><span class="meta">${escapeHtml(item.sizeLabel || "")}</span>`;
    node.addEventListener("dblclick", () => window.edex.openPath(item.path));
    if (opts.draggable && !listMode) bindIconDrag(node, item, gap);
    stage.appendChild(node);
  });
  bindFileStage(stage, {
    destDir: opts.destDir || "",
    onRefresh: opts.onRefresh
  });
}

function bindIconDrag(node, item, gap) {
  node.addEventListener("pointerdown", (event) => {
    if (event.detail > 1) return;
    event.preventDefault();
    node.classList.add("dragging");
    node.style.zIndex = String(++state.zTop);
    const startX = event.clientX;
    const startY = event.clientY;
    const origX = node.offsetLeft;
    const origY = node.offsetTop;
    const move = (ev) => {
      let x = origX + (ev.clientX - startX);
      let y = origY + (ev.clientY - startY);
      if (state.settings.snapWidgets) {
        x = Math.round(x / gap) * gap;
        y = Math.round(y / gap) * gap;
      }
      x = Math.max(0, x);
      y = Math.max(0, y);
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;
      state.iconPositions[item.path] = { x, y };
    };
    const up = () => {
      node.classList.remove("dragging");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      persistLayout();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

function itemKindBucket(item) {
  if (!item) return "other";
  if (item.kind === "thispc" || item.kind === "recycle") return "icons";
  const name = String(item.name || "");
  if (/\.(lnk|url)$/i.test(name) || item.category === "shortcuts" || item.kind === "shortcut") {
    return "icons";
  }
  if (item.isDirectory) return "folders";
  return item.category || "other";
}

function deskFilterBuckets() {
  return [
    { id: "folders", label: "文件夾" },
    { id: "icons", label: "圖標" },
    ...FILE_FORMAT_FILTERS
  ];
}

function matchesDeskFilter(item, filter) {
  const bucket = itemKindBucket(item);
  if (!filter || filter === "all") return true;
  if (filter === "files") return !["folders", "icons"].includes(bucket);
  return bucket === filter;
}

function bindDeskFilters(desk) {
  desk.querySelectorAll("[data-desk-filter]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      state.desktopFilter = btn.dataset.deskFilter || "all";
      persistLayout();
      arrangeDesktop();
    });
  });
  syncDeskFilters();
}

function syncDeskFilters() {
  const current = state.desktopFilter || "all";
  document.querySelectorAll("[data-desk-filter]").forEach((btn) => {
    btn.classList.toggle("on", btn.dataset.deskFilter === current);
  });
}

function arrangeDesktop() {
  const stage = document.getElementById("desktop-stage");
  if (!stage) return;
  const destDir = state.bootstrap?.desktop || "";
  const all = desktopItems();
  const filter = state.desktopFilter || "all";
  const view = state.iconView === "list" ? "list" : "grid";
  const fileOpts = {
    destDir,
    onRefresh: async () => {
      await loadDesktopListing();
      arrangeDesktop();
    }
  };
  const buckets = deskFilterBuckets();
  syncDeskFilters();
  if (state.desktopGrouped && filter === "all") {
    stage.classList.remove("view-list", "view-grid");
    stage.classList.add("view-grouped");
    const visibleBuckets = buckets.filter((bucket) => all.some((item) => matchesDeskFilter(item, bucket.id)));
    const list = visibleBuckets.length ? visibleBuckets : buckets;
    stage.innerHTML = list.map((bucket) => {
      const count = all.filter((item) => matchesDeskFilter(item, bucket.id)).length;
      return `<section class="desk-group" data-bucket="${bucket.id}"><h4>${bucket.label}<em>${count}</em></h4><div class="desk-group-items"></div></section>`;
    }).join("");
    list.forEach((bucket) => {
      const inner = stage.querySelector(`[data-bucket="${bucket.id}"] .desk-group-items`);
      if (!inner) return;
      const items = all.filter((item) => matchesDeskFilter(item, bucket.id));
      if (!items.length) {
        inner.className = "desk-group-items";
        inner.innerHTML = `<p class="path-empty">沒有${bucket.label}</p>`;
        return;
      }
      fillIconStage(inner, items, { draggable: false, view, ...fileOpts });
    });
    bindFileStage(stage, fileOpts);
    return;
  }
  stage.classList.remove("view-grouped");
  const items = all.filter((item) => matchesDeskFilter(item, filter));
  fillIconStage(stage, items, { draggable: false, view, ...fileOpts });
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function renderStats() {
  const scan = state.scan;
  if (!scan) return;
  setText("fill_label", scan.totalSizeLabel);
  const order = ["documents", "images", "videos", "audio", "archives", "shortcuts", "apps", "other", "folders"];
  const labels = {
    documents: "文件", images: "圖片", videos: "影片", audio: "音樂",
    archives: "壓縮", shortcuts: "捷徑", apps: "應用", other: "其他", folders: "資料夾"
  };
  const bars = document.getElementById("category_bars");
  if (bars) {
    const max = Math.max(1, ...order.map((id) => scan.counts[id] || 0));
    bars.innerHTML = order.map((id) => {
      const n = scan.counts[id] || 0;
      return `<div class="bar-row"><span>${labels[id]}</span><progress max="${max}" value="${n}"></progress><span>${n}</span></div>`;
    }).join("");
  }
  const map = document.getElementById("fill_pointmap");
  if (map) {
    const usedRatio = Math.min(1, scan.total / 80);
    map.innerHTML = Array.from({ length: 150 }, (_, i) => {
      const cls = i / 150 < usedRatio ? "active" : "free";
      return `<div class="mod_ramwatcher_point ${cls}"></div>`;
    }).join("");
  }
}

function log(text) {
  const node = document.getElementById("op_log");
  if (!node) return;
  const time = new Date().toLocaleTimeString("zh-Hant", { hour12: false });
  node.innerHTML = `[${time}] ${escapeHtml(text)}<br/>` + node.innerHTML;
}

function updateDisplayChip() {
  const chip = document.getElementById("display_chip");
  if (!chip) return;
  const { width, height } = pageSize();
  const role = state.primary ? "主螢幕" : "獨立頁面";
  const who = state.bootstrap?.username || "";
  chip.textContent = `顯示器 ${state.displayIndex + 1} · ${layoutMode().toUpperCase()} · ${width}×${height} · ${who} · ${role}`;
}

async function refreshPlan() {
  if (!state.scan) return;
  state.plan = await window.edex.plan(state.scan, { includeFolders: state.includeFolders });
  setText("st_plan", `${state.plan.count} 筆`);
  setText("st_folders", state.includeFolders ? "一併移動" : "略過");
}

async function doScan() {
  const cards = state.pathCards.filter((card) => card.path);
  setText("st_mode", "掃描中");
  try {
    if (!cards.length) {
      state.scan = null;
      state.plan = null;
    } else {
      await Promise.all(cards.map((card) => scanCard(card)));
    }
  } finally {
    setText("st_mode", "待命");
  }
  await loadDesktopListing();
  arrangeDesktop();
}

function closeSettings() {
  document.getElementById("settingsEditor")?.closest(".modal_popup")?.remove();
}

function openSettings() {
  if (document.getElementById("settingsEditor")) return;
  const modal = document.createElement("div");
  modal.className = "modal_popup info";
  const themeOpts = state.themes.map((t) =>
    `<option value="${escapeHtml(t)}" ${t === state.themeName ? "selected" : ""}>${escapeHtml(t)}</option>`
  ).join("");
  const wallOpts = state.wallpapers.map((w) =>
    `<option value="${escapeHtml(w.id)}" ${w.id === (state.settings.wallpaper || "grid") ? "selected" : ""}>${escapeHtml(w.label)}</option>`
  ).join("");

  modal.innerHTML = `
    <h1>設定</h1>
    <h2>畫面與外觀（解析度與網格全顯示器同步）</h2>
    <table id="settingsEditor">
      <tr><th>項目</th><th>說明</th><th>值</th></tr>
      <tr>
        <td>本顯示器</td>
        <td>實體解析度（非系統 2K 縮放）</td>
        <td>顯示器 ${state.displayIndex + 1} · ${pageSize().width}×${pageSize().height}</td>
      </tr>
      <tr>
        <td>顯示器數量</td>
        <td>各自獨立視窗，非鏡像</td>
        <td>${state.displays.length || 1} 台</td>
      </tr>
      <tr>
        <td>主題</td>
        <td>原版介面主題</td>
        <td><select id="set-theme">${themeOpts}</select></td>
      </tr>
      <tr>
        <td>壁紙</td>
        <td>所有顯示器共用背景</td>
        <td><select id="set-wall">${wallOpts}</select></td>
      </tr>
      <tr>
        <td>圖示顯示</td>
        <td>桌面容器內圖示排列</td>
        <td>
          <select id="set-icon-view">
            <option value="grid" ${state.iconView === "grid" ? "selected" : ""}>圖示網格</option>
            <option value="list" ${state.iconView === "list" ? "selected" : ""}>圖示列表</option>
          </select>
        </td>
      </tr>
      <tr>
        <td>自動吸附</td>
        <td>容器拖曳時自動對齊（含螢幕邊緣）</td>
        <td><input id="set-snap" type="checkbox" ${state.settings.snapWidgets !== false ? "checked" : ""}></td>
      </tr>
      <tr>
        <td>網格大小</td>
        <td>以主顯示器為準，所有顯示器使用同一格距（像素）</td>
        <td><input id="set-grid" type="number" min="12" max="96" step="1" value="${settingsGridSize()}"></td>
      </tr>
      <tr>
        <td>時鐘字格</td>
        <td>相對壁紙網格倍率（0.25–2.0，可縮小）</td>
        <td><input id="set-clock-scale" type="number" min="0.25" max="2" step="0.05" value="${clockScale()}"></td>
      </tr>
      <tr>
        <td>顯示日期</td>
        <td>在時間下方另起一行顯示年月日</td>
        <td><input id="set-clock-date" type="checkbox" ${clockShowDate() ? "checked" : ""}></td>
      </tr>
      <tr>
        <td>時鐘高亮</td>
        <td>點陣點亮顏色（色票或 #RRGGBB）</td>
        <td>
          <input id="set-clock-led" type="color" value="${escapeHtml(clockLedColor())}">
          <input id="set-clock-led-hex" type="text" spellcheck="false" value="${escapeHtml(clockLedColor())}" style="width:7rem">
        </td>
      </tr>
      <tr>
        <td>搜尋字體</td>
        <td>快速搜尋檔名、路徑與輸入框統一字級（px，預設 12）</td>
        <td><input id="set-search-font" type="text" inputmode="numeric" spellcheck="false" value="${searchFontSize()}"></td>
      </tr>
      <tr>
        <td>瀑布字體</td>
        <td>代碼雨字級（px，8–72，手動輸入後套用）</td>
        <td><input id="set-rain-font" type="text" inputmode="numeric" spellcheck="false" value="${rainFontSize()}"></td>
      </tr>
      <tr>
        <td>瀑布速度</td>
        <td>下落倍率（0.1–8.0，手動輸入後套用）</td>
        <td><input id="set-rain-speed" type="text" inputmode="decimal" spellcheck="false" value="${rainSpeed()}"></td>
      </tr>
      <tr>
        <td>佈局解析度</td>
        <td>全顯示器同步。2K 螢幕依同一尺縮小，網格密度與 4K 一致</td>
        <td>
          <select id="set-layout-mode">
            <option value="2k" ${layoutMode() === "2k" ? "selected" : ""}>2K（2560×1440）</option>
            <option value="4k" ${layoutMode() === "4k" ? "selected" : ""}>4K（3840×2160）</option>
          </select>
        </td>
      </tr>
      <tr>
        <td>介面比例</td>
        <td>全顯示器同步，疊加在佈局解析度上</td>
        <td><input id="set-ui-scale" type="number" min="0.4" max="1.2" step="0.05" value="${displayUiScale()}"></td>
      </tr>
      <tr>
        <td>遷移檔案</td>
        <td>開啟後自動整理會把檔案搬到「分類／副檔名」資料夾；關閉則只篩選顯示</td>
        <td><input id="set-migrate" type="checkbox" ${state.settings?.migrateFiles ? "checked" : ""}></td>
      </tr>
      <tr>
        <td>整理資料夾</td>
        <td>遷移時一併把資料夾收到「資料夾」</td>
        <td><input id="set-dirs" type="checkbox" ${state.includeFolders ? "checked" : ""}></td>
      </tr>
    </table>

    <div class="settings-footer">
      <button type="button" id="set-reset">重設容器位置</button>
      <button type="button" id="set-quit">結束程式</button>
      <button type="button" id="set-cancel">關閉</button>
      <button type="button" id="set-save">套用設定</button>
    </div>
  `;
  document.body.appendChild(modal);
  placeCentered(modal);

  const ledColor = modal.querySelector("#set-clock-led");
  const ledHex = modal.querySelector("#set-clock-led-hex");
  const previewLed = () => {
    const hex = toHex6(ledHex?.value || ledColor?.value || clockLedColor());
    state.settings = { ...state.settings, clockLedColor: hex };
    applyClockMetrics();
  };
  ledColor?.addEventListener("input", () => {
    if (ledHex) ledHex.value = ledColor.value;
    previewLed();
  });
  ledHex?.addEventListener("input", () => {
    const hex = toHex6(ledHex.value);
    if (ledColor && /^#[0-9a-fA-F]{6}$/.test(hex)) ledColor.value = hex;
    previewLed();
  });
  modal.querySelector("#set-clock-date")?.addEventListener("change", (event) => {
    setClockShowDate(event.target.checked);
  });
  modal.querySelector("#set-clock-scale")?.addEventListener("input", (event) => {
    const next = Number(event.target.value);
    if (!Number.isFinite(next)) return;
    state.settings = { ...state.settings, clockScale: Math.max(0.25, Math.min(2, next)) };
    applyClockMetrics();
    renderClock();
  });

  const previewRain = () => {
    const fontRaw = Number(modal.querySelector("#set-rain-font")?.value);
    const speedRaw = Number(modal.querySelector("#set-rain-speed")?.value);
    state.settings = {
      ...state.settings,
      rainFontSize: Number.isFinite(fontRaw) ? Math.max(8, Math.min(72, Math.round(fontRaw))) : rainFontSize(),
      rainSpeed: Number.isFinite(speedRaw) ? Math.max(0.1, Math.min(8, Math.round(speedRaw * 10) / 10)) : rainSpeed()
    };
    applyRainMetrics();
  };
  modal.querySelector("#set-rain-font")?.addEventListener("input", previewRain);
  modal.querySelector("#set-rain-speed")?.addEventListener("input", previewRain);
  modal.querySelector("#set-search-font")?.addEventListener("input", (event) => {
    const next = Number(event.target.value);
    if (!Number.isFinite(next)) return;
    state.settings = { ...state.settings, searchFontSize: Math.max(8, Math.min(72, Math.round(next))) };
    applyUiMetrics();
  });

  const prevLayoutMode = layoutMode();
  const prevUiScale = displayUiScale();
  modal.querySelector("#set-layout-mode")?.addEventListener("change", (event) => {
    state.settings = { ...state.settings, layoutMode: event.target.value === "4k" ? "4k" : "2k" };
    applyUiMetrics();
  });
  modal.querySelector("#set-ui-scale")?.addEventListener("input", (event) => {
    const next = Number(event.target.value);
    if (!Number.isFinite(next)) return;
    state.settings = { ...state.settings, uiScale: Math.max(0.4, Math.min(1.5, next)) };
    applyUiMetrics();
  });

  modal.querySelector("#set-cancel").onclick = () => {
    state.settings = { ...state.settings, layoutMode: prevLayoutMode, uiScale: prevUiScale };
    applyUiMetrics();
    closeSettings();
  };
  modal.querySelector("#set-quit").onclick = () => {
    if (window.confirm("確定退出桌面整理？")) window.edex.quitApp();
  };
  modal.querySelector("#set-reset").onclick = () => {
    state.layout = defaultWidgets();
    state.desktopStage = defaultDesktop();
    state.desktopEnabled = true;
    state.pathCards = [];
    snapAllLayoutToGrid();
    persistLayout();
    location.reload();
  };

  modal.querySelector("#set-save").onclick = async () => {
    state.includeFolders = modal.querySelector("#set-dirs").checked;
    const migrateFiles = Boolean(modal.querySelector("#set-migrate")?.checked);
    state.settings = { ...state.settings, migrateFiles };
    state.iconView = modal.querySelector("#set-icon-view").value === "list" ? "list" : "grid";
    const themeName = modal.querySelector("#set-theme").value;
    const wallpaper = modal.querySelector("#set-wall").value;
    const uiScaleRaw = Number(modal.querySelector("#set-ui-scale").value);
    const uiScale = Number.isFinite(uiScaleRaw) ? Math.max(0.4, Math.min(1.2, uiScaleRaw)) : 1;
    const layoutModeValue = modal.querySelector("#set-layout-mode")?.value === "4k" ? "4k" : "2k";
    state.settings = { ...state.settings, layoutMode: layoutModeValue, uiScale };
    const gridRaw = Number(modal.querySelector("#set-grid").value);
    const gridSizeValue = Number.isFinite(gridRaw) ? Math.max(12, Math.min(96, Math.round(gridRaw))) : 32;
    const clockRaw = Number(modal.querySelector("#set-clock-scale").value);
    const clockScaleValue = Number.isFinite(clockRaw)
      ? Math.max(0.25, Math.min(2, Math.round(clockRaw * 20) / 20))
      : 1;
    const clockLedValue = toHex6(
      modal.querySelector("#set-clock-led-hex")?.value
      || modal.querySelector("#set-clock-led")?.value
      || clockLedColor()
    );
    const clockDateValue = Boolean(modal.querySelector("#set-clock-date")?.checked);
    const rainFontRaw = Number(modal.querySelector("#set-rain-font").value);
    const rainFontValue = Number.isFinite(rainFontRaw)
      ? Math.max(8, Math.min(72, Math.round(rainFontRaw)))
      : 14;
    const rainSpeedRaw = Number(modal.querySelector("#set-rain-speed").value);
    const rainSpeedValue = Number.isFinite(rainSpeedRaw)
      ? Math.max(0.1, Math.min(8, Math.round(rainSpeedRaw * 10) / 10))
      : 1;
    const searchFontRaw = Number(modal.querySelector("#set-search-font")?.value);
    const searchFontValue = Number.isFinite(searchFontRaw)
      ? Math.max(8, Math.min(72, Math.round(searchFontRaw)))
      : 12;
    const result = await window.edex.saveSettings({
      snapWidgets: modal.querySelector("#set-snap").checked,
      gridSize: gridSizeValue,
      clockScale: clockScaleValue,
      clockLedColor: clockLedValue,
      clockShowDate: clockDateValue,
      rainFontSize: rainFontValue,
      rainSpeed: rainSpeedValue,
      searchFontSize: searchFontValue,
      layoutMode: layoutModeValue,
      uiScale,
      theme: themeName,
      wallpaper,
      iconView: state.iconView,
      includeFolders: state.includeFolders,
      migrateFiles
    });
    state.settings = result.settings;
    state.themeName = result.themeName;
    if (result.displays) state.displays = result.displays;
    applyTheme(result.theme, wallpaper);
    applyClockMetrics();
    applyRainMetrics();
    snapAllLayoutToGrid();
    persistLayout();
    closeSettings();
    toast("設定已套用");
    rebuildWorkspace();
  };
}

function rebuildWorkspace() {
  buildLayout();
  updateDisplayChip();
  applyClockMetrics();
  applyRainMetrics();
  window.edexEffects?.start?.();
  applyRainMetrics();
  renderPathCards();
  if (state.scan) renderStats();
  loadDesktopListing().then(() => arrangeDesktop());
  fillShortcutsStage();
  fillDrivesStage();
}

function receiveWidget(widget) {
  if (!widget?.type) return;

  if (widget.type === "panel" && widget.id && widget.id !== "status" && PANEL_META[widget.id]) {
    state.layout[widget.id] = snapBoxVwVh({
      ...(widget.data?.box || {}),
      x: widget.x ?? 2,
      y: widget.y ?? 4,
      w: widget.w ?? 16,
      h: widget.h ?? 14,
      gx: widget.gx,
      gy: widget.gy,
      gw: widget.gw,
      gh: widget.gh
    });
    persistLayout();
    rebuildWorkspace();
    toast(`已接收面板「${PANEL_META[widget.id].title}」`);
    return;
  }

  if (widget.type === "path") {
    const id = widget.id || `p${Date.now()}`;
    if (!state.pathCards.some((c) => c.id === id)) {
      state.pathCards.push(snapBoxVwVh({
        id,
        path: widget.data?.path || state.bootstrap.root,
        x: widget.x ?? 20,
        y: widget.y ?? 16,
        w: widget.w ?? 46,
        h: widget.h ?? 52,
        gx: widget.gx,
        gy: widget.gy,
        gw: widget.gw,
        gh: widget.gh,
        iconView: widget.data?.iconView === "list" ? "list" : "grid"
      }));
    } else {
      const card = state.pathCards.find((c) => c.id === id);
      Object.assign(card, snapBoxVwVh({
        ...card,
        path: widget.data?.path || card.path,
        x: widget.x ?? card.x,
        y: widget.y ?? card.y,
        w: widget.w ?? card.w,
        h: widget.h ?? card.h,
        gx: widget.gx ?? card.gx,
        gy: widget.gy ?? card.gy,
        gw: widget.gw ?? card.gw,
        gh: widget.gh ?? card.gh
      }));
    }
    if (!state.activePathId) state.activePathId = id;
    persistLayout();
    renderPathCards();
    const card = state.pathCards.find((c) => c.id === id);
    scanCard(card);
    toast("已接收路徑容器");
    return;
  }

  if (widget.type === "desktop") {
    state.desktopEnabled = true;
    state.desktopStage = snapBoxVwVh({
      ...state.desktopStage,
      x: widget.x ?? state.desktopStage.x,
      y: widget.y ?? state.desktopStage.y,
      w: widget.w ?? state.desktopStage.w,
      h: widget.h ?? state.desktopStage.h,
      gx: widget.gx ?? state.desktopStage.gx,
      gy: widget.gy ?? state.desktopStage.gy,
      gw: widget.gw ?? state.desktopStage.gw,
      gh: widget.gh ?? state.desktopStage.gh
    });
    persistLayout();
    rebuildWorkspace();
    toast("已接收桌面容器");
  }
}

async function runOrganize() {
  const root = state.bootstrap?.desktop;
  if (!root) {
    toast("找不到系統桌面路徑");
    return;
  }
  const migrate = Boolean(state.settings?.migrateFiles);
  state.busy = true;
  setText("st_mode", migrate ? "整理中" : "篩選中");
  try {
    const scan = await window.edex.scan(root);
    state.scan = scan;
    await refreshPlan();
    renderStats();
    if (!migrate) {
      state.desktopGrouped = true;
      state.desktopFilter = "all";
      persistLayout();
      await loadDesktopListing();
      arrangeDesktop();
      log("已依文件夾、圖標與檔案格式大類篩選顯示（未遷移檔案）");
      toast("已按格式大類篩選顯示，檔案仍在系統桌面");
      return;
    }
    if (!state.plan?.count) {
      toast("沒有需要遷移的項目");
      return;
    }
    if (!window.confirm(`將在系統桌面建立分類／副檔名資料夾並遷移 ${state.plan.count} 個項目。確定？`)) {
      return;
    }
    const result = await window.edex.organize(scan, { includeFolders: state.includeFolders });
    log(`已遷移 ${result.moved} 個項目到分類資料夾`);
    toast(`已遷移 ${result.moved} 個項目`);
    await doScan();
  } catch (err) {
    toast(err.message);
    log(`執行失敗：${err.message}`);
  } finally {
    state.busy = false;
    setText("st_mode", "待命");
  }
}

window.addEventListener("keydown", (event) => {
  if (!state.primary) return;
  if (event.key === "F10" || (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "s")) {
    event.preventDefault();
    openSettings();
  }
});

(async function start() {
  state.bootstrap = await window.edex.bootstrap();
  state.settings = state.bootstrap.settings || {};
  state.displays = state.bootstrap.displays || [];
  state.displayId = state.bootstrap.displayId ?? window.edex.displayId;
  state.displayIndex = state.bootstrap.displayIndex ?? window.edex.displayIndex ?? 0;
  state.primary = Boolean(state.bootstrap.primary ?? window.edex.isPrimary);
  state.bounds = state.bootstrap.bounds || {
    x: 0,
    y: 0,
    width: window.edex.launchWidth || window.innerWidth,
    height: window.edex.launchHeight || window.innerHeight
  };
  state.scaleFactor = state.bootstrap.scaleFactor || window.edex.launchScale || 1;
  state.physicalSize = state.bootstrap.physicalSize || null;
  state.themes = state.bootstrap.themes || [];
  state.wallpapers = state.bootstrap.wallpapers || [];
  state.themeName = state.bootstrap.themeName || "tron";
  state.includeFolders = Boolean(state.settings.includeFolders);

  // Prefer per-display layout; migrate legacy global layout onto primary once.
  let saved = state.bootstrap.displayLayout;
  if (!saved && state.primary && (state.settings.layout || state.settings.pathCards)) {
    saved = {
      layout: state.settings.layout,
      desktopStage: state.settings.desktopStage,
      pathCards: state.settings.pathCards,
      iconPositions: state.settings.iconPositions,
      iconView: state.settings.iconView
    };
  }

  state.iconView = (saved?.iconView || state.settings.iconView) === "list" ? "list" : "grid";
  state.iconPositions = saved?.iconPositions || {};
  if (state.settings?.layoutMode !== "4k" && state.settings?.layoutMode !== "2k") {
    state.settings = { ...state.settings, layoutMode: defaultLayoutMode() };
  }
  applyTheme(state.bootstrap.theme, state.settings.wallpaper || "grid");

  try {
    const fitted = await window.edex.refitDisplay();
    if (fitted?.bounds) {
      state.bounds = fitted.bounds;
      state.scaleFactor = fitted.scaleFactor || state.scaleFactor;
      state.physicalSize = fitted.physicalSize || state.physicalSize;
    }
  } catch {
    // Keep launch bounds if refit is unavailable.
  }
  applyUiMetrics();

  await boot();

  const defaults = defaultWidgets();
  state.layout = defaults;
  const savedLayout = saved?.layout || null;
  const oldSecondaryMirror = !state.primary && savedLayout && Object.keys(savedLayout).length
    && Object.keys(savedLayout).every((k) => ["clock", "status", "log"].includes(k));

  if (savedLayout && !oldSecondaryMirror) {
    state.layout = {};
    Object.keys(savedLayout).forEach((key) => {
      if (key === "status") return;
      if (!PANEL_META[key]) return;
      state.layout[key] = { ...(PANEL_META[key].box || {}), ...savedLayout[key] };
    });
  } else if (!state.primary) {
    state.layout = {};
  } else {
    state.layout = defaults;
  }

  state.desktopStage = saved?.desktopStage
    ? { ...defaultDesktop(), ...saved.desktopStage }
    : defaultDesktop();
  if (saved?.desktopBg && !state.desktopStage.bg) state.desktopStage.bg = saved.desktopBg;
  state.desktopEnabled = saved?.desktopEnabled !== false;
  state.desktopLocked = Boolean(saved?.desktopLocked);
  state.desktopGrouped = Boolean(saved?.desktopGrouped);
  state.desktopFilter = saved?.desktopFilter || "all";

  if (Array.isArray(saved?.pathCards) && saved.pathCards.length) {
    state.pathCards = saved.pathCards.filter((card) => card?.path && card.id !== "desktop");
  } else {
    state.pathCards = [];
  }
  state.activePathId = state.pathCards[0]?.id || null;

  snapAllLayoutToGrid();
  buildLayout();
  setText("info_user", state.bootstrap.username);
  setText("info_host", state.bootstrap.hostname);
  updateDisplayChip();
  renderPathCards();

  window.edex.onDisplaysChanged((payload) => {
    if (Array.isArray(payload)) {
      state.displays = payload;
    } else {
      state.displays = payload.displays || state.displays;
      if (payload.bounds) state.bounds = payload.bounds;
      if (payload.scaleFactor) state.scaleFactor = payload.scaleFactor;
      if (payload.displayId != null) state.displayId = payload.displayId;
      if (payload.index != null) state.displayIndex = payload.index;
      if (payload.physicalSize) state.physicalSize = payload.physicalSize;
    }
    updateDisplayChip();
  });

  window.edex.onSettingsUpdated((payload) => {
    const prevGrid = gridSize();
    const prevGridSetting = settingsGridSize();
    const prevClock = clockScale();
    const prevMode = layoutMode();
    const prevUi = displayUiScale();
    state.settings = payload.settings || state.settings;
    state.themeName = payload.themeName || state.themeName;
    if (payload.displays) state.displays = payload.displays;
    if (payload.theme) applyTheme(payload.theme, state.settings.wallpaper || "grid");
    else applyUiMetrics();
    applyClockMetrics();
    applyRainMetrics();
    updateDisplayChip();
    renderClock();
    if (
      settingsGridSize() !== prevGridSetting
      || gridSize() !== prevGrid
      || layoutMode() !== prevMode
      || displayUiScale() !== prevUi
    ) {
      snapAllLayoutToGrid();
      rebuildWorkspace();
    } else if (clockScale() !== prevClock) {
      applyClockMetrics();
      renderClock();
    }
  });

  window.edex.onReceiveWidget((widget) => receiveWidget(widget));
  setupDesktopClickThrough();

  window.addEventListener("resize", () => {
    applyUiMetrics();
    updateDisplayChip();
  });

  await doScan();
})();
