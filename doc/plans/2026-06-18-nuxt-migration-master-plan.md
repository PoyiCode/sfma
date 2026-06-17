# 移植總規格 — ptApp（React）→ sfma（Nuxt 4）

> 日期：2026-06-18　語言：zh-tw
> 角色：本文件為**移植總規格（master plan）**——策略、框架對應、重用/重寫清單、階段路線圖、決策與風險。
> 各 Phase 的實作計畫另立（Phase 0 細規格見 [`2026-06-18-phase-0-foundation.md`](2026-06-18-phase-0-foundation.md)）。

## 背景與現況

- **來源** `ptApp/apps/web`：React 19 + Vite 8 + TS 6 的 pnpm monorepo，約 28k LOC。
- **目標** `sfma`：Nuxt 4.4 + Vue 3.5 全新 scaffold。
- 已搬入 sfma：整個 `doc/`（design＋90+ plans＋todo＋ref＋release_checklist）、`packages/shared`＋`packages/definitions`（原始檔複製）、`public/`（models/draco/icons）、`infra/`。
- 尚未做：實際 app 程式碼（`app/` 僅預設 scaffold）；**設計文件 02/03/07 仍寫 React/Vite/Radix，未改 Nuxt**；git 尚無 commit。

**核心判斷**：這不是機械式 port，而是**以 ptApp 為行為規格、用 Vue/Nuxt 重寫 UI 層**。真正可重用的核心很小（純邏輯＋資料＋3D 場景邏輯＋公開資產），其餘 React UI 需重寫。

## A. 移植執行策略

**參照式乾淨重寫（reference-driven clean rewrite），地基優先、分階段、純核心重用。**
以 `ptApp/apps/web` 為「行為規格來源」，在 sfma 逐模組以 Vue 重寫；框架無關的純邏輯／資料／3D 場景邏輯直接搬。

替代方案與否決理由：
- 機械式逐檔轉譯（React→Vue 自動轉換）：hooks/JSX/Radix 與 Vue 心智模型差異過大，產出髒、不可維護 → 否決。
- strangler 並行雙跑：目標為全新專案、無與舊版共存需求 → 多餘。

## B. 框架對應表（React → Nuxt 4 / Vue 3）

| 面向 | ptApp（React） | sfma（Nuxt 4） |
| --- | --- | --- |
| 框架/建置 | React 19 + Vite 8 | Nuxt 4.4 + Vite（內建），**SPA `ssr:false`** |
| 路由 | react-router 7（`router.tsx`） | Nuxt 檔案式路由 `app/pages/` |
| 元件 | `.tsx` + JSX | `.vue` SFC（`<script setup lang="ts">`） |
| 狀態 | hooks + context | **Pinia**（跨頁：patient／評估 session／breakout／settings）＋ composables（區域） |
| 邏輯重用 | 自訂 hooks（`useBreakpoint`／`useOrientation`／`useFileDrop`／`useUnsavedChangesGuard`／`useHistoryDismiss`／`useInstallPrompt`…） | Vue composables `app/composables/`（`useXxx`） |
| UI 原語 | Radix React（Accordion/Dialog/AlertDialog/Checkbox/RadioGroup/Switch/Select）＋自訂 CSS token | **Nuxt UI**（UAccordion/UModal/UCheckbox/URadioGroup/USwitch/USelect…）＋ Tailwind theme |
| 3D | Babylon.js（引擎框架無關） | **Babylon 場景邏輯照搬**，React wrapper → Vue `<ClientOnly>` 元件 + composable |
| 資料層 | `data/`（idb localStore/exporter/importer/migrations/repository） | **近 1:1 照搬**，以 Nuxt plugin/composable 注入 |
| PWA | `vite-plugin-pwa`（precacheGlobs/runtimeCaching/devSW） | **`@vite-pwa/nuxt`**（沿用 precache/runtime caching 白名單與 dev 停用 SW 邏輯） |
| i18n | 自訂（`documentLang`/`initLocale`/`useLocale`/`localeSubscribe`） | **`@nuxtjs/i18n`**（zh-TW 預設） |
| devtools | `actionLogger`/`redactPii`（建置旗標剔除） | Nuxt plugin，`DEV_MODE` 建置旗標 dead-code 剔除 |
| dev server host 閘 | `VITE_DEV_MODE`→`0.0.0.0`/`localhost` | nuxt.config `devServer.host` 由 `DEV_MODE` env 閘控 |
| Lint | ESLint flat + `naming-convention` + react plugins | **同套 naming-convention**，react plugins → `eslint-plugin-vue` + `vue-eslint-parser`，整合 `@nuxt/eslint` |
| 測試 | Vitest + Testing Library React | Vitest + `@vue/test-utils`（+ `@nuxt/test-utils`）；Playwright、Babylon NullEngine 不變 |

## C. 重用 vs 重寫 清單

| 類別 | 內容 | 處置 | 量 |
| --- | --- | --- | --- |
| **直接重用** | `packages/shared`、`packages/definitions`（SFMA 定義、breakout flows、anatomy、derive、schemas、ids、export、time、settings、patient、assessment 型別…）＋ `public/`（models/draco/icons） | 已複製進 sfma；接好 workspace＋確認建置/測試綠 | ~600 LOC + JSON/資產 |
| **薄重寫（框架無關核心＋薄注入）** | `data/`（db/localStore/exporter/importer/migrations/repository/initStorage）、`devtools/`、`config/`、`pwa/` 白名單、i18n 字串 | 邏輯照搬，換注入方式（plugin/composable/nuxt.config） | ~1,900 LOC |
| **重寫（React→Vue）** | `modules/`（assessment＋breakoutFlow／humanModel／patient／settings）、`ui/` 原語（16 個）、`app/` shell＋routing＋hooks | 以原碼為行為規格逐一 Vue 重寫 | ~21,500 LOC |

