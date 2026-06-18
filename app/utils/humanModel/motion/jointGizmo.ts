// 弧形拖曳手柄（04 §4.3.3）：於關節樞紐下逐 DOF 建弧 mesh，抓取旋轉拖曳驅動 onAngle、觸界著色。
// 唯一新增變動場景圖模組（除 rig 外）。NullEngine 可建構；拖曳互動（pointer／相機）須實機 QA。
import {
  type AbstractMesh,
  Color3,
  Matrix,
  MeshBuilder,
  type Observer,
  PointerEventTypes,
  type PointerInfo,
  type Scene,
  StandardMaterial,
  type TransformNode,
  Vector3,
} from '@babylonjs/core';
import { JOINT_KINEMATICS, movableJointDof } from './jointKinematics';
import { type MotionPose, jointAngle } from './motionPose';
import { clampAngle } from './romClamp';
import { type Vec3, dragToAngle, planeBasis, pointerAngleInPlane } from './dragRotation';

// 世界單位；尺度與弧長為視覺值，實機 QA 調整。
const ARC_RADIUS = 0.25;
const ARC_SWEEP = (Math.PI * 2) / 3; // 120°
const ARC_TUBE = 0.012;
const ARC_SEGMENTS = 24;
const COLOR_ACCENT = '#0e7490'; // teal-700（accent，§3.7.2）
const COLOR_LIMIT = '#b26a00'; // amber-clinical（觸界，§3.6）

function toVec3(p: Vector3): Vec3 {
  return { x: p.x, y: p.y, z: p.z };
}

export interface JointGizmoCallbacks {
  onAngle(jointId: string, axis: string, deg: number): void;
  onDragStart(): void;
  onDragEnd(): void;
  getPoseAngle(jointId: string, axis: string): number;
}

export interface JointGizmo {
  update(pose: MotionPose): void;
  dispose(): void;
}

interface ArcEntry {
  axis: string;
  mesh: AbstractMesh;
  material: StandardMaterial;
  localAxis: Vec3;
  localRef: Vec3; // planeBasis(localAxis).u
  sign: 1 | -1;
}

export function createJointGizmo(
  scene: Scene,
  pivot: TransformNode,
  jointId: string,
  cb: JointGizmoCallbacks,
): JointGizmo {
  const kin = JOINT_KINEMATICS[jointId];
  const arcs: ArcEntry[] = [];

  if (kin) {
    for (const dof of kin.dofs) {
      const localAxis: Vec3 = { x: dof.worldAxis[0], y: dof.worldAxis[1], z: dof.worldAxis[2] };
      const { u, v } = planeBasis(localAxis);
      const path: Vector3[] = [];
      for (let i = 0; i <= ARC_SEGMENTS; i += 1) {
        const a = -ARC_SWEEP / 2 + (ARC_SWEEP * i) / ARC_SEGMENTS;
        const c = Math.cos(a);
        const s = Math.sin(a);
        path.push(
          new Vector3(
            ARC_RADIUS * (c * u.x + s * v.x),
            ARC_RADIUS * (c * u.y + s * v.y),
            ARC_RADIUS * (c * u.z + s * v.z),
          ),
        );
      }
      const mesh = MeshBuilder.CreateTube(
        `gizmo:${jointId}:${dof.axis}`,
        { path, radius: ARC_TUBE, tessellation: 8, updatable: false },
        scene,
      );
      const material = new StandardMaterial(`gizmoMat:${jointId}:${dof.axis}`, scene);
      material.emissiveColor = Color3.FromHexString(COLOR_ACCENT);
      material.disableLighting = true;
      mesh.material = material;
      mesh.parent = pivot;
      mesh.isPickable = true;
      mesh.metadata = { gizmoAxis: dof.axis, gizmoJointId: jointId };
      arcs.push({ axis: dof.axis, mesh, material, localAxis, localRef: u, sign: dof.sign });
    }
  }

  // 拖曳於抓取時固定旋轉平面（防拖曳中平面隨關節旋轉漂移）。
  let drag: {
    axis: string;
    pivotPos: Vec3;
    normal: Vec3;
    ref: Vec3;
    grabAngle: number;
    startDeg: number;
    sign: 1 | -1;
  } | null = null;

  function worldDir(local: Vec3): Vec3 {
    const out = Vector3.TransformNormal(
      new Vector3(local.x, local.y, local.z),
      pivot.getWorldMatrix(),
    );
    out.normalize();
    return toVec3(out);
  }
  function ray(): { origin: Vec3; dir: Vec3 } {
    const r = scene.createPickingRay(
      scene.pointerX,
      scene.pointerY,
      Matrix.Identity(),
      scene.activeCamera,
    );
    return { origin: toVec3(r.origin), dir: toVec3(r.direction) };
  }

  const obs: Observer<PointerInfo> | null = scene.onPointerObservable.add((info) => {
    if (info.type === PointerEventTypes.POINTERDOWN) {
      const picked = info.pickInfo?.pickedMesh;
      const entry = picked ? arcs.find((x) => x.mesh === picked) : undefined;
      if (!entry) return;
      pivot.computeWorldMatrix(true);
      const pivotPos = toVec3(pivot.getAbsolutePosition());
      const normal = worldDir(entry.localAxis);
      const ref = worldDir(entry.localRef);
      const r = ray();
      const grab = pointerAngleInPlane(r.origin, r.dir, pivotPos, normal, ref);
      if (grab === null) return;
      drag = {
        axis: entry.axis,
        pivotPos,
        normal,
        ref,
        grabAngle: grab,
        startDeg: cb.getPoseAngle(jointId, entry.axis),
        sign: entry.sign,
      };
      cb.onDragStart();
    } else if (info.type === PointerEventTypes.POINTERMOVE && drag) {
      const r = ray();
      const cur = pointerAngleInPlane(r.origin, r.dir, drag.pivotPos, drag.normal, drag.ref);
      if (cur === null) return;
      const dof = movableJointDof(jointId, drag.axis);
      if (!dof) return;
      cb.onAngle(
        jointId,
        drag.axis,
        dragToAngle(drag.startDeg, drag.grabAngle, cur, dof, drag.sign).value,
      );
    } else if (info.type === PointerEventTypes.POINTERUP && drag) {
      drag = null;
      cb.onDragEnd();
    }
  });

  function update(pose: MotionPose): void {
    for (const entry of arcs) {
      const dof = movableJointDof(jointId, entry.axis);
      if (!dof) continue;
      const { atLimit } = clampAngle(dof, jointAngle(pose, jointId, entry.axis, dof.neutral));
      entry.material.emissiveColor = Color3.FromHexString(atLimit ? COLOR_LIMIT : COLOR_ACCENT);
    }
  }

  function dispose(): void {
    if (obs) scene.onPointerObservable.remove(obs);
    for (const entry of arcs) {
      entry.material.dispose();
      entry.mesh.dispose();
    }
    arcs.length = 0;
    drag = null;
  }

  return { update, dispose };
}
