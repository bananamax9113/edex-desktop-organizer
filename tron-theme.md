# Tron 主題配色（前端開發參考）

來源：`src/assets/themes/tron.json`（eDEX 預設主題），以及 organizer 前端套用時的 CSS 變數與語意色 fallback。

主色為偏青的冷白（cyan-ice），背景為近黑藍。介面幾乎只用「主色 + 透明度」堆出層級，紅色／黃色僅用於錯誤與警告。

---

## 核心色票

| Token | Hex | RGB | 用途 |
| --- | --- | --- | --- |
| `primary` | `#aacfd1` | `170, 207, 209` | 文字、邊框、圖示、游標、高亮 |
| `black` | `#000000` | `0, 0, 0` | 純黑、陰影、地球儀底色 |
| `bg` / `light_black` | `#05080d` | `5, 8, 13` | 頁面／面板底、終端背景 |
| `grey` | `#262828` | `38, 40, 40` | 網格線、次底、分割線 |
| `danger` / `red` | `#ff3c3c` | `255, 60, 60` | 錯誤、刪除、危險操作（主題 JSON 未定義，前端 fallback） |
| `warning` / `yellow` | `#ffd23c` | `255, 210, 60` | 警告、待處理（主題 JSON 未定義，前端 fallback） |
| `led` | `#ffffff` | `255, 255, 255` | 時鐘 LED 點亮色 |

主色 RGB 分量（主題 JSON 原始欄位）：

```
r: 170
g: 207
b: 209
```

---

## CSS 變數（建議直接複製）

```css
:root {
  --font_main: "United Sans Medium", "Rajdhani", "Segoe UI", sans-serif;
  --font_main_light: "United Sans Light", "Rajdhani", "Segoe UI", sans-serif;
  --font_mono: "Fira Mono", "Share Tech Mono", Consolas, monospace;

  --color_r: 170;
  --color_g: 207;
  --color_b: 209;

  --color_black: #000000;
  --color_light_black: #05080d;
  --color_grey: #262828;
  --color_red: #ff3c3c;
  --color_yellow: #ffd23c;

  --color_primary: rgb(var(--color_r), var(--color_g), var(--color_b));
  --color_primary_hex: #aacfd1;
}
```

主色請用 RGB 分量組字，方便同一套色套透明度：

```css
color: rgb(var(--color_r), var(--color_g), var(--color_b));
border-color: rgba(var(--color_r), var(--color_g), var(--color_b), 0.45);
background: rgba(var(--color_r), var(--color_g), var(--color_b), 0.18);
```

---

## 語意對照（前端元件）

| 語意 | 建議寫法 | 實際值 |
| --- | --- | --- |
| 頁面背景 | `var(--color_light_black)` | `#05080d` |
| 主文字 | `rgb(var(--color_r), var(--color_g), var(--color_b))` | `#aacfd1` |
| 反白文字（填滿按鈕上） | `var(--color_light_black)` | `#05080d` |
| 面板底 | `var(--color_light_black)` | `#05080d` |
| 次要底／網格 | `var(--color_grey)` | `#262828` |
| 預設邊框 | `rgba(..., 0.45)` | `rgba(170, 207, 209, 0.45)` |
| 弱邊框 | `rgba(..., 0.28)` | `rgba(170, 207, 209, 0.28)` |
| 強邊框／焦點 | `rgb(...)` 實線 | `#aacfd1` |
| Hover 底 | `rgba(..., 0.18)` ~ `0.25` | — |
| 選取／按下 | `rgba(..., 0.30)` | 與終端 selection 相同 |
| Glow | `box-shadow: 0 0 0.6rem rgba(..., 0.55)` | — |
| 錯誤 | `var(--color_red)` | `#ff3c3c` |
| 警告 | `var(--color_yellow)` | `#ffd23c` |

### 常用透明度階梯

現有 UI 實際使用的 alpha（由弱到強）：

