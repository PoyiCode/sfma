# 運動模式 on-model 拖曳手柄 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 3D 模型上以自訂弧形手柄直接拖曳活動關節（grab-and-turn、ROM 鉗制、觸界琥珀），點選身體部位選關節，滑桿並存雙向同步。

**Architecture:** 接續運動模式 v1。新增純函式 `dragRotation`（平面投影掃掠角→鉗制角）、`meshToJoint`（mesh→關節反查）；`articulationRig` 暴露 `getPivot`；Babylon `jointGizmo`（弧 mesh＋pointer 拖曳）與 `gizmoController`（生命週期，仿 `rigController`）。`Model3DView` 接線手柄＋pointer 分流＋拖曳時 detach 相機；`Model3DViewer` 透傳。拖曳輸入經既有 `setJointAngle`→`clampAngle`→`pose`→`rigController.applyPose` seam，與滑桿同源。

**Tech Stack:** Nuxt 4 / Vue 3（`<script setup>`）、Babylon.js（`@babylonjs/core`：`MeshBuilder.CreateTube`、`StandardMaterial`、`onPointerObservable`、`createPickingRay`、`Vector3.TransformNormal`、`NullEngine`）、Vitest（node＋NullEngine）。

## Global Constraints

- 套件管理器 **pnpm**（Node ≥ 20）；勿用 npm/yarn。
- 命名：camelCase（變數／函式）、PascalCase（型別／元件）、UPPER_CASE（常數）；**嚴禁 snake_case**（eslint 強制）。
- 單元／NullEngine 測試走 `pnpm test`（node 環境，排除 `*.nuxt.test.ts`）；元件 jsdom 以檔頭 docblock 切換。
- Babylon 物件以閉包變數持（非 Vue reactive）。
- `pnpm typecheck` 須過；提交前 husky + lint-staged 自動修正；每 task commit。
- 不改 `packages/shared`、`packages/definitions`。
- pose 維持**側別無關**（雙側對稱）；本功能不引入 per-side pose。

---

## File Structure

新增：
- `app/utils/humanModel/motion/dragRotation.ts`（＋test）— 純：向量／平面基底／掃掠角／鉗制角。
- `app/utils/humanModel/motion/meshToJoint.ts`（＋test）— 純：mesh 名→關節／側別。
- `app/utils/humanModel/motion/jointGizmo.ts`（＋test）— Babylon：弧手柄。
- `app/utils/humanModel/motion/gizmoController.ts`（＋test）— Babylon：手柄生命週期。

修改：
- `app/utils/humanModel/motion/articulationRig.ts` — 新增 `getPivot`。
- `app/utils/humanModel/motion/rigController.ts` — 新增 `getPivot`（委派）。
- `app/components/humanModel/Model3DView.vue` — 手柄接線＋pointer 分流＋相機 detach＋`motionJoint` prop＋`setJointAngle`／`selectMotionJoint` emits。
- `app/components/humanModel/Model3DViewer.vue` — 透傳 `motion-joint`、forward `set-joint-angle`／`select-motion-joint`。
- `doc/design/04_human_model.md` §4.3.3 — 設計同步。

頁面 `model.vue` **無須改動**（已接 `@motion-joint-change="motionJoint=$event"`、`@set-joint-angle="handleSetJointAngle"`、`:motion-joint`）。

---

## Task 1: 拖曳旋轉純函式（dragRotation）

**Files:**
- Create: `app/utils/humanModel/motion/dragRotation.ts`
- Test: `app/utils/humanModel/motion/dragRotation.test.ts`

**Interfaces:**
- Consumes: `./romClamp` 之 `clampAngle`、`ClampResult`、`DegreeOfFreedom`。
- Produces:
  - `interface Vec3 { x: number; y: number; z: number }`
  - `normalizeDeg(deg: number): number`（收斂至 (−180,180]）
  - `planeBasis(axis: Vec3): { u: Vec3; v: Vec3 }`（旋轉平面正交基底）
  - `pointerAngleInPlane(rayOrigin: Vec3, rayDir: Vec3, pivot: Vec3, planeNormal: Vec3, refDir: Vec3): number | null`（弧度；無穩定交點回 null）
  - `dragToAngle(startDeg: number, grabAngleRad: number, currentAngleRad: number, dof: Pick<DegreeOfFreedom, 'min' | 'max'>): ClampResult`

- [ ] **Step 1: 寫失敗測試**

