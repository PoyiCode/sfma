import { defineVitestConfig } from '@nuxt/test-utils/config';

// Nuxt-context 整合測試獨立設定（07 §7.7、08 E2E 段）：主 `vitest.config.ts` 為 node 全域環境、
// 涵蓋純函式／資料層／逐檔 docblock 切 jsdom 之元件測；此設定另立 `environment: 'nuxt'`，
// 經 @nuxt/test-utils 啟真實 Nuxt runtime（自動 import、router、i18n、頁面元件解析），
// 專供跨頁整合測試（renderSuspended／mountSuspended 驅動真實頁面元件 + 真實 localStore + fake-indexeddb）。
// 與主 `test` 分立執行（`pnpm test:nuxt`）：Nuxt runtime 啟動成本高、隔離避免拖慢／互擾主套件。
export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    // 專案已備 jsdom（主套件即以 jsdom docblock 測元件）；不引入 happy-dom（Nuxt 環境預設）以免多裝相依。
    environmentOptions: {
      nuxt: {
        domEnvironment: 'jsdom',
      },
    },
    // fake-indexeddb 全域 indexedDB + jsdom matchMedia stub（@vite-pwa client plugin 初始化所需）。
    setupFiles: ['app/test/setupNuxt.ts'],
    include: ['app/**/*.nuxt.test.ts'],
    exclude: ['**/node_modules/**', '**/.nuxt/**', '**/.output/**'],
    // Nuxt runtime 啟動 + DOM 整合測試較慢，放寬單測逾時。
    testTimeout: 30000,
    hookTimeout: 30000,
    // Nuxt 環境啟動成本高且本機（WSL2）下 fork 並行易互擾 → 單一 fork、不並行，求穩定。
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
  },
});
