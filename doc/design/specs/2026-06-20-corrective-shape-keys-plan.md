# 下肢極限屈曲 corrective shape keys — 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 下肢（膝/髖/踝 L/R）極限屈曲處 LBS candy-wrapper 塌陷，以 procedural 生成之 corrective morph 修正，runtime 依屈曲角度驅動 morph 權重，保留完整臨床 ROM。

**Architecture:** 三部分——(A) `rigSkin.py` 於 `bind_meshes` 後 procedural 生成 shape key `corr.<jointId>`（保體積目標−LBS 之 rest-space delta）；(B) `exportGltf.py` 帶 morph 匯出；(C) 新 `morphTargetController.ts` 於 `Model3DView.vue` watcher 內隨 pose 變更設 morph influence。契約＝morph target 名 `corr.<jointId>`（Babylon glTF loader 由 `extras.targetNames` 還原名）。

**Tech Stack:** Blender bpy（Python 3.13、numpy、mathutils）、Babylon.js 9.12.1（MorphTargetManager）、Vue 3 / Nuxt 4、Vitest（node 環境＋NullEngine）。

**設計來源:** [spec](2026-06-20-corrective-shape-keys-design.md)

## Global Constraints

- 套件管理器一律 **pnpm**（勿 npm/yarn）。
- TS/Vue 命名：camelCase（變數/函式）、PascalCase（型別/元件）、全大寫常數；**嚴禁 snake_case**（eslint 強制）。Python 檔（`*.py`）沿用 snake_case（eslint 不及）。
- 單元測試 `*.test.ts`（Vitest node 環境，**排除** `*.nuxt.test.ts`）；Babylon 測試用 **NullEngine**。
- 文件語言 zh-tw；**設計同步必守**：變更同步 `doc/design` 與 `doc/todo`。
- 出貨 glb 部署於 `public/models/anatomyV1.glb`（gitignored）；重出前已存 `public/models/anatomyV1.noskel.bak.glb` 備份。
- morph 驅動軸 per joint：膝/髖＝`flexionExtension`、踝＝`plantarDorsiflexion`（見 `jointKinematics.ts` DOF.axis）。
- corrective 由「子關節」（`crossJointBlend.distal`）屈曲驅動；morph 名＝`corr.<distal jointId>`。

---

### Task 1: `correctiveWeight` 純函式（morph 權重曲線）

**Files:**
- Create: `app/utils/humanModel/motion/morphTargetController.ts`
- Test: `app/utils/humanModel/motion/morphTargetController.test.ts`

**Interfaces:**
- Produces: `correctiveWeight(angleDeg: number, onsetDeg: number, refDeg: number): number` — `|angle| ≤ onset`→0、`≥ ref`→1、之間 smoothstep；`ref ≤ onset`→0。

- [ ] **Step 1: 寫失敗測試**

```ts
// app/utils/humanModel/motion/morphTargetController.test.ts
import { describe, expect, it } from 'vitest';
import { correctiveWeight } from './morphTargetController';

describe('correctiveWeight', () => {
  it('onset 以下回 0（含絕對值）', () => {
    expect(correctiveWeight(0, 84, 140)).toBe(0);
    expect(correctiveWeight(84, 84, 140)).toBe(0);
    expect(correctiveWeight(-84, 84, 140)).toBe(0);
  });
  it('ref 以上回 1', () => {
    expect(correctiveWeight(140, 84, 140)).toBe(1);
    expect(correctiveWeight(1000, 84, 140)).toBe(1);
  });
  it('區間 smoothstep（中點 0.5、單調遞增）', () => {
    expect(correctiveWeight((84 + 140) / 2, 84, 140)).toBeCloseTo(0.5, 5);
    expect(correctiveWeight(100, 84, 140)).toBeLessThan(correctiveWeight(120, 84, 140));
  });
  it('ref<=onset 防呆回 0', () => {
    expect(correctiveWeight(200, 140, 140)).toBe(0);
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test -- morphTargetController`
Expected: FAIL（`correctiveWeight` is not exported / module 無此匯出）

- [ ] **Step 3: 最小實作**

