# 運動模式：on-model 拖曳手柄（drag handles）設計規格

> 日期：2026-06-18｜狀態：設計定案、待實作｜分支：`feat/motion-mode`（接續運動模式 v1）｜對應設計：[04_human_model.md](../04_human_model.md) §4.3.3｜前置規格：[2026-06-18-motion-mode-design.md](2026-06-18-motion-mode-design.md)｜文件語言：zh-tw

本規格為運動模式 v1（逐 DOF 滑桿）之後續：在 3D 模型上直接以**自訂弧形手柄（arc handles）**拖曳活動關節，落實 §4.3.3「拖曳到邊界即停止」之原始互動構想。滑桿保留，拖曳為其補充；二者共用同一 `setJointAngle`／`clampAngle` seam。

## 1. 背景與現況

- 運動模式 v1 已上線（review-clean）：6 個 SFMA 關節（頸椎／肩／脊椎／髖／膝／踝）以剛性節段旋轉活動，逐 DOF 滑桿驅動、`clampAngle` 鉗制於 ROM、觸界以文字＋琥珀提示。
- 資料流 seam 已備：`setJointAngle(jointId, axis, deg) → clampAngle → pose ref → rigController.applyPose`。本功能新增「拖曳手柄」為另一個 `setJointAngle` 的輸入源（與滑桿並存、同一真相源 `pose`）。
- 現況限制（延續、非本功能處理）：軸／sign 為中立姿勢最佳猜測（待實機目視校正）；`MotionPose` 為**側別無關**（`jointId → axis → deg`，`applyPose` 對雙側樞紐同步套用）→ 雙側對稱活動。

## 2. 決策摘要

| 決策 | 選定 | 理由 |
| --- | --- | --- |
| 互動樣式 | **自訂 on-joint 弧形手柄**（逐 DOF 一弧；膝 1、肩／髖 3） | 完全掌控外觀／ROM／觸控；契合臨床美感（不似編輯器三環）；複用既有 seam |
| 關節選取 | **點選身體部位** → 選其控制關節並顯該關節弧手柄（面板選擇器仍同步、為替代路徑） | 「on-model」最直接、可發現；mesh→關節以既有節段成員反查 |
| 拖曳→角度 | **抓取旋轉（grab-and-turn sweep）**：指標投影至旋轉平面、量繞樞紐掃掠角，弧 1:1 跟手 | 最自然精確；數學為可單元測試之純函式 |
| 雙側 | **維持 v1 側別無關**（拖曳雙側關節＝兩側對稱活動，同滑桿） | 不擴張 pose 模型範圍；per-side 獨立為後續 |

## 3. 架構（沿用純函式決策層 ＋ Babylon 接線分立）

### 3.1 純邏輯層（`app/utils/humanModel/motion/`，node 可測、無 Babylon）

- `dragRotation.ts`：
  - `pointerAngleInPlane(rayOrigin, rayDir, pivot, planeNormal, refDir): number`（弧度）—— 指標射線與旋轉平面（點＝pivot、法線＝planeNormal＝該 DOF 世界軸）求交，於平面內以正交基底 `u=normalize(refDir)`、`v=normalize(planeNormal×u)` 取 `atan2(w·v, w·u)`（`w=交點−pivot`）。向量以純 `{x,y,z}` 表（不 import Babylon）。
  - `dragToAngle(startDeg, grabAngleRad, currentAngleRad, dof): ClampResult` —— `deltaDeg = normalizeDeg((currentAngleRad − grabAngleRad)×180/π)`（`normalizeDeg` 收斂至 (−180,180] 防繞圈跳變）；`requested = startDeg + deltaDeg`；回傳 `clampAngle(dof, requested)`（複用 Task 1 之 `clampAngle`／`ClampResult`）。
- `meshToJoint.ts`：以 `segmentMembershipAll()`（Task 3）建反查表 `anatomyId → segmentJointId`（一次）；`jointForMesh(meshName): string | null` —— 去 `#L/#R` 尾碼還原 anatomyId 後查表（基座部位＝null）。`sideOfMesh(meshName): '#L'|'#R'|null` 取側別（供手柄置於對側樞紐）。

### 3.2 Rig 擴充（`articulationRig.ts`）

`ArticulationRig` 介面新增 `getPivot(jointId: string, side?: string | null): TransformNode | null`（回傳既有樞紐節點）。手柄**掛為樞紐之子節點**，故隨關節（及其父鏈）旋轉即時跟動，無須逐幀重置位置。為小幅 additive 變更。

### 3.3 Babylon 接線層（`jointGizmo.ts`）

唯一新增之變動場景圖模組（除 rig 外）。`createJointGizmo(scene, pivot, jointKinematics, { onAngle, onDragStart, onDragEnd, getPoseAngle }): JointGizmo`：
- 於 `pivot` 下逐 DOF 建一弧形手柄 mesh（短管／ribbon，臥於該 DOF 旋轉平面、世界尺度相對關節）。各 DOF 之 ROM（min/max/neutral）由 `movableJointDof(jointId, axis)`（Task 3）讀取。
- 掛 pointer 觀察者：`POINTERDOWN` 命中某弧 → 記抓取角（`pointerAngleInPlane`）＋當前 pose 角（`getPoseAngle(axis)`）、回呼 `onDragStart`（供元件 detach 相機）；`POINTERMOVE` → `dragToAngle` → `onAngle(jointId, axis, clampedDeg)`；`POINTERUP` → `onDragEnd`（reattach 相機）。
- 著色：常態 accent；該 DOF 觸 ROM 邊界（`clampAngle` 之 `atLimit`）→ 弧轉**琥珀**（`--color-warning`）＋沿用文字提示（非僅色彩，§3.6）。
- `update(pose)`：依 pose 更新各弧之觸界著色（位置由 parenting 自動跟動）。`dispose()`：釋放弧 mesh 與觀察者。