Create `app/utils/humanModel/motion/dragRotation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  dragToAngle,
  normalizeDeg,
  planeBasis,
  pointerAngleInPlane,
  type Vec3,
} from './dragRotation';

const KNEE = { min: -5, max: 140 } as const;

describe('normalizeDeg', () => {
  it('收斂至 (−180,180]', () => {
    expect(normalizeDeg(10)).toBe(10);
    expect(normalizeDeg(190)).toBe(-170);
    expect(normalizeDeg(-190)).toBe(170);
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(180)).toBe(180);
    expect(normalizeDeg(-180)).toBe(180);
  });
});

describe('planeBasis', () => {
  it('回傳兩兩正交且與軸正交之單位基底', () => {
    const { u, v } = planeBasis({ x: 0, y: 1, z: 0 });
    const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
    expect(Math.abs(dot(u, { x: 0, y: 1, z: 0 }))).toBeLessThan(1e-9); // u ⟂ axis
    expect(Math.abs(dot(u, v))).toBeLessThan(1e-9); // u ⟂ v
    expect(dot(u, u)).toBeCloseTo(1, 9);
    expect(dot(v, v)).toBeCloseTo(1, 9);
  });
});

describe('pointerAngleInPlane', () => {
  // XZ 平面（法線 +Y）過原點、refDir=+X。
  const PIVOT: Vec3 = { x: 0, y: 0, z: 0 };
  const N: Vec3 = { x: 0, y: 1, z: 0 };
  const REF: Vec3 = { x: 1, y: 0, z: 0 };
  it('射線自上方打中 +X 方向 → 角 0', () => {
    const a = pointerAngleInPlane({ x: 1, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }, PIVOT, N, REF);
    expect(a).not.toBeNull();
    expect(a!).toBeCloseTo(0, 6);
  });
  it('平行平面之射線 → null', () => {
    expect(
      pointerAngleInPlane({ x: 1, y: 5, z: 0 }, { x: 1, y: 0, z: 0 }, PIVOT, N, REF),
    ).toBeNull();
  });
  it('交點在射線後方 → null', () => {
    expect(
      pointerAngleInPlane({ x: 1, y: 5, z: 0 }, { x: 0, y: 1, z: 0 }, PIVOT, N, REF),
    ).toBeNull();
  });
});

describe('dragToAngle', () => {
  it('掃掠 delta 加至起始角、範圍內不觸界', () => {
    // grab=0、current=π/2（+90°），start=0 → 90
    expect(dragToAngle(0, 0, Math.PI / 2, KNEE)).toEqual({ value: 90, atLimit: false });
  });
  it('超界鉗制（膝 max 140）', () => {
    // start=120、delta≈+90 → 210 → 夾 140
    const r = dragToAngle(120, 0, Math.PI / 2, KNEE);
    expect(r.value).toBe(140);
    expect(r.atLimit).toBe(true);
  });
  it('繞圈正規化防跳變（current−grab 越 180）', () => {
    // grab=170°、current=−170°：原始 delta −340° → 正規化 +20°
    const grab = (170 * Math.PI) / 180;
    const cur = (-170 * Math.PI) / 180;
    expect(dragToAngle(0, grab, cur, KNEE).value).toBeCloseTo(20, 6);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test -- dragRotation`
Expected: FAIL（模組不存在）。

- [ ] **Step 3: 實作**

Create `app/utils/humanModel/motion/dragRotation.ts`:

```ts
// 拖曳旋轉數學（04 §4.3.3 grab-and-turn）：指標投影至關節旋轉平面、量掃掠角、轉鉗制角度。
// 純函式、無 Babylon（向量以 Vec3 表）。node 可測。
import { type ClampResult, type DegreeOfFreedom, clampAngle } from './romClamp';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const RAD2DEG = 180 / Math.PI;

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function normalize(a: Vec3): Vec3 {
  const l = Math.sqrt(dot(a, a));
  return l > 1e-9 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: 0, z: 0 };
}

// 角度收斂至 (−180, 180]。
export function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

// 旋轉平面（法線 axis）之正交單位基底。
export function planeBasis(axis: Vec3): { u: Vec3; v: Vec3 } {
  const n = normalize(axis);
  const ref: Vec3 = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const u = normalize(cross(ref, n));
  const v = cross(n, u);
  return { u, v };
}

// 指標射線與旋轉平面（過 pivot、法線 planeNormal）求交，於平面內以 refDir 為基準量角（弧度）。
// 射線近乎平行平面或交點在後方 → null。
export function pointerAngleInPlane(
  rayOrigin: Vec3,
  rayDir: Vec3,
  pivot: Vec3,
  planeNormal: Vec3,
  refDir: Vec3,
): number | null {
  const n = normalize(planeNormal);
  const denom = dot(rayDir, n);
  if (Math.abs(denom) < 1e-6) return null;
  const t = dot(sub(pivot, rayOrigin), n) / denom;
  if (t < 0) return null;
  const hit: Vec3 = {
    x: rayOrigin.x + rayDir.x * t,
    y: rayOrigin.y + rayDir.y * t,
    z: rayOrigin.z + rayDir.z * t,
  };
  const w = sub(hit, pivot);
  // 平面內基底：u＝refDir 去除法線分量後正規化；v＝n×u。
  const proj = dot(refDir, n);
  const u = normalize(sub(refDir, { x: n.x * proj, y: n.y * proj, z: n.z * proj }));
  const vv = cross(n, u);
  return Math.atan2(dot(w, vv), dot(w, u));
}

// 掃掠角→鉗制角度：自抓取點之角度差（正規化防繞圈）加至起始角、鉗制於 ROM。
export function dragToAngle(
  startDeg: number,
  grabAngleRad: number,
  currentAngleRad: number,
  dof: Pick<DegreeOfFreedom, 'min' | 'max'>,
): ClampResult {
  const deltaDeg = normalizeDeg((currentAngleRad - grabAngleRad) * RAD2DEG);
  return clampAngle(dof, startDeg + deltaDeg);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test -- dragRotation`
