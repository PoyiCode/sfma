# 執行期 skin 變形驅動 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 載入帶真骨架的 GLB 時，以同一 `pose` 驅動 Babylon `Skeleton` bones 使 mesh 軟變形（取代剛性節段）；無骨架資產（現役出貨）仍走剛性路、行為不變。

**Architecture:** 新增 `boneRig.ts`（實作既有 `ArticulationRig` 介面的骨骼驅動實作）＋ `boneRigMap.ts`（jointId→bone＋per-DOF 區域軸/正負資料表）。`rigController.ts` 成為唯一路徑選擇 seam：偵測可驅動骨架則 `buildBoneRig`、否則 `buildArticulationRig`。下游（`Model3DView`／`gizmoController`／`muscleShading`）因共用 `ArticulationRig` 介面與 `pose` seam 而零改動。v1 ship-dark：以程式建構的 NullEngine 骨架 fixture TDD，真 rigged 資產到位即自動亮。

**Tech Stack:** Nuxt 4 / Vue 3 SPA、Babylon.js（`@babylonjs/core`，`Skeleton`/`Bone`/`Space.LOCAL`、NullEngine 測試）、Vitest（node 環境）、pnpm。

設計來源：[skin 變形執行期驅動 spec](specs/2026-06-19-skin-deformation-runtime-design.md)。前置脈絡：[運動模式](specs/2026-06-18-motion-mode-design.md)、[左右側別獨立](specs/2026-06-19-motion-per-side-design.md)、[肌肉著色](specs/2026-06-19-muscle-shading-design.md)。

## Global Constraints

- **pnpm only**（勿用 npm/yarn）。Node ≥ 20。
- 命名：camelCase（變數/函式）、PascalCase（型別/元件）、UPPER_CASE（常數）；**嚴禁 snake_case**（eslint 強制）。
- 程式註解與文件一律 **zh-tw**。
- **勿改 `packages/shared`／`packages/definitions`**（純沿用層）；ROM 資料讀 `@ptapp/definitions`，不新增。
- 場景圖測試一律 **NullEngine**；純函式/資料測試 node 環境（無 docblock）。
- 單元測試：`pnpm test`（vitest node，排除 `*.nuxt.test.ts`）。
- **設計同步必守**：本功能落地時同步更新 `doc/design/04_human_model.md` §4.3.3 與 `doc/todo`（見 Task 5）。
- **bone 驅動不 reparent mesh**：僅改 bone 區域旋轉；剛性路（`articulationRig.ts`）仍為唯一 reparent 者；兩者由 `rigController` 擇一、互斥。
- bone 路徑 v1：`getPivot` 一律回 `null`（gizmo 視覺手柄擺位延後）、`pivotKeys` 回 `[]`；滑桿仍經共用 `pose` seam 驅動。
- 真骨架之 bone 名與 bone-local 軸/正負為 **placeholder（延後實機校正）**；fixture 用 identity rest 使測試確定。

---

### Task 1: `boneRigMap.ts` — jointId→bone＋per-DOF 區域軸/正負 資料表

**Files:**
- Create: `app/utils/humanModel/motion/boneRigMap.ts`
- Test: `app/utils/humanModel/motion/boneRigMap.test.ts`

**Interfaces:**
- Consumes: `AxisVec` from `./jointKinematics`；`MOVABLE_JOINT_IDS`、`JOINT_KINEMATICS`、`movableJointDof` from `./jointKinematics`（測試用）。
- Produces:
  - `export interface BoneDofMapping { localAxis: AxisVec; sign: 1 | -1 }`
  - `export interface BoneJointMapping { bone: string; dofs: Readonly<Record<string, BoneDofMapping>> }`
  - `export const BONE_RIG_MAP: Readonly<Record<string, BoneJointMapping>>`（涵蓋 6 SFMA 關節）

- [ ] **Step 1: 寫失敗測試**

