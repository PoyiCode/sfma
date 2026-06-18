import { describe, expect, it } from 'vitest';
import { classifyGpuTier } from './gpuTier';

describe('classifyGpuTier（GPU 分級啟發式；04 §4.3.5）', () => {
  it('軟體算繪 renderer → 0（無 GPU 加速）', () => {
    expect(classifyGpuTier({ renderer: 'Google SwiftShader' })).toBe(0);
    expect(classifyGpuTier({ renderer: 'llvmpipe (LLVM 15.0.7, 256 bits)' })).toBe(0);
    expect(classifyGpuTier({ renderer: 'Microsoft Basic Render Driver' })).toBe(0);
  });

  it('明確旗艦 renderer → 3', () => {
    expect(classifyGpuTier({ renderer: 'Apple M2 Pro' })).toBe(3);
    expect(classifyGpuTier({ renderer: 'Apple A17 Pro GPU' })).toBe(3);
    expect(
      classifyGpuTier({ renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)' }),
    ).toBe(3);
    expect(classifyGpuTier({ renderer: 'AMD Radeon RX 6800 XT' })).toBe(3);
    expect(classifyGpuTier({ renderer: 'Adreno (TM) 730' })).toBe(3);
    expect(classifyGpuTier({ renderer: 'Mali-G78 MP14' })).toBe(3);
  });

  it('明確低階 renderer → 1', () => {
    expect(classifyGpuTier({ renderer: 'Mali-T720' })).toBe(1);
    expect(classifyGpuTier({ renderer: 'Adreno (TM) 308' })).toBe(1);
    expect(classifyGpuTier({ renderer: 'PowerVR Rogue GE8320' })).toBe(1);
    expect(classifyGpuTier({ renderer: 'Intel(R) HD Graphics 4000' })).toBe(1);
  });

  it('旗艦 renderer 優先於軟體以外之低判定（高階先比中、軟體最先）', () => {
    // 軟體 renderer 即令記憶體高亦回 0（算繪不可行）。
    expect(
      classifyGpuTier({ renderer: 'SwiftShader', deviceMemoryGb: 8, hardwareConcurrency: 16 }),
    ).toBe(0);
  });

  it('renderer 未知／被遮蔽 → 以記憶體＋核心數推估', () => {
    expect(classifyGpuTier({ deviceMemoryGb: 8, hardwareConcurrency: 12 })).toBe(3);
    expect(classifyGpuTier({ deviceMemoryGb: 4, hardwareConcurrency: 4 })).toBe(2);
    expect(classifyGpuTier({ deviceMemoryGb: 2, hardwareConcurrency: 4 })).toBe(1);
    expect(classifyGpuTier({ hardwareConcurrency: 2 })).toBe(1);
  });

  it('renderer 未分類（如一般 ANGLE 字串）且 capacity 強 → 依 capacity', () => {
    expect(
      classifyGpuTier({
        renderer: 'ANGLE (Intel, Mesa Intel(R) Graphics, OpenGL 4.6)',
        deviceMemoryGb: 8,
        hardwareConcurrency: 8,
      }),
    ).toBe(3);
  });

  it('信號不足（無 renderer 且無 memory／cores）→ undefined（上層保守預設精簡）', () => {
    expect(classifyGpuTier({})).toBeUndefined();
    expect(classifyGpuTier({ renderer: '' })).toBeUndefined();
  });

  it('renderer 未分類且 capacity 介於中間／弱 → undefined', () => {
    // mem=4 但 cores 未知（<4 路徑不成立、>8 不成立）→ 無法判定。
    expect(classifyGpuTier({ deviceMemoryGb: 4 })).toBeUndefined();
  });
});