Expected: PASS（4 describe / 9+ assertions）。

- [ ] **Step 5: Commit**

```bash
git add app/utils/humanModel/motion/dragRotation.ts app/utils/humanModel/motion/dragRotation.test.ts
git commit -m "feat(motion): 拖曳旋轉純函式 dragRotation（掃掠角→鉗制）"
```

---

## Task 2: mesh→關節反查（meshToJoint）

**Files:**
- Create: `app/utils/humanModel/motion/meshToJoint.ts`
- Test: `app/utils/humanModel/motion/meshToJoint.test.ts`

**Interfaces:**
- Consumes: `./jointKinematics` 之 `segmentMembershipAll`。
- Produces: `stripSide(meshName): string`、`jointForMesh(meshName): string | null`、`sideOfMesh(meshName): '#L' | '#R' | null`。

- [ ] **Step 1: 寫失敗測試**

Create `app/utils/humanModel/motion/meshToJoint.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { jointForMesh, sideOfMesh, stripSide } from './meshToJoint';

describe('meshToJoint', () => {
  it('stripSide 去 #L/#R 尾碼', () => {
    expect(stripSide('bone.tibia#L')).toBe('bone.tibia');
    expect(stripSide('bone.sacrum')).toBe('bone.sacrum');
  });
  it('sideOfMesh 取側別', () => {
    expect(sideOfMesh('bone.tibia#L')).toBe('#L');
    expect(sideOfMesh('bone.femur#R')).toBe('#R');
    expect(sideOfMesh('bone.sacrum')).toBeNull();
  });
  it('jointForMesh：節段成員→其控制關節', () => {
    expect(jointForMesh('bone.tibia#L')).toBe('joint.knee'); // 脛骨∈小腿（膝）
    expect(jointForMesh('bone.femur#R')).toBe('joint.hip'); // 股骨∈大腿（髖）
    expect(jointForMesh('bone.humerus')).toBe('joint.glenohumeral'); // 肱骨∈手臂（肩）
  });
  it('非任何節段成員（基座）→ null', () => {
    expect(jointForMesh('bone.sacrum')).toBeNull(); // 薦椎為脊椎樞紐 anchor、非節段成員
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test -- meshToJoint`
Expected: FAIL。

- [ ] **Step 3: 實作**

Create `app/utils/humanModel/motion/meshToJoint.ts`:

```ts
// mesh→關節反查（04 §4.3.3）：點選身體部位→其控制關節（節段）。純函式。
import { segmentMembershipAll } from './jointKinematics';

const SIDE_SUFFIX = /#([LR])$/;

let memo: ReadonlyMap<string, string> | null = null;
// anatomyId → 控制其之 segment jointId（一次建表）。
function reverseMap(): ReadonlyMap<string, string> {
  if (memo) return memo;
  const m = new Map<string, string>();
  for (const [jointId, ids] of segmentMembershipAll()) {
    for (const id of ids) m.set(id, jointId);
  }
  memo = m;
  return m;
}

export function stripSide(meshName: string): string {
  return meshName.replace(SIDE_SUFFIX, '');
}

export function jointForMesh(meshName: string): string | null {
  return reverseMap().get(stripSide(meshName)) ?? null;
}

export function sideOfMesh(meshName: string): '#L' | '#R' | null {
  const m = meshName.match(SIDE_SUFFIX);
  return m ? (`#${m[1]}` as '#L' | '#R') : null;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test -- meshToJoint`