`app/utils/humanModel/motion/boneRigMap.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { BONE_RIG_MAP } from './boneRigMap';
import { JOINT_KINEMATICS, MOVABLE_JOINT_IDS, movableJointDof } from './jointKinematics';

describe('BONE_RIG_MAP（骨骼驅動資料表）', () => {
  it('每個可動關節都有對應', () => {
    for (const jid of MOVABLE_JOINT_IDS) {
      expect(BONE_RIG_MAP[jid], jid).toBeDefined();
    }
  });

  it('每關節 DOF 軸集合＝剛性路 JOINT_KINEMATICS、且各對齊 definitions degreesOfFreedom', () => {
    for (const jid of MOVABLE_JOINT_IDS) {
      const boneAxes = Object.keys(BONE_RIG_MAP[jid]!.dofs).sort();
      const rigidAxes = JOINT_KINEMATICS[jid]!.dofs.map((d) => d.axis).sort();
      expect(boneAxes, jid).toEqual(rigidAxes);
      for (const axis of boneAxes) {
        expect(movableJointDof(jid, axis), `${jid}/${axis}`).toBeDefined();
      }
    }
  });

  it('localAxis 為單位主軸、sign ∈ {1,-1}', () => {
    for (const jid of MOVABLE_JOINT_IDS) {
      for (const [axis, m] of Object.entries(BONE_RIG_MAP[jid]!.dofs)) {
        const sq = m.localAxis[0] ** 2 + m.localAxis[1] ** 2 + m.localAxis[2] ** 2;
        expect(sq, `${jid}/${axis} unit`).toBe(1);
        expect([1, -1], `${jid}/${axis} sign`).toContain(m.sign);
      }
    }
  });

  it('bone 名非空且非 anatomyId 形式（不以 bone./joint. 起頭）', () => {
    for (const jid of MOVABLE_JOINT_IDS) {
      const bone = BONE_RIG_MAP[jid]!.bone;
      expect(bone.length, jid).toBeGreaterThan(0);
      expect(bone.startsWith('bone.') || bone.startsWith('joint.'), jid).toBe(false);
    }
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test app/utils/humanModel/motion/boneRigMap.test.ts`
Expected: FAIL（`Cannot find module './boneRigMap'`）

- [ ] **Step 3: 實作 `boneRigMap.ts`**

```ts
// 骨骼驅動資料表（04 §4.3.3 skin 變形）：每個可動關節對應一根 MakeHuman armature bone
// （base 名、雙側於解析時補 .L/.R）＋每個 DOF 之 bone-local 旋轉軸與正負號。
// 與剛性路 JOINT_KINEMATICS[*].pivot.bone（骨 mesh 的 anatomyId）語意不同。
// 軸/正負起始值比照剛性路 worldAxis/sign；真骨架 bone 名與 bone-local 軸/正負為 placeholder、
// 待真資產實機目視校正（與現役 world-sign 校正同軌）。脊椎/頸椎以單一代表 bone（多椎延後）。
import type { AxisVec } from './jointKinematics';

export interface BoneDofMapping {
  // bone 區域座標之旋轉軸（單位主軸）
  localAxis: AxisVec;
  // 正角度方向（待實機校正）
  sign: 1 | -1;
}

export interface BoneJointMapping {
  // MakeHuman armature bone 之 base 名（雙側於 resolveBoneName 補 .L/.R；單側用裸名）
  bone: string;
  // 對齊 definitions joint.degreesOfFreedom[].axis
  dofs: Readonly<Record<string, BoneDofMapping>>;
}

const X: AxisVec = [1, 0, 0];
const Y: AxisVec = [0, 1, 0];
const Z: AxisVec = [0, 0, 1];

export const BONE_RIG_MAP: Readonly<Record<string, BoneJointMapping>> = {
  'joint.hip': {
    bone: 'upperleg01',
    dofs: {
      flexionExtension: { localAxis: X, sign: -1 },
      abductionAdduction: { localAxis: Z, sign: 1 },
      internalExternalRotation: { localAxis: Y, sign: 1 },
    },
  },
  'joint.knee': {
    bone: 'lowerleg01',
    dofs: {
      flexionExtension: { localAxis: X, sign: 1 },
    },
  },
  'joint.ankle': {
    bone: 'foot',
    dofs: {
      plantarDorsiflexion: { localAxis: X, sign: 1 },
      inversionEversion: { localAxis: Z, sign: 1 },
    },
  },
  'joint.glenohumeral': {
    bone: 'upperarm01',
    dofs: {
      flexionExtension: { localAxis: X, sign: -1 },
      abductionAdduction: { localAxis: Z, sign: 1 },
      internalExternalRotation: { localAxis: Y, sign: 1 },
    },
  },
  'joint.cervicalSpine': {
    bone: 'neck01',
    dofs: {
      flexionExtension: { localAxis: X, sign: 1 },
      lateralFlexion: { localAxis: Z, sign: 1 },
      rotation: { localAxis: Y, sign: 1 },
    },
  },
  'joint.spine': {
    bone: 'spine01',
    dofs: {
      flexionExtension: { localAxis: X, sign: 1 },
      lateralFlexion: { localAxis: Z, sign: 1 },
      rotation: { localAxis: Y, sign: 1 },
    },
  },
};
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test app/utils/humanModel/motion/boneRigMap.test.ts`
Expected: PASS（4 個測試）

