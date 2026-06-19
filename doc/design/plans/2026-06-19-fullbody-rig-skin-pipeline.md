# 全身 rig + skin 資產管線 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans（**inline 執行**，本人在 session 內跑）。理由見下「執行模式」。Steps 用 `- [ ]` 追蹤。

**Goal:** 把 z-anatomy 解剖 mesh 綁到 MakeHuman 預設骨架並蒙皮，匯出帶 armature＋skins 的 `anatomyV1.glb`，使現役 `boneRig` 驅動、肌肉軟變形。

**Architecture:** bpy 讀已取得之 `makehuman-default-skeleton.json` 建 armature→腳本對位 z-anatomy（Y-up→Z-up＋fit＋關鍵關節 snap）→依節段成員剛性綁＋跨關節肌位置漸變蒙皮→`exportGltf.py` 帶 skins 匯出。成員由 `jointKinematics.ts` 經橋接 JSON 餵給 bpy（單一真相）。

**Tech Stack:** Blender 5.1（`blender.exe` headless，WSL 呼叫 Windows exe）、bpy；Node/tsx（成員橋接）；Vitest（TS 測試）；headless Edge（算圖目視驗證）。

## 執行模式（重要）

- **bpy 任務（armature/對位/綁定/匯出）＝Blender-iterate-verify**：無法 vitest 單測（跑在 Blender）；如 spike 般「跑 headless→Edge 算圖→Read 目視→調→重跑」。其「測試」＝結構斷言（bone 數／hierarchy／每 mesh 有權重）＋算圖目視。**本人 inline 執行**（已建立 blender.exe／Edge／Read-image 工作流）；不派 subagent（subagent 難複製此視覺迭代環）。
- **TS 任務（成員橋接、boneRigMap 校核）＝vitest-TDD**：可單測，inline 或 subagent 皆可。
- 產物 glb 為大型二進位、不入 git；spike 同款 throwaway viewer 僅暫用、用後刪。

## Global Constraints

- pnpm only。bpy 腳本為 Python（PEP8 snake_case，比照既有 `infra/asset-pipeline/*.py`，eslint 不管 Python）；TS 仍 camelCase/PascalCase/UPPER_CASE、嚴禁 snake_case。
- 註解／文件 zh-tw。勿改 `packages/shared`／`packages/definitions`。
- 骨架來源已取得：`doc/ref/models/makehuman-default-skeleton.json`（163 bones、CC0）。z-anatomy 來源：`doc/ref/models/z-anatomy.blend`（293MB，Z-up，source 名帶 `.l/.r`）。
- bpy 執行：`"/mnt/c/Program Files/Blender Foundation/Blender 5.1/blender.exe" -b "$(wslpath -w <blend>)" -P "$(wslpath -w <script>)" -- <args>`；路徑用 `wslpath -w`；輸出至 `/mnt/c/.../Temp/` 以便讀回。
- 成員單一真相＝`app/utils/humanModel/motion/jointKinematics.ts` `resolveSegmentMembership`；Python 不重寫成員邏輯。
- 設計同步必守（見 Task 7）。

---

### Task 1: 節段成員橋接（TS→JSON）

**Files:**
- Create: `infra/asset-pipeline/exportSegmentMembership.mjs`（或 `.ts` 經 tsx 跑）
- Create: `infra/asset-pipeline/out/segmentMembership.json`（產物，gitignored）
- Test: `infra/asset-pipeline/exportSegmentMembership.test.ts`（vitest node）

**Interfaces:**
- Consumes: `resolveSegmentMembership(anatomyEntities)`、`MOVABLE_JOINT_IDS` from `app/utils/humanModel/motion/jointKinematics`；`anatomyEntities` from `@ptapp/definitions`。
- Produces: JSON `{ "<jointId>": ["<anatomyId>", ...], ... }`（每可動節段→其成員 anatomyId 陣列；側別無關，bpy 端補 `#L/#R`）。