```ts
// app/utils/humanModel/motion/morphTargetController.ts
// 極限屈曲 corrective morph 控制（spec 2026-06-20）：依關節屈曲角度設 morph influence，
// 回復 LBS candy-wrapper 塌陷之體積。morph 契約名＝`corr.<jointId>`（distal 關節）。

// morph 權重曲線：|angle| onset 下 0、ref 上 1、之間 smoothstep（C1 連續、端點導數 0）。
export function correctiveWeight(angleDeg: number, onsetDeg: number, refDeg: number): number {
  if (refDeg <= onsetDeg) return 0;
  const c = Math.min(1, Math.max(0, (Math.abs(angleDeg) - onsetDeg) / (refDeg - onsetDeg)));
  return c * c * (3 - 2 * c);
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test -- morphTargetController`
Expected: PASS（4 tests）

- [ ] **Step 5: Commit**

```bash
git add app/utils/humanModel/motion/morphTargetController.ts app/utils/humanModel/motion/morphTargetController.test.ts
git commit -m "feat(motion): correctiveWeight 純函式（corrective morph 權重 smoothstep 曲線）"
```

---

### Task 2: `createMorphTargetController`（依 pose 設 morph influence）

**Files:**
- Modify: `app/utils/humanModel/motion/morphTargetController.ts`
- Test: `app/utils/humanModel/motion/morphTargetController.test.ts`（續寫）

**Interfaces:**
- Consumes: `correctiveWeight`（Task 1）；`jointAngle`（`motionPose.ts`）；`poseKey`、`movableJointDof`（`jointKinematics.ts`）。
- Produces: `interface MorphTargetController { sync(pose: MotionPose): void; dispose(): void }`；`createMorphTargetController(scene: Scene): MorphTargetController` — 建立期掃描 `scene.meshes` 之 `morphTargetManager`，收集名為 `corr.<jointId>`（jointId∈{knee,hip,ankle}）之 target；`sync` 依該關節該側屈曲角度設 influence；`dispose` 全歸 0。

- [ ] **Step 1: 寫失敗測試（NullEngine）**

```ts
// 續 morphTargetController.test.ts —— 檔頂 import 增補：
import { MeshBuilder, MorphTarget, MorphTargetManager, NullEngine, Scene, VertexBuffer } from '@babylonjs/core';
import { createMorphTargetController } from './morphTargetController';
import type { MotionPose } from './motionPose';

// 建一具名 corrective morph 之 mesh（box 幾何足夠）。
function meshWithMorph(scene: Scene, meshName: string, morphName: string) {
  const box = MeshBuilder.CreateBox(meshName, { size: 1 }, scene);
  const target = new MorphTarget(morphName, 0, scene);
  target.setPositions(box.getVerticesData(VertexBuffer.PositionKind)!);
  const mgr = new MorphTargetManager(scene);
  mgr.addTarget(target);
  box.morphTargetManager = mgr;
  return target;
}

describe('createMorphTargetController', () => {
  it('neutral pose → corrective influence 0；大屈曲 → influence 1', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const t = meshWithMorph(scene, 'muscle.rectusFemoris#L', 'corr.joint.knee');
    const ctrl = createMorphTargetController(scene);
    ctrl.sync({});
    expect(t.influence).toBe(0);
    ctrl.sync({ 'joint.knee#L': { flexionExtension: 1000 } } as MotionPose);
    expect(t.influence).toBe(1);
    engine.dispose();
  });

  it('左右獨立：joint.knee#L 屈曲只驅動 #L mesh', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const tl = meshWithMorph(scene, 'muscle.rectusFemoris#L', 'corr.joint.knee');
    const tr = meshWithMorph(scene, 'muscle.rectusFemoris#R', 'corr.joint.knee');
    const ctrl = createMorphTargetController(scene);
    ctrl.sync({ 'joint.knee#L': { flexionExtension: 1000 } } as MotionPose);
    expect(tl.influence).toBe(1);
    expect(tr.influence).toBe(0);
    engine.dispose();
  });

  it('非 corr. 前綴 / 未知關節之 morph 不被驅動', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const other = meshWithMorph(scene, 'muscle.x#L', 'someOtherMorph');
    const elbow = meshWithMorph(scene, 'muscle.y#L', 'corr.joint.elbow');
    other.influence = 0.5;
    elbow.influence = 0.5;
    const ctrl = createMorphTargetController(scene);
    ctrl.sync({ 'joint.knee#L': { flexionExtension: 1000 } } as MotionPose);
    expect(other.influence).toBe(0.5);
    expect(elbow.influence).toBe(0.5);
    engine.dispose();
  });

  it('dispose 後 influence 歸 0', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const t = meshWithMorph(scene, 'muscle.rectusFemoris#L', 'corr.joint.knee');
    const ctrl = createMorphTargetController(scene);
    ctrl.sync({ 'joint.knee#L': { flexionExtension: 1000 } } as MotionPose);
    ctrl.dispose();
    expect(t.influence).toBe(0);
    engine.dispose();
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test -- morphTargetController`
Expected: FAIL（`createMorphTargetController` 未匯出）

