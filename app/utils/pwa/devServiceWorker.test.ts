import { describe, expect, it, vi } from 'vitest';
import { unregisterServiceWorkersAndClearCaches } from './devServiceWorker';

describe('unregisterServiceWorkersAndClearCaches', () => {
  it('反註冊所有 SW 並清空所有 cache', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const serviceWorker = {
      getRegistrations: vi.fn().mockResolvedValue([{ unregister }, { unregister }]),
    } as unknown as ServiceWorkerContainer;
    const del = vi.fn().mockResolvedValue(true);
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue(['a', 'b']),
      delete: del,
    } as unknown as CacheStorage;

    await unregisterServiceWorkersAndClearCaches({ serviceWorker, cacheStorage });

    expect(unregister).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith('a');
    expect(del).toHaveBeenCalledWith('b');
  });

  it('不支援（null）時安全略過、不拋', async () => {
    await expect(
      unregisterServiceWorkersAndClearCaches({ serviceWorker: null, cacheStorage: null }),
    ).resolves.toBeUndefined();
  });
});
