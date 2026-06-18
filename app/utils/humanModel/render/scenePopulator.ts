// 場景填充策略（04 §4.3.1 canvas 元件／§4.6.4 glTF 抽換保證之程式落點）：
// 注入 Model3DView 以決定幾何來源。預設＝同步程序化佔位身體（已自帶 metadata、
// 無資產相依）；非同步＝載入 glTF 後 bindAnatomyMetadata 綁定 anatomyId metadata，
// 使真實幾何流入既有 picking/layers/highlight 邊界。實際載入器（@babylonjs/loaders）
// 與資產 url 於 Stage F 切片注入——此處僅定接縫（控制反轉）。
import type { Scene } from '@babylonjs/core';
import { anatomyEntities } from '@ptapp/definitions';
import { buildPlaceholderBody } from './sceneCore';
import { bindAnatomyMetadata } from './gltfBinding';

// 填充器：對 scene 加入幾何。同步回 void（佔位）、非同步回 Promise（glTF 載入）。
export type ScenePopulator = (scene: Scene) => void | Promise<void>;

// 預設：程序化佔位身體（同步、含 metadata）。
export const placeholderScenePopulator: ScenePopulator = (scene) => {
  buildPlaceholderBody(scene, anatomyEntities);
};

// glTF 幾何載入器：把 mesh（node 名＝anatomyId、無 metadata）載入 scene。
export type SceneMeshLoader = (scene: Scene) => Promise<void>;

// 由載入器組出非同步 ScenePopulator：先 await 載入幾何、後綁定 anatomyId metadata。
export function createGltfScenePopulator(loadIntoScene: SceneMeshLoader): ScenePopulator {
  return async (scene) => {
    await loadIntoScene(scene);
    bindAnatomyMetadata(scene);
  };
}

// glTF 填充器＋失敗後備：glb 為 gitignore 之大型資產（乾淨建置／CI 可能無此檔→404），
// 載入或解析失敗時退回 fallback（預設程序化佔位身體），使 3D 恆有幾何、不致空場景或
// 未捕捉 rejection（§4.2／§4.6.4；3D render/chunk 失敗另由 ui/ErrorBoundary 退 2D）。
export function createGltfScenePopulatorWithFallback(
  loadIntoScene: SceneMeshLoader,
  fallback: ScenePopulator = placeholderScenePopulator,
): ScenePopulator {
  const gltf = createGltfScenePopulator(loadIntoScene);
  return async (scene) => {
    try {
      await gltf(scene);
    } catch {
      await fallback(scene);
    }
  };
}
