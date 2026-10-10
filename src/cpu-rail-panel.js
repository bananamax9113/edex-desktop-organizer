/* CPU power-rail schematic — pins fan out to four sides + transition glow */

(function () {
  const VIEW_W = 720;
  const VIEW_H = 460;
  // Chip centered so rails can radiate evenly
  const CHIP = { x: 276, y: 146, w: 168, h: 168 };

  function detectBrand(name) {
    const s = String(name || "");
    if (/apple|m[1-4](\s|$)|m[1-4]\s*(pro|max|ultra)/i.test(s)) return "apple";
    if (/amd|ryzen|epyc|athlon|threadripper|radeon/i.test(s)) return "amd";
    if (/intel|core\b|xeon|pentium|celeron|ultra\s*\d/i.test(s)) return "intel";
    return "generic";
  }

  function shortModel(name, brand) {
    let s = String(name || "CPU").replace(/\s+/g, " ").trim();
    s = s
      .replace(/\(R\)|\(TM\)|®|™/gi, "")
      .replace(/CPU\s*@.*$/i, "")
      .replace(/with\s+Radeon.*$/i, "")
      .trim();
    if (brand === "intel") {
      const m = s.match(/(Core\s*(Ultra\s*)?[iI]?\d?[-\s]?\w[\w-]*)/i)
        || s.match(/(Xeon\s+[\w-]+)/i)
        || s.match(/(Pentium\s+[\w-]+)/i);
      if (m) return m[1].replace(/\s+/g, " ").trim();
    }
    if (brand === "amd") {
      const m = s.match(/(Ryzen\s+\d+\s+\w[\w\s-]*)/i)
        || s.match(/(EPYC\s+[\w-]+)/i)
        || s.match(/(Threadripper\s+[\w\s-]+)/i);
      if (m) return m[1].replace(/\s+/g, " ").trim();
    }
    if (brand === "apple") {
      const m = s.match(/(Apple\s+)?(M[1-4](\s*(Pro|Max|Ultra))?)/i);
      if (m) return `Apple ${m[2]}`.replace(/\s+/g, " ").trim();
    }
    return s.length > 36 ? `${s.slice(0, 34)}…` : s;
  }

  function logoSvg(brand) {
    if (brand === "intel") {
      // Classic intel wordmark inside oval swoosh
      return `
        <svg class="cpu-rail-logo-mark brand-intel" viewBox="0 0 120 48" aria-hidden="true">
          <ellipse cx="60" cy="24" rx="56" ry="20" fill="none" stroke="currentColor" stroke-width="2.2"/>
          <text x="60" y="30" text-anchor="middle"
            font-family="Arial Black, Arial, sans-serif" font-size="22" font-weight="800"
            letter-spacing="-0.04em" fill="currentColor">intel</text>
        </svg>`;
    }
    if (brand === "amd") {
      // AMD arrow mark + wordmark
      return `
        <svg class="cpu-rail-logo-mark brand-amd" viewBox="0 0 120 48" aria-hidden="true">
          <path fill="currentColor" d="M8 38 L28 8 H48 L28 38 Z"/>
          <path fill="currentColor" d="M40 38 L60 8 H80 L60 38 Z"/>
          <text x="88" y="34" text-anchor="middle"
            font-family="Arial Black, Arial, sans-serif" font-size="18" font-weight="800"
            letter-spacing="0.06em" fill="currentColor">AMD</text>
        </svg>`;
    }
    if (brand === "apple") {
      return `
        <svg class="cpu-rail-logo-mark brand-apple" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="currentColor" d="M33.4 14.1c-1.9 0-3.6 1.1-4.7 2.4-1 1.2-1.9 3.2-1.6 5.1 2 0.1 4-1.1 5.1-2.4 1.1-1.3 1.9-3.2 1.3-5.1zM35 21.7c-2.9-.1-5.3 2-6.7 2-1.3 0-3.3-1.9-5.6-1.9-2.9 0-5.6 1.7-7.1 4.3-3.1 5.2-.8 12.9 2.1 17.2 1.5 2 3.2 4.3 5.5 4.2 2.1 0 2.9-1.3 5.6-1.3s3.3 1.3 5.6 1.3c2.3 0 3.9-2 5.3-4.1 1.6-2.4 2.3-4.7 2.3-4.8-.1 0-4.4-1.7-4.4-6.7-.1-4.1 3.5-6 3.6-6.1-2-2.9-5.1-3.3-6.2-3.4z"/>
        </svg>`;
    }
    return `
      <svg class="cpu-rail-logo-mark brand-generic" viewBox="0 0 72 40" aria-hidden="true">
        <rect x="6" y="6" width="60" height="28" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>
        <rect x="14" y="14" width="8" height="12" fill="currentColor" opacity="0.85"/>
        <rect x="26" y="12" width="8" height="16" fill="currentColor" opacity="0.7"/>
        <rect x="38" y="15" width="8" height="10" fill="currentColor" opacity="0.9"/>
        <rect x="50" y="13" width="8" height="14" fill="currentColor" opacity="0.65"/>
      </svg>`;
  }

  /** Die floorplan inside chip package — cores, cache, mesh with flow */
  function chipDieMarkup() {
    const { x, y, w, h } = CHIP;
    const pad = 14;
    const ix = x + pad;
    const iy = y + pad;
    const iw = w - pad * 2;
    const ih = h - pad * 2;
    const cols = 4;
    const rows = 3;
    const gap = 4;
    const cacheH = 18;
    const coreAreaH = ih - cacheH - gap * 2 - 8;
    const cellW = (iw - gap * (cols - 1)) / cols;
    const cellH = (coreAreaH - gap * (rows - 1)) / rows;
    const parts = [];

    // Die outline
    parts.push(`<rect class="cpu-die-outline" x="${ix}" y="${iy}" width="${iw}" height="${ih}"/>`);

    // Core grid
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = ix + c * (cellW + gap);
        const cy = iy + 6 + r * (cellH + gap);
        const delay = ((r * cols + c) * 0.18).toFixed(2);
        parts.push(`<rect class="cpu-die-core" x="${cx}" y="${cy}" width="${cellW}" height="${cellH}"
          style="animation-delay:-${delay}s"/>`);
        // Mini crosshair inside each core
        const mx = cx + cellW / 2;
        const my = cy + cellH / 2;
        parts.push(`<path class="cpu-die-core-x" d="M ${cx + 3} ${my} H ${cx + cellW - 3} M ${mx} ${cy + 3} V ${cy + cellH - 3}"/>`);
      }
    }

    // Mesh interconnect (between cores)
    const mesh = [];
    for (let r = 0; r <= rows; r++) {
      const my = iy + 6 + r * (cellH + gap) - gap / 2;
      if (r === 0) continue;
      if (r === rows) continue;
      mesh.push(`M ${ix + 2} ${my} H ${ix + iw - 2}`);
    }
    for (let c = 0; c <= cols; c++) {
      if (c === 0 || c === cols) continue;
      const mx = ix + c * (cellW + gap) - gap / 2;
      mesh.push(`M ${mx} ${iy + 8} V ${iy + 6 + coreAreaH}`);
    }
    parts.push(`<path class="cpu-die-mesh pulse" d="${mesh.join(" ")}"/>`);

    // Shared cache / uncore bar
    const cacheY = iy + ih - cacheH - 4;
    parts.push(`<rect class="cpu-die-cache" x="${ix}" y="${cacheY}" width="${iw}" height="${cacheH}"/>`);
    // Two cache flow stripes (was 5) — enough motion, less paint work.
    for (let i = 0; i < 2; i++) {
      const sx = ix + 10 + i * ((iw - 20) / 1);
      parts.push(`<path class="cpu-die-cache-line pulse" d="M ${sx} ${cacheY + 4} V ${cacheY + cacheH - 4}"
        style="animation-delay:-${(i * 0.45).toFixed(2)}s"/>`);
    }

    // Ring bus around die
    parts.push(`<rect class="cpu-die-ring pulse" x="${ix - 3}" y="${iy - 3}" width="${iw + 6}" height="${ih + 6}"/>`);

    // Corner bond pads
    [[ix - 1, iy - 1], [ix + iw - 5, iy - 1], [ix - 1, iy + ih - 5], [ix + iw - 5, iy + ih - 5]].forEach((p, i) => {
      parts.push(`<rect class="cpu-die-bond" x="${p[0]}" y="${p[1]}" width="6" height="6"
        style="animation-delay:-${(i * 0.4).toFixed(2)}s"/>`);
    });

    // Skip SMIL bead on die ring — CSS dash animation is enough and stays GPU-cheap.

    return `<g class="cpu-die">${parts.join("")}</g>`;
  }

  function brandLabel(brand) {
    if (brand === "intel") return "INTEL";
    if (brand === "amd") return "AMD";
    if (brand === "apple") return "APPLE";
    return "PROCESSOR";
  }

  function rng(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  /** Orthogonal fan path: pin → out → side branch → terminal */
  function fanPath(pin, terminal, branch) {
    const sx = pin.x + pin.ox;
    const sy = pin.y + pin.oy;
    const pts = [[sx, sy]];
    const side = pin.side;
    const out = 18 + branch * 22;

    if (side === "left") {
      const mx = sx - out;
      pts.push([mx, sy]);
      if (Math.abs(terminal.y - sy) > 6) pts.push([mx, terminal.y]);
      pts.push([terminal.x, terminal.y]);
    } else if (side === "right") {
      const mx = sx + out;
      pts.push([mx, sy]);
      if (Math.abs(terminal.y - sy) > 6) pts.push([mx, terminal.y]);
      pts.push([terminal.x, terminal.y]);
    } else if (side === "top") {
      const my = sy - out;
      pts.push([sx, my]);
      if (Math.abs(terminal.x - sx) > 6) pts.push([terminal.x, my]);
      pts.push([terminal.x, terminal.y]);
    } else {
      const my = sy + out;
      pts.push([sx, my]);
      if (Math.abs(terminal.x - sx) > 6) pts.push([terminal.x, my]);
      pts.push([terminal.x, terminal.y]);
    }

    // Deduplicate consecutive points
    const clean = [];
    for (const p of pts) {
      const prev = clean[clean.length - 1];
      if (prev && prev[0] === p[0] && prev[1] === p[1]) continue;
      clean.push(p);
    }
    return clean;
  }

  function ptsToD(pts) {
    if (!pts.length) return "";
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    return d;
  }

  function pathLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return Math.max(1, len);
  }

  function buildSchematic(seed = 13) {
    const rand = rng(seed);
    const { x: cx, y: cy, w: cw, h: ch } = CHIP;
    const pinLen = 10;
    const pins = [];
    const traces = [];
    const vias = [];
    const pads = [];
    const comps = [];
    const nodes = []; // transition glow nodes (corners / vias)

    const margin = 22;
    const nTB = 14;
    const nLR = 14;

    const addPin = (side, i, n) => {
      let px;
      let py;
      let ox;
      let oy;
      if (side === "top") {
        px = cx + 16 + i * ((cw - 32) / Math.max(1, n - 1));
        py = cy;
        ox = 0;
        oy = -pinLen;
      } else if (side === "bottom") {
        px = cx + 16 + i * ((cw - 32) / Math.max(1, n - 1));
        py = cy + ch;
        ox = 0;
        oy = pinLen;
      } else if (side === "left") {
        px = cx;
        py = cy + 16 + i * ((ch - 32) / Math.max(1, n - 1));
        ox = -pinLen;
        oy = 0;
      } else {
        px = cx + cw;
        py = cy + 16 + i * ((ch - 32) / Math.max(1, n - 1));
        ox = pinLen;
        oy = 0;
      }
      pins.push({
        x: Math.round(px * 10) / 10,
        y: Math.round(py * 10) / 10,
        ox,
        oy,
        side,
        index: i,
        n
      });
    };

    for (let i = 0; i < nTB; i++) {
      addPin("top", i, nTB);
      addPin("bottom", i, nTB);
    }
    for (let i = 0; i < nLR; i++) {
      addPin("left", i, nLR);
      addPin("right", i, nLR);
    }

    /** Spread terminals evenly along each outer edge */
    function edgeTerminals(side, count) {
      const out = [];
      for (let i = 0; i < count; i++) {
        const t = (i + 0.5) / count;
        const jitter = (rand() - 0.5) * 10;
        if (side === "left") {
          out.push({
            x: margin + rand() * 36,
            y: Math.max(margin, Math.min(VIEW_H - margin, margin + t * (VIEW_H - margin * 2) + jitter))
          });
        } else if (side === "right") {
          out.push({
            x: VIEW_W - margin - rand() * 36,
            y: Math.max(margin, Math.min(VIEW_H - margin, margin + t * (VIEW_H - margin * 2) + jitter))
          });
        } else if (side === "top") {
          out.push({
            x: Math.max(margin, Math.min(VIEW_W - margin, margin + t * (VIEW_W - margin * 2) + jitter)),
            y: margin + rand() * 28
          });
        } else {
          out.push({
            x: Math.max(margin, Math.min(VIEW_W - margin, margin + t * (VIEW_W - margin * 2) + jitter)),
            y: VIEW_H - margin - rand() * 28
          });
        }
      }
      return out;
    }

    const terminalsBySide = {
      left: edgeTerminals("left", nLR),
      right: edgeTerminals("right", nLR),
      top: edgeTerminals("top", nTB),
      bottom: edgeTerminals("bottom", nTB)
    };

    const sideCursor = { left: 0, right: 0, top: 0, bottom: 0 };

    pins.forEach((pin) => {
      // Skip a few pins for visual breathing room
      if (rand() < 0.12) return;

      const list = terminalsBySide[pin.side];
      const ti = Math.min(sideCursor[pin.side]++, list.length - 1);
      const terminal = list[ti];
      const branch = (pin.index % 4) + rand() * 0.8;
      const pts = fanPath(pin, terminal, branch);
      const d = ptsToD(pts);
      const len = pathLength(pts);
      // Fewer animated traces → much lower compositor / paint cost.
      const glow = rand() > 0.72;

      traces.push({
        d,
        len,
        pulse: glow,
        slow: rand() > 0.55,
        delay: rand() * 2.4
      });

      // Transition nodes at every corner of the fan path
      for (let i = 1; i < pts.length - 1; i++) {
        nodes.push({
          x: pts[i][0],
          y: pts[i][1],
          delay: rand() * 2.8,
          bright: rand() > 0.55
        });
      }

      // Terminal hardware
      const kind = rand();
      if (kind < 0.32) {
        vias.push({ x: terminal.x, y: terminal.y, r: 2.6, glow: true, delay: rand() * 2 });
      } else if (kind < 0.52) {
        pads.push({ x: terminal.x - 3, y: terminal.y - 3, w: 6, h: 6 });
        nodes.push({ x: terminal.x, y: terminal.y, delay: rand() * 2, bright: true });
      } else if (kind < 0.72) {
        const horiz = pin.side === "left" || pin.side === "right" ? rand() > 0.35 : rand() > 0.5;
        comps.push({
          type: "res",
          x: terminal.x - (horiz ? 11 : 3),
          y: terminal.y - (horiz ? 3 : 11),
          w: horiz ? 22 : 6,
          h: horiz ? 6 : 22
        });
      } else if (kind < 0.88) {
        comps.push({
          type: "ic",
          x: terminal.x - 14,
          y: terminal.y - 9,
          w: 28,
          h: 18
        });
      } else {
        const cols = 2 + Math.floor(rand() * 2);
        const rows = 2 + Math.floor(rand() * 2);
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            pads.push({ x: terminal.x + c * 5.2, y: terminal.y + r * 5.2, w: 2.4, h: 2.4 });
          }
        }
        nodes.push({ x: terminal.x + 4, y: terminal.y + 4, delay: rand() * 1.5, bright: true });
      }
    });

    // Cross-bus rails that ring the chip (power planes feel)
    const ringGap = 36;
    const ring = [
      [
        [cx - ringGap, cy - ringGap],
        [cx + cw + ringGap, cy - ringGap],
        [cx + cw + ringGap, cy + ch + ringGap],
        [cx - ringGap, cy + ch + ringGap],
        [cx - ringGap, cy - ringGap]
      ]
    ];
    ring.forEach((pts) => {
      traces.push({
        d: ptsToD(pts),
        len: pathLength(pts),
        pulse: true,
        slow: true,
        ring: true,
        delay: 0.4
      });
    });
    // Four ring corner glow nodes
    [
      [cx - ringGap, cy - ringGap],
      [cx + cw + ringGap, cy - ringGap],
      [cx + cw + ringGap, cy + ch + ringGap],
      [cx - ringGap, cy + ch + ringGap]
    ].forEach((p, i) => {
      nodes.push({ x: p[0], y: p[1], delay: i * 0.55, bright: true });
      vias.push({ x: p[0], y: p[1], r: 3.2, glow: true, delay: i * 0.55 });
    });

    return { pins, traces, vias, pads, comps, nodes };
  }

  function schematicSvg(data) {
    // No SVG feGaussianBlur — those force CPU rasterization every frame.
    const pinRects = data.pins.map((p) => {
      if (p.ox !== 0) {
        const x = Math.min(p.x, p.x + p.ox);
        return `<rect class="cpu-rail-pin" x="${x}" y="${p.y - 1.5}" width="${Math.abs(p.ox)}" height="3"/>`;
      }
      const y = Math.min(p.y, p.y + p.oy);
      return `<rect class="cpu-rail-pin" x="${p.x - 1.5}" y="${y}" width="3" height="${Math.abs(p.oy)}"/>`;
    }).join("");

    const tracePaths = data.traces.map((t, i) => {
      const cls = [
        "cpu-rail-trace",
        t.pulse ? "pulse" : "",
        t.slow ? "slow" : "",
        t.ring ? "ring" : ""
      ].filter(Boolean).join(" ");
      const dash = Math.max(40, Math.round(t.len || 80));
      return `<path class="${cls}" d="${t.d}" pathLength="${dash}"/>`;
    }).join("");

    // No SMIL beads / CSS dash animation — static nodes only (GPU idle after paint).
    const beadsFixed = "";

    const viaEls = data.vias.filter((_, i) => i % 3 === 0).map((v) =>
      `<g class="cpu-rail-via-wrap${v.glow ? " glow" : ""}">
        <circle class="cpu-rail-via-halo" cx="${v.x}" cy="${v.y}" r="${(v.r || 2.4) + 3.5}"/>
        <circle class="cpu-rail-via" cx="${v.x}" cy="${v.y}" r="${v.r || 2.4}"/>
      </g>`
    ).join("");

    const padEls = data.pads.map((p) =>
      `<rect class="cpu-rail-pad" x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}"/>`
    ).join("");

    const nodeEls = data.nodes.filter((_, i) => i % 4 === 0).map((n) =>
      `<g class="cpu-rail-node${n.bright ? " bright" : ""}">
        <circle class="cpu-rail-node-halo" cx="${n.x}" cy="${n.y}" r="6"/>
        <circle class="cpu-rail-node-core" cx="${n.x}" cy="${n.y}" r="2.1"/>
      </g>`
    ).join("");

    const compEls = data.comps.map((c) => {
      if (c.type === "res") {
        return `<rect class="cpu-rail-comp-fill" x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}"/>`;
      }
      let pins = "";
      for (let i = 0; i < 4; i++) {
        const py = c.y + 3 + i * 3.4;
        pins += `<rect class="cpu-rail-pad" x="${c.x - 3}" y="${py}" width="3" height="1.5"/>`;
        pins += `<rect class="cpu-rail-pad" x="${c.x + c.w}" y="${py}" width="3" height="1.5"/>`;
      }
      return `${pins}<rect class="cpu-rail-comp" x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}"/>`;
    }).join("");

    const { x, y, w, h } = CHIP;
    return `
      <svg viewBox="0 0 ${VIEW_W} ${VIEW_H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        ${tracePaths}
        ${compEls}
        ${padEls}
        ${viaEls}
        ${nodeEls}
        ${beadsFixed}
        ${pinRects}
        <rect class="cpu-rail-chip-body" x="${x}" y="${y}" width="${w}" height="${h}"/>
        ${chipDieMarkup()}
        <rect class="cpu-rail-chip-inner" x="${x + 8}" y="${y + 8}" width="${w - 16}" height="${h - 16}"/>
      </svg>`;
  }

  function bodyHtml() {
    return `
      <div id="mod_cpu_rail" class="cpu-rail-root">
        <div class="cpu-rail-stage" data-cpu-rail-stage>
          <div data-cpu-rail-svg></div>
          <div class="cpu-rail-chip-face" data-cpu-rail-face>
            <div class="cpu-rail-logo" data-cpu-rail-logo></div>
            <div class="cpu-rail-model" data-cpu-rail-model>DETECTING…</div>
            <div class="cpu-rail-brand" data-cpu-rail-brand>—</div>
          </div>
        </div>
        <div class="cpu-rail-meta">
          <span>RAIL <b data-cpu-rail-load>—%</b></span>
          <span>CORES <b data-cpu-rail-cores>—</b></span>
          <span>CLK <b data-cpu-rail-clk>—</b></span>
        </div>
      </div>`;
  }

  function placeChipFace(root) {
    const stage = root.querySelector("[data-cpu-rail-stage]");
    const face = root.querySelector("[data-cpu-rail-face]");
    if (!stage || !face) return;
    const rect = stage.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) return;
    const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
    const ox = (rect.width - VIEW_W * scale) / 2;
    const oy = (rect.height - VIEW_H * scale) / 2;
    const pad = 10 * scale;
    face.style.left = `${ox + (CHIP.x + pad) * scale}px`;
    face.style.top = `${oy + (CHIP.y + pad) * scale}px`;
    face.style.width = `${(CHIP.w - pad * 2) * scale}px`;
    face.style.height = `${(CHIP.h - pad * 2) * scale}px`;
  }

  function bind(state) {
    const root = document.getElementById("mod_cpu_rail");
    if (!root) return;

    const svgHost = root.querySelector("[data-cpu-rail-svg]");
    // v5: fully static schematic (no SMIL / dash animation runtime).
    if (svgHost && svgHost.dataset.drawn !== "v5") {
      const data = buildSchematic(13);
      root._cpuRailData = data;
      svgHost.innerHTML = schematicSvg(data);
      svgHost.dataset.drawn = "v5";
    }

    const syncPause = () => {
      root.classList.toggle("cpu-rail-paused", document.visibilityState === "hidden");
    };
    syncPause();

    const layout = () => placeChipFace(root);
    layout();
    if (!root.dataset.bound) {
      root.dataset.bound = "1";
      if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => layout());
        ro.observe(root.querySelector("[data-cpu-rail-stage]") || root);
        state.cpuRailResizeObs = ro;
      }
      window.addEventListener("resize", layout);
      document.addEventListener("visibilitychange", syncPause);
      state.cpuRailVisHandler = syncPause;
    }

    const refresh = async () => {
      if (!document.getElementById("mod_cpu_rail") || !window.edex?.getCpuMetrics) return;
      const cpu = await window.edex.getCpuMetrics();
      const full = cpu.fullName || cpu.name || "CPU";
      const brand = detectBrand(full);
      const model = shortModel(full, brand);
      const logo = root.querySelector("[data-cpu-rail-logo]");
      const brandEl = root.querySelector("[data-cpu-rail-brand]");
      const modelEl = root.querySelector("[data-cpu-rail-model]");
      const loadEl = root.querySelector("[data-cpu-rail-load]");
      const coresEl = root.querySelector("[data-cpu-rail-cores]");
      const clkEl = root.querySelector("[data-cpu-rail-clk]");
      if (logo && logo.dataset.brand !== brand) {
        logo.innerHTML = logoSvg(brand);
        logo.dataset.brand = brand;
      }
      const face = root.querySelector("[data-cpu-rail-face]");
      if (face) face.dataset.brand = brand;
      if (brandEl) brandEl.textContent = brandLabel(brand);
      if (modelEl) modelEl.textContent = model;
      if (loadEl) loadEl.textContent = `${Math.round(Number(cpu.avg) || 0)}%`;
      if (coresEl) coresEl.textContent = String(cpu.cores || "—");
      if (clkEl) {
        const mx = Number(cpu.speedMax) || 0;
        clkEl.textContent = mx ? `${mx.toFixed(2)}GHz` : "—";
      }
    };

    refresh();
    if (state.cpuRailTimer) clearInterval(state.cpuRailTimer);
    state.cpuRailTimer = setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (!document.getElementById("mod_cpu_rail")) return;
      refresh();
    }, 15000);
  }

  window.cpuRailPanel = { bodyHtml, bind };
})();