- [ ] **Step 5: Commit**（含本 session 已寫之 spec＋plan 文件，作為分支首 commit 之一）

```bash
git add app/utils/humanModel/motion/boneRigMap.ts app/utils/humanModel/motion/boneRigMap.test.ts \
        doc/design/specs/2026-06-19-skin-deformation-runtime-design.md \
        doc/design/plans/2026-06-19-skin-deformation-runtime.md
git commit -m "feat(motion): 骨骼驅動資料表 BONE_RIG_MAP（skin 變形 §4.3.3）"
```

---

### Task 2: `boneRig.ts` — 骨骼驅動 rig（同 `ArticulationRig` 介面）＋測試 fixture

**Files:**
- Create: `app/utils/humanModel/motion/boneRig.ts`
- Create: `app/utils/humanModel/motion/boneRigFixture.ts`（測試用 fixture，僅由測試 import）
- Test: `app/utils/humanModel/motion/boneRig.test.ts`

**Interfaces:**
- Consumes:
  - `ArticulationRig` from `./articulationRig`（`{ applyPose(pose): void; dispose(): void; pivotKeys: readonly string[]; getPivot(jointId, side?): TransformNode | null }`）
  - `MotionPose`、`jointAngle` from `./motionPose`
  - `JOINT_KINEMATICS`、`MOVABLE_JOINT_IDS`、`movableJointDof`、`poseKey` from `./jointKinematics`
  - `BONE_RIG_MAP` from `./boneRigMap`
- Produces:
  - `export function resolveBoneName(base: string, side: string | null): string`
  - `export function hasDrivableSkeleton(scene: Scene): boolean`
  - `export function buildBoneRig(scene: Scene): ArticulationRig`
  - `boneRigFixture.ts`：`export function makeBoneRigFixture(scene: Scene): { skeleton: Skeleton; mesh: Mesh }`（建含 hip/knee 雙側＋spine 單側 bone、identity rest、附 skinned mesh 之骨架）

- [ ] **Step 1: 寫測試 fixture（非測試框架檔、供兩個測試共用）**

`app/utils/humanModel/motion/boneRigFixture.ts`：

```ts
// 測試用骨架 fixture（僅由 *.test.ts import）：建一具含髖/膝雙側＋脊椎單側 bone、
// identity rest 之 Skeleton 並附 skinned mesh，使 scene.skeletons 填充、bone 名比照
// resolveBoneName 慣例。供 boneRig／rigController 測試以已知朝向確定驗證。
import { Bone, Matrix, Mesh, type Scene, Skeleton } from '@babylonjs/core';
import { BONE_RIG_MAP } from './boneRigMap';
import { resolveBoneName } from './boneRig';

export function makeBoneRigFixture(scene: Scene): { skeleton: Skeleton; mesh: Mesh } {
  const skeleton = new Skeleton('rig', 'rig', scene);
  const names = [
    resolveBoneName(BONE_RIG_MAP['joint.hip']!.bone, '#L'),
    resolveBoneName(BONE_RIG_MAP['joint.hip']!.bone, '#R'),
    resolveBoneName(BONE_RIG_MAP['joint.knee']!.bone, '#L'),
    resolveBoneName(BONE_RIG_MAP['joint.knee']!.bone, '#R'),
    resolveBoneName(BONE_RIG_MAP['joint.spine']!.bone, null),
  ];
  for (const name of names) new Bone(name, skeleton, null, Matrix.Identity());
  const mesh = new Mesh('skinned', scene);
  mesh.skeleton = skeleton;
  return { skeleton, mesh };
}
```

