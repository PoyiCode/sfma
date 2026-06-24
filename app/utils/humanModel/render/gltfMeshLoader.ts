// glTF/glb 載入器適配（04 §4.6.3 匯出管線／§4.6.4 抽換保證）：把託管之 glb（node 名＝
// anatomyId、無 metadata）載入 scene，供 createGltfScenePopulator 串接 bindAnatomyMetadata。
// 資產託管＝apps/web/public/（gitignored glb、Vite dev server 服務、runtime url /models/<name>.glb）。
// importer 可注入便於以 NullEngine mock 測適配層；預設用 Babylon ImportMeshAsync。
import { ImportMeshAsync, type Scene } from '@babylonjs/core';
// 側效：註冊 glTF/glb SceneLoader 外掛（比照 sceneHighlight 之 outlineRenderer 側效）。
import '@babylonjs/loaders/glTF';
import type { SceneMeshLoader } from './scenePopulator';
import { configureDracoDecoder } from './dracoConfig';
import { actionLogger } from '../../devtools/actionLogger';

export type MeshImporter = (url: string, scene: Scene) => Promise<unknown>;

// createInstances:false——拆雙側個別骨後，左右同名骨之鏡像幾何經 glTF 去重為共用 mesh，
// Babylon 預設將額外參考建為 InstancedMesh。但實例與來源**共用材質**且 overlay／outline
// **不渲染 InstancedMesh**→選取高亮無法單側著色；且實例可見性與來源耦合。App 全鏈（綁定／
// 點選／高亮／分層可見性）皆假設「每部位一獨立 Mesh」→關閉實例化、每 node 載為獨立 Mesh，
// 還原一致互動（換取共用幾何之記憶體節省、模型已減面故可接受）。
export const GLTF_IMPORT_OPTIONS = { pluginOptions: { gltf: { createInstances: false } } } as const;

const defaultImporter: MeshImporter = (url, scene) =>
  ImportMeshAsync(url, scene, GLTF_IMPORT_OPTIONS);

export function createGltfMeshLoader(
  url: string,
  importer: MeshImporter = defaultImporter,
  dracoBaseUrl?: string,
): SceneMeshLoader {
  // 配置自帶 Draco decoder（不走 CDN）於 import 前——glb 經 KHR_draco_mesh_compression 壓縮、
  // Babylon glTF 載入器以 DracoDecoder.Default 解碼，須先指向自帶 public/draco/（§4.6.3、todo 04 line 8）。
  // 子路徑佈署（GitHub Pages）由呼叫端傳含 app.baseURL 前綴之 dracoBaseUrl；未傳則預設 /draco/。
  configureDracoDecoder(dracoBaseUrl);
  return async (scene) => {
    // 開發者埋點（07 §7.6、todo 07 line 16）：資產載入生命週期——assetLoad（開始、時戳供算載入時長）／
    // assetLoaded（成功）／assetLoadError（失敗，診斷 iOS 區網非安全環境載入失敗，見 [[ios-lan-nonsecure-context]]）。
    // detail＝url（非個資）；正式建置 actionLogger 為 no-op。
    actionLogger.log('humanModel', 'assetLoad', url);
    try {
      await importer(url, scene);
      actionLogger.log('humanModel', 'assetLoaded', url);
    } catch (error) {
      actionLogger.error('humanModel', 'assetLoadError', url);
      throw error;
    }
  };
}
