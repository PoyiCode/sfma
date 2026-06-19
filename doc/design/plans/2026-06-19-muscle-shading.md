# 肌肉收縮／伸展著色（§4.3.4）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 運動模式下擺動關節時，相關肌群依「收縮（暖色）／伸展（冷色）／中性」以 mesh overlay 發散著色，並於 MotionControls 顯色階圖例＋選取關節相關肌群文字態。

**Architecture:** 純函式 `muscleShading.ts`（無 Babylon 的純量推導 ＋ NullEngine 可測的 overlay 套用＋dispatcher）為核心，由運動 `pose` × `muscle.actions` 推導每肌收縮純量；著色沿用既有 `mesh.overlayColor/overlayAlpha` 單通道，運動模式+著色開時為唯一 overlay 權威（暫停選取/標註高亮）。元件僅透傳開關 prop 與渲染。

**Tech Stack:** Nuxt 4 / Vue 3 SPA、Babylon.js（overlay/outlineRenderer、NullEngine 測試）、Pinia/i18n、Vitest（node ＋ jsdom docblock）、pnpm。

**Spec:** [doc/design/specs/2026-06-19-muscle-shading-design.md](../specs/2026-06-19-muscle-shading-design.md)

## Global Constraints

- 套件管理器一律 **pnpm**（勿 npm/yarn）。
- 命名：camelCase（變數/函式）、PascalCase（型別/元件）、UPPER_CASE（常數）；**嚴禁 snake_case**（eslint 強制）。
- 文件語言 **zh-TW**；設計同步必守（design/todo/code 不得脫節）。
- **勿重寫** `packages/shared`、`packages/definitions`（純沿用資料/型別層）。
- 單元測試：`pnpm test`（Vitest `vitest run`，node 環境，排除 `*.nuxt.test.ts`）；元件測試以檔首 `// @vitest-environment jsdom` docblock 切 jsdom；Babylon 測試用 `NullEngine`。
- v1 範圍：僅成對方向明確軸（屈伸/外展內收/內外旋/蹠背屈/內外翻）；overlay 通道（非 Node Material）；著色為運動模式內獨立開關、預設開。
- 色值（暫定、可對齊 tokens §3.7）：`WARM=#D94A2A`、`COOL=#2F6FB0`、`MAX_ALPHA=0.55`、`EPSILON=0.02`。

---

### Task 1: 核心收縮純量模型（`muscleShading.ts` 純量 ＋ `isMirroredAxis`）

**Files:**
- Modify: `app/utils/humanModel/motion/jointKinematics.ts`（匯出 `isMirroredAxis`）
- Modify: `app/utils/humanModel/motion/jointKinematics.test.ts`（測 `isMirroredAxis`）
- Create: `app/utils/humanModel/motion/muscleShading.ts`
- Create: `app/utils/humanModel/motion/muscleShading.test.ts`

**Interfaces:**
- Consumes: `jointDofForSide`/`poseKey`/`JOINT_KINEMATICS`/`MOVABLE_JOINT_IDS`（既有，`jointKinematics.ts`）；`jointAngle`/`MotionPose`（`motionPose.ts`）；`anatomyEntities`/`anatomyEntityById`（`@ptapp/definitions`）；`Muscle`（`@ptapp/shared`）。
- Produces:
  - `isMirroredAxis(axis: string): boolean`
  - `muscleContractionScalar(muscle: Muscle, pose: MotionPose, side: string | null): number`（值域 `[-1,1]`，正＝收縮）
  - `type ContractionState = 'contract' | 'stretch' | 'neutral'`
  - `contractionState(scalar: number): ContractionState`

- [ ] **Step 1: 匯出 `isMirroredAxis`（jointKinematics.ts）**

於 `app/utils/humanModel/motion/jointKinematics.ts` 既有 `MIRRORED_AXES` 常數定義之後，新增：

```ts
// 是否為左右鏡像軸（額狀／橫狀面：外展內收／內翻外翻／內外旋）。包裝 MIRRORED_AXES、不外露 Set。
export function isMirroredAxis(axis: string): boolean {
  return MIRRORED_AXES.has(axis);
}
```

- [ ] **Step 2: 寫 `isMirroredAxis` 失敗測試（jointKinematics.test.ts）**

於 `app/utils/humanModel/motion/jointKinematics.test.ts` 末端（最後一個 `});` 之前的適當位置）新增 describe：

```ts
describe('isMirroredAxis（左右鏡像軸判定）', () => {
  it('額狀／橫狀面軸為鏡像軸', () => {
    expect(isMirroredAxis('abductionAdduction')).toBe(true);
    expect(isMirroredAxis('inversionEversion')).toBe(true);
    expect(isMirroredAxis('internalExternalRotation')).toBe(true);
  });
  it('矢狀面與其他軸非鏡像', () => {
    expect(isMirroredAxis('flexionExtension')).toBe(false);
    expect(isMirroredAxis('plantarDorsiflexion')).toBe(false);
    expect(isMirroredAxis('unknownAxis')).toBe(false);
  });
});
```

於該檔頂部 import 加入 `isMirroredAxis`（與既有 `jointKinematics` import 合併；若為 `import { ... } from './jointKinematics'` 形式則加入清單）。

- [ ] **Step 3: 跑測試確認 `isMirroredAxis` 通過**

Run: `pnpm test app/utils/humanModel/motion/jointKinematics.test.ts`
Expected: PASS（含新 describe）。

