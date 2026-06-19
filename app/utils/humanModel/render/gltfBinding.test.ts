import { Bone, MeshBuilder, NullEngine, Skeleton } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { anatomyEntities } from '@ptapp/definitions';
import { createModelScene } from './sceneCore';
import { anatomyIdOfMesh } from './scenePicking';
import { applyMeshVisibility } from './sceneLayers';
import { bindAnatomyMetadata } from './gltfBinding';

describe('gltfBinding（glTF mesh→anatomyId metadata 橋接；04 §4.6.2）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function sceneWithNamed(names: readonly string[]) {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    for (const n of names) MeshBuilder.CreateBox(n, { size: 1 }, scene);
    return scene;
  }

  it('依 node 名反查設 metadata（anatomyId＋entityType）', () => {
    const scene = sceneWithNamed(['bone.humerus']);
    bindAnatomyMetadata(scene);
    const mesh = scene.getMeshByName('bone.humerus');
    expect(mesh?.metadata).toMatchObject({ anatomyId: 'bone.humerus', entityType: 'bone' });
  });

  it('muscle 補 layer', () => {
    const scene = sceneWithNamed(['muscle.bicepsBrachii']);
    bindAnatomyMetadata(scene);
    const meta = scene.getMeshByName('muscle.bicepsBrachii')?.metadata as { layer?: string };
    expect(meta.layer).toBe('superficial'); // MuscleLayer 原值（與 buildPlaceholderBody 一致）
  });

  it('未知 node 名（如 __root__）略過、metadata 不設', () => {
    const scene = sceneWithNamed(['__root__', 'bone.humerus']);
    bindAnatomyMetadata(scene);
    expect(scene.getMeshByName('__root__')?.metadata ?? null).toBeNull();
  });

  it('回傳已綁定 anatomyId 陣列', () => {
    const scene = sceneWithNamed(['bone.humerus', 'muscle.brachialis', '__root__']);
    const bound = bindAnatomyMetadata(scene);
    expect(bound.sort()).toEqual(['bone.humerus', 'muscle.brachialis']);
  });

  it('綁定後既有邊界可用：anatomyIdOfMesh／applyMeshVisibility', () => {
    const scene = sceneWithNamed(['bone.humerus', 'muscle.brachialis']);
    bindAnatomyMetadata(scene);
    expect(anatomyIdOfMesh(scene.getMeshByName('bone.humerus'))).toBe('bone.humerus');
    applyMeshVisibility(
      scene,
      {
        bone: false,
        deepMuscle: true,
        superficialMuscle: false,
        nerve: false,
        passiveStructure: false,
      },
      new Set(),
    );
    expect(scene.getMeshByName('bone.humerus')?.isEnabled(false)).toBe(false); // bone 關
    expect(scene.getMeshByName('muscle.brachialis')?.isEnabled(false)).toBe(true); // deep 開
  });

  // —— 雙側（bilateral）：同名成對部位經匯出改名後 Blender 強制唯一性 → 後者帶 .NNN 尾碼。
  //    anatomyId 側別無關（§4.6.2、06 §6.5），去尾碼還原綁定、兩側皆參與 picking/layers/highlight。
  it('雙側鏡像 mesh：Blender 唯一性尾碼 .001 去除後皆綁定至同一側別無關 anatomyId', () => {
    const scene = sceneWithNamed(['bone.humerus', 'bone.humerus.001']);
    const bound = bindAnatomyMetadata(scene);
    expect(scene.getMeshByName('bone.humerus')?.metadata).toMatchObject({
      anatomyId: 'bone.humerus',
      entityType: 'bone',
    });
    expect(scene.getMeshByName('bone.humerus.001')?.metadata).toMatchObject({
      anatomyId: 'bone.humerus',
      entityType: 'bone',
    });
    expect(bound).toEqual(['bone.humerus', 'bone.humerus']); // 兩 mesh 皆綁
  });

  it('去尾碼還原後既有邊界可用：.NNN mesh 之 anatomyIdOfMesh 回側別無關 anatomyId', () => {
    const scene = sceneWithNamed(['bone.humerus.001']);
    bindAnatomyMetadata(scene);
    expect(anatomyIdOfMesh(scene.getMeshByName('bone.humerus.001'))).toBe('bone.humerus');
  });

  it('僅去 Blender 唯一性數字尾碼：非數字尾碼之未知 node 不誤綁', () => {
    const scene = sceneWithNamed(['bone.humerus.foo']);
    bindAnatomyMetadata(scene);
    expect(scene.getMeshByName('bone.humerus.foo')?.metadata ?? null).toBeNull();
  });

  it('rigged-shaped 場景：skinned mesh 仍綁定、armature 不被誤綁、scene.skeletons 有值', () => {
    // 建立場景並使用前兩個解剖實體的 anatomyId 建 mesh
    const ids = anatomyEntities.slice(0, 2).map((e) => e.anatomyId);
    const scene = sceneWithNamed(ids);

    // armature：bone 名刻意非 anatomyId
    const skel = new Skeleton('rig', 'rig', scene);
    new Bone('upperleg01.L', skel, null);
    new Bone('spine01', skel, null);

    const bound = bindAnatomyMetadata(scene);

    // 場景有 skeleton
    expect(scene.skeletons.length).toBe(1);

    // mesh anatomyId 皆被綁定
    for (const id of ids) expect(bound).toContain(id);

    // armature bone 名未被當部位綁定（bone 非 mesh，不在 scene.meshes）
    expect(bound).not.toContain('upperleg01.L');
    expect(bound).not.toContain('spine01');
  });
});