Expected: PASS（4 tests）。若某 anatomyId 之歸屬與斷言不符，以 `SEGMENT_BONES`／`segmentForMuscle` 實際結果修正斷言（勿改 jointKinematics）。

- [ ] **Step 5: Commit**

```bash
git add app/utils/humanModel/motion/meshToJoint.ts app/utils/humanModel/motion/meshToJoint.test.ts
git commit -m "feat(motion): mesh→關節反查 meshToJoint"
```

---

## Task 3: articulationRig 暴露 getPivot

**Files:**
- Modify: `app/utils/humanModel/motion/articulationRig.ts`
- Test: `app/utils/humanModel/motion/articulationRig.test.ts`（補測）

**Interfaces:**
- Produces（介面新增）：`getPivot(jointId: string, side?: string | null): TransformNode | null`（回傳既有樞紐 `TransformNode`；無則 null）。

- [ ] **Step 1: 補失敗測試**

於 `app/utils/humanModel/motion/articulationRig.test.ts` 之 describe 區塊內新增（沿用其 `freshScene()`／NullEngine 設置）：

```ts
  it('getPivot 取既有樞紐節點、未知回 null、dispose 後清空', () => {
    const scene = freshScene();
    const rig = buildArticulationRig(scene);
    expect(rig.getPivot('joint.knee', '#L')).not.toBeNull();
    expect(rig.getPivot('joint.spine')).not.toBeNull(); // 中線（side 預設 null）
    expect(rig.getPivot('joint.nope')).toBeNull();
    rig.dispose();
    expect(rig.getPivot('joint.knee', '#L')).toBeNull();
  });
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test -- articulationRig`
Expected: FAIL（`getPivot` 不存在）。

- [ ] **Step 3: 實作**

於 `articulationRig.ts`：

(a) `ArticulationRig` 介面加一行：

```ts
  getPivot(jointId: string, side?: string | null): TransformNode | null;
```

(b) `buildArticulationRig` 內、`return { ... }` 之前加：

```ts
  function getPivot(jointId: string, side: string | null = null): TransformNode | null {
    return pivots.get(pivotKey(jointId, side)) ?? null;
  }
```

(c) `return` 物件加 `getPivot`：

```ts
  return { applyPose, dispose, pivotKeys: [...pivots.keys()], getPivot };
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test -- articulationRig`
Expected: PASS（含原測試＋新測試）。

- [ ] **Step 5: typecheck ＋ Commit**

```bash
pnpm typecheck
git add app/utils/humanModel/motion/articulationRig.ts app/utils/humanModel/motion/articulationRig.test.ts
git commit -m "feat(motion): articulationRig.getPivot 暴露樞紐節點"
```

Expected typecheck: EXIT 0。

---

## Task 4: 弧形拖曳手柄（jointGizmo，Babylon）

**Files:**
- Create: `app/utils/humanModel/motion/jointGizmo.ts`
- Test: `app/utils/humanModel/motion/jointGizmo.test.ts`

**Interfaces:**
- Consumes: `@babylonjs/core`、`./jointKinematics`（`JOINT_KINEMATICS`、`movableJointDof`）、`./motionPose`（`MotionPose`、`jointAngle`）、`./romClamp`（`clampAngle`）、`./dragRotation`（`dragToAngle`、`planeBasis`、`pointerAngleInPlane`、`Vec3`）。
- Produces:
  - `interface JointGizmoCallbacks { onAngle(jointId, axis, deg): void; onDragStart(): void; onDragEnd(): void; getPoseAngle(jointId, axis): number }`
  - `interface JointGizmo { update(pose: MotionPose): void; dispose(): void }`
  - `createJointGizmo(scene: Scene, pivot: TransformNode, jointId: string, cb: JointGizmoCallbacks): JointGizmo`

說明：逐 DOF 於 `pivot` 下建一 120° 弧 tube（臥於該 DOF 旋轉平面，basis 取 `planeBasis(worldAxis)`），`isPickable`、`metadata.gizmoAxis`。pointer：`POINTERDOWN` 命中弧→固定當下旋轉平面（世界法線/refDir/pivot 位置）＋記抓取角與起始 pose 角、`onDragStart`；`POINTERMOVE` 拖曳中→`dragToAngle`→`onAngle`；`POINTERUP`→`onDragEnd`。`update(pose)` 依 `clampAngle.atLimit` 著色（accent／琥珀）。

- [ ] **Step 1: 寫失敗測試**

Create `app/utils/humanModel/motion/jointGizmo.test.ts`:

```ts
import { Color3, NullEngine, type StandardMaterial, TransformNode } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createModelScene } from '../render/sceneCore';
import { NEUTRAL_POSE, setJointAngle } from './motionPose';
import { createJointGizmo } from './jointGizmo';

const NOOP_CB = {
  onAngle: () => {},
  onDragStart: () => {},
  onDragEnd: () => {},
  getPoseAngle: () => 0,
};

describe('jointGizmo（弧手柄建構；NullEngine）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function fresh() {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    const pivot = new TransformNode('pivot:test', scene);
    return { scene, pivot };
  }

  it('肩（3 DOF）建 3 弧、掛於 pivot、帶 axis metadata', () => {
    const { scene, pivot } = fresh();
    const g = createJointGizmo(scene, pivot, 'joint.glenohumeral', NOOP_CB);
    const arcs = scene.meshes.filter((m) => m.name.startsWith('gizmo:joint.glenohumeral'));
    expect(arcs).toHaveLength(3);
    expect(arcs.every((a) => a.parent === pivot)).toBe(true);
    expect(arcs.every((a) => typeof a.metadata?.gizmoAxis === 'string')).toBe(true);
    g.dispose();
  });

  it('膝（1 DOF）建 1 弧', () => {
    const { scene, pivot } = fresh();
    const g = createJointGizmo(scene, pivot, 'joint.knee', NOOP_CB);
    expect(scene.meshes.filter((m) => m.name.startsWith('gizmo:joint.knee'))).toHaveLength(1);
    g.dispose();
  });

  it('update：觸 ROM 邊界轉琥珀、範圍內回 accent', () => {
    const { scene, pivot } = fresh();
    const g = createJointGizmo(scene, pivot, 'joint.knee', NOOP_CB);
    const arc = scene.meshes.find((m) => m.name.startsWith('gizmo:joint.knee'))!;
    const mat = arc.material as StandardMaterial;
    g.update(setJointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension', 140)); // max
    expect(mat.emissiveColor.equals(Color3.FromHexString('#b26a00'))).toBe(true);
    g.update(setJointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension', 45));
    expect(mat.emissiveColor.equals(Color3.FromHexString('#0e7490'))).toBe(true);
    g.dispose();
  });

  it('dispose 移除弧 mesh', () => {
    const { scene, pivot } = fresh();
    const g = createJointGizmo(scene, pivot, 'joint.knee', NOOP_CB);
    g.dispose();
    expect(scene.meshes.filter((m) => m.name.startsWith('gizmo:joint.knee'))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test -- jointGizmo`
Expected: FAIL。

- [ ] **Step 3: 實作**

Create `app/utils/humanModel/motion/jointGizmo.ts`:

```ts
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
      arcs.push({ axis: dof.axis, mesh, material, localAxis, localRef: u });
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
  } | null = null;

  function worldDir(local: Vec3): Vec3 {
    const out = Vector3.TransformNormal(new Vector3(local.x, local.y, local.z), pivot.getWorldMatrix());
    out.normalize();
    return toVec3(out);
  }
  function ray(): { origin: Vec3; dir: Vec3 } {
    const r = scene.createPickingRay(scene.pointerX, scene.pointerY, Matrix.Identity(), scene.activeCamera);
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
      drag = { axis: entry.axis, pivotPos, normal, ref, grabAngle: grab, startDeg: cb.getPoseAngle(jointId, entry.axis) };
      cb.onDragStart();
    } else if (info.type === PointerEventTypes.POINTERMOVE && drag) {
      const r = ray();
      const cur = pointerAngleInPlane(r.origin, r.dir, drag.pivotPos, drag.normal, drag.ref);
      if (cur === null) return;
      const dof = movableJointDof(jointId, drag.axis);
      if (!dof) return;
      cb.onAngle(jointId, drag.axis, dragToAngle(drag.startDeg, drag.grabAngle, cur, dof).value);
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
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test -- jointGizmo`
Expected: PASS（4 tests）。

- [ ] **Step 5: typecheck ＋ Commit**

```bash
pnpm typecheck
git add app/utils/humanModel/motion/jointGizmo.ts app/utils/humanModel/motion/jointGizmo.test.ts
git commit -m "feat(motion): 弧形拖曳手柄 jointGizmo（建構/拖曳/觸界著色）"
```

---

## Task 5: 手柄生命週期控制器（gizmoController）＋ rigController.getPivot

**Files:**
- Create: `app/utils/humanModel/motion/gizmoController.ts`
- Test: `app/utils/humanModel/motion/gizmoController.test.ts`
- Modify: `app/utils/humanModel/motion/rigController.ts`