## D. 階段路線圖（依賴序，非時程）

```
Phase 0 地基 ──┬─→ Phase 1 資料層+devtools ──┬─→ Phase 4 評估(assessment+breakout) ─┐
               │                              │                                    ├─→ Phase 6 介面整合+PWA+i18n ─→ Phase 7 測試/資安發布檢核
               ├─→ Phase 2 設計系統+UI原語 ───┤                                    │
               └─→ Phase 3 定義/圖資接線 ─────┴─→ Phase 5 人體模型(Babylon) ───────┘
```

| Phase | 範圍 | 主要來源 |
| --- | --- | --- |
| **0 地基** | workspace(pnpm)＋nuxt.config(SPA)＋Nuxt UI/PWA/i18n/Pinia 模組＋tooling(ESLint/Prettier/husky/CI)＋packages 接線建置綠＋app shell 骨架＋devtools 旗標＋**設計文件改寫**＋todo 校準 | 02、07、本文件 |
| **1 資料層+devtools** | IndexedDB localStore/exporter/importer/migrations/repository/initStorage＋actionLogger 接線 | 06、02 §2.6/2.11 |
| **2 設計系統+UI原語** | 設計 token → Nuxt UI theme；16 個 ui 原語移植 | 03 |
| **3 定義/圖資接線** | definitions/anatomy 資料接線、2D 圖資 | 04 §4.6、03 |
| **4 patient+assessment** | 個案管理＋SFMA 評估（含 breakout 決策樹引擎與 UI） | 05、06 |
| **5 人體模型** | Babylon 場景、LOD、分層、互動 | 04 |
| **6 介面整合+PWA+i18n** | app shell 整合、routing、settings、PWA 上線（caching 規則）、i18n、安裝引導 | 03、02 §2.9 |
| **7 測試+資安** | 測試補齊（Vitest+@vue/test-utils、Playwright、Babylon NullEngine）＋資安/隱私發布檢核 | 07 §7.7、08、release_checklist |

> 每個 Phase 各自走 brainstorm（如需）→ spec → writing-plans → 實作的循環。

## E. 設計文件改寫工作流（「設計同步必守」）

於 Phase 0 內完成——把 React 專屬內容改寫為 Nuxt：

| 文件 | 動作 |
| --- | --- |
| `02_architecture` | 框架選型 React→**Nuxt 4/Vue**、模組圖、資料流、PWA(SW)、DEV_MODE 旗標、dev host 改寫 |
| `03_ui_ux` | 設計系統段：CSS custom-property token 系統 → **Nuxt UI theme + Tailwind** 對應策略 |
| `07_dev_conventions` | 專案結構（Nuxt `app/` 慣例）、測試工具（Testing Library React→@vue/test-utils）、lint plugins、naming-convention 留存 |
| `04`／`05`／`06`／`08` | 領域文件（人體模型解剖、SFMA 評估、資料模型、資安）**框架無關，大致不動**，僅修個別 React 措辭 |
| `doc/plans/*`（ptApp 90+ 既有） | **不帶入 sfma**：歷史 React 微計畫留於來源庫 `ptApp/doc/plans/`，sfma `doc/plans/README.md` 指向該處作為**行為規格參照**；Nuxt 各 Phase 另出新 plan（`2026-06-18-*`） |
| `doc/todo/*` | 依本路線圖校準；`01_todo_setup.md` 改為 Nuxt 地基 |
| sfma `CLAUDE.md`／`README.md` | 同步更新 |

## F. 決策與待決事項

### 已拍板
1. **套件管理器：pnpm workspace**（與來源一致、monorepo 體驗佳）。sfma 現有 npm `package-lock.json` 移除。
2. **UI 元件庫：Nuxt UI**（底層 Reka UI + Tailwind）。
3. **渲染模式：SPA `ssr: false`**（貼近原 Vite SPA、local-first，無 SSR 水合問題）。
4. **i18n：`@nuxtjs/i18n` 模組**（zh-TW 預設）。
5. **狀態：Pinia + composables**。
6. **忠實度：對等為主、順手修小問題**——各 Phase plan 須將「對等基線」與「順手修正」分離標注，避免範圍蔓延。

### 風險
- **設計 token → Nuxt UI**：選 Nuxt UI 後，現有 kebab-case CSS custom properties 設計系統與 Nuxt UI 的 Tailwind theming 並非 1:1；需橋接策略（於 03 改寫處理、Phase 2 落實）。**此為與原設計最大的刻意偏離。**
- **Babylon × SPA × PWA**：3D 僅 client，需 `<ClientOnly>`／`import.meta.client` 包裹；離線 3D 的 runtime caching 規則照搬（Phase 6）。
- **啟動相依序**：theme/locale/persistentStorage 啟動套用依賴資料層（Phase 1）；Phase 0 先建 plugin 骨架（安全 no-op／try-catch），Phase 1 接線。
- **packages 命名**：維持 `@ptapp/*` 以減少 import 改動；是否改 scope 日後另議（低風險）。
