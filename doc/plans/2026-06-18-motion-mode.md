# 運動模式（Motion Mode）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 3D 人體模型可在「運動模式」下活動 SFMA 臨床優先關節（頸椎／肩／脊椎／髖／膝／踝），以逐自由度滑桿驅動、鉗制於既有 ROM 範圍。

**Architecture:** 現役 `anatomyV1.glb` 無骨架（0 skins／0 bones、569 件扁平 mesh，名＝anatomyId＋`#L/#R`），故採**剛性節段旋轉**：把既有 mesh 依節段分群、掛到關節樞紐 `TransformNode` 下，旋轉遠端節段、依 `degreesOfFreedom` 鉗制。沿用 repo 既有「純函式決策層（NullEngine／node 可測）＋元件接線」分立。資料流 seam：`滑桿 → setJointAngle → clampAngle → applyPose`。

**Tech Stack:** Nuxt 4 / Vue 3（`<script setup>`）、Babylon.js（`@babylonjs/core`，`TransformNode`／`Quaternion`／`NullEngine`）、Pinia 無關、Vitest（node＋jsdom）、`@ptapp/definitions`（關節 ROM）、`@ptapp/shared`（型別）。

## Global Constraints

- 套件管理器一律 **pnpm**（Node ≥ 20）；勿用 npm/yarn。
- 命名：camelCase（變數／函式）、PascalCase（型別／元件）、UPPER_CASE（常數）；**嚴禁 snake_case**（eslint 強制）。
- 文件語言 **zh-tw**；i18n 字串入 `i18n/locales/zh-TW.json`（單一語系）。
- 單元測試（node 環境）跑 `pnpm test`，**排除** `*.nuxt.test.ts`；元件測試以檔頭 docblock `// @vitest-environment jsdom` 切換；Babylon 測試用 `NullEngine`。
- Babylon 物件以閉包變數持（非 Vue reactive），避免響應式代理污染引擎內部 identity。
- 提交前 husky + lint-staged 自動 eslint/prettier；每個 task 結束 commit。
- 不改 `packages/shared`、`packages/definitions` 之既有資料/schema（只讀其 ROM 與型別）。

---

## File Structure

新增（app 端，運動學為資產相依算圖期邏輯、不入 definitions）：

- `app/utils/humanModel/motion/romClamp.ts` — ROM 鉗制純函式。
- `app/utils/humanModel/motion/motionPose.ts` — 姿態狀態與不可變 reducer。
- `app/utils/humanModel/motion/jointKinematics.ts` — 運動學表（樞紐／軸／節段樹／節段成員）＋成員解析純函式。
- `app/utils/humanModel/motion/articulationRig.ts` — Babylon：建樞紐樹／reparent／applyPose／dispose。
- `app/components/humanModel/MotionControls.vue` — 關節選擇＋逐 DOF 滑桿＋重置面板。
- 各檔對應 `*.test.ts`（node 或 jsdom）。

修改：

- `i18n/locales/zh-TW.json` — 運動模式字串。
- `app/components/humanModel/Model3DControls.vue` — 運動模式切換鈕。
- `app/components/humanModel/Model3DView.vue` — `motionMode`／`pose` props ＋ `setJointAngle` emit ＋ rig 生命週期接線。
- `app/components/humanModel/Model3DViewer.vue` — 透傳運動 props/emits ＋ 嵌 `MotionControls`。
- `app/pages/patients/[patientId]/model.vue` — `motionMode`／`pose` 狀態、鉗制 handler、運動模式暫停標註。
- `doc/design/04_human_model.md` §4.3.3 ＋ `doc/todo/04_todo_human_model.md` — 設計同步。

---

## Task 1: ROM 鉗制純函式（romClamp）

**Files:**
- Create: `app/utils/humanModel/motion/romClamp.ts`
- Test: `app/utils/humanModel/motion/romClamp.test.ts`

**Interfaces:**
- Consumes: `@ptapp/shared` 之 `Joint` 型別。
- Produces: `type DegreeOfFreedom`、`interface ClampResult { value: number; atLimit: boolean }`、`clampAngle(dof: Pick<DegreeOfFreedom, 'min' | 'max'>, requested: number): ClampResult`。

- [ ] **Step 1: 寫失敗測試**

Create `app/utils/humanModel/motion/romClamp.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { clampAngle } from './romClamp';

const ELBOW = { min: 0, max: 145 } as const;

describe('clampAngle（ROM 鉗制；04 §4.3.3 不可超出活動範圍）', () => {
  it('範圍內：原值、未觸界', () => {
    expect(clampAngle(ELBOW, 90)).toEqual({ value: 90, atLimit: false });
  });
  it('超上界：夾回 max、觸界', () => {
    expect(clampAngle(ELBOW, 200)).toEqual({ value: 145, atLimit: true });
  });
  it('超下界：夾回 min、觸界', () => {
    expect(clampAngle({ min: -70, max: 80 }, -120)).toEqual({ value: -70, atLimit: true });
  });
  it('恰在邊界：觸界', () => {
    expect(clampAngle(ELBOW, 145)).toEqual({ value: 145, atLimit: true });
    expect(clampAngle(ELBOW, 0)).toEqual({ value: 0, atLimit: true });
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test -- romClamp`
Expected: FAIL（`clampAngle` 不存在／模組找不到）。

- [ ] **Step 3: 實作**

Create `app/utils/humanModel/motion/romClamp.ts`:

```ts
// ROM 鉗制（04 §4.3.3）：將請求角度夾於關節某自由度之 [min, max]；觸界（含被夾回）回報 atLimit
// 供 UI 警示色／文字提示（§4.3.3 達極限給視覺提示）。純函式、node 可測。
import type { Joint } from '@ptapp/shared';

// 單一自由度描述：對齊 definitions joint.degreesOfFreedom 之元素（axis/min/max/neutral/unit）。
export type DegreeOfFreedom = Joint['degreesOfFreedom'][number];

export interface ClampResult {
  // 鉗制後角度（deg）
  value: number;
  // 是否觸及（或超出被夾回）ROM 邊界
  atLimit: boolean;
}

export function clampAngle(
  dof: Pick<DegreeOfFreedom, 'min' | 'max'>,
  requested: number,
): ClampResult {
  if (requested <= dof.min) return { value: dof.min, atLimit: true };
  if (requested >= dof.max) return { value: dof.max, atLimit: true };
  return { value: requested, atLimit: false };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test -- romClamp`
Expected: PASS（4 tests）。

- [ ] **Step 5: Commit**

```bash
git add app/utils/humanModel/motion/romClamp.ts app/utils/humanModel/motion/romClamp.test.ts
git commit -m "feat(motion): ROM 鉗制純函式 clampAngle"
```

---

## Task 2: 姿態狀態與 reducer（motionPose）

**Files:**
- Create: `app/utils/humanModel/motion/motionPose.ts`
- Test: `app/utils/humanModel/motion/motionPose.test.ts`

**Interfaces:**
- Produces:
  - `type MotionPose = Readonly<Record<string, Readonly<Record<string, number>>>>`（`jointId → axis → 絕對角度 deg`）
  - `const NEUTRAL_POSE: MotionPose`
  - `setJointAngle(pose: MotionPose, jointId: string, axis: string, deg: number): MotionPose`
  - `jointAngle(pose: MotionPose, jointId: string, axis: string, fallback?: number): number`
  - `resetPose(): MotionPose`

- [ ] **Step 1: 寫失敗測試**

Create `app/utils/humanModel/motion/motionPose.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { jointAngle, NEUTRAL_POSE, resetPose, setJointAngle } from './motionPose';

describe('motionPose（運動姿態不可變 reducer）', () => {
  it('setJointAngle 不變更原 pose、回傳新值', () => {
    const next = setJointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension', 30);
    expect(jointAngle(next, 'joint.knee', 'flexionExtension')).toBe(30);
    expect(NEUTRAL_POSE).toEqual({});
  });
  it('同關節多軸並存、互不覆蓋', () => {
    let p = setJointAngle(NEUTRAL_POSE, 'joint.hip', 'flexionExtension', 40);
    p = setJointAngle(p, 'joint.hip', 'abductionAdduction', 10);
    expect(jointAngle(p, 'joint.hip', 'flexionExtension')).toBe(40);
    expect(jointAngle(p, 'joint.hip', 'abductionAdduction')).toBe(10);
  });
  it('jointAngle 未設回 fallback（預設 0）', () => {
    expect(jointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension')).toBe(0);
    expect(jointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension', -5)).toBe(-5);
  });
  it('resetPose 回中立空姿態', () => {
    expect(resetPose()).toEqual({});
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test -- motionPose`
Expected: FAIL。