- [ ] **Step 2: 寫失敗測試**

`app/utils/humanModel/motion/boneRig.test.ts`：

```ts
import { NullEngine, Quaternion, Space, Vector3 } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createModelScene } from '../render/sceneCore';
import { NEUTRAL_POSE, setJointAngle } from './motionPose';
import { BONE_RIG_MAP } from './boneRigMap';
import { buildBoneRig, hasDrivableSkeleton, resolveBoneName } from './boneRig';
import { makeBoneRigFixture } from './boneRigFixture';

const DEG2RAD = Math.PI / 180;

// 兩四元數是否表示同一旋轉（含 q≡−q）。
function sameRotation(a: Quaternion, b: Quaternion, eps = 1e-4): boolean {
  return Math.abs(Math.abs(Quaternion.Dot(a, b)) - 1) < eps;
}

describe('boneRig（骨骼驅動，NullEngine）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function freshScene() {
    engine = new NullEngine();
    return createModelScene(engine);
  }
  function boneByName(scene: ReturnType<typeof freshScene>, name: string) {
    return scene.skeletons[0]!.bones.find((b) => b.name === name)!;
  }

  it('resolveBoneName：雙側補 .L/.R、單側用裸名', () => {
    expect(resolveBoneName('upperleg01', '#L')).toBe('upperleg01.L');
    expect(resolveBoneName('upperleg01', '#R')).toBe('upperleg01.R');
    expect(resolveBoneName('spine01', null)).toBe('spine01');
  });

  it('hasDrivableSkeleton：有 fixture 骨架→true、空場景→false', () => {
    const scene = freshScene();
    expect(hasDrivableSkeleton(scene)).toBe(false);
    makeBoneRigFixture(scene);
    expect(hasDrivableSkeleton(scene)).toBe(true);
  });

  it('applyPose：膝屈曲套至對應側 bone 之區域旋轉（正確軸/正負）', () => {
    const scene = freshScene();
    makeBoneRigFixture(scene);
    const rig = buildBoneRig(scene);
    rig.applyPose(setJointAngle(NEUTRAL_POSE, 'joint.knee#R', 'flexionExtension', 90));
    const m = BONE_RIG_MAP['joint.knee']!.dofs.flexionExtension!;
    const expected = Quaternion.RotationAxis(
      new Vector3(m.localAxis[0], m.localAxis[1], m.localAxis[2]),
      90 * m.sign * DEG2RAD,
    );
    const bone = boneByName(scene, resolveBoneName('lowerleg01', '#R'));
    expect(sameRotation(bone.getRotationQuaternion(Space.LOCAL), expected)).toBe(true);
    // 另一側未驅動→仍為 rest（identity）
    const other = boneByName(scene, resolveBoneName('lowerleg01', '#L'));
    expect(sameRotation(other.getRotationQuaternion(Space.LOCAL), Quaternion.Identity())).toBe(true);
  });

  it('applyPose：同 bone 多 DOF 依 dofs 順序相乘', () => {
    const scene = freshScene();
    makeBoneRigFixture(scene);
    const rig = buildBoneRig(scene);
    let pose = setJointAngle(NEUTRAL_POSE, 'joint.hip#R', 'flexionExtension', 30);
    pose = setJointAngle(pose, 'joint.hip#R', 'abductionAdduction', 20);
    rig.applyPose(pose);
    const d = BONE_RIG_MAP['joint.hip']!.dofs;
    const flex = Quaternion.RotationAxis(
      new Vector3(...d.flexionExtension!.localAxis),
      30 * d.flexionExtension!.sign * DEG2RAD,
    );
    const abd = Quaternion.RotationAxis(
      new Vector3(...d.abductionAdduction!.localAxis),
      20 * d.abductionAdduction!.sign * DEG2RAD,
    );
    // rest(identity) ∘ flex ∘ abd，順序＝Object.entries(dofs) 插入序
    const expected = Quaternion.Identity().multiply(flex).multiply(abd);
    const bone = boneByName(scene, resolveBoneName('upperleg01', '#R'));
    expect(sameRotation(bone.getRotationQuaternion(Space.LOCAL), expected)).toBe(true);
  });

  it('dispose：受驅動 bone 還原 rest（identity）', () => {
    const scene = freshScene();
    makeBoneRigFixture(scene);
    const rig = buildBoneRig(scene);
    rig.applyPose(setJointAngle(NEUTRAL_POSE, 'joint.knee#R', 'flexionExtension', 90));
    rig.dispose();
    const bone = boneByName(scene, resolveBoneName('lowerleg01', '#R'));
    expect(sameRotation(bone.getRotationQuaternion(Space.LOCAL), Quaternion.Identity())).toBe(true);
  });

  it('getPivot 回 null、pivotKeys 為空（gizmo 擺位延後）', () => {
    const scene = freshScene();
    makeBoneRigFixture(scene);
    const rig = buildBoneRig(scene);
    expect(rig.getPivot('joint.knee', '#R')).toBeNull();
    expect(rig.pivotKeys).toEqual([]);
  });

  it('解析不到之關節安全跳過（fixture 無踝/肩/頸 bone→無錯）', () => {
    const scene = freshScene();
    makeBoneRigFixture(scene);
    const rig = buildBoneRig(scene);
    expect(() =>
      rig.applyPose(setJointAngle(NEUTRAL_POSE, 'joint.ankle#R', 'plantarDorsiflexion', 20)),
    ).not.toThrow();
  });
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm test app/utils/humanModel/motion/boneRig.test.ts`
Expected: FAIL（`Cannot find module './boneRig'`；注意 `boneRigFixture.ts` import 自 `./boneRig`，故先建 `boneRig.ts`）

