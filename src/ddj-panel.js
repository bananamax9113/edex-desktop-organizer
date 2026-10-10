/* Pioneer DDJ-1000 style DJ controller — true-circle jogs + theme mono */

(function () {
  const TRACKS = [
    { title: "NEXUS GRID", bpm: 128, key: "8A" },
    { title: "TRON PULSE", bpm: 124, key: "5B" },
    { title: "ORBIT RUN", bpm: 140, key: "11A" },
    { title: "VOID SHIFT", bpm: 118, key: "2B" }
  ];

  const BEAT_FX = ["ECHO", "REVERB", "FLANGER", "SPIRAL", "ROLL", "MOBIA"];
  const COLOR_FX = ["D.ECHO", "PITCH", "NOISE", "FILTER"];
  const PAD_MODES = ["HOT CUE", "PAD FX", "BEAT JUMP", "SAMPLER"];

  function deckHtml(side) {
    const a = side === "L" ? 1 : 2;
    const b = side === "L" ? 3 : 4;
    const pads = Array.from({ length: 8 }, (_, i) =>
      `<button type="button" class="ddj-pad" data-ddj-pad="${i}" data-pad-color="0" aria-label="Pad ${i + 1}"></button>`
    ).join("");
    return `
      <div class="ddj-deck" data-side="${side}" data-active-deck="${a}">
        <div class="ddj-deck-head">
          <div class="ddj-deck-tabs">
            <button type="button" class="ddj-deck-tab active" data-ddj-deck-tab="${a}">DECK ${a}</button>
            <button type="button" class="ddj-deck-tab" data-ddj-deck-tab="${b}">DECK ${b}</button>
          </div>
          <span class="ddj-deck-meta" data-ddj-key>—</span>
        </div>
        <div class="ddj-jog-row">
          <div class="ddj-jog-stage" data-ddj-jog-stage>
            <div class="ddj-jog-halo" aria-hidden="true">
              <span class="grid">GRID / SLIDE</span>
              <span class="rev">− REV</span>
              <span class="fwd">FWD +</span>
            </div>
            <div class="ddj-jog" data-ddj-jog tabindex="0" aria-label="Jog wheel">
              <div class="ddj-jog-spin" data-ddj-spin>
                <div class="ddj-jog-dimples"></div>
                <div class="ddj-jog-platter"></div>
                <i class="ddj-jog-needle"></i>
              </div>
              <div class="ddj-jog-lcd">
                <div class="ddj-jog-ring"><i data-ddj-ring-needle></i></div>
                <div class="ddj-lcd-tags">
                  <span class="t-deck" data-ddj-lcd-deck>DECK ${a}</span>
                  <span class="t-sync" data-ddj-lcd-sync>SYNC</span>
                  <span class="t-pct" data-ddj-lcd-pct>+0.0%</span>
                </div>
                <div class="bpm"><span data-ddj-bpm>128.0</span></div>
                <canvas data-ddj-wave width="120" height="24"></canvas>
                <div class="time" data-ddj-time>-0:00</div>
                <div class="track" data-ddj-track>LOAD TRACK</div>
              </div>
            </div>
          </div>
          <div class="ddj-tempo-col">
            <span>TEMPO</span>
            <div class="ddj-tempo" data-ddj-tempo data-value="50">
              <div class="ddj-tempo-fill"></div>
              <div class="ddj-tempo-cap"></div>
            </div>
            <span data-ddj-tempo-val>±0.0%</span>
          </div>
        </div>
        <div class="ddj-deck-btns">
          <button type="button" class="ddj-btn on" data-ddj-tog="quantize"><i class="lamp"></i><span>QNTZ</span></button>
          <button type="button" class="ddj-btn off" data-ddj-tog="slip"><i class="lamp"></i><span>SLIP</span></button>
          <button type="button" class="ddj-btn off" data-ddj-tog="sync"><i class="lamp"></i><span>SYNC</span></button>
          <button type="button" class="ddj-btn off" data-ddj-tog="mt"><i class="lamp"></i><span>MT</span></button>
        </div>
        <div class="ddj-transport">
          <button type="button" class="ddj-round cue" data-ddj-cue><i class="lamp"></i><span>CUE</span></button>
          <button type="button" class="ddj-round play" data-ddj-play><i class="lamp"></i><span>PLAY</span></button>
          <button type="button" class="ddj-round" data-ddj-shift><i class="lamp"></i><span>SHIFT</span></button>
        </div>
        <div class="ddj-pad-modes">
          ${PAD_MODES.map((m, i) =>
            `<button type="button" class="ddj-btn ${i === 0 ? "on" : "off"}" data-ddj-padmode="${i}"><span>${m}</span></button>`
          ).join("")}
        </div>
        <div class="ddj-pads">${pads}</div>
      </div>`;
  }

  function channelHtml(ch) {
    return `
      <div class="ddj-ch" data-ch="${ch}">
        <span class="ddj-ch-label">${ch}</span>
        <div class="ddj-meter" aria-hidden="true"><i data-ddj-meter></i></div>
        <div class="ddj-knob-wrap">
          <div class="ddj-knob" data-ddj-knob="trim" data-min="0" data-max="100" data-value="70"><i></i></div>
          <span>TRIM</span>
        </div>
        <div class="ddj-knob-wrap">
          <div class="ddj-knob" data-ddj-knob="hi" data-min="0" data-max="100" data-value="50"><i></i></div>
          <span>HI</span>
        </div>
        <div class="ddj-knob-wrap">
          <div class="ddj-knob" data-ddj-knob="mid" data-min="0" data-max="100" data-value="50"><i></i></div>
          <span>MID</span>
        </div>
        <div class="ddj-knob-wrap">
          <div class="ddj-knob" data-ddj-knob="low" data-min="0" data-max="100" data-value="50"><i></i></div>
          <span>LOW</span>
        </div>
        <div class="ddj-color-knob-wrap">
          <div class="ddj-color-scale"><span>LOW</span><span>HI</span></div>
          <div class="ddj-knob" data-ddj-knob="color" data-min="0" data-max="100" data-value="50"><i></i></div>
          <span>COLOR</span>
        </div>
        <button type="button" class="ddj-chcue off" data-ddj-chcue>CUE</button>
        <div class="ddj-ch-fader-wrap">
          <div class="ddj-ch-fader" data-ddj-chfader data-value="75">
            <div class="fill"></div>
            <div class="cap"></div>
          </div>
          <div class="ddj-fader-ticks" aria-hidden="true"></div>
        </div>
      </div>`;
  }

  function bodyHtml() {
    return `
      <div id="mod_ddj" class="ddj-root">
        <div class="ddj-chrome">
          <span class="ddj-model"><b>DDJ-1000</b></span>
          <span>4CH · MAGVEL</span>
          <span>MASTER <b data-ddj-master-read>70</b></span>
        </div>
        <div class="ddj-body">
          ${deckHtml("L")}
          <div class="ddj-mixer">
            <div class="ddj-mixer-head">
              <span>MIXER</span>
              <span>SOUND COLOR / BEAT FX</span>
            </div>
            <div class="ddj-fx-row">
              <div class="ddj-fx-block">
                <h4>SOUND COLOR FX</h4>
                <div class="ddj-fx-grid" data-ddj-colorfx>
                  ${COLOR_FX.map((fx, i) =>
                    `<button type="button" class="${i === 3 ? "active" : ""}" data-fx="${fx}">${fx}</button>`
                  ).join("")}
                </div>
                <div class="ddj-knob-row">
                  <div class="ddj-knob-wrap">
                    <div class="ddj-knob" data-ddj-knob="sampler" data-min="0" data-max="100" data-value="60"><i></i></div>
                    <span>SAMPLER</span>
                  </div>
                </div>
              </div>
              <div class="ddj-fx-block">
                <h4>BEAT FX</h4>
                <div class="ddj-fx-lcd" data-ddj-fx-lcd>
                  <div><b data-ddj-fx-name>ECHO</b></div>
                  <div class="sub">AUTO <span data-ddj-fx-bpm>128</span> · 1/2 · CH 1</div>
                </div>
                <div class="ddj-fx-select" data-ddj-beatfx>
                  ${BEAT_FX.map((fx, i) =>
                    `<button type="button" class="${i === 0 ? "active" : ""}" data-fx="${fx}">${fx}</button>`
                  ).join("")}
                </div>
                <div class="ddj-knob-row">
                  <div class="ddj-knob-wrap">
                    <div class="ddj-knob" data-ddj-knob="level" data-min="0" data-max="100" data-value="40"><i></i></div>
                    <span>LEVEL</span>
                  </div>
                  <div class="ddj-knob-wrap">
                    <div class="ddj-knob" data-ddj-knob="time" data-min="0" data-max="100" data-value="50"><i></i></div>
                    <span>TIME</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="ddj-channels">
              ${[3, 1, 2, 4].map(channelHtml).join("")}
            </div>
            <div class="ddj-master-row">
              <div class="ddj-master-block">
                <span>MASTER</span>
                <div class="ddj-h-fader" data-ddj-master data-value="70"><div class="fill"></div><div class="cap"></div></div>
              </div>
              <div class="ddj-master-block">
                <span>PHONES</span>
                <div class="ddj-h-fader" data-ddj-phones data-value="50"><div class="fill"></div><div class="cap"></div></div>
              </div>
              <div class="ddj-master-block">
                <span>BOOTH</span>
                <div class="ddj-h-fader" data-ddj-booth data-value="60"><div class="fill"></div><div class="cap"></div></div>
              </div>
            </div>
            <div class="ddj-xfader-wrap">
              <span>CROSSFADER</span>
              <div class="ddj-xfader" data-ddj-xfader data-value="50"><div class="cap"></div></div>
            </div>
          </div>
          ${deckHtml("R")}
        </div>
        <div class="ddj-status" id="ddj_status">DDJ-1000 READY</div>
      </div>`;
  }

  function bind(state) {
    const root = document.getElementById("mod_ddj");
    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    if (state.ddjRaf) {
      cancelAnimationFrame(state.ddjRaf);
      state.ddjRaf = null;
    }
    if (state.ddjResizeObs) {
      try { state.ddjResizeObs.disconnect(); } catch { /* ignore */ }
      state.ddjResizeObs = null;
    }

    const setStatus = (text) => {
      const el = document.getElementById("ddj_status");
      if (el) el.textContent = text;
    };

    const themeRgb = () => {
      const cs = getComputedStyle(document.documentElement);
      return {
        r: Number(cs.getPropertyValue("--color_r")) || 0,
        g: Number(cs.getPropertyValue("--color_g")) || 200,
        b: Number(cs.getPropertyValue("--color_b")) || 255
      };
    };

    const audio = { ctx: null, master: null };
    const ensureAudio = async () => {
      if (audio.ctx) {
        if (audio.ctx.state === "suspended") await audio.ctx.resume();
        return audio.ctx;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = 0.3;
      master.connect(ctx.destination);
      audio.ctx = ctx;
      audio.master = master;
      return ctx;
    };

    const beep = async (freq, dur, gain = 0.1, type = "square") => {
      const ctx = await ensureAudio();
      if (!ctx || !audio.master) return;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.value = gain;
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      osc.connect(g);
      g.connect(audio.master);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    };

    /** Keep jog a perfect circle: size = min(stageW, stageH) in CSS pixels */
    const fitJogs = () => {
      root.querySelectorAll("[data-ddj-jog-stage]").forEach((stage) => {
        const jog = stage.querySelector("[data-ddj-jog]");
        if (!jog) return;
        const w = stage.clientWidth;
        const h = stage.clientHeight;
        if (w < 8 || h < 8) return;
        const size = Math.floor(Math.min(w, h) * 0.96);
        jog.style.width = `${size}px`;
        jog.style.height = `${size}px`;
      });
    };

    state.ddjResizeObs = new ResizeObserver(() => fitJogs());
    root.querySelectorAll("[data-ddj-jog-stage]").forEach((stage) => state.ddjResizeObs.observe(stage));
    requestAnimationFrame(fitJogs);

    const makeDeckState = (trackIndex) => {
      const t = TRACKS[trackIndex % TRACKS.length];
      return {
        deckNum: trackIndex === 0 ? 1 : 2,
        playing: false,
        position: 0,
        cuePos: 0,
        jogAngle: 0,
        vinyl: true,
        padMode: 0,
        hotcues: Array.from({ length: 8 }, () => null),
        tempo: 50,
        track: { ...t },
        syncOn: false
      };
    };

    const decks = { L: makeDeckState(0), R: makeDeckState(1) };

    const applyKnob = (knob, value) => {
      const min = Number(knob.dataset.min) || 0;
      const max = Number(knob.dataset.max) || 100;
      const span = Math.max(1, max - min);
      const t = Math.max(0, Math.min(1, (value - min) / span));
      knob.dataset.value = String(value);
      knob.style.transform = `rotate(${t * 270 - 135}deg)`;
    };

    root.querySelectorAll("[data-ddj-knob]").forEach((knob) => {
      const min = Number(knob.dataset.min) || 0;
      const max = Number(knob.dataset.max) || 100;
      let value = Number(knob.dataset.value);
      if (!Number.isFinite(value)) value = min;
      applyKnob(knob, value);
      knob.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        window.edex?.setMouseIgnore?.(false);
        const startY = event.clientY;
        const startVal = Number(knob.dataset.value) || min;
        const span = Math.max(1, max - min);
        try { knob.setPointerCapture(event.pointerId); } catch { /* ignore */ }
        const move = (ev) => {
          applyKnob(knob, Math.max(min, Math.min(max, startVal + ((startY - ev.clientY) / 1.5) * (span / 100))));
        };
        const up = (ev) => {
          try { knob.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          setStatus(`${String(knob.dataset.ddjKnob || "KNOB").toUpperCase()} ${Math.round(Number(knob.dataset.value))}`);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    });

    const applyVFader = (el, value) => {
      const v = Math.max(0, Math.min(100, value));
      el.dataset.value = String(v);
      const fill = el.querySelector(".fill, .ddj-tempo-fill");
      const cap = el.querySelector(".cap, .ddj-tempo-cap");
      if (fill) fill.style.height = `${v}%`;
      if (cap) cap.style.top = `${100 - v}%`;
      return v;
    };

    const bindVFader = (el, onChange) => {
      if (!el) return;
      const setFromY = (clientY) => {
        const rect = el.getBoundingClientRect();
        const t = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height)));
        onChange?.(applyVFader(el, t * 100));
      };
      applyVFader(el, Number(el.dataset.value) || 0);
      el.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        window.edex?.setMouseIgnore?.(false);
        el.classList.add("dragging");
        setFromY(event.clientY);
        try { el.setPointerCapture(event.pointerId); } catch { /* ignore */ }
        const move = (ev) => setFromY(ev.clientY);
        const up = (ev) => {
          el.classList.remove("dragging");
          try { el.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    };

    const applyHFader = (el, value) => {
      const v = Math.max(0, Math.min(100, value));
      el.dataset.value = String(v);
      const fill = el.querySelector(".fill");
      const cap = el.querySelector(".cap");
      if (fill) fill.style.width = `${v}%`;
      if (cap) cap.style.left = `${v}%`;
      return v;
    };

    const bindHFader = (el, onChange) => {
      if (!el) return;
      const setFromX = (clientX) => {
        const rect = el.getBoundingClientRect();
        const t = Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width)));
        onChange?.(applyHFader(el, t * 100));
      };
      applyHFader(el, Number(el.dataset.value) || 0);
      el.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        window.edex?.setMouseIgnore?.(false);
        el.classList.add("dragging");
        setFromX(event.clientX);
        try { el.setPointerCapture(event.pointerId); } catch { /* ignore */ }
        const move = (ev) => setFromX(ev.clientX);
        const up = (ev) => {
          el.classList.remove("dragging");
          try { el.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      });
    };

    const tempoToPct = (tempo) => ((tempo - 50) / 50) * 8;
    const effectiveBpm = (d) => d.track.bpm * (1 + tempoToPct(d.tempo) / 100);

    const syncDeckUi = (side) => {
      const el = root.querySelector(`.ddj-deck[data-side="${side}"]`);
      const d = decks[side];
      if (!el || !d) return;
      el.dataset.activeDeck = String(d.deckNum);
      el.querySelectorAll("[data-ddj-deck-tab]").forEach((tab) => {
        tab.classList.toggle("active", Number(tab.dataset.ddjDeckTab) === d.deckNum);
      });
      const pct = tempoToPct(d.tempo);
      const pctText = `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
      const bpmEl = el.querySelector("[data-ddj-bpm]");
      const timeEl = el.querySelector("[data-ddj-time]");
      const trackEl = el.querySelector("[data-ddj-track]");
      const keyEl = el.querySelector("[data-ddj-key]");
      const tempoVal = el.querySelector("[data-ddj-tempo-val]");
      const playBtn = el.querySelector("[data-ddj-play]");
      const lcdDeck = el.querySelector("[data-ddj-lcd-deck]");
      const lcdSync = el.querySelector("[data-ddj-lcd-sync]");
      const lcdPct = el.querySelector("[data-ddj-lcd-pct]");
      if (bpmEl) bpmEl.textContent = effectiveBpm(d).toFixed(1);
      if (trackEl) trackEl.textContent = d.track.title;
      if (keyEl) keyEl.textContent = `KEY ${d.track.key}`;
      if (tempoVal) tempoVal.textContent = pctText;
      if (lcdPct) lcdPct.textContent = pctText;
      if (lcdDeck) lcdDeck.textContent = `DECK ${d.deckNum}`;
      if (lcdSync) {
        lcdSync.textContent = d.syncOn ? "SYNC" : "—";
        lcdSync.style.opacity = d.syncOn ? "0.9" : "0.35";
      }
      if (timeEl) {
        const remain = Math.max(0, 180 - d.position);
        const m = Math.floor(remain / 60);
        const s = Math.floor(remain % 60);
        timeEl.textContent = `-${m}:${String(s).padStart(2, "0")}`;
      }
      if (playBtn) {
        playBtn.classList.toggle("on", d.playing);
        playBtn.classList.toggle("off", !d.playing);
      }
      const jog = el.querySelector("[data-ddj-jog]");
      const spin = el.querySelector("[data-ddj-spin]");
      const ringNeedle = el.querySelector("[data-ddj-ring-needle]");
      const rot = `rotate(${d.jogAngle}deg)`;
      if (spin) spin.style.transform = rot;
      if (ringNeedle) ringNeedle.style.transform = rot;
      if (jog) jog.classList.toggle("spinning", d.playing);
    };

    const loadTrack = (side, index) => {
      const t = TRACKS[((index % TRACKS.length) + TRACKS.length) % TRACKS.length];
      decks[side].track = { ...t };
      decks[side].position = 0;
      decks[side].cuePos = 0;
      decks[side].playing = false;
      syncDeckUi(side);
      const fxBpm = root.querySelector("[data-ddj-fx-bpm]");
      if (fxBpm) fxBpm.textContent = String(Math.round(t.bpm));
      setStatus(`DECK ${decks[side].deckNum} LOADED · ${t.title}`);
      beep(220 + index * 40, 0.08, 0.08, "triangle");
    };

    root.querySelectorAll(".ddj-deck").forEach((deckEl) => {
      const side = deckEl.dataset.side;
      const d = decks[side];

      deckEl.querySelectorAll("[data-ddj-deck-tab]").forEach((tab) => {
        tab.addEventListener("click", (event) => {
          event.stopPropagation();
          d.deckNum = Number(tab.dataset.ddjDeckTab);
          loadTrack(side, d.deckNum - 1);
        });
      });

      deckEl.querySelectorAll("[data-ddj-tog]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          const on = !btn.classList.contains("on");
          btn.classList.toggle("on", on);
          btn.classList.toggle("off", !on);
          if (btn.dataset.ddjTog === "slip") d.vinyl = !on;
          if (btn.dataset.ddjTog === "sync") {
            d.syncOn = on;
            syncDeckUi(side);
          }
          setStatus(`DECK ${d.deckNum} ${String(btn.dataset.ddjTog).toUpperCase()} ${on ? "ON" : "OFF"}`);
        });
      });

      deckEl.querySelector("[data-ddj-play]")?.addEventListener("click", async (event) => {
        event.stopPropagation();
        await ensureAudio();
        d.playing = !d.playing;
        syncDeckUi(side);
        setStatus(`DECK ${d.deckNum} ${d.playing ? "PLAYING" : "PAUSED"}`);
        beep(d.playing ? 440 : 220, 0.06, 0.1, "square");
      });

      deckEl.querySelector("[data-ddj-cue]")?.addEventListener("click", (event) => {
        event.stopPropagation();
        if (d.playing) {
          d.playing = false;
          d.position = d.cuePos;
        } else {
          d.position = d.cuePos;
          d.playing = true;
        }
        syncDeckUi(side);
        setStatus(`DECK ${d.deckNum} CUE`);
        beep(660, 0.05, 0.1, "triangle");
      });

      deckEl.querySelector("[data-ddj-shift]")?.addEventListener("click", (event) => {
        event.stopPropagation();
        const idx = TRACKS.findIndex((t) => t.title === d.track.title);
        loadTrack(side, idx + 1);
      });

      deckEl.querySelectorAll("[data-ddj-padmode]").forEach((btn) => {
        btn.addEventListener("click", (event) => {
          event.stopPropagation();
          d.padMode = Number(btn.dataset.ddjPadmode) || 0;
          deckEl.querySelectorAll("[data-ddj-padmode]").forEach((b) => {
            const on = Number(b.dataset.ddjPadmode) === d.padMode;
            b.classList.toggle("on", on);
            b.classList.toggle("off", !on);
          });
          setStatus(`DECK ${d.deckNum} PAD · ${PAD_MODES[d.padMode]}`);
        });
      });

      deckEl.querySelectorAll("[data-ddj-pad]").forEach((pad) => {
        pad.addEventListener("pointerdown", (event) => {
          event.stopPropagation();
          const i = Number(pad.dataset.ddjPad) || 0;
          // Cycle pad backlight color on each press (blank pads, no digits)
          const nextColor = ((Number(pad.dataset.padColor) || 0) % 8) + 1;
          pad.dataset.padColor = String(nextColor);
          pad.classList.add("hit", "lit");
          window.setTimeout(() => pad.classList.remove("hit"), 140);
          if (d.padMode === 0) {
            if (d.hotcues[i] == null) {
              d.hotcues[i] = d.position;
              setStatus(`DECK ${d.deckNum} HOT CUE ${i + 1} SET`);
            } else {
              d.position = d.hotcues[i];
              setStatus(`DECK ${d.deckNum} HOT CUE ${i + 1}`);
            }
          } else if (d.padMode === 2) {
            d.position = Math.max(0, d.position + (i < 4 ? -1 : 1) * (0.5 + (i % 4) * 0.5));
            setStatus(`DECK ${d.deckNum} BEAT JUMP`);
          } else {
            setStatus(`DECK ${d.deckNum} ${PAD_MODES[d.padMode]} ${i + 1}`);
          }
          beep(180 + i * 55 + d.padMode * 30, 0.07, 0.1, "square");
        });
      });

      bindVFader(deckEl.querySelector("[data-ddj-tempo]"), (v) => {
        d.tempo = v;
        syncDeckUi(side);
        setStatus(`DECK ${d.deckNum} TEMPO ${tempoToPct(v).toFixed(1)}%`);
      });

      const jog = deckEl.querySelector("[data-ddj-jog]");
      if (jog) {
        jog.addEventListener("pointerdown", (event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          window.edex?.setMouseIgnore?.(false);
          jog.classList.add("dragging");
          const rect = jog.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          let lastAng = Math.atan2(event.clientY - cy, event.clientX - cx);
          try { jog.setPointerCapture(event.pointerId); } catch { /* ignore */ }
          const move = (ev) => {
            const ang = Math.atan2(ev.clientY - cy, ev.clientX - cx);
            let delta = ang - lastAng;
            if (delta > Math.PI) delta -= Math.PI * 2;
            if (delta < -Math.PI) delta += Math.PI * 2;
            lastAng = ang;
            d.jogAngle = (d.jogAngle + (delta * 180) / Math.PI) % 360;
            if (d.playing || d.vinyl) d.position = Math.max(0, d.position + delta * 0.35);
            syncDeckUi(side);
          };
          const up = (ev) => {
            jog.classList.remove("dragging");
            try { jog.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
            setStatus(`DECK ${d.deckNum} JOG`);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", up);
        });
      }

      loadTrack(side, side === "L" ? 0 : 1);
    });

    root.querySelectorAll("[data-ddj-chfader]").forEach((fader) => {
      bindVFader(fader, (v) => setStatus(`CH ${fader.closest(".ddj-ch")?.dataset.ch} ${Math.round(v)}`));
    });

    root.querySelectorAll("[data-ddj-chcue]").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const on = !btn.classList.contains("on");
        btn.classList.toggle("on", on);
        btn.classList.toggle("off", !on);
        setStatus(`CH ${btn.closest(".ddj-ch")?.dataset.ch} CUE ${on ? "ON" : "OFF"}`);
        beep(520, 0.04, 0.06, "sine");
      });
    });

    bindHFader(root.querySelector("[data-ddj-master]"), (v) => {
      const read = root.querySelector("[data-ddj-master-read]");
      if (read) read.textContent = String(Math.round(v));
      if (audio.master) audio.master.gain.value = (v / 100) * 0.45;
      setStatus(`MASTER ${Math.round(v)}`);
    });
    bindHFader(root.querySelector("[data-ddj-phones]"), (v) => setStatus(`PHONES ${Math.round(v)}`));
    bindHFader(root.querySelector("[data-ddj-booth]"), (v) => setStatus(`BOOTH ${Math.round(v)}`));
    bindHFader(root.querySelector("[data-ddj-xfader]"), (v) => setStatus(`CROSSFADER ${Math.round(v)}`));

    root.querySelectorAll("[data-ddj-beatfx] button").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        btn.parentElement?.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const name = root.querySelector("[data-ddj-fx-name]");
        if (name) name.textContent = btn.dataset.fx || "FX";
        setStatus(`BEAT FX · ${btn.dataset.fx}`);
        beep(300, 0.05, 0.07, "sine");
      });
    });

    root.querySelectorAll("[data-ddj-colorfx] button").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        btn.parentElement?.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        setStatus(`COLOR FX · ${btn.dataset.fx}`);
        beep(280, 0.05, 0.07, "sine");
      });
    });

    const drawWave = (canvas, d, theme) => {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = `rgba(${theme.r},${theme.g},${theme.b},0.12)`;
      ctx.fillRect(0, 0, w, h);
      const mid = h / 2;
      ctx.strokeStyle = `rgba(${theme.r},${theme.g},${theme.b},0.9)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x < w; x++) {
        const phase = d.position * 18 + x * 0.4 + d.jogAngle * 0.02;
        const amp = (Math.sin(phase) * 0.5 + Math.sin(phase * 2.1) * 0.25) * (mid - 2);
        const y = mid + amp * (0.5 + (d.playing ? 0.5 : 0.15));
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.fillStyle = `rgba(${theme.r},${theme.g},${theme.b},0.95)`;
      ctx.fillRect((d.position * 12) % w, 0, 2, h);
    };

    // Jog RPM follows beat/tempo: deg/sec = (BPM/60) * degPerBeat
    const spinRate = (d) => {
      const bpm = Math.max(40, effectiveBpm(d));
      if (!d.playing) return bpm * 0.08;
      return (bpm / 60) * 210;
    };

    // Cache hot DOM once — avoid querySelector storms every frame
    const deckEls = {
      L: root.querySelector('.ddj-deck[data-side="L"]'),
      R: root.querySelector('.ddj-deck[data-side="R"]')
    };
    const spinEls = {
      L: deckEls.L?.querySelector("[data-ddj-spin]"),
      R: deckEls.R?.querySelector("[data-ddj-spin]")
    };
    const ringEls = {
      L: deckEls.L?.querySelector("[data-ddj-ring-needle]"),
      R: deckEls.R?.querySelector("[data-ddj-ring-needle]")
    };
    const waveEls = {
      L: deckEls.L?.querySelector("[data-ddj-wave]"),
      R: deckEls.R?.querySelector("[data-ddj-wave]")
    };
    const jogEls = {
      L: deckEls.L?.querySelector("[data-ddj-jog]"),
      R: deckEls.R?.querySelector("[data-ddj-jog]")
    };
    const meterRefs = [...root.querySelectorAll(".ddj-ch")].map((chEl) => ({
      ch: Number(chEl.dataset.ch),
      fader: chEl.querySelector("[data-ddj-chfader]"),
      meter: chEl.querySelector("[data-ddj-meter]")
    }));

    let lastTs = 0;
    let lastUi = 0;
    let lastWave = 0;
    let lastMeter = 0;
    let cachedTheme = themeRgb();
    let themeAt = 0;

    const applySpinOnly = (side) => {
      const d = decks[side];
      const rot = `rotate(${d.jogAngle}deg)`;
      if (spinEls[side]) spinEls[side].style.transform = rot;
      if (ringEls[side]) ringEls[side].style.transform = rot;
      if (jogEls[side]) jogEls[side].classList.toggle("spinning", d.playing);
    };

    const tick = (ts) => {
      if (!document.getElementById("mod_ddj")) {
        state.ddjRaf = null;
        return;
      }
      state.ddjRaf = requestAnimationFrame(tick);
      if (document.visibilityState === "hidden") {
        lastTs = 0;
        return;
      }
      // Cap ~30 fps for the whole DDJ loop
      if (lastTs && ts - lastTs < 33) return;
      const dt = lastTs ? Math.min(0.08, (ts - lastTs) / 1000) : 0.016;
      lastTs = ts;

      if (!themeAt || ts - themeAt > 1200) {
        cachedTheme = themeRgb();
        themeAt = ts;
      }

      ["L", "R"].forEach((side) => {
        const d = decks[side];
        d.jogAngle = (d.jogAngle + dt * spinRate(d)) % 360;
        if (d.playing) d.position += dt * (effectiveBpm(d) / 60);
        applySpinOnly(side);
      });

      // Text/BPM/time: ~5 Hz
      if (!lastUi || ts - lastUi > 200) {
        lastUi = ts;
        syncDeckUi("L");
        syncDeckUi("R");
      }

      // Waveform: ~12 Hz
      if (!lastWave || ts - lastWave > 80) {
        lastWave = ts;
        drawWave(waveEls.L, decks.L, cachedTheme);
        drawWave(waveEls.R, decks.R, cachedTheme);
      }

      // Meters: ~8 Hz
      if (!lastMeter || ts - lastMeter > 120) {
        lastMeter = ts;
        for (const ref of meterRefs) {
          if (!ref.meter) continue;
          const fader = Number(ref.fader?.dataset.value) || 0;
          const boost =
            (ref.ch === decks.L.deckNum && decks.L.playing) ||
            (ref.ch === decks.R.deckNum && decks.R.playing)
              ? 1
              : 0.2;
          ref.meter.style.height = `${Math.min(100, fader * (0.45 + Math.random() * 0.45) * boost)}%`;
        }
      }
    };

    decks.L.playing = true;
    decks.R.playing = true;
    syncDeckUi("L");
    syncDeckUi("R");
    fitJogs();
    state.ddjRaf = requestAnimationFrame(tick);
    setStatus("DDJ-1000 ONLINE · JOG CIRCLE LOCKED");
  }

  window.ddjPanel = { bodyHtml, bind };
})();
