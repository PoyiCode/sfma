// Service Worker 預快取範圍（單一真相）：只含 App 殼層與靜態資產。
// 個案資料僅存 IndexedDB、不經網路，SW 不得快取個資（08 §8.7、§8.4、02 §2.1）。
// 由 nuxt.config.ts 消費為 @vite-pwa/nuxt workbox globPatterns；變更白名單須同步 precacheGlobs.test.ts。
//
// 廣納 App 殼層之 js/css/html/圖示/字型/2D 圖資（Nuxt 4 chunk 名為純雜湊、無語意前綴，故不能以
// 名稱白名單篩進入點）。**3D 檢視器之 Babylon 巨型 chunk（>5 MB 單檔，超 workbox 2 MiB precache
// 上限會使 build 失敗）以 PRECACHE_MAX_FILE_BYTES（workbox maximumFileSizeToCacheInBytes）排除**——
// 該門檻僅大於唯一的 Babylon megachunk、小於其餘殼層 chunk，故進入點與一般 chunk 仍 precache、
// 3D megachunk 不 precache（§4.2、§4.3.5；使用者 2026-06-14 決策「排除 3D chunk 不 precache」）。
// **全離線 3D（2026-06-16）**：被排除之 3D chunk／glb／draco 改由 **runtime 快取**（cache-on-use、
// 見 runtimeCaching.ts）——使用者開過 3D 後可離線重看；precache 仍不含 3D megachunk（不肨 install／守 2 MiB）。
export const PRECACHE_GLOB_PATTERNS = [
  '**/*.{js,css,html,svg,png,woff2}',
] as const;

// precache 單檔上限（bytes）：3 MiB——大於其餘殼層 chunk、小於唯一的 3D Babylon megachunk（~6.9 MB），
// 故 megachunk 自動排除 precache（改由 runtime CacheFirst 服務），其餘殼層仍 precache。
export const PRECACHE_MAX_FILE_BYTES = 3 * 1024 * 1024;
