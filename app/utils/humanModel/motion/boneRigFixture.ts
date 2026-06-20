// 測試用骨架 fixture（僅由 *.test.ts import）：建一具含髖/膝雙側＋脊椎單側 bone、
// identity rest 之 Skeleton 並附 skinned mesh，使 scene.skeletons 填充、bone 名比照
// resolveBoneName 慣例。供 boneRig／rigController 測試以已知朝向確定驗證。
import {
  Bone,
  Matrix,
  Mesh,
  Quaternion,
  type Scene,
  Skeleton,
  TransformNode,
} from '@babylonjs/core';
import { BONE_RIG_MAP } from './boneRigMap';
import { resolveBoneName } from './boneRig';

// opts.linkNodes：模擬 glTF 匯入——每根 bone 經 linkedTransformNode 驅動（真資產之情形），
// 供測試覆蓋 boneRig 之 node 驅動路徑（合成 fixture 預設無 node、走 bone 直驅路徑）。
export function makeBoneRigFixture(
  scene: Scene,
  opts: { linkNodes?: boolean } = {},
): { skeleton: Skeleton; mesh: Mesh } {
  const skeleton = new Skeleton('rig', 'rig', scene);
  const names = [
    resolveBoneName(BONE_RIG_MAP['joint.hip']!.bone, '#L'),
    resolveBoneName(BONE_RIG_MAP['joint.hip']!.bone, '#R'),
    resolveBoneName(BONE_RIG_MAP['joint.knee']!.bone, '#L'),
    resolveBoneName(BONE_RIG_MAP['joint.knee']!.bone, '#R'),
    resolveBoneName(BONE_RIG_MAP['joint.glenohumeral']!.bone, '#L'),
    resolveBoneName(BONE_RIG_MAP['joint.glenohumeral']!.bone, '#R'),
    resolveBoneName(BONE_RIG_MAP['joint.spine']!.bone, null),
  ];
  for (const name of names) {
    const bone = new Bone(name, skeleton, null, Matrix.Identity());
    if (opts.linkNodes) {
      const node = new TransformNode(`node:${name}`, scene);
      node.rotationQuaternion = Quaternion.Identity();
      bone.linkTransformNode(node);
    }
  }
  const mesh = new Mesh('skinned', scene);
  mesh.skeleton = skeleton;
  return { skeleton, mesh };
}