- [ ] **Step 3: 實作**

Create `app/utils/humanModel/motion/motionPose.ts`:

```ts
// 運動姿態（04 §4.3.3）：每關節各自由度之絕對角度（deg）。jointId = anatomyId（如 'joint.knee'）、
// axis = definitions DOF.axis。未設之軸＝中立（由 applyPose 以 DOF.neutral 解釋）。純函式、不可變更新。
export type MotionPose = Readonly<Record<string, Readonly<Record<string, number>>>>;

export const NEUTRAL_POSE: MotionPose = {};

export function setJointAngle(
  pose: MotionPose,
  jointId: string,
  axis: string,
  deg: number,
): MotionPose {
  const joint = { ...(pose[jointId] ?? {}), [axis]: deg };
  return { ...pose, [jointId]: joint };
}

export function jointAngle(
  pose: MotionPose,
  jointId: string,
  axis: string,
  fallback = 0,
): number {
  return pose[jointId]?.[axis] ?? fallback;
}

export function resetPose(): MotionPose {
  return NEUTRAL_POSE;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test -- motionPose`
Expected: PASS（4 tests）。

- [ ] **Step 5: Commit**

```bash
git add app/utils/humanModel/motion/motionPose.ts app/utils/humanModel/motion/motionPose.test.ts
git commit -m "feat(motion): 運動姿態不可變 reducer motionPose"
```

---

## Task 3: 運動學表與節段成員解析（jointKinematics）

定義 6 個可動 SFMA 關節之樞紐／軸、節段樹、節段骨骼成員，及由 `relatedJoints` 推導肌肉歸屬之純函式。

**Files:**
- Create: `app/utils/humanModel/motion/jointKinematics.ts`
- Test: `app/utils/humanModel/motion/jointKinematics.test.ts`

**Interfaces:**
- Consumes: `@ptapp/definitions`（`anatomyEntities`、`anatomyEntityById`）、`@ptapp/shared`（`AnatomyEntity`、`Joint`）、本 task 之 `romClamp.DegreeOfFreedom`。
- Produces:
  - `type AxisVec = readonly [number, number, number]`
  - `type AabbFace = 'minX'|'maxX'|'minY'|'maxY'|'minZ'|'maxZ'`
  - `interface PivotAnchor { bone: string; face: AabbFace }`
  - `interface DofAxisMapping { axis: string; worldAxis: AxisVec; sign: 1 | -1 }`
  - `interface JointKinematics { jointId: string; pivot: PivotAnchor; dofs: readonly DofAxisMapping[]; bilateral: boolean }`
  - `interface SegmentTreeNode { jointId: string; children: readonly SegmentTreeNode[] }`
  - `const MOVABLE_JOINT_IDS: readonly string[]`
  - `const JOINT_KINEMATICS: Readonly<Record<string, JointKinematics>>`（keyed by jointId）
  - `const SEGMENT_TREE: SegmentTreeNode`（root 為固定基座 sentinel `'base'`）
  - `const SEGMENT_BONES: Readonly<Record<string, readonly string[]>>`（segmentJointId → 側別無關 bone anatomyId）
  - `const JOINT_TO_SEGMENT: Readonly<Record<string, string>>`（任一 joint → 擁有它的 movable segmentJointId）
  - `segmentForMuscle(relatedJoints: readonly string[]): string | null`
  - `resolveSegmentMembership(entities: readonly AnatomyEntity[]): Map<string, string[]>`
  - `movableJointDof(jointId: string, axis: string): DegreeOfFreedom | undefined`

- [ ] **Step 1: 寫失敗測試**

Create `app/utils/humanModel/motion/jointKinematics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { anatomyEntities, anatomyEntityById } from '@ptapp/definitions';
import {
  JOINT_KINEMATICS,
  MOVABLE_JOINT_IDS,
  movableJointDof,
  resolveSegmentMembership,
  segmentForMuscle,
  SEGMENT_BONES,
} from './jointKinematics';

describe('jointKinematics（運動學表不變式）', () => {
  it('6 個 SFMA 可動關節', () => {
    expect([...MOVABLE_JOINT_IDS].sort()).toEqual(
      [
        'joint.ankle',
        'joint.cervicalSpine',
        'joint.glenohumeral',
        'joint.hip',
        'joint.knee',
        'joint.spine',
      ].sort(),
    );
  });

  it('每個可動關節之 dof.axis 皆對應 definitions 真實 DOF', () => {
    for (const jointId of MOVABLE_JOINT_IDS) {
      const entity = anatomyEntityById.get(jointId);
      expect(entity, jointId).toBeDefined();
      const realAxes = new Set(
        entity!.type === 'joint' ? entity!.degreesOfFreedom.map((d) => d.axis) : [],
      );
      for (const m of JOINT_KINEMATICS[jointId]!.dofs) {
        expect(realAxes.has(m.axis), `${jointId}:${m.axis}`).toBe(true);
      }
    }
  });

  it('每個可動關節 anchor bone 為已知 bone 實體', () => {
    for (const jointId of MOVABLE_JOINT_IDS) {
      const anchor = JOINT_KINEMATICS[jointId]!.pivot.bone;
      expect(anatomyEntityById.get(anchor)?.type, anchor).toBe('bone');
    }
  });

  it('worldAxis 為單位向量、sign 為 ±1', () => {
    for (const jointId of MOVABLE_JOINT_IDS) {
      for (const m of JOINT_KINEMATICS[jointId]!.dofs) {
        const [x, y, z] = m.worldAxis;
        expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
        expect(Math.abs(m.sign)).toBe(1);
      }
    }
  });

  it('segmentForMuscle：跨關節肌歸最近端節段', () => {
    // 腿後肌（hip+knee）→ 大腿（joint.hip）；腓腸肌（knee+ankle）→ 小腿（joint.knee）
    expect(segmentForMuscle(['joint.hip', 'joint.knee'])).toBe('joint.hip');
    expect(segmentForMuscle(['joint.knee', 'joint.ankle'])).toBe('joint.knee');
    // 單關節肘肌（elbow，內屬手臂）→ 肩（joint.glenohumeral）
    expect(segmentForMuscle(['joint.elbow'])).toBe('joint.glenohumeral');
    // 不跨任何受擁關節 → null（騎乘基座）
    expect(segmentForMuscle([])).toBeNull();
  });

  it('SEGMENT_BONES：股骨歸大腿、脛骨歸小腿、跟骨歸足', () => {
    expect(SEGMENT_BONES['joint.hip']).toContain('bone.femur');
    expect(SEGMENT_BONES['joint.knee']).toContain('bone.tibia');
    expect(SEGMENT_BONES['joint.ankle']).toContain('bone.calcaneus');
  });

  it('resolveSegmentMembership：成員不重複、骨＋肌皆納', () => {
    const membership = resolveSegmentMembership(anatomyEntities);
    const seen = new Map<string, string>();
    for (const [segId, ids] of membership) {
      for (const id of ids) {
        expect(seen.has(id), `${id} 重複指派（${seen.get(id)} 與 ${segId}）`).toBe(false);
        seen.set(id, segId);
      }
    }
    // 大腿含股骨（骨）與一條髖肌（肌，relatedJoints 含 joint.hip）
    expect(membership.get('joint.hip')).toContain('bone.femur');
    const hipMuscle = anatomyEntities.find(
      (e) => e.type === 'muscle' && (e.relatedJoints ?? []).includes('joint.hip'),
    );
    expect(membership.get('joint.hip')).toContain(hipMuscle!.anatomyId);
  });

  it('movableJointDof 讀 definitions ROM', () => {
    expect(movableJointDof('joint.knee', 'flexionExtension')?.max).toBe(140);
    expect(movableJointDof('joint.knee', 'bogus')).toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test -- jointKinematics`
Expected: FAIL。

