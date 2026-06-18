import { NullEngine } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { anatomyEntities } from '@ptapp/definitions';
import { DEFAULT_LAYER_VISIBILITY } from '../anatomy/anatomyLayers';
import { buildPlaceholderBody, createModelScene, findMeshByAnatomyId } from './sceneCore';
import { applyMeshVisibility } from './sceneLayers';

const ALL_ON = {
  bone: true,
  deepMuscle: true,
  superficialMuscle: true,
  nerve: true,
  passiveStructure: true,
} as const;
const NONE = new Set<string>();

describe('applyMeshVisibility（分層 × 單一隱藏合成可見性）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function freshScene() {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    buildPlaceholderBody(scene, anatomyEntities);
    return scene;
  }

  it('分層狀態決定各型 mesh（無隱藏）', () => {
    const scene = freshScene();
    applyMeshVisibility(
      scene,
      {
        bone: true,
        deepMuscle: false,
        superficialMuscle: true,
        nerve: false,
        passiveStructure: false,
      },
      NONE,
    );
    expect(findMeshByAnatomyId(scene, 'bone.humerus')?.isEnabled(false)).toBe(true);
    expect(findMeshByAnatomyId(scene, 'muscle.brachialis')?.isEnabled(false)).toBe(false); // deep
    expect(findMeshByAnatomyId(scene, 'muscle.bicepsBrachii')?.isEnabled(false)).toBe(true); // superficial
    expect(findMeshByAnatomyId(scene, 'nerve.radial')?.isEnabled(false)).toBe(false);
  });

  it('joint 不受分層開關影響（全關＋無隱藏仍顯）', () => {
    const scene = freshScene();
    applyMeshVisibility(
      scene,
      {
        bone: false,
        deepMuscle: false,
        superficialMuscle: false,
        nerve: false,
        passiveStructure: false,
      },
      NONE,
    );
    expect(findMeshByAnatomyId(scene, 'joint.elbow')?.isEnabled(false)).toBe(true);
  });

  it('被動結構分層獨立控制韌帶／椎間盤（脫離骨骼層；解3d資產 52）', () => {
    const scene = freshScene();
    // passiveStructure 關、其餘全開：韌帶／椎間盤不顯，但骨骼仍顯（證已脫離骨骼層）。
    applyMeshVisibility(
      scene,
      {
        bone: true,
        deepMuscle: true,
        superficialMuscle: true,
        nerve: true,
        passiveStructure: false,
      },
      NONE,
    );
    expect(findMeshByAnatomyId(scene, 'ligament.anteriorCruciateLigament')?.isEnabled(false)).toBe(
      false,
    );
    expect(findMeshByAnatomyId(scene, 'disc.l5S1')?.isEnabled(false)).toBe(false);
    expect(findMeshByAnatomyId(scene, 'bone.humerus')?.isEnabled(false)).toBe(true);
    // passiveStructure 開：韌帶／椎間盤顯。
    applyMeshVisibility(scene, ALL_ON, NONE);
    expect(findMeshByAnatomyId(scene, 'ligament.anteriorCruciateLigament')?.isEnabled(false)).toBe(
      true,
    );
    expect(findMeshByAnatomyId(scene, 'disc.l5S1')?.isEnabled(false)).toBe(true);
  });

  it('隱藏覆寫分層：layer 開但在 hiddenIds → 不顯', () => {
    const scene = freshScene();
    applyMeshVisibility(scene, ALL_ON, new Set(['muscle.bicepsBrachii']));
    expect(findMeshByAnatomyId(scene, 'muscle.bicepsBrachii')?.isEnabled(false)).toBe(false);
    expect(findMeshByAnatomyId(scene, 'muscle.tricepsBrachii')?.isEnabled(false)).toBe(true);
  });

  it('單一隱藏適用 joint（非顯示分層亦可隱藏）', () => {
    const scene = freshScene();
    applyMeshVisibility(scene, ALL_ON, new Set(['joint.elbow']));
    expect(findMeshByAnatomyId(scene, 'joint.elbow')?.isEnabled(false)).toBe(false);
  });

  it('自隱藏移除後恢復顯示（再套用空集）', () => {
    const scene = freshScene();
    applyMeshVisibility(scene, DEFAULT_LAYER_VISIBILITY, new Set(['bone.humerus']));
    expect(findMeshByAnatomyId(scene, 'bone.humerus')?.isEnabled(false)).toBe(false);
    applyMeshVisibility(scene, DEFAULT_LAYER_VISIBILITY, NONE);
    expect(findMeshByAnatomyId(scene, 'bone.humerus')?.isEnabled(false)).toBe(true);
  });
});
