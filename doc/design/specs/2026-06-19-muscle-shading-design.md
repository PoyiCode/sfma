# 運動模式：肌肉收縮／伸展著色 — 設計規格

> 日期：2026-06-19｜設計：[04 §4.3.4](../04_human_model.md#434-肌肉收縮伸展色彩)
> 前置：[運動模式總覽](2026-06-18-motion-mode-design.md)、[左右側別獨立控制](2026-06-19-motion-per-side-design.md)

## 目標

運動模式下擺動關節時，相關肌群依其狀態以**發散色階**顯示收縮（暖色）與伸展（冷色）、
中性為無著色，強度對應「關節角相對 neutral 的變化量」。著色**由資料推導**（`muscle.actions`
× pose），非量測變形後 mesh，故與剛性節段綁定相容（§4.3.4）。供臨床向個案說明某動作牽動哪些肌肉。

姿態為記憶體暫態（頁面 ref，未持久化）→ 無資料遷移。

## 範圍（v1）

- **管道**：沿用 `sceneHighlight` 既有 `mesh.overlayColor`/`overlayAlpha` 單通道（NullEngine 可測、
  低風險）。Node Material（設計文件原述）列為**未來增強**，與既有「現役 overlay／未來增強」慣例一致。
- **觸發**：運動模式內**獨立開關**（`muscleShading`），**預設開**；關閉即還原一般高亮、完全不動 overlay。
- **軸涵蓋**：僅**方向明確的成對軸**（屈伸／外展內收／內外旋／蹠背屈／內外翻）。`lateralFlexion`／
  `rotation`（資料 action 為單名、無左右方向）暫不著色，記為後續軌。
- **非色彩通道（§3.6）**：暖↔冷色階**圖例** ＋「**選取關節的相關肌群**」清單於 MotionControls
  逐肌顯**文字態**（收縮／伸展／中性＋量值）。
  - 註：運動模式進入即清除部位選取（`model.vue` `selection.clear()`）、且點 3D 肢體選的是**關節**
    而非肌肉，故文字態不掛 `AnatomyInfoCard`（運動模式不渲染該卡），改掛 MotionControls；
    granularity 為「選取關節作用的肌群」而非單一肌肉，臨床上更直接（看此動作牽動哪些肌）。

**v1 不做**：Node Material；`lateralFlexion`／`rotation` 軸；肌肉實際長度量測；非可動關節
（肘／腕／指／趾／橈尺／肩胛胸廓／顳顎／舌骨／胸廓）之肌（其 action delta 恆 0、自然不著色）。

## 架構決策

### 1. 核心模型（純函式，無 Babylon）

新模組 `app/utils/humanModel/motion/muscleShading.ts`。

**`ACTION_AXIS`**：action 字串 → `{ axis, dir }`，只收方向明確成對軸；慣例＝複合軸名「第一個動作＝+1」
（與 ROM 資料一致：flexion=+120、abduction=+45 為正端）。表外動作（`lateralFlexion`／`rotation`／
`pronation`…）貢獻 0。

```ts
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
```

**`muscleContractionScalar(muscle, pose, side) → number`**（值域 `[-1, 1]`，正＝收縮、負＝伸展、≈0＝中性）：

```
s = clamp( Σ_actions [ dir × (delta / romReach) ], -1, 1 )
  map      = ACTION_AXIS[action]          // 無對應或 jointId 非可動 → 跳過
  dof      = jointDofForSide(jointId, map.axis, side)   // 側別感知 ROM（左側鏡像軸 [-max,-min]）
  delta    = jointAngle(pose, poseKey(jointId, side), map.axis, dof.neutral) − dof.neutral
  romReach = delta ≥ 0 ? (dof.max − dof.neutral) : (dof.neutral − dof.min)   // =0 則跳過（防除零）
  dir      = (side === '#L' && isMirroredAxis(map.axis)) ? −map.dir : map.dir
```

- **左側鏡像軸翻轉 `dir`**：與既有 `jointDofForSide` 之 `[-max,-min]` 鏡像一致——左外展肌外展時 pose
  落負端、翻轉後收縮純量為正。矢狀面軸（屈伸／蹠背屈）不在鏡像集、不翻轉，左右同向。
- **對未校正世界 sign 免疫**：著色與關節 rig 讀同一 pose，主動肌縮／拮抗肌伸的相對關係恆成立，
  與各軸 sign 是否實機校正無關（§4.3.3 待辦）。
- 多可動關節肌求和後 clamp；多數可動肌僅單一相關 action。

`isMirroredAxis(axis)`：自 `jointKinematics.ts` 既有私有 `MIRRORED_AXES` 包裝匯出之 predicate
（不外露 Set、維持封裝）。

**`contractionState(scalar, ε=0.02) → 'contract' | 'stretch' | 'neutral'`**：純分類（`>ε`→contract、
`<−ε`→stretch、否則 neutral），供 MotionControls 文字態與圖例。

**`musclesForJoint(jointId) → Muscle[]`**：取 `actions` 含該 jointId 且該動作於 `ACTION_AXIS` 有對應
之肌（即 v1 會著色者）；非可動關節或無對應動作 → 空集。供 MotionControls 相關肌群清單。

### 2. 著色套用（Babylon，NullEngine 可測）

同模組 `applyMuscleShading(scene, pose)`（唯一 overlay 來源、是否呼叫由 §3 dispatcher 決定）：

- 走訪 `scene.meshes`：`metadata.entityType === 'muscle'` 者為肌肉，`side = sideOfMesh(mesh.name)`
  （既有 helper，回 `#L`/`#R`/null＝pose 側）；**非肌肉 mesh 一律 `renderOverlay=false`**（清殘留選取/標註）。
- 每肌算 `s`：`s > ε` → `overlayColor=WARM, overlayAlpha=s×MAX_ALPHA, renderOverlay=true`；
  `s < −ε` → `COOL`；`|s| ≤ ε` → `renderOverlay=false`。
- 色值（暫定、可對齊 tokens §3.7）：`WARM=#D94A2A`（與 painful-red `#c0392b` 區隔）、
  `COOL=#2F6FB0`、`MAX_ALPHA≈0.55`、`ε≈0.02`。

### 3. overlay 單一權威（與選取／標註高亮優先序）

`overlayColor` 每 mesh 單通道，故須單一權威。抽純函式 dispatcher
`applyOverlays(scene, { motionMode, muscleShading, pose, selectedKey, highlights })`（置 `muscleShading.ts`、
NullEngine 可測）：

- **`motionMode && muscleShading`** → `applyMuscleShading(scene, pose)` 為唯一 overlay 來源
  （**不**呼叫 `applyHighlights`；反向標註高亮屬一般檢視關注、運動模式以 gizmo 表達「選取的關節」）。
- **否則** → `applyHighlights(scene, selectedKey, highlights)` 如現行（含運動模式但著色關時仍顯標註）。

`Model3DView` 三個 watcher（`highlights`／motion〔motionMode/pose…〕／`muscleShading`）皆改呼 `applyOverlays()`，
杜絕兩 applier 互搶。rig `applyPose` 已改 mesh 之 parent，overlay 依 mesh 設定、與 parenting 無關。

### 4. 元件接線

- `Model3DView` / `Model3DViewer`：新增 `muscleShading?: boolean`（預設 `true`）透傳；新增
  `refreshOverlays()` 收斂分流（取代 highlights watcher 直呼 `applyHighlights`）。
- `MotionControls`：新增 `muscleShading` prop ＋ `update:muscleShading` emit；一個 `BaseSwitch`
  「肌肉著色」開關（樣式比照 `Model3DControls` 標籤開關）；開啟時顯
  (a) **暖↔冷色階圖例**（收縮↔中性↔伸展，含文字標籤、非僅色）、
  (b) **選取關節相關肌群清單**——以 `musclesForJoint(selectedJoint)` 取作用於該關節之肌，
  逐肌以 `muscleContractionScalar(muscle, pose, poseSide)`＋`contractionState` 顯文字態
  （收縮／伸展／中性＋量值）。已有 `pose`/`selectedJoint`/`selectedSide` props，無需新增資料來源。
- `model.vue`：`muscleShading` ref（預設 `true`）＋切換 handler（透傳，不另算狀態）。
- `AnatomyInfoCard`：**不變**（運動模式不渲染該卡）。
- `i18n/locales/zh-TW.json`：`modelMuscleShading`、`muscleShadingContract`、`muscleShadingStretch`、
  `muscleShadingNeutral`、`muscleShadingRelated`。

### 5. 邊界情形

- 肌無可動關節 action（如僅作用肘／腕）→ 純量 0 → 不著色。
- 多可動關節肌 → 各 action 貢獻求和、clamp `[-1,1]`。
- 空／中立 pose → 全 0 → 全不著色。
- 著色關 ↔ 開、運動模式進 ↔ 出 → 經 `refreshOverlays()` 冪等切換 overlay 來源。
- 佔位身體（無 #L/#R、無真肌 mesh）→ 無肌肉 mesh 命中、安全 no-op。

## 受影響檔案

| 檔案 | 變更 |
|---|---|
| `app/utils/humanModel/motion/muscleShading.ts`（新） | `ACTION_AXIS`、`muscleContractionScalar`、`contractionState`、`musclesForJoint`、`applyMuscleShading`、`applyOverlays` |
| `app/utils/humanModel/motion/jointKinematics.ts` | 匯出 `isMirroredAxis(axis)` predicate（包裝既有 `MIRRORED_AXES`） |
| `app/components/humanModel/Model3DView.vue` | `muscleShading` prop；`refreshOverlays()` 收斂 overlay 分流 |
| `app/components/humanModel/Model3DViewer.vue` | 透傳 `muscleShading` prop＋`muscleShadingChange` emit |
| `app/components/humanModel/MotionControls.vue` | `muscleShading` 開關＋`update:muscleShading`＋色階圖例＋選取關節相關肌群清單 |
| `app/pages/patients/[patientId]/model.vue` | `muscleShading` ref＋切換 handler（透傳） |
| `i18n/locales/zh-TW.json` | `modelMuscleShading`／圖例／文字態鍵 |

## 測試

- `muscleShading.test.ts`：`ACTION_AXIS` 釘值；屈肌全屈 = +1、其拮抗肌 = −1；多動作求和/clamp；
  非可動關節 action → 0；左側鏡像軸翻轉（左外展肌外展 → 正收縮）；空 pose → 全 0。
- 套用（NullEngine）：收縮肌得暖 overlay、伸展得冷、中性 `renderOverlay=false`；非肌肉 mesh 清除；
  `#L`／`#R` 以各自 pose 獨立著色。
- `Model3DView`：著色開時不套標註高亮、只染肌肉；關閉/退運動模式還原 `applyHighlights`。
- `MotionControls`：開關 emit `update:muscleShading`；圖例＋相關肌群清單隨開關顯隱；
  清單以 `musclesForJoint`＋`contractionState` 顯選取關節各肌之文字態（換側別→量值/方向更新）。
- `muscleShading.test.ts` 另含 `contractionState`（正→contract、負→stretch、≈0→neutral）與
  `musclesForJoint`（取作用於關節之肌、非可動關節空集）。

## 設計同步

- `doc/design/04_human_model.md` §4.3.4：overlay 著色改述為**現役**、Node Material 列未來增強；
  補「成對方向明確軸、左側鏡像翻轉、運動模式獨佔 overlay」要點。
- `doc/todo/04_todo_human_model.md`：勾選肌肉著色；新增後續軌（`lateralFlexion`/`rotation` 軸著色、
  Node Material 發散材質）。
