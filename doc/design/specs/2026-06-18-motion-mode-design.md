# 運動模式（Motion Mode）設計規格

> 日期：2026-06-18｜狀態：設計定案、待實作｜對應設計文件：[04_human_model.md](../04_human_model.md) §4.3.3／§4.3.4｜文件語言：zh-tw
>
> 本規格為「讓 3D 模型動起來」功能之實作設計。為 brainstorming 產出之工作規格；正式 canonical 設計（§4.3.3 改寫）與 todo 同步列為實作交付項（見 §10）。

## 1. 背景與現況約束

讓 3D 人體模型「動起來」：使用者可在**運動模式（motion mode）**下活動關節，且**不可超出人體活動範圍（ROM）**。

關鍵現況（決定整個取徑）：

- **資產無骨架（rig）**。現役 `anatomyV1.glb` 為 730 節點／569 mesh 的**扁平集合**（716/730 為場景根節點），**0 skins、0 animations、0 bones**。每件 mesh 為獨立物件、以 `anatomyId`（含 `#L/#R` 側別尾碼）命名。設計文件 §4.6.3 已載明 MakeHuman 綁骨（步驟 3）「尚未提供」。
- 故 §4.3.3 教科書取徑（Babylon skeleton bones ＋ `BoneIKController` ＋ skin weights）**目前不可行**——沒有可驅動的骨架。
- **ROM 限制資料已就緒**。`@ptapp/definitions` 之 16 個 `joint` 實體皆帶 `degreesOfFreedom`（`min/max/neutral/unit`，如 `joint.elbow` 屈伸 0–145°、`joint.glenohumeral` 三軸）。故「限制」已備，缺的是「運動學」（樞紐位置、旋轉軸、哪些 mesh 移動）。

## 2. 決策摘要

| 決策 | 選定 | 理由 |
| --- | --- | --- |
| 運動取徑 | **剛性節段旋轉（rigid segment rotation）** | 免綁骨、用現役資產即可動；對齊 §4.3.3「預設逐 mesh 剛性綁主骨」基線；對未來真 rig 前向相容（關節驅動層可於同一 UI 下抽換） |
| 關節範圍 | **SFMA 臨床優先集**：頸椎、肩（glenohumeral）、脊椎、髖、膝、踝 | 對齊 SFMA top-tier breakout；脊椎／頸椎多節段以單樞紐簡化（§5） |
| 互動方式 | **逐自由度（per-DOF）滑桿**，置於 `setJointAngle` seam 之上 | 穩健、精確（顯示角度）、觸控／桌面一致、純函式可測；on-model 拖曳手柄為後續、共用同一 seam |
| 肌肉收縮／伸展著色 | **延後**（另開任務） | 縮小範圍；避免依賴尚為 PT 佔位的 muscle `actions`／`relatedJoints`；運動層暴露關節角，著色日後可讀取 |

## 3. 架構

沿用既有 render 層慣例：**框架無關決策函式（NullEngine／node 可測）** 與 **元件接線** 分立。

### 3.1 純邏輯層（`app/utils/humanModel/motion/`，不 import Babylon 或僅 type-only）

- `jointKinematics.ts` — 運動學表 ＋ **節段樹（segment tree）**（資料，見 §4）。型別：`JointKinematics`、`SegmentNode`、`DofAxisMapping`、`PivotAnchor`。
- `romClamp.ts` — `clampAngle(dof, requested) → { value, atLimit }`，讀 `@ptapp/definitions` 既有 `degreesOfFreedom` 之 `min/max`。此即「不可超出活動範圍」全部規則。純函式。
- `motionPose.ts` — `MotionPose`（`jointId → axis → 角度(deg)`）＋ 純 reducer：`setJointAngle`、`resetPose`、`neutralPose`。

### 3.2 Babylon 接線層

- `articulationRig.ts` — 進入運動模式時，依運動學表建一棵 `TransformNode` 樞紐樹，將各節段 mesh `setParent` 至其樞紐（`setParent` 保世界變換），樞紐依節段樹巢狀。`applyPose(rig, pose)` 依 pose 設各樞紐旋轉；`dispose()` 還原原始 parenting。**全程僅此檔變動場景圖。**

資料流 seam：`滑桿 → setJointAngle → clampAngle → applyPose`。日後拖曳手柄呼叫同一 `setJointAngle`、不動下層運動學與 clamp。

## 4. 運動學資料模型：節段樹

身體切為剛性節段；關節為父子節段間的樞紐。**巢狀**使「移動髖部帶動整條腿、移動膝只帶動小腿＋足」自然成立：

