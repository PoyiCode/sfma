// 分級資產解析（04 §4.3.6 LOD 分級→資產／§4.6.3 匯出管線）：依解析之 LodTier 擇載入之
// glb url，並以每-url memo 提供穩定參考之 ScenePopulator（Model3DView 要求穩定 populateScene）。
// 資產託管＝apps/web/public/models/（gitignored、Vite 靜態服務、runtime url /models/<name>.glb）。
import type { LodTier } from '../lod/lodTier';
import { createGltfScenePopulatorWithFallback, type ScenePopulator } from './scenePopulator';
import { createGltfMeshLoader } from './gltfMeshLoader';

// 託管 glb 之執行期 url（§4.3.6 分級資產）：
//   simplified＝現役 anatomyV1.glb（全身減面細節版，≤900k 三角面；**精細〔detailed〕LOD 階層移除後
//     唯一 3D 分級資產**）。原過度簡化版（肌群合併＋cap 300 激進減面）失逐肌選取與臨床可辨識度
//     〔使用者回報〕已刪、現以此 glb 為基線。
//   full＝完整無損版（未壓縮〔無 Draco〕、未減面、無視預算；解3d資產「完整」級別）——
//     獨立檔 anatomyV1.full.glb（~38 MB，遠大於現役版 3.3 MB），手動 opt-in、首載大流量。
// 註：匯出／manifest 之「detailed」描繪 profile（逐件 vs simplified 合併群組）為資產管線概念、
//     與此執行期 LOD 階層正交、保留不動；現役 anatomyV1.glb 即由 detailed profile 匯出。
export const MODEL_ASSET_URLS = {
  full: '/models/anatomyV1.full.glb',
  simplified: '/models/anatomyV1.glb',
} as const;

// 依解析分級擇資產 url。full→完整無損獨立檔；simplified→現役 anatomyV1.glb。
export function resolveModelAssetUrl(tier: LodTier): string {
  if (tier === 'full') return MODEL_ASSET_URLS.full;
  return MODEL_ASSET_URLS.simplified;
}

// 每-url 之 ScenePopulator memo：同一 url 回穩定相同參考（避免 Model3DView 因參考變動重建場景），
// 相異 url 回相異參考。填充器＝載入該 glb，缺檔／失敗退佔位身體（§4.2／§4.6.4）。
const POPULATOR_BY_URL = new Map<string, ScenePopulator>();

export function anatomyScenePopulatorFor(url: string): ScenePopulator {
  const cached = POPULATOR_BY_URL.get(url);
  if (cached) {
    return cached;
  }
  const populator = createGltfScenePopulatorWithFallback(createGltfMeshLoader(url));
  POPULATOR_BY_URL.set(url, populator);
  return populator;
}
