// 裝置能力偵測（04 §4.3.5）：WebGL 支援＋navigator.deviceMemory＋GPU 分級（renderer 字串／
// 記憶體／核心數啟發），組為 DeviceCapability。可注入/可 jsdom 測。
// gpuTier 經 classifyGpuTier 啟發式推估（非 detect-gpu 套件、同步、無相依；失準由 §4.3.6 FPS
// 自動降級校正）——使 auto 模式之高階裝置能自動取細節版（否則 gpuTier 恆 undefined→恆精簡）。
import type { DeviceCapability } from './lodTier';
import { classifyGpuTier } from './gpuTier';

// WEBGL_debug_renderer_info 之 UNMASKED_RENDERER_WEBGL 列舉值（擴充未啟用時以此參數查 renderer）。
const UNMASKED_RENDERER_WEBGL = 0x9246;

// navigator.deviceMemory 為非標準 API（Chromium 系）；未支援為 undefined。
interface DeviceMemoryNavigator {
  deviceMemory?: number;
}

function getWebglContext(): WebGLRenderingContext | null {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
  return (gl as WebGLRenderingContext | null) ?? null;
}

export function detectWebglSupport(): boolean {
  try {
    return getWebglContext() !== null;
  } catch {
    return false;
  }
}

// GPU renderer 字串（WEBGL_debug_renderer_info）；擴充被遮蔽／無 WebGL／失敗 → undefined（不拋）。
export function detectWebglRenderer(): string | undefined {
  try {
    const gl = getWebglContext();
    if (gl === null) return undefined;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext === null) return undefined;
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL ?? UNMASKED_RENDERER_WEBGL);
    return typeof renderer === 'string' && renderer.length > 0 ? renderer : undefined;
  } catch {
    return undefined;
  }
}

export function detectDeviceMemoryGb(): number | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const memory = (navigator as Navigator & DeviceMemoryNavigator).deviceMemory;
  return typeof memory === 'number' ? memory : undefined;
}

export function detectHardwareConcurrency(): number | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const cores = navigator.hardwareConcurrency;
  return typeof cores === 'number' && cores > 0 ? cores : undefined;
}

export function detectDeviceCapability(): DeviceCapability {
  const capability: DeviceCapability = { webglSupported: detectWebglSupport() };
  const memory = detectDeviceMemoryGb();
  if (memory !== undefined) capability.deviceMemoryGb = memory;
  const gpuTier = classifyGpuTier({
    renderer: detectWebglRenderer(),
    deviceMemoryGb: memory,
    hardwareConcurrency: detectHardwareConcurrency(),
  });
  if (gpuTier !== undefined) capability.gpuTier = gpuTier;
  return capability;
}