| Alpha | 用途 |
| --- | --- |
| `0.04` | 掃描線、極淡紋理 |
| `0.08` | 六角／輻射壁紙 |
| `0.18` | hover 底、中央光暈 |
| `0.22` ~ `0.25` | 按鈕 hover、填充 |
| `0.28` | 弱邊框 |
| `0.30` | 選取、按下 |
| `0.32` ~ `0.35` | 對齊輔助線、半實底 |
| `0.45` | 虛線／一般邊框 |
| `0.55` | 強調邊框、外發光 |

---

## 終端／程式碼區塊

| 項目 | 值 |
| --- | --- |
| `foreground` | `#aacfd1` |
| `background` | `#05080d` |
| `cursor` | `#aacfd1` |
| `cursorAccent` | `#aacfd1` |
| `selection` | `rgba(170, 207, 209, 0.3)` |
| `cursorStyle` | `block` |
| `fontFamily` | `Fira Mono` |

---

## 地球儀／標記色

| 項目 | 值 |
| --- | --- |
| `base` | `#000000` |
| `marker` | `#aacfd1` |
| `pin` | `#aacfd1` |
| `satellite` | `#aacfd1` |

---

## JS / CSS-in-JS 物件

```js
export const tronTheme = {
  name: "tron",
  colors: {
    r: 170,
    g: 207,
    b: 209,
    primary: "#aacfd1",
    black: "#000000",
    background: "#05080d",
    grey: "#262828",
    danger: "#ff3c3c",
    warning: "#ffd23c",
    led: "#ffffff",
  },
  alpha: {
    texture: 0.04,
    wallpaper: 0.08,
    hover: 0.18,
    fill: 0.22,
    borderWeak: 0.28,
    selection: 0.3,
    border: 0.45,
    glow: 0.55,
  },
  fonts: {
    ui: '"United Sans Medium", "Rajdhani", "Segoe UI", sans-serif',
    uiLight: '"United Sans Light", "Rajdhani", "Segoe UI", sans-serif',
    mono: '"Fira Mono", "Share Tech Mono", Consolas, monospace',
  },
  terminal: {
    fontFamily: "Fira Mono",
    cursorStyle: "block",
    foreground: "#aacfd1",
    background: "#05080d",
    cursor: "#aacfd1",
    cursorAccent: "#aacfd1",
    selection: "rgba(170,207,209,0.3)",
  },
};

export const rgb = (a = 1) =>
  a === 1
    ? `rgb(${tronTheme.colors.r}, ${tronTheme.colors.g}, ${tronTheme.colors.b})`
    : `rgba(${tronTheme.colors.r}, ${tronTheme.colors.g}, ${tronTheme.colors.b}, ${a})`;
```

---

## Tailwind 對應（可選）

```js
// tailwind.config 片段
theme: {
  extend: {
    colors: {
      tron: {
        DEFAULT: "#aacfd1",
        black: "#000000",
        bg: "#05080d",
        grey: "#262828",
        danger: "#ff3c3c",
        warning: "#ffd23c",
      },
    },
    fontFamily: {
      tron: ['"United Sans Medium"', "Rajdhani", "Segoe UI", "sans-serif"],
      "tron-mono": ['"Fira Mono"', '"Share Tech Mono"', "Consolas", "monospace"],
    },
  },
}
```

使用示例：`bg-tron-bg text-tron border-tron/45 hover:bg-tron/18`

---

## 使用原則

1. **不要另開一組灰階文字色。** 次要資訊用主色降透明度，不要改成中性灰。
2. **底只用 `#05080d` 與 `#262828`。** 避免純白底或淺灰卡片。
3. **互動態優先改 alpha，不要改 hue。** Hover / Active / Focus 都走同一組 RGB。
4. **紅黃只出現在狀態，不當作品牌色。**
5. 字體：UI 用 Sans（United Sans / Rajdhani），數據與路徑用 Mono（Fira Mono / Share Tech Mono）。

---

## 來源檔

- 主題定義：`src/assets/themes/tron.json`
- 前端預設 CSS：`organizer/src/organizer.css` 的 `:root`
- 執行期套用：`organizer/src/renderer.js` → `applyTheme()`
