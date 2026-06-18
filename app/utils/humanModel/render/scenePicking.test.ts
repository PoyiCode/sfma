import { MeshBuilder, NullEngine, PickingInfo } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createModelScene } from './sceneCore';
import { anatomyIdFromPick, anatomyIdOfMesh, isBackgroundPick } from './scenePicking';

describe('scenePicking（3D 部位點選對應）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });

  it('anatomyIdOfMesh 讀 metadata.anatomyId', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    const mesh = MeshBuilder.CreateBox('muscle.bicepsBrachii', { size: 1 }, scene);
    mesh.metadata = { anatomyId: 'muscle.bicepsBrachii', entityType: 'muscle' };
    expect(anatomyIdOfMesh(mesh)).toBe('muscle.bicepsBrachii');
  });

  it('anatomyIdOfMesh 無 metadata／null → null', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    const mesh = MeshBuilder.CreateBox('bare', { size: 1 }, scene);
    expect(anatomyIdOfMesh(mesh)).toBeNull();
    expect(anatomyIdOfMesh(null)).toBeNull();
  });

  it('anatomyIdFromPick 命中帶 anatomyId 的 mesh → anatomyId', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    const mesh = MeshBuilder.CreateBox('joint.elbow', { size: 1 }, scene);
    mesh.metadata = { anatomyId: 'joint.elbow', entityType: 'joint' };
    const pick = new PickingInfo();
    pick.hit = true;
    pick.pickedMesh = mesh;
    expect(anatomyIdFromPick(pick)).toBe('joint.elbow');
  });

  it('anatomyIdFromPick 未命中／null → null', () => {
    const miss = new PickingInfo();
    miss.hit = false;
    expect(anatomyIdFromPick(miss)).toBeNull();
    expect(anatomyIdFromPick(null)).toBeNull();
  });

  it('anatomyIdFromPick 命中無 metadata 的 mesh → null', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    const mesh = MeshBuilder.CreateBox('bare', { size: 1 }, scene);
    const pick = new PickingInfo();
    pick.hit = true;
    pick.pickedMesh = mesh;
    expect(anatomyIdFromPick(pick)).toBeNull();
  });

  it('isBackgroundPick：未命中／null → true、命中 → false（§3.3.8 點空白）', () => {
    const miss = new PickingInfo();
    miss.hit = false;
    expect(isBackgroundPick(miss)).toBe(true);
    expect(isBackgroundPick(null)).toBe(true);
    const hit = new PickingInfo();
    hit.hit = true;
    expect(isBackgroundPick(hit)).toBe(false);
  });
});