- [ ] **Step 4: 實作 `boneRig.ts`**

```ts
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
  type TransformNode,
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
  rest: Quaternion;
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
        driven.push({ jointId, side, bone, rest: bone.getRotationQuaternion(Space.LOCAL).clone() });
      }
    }
  }

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
        const v = new Vector3(m.localAxis[0], m.localAxis[1], m.localAxis[2]);
        q = q.multiply(Quaternion.RotationAxis(v, deg * m.sign * DEG2RAD));
      }
      d.bone.setRotationQuaternion(q, Space.LOCAL);
    }
  }

  function dispose(): void {
    for (const d of driven) d.bone.setRotationQuaternion(d.rest, Space.LOCAL);
    driven.length = 0;
  }

  // gizmo 視覺手柄擺位延後（§spec §2）：回 null → gizmoController 不建手柄；滑桿仍經共用 seam 驅動。
  function getPivot(_jointId: string, _side: string | null = null): TransformNode | null {
    return null;
  }

  return { applyPose, dispose, pivotKeys: [], getPivot };
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `pnpm test app/utils/humanModel/motion/boneRig.test.ts`
Expected: PASS（7 個測試）

- [ ] **Step 6: Commit**

```bash
git add app/utils/humanModel/motion/boneRig.ts app/utils/humanModel/motion/boneRigFixture.ts \
        app/utils/humanModel/motion/boneRig.test.ts
