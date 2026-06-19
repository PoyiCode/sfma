// 肌肉收縮／伸展著色（04 §4.3.4）：由運動 pose × muscle.actions 推導每肌「收縮（暖）／伸展（冷）」
// 純量。著色由資料推導、與剛性節段綁定無關（§4.3.4）。純函式核心、可 node 測。
import { Color3, type Scene } from '@babylonjs/core';
import '@babylonjs/core/Rendering/outlineRenderer';
import type { Muscle } from '@ptapp/shared';
import { anatomyEntities, anatomyEntityById } from '@ptapp/definitions';
import type { PlaceholderMeshMetadata } from '../render/sceneCore';
import { type MotionPose, jointAngle } from './motionPose';
import { sideOfMesh } from './meshToJoint';
import {
  isMirroredAxis,
  JOINT_KINEMATICS,
  jointDofForSide,
  MOVABLE_JOINT_IDS,
  poseKey,
} from './jointKinematics';

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

// 作用於某可動關節、且 action 於 v1 著色表有對應之肌；非可動關節或無對應 → 空集。
export function musclesForJoint(jointId: string): Muscle[] {
  if (!MOVABLE_JOINT_IDS.includes(jointId)) return [];
  return anatomyEntities.filter(
    (e): e is Muscle =>
      e.type === 'muscle' &&
      e.actions.some((a) => a.jointId === jointId && ACTION_AXIS[a.action] !== undefined),
  );
}

// 著色色（發散）：收縮暖、伸展冷（暫定、可對齊 tokens §3.7）。
export const WARM = new Color3(217 / 255, 74 / 255, 42 / 255); // #D94A2A
export const COOL = new Color3(47 / 255, 111 / 255, 176 / 255); // #2F6FB0
const MAX_ALPHA = 0.55;

// 肌肉著色（唯一 overlay 來源）：染肌肉、清非肌肉殘留 overlay。NullEngine 可測。
export function applyMuscleShading(scene: Scene, pose: MotionPose): void {
  for (const mesh of scene.meshes) {
    const meta = mesh.metadata as PlaceholderMeshMetadata | null | undefined;
    if (meta?.entityType !== 'muscle' || meta.anatomyId === undefined) {
      mesh.renderOverlay = false;
      continue;
    }
    const entity = anatomyEntityById.get(meta.anatomyId);
    if (entity === undefined || entity.type !== 'muscle') {
      mesh.renderOverlay = false;
      continue;
    }
    const s = muscleContractionScalar(entity, pose, sideOfMesh(mesh.name));
    if (s > EPSILON) {
      mesh.renderOverlay = true;
      mesh.overlayColor = WARM;
      mesh.overlayAlpha = s * MAX_ALPHA;
    } else if (s < -EPSILON) {
      mesh.renderOverlay = true;
      mesh.overlayColor = COOL;
      mesh.overlayAlpha = -s * MAX_ALPHA;
    } else {
      mesh.renderOverlay = false;
    }
  }
}
