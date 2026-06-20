// 骨骼驅動 rig（04 §4.3.3，skin 變形）：載入帶真骨架之 GLB 時，以同一 pose 驅動 Babylon
// Skeleton bones 之區域旋轉，GPU 蒙皮自動使 mesh 軟變形（剛性綁定與跨關節肌一律由 GPU 處理）。
// 實作既有 ArticulationRig 介面，與剛性路（articulationRig.ts）由 rigController 擇一、互斥。
// 不 reparent mesh、僅改 bone 區域旋轉。NullEngine 可測。
import {
  type Bone,
  Quaternion,
  type Scene,
  type Skeleton,
  Space,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import type { ArticulationRig } from './articulationRig';
import { type MotionPose, jointAngle } from './motionPose';
import { JOINT_KINEMATICS, MOVABLE_JOINT_IDS, movableJointDof, poseKey } from './jointKinematics';
import { BONE_RIG_MAP } from './boneRigMap';

const DEG2RAD = Math.PI / 180;
const SIDES: readonly (string | null)[] = ['#L', '#R'];

// pose 側 → MakeHuman bone 側尾碼（雙側 #L/#R→.L/.R、單側無尾碼）。
export function resolveBoneName(base: string, side: string | null): string {
  if (side === '#L') return `${base}.L`;
  if (side === '#R') return `${base}.R`;
  return base;
}

function findBone(skeleton: Skeleton, name: string): Bone | null {
  return skeleton.bones.find((b) => b.name === name) ?? null;
}

function sidesFor(jointId: string): readonly (string | null)[] {
  return JOINT_KINEMATICS[jointId]?.bilateral === true ? SIDES : [null];
}

// 是否有可驅動骨架：至少一具 skeleton 且 BONE_RIG_MAP 之骨可解析（保守：解析不到→退剛性路）。
export function hasDrivableSkeleton(scene: Scene): boolean {
  if (scene.skeletons.length === 0) return false;
  for (const skeleton of scene.skeletons) {
    for (const jointId of MOVABLE_JOINT_IDS) {
      const map = BONE_RIG_MAP[jointId];
      if (!map) continue;
      for (const side of sidesFor(jointId)) {
        if (findBone(skeleton, resolveBoneName(map.bone, side))) return true;
      }
    }
  }
  return false;
}

interface DrivenBone {
  jointId: string;
  side: string | null;
  bone: Bone;
  node: TransformNode | null;
  rest: Quaternion;
  setLocal(q: Quaternion): void;
}

export function buildBoneRig(scene: Scene): ArticulationRig {
  const driven: DrivenBone[] = [];
  for (const skeleton of scene.skeletons) {
    for (const jointId of MOVABLE_JOINT_IDS) {
      const map = BONE_RIG_MAP[jointId];
      if (!map) continue;
      for (const side of sidesFor(jointId)) {
        const bone = findBone(skeleton, resolveBoneName(map.bone, side));
        if (!bone) continue;
        // glTF 匯入之骨架經 bone.linkedTransformNode 驅動：須轉該 node 之區域旋轉，直接
        // bone.setRotationQuaternion 對 glTF 骨架無效（合成 fixture 無 node → 退回 bone 直驅）。
        const node = bone.getTransformNode();
        let rest: Quaternion;
        let setLocal: (q: Quaternion) => void;
        if (node) {
          rest = (node.rotationQuaternion ?? Quaternion.FromEulerVector(node.rotation)).clone();
          setLocal = (q) => {
            node.rotationQuaternion = q;
          };
        } else {
          rest = bone.getRotationQuaternion(Space.LOCAL).clone();
          setLocal = (q) => {
            bone.setRotationQuaternion(q, Space.LOCAL);
          };
        }
        driven.push({ jointId, side, bone, node, rest, setLocal });
      }
    }
  }

  // skinned mesh 防視錐裁切：Babylon 以 rest-pose 邊界剔除，posed 幾何超出邊界會整件不繪。
  for (const mesh of scene.meshes) {
    if (mesh.skeleton) mesh.alwaysSelectAsActiveMesh = true;
  }

  // gizmo 樞紐：每 (jointId, side) 一個自由 TransformNode（identity 旋轉、置於關節中心＝bone head），
  // **不** parent 至骨。arc 以 dof.worldAxis 為子節點建於此 → 因樞紐 identity 旋轉、worldAxis 直接對映
  // 世界平面（識別軸無誤）。位置於每次 applyPose 後隨 FK 更新（近端關節轉動時遠端中心隨動）。
  // 拖曳為 pose-space、與 rig 無關 → 與剛性路共用 jointGizmo 之 arc/drag。
  const pivots = new Map<string, TransformNode>();
  const pivotSrc: { pivot: TransformNode; node: TransformNode | null; bone: Bone }[] = [];
  const pivotKeyOf = (jointId: string, side: string | null): string => `${jointId}${side ?? ''}`;
  for (const d of driven) {
    const key = pivotKeyOf(d.jointId, d.side);
    if (pivots.has(key)) continue;
    const piv = new TransformNode(`gizmoPivot:${key}`, scene);
    piv.rotationQuaternion = Quaternion.Identity();
    pivots.set(key, piv);
    pivotSrc.push({ pivot: piv, node: d.node, bone: d.bone });
  }
  function syncPivots(): void {
    for (const p of pivotSrc) {
      const pos = p.node ? p.node.getAbsolutePosition() : p.bone.getAbsolutePosition();
      p.pivot.position.copyFrom(pos);
    }
  }
  syncPivots(); // 初始＝rest 關節中心

  function applyPose(pose: MotionPose): void {
    for (const d of driven) {
      const map = BONE_RIG_MAP[d.jointId]!;
      const pk = poseKey(d.jointId, d.side);
      // 自 rest 起、逐 DOF 相乘（與 articulationRig 同慣例）；左右鏡像由 pose 值帶（同剛性路/著色）。
      let q = d.rest.clone();
      for (const [axis, m] of Object.entries(map.dofs)) {
        const neutral = movableJointDof(d.jointId, axis)?.neutral ?? 0;
        const deg = jointAngle(pose, pk, axis, neutral) - neutral;
        if (deg === 0) continue;
        const la = d.side === '#L' && m.localAxisLeft ? m.localAxisLeft : m.localAxis;
        const v = new Vector3(la[0], la[1], la[2]);
        q = q.multiply(Quaternion.RotationAxis(v, deg * m.sign * DEG2RAD));
      }
      d.setLocal(q);
    }
    syncPivots(); // 關節中心隨 FK 更新（pose 變更後）
  }

  function dispose(): void {
    for (const d of driven) d.setLocal(d.rest.clone());
    driven.length = 0;
    for (const piv of pivots.values()) piv.dispose();
    pivots.clear();
    pivotSrc.length = 0;
  }

  // gizmo 手柄樞紐：關節中心 TransformNode（gizmoController 據此建 arc 手柄；bone-path 啟用）。
  function getPivot(jointId: string, side: string | null = null): TransformNode | null {
    return pivots.get(pivotKeyOf(jointId, side)) ?? null;
  }

  return { applyPose, dispose, pivotKeys: [...pivots.keys()], getPivot };
}
