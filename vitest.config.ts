import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// 純函式測試為框架無關（node 安全：以 typeof navigator/document 守衛），全域環境維持 node。
// 元件/DOM 測試（@vue/test-utils、@testing-library/vue）以逐檔 docblock `// @vitest-environment jsdom`
// 切換環境（不改全域）；vue 外掛使 .vue SFC 於測試期可編譯。
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    setupFiles: ['app/test/setup.ts'],
    include: [
      'packages/**/*.test.ts',
      'app/**/*.test.ts',
      'config/**/*.test.ts',
      'infra/**/*.test.ts',
    ],
    // *.nuxt.test.ts 為 Nuxt-context 整合測試，僅由 vitest.nuxt.config.ts（environment: 'nuxt'）執行，
    // 須自主套件（node 環境）排除，否則 node 環境跑不起 Nuxt runtime 而失敗。
    exclude: ['**/node_modules/**', '**/.nuxt/**', '**/.output/**', '**/*.nuxt.test.ts'],
  },
});
