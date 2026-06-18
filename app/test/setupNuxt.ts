// Nuxt-context 整合測試專用 setup（vitest.nuxt.config.ts）：
// 1) fake-indexeddb 全域 indexedDB（資料層整合所需）。@nuxt/test-utils 之 jsdom 環境下
//    `window` 與 `globalThis` 可能非同一物件；fake-indexeddb/auto 僅掛 `window`，而頁面元件之
//    `idb.openDB` 經 Vite SSR module runner 載入時讀 bare `indexedDB`（→ globalThis）→ 找不到
//    fake → openDB 永不 resolve（頁面卡在 loading）。故顯式同時鏡射至 globalThis。
// 2) jsdom 未實作 window.matchMedia → @vite-pwa/nuxt client plugin 於 app 初始化即呼叫而拋錯，
//    使頁面元件掛載失敗。以最小 stub 補上（色彩模式／PWA 偵測非本接縫範圍）。
import 'fake-indexeddb/auto';

const idbKeys = [
  'indexedDB',
  'IDBKeyRange',
  'IDBFactory',
  'IDBCursor',
  'IDBCursorWithValue',
  'IDBDatabase',
  'IDBIndex',
  'IDBObjectStore',
  'IDBOpenDBRequest',
  'IDBRequest',
  'IDBTransaction',
  'IDBVersionChangeEvent',
] as const;

// 將 window 上的 fake-indexeddb 綁定鏡射至 globalThis（若兩者非同一物件）。
const win = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : undefined;
const g = globalThis as unknown as Record<string, unknown>;
if (win && win !== g) {
  for (const key of idbKeys) {
    if (g[key] === undefined && win[key] !== undefined) g[key] = win[key];
  }
}
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
