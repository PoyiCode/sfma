# 運動模式：執行期 skin 變形驅動 — 設計規格

> 日期：2026-06-19｜設計：[04 §4.3.3](../04_human_model.md#433-關節活動與-rom-限制)
> 前置：[運動模式總覽](2026-06-18-motion-mode-design.md)、[左右側別獨立控制](2026-06-19-motion-per-side-design.md)、[肌肉著色](2026-06-19-muscle-shading-design.md)
> 文件語言：zh-tw｜狀態：設計定案、待實作

## 目標

讓運動模式在**載入帶真骨架（armature＋skin weights）的 GLB 時**，以骨骼驅動 mesh **軟變形**（取代剛性節段平移），消除剛性路徑「跨關節肌起止點輕微脫離」的視覺瑕疵（§4.3.3、[motion-mode §11](2026-06-18-motion-mode-design.md)）。

本規格為 **skin 變形兩子系統中的「執行期驅動」子專案**。另一子系統「資產管線綁骨＋蒙皮匯出」（§4.6.3 步驟 3–4，產出 rigged GLB）為其上游依賴、**另開 spec→plan**，不在本規格範圍。

依賴方向：**資產管線（產出 rigged GLB）→ 執行期（驅動它）**。本子專案先行的理由：純驅動層、此 repo 內可建可測，可在真資產到位前**先 de-risk Babylon skinning 整合**。

## 範圍（v1）

- **完成定義＝ship-dark**：bone 驅動層完整實作＋有骨架自動選用，以**程式建構的 NullEngine 骨架 fixture**＋一個**程式建構的 rigged-shaped 場景**（skinned mesh 名＝anatomyId ＋ armature `Skeleton`）做 TDD。**出貨 app 行為完全不變**——現役 `anatomyV1.glb` 無骨架（0 skins／0 bones），仍走剛性節段路徑；真 rigged 資產到位即自動亮 bone 路徑。
  - 不引入真 `.glb` skinned fixture：repo 無 `@babylonjs/serializers`，產生真 glb 需新依賴；綁定誤判風險為**我方** `gltfBinding`／`scenePopulator` 邏輯（`ImportMeshAsync` 之 skin 還原為 Babylon 自身已測程式），以 rigged-shaped 場景即可完整覆蓋。真資產端對端驗證隨**資產管線子專案**產出 rigged GLB 時進行。
- **關節涵蓋**：6 個 SFMA 關節（頸椎、肩、脊椎、髖、膝、踝），與剛性路同 parity。脊椎／頸椎以**單一代表 bone** 驅動（多椎延後）。
- **驅動共用既有 seam**：與剛性路讀**同一 `pose`**、同一 `setJointAngle → clampAngle → applyPose` 資料流；bone 路徑僅為 `applyPose` 的另一種「下游目標」。

**v1 不做**：① 真資產 bone 名＋區域軸正負號之**實機目視校正**（值先以 placeholder 校準、列待辦，與現役 world-sign 校正同軌）；② skinned 路徑的 **gizmo 精確擺位與 picking 精修**（v1 經共用 seam **能驅動**即可，無真資產不值得做視覺擺位）；③ **平滑多椎脊椎**；④ **資產管線綁骨＋蒙皮匯出**（另一子專案）。

姿態為記憶體暫態（頁面 ref，未持久化）→ 無資料遷移。

## 現況約束（決定整個取徑）

- 現役 `anatomyV1.glb`＝730 節點／569 mesh 的**扁平集合，0 skins／0 bones／0 animations**（[motion-mode §1](2026-06-18-motion-mode-design.md)）。故現役運動＝**剛性節段旋轉**（`articulationRig.ts`：mesh `setParent` 至 `TransformNode` 樞紐、樞紐旋轉）。
- §4.3.3 教科書取徑（Babylon `Skeleton` bones ＋ skin weights）目前**無任何 runtime 實作**——本規格即補此驅動層，但**只在資產帶骨架時啟用**。
- ROM 限制資料已就緒（`@ptapp/definitions` 之 `joint.degreesOfFreedom`），與剛性路共用。

## 決策摘要

| 決策 | 選定 | 理由 |
| --- | --- | --- |
| 子專案起點 | **執行期驅動先行**（資產管線另案） | 純驅動層、repo 內可建可測；先 de-risk Babylon skinning 整合 |
| v1 完成定義 | **機制完成、ship-dark** | 真 rigged 資產未到；以 fixture TDD、出貨行為不變、資產到位即亮 |
| 共存模型 | **雙路自動選**（有骨架→bone、無→剛性） | 出貨無骨架資產不能丟；同一 `ArticulationRig` 介面、下游零改動 |
| 軸演算 | **資料表＋延後校正** | bone-local 軸方向 ≠ world 且真骨架未到；對齊現役「資料表＋實機校正」慣例 |

## 架構

沿用既有 render 層慣例：**框架無關決策／資料**（NullEngine／node 可測）與**元件接線**分立。

### 1. 路徑選擇 seam：`rigController.ts`（修改）

`createRigController(scene)` 為**唯一路徑選擇點**。`sync(motionMode, pose)` 首次進入運動模式時：

```
if (motionMode) {
  if (!rig) rig = hasDrivableSkeleton(scene) ? buildBoneRig(scene) : buildArticulationRig(scene)
  rig.applyPose(pose)
} else if (rig) { rig.dispose(); rig = null }
```

- `hasDrivableSkeleton(scene)`：`scene.skeletons.length > 0` **且** `BONE_RIG_MAP` 至少能解析其應驅動之 bone（純函式/可測；資產半綁、bone 名不符 → 安全退回剛性）。
- `buildBoneRig` 與 `buildArticulationRig` **同實作 `ArticulationRig` 介面**（`applyPose(pose)` / `dispose()` / `pivotKeys` / `getPivot(jointId, side)`）。`RigController` 介面與下游（`Model3DView`、`gizmoController`、`muscleShading`）**零改動**。

### 2. bone 驅動：`boneRig.ts`（新，Babylon／NullEngine 可測）

`buildBoneRig(scene): ArticulationRig`：

- **建構**：取 `scene.skeletons[0]`（或 mesh.skeleton）；依 `BONE_RIG_MAP` 以 bone 名解析各關節之 `Bone`（雙側關節解析 `#L/#R` 對應骨；解析不到之關節跳過，不致命）。記錄每 bone 之 **rest 區域旋轉**供還原。
- **`applyPose(pose)`**：對每個已解析關節 × 每個 DOF，輸入**與剛性路相同**——`pk = poseKey(jointId, side)`、`deg = jointAngle(pose, pk, axis, neutral) − neutral`（角度上游已 clamp）；以 `BONE_RIG_MAP` 之 `localAxis`＋`sign` 組旋轉四元數，套到 `bone` 之**區域**旋轉（`Space.LOCAL`）。多 DOF 於同 bone 者依序相乘（同剛性路 `q.multiply` 慣例）。GPU 蒙皮自動變形 mesh——**剛性綁定（單骨權重 1.0）與跨關節肌（多骨權重）一律由 GPU 處理、runtime 不分辨**。
- **`dispose()`**：所有受驅動 bone 還原 rest 區域旋轉（不動場景 parenting——bone 路徑不 reparent mesh，與剛性路 `dispose` 還原 parenting 相對）。
- **`getPivot(jointId, side)`**：v1 一律回 `null`（gizmo 精確擺位延後；回 null 時 gizmo 仍可經共用 seam 驅動關節，僅視覺手柄擺位不啟用）。

> **唯一變動場景圖之處**：bone 路徑僅改 bone 區域旋轉、**不 reparent mesh**；剛性路仍為 `articulationRig.ts` 唯一 reparent 者。兩者互斥（由 `RigController` 擇一），不會同時動場景圖。

### 3. 資料：`boneRigMap.ts`（新，純資料／可測）

```ts
export const BONE_RIG_MAP: Readonly<Record<string, {
  bone: string;                                            // MakeHuman armature bone 名（非骨 mesh anatomyId）
  dofs: Readonly<Record<string, { localAxis: readonly [number, number, number]; sign: 1 | -1 }>>;
}>>
```

- 涵蓋 6 SFMA 關節；每關節 `dofs` 之 axis 鍵對齊該 joint 之 `degreesOfFreedom`。
- 與剛性路 `JOINT_KINEMATICS[*].pivot.bone`（骨 **mesh 的 anatomyId**，如 `bone.femur`）**語意不同**——此處為 **armature bone 名**（如 `upperleg01.L`）。bone-naming 以 **MakeHuman 預設骨架命名**為目標契約；真名於 rig 到位時釘定。
- 值為 placeholder 校準（fixture 可確定驗證）；真骨架之 bone-local 軸對應與正負號列**延後校正待辦**。

### 4. 元件接線

- `Model3DView.vue` / `gizmoController.ts` / `muscleShading.ts`：**不變**（皆透過 `RigController`／`ArticulationRig` 介面與共用 `pose` seam）。
- 載入路徑（`gltfBinding.ts` / `scenePopulator.ts`）：**以 rigged-shaped 場景驗證綁定存活**（回歸護欄，預期現碼即通過）——skinned mesh 名仍＝anatomyId、armature `Bone`／`Skeleton`（非 mesh）不被 `gltfBinding`（迭代 `scene.meshes`）誤判為部位、`scene.skeletons` 有值。真資產端對端載入隨資產管線子專案產出 rigged GLB 時驗。

## 邊界情形

- **無骨架資產**（現役出貨）→ `hasDrivableSkeleton` false → 走剛性路、行為不變。
- **半綁資產**（有骨架但 bone 名不符 `BONE_RIG_MAP`）→ `hasDrivableSkeleton` false（保守）→ 退剛性路。
- **部分關節綁定**（骨架含部分 bone）→ bone 路徑只驅動解析得到之關節，其餘關節該 DOF 無作用（不致命）。
- 空／中立 pose → 全 bone rest → 無變形。
- 進出運動模式／模式切換 → `RigController.sync` 冪等：bone 路徑 `dispose` 還原 rest、剛性路 `dispose` 還原 parenting。
- muscle shading：bone 變形與 per-mesh overlay 正交，著色不受影響。

## 受影響檔案

| 檔案 | 變更 |
|---|---|
| `app/utils/humanModel/motion/boneRig.ts`（新） | `buildBoneRig`（同 `ArticulationRig` 介面）：解析 bone、applyPose 套 bone 區域旋轉、dispose 還原 rest |
| `app/utils/humanModel/motion/boneRigMap.ts`（新） | `BONE_RIG_MAP`（jointId→bone＋per-DOF localAxis/sign） |
| `app/utils/humanModel/motion/rigController.ts` | 路徑選擇：`hasDrivableSkeleton(scene)` 擇 bone／剛性 |
| `app/utils/humanModel/render/gltfBinding.test.ts`（擴充） | rigged-shaped 場景綁定回歸護欄（預期現碼即通過、無 production 改動或最小改動） |
| 測試 fixture | `makeBoneRigFixture`（程式 NullEngine 骨架＋skinned mesh，置 `boneRig.ts` 或 `boneRig.test.ts`） |

## 測試

- `boneRig.test.ts`（NullEngine）：applyPose 旋轉**正確 bone、正確區域軸、正確正負**（以 fixture 已知朝向斷言）；多 DOF 同 bone 依序相乘；dispose 還原 rest；getPivot；解析不到之關節安全跳過。
- `rigController.test.ts`（擴充）：有骨架 → `buildBoneRig`、無骨架 → `buildArticulationRig`；半綁／bone 名不符 → 退剛性。
- `boneRigMap.test.ts`：每可動關節有對應、每 DOF 對齊 definitions `degreesOfFreedom`、localAxis 為單位軸、sign ∈ {1,−1}。
- rigged-shaped 場景綁定（`gltfBinding.test.ts` 擴充）：scene 含 skinned mesh（名＝anatomyId）＋ `Skeleton`（bone 名非 anatomyId）→ `bindAnatomyMetadata` 仍正確綁 mesh、`scene.skeletons` 有值、armature 不被誤綁。
- 命名遵 [07 §7.5](../07_dev_conventions.md)：camelCase／PascalCase／UPPER_CASE，**嚴禁 snake_case**。

## 設計同步

- `doc/design/04_human_model.md` §4.3.3：「MakeHuman 真骨架＋skin 變形」由純後續軌改述為「**執行期驅動層已實作；有骨架資產走 bone 驅動軟變形、無骨架走剛性節段 fallback**」；標注真資產校正、gizmo skinned 擺位、多椎脊椎、資產管線綁骨匯出為延後。
- `doc/todo/04_todo_human_model.md`：勾選執行期 skin 驅動；保留／新增後續軌（真資產 bone 校正、資產管線綁骨＋蒙皮匯出、skinned gizmo/picking、多椎脊椎）。
