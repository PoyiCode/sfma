// 關節活動 rig（04 §4.3.3，剛性節段旋轉）：把扁平 mesh 集合掛到關節樞紐 TransformNode 下、
// 依姿態旋轉遠端節段。為唯一變動場景圖之模組（建立/還原皆在此）。NullEngine 可測。
import {
  type AbstractMesh,
  type Node,
  Quaternion,
  type Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import { type MotionPose, jointAngle } from './motionPose';
import {
  type AabbFace,
  type JointKinematics,
  JOINT_KINEMATICS,
  movableJointDof,
  SEGMENT_TREE,
  type SegmentTreeNode,
  segmentMembershipAll,
} from './jointKinematics';

const SIDE_SUFFIXES: readonly (string | null)[] = ['#L', '#R'];
const DEG2RAD = Math.PI / 180;

export interface ArticulationRig {
  applyPose(pose: MotionPose): void;
  dispose(): void;
  pivotKeys: readonly string[];
}

interface MovedMesh {
  mesh: AbstractMesh;
  originalParent: Node | null;
}

function pivotKey(jointId: string, side: string | null): string {
  return side === null ? jointId : `${jointId}${side}`;
}

// 取 mesh 世界 AABB 指定面之中心（如 maxY＝上端面心）。
function faceCenter(mesh: AbstractMesh, face: AabbFace): Vector3 {
  mesh.computeWorldMatrix(true);
  const box = mesh.getBoundingInfo().boundingBox;
  const min = box.minimumWorld;
  const max = box.maximumWorld;
  const cx = (min.x + max.x) / 2;
  const cy = (min.y + max.y) / 2;
  const cz = (min.z + max.z) / 2;
  switch (face) {
    case 'minX':
      return new Vector3(min.x, cy, cz);
    case 'maxX':
      return new Vector3(max.x, cy, cz);
    case 'minY':
      return new Vector3(cx, min.y, cz);
    case 'maxY':
      return new Vector3(cx, max.y, cz);
    case 'minZ':
      return new Vector3(cx, cy, min.z);
    case 'maxZ':
      return new Vector3(cx, cy, max.z);
  }
}

// 解析某 segment+side 之成員 mesh：雙側取 `<id><side>`、無側取 `<id>`（佔位身體無側→ fallback 無後綴）。
function meshesFor(
  scene: Scene,
  anatomyIds: readonly string[],
  side: string | null,
): AbstractMesh[] {
  const out: AbstractMesh[] = [];
  for (const id of anatomyIds) {
    const named = side !== null ? scene.getMeshByName(`${id}${side}`) : null;
    const mesh = named ?? scene.getMeshByName(id);
    if (mesh) out.push(mesh);
  }
  return out;
}

// anchor bone mesh（同 side fallback 無側）。
function anchorMesh(scene: Scene, bone: string, side: string | null): AbstractMesh | null {
  return (
    (side !== null ? scene.getMeshByName(`${bone}${side}`) : null) ?? scene.getMeshByName(bone)
  );
}

export function buildArticulationRig(scene: Scene): ArticulationRig {
  const membership = segmentMembershipAll();
  const pivots = new Map<string, TransformNode>();
  const pivotMeta = new Map<string, { kin: JointKinematics; side: string | null }>();
  const moved: MovedMesh[] = [];
  // 追蹤已被移動之 mesh（佔位身體無 #L/#R 時同一 mesh 可能被雙側各找到一次）。
  const movedSet = new Set<AbstractMesh>();

  // 依樹前序（父先於子）建樞紐並巢狀。
  function visit(node: SegmentTreeNode, parentKeyForSide: (side: string | null) => string | null) {
    if (node.jointId !== 'base') {
      const kin = JOINT_KINEMATICS[node.jointId]!;
      const sides: (string | null)[] = kin.bilateral ? [...SIDE_SUFFIXES] : [null];
      for (const side of sides) {
        const anchor = anchorMesh(scene, kin.pivot.bone, side);
        if (!anchor) continue; // 缺 anchor（資產未含）→ 跳過此樞紐
        const key = pivotKey(node.jointId, side);
        const pivot = new TransformNode(`pivot:${key}`, scene);
        pivot.rotationQuaternion = Quaternion.Identity();
        pivot.setAbsolutePosition(faceCenter(anchor, kin.pivot.face));
        // 巢狀：父樞紐同側（父為中線時取中線父）。
        const parentKey = parentKeyForSide(side);
        const parentPivot = parentKey !== null ? pivots.get(parentKey) : undefined;
        if (parentPivot) pivot.setParent(parentPivot);
        pivots.set(key, pivot);
        pivotMeta.set(key, { kin, side });
        // reparent 成員 mesh（保世界變換）；已移動（fallback 同一 mesh）跳過。
        for (const mesh of meshesFor(scene, membership.get(node.jointId) ?? [], side)) {
          if (movedSet.has(mesh)) continue;
          movedSet.add(mesh);
          moved.push({ mesh, originalParent: mesh.parent });
          mesh.setParent(pivot);
        }
      }
    }
    for (const child of node.children) {
      visit(child, (side) => {
        if (node.jointId === 'base') return null;
        const kin = JOINT_KINEMATICS[node.jointId]!;
        return pivotKey(node.jointId, kin.bilateral ? side : null);
      });
    }
  }
  visit(SEGMENT_TREE, () => null);

  function applyPose(pose: MotionPose): void {
    for (const [key, { kin }] of pivotMeta) {
      const pivot = pivots.get(key);
      if (!pivot) continue;
      let q = Quaternion.Identity();
      for (const m of kin.dofs) {
        const dof = movableJointDof(kin.jointId, m.axis);
        const neutral = dof?.neutral ?? 0;
        const deg = jointAngle(pose, kin.jointId, m.axis, neutral) - neutral;
        if (deg === 0) continue;
        const axis = new Vector3(m.worldAxis[0], m.worldAxis[1], m.worldAxis[2]);
        q = q.multiply(Quaternion.RotationAxis(axis, deg * m.sign * DEG2RAD));
      }
      pivot.rotationQuaternion = q;
    }
  }

  function dispose(): void {
    applyPose({}); // 歸零旋轉→世界變換回中立
    // 強制更新所有樞紐世界矩陣（從根到葉），確保 setParent 取到正確世界位置。
    for (const pivot of pivots.values()) pivot.computeWorldMatrix(true);
    for (const { mesh, originalParent } of moved) {
      mesh.computeWorldMatrix(true);
      mesh.setParent(originalParent);
    }
    for (const pivot of pivots.values()) pivot.dispose();
    pivots.clear();
    pivotMeta.clear();
    moved.length = 0;
  }

  return { applyPose, dispose, pivotKeys: [...pivots.keys()] };
}