## 4. 弧手柄細節

- 僅顯示**目前選取關節**之弧；改選即 dispose 舊、建新。
- 逐 DOF 一弧：膝 1、踝 2、肩／髖 3、脊椎／頸椎 3；各弧臥於其 DOF 旋轉平面（由 `JOINT_KINEMATICS[jointId].dofs[].worldAxis` 定法線），以方位區辨。
- 弧為 `pivot` 之子 → 關節活動時平移＋旋轉跟動；近端關節活動帶動遠端關節之弧亦正確跟動（巢狀樞紐）。
- 雙側關節：手柄置於**被點選側**之樞紐（`getPivot(jointId, side)`）；面板選取（無點選）之雙側關節預設置於 `#R` 側。活動為雙側對稱（pose 側別無關）。

## 5. 互動與資料流

- **選取**：運動模式下，`POINTERTAP` 命中身體部位 → `jointForMesh` → 上拋關節選取（`selectMotionJoint`）→ 頁面 `motionJoint` 更新 → 回流為 prop → 於該關節（點選側）建手柄。面板選擇器同步。**非運動模式**：tap＝既有部位選取（不變）。
- **拖曳**：弧 `POINTERDOWN` → 記抓取角＋當前 pose 角、**detach `ArcRotateCamera`**（拖曳不誤環繞）→ `POINTERMOVE` 算掃掠角→鉗制→`setJointAngle(jointId, axis, deg)` → 頁面更新 `pose` → `rigController.applyPose` 旋轉節段＋手柄跟動 → `POINTERUP` reattach 相機。
- **雙向同步**：拖曳→pose→面板滑桿反映；滑桿→pose→手柄反映。單一真相源＝頁面 `pose` ref。滑桿維持完整可用。
- **接線增量**：`Model3DView.vue` 增 `motionJoint` prop ＋ emits `setJointAngle`、`selectMotionJoint`；建/拆手柄之 effect（依 motionMode／motionJoint／pose）；pointer 處理依 motionMode 分流。`Model3DViewer.vue` 透傳。`model.vue` 增 tap→選關節 handler（既有 `motionJoint`／`pose`／`handleSetJointAngle` 沿用）。

## 6. 檔案佈局

```
app/utils/humanModel/motion/
  dragRotation.ts        # 純：平面投影角 ＋ 掃掠→鉗制角
  dragRotation.test.ts
  meshToJoint.ts         # 純：mesh→關節／側別反查
  meshToJoint.test.ts
  jointGizmo.ts          # Babylon：弧手柄建構／pointer 拖曳／著色／dispose
  jointGizmo.test.ts     # NullEngine
  articulationRig.ts     # 修改：新增 getPivot
  articulationRig.test.ts# 補測 getPivot
app/components/humanModel/
  Model3DView.vue        # 修改：手柄生命週期＋pointer 分流＋相機 detach；motionJoint prop；setJointAngle/selectMotionJoint emits
  Model3DViewer.vue      # 修改：透傳 motionJoint／selectMotionJoint
  model.vue（page）       # 修改：tap→選關節 handler
i18n/locales/zh-TW.json  # 視需要新增字串（如手柄提示）
doc/design/04_human_model.md  # §4.3.3 同步：拖曳手柄已落實
```

## 7. 測試策略

- 純函式 `dragRotation`（平面投影角、掃掠 delta、繞圈正規化、鉗制）、`meshToJoint`（反查、去側別尾碼、基座→null）→ `pnpm test`（node）。
- `jointGizmo` 建構／弧數＝DOF 數／掛於 pivot 子／觸界著色狀態、`articulationRig.getPivot` → NullEngine（`pnpm test`）。
- 元件接線（Model3DView／Viewer／page）以 `pnpm typecheck` ＋既有測試不退步把關（互動本身難單元測）。
- 命名遵 07 §7.5（camelCase／PascalCase／UPPER_CASE，嚴禁 snake_case）。

## 8. 範圍外（明確排除）

- 軸／sign 實機目視校正（延續待辦；手柄沿用同一最佳猜測軸）。
- per-side 獨立活動（pose 維持側別無關、雙側對稱）。
- 其餘關節（肘／腕／指／趾／顳顎／舌骨／胸廓／scapulothoracic／radioulnar）。
- 肌肉收縮／伸展著色（§4.3.4）、MakeHuman 真骨架／skin 變形、平滑多椎脊椎。

## 9. 風險與待解

- **拖曳手感與弧之置放／尺度美感**須實機目視 QA（headless 僅驗純數學與建構）；Playwright 可作部分自動化煙測（導航＋截圖），但 WebGL canvas 像素級驗證仍倚人眼。
- **依賴未校正之軸**：弧繞同一最佳猜測軸旋轉，方向可能需與軸校正一併修正。
- **觸控**：pointer events 統一；須與既有 pinch 縮放／單指環繞不衝突（拖曳弧時 detach 相機為關鍵）。
- **雙側對稱**之 UX：抓單側弧而兩側同動，為 v1 pose 模型之既有簡化，文件載明。

## 10. 文件同步（設計同步交付項）

- 改寫 [04_human_model.md](../04_human_model.md) §4.3.3：將 on-model 拖曳手柄由「延後」改述為已落實（grab-and-turn 弧手柄、tap 選關節、ROM 鉗制＋琥珀觸界）；軸校正／per-side／其餘關節維持待辦。
