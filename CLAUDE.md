# CLAUDE.md

本檔提供 Claude Code 在此 repo 工作時的指引。此專案由 React（ptApp）移植到 Nuxt 4（Vue 3），渲染 SPA（`ssr: false`）。React 行為規格參考來源：`/mnt/e/programming/projects/ptApp/apps/web`。

## 技術棧

- 套件管理器：**pnpm**（`packageManager: pnpm@11.3.0`，Node ≥ 20）。一律用 `pnpm`，勿用 npm/yarn。
- Nuxt 4（`app/` srcDir）+ Vue 3，SPA（`ssr: false`）；UI：Nuxt UI v4；狀態：Pinia；i18n：`@nuxtjs/i18n`（預設 `zh-TW`，`no_prefix`）；PWA：`@vite-pwa/nuxt`；3D：Babylon.js。
- Monorepo workspace：`packages/shared`（@ptapp/shared）、`packages/definitions`（@ptapp/definitions）為直接沿用的純邏輯/資料層，**勿重寫**。

## 常用指令

- `pnpm dev` — 開發伺服器；`pnpm build` / `pnpm generate` — 建置。
- `pnpm test` — 單元測試（Vitest node 環境，**排除** `*.nuxt.test.ts`）。
- `pnpm test:nuxt` — Nuxt 環境整合測試（獨立 config `vitest.nuxt.config.ts`，須與單元測試分開跑）。
- `pnpm test:e2e` — Playwright E2E。
- `pnpm typecheck` — 含 workspace 套件（`nuxt typecheck` + `packages/shared`、`packages/definitions`）。
- `pnpm lint`（eslint）、`pnpm format`（prettier）；提交前 husky + lint-staged 自動修正。

## 測試與注意事項

- 元件測試以檔案開頭 docblock `// @vitest-environment jsdom` 切換環境（非全域設定）；node 環境無 IndexedDB，以 `fake-indexeddb` 注入；Babylon 測試用 NullEngine。
- Playwright 須序列執行（`workers: 1`）以隔離 IndexedDB。
- `VITE_DEV_MODE='true'` 時 dev server 綁 `0.0.0.0`（裝置測試）並啟用 dead-code elimination（設於 `nuxt.config.ts` vite define，非 `.env`）。
- PWA：dev 不啟用 Service Worker；3D Babylon/Draco 資產（>2 MiB）走 runtime caching，不進 precache。
- IndexedDB 為目前資料來源（尚無後端 API）；匯出/匯入 JSON 對齊未來 API DTO。

## 文件與路徑

- document path: `./doc`
  - 設計文件：`./doc/design`（索引：[doc/design/README.md](doc/design/README.md)）
  - 待辦清單：`./doc/todo`（索引：[doc/todo/README.md](doc/todo/README.md)）
- doc language: `zh-tw`
- 3D模型原始資產: `./doc/ref/models/`

## 開發規則

- **設計同步（必守）**：開發中途若變更設計，**必須同步更新** `./doc/design` 對應設計文件與 `./doc/todo` 對應 todo 檔，再進行實作 — 設計文件、todo、程式碼三者不得脫節。
- 命名、專案結構、測試等開發規範依 [doc/design/07_dev_conventions.md](doc/design/07_dev_conventions.md)：camelCase（變數／函式）、PascalCase（類別／型別／元件）、全大寫（常數／環境變數），**嚴禁 snake_case**（eslint 強制）。
- todo 完成即勾選對應項目（`- [x]`），保持 todo 與實際進度一致。
