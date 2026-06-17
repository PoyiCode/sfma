# Phase 0 — Nuxt 地基（細規格）

> 日期：2026-06-18　語言：zh-tw
> 上層：[`2026-06-18-nuxt-migration-master-plan.md`](2026-06-18-nuxt-migration-master-plan.md)
> 角色：本文件為 **Phase 0 設計規格**，將交付 writing-plans 產出實作計畫。

## 目標

sfma 從空 scaffold 變成：**可編譯、可 lint、可測、能啟動空殼、設計文件已同步、命名規範已強制**的地基。

**界線（重要）**：Phase 0 **不含任何真實模組 UI／資料層實作／3D／ui 原語**。所有頁面為 placeholder（一行佔位字樣），僅證明「路由走得通＋Nuxt UI 會渲染＋build/dev 跑得起來」。真實畫面與資料於 Phase 1+ 填入，不再回頭動地基。

## 工作分項

### 0-A 套件管理與 workspace
- npm → **pnpm**：移除 `package-lock.json`，新增 `pnpm-workspace.yaml`（`packages/*`；Nuxt app 位於根 `app/`，不列 `apps/*`）。
- 新增根 `tsconfig.base.json`（照搬 ptApp；sfma 現缺此檔，而 `packages/*/tsconfig.json` 已 `extends ../../tsconfig.base.json`）。
- packages 名稱維持 `@ptapp/shared`、`@ptapp/definitions`。
- 驗收：`pnpm install` 綠、`pnpm -r test`（packages 既有測試）綠。

### 0-B Nuxt 設定（`nuxt.config.ts`）
- `ssr: false`（SPA）。
- modules：`@nuxt/ui`、`@vite-pwa/nuxt`、`@nuxtjs/i18n`、`@pinia/nuxt`、`@nuxt/eslint`。
- `devServer.host` 由 `DEV_MODE` env 閘控（`0.0.0.0`／`localhost`，對應原 `config/devServerHost`）。
- `runtimeConfig.public.devMode` ＋建置旗標（dead-code 剔除 devtools／未來免認證路徑）。

### 0-C Tooling
- ESLint flat config：**保留 `naming-convention`**（camelCase／PascalCase／UPPER_CASE、禁 snake_case）；react plugins → `eslint-plugin-vue` + `vue-eslint-parser`；整合 `@nuxt/eslint`。
- Prettier、husky、lint-staged（照搬，副檔名加 `.vue`）。
- CI：照搬 `.github/workflows/ci.yml`（lint → typecheck → test），改 pnpm。
- 驗收：`pnpm lint`、`pnpm typecheck`（`nuxt typecheck` + packages）綠。

### 0-D 設計文件同步
- 改寫 `02_architecture`（框架 React→Nuxt/Vue、模組圖、資料流、PWA、DEV_MODE、dev host）。
- 改寫 `03_ui_ux` 設計系統段（CSS token → Nuxt UI theme 對應策略）。
- 改寫 `07_dev_conventions`（Nuxt `app/` 結構、測試工具 @vue/test-utils、lint plugins；naming-convention 留存）。
- `04/05/06/08` 僅修 React 措辭。`doc/plans/*`（既有 90+）加歷史參照標注。`doc/todo/*` 依路線圖校準、`01_todo_setup.md` 改 Nuxt 地基。
- 同步更新 sfma `CLAUDE.md`／`README.md`。

### 0-E App shell 骨架
- `app/app.vue`：移除 `NuxtWelcome` → `<UApp>` + `NuxtLayout` + `NuxtPage`。
- `app/layouts/default.vue`：AppBar 殼（內容 placeholder）。
- `app/pages/` 依原路由表（`router.tsx`）建 **placeholder 頁**：
  - `index.vue`（病患清單）
  - `patients/new.vue`
  - `patients/[patientId].vue`（巢狀父頁，含 `<NuxtPage>`）
    - `patients/[patientId]/index.vue`（redirect → assessments）
    - `patients/[patientId]/assessments/index.vue`
    - `patients/[patientId]/assessments/new.vue`
    - `patients/[patientId]/assessments/[sessionId].vue`
    - `patients/[patientId]/model.vue`
  - `patients/[patientId]/edit.vue`
  - `settings.vue`
  - `[...notFound].vue`（404）
- 每頁內容為一行佔位字樣 + `useHead` 標題；**不含表單、清單、3D、資料讀寫**。
- 驗收：路由切換、回上一頁、404 正常；Nuxt UI 元件（如 `UCard`）可渲染。

### 0-F devtools ＋ 啟動 plugins
- 照搬 `devtools/actionLogger`＋`redactPii`；Nuxt plugin 包裝，建置旗標 dead-code 剔除（正式版 no-op）。
- 啟動 plugins（`.client.ts`，對應原 `main.tsx`）：
  - navigation routeChange 埋點（Vue Router `afterEach`）。
  - theme init、locale init、`requestPersistentStorage`、PWA register（prod only）。
  - **注意**：theme/locale/persistentStorage 依賴資料層（Phase 1）。Phase 0 僅建 plugin 骨架＋安全 no-op／try-catch，Phase 1 接線。

### 0-G i18n bootstrap
- `@nuxtjs/i18n`：`defaultLocale: 'zh-TW'`、locale 檔骨架（先搬必要殼層字串，模組字串隨各 Phase 補）、document lang 設定。

### 0-H PWA bootstrap
- `@vite-pwa/nuxt`：manifest（照搬 ptApp：name/short_name/lang/theme/icons）、**dev `devOptions.enabled:false`**、`registerType:'autoUpdate'`。
- precache／runtimeCaching 白名單**延後到 Phase 6**；Phase 0 僅最小 manifest + 模組裝好。

### 0-I Pinia
- `@pinia/nuxt` 裝好、空 store 骨架（store 內容隨模組長出）。

## 驗收門檻（可驗證）

```
pnpm install            # 綠
pnpm -r test            # packages 既有測試綠
pnpm lint               # 綠（naming-convention 生效）
pnpm typecheck          # 綠
pnpm dev                # SPA 殼啟動、路由 placeholder 可走、Nuxt UI 元件可渲染
pnpm build              # 成功（SPA 輸出）
```
另：設計文件 02/03/07 已無 React 殘留；`doc/todo` 已對齊路線圖。

## 明確排除（留待後續 Phase）

資料層實作（Phase 1）、ui 原語移植（Phase 2）、definitions 接線渲染（Phase 3）、patient/assessment/breakout（Phase 4）、Babylon 3D（Phase 5）、PWA caching 規則與真實畫面（Phase 6）、測試補齊與資安發布檢核（Phase 7）。

## 交接 → Phase 1

Phase 0 完成後，Phase 1 在既有 plugin 骨架上接線資料層（localStore/exporter/importer/migrations/repository/initStorage）與 actionLogger，並把 theme/locale/persistentStorage 啟動套用接到真實 settings。
