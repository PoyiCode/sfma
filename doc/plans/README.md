# Plans — 實作計畫索引

> 語言：zh-tw。本目錄存放各階段的實作計畫（spec／impl plan）。

## 歷史微計畫（ptApp，React）— 行為規格參照

`2026-06-1[2-7]-*` 系列為 **ptApp（React）** 開發期的歷史微計畫，記錄各功能的設計決策與行為。本專案由 ptApp 移植到 Nuxt 4 時，**這些微計畫作為「行為規格參照」**（要做成什麼樣），**非 Nuxt 實作依據**（怎麼用 Nuxt 做）。

- 原始檔留於來源庫 `ptApp/doc/plans/`（React 微計畫，約 90+ 篇）。
- 框架相關內容（React hooks／JSX／Radix／`vite-plugin-pwa`／`react-router`）已過時，**勿照搬實作**；其領域語意（SFMA 計分、breakout 決策樹、解剖、資料模型、互動行為）仍有效，作為對等基線參照。

## Nuxt 移植計畫（本專案，`2026-06-18-*`）

Nuxt 各 Phase 另出新 plan：

| 檔案 | 角色 |
| --- | --- |
| [`2026-06-18-nuxt-migration-master-plan.md`](2026-06-18-nuxt-migration-master-plan.md) | 移植總規格：策略、框架對應、重用/重寫清單、Phase 0–7 路線圖、決策與風險 |
| [`2026-06-18-phase-0-foundation.md`](2026-06-18-phase-0-foundation.md) | Phase 0 地基設計規格 |
| [`2026-06-18-phase-0-foundation-impl-plan.md`](2026-06-18-phase-0-foundation-impl-plan.md) | Phase 0 實作計畫 |

> 後續 Phase（1–7）各自走 brainstorm（如需）→ spec → writing-plans → 實作的循環，新增對應 `2026-06-18-*`（或當日日期）plan。
