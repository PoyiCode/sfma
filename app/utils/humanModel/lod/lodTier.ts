// LOD 分級決策（04 §4.3.5 切換機制／§4.3.6 降級規則）：純框架無關邏輯。
// 依使用者覆寫解析渲染分級；FPS 降級為「降一級」純轉移（精簡為最低、不再退 2D）。
// 不含 Babylon mesh.addLODLevel（mesh 距離換版需真實 glTF、待資產）。
import type { AppSettings } from '@ptapp/shared';

// 渲染分級（§4.3.6）：full＝無損（未壓縮未減面 glb、手動 opt-in、絕不自動選）；
// simplified＝現役 anatomyV1.glb（唯一自動分級；精細與 2D 階層皆已移除）。
// App 為「僅 3D」：無 WebGL 由頁面顯不支援訊息（非 LOD 階層），故無 twoD 階層。
export const LOD_TIERS = ['full', 'simplified'] as const;
export type LodTier = (typeof LOD_TIERS)[number];

// 使用者覆寫複用設定單一真相（auto／simplified／full）。
export type LodOverride = AppSettings['lodMode'];

// LOD 覆寫選項（單一真相）：設定頁與檢視器內 LOD 控制共用之有序選項
// （resolved LodTier〔full/simplified〕為渲染分級、與此覆寫值分立）。
// full 置末＝最高細節（無損）；切換至 full 須經流量確認（見 useFullLodConfirm）。
export const LOD_OVERRIDES = [
  'auto',
  'simplified',
  'full',
] as const satisfies readonly LodOverride[];

export interface DeviceCapability {
  // detect-gpu tier（0 封鎖/極弱 – 3 旗艦）；未知為 undefined。
  gpuTier?: number;
  // navigator.deviceMemory（GB）；未知為 undefined。
  deviceMemoryGb?: number;
  // 是否支援 WebGL（3D 前提；不支援則頁面顯不支援訊息＝App 僅 3D）。
  webglSupported: boolean;
}

// 依使用者覆寫解析渲染分級（僅於 WebGL 可用時呼叫；WebGL 閘由頁面把關）。
// full＝手動 opt-in 無損；auto／simplified 皆解析 simplified（現役單一 glb）。
export function resolveLodTier(override: LodOverride): LodTier {
  return override === 'full' ? 'full' : 'simplified';
}

// §4.3.6 降級規則：完整 → 精簡（精簡為最低、不再退 2D；FPS 自動降級沿此級聯）。
export function degradeLodTier(current: LodTier): LodTier {
  switch (current) {
    case 'full':
      return 'simplified';
    case 'simplified':
      return 'simplified';
  }
}
