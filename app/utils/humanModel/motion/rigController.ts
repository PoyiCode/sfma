// rig 生命週期控制器（供 Model3DView effect 與測試共用）：依 motionMode/pose 冪等地建/套/拆 rig。
// 抽離 view 之難測 Babylon 接線。NullEngine 可測。
import type { Scene, TransformNode } from '@babylonjs/core';
import { type ArticulationRig, buildArticulationRig } from './articulationRig';
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
      if (!rig) rig = buildArticulationRig(scene);
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
