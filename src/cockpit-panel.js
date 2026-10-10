/* Cockpit radar suite panel — restored after renderer wipe */

(function () {
  function bodyHtml() {
    return `
        <div id="mod_cockpit" class="cockpit-root">
          <div class="cockpit-matrix-bar" id="ckp_matrix">
            <span>RNG <b data-mx="rng">0000</b></span>
            <span>BRG <b data-mx="brg">000</b></span>
            <span>ALT <b data-mx="alt">00000</b></span>
            <span>SPD <b data-mx="spd">000</b></span>
            <span>LAT <b data-mx="lat">00.00</b></span>
            <span>LON <b data-mx="lon">000.00</b></span>
            <span>HDG <b id="ckp_hdg">000</b></span>
            <span>COM <b id="ckp_com">118.00</b></span>
            <span>GAIN <b id="ckp_gain">50</b></span>
            <span>THR <b id="ckp_thr">00</b></span>
          </div>
          <div class="cockpit-main">
            <div class="cockpit-radar-wrap" id="ckp_radar_wrap">
              <div class="cockpit-radar-label">PRIMARY SCAN</div>
              <canvas id="ckp_radar"></canvas>
            </div>
            <div class="cockpit-sectors" id="ckp_sectors">
              <div class="cockpit-sector"><canvas data-sector="A" data-pct="10"></canvas></div>
              <div class="cockpit-sector"><canvas data-sector="B" data-pct="25"></canvas></div>
              <div class="cockpit-sector"><canvas data-sector="C" data-pct="34"></canvas></div>
              <div class="cockpit-sector"><canvas data-sector="D" data-pct="50"></canvas></div>
              <div class="cockpit-sector"><canvas data-sector="E" data-pct="70"></canvas></div>
              <div class="cockpit-sector"><canvas data-sector="F" data-pct="79"></canvas></div>
            </div>
          </div>
          <div class="cockpit-controls">
            <div class="cockpit-col">
              <h4>ROTARY</h4>
              <div class="cockpit-knobs">
                <div class="cockpit-knob-wrap">
                  <div class="cockpit-knob" data-ckp-knob="hdg" data-min="0" data-max="359" data-value="0"><i class="cockpit-knob-tick"></i></div>
                  <span class="cockpit-knob-label">HDG</span>
                </div>
                <div class="cockpit-knob-wrap">
                  <div class="cockpit-knob" data-ckp-knob="com" data-min="11800" data-max="13600" data-value="11800"><i class="cockpit-knob-tick"></i></div>
                  <span class="cockpit-knob-label">COM</span>
                </div>
                <div class="cockpit-knob-wrap">
                  <div class="cockpit-knob" data-ckp-knob="gain" data-min="0" data-max="100" data-value="50"><i class="cockpit-knob-tick"></i></div>
                  <span class="cockpit-knob-label">GAIN</span>
                </div>
              </div>
            </div>
            <div class="cockpit-col">
              <h4>PUSH / TOGGLE</h4>
              <div class="cockpit-btns">
                <button type="button" class="cockpit-btn" data-ckp-tog="ap">AP</button>
                <button type="button" class="cockpit-btn" data-ckp-tog="nav">NAV</button>
                <button type="button" class="cockpit-btn" data-ckp-pulse="ident">IDENT</button>
                <button type="button" class="cockpit-btn" data-ckp-tog="gear">GEAR</button>
              </div>
              <div class="cockpit-leds">
                <i class="cockpit-led" id="ckp_led_ap"></i>
                <i class="cockpit-led" id="ckp_led_nav"></i>
                <i class="cockpit-led" id="ckp_led_ident"></i>
                <i class="cockpit-led" id="ckp_led_gear"></i>
              </div>
            </div>
            <div class="cockpit-col">
              <h4>MASTER</h4>
              <div class="cockpit-switches">
                <div class="cockpit-switch" data-ckp-sw="batt">
                  <div class="cockpit-switch-body"><i class="cockpit-switch-lever"></i></div>
                  <span>BATT</span>
                </div>
                <div class="cockpit-switch" data-ckp-sw="avionics">
                  <div class="cockpit-switch-body"><i class="cockpit-switch-lever"></i></div>
                  <span>AVN</span>
                </div>
              </div>
              <div class="cockpit-throttle">
                <input id="ckp_throttle" type="range" min="0" max="100" value="0" />
                <span>THRUST</span>
              </div>
            </div>
          </div>
          <div class="cockpit-status" id="ckp_status">STANDBY</div>
        </div>`;
  }

  function pad2(n) {
    return String(Math.round(Number(n) || 0)).padStart(2, "0");
  }

  function bind(state) {
    const root = document.getElementById("mod_cockpit");
    if (!root) return;
    // DOM is rebuilt often; only skip if this exact node is already wired.
    if (root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    if (state.cockpitRaf) {
      cancelAnimationFrame(state.cockpitRaf);
      state.cockpitRaf = null;
    }
    if (state.cockpitMatrixTimer) {
      clearInterval(state.cockpitMatrixTimer);
      state.cockpitMatrixTimer = null;
    }

    const status = () => document.getElementById("ckp_status");
    const setStatus = (text) => {
      const el = status();
      if (el) el.textContent = text;
    };

    let themeCache = { r: 170, g: 207, b: 209, at: 0 };
    let fontCache = { value: '"Press Start 2P", monospace', at: 0 };
    const themeRgb = () => {
      const now = Date.now();
      if (now - themeCache.at < 2000) return themeCache;
      const cs = getComputedStyle(document.documentElement);
      themeCache = {
        r: Number(cs.getPropertyValue("--color_r")) || 0,
        g: Number(cs.getPropertyValue("--color_g")) || 200,
        b: Number(cs.getPropertyValue("--color_b")) || 255,
        at: now
      };
      return themeCache;
    };
    const rgba = (c, a) => `rgba(${c.r},${c.g},${c.b},${a})`;
    const pad3 = (n) => String(Math.round(n)).padStart(3, "0");
    const pixelFont = () => {
      const now = Date.now();
      if (now - fontCache.at < 5000) return fontCache.value;
      const cs = getComputedStyle(document.documentElement);
      fontCache = {
        value: cs.getPropertyValue("--font_pixel")?.trim() || '"Press Start 2P", monospace',
        at: now
      };
      return fontCache.value;
    };

    const syncReadouts = () => {
      const hdg = Number(root.querySelector('[data-ckp-knob="hdg"]')?.dataset.value) || 0;
      const com = Number(root.querySelector('[data-ckp-knob="com"]')?.dataset.value) || 11800;
      const gain = Number(root.querySelector('[data-ckp-knob="gain"]')?.dataset.value) || 50;
      const thr = Number(document.getElementById("ckp_throttle")?.value) || 0;
      const hdgEl = document.getElementById("ckp_hdg");
      const comEl = document.getElementById("ckp_com");
      const gainEl = document.getElementById("ckp_gain");
      const thrEl = document.getElementById("ckp_thr");
      if (hdgEl) hdgEl.textContent = pad3(((hdg % 360) + 360) % 360);
      if (comEl) comEl.textContent = (com / 100).toFixed(2);
      if (gainEl) gainEl.textContent = String(Math.round(gain));
      if (thrEl) thrEl.textContent = pad2(Math.round(thr));
    };

    const flickerMatrix = () => {
      const set = (key, val) => {
        const el = root.querySelector(`[data-mx="${key}"]`);
        if (el) el.textContent = val;
      };
      set("rng", String(Math.floor(Math.random() * 9999)).padStart(4, "0"));
      set("brg", pad3(Math.floor(Math.random() * 360)));
      set("alt", String(Math.floor(Math.random() * 45000)).padStart(5, "0"));
      set("spd", pad3(Math.floor(80 + Math.random() * 420)));
      set("lat", (Math.random() * 90).toFixed(2));
      set("lon", (Math.random() * 180).toFixed(2));
    };
    flickerMatrix();
    // Matrix timer started later — only ticks while card is live/hovered.

    const applyKnobVisual = (knob, value) => {
      const min = Number(knob.dataset.min) || 0;
      const max = Number(knob.dataset.max) || 100;
      const span = Math.max(1, max - min);
      const t = (value - min) / span;
      const deg = t * 270 - 135;
      knob.style.transform = `rotate(${deg}deg)`;
      knob.dataset.value = String(value);
    };

    root.querySelectorAll("[data-ckp-knob]").forEach((knob) => {
      const min = Number(knob.dataset.min) || 0;
      const max = Number(knob.dataset.max) || 100;
      let value = Number(knob.dataset.value);
      if (!Number.isFinite(value)) value = min;
      applyKnobVisual(knob, value);

      knob.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        window.edex?.setMouseIgnore?.(false);
        knob.classList.add("dragging");
        const startY = event.clientY;
        const startVal = Number(knob.dataset.value) || min;
        const span = Math.max(1, max - min);
        try { knob.setPointerCapture(event.pointerId); } catch { /* ignore */ }

        const move = (ev) => {
          const delta = (startY - ev.clientY) / 1.6;
          const next = Math.max(min, Math.min(max, startVal + delta * (span / 100)));
          applyKnobVisual(knob, next);
          syncReadouts();
        };
        const up = (ev) => {
          knob.classList.remove("dragging");
          try { knob.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          const key = knob.dataset.ckpKnob;
          setStatus(`${String(key || "KNOB").toUpperCase()} SET`);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    });

    root.querySelectorAll("[data-ckp-tog]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        btn.classList.toggle("on");
        const key = btn.dataset.ckpTog;
        const led = document.getElementById(`ckp_led_${key}`);
        led?.classList.toggle("on", btn.classList.contains("on"));
        setStatus(`${String(key || "BTN").toUpperCase()} ${btn.classList.contains("on") ? "ENGAGED" : "OFF"}`);
      });
    });

    root.querySelectorAll("[data-ckp-pulse]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        btn.classList.add("on");
        const key = btn.dataset.ckpPulse;
        const led = document.getElementById(`ckp_led_${key}`);
        led?.classList.add("on");
        setStatus(`${String(key || "PULSE").toUpperCase()} PULSE`);
        window.setTimeout(() => {
          btn.classList.remove("on");
          led?.classList.remove("on");
        }, 420);
      });
    });

    root.querySelectorAll("[data-ckp-sw]").forEach((sw) => {
      sw.addEventListener("click", (event) => {
        event.stopPropagation();
        sw.classList.toggle("on");
        const key = sw.dataset.ckpSw;
        setStatus(`${String(key || "SW").toUpperCase()} ${sw.classList.contains("on") ? "ON" : "OFF"}`);
      });
    });

    const throttle = document.getElementById("ckp_throttle");
    throttle?.addEventListener("input", () => {
      syncReadouts();
      setStatus(`THRUST ${pad2(Number(throttle.value) || 0)}%`);
    });
    throttle?.addEventListener("pointerdown", (event) => event.stopPropagation());

    /** CSS-px size cache — resize only via ResizeObserver, never per paint frame. */
    const canvasSize = new WeakMap();
    const ctxCache = new WeakMap();
    const measureCanvas = (canvas) => {
      const parent = canvas.parentElement;
      if (!parent) return { w: 0, h: 0, dpr: 1 };
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.floor(rect.width));
      const h = Math.max(1, Math.floor(rect.height));
      const bw = Math.floor(w * dpr);
      const bh = Math.floor(h * dpr);
      if (canvas.width !== bw || canvas.height !== bh) {
        canvas.width = bw;
        canvas.height = bh;
        ctxCache.delete(canvas);
      }
      const size = { w, h, dpr };
      canvasSize.set(canvas, size);
      return size;
    };
    const fitCanvas = (canvas) => canvasSize.get(canvas) || measureCanvas(canvas);
    const getCtx = (canvas) => {
      let ctx = ctxCache.get(canvas);
      if (!ctx) {
        ctx = canvas.getContext("2d", { alpha: true, desynchronized: true }) || canvas.getContext("2d");
        ctxCache.set(canvas, ctx);
      }
      return ctx;
    };

    const drawRing = (ctx, cx, cy, r, color, width, dash) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.setLineDash(dash || []);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawTicks = (ctx, cx, cy, rOuter, rInner, count, color, every = 1) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      for (let i = 0; i < count; i++) {
        if (i % every !== 0) continue;
        const a = (i / count) * Math.PI * 2 - Math.PI / 2;
        const major = i % (count / 8) === 0;
        const ri = major ? rInner - 3 : rInner;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * ri, cy + Math.sin(a) * ri);
        ctx.lineTo(cx + Math.cos(a) * rOuter, cy + Math.sin(a) * rOuter);
        ctx.stroke();
      }
    };

    const makeBlips = (n, seed = 1) => {
      const list = [];
      let s = seed;
      for (let i = 0; i < n; i++) {
        s = (s * 16807) % 2147483647;
        const ang = (s / 2147483647) * Math.PI * 2;
        s = (s * 16807) % 2147483647;
        const rad = 0.15 + (s / 2147483647) * 0.75;
        list.push({ ang, rad, life: 0.4 + (i % 5) * 0.12 });
      }
      return list;
    };

    const sectorCanvases = [...root.querySelectorAll("canvas[data-sector]")];
    const sectorState = sectorCanvases.map((canvas, i) => ({
      canvas,
      letter: canvas.dataset.sector || String.fromCharCode(65 + i),
      pct: Number(canvas.dataset.pct) || 10 + i * 15,
      blips: makeBlips(8 + (i % 4), 100 + i * 17),
      drift: Math.random() * Math.PI * 2
    }));

    const radarCanvas = document.getElementById("ckp_radar");
    const radarBlips = makeBlips(14, 42).map((b) => ({ ...b, pulse: Math.random() }));
    let sweepAngle = 0;
    let ringSpin = 0;
    let lastTs = 0;

    const drawSector = (item, t) => {
      const { canvas, letter, pct, blips } = item;
      const { w, h, dpr } = fitCanvas(canvas);
      if (w < 8 || h < 8) return;
      const ctx = getCtx(canvas);
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const c = themeRgb();
      const cx = w / 2;
      const cy = h * 0.42;
      const R = Math.min(w, h) * 0.32;
      const trackR = R + 6;
      const trackW = Math.max(5, R * 0.22);

      // track background
      ctx.beginPath();
      ctx.arc(cx, cy, trackR, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(c, 0.18);
      ctx.lineWidth = trackW;
      ctx.stroke();

      // progress arc (from bottom-left clockwise-ish, starting ~135deg)
      const start = Math.PI * 0.75;
      const span = (pct / 100) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, trackR, start, start + span);
      ctx.strokeStyle = rgba(c, 0.95);
      ctx.lineWidth = trackW;
      ctx.lineCap = "butt";
      ctx.stroke();

      drawRing(ctx, cx, cy, R * 0.95, rgba(c, 0.35), 1);
      drawRing(ctx, cx, cy, R * 0.55, rgba(c, 0.25), 1);
      drawRing(ctx, cx, cy, R * 0.18, rgba(c, 0.55), 1.5);

      // faint crosshair
      ctx.strokeStyle = rgba(c, 0.2);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx - R * 0.9, cy);
      ctx.lineTo(cx + R * 0.9, cy);
      ctx.moveTo(cx, cy - R * 0.9);
      ctx.lineTo(cx, cy + R * 0.9);
      ctx.stroke();

      // center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 2, 0, Math.PI * 2);
      ctx.fillStyle = rgba(c, 0.95);
      ctx.fill();

      // blips
      blips.forEach((b, i) => {
        const a = b.ang + item.drift + t * 0.08 * (i % 2 ? 1 : -1);
        const rr = b.rad * R * 0.85;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        const pulse = 0.45 + 0.55 * Math.abs(Math.sin(t * 2 + i));
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = rgba(c, pulse);
        ctx.fill();
      });

      // top tick + pct
      ctx.strokeStyle = rgba(c, 0.7);
      ctx.beginPath();
      ctx.moveTo(cx, cy - trackR - trackW / 2 - 2);
      ctx.lineTo(cx, cy - trackR - trackW / 2 - 8);
      ctx.stroke();

      ctx.fillStyle = rgba(c, 0.95);
      ctx.font = `500 ${Math.max(7, Math.floor(R * 0.28))}px ${pixelFont()}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(`${Math.round(pct)}%`, cx, cy - trackR - trackW / 2 - 10);

      // side markers
      ctx.font = `400 ${Math.max(6, Math.floor(R * 0.22))}px ${pixelFont()}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = rgba(c, 0.55);
      ctx.fillText("120", cx - trackR - trackW / 2 - 4, cy);
      ctx.textAlign = "left";
      ctx.fillText("50", cx + trackR + trackW / 2 + 4, cy);

      // corner glyphs
      const glyph = (x, y) => {
        ctx.fillStyle = rgba(c, 0.45);
        [[0, 0], [3, 0], [0, 3], [3, 3]].forEach(([dx, dy]) => {
          ctx.fillRect(x + dx, y + dy, 1.5, 1.5);
        });
      };
      glyph(cx - trackR - 10, cy + trackR * 0.55);
      glyph(cx + trackR + 2, cy + trackR * 0.55);

      // label
      ctx.fillStyle = rgba(c, 0.85);
      ctx.font = `500 ${Math.max(7, Math.floor(R * 0.26))}px ${pixelFont()}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(`SECTOR : ${letter}`, cx, cy + trackR + trackW / 2 + 8);
    };

    const drawMainRadar = (t, dt) => {
      if (!radarCanvas) return;
      const { w, h, dpr } = fitCanvas(radarCanvas);
      if (w < 16 || h < 16) return;
      const ctx = getCtx(radarCanvas);
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const c = themeRgb();
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.min(w, h) * 0.42;

      sweepAngle = (sweepAngle + dt * 0.85) % (Math.PI * 2);
      ringSpin = (ringSpin + dt * 0.12) % (Math.PI * 2);

      // outer thick segmented ring
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-ringSpin * 0.4);
      for (let i = 0; i < 8; i++) {
        const a0 = (i / 8) * Math.PI * 2 + 0.04;
        const a1 = ((i + 1) / 8) * Math.PI * 2 - 0.04;
        ctx.beginPath();
        ctx.arc(0, 0, R, a0, a1);
        ctx.strokeStyle = rgba(c, 0.9);
        ctx.lineWidth = Math.max(3, R * 0.045);
        ctx.stroke();
      }
      ctx.restore();

      // tick scale
      drawTicks(ctx, cx, cy, R * 0.88, R * 0.78, 72, rgba(c, 0.55));
      drawRing(ctx, cx, cy, R * 0.88, rgba(c, 0.45), 1);

      // dashed rings (rotating)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ringSpin);
      drawRing(ctx, 0, 0, R * 0.72, rgba(c, 0.55), 1.5, [6, 8]);
      ctx.rotate(-ringSpin * 2.2);
      drawRing(ctx, 0, 0, R * 0.58, rgba(c, 0.4), 1, [3, 5]);
      ctx.restore();

      drawRing(ctx, cx, cy, R * 0.42, rgba(c, 0.5), 1.5);
      drawRing(ctx, cx, cy, R * 0.28, rgba(c, 0.85), 2.5);
      drawRing(ctx, cx, cy, R * 0.14, rgba(c, 0.35), 1);

      // radial spokes
      ctx.strokeStyle = rgba(c, 0.22);
      ctx.lineWidth = 1;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
        const len = i % 4 === 0 ? R * 0.95 : R * 0.7;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R * 0.12, cy + Math.sin(a) * R * 0.12);
        ctx.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
        ctx.stroke();
      }

      // sweep wedge
      const wedge = Math.PI / 3.2;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(sweepAngle);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.95);
      grad.addColorStop(0, rgba(c, 0.02));
      grad.addColorStop(0.55, rgba(c, 0.12));
      grad.addColorStop(1, rgba(c, 0.28));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, R * 0.95, -wedge / 2, wedge / 2);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
      // leading edge
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(wedge / 2) * R * 0.95, Math.sin(wedge / 2) * R * 0.95);
      ctx.strokeStyle = rgba(c, 1);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      // center crosshair + dot
      ctx.strokeStyle = rgba(c, 0.7);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - 8, cy);
      ctx.lineTo(cx + 8, cy);
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx, cy + 8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fillStyle = rgba(c, 0.95);
      ctx.fill();

      // blips + lit by sweep proximity
      radarBlips.forEach((b, i) => {
        b.pulse += dt * 0.6;
        const a = b.ang;
        const rr = b.rad * R * 0.9;
        const x = cx + Math.cos(a - Math.PI / 2) * rr;
        const y = cy + Math.sin(a - Math.PI / 2) * rr;
        let diff = Math.abs(((a - Math.PI / 2) - sweepAngle + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        const lit = Math.max(0.2, 1 - diff / Math.PI);
        const size = 1.8 + lit * 1.6;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = rgba(c, 0.35 + lit * 0.65);
        ctx.fill();
        if (lit > 0.7) {
          ctx.beginPath();
          ctx.arc(x, y, size + 3, 0, Math.PI * 2);
          ctx.strokeStyle = rgba(c, 0.35);
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        // random matrix digits near some blips
        if (i % 3 === 0 && lit > 0.45) {
          ctx.fillStyle = rgba(c, 0.55 + lit * 0.35);
          ctx.font = `400 ${Math.max(6, Math.floor(R * 0.07))}px ${pixelFont()}`;
          ctx.textAlign = "left";
          ctx.textBaseline = "bottom";
          const n = String(Math.floor((Math.sin(t * 3 + i) * 0.5 + 0.5) * 999)).padStart(3, "0");
          ctx.fillText(n, x + 4, y - 2);
        }
      });

      // floating matrix readouts around rim
      ctx.font = `400 ${Math.max(7, Math.floor(R * 0.08))}px ${pixelFont()}`;
      ctx.fillStyle = rgba(c, 0.65);
      const rimNums = [
        { a: -0.35, label: String(Math.floor(t * 17) % 1000).padStart(3, "0") },
        { a: 1.1, label: String(Math.floor(t * 11 + 40) % 360).padStart(3, "0") },
        { a: 2.4, label: String(Math.floor(200 + (Math.sin(t) * 0.5 + 0.5) * 800)).padStart(4, "0") },
        { a: 4.0, label: `${Math.floor((Math.sin(t * 0.7) * 0.5 + 0.5) * 99)}%` }
      ];
      rimNums.forEach((item) => {
        const x = cx + Math.cos(item.a) * (R * 1.02);
        const y = cy + Math.sin(item.a) * (R * 1.02);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(item.label, x, y);
      });
    };

    /*
     * Idle by default: paint a static frame once, then only run RAF while the
     * card is hovered / focused (~8fps). Canvas2D is CPU-bound; this cuts idle cost to ~0.
     */
    const FRAME_MS = 125;
    let sectorPaintAt = 0;
    let live = false;
    const card = document.getElementById("card_cockpit");

    const paintFrame = (ts, forceSectors = false) => {
      const t = (ts || performance.now()) / 1000;
      const dt = lastTs ? Math.min(0.12, ((ts || performance.now()) - lastTs) / 1000) : 0.016;
      lastTs = ts || performance.now();
      drawMainRadar(t, dt);
      if (forceSectors || !sectorPaintAt || lastTs - sectorPaintAt > 900) {
        sectorPaintAt = lastTs;
        sectorState.forEach((s) => drawSector(s, t));
      }
    };

    const tick = (ts) => {
      if (!document.getElementById("mod_cockpit")) {
        state.cockpitRaf = null;
        return;
      }
      if (!live || document.visibilityState === "hidden") {
        state.cockpitRaf = null;
        lastTs = 0;
        return;
      }
      state.cockpitRaf = requestAnimationFrame(tick);
      if (lastTs && ts - lastTs < FRAME_MS) return;
      paintFrame(ts, false);
    };

    const startLive = () => {
      if (live) return;
      live = true;
      setStatus("SCAN LIVE");
      if (!state.cockpitRaf) state.cockpitRaf = requestAnimationFrame(tick);
    };
    const stopLive = () => {
      live = false;
      if (state.cockpitRaf) {
        cancelAnimationFrame(state.cockpitRaf);
        state.cockpitRaf = null;
      }
      setStatus("SCAN IDLE");
    };

    // Initial measure + one static paint (no continuous RAF).
    if (radarCanvas) measureCanvas(radarCanvas);
    sectorCanvases.forEach((c) => measureCanvas(c));
    paintFrame(performance.now(), true);

    const radarWrap = document.getElementById("ckp_radar_wrap");
    radarWrap?.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      startLive();
      setStatus("SCAN LOCK");
      window.setTimeout(() => {
        if (status()?.textContent === "SCAN LOCK") setStatus("TRACKING");
      }, 650);
    });

    card?.addEventListener("pointerenter", startLive);
    card?.addEventListener("pointerleave", stopLive);
    card?.addEventListener("focusin", startLive);
    card?.addEventListener("focusout", (event) => {
      if (!card.contains(event.relatedTarget)) stopLive();
    });

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        if (radarCanvas) measureCanvas(radarCanvas);
        sectorCanvases.forEach((c) => measureCanvas(c));
        paintFrame(performance.now(), true);
      });
      ro.observe(root);
      if (radarWrap) ro.observe(radarWrap);
      sectorCanvases.forEach((c) => {
        if (c.parentElement) ro.observe(c.parentElement);
      });
    }

    // Slow matrix flicker only while live / visible.
    if (state.cockpitMatrixTimer) {
      clearInterval(state.cockpitMatrixTimer);
      state.cockpitMatrixTimer = null;
    }
    state.cockpitMatrixTimer = window.setInterval(() => {
      if (document.visibilityState === "hidden" || !live) return;
      flickerMatrix();
    }, 1500);

    syncReadouts();
    setStatus("SCAN IDLE");
  }

  window.cockpitPanel = { bodyHtml, bind };
})();