```
pelvis/sacrum（固定基座）
├─ spine 樞紐（lumbosacral）            → trunk：胸腰椎、肋骨、胸骨、軀幹肌
│   ├─ cervical 樞紐（cervicothoracic） → neck+head：頸椎、顱骨、下頜、舌骨、頸部肌
│   ├─ glenohumeral 樞紐 L             → arm L：肱骨＋前臂＋手＋上肢肌（v1 肘剛性）
│   └─ glenohumeral 樞紐 R             → arm R
├─ hip 樞紐 L → thigh L → knee 樞紐 L → shank L → ankle 樞紐 L → foot L
└─ hip 樞紐 R → …（鏡像）
```

### 4.1 樞紐位置：自幾何計算（非手填座標）

每個關節指定 **anchor bone ＋ AABB 面**，樞紐 = 該骨世界 AABB 指定面之中心。資產位移時可重新推導、無魔術數字。

| 關節 | anchor bone | 面 |
| --- | --- | --- |
| hip | `bone.femur` | 上端（max-Y）面心 |
| knee | `bone.tibia` | 上端（max-Y）面心 |
| ankle | `bone.tibia` | 下端（min-Y）面心 |
| glenohumeral | `bone.humerus` | 上端（max-Y）面心 |
| cervical | 第一胸椎 `bone.t1`（頸胸交界） | 上端（max-Y）面心 |
| spine | 薦椎 `bone.sacrum` 頂（腰薦交界，鄰 `bone.l5`） | 上端（max-Y）面心 |

> 脊椎節已建妥獨立 mesh：頸椎 `bone.c1`–`c7`、胸椎 `bone.t1`–`t12`、腰椎 `bone.l1`–`l5`、`bone.sacrum`。樞紐 = 指定節之世界 AABB 指定面中心，與肢端關節同一機制；確切 anchor 節於實作時微調定版。
>
> 採計算式而非手填座標：對齊「資產可抽換」原則、避免對未自有之 CC BY-SA 資產寫死座標而脆裂。

### 4.2 旋轉軸

模型為中立站姿，**解剖軸 ≈ 世界軸**。每自由度於表中對應一世界軸＋正負號：屈伸→X、外展內收→Z、旋轉→Y。v1 以此近似，日後可精修（每關節局部軸）。

### 4.3 節段成員（segment membership）

「哪個 `anatomyId` 屬哪個節段」為本功能**主要編寫工作量**。規則：

- 每件 mesh 指派至**恰一**節段。
- **肌肉歸其「肌腹（belly）」所在節段**：預設啟發式 `segmentForMuscle` 取 `relatedJoints` 對應諸節段中**最近端**者（深度最小）。但外在肌之肌腹位於所跨關節的**近端**節段——單關節肌時「作用關節」與「肌腹節段」背離（如股四頭三頭 `vastus*` 作用膝、肌腹在股骨；小腿外在肌 `soleus`／脛前後肌／腓骨肌／伸屈趾長肌作用踝/趾、肌腹在脛腓骨），若按作用關節會被誤歸遠端節段、隨遠端剛性旋轉而**整條脫離**。故以 curated `MUSCLE_SEGMENT_OVERRIDE`（`jointKinematics.ts`）把這類肌校正回近端節段。無法純由 `relatedJoints` 自動辨識（三角肌亦單關節 `[盂肱]` 但肌腹罩上臂、歸手臂才對），故採資料化人工校正。
- **無作用關節之肌亦走 override**：表情肌（`orbicularisOculi`／`zygomaticus*`／`occipitofrontalis`／`buccinator`／`platysma`…）動皮膚不動關節 → `relatedJoints` 空 → `segmentForMuscle` 回 null → 預設**騎乘固定基座（靜止）**，旋轉頭/頸時整批浮空脫離。以 `MUSCLE_SEGMENT_OVERRIDE` 歸 `joint.cervicalSpine`（肌腹貼顱骨/面），隨顱骨旋轉。骨盆底肌（`pubococcygeus`…）同為 null 但本應靜止於基座、**不**override。
- 校正後僅**肌腱越關節之插入端**有輕微縫隙＝設計接受基線（待真 skin 變形改善，見 [skin 變形執行期驅動 spec](2026-06-19-skin-deformation-runtime-design.md)）。
- 初版可依骨骼命名＋Y 位置半自動分群，再人工校正；成員表為資料，擴充關節 = 增資料、不需改碼。

## 5. 脊椎與頸椎處理（多節段簡化）

v1 各以**單一剛性樞紐**：lumbosacral 樞紐旋整個軀幹（及其上），cervicothoracic 樞紐旋頭＋頸；分別由 `joint.spine`／`joint.cervicalSpine` 之 ROM 驅動（屈伸／側彎／旋轉）。