- [ ] **Step 3: 實作**

Create `app/utils/humanModel/motion/jointKinematics.ts`:

```ts
// 運動學表（04 §4.3.3，剛性節段旋轉）：純資料＋純函式，無 Babylon（軸以 [x,y,z] 表、座標由
// articulationRig 求 AABB）。SFMA 臨床優先 6 關節：頸椎／肩／脊椎／髖／膝／踝。
// 樞紐自幾何計算（anchor bone + AABB 面）；脊椎/頸椎 v1 單樞紐近似（見 §4.3.3 待辦）。
import { anatomyEntities as ALL_ENTITIES, anatomyEntityById } from '@ptapp/definitions';
import type { AnatomyEntity } from '@ptapp/shared';
import type { DegreeOfFreedom } from './romClamp';

export type AxisVec = readonly [number, number, number];
export type AabbFace = 'minX' | 'maxX' | 'minY' | 'maxY' | 'minZ' | 'maxZ';

export interface PivotAnchor {
  // anchor bone anatomyId（側別無關；建 rig 時雙側補 #L/#R）
  bone: string;
  // 取此 bone 世界 AABB 之指定面中心為樞紐
  face: AabbFace;
}

export interface DofAxisMapping {
  // 對齊 definitions joint.degreesOfFreedom[].axis
  axis: string;
  // 旋轉軸（世界座標、單位向量；中立站姿下解剖軸 ≈ 世界軸）
  worldAxis: AxisVec;
  // 正角度方向（依各 DOF 之解剖正向約定；實作時對實機校正）
  sign: 1 | -1;
}

export interface JointKinematics {
  jointId: string;
  pivot: PivotAnchor;
  dofs: readonly DofAxisMapping[];
  // 是否成對（左右各一獨立節段／樞紐）
  bilateral: boolean;
}

export interface SegmentTreeNode {
  jointId: string;
  children: readonly SegmentTreeNode[];
}

// 世界軸（中立站姿；模型 +Y 上）。X＝左右（屈伸軸）、Y＝上下（縱軸＝旋轉）、Z＝前後（側彎／外展軸）。
// 註：sign 與軸於 Task 4 對實機目視校正（見該 task Step 7）。
const X: AxisVec = [1, 0, 0];
const Y: AxisVec = [0, 1, 0];
const Z: AxisVec = [0, 0, 1];

export const MOVABLE_JOINT_IDS: readonly string[] = [
  'joint.hip',
  'joint.knee',
  'joint.ankle',
  'joint.glenohumeral',
  'joint.cervicalSpine',
  'joint.spine',
];

export const JOINT_KINEMATICS: Readonly<Record<string, JointKinematics>> = {
  'joint.hip': {
    jointId: 'joint.hip',
    pivot: { bone: 'bone.femur', face: 'maxY' }, // 股骨頭端（上）
    bilateral: true,
    dofs: [
      { axis: 'flexionExtension', worldAxis: X, sign: 1 },
      { axis: 'abductionAdduction', worldAxis: Z, sign: 1 },
      { axis: 'internalExternalRotation', worldAxis: Y, sign: 1 },
    ],
  },
  'joint.knee': {
    jointId: 'joint.knee',
    pivot: { bone: 'bone.tibia', face: 'maxY' }, // 脛骨平台（上）
    bilateral: true,
    dofs: [{ axis: 'flexionExtension', worldAxis: X, sign: 1 }],
  },
  'joint.ankle': {
    jointId: 'joint.ankle',
    pivot: { bone: 'bone.tibia', face: 'minY' }, // 遠端脛骨（下）
    bilateral: true,
    dofs: [
      { axis: 'plantarDorsiflexion', worldAxis: X, sign: 1 },
      { axis: 'inversionEversion', worldAxis: Z, sign: 1 },
    ],
  },
  'joint.glenohumeral': {
    jointId: 'joint.glenohumeral',
    pivot: { bone: 'bone.humerus', face: 'maxY' }, // 肱骨頭端（上）
    bilateral: true,
    dofs: [
      { axis: 'flexionExtension', worldAxis: X, sign: 1 },
      { axis: 'abductionAdduction', worldAxis: Z, sign: 1 },
      { axis: 'internalExternalRotation', worldAxis: Y, sign: 1 },
    ],
  },
  'joint.cervicalSpine': {
    jointId: 'joint.cervicalSpine',
    pivot: { bone: 'bone.t1', face: 'maxY' }, // 頸胸交界（T1 上端）
    bilateral: false,
    dofs: [
      { axis: 'flexionExtension', worldAxis: X, sign: 1 },
      { axis: 'lateralFlexion', worldAxis: Z, sign: 1 },
      { axis: 'rotation', worldAxis: Y, sign: 1 },
    ],
  },
  'joint.spine': {
    jointId: 'joint.spine',
    pivot: { bone: 'bone.sacrum', face: 'maxY' }, // 腰薦交界（薦椎上端）
    bilateral: false,
    dofs: [
      { axis: 'flexionExtension', worldAxis: X, sign: 1 },
      { axis: 'lateralFlexion', worldAxis: Z, sign: 1 },
      { axis: 'rotation', worldAxis: Y, sign: 1 },
    ],
  },
};

// 節段樹（jointId 為節點；root 為固定基座 sentinel 'base'）。巢狀＝移動近端帶動遠端。
export const SEGMENT_TREE: SegmentTreeNode = {
  jointId: 'base',
  children: [
    {
      jointId: 'joint.spine',
      children: [
        { jointId: 'joint.cervicalSpine', children: [] },
        { jointId: 'joint.glenohumeral', children: [] },
      ],
    },
    {
      jointId: 'joint.hip',
      children: [
        {
          jointId: 'joint.knee',
          children: [{ jointId: 'joint.ankle', children: [] }],
        },
      ],
    },
  ],
};

// 節段深度（root 距離；segmentForMuscle 取最小者＝最近端）。
const SEGMENT_DEPTH: Readonly<Record<string, number>> = {
  'joint.spine': 1,
  'joint.hip': 1,
  'joint.cervicalSpine': 2,
  'joint.glenohumeral': 2,
  'joint.knee': 2,
  'joint.ankle': 3,
};

// 同深度平手時之優先序（近端→遠端）。
const SEGMENT_PRIORITY: readonly string[] = [
  'joint.spine',
  'joint.hip',
  'joint.glenohumeral',
  'joint.cervicalSpine',
  'joint.knee',
  'joint.ankle',
];

// 任一關節（含內屬不可動關節）→ 擁有它的可動 segment。內屬關節歸入其所在剛性節段。
export const JOINT_TO_SEGMENT: Readonly<Record<string, string>> = {
  // 軀幹
  'joint.spine': 'joint.spine',
  'joint.thorax': 'joint.spine',
  'joint.scapulothoracic': 'joint.spine',
  // 頭頸
  'joint.cervicalSpine': 'joint.cervicalSpine',
  'joint.temporomandibular': 'joint.cervicalSpine',
  'joint.hyoid': 'joint.cervicalSpine',
  // 手臂（肘以下內屬，肩為近端可動）
  'joint.glenohumeral': 'joint.glenohumeral',
  'joint.elbow': 'joint.glenohumeral',
  'joint.radioulnar': 'joint.glenohumeral',
  'joint.wrist': 'joint.glenohumeral',
  'joint.fingers': 'joint.glenohumeral',
  'joint.thumb': 'joint.glenohumeral',
  // 下肢
  'joint.hip': 'joint.hip',
  'joint.knee': 'joint.knee',
  'joint.ankle': 'joint.ankle',
  'joint.toes': 'joint.ankle',
};

// 各節段之骨骼成員（側別無關 anatomyId）。基座（骨盆／薦椎／中軸殘餘）不列＝不動。
export const SEGMENT_BONES: Readonly<Record<string, readonly string[]>> = {
  'joint.hip': ['bone.femur'],
  'joint.knee': ['bone.tibia', 'bone.fibula', 'bone.patella'],
  'joint.ankle': [
    'bone.talus',
    'bone.calcaneus',
    'bone.navicular',
    'bone.cuboid',
    'bone.medialCuneiform',
    'bone.intermediateCuneiform',
    'bone.lateralCuneiform',
    'bone.metatarsal1',
    'bone.metatarsal2',
    'bone.metatarsal3',
    'bone.metatarsal4',
    'bone.metatarsal5',
    'bone.footProximalPhalanx1',
    'bone.footProximalPhalanx2',
    'bone.footProximalPhalanx3',
    'bone.footProximalPhalanx4',
    'bone.footProximalPhalanx5',
    'bone.footMiddlePhalanx2',
    'bone.footMiddlePhalanx3',
    'bone.footMiddlePhalanx4',
    'bone.footMiddlePhalanx5',
    'bone.footDistalPhalanx1',
    'bone.footDistalPhalanx2',
    'bone.footDistalPhalanx3',
    'bone.footDistalPhalanx4',
    'bone.footDistalPhalanx5',
  ],
  'joint.glenohumeral': [
    'bone.humerus',
    'bone.radius',
    'bone.ulna',
    'bone.scaphoid',
    'bone.lunate',
    'bone.triquetrum',
    'bone.pisiform',
    'bone.trapezium',
    'bone.trapezoid',
    'bone.capitate',
    'bone.hamate',
    'bone.metacarpal1',
    'bone.metacarpal2',
    'bone.metacarpal3',
    'bone.metacarpal4',
    'bone.metacarpal5',
    'bone.handProximalPhalanx1',
    'bone.handProximalPhalanx2',
    'bone.handProximalPhalanx3',
    'bone.handProximalPhalanx4',
    'bone.handProximalPhalanx5',
    'bone.handMiddlePhalanx2',
    'bone.handMiddlePhalanx3',
    'bone.handMiddlePhalanx4',
    'bone.handMiddlePhalanx5',
    'bone.handDistalPhalanx1',
    'bone.handDistalPhalanx2',
    'bone.handDistalPhalanx3',
    'bone.handDistalPhalanx4',
    'bone.handDistalPhalanx5',
  ],
  'joint.cervicalSpine': [
    'bone.c1',
    'bone.c2',
    'bone.c3',
    'bone.c4',
    'bone.c5',
    'bone.c6',
    'bone.c7',
    'bone.frontal',
    'bone.parietal',
    'bone.temporal',
    'bone.occipital',
    'bone.sphenoid',
    'bone.ethmoid',
    'bone.nasal',
    'bone.lacrimal',
    'bone.zygomatic',
    'bone.maxilla',
    'bone.mandible',
    'bone.palatine',
    'bone.vomer',
    'bone.inferiorNasalConcha',
    'bone.hyoid',
  ],
  // 軀幹（脊椎節段）：胸腰椎＋肋＋胸骨＋肩帶。頭頸與手臂為其子節段、另列。
  'joint.spine': [
    'bone.t1',
    'bone.t2',
    'bone.t3',
    'bone.t4',
    'bone.t5',
    'bone.t6',
    'bone.t7',
    'bone.t8',
    'bone.t9',
    'bone.t10',
    'bone.t11',
    'bone.t12',
    'bone.l1',
    'bone.l2',
    'bone.l3',
    'bone.l4',
    'bone.l5',
    'bone.clavicle',
    'bone.scapula',
  ],
};

// 跨關節肌之節段歸屬：取其 relatedJoints 對應之諸 segment 中「最近端」者（深度最小、平手取優先序）。
// 不對應任何受擁 segment（relatedJoints 皆未在 JOINT_TO_SEGMENT）→ null（騎乘固定基座）。
export function segmentForMuscle(relatedJoints: readonly string[]): string | null {
  const segments = new Set<string>();
  for (const j of relatedJoints) {
    const seg = JOINT_TO_SEGMENT[j];
    if (seg !== undefined) segments.add(seg);
  }
  if (segments.size === 0) return null;
  let best: string | null = null;
  for (const seg of segments) {
    if (best === null) {
      best = seg;
      continue;
    }
    const d = SEGMENT_DEPTH[seg] ?? 99;
    const db = SEGMENT_DEPTH[best] ?? 99;
    if (d < db || (d === db && SEGMENT_PRIORITY.indexOf(seg) < SEGMENT_PRIORITY.indexOf(best))) {
      best = seg;
    }
  }
  return best;
}

// 解析各節段之全部成員（側別無關 anatomyId）：curated 骨 ＋ 由 relatedJoints 推導之肌。
export function resolveSegmentMembership(
  entities: readonly AnatomyEntity[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const segId of MOVABLE_JOINT_IDS) result.set(segId, [...(SEGMENT_BONES[segId] ?? [])]);
  for (const e of entities) {
    if (e.type !== 'muscle') continue;
    const seg = segmentForMuscle(e.relatedJoints ?? []);
    if (seg !== null) result.get(seg)!.push(e.anatomyId);
  }
  return result;
}

// 讀 definitions 之某關節某軸 DOF（ROM 來源）。
export function movableJointDof(jointId: string, axis: string): DegreeOfFreedom | undefined {
  const entity = anatomyEntityById.get(jointId);
  if (entity === undefined || entity.type !== 'joint') return undefined;
  return entity.degreesOfFreedom.find((d) => d.axis === axis);
}

// 便利：全部成員一次解析（rig 用）。
export const segmentMembershipAll = (): Map<string, string[]> =>
  resolveSegmentMembership(ALL_ENTITIES);
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test -- jointKinematics`
Expected: PASS（8 tests）。若 `joint.knee` flexionExtension max 非 140，依 definitions 實際值修正測試斷言。

