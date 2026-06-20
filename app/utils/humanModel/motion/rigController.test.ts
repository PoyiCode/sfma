import { Bone, NullEngine, Quaternion, Skeleton, Space } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { anatomyEntities } from '@ptapp/definitions';
import { buildPlaceholderBody, createModelScene } from '../render/sceneCore';
import { NEUTRAL_POSE, setJointAngle } from './motionPose';
import { resolveBoneName } from './boneRig';
import { makeBoneRigFixture } from './boneRigFixture';
import { createRigController } from './rigController';

describe('rigController（依 motionMode/pose 建/套/拆 rig）', () => {
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

  it('motionMode=false 不建 rig（無 pivot 節點）', () => {
    const scene = freshScene();
    const ctrl = createRigController(scene);
    ctrl.sync(false, NEUTRAL_POSE);
    expect(scene.transformNodes.some((n) => n.name.startsWith('pivot:'))).toBe(false);
    ctrl.dispose();
  });

  it('motionMode=true 建 rig 並套 pose；關閉拆 rig', () => {
    const scene = freshScene();
    const ctrl = createRigController(scene);
    ctrl.sync(true, setJointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension', 45));
    expect(scene.transformNodes.some((n) => n.name.startsWith('pivot:'))).toBe(true);
    ctrl.sync(false, NEUTRAL_POSE);
    expect(scene.transformNodes.some((n) => n.name.startsWith('pivot:'))).toBe(false);
    ctrl.dispose();
  });

  it('有可驅動骨架→走 bone 路徑（不建 pivot: 節點、驅動 bone 旋轉）', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    makeBoneRigFixture(scene);
    const ctrl = createRigController(scene);
    ctrl.sync(true, setJointAngle(NEUTRAL_POSE, 'joint.knee#R', 'flexionExtension', 90));
    // bone 路徑不 reparent、不建 pivot: TransformNode
    expect(scene.transformNodes.some((n) => n.name.startsWith('pivot:'))).toBe(false);
    // bone 已被驅動（非 identity）
    const bone = scene.skeletons[0]!.bones.find(
      (b) => b.name === resolveBoneName('lowerleg01', '#R'),
    )!;
    const isIdentity =
      Math.abs(
        Math.abs(Quaternion.Dot(bone.getRotationQuaternion(Space.LOCAL), Quaternion.Identity())) -
          1,
      ) < 1e-4;
    expect(isIdentity).toBe(false);
    // getPivot 回關節中心 TransformNode（gizmo 啟用、bone-path）
    expect(ctrl.getPivot('joint.knee', '#R')).not.toBeNull();
    ctrl.dispose();
  });

  it('有骨架但 bone 名不符 BONE_RIG_MAP→退剛性路', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    // 建一具骨架但 bone 名與 BONE_RIG_MAP 無一相符
    const skel = new Skeleton('x', 'x', scene);
    new Bone('totally.unrelated', skel, null);
    buildPlaceholderBody(scene, anatomyEntities);
    const ctrl = createRigController(scene);
    ctrl.sync(true, NEUTRAL_POSE);
    expect(scene.transformNodes.some((n) => n.name.startsWith('pivot:'))).toBe(true); // 剛性路
    ctrl.dispose();
  });
});
