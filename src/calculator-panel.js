/* Sci-fi calculator panel for eDEX organizer */

(function () {
  function bodyHtml() {
    return `
      <div id="mod_calculator" class="calc-root" tabindex="0" aria-label="計算器">
        <div class="calc-screen">
          <div class="calc-expr" id="calc_expr"></div>
          <div class="calc-display" id="calc_display">0</div>
        </div>
        <div class="calc-pad" id="calc_pad">
          <button type="button" data-calc="clear" class="calc-fn calc-clear">C</button>
          <button type="button" data-calc="back" class="calc-fn">⌫</button>
          <button type="button" data-calc="pct" class="calc-fn">%</button>
          <button type="button" data-calc="op" data-op="/" class="calc-op">÷</button>

          <button type="button" data-calc="digit" data-digit="7">7</button>
          <button type="button" data-calc="digit" data-digit="8">8</button>
          <button type="button" data-calc="digit" data-digit="9">9</button>
          <button type="button" data-calc="op" data-op="*" class="calc-op">×</button>

          <button type="button" data-calc="digit" data-digit="4">4</button>
          <button type="button" data-calc="digit" data-digit="5">5</button>
          <button type="button" data-calc="digit" data-digit="6">6</button>
          <button type="button" data-calc="op" data-op="-" class="calc-op">−</button>

          <button type="button" data-calc="digit" data-digit="1">1</button>
          <button type="button" data-calc="digit" data-digit="2">2</button>
          <button type="button" data-calc="digit" data-digit="3">3</button>
          <button type="button" data-calc="op" data-op="+" class="calc-op">+</button>

          <button type="button" data-calc="sign" class="calc-fn">±</button>
          <button type="button" data-calc="digit" data-digit="0">0</button>
          <button type="button" data-calc="dot">.</button>
          <button type="button" data-calc="eq" class="calc-eq">=</button>
        </div>
      </div>`;
  }

  const OP_LABEL = { "+": "+", "-": "−", "*": "×", "/": "÷" };

  function formatNum(n) {
    if (!Number.isFinite(n)) return "Error";
    const abs = Math.abs(n);
    let s;
    if (abs !== 0 && (abs >= 1e12 || abs < 1e-9)) {
      s = n.toExponential(8).replace(/\.?0+e/, "e");
    } else {
      s = String(parseFloat(n.toPrecision(12)));
    }
    if (s.length > 14) s = n.toExponential(6);
    return s;
  }

  function compute(a, op, b) {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": return b === 0 ? NaN : a / b;
      default: return b;
    }
  }

  function bind(state) {
    const root = document.getElementById("mod_calculator");
    if (!root || root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    const displayEl = document.getElementById("calc_display");
    const exprEl = document.getElementById("calc_expr");
    const pad = document.getElementById("calc_pad");
    if (!displayEl || !exprEl || !pad) return;

    let current = "0";
    let acc = null;
    let pending = null;
    let fresh = true;
    let error = false;

    const paint = () => {
      displayEl.textContent = error ? "Error" : current;
      if (pending != null && acc != null && !error) {
        exprEl.textContent = `${formatNum(acc)} ${OP_LABEL[pending] || pending}`;
      } else {
        exprEl.textContent = "";
      }
      pad.querySelectorAll(".calc-op").forEach((btn) => {
        btn.classList.toggle("active", pending != null && btn.dataset.op === pending && !error);
      });
    };

    const reset = () => {
      current = "0";
      acc = null;
      pending = null;
      fresh = true;
      error = false;
      paint();
    };

    const inputDigit = (d) => {
      if (error) reset();
      if (fresh) {
        current = d;
        fresh = false;
      } else if (current === "0" && d !== ".") {
        current = d;
      } else if (current.replace("-", "").replace(".", "").length < 14) {
        current += d;
      }
      paint();
    };

    const inputDot = () => {
      if (error) reset();
      if (fresh) {
        current = "0.";
        fresh = false;
      } else if (!current.includes(".")) {
        current += ".";
      }
      paint();
    };

    const setOp = (op) => {
      if (error) reset();
      const value = parseFloat(current);
      if (pending != null && acc != null && !fresh) {
        const next = compute(acc, pending, value);
        if (!Number.isFinite(next)) {
          error = true;
          current = "0";
          acc = null;
          pending = null;
          fresh = true;
          paint();
          return;
        }
        acc = next;
        current = formatNum(next);
      } else {
        acc = value;
      }
      pending = op;
      fresh = true;
      paint();
    };

    const equals = () => {
      if (error || pending == null || acc == null) return;
      const value = parseFloat(current);
      const next = compute(acc, pending, value);
      if (!Number.isFinite(next)) {
        error = true;
        current = "0";
      } else {
        current = formatNum(next);
      }
      acc = null;
      pending = null;
      fresh = true;
      paint();
    };

    const backspace = () => {
      if (error || fresh) {
        reset();
        return;
      }
      current = current.length <= 1 || (current.length === 2 && current.startsWith("-"))
        ? "0"
        : current.slice(0, -1);
      if (current === "-" || current === "") current = "0";
      paint();
    };

    const toggleSign = () => {
      if (error) return;
      if (current === "0") return;
      current = current.startsWith("-") ? current.slice(1) : `-${current}`;
      paint();
    };

    const percent = () => {
      if (error) return;
      const value = parseFloat(current) / 100;
      current = formatNum(value);
      fresh = true;
      paint();
    };

    const handle = (action, btn) => {
      switch (action) {
        case "digit": inputDigit(btn.dataset.digit); break;
        case "dot": inputDot(); break;
        case "op": setOp(btn.dataset.op); break;
        case "eq": equals(); break;
        case "clear": reset(); break;
        case "back": backspace(); break;
        case "sign": toggleSign(); break;
        case "pct": percent(); break;
        default: break;
      }
    };

    // Keep card drag on title only — never start drag from the pad.
    root.addEventListener("pointerdown", (event) => event.stopPropagation());

    pad.addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-calc]");
      if (!btn || !pad.contains(btn)) return;
      handle(btn.dataset.calc, btn);
      root.focus({ preventScroll: true });
    });

    root.addEventListener("keydown", (event) => {
      const k = event.key;
      if (/^[0-9]$/.test(k)) {
        event.preventDefault();
        inputDigit(k);
        return;
      }
      if (k === ".") {
        event.preventDefault();
        inputDot();
        return;
      }
      if (k === "+" || k === "-" || k === "*" || k === "/") {
        event.preventDefault();
        setOp(k);
        return;
      }
      if (k === "Enter" || k === "=") {
        event.preventDefault();
        equals();
        return;
      }
      if (k === "Escape" || k === "c" || k === "C") {
        event.preventDefault();
        reset();
        return;
      }
      if (k === "Backspace") {
        event.preventDefault();
        backspace();
        return;
      }
      if (k === "%") {
        event.preventDefault();
        percent();
        return;
      }
    });

    paint();
    // Focus when the panel is first bound so keyboard works immediately.
    requestAnimationFrame(() => root.focus({ preventScroll: true }));
  }

  window.calculatorPanel = { bodyHtml, bind };
})();