- 為粗略近似（真實脊椎為平滑曲線），但與剛性節段模型一致、統一「樞紐＋遠端節段＋軸＋ROM clamp」。
- **平滑多椎彎曲明確延後**。

## 6. 運動模式 UX 與狀態

- **切換鈕**置 `Model3DControls.vue`（i18n，如 `modelMotionMode`）。預設關；未切換前模型靜態，與現狀完全相同。
- **進入**：建 articulation rig、設中立 pose、資訊面板換為 **`MotionControls.vue`**。
- **選關節**：點選可動節段（選其控制關節）或自關節分段控制／清單擇一。面板顯該關節各 DOF 一支標籤滑桿＋即時角度讀數。
- **驅動**：滑桿 → `setJointAngle` → clamp → `applyPose`。觸 ROM 極限時滑桿貼軌、轉**琥珀色**，並以文字／`role="status"` 提示（非色彩通道，§3.6）。
- **重置 pose** 鈕 → 中立。**離開** → 還原 parenting、回正常模式。
- **互動相容**：運動模式下暫停評估選取／標註（獨立模式）；**分層可見性與相機環繞照常運作**；標籤跟隨。

接線：`Model3DView.vue` 增 `motionMode`／`pose` props ＋ `setJointAngle` emit；`Model3DViewer.vue`＋`ModelViewerPage` 持模式／pose 狀態。

**資料落點**：運動學置**app 端**（`motion/`），不入 `@ptapp/definitions`——樞紐／軸／節段成員為**資產相依之算圖期運動學**、非可移植解剖事實（對齊 `anatomyLayers.ts` 置 app 端之慣例）。ROM 仍留 definitions。

## 7. 檔案佈局（新增為主）

```
app/utils/humanModel/motion/
  jointKinematics.ts        # 運動學表＋節段樹＋型別
  jointKinematics.test.ts   # 表不變式（每關節 DOF 對齊 definitions、節段樹完整、成員不重複）
  romClamp.ts               # clampAngle 純函式
  romClamp.test.ts
  motionPose.ts             # MotionPose ＋ reducers
  motionPose.test.ts
  articulationRig.ts        # Babylon：建樞紐／reparent／applyPose／dispose
  articulationRig.test.ts   # NullEngine
app/components/humanModel/
  MotionControls.vue        # 運動面板（關節選擇＋逐 DOF 滑桿＋角度讀數＋重置）
  MotionControls.test.ts    # jsdom
  Model3DControls.vue       # 增運動模式切換鈕（修改）
  Model3DView.vue           # 增 motionMode／pose props ＋ setJointAngle emit（修改）
  Model3DViewer.vue         # 模式／pose 狀態接線（修改）
```

## 8. 測試策略

- **純函式**（`romClamp`、`motionPose`、運動學表不變式、軸數學）→ `pnpm test`（node）。
- **`articulationRig`** 建構／applyPose／dispose → NullEngine（如既有 scene 測試）。
- **`MotionControls`／切換** → jsdom 元件測試。
- 命名遵 07 §7.5：camelCase／PascalCase／UPPER_CASE，**嚴禁 snake_case**。

## 9. 範圍外（明確排除）

- 肌肉收縮／伸展著色（§4.3.4）。
- on-model 拖曳手柄（共用 seam，後續）。
- MakeHuman rig／skin 變形（真骨架）。
- 肘／腕／指／趾／顳顎／舌骨／胸廓／scapulothoracic／radioulnar 之活動。
- 平滑多椎脊椎曲線。

## 10. 與既有文件同步（設計同步、實作交付項）

依 CLAUDE.md 設計同步必守，下列於實作落地時同步更新：

- 改寫 [04_human_model.md](../04_human_model.md) **§4.3.3**：由教科書 rig 取徑改述為「剛性節段旋轉」現實＋運動模式＋滑桿 UI；標注拖曳／著色／真 rig 為延後。
- `doc/todo` 對應項：新增運動模式實作待辦、勾選／調整 §4.3.3 相關項。

## 11. 風險與待解

- **節段成員編寫量**為主要工作量與品質風險；初版半自動分群＋人工校正。
- **樞紐近似**（尤其脊椎／頸椎單樞紐）為臨床粗略；發布前須 PT 審閱（與既有 ROM 佔位審閱併軌）。
- **跨關節肌剛性移動**會在起止點輕微脫離；設計已接受為基線、待真 skin 變形改善。
- 世界軸 ≈ 解剖軸之假設依賴中立站姿；若資產姿態偏移需改採局部軸。