- [ ] **Step 1: 寫測試**（vitest node；確認橋接輸出＝`resolveSegmentMembership`）

```ts
// exportSegmentMembership.test.ts
import { describe, expect, it } from 'vitest';
import { anatomyEntities } from '@ptapp/definitions';
import { resolveSegmentMembership, MOVABLE_JOINT_IDS } from '../../app/utils/humanModel/motion/jointKinematics';
import { buildMembershipJson } from './exportSegmentMembership.mjs';

describe('exportSegmentMembership', () => {
  it('每可動節段皆有鍵、成員＝resolveSegmentMembership', () => {
    const json = buildMembershipJson();
    const ref = resolveSegmentMembership(anatomyEntities);
    for (const jid of MOVABLE_JOINT_IDS) {
      expect(json[jid], jid).toEqual(ref.get(jid));
    }
  });
  it('成員不重複跨節段', () => {
    const json = buildMembershipJson();
    const seen = new Set<string>();
    for (const ids of Object.values(json)) for (const id of ids) {
      expect(seen.has(id), id).toBe(false); seen.add(id);
    }
  });
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `pnpm test infra/asset-pipeline/exportSegmentMembership.test.ts`
Expected: FAIL（`buildMembershipJson` 不存在）

- [ ] **Step 3: 實作**

```js
// exportSegmentMembership.mjs
import { writeFileSync } from 'node:fs';
import { anatomyEntities } from '@ptapp/definitions';
import { resolveSegmentMembership, MOVABLE_JOINT_IDS } from '../../app/utils/humanModel/motion/jointKinematics.ts';

export function buildMembershipJson() {
  const m = resolveSegmentMembership(anatomyEntities);
  const out = {};
  for (const jid of MOVABLE_JOINT_IDS) out[jid] = m.get(jid) ?? [];
  return out;
}

// 直接執行時寫檔（CLI）
if (import.meta.url === `file://${process.argv[1]}`) {
  writeFileSync(new URL('./out/segmentMembership.json', import.meta.url), JSON.stringify(buildMembershipJson(), null, 1));
}
```

> 註：runner 須能解析 `@ptapp/definitions`（workspace 套件）與 `.ts` import。若 `node`/`tsx` 無法解析 Nuxt/TS，改以 vitest 環境跑（vitest 已配置別名）：把 CLI 寫檔包成一個 `it('writes json', …)` 或用 `vite-node`。實作者擇可行 runner、保持 `buildMembershipJson` 為被測純函式。

- [ ] **Step 4: 跑測試確認通過** — Run: `pnpm test infra/asset-pipeline/exportSegmentMembership.test.ts` → PASS

- [ ] **Step 5: 產生 JSON＋commit**

```bash
# 以可行 runner 產出 out/segmentMembership.json（gitignored）
git add infra/asset-pipeline/exportSegmentMembership.mjs infra/asset-pipeline/exportSegmentMembership.test.ts
git commit -m "feat(pipeline): 節段成員 TS→JSON 橋接（供 bpy 綁定、單一真相）"
```

---

### Task 2: `boneRigMap` 校核對齊 MakeHuman 實名（TS/vitest-TDD）

**Files:**
- Modify: `app/utils/humanModel/motion/boneRigMap.ts`（必要時改 spine/cervical 代表骨名）
- Test: `app/utils/humanModel/motion/boneRigMap.test.ts`（擴充）

**Interfaces:** Consumes `BONE_RIG_MAP`、`makehuman-default-skeleton.json`（bone 名集合）。

- [ ] **Step 1: 寫測試**（每個 `BONE_RIG_MAP[*].bone` ＋ `#L/#R`／裸名 須存在於 MakeHuman 骨架）

