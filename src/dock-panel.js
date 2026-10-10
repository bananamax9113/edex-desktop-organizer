/* Bottom dock — fixed bottom-center frame; width/height from settings. */

(function () {
  const FRAME_STYLES = ["rounded", "trapezoid", "rect"];
  const BEAD_COUNT = 3;
  const FX_FPS = 6;
  const DEFAULT_WIDTH = 720;
  const DEFAULT_HEIGHT = 72;
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 2400;
  const MIN_HEIGHT = 40;
  const MAX_HEIGHT = 160;

  function bodyHtml() {
    return `
      <div id="mod_dock" class="dock-root" data-dock-frame="rounded" aria-hidden="true">
        <div class="dock-shell" data-dock-shell></div>
        <canvas class="dock-fx" data-dock-fx aria-hidden="true"></canvas>
      </div>`;
  }

  function frameStyle(state) {
    const raw = String(state?.settings?.dockFrameStyle || "rounded").toLowerCase();
    return FRAME_STYLES.includes(raw) ? raw : "rounded";
  }

  function dockWidth(state) {
    const raw = Number(state?.settings?.dockWidth);
    if (!Number.isFinite(raw)) return DEFAULT_WIDTH;
    return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(raw)));
  }

  function dockHeight(state) {
    const raw = Number(state?.settings?.dockHeight);
    if (!Number.isFinite(raw)) return DEFAULT_HEIGHT;
    return Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(raw)));
  }

  function themeRgb() {
    const cs = getComputedStyle(document.documentElement);
    return {
      r: Number(cs.getPropertyValue("--color_r")) || 170,
      g: Number(cs.getPropertyValue("--color_g")) || 207,
      b: Number(cs.getPropertyValue("--color_b")) || 209
    };
  }

  function pageSize() {
    return {
      w: window.innerWidth || document.documentElement.clientWidth || 1280,
      h: window.innerHeight || document.documentElement.clientHeight || 720
    };
  }

  function cursorOverTaskbar() {
    try {
      const pt = window.edex?.getCursorClientPoint?.();
      if (!pt || !Number.isFinite(pt.y)) return false;
      return pt.y >= pageSize().h - 120;
    } catch {
      return false;
    }
  }

  function framePath(style, w, h) {
    const inset = 1.5;
    const x0 = inset;
    const y0 = inset;
    const x1 = w - inset;
    const y1 = h - inset;
    if (style === "trapezoid") {
      const insetTop = Math.min(w * 0.07, 40);
      return [
        [x0 + insetTop, y0],
        [x1 - insetTop, y0],
        [x1, y1],
        [x0, y1],
        [x0 + insetTop, y0]
      ];
    }
    if (style === "rect") {
      return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]];
    }
    const r = Math.min(14, h * 0.35, w * 0.08);
    return [
      [x0 + r, y0],
      [x1 - r, y0],
      [x1, y0 + r],
      [x1, y1 - r],
      [x1 - r, y1],
      [x0 + r, y1],
      [x0, y1 - r],
      [x0, y0 + r],
      [x0 + r, y0]
    ];
  }

  function pathLength(pts) {
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return len;
  }

  function pointAt(pts, t) {
    if (!pts?.length) return [0, 0];
    let total = pathLength(pts);
    if (total < 1e-6) return pts[0];
    let dist = ((t % 1) + 1) % 1 * total;
    for (let i = 1; i < pts.length; i++) {
      const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (dist <= seg || i === pts.length - 1) {
        const u = seg < 1e-6 ? 0 : dist / seg;
        return [
          pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u,
          pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u
        ];
      }
      dist -= seg;
    }
    return pts[pts.length - 1];
  }

  function placeCard(width, height) {
    const card = document.getElementById("card_dock");
    if (!card) return;
    const pageW = Math.max(1, pageSize().w);
    const pageH = Math.max(1, pageSize().h);
    const w = Math.min(pageW * 0.98, Math.max(MIN_WIDTH, Math.round(width)));
    const h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(height)));
    card.style.left = "50%";
    card.style.right = "auto";
    card.style.top = "auto";
    card.style.bottom = "0";
    card.style.width = `${w}px`;
    card.style.height = `${h}px`;
    card.style.transform = "translateX(-50%)";
    card.style.margin = "0";
    return { w, h, pageW, pageH };
  }

  function applyGeometry(state) {
    const placed = placeCard(dockWidth(state), dockHeight(state));
    if (!placed || !state.layout?.dock) return;
    const { w, h, pageW, pageH } = placed;
    const left = (pageW - w) / 2;
    const top = pageH - h;
    state.layout.dock = {
      ...state.layout.dock,
      x: (left / pageW) * 100,
      y: (top / pageH) * 100,
      w: (w / pageW) * 100,
      h: (h / pageH) * 100,
      locked: true
    };
  }

  function applyFrameClass(state) {
    const root = document.getElementById("mod_dock");
    if (!root) return;
    const style = frameStyle(state);
    root.dataset.dockFrame = style;
    root.classList.toggle("is-trap", style === "trapezoid");
    root.classList.toggle("is-rect", style === "rect");
    root.classList.toggle("is-rounded", style === "rounded");
  }

  function paintBorderFx(state, ts) {
    const root = document.getElementById("mod_dock");
    const canvas = root?.querySelector("[data-dock-fx]");
    if (!root || !canvas) return;
    if (cursorOverTaskbar()) return;

    const rect = root.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    if (w < 8 || h < 8) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas._ctx = null;
    }
    let ctx = canvas._ctx;
    if (!ctx) {
      try {
        ctx = canvas.getContext("2d", { alpha: true, desynchronized: true });
      } catch {
        ctx = canvas.getContext("2d", { alpha: true });
      }
      canvas._ctx = ctx;
    }
    if (!ctx) return;

    const style = frameStyle(state);
    const pts = framePath(style, w, h);
    const c = themeRgb();
    const t = (ts || performance.now()) / 1000;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.8)`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.strokeStyle = `rgba(${c.r},${c.g},${c.b},0.4)`;
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 16]);
    ctx.lineDashOffset = -(t * 28);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let i = 0; i < BEAD_COUNT; i++) {
      const u = (t * 0.1 + i / BEAD_COUNT) % 1;
      const [x, y] = pointAt(pts, u);
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${c.r},${c.g},${c.b},0.9)`;
      ctx.fill();
    }
  }

  function refresh(state) {
    if (!document.getElementById("mod_dock")) return;
    applyFrameClass(state);
    applyGeometry(state);
  }

  function bind(state) {
    const root = document.getElementById("mod_dock");
    const card = document.getElementById("card_dock");
    if (!root) return;

    if (card) {
      card.classList.add("dock-bare", "locked");
      card.classList.remove("dragging");
      card.setAttribute("aria-hidden", "true");
    }

    applyFrameClass(state);
    applyGeometry(state);

    if (root.dataset.bound === "1") {
      refresh(state);
      return;
    }
    root.dataset.bound = "1";

    const FRAME_MS = 1000 / FX_FPS;
    let lastFx = 0;
    const fxTick = (ts) => {
      if (!document.getElementById("mod_dock")) {
        state.dockRaf = null;
        return;
      }
      if (document.visibilityState === "hidden") {
        state.dockRaf = null;
        return;
      }
      state.dockRaf = requestAnimationFrame(fxTick);
      if (lastFx && ts - lastFx < FRAME_MS) return;
      lastFx = ts;
      paintBorderFx(state, ts);
    };

    if (state.dockRaf) cancelAnimationFrame(state.dockRaf);
    state.dockRaf = requestAnimationFrame(fxTick);

    if (state.dockPinTimer) clearInterval(state.dockPinTimer);
    state.dockPinTimer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      if (!document.getElementById("mod_dock")) return;
      // Soft pin always (no blur) so taskbar clicks cannot leave the dock on top.
      window.edex?.pinOverlaysBottomSoft?.();
      const el = document.getElementById("card_dock");
      if (el) {
        el.style.left = "50%";
        el.style.top = "auto";
        el.style.bottom = "0";
        el.style.transform = "translateX(-50%)";
      }
    }, 1000);

    if (!state.dockResizeHandler) {
      state.dockResizeHandler = () => refresh(state);
      window.addEventListener("resize", state.dockResizeHandler);
    }
  }

  function unbind(state) {
    if (state?.dockTimer) {
      clearInterval(state.dockTimer);
      state.dockTimer = null;
    }
    if (state?.dockPinTimer) {
      clearInterval(state.dockPinTimer);
      state.dockPinTimer = null;
    }
    if (state?.dockRaf) {
      cancelAnimationFrame(state.dockRaf);
      state.dockRaf = null;
    }
    if (state?.dockResizeHandler) {
      window.removeEventListener("resize", state.dockResizeHandler);
      state.dockResizeHandler = null;
    }
  }

  function setFrameStyle(state, style) {
    const next = FRAME_STYLES.includes(style) ? style : "rounded";
    state.settings = { ...state.settings, dockFrameStyle: next };
    applyFrameClass(state);
    paintBorderFx(state, performance.now());
    window.edex?.saveSettings?.({ dockFrameStyle: next }).catch?.(() => {});
  }

  function setSize(state, { width, height } = {}) {
    const patch = {};
    if (width !== undefined) {
      const w = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.round(Number(width) || DEFAULT_WIDTH)));
      patch.dockWidth = w;
    }
    if (height !== undefined) {
      const h = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(Number(height) || DEFAULT_HEIGHT)));
      patch.dockHeight = h;
    }
    if (!Object.keys(patch).length) return;
    state.settings = { ...state.settings, ...patch };
    applyGeometry(state);
    paintBorderFx(state, performance.now());
    window.edex?.saveSettings?.(patch).catch?.(() => {});
  }

  window.dockPanel = {
    bodyHtml,
    bind,
    unbind,
    setFrameStyle,
    setSize,
    dockWidth,
    dockHeight,
    FRAME_STYLES,
    DEFAULT_WIDTH,
    DEFAULT_HEIGHT,
    MIN_WIDTH,
    MAX_WIDTH,
    MIN_HEIGHT,
    MAX_HEIGHT
  };
})();
