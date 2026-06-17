// 開發模式停用離線載入（取消 Service Worker）：dev 不註冊 SW，並主動移除既有 SW 與其快取——
// 清除先前 prod build／preview 殘留之 SW，否則於 dev 持續攔截、回舊版資產。
// 純函式、注入式（便於測試）、環境守衛：jsdom 與非安全 http 區網無 navigator.serviceWorker／caches，安全略過。
export interface ServiceWorkerCleanupDeps {
  serviceWorker?: ServiceWorkerContainer | null;
  cacheStorage?: CacheStorage | null;
}

function resolveDeps(deps: ServiceWorkerCleanupDeps): {
  serviceWorker: ServiceWorkerContainer | null;
  cacheStorage: CacheStorage | null;
} {
  const serviceWorker =
    'serviceWorker' in deps
      ? (deps.serviceWorker ?? null)
      : typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? navigator.serviceWorker
        : null;
  const cacheStorage =
    'cacheStorage' in deps
      ? (deps.cacheStorage ?? null)
      : typeof globalThis !== 'undefined' && 'caches' in globalThis
        ? globalThis.caches
        : null;
  return { serviceWorker, cacheStorage };
}

export async function unregisterServiceWorkersAndClearCaches(
  deps: ServiceWorkerCleanupDeps = {},
): Promise<void> {
  const { serviceWorker, cacheStorage } = resolveDeps(deps);
  if (serviceWorker) {
    try {
      const registrations = await serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch {
      // 不支援／非安全環境：略過。
    }
  }
  if (cacheStorage) {
    try {
      const keys = await cacheStorage.keys();
      await Promise.all(keys.map((key) => cacheStorage.delete(key)));
    } catch {
      // 略過。
    }
  }
}
