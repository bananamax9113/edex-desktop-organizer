/* Flat cyberpunk cassette — yellow label + gear hubs; auto-reverse */

(function () {
  const TAPES = [
    { title: "C-90", duration: 90 },
    { title: "C-60", duration: 60 },
    { title: "C-46", duration: 46 }
  ];

  /** Flat gear hub matching the reference art */
  function gearSvg() {
    const teeth = 12;
    const outer = 46;
    const inner = 34;
    const hole = 14;
    const pts = [];
    for (let i = 0; i < teeth * 2; i += 1) {
      const a = (Math.PI * i) / teeth - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`);
    }
    return `
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <polygon points="${pts.join(" ")}" fill="#9aa0a6"/>
        <circle cx="50" cy="50" r="${hole}" fill="#141414"/>
        <circle cx="50" cy="50" r="6.5" fill="#9aa0a6"/>
      </svg>`;
  }

  function reelHtml(id) {
    return `
      <div class="cass-reel" data-reel="${id}" title="PLAY / STOP">
        <div class="cass-spin" data-cass-spin>
          <div class="cass-pack" data-cass-pack></div>
          <div class="cass-flange">${gearSvg()}</div>
        </div>
      </div>`;
  }

  function bodyHtml() {
    return `
      <div id="mod_cassette" class="cass-root">
        <div class="cass-stage">
          <div class="cass-shell" aria-label="Compact cassette">
            <i class="cass-screw tl"></i>
            <i class="cass-screw tr"></i>
            <i class="cass-screw bl"></i>
            <i class="cass-screw br"></i>

            <div class="cass-headbay" aria-hidden="true">
              <i></i><i class="round"></i><i></i><i class="wide"></i><i></i><i class="round"></i><i></i>
            </div>

            <div class="cass-label">
              <div class="cass-window">
                ${reelHtml("L")}
                <span class="cass-bridge" aria-hidden="true"></span>
                ${reelHtml("R")}
              </div>
              <div class="cass-label-meta">
                <span class="cass-label-lines" aria-hidden="true"></span>
                <span class="cass-side-mark" data-cass-side-badge>B</span>
              </div>
              <span class="cass-side-a" data-cass-side-a hidden>A</span>
              <span class="cass-side-b" data-cass-side-b hidden>B</span>
            </div>
          </div>
        </div>
        <div class="cass-hud">
          <button type="button" class="cass-btn" data-cass-prev>◁◁</button>
          <button type="button" class="cass-btn on" data-cass-play>PLAY</button>
          <button type="button" class="cass-btn" data-cass-rev>REV</button>
          <span class="cass-title" data-cass-title>C-90</span>
          <span class="cass-dir" data-cass-dir>FWD</span>
          <span class="cass-time" data-cass-time>00:00</span>
          <button type="button" class="cass-btn" data-cass-next>▷▷</button>
        </div>
      </div>`;
  }

  function bind(state) {
    const root = document.getElementById("mod_cassette");
    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    if (state.cassetteRaf) {
      cancelAnimationFrame(state.cassetteRaf);
      state.cassetteRaf = null;
    }

    const els = {
      title: root.querySelector("[data-cass-title]"),
      time: root.querySelector("[data-cass-time]"),
      dir: root.querySelector("[data-cass-dir]"),
      play: root.querySelector("[data-cass-play]"),
      sideA: root.querySelector("[data-cass-side-a]"),
      sideB: root.querySelector("[data-cass-side-b]"),
      sideBadge: root.querySelector("[data-cass-side-badge]"),
      spinL: root.querySelector('[data-reel="L"] [data-cass-spin]'),
      spinR: root.querySelector('[data-reel="R"] [data-cass-spin]'),
      reelL: root.querySelector('[data-reel="L"]'),
      reelR: root.querySelector('[data-reel="R"]'),
      packL: root.querySelector('[data-reel="L"] [data-cass-pack]'),
      packR: root.querySelector('[data-reel="R"] [data-cass-pack]')
    };

    const sim = {
      tapeIndex: 0,
      playing: true,
      lengthRight: 0.08,
      dir: 1,
      side: "A",
      angleL: 0,
      angleR: 0,
      reversing: false,
      lastPackL: -1,
      lastPackR: -1
    };

    const R_HUB = 0.28;
    const R_MAX = 1;
    const SIDE_SECONDS = 26;
    const SPIN_GAIN = 420;

    const tape = () => TAPES[sim.tapeIndex % TAPES.length];
    const lengthLeft = () => 1 - sim.lengthRight;

    const packRadiusNorm = (length) => {
      const a = Math.max(0.001, Math.min(1, length));
      return R_HUB + (R_MAX - R_HUB) * Math.sqrt(a);
    };

    const packRadiusPct = (length) => {
      const t = (packRadiusNorm(length) - R_HUB) / (R_MAX - R_HUB);
      return Math.round(38 + 40 * t);
    };

    const syncLabel = () => {
      const t = tape();
      if (els.title) els.title.textContent = t.title;
      els.sideA?.classList.toggle("active", sim.side === "A");
      els.sideB?.classList.toggle("active", sim.side === "B");
      if (els.sideBadge) els.sideBadge.textContent = sim.side;
    };

    const applyPacks = () => {
      const rL = packRadiusPct(lengthLeft());
      const rR = packRadiusPct(sim.lengthRight);
      if (els.packL && rL !== sim.lastPackL) {
        sim.lastPackL = rL;
        els.packL.style.width = `${rL}%`;
        els.packL.style.height = `${rL}%`;
      }
      if (els.packR && rR !== sim.lastPackR) {
        sim.lastPackR = rR;
        els.packR.style.width = `${rR}%`;
        els.packR.style.height = `${rR}%`;
      }
    };

    const applySpins = () => {
      if (els.spinL) els.spinL.style.transform = `rotate(${sim.angleL}deg)`;
      if (els.spinR) els.spinR.style.transform = `rotate(${sim.angleR}deg)`;
    };

    const fmtTime = () => {
      const t = tape();
      const sideSec = Math.max(30, t.duration * 18);
      const pos = sim.dir > 0 ? sim.lengthRight : lengthLeft();
      const sec = Math.floor(pos * sideSec);
      if (els.time) {
        els.time.textContent = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
      }
    };

    const syncDirUi = () => {
      if (els.dir) els.dir.textContent = sim.dir > 0 ? "FWD" : "REV";
      if (els.play) {
        els.play.classList.toggle("on", sim.playing);
        els.play.textContent = sim.playing ? "PLAY" : "STOP";
      }
      els.reelL?.classList.toggle("is-spinning", sim.playing);
      els.reelR?.classList.toggle("is-spinning", sim.playing);
      root.classList.toggle("is-playing", sim.playing);
    };

    const flipSide = () => {
      sim.side = sim.side === "A" ? "B" : "A";
      syncLabel();
    };

    const reverseAtEnd = () => {
      if (sim.reversing) return;
      sim.reversing = true;
      sim.dir *= -1;
      flipSide();
      syncDirUi();
      window.setTimeout(() => {
        sim.reversing = false;
      }, 280);
    };

    els.play?.addEventListener("click", (e) => {
      e.stopPropagation();
      sim.playing = !sim.playing;
      syncDirUi();
    });

    root.querySelector("[data-cass-rev]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      sim.dir *= -1;
      flipSide();
      syncDirUi();
    });

    const loadTape = (delta) => {
      sim.tapeIndex = (sim.tapeIndex + delta + TAPES.length) % TAPES.length;
      sim.lengthRight = 0.08;
      sim.dir = 1;
      sim.side = "A";
      sim.lastPackL = sim.lastPackR = -1;
      syncLabel();
      syncDirUi();
      applyPacks();
      applySpins();
    };

    root.querySelector("[data-cass-prev]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      loadTape(-1);
    });
    root.querySelector("[data-cass-next]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      loadTape(1);
    });

    root.querySelectorAll(".cass-reel").forEach((reel) => {
      reel.addEventListener("click", (e) => {
        e.stopPropagation();
        sim.playing = !sim.playing;
        syncDirUi();
      });
    });

    let lastTs = 0;
    let lastTimeUi = 0;

    const tick = (ts) => {
      if (!document.getElementById("mod_cassette")) {
        state.cassetteRaf = null;
        return;
      }
      state.cassetteRaf = requestAnimationFrame(tick);
      if (document.visibilityState === "hidden") {
        lastTs = 0;
        return;
      }
      if (lastTs && ts - lastTs < 48) return;
      const dt = lastTs ? Math.min(0.08, (ts - lastTs) / 1000) : 0.016;
      lastTs = ts;

      if (sim.playing && !sim.reversing) {
        const v = sim.dir / SIDE_SECONDS;
        const dLen = v * dt;
        const rL = packRadiusNorm(lengthLeft());
        const rR = packRadiusNorm(sim.lengthRight);
        sim.angleL += (-dLen / rL) * SPIN_GAIN;
        sim.angleR += (dLen / rR) * SPIN_GAIN;
        sim.lengthRight += dLen;
        if (sim.lengthRight >= 1) {
          sim.lengthRight = 1;
          reverseAtEnd();
        } else if (sim.lengthRight <= 0) {
          sim.lengthRight = 0;
          reverseAtEnd();
        }
      }

      applySpins();
      applyPacks();
      if (!lastTimeUi || ts - lastTimeUi > 300) {
        lastTimeUi = ts;
        fmtTime();
      }
    };

    syncLabel();
    syncDirUi();
    applyPacks();
    applySpins();
    fmtTime();
    state.cassetteRaf = requestAnimationFrame(tick);
  }

  window.cassettePanel = { bodyHtml, bind };
})();
