# 全身 rig + skin 資產管線 — 設計規格

> 日期：2026-06-19｜設計：[04 §4.6.3 步驟 3–4](../04_human_model.md#463-製作管線blender-bpy-腳本)、[§4.3.3](../04_human_model.md#433-關節活動與-rom-限制)
> 前置：[執行期 skin 驅動](2026-06-19-skin-deformation-runtime-design.md)（runtime 已實作＋修正）、[運動模式](2026-06-18-motion-mode-design.md)
> 文件語言：zh-tw｜狀態：設計定案、待實作

## 目標

把 `z-anatomy.blend` 的解剖 mesh 綁到 **MakeHuman 預設骨架**並蒙皮，匯出**帶 armature＋skins 的 `anatomyV1.glb`**，使現役 `boneRig` 執行期以同一 `pose` 驅動骨骼、肌肉軟變形。產出後，skin 變形這條線端對端打通（資產→runtime→渲染）。

本規格為 skin 變形兩子系統中的**「資產管線」子專案**（另一半「執行期驅動」已於 [skin 驅動 spec](2026-06-19-skin-deformation-runtime-design.md) 完成並修正）。

## 已 de-risk（本規格建立其上）

- **執行期 `boneRig` 已實作並修正**：載真 skinned glb→驅動骨架（含 glTF `linkedTransformNode`）→GPU 蒙皮變形→WebGL 渲染，已端對端驗（[skin 驅動 spec](2026-06-19-skin-deformation-runtime-design.md)）。
- **一條腿 spike 驗證蒙皮可行**（`infra/asset-pipeline/spikeLegRig.py`）：自動權重（ARMATURE_AUTO）＋位置漸變後備＋Freestyle/compositor-off 算圖；彎膝變形臨床可接受（使用者目視）。
- **MakeHuman 預設骨架已取得**：`doc/ref/models/makehuman-default-skeleton.json`（163 bones、CC0、head/tail 位置＋hierarchy＋provenance，自開源 `default.mhskel`＋`base.obj` headless 重建，無 MakeHuman app）。bone 名已對齊 `BONE_RIG_MAP`（`upperleg01.L`／`lowerleg01.L`／`foot.L`／`upperarm01.L`／`neck01`／`spine0x`）。

## 範圍（v1）

- **驅動 6 SFMA 關節**（頸椎、肩、脊椎、髖、膝、踝），對齊 `BONE_RIG_MAP`。
- **全身所有 mesh 綁定**：多數 mesh 剛性綁至其節段對應骨；跨關節肌做蒙皮（位置漸變權重）。
- **產出單一 rigged `anatomyV1.glb`**（standard profile）；`full` profile 暫沿用無骨架（或後續）。

**v1 不做**：手指／腳趾／多節脊椎之**驅動**（其骨存在於骨架、其 mesh 剛性綁至父節段，但 runtime 不驅動）；逐肌手動 weight 精修；真實 rig 之軸/sign 校正（沿用 skin 驅動 spec 之延後）；`anatomyV1.full.glb` 之 rig。

## 決策摘要

| 決策 | 選定 | 理由 |
| --- | --- | --- |
| 骨架來源 | **MakeHuman 預設骨架（163 bones、CC0）** | 解剖正確、未來可擴充更多關節、標準命名；已 headless 取得、無 app 依賴 |
| 對位 | **腳本 auto-fit ＋ 關鍵關節 snap** | 無手動 Blender；spike 已驗 AABB anchor snap；非驅動骨隨整體 fit 近似可接受 |
| 綁定 | **節段成員驅動**（剛性綁＋跨關節肌蒙皮） | 重用 `jointKinematics` 既有成員邏輯（單一真相）；spike 已驗蒙皮技法 |
| 成員橋接 | **node/tsx 腳本匯出成員 JSON 供 bpy 讀** | 避免 Python 重寫成員邏輯、防漂移 |
| 執行 | **scripted bpy、`blender.exe` headless** | 沿用 spike／exportGltf 慣例；可重複、可 CI |

## 架構

### 1. 骨架建構＋對位（bpy）

- 讀 `doc/ref/models/makehuman-default-skeleton.json`，建 163-bone armature（依 `head`/`tail`/`parent`）。
- **對位（scripted）**：
  1. MakeHuman 參考空間 Y-up → z-anatomy Z-up（座標轉換）。
  2. 整體 fit：縮放／平移使骨架對齊 z-anatomy 之鉛直 bounds（身高）與中線。
  3. **關鍵關節位置 snap**：把**受驅動／節段邊界關節**（髖／膝／踝／肩／脊椎／頸）之**關節點**（相鄰骨共用之 head/tail 點）snap 到 z-anatomy 對應骨 AABB anchor（同 `JOINT_KINEMATICS` pivot anchor／spike）。snap **共用關節點**（非逐骨獨立）以保骨鏈連通。
- 非驅動骨（手指／腳趾／多節脊椎之細分）隨整體 fit 近似定位——v1 不驅動，可接受。

### 2. 綁定（bpy，成員驅動）

- **入 rig 範圍＝僅 `bone.`／`muscle.`**：被動結構（韌帶／關節囊／椎間盤／滑囊／筋膜／盂唇…）、神經、血管、臟器**不入旋轉變形**、靜態匯出（不蒙皮）——使用者決策：此類不需隨關節變形。
- **剛性綁定（bone./muscle.）**：每件 mesh 依**節段成員**綁至該節段對應骨（單骨、weight 1.0）。節段→MakeHuman 骨：`joint.hip→upperleg01.{L,R}`、`joint.knee→lowerleg01.{L,R}`、`joint.ankle→foot.{L,R}`、`joint.glenohumeral→upperarm01.{L,R}`（含肘以下手臂 mesh——v1 手臂整段剛動）、`joint.spine→spine0x`、`joint.cervicalSpine→neck01`。騎乘固定基座之骨（骨盆／薦椎／肋／胸骨）綁 `root`（不動）。
- **跨關節肌蒙皮**：跨關節肌（既有 `MUSCLE_SEGMENT_OVERRIDE` 之外在肌＋雙關節肌如腿後肌／股直肌／腓腸肌）以 **位置漸變權重**（spike 技法：沿肢長軸於關節處於父／子骨間平滑混合），自動權重失敗之 mesh 以就近骨後備（同 spike）。
- **成員來源**：bpy 讀 §5 之成員 JSON，不重寫成員邏輯。

### 3. 整合與輸出

- 擴充 `infra/asset-pipeline/exportGltf.py`（或其呼叫之新 rig 階段）：於既有「解析→join→改名 `anatomyId#L/R`→分層著色→減面」之後、匯出之前，插入「建骨架＋對位＋綁定」，並令 `export_scene.gltf` 帶 `export_skins=True`（含 armature）。
- bone 名＝MakeHuman 名，受驅動關節對齊 `BONE_RIG_MAP`；runtime `hasDrivableSkeleton` 解析得到。
- z-anatomy 匯出眉角（沿用既有 `exportGltf.py`＋spike 經驗）：須**強制目標 mesh 可見並掛主集合**（z-anatomy 互動圖譜預設多數隱藏／排除於 view layer，否則漏匯）；Freestyle/compositor 為算圖設定、與匯出無關，不在此處理。

### 4. 執行與驗證

- scripted bpy，`blender.exe -b z-anatomy.blend -P <rig 腳本> -- ...` headless（沿用 spike）。
- 驗證：① headless Edge 算圖 spike-style 前後對比（我跑、SendUserFile 給使用者目視）；② **端對端**：rigged `anatomyV1.glb` 經現役 `boneRig` 載入＋驅動＋WebGL 算圖（沿用已驗之 viewer 路徑）。

### 5. 成員橋接（TS→JSON）

- 新增 node/tsx 腳本（如 `infra/asset-pipeline/exportSegmentMembership.mjs`／tsx）：呼 `resolveSegmentMembership(anatomyEntities)`（`app/utils/humanModel/motion/jointKinematics.ts`）＋ `@ptapp/definitions`，輸出 `{ jointId: [anatomyId...] }` JSON 供 bpy 綁定讀。**單一真相＝`jointKinematics.ts`**，Python 不重寫成員邏輯（防漂移）。

## 資料／輸入

| 輸入 | 來源 | 授權 |
| --- | --- | --- |
| 解剖 mesh | `doc/ref/models/z-anatomy.blend` | CC BY-SA 4.0 |
| 骨架 | `doc/ref/models/makehuman-default-skeleton.json`（已取得） | CC0 |
| 來源名↔anatomyId | `infra/asset-pipeline/manifestV1.json` | — |
| 節段成員 | §5 由 `jointKinematics.ts` 匯出 | — |

## 受影響檔案

| 檔案 | 變更 |
|---|---|
| `infra/asset-pipeline/buildArmature.py`（新，或併入 exportGltf） | 讀 skeleton JSON 建 armature＋對位 z-anatomy |
| `infra/asset-pipeline/exportGltf.py` | 插入綁定階段＋`export_skins=True`；rigged 輸出 |
| `infra/asset-pipeline/exportSegmentMembership.mjs`（新） | 由 `jointKinematics.ts` 匯出成員 JSON |
| `app/utils/humanModel/motion/boneRigMap.ts` | 校核 bone 名與 MakeHuman 實名一致（多數已對齊；spine/cervical 代表骨確認） |
| `doc/ref/models/makehuman-default-skeleton.json`（已新增） | CC0 骨架來源 |

## 測試

- **成員橋接**：匯出 JSON 與 `resolveSegmentMembership` 結果一致（node 測試或快照）。
- **骨架建構**（bpy／可選 headless 斷言）：163 bones、hierarchy 正確、關鍵關節 snap 後 head/tail 落在對應 z-anatomy 骨 AABB 內。
- **綁定**：每件 mesh 有 deform 權重（無「no skin」漏綁）；跨關節肌權重跨關節分布。
- **端對端**：rigged `anatomyV1.glb` 載入後 `hasDrivableSkeleton` true、`boneRig` 驅動使受驅動關節 mesh 變形（headless Edge 算圖目視）。
- 命名遵 [07 §7.5](../07_dev_conventions.md)（bpy 為 Python、PEP8 snake_case 例外於 infra/asset-pipeline，比照既有 `exportGltf.py`）。

## 設計同步

- `doc/design/04_human_model.md` §4.6.3：步驟 3「綁骨」由「MakeHuman ≤120 bones、尚未提供」改述為「**MakeHuman 預設骨架 163 bones（CC0）已 headless 取得（`makehuman-default-skeleton.json`）、腳本 auto-fit＋關鍵關節 snap 對位**」；步驟 4「混合綁定」補「成員驅動剛性綁＋跨關節肌位置漸變蒙皮、含後備」。
- `doc/design/04_human_model.md` §4.3.3：skin 變形待辦補「資產管線已規劃（本 spec）」。
- `doc/todo/04_todo_human_model.md`：將「資產管線綁骨＋蒙皮匯出」由後續軌移為進行中／勾選子項（骨架取得 ✓）。
