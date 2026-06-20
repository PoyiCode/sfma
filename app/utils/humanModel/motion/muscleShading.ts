// 肌肉收縮／伸展著色（04 §4.3.4）：由運動 pose × muscle.actions 推導每肌「收縮（暖）／伸展（冷）」
// 純量。著色由資料推導、與剛性節段綁定無關（§4.3.4）。純函式核心、可 node 測。
// 著色經**頂點色**（VertexBuffer.ColorKind、乘於 albedo）施加——頂點色為 attribute、於 GPU skin/morph
// 變形「之後」內插，不受 rest-pose 幾何影響；取代舊 renderOverlay outline shell（其以 rest-pose 殼繪、
// 與 skinned 變形面 z-fighting 致表面雜訊）。renderOverlay 仍用於選取/標註高亮（sceneHighlight）。
import { type AbstractMesh, Color3, type Mesh, type Scene, VertexBuffer } from '@babylonjs/core';
import '@babylonjs/core/Rendering/outlineRenderer';
import type { AnnotationHighlights } from '../anatomy/anatomyHighlight';
import { applyHighlights } from '../render/sceneHighlight';
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
// 頂點色乘於 albedo：白＝不變（中性）；lerp(白→暖/冷) 以 |scalar| 為比、上限 TINT_STRENGTH（保底色辨識）。
const TINT_STRENGTH = 0.8;
const lastTint = new WeakMap<AbstractMesh, string>();

// 設整片 mesh 之 uniform 頂點色（RGBA、alpha 固定 1 不引入透明）。快取跳過未變者，避免每次 pose 重傳 buffer。
function setMeshTint(mesh: AbstractMesh, r: number, g: number, b: number): void {
  const key = `${r.toFixed(3)},${g.toFixed(3)},${b.toFixed(3)}`;
  if (lastTint.get(mesh) === key) return;
  lastTint.set(mesh, key);
  const m = mesh as Mesh;
  const n = m.getTotalVertices();
  if (n === 0) return;
  const data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    data[o] = r;
    data[o + 1] = g;
    data[o + 2] = b;
    data[o + 3] = 1;
  }
  if (m.isVerticesDataPresent(VertexBuffer.ColorKind)) {
    m.updateVerticesData(VertexBuffer.ColorKind, data);
  } else {
    m.setVerticesData(VertexBuffer.ColorKind, data, true);
  }
  m.useVertexColors = true;
}

// 肌肉著色（overlay 單一權威之一）：以頂點色染肌肉（skinning-safe）、清所有 renderOverlay 殘留。NullEngine 可測。
export function applyMuscleShading(scene: Scene, pose: MotionPose): void {
  for (const mesh of scene.meshes) {
    mesh.renderOverlay = false; // 著色模式不顯選取/標註 overlay（清殘留）
    const meta = mesh.metadata as PlaceholderMeshMetadata | null | undefined;
    if (meta?.entityType !== 'muscle' || meta.anatomyId === undefined) continue;
    const entity = anatomyEntityById.get(meta.anatomyId);
    if (entity === undefined || entity.type !== 'muscle') continue;
    const s = muscleContractionScalar(entity, pose, sideOfMesh(mesh.name));
    if (contractionState(s) === 'neutral') {
      setMeshTint(mesh, 1, 1, 1);
      continue;
    }
    const base = s > 0 ? WARM : COOL;
    const f = Math.min(1, Math.abs(s)) * TINT_STRENGTH;
    setMeshTint(mesh, 1 + (base.r - 1) * f, 1 + (base.g - 1) * f, 1 + (base.b - 1) * f);
  }
}

// 離開著色模式時還原肌肉頂點色為白（僅曾染色者），使 albedo 復原。
export function clearMuscleShading(scene: Scene): void {
  for (const mesh of scene.meshes) {
    const meta = mesh.metadata as PlaceholderMeshMetadata | null | undefined;
    if (
      meta?.entityType === 'muscle' &&
      (mesh as Mesh).isVerticesDataPresent(VertexBuffer.ColorKind)
    ) {
      setMeshTint(mesh, 1, 1, 1);
    }
  }
}

export interface OverlayParams {
  motionMode: boolean;
  muscleShading: boolean;
  pose: MotionPose;
  selectedKey: string | null;
  highlights?: AnnotationHighlights;
}

// overlay 單一權威：運動模式+著色 → 肌肉著色；否則 → 選取/標註高亮（含運動模式著色關時仍顯標註）。
export function applyOverlays(scene: Scene, params: OverlayParams): void {
  if (params.motionMode && params.muscleShading) {
    applyMuscleShading(scene, params.pose);
  } else {
    clearMuscleShading(scene);
    applyHighlights(scene, params.selectedKey, params.highlights);
  }
}
