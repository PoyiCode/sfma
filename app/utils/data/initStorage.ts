import { actionLogger } from '../devtools/actionLogger';

export type PersistResult = 'granted' | 'denied' | 'unsupported';

// 啟動時申請持久儲存（02 §2.6、08 §8.7）：對抗瀏覽器自動清除 IndexedDB。
export async function requestPersistentStorage(
  storage: Pick<StorageManager, 'persist'> | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.storage,
): Promise<PersistResult> {
  if (storage === undefined || typeof storage.persist !== 'function') {
    actionLogger.warn('data', 'persistStorage', 'unsupported');
    return 'unsupported';
  }
  try {
    if (await storage.persist()) {
      actionLogger.log('data', 'persistStorage', 'granted');
      return 'granted';
    }
    actionLogger.warn('data', 'persistStorage', 'denied');
    return 'denied';
  } catch {
    actionLogger.warn('data', 'persistStorage', 'unsupported');
    return 'unsupported';
  }
}