- [ ] **Step 4: 寫 `muscleContractionScalar`/`contractionState` 失敗測試**

建 `app/utils/humanModel/motion/muscleShading.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { anatomyEntityById } from '@ptapp/definitions';
import type { Muscle } from '@ptapp/shared';
import type { MotionPose } from './motionPose';
import { contractionState, muscleContractionScalar } from './muscleShading';

function muscle(id: string): Muscle {
  const e = anatomyEntityById.get(id);
  if (e === undefined || e.type !== 'muscle') throw new Error(`not a muscle: ${id}`);
  return e;
}

describe('muscleContractionScalar（收縮純量；§4.3.4）', () => {
  it('主動肌於該動作全幅 → +1（收縮）：右髖外展肌外展至 +45', () => {
    // gluteusMedius: [{joint.hip, abduction}]；hip abductionAdduction 右 ROM [-30,45]
    const pose: MotionPose = { 'joint.hip#R': { abductionAdduction: 45 } };
    expect(muscleContractionScalar(muscle('muscle.gluteusMedius'), pose, '#R')).toBeCloseTo(1, 5);
  });

  it('主動肌反向 → −1（伸展）：右髖外展肌內收至 −30', () => {
    const pose: MotionPose = { 'joint.hip#R': { abductionAdduction: -30 } };
    expect(muscleContractionScalar(muscle('muscle.gluteusMedius'), pose, '#R')).toBeCloseTo(-1, 5);
  });

  it('左側鏡像軸翻轉：左髖外展（pose 落 −45）→ +1（收縮）', () => {
    // 左側 jointDofForSide 鏡像為 [-45,30]；左外展＝負端、dir 翻轉。
    const pose: MotionPose = { 'joint.hip#L': { abductionAdduction: -45 } };
    expect(muscleContractionScalar(muscle('muscle.gluteusMedius'), pose, '#L')).toBeCloseTo(1, 5);
  });

  it('拮抗肌伸展：髖屈曲 +120 時膕旁肌（hip extension）→ −1', () => {
    // bicepsFemoris: [{knee, flexion},{hip, extension}]；只動髖→ knee 貢獻 0。
    const pose: MotionPose = { 'joint.hip#R': { flexionExtension: 120 } };
    expect(muscleContractionScalar(muscle('muscle.bicepsFemoris'), pose, '#R')).toBeCloseTo(-1, 5);
  });

  it('半幅 → 比例量值：髖屈曲 +60（ROM 0..120）→ ≈ +0.5', () => {
    // rectusFemoris: [{knee, extension},{hip, flexion}]；只動髖→ +60/120=0.5。
    const pose: MotionPose = { 'joint.hip#R': { flexionExtension: 60 } };
    expect(muscleContractionScalar(muscle('muscle.rectusFemoris'), pose, '#R')).toBeCloseTo(0.5, 5);
  });

  it('多動作求和後 clamp 至 [−1,1]', () => {
    // rectusFemoris 髖屈曲滿(+1) + 膝伸展滿(膝 ROM [-5,140]，extension=負端 −5 → +1) → 和 2 → clamp 1。
    const pose: MotionPose = {
      'joint.hip#R': { flexionExtension: 120 },
      'joint.knee#R': { flexionExtension: -5 },
    };
    expect(muscleContractionScalar(muscle('muscle.rectusFemoris'), pose, '#R')).toBeCloseTo(1, 5);
  });

  it('空 pose → 0（中性）', () => {
    expect(muscleContractionScalar(muscle('muscle.gluteusMedius'), {}, '#R')).toBe(0);
  });

  it('僅作用非可動關節（如肘）→ 0（pose 無該關節項）', () => {
    // bicepsBrachii: [{elbow, flexion}]；運動 pose 僅含可動 6 關節→ 肘無項→ delta 0。
    const pose: MotionPose = { 'joint.hip#R': { flexionExtension: 120 } };
    expect(muscleContractionScalar(muscle('muscle.bicepsBrachii'), pose, null)).toBe(0);
  });
});

describe('contractionState（純量→文字態）', () => {
  it('正→contract、負→stretch、近零→neutral', () => {
    expect(contractionState(0.5)).toBe('contract');
    expect(contractionState(-0.5)).toBe('stretch');
    expect(contractionState(0)).toBe('neutral');
    expect(contractionState(0.01)).toBe('neutral'); // 在 EPSILON 內
  });
});
```

- [ ] **Step 5: 跑測試確認失敗**

Run: `pnpm test app/utils/humanModel/motion/muscleShading.test.ts`
Expected: FAIL（`muscleShading` 模組不存在 / 函式未定義）。

- [ ] **Step 6: 實作 `muscleShading.ts` 純量核心**

建 `app/utils/humanModel/motion/muscleShading.ts`：

```ts
// 肌肉收縮／伸展著色（04 §4.3.4）：由運動 pose × muscle.actions 推導每肌「收縮（暖）／伸展（冷）」
// 純量。著色由資料推導、與剛性節段綁定無關（§4.3.4）。純函式核心、可 node 測。
import { anatomyEntities } from '@ptapp/definitions';
import type { Muscle } from '@ptapp/shared';
import { type MotionPose, jointAngle } from './motionPose';
import {
  isMirroredAxis,
  JOINT_KINEMATICS,
  MOVABLE_JOINT_IDS,
  jointDofForSide,
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
```