```ts
import bones from '../../../doc/ref/models/makehuman-default-skeleton.json';
import { BONE_RIG_MAP } from './boneRigMap';
import { JOINT_KINEMATICS } from './jointKinematics';
it('BONE_RIG_MAP 之骨名存在於 MakeHuman 預設骨架', () => {
  const names = new Set(Object.keys((bones as { bones: Record<string, unknown> }).bones));
  for (const [jid, m] of Object.entries(BONE_RIG_MAP)) {
    const bilateral = JOINT_KINEMATICS[jid]?.bilateral === true;
    const cand = bilateral ? [`${m.bone}.L`, `${m.bone}.R`] : [m.bone];
    for (const n of cand) expect(names.has(n), `${jid}:${n}`).toBe(true);
  }
});
```

- [ ] **Step 2: 跑測試確認失敗或通過**

Run: `pnpm test app/utils/humanModel/motion/boneRigMap.test.ts`
Expected: 可能 FAIL（`joint.spine→spine01` 等代表骨需確認；MakeHuman 有 `spine01`–`05`、`neck01`–`03`）。

- [ ] **Step 3: 依骨架實名修 `boneRigMap.ts`**

查 `makehuman-default-skeleton.json` 之 spine/neck 鏈，將 `joint.spine.bone` 設為**腰薦樞紐**對應之下段脊椎骨（依該 JSON 之 head Y 最低之 spine 骨，即最接近骨盆者；`spine01` 於 MakeHuman 為**上**段→應改為下段如 `spine04`/`spine05`，以實際 JSON 為準），`joint.cervicalSpine.bone` 設 `neck01`（頸基）。其餘（`upperleg01`/`lowerleg01`/`foot`/`upperarm01`）已對齊。

- [ ] **Step 4: 跑測試確認通過** → PASS

- [ ] **Step 5: Commit**（含 spec/plan/skeleton JSON 作為分支首 commit）

```bash
git add app/utils/humanModel/motion/boneRigMap.ts app/utils/humanModel/motion/boneRigMap.test.ts \
        doc/ref/models/makehuman-default-skeleton.json \
        doc/design/specs/2026-06-19-fullbody-rig-skin-pipeline-design.md \
        doc/design/plans/2026-06-19-fullbody-rig-skin-pipeline.md
git commit -m "feat(motion): boneRigMap 代表骨對齊 MakeHuman 預設骨架實名"
```

---

### Task 3: `buildArmature.py` — 建 armature ＋ 對位 z-anatomy（bpy，iterate-verify）

**Files:**
- Create: `infra/asset-pipeline/buildArmature.py`（供 exportGltf import 之模組：`build_aligned_armature(scene) -> armature_obj`）

**Interfaces:**
- Consumes: `makehuman-default-skeleton.json`（bones head/tail/parent，MakeHuman Y-up 空間）；z-anatomy 骨 mesh（AABB anchor）。
- Produces: 場景中一具對位後 armature；bone 名＝MakeHuman 名。anchor 取法重用 spike：`bone.femur` maxZ＝髖、`bone.tibia` maxZ＝膝/minZ＝踝、`bone.humerus` maxZ＝肩、`bone.t1`/`bone.sacrum` 等＝脊椎/頸（z-anatomy Z-up）。

**做法（iterate-verify，非一次定稿）：**

