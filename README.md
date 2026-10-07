# eDEX Desktop Organizer

以 [eDEX-UI](https://github.com/GitSquared/edex-ui) 的科幻 HUD 佈局為桌面整理工具：

- 左欄：時鐘、路徑、分類佔比（原 SYSTEM 面板）
- 中央：分類分頁與桌面檔案格（原 TERMINAL）
- 右欄：分類規則與操作紀錄（原 NETWORK 面板）
- 下方檔案列：整理後的目標資料夾（原 FILESYSTEM）
- 底部按鍵列：掃描 / 預覽 / 執行 / 還原（原 KEYBOARD）

## 執行

```powershell
cd organizer
npm install
npm start
```

## 編譯 Windows 安裝程式

```powershell
cd organizer
npm install
npm run dist
```

產出：`organizer/dist/eDEX-Desktop-Organizer-Setup-1.0.0.exe`（NSIS 安裝包，可在其他 Windows 電腦安裝）。

啟動時會依選定顯示器解析度鋪滿畫面。容器可拖曳／縮放，並以固定間距磁吸對齊；桌面圖示以方框容器顯示。設定中可切換原版主題與壁紙樣式（`THEME` / `WALL` 或 F9 / F8）。

預設掃描 Windows 桌面，並把檔案依類型移入桌面上的分類資料夾。可用底部 `UNDO` 還原上一次整理。
