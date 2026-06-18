import { defineConfig, devices } from '@playwright/test';

// Playwright E2E 設定（07 §7.7、todo 08 E2E 段）：以正式建置產物（build→preview）為受測目標，
// 近似實際部署行為（SPA、PWA、IndexedDB）。webServer 由 Playwright 啟動 preview server 並等就緒。
// 三引擎 projects（chromium／webkit／firefox）；CI 預設僅 chromium（其餘需 --with-deps 系統相依，
// 視環境啟用——見 .github/workflows/ci.yml 與回報「瀏覽器安裝環境受阻」說明）。
const PORT = Number(process.env.E2E_PORT ?? 4173);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // 單機 local-first app：避免測試間 IndexedDB 互擾，序列執行。
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  // 正式建置產物預覽（nuxt build → nuxt preview）；reuse 既有 server（本機重跑加速）。
  // 預設 build+preview（CI／首次）；本機已 build 過可設 E2E_SKIP_BUILD=1 僅 preview 加速。
  // build 在低階機可能逾 4 分鐘，故 timeout 放寬至 8 分鐘。
  webServer: {
    command: process.env.E2E_SKIP_BUILD
      ? `pnpm preview --port ${PORT}`
      : `pnpm build && pnpm preview --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 480_000,
  },
});