- [ ] **Step 5: typecheck（型別一致）**

Run: `pnpm typecheck`
Expected: EXIT 0。

- [ ] **Step 6: Commit**

```bash
git add app/utils/humanModel/motion/jointKinematics.ts app/utils/humanModel/motion/jointKinematics.test.ts
git commit -m "feat(motion): 運動學表＋節段樹＋成員解析 jointKinematics"
```

---

## Task 4: 關節活動 rig（articulationRig，Babylon）

建樞紐樹、reparent 節段 mesh、依 pose 旋轉、dispose 還原。為唯一變動場景圖之模組。

**Files:**
- Create: `app/utils/humanModel/motion/articulationRig.ts`
- Test: `app/utils/humanModel/motion/articulationRig.test.ts`

**Interfaces:**
- Consumes: `@babylonjs/core`（`Scene`、`TransformNode`、`Quaternion`、`Vector3`、`AbstractMesh`）、Task 3 之 `JOINT_KINEMATICS`／`SEGMENT_TREE`／`MOVABLE_JOINT_IDS`／`movableJointDof`／`segmentMembershipAll`、Task 2 之 `MotionPose`/`jointAngle`。
- Produces:
  - `interface ArticulationRig { applyPose(pose: MotionPose): void; dispose(): void; pivotKeys: readonly string[] }`
  - `buildArticulationRig(scene: Scene): ArticulationRig`

說明（給實作者）：每個可動關節（雙側者左右各一）建一 `TransformNode` 樞紐，置於 anchor bone 世界 AABB 指定面中心；樞紐依 `SEGMENT_TREE` 巢狀（子樞紐 `setParent` 父樞紐，保世界變換）。各節段成員 mesh `setParent` 至其樞紐（保世界變換→中立姿態視覺不變）。`applyPose` 對每樞紐以其 `dofs` 組合 `Quaternion`（角度＝pose 絕對角 − DOF.neutral，乘 sign）設 `rotationQuaternion`；因樞紐巢狀，遠端自動隨近端。`dispose` 先套中立姿態歸零、再把 mesh `setParent` 回原 parent、最後 dispose 樞紐節點。

- [ ] **Step 1: 寫失敗測試**

Create `app/utils/humanModel/motion/articulationRig.test.ts`:

