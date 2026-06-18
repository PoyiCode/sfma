// 手柄生命週期控制器（供 Model3DView effect 與測試共用，仿 rigController）：依 motionMode/關節/側別
// 冪等地建/拆手柄、依 pose 更新觸界著色。NullEngine 可測。
import type { Scene, TransformNode } from '@babylonjs/core';
import { type JointGizmo, type JointGizmoCallbacks, createJointGizmo } from './jointGizmo';
import type { MotionPose } from './motionPose';

export interface GizmoController {
  sync(motionMode: boolean, jointId: string | null, side: string | null, pose: MotionPose): void;
  dispose(): void;
}

export function createGizmoController(
  scene: Scene,
  getPivot: (jointId: string, side: string | null) => TransformNode | null,
  cb: JointGizmoCallbacks,
): GizmoController {
  let gizmo: JointGizmo | null = null;
  let currentKey: string | null = null;

  function sync(
    motionMode: boolean,
    jointId: string | null,
    side: string | null,
    pose: MotionPose,
  ): void {
    const pivot = motionMode && jointId ? getPivot(jointId, side) : null;
    const key = pivot && jointId ? `${jointId}|${side ?? ''}` : null;
    if (key !== currentKey) {
      gizmo?.dispose();
      gizmo = null;
      currentKey = key;
      if (pivot && jointId) gizmo = createJointGizmo(scene, pivot, jointId, side, cb);
    }
    gizmo?.update(pose);
  }

  function dispose(): void {
    gizmo?.dispose();
    gizmo = null;
    currentKey = null;
  }

  return { sync, dispose };
}
