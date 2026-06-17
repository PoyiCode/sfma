import { defineConfig } from 'vitest/config';

// Phase 0 測試為框架無關純函式（node 安全：以 typeof navigator/document 守衛）。
// 元件/DOM 測試（@vue/test-utils、@nuxt/test-utils、jsdom）於 Phase 7 另設 project。
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['app/test/setup.ts'],
    include: [
      'packages/**/*.test.ts',
      'app/**/*.test.ts',
      'config/**/*.test.ts',
      'infra/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/.nuxt/**', '**/.output/**'],
  },
});
