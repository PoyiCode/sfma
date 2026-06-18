import { NullEngine } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { addDefaultCamera, createModelScene } from './sceneCore';
import {
  applyCameraFraming,
  applyCameraView,
  CAMERA_VIEW_KEYS,
  CAMERA_VIEW_PRESETS,
  DEFAULT_CAMERA_VIEW,
  type CameraFraming,
} from './sceneCamera';

describe('sceneCamera（預設視角／重置）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function freshCamera() {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    return addDefaultCamera(scene);
  }

  it('四向預設鍵齊備、皆有 alpha/beta/radius', () => {
    expect(CAMERA_VIEW_KEYS).toEqual(['front', 'back', 'left', 'right']);
    for (const key of CAMERA_VIEW_KEYS) {
      const p = CAMERA_VIEW_PRESETS[key];
      expect(typeof p.alpha).toBe('number');
      expect(typeof p.beta).toBe('number');
      expect(p.radius).toBeGreaterThan(0);
    }
  });

  it('預設視角為 front', () => {
    expect(DEFAULT_CAMERA_VIEW).toBe('front');
  });

  it('四向 alpha 兩兩相異（90° 等距、beta/radius 一致）', () => {
    const alphas = CAMERA_VIEW_KEYS.map((k) => CAMERA_VIEW_PRESETS[k].alpha);
    expect(new Set(alphas).size).toBe(CAMERA_VIEW_KEYS.length);
    const betas = new Set(CAMERA_VIEW_KEYS.map((k) => CAMERA_VIEW_PRESETS[k].beta));
    const radii = new Set(CAMERA_VIEW_KEYS.map((k) => CAMERA_VIEW_PRESETS[k].radius));
    expect(betas.size).toBe(1);
    expect(radii.size).toBe(1);
  });

  it('applyCameraView 設 camera 之 alpha/beta/radius', () => {
    const camera = freshCamera();
    applyCameraView(camera, 'back');
    expect(camera.alpha).toBe(CAMERA_VIEW_PRESETS.back.alpha);
    expect(camera.beta).toBe(CAMERA_VIEW_PRESETS.back.beta);
    expect(camera.radius).toBe(CAMERA_VIEW_PRESETS.back.radius);
  });

  it('重置＝套用 DEFAULT_CAMERA_VIEW（自他向恢復預設取景）', () => {
    const camera = freshCamera();
    applyCameraView(camera, 'left');
    applyCameraView(camera, DEFAULT_CAMERA_VIEW);
    expect(camera.alpha).toBe(CAMERA_VIEW_PRESETS.front.alpha);
    expect(camera.beta).toBe(CAMERA_VIEW_PRESETS.front.beta);
    expect(camera.radius).toBe(CAMERA_VIEW_PRESETS.front.radius);
  });

  const FRAMING: CameraFraming = {
    target: { x: 0.1, y: 0.9, z: -0.2 },
    radius: 3.04,
    lower: 0.152,
    upper: 4.256,
    minZ: 0.0304,
  };

  it('framing 提供時：alpha/beta 仍由 preset，target/radius/limits/minZ 取自 framing', () => {
    const camera = freshCamera();
    applyCameraView(camera, 'back', FRAMING);
    // 方向（alpha/beta）恆由 preset 決定。
    expect(camera.alpha).toBe(CAMERA_VIEW_PRESETS.back.alpha);
    expect(camera.beta).toBe(CAMERA_VIEW_PRESETS.back.beta);
    // 取景數值取自 framing（非 preset 固定 radius 4）。
    expect(camera.radius).toBeCloseTo(FRAMING.radius, 6);
    expect(camera.target.x).toBeCloseTo(FRAMING.target.x, 6);
    expect(camera.target.y).toBeCloseTo(FRAMING.target.y, 6);
    expect(camera.target.z).toBeCloseTo(FRAMING.target.z, 6);
    expect(camera.lowerRadiusLimit).toBeCloseTo(FRAMING.lower, 6);
    expect(camera.upperRadiusLimit).toBeCloseTo(FRAMING.upper, 6);
    expect(camera.minZ).toBeCloseTo(FRAMING.minZ, 6);
  });

  it('framing 未提供時：沿用 preset radius（佔位無模型時後備）', () => {
    const camera = freshCamera();
    applyCameraView(camera, 'front');
    expect(camera.radius).toBe(CAMERA_VIEW_PRESETS.front.radius);
  });

  it('applyCameraFraming：只套 target/radius/limits/minZ，保留 alpha/beta（resize re-fit）', () => {
    const camera = freshCamera();
    // 先以 back 視角＋環繞（模擬使用者旋轉）建立 alpha/beta 基準
    applyCameraView(camera, 'back');
    camera.alpha = 0.123; // 使用者環繞
    const beta = camera.beta;
    // 只套框取：取景數值更新、alpha/beta 不動
    applyCameraFraming(camera, FRAMING);
    expect(camera.alpha).toBeCloseTo(0.123, 6); // 旋轉保留
    expect(camera.beta).toBeCloseTo(beta, 6);
    expect(camera.radius).toBeCloseTo(FRAMING.radius, 6);
    expect(camera.target.x).toBeCloseTo(FRAMING.target.x, 6);
    expect(camera.target.y).toBeCloseTo(FRAMING.target.y, 6);
    expect(camera.target.z).toBeCloseTo(FRAMING.target.z, 6);
    expect(camera.lowerRadiusLimit).toBeCloseTo(FRAMING.lower, 6);
    expect(camera.upperRadiusLimit).toBeCloseTo(FRAMING.upper, 6);
    expect(camera.minZ).toBeCloseTo(FRAMING.minZ, 6);
  });
});