```ts
import { NullEngine, TransformNode } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { anatomyEntities } from '@ptapp/definitions';
import { buildPlaceholderBody, createModelScene } from '../render/sceneCore';
import { NEUTRAL_POSE, setJointAngle } from './motionPose';
import { buildArticulationRig } from './articulationRig';

// 佔位身體（sceneCore）：每 anatomyId 一 box、側別無關（無 #L/#R）。足供 rig 結構測試
// （中線關節 spine/cervical 走無側分支；雙側關節於佔位身體亦解析為單側 fallback）。

describe('articulationRig（剛性節段 rig；NullEngine）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function freshScene() {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    buildPlaceholderBody(scene, anatomyEntities);
    return scene;
  }

  it('建 rig 後生成樞紐 TransformNode、含脊椎與膝', () => {
    const scene = freshScene();
    const rig = buildArticulationRig(scene);
    expect(rig.pivotKeys.some((k) => k.startsWith('joint.spine'))).toBe(true);
    expect(rig.pivotKeys.some((k) => k.startsWith('joint.knee'))).toBe(true);
    expect(scene.getTransformNodeByName !== undefined).toBe(true);
    rig.dispose();
  });

  it('中立姿態下 mesh 世界座標不變（reparent 保變換）', () => {
    const scene = freshScene();
    const femur = scene.getMeshByName('bone.femur')!;
    const before = femur.getAbsolutePosition().clone();
    const rig = buildArticulationRig(scene);
    rig.applyPose(NEUTRAL_POSE);
    femur.computeWorldMatrix(true);
    expect(femur.getAbsolutePosition().subtract(before).length()).toBeLessThan(1e-4);
    rig.dispose();
  });

  it('膝屈曲改變小腿成員（脛骨）世界座標', () => {
    const scene = freshScene();
    const tibia = scene.getMeshByName('bone.tibia')!;
    const rig = buildArticulationRig(scene);
    const before = tibia.getAbsolutePosition().clone();
    rig.applyPose(setJointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension', 90));
    tibia.computeWorldMatrix(true);
    // 脛骨為膝樞紐之 anchor（樞紐在其上端）：屈曲後其下半旋走、絕對中心應位移
    expect(tibia.getAbsolutePosition().subtract(before).length()).toBeGreaterThan(0.01);
    rig.dispose();
  });

  it('dispose 後 mesh 還原至樞紐外（parent 非樞紐）且世界座標復原', () => {
    const scene = freshScene();
    const tibia = scene.getMeshByName('bone.tibia')!;
    const before = tibia.getAbsolutePosition().clone();
    const rig = buildArticulationRig(scene);
    rig.applyPose(setJointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension', 90));
    rig.dispose();
    tibia.computeWorldMatrix(true);
    expect(tibia.parent instanceof TransformNode && tibia.parent.name.startsWith('pivot:')).toBe(
      false,
    );
    expect(tibia.getAbsolutePosition().subtract(before).length()).toBeLessThan(1e-3);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test -- articulationRig`
Expected: FAIL（`buildArticulationRig` 不存在）。

- [ ] **Step 3: 實作**

Create `app/utils/humanModel/motion/articulationRig.ts`:

```ts
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
  MOVABLE_JOINT_IDS,
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
  return (side !== null ? scene.getMeshByName(`${bone}${side}`) : null) ?? scene.getMeshByName(bone);
}

export function buildArticulationRig(scene: Scene): ArticulationRig {
  const membership = segmentMembershipAll();
  const pivots = new Map<string, TransformNode>();
  const pivotMeta = new Map<string, { kin: JointKinematics; side: string | null }>();
  const moved: MovedMesh[] = [];

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
        // reparent 成員 mesh（保世界變換）。
        for (const mesh of meshesFor(scene, membership.get(node.jointId) ?? [], side)) {
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
    for (const [key, { kin, side }] of pivotMeta) {
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
    for (const { mesh, originalParent } of moved) mesh.setParent(originalParent);
    for (const pivot of pivots.values()) pivot.dispose();
    pivots.clear();
    pivotMeta.clear();
    moved.length = 0;
  }

  return { applyPose, dispose, pivotKeys: [...pivots.keys()] };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test -- articulationRig`
Expected: PASS（4 tests）。

- [ ] **Step 5: typecheck**

Run: `pnpm typecheck`
Expected: EXIT 0。

- [ ] **Step 6: Commit**

```bash
git add app/utils/humanModel/motion/articulationRig.ts app/utils/humanModel/motion/articulationRig.test.ts
git commit -m "feat(motion): 剛性節段 articulationRig（建/旋/還原）"
```

- [ ] **Step 7: 軸／sign 實機校正（dev server 目視，非自動）**

啟 `pnpm dev`，於 `/patients/<任一>/model` 完成 UI 接線後（Task 8–10）回到此步：逐關節推單軸至大角度，目視確認方向（屈曲應向前、外展向外、旋轉繞縱軸）。若方向相反，翻該 DOF 之 `sign`；若繞錯平面，調 `worldAxis`。於 `jointKinematics.ts` 修正後重跑 `pnpm test -- jointKinematics articulationRig`。記錄校正結果於 commit message。

> 此步驟依賴 Task 8–10 之 UI；於整體接線完成後執行，再 commit 校正。

---

## Task 5: 運動模式 i18n 字串

**Files:**
- Modify: `i18n/locales/zh-TW.json`

**Interfaces:**
- Produces: i18n keys：`modelMotionMode`、`modelMotionJoint`、`modelMotionReset`、`modelMotionAtLimit`、`motionAxisFlexionExtension`、`motionAxisAbductionAdduction`、`motionAxisInternalExternalRotation`、`motionAxisPlantarDorsiflexion`、`motionAxisInversionEversion`、`motionAxisLateralFlexion`、`motionAxisRotation`。

- [ ] **Step 1: 加入字串**

於 `i18n/locales/zh-TW.json` 既有 model 相關鍵附近加入（JSON 物件成員，注意尾逗號合法）：

```json
"modelMotionMode": "關節活動",
"modelMotionJoint": "關節",
"modelMotionReset": "回中立姿勢",
"modelMotionAtLimit": "已達活動範圍邊界",
"motionAxisFlexionExtension": "屈曲／伸展",
"motionAxisAbductionAdduction": "外展／內收",
"motionAxisInternalExternalRotation": "內旋／外旋",
"motionAxisPlantarDorsiflexion": "蹠屈／背屈",
"motionAxisInversionEversion": "內翻／外翻",
"motionAxisLateralFlexion": "側彎",
"motionAxisRotation": "旋轉"
```

- [ ] **Step 2: 驗 JSON 合法**

Run: `node -e "JSON.parse(require('fs').readFileSync('i18n/locales/zh-TW.json','utf8')); console.log('ok')"`
Expected: 印出 `ok`。

- [ ] **Step 3: Commit**

```bash
git add i18n/locales/zh-TW.json
git commit -m "feat(motion): 運動模式 i18n 字串（zh-TW）"
```

---

## Task 6: 運動控制面板（MotionControls.vue）

關節選擇（分段控制）＋每自由度滑桿（原生 range ＋角度讀數）＋觸界提示＋重置。受控、純展示，狀態由父持。

**Files:**
- Create: `app/components/humanModel/MotionControls.vue`
- Test: `app/components/humanModel/MotionControls.test.ts`

**Interfaces:**
- Consumes: Task 1 `clampAngle`、Task 2 `MotionPose`/`jointAngle`、Task 3 `MOVABLE_JOINT_IDS`/`JOINT_KINEMATICS`/`movableJointDof`、`@ptapp/definitions` `anatomyEntityById`、`localizeText`。
- Produces（emits）：`setJointAngle: [jointId: string, axis: string, deg: number]`、`resetPose: []`。Props：`pose: MotionPose`、`selectedJoint: string`、`update:selectedJoint`（v-model）。

- [ ] **Step 1: 寫失敗測試**