**Interfaces:**
- Consumes: `./jointGizmo`（`createJointGizmo`、`JointGizmo`、`JointGizmoCallbacks`）、`./motionPose`（`MotionPose`）、`@babylonjs/core`（`Scene`、`TransformNode`）。
- Produces:
  - `rigController`：`RigController` 介面新增 `getPivot(jointId: string, side?: string | null): TransformNode | null`。
  - `gizmoController`：`createGizmoController(scene, getPivot, cb): GizmoController`，`GizmoController { sync(motionMode, jointId, side, pose): void; dispose(): void }`。

- [ ] **Step 1: rigController.getPivot（先補，gizmoController 依賴）**

於 `rigController.ts`：

(a) import 加 `TransformNode`（type-only）：

```ts
import type { Scene, TransformNode } from '@babylonjs/core';
```

(b) `RigController` 介面加：

```ts
  getPivot(jointId: string, side?: string | null): TransformNode | null;
```

(c) `createRigController` 內 `return` 前加：

```ts
  function getPivot(jointId: string, side: string | null = null): TransformNode | null {
    return rig?.getPivot(jointId, side) ?? null;
  }
```

(d) `return { sync, dispose }` → `return { sync, dispose, getPivot }`。

- [ ] **Step 2: 寫 gizmoController 失敗測試**

Create `app/utils/humanModel/motion/gizmoController.test.ts`:

```ts
import { NullEngine } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { anatomyEntities } from '@ptapp/definitions';
import { buildPlaceholderBody, createModelScene } from '../render/sceneCore';
import { buildArticulationRig } from './articulationRig';
import { NEUTRAL_POSE } from './motionPose';
import { createGizmoController } from './gizmoController';

const NOOP_CB = {
  onAngle: () => {},
  onDragStart: () => {},
  onDragEnd: () => {},
  getPoseAngle: () => 0,
};

describe('gizmoController（手柄生命週期；NullEngine）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function fresh() {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    buildPlaceholderBody(scene, anatomyEntities);
    const rig = buildArticulationRig(scene);
    return { scene, rig };
  }

  it('motionMode+joint 建手柄；關閉拆除', () => {
    const { scene, rig } = fresh();
    const ctrl = createGizmoController(scene, (j, s) => rig.getPivot(j, s), NOOP_CB);
    ctrl.sync(true, 'joint.knee', '#L', NEUTRAL_POSE);
    expect(scene.meshes.some((m) => m.name.startsWith('gizmo:joint.knee'))).toBe(true);
    ctrl.sync(false, null, null, NEUTRAL_POSE);
    expect(scene.meshes.some((m) => m.name.startsWith('gizmo:'))).toBe(false);
    ctrl.dispose();
    rig.dispose();
  });

  it('改選關節重建手柄', () => {
    const { scene, rig } = fresh();
    const ctrl = createGizmoController(scene, (j, s) => rig.getPivot(j, s), NOOP_CB);
    ctrl.sync(true, 'joint.knee', '#L', NEUTRAL_POSE);
    ctrl.sync(true, 'joint.hip', '#L', NEUTRAL_POSE);
    expect(scene.meshes.some((m) => m.name.startsWith('gizmo:joint.knee'))).toBe(false);
    expect(scene.meshes.some((m) => m.name.startsWith('gizmo:joint.hip'))).toBe(true);
    ctrl.dispose();
    rig.dispose();
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm test -- gizmoController`
Expected: FAIL（`createGizmoController` 不存在）。

- [ ] **Step 4: 實作 gizmoController**

Create `app/utils/humanModel/motion/gizmoController.ts`:

```ts
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
      if (pivot && jointId) gizmo = createJointGizmo(scene, pivot, jointId, cb);
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
```

- [ ] **Step 5: 跑測試確認通過 ＋ typecheck**

Run: `pnpm test -- gizmoController rigController` then `pnpm typecheck`
Expected: PASS（gizmoController 2 tests、rigController 既有不退步）、typecheck EXIT 0。

- [ ] **Step 6: Commit**

```bash
git add app/utils/humanModel/motion/gizmoController.ts app/utils/humanModel/motion/gizmoController.test.ts app/utils/humanModel/motion/rigController.ts
git commit -m "feat(motion): gizmoController 手柄生命週期＋rigController.getPivot 委派"
```

---

## Task 6: Model3DView 接線手柄＋pointer 分流＋相機 detach

**Files:**
- Modify: `app/components/humanModel/Model3DView.vue`

**Interfaces:**
- Consumes: Task 5 `createGizmoController`/`GizmoController`、Task 2 `jointForMesh`/`sideOfMesh`、`./motionPose` `jointAngle`、`./jointKinematics` `movableJointDof`。
- Produces（新增 props/emits）：prop `motionJoint?: string`；emits `setJointAngle: [jointId, axis, deg]`、`selectMotionJoint: [jointId]`。