- [ ] **Step 3: 實作 controller（續寫 morphTargetController.ts）**

```ts
// morphTargetController.ts —— 於 correctiveWeight 之後增補：
import type { Scene } from '@babylonjs/core';
import { type MotionPose, jointAngle } from './motionPose';
import { movableJointDof, poseKey } from './jointKinematics';

const CORR_PREFIX = 'corr.';
const ONSET_FRACTION = 0.6;
// 驅動軸 per joint（膝/髖＝矢狀屈伸；踝＝蹠背屈）。未列之關節不驅動。
const CORRECTIVE_AXIS: Readonly<Record<string, string>> = {
  'joint.knee': 'flexionExtension',
  'joint.hip': 'flexionExtension',
  'joint.ankle': 'plantarDorsiflexion',
};

export interface MorphTargetController {
  sync(pose: MotionPose): void;
  dispose(): void;
}

function sideFromMeshName(name: string): string | null {
  if (name.endsWith('#L')) return '#L';
  if (name.endsWith('#R')) return '#R';
  return null;
}

// ref＝該軸 ROM 兩端最大幅（極限屈曲端）；onset＝0.6·ref。definitions 缺→0（不驅動）。
function refOnset(jointId: string, axis: string): { ref: number; onset: number } {
  const dof = movableJointDof(jointId, axis);
  const ref = dof ? Math.max(Math.abs(dof.min), Math.abs(dof.max)) : 0;
  return { ref, onset: ref * ONSET_FRACTION };
}

export function createMorphTargetController(scene: Scene): MorphTargetController {
  interface Driven {
    set(w: number): void;
    pk: string;
    axis: string;
    onset: number;
    ref: number;
  }
  const driven: Driven[] = [];
  for (const mesh of scene.meshes) {
    const mgr = mesh.morphTargetManager;
    if (!mgr) continue;
    const side = sideFromMeshName(mesh.name);
    for (let i = 0; i < mgr.numTargets; i++) {
      const target = mgr.getTarget(i);
      if (!target.name.startsWith(CORR_PREFIX)) continue;
      const jointId = target.name.slice(CORR_PREFIX.length);
      const axis = CORRECTIVE_AXIS[jointId];
      if (!axis) continue;
      const { ref, onset } = refOnset(jointId, axis);
      driven.push({
        set: (w) => {
          target.influence = w;
        },
        pk: poseKey(jointId, side),
        axis,
        onset,
        ref,
      });
    }
  }

  return {
    sync(pose: MotionPose): void {
      for (const d of driven) d.set(correctiveWeight(jointAngle(pose, d.pk, d.axis, 0), d.onset, d.ref));
    },
    dispose(): void {
      for (const d of driven) d.set(0);
      driven.length = 0;
    },
  };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `pnpm test -- morphTargetController`
Expected: PASS（Task 1 之 4 ＋ Task 2 之 4 = 8 tests）

- [ ] **Step 5: typecheck**

Run: `pnpm typecheck`
Expected: 無新錯誤

- [ ] **Step 6: Commit**

```bash
git add app/utils/humanModel/motion/morphTargetController.ts app/utils/humanModel/motion/morphTargetController.test.ts
git commit -m "feat(motion): createMorphTargetController 依關節屈曲角度驅動 corrective morph influence"
```

---

### Task 3: 接線 `Model3DView.vue`（隨 pose 同步 morph）

**Files:**
- Modify: `app/components/humanModel/Model3DView.vue`（`:58` import、`:146` 宣告、`:310-311` 建立、`:380-381` 釋放、`:449` watcher）

**Interfaces:**
- Consumes: `createMorphTargetController`、`MorphTargetController`（Task 2）。
- Produces: 載入帶 morph 之 glb 時，pose 變更即更新 morph influence（無 morph 之 glb 則 no-op，安全）。

- [ ] **Step 1: import（緊接 rigController import，約 `:58`）**

於 `import { ... } from '../../utils/humanModel/motion/rigController';` 後新增一行：

```ts
import { createMorphTargetController, type MorphTargetController } from '../../utils/humanModel/motion/morphTargetController';
```

- [ ] **Step 2: 宣告（`:146` `let rigController` 後）**

```ts
let morphTargetController: MorphTargetController | null = null;
```

- [ ] **Step 3: 建立＋首同步（`:310-311`）**

將
```ts
        rigController = createRigController(builtScene);
        rigController.sync(props.motionMode, props.pose ?? {});
