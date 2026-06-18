// Babylon engine 工廠（與 Model3DView 分檔：元件檔僅匯出元件，避免 react-refresh 警告）。
// engine 共同基底為 AbstractEngine：WebGL2 Engine／NullEngine／WebGPUEngine 皆繼承之
// （runRenderLoop／resize／dispose 皆於 AbstractEngine）。
import { type AbstractEngine, Engine as BabylonEngine, WebGPUEngine } from '@babylonjs/core';

// engine 工廠：可同步（WebGL2／測試 NullEngine）或非同步（WebGPU 需 initAsync，§4.3.1）；
// 故回傳型別容許 Promise，Model3DView 以 `instanceof Promise` 分流同步／非同步建場景。
export type EngineFactory = (canvas: HTMLCanvasElement) => AbstractEngine | Promise<AbstractEngine>;

// WebGL2 後備（同步建立、browser-only）：保留繪圖緩衝＋stencil（既有預設選項）。
export const createWebGL2Engine = (canvas: HTMLCanvasElement): AbstractEngine =>
  new BabylonEngine(canvas, true, { preserveDrawingBuffer: true, stencil: true });

// WebGPU／WebGL2 選擇之相依（注入式、測試脫鉤；預設＝真 Babylon 實作）。
export interface PreferredEngineDeps {
  // WebGPU 是否受瀏覽器／裝置支援（非同步偵測）；預設 WebGPUEngine.IsSupportedAsync。
  isWebGPUSupported: () => Promise<boolean>;
  // 建立並初始化 WebGPU engine；預設 WebGPUEngine.CreateAsync（內含 initAsync）。
  createWebGPUEngine: (canvas: HTMLCanvasElement) => Promise<AbstractEngine>;
  // 建立 WebGL2 engine（後備）；預設 createWebGL2Engine。
  createWebGL2Engine: (canvas: HTMLCanvasElement) => AbstractEngine;
}

export const defaultPreferredEngineDeps: PreferredEngineDeps = {
  isWebGPUSupported: () => WebGPUEngine.IsSupportedAsync,
  createWebGPUEngine: (canvas) =>
    WebGPUEngine.CreateAsync(canvas, { stencil: true, antialias: true }),
  createWebGL2Engine,
};

// 04 §4.3.1「WebGPU 優先、WebGL2 後備」：偵測支援→建 WebGPU（含 initAsync）；
// 不支援，或 WebGPU 偵測／初始化任一步驟拋錯，皆退回 WebGL2（不阻斷算圖）。
export async function createPreferredEngine(
  canvas: HTMLCanvasElement,
  deps: PreferredEngineDeps = defaultPreferredEngineDeps,
): Promise<AbstractEngine> {
  try {
    if (await deps.isWebGPUSupported()) {
      return await deps.createWebGPUEngine(canvas);
    }
  } catch {
    // WebGPU 偵測／初始化失敗 → 後備 WebGL2（見下）。
  }
  return deps.createWebGL2Engine(canvas);
}

// 預設 engine 工廠：WebGPU 優先、WebGL2 後備（非同步；04 §4.3.1）。
export const defaultEngineFactory: EngineFactory = (canvas) => createPreferredEngine(canvas);
