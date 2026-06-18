// Service Worker 執行期快取範圍（單一真相）：全離線 3D——opt-in 載入後 cache-on-use。
// 由 nuxt.config.ts 消費為 @vite-pwa/nuxt workbox runtimeCaching；變更須同步 runtimeCaching.test.ts。
//
// 與 precache（precacheGlobs.ts）分工：precache＝安裝期殼層（index/css/html/圖示/字型）；
// runtime＝使用者**開過 3D 後**才下載之大型資產（glb／draco／Babylon chunk）於使用時入快取，
// 之後可離線重看。runtime **無 precache 之 2 MiB 上限**，故 5.4 MB Babylon chunk 可快取；
// 仍 opt-in（只快取已主動載入者）、不肨 install。改變「opt-in 不離線」→「opt-in，載入後可離線」。
//
// 皆 CacheFirst：glb 版本命名（anatomyV1→V2）／JS 內容雜湊 → 改版即新 URL、自動取新；
// draco 固定名、隨 Babylon 版極少更新。expiration 限快取膨脹；cacheableResponse 僅收 200/0（opaque）。
//
// 隱私（08 §8.7）：規則僅比對 *.glb／/draco/／assets/*.js 靜態資產，**不**比對 json／db／個資路徑——
// SW（precache 與 runtime 皆然）不快取個資；個案資料僅存 IndexedDB、不經網路。
//
// 型別刻意輕量（不引 workbox 型別至 App 原始碼）：nuxt.config 消費時結構即合 workbox RuntimeCaching。
export interface RuntimeCacheRule {
  urlPattern: RegExp;
  handler: 'CacheFirst';
  options: {
    cacheName: string;
    expiration: { maxEntries: number; maxAgeSeconds: number };
    cacheableResponse: { statuses: number[] };
  };
}

const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

export const RUNTIME_CACHING: readonly RuntimeCacheRule[] = [
  {
    // 3D 模型 GLB（§4.3.1）：opt-in 切 3D 才下載（~3 MB）；載入後快取供離線重看。
    urlPattern: /\/models\/.+\.glb$/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'ptapp-model-3d',
      expiration: { maxEntries: 4, maxAgeSeconds: THIRTY_DAYS_SECONDS },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  {
    // Draco 解碼器（自帶 /draco/ 之 wasm/js）：3D glTF Draco 解壓所需。
    urlPattern: /\/draco\/.+/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'ptapp-draco',
      expiration: { maxEntries: 8, maxAgeSeconds: THIRTY_DAYS_SECONDS },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  {
    // 非殼層 lazy JS chunk（assets/*.js，現＝3D/Babylon 視口 ~5.4 MB）：內容雜湊不可變。
    // 與 precache 之 index-*.js 重疊無害——workbox 先註冊 precache 路由、殼層自 precache 服務，
    // runtime 規則實際只處理未 precache 之 chunk（離線可載 Babylon 視口）。
    urlPattern: /\/assets\/.+\.js$/i,
    handler: 'CacheFirst',
    options: {
      cacheName: 'ptapp-js-chunks',
      expiration: { maxEntries: 60, maxAgeSeconds: THIRTY_DAYS_SECONDS },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
] as const;
