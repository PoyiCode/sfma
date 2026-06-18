import { resolveDevServerHost } from './config/devServerHost';
// PWA 白名單單一真相（純 TS、無 Nuxt 依賴，於此靜態消費；08 §8.7）。
import { PRECACHE_GLOB_PATTERNS, PRECACHE_MAX_FILE_BYTES } from './app/utils/pwa/precacheGlobs';
import { RUNTIME_CACHING } from './app/utils/pwa/runtimeCaching';

// 開發者模式建置旗標（02 §2.11、08 §8.9）：dev build 預設開、正式 build 預設關，可由 VITE_DEV_MODE 覆寫。
// 經 vite.define 靜態替換 import.meta.env.VITE_DEV_MODE → 正式建置 dead-code 剔除（actionLogger no-op、哨兵剔除）。
// Nuxt 僅自動載入 .env（不載 .env.<mode>），故以 NODE_ENV 推導預設，避免依賴 mode-based env 檔。
const VITE_DEV_MODE =
  process.env.VITE_DEV_MODE ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true');

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false, // SPA：local-first（IndexedDB/Babylon 僅 client），無 SSR 水合問題（master plan F）
  devtools: { enabled: false },
  modules: ['@nuxt/ui', '@nuxt/eslint', '@pinia/nuxt', '@nuxtjs/i18n', '@vite-pwa/nuxt'],
  css: ['~/assets/css/main.css'],
  devServer: {
    // 開發者模式綁 0.0.0.0（區網可及，供實機測試）；否則 localhost（02 §2.11、08 §8.9）
    host: resolveDevServerHost(VITE_DEV_MODE),
    // port: 5173,
  },
  vite: {
    define: {
      'import.meta.env.VITE_DEV_MODE': JSON.stringify(VITE_DEV_MODE),
    },
    optimizeDeps: {
      include: [
        '@babylonjs/core',
        '@babylonjs/core/Rendering/outlineRenderer',
        '@babylonjs/gui',
        '@babylonjs/loaders',
        '@babylonjs/loaders/glTF',
      ]
    }
  },
  i18n: {
    defaultLocale: 'zh-TW',
    strategy: 'no_prefix', // 單機 app 不以網址前綴分語系
    locales: [{ code: 'zh-TW', language: 'zh-TW', file: 'zh-TW.json' }],
  },
  pwa: {
    registerType: 'autoUpdate',
    devOptions: { enabled: false }, // 開發模式停用 SW（取消離線載入）；正式建置不受影響
    // 3D Babylon megachunk（>2 MiB）刻意排除 precache（改由 runtimeCaching CacheFirst 服務）：
    // 以此降級「超 precache 上限」為警告而非建置失敗（否則 vite-plugin-pwa 預設拋錯中止 build）。
    showMaximumFileSizeToCacheInBytesWarning: true,
    manifest: {
      name: '物理治療評估',
      short_name: 'sfma',
      lang: 'zh-TW',
      display: 'standalone',
      start_url: '/',
      theme_color: '#0e7490',
      background_color: '#F8FAFC',
      icons: [
        { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    // Service Worker 快取白名單（08 §8.7）：precache＝App 殼層與靜態資產；runtimeCaching＝全離線 3D
    // （glb／draco／Babylon chunk 之 CacheFirst，opt-in 載入後 cache-on-use）。個案資料僅存 IndexedDB、
    // 不得快取——白名單僅含殼層與靜態資產。navigateFallback '/' 供 SPA 殼層導覽回退。
    // @vite-pwa/nuxt 之 workbox 設定鍵與 vite-plugin-pwa 相同。
    workbox: {
      globPatterns: [...PRECACHE_GLOB_PATTERNS],
      // 排除唯一的 3D Babylon megachunk（>2 MiB；改由 runtimeCaching CacheFirst 服務），守 precache 上限。
      maximumFileSizeToCacheInBytes: PRECACHE_MAX_FILE_BYTES,
      navigateFallback: '/',
      runtimeCaching: RUNTIME_CACHING.map((rule) => ({
        urlPattern: rule.urlPattern,
        handler: rule.handler,
        options: {
          cacheName: rule.options.cacheName,
          expiration: { ...rule.options.expiration },
          cacheableResponse: { statuses: [...rule.options.cacheableResponse.statuses] },
        },
      })),
    },
  },
});