```
改為
```ts
        rigController = createRigController(builtScene);
        rigController.sync(props.motionMode, props.pose ?? {});
        morphTargetController = createMorphTargetController(builtScene);
        morphTargetController.sync(props.pose ?? {});
```

- [ ] **Step 4: 釋放（`:380-381`）**

將
```ts
    rigController?.dispose();
    rigController = null;
```
改為
```ts
    rigController?.dispose();
    rigController = null;
    morphTargetController?.dispose();
    morphTargetController = null;
```

- [ ] **Step 5: watcher 同步（`:449`）**

將
```ts
    if (rigController) rigController.sync(props.motionMode, props.pose ?? {});
```
改為
```ts
    if (rigController) rigController.sync(props.motionMode, props.pose ?? {});
    if (morphTargetController) morphTargetController.sync(props.pose ?? {});
```

- [ ] **Step 6: typecheck ＋ 既有測試**

Run: `pnpm typecheck && pnpm test -- humanModel`
Expected: typecheck 無錯；既有 humanModel 測試全通過（morph 接線不破壞既有路徑——目前部署 glb 無 morph，controller no-op）。

- [ ] **Step 7: Commit**

```bash
git add app/components/humanModel/Model3DView.vue
git commit -m "feat(motion): Model3DView 接 morphTargetController（隨 pose 同步 corrective morph）"
```

---

### Task 4: `add_corrective_shapekeys`（rigSkin.py procedural 生成）

**Files:**
- Modify: `infra/asset-pipeline/rigSkin.py`（檔尾新增函式＋常數）

**Interfaces:**
- Consumes: `_bone_for`（既有）；`bind_meshes` 已寫之 per-vertex 兩骨權重（vertex group `pbone`/`dbone`）。
- Produces: `add_corrective_shapekeys(arm, result_objects, anat_to_joint, za, cross_joint) -> (n_mesh, n_target)` — 為每個跨關節肌（`cross_joint[anat]`）於子關節（`distal`）屈曲 `θ_ref` 處生成 shape key `corr.<distal>`（Basis ＋ corrective）；僅過渡帶頂點、`|delta|>EPS` 寫入；無顯著修正則移除該 key。

- [ ] **Step 1: 新增常數＋輔助（rigSkin.py 檔尾，import 區已含 `numpy as np`、`math`、`Vector`；補 `Matrix`、`Quaternion`）**

於 `from mathutils import Vector` 改為：
```python
from mathutils import Matrix, Quaternion, Vector
```

檔尾新增：
```python
# === 極限屈曲 corrective shape keys（spec 2026-06-20）===
# 子關節屈曲 ROM max（與 definitions 對齊；morph 於此角度烘焙全量修正）。
CORRECTIVE_REF_DEG = {
    "joint.knee": 140.0,
    "joint.hip": 120.0,
    "joint.ankle": 50.0,
}
# Blender 子骨屈曲姿勢：(euler 軸 index, sign)。膝已驗 local-X 正＝矢狀屈曲；髖/踝待 MCP 校正（Task 6）。
CORRECTIVE_POSE_AXIS = {
    "joint.knee": (0, 1.0),
    "joint.hip": (0, 1.0),
    "joint.ankle": (0, 1.0),
}
CORRECTIVE_EPS = 1e-4  # rest-space delta 門檻（m）；以下不寫入（稀疏化）。


def _vgroup_weights(o, vg_index):
    """回 {vertex_index: weight}（指定 vertex group 之逐頂點權重）。"""
    w = {}
    for v in o.data.vertices:
        for g in v.groups:
            if g.group == vg_index:
                w[v.index] = g.weight
                break
    return w