> 註：`anatomyEntities`/`MOVABLE_JOINT_IDS` 於 Task 2 用到，先 import 不會 lint 失敗（皆會在本檔被使用）；若執行至此 eslint 報未使用，將 `anatomyEntities`/`MOVABLE_JOINT_IDS` 暫移除、於 Task 2 補回。

- [ ] **Step 7: 跑測試確認通過**

Run: `pnpm test app/utils/humanModel/motion/muscleShading.test.ts app/utils/humanModel/motion/jointKinematics.test.ts`
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add app/utils/humanModel/motion/jointKinematics.ts app/utils/humanModel/motion/jointKinematics.test.ts app/utils/humanModel/motion/muscleShading.ts app/utils/humanModel/motion/muscleShading.test.ts
git commit -m "feat(motion): 肌肉收縮純量模型（muscleContractionScalar/contractionState）"
```

---

### Task 2: `musclesForJoint`（選取關節相關肌群）

**Files:**
- Modify: `app/utils/humanModel/motion/muscleShading.ts`
- Modify: `app/utils/humanModel/motion/muscleShading.test.ts`

**Interfaces:**
- Produces: `musclesForJoint(jointId: string): Muscle[]`（作用於該可動關節且 action 於 v1 著色表者；非可動關節→空集）

- [ ] **Step 1: 寫失敗測試**

於 `muscleShading.test.ts` 頂部 import 補入 `musclesForJoint`：

```ts
import { contractionState, muscleContractionScalar, musclesForJoint } from './muscleShading';
```

新增 describe：

```ts
describe('musclesForJoint（選取關節相關肌群）', () => {
  it('取作用於髖且 v1 會著色之肌（含 gluteusMedius）', () => {
    const ids = musclesForJoint('joint.hip').map((m) => m.anatomyId);
    expect(ids).toContain('muscle.gluteusMedius');
    expect(ids).toContain('muscle.rectusFemoris');
    expect(ids.length).toBeGreaterThan(0);
  });
  it('全回傳項皆為 muscle 型別', () => {
    expect(musclesForJoint('joint.hip').every((m) => m.type === 'muscle')).toBe(true);
  });
  it('非可動關節（肘）→ 空集', () => {
    expect(musclesForJoint('joint.elbow')).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test app/utils/humanModel/motion/muscleShading.test.ts`
Expected: FAIL（`musclesForJoint` 未匯出）。

- [ ] **Step 3: 實作 `musclesForJoint`**

於 `muscleShading.ts` `contractionState` 之後新增：

```ts
// 作用於某可動關節、且 action 於 v1 著色表有對應之肌；非可動關節或無對應 → 空集。
export function musclesForJoint(jointId: string): Muscle[] {
  if (!MOVABLE_JOINT_IDS.includes(jointId)) return [];
  return anatomyEntities.filter(
    (e): e is Muscle =>
      e.type === 'muscle' &&
      e.actions.some((a) => a.jointId === jointId && ACTION_AXIS[a.action] !== undefined),
  );
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test app/utils/humanModel/motion/muscleShading.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add app/utils/humanModel/motion/muscleShading.ts app/utils/humanModel/motion/muscleShading.test.ts
git commit -m "feat(motion): musclesForJoint 取選取關節相關肌群"
```

---

### Task 3: `applyMuscleShading`（overlay 套用，NullEngine）

**Files:**
- Modify: `app/utils/humanModel/motion/muscleShading.ts`
- Modify: `app/utils/humanModel/motion/muscleShading.test.ts`

**Interfaces:**
- Consumes: `Color3`/`Scene`/outlineRenderer（`@babylonjs/core`）；`PlaceholderMeshMetadata`（`../render/sceneCore`）；`sideOfMesh`（`./meshToJoint`）；`anatomyEntityById`（`@ptapp/definitions`）。
- Produces: `applyMuscleShading(scene: Scene, pose: MotionPose): void`、`WARM`/`COOL`（`Color3`，export 供測試比對）。

- [ ] **Step 1: 寫失敗測試（NullEngine）**

於 `muscleShading.test.ts` 頂部新增 import：

```ts
import { Color3, MeshBuilder, NullEngine } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { createModelScene, type PlaceholderMeshMetadata } from '../render/sceneCore';
```

並把現有 `import { contractionState, ... } from './muscleShading';` 補上 `applyMuscleShading, COOL, WARM`：

```ts
import {
  applyMuscleShading,
  contractionState,
  COOL,
  muscleContractionScalar,
  musclesForJoint,
  WARM,
} from './muscleShading';
```

新增 describe（mesh 名帶 `#L/#R`、metadata.entityType='muscle'，模擬真實資產）：

```ts
describe('applyMuscleShading（overlay 著色；§4.3.4）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });

  function addMuscle(scene: Scene, anatomyId: string, side: 'L' | 'R'): void {
    const mesh = MeshBuilder.CreateBox(`${anatomyId}#${side}`, { size: 1 }, scene);
    const metadata: PlaceholderMeshMetadata = {
      anatomyId,
      entityType: 'muscle',
      side: side === 'L' ? 'left' : 'right',
    };
    mesh.metadata = metadata;
  }
  function addBone(scene: Scene, anatomyId: string): void {
    const mesh = MeshBuilder.CreateBox(anatomyId, { size: 1 }, scene);
    mesh.metadata = { anatomyId, entityType: 'bone' } satisfies PlaceholderMeshMetadata;
  }
  function scene(): Scene {
    engine = new NullEngine();
    const s = createModelScene(engine);
    addMuscle(s, 'muscle.gluteusMedius', 'R'); // hip abduction
    addMuscle(s, 'muscle.bicepsFemoris', 'R'); // hip extension（拮抗）
    addBone(s, 'bone.femur');
    return s;
  }
  const get = (s: Scene, name: string) => s.getMeshByName(name)!;

  it('收縮肌得暖色 overlay、拮抗肌得冷色：右髖屈曲 +120', () => {
    const s = scene();
    applyMuscleShading(s, { 'joint.hip#R': { flexionExtension: 120 } });
    const rf = get(s, 'muscle.bicepsFemoris#R'); // 髖伸肌 → 屈曲時伸展（冷）
    expect(rf.renderOverlay).toBe(true);
    expect(rf.overlayColor.equals(COOL)).toBe(true);
    // gluteusMedius 僅外展、屈曲不動之 → 中性、無 overlay
    expect(get(s, 'muscle.gluteusMedius#R').renderOverlay).toBe(false);
  });

  it('外展肌外展 +45 → 暖色 overlay、alpha>0', () => {
    const s = scene();
    applyMuscleShading(s, { 'joint.hip#R': { abductionAdduction: 45 } });
    const gm = get(s, 'muscle.gluteusMedius#R');
    expect(gm.renderOverlay).toBe(true);
    expect(gm.overlayColor.equals(WARM)).toBe(true);
    expect(gm.overlayAlpha).toBeGreaterThan(0);
  });

  it('非肌肉 mesh 一律清 overlay', () => {
    const s = scene();
    const bone = get(s, 'bone.femur');
    bone.renderOverlay = true; // 模擬殘留選取
    applyMuscleShading(s, { 'joint.hip#R': { abductionAdduction: 45 } });
    expect(bone.renderOverlay).toBe(false);
  });

  it('中性 pose → 全肌無 overlay', () => {
    const s = scene();
    applyMuscleShading(s, {});
    expect(get(s, 'muscle.gluteusMedius#R').renderOverlay).toBe(false);
    expect(get(s, 'muscle.bicepsFemoris#R').renderOverlay).toBe(false);
  });
});
```

於檔頂 `import { describe, expect, it } from 'vitest';` 補 `afterEach`：

```ts
import { afterEach, describe, expect, it } from 'vitest';
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test app/utils/humanModel/motion/muscleShading.test.ts`
Expected: FAIL（`applyMuscleShading`/`WARM`/`COOL` 未匯出）。

- [ ] **Step 3: 實作 `applyMuscleShading`**

於 `muscleShading.ts` 頂部 import 區補入：

```ts
import { Color3, type Scene } from '@babylonjs/core';
import '@babylonjs/core/Rendering/outlineRenderer';
import { anatomyEntities, anatomyEntityById } from '@ptapp/definitions';
import type { PlaceholderMeshMetadata } from '../render/sceneCore';
import { sideOfMesh } from './meshToJoint';
```

（將既有 `import { anatomyEntities } from '@ptapp/definitions';` 併為上面的 `{ anatomyEntities, anatomyEntityById }`。）

於檔末新增：

```ts
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
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test app/utils/humanModel/motion/muscleShading.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add app/utils/humanModel/motion/muscleShading.ts app/utils/humanModel/motion/muscleShading.test.ts
git commit -m "feat(motion): applyMuscleShading 以 overlay 著色肌肉收縮/伸展"
```

---

### Task 4: `applyOverlays` 單一權威 dispatcher（NullEngine）

**Files:**
- Modify: `app/utils/humanModel/motion/muscleShading.ts`
- Modify: `app/utils/humanModel/motion/muscleShading.test.ts`

**Interfaces:**
- Consumes: `applyHighlights`（`../render/sceneHighlight`）；`AnnotationHighlights`（`../anatomy/anatomyHighlight`）。
- Produces:
  - `interface OverlayParams { motionMode: boolean; muscleShading: boolean; pose: MotionPose; selectedKey: string | null; highlights?: AnnotationHighlights }`
  - `applyOverlays(scene: Scene, params: OverlayParams): void`

- [ ] **Step 1: 寫失敗測試**

於 `muscleShading.test.ts` import 區補入：

```ts
import { partKey } from '../anatomy/partKey';
import { SELECTION_OVERLAY_COLOR } from '../render/sceneHighlight';
```

並把 `from './muscleShading'` 的 import 補 `applyOverlays`、`type OverlayParams`（如需）。新增 describe：

```ts
describe('applyOverlays（overlay 單一權威 dispatcher）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function sidedMuscle(s: Scene, anatomyId: string, side: 'L' | 'R'): void {
    const m = MeshBuilder.CreateBox(`${anatomyId}#${side}`, { size: 1 }, s);
    m.metadata = {
      anatomyId,
      entityType: 'muscle',
      side: side === 'L' ? 'left' : 'right',
    } satisfies PlaceholderMeshMetadata;
  }
  function scene(): Scene {
    engine = new NullEngine();
    const s = createModelScene(engine);
    sidedMuscle(s, 'muscle.gluteusMedius', 'R');
    return s;
  }

  it('運動模式+著色開 → 走肌肉著色（外展肌外展得暖色）', () => {
    const s = scene();
    applyOverlays(s, {
      motionMode: true,
      muscleShading: true,
      pose: { 'joint.hip#R': { abductionAdduction: 45 } },
      selectedKey: null,
    });
    expect(s.getMeshByName('muscle.gluteusMedius#R')!.overlayColor.equals(WARM)).toBe(true);
  });

  it('運動模式但著色關 → 走選取/標註高亮（選取部位 accent）', () => {
    const s = scene();
    applyOverlays(s, {
      motionMode: true,
      muscleShading: false,
      pose: { 'joint.hip#R': { abductionAdduction: 45 } },
      selectedKey: partKey('muscle.gluteusMedius', 'right'),
    });
    // 選取高亮以 partKey 比對 metadata.anatomyId+side → accent；非肌肉著色色。
    const gm = s.getMeshByName('muscle.gluteusMedius#R')!;
    expect(gm.renderOverlay).toBe(true);
    expect(gm.overlayColor.equals(SELECTION_OVERLAY_COLOR)).toBe(true);
  });

  it('非運動模式 → 走選取/標註高亮', () => {
    const s = scene();
    applyOverlays(s, {
      motionMode: false,
      muscleShading: true,
      pose: {},
      selectedKey: partKey('muscle.gluteusMedius', 'right'),
    });
    expect(
      s.getMeshByName('muscle.gluteusMedius#R')!.overlayColor.equals(SELECTION_OVERLAY_COLOR),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test app/utils/humanModel/motion/muscleShading.test.ts`
Expected: FAIL（`applyOverlays` 未匯出）。

- [ ] **Step 3: 實作 `applyOverlays`**

於 `muscleShading.ts` 頂部 import 補入：

```ts
import type { AnnotationHighlights } from '../anatomy/anatomyHighlight';
import { applyHighlights } from '../render/sceneHighlight';
```

於檔末新增：

```ts
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
    applyHighlights(scene, params.selectedKey, params.highlights);
  }
}
```

- [ ] **Step 4: 跑測試確認通過 ＋ 全套件回歸**

Run: `pnpm test app/utils/humanModel/motion/muscleShading.test.ts`
Expected: PASS。

Run: `pnpm test`
Expected: 全綠（既有 786 ＋ 本批新增）。

- [ ] **Step 5: Commit**

```bash
git add app/utils/humanModel/motion/muscleShading.ts app/utils/humanModel/motion/muscleShading.test.ts
git commit -m "feat(motion): applyOverlays 收斂著色/高亮為單一 overlay 權威"
```

---

### Task 5: i18n 鍵 ＋ MotionControls（開關＋圖例＋相關肌群清單）

**Files:**
- Modify: `i18n/locales/zh-TW.json`
- Modify: `app/components/humanModel/MotionControls.vue`
- Modify: `app/components/humanModel/MotionControls.test.ts`

**Interfaces:**
- Consumes: `musclesForJoint`/`muscleContractionScalar`/`contractionState`/`type ContractionState`（`muscleShading.ts`）；`BaseSwitch`（`../base/Switch.vue`）；`localizeText`。
- Produces（MotionControls 對外）：新增 prop `muscleShading: boolean`；新增 emit `'update:muscleShading': [boolean]`。

- [ ] **Step 1: 加 i18n 鍵**

於 `i18n/locales/zh-TW.json` 既有 `"motionAxisRotation": "旋轉",` 之後新增（注意前一行補逗號）：

```json
"modelMuscleShading": "肌肉著色",
"muscleShadingContract": "收縮",
"muscleShadingStretch": "伸展",
"muscleShadingNeutral": "中性",
"muscleShadingRelated": "相關肌群",
```

- [ ] **Step 2: 寫 MotionControls 失敗測試**

於 `app/components/humanModel/MotionControls.test.ts`（檔首已有 `// @vitest-environment jsdom`）新增測試（沿用該檔既有 mount 工具與 i18n stub 模式；以下假設既有測試以 `mountSuspended` 或 `mount` ＋ i18n。若該檔已有 helper `mountMotion(props)`，沿用之並補 `muscleShading` prop）：

```ts
it('著色開（muscleShading=true）→ 顯開關、圖例與相關肌群清單', async () => {
  const wrapper = await mountMotion({
    pose: { 'joint.hip#R': { abductionAdduction: 45 } },
    selectedJoint: 'joint.hip',
    selectedSide: '#R',
    muscleShading: true,
  });
  expect(wrapper.find('[data-testid="muscle-shading-toggle"]').exists()).toBe(true);
  expect(wrapper.find('[data-testid="muscle-shading-legend"]').exists()).toBe(true);
  // 相關肌群清單含至少一項
  expect(wrapper.findAll('[data-testid="muscle-shading-item"]').length).toBeGreaterThan(0);
});

it('著色關（muscleShading=false）→ 不顯圖例與清單', async () => {
  const wrapper = await mountMotion({
    pose: {},
    selectedJoint: 'joint.hip',
    selectedSide: '#R',
    muscleShading: false,
  });
  expect(wrapper.find('[data-testid="muscle-shading-legend"]').exists()).toBe(false);
  expect(wrapper.findAll('[data-testid="muscle-shading-item"]').length).toBe(0);
});

it('切換開關 → emit update:muscleShading', async () => {
  const wrapper = await mountMotion({
    pose: {},
    selectedJoint: 'joint.hip',
    selectedSide: '#R',
    muscleShading: true,
  });
  // BaseSwitch（USwitch）內含 role=switch；點擊切換
  await wrapper.find('[role="switch"]').trigger('click');
  expect(wrapper.emitted('update:muscleShading')).toBeTruthy();
});
```

> 若 `MotionControls.test.ts` 尚無共用 `mountMotion(props)` helper：以該檔現有單一測試的 mount 寫法為樣板，抽出一個傳入 `props`（含必填 `pose`/`selectedJoint`/`selectedSide`/`muscleShading`）的 helper，使既有測試與新測試共用；既有測試補上 `muscleShading: true`（或 false）prop 以滿足新必填 prop。

- [ ] **Step 3: 跑測試確認失敗**

Run: `pnpm test app/components/humanModel/MotionControls.test.ts`
Expected: FAIL（無 `muscle-shading-*` 元素、prop 未定義）。

- [ ] **Step 4: 實作 MotionControls 變更**

於 `app/components/humanModel/MotionControls.vue` `<script setup>`：

(a) import 區補入：

```ts
import BaseSwitch from '../base/Switch.vue';
import {
  contractionState,
  type ContractionState,
  muscleContractionScalar,
  musclesForJoint,
} from '../../utils/humanModel/motion/muscleShading';
```

(b) `Props` 介面新增（於 `selectedSide` 之後）：

```ts
  // 肌肉著色（§4.3.4）：運動模式內獨立開關（預設由父持、預設開）。
  muscleShading: boolean;
```

(c) `defineEmits` 物件新增一行：

```ts
  'update:muscleShading': [on: boolean];
```

(d) script 中（`sliders` computed 之後）新增文字態鍵表與相關肌群 computed：

```ts
const STATE_KEYS: Record<ContractionState, string> = {
  contract: 'muscleShadingContract',
  stretch: 'muscleShadingStretch',
  neutral: 'muscleShadingNeutral',
};

interface RelatedMuscle {
  anatomyId: string;
  label: string;
  stateLabel: string;
  percent: number; // 0..100，量值（含方向已由 stateLabel 表達）
}

// 選取關節相關肌群（§4.3.4 非色彩通道）：著色開時，逐肌顯收縮/伸展/中性＋量值。
const relatedMuscles = computed<RelatedMuscle[]>(() => {
  if (!props.muscleShading) return [];
  return musclesForJoint(props.selectedJoint).map((m) => {
    const scalar = muscleContractionScalar(m, props.pose, props.selectedSide);
    return {
      anatomyId: m.anatomyId,
      label: localizeText(m.name),
      stateLabel: t(STATE_KEYS[contractionState(scalar)]),
      percent: Math.round(Math.abs(scalar) * 100),
    };
  });
});

function onMuscleShading(on: boolean): void {
  emit('update:muscleShading', on);
}
```

(e) `<template>` 中，於回中立按鈕（`data-testid="motion-reset"` 之 `BaseButton`）**之前**插入：

```vue
    <BaseSwitch
      data-testid="muscle-shading-toggle"
      :model-value="muscleShading"
      :label="t('modelMuscleShading')"
      @update:model-value="onMuscleShading($event === true)"
    />
    <div v-if="muscleShading" data-testid="muscle-shading-legend" class="muscleShadingLegend">
      <span class="legendSwatch legendContract" />{{ t('muscleShadingContract') }}
      <span class="legendSwatch legendNeutral" />{{ t('muscleShadingNeutral') }}
      <span class="legendSwatch legendStretch" />{{ t('muscleShadingStretch') }}
    </div>
    <ul v-if="muscleShading && relatedMuscles.length" class="muscleShadingList">
      <li
        v-for="m in relatedMuscles"
        :key="m.anatomyId"
        data-testid="muscle-shading-item"
        class="muscleShadingItem"
      >
        <span>{{ m.label }}</span>
        <span class="muscleShadingState">{{ m.stateLabel }} {{ m.percent }}%</span>
      </li>
    </ul>
```

(f) `<style scoped>` 末端新增（色票對齊 WARM/COOL）：

```css
.muscleShadingLegend {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}
.legendSwatch {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  border-radius: var(--radius-sm);
}
.legendContract {
  background: #d94a2a;
}
.legendNeutral {
  background: var(--color-border);
}
.legendStretch {
  background: #2f6fb0;
}
.muscleShadingList {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.muscleShadingItem {
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
  color: var(--color-text);
}
.muscleShadingState {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-muted);
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `pnpm test app/components/humanModel/MotionControls.test.ts`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add i18n/locales/zh-TW.json app/components/humanModel/MotionControls.vue app/components/humanModel/MotionControls.test.ts
git commit -m "feat(motion): MotionControls 肌肉著色開關＋色階圖例＋相關肌群文字態"
```

---

### Task 6: Model3DView ＋ Model3DViewer 接線（muscleShading prop＋applyOverlays）

**Files:**
- Modify: `app/components/humanModel/Model3DView.vue`
- Modify: `app/components/humanModel/Model3DViewer.vue`

**Interfaces:**
- Consumes: `applyOverlays`/`type OverlayParams`（`muscleShading.ts`）。
- Produces: 兩元件對外新增 prop `muscleShading?: boolean`（預設 `true`）；`Model3DViewer` 新增 emit `muscleShadingChange: [boolean]`，並透傳至 `MotionControls`（`@update:muscle-shading`）與 `Model3DView`（`:muscle-shading`）。

- [ ] **Step 1: Model3DView — 引入 applyOverlays、加 prop**

於 `Model3DView.vue` import 區，將既有 `import { applyHighlights } from '../../utils/humanModel/render/sceneHighlight';` 替換為：

```ts
import {
  applyOverlays,
  type OverlayParams,
} from '../../utils/humanModel/motion/muscleShading';
```

（`applyHighlights` 不再於本檔直接使用——由 `applyOverlays` 內部呼叫。）

於 `Props`（運動模式 prop 區，`pose?` 附近）新增：

```ts
// 肌肉著色（§4.3.4）：運動模式內獨立開關，預設開。
muscleShading?: boolean;
```

於 `withDefaults`（既有 `motionMode: false,` 附近）新增：

```ts
muscleShading: true,
```

- [ ] **Step 2: Model3DView — 加 refreshOverlays 並改接三處**

於 `<script setup>` 適當位置（如 `let rigController...` 宣告附近的函式區）新增：

```ts
function overlayParams(): OverlayParams {
  return {
    motionMode: props.motionMode,
    muscleShading: props.muscleShading,
    pose: props.pose ?? {},
    selectedKey: props.selectedId ?? null,
    highlights: props.highlights,
  };
}
function refreshOverlays(): void {
  if (scene) applyOverlays(scene, overlayParams());
}
```

(a) 初次填充：將 `applyHighlights(builtScene, props.selectedId ?? null, props.highlights);` 改為 `refreshOverlays();`

(b) 高亮 watcher：將
```ts
watch(
  () => [props.selectedId, props.highlights] as const,
  () => {
    if (scene) applyHighlights(scene, props.selectedId ?? null, props.highlights);
  },
);
```
改為
```ts
watch(
  () => [props.selectedId, props.highlights] as const,
  () => refreshOverlays(),
);
```

(c) 運動 watcher：將其依賴陣列加入 `props.muscleShading`，並於 callback 末端加 `refreshOverlays()`：
```ts
watch(
  () => [props.motionMode, props.motionJoint, props.motionSide, props.pose, props.muscleShading] as const,
  () => {
    if (rigController) rigController.sync(props.motionMode, props.pose ?? {});
    if (gizmoController) {
      gizmoController.sync(
        props.motionMode,
        props.motionJoint ?? null,
        props.motionSide ?? null,
        props.pose ?? {},
      );
    }
    refreshOverlays();
  },
);
```

- [ ] **Step 3: Model3DViewer — 加 prop/emit/透傳**

於 `Model3DViewer.vue` `Props`（`motionSide` 附近）新增：

```ts
muscleShading?: boolean;
```

於 `withDefaults`（如有；若無預設則於 Props 設選填並於模板 `?? true`）新增 `muscleShading: true,`。
於 `defineEmits` 物件新增：

```ts
muscleShadingChange: [on: boolean];
```

於模板 `<Model3DView ...>` 標籤新增 prop：

```vue
:muscle-shading="muscleShading ?? true"
```

於模板 `<MotionControls ...>` 標籤新增 prop 與事件：

```vue
:muscle-shading="muscleShading ?? true"
@update:muscle-shading="emit('muscleShadingChange', $event)"
```

- [ ] **Step 4: 型別檢查 ＋ 回歸測試**

Run: `pnpm typecheck`
Expected: 無錯誤（`ℹ Nuxt Icon ...` 資訊列可忽略）。

Run: `pnpm test`
Expected: 全綠。

- [ ] **Step 5: Commit**

```bash
git add app/components/humanModel/Model3DView.vue app/components/humanModel/Model3DViewer.vue
git commit -m "feat(motion): Model3DView/Viewer 透傳 muscleShading 並以 applyOverlays 派發"
```

---

### Task 7: model.vue 頁面接線（muscleShading ref ＋ handler）

**Files:**
- Modify: `app/pages/patients/[patientId]/model.vue`

**Interfaces:**
- Consumes: `Model3DViewer` 之 `muscle-shading` prop 與 `muscleShadingChange` emit（Task 6）。
- Produces: 頁面 `muscleShading` ref（預設 `true`）流入檢視器。

- [ ] **Step 1: 加 ref**

於 `model.vue` `<script setup>` 運動模式 state 區（`const pose = ref<MotionPose>(NEUTRAL_POSE);` 之後）新增：

```ts
// 肌肉著色（§4.3.4）：運動模式內獨立開關，預設開（記憶體暫態、未持久化）。
const muscleShading = ref(true);
```

- [ ] **Step 2: 模板綁定**

於 `<Model3DViewer ...>` 新增 prop 與事件（與 `:motion-side` 等相鄰）：

```vue
        :muscle-shading="muscleShading"
        @muscle-shading-change="muscleShading = $event"
```

- [ ] **Step 3: 型別檢查**

Run: `pnpm typecheck`
Expected: 無錯誤。

- [ ] **Step 4: 全套件回歸**

Run: `pnpm test`
Expected: 全綠。

- [ ] **Step 5: Commit**

```bash
git add "app/pages/patients/[patientId]/model.vue"
git commit -m "feat(motion): model 頁接線 muscleShading 開關"
```

---

### Task 8: 設計同步 ＋ 最終驗證

**Files:**
- Modify: `doc/design/04_human_model.md`（§4.3.4）
- Modify: `doc/todo/04_todo_human_model.md`
- （spec `doc/design/specs/2026-06-19-muscle-shading-design.md` 已存在於工作樹，一併納入本 commit）

- [ ] **Step 1: 更新 §4.3.4（04_human_model.md）**

將 §4.3.4 末之 `> **待**：Node Material 收縮／伸展著色尚待實作。` 替換為：

```markdown
**現役：overlay 著色**（§4.3.3 同管道）——運動模式擺動關節時，相關肌群依 `muscleContractionScalar`
（pose × `muscle.actions`）以 mesh overlay 發散著色：收縮暖（`#D94A2A`）、伸展冷（`#2F6FB0`）、
中性無 overlay，alpha ∝ |純量|。運動模式內**獨立開關**（預設開）；著色開時為**唯一 overlay 權威**
（`applyOverlays` 暫停選取/標註高亮，運動模式以 gizmo 表達選取關節）。非色彩通道（§3.6）：
MotionControls 顯暖↔冷色階**圖例** ＋「選取關節相關肌群」逐肌**文字態**（收縮/伸展/中性＋量值）。

- **方向明確成對軸**（屈伸/外展內收/內外旋/蹠背屈/內外翻）；複合軸名第一動作為正向。
- **左側鏡像翻轉**：鏡像軸（外展內收/內翻外翻/內外旋）左側收縮方向翻轉，與 `jointDofForSide` 一致。
- **對未校正世界 sign 免疫**：著色與 rig 讀同一 pose，主動肌縮/拮抗肌伸關係恆成立。

> **待（後續軌）**：Node Material 發散材質（更細緻漸層）；`lateralFlexion`／`rotation` 軸（資料 action
> 單名、無左右方向）著色；肌肉實際長度量測。工作規格：[2026-06-19-muscle-shading-design.md](specs/2026-06-19-muscle-shading-design.md)。
```

- [ ] **Step 2: 更新 todo（04_todo_human_model.md）**

於「肌肉收縮／伸展著色」段，將：

```markdown
## 肌肉收縮／伸展著色

- [ ] 關節角度 → 肌肉長度變化推算（由 `relatedJoints`／`actions` 資料驅動；04 §4.3.4）
- [ ] Node Material 參數驅動：收縮暖色／伸展冷色／中性基準色，強度對應變化量
- [ ] 色彩之外的輔助提示（無障礙；03 §3.6）
```

改為：

```markdown
## 肌肉收縮／伸展著色

- [x] 關節角度 → 肌肉長度變化純量（pose × `actions`，方向明確成對軸；`muscleContractionScalar`；04 §4.3.4）
- [x] overlay 發散著色（收縮暖／伸展冷／中性無；運動模式內獨立開關、預設開；`applyMuscleShading`/`applyOverlays`）
- [x] 非色彩輔助（§3.6）：色階圖例＋選取關節相關肌群文字態（MotionControls）
- [ ] Node Material 參數驅動發散材質（更細緻漸層，取代 overlay）
- [ ] `lateralFlexion`／`rotation` 軸著色（資料 action 單名、待左右方向）
```

並於「運動模式」段「待實作（後續軌）」之 `- [ ] 肌肉收縮／伸展著色（04 §4.3.4；待 Node Material）` 改為：
`- [x] 肌肉收縮／伸展著色（overlay；04 §4.3.4）` 〔若該行存在〕。

- [ ] **Step 3: 最終全量驗證**

Run: `pnpm test`
Expected: 全綠（含本批新增）。

Run: `pnpm typecheck`
Expected: 無錯誤。

Run: `pnpm lint`
Expected: `ESLint: No issues found`（或無錯誤輸出）。

- [ ] **Step 4: Commit（含 spec 與 docs）**

```bash
git add doc/design/04_human_model.md doc/todo/04_todo_human_model.md doc/design/specs/2026-06-19-muscle-shading-design.md doc/design/plans/2026-06-19-muscle-shading.md
git commit -m "docs(motion): 肌肉著色 §4.3.4 設計同步（spec/§4.3.4/todo）"
```

---

## Self-Review

**1. Spec coverage（逐節對照）：**
- §1 核心模型（ACTION_AXIS/muscleContractionScalar/contractionState/isMirroredAxis）→ Task 1 ✓；`musclesForJoint` → Task 2 ✓。
- §2 applyMuscleShading（overlay、清非肌肉、sideOfMesh、色值）→ Task 3 ✓。
- §3 applyOverlays 單一權威 dispatcher → Task 4；Model3DView 三 watcher 改接 → Task 6 ✓。
- §4 元件接線：MotionControls（開關/圖例/清單）→ Task 5；Model3DView/Viewer 透傳 → Task 6；model.vue → Task 7；i18n → Task 5 ✓。
- §5 邊界情形（非可動關節 0、多關節 clamp、空 pose 0、鏡像翻轉、佔位 no-op）→ Task 1/3 測試涵蓋 ✓。
- 設計同步（§4.3.4/todo）→ Task 8 ✓。

**2. Placeholder scan：** 無 TBD/TODO；每段含實際程式碼與指令。

**3. Type consistency：** `muscleContractionScalar(muscle, pose, side)`、`applyMuscleShading(scene, pose)`、`applyOverlays(scene, params)`、`contractionState(scalar)`、`musclesForJoint(jointId)`、`isMirroredAxis(axis)`、`OverlayParams` 於各 Task 簽章一致；`muscleShading` prop/emit（`update:muscleShading`/`muscleShadingChange`）命名於 Task 5/6/7 一致；`WARM`/`COOL`/`EPSILON`/`MAX_ALPHA` 常數一致。