Create `app/components/humanModel/MotionControls.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import MotionControls from './MotionControls.vue';
import { NEUTRAL_POSE } from '../../utils/humanModel/motion/motionPose';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// 以契約替身替換包裝元件（避免 jsdom 拉入 Nuxt UI 執行期）；滑桿為原生 input、不需 stub。
const UiButtonStub = defineComponent({
  name: 'UiButton',
  inheritAttrs: false,
  template: `<button v-bind="$attrs" @click="$emit('click')"><slot /></button>`,
});
const UiSegmentedControlStub = defineComponent({
  name: 'UiSegmentedControl',
  props: { modelValue: { type: String, default: '' }, options: { type: Array, default: () => [] } },
  emits: ['update:modelValue'],
  template: `<div class="segStub" />`,
});
const mountOpts = {
  props: { pose: NEUTRAL_POSE, selectedJoint: 'joint.knee' },
  global: { stubs: { UiButton: UiButtonStub, UiSegmentedControl: UiSegmentedControlStub } },
};

describe('MotionControls（運動控制面板；04 §4.3.3）', () => {
  it('選膝（1 DOF）顯一支滑桿', () => {
    const wrapper = mount(MotionControls, mountOpts);
    const sliders = wrapper.findAll('input[type="range"]');
    expect(sliders).toHaveLength(1);
  });

  it('選肩（3 DOF）顯三支滑桿', () => {
    const wrapper = mount(MotionControls, {
      ...mountOpts,
      props: { pose: NEUTRAL_POSE, selectedJoint: 'joint.glenohumeral' },
    });
    expect(wrapper.findAll('input[type="range"]')).toHaveLength(3);
  });

  it('滑桿之 min/max = definitions ROM（膝 -5..140）', () => {
    const wrapper = mount(MotionControls, mountOpts);
    const slider = wrapper.find('input[type="range"]');
    expect(slider.attributes('min')).toBe('-5');
    expect(slider.attributes('max')).toBe('140');
  });

  it('移動滑桿發 setJointAngle（jointId, axis, 鉗制值）', async () => {
    const wrapper = mount(MotionControls, mountOpts);
    const slider = wrapper.find('input[type="range"]');
    await slider.setValue('90');
    const ev = wrapper.emitted('setJointAngle');
    expect(ev?.[0]).toEqual(['joint.knee', 'flexionExtension', 90]);
  });

  it('超界輸入被鉗制後上拋（膝 200 → 140）', async () => {
    const wrapper = mount(MotionControls, mountOpts);
    const slider = wrapper.find('input[type="range"]');
    await slider.setValue('200');
    const ev = wrapper.emitted('setJointAngle');
    expect(ev?.[ev.length - 1]).toEqual(['joint.knee', 'flexionExtension', 140]);
  });

  it('重置鈕發 resetPose', async () => {
    const wrapper = mount(MotionControls, mountOpts);
    await wrapper.find('[data-testid="motion-reset"]').trigger('click');
    expect(wrapper.emitted('resetPose')).toBeTruthy();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test -- MotionControls`（jsdom docblock 元件測試與 `LayerControls.test.ts` 同走 `pnpm test`，非 `test:nuxt`）。
Expected: FAIL。

- [ ] **Step 3: 實作**

Create `app/components/humanModel/MotionControls.vue`:

```vue
<script setup lang="ts">
// 運動控制面板（04 §4.3.3）：關節選擇＋逐自由度滑桿（原生 range，min/max＝ROM）＋角度讀數
// ＋觸界提示（非色彩通道：文字 role="status"）＋回中立。受控、狀態由父持（pose／selectedJoint）。
import { computed } from 'vue';
import { anatomyEntityById } from '@ptapp/definitions';
import UiSegmentedControl, { type SegmentedOption } from '../base/SegmentedControl.vue';
import UiButton from '../base/Button.vue';
import { localizeText } from '../../utils/i18n/localizeText';
import { clampAngle } from '../../utils/humanModel/motion/romClamp';
import { type MotionPose, jointAngle } from '../../utils/humanModel/motion/motionPose';
import {
  JOINT_KINEMATICS,
  MOVABLE_JOINT_IDS,
  movableJointDof,
} from '../../utils/humanModel/motion/jointKinematics';

const AXIS_LABEL_KEYS: Record<string, string> = {
  flexionExtension: 'motionAxisFlexionExtension',
  abductionAdduction: 'motionAxisAbductionAdduction',
  internalExternalRotation: 'motionAxisInternalExternalRotation',
  plantarDorsiflexion: 'motionAxisPlantarDorsiflexion',
  inversionEversion: 'motionAxisInversionEversion',
  lateralFlexion: 'motionAxisLateralFlexion',
  rotation: 'motionAxisRotation',
};

interface Props {
  pose: MotionPose;
  selectedJoint: string;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  setJointAngle: [jointId: string, axis: string, deg: number];
  resetPose: [];
  'update:selectedJoint': [jointId: string];
}>();

const { t } = useI18n();

const jointOptions = computed<SegmentedOption[]>(() =>
  MOVABLE_JOINT_IDS.map((id) => ({
    value: id,
    label: localizeText(anatomyEntityById.get(id)?.name ?? { 'zh-TW': id, en: id }),
  })),
);

interface SliderModel {
  axis: string;
  label: string;
  min: number;
  max: number;
  neutral: number;
  value: number;
  atLimit: boolean;
}

const sliders = computed<SliderModel[]>(() => {
  const kin = JOINT_KINEMATICS[props.selectedJoint];
  if (!kin) return [];
  return kin.dofs.map((m) => {
    const dof = movableJointDof(props.selectedJoint, m.axis);
    const min = dof?.min ?? 0;
    const max = dof?.max ?? 0;
    const neutral = dof?.neutral ?? 0;
    const value = jointAngle(props.pose, props.selectedJoint, m.axis, neutral);
    return {
      axis: m.axis,
      label: t(AXIS_LABEL_KEYS[m.axis] ?? m.axis),
      min,
      max,
      neutral,
      value,
      atLimit: value <= min || value >= max,
    };
  });
});

function onJoint(value: string): void {
  if (MOVABLE_JOINT_IDS.includes(value)) emit('update:selectedJoint', value);
}

function onSlider(axis: string, raw: string | number): void {
  const dof = movableJointDof(props.selectedJoint, axis);
  if (!dof) return;
  const { value } = clampAngle(dof, Number(raw));
  emit('setJointAngle', props.selectedJoint, axis, value);
}
</script>

<template>
  <div class="motionControls">
    <UiSegmentedControl
      v-bind="{ ariaLabel: t('modelMotionJoint') }"
      :model-value="selectedJoint"
      :options="jointOptions"
      @update:model-value="onJoint"
    />
    <div v-for="s in sliders" :key="s.axis" class="motionDof">
      <label class="motionDofLabel">
        <span>{{ s.label }}</span>
        <span class="motionDofValue">{{ Math.round(s.value) }}°</span>
      </label>
      <input
        type="range"
        :aria-label="s.label"
        :min="s.min"
        :max="s.max"
        :value="s.value"
        step="1"
        @input="onSlider(s.axis, ($event.target as HTMLInputElement).value)"
      />
      <p v-if="s.atLimit" class="motionAtLimit" role="status">{{ t('modelMotionAtLimit') }}</p>
    </div>
    <UiButton variant="secondary" data-testid="motion-reset" @click="emit('resetPose')">
      {{ t('modelMotionReset') }}
    </UiButton>
  </div>
</template>

<style scoped>
.motionControls {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.motionDof {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.motionDofLabel {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}
.motionDofValue {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}
.motionDof input[type='range'] {
  width: 100%;
}
/* 觸界提示（非色彩通道＋琥珀；§3.6 不僅依顏色）。 */
.motionAtLimit {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-warning, #b26a00);
}
</style>
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test -- MotionControls`
Expected: PASS（6 tests）。

- [ ] **Step 5: Commit**

```bash
git add app/components/humanModel/MotionControls.vue app/components/humanModel/MotionControls.test.ts
git commit -m "feat(motion): 運動控制面板 MotionControls（關節選擇＋ROM 滑桿）"
```

---

## Task 7: Model3DControls 加運動模式切換鈕

**Files:**
- Modify: `app/components/humanModel/Model3DControls.vue`
- Test: `app/components/humanModel/Model3DControls.test.ts`（若不存在則新建）

**Interfaces:**
- Produces（新增 props/emits）：prop `motionMode?: boolean`、`canToggleMotion?: boolean`；emit `motionModeChange: [on: boolean]`。

- [ ] **Step 1: 寫/補失敗測試**

於 `Model3DControls.test.ts`（沿用 `LayerControls.test.ts` 之 jsdom＋`vi.stubGlobal('useI18n', …)`＋stub 模式；需 stub `UiSwitch`／`UiSegmentedControl`）新增：

```ts
it('canToggleMotion 時顯運動模式開關、切換發 motionModeChange', async () => {
  const wrapper = mount(Model3DControls, {
    props: { view: 'front', canToggleMotion: true, motionMode: false },
    ...mountOpts,
  });
  const sw = wrapper.find('[data-testid="motion-toggle"]');
  expect(sw.exists()).toBe(true);
  await sw.trigger('click');
  expect(wrapper.emitted('motionModeChange')?.[0]).toEqual([true]);
});
```

