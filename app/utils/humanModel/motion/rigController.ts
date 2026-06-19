// rig 生命週期控制器（供 Model3DView effect 與測試共用）：依 motionMode/pose 冪等地建/套/拆 rig。
// 依資產能力選路：有可驅動骨架→骨骼驅動（boneRig，skin 變形）、否則→剛性節段（articulationRig）。
// 抽離 view 之難測 Babylon 接線。NullEngine 可測。
import type { Scene, TransformNode } from '@babylonjs/core';
import { type ArticulationRig, buildArticulationRig } from './articulationRig';
import { buildBoneRig, hasDrivableSkeleton } from './boneRig';
import type { MotionPose } from './motionPose';

export interface RigController {
  sync(motionMode: boolean, pose: MotionPose): void;
  dispose(): void;
  getPivot(jointId: string, side?: string | null): TransformNode | null;
}

export function createRigController(scene: Scene): RigController {
  let rig: ArticulationRig | null = null;
  function sync(motionMode: boolean, pose: MotionPose): void {
    if (motionMode) {
      if (!rig)
        rig = hasDrivableSkeleton(scene) ? buildBoneRig(scene) : buildArticulationRig(scene);
      rig.applyPose(pose);
    } else if (rig) {
      rig.dispose();
      rig = null;
    }
  }
  function dispose(): void {
    rig?.dispose();
    rig = null;
  }
  function getPivot(jointId: string, side: string | null = null): TransformNode | null {
    return rig?.getPivot(jointId, side) ?? null;
  }
  return { sync, dispose, getPivot };
}
