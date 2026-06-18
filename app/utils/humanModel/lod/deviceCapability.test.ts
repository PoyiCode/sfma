// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  detectDeviceCapability,
  detectDeviceMemoryGb,
  detectHardwareConcurrency,
  detectWebglRenderer,
  detectWebglSupport,
} from './deviceCapability';

// WEBGL_debug_renderer_info 之 UNMASKED_RENDERER_WEBGL 列舉值。
const UNMASKED_RENDERER_WEBGL = 37446;

// 建假 WebGLRenderingContext：可選 renderer（提供 debug_renderer_info 擴充＋getParameter）。
function fakeGl(renderer?: string) {
  return {
    getExtension: (name: string) =>
      name === 'WEBGL_debug_renderer_info' && renderer !== undefined
        ? { UNMASKED_RENDERER_WEBGL }
        : null,
    getParameter: (param: number) => (param === UNMASKED_RENDERER_WEBGL ? renderer : undefined),
  } as unknown as RenderingContext;
}

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'deviceMemory');
  Reflect.deleteProperty(navigator, 'hardwareConcurrency');
});

describe('deviceCapability（裝置能力偵測；04 §4.3.5）', () => {
  it('detectWebglSupport：jsdom 預設無 WebGL → false', () => {
    expect(detectWebglSupport()).toBe(false);
  });

  it('detectWebglSupport：getContext 回 context → true', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext);
    expect(detectWebglSupport()).toBe(true);
  });

  it('detectDeviceMemoryGb：無 deviceMemory → undefined；有 → 數值', () => {
    expect(detectDeviceMemoryGb()).toBeUndefined();
    Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
    expect(detectDeviceMemoryGb()).toBe(8);
  });

  it('detectHardwareConcurrency：有效正整數 → 值；缺／非正 → undefined', () => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 12, configurable: true });
    expect(detectHardwareConcurrency()).toBe(12);
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 0, configurable: true });
    expect(detectHardwareConcurrency()).toBeUndefined();
  });

  it('detectWebglRenderer：debug_renderer_info 可讀 → renderer 字串', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeGl('Apple M2 Pro'));
    expect(detectWebglRenderer()).toBe('Apple M2 Pro');
  });

  it('detectWebglRenderer：擴充被遮蔽（無 debug_renderer_info）→ undefined', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeGl(undefined));
    expect(detectWebglRenderer()).toBeUndefined();
  });

  it('detectWebglRenderer：無 WebGL（jsdom 預設）→ undefined（不拋）', () => {
    expect(detectWebglRenderer()).toBeUndefined();
  });

  it('detectDeviceCapability：旗艦 renderer → gpuTier 3（auto 高階裝置可取細節版）', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeGl('Apple M2 Pro'));
    Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 10, configurable: true });
    const cap = detectDeviceCapability();
    expect(cap.webglSupported).toBe(true);
    expect(cap.deviceMemoryGb).toBe(8);
    expect(cap.gpuTier).toBe(3);
  });

  it('detectDeviceCapability：renderer 被遮蔽 → 退記憶體／核心數啟發（mem4 cores4 → tier 2）', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeGl(undefined));
    Object.defineProperty(navigator, 'deviceMemory', { value: 4, configurable: true });
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
    const cap = detectDeviceCapability();
    expect(cap.gpuTier).toBe(2);
  });

  it('detectDeviceCapability：信號不足以判定 → gpuTier 留 undefined（上層保守預設精簡）', () => {
    // 無 WebGL（jsdom 預設）／無 deviceMemory／核心數中段（4，非高非低）→ 啟發式無法判定。
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 4, configurable: true });
    const cap = detectDeviceCapability();
    expect(cap.webglSupported).toBe(false);
    expect(cap.gpuTier).toBeUndefined();
  });
});