（`mountOpts` 需 stub `UiSwitch`／`UiSegmentedControl`，比照既有 LayerControls 測試之 stub 寫法；`UiSwitch` stub 以 `data-testid` 透傳。）

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test -- Model3DControls`
Expected: FAIL。

- [ ] **Step 3: 實作**

於 `Model3DControls.vue` `<script setup>` 之 `Props` 介面加：

```ts
  // 運動模式（§4.3.3）：canToggleMotion＝顯關節活動開關；motionMode＝當前。
  motionMode?: boolean;
  canToggleMotion?: boolean;
```

`withDefaults` 內加：`motionMode: false,` 與 `canToggleMotion: false,`。

`defineEmits` 內加：`motionModeChange: [on: boolean];`

於 `<template>` `.model3dControls` 內（建議置首，最常用）加：

```vue
    <UiSwitch
      v-if="canToggleMotion"
      data-testid="motion-toggle"
      :label="t('modelMotionMode')"
      :model-value="motionMode === true"
      @update:model-value="emit('motionModeChange', $event === true)"
    />
```

（`UiSwitch` 已 import。）

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test -- Model3DControls`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add app/components/humanModel/Model3DControls.vue app/components/humanModel/Model3DControls.test.ts
git commit -m "feat(motion): Model3DControls 運動模式切換鈕"
```

---

## Task 8: Model3DView 接線 rig 生命週期

加 `motionMode`／`pose` props（Model3DView 為 canvas、無滑桿故無 `setJointAngle` emit——該 emit 屬 Task 9 Model3DViewer，MotionControls 掛於彼）；於 motionMode 開→填充完成後 `buildArticulationRig`、pose 變→`applyPose`、關閉/卸載→`dispose`。

**Files:**
- Create: `app/utils/humanModel/motion/rigController.ts`
- Test: `app/utils/humanModel/motion/rigController.test.ts`（NullEngine；測抽出之純控制器，避免掛真 canvas）
- Modify: `app/components/humanModel/Model3DView.vue`（呼叫控制器，難測接線最小化）

**Interfaces:**
- Consumes: Task 4 `buildArticulationRig`/`ArticulationRig`、Task 2 `MotionPose`。
- Produces: 抽出 `app/utils/humanModel/motion/rigController.ts` 之 `createRigController(scene): { sync(motionMode: boolean, pose: MotionPose): void; dispose(): void }`，供 view 與測試共用。Props 加 `motionMode?: boolean`、`pose?: MotionPose`。

> 設計：把「依 motionMode/pose 建/套/拆 rig」抽成純控制器 `rigController`（NullEngine 可測），view 僅在 effect 中呼叫，維持 view 難測部分最小。

- [ ] **Step 1: 寫失敗測試（rigController）**

Create `app/utils/humanModel/motion/rigController.test.ts`:

```ts
import { NullEngine } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { anatomyEntities } from '@ptapp/definitions';
import { buildPlaceholderBody, createModelScene } from '../render/sceneCore';
import { NEUTRAL_POSE, setJointAngle } from './motionPose';
import { createRigController } from './rigController';