def add_corrective_shapekeys(arm, result_objects, anat_to_joint, za, cross_joint):
    """跨關節肌極限屈曲 corrective shape key：保體積目標（四元數混合旋轉）− LBS 之 rest-space
    delta。須於 bind_meshes 後、export 前呼用。回 (mesh 數, target 數)。"""
    import bpy
    n_mesh = 0
    n_target = 0
    for o in result_objects:
        if o.type != "MESH":
            continue
        name = o.name
        side, anat = None, name
        if name.endswith("#L"):
            side, anat = "left", name[:-2]
        elif name.endswith("#R"):
            side, anat = "right", name[:-2]
        bp = cross_joint.get(anat)
        if not bp:
            continue
        distal = bp["distal"]
        ref = CORRECTIVE_REF_DEG.get(distal)
        if ref is None:
            continue
        dbone = _bone_for(distal, side)
        pbone = _bone_for(bp["proximal"], side)
        if dbone not in arm.pose.bones or pbone not in arm.pose.bones:
            continue
        vg_d = o.vertex_groups.get(dbone)
        vg_p = o.vertex_groups.get(pbone)
        if vg_d is None or vg_p is None:
            continue
        wd = _vgroup_weights(o, vg_d.index)
        wp = _vgroup_weights(o, vg_p.index)
        band = [i for i in wd if wd[i] > 1e-6 and wp.get(i, 0.0) > 1e-6]
        if not band:
            continue

        # rest 世界蒙皮基底矩陣（mathutils，供 to_quaternion／反矩陣）。
        Mp_rest = arm.matrix_world @ arm.pose.bones[pbone].bone.matrix_local
        Md_rest = arm.matrix_world @ arm.pose.bones[dbone].bone.matrix_local

        # 子骨屈曲 ref。
        axis_i, sign = CORRECTIVE_POSE_AXIS[distal]
        pbd = arm.pose.bones[dbone]
        old_mode, old_euler = pbd.rotation_mode, tuple(pbd.rotation_euler)
        pbd.rotation_mode = "XYZ"
        eul = [0.0, 0.0, 0.0]
        eul[axis_i] = math.radians(ref) * sign
        pbd.rotation_euler = eul
        bpy.context.view_layer.update()

        Sp_m = (arm.matrix_world @ arm.pose.bones[pbone].matrix) @ Mp_rest.inverted()
        Sd_m = (arm.matrix_world @ arm.pose.bones[dbone].matrix) @ Md_rest.inverted()

        pbd.rotation_euler = old_euler
        pbd.rotation_mode = old_mode
        bpy.context.view_layer.update()

        Sp = np.array(Sp_m)
        Sd = np.array(Sd_m)
        qp = Sp_m.to_quaternion()
        qd = Sd_m.to_quaternion()
        tp, td = Sp_m.translation, Sd_m.translation

        mw = o.matrix_world
        mwi = mw.inverted()
        if o.data.shape_keys is None:
            o.shape_key_add(name="Basis", from_mix=False)
        key = o.shape_key_add(name="corr.%s" % distal, from_mix=False)

        wrote = 0
        for i in band:
            a = wp.get(i, 0.0)
            b = wd.get(i, 0.0)
            s = a + b
            if s <= 1e-9:
                continue
            a, b = a / s, b / s
            co = o.data.vertices[i].co
            p_w = mw @ co
            # LBS（線性矩陣混合）。
            M = a * Sp + b * Sd
            # 保體積目標：四元數混合旋轉（對齊半球）＋線性平移。
            qb = qp * a + (qd if qd.dot(qp) >= 0 else qd * -1.0) * b
            qb.normalize()
            T = Matrix.Translation(a * tp + b * td) @ qb.to_matrix().to_4x4()
            target_w = T @ p_w
            try:
                solved = np.linalg.solve(M, np.array([target_w[0], target_w[1], target_w[2], 1.0]))
            except np.linalg.LinAlgError:
                continue
            new_local = mwi @ Vector((solved[0], solved[1], solved[2]))
            if (new_local - co).length < CORRECTIVE_EPS:
                continue
            key.data[i].co = new_local
            wrote += 1
        if wrote == 0:
            o.shape_key_remove(key)
            continue
        n_mesh += 1
        n_target += 1
    return n_mesh, n_target
