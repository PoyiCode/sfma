import { MeshBuilder, NullEngine } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createModelScene } from './sceneCore';
import {
  createGltfScenePopulator,
  createGltfScenePopulatorWithFallback,
  placeholderScenePopulator,
  type SceneMeshLoader,
} from './scenePopulator';

describe('scenePopulator（場景填充策略；04 §4.3.1/§4.6.4）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function newScene() {
    engine = new NullEngine();
    return createModelScene(engine);
  }

  it('placeholderScenePopulator：同步建佔位身體（含 anatomyId metadata）', () => {
    const scene = newScene();
    const ret = placeholderScenePopulator(scene);
    expect(ret).toBeUndefined(); // 同步、無 Promise
    const withMeta = scene.meshes.filter(
      (m) => (m.metadata as { anatomyId?: string } | null)?.anatomyId,
    );
    expect(withMeta.length).toBeGreaterThan(0);
  });

  it('createGltfScenePopulator：先載入幾何、後綁定 metadata（順序）', async () => {
    const scene = newScene();
    const order: string[] = [];
    const load: SceneMeshLoader = (s) => {
      order.push('load');
      MeshBuilder.CreateBox('bone.humerus', { size: 1 }, s); // glTF mesh：node 名＝anatomyId、無 metadata
      return Promise.resolve();
    };
    const ret = createGltfScenePopulator(load)(scene);
    expect(ret).toBeInstanceOf(Promise);
    await ret;
    order.push('after');
    expect(order).toEqual(['load', 'after']);
    expect(scene.getMeshByName('bone.humerus')?.metadata).toMatchObject({
      anatomyId: 'bone.humerus',
      entityType: 'bone',
    });
  });

  it('createGltfScenePopulator：未知 node 名（__root__）不綁 metadata', async () => {
    const scene = newScene();
    const load: SceneMeshLoader = (s) => {
      MeshBuilder.CreateBox('__root__', { size: 1 }, s);
      return Promise.resolve();
    };
    await createGltfScenePopulator(load)(scene);
    expect(scene.getMeshByName('__root__')?.metadata ?? null).toBeNull();
  });

  it('createGltfScenePopulator：await 載入完成才綁定（綁定不早於 load resolve）', async () => {
    const scene = newScene();
    let loaded = false;
    const load: SceneMeshLoader = async (s) => {
      await Promise.resolve();
      MeshBuilder.CreateBox('muscle.brachialis', { size: 1 }, s);
      loaded = true;
    };
    const p = createGltfScenePopulator(load)(scene);
    expect(loaded).toBe(false); // 尚在載入、尚未綁定
    await p;
    expect(loaded).toBe(true);
    expect(scene.getMeshByName('muscle.brachialis')?.metadata).toMatchObject({
      anatomyId: 'muscle.brachialis',
    });
  });

  it('createGltfScenePopulatorWithFallback：載入成功→glTF 路徑（綁定 metadata、不跑後備）', async () => {
    const scene = newScene();
    let fallbackRan = false;
    const load: SceneMeshLoader = (s) => {
      MeshBuilder.CreateBox('bone.humerus', { size: 1 }, s);
      return Promise.resolve();
    };
    const fallback = (s: typeof scene) => {
      fallbackRan = true;
      MeshBuilder.CreateBox('__fallback__', { size: 1 }, s);
    };
    await createGltfScenePopulatorWithFallback(load, fallback)(scene);
    expect(fallbackRan).toBe(false);
    expect(scene.getMeshByName('bone.humerus')?.metadata).toMatchObject({
      anatomyId: 'bone.humerus',
    });
    expect(scene.getMeshByName('__fallback__') ?? null).toBeNull();
  });

  it('createGltfScenePopulatorWithFallback：載入失敗（glb 缺/404）→ 退回後備佔位身體', async () => {
    const scene = newScene();
    const load: SceneMeshLoader = () => Promise.reject(new Error('404 glb 缺'));
    await createGltfScenePopulatorWithFallback(load)(scene); // 預設後備＝placeholderScenePopulator
    const withMeta = scene.meshes.filter(
      (m) => (m.metadata as { anatomyId?: string } | null)?.anatomyId,
    );
    expect(withMeta.length).toBeGreaterThan(0); // 佔位身體已建（不因載入失敗而空場景）
  });
});
