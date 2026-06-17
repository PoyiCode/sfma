# CLAUDE.md

## 優先任務: 移植Project

- 此專案由 React（ptApp）移植到 **Nuxt 4（Vue 3）**，渲染 SPA（`ssr: false`）；UI 採 Nuxt UI、狀態 Pinia、i18n `@nuxtjs/i18n`、PWA `@vite-pwa/nuxt`。
- source path（行為規格來源）: `E:\programming\projects\ptApp\apps\web`
- 移植總規格與 Phase 路線圖：[doc/plans/2026-06-18-nuxt-migration-master-plan.md](doc/plans/2026-06-18-nuxt-migration-master-plan.md)（計畫索引：[doc/plans/README.md](doc/plans/README.md)）

##

- document path: `./doc`
  - 設計文件：`./doc/design`（索引：[doc/design/README.md](doc/design/README.md)）
  - todo 清單：`./doc/todo`（索引：[doc/todo/README.md](doc/todo/README.md)）
- doc language: `zh-tw`
- 3D模型原始資產: `./doc/ref/models/`

## 開發規則

- **設計同步（必守）**：開發中途若變更設計，**必須同步更新** `./doc/design` 對應設計文件與 `./doc/todo` 對應 todo 檔，再進行實作 — 設計文件、todo、程式碼三者不得脫節。
- 命名、專案結構、測試等開發規範依 [doc/design/07_dev_conventions.md](doc/design/07_dev_conventions.md)：camelCase（變數／函式）、PascalCase（類別／型別／元件）、全大寫（常數／環境變數），**嚴禁 snake_case**。
- todo 完成即勾選對應項目（`- [x]`），保持 todo 與實際進度一致。
