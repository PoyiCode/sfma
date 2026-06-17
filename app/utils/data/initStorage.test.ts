import { describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './initStorage';

describe('requestPersistentStorage', () => {
  it('persist() → true 回 granted', async () => {
    expect(await requestPersistentStorage({ persist: vi.fn().mockResolvedValue(true) })).toBe(
      'granted',
    );
  });
  it('persist() → false 回 denied', async () => {
    expect(await requestPersistentStorage({ persist: vi.fn().mockResolvedValue(false) })).toBe(
      'denied',
    );
  });
  it('無 storage 回 unsupported', async () => {
    expect(await requestPersistentStorage(undefined)).toBe('unsupported');
  });
});
