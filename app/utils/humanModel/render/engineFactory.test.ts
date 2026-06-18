import { describe, expect, it, vi } from 'vitest';
import type { AbstractEngine } from '@babylonjs/core';
import {
  createPreferredEngine,
  defaultEngineFactory,
  type PreferredEngineDeps,
} from './engineFactory';

// sentinel engines：createPreferredEngine 僅回傳 deps 所建之 engine、不觸碰其方法，
// 故以標記物件替身（免於 node 建真 Babylon engine、亦使「回傳何者」之斷言精確）。
const webgpuEngine = { kind: 'webgpu' } as unknown as AbstractEngine;
const webgl2Engine = { kind: 'webgl2' } as unknown as AbstractEngine;
const canvas = {} as HTMLCanvasElement;

function makeDeps(over: Partial<PreferredEngineDeps> = {}) {
  const isWebGPUSupported = vi.fn(async () => true);
  const createWebGPUEngine = vi.fn(async () => webgpuEngine);
  const createWebGL2Engine = vi.fn(() => webgl2Engine);
  const deps: PreferredEngineDeps = {
    isWebGPUSupported,
    createWebGPUEngine,
    createWebGL2Engine,
    ...over,
  };
  return { deps, isWebGPUSupported, createWebGPUEngine, createWebGL2Engine };
}

describe('createPreferredEngine（04 §4.3.1 WebGPU 優先、WebGL2 後備）', () => {
  it('WebGPU 支援 → 建並回 WebGPU engine、不建 WebGL2', async () => {
    const { deps, isWebGPUSupported, createWebGPUEngine, createWebGL2Engine } = makeDeps();
    const engine = await createPreferredEngine(canvas, deps);
    expect(engine).toBe(webgpuEngine);
    expect(isWebGPUSupported).toHaveBeenCalledTimes(1);
    expect(createWebGPUEngine).toHaveBeenCalledWith(canvas);
    expect(createWebGL2Engine).not.toHaveBeenCalled();
  });

  it('WebGPU 不支援 → 後備 WebGL2、不建 WebGPU', async () => {
    const { deps, createWebGPUEngine, createWebGL2Engine } = makeDeps({
      isWebGPUSupported: vi.fn(async () => false),
    });
    const engine = await createPreferredEngine(canvas, deps);
    expect(engine).toBe(webgl2Engine);
    expect(createWebGPUEngine).not.toHaveBeenCalled();
    expect(createWebGL2Engine).toHaveBeenCalledWith(canvas);
  });

  it('WebGPU 偵測拋錯 → 後備 WebGL2（不阻斷算圖）', async () => {
    const { deps, createWebGL2Engine } = makeDeps({
      isWebGPUSupported: vi.fn(async () => {
        throw new Error('no gpu');
      }),
    });
    const engine = await createPreferredEngine(canvas, deps);
    expect(engine).toBe(webgl2Engine);
    expect(createWebGL2Engine).toHaveBeenCalledWith(canvas);
  });

  it('WebGPU 支援但初始化拋錯 → 後備 WebGL2', async () => {
    const { deps, createWebGL2Engine } = makeDeps({
      createWebGPUEngine: vi.fn(async () => {
        throw new Error('initAsync failed');
      }),
    });
    const engine = await createPreferredEngine(canvas, deps);
    expect(engine).toBe(webgl2Engine);
    expect(createWebGL2Engine).toHaveBeenCalledWith(canvas);
  });

  it('defaultEngineFactory 回傳 Promise（非同步 WebGPU 優先路徑、供 Model3DView 分流）', () => {
    // 不 await：預設 deps 於 node 走後備時會嘗試以無效 canvas 建真 WebGL2 而 reject，
    // 僅驗同步回傳為 Promise（元件以 instanceof Promise 分流同步／非同步建場景）。
    const result = defaultEngineFactory(canvas);
    expect(result).toBeInstanceOf(Promise);
    void (result as Promise<unknown>).catch(() => {});
  });
});
