import { describe, expect, it } from 'vitest';
import { createUuid, nextDisplayCode } from './ids';

describe('createUuid（06 §6.6）', () => {
  it('輸出 UUID 格式且每次不同', () => {
    const a = createUuid();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(createUuid()).not.toBe(a);
  });

  // 回歸：非安全環境（如 iOS WebKit 經 http://區網IP 存取）crypto.randomUUID 為 undefined，
  // 但 getRandomValues 仍可用 → createUuid 須以後備產生合法 v4 UUID（否則新增個案存檔擲錯）。
  it('randomUUID 不可用時以 getRandomValues 後備產生合法 v4 UUID', () => {
    // shared lib 為 ES2023 無 DOM 型別 → 經 unknown 取得 crypto 全域（與 ids.ts 同）
    const cryptoObj = (globalThis as unknown as { crypto: { randomUUID?: unknown } }).crypto;
    const hadOwn = Object.prototype.hasOwnProperty.call(cryptoObj, 'randomUUID');
    const originalDesc = Object.getOwnPropertyDescriptor(cryptoObj, 'randomUUID');
    Object.defineProperty(cryptoObj, 'randomUUID', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      const id = createUuid();
      // v4：第三段首位＝4（版本）、第四段首位∈[89ab]（變體）
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(createUuid()).not.toBe(id);
    } finally {
      delete cryptoObj.randomUUID;
      if (hadOwn && originalDesc) Object.defineProperty(cryptoObj, 'randomUUID', originalDesc);
    }
  });
});

describe('nextDisplayCode（06 §6.2 自動編號）', () => {
  it('空集合 → P0001', () => {
    expect(nextDisplayCode([])).toBe('P0001');
  });

  it('取既有最大值 +1（允許跳號）', () => {
    expect(nextDisplayCode(['P0001', 'P0003'])).toBe('P0004');
  });

  it('忽略自訂代碼與 undefined', () => {
    expect(nextDisplayCode(['custom-7', undefined, 'P0002'])).toBe('P0003');
  });

  it('超過四位數不歸零', () => {
    expect(nextDisplayCode(['P9999'])).toBe('P10000');
  });
});
