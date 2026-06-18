import { DracoDecoder, MeshBuilder, NullEngine, SceneLoader } from '@babylonjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { actionLogger } from '../../devtools/actionLogger';
import { createModelScene } from './sceneCore';
import { createGltfMeshLoader, GLTF_IMPORT_OPTIONS, type MeshImporter } from './gltfMeshLoader';

describe('gltfMeshLoader（glTF/glb 載入器適配；04 §4.6.3/§4.6.4）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function newScene() {
    engine = new NullEngine();
    return createModelScene(engine);
  }

  it('side-effect import 註冊 .glb/.gltf SceneLoader 外掛', () => {
    // 匯入本模組已觸發 `@babylonjs/loaders/glTF` 側效註冊
    expect(SceneLoader.IsPluginForExtensionAvailable('.glb')).toBe(true);
    expect(SceneLoader.IsPluginForExtensionAvailable('.gltf')).toBe(true);
  });

  it('以 url＋scene 呼叫 importer 並 await', async () => {
    const scene = newScene();
    const importer = vi.fn<MeshImporter>(() => Promise.resolve());
    await createGltfMeshLoader('/models/anatomyV1.glb', importer)(scene);
    expect(importer).toHaveBeenCalledTimes(1);
    expect(importer.mock.calls[0]![0]).toBe('/models/anatomyV1.glb');
    expect(importer.mock.calls[0]![1]).toBe(scene);
  });

  it('glTF 載入選項關閉實例化（createInstances:false）——雙側共享幾何不建 InstancedMesh、每部位獨立 Mesh 使 overlay 高亮/單側可見性/點選一致', () => {
    expect(GLTF_IMPORT_OPTIONS.pluginOptions.gltf.createInstances).toBe(false);
  });

  it('importer 載入幾何後 scene 含該 mesh（適配層真填充）', async () => {
    const scene = newScene();
    const importer: MeshImporter = (_url, s) => {
      MeshBuilder.CreateBox('bone.humerus', { size: 1 }, s); // node 名＝anatomyId、無 metadata
      return Promise.resolve();
    };
    await createGltfMeshLoader('/models/anatomyV1.glb', importer)(scene);
    expect(scene.getMeshByName('bone.humerus')).toBeTruthy();
  });

  it('importer 拒絕 → loader 拒絕（錯誤傳播）', async () => {
    const scene = newScene();
    const importer: MeshImporter = () => Promise.reject(new Error('load fail'));
    await expect(createGltfMeshLoader('/x.glb', importer)(scene)).rejects.toThrow('load fail');
  });

  it('建立 loader 即配置自帶 Draco decoder（不走 CDN；解 KHR_draco_mesh_compression 壓縮 glb）', () => {
    createGltfMeshLoader('/models/anatomyV1.glb', () => Promise.resolve());
    expect(DracoDecoder.DefaultConfiguration.wasmBinaryUrl).toBe('/draco/draco_decoder_gltf.wasm');
    expect(DracoDecoder.DefaultConfiguration.wasmUrl).toBe('/draco/draco_wasm_wrapper_gltf.js');
  });

  it('成功載入經 actionLogger 埋點（humanModel／assetLoad＋assetLoaded／url；07 line 16）', async () => {
    const logSpy = vi.spyOn(actionLogger, 'log');
    const scene = newScene();
    await createGltfMeshLoader('/models/anatomyV1.glb', () => Promise.resolve())(scene);
    expect(logSpy).toHaveBeenCalledWith('humanModel', 'assetLoad', '/models/anatomyV1.glb');
    expect(logSpy).toHaveBeenCalledWith('humanModel', 'assetLoaded', '/models/anatomyV1.glb');
    logSpy.mockRestore();
  });

  it('載入失敗經 actionLogger 記 error 並傳播（assetLoadError／url）', async () => {
    const errorSpy = vi.spyOn(actionLogger, 'error');
    const scene = newScene();
    const importer: MeshImporter = () => Promise.reject(new Error('load fail'));
    await expect(createGltfMeshLoader('/models/anatomyV1.glb', importer)(scene)).rejects.toThrow(
      'load fail',
    );
    expect(errorSpy).toHaveBeenCalledWith('humanModel', 'assetLoadError', '/models/anatomyV1.glb');
    errorSpy.mockRestore();
  });
});