git commit -m "feat(motion): 骨骼驅動 rig boneRig（同 ArticulationRig 介面、skin 變形 §4.3.3）"
```

---

### Task 3: `rigController.ts` — 依骨架能力選 bone／剛性路徑

**Files:**
- Modify: `app/utils/humanModel/motion/rigController.ts`
- Test: `app/utils/humanModel/motion/rigController.test.ts`（擴充）

**Interfaces:**
- Consumes: `buildBoneRig`、`hasDrivableSkeleton` from `./boneRig`；`makeBoneRigFixture` from `./boneRigFixture`（測試）。
- Produces: `createRigController` 行為不變（介面同），唯首次建 rig 時依 `hasDrivableSkeleton(scene)` 擇 `buildBoneRig`／`buildArticulationRig`。

- [ ] **Step 1: 寫失敗測試（擴充既有檔，新增 bone 路徑案例）**

於 `app/utils/humanModel/motion/rigController.test.ts` 既有 `describe` 內**新增**下列測試（保留既有兩個剛性路測試不動），並於檔首補 import：

```ts
import { makeBoneRigFixture } from './boneRigFixture';
import { resolveBoneName } from './boneRig';
import { Quaternion, Space } from '@babylonjs/core';
```

```ts
  it('有可驅動骨架→走 bone 路徑（不建 pivot: 節點、驅動 bone 旋轉）', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    makeBoneRigFixture(scene);
    const ctrl = createRigController(scene);
    ctrl.sync(true, setJointAngle(NEUTRAL_POSE, 'joint.knee#R', 'flexionExtension', 90));
    // bone 路徑不 reparent、不建 pivot: TransformNode
    expect(scene.transformNodes.some((n) => n.name.startsWith('pivot:'))).toBe(false);
    // bone 已被驅動（非 identity）
    const bone = scene.skeletons[0]!.bones.find(
      (b) => b.name === resolveBoneName('lowerleg01', '#R'),
    )!;
    const isIdentity =
      Math.abs(Math.abs(Quaternion.Dot(bone.getRotationQuaternion(Space.LOCAL), Quaternion.Identity())) - 1) < 1e-4;
    expect(isIdentity).toBe(false);
    // getPivot 回 null（gizmo 擺位延後）
    expect(ctrl.getPivot('joint.knee', '#R')).toBeNull();
    ctrl.dispose();
  });

  it('有骨架但 bone 名不符 BONE_RIG_MAP→退剛性路（佔位身體場景不受影響已由上方覆蓋）', () => {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    // 建一具骨架但 bone 名與 BONE_RIG_MAP 無一相符
    const skel = new (await import('@babylonjs/core')).Skeleton('x', 'x', scene);
    new (await import('@babylonjs/core')).Bone('totally.unrelated', skel, null);
    buildPlaceholderBody(scene, anatomyEntities);
    const ctrl = createRigController(scene);
    ctrl.sync(true, NEUTRAL_POSE);
    expect(scene.transformNodes.some((n) => n.name.startsWith('pivot:'))).toBe(true); // 剛性路
    ctrl.dispose();
  });
```

> 註：第二個測試的動態 import 寫法若不便，改為於檔首 `import { Bone, Skeleton } from '@babylonjs/core'` 後直接 `new Skeleton('x','x',scene)`／`new Bone('totally.unrelated', skel, null)`。實作者擇一即可，斷言不變。

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test app/utils/humanModel/motion/rigController.test.ts`
Expected: FAIL（新案例：目前 `createRigController` 永遠 `buildArticulationRig`，故「有骨架→不建 pivot:」斷言失敗——bone 路徑尚未接入）

- [ ] **Step 3: 修改 `rigController.ts`**

把第 4–5 行 import 與 `sync` 內建 rig 之行改為依骨架能力選路：

```ts
// rig 生命週期控制器（供 Model3DView effect 與測試共用）：依 motionMode/pose 冪等地建/套/拆 rig。
// 依資產能力選路：有可驅動骨架→骨骼驅動（boneRig，skin 變形）、否則→剛性節段（articulationRig）。
// 抽離 view 之難測 Babylon 接線。NullEngine 可測。
import type { Scene, TransformNode } from '@babylonjs/core';
import { type ArticulationRig, buildArticulationRig } from './articulationRig';
import { buildBoneRig, hasDrivableSkeleton } from './boneRig';
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
      if (!rig) rig = hasDrivableSkeleton(scene) ? buildBoneRig(scene) : buildArticulationRig(scene);
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
```

- [ ] **Step 4: 跑測試確認通過（含既有剛性路測試不回歸）**

Run: `pnpm test app/utils/humanModel/motion/rigController.test.ts`
Expected: PASS（既有 2＋新增 2）

- [ ] **Step 5: Commit**

```bash
git add app/utils/humanModel/motion/rigController.ts app/utils/humanModel/motion/rigController.test.ts
git commit -m "feat(motion): rigController 依骨架能力選 bone／剛性路徑"
```

---

### Task 4: 載入綁定路徑 rigged-shaped 回歸護欄

