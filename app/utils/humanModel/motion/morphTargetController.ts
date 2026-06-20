// 極限屈曲 corrective morph 控制（spec 2026-06-20）：依關節屈曲角度設 morph influence，
// 回復 LBS candy-wrapper 塌陷之體積。morph 契約名＝`corr.<jointId>`（distal 關節）。

// morph 權重曲線：|angle| onset 下 0、ref 上 1、之間 smoothstep（C1 連續、端點導數 0）。
import type { Scene } from '@babylonjs/core';
import { type MotionPose, jointAngle } from './motionPose';
import { movableJointDof, poseKey } from './jointKinematics';

export function correctiveWeight(angleDeg: number, onsetDeg: number, refDeg: number): number {
  if (refDeg <= onsetDeg) return 0;
  const c = Math.min(1, Math.max(0, (Math.abs(angleDeg) - onsetDeg) / (refDeg - onsetDeg)));
  return c * c * (3 - 2 * c);
}

const CORR_PREFIX = 'corr.';
const ONSET_FRACTION = 0.6;
// 驅動軸 per joint（膝/髖＝矢狀屈伸；踝＝蹠背屈）。未列之關節不驅動。
const CORRECTIVE_AXIS: Readonly<Record<string, string>> = {
  'joint.knee': 'flexionExtension',
  'joint.hip': 'flexionExtension',
  'joint.ankle': 'plantarDorsiflexion',
};

export interface MorphTargetController {
  sync(pose: MotionPose): void;
  dispose(): void;
}

function sideFromMeshName(name: string): string | null {
  if (name.endsWith('#L')) return '#L';
  if (name.endsWith('#R')) return '#R';
  return null;
}

// ref＝該軸 ROM 兩端最大幅（極限屈曲端）；onset＝0.6·ref。definitions 缺→0（不驅動）。
function refOnset(jointId: string, axis: string): { ref: number; onset: number } {
  const dof = movableJointDof(jointId, axis);
  const ref = dof ? Math.max(Math.abs(dof.min), Math.abs(dof.max)) : 0;
  return { ref, onset: ref * ONSET_FRACTION };
}

export function createMorphTargetController(scene: Scene): MorphTargetController {
  interface Driven {
    set(w: number): void;
    pk: string;
    axis: string;
    onset: number;
    ref: number;
  }
  const driven: Driven[] = [];
  for (const mesh of scene.meshes) {
    const mgr = mesh.morphTargetManager;
    if (!mgr) continue;
    const side = sideFromMeshName(mesh.name);
    for (let i = 0; i < mgr.numTargets; i++) {
      const target = mgr.getTarget(i);
      if (!target.name.startsWith(CORR_PREFIX)) continue;
      const jointId = target.name.slice(CORR_PREFIX.length);
      const axis = CORRECTIVE_AXIS[jointId];
      if (!axis) continue;
      const { ref, onset } = refOnset(jointId, axis);
      driven.push({
        set: (w) => {
          target.influence = w;
        },
        pk: poseKey(jointId, side),
        axis,
        onset,
        ref,
      });
    }
  }

  return {
    sync(pose: MotionPose): void {
      for (const d of driven)
        d.set(correctiveWeight(jointAngle(pose, d.pk, d.axis, 0), d.onset, d.ref));
    },
    dispose(): void {
      for (const d of driven) d.set(0);
      driven.length = 0;
    },
  };
}