```

- [ ] **Step 2: 語法檢查（無 Blender 亦可）**

Run: `python3 -c "import ast; ast.parse(open('infra/asset-pipeline/rigSkin.py').read()); print('SYNTAX_OK')"`
Expected: `SYNTAX_OK`

- [ ] **Step 3: Commit（接線與驗證於 Task 5）**

```bash
git add infra/asset-pipeline/rigSkin.py
git commit -m "feat(pipeline): add_corrective_shapekeys 生成下肢極限屈曲 corrective shape key"
```

---

### Task 5: 接線 exportGltf ＋ morph 匯出 ＋ 重出驗證

**Files:**
- Modify: `infra/asset-pipeline/exportGltf.py`（`:201` import、`:214` 後呼用、`:233` 匯出加 `export_morph`、log）

**Interfaces:**
- Consumes: `add_corrective_shapekeys`（Task 4）。
- Produces: rigged glb 帶 morph targets；log `MORPH_OK meshes=N targets=M`。

- [ ] **Step 1: import ＋ 呼用（`:201`、`:214` 後）**

`:201` 將
```python
        from rigSkin import build_aligned_armature, bind_meshes
```
改為
```python
        from rigSkin import add_corrective_shapekeys, build_aligned_armature, bind_meshes
```

`:214-216`（`bind_meshes` 與 `RIG_OK` print）之後新增：
```python
        ncm, nct = add_corrective_shapekeys(arm, resultObjects, anat_to_joint, za, cross_joint)
        print("MORPH_OK meshes=%d targets=%d" % (ncm, nct))
```

- [ ] **Step 2: 匯出加 morph（`:239` `export_skins=rig_enabled,` 後新增一行）**

```python
        export_morph=rig_enabled,
```

- [ ] **Step 3: 重出（WSL Blender headless；參數沿用既有 rig 呼叫）**

> 既有產線指令見前次 commit（`exportGltf.py` 帶 `<skeleton.json> <membership.json>` 位置參數）。先備份現役 glb：

```bash
cp public/models/anatomyV1.glb public/models/anatomyV1.premorph.bak.glb
```

Run（沿用前次重出之同一指令；out 為 `infra/asset-pipeline/out/`）：
```bash
/snap/bin/blender -b -P infra/asset-pipeline/exportGltf.py -- \
  <profile> infra/asset-pipeline/out doc/ref/models/makehuman-default-skeleton.json infra/asset-pipeline/out/segmentMembership.json 2>&1 | grep -E "RIG_OK|MORPH_OK|EXPORT_OK"