**Files:**
- Test: `app/utils/humanModel/render/gltfBinding.test.ts`（擴充）
- （預期）無 production 改動；若測試意外失敗，最小修正 `app/utils/humanModel/render/gltfBinding.ts`。

**Interfaces:**
- Consumes: `bindAnatomyMetadata` from `./gltfBinding`；`anatomyEntities` from `@ptapp/definitions`；Babylon `Skeleton`/`Bone`。

**背景（為何預期現碼即通過）**：`bindAnatomyMetadata` 迭代 `scene.meshes`，未解析者 `continue`；armature `Bone` 非 mesh、不在 `scene.meshes`，故不被誤綁。skinned mesh 名仍＝anatomyId→正常綁定。此測為回歸護欄，鎖住此不變式。

- [ ] **Step 1: 寫測試（預期對現碼即通過 — 回歸護欄）**

先讀現有 `gltfBinding.test.ts` 既有測試風格（如何建具名 mesh、用哪個 NullEngine helper），於其 `describe` 內**新增**：

```ts
  it('rigged-shaped 場景：skinned mesh 仍綁定、armature 不被誤綁、scene.skeletons 有值', () => {
    // engine/scene 建立沿用本檔既有 helper（如 freshScene/createModelScene）。
    const scene = /* 既有 helper 建之 NullEngine scene */;
    // 真實 anatomyId 命名之 mesh（取定義集前兩筆，避免硬編）
    const ids = anatomyEntities.slice(0, 2).map((e) => e.anatomyId);
    for (const id of ids) new Mesh(id, scene);
    // armature：bone 名刻意非 anatomyId
    const skel = new Skeleton('rig', 'rig', scene);
    new Bone('upperleg01.L', skel, null);
    new Bone('spine01', skel, null);

    const bound = bindAnatomyMetadata(scene);

    expect(scene.skeletons.length).toBe(1);
    for (const id of ids) expect(bound).toContain(id);
    // armature bone 名未被當部位綁定
    expect(bound).not.toContain('upperleg01.L');
    expect(bound).not.toContain('spine01');
  });
```

> 檔首補 import：`import { Bone, Mesh, Skeleton } from '@babylonjs/core'`、`import { anatomyEntities } from '@ptapp/definitions'`（若既有檔未引入）。實作者依本檔既有 scene 建立方式填入 `scene`。

- [ ] **Step 2: 跑測試**

Run: `pnpm test app/utils/humanModel/render/gltfBinding.test.ts`
Expected: PASS（回歸護欄；現碼結構上即正確）。**若失敗**（armature 被誤綁或 skinned mesh 漏綁），最小修正 `gltfBinding.ts`（如綁定前以 `mesh.getClassName?.()`／既有 mesh 判定排除非幾何節點），再跑至通過。

- [ ] **Step 3: Commit**

```bash
git add app/utils/humanModel/render/gltfBinding.test.ts
# 若有最小修正：一併 git add app/utils/humanModel/render/gltfBinding.ts
git commit -m "test(motion): rigged-shaped 場景綁定回歸護欄（skin 變形載入路徑）"
```

---

### Task 5: 設計同步（`04_human_model.md` §4.3.3 ＋ todo）

**Files:**
- Modify: `doc/design/04_human_model.md`（§4.3.3 後續軌段落）
- Modify: `doc/todo/04_todo_human_model.md`

**Interfaces:** 無程式介面（文件同步，CLAUDE.md 設計同步必守）。

- [ ] **Step 1: 改寫 §4.3.3「待」清單中真骨架／skin 變形項**

於 `doc/design/04_human_model.md` §4.3.3 的「> **待**（以下為後續軌）」清單，將：

```
> - **MakeHuman 真骨架＋skin 變形**：引入真骨架 rig 與 skin weights 軟變形，取代剛性節段
```

改為：