- [ ] **Step 1: 由 JSON 建 armature**（edit bones：head/tail/parent；MakeHuman Y-up）。bpy edit-mode 建骨、設 parent、`use_connect` 依 head==parent.tail。
- [ ] **Step 2: Y-up→Z-up ＋ 整體 fit**：對整 armature 套轉換矩陣（MakeHuman Y-up→Blender Z-up＝繞 X +90°），再依 z-anatomy 全身鉛直 bounds 縮放／平移（MakeHuman 骨架 Y 範圍 −8..8.4 → z-anatomy 對應骨 bounds）。
- [ ] **Step 3: 關鍵關節 snap**：對髖/膝/踝/肩之**關節點**（共用 head/tail），snap 至 z-anatomy 對應骨 AABB anchor（重用 spike anchor 邏輯）；脊椎/頸取 `bone.sacrum`/`bone.t1` anchor。snap 共用點以保鏈連通。
- [ ] **Step 4: headless 算圖驗證**：armature ＋ z-anatomy 骨 mesh 疊算（Workbench、Freestyle/compositor off、骨 mesh 半透明），Edge 算圖、Read 目視——確認各 bone 落在對應骨內、左右對稱、鏈連通。**不對則回 Step 2/3 調**（如 spike 多輪）。
- [ ] **Step 5: 結構斷言**（print 供 log 檢核）：bone 數＝163；`upperleg01.L` head 在 `bone.femur#L` AABB 內、`lowerleg01.L` head 近膝…（容差內）。
- [ ] **Step 6: Commit**

```bash
git add infra/asset-pipeline/buildArmature.py
git commit -m "feat(pipeline): MakeHuman 骨架建構＋z-anatomy 對位（buildArmature）"
```

---

### Task 4: 綁定 — 剛性（成員）＋跨關節肌蒙皮（bpy，iterate-verify）

**Files:**
- Create: `infra/asset-pipeline/bindMeshes.py`（`bind_meshes(armature, meshes_by_anatomy_id, membership, cross_joint_set)`）

**Interfaces:**
- Consumes: Task 3 armature；Task 1 `segmentMembership.json`；exportGltf 已改名之 mesh（`anatomyId#L/R`）；跨關節肌集合（取 `MUSCLE_SEGMENT_OVERRIDE` 之外在肌＋雙關節肌；可由成員/actions 推或列表）。
- Produces: 各 mesh 帶 armature modifier ＋ 權重；無漏綁。

**做法（重用 spike 技法、擴至全身）：**

- [ ] **Step 1: 剛性綁**：每件 mesh 依成員找節段→對應 MakeHuman 骨（節段→骨表，見 spec §2）；建單骨 vertex group weight 1.0。基座成員（骨盆/肋/胸骨/骨盆底肌）綁 `root`。
- [ ] **Step 2: 跨關節肌蒙皮**：對跨關節肌套 spike 之**位置漸變權重**（沿肢長軸於父/子骨間平滑混合）；先試 ARMATURE_AUTO、失敗者位置漸變後備（重用 `spikeLegRig.py` 之 `split`/fallback 邏輯，抽共用）。
- [ ] **Step 3: 無漏綁斷言**：每件 mesh 至少一 deform 群且有非零權重（print 清單；漏綁者位置漸變補）。
- [ ] **Step 4: headless 算圖驗證**：擺數個關節（膝/髖/肩/頸各 60–90°），Edge 算圖、Read 目視——確認變形隨關節、無整段脫離/嚴重穿模。**不對則調**（如 spike）。
- [ ] **Step 5: Commit**

```bash
git add infra/asset-pipeline/bindMeshes.py
git commit -m "feat(pipeline): 成員驅動剛性綁＋跨關節肌位置漸變蒙皮（bindMeshes）"
```

---

### Task 5: 整合進 `exportGltf.py` — rigged glb 匯出（bpy，iterate-verify）

**Files:**
- Modify: `infra/asset-pipeline/exportGltf.py`（於改名/減面後、匯出前插入 build_aligned_armature＋bind_meshes；`export_skins=True`）

- [ ] **Step 1: 接線**：import buildArmature/bindMeshes；於 `resultObjects` 就緒後建骨架、綁定（讀 `segmentMembership.json`）；強制目標 mesh 可見/掛主集合（spike 經驗）。
- [ ] **Step 2: 匯出帶 skins**：`export_scene.gltf(..., export_skins=True)`（連同既有 Draco/yup/apply）。選取須含 armature＋meshes。
- [ ] **Step 3: 跑全管線產 `anatomyV1.glb`**：`blender.exe -b z-anatomy.blend -P exportGltf.py -- manifestV1.json out standard`；確認輸出含 1 skeleton、mesh 帶 skin（inspect glb／Babylon 載入 log）。
- [ ] **Step 4: 預算稽核**：跑 `verifyModelBudget.mjs`（rigged glb 仍須符 §4.3.6 預算；骨架/skin 增量微小）。
- [ ] **Step 5: Commit**

