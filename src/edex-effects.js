/* Original eDEX-style globe / network / CPU / RAM / hardware helpers. */
(function () {
  let globeInstance = null;
  let globeGen = 0;
  let globeGrid = null;
  let animateTimer = null;
  let globeInitTimer = null;
  let netTimer = null;
  let trafficTimer = null;
  let cpuTimer = null;
  let memTimer = null;
  let sysTimer = null;
  let hwTimer = null;
  let topTimer = null;
  let trafficHistory = { up: [], down: [] };
  let cpuHistory = [];
  let memHistory = [];
  let memAnim = 0;
  let rainRaf = null;
  let rainObs = null;
  let rainState = null;
  let rainOpts = { fontSize: 14, speed: 1 };
  let bootGlyphs = "0123456789ABCDEFabcdefxyznul";
  let bootLogLoaded = false;

  function themeRgb() {
    const r = getComputedStyle(document.documentElement).getPropertyValue("--color_r").trim() || "170";
    const g = getComputedStyle(document.documentElement).getPropertyValue("--color_g").trim() || "207";
    const b = getComputedStyle(document.documentElement).getPropertyValue("--color_b").trim() || "209";
    return { r, g, b, css: `rgb(${r},${g},${b})` };
  }

  function stopGlobe() {
    globeGen += 1;
    if (animateTimer) clearTimeout(animateTimer);
    if (globeInitTimer) clearTimeout(globeInitTimer);
    animateTimer = globeInitTimer = null;
    const host = document.getElementById("mod_globe_innercontainer");
    host?.querySelector("canvas")?.remove();
    globeInstance = null;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function globeBox(host, placeholder) {
    const w = Math.floor(
      placeholder?.clientWidth
      || host.clientWidth
      || host.parentElement?.clientWidth
      || 220
    );
    const heading = [...host.children].reduce((sum, el) => {
      if (el === placeholder || el.tagName === "CANVAS" || el.tagName === "H3") return sum;
      return sum + (el.offsetHeight || 0);
    }, 0);
    const h = Math.floor(
      placeholder?.clientHeight
      || Math.max(0, host.clientHeight - heading)
      || Math.round(w * 0.92)
      || 180
    );
    return { w: Math.max(120, w), h: Math.max(120, h) };
  }

  async function initGlobe() {
    const gen = globeGen;
    const host = document.getElementById("mod_globe_innercontainer");
    const placeholder = document.getElementById("mod_globe_canvas_placeholder");
    if (!host || !window.ENCOM || !window.edex?.getGlobeGrid) return;

    host.querySelector("canvas")?.remove();

    try {
      if (!globeGrid?.tiles?.length) globeGrid = await window.edex.getGlobeGrid();
      if (gen !== globeGen) return;
      if (!globeGrid?.tiles?.length) throw new Error("missing globe tiles");

      let size = { w: 0, h: 0 };
      for (let i = 0; i < 40; i += 1) {
        size = globeBox(host, placeholder);
        if (size.w > 80 && size.h > 80) break;
        await wait(80);
        if (gen !== globeGen) return;
      }

      const color = themeRgb().css;
      const globeTheme = window.__edexTheme?.globe || {};
      globeInstance = new window.ENCOM.Globe(size.w, size.h, {
        font: "Rajdhani",
        data: [],
        tiles: globeGrid.tiles,
        baseColor: globeTheme.base || color,
        markerColor: globeTheme.marker || color,
        pinColor: globeTheme.pin || color,
        satelliteColor: globeTheme.satellite || color,
        scale: 1.05,
        viewAngle: 0.63,
        dayLength: 1000 * 45,
        introLinesDuration: 2000,
        introLinesColor: globeTheme.marker || color,
        maxPins: 300,
        maxMarkers: 100
      });

      if (gen !== globeGen) return;
      placeholder?.remove();
      const canvas = globeInstance.domElement;
      canvas.style.width = "100%";
      canvas.style.height = "auto";
      canvas.style.flex = "1 1 auto";
      host.appendChild(canvas);

      const bg = getComputedStyle(document.documentElement).getPropertyValue("--color_light_black").trim() || "#05080d";
      globeInstance.init(bg, () => {
        if (gen !== globeGen || !globeInstance) return;
        const tick = () => {
          if (gen !== globeGen || !globeInstance) return;
          globeInstance.tick();
          animateTimer = setTimeout(() => requestAnimationFrame(tick), 1000 / 24);
        };
        tick();
        setTimeout(() => {
          if (gen !== globeGen || !globeInstance) return;
          const constellation = [];
          for (let i = 0; i < 2; i += 1) {
            for (let j = 0; j < 3; j += 1) {
              constellation.push({
                lat: 50 * i - 30 + 15 * Math.random(),
                lon: 120 * j - 120 + 30 * i,
                altitude: Math.random() * 0.4 + 1.3
              });
            }
          }
          try { globeInstance.addConstellation(constellation); } catch { /* ignore */ }
        }, 2000);
      });
    } catch (err) {
      console.warn("globe init failed", err);
      if (placeholder) placeholder.textContent = "GLOBE OFFLINE";
    }
  }

  async function refreshNetstat() {
    const root = document.getElementById("mod_netstat");
    if (!root || !window.edex?.getNetStatus) return;
    const info = await window.edex.getNetStatus();
    const iname = document.getElementById("mod_netstat_iname");
    const stateEl = document.getElementById("mod_netstat_state")
      || document.querySelector("#mod_netstat_innercontainer > div:nth-child(1) > h2");
    const ipEl = document.getElementById("mod_netstat_ip")
      || document.querySelector("#mod_netstat_innercontainer > div:nth-child(2) > h2");
    const pingEl = document.getElementById("mod_netstat_ping")
      || document.querySelector("#mod_netstat_innercontainer > div:nth-child(3) > h2");
    if (iname) iname.textContent = info.iface ? `INTERFACE: ${info.iface}` : "INTERFACE: (OFFLINE)";
    if (stateEl) stateEl.textContent = info.state || (info.offline ? "OFFLINE" : "ONLINE");
    if (ipEl) ipEl.textContent = info.ip4 || info.externalIp || "--.--.--.--";
    if (pingEl) pingEl.textContent = info.ping != null ? `${info.ping}ms` : "--ms";
    root.classList.toggle("offline", Boolean(info.offline));
    const globe = document.getElementById("mod_globe");
    if (globe) globe.classList.toggle("offline", Boolean(info.offline));
    const header = document.querySelector(".mod_globe_headerInfo");
    if (header) header.textContent = info.externalIp || info.ip4 || "0.0000, 0.0000";
  }

  function toPoints(series, w, h, invert) {
    const max = Math.max(1, ...series);
    return series.map((v, i) => {
      const x = (i / Math.max(1, series.length - 1)) * w;
      const ratio = Math.max(0, Math.min(1, v / max));
      const y = invert ? 2.4 + ratio * (h - 5) : h - ratio * (h - 5) - 2.4;
      return { x, y };
    });
  }

  function strokeArcSpline(ctx, pts) {
    if (!pts.length) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    if (pts.length === 2) {
      ctx.lineTo(pts[1].x, pts[1].y);
      return;
    }
    for (let i = 0; i < pts.length - 1; i += 1) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
  }

  function drawSeries(canvas, series, palette, invert) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(40, canvas.clientWidth || 200);
    const h = Math.max(24, canvas.clientHeight || 40);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (series.length < 2) return;
    const pts = toPoints(series, w, h, invert);
    const fillBottom = invert ? 0 : h;

    ctx.save();
    strokeArcSpline(ctx, pts);
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, fillBottom);
    ctx.lineTo(pts[0].x, fillBottom);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, invert ? h : 0, 0, fillBottom);
    fill.addColorStop(0, palette.fill0);
    fill.addColorStop(1, palette.fill1);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 1.15;
    ctx.strokeStyle = palette.stroke;
    ctx.shadowColor = palette.glow;
    ctx.shadowBlur = 6;
    strokeArcSpline(ctx, pts);
    ctx.stroke();
    ctx.restore();
  }

  const CHART_COLORS = {
    up: { stroke: "#2ee6c7", glow: "rgba(46,230,199,0.55)", fill0: "rgba(46,230,199,0.22)", fill1: "rgba(46,230,199,0.02)" },
    down: { stroke: "#ffb347", glow: "rgba(255,179,71,0.5)", fill0: "rgba(255,179,71,0.22)", fill1: "rgba(255,179,71,0.02)" },
    cpuA: { stroke: "#5b8cff", glow: "rgba(91,140,255,0.35)", fill0: "rgba(91,140,255,0.1)", fill1: "rgba(91,140,255,0.01)" },
    cpuB: { stroke: "#e45cff", glow: "rgba(228,92,255,0.35)", fill0: "rgba(228,92,255,0.1)", fill1: "rgba(228,92,255,0.01)" },
    mem: { stroke: "#2ee6c7", glow: "rgba(46,230,199,0.45)", fill0: "rgba(46,230,199,0.28)", fill1: "rgba(46,230,199,0.02)" }
  };

  function coreStroke(i, total, base) {
    const t = total <= 1 ? 0 : i / (total - 1);
    const mix = (a, b) => Math.round(a + (b - a) * t);
    if (base === "a") {
      return `rgb(${mix(70, 150)}, ${mix(140, 200)}, ${mix(255, 180)})`;
    }
    return `rgb(${mix(180, 255)}, ${mix(70, 120)}, ${mix(255, 200)})`;
  }

  function toPointsFixed(series, w, h, maxValue) {
    const max = Math.max(1, maxValue || 100);
    return series.map((v, i) => {
      const x = (i / Math.max(1, series.length - 1)) * w;
      const ratio = Math.max(0, Math.min(1, v / max));
      const y = h - ratio * (h - 5) - 2.4;
      return { x, y };
    });
  }

  function drawMultiSeries(canvas, seriesList, colorKey) {
    if (!canvas || !seriesList?.length) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(40, canvas.clientWidth || 200);
    const h = Math.max(24, canvas.clientHeight || 40);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const usable = seriesList.filter((s) => s.length >= 2);
    if (!usable.length) return;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 1.05;
    usable.forEach((series, i) => {
      const pts = toPointsFixed(series.map((v) => Math.max(0, Math.min(100, v))), w, h, 100);
      ctx.strokeStyle = coreStroke(i, usable.length, colorKey);
      ctx.globalAlpha = 0.5 + (0.5 * (i + 1)) / usable.length;
      strokeArcSpline(ctx, pts);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  function ensureCoreBars(host, count) {
    if (!host) return [];
    if (host.childElementCount !== count) {
      host.innerHTML = Array.from({ length: count }, (_, i) => `
        <div class="cpu-core" data-core="${i}" title="Core ${i}">
          <div class="cpu-core-track">
            <i></i>
            <span class="cpu-core-idx">${i}</span>
          </div>
          <span class="cpu-core-pct">0</span>
        </div>
      `).join("");
    }
    return [...host.querySelectorAll(".cpu-core")];
  }

  function drawMemGauge(canvas, usedPct, availPct) {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const size = Math.max(72, Math.min(canvas.clientWidth || 120, canvas.clientHeight || 120));
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.38;
    const rgb = themeRgb();
    const start = -Math.PI * 0.75;
    const span = Math.PI * 1.5;

    ctx.lineWidth = size * 0.08;
    ctx.lineCap = "round";
    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.14)`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + span);
    ctx.stroke();

    const used = Math.max(0, Math.min(1, usedPct / 100));
    ctx.strokeStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    ctx.shadowColor = `rgba(${rgb.r},${rgb.g},${rgb.b},0.55)`;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, r, start, start + span * used);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const avail = Math.max(0, Math.min(1 - used, availPct / 100));
    ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.35)`;
    ctx.lineWidth = size * 0.05;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.72, start + span * used, start + span * (used + avail));
    ctx.stroke();

    ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
    ctx.font = `600 ${Math.round(size * 0.22)}px Rajdhani, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${Math.round(usedPct)}%`, cx, cy - size * 0.02);
    ctx.globalAlpha = 0.55;
    ctx.font = `500 ${Math.round(size * 0.1)}px Rajdhani, sans-serif`;
    ctx.fillText("USED", cx, cy + size * 0.16);
    ctx.globalAlpha = 1;
  }

  function prettyBytes(n) {
    if (!Number.isFinite(n)) return "0 B";
    const u = ["B", "KB", "MB", "GB"];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < u.length - 1) {
      v /= 1024;
      i += 1;
    }
    return `${v.toFixed(i ? 1 : 0)} ${u[i]}`;
  }

  async function refreshTraffic() {
    const box = document.getElementById("mod_conninfo");
    if (!box || !window.edex?.getNetTraffic) return;
    const sample = await window.edex.getNetTraffic();
    trafficHistory.up.push(sample.upBps || 0);
    trafficHistory.down.push(sample.downBps || 0);
    if (trafficHistory.up.length > 72) trafficHistory.up.shift();
    if (trafficHistory.down.length > 72) trafficHistory.down.shift();
    drawSeries(document.getElementById("mod_conninfo_canvas_top"), trafficHistory.up, CHART_COLORS.up, false);
    drawSeries(document.getElementById("mod_conninfo_canvas_bottom"), trafficHistory.down, CHART_COLORS.down, true);
    const current = document.querySelector("#mod_conninfo_innercontainer > h1 > i");
    const total = document.querySelector("#mod_conninfo_innercontainer > h2 > i");
    if (current) {
      current.textContent = `UP / DOWN, ${prettyBytes(sample.upBps || 0)}/S · ${prettyBytes(sample.downBps || 0)}/S`;
    }
    if (total) {
      total.textContent = `${prettyBytes(sample.totalUp || 0)} OUT, ${prettyBytes(sample.totalDown || 0)} IN`;
    }
  }

  async function refreshCpu() {
    if (!document.getElementById("mod_cpuinfo") || !window.edex?.getCpuMetrics) return;
    const cpu = await window.edex.getCpuMetrics();
    const cores = Math.max(1, cpu.cores || cpu.percents?.length || 1);
    const percents = (cpu.percents || []).slice(0, cores);
    while (percents.length < cores) percents.push(0);

    if (cpuHistory.length !== cores) {
      cpuHistory = Array.from({ length: cores }, () => []);
    }
    percents.forEach((p, i) => {
      cpuHistory[i].push(p);
      if (cpuHistory[i].length > 60) cpuHistory[i].shift();
    });

    const name = document.querySelector("#mod_cpuinfo_innercontainer > h1 > i");
    if (name) name.textContent = `${cpu.name} · ${cpu.avg.toFixed(0)}%`;

    const bars = ensureCoreBars(document.getElementById("mod_cpuinfo_corebars"), cores);
    bars.forEach((el, i) => {
      const pct = Math.max(0, Math.min(100, percents[i] || 0));
      const fill = el.querySelector("i");
      const label = el.querySelector(".cpu-core-pct");
      if (fill) fill.style.height = `${pct}%`;
      if (label) label.textContent = `${pct.toFixed(0)}`;
      el.classList.toggle("hot", pct >= 85);
      el.classList.toggle("warm", pct >= 55 && pct < 85);
    });

    const mid = Math.max(1, Math.floor(cores / 2));
    const seriesA = cpuHistory.slice(0, mid);
    const seriesB = cpuHistory.slice(mid);
    drawMultiSeries(document.getElementById("mod_cpuinfo_canvas_0"), seriesA, "a");
    drawMultiSeries(document.getElementById("mod_cpuinfo_canvas_1"), seriesB, "b");

    const avg = (list) => {
      if (!list.length) return 0;
      const last = list.map((s) => s[s.length - 1] || 0);
      return last.reduce((a, b) => a + b, 0) / last.length;
    };
    const c0 = document.getElementById("mod_cpuinfo_usagecounter0");
    const c1 = document.getElementById("mod_cpuinfo_usagecounter1");
    const r0 = document.getElementById("mod_cpuinfo_range0");
    const r1 = document.getElementById("mod_cpuinfo_range1");
    if (r0) r0.textContent = `1-${mid}`;
    if (r1) r1.textContent = `${mid + 1}-${cores}`;
    if (c0) c0.textContent = `Avg. ${avg(seriesA).toFixed(0)}%`;
    if (c1) c1.textContent = `Avg. ${avg(seriesB).toFixed(0)}%`;

    const temp = document.getElementById("mod_cpuinfo_temp");
    if (temp) temp.textContent = String(cores);
    const mn = document.getElementById("mod_cpuinfo_speed_min");
    const mx = document.getElementById("mod_cpuinfo_speed_max");
    if (mn) mn.textContent = `${cpu.speedMin.toFixed(2)}GHz`;
    if (mx) mx.textContent = `${cpu.speedMax.toFixed(2)}GHz`;
  }

  async function refreshMem() {
    const root = document.getElementById("mod_ramwatcher");
    if (!root || !window.edex?.getMemMetrics) return;
    const mem = await window.edex.getMemMetrics();
    const total = Math.max(1, mem.total || 1);
    const used = Math.max(0, mem.used || 0);
    const free = Math.max(0, mem.free || 0);
    const available = Math.max(0, Math.min(free, mem.available != null ? mem.available : free));
    const usedPct = (used / total) * 100;
    const freePct = (free / total) * 100;
    const availPct = Math.max(0, Math.min(freePct, (available / total) * 100 * 0.35));
    const freeRemain = Math.max(0, freePct - availPct);

    memAnim += (usedPct - memAnim) * 0.28;
    drawMemGauge(document.getElementById("mod_ramwatcher_gauge"), memAnim, availPct);

    const usedSeg = document.getElementById("mod_ramwatcher_used_seg");
    const availSeg = document.getElementById("mod_ramwatcher_avail_seg");
    const freeSeg = document.getElementById("mod_ramwatcher_free_seg");
    if (usedSeg) usedSeg.style.width = `${usedPct}%`;
    if (availSeg) availSeg.style.width = `${availPct}%`;
    if (freeSeg) freeSeg.style.width = `${freeRemain}%`;
    const setTxt = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = `${Math.round(v)}%`;
    };
    setTxt("mod_ramwatcher_used_pct", usedPct);
    setTxt("mod_ramwatcher_avail_pct", availPct);
    setTxt("mod_ramwatcher_free_pct", freeRemain);

    memHistory.push(usedPct);
    if (memHistory.length > 48) memHistory.shift();
    const wave = document.getElementById("mod_ramwatcher_wave");
    if (wave && memHistory.length >= 2) {
      const ctx = wave.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(40, wave.clientWidth || 200);
      const h = Math.max(24, wave.clientHeight || 40);
      wave.width = Math.floor(w * dpr);
      wave.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const pts = toPointsFixed(memHistory, w, h, 100);
      const palette = CHART_COLORS.mem;
      ctx.save();
      strokeArcSpline(ctx, pts);
      ctx.lineTo(pts[pts.length - 1].x, h);
      ctx.lineTo(pts[0].x, h);
      ctx.closePath();
      const fill = ctx.createLinearGradient(0, 0, 0, h);
      fill.addColorStop(0, palette.fill0);
      fill.addColorStop(1, palette.fill1);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.restore();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = palette.stroke;
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 5;
      strokeArcSpline(ctx, pts);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    const gib = (v) => (v / 1073741824).toFixed(1);
    const info = document.getElementById("mod_ramwatcher_info");
    if (info) info.textContent = `USING ${gib(used)} / ${gib(total)} GiB`;
    const swapBar = document.getElementById("mod_ramwatcher_swapbar");
    const swapText = document.getElementById("mod_ramwatcher_swaptext");
    if (swapBar) swapBar.value = Math.min(100, usedPct);
    if (swapText) swapText.textContent = `${gib(free)} GiB free`;
  }

  async function refreshSys() {
    if (!document.getElementById("sys_uptime") || !window.edex?.getSysMetrics) return;
    const s = await window.edex.getSysMetrics();
    const year = document.getElementById("sys_year");
    const month = document.getElementById("sys_month");
    const uptime = document.getElementById("sys_uptime");
    const type = document.getElementById("sys_type");
    const power = document.getElementById("sys_power");
    if (year) year.textContent = s.year;
    if (month) month.textContent = s.monthDay;
    if (uptime) uptime.textContent = s.uptime;
    if (type) type.textContent = s.type;
    if (power) power.textContent = s.power;
  }

  async function refreshHardware() {
    if (!document.getElementById("mod_hardwareInspector") || !window.edex?.getHardwareInfo) return;
    const info = await window.edex.getHardwareInfo();
    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v || "NONE";
    };
    set("mod_hardwareInspector_manufacturer", info.manufacturer);
    set("mod_hardwareInspector_model", info.model);
    set("mod_hardwareInspector_chassis", info.chassis);
  }

  async function refreshToplist() {
    const table = document.getElementById("mod_toplist_table");
    if (!table || !window.edex?.getTopProcesses) return;
    const data = await window.edex.getTopProcesses();
    const rows = data.list || [];
    table.innerHTML = rows.map((p) =>
      `<tr><td>${p.pid}</td><td><strong>${p.name}</strong></td><td>${p.cpu}</td><td>${p.mem}%</td></tr>`
    ).join("");
    const tasks = document.getElementById("mod_cpuinfo_tasks");
    if (tasks && data.tasks != null) tasks.textContent = String(data.tasks);
  }

  function start() {
    stop();
    if (document.getElementById("mod_globe")) {
      globeInitTimer = setTimeout(() => initGlobe(), 400);
    }
    if (document.getElementById("mod_netstat")) {
      refreshNetstat();
      netTimer = setInterval(refreshNetstat, 2500);
    }
    if (document.getElementById("mod_conninfo")) {
      refreshTraffic();
      trafficTimer = setInterval(refreshTraffic, 1000);
    }
    if (document.getElementById("mod_cpuinfo")) {
      refreshCpu();
      cpuTimer = setInterval(refreshCpu, 1000);
    }
    if (document.getElementById("mod_ramwatcher")) {
      refreshMem();
      memTimer = setInterval(refreshMem, 1000);
    }
    if (document.getElementById("sys_uptime")) {
      refreshSys();
      sysTimer = setInterval(refreshSys, 1000);
    }
    if (document.getElementById("mod_hardwareInspector")) {
      refreshHardware();
      hwTimer = setInterval(refreshHardware, 20000);
    }
    if (document.getElementById("mod_toplist_table")) {
      refreshToplist();
      topTimer = setInterval(refreshToplist, 2500);
    }
    if (document.getElementById("mod_coderain_canvas")) startRain();
  }

  function stopRain() {
    if (rainRaf) cancelAnimationFrame(rainRaf);
    rainRaf = null;
    rainObs?.disconnect();
    rainObs = null;
    rainState = null;
  }

  function decodeBootLog(text) {
    return String(text || "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, "&");
  }

  async function loadBootLog() {
    if (bootLogLoaded) return;
    bootLogLoaded = true;
    try {
      const res = await fetch("assets/misc/boot_log.txt");
      const text = decodeBootLog(await res.text());
      const set = new Set(bootGlyphs.split(""));
      for (const ch of text) {
        if (ch.trim() && ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127) set.add(ch);
      }
      bootGlyphs = [...set].join("") || bootGlyphs;
    } catch {
      bootLogLoaded = false;
    }
  }

  function setRainOptions(opts = {}) {
    if (Number.isFinite(Number(opts.fontSize))) {
      rainOpts.fontSize = Math.max(8, Math.min(72, Math.round(Number(opts.fontSize))));
    }
    if (Number.isFinite(Number(opts.speed))) {
      rainOpts.speed = Math.max(0.1, Math.min(8, Number(opts.speed)));
    }
    const canvas = document.getElementById("mod_coderain_canvas");
    if (canvas && rainState) layoutRain(canvas);
    else if (canvas && !rainRaf) startRain();
  }

  function layoutRain(canvas) {
    const host = document.getElementById("mod_coderain_stream") || canvas?.parentElement;
    if (!canvas || !host) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(48, canvas.clientWidth || host.clientWidth || 200);
    const h = Math.max(48, canvas.clientHeight || host.clientHeight || 120);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const font = rainOpts.fontSize;
    const cols = Math.max(4, Math.floor(w / Math.max(6, font * 0.85)));
    const oldDrops = rainState?.drops || [];
    rainState = {
      ctx,
      w,
      h,
      cols,
      drops: Array.from({ length: cols }, (_, i) => oldDrops[i] ?? Math.random() * (h / font)),
      baseSpeed: Array.from({ length: cols }, () => 0.18 + Math.random() * 0.55)
    };
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color_light_black").trim() || "#05080d";
    ctx.fillRect(0, 0, w, h);
  }

  function startRain() {
    stopRain();
    const canvas = document.getElementById("mod_coderain_canvas");
    const host = document.getElementById("mod_coderain_stream") || canvas?.parentElement;
    if (!canvas || !host) return;
    loadBootLog();
    layoutRain(canvas);
    rainObs = new ResizeObserver(() => {
      if (document.getElementById("mod_coderain_canvas")) layoutRain(canvas);
    });
    rainObs.observe(host);

    const tick = () => {
      if (!document.getElementById("mod_coderain_canvas") || !rainState) {
        rainRaf = null;
        return;
      }
      const { ctx, w, h, cols, drops, baseSpeed } = rainState;
      const font = rainOpts.fontSize;
      const rgb = themeRgb();
      ctx.fillStyle = "rgba(5, 8, 13, 0.18)";
      ctx.fillRect(0, 0, w, h);
      ctx.font = `${font}px "Share Tech Mono", ui-monospace, monospace`;
      ctx.textBaseline = "top";
      const colW = Math.max(6, font * 0.85);
      const glyphs = bootGlyphs;
      for (let i = 0; i < cols; i += 1) {
        const x = i * colW;
        const y = drops[i] * font;
        const head = glyphs.charAt(Math.floor(Math.random() * glyphs.length)) || "0";
        const trail = glyphs.charAt(Math.floor(Math.random() * glyphs.length)) || "1";
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.28)`;
        ctx.fillText(trail, x, y - font);
        ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.9)`;
        ctx.fillText(head, x, y);
        drops[i] += (baseSpeed[i] || 0.4) * rainOpts.speed;
        if (y > h && Math.random() > 0.96) drops[i] = -Math.random() * 12;
      }
      rainRaf = requestAnimationFrame(tick);
    };
    rainRaf = requestAnimationFrame(tick);
  }

  function stop() {
    if (netTimer) clearInterval(netTimer);
    if (trafficTimer) clearInterval(trafficTimer);
    if (cpuTimer) clearInterval(cpuTimer);
    if (memTimer) clearInterval(memTimer);
    if (sysTimer) clearInterval(sysTimer);
    if (hwTimer) clearInterval(hwTimer);
    if (topTimer) clearInterval(topTimer);
    netTimer = trafficTimer = cpuTimer = memTimer = sysTimer = hwTimer = topTimer = null;
    stopRain();
    stopGlobe();
  }

  window.edexEffects = { start, stop, initGlobe, refreshNetstat, setRainOptions };
})();
