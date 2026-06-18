// GPU 分級啟發式（04 §4.3.5）：依 WebGL renderer 字串＋記憶體／核心數推估 detect-gpu 風格
// tier（0 軟體/極弱 – 3 旗艦）。純函式、無相依、可注入測；信號不足回 undefined。
//
// 名單與門檻為**初版工程啟發值（非 benchmark／臨床資料）**。註：精細與 2D 階層移除後
// `resolveLodTier` 已不依 gpuTier 決定分級（auto 恆 simplified）；本分級保留為裝置能力
// metadata（前瞻：未來補真精細分級時可再據此自動升級），執行期效能仍由 §4.3.6 FPS
// 自動降級（完整→精簡）把關。

export interface GpuTierSignals {
  // WEBGL_debug_renderer_info 之 UNMASKED_RENDERER_WEBGL（部分瀏覽器遮蔽 → undefined）。
  renderer?: string;
  // navigator.deviceMemory（Chromium，GB，上限 8）。
  deviceMemoryGb?: number;
  // navigator.hardwareConcurrency（邏輯核心數）。
  hardwareConcurrency?: number;
}

// 軟體算繪（無硬體 GPU 加速）：3D 不可行等級。
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|\bsoftware\b|microsoft basic/i;
// 明確旗艦 GPU 家族（細節版）。
const FLAGSHIP_RENDERER =
  /apple m\d|apple a1[5-9]|geforce rtx|\brtx\b|radeon rx [5-9]\d{3}|radeon pro|adreno\D*7\d\d|mali-g[789]\d/i;
// 明確入門／低階 GPU 家族（精簡版）。
const ENTRY_RENDERER =
  /mali-[4t]\d|mali-g5\d|adreno\D*[2-5]\d\d|powervr|videocore|intel.*hd graphics/i;

const HIGH_MEMORY_GB = 8;
const HIGH_CORES = 8;
const MID_MEMORY_GB = 4;
const MID_CORES = 4;
const LOW_MEMORY_GB = 2;
const LOW_CORES = 2;

// renderer 未知／被遮蔽／未分類時，以記憶體＋核心數推估（信號不足回 undefined）。
function classifyByCapacity(signals: GpuTierSignals): number | undefined {
  const { deviceMemoryGb, hardwareConcurrency } = signals;
  if (deviceMemoryGb === undefined && hardwareConcurrency === undefined) {
    return undefined;
  }
  const memory = deviceMemoryGb ?? 0;
  const cores = hardwareConcurrency ?? 0;
  if (memory >= HIGH_MEMORY_GB && cores >= HIGH_CORES) return 3;
  if (memory >= MID_MEMORY_GB && cores >= MID_CORES) return 2;
  if (memory > 0 && memory <= LOW_MEMORY_GB) return 1;
  if (cores > 0 && cores <= LOW_CORES) return 1;
  return undefined;
}

export function classifyGpuTier(signals: GpuTierSignals): number | undefined {
  const renderer = signals.renderer ?? '';
  if (renderer) {
    if (SOFTWARE_RENDERER.test(renderer)) return 0;
    if (FLAGSHIP_RENDERER.test(renderer)) return 3;
    if (ENTRY_RENDERER.test(renderer)) return 1;
  }
  return classifyByCapacity(signals);
}
