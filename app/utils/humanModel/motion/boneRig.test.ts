import { NullEngine, Quaternion, Space, Vector3 } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createModelScene } from '../render/sceneCore';
import { NEUTRAL_POSE, setJointAngle } from './motionPose';
import { BONE_RIG_MAP } from './boneRigMap';
import { buildBoneRig, hasDrivableSkeleton, resolveBoneName } from './boneRig';
import { makeBoneRigFixture } from './boneRigFixture';

const DEG2RAD = Math.PI / 180;

// 兩四元數是否表示同一旋轉（含 q≡−q）。
function sameRotation(a: Quaternion, b: Quaternion, eps = 1e-4): boolean {
  return Math.abs(Math.abs(Quaternion.Dot(a, b)) - 1) < eps;
}

describe('boneRig（骨骼驅動，NullEngine）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function freshScene() {
    engine = new NullEngine();
    return createModelScene(engine);
  }
  function boneByName(scene: ReturnType<typeof freshScene>, name: string) {
    return scene.skeletons[0]!.bones.find((b) => b.name === name)!;
  }

  it('resolveBoneName：雙側補 .L/.R、單側用裸名', () => {
    expect(resolveBoneName('upperleg01', '#L')).toBe('upperleg01.L');
    expect(resolveBoneName('upperleg01', '#R')).toBe('upperleg01.R');
    expect(resolveBoneName('spine01', null)).toBe('spine01');
  });

  it('hasDrivableSkeleton：有 fixture 骨架→true、空場景→false', () => {
    const scene = freshScene();
    expect(hasDrivableSkeleton(scene)).toBe(false);
    makeBoneRigFixture(scene);
    expect(hasDrivableSkeleton(scene)).toBe(true);
  });

  it('applyPose：膝屈曲套至對應側 bone 之區域旋轉（正確軸/正負）', () => {
    const scene = freshScene();
    makeBoneRigFixture(scene);
    const rig = buildBoneRig(scene);
    rig.applyPose(setJointAngle(NEUTRAL_POSE, 'joint.knee#R', 'flexionExtension', 90));
    const m = BONE_RIG_MAP['joint.knee']!.dofs.flexionExtension!;
    const expected = Quaternion.RotationAxis(
      new Vector3(m.localAxis[0], m.localAxis[1], m.localAxis[2]),
      90 * m.sign * DEG2RAD,
    );
    const bone = boneByName(scene, resolveBoneName('lowerleg01', '#R'));
    expect(sameRotation(bone.getRotationQuaternion(Space.LOCAL), expected)).toBe(true);
    // 另一側未驅動→仍為 rest（identity）
    const other = boneByName(scene, resolveBoneName('lowerleg01', '#L'));
    expect(sameRotation(other.getRotationQuaternion(Space.LOCAL), Quaternion.Identity())).toBe(
      true,
    );
  });

  it('applyPose：同 bone 多 DOF 依 dofs 順序相乘', () => {
    const scene = freshScene();
    makeBoneRigFixture(scene);
    const rig = buildBoneRig(scene);
    let pose = setJointAngle(NEUTRAL_POSE, 'joint.hip#R', 'flexionExtension', 30);
    pose = setJointAngle(pose, 'joint.hip#R', 'abductionAdduction', 20);
    rig.applyPose(pose);
    const d = BONE_RIG_MAP['joint.hip']!.dofs;
    const flex = Quaternion.RotationAxis(
      new Vector3(...d.flexionExtension!.localAxis),
      30 * d.flexionExtension!.sign * DEG2RAD,
    );
    const abd = Quaternion.RotationAxis(
      new Vector3(...d.abductionAdduction!.localAxis),
      20 * d.abductionAdduction!.sign * DEG2RAD,
    );
    // rest(identity) ∘ flex ∘ abd，順序＝Object.entries(dofs) 插入序
    const expected = Quaternion.Identity().multiply(flex).multiply(abd);
    const bone = boneByName(scene, resolveBoneName('upperleg01', '#R'));
    expect(sameRotation(bone.getRotationQuaternion(Space.LOCAL), expected)).toBe(true);
  });

  it('dispose：受驅動 bone 還原 rest（identity）', () => {
    const scene = freshScene();
    makeBoneRigFixture(scene);
    const rig = buildBoneRig(scene);
    rig.applyPose(setJointAngle(NEUTRAL_POSE, 'joint.knee#R', 'flexionExtension', 90));
    rig.dispose();
    const bone = boneByName(scene, resolveBoneName('lowerleg01', '#R'));
    expect(sameRotation(bone.getRotationQuaternion(Space.LOCAL), Quaternion.Identity())).toBe(true);
  });

  it('getPivot 回 null、pivotKeys 為空（gizmo 擺位延後）', () => {
    const scene = freshScene();
    makeBoneRigFixture(scene);
    const rig = buildBoneRig(scene);
    expect(rig.getPivot('joint.knee', '#R')).toBeNull();
    expect(rig.pivotKeys).toEqual([]);
  });

  it('解析不到之關節安全跳過（fixture 無踝/肩/頸 bone→無錯）', () => {
    const scene = freshScene();
    makeBoneRigFixture(scene);
    const rig = buildBoneRig(scene);
    expect(() =>
      rig.applyPose(setJointAngle(NEUTRAL_POSE, 'joint.ankle#R', 'plantarDorsiflexion', 20)),
    ).not.toThrow();
  });

  it('glTF 骨架（bone 有 linkedTransformNode）→ applyPose 驅動 node 區域旋轉、dispose 還原（非 bone 直驅）', () => {
    const scene = freshScene();
    makeBoneRigFixture(scene, { linkNodes: true });
    const rig = buildBoneRig(scene);
    rig.applyPose(setJointAngle(NEUTRAL_POSE, 'joint.knee#R', 'flexionExtension', 90));
    const m = BONE_RIG_MAP['joint.knee']!.dofs.flexionExtension!;
    const expected = Quaternion.RotationAxis(
      new Vector3(m.localAxis[0], m.localAxis[1], m.localAxis[2]),
      90 * m.sign * DEG2RAD,
    );
    const node = boneByName(scene, resolveBoneName('lowerleg01', '#R')).getTransformNode();
    expect(node).not.toBeNull();
    expect(sameRotation(node!.rotationQuaternion!, expected)).toBe(true);
    rig.dispose();
    expect(sameRotation(node!.rotationQuaternion!, Quaternion.Identity())).toBe(true);
  });

  it('buildBoneRig 對 skinned mesh 設 alwaysSelectAsActiveMesh（防視錐裁切）', () => {
    const scene = freshScene();
    const { mesh } = makeBoneRigFixture(scene);
    expect(mesh.alwaysSelectAsActiveMesh).toBe(false);
    buildBoneRig(scene);
    expect(mesh.alwaysSelectAsActiveMesh).toBe(true);
  });
});
