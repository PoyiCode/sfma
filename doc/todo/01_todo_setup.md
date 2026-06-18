# 01 — Todo：專案建置與開發規範（Nuxt 地基）

> 階段：開發期（Phase 0 地基，**已完成**）｜來源設計：[02_architecture.md](../design/02_architecture.md)、[07_dev_conventions.md](../design/07_dev_conventions.md)｜前置：無（第一步）
>
> Phase 0 地基已落地；本檔僅餘 `app.config.ts` token→theme 橋接、實機驗證與託管決策待辦。

## 套件管理與 workspace

- [x] pnpm workspace（`pnpm-workspace.yaml`：`packages/*`；Nuxt app 於根 `app/`）；移除 npm `package-lock.json`
- [x] 根 `tsconfig.base.json`（`packages/*` `extends` 之）；`packages/shared`、`packages/definitions` 接入建置，`pnpm -r test` 綠

## Nuxt 設定（`nuxt.config.ts`）

- [x] `ssr: false`（SPA，local-first）
- [x] 模組：`@nuxt/ui`、`@vite-pwa/nuxt`、`@nuxtjs/i18n`、`@pinia/nuxt`、`@nuxt/eslint`
- [x] 開發者模式建置旗標 `VITE_DEV_MODE`（`process.env.VITE_DEV_MODE ?? NODE_ENV` 推導 + `vite.define` 靜態替換，dead-code 剔除；02 §2.11）
- [x] `devServer.host` 由 `VITE_DEV_MODE` 閘控（`0.0.0.0`／`localhost`，邏輯抽於 `config/devServerHost.ts`；02 §2.11、08 §8.9）

## UI／設計系統（Nuxt UI + Tailwind）

- [x] `app/assets/css/main.css`（`@import "tailwindcss"; @import "@nuxt/ui";`）＋ `@theme` 注入設計 token（03 §3.7）
- [ ] `app.config.ts`：Nuxt UI 語意色別名（primary／error 對應臨床 accent／danger）—— 尚未新增 `app.config.ts`（現以 `main.css` `@theme` ＋ Nuxt UI 預設運作）；完整 token→theme 橋接俟需要時補

## 狀態與 i18n／PWA／Pinia 模組接線

- [x] `@nuxtjs/i18n`：`defaultLocale: 'zh-TW'`、`strategy: 'no_prefix'`、`i18n/locales/zh-TW.json` 殼層字串
- [x] `@vite-pwa/nuxt`：最小 manifest、`registerType:'autoUpdate'`、dev `devOptions.enabled:false`（precache／runtimeCaching 白名單已於 Phase 6 落實；02 §2.9）
- [x] `@pinia/nuxt`：裝好、空 store 骨架（內容隨模組長出）

## App shell 骨架

- [x] `app/app.vue`（`<UApp>` + `NuxtLayout` + `NuxtPage`）、`app/layouts/default.vue`（AppBar 殼）
- [x] `app/pages/` 依路由表（03 §3.3.4）建頁（含巢狀 `[patientId]`、`[sessionId]`、`[...notFound]`），路由／回上一頁／404 走得通、Nuxt UI 可渲染

## devtools ＋ 啟動 plugins

- [x] `app/utils/devtools/`：`actionLogger`／`redactPii`，建置旗標 dead-code 剔除（正式版 no-op；02 §2.11、07 §7.6）
- [x] 啟動 plugins（`app/plugins/*.client.ts`，對應原 `main.tsx`）：導覽埋點（Vue Router `afterEach`）、`requestPersistentStorage`、PWA register（prod）

## Lint／格式／Hook

- [x] ESLint flat config（`eslint.config.mjs`，以 `@nuxt/eslint` 為底 + `eslint-plugin-vue`）；保留 `@typescript-eslint/naming-convention`（camelCase／PascalCase／UPPER_CASE、禁 snake_case，套用於 `.ts`）
- [x] Prettier、husky、lint-staged（副檔名含 `.vue`）
- [x] `pnpm lint`、`pnpm typecheck`（`nuxt typecheck` + packages）綠

## PWA 基礎

- [ ] 可安裝性驗證：iOS Safari／Android Chrome／桌面 Chromium（需實機）

## CI 與部署

- [x] CI pipeline：lint → typecheck → 單元／元件 → test:nuxt → build → verify:bundle，E2E 另立 job（`.github/workflows/ci.yml`，pnpm）—— **待 GitHub remote 實跑**
- [ ] 前端靜態託管（CDN、HTTPS）—— 暫緩：需供應商帳號決策，見 `infra/README.md`
- [ ] 3D 資產物件儲存桶 + CDN 基礎配置（02 §2.5；資產內容見 [03_todo_assets.md](03_todo_assets.md)）—— 暫緩：同上
