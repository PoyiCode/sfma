// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { DracoDecoder } from '@babylonjs/core';
import { configureDracoDecoder } from './dracoConfig';

// 還原 DefaultConfiguration 免測間污染（靜態屬性）。
const original = DracoDecoder.DefaultConfiguration;
afterEach(() => {
  DracoDecoder.DefaultConfiguration = original;
});

describe('configureDracoDecoder（自帶 Draco decoder、不走 CDN；04 §4.6.3）', () => {
  it('預設 base /draco/：DefaultConfiguration 指向本地 wasm wrapper 與 binary', () => {
    configureDracoDecoder();
    expect(DracoDecoder.DefaultConfiguration.wasmUrl).toBe('/draco/draco_wasm_wrapper_gltf.js');
    expect(DracoDecoder.DefaultConfiguration.wasmBinaryUrl).toBe('/draco/draco_decoder_gltf.wasm');
  });

  it('自訂 base：URL 以 base 為前綴', () => {
    configureDracoDecoder('/custom/draco/');
    expect(DracoDecoder.DefaultConfiguration.wasmUrl).toBe(
      '/custom/draco/draco_wasm_wrapper_gltf.js',
    );
    expect(DracoDecoder.DefaultConfiguration.wasmBinaryUrl).toBe(
      '/custom/draco/draco_decoder_gltf.wasm',
    );
  });

  it('不設 fallbackUrl（WASM 自 iOS 11 通用、JS fallback 不出貨）', () => {
    configureDracoDecoder();
    expect(DracoDecoder.DefaultConfiguration.fallbackUrl).toBeUndefined();
  });
});