```bash
git add infra/asset-pipeline/exportGltf.py
git commit -m "feat(pipeline): exportGltf 整合 rig+skin、匯出帶骨架蒙皮 anatomyV1.glb"
```

---

### Task 6: 端對端驗證 — rigged glb 經 boneRig 驅動算圖（viewer，verify）

**Files:** 暫用 throwaway viewer（同 spike，用後刪；不入 git）。

- [ ] **Step 1: 載 rigged `anatomyV1.glb` 入 throwaway Babylon viewer**（仿 `spike-viewer.html`，惟用實際 `boneRig` 之驅動邏輯：`getTransformNode()` node 驅動、`alwaysSelectAsActiveMesh`）。
- [ ] **Step 2: headless Edge 算圖**：中立 vs 膝/髖/肩/頸屈，Read 目視＋SendUserFile 給使用者。
- [ ] **Step 3: 確認** `hasDrivableSkeleton` true、受驅動關節變形正確、無回歸。
- [ ] **Step 4: 清理**：刪 throwaway viewer/glb 暫存（public/ 不留）。

---

### Task 7: 設計同步（docs）

**Files:** Modify `doc/design/04_human_model.md`（§4.6.3 步驟 3–4、§4.3.3）、`doc/todo/04_todo_human_model.md`

- [ ] **Step 1: §4.6.3** 步驟 3 改述（MakeHuman 163-bone CC0 已 headless 取得、腳本 auto-fit＋關鍵關節 snap）、步驟 4（成員驅動剛性＋跨關節肌位置漸變蒙皮）。
- [ ] **Step 2: §4.3.3／todo** skin 變形：資產管線由後續軌移為**已完成**（rigged `anatomyV1.glb` 產出）；保留延後軌（逐肌權重精修、真 rig 軸/sign 校正、手指/趾/多椎驅動）。
- [ ] **Step 3: 全量驗證**：`pnpm test`／`pnpm typecheck`／`pnpm lint` 全綠（TS 側）。
- [ ] **Step 4: Commit**

```bash
git add doc/design/04_human_model.md doc/todo/04_todo_human_model.md
git commit -m "docs(human-model): 全身 rig+skin 管線落地、§4.6.3/§4.3.3＋todo 同步"
```

---

## Self-Review

**1. Spec coverage:** §1 骨架建構＋對位→Task 3；§2 綁定（成員剛性＋跨關節肌蒙皮）→Task 4；§3 整合輸出→Task 5；§4 執行/驗證→Task 3–6（headless render）；§5 成員橋接→Task 1；boneRigMap 校核（spec §受影響檔案）→Task 2；設計同步→Task 7。涵蓋齊。

**2. Placeholder scan:** bpy 任務（3/4/5）刻意為 iterate-verify（非 fill-in code）——已於「執行模式」聲明此為 Blender 視覺迭代之本質，非佔位；步驟給做法＋驗證閘＋重用 spike 既有程式（`spikeLegRig.py` 之 split/fallback/anchor）。Task 1 runner 不確定性已明列備案。

**3. Type consistency:** `buildMembershipJson()`（Task 1）、`BONE_RIG_MAP[*].bone`（Task 2）、節段→骨表（spec §2，Task 4 用）、`resolveBoneName` 慣例（`.L/.R`，Task 2/4 一致）。一致。

**4. 風險:** 對位（Task 3）為最大不確定（如 spike 需多輪）；Task 1 runner（tsx 解析 workspace/別名）次之——皆有 fallback。
