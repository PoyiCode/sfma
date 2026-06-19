# 04 — Todo：人體模型（3D 檢視器）

> 階段：開發期｜來源設計：[04_human_model.md](../design/04_human_model.md)、[02_architecture.md](../design/02_architecture.md) §2.4–2.5、§2.9｜前置：[01](01_todo_setup.md)、[03](03_todo_assets.md)（至少佔位資產）

## 運動模式（motion mode）與關節活動

> 設計：[04 §4.3.3](../design/04_human_model.md#433-關節活動與-rom-限制)、[工作規格](../design/specs/2026-06-18-motion-mode-design.md)

### v1 已完成（剛性節段旋轉，SFMA 臨床 6 關節）

- [x] 運動模式開關（motion mode toggle）
- [x] 逐自由度滑桿（per-DOF sliders）依 `degreesOfFreedom` 展開
- [x] `clampAngle` 將角度鉗制於 ROM `min`／`max` 內
- [x] ROM 觸界提示：文字說明＋琥珀色提示（§3.6，非僅顏色）
- [x] 剛性節段旋轉：6 SFMA 關節（頸椎／肩／脊椎／髖／膝／踝），脊椎／頸椎以單樞紐近似
- [x] on-model 拖曳手柄：模型表面弧形手柄 grab-and-turn 驅動關節（雙向同步滑桿；04 §4.3.3）
- [x] 左右側別獨立：雙側關節（肩／髖／膝／踝）各自 pose（`poseKey` #L/#R）；面板左/右切換＋點肢體同步（[spec](../design/specs/2026-06-19-motion-per-side-design.md)）
- [x] 左右鏡像 ROM：非矢狀軸（外展內收／內翻外翻／內外旋）左側取右側鏡像 `[-max,-min]`（`jointDofForSide`）

### 待實作（後續軌）

- [x] 肌肉收縮／伸展著色（overlay；04 §4.3.4）
- [ ] MakeHuman 真骨架＋skin weights 軟變形，取代剛性節段（04 §4.3.3）
- [ ] 其餘關節：肘、腕、指、趾、顳顎關節、胸廓等（04 §4.3.3）
- [ ] 平滑多椎脊椎：頸椎／脊椎逐椎獨立旋轉（取代單樞紐近似）
- [ ] 軸／sign 實機目視校正（各 DOF 旋轉軸方向與正負號待真實資產驗證）

## 肌肉收縮／伸展著色

- [x] 關節角度 → 肌肉長度變化純量（pose × `actions`，方向明確成對軸；`muscleContractionScalar`；04 §4.3.4）
- [x] overlay 發散著色（收縮暖／伸展冷／中性無；運動模式內獨立開關、預設開；`applyMuscleShading`/`applyOverlays`）
- [x] 非色彩輔助（§3.6）：色階圖例＋選取關節相關肌群文字態（MotionControls）
- [ ] Node Material 參數驅動發散材質（更細緻漸層，取代 overlay）
- [ ] `lateralFlexion`／`rotation` 軸著色（資料 action 單名、待左右方向）
