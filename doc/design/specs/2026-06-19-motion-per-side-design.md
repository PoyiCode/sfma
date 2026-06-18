# 運動模式：左右側別獨立控制 — 設計規格

> 日期：2026-06-19｜設計：[04 §4.3.3](../04_human_model.md#433-關節活動與-rom-限制)
> 前置：[運動模式總覽](2026-06-18-motion-mode-design.md)、[on-model 拖曳手柄](2026-06-18-motion-drag-handles-design.md)

## 目標

雙側關節（肩／髖／膝／踝）可各自獨立保持不同角度（例：左髖屈曲 90°、右髖中立），
供臨床觀察左右不對稱（SFMA 核心）。**移除**現行「雙側對稱鏡像驅動」。單側關節
（脊椎／頸椎，`bilateral:false`）行為不變。

姿態為記憶體暫態（頁面 ref，未持久化）→ 無資料遷移。

## 架構決策

### 1. 姿態鍵改為「節段鍵」（side-suffixed）

`MotionPose = Record<string, Record<axis, deg>>` 型別**不變**；鍵由裸 `jointId` 改為
**節段鍵** ＝ rig 既有 `pivotKey(jointId, side)`：

- 雙側 → `joint.knee#L` / `joint.knee#R`
- 單側 → `joint.spine`（無後綴，同現行）

唯一真相：純函式 `poseKey(jointId, side)`（置於 `jointKinematics.ts`，因其握有
`JOINT_KINEMATICS[*].bilateral`）。規則：

```ts
// 雙側關節→附側別後綴；單側關節→裸 jointId（忽略 side）
export function poseKey(jointId: string, side: string | null): string {
  return JOINT_KINEMATICS[jointId]?.bilateral === true ? `${jointId}${side ?? '#R'}` : jointId;
}
```

頁面、面板、手柄、rig 一律經此鍵讀寫。

**否決方案**：巢狀 `Record<joint, Record<side, Record<axis, deg>>>` — 變更型別與所有
helper／手柄／rig／測試，無實質增益（YAGNI）。

### 2. seam：`setJointAngle` 帶入 `side`

- 元件事件 `setJointAngle` 由 `(jointId, axis, deg)` → `(jointId, side, axis, deg)`。
- 頁面 handler 以 `poseKey(jointId, side)` 組鍵寫入 `pose`。
- `articulationRig.applyPose`：`pivotMeta` 已含 `side` → 讀 `poseKey(kin.jointId, side)`
  取代裸 `kin.jointId`（**此即現行鏡像之根因行**）。
- 手柄回呼 `onAngle` 帶自身 side；`getPoseAngle` 亦帶 side（手柄本即依 side 建立）。

### 3. UI

- `Model3DView`：側別上移至頁面為唯一真相。`selectMotionJoint` 由 `(jointId)` →
  `(jointId, side)`；內部 `motionSide` 改由 `props.motionSide` 驅動（拆除 closure 變數），
  手柄 sync 與 `setJointAngle` 取 `props.motionSide`。
- `Model3DViewer`：透傳 `motionSide` prop 與 `selectMotionJoint(jointId, side)` 事件。
- 頁面 `model.vue`：新增 `motionSide` ref（預設 `#R`）。點肢體→同時設 `motionJoint`＋
  `motionSide`；面板 左/右 切換鈕→設 `motionSide`。
- `MotionControls`：新增 `selectedSide` prop ＋ `update:selectedSide` 事件；**僅當選取
  關節為雙側**時渲染 左/右 `BaseSegmentedControl`；滑桿讀寫該側值。

### 4. 邊界情形

- 選單側關節 → 不顯 左/右 鈕、side 視為 `null`、鍵為裸 `jointId`。
- 切換關節保留目前 side（雙側兩側皆合法）；選到單側關節則隱藏切換鈕。
- 回中立 → 整個 pose `{}`（含兩側），同現行。
- 預設側 `#R`（沿用現行 closure 預設）。

### 5. 左右鏡像 ROM

額狀／橫狀面動作於身體中線左右鏡像；矢狀面（屈伸／蹠背屈）左右同向。definitions 之
`degreesOfFreedom` 存**右側慣例**值；單一世界 sign 驅動雙側，故**左側 ROM ＝ 右側鏡像
`[-max, -min]`**（對稱範圍如 `[-45,45]` 鏡像為無作用）。

```ts
const MIRRORED_AXES = new Set(['abductionAdduction', 'inversionEversion', 'internalExternalRotation']);
// 左側鏡像軸取 [-max,-min]；右側、矢狀面軸、單側關節原值
export function jointDofForSide(jointId, axis, side): DegreeOfFreedom | undefined {
  const dof = movableJointDof(jointId, axis);
  if (!dof) return undefined;
  if (side === '#L' && MIRRORED_AXES.has(axis) && JOINT_KINEMATICS[jointId]?.bilateral) {
    return { ...dof, min: -dof.max, max: -dof.min };
  }
  return dof;
}
```

使用者規格（右＝definitions、左＝鏡像）：髖外展 右`-30~45`／左`-45~30`；踝內翻外翻
右`-35~15`／左`-15~35`；肩外展 右`-50~180`／左`-180~50`；肩內外旋 右`-70~90`／左`-90~70`。

`jointDofForSide` 取代 `MotionControls`（slider min/max/clamp）與 `jointGizmo`（觸界著色、拖曳 clamp）
之 `movableJointDof`。rig `applyPose` 僅取 `neutral`（皆 0、鏡像不影響）故不改；世界 sign 維持單一。

## 受影響檔案

| 檔案 | 變更 |
|---|---|
| `app/utils/humanModel/motion/jointKinematics.ts` | 新增 `poseKey(jointId, side)`、`normalizeSide`、`jointDofForSide`（鏡像 ROM） |
| `app/utils/humanModel/motion/articulationRig.ts` | `applyPose` 以 `poseKey` 讀每側值 |
| `app/utils/humanModel/motion/jointGizmo.ts` | `onAngle`／`getPoseAngle` 帶 side |
| `app/utils/humanModel/motion/gizmoController.ts` | 將 side 傳入手柄回呼 |
| `app/components/humanModel/Model3DView.vue` | `selectMotionJoint(jointId, side)`、`motionSide` prop、`setJointAngle` 帶 side |
| `app/components/humanModel/Model3DViewer.vue` | 透傳 `motionSide`／事件 |
| `app/components/humanModel/MotionControls.vue` | `selectedSide` prop＋左/右 切換（雙側才顯）＋滑桿帶 side |
| `app/pages/patients/[patientId]/model.vue` | `motionSide` ref＋handlers |
| `i18n/locales/zh-TW.json` | `modelMotionSide`／`motionSideLeft`（左）／`motionSideRight`（右） |

## 測試

- `poseKey`：雙側附 `#L`／`#R`、單側裸鍵、未知關節裸鍵。
- `articulationRig`：pose `{ 'joint.knee#L': {...} }` 僅旋轉 `#L` pivot、`#R` 維持中立
  （**不對稱保證**）；單側關節以裸鍵驅動。
- `MotionControls`：左/右 鈕僅雙側關節顯示；滑桿 input 以選取側別 emit；讀對應側值。
- `gizmoController`／`jointGizmo`：drag 之 `onAngle` 帶正確 side。

## 設計同步

- `doc/design/04_human_model.md` §4.3.3：移除「雙側對稱鏡像」待辦、改述為左右獨立。
- `doc/todo/04_todo_human_model.md`：勾選／新增左右獨立項。
