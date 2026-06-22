# 06 — Todo：介面、畫面與響應式

> 階段：開發期｜來源設計：[03_ui_ux.md](../design/03_ui_ux.md)｜前置：[01](01_todo_setup.md)；整合各功能模組（[02](02_todo_data.md)、[04](04_todo_human_model.md)、[05](05_todo_assessment.md)）

## 畫面

- [ ] 人體模型檢視畫面：控制項清單依 03 §3.5（分層、單一部位還原、標籤、LOD、視角），與 [04](04_todo_human_model.md) 整合。**已完成**：各斷點／方向欄佈局——純函式 `render/modelPageLayout`（Expanded 任一方向／Medium 橫式→模型檢視器與身體標註清單並排 `split`；手機任一／平板直式→堆疊 `stack`），`.modelViewerPage[data-page-layout]` CSS 切換、單元測試；**控制項收斂**——次要控制（region／label-mode／LOD）折入「顯示選項」WAI-ARIA disclosure（預設收合），主要控制（視角／標籤／關節活動）恆顯（`Model3DControls`）；**患者檢視模式**——`patientView` 一鍵 toggle，隱藏工具列／分層面板／控制項／重置按鈕，保留畫布與選取部位資訊卡（`model.vue` → `Model3DViewer` prop）。**仍待（待實機）**：精準貼近部位定位（待真實資產執行期螢幕座標）；3D 執行期 FPS 動態降級（已接線、待實機目視）

## 導覽與 App Shell（§3.3）

- [ ] Service Worker 導覽後備（離線回殼層）＋主機 SPA rewrite（03 §3.3.4–3.3.5）—— SW 離線回殼層已 done；主機 SPA rewrite 屬部署目標（人為決策，見[發布前檢核表](../release_checklist.md) §4）

## 視覺改版（full visual refresh，§3.7.2–3.7.4、§3.3.3、§3.3.8）

- [x] **light 主題改用 jolly-health sage 配色**（§3.7.2）：sage 品牌綠 `#596d5d`（accent/focus/border 取向）＋暖白 bg＋淡 sage 分隔線；新增 `--sage-50…950` primitive；dark 維持冷 slate、共用 sage accent（暗背景提亮 sage-300）；臨床色不變。`tokens.contrast.test.ts` 雙主題 AA 仍全綠（20/20）。PWA `theme_color` 同步 sage；3D 視埠 accent（sceneHighlight／jointGizmo）刻意維持 teal（對解剖對比、非主題 chrome）。
- [x] **「量測儀器」字排識別**（§3.7.3，刻意取一風險）：系統 mono 升格為資料字（代碼/角度/日期/計數/`n/15`）＋ eyebrow 結構小標；零字體下載、CJK 原生。token：`--tracking-eyebrow/-data/-tight`、`--font-size-eyebrow`；工具 `.eyebrow`／`.dataText`。
- [x] **簽名：`StatusChip` → Quadrant Mark**（§3.7.4）：FN/FP/DN/DP 改為微縮 2×2 方格（位置即答案），與 `SfmaQuadrant` 輸入同構；既有 a11y 契約（`role=img`/`aria-label`/`.statusChipCode`/`.statusChipPain`/`data-axis`/`data-status`）全保留、測試綠。
- [x] **App Bar chrome**（§3.3.3）：`‹`/`⚙` 文字字符 → 真實 SVG（chevron-left／齒輪）；根路徑顯 2×2 sage 品牌徽記；標題字重 600＋收緊。
- [x] **個案清單兩層列**（§3.3.8）：代碼 eyebrow＋姓名（左）／概況＋mono 日期（右）＋SVG chevron＋hover sage 邊框；評估表進度「讀值」＋每側卡 L/R mono 短碼。
- [x] **驗收**：`pnpm test`（910 綠）、`typecheck`、`lint` 全綠；Nuxt UI `primary='sage'` 經 `@theme`＋`--ui-color-primary-*` 雙綁定。**仍待（待實機目視）**：無頭瀏覽器於本機 WSL2 缺系統庫，未能截圖驗證；待實機／CI Playwright 視覺確認。

## 設計系統（§3.7）

- [ ] UI 原語包裝（Nuxt UI；03 §3.7.4）—— 基礎元件由 Nuxt UI 直接提供；app 專屬包裝已落地於 `app/components/base/`：Button／IconButton／Input／Checkbox／Accordion／AlertDialog／Select／Dialog／Switch／Callout／SegmentedControl／StatusChip／Skeleton／PageSkeleton／PageError／ErrorBoundary。**demand-first 暫緩**：Radio／Slider／Tabs／Popover／Tooltip／Toast／Menu／Card／Badge 等可直接用 Nuxt UI（`URadioGroup`／`USlider`／`UTabs`／`UPopover`／`UTooltip`／`useToast` …），俟實際 consumer 再視需要加專屬包裝。**匯出備份 toast 已落地**：`settings.vue` 以 `useToast` 匯出成功後顯 success toast（`toastExportDone`「備份已匯出」）。
- [ ] 系統級無障礙驗收：WCAG AA 對比、`:focus-visible` 環、`prefers-reduced-motion`、`forced-colors` 退化、點按 ≥44px、icon-only 配 VisuallyHidden（03 §3.7.5）—— 大部分已落地；**焦點環強化已落地**：`SegmentedControl`／`Accordion`（父層 `overflow:hidden` 或 Reka UI 覆寫）改以 inset `box-shadow` 呈現 `:focus-visible`，`SfmaQuadrant` 格子同套用；**仍待**：`forced-colors` 退化（非單元可測、待實機驗收）