> 無新單元測試（Babylon 元件接線）；以 `pnpm typecheck` ＋全測試不退步把關。拖曳手感／相機 detach 時機須實機 QA。

- [ ] **Step 1: imports（接其他 motion import 之後）**

```ts
import { createGizmoController, type GizmoController } from '../../utils/humanModel/motion/gizmoController';
import { jointForMesh, sideOfMesh } from '../../utils/humanModel/motion/meshToJoint';
import { jointAngle } from '../../utils/humanModel/motion/motionPose';
import { movableJointDof } from '../../utils/humanModel/motion/jointKinematics';
```

- [ ] **Step 2: Props/emits**

(a) `Props` 介面加：`motionJoint?: string;`
(b) `withDefaults` 加：`motionJoint: undefined,`
(c) `defineEmits` 加：

```ts
  setJointAngle: [jointId: string, axis: string, deg: number];
  selectMotionJoint: [jointId: string];
```

- [ ] **Step 3: 閉包變數（接 `let rigController …` 旁）**

```ts
let gizmoController: GizmoController | null = null;
let gizmoDragging = false;
// 拖曳/面板選關節時手柄置放側（由點選側決定；面板選取之雙側關節預設 #R）。
let motionSide: string | null = '#R';
```

- [ ] **Step 4: pointer 觀察者分流**

找到既有 `POINTERTAP` 觀察者（`builtScene.onPointerObservable.add((pointerInfo) => { … }, PointerEventTypes.POINTERTAP)`），將其 callback 內容改為依 motionMode 分流：

```ts
    builtScene.onPointerObservable.add((pointerInfo) => {
      const pickInfo = pointerInfo.pickInfo;
      if (props.motionMode) {
        // 運動模式：點身體部位→選其控制關節（忽略手柄弧之點按；拖曳剛結束之 tap 不誤選）。
        if (gizmoDragging) return;
        const name = pickInfo?.pickedMesh?.name;
        if (!name) return;
        const joint = jointForMesh(name);
        if (joint !== null) {
          motionSide = sideOfMesh(name) ?? '#R';
          emit('selectMotionJoint', joint);
        }
        return;
      }
      const key = partKeyFromPick(pickInfo);
      if (key !== null) emit('select', key);
      else if (isBackgroundPick(pickInfo)) emit('backgroundClick');
    }, PointerEventTypes.POINTERTAP);
```

（`partKeyFromPick`／`isBackgroundPick` 已 import；保留非運動模式原行為。）

- [ ] **Step 5: 建 gizmoController（填充 `.then()` 內、`rigController.sync(...)` 之後）**

```ts
        gizmoController = createGizmoController(
          builtScene,
          (j, s) => rigController?.getPivot(j, s) ?? null,
          {
            onAngle: (j, a, d) => emit('setJointAngle', j, a, d),
            onDragStart: () => {
              gizmoDragging = true;
              builtCamera.detachControl();
            },
            onDragEnd: () => {
              gizmoDragging = false;
              builtCamera.attachControl(canvas, true);
            },
            getPoseAngle: (j, a) =>
              jointAngle(props.pose ?? {}, j, a, movableJointDof(j, a)?.neutral ?? 0),
          },
        );
        gizmoController.sync(props.motionMode, props.motionJoint ?? null, motionSide, props.pose ?? {});
```

（`builtCamera`／`canvas` 為該 effect 既有區域變數。）

- [ ] **Step 6: watch 同步（既有 `[props.motionMode, props.pose]` watch 擴充為含 motionJoint）**

將既有運動 watch 改為：

```ts
watch(
  () => [props.motionMode, props.motionJoint, props.pose] as const,
  () => {
    if (rigController) rigController.sync(props.motionMode, props.pose ?? {});
    if (gizmoController) {
      gizmoController.sync(props.motionMode, props.motionJoint ?? null, motionSide, props.pose ?? {});
    }
  },
);
```

- [ ] **Step 7: 卸載清理（`onBeforeUnmount` 內、`rigController?.dispose()` 旁）**

```ts
    gizmoController?.dispose();
    gizmoController = null;
```

- [ ] **Step 8: typecheck ＋ 全測試不退步**

Run: `pnpm typecheck && pnpm test`
Expected: EXIT 0；全套件 PASS（含前述新測試）。

- [ ] **Step 9: Commit**

```bash
git add app/components/humanModel/Model3DView.vue
git commit -m "feat(motion): Model3DView 接線拖曳手柄（pointer 分流＋相機 detach）"
```