describe('rigController（依 motionMode/pose 建/套/拆 rig）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function freshScene() {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    buildPlaceholderBody(scene, anatomyEntities);
    return scene;
  }

  it('motionMode=false 不建 rig（無 pivot 節點）', () => {
    const scene = freshScene();
    const ctrl = createRigController(scene);
    ctrl.sync(false, NEUTRAL_POSE);
    expect(scene.transformNodes.some((n) => n.name.startsWith('pivot:'))).toBe(false);
    ctrl.dispose();
  });

  it('motionMode=true 建 rig 並套 pose；關閉拆 rig', () => {
    const scene = freshScene();
    const ctrl = createRigController(scene);
    ctrl.sync(true, setJointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension', 45));
    expect(scene.transformNodes.some((n) => n.name.startsWith('pivot:'))).toBe(true);
    ctrl.sync(false, NEUTRAL_POSE);
    expect(scene.transformNodes.some((n) => n.name.startsWith('pivot:'))).toBe(false);
    ctrl.dispose();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test -- rigController`
Expected: FAIL。

- [ ] **Step 3: 實作 rigController**

Create `app/utils/humanModel/motion/rigController.ts`:

```ts
// rig 生命週期控制器（供 Model3DView effect 與測試共用）：依 motionMode/pose 冪等地建/套/拆 rig。
// 抽離 view 之難測 Babylon 接線。NullEngine 可測。
import type { Scene } from '@babylonjs/core';
import { type ArticulationRig, buildArticulationRig } from './articulationRig';
import type { MotionPose } from './motionPose';

export interface RigController {
  sync(motionMode: boolean, pose: MotionPose): void;
  dispose(): void;
}

export function createRigController(scene: Scene): RigController {
  let rig: ArticulationRig | null = null;
  function sync(motionMode: boolean, pose: MotionPose): void {
    if (motionMode) {
      if (!rig) rig = buildArticulationRig(scene);
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
  return { sync, dispose };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test -- rigController`
Expected: PASS（2 tests）。

- [ ] **Step 5: 接線 Model3DView.vue**

於 `Model3DView.vue`：

(a) import（接其他 motion import 後）：

```ts
import { createRigController, type RigController } from '../../utils/humanModel/motion/rigController';
import type { MotionPose } from '../../utils/humanModel/motion/motionPose';
```

(b) `Props` 介面加：

```ts
  // 運動模式（§4.3.3）：motionMode 開即建 rig；pose 變即套用。
  motionMode?: boolean;
  pose?: MotionPose;
```

(c) `withDefaults` 加：`motionMode: false,` 與 `pose: undefined,`。

(d) 閉包變數區（`let labelLayer …` 附近）加：

```ts
let rigController: RigController | null = null;
```

(e) 於填充 `.then(...)` 區塊內、`syncLabels();` 之後加（rig 須在 mesh 載入後才建）：

```ts
        rigController = createRigController(builtScene);
        rigController.sync(props.motionMode, props.pose ?? {});
```

(f) `onBeforeUnmount` 內、`labelLayer?.dispose();` 之後加：

```ts
    rigController?.dispose();
    rigController = null;
```

(g) 新增 watch（置其他 watch 之後）：

```ts
// 運動模式（§4.3.3）：motionMode／pose 變更即冪等建/套/拆 rig（填充完成後 rigController 方存在）。
watch(
  () => [props.motionMode, props.pose] as const,
  () => {
    if (rigController) rigController.sync(props.motionMode, props.pose ?? {});
  },
);
```

- [ ] **Step 6: typecheck**

Run: `pnpm typecheck`
Expected: EXIT 0。

- [ ] **Step 7: Commit**

```bash
git add app/components/humanModel/Model3DView.vue \
  app/utils/humanModel/motion/rigController.ts app/utils/humanModel/motion/rigController.test.ts
git commit -m "feat(motion): Model3DView rig 生命週期接線（rigController）"
```

---

## Task 9: Model3DViewer 透傳運動 props/emits ＋ 嵌 MotionControls

**Files:**
- Modify: `app/components/humanModel/Model3DViewer.vue`

**Interfaces:**
- Produces（新增 props）：`motionMode?: boolean`、`canToggleMotion?: boolean`、`pose?: MotionPose`、`motionJoint?: string`。Emits：`motionModeChange: [on: boolean]`、`setJointAngle: [jointId: string, axis: string, deg: number]`、`resetPose: []`、`motionJointChange: [jointId: string]`。

- [ ] **Step 1: 接線（script）**

於 `Model3DViewer.vue` `<script setup>`：

(a) import：

```ts
import MotionControls from './MotionControls.vue';
import type { MotionPose } from '../../utils/humanModel/motion/motionPose';
```

(b) `Props` 介面加：

```ts
  // 運動模式（§4.3.3）：canToggleMotion＝控制列顯開關；motionMode/pose/motionJoint 為當前狀態。
  motionMode?: boolean;
  canToggleMotion?: boolean;
  pose?: MotionPose;
  motionJoint?: string;
```

(c) `withDefaults` 加：`motionMode: false,`、`canToggleMotion: false,`、`pose: undefined,`、`motionJoint: 'joint.knee',`。

(d) `defineEmits` 加：

```ts
  motionModeChange: [on: boolean];
  setJointAngle: [jointId: string, axis: string, deg: number];
  resetPose: [];
  motionJointChange: [jointId: string];
```

- [ ] **Step 2: 接線（template）**

(a) `Model3DControls` 元件加 props/emit（在既有 attr 之間）：

```vue
        :motion-mode="motionMode"
        :can-toggle-motion="canToggleMotion"
        @motion-mode-change="emit('motionModeChange', $event)"
```

(b) `Model3DView` 元件加 props：

```vue
            :motion-mode="motionMode"
            :pose="pose"
```

(c) 資訊卡預留位 `.model3dCardSlot`：運動模式時改顯 `MotionControls`。將該 `<div class="model3dCardSlot">` 內容改為條件分支：

```vue
      <div class="model3dCardSlot">
        <MotionControls
          v-if="motionMode"
          :pose="pose ?? {}"
          :selected-joint="motionJoint"
          @set-joint-angle="(j, a, d) => emit('setJointAngle', j, a, d)"
          @reset-pose="emit('resetPose')"
          @update:selected-joint="emit('motionJointChange', $event)"
        />
        <AnatomyInfoCard
          v-else-if="selected"
          :entity="selected"
          :side="selectedSide ?? null"
          :can-annotate="canAnnotate"
          :can-hide="canHide"
          @annotate="emit('annotate')"
          @hide="emit('hide')"
        />
      </div>
```

- [ ] **Step 3: typecheck ＋ 既有測試不退步**

Run: `pnpm typecheck && pnpm test -- ModelViewer Model3DControls`
Expected: EXIT 0、既有測試 PASS。

- [ ] **Step 4: Commit**

```bash
git add app/components/humanModel/Model3DViewer.vue
git commit -m "feat(motion): Model3DViewer 透傳運動 props 並嵌 MotionControls"
```

---

## Task 10: 頁面狀態接線（model.vue）

**Files:**
- Modify: `app/pages/patients/[patientId]/model.vue`

**Interfaces:**
- Consumes: Task 1 `clampAngle`、Task 2 `MotionPose`/`NEUTRAL_POSE`/`setJointAngle`/`resetPose`、Task 3 `movableJointDof`。

- [ ] **Step 1: 接線（script）**

(a) import（接既有 humanModel import 之後）：

```ts
import {
  NEUTRAL_POSE,
  resetPose as resetMotionPose,
  setJointAngle,
  type MotionPose,
} from '../../../utils/humanModel/motion/motionPose';
```

(b) 狀態（接 `const annotating = ref(false)` 之後）：

```ts
// 運動模式（§4.3.3）：開關、當前選擇關節、姿態。進運動模式暫停評估標註（獨立模式）。
const motionMode = ref(false);
const motionJoint = ref('joint.knee');
const pose = ref<MotionPose>(NEUTRAL_POSE);

function handleMotionModeChange(on: boolean): void {
  motionMode.value = on;
  if (on) {
    selection.clear();
    pose.value = resetMotionPose();
  }
}
function handleSetJointAngle(jointId: string, axis: string, deg: number): void {
  pose.value = setJointAngle(pose.value, jointId, axis, deg);
}
function handleResetPose(): void {
  pose.value = resetMotionPose();
}
```

(c) 運動模式時不可標註：將 `canAnnotate` 改為：

```ts
const canAnnotate = computed(
  () => !motionMode.value && canAnnotateSession.value && selected.value !== null,
);
```

(d) `handleResetView` 內加（重置檢視一併退出運動模式）：在 `selection.clear();` 之後加 `motionMode.value = false; pose.value = resetMotionPose();`。

- [ ] **Step 2: 接線（template）**

於 `<Model3Dviewer …>` 既有 attr 加：

```vue
        :can-toggle-motion="true"
        :motion-mode="motionMode"
        :pose="pose"
        :motion-joint="motionJoint"
        @motion-mode-change="handleMotionModeChange"
        @set-joint-angle="handleSetJointAngle"
        @reset-pose="handleResetPose"
        @motion-joint-change="motionJoint = $event"
```

（注意元件標籤為 `Model3DViewer`；上方屬性插入其屬性清單。）

- [ ] **Step 3: typecheck ＋ 既有頁面測試**

Run: `pnpm typecheck && pnpm test`
Expected: EXIT 0；全套件 PASS（含新 motion 測試）。

- [ ] **Step 4: dev 目視冒煙 ＋ 執行 Task 4 Step 7 軸校正**

Run: `pnpm dev`，開 `/patients/<任一 patientId>/model`，開「關節活動」→選膝→拉屈曲滑桿→小腿應隨之屈曲且止於 140°。逐關節執行 Task 4 Step 7 之軸/sign 校正並修 `jointKinematics.ts`。

- [ ] **Step 5: Commit**

```bash
git add app/pages/patients/[patientId]/model.vue app/utils/humanModel/motion/jointKinematics.ts
git commit -m "feat(motion): 頁面接線運動模式狀態＋軸校正"
```

---

## Task 11: 設計同步（§4.3.3 ＋ todo）

**Files:**
- Modify: `doc/design/04_human_model.md`（§4.3.3）
- Modify: `doc/todo/04_todo_human_model.md`（運動模式項；若該檔不存在，改 `doc/todo` 對應人體模型 todo 檔——先 `ls doc/todo` 確認檔名）

**Interfaces:** 無程式碼。

- [ ] **Step 1: 改寫 §4.3.3**

於 `doc/design/04_human_model.md` §4.3.3：保留 ROM 資料驅動敘述；將「Babylon BoneIKController＋骨架」之教科書取徑改述為**現實取徑**：

- 現役資產無骨架（0 skins）→ 採**剛性節段旋轉**（節段樹＋樞紐 TransformNode＋逐 DOF 滑桿，運動學見 `app/utils/humanModel/motion/`）。
- 互動：運動模式（motion mode）開關下，逐自由度滑桿驅動、`clampAngle` 鉗制於 ROM、觸界以文字＋琥珀提示（§3.6 非僅色彩）。
- v1 範圍：SFMA 臨床優先 6 關節（頸椎／肩／脊椎／髖／膝／踝）；脊椎/頸椎單樞紐近似。
- 延後（標注為待）：on-model 拖曳手柄、肌肉收縮/伸展著色（§4.3.4）、MakeHuman 真骨架＋skin 變形、肘/腕/指/趾/顳顎/胸廓等其餘關節、平滑多椎脊椎。
- 連結工作規格 `doc/design/specs/2026-06-18-motion-mode-design.md`。

- [ ] **Step 2: 更新 todo**

Run: `ls doc/todo` 確認人體模型 todo 檔名；於其中新增運動模式條目（勾選 v1 已完成項、列延後項），與 §4.3.3 一致。

- [ ] **Step 3: Commit**

```bash
git add doc/design/04_human_model.md doc/todo/
git commit -m "docs: §4.3.3 運動模式（剛性節段旋轉）設計同步＋todo"
```

---

## Self-Review Notes（作者自核，已修）

- **Spec 覆蓋**：§3 架構（Task 1–4＋8 rigController）、§4 運動學/樞紐/軸/成員（Task 3–4）、§5 脊椎/頸椎單樞紐（Task 3 JOINT_KINEMATICS）、§6 UX/狀態（Task 5–10）、§7 檔案佈局（全 task）、§8 測試（各 task 測試步）、§9 範圍外（Task 11 標注）、§10 文件同步（Task 11）皆有對應 task。
- **型別一致**：`MotionPose`、`clampAngle`/`ClampResult`、`JointKinematics`/`DofAxisMapping`、`ArticulationRig`、`RigController`、emit `setJointAngle(jointId, axis, deg)` 跨 task 名稱一致。
- **無 placeholder**：每 code step 附完整內容；唯 Task 3 Step 4 之 `knee max=140` 與 i18n 既有鍵插入位置需以實檔核對（已標明）。
- **已知校正點**：軸方向/sign（Task 4 Step 7 / Task 10 Step 4）與元件測試所屬指令（`pnpm test` vs `pnpm test:nuxt`，Task 6 Step 2）為實作時就地確認項，非 placeholder。