```
> - **skin 變形（執行期驅動已實作、ship-dark）**：`rigController` 依資產能力選路——載入**帶真骨架**的 GLB 時走骨骼驅動（`boneRig`／`BONE_RIG_MAP`，bone 區域旋轉＋GPU 蒙皮軟變形）、無骨架（現役出貨）走剛性節段 fallback；兩者共用同一 `pose` seam、下游零改動。待：真資產 bone 名與 bone-local 軸/正負之**實機目視校正**、skinned 路徑 gizmo 擺位與 picking 精修、平滑多椎脊椎、**資產管線綁骨＋蒙皮匯出**（§4.6.3 步驟 3–4，另一子專案，產出 rigged GLB）。見 [skin 變形執行期驅動 spec](specs/2026-06-19-skin-deformation-runtime-design.md)。
```

- [ ] **Step 2: 更新 todo**

於 `doc/todo/04_todo_human_model.md` 對應 §4.3.3／skin 變形項：勾選「執行期 skin 驅動（boneRig 骨骼驅動、有骨架自動選用、ship-dark）」；保留／新增後續軌未勾項：「真資產 bone 名＋bone-local 軸/正負實機校正」、「skinned 路徑 gizmo/picking 精修」、「平滑多椎脊椎」、「資產管線綁骨＋蒙皮匯出（產出 rigged GLB）」。

> 實作者先 `grep -n "skin\|骨架\|真骨架\|MakeHuman\|4.3.3" doc/todo/04_todo_human_model.md` 定位既有項，沿用該檔既有勾選格式與章節編排，勿新建重複段落。

- [ ] **Step 3: 全量驗證（落地閘門）**

```bash
pnpm test          # 全套 vitest node，預期全綠（既有 + 本功能新增）
pnpm typecheck     # nuxt typecheck + packages/shared + packages/definitions
pnpm lint          # eslint（嚴禁 snake_case 等）
```
Expected: 三者皆通過。

- [ ] **Step 4: Commit**

```bash
git add doc/design/04_human_model.md doc/todo/04_todo_human_model.md
git commit -m "docs(human-model): §4.3.3 skin 變形執行期驅動現役化＋todo 同步"
```

---

## Self-Review

**1. Spec coverage（逐 spec 區段對照）：**
- §架構 1 路徑選擇（`hasDrivableSkeleton`／rigController 擇路）→ Task 3。
- §架構 2 `boneRig`（applyPose 套 bone 區域旋轉、dispose 還原 rest、getPivot=null、不 reparent）→ Task 2。
- §架構 3 `BONE_RIG_MAP`（6 關節、per-DOF localAxis/sign、bone 名 vs anatomyId 區隔）→ Task 1。
- §架構 4 元件接線：下游不變（Model3DView/gizmoController/muscleShading 未列入修改檔，靠介面/seam 保證）→ 無 task（即「不改」），由 Task 3 既有測試不回歸佐證；載入綁定 rigged-shaped 護欄 → Task 4。
- §邊界：無骨架→剛性（Task 3 既有測試）、半綁→退剛性（Task 3 新測）、部分關節綁定/解析不到跳過（Task 2 「安全跳過」測）、空 pose→rest（Task 2 dispose/未驅動側為 identity 佐證）、進出冪等（rigController sync 既有測）、muscle shading 正交（設計層面、無新碼）。
- §測試四項 → Task 1/2/3/4 對應。
- §設計同步 → Task 5。

**2. Placeholder scan：** 無「TBD/實作後補/類似 Task N」；每段含完整程式。Task 4 明列「預期通過、失敗則最小修正」屬條件分支非佔位。Task 3 第二測試提供動態 import 與靜態 import 兩寫法、斷言固定。

**3. Type consistency：** `ArticulationRig` 介面欄位（`applyPose`/`dispose`/`pivotKeys`/`getPivot`）與 `articulationRig.ts:26-31` 一致；`BoneJointMapping.bone: string`、`BoneDofMapping.localAxis: AxisVec`、`sign: 1|-1` 跨 Task 1↔2 一致；`resolveBoneName(base, side)`、`hasDrivableSkeleton(scene)`、`buildBoneRig(scene)`、`makeBoneRigFixture(scene)` 簽章跨 Task 2↔3↔fixture 一致；`poseKey`/`jointAngle`/`movableJointDof`/`JOINT_KINEMATICS`/`MOVABLE_JOINT_IDS` 取自既有 `jointKinematics.ts`／`motionPose.ts`，簽章與現碼相符。
