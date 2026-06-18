import { NullEngine } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { anatomyEntities } from '@ptapp/definitions';
import {
  addDefaultCamera,
  addDefaultLight,
  buildPlaceholderBody,
  createModelScene,
  findMeshByAnatomyId,
} from './sceneCore';

describe('sceneCore（Babylon 場景核心）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });

  it('createModelScene 以注入 engine 建 Scene', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    expect(scene.getEngine()).toBe(engine);
  });

  it('buildPlaceholderBody 逐實體建 mesh、name＝anatomyId、metadata 帶型別與分層（佔位側別無關）', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    buildPlaceholderBody(scene, anatomyEntities);
    for (const entity of anatomyEntities) {
      const mesh = findMeshByAnatomyId(scene, entity.anatomyId);
      expect(mesh).not.toBeNull();
      expect(mesh?.name).toBe(entity.anatomyId);
      expect(mesh?.metadata).toMatchObject({
        anatomyId: entity.anatomyId,
        entityType: entity.type,
      });
    }
  });

  it('findMeshByAnatomyId 未知 id 回 null', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    buildPlaceholderBody(scene, anatomyEntities);
    expect(findMeshByAnatomyId(scene, 'muscle.doesNotExist')).toBeNull();
  });

  it('addDefaultCamera 建 ArcRotateCamera 並設為 activeCamera', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    const camera = addDefaultCamera(scene);
    expect(camera.getClassName()).toBe('ArcRotateCamera');
    expect(scene.activeCamera).toBe(camera);
  });

  it('addDefaultCamera 設拉進/拉遠半徑極限（防過度拉進穿入模型顯示背面）', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    const camera = addDefaultCamera(scene);
    const lower = camera.lowerRadiusLimit ?? 0;
    const upper = camera.upperRadiusLimit ?? Infinity;
    expect(lower).toBeGreaterThan(0);
    expect(upper).toBeGreaterThan(lower);
    // 預設取景 radius 須落在極限內（極限不得卡死預設視角）
    expect(camera.radius).toBeGreaterThanOrEqual(lower);
    expect(camera.radius).toBeLessThanOrEqual(upper);
  });

  it('addDefaultCamera 關閉移動/轉動/平移慣性（放開即停）', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    const camera = addDefaultCamera(scene);
    expect(camera.inertia).toBe(0);
    expect(camera.panningInertia).toBe(0);
  });

  it('addDefaultCamera 旋轉靈敏度高於預設（angularSensibility 125＝Babylon 預設 1000 之 1/8＝8 倍靈敏、越小越靈敏）', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    const camera = addDefaultCamera(scene);
    expect(camera.angularSensibilityX).toBe(125);
    expect(camera.angularSensibilityY).toBe(125);
  });

  it('addDefaultCamera 自適應縮放：wheel/pinch 用 deltaPercentage（∝ 距離→近小遠大、平滑無斷崖、取代固定 wheelPrecision）', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    const camera = addDefaultCamera(scene);
    expect(camera.wheelDeltaPercentage).toBe(0.05);
    expect(camera.pinchDeltaPercentage).toBe(0.05);
  });

  it('addDefaultLight 建 HemisphericLight', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    const light = addDefaultLight(scene);
    expect(light.getClassName()).toBe('HemisphericLight');
    expect(scene.lights).toContain(light);
  });

  it('buildPlaceholderBody 為等冪：重建不重複堆疊 mesh', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    buildPlaceholderBody(scene, anatomyEntities);
    buildPlaceholderBody(scene, anatomyEntities);
    const names = scene.meshes.map((m) => m.name).filter((n) => n.includes('.'));
    expect(new Set(names).size).toBe(names.length);
  });
});
