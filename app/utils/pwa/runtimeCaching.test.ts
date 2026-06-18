import { describe, expect, it } from 'vitest';
import { RUNTIME_CACHING } from './runtimeCaching';

// 找出比對某 URL 之 runtime 快取規則（urlPattern 為 RegExp）。
function ruleFor(url: string) {
  return RUNTIME_CACHING.find((rule) => rule.urlPattern.test(url));
}

describe('RUNTIME_CACHING（SW 執行期快取：全離線 3D cache-on-use）', () => {
  it('3D 模型 glb → CacheFirst（opt-in 載入後可離線重看）', () => {
    for (const url of ['/models/anatomyV1.glb', 'https://host.example/models/anatomyV1.glb']) {
      const rule = ruleFor(url);
      expect(rule?.handler).toBe('CacheFirst');
      expect(rule?.options?.cacheName).toBe('ptapp-model-3d');
    }
  });

  it('Draco 解碼器 /draco/* → CacheFirst', () => {
    for (const url of ['/draco/draco_decoder_gltf.wasm', '/draco/draco_wasm_wrapper_gltf.js']) {
      const rule = ruleFor(url);
      expect(rule?.handler).toBe('CacheFirst');
      expect(rule?.options?.cacheName).toBe('ptapp-draco');
    }
  });

  it('3D／Babylon lazy JS chunk（assets/*.js）→ CacheFirst（離線可載 Babylon 視口）', () => {
    for (const url of [
      '/assets/Model3DViewer-BuBP4VWF.js',
      '/assets/pbr.fragment-CBQN63Fa.js',
      '/assets/thinEngine.pure-DdJtkfbK.js',
    ]) {
      const rule = ruleFor(url);
      expect(rule?.handler).toBe('CacheFirst');
      expect(rule?.options?.cacheName).toBe('ptapp-js-chunks');
    }
  });

  it('不快取結構化／個資路徑（json／db／csv／html）——SW 執行期亦不快取個資（§8.7）', () => {
    for (const url of [
      '/data/patients.json',
      'https://host.example/store.db',
      '/export.csv',
      '/index.html',
    ]) {
      expect(ruleFor(url)).toBeUndefined();
    }
  });

  it('每條規則皆 CacheFirst＋具 cacheName 與 expiration（限快取膨脹）', () => {
    expect(RUNTIME_CACHING.length).toBeGreaterThanOrEqual(3);
    for (const rule of RUNTIME_CACHING) {
      expect(rule.handler).toBe('CacheFirst');
      expect(typeof rule.options?.cacheName).toBe('string');
      expect(rule.options?.expiration?.maxEntries).toBeGreaterThan(0);
      expect(rule.options?.expiration?.maxAgeSeconds).toBeGreaterThan(0);
      expect(rule.options?.cacheableResponse?.statuses).toContain(200);
    }
  });
});
