// 肌肉收縮／伸展著色（04 §4.3.4）：由運動 pose × muscle.actions 推導每肌「收縮（暖）／伸展（冷）」
// 純量。著色由資料推導、與剛性節段綁定無關（§4.3.4）。純函式核心、可 node 測。
import type { Muscle } from '@ptapp/shared';
import { type MotionPose, jointAngle } from './motionPose';
import { isMirroredAxis, JOINT_KINEMATICS, jointDofForSide, poseKey } from './jointKinematics';

// 方向明確之成對軸 action → { axis, dir }；複合軸名第一動作＝+1（與 ROM 資料一致）。
// lateralFlexion／rotation 等單名/非成對動作刻意不入表 → 貢獻 0、不著色（v1 範圍）。
const ACTION_AXIS: Readonly<Record<string, { axis: string; dir: 1 | -1 }>> = {
  flexion: { axis: 'flexionExtension', dir: 1 },
  extension: { axis: 'flexionExtension', dir: -1 },
  abduction: { axis: 'abductionAdduction', dir: 1 },
  adduction: { axis: 'abductionAdduction', dir: -1 },
  internalRotation: { axis: 'internalExternalRotation', dir: 1 },
  externalRotation: { axis: 'internalExternalRotation', dir: -1 },
  plantarflexion: { axis: 'plantarDorsiflexion', dir: 1 },
  dorsiflexion: { axis: 'plantarDorsiflexion', dir: -1 },
  inversion: { axis: 'inversionEversion', dir: 1 },
  eversion: { axis: 'inversionEversion', dir: -1 },
};

const EPSILON = 0.02;

// 收縮純量（正＝收縮、負＝伸展、≈0＝中性）；side 為 pose 側（'#L'/'#R'/null）。
export function muscleContractionScalar(
  muscle: Muscle,
  pose: MotionPose,
  side: string | null,
): number {
  let sum = 0;
  for (const { jointId, action } of muscle.actions) {
    const map = ACTION_AXIS[action];
    if (map === undefined) continue;
    const dof = jointDofForSide(jointId, map.axis, side);
    if (dof === undefined) continue;
    const delta = jointAngle(pose, poseKey(jointId, side), map.axis, dof.neutral) - dof.neutral;
    const reach = delta >= 0 ? dof.max - dof.neutral : dof.neutral - dof.min;
    if (reach <= 0) continue;
    const bilateral = JOINT_KINEMATICS[jointId]?.bilateral === true;
    const dir = side === '#L' && isMirroredAxis(map.axis) && bilateral ? -map.dir : map.dir;
    sum += (dir * delta) / reach;
  }
  return Math.max(-1, Math.min(1, sum));
}

export type ContractionState = 'contract' | 'stretch' | 'neutral';

export function contractionState(scalar: number): ContractionState {
  if (scalar > EPSILON) return 'contract';
  if (scalar < -EPSILON) return 'stretch';
  return 'neutral';
}