---

## Task 7: Model3DViewer 透傳手柄選取／拖曳

**Files:**
- Modify: `app/components/humanModel/Model3DViewer.vue`

**Interfaces:**
- Produces: 將 `motionJoint` 傳入 `Model3DView`；forward `Model3DView` 之 `@set-joint-angle`→既有 `setJointAngle` emit、`@select-motion-joint`→既有 `motionJointChange` emit。

> `Model3DViewer` 既有 props（`motionMode`/`pose`/`motionJoint`）與 emits（`setJointAngle`/`motionJointChange`）已備（運動 v1）；本 task 僅補 `Model3DView` 子元件之接線。

- [ ] **Step 1: 接線 `Model3DView` 元件**

找到 template 內 `<Model3DView … />`（含 `:motion-mode="motionMode"`、`:pose="pose"`），加：

```vue
            :motion-joint="motionJoint"
            @set-joint-angle="(j, a, d) => emit('setJointAngle', j, a, d)"
            @select-motion-joint="emit('motionJointChange', $event)"
```

（`motionJoint` prop、`setJointAngle`／`motionJointChange` emits 皆已存在於 `Model3DViewer`；此處僅將 `Model3DView` 之事件接上。）

- [ ] **Step 2: typecheck ＋ 既有測試不退步**

Run: `pnpm typecheck && pnpm test -- ModelViewer Model3DControls`
Expected: EXIT 0、PASS。

- [ ] **Step 3: dev 目視冒煙（人工，非自動）**

Run `pnpm dev`，開 `/patients/<任一>/model`→開「關節活動」→點小腿（選膝）→應現膝弧手柄→拖弧→小腿屈曲且止於 ROM、觸界轉琥珀、滑桿同步；拖曳時不誤環繞相機。記錄觀察；軸方向異常屬既知待校正項（不在本 task 修）。

- [ ] **Step 4: Commit**

```bash
git add app/components/humanModel/Model3DViewer.vue
git commit -m "feat(motion): Model3DViewer 透傳拖曳手柄選取/角度"
```

---

## Task 8: 設計同步（§4.3.3）

**Files:**
- Modify: `doc/design/04_human_model.md`（§4.3.3）

- [ ] **Step 1: 改寫 §4.3.3 拖曳段落**

於 §4.3.3：將「延後」清單中之 **on-model 拖曳手柄** 移出，改述為已落實：
- 互動：運動模式下點身體部位選其控制關節，關節樞紐現**自訂弧形手柄**（逐 DOF 一弧）；**grab-and-turn** 拖曳（指標投影旋轉平面、掃掠角）驅動旋轉、`clampAngle` 鉗制於 ROM、觸 ROM 邊界弧轉琥珀＋文字提示；滑桿與手柄雙向同步（同源 `pose`）。拖曳時 detach 相機免誤環繞。
- 仍為**待**：軸／sign 實機目視校正、per-side 獨立（現雙側對稱）、其餘關節、肌肉著色、真骨架、平滑多椎脊椎。
- 連結工作規格 `doc/design/specs/2026-06-18-motion-drag-handles-design.md`。
保留其餘 §4.3.3 內容（剛性節段、ROM 資料驅動等）。

- [ ] **Step 2: Commit**

```bash
git add doc/design/04_human_model.md
git commit -m "docs: §4.3.3 on-model 拖曳手柄已落實（設計同步）"
```

---

## Self-Review Notes（作者自核）

- **Spec 覆蓋**：§3.1 dragRotation/meshToJoint（Task 1–2）、§3.2 getPivot（Task 3）、§3.3 jointGizmo（Task 4）＋gizmoController（Task 5）、§4 弧細節（Task 4）、§5 互動/資料流（Task 6–7，page 既有）、§6 檔案、§7 測試（各 task 測試步）、§8 範圍外（Task 8 標注待辦）、§10 文件同步（Task 8）皆有對應。
- **型別一致**：`Vec3`、`planeBasis{u,v}`、`pointerAngleInPlane(...)→number|null`、`dragToAngle(...)→ClampResult`、`JointGizmoCallbacks`、`JointGizmo`、`GizmoController`、`getPivot(jointId, side?)`、emit `setJointAngle(jointId,axis,deg)`／`selectMotionJoint(jointId)` 跨 task 一致。
- **無 placeholder**：每 code step 附完整內容。
- **既知校正/QA 點**（非 placeholder）：弧尺度/弧長常數、拖曳手感、相機 detach 時機（若 jank 可改 `PointerDragBehavior`）、軸/sign 方向 — 皆實機 QA 項，已於 Task 7 Step 3 與 §8 標注。