```
Expected: 見 `RIG_OK …`、`MORPH_OK meshes=N targets=M`（N>0）、`EXPORT_OK … bytes=…`。

- [ ] **Step 4: Babylon load smoke test（morph 名還原驗證）**

Create: `infra/asset-pipeline/out/.gitignore` 無關；於 repo 既有 nuxt 測試體系外，用一次性 node 檢查 glb 之 morph target 名。改於 Task 2 測試體系驗證較穩——此處改以 Blender MCP 於 Task 6 確認 `morphTargetManager`。本步驟僅斷言 export log：

Run: `ls -l infra/asset-pipeline/out/anatomyV1*.glb`
Expected: 檔案存在且 bytes 較 premorph 備份大（morph delta 增量）。

- [ ] **Step 5: 部署（取代出貨 glb）**

```bash
cp infra/asset-pipeline/out/anatomyV1.glb public/models/anatomyV1.glb
```

- [ ] **Step 6: Commit**

```bash
git add infra/asset-pipeline/exportGltf.py
git commit -m "feat(pipeline): exportGltf 接 corrective shapekeys ＋ morph 匯出（MORPH_OK log）"
```

---

### Task 6: Blender MCP 視覺校正（θ_onset／per-joint 屈曲軸／EPS）＋ 確認 morph 生效

**Files:**
- Modify（視校正結果）: `infra/asset-pipeline/rigSkin.py`（`CORRECTIVE_POSE_AXIS`、`CORRECTIVE_EPS`）；必要時重出＋重部署（Task 5 Step 3、5）。

**驗證循環（每關節 膝→髖→踝）：**

- [ ] **Step 1: 於 Blender MCP 載入新 glb、確認 morph 存在**

以 `mcp__blender__execute_blender_code` 載入 `public/models/anatomyV1.glb` 至新 scene，列出帶 `morphTargetManager`／shape key 之 mesh 數、抽查一 mesh 之 shape key 名含 `corr.joint.knee`。
Expected: 數 > 0、名稱正確。

- [ ] **Step 2: 對照渲染（膝 130°，morph off vs on）**

姿勢 `lowerleg01.R` 屈曲 130°；分別設該 mesh 群 corrective shape key value=0 與 =1，各算圖（沿用 §對話既有相機/Workbench 流程，存 `/tmp/corr_knee_off.png`、`/tmp/corr_knee_on.png`），Read 比對。
Expected: on 之小腿/小腿肌塌陷明顯改善、無翻面/過衝；其餘部位不動。

- [ ] **Step 3: 若屈曲方向錯（扭轉而非矢狀）或過衝/不足 → 調參重出**

調 `CORRECTIVE_POSE_AXIS[<joint>]`（軸 index/sign）或檢查保體積目標；重出（Task 5 Step 3）、重部署、回 Step 2。
Expected: 收斂至視覺可接受。

- [ ] **Step 4: 髖、踝 重複 Step 2–3**

Expected: 髖屈曲塌陷改善；踝（ROM 小）多被 EPS 稀疏跳過＝可接受（log MORPH 無踝 target 亦正常）。

- [ ] **Step 5: 校正 θ_onset（app 端）**

`pnpm dev` → `/patients/<id>/model` → 關節活動 → 膝由 0 拉至 ROM max：corrective 應於上段（~`0.6·ref` 起）漸入、低角度無副作用。若起點過早/過晚，調 `morphTargetController.ts` `ONSET_FRACTION`（重跑 Task 2 測試）。
Expected: 中低角度無 corrective 介入痕跡、極限端塌陷修正。

- [ ] **Step 6: 清理 Blender 測試 scene、Commit 校正**

```bash
git add infra/asset-pipeline/rigSkin.py app/utils/humanModel/motion/morphTargetController.ts
git commit -m "fix(pipeline): MCP 校正 corrective 屈曲軸/EPS/onset（下肢膝髖踝）"
```

> 註：`public/models/anatomyV1.glb` 為 gitignored，不入 commit；部署即覆蓋。

---

### Task 7: 設計同步 ＋ todo 收尾

**Files:**
- Modify: `doc/design/04_human_model.md`（§4.3.3 或 §4.6.3 增 corrective shape keys 一節）
- Modify: `doc/todo/04_todo_human_model.md`（勾選極限屈曲 corrective 項、補實作摘要）

- [ ] **Step 1: 04_human_model.md 增節**

於 §4.6.3（製作管線）或 §4.3.3 後增「極限屈曲 corrective shape keys」段：procedural 生成（保體積目標−LBS rest-space delta、morph 名 `corr.<jointId>`）、runtime `morphTargetController` 依屈曲角度 smoothstep 驅動、範圍下肢膝髖踝、保完整 ROM。連結 [spec](specs/2026-06-20-corrective-shape-keys-design.md)。

- [ ] **Step 2: todo 勾選**

`doc/todo/04_todo_human_model.md` 之「極限屈曲 corrective shape keys（新子專案）」改 `- [x]`，補一行實作摘要（rigSkin `add_corrective_shapekeys` ＋ exportGltf morph ＋ `morphTargetController`；MCP 校正；commit 範圍）。

- [ ] **Step 3: 驗證全綠**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: 全通過。

- [ ] **Step 4: Commit**

```bash
git add doc/design/04_human_model.md doc/todo/04_todo_human_model.md
git commit -m "docs: 同步下肢極限屈曲 corrective shape keys（設計＋todo）"
```

---

## Self-Review

**Spec coverage:** §A 生成→Task 4；§B 匯出→Task 5；§C runtime→Task 1/2/3；命名契約→Task 2（名匹配）＋Task 5（targetNames 匯出）；測試→Task 1/2（vitest）、Task 5/6（export log＋MCP）；設計同步→Task 7；YAGNI（僅下肢、僅屈曲、稀疏）→Task 4 常數＋Task 2 `CORRECTIVE_AXIS`。涵蓋完整。

**Placeholder scan:** 無 TBD/TODO；各 step 附實際碼/指令。Task 5 Step 3 `<profile>` 與重出指令為「沿用前次同一指令」之佔位——已明示來源（前次 rig 重出 commit）；Task 6 為本質迭代式校正（spec 已列為主要風險），各 step 有明確 expected 與調參對象，非空泛。

**Type consistency:** `correctiveWeight(angleDeg, onsetDeg, refDeg)`、`createMorphTargetController(scene)→{sync,dispose}`、morph 名 `corr.<jointId>`、驅動軸 knee/hip=`flexionExtension`、ankle=`plantarDorsiflexion`、`add_corrective_shapekeys(arm, result_objects, anat_to_joint, za, cross_joint)→(n_mesh,n_target)` 跨 Task 一致。
