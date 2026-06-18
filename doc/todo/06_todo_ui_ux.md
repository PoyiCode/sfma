# 06 — Todo：介面、畫面與響應式

> 階段：開發期｜來源設計：[03_ui_ux.md](../design/03_ui_ux.md)｜前置：[01](01_todo_setup.md)；整合各功能模組（[02](02_todo_data.md)、[04](04_todo_human_model.md)、[05](05_todo_assessment.md)）

## 畫面

- [ ] 人體模型檢視畫面：控制項清單依 03 §3.5（分層、單一部位還原、標籤、LOD、視角），與 [04](04_todo_human_model.md) 整合。**仍待**：精準貼近部位定位（待真實資產執行期螢幕座標）；直式各斷點欄佈局；3D 執行期 FPS 動態降級（已接線、待實機）

## 導覽與 App Shell（§3.3）

- [ ] Service Worker 導覽後備（離線回殼層）＋主機 SPA rewrite（03 §3.3.4–3.3.5）—— SW 離線回殼層已 done；主機 SPA rewrite 屬部署目標（人為決策，見[發布前檢核表](../release_checklist.md) §4）

## 設計系統（§3.7）

- [ ] UI 原語包裝（Nuxt UI；03 §3.7.4）—— 基礎元件由 Nuxt UI 直接提供；app 專屬包裝已落地於 `app/components/base/`：Button／IconButton／Input／Checkbox／Accordion／AlertDialog／Select／Dialog／Switch／Callout／SegmentedControl／StatusChip／Skeleton／PageSkeleton／PageError／ErrorBoundary。**demand-first 暫緩**：Radio／Slider／Tabs／Popover／Tooltip／Toast／Menu／Card／Badge 等可直接用 Nuxt UI（`URadioGroup`／`USlider`／`UTabs`／`UPopover`／`UTooltip`／`useToast` …），俟實際 consumer 再視需要加專屬包裝
- [ ] 系統級無障礙驗收：WCAG AA 對比、`:focus-visible` 環、`prefers-reduced-motion`、`forced-colors` 退化、點按 ≥44px、icon-only 配 VisuallyHidden（03 §3.7.5）—— 大部分已落地；**仍待**：`forced-colors` 退化（非單元可測、待實機驗收）
