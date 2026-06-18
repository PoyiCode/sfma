import { describe, expect, it } from 'vitest';
import { MODEL_ASSET_URLS, anatomyScenePopulatorFor, resolveModelAssetUrl } from './modelAsset';

describe('resolveModelAssetUrl（§4.3.6 分級→資產）', () => {
  it('simplified → 現役 glb url（anatomyV1.glb）', () => {
    expect(resolveModelAssetUrl('simplified')).toBe(MODEL_ASSET_URLS.simplified);
    expect(MODEL_ASSET_URLS.simplified).toBe('/models/anatomyV1.glb');
  });

  it('full → 完整無損 glb url（未壓縮未減面）', () => {
    expect(resolveModelAssetUrl('full')).toBe(MODEL_ASSET_URLS.full);
    expect(MODEL_ASSET_URLS.full).toBe('/models/anatomyV1.full.glb');
  });

  it('full 與 simplified 解析至相異資產（完整版為獨立無損檔）', () => {
    expect(resolveModelAssetUrl('full')).not.toBe(resolveModelAssetUrl('simplified'));
  });
});

describe('anatomyScenePopulatorFor（每-url memo、穩定參考）', () => {
  it('同 url 回穩定相同參考（Model3DView 要求穩定 populateScene）', () => {
    const a = anatomyScenePopulatorFor(MODEL_ASSET_URLS.simplified);
    const b = anatomyScenePopulatorFor(MODEL_ASSET_URLS.simplified);
    expect(a).toBe(b);
    expect(typeof a).toBe('function');
  });

  it('相異 url 回相異參考（每-url 各自獨立填充器）', () => {
    const one = anatomyScenePopulatorFor('/models/__test_a.glb');
    const two = anatomyScenePopulatorFor('/models/__test_b.glb');
    expect(one).not.toBe(two);
  });
});
