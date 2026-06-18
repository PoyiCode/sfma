# 04 — Todo：人體模型（3D 檢視器）

> 階段：開發期｜來源設計：[04_human_model.md](../design/04_human_model.md)、[02_architecture.md](../design/02_architecture.md) §2.4–2.5、§2.9｜前置：[01](01_todo_setup.md)、[03](03_todo_assets.md)（至少佔位資產）

## 關節活動與 ROM

- [ ] 骨架載入、關節控制點顯示與拖曳（04 §4.3.3；待 MakeHuman 骨架資產：剛性＋跨關節肌蒙皮綁定，見 [03_todo_assets.md](03_todo_assets.md)）
- [ ] `BoneIKController` + 自訂角度鉗制：每自由度依 `degreesOfFreedom` 之 min／max（04 §4.3.3、06 §6.5；待骨架）
- [ ] ROM 極限提示：警示色 + 文字／圖示（不僅依賴顏色）

## 肌肉收縮／伸展著色

- [ ] 關節角度 → 肌肉長度變化推算（由 `relatedJoints`／`actions` 資料驅動；04 §4.3.4）
- [ ] Node Material 參數驅動：收縮暖色／伸展冷色／中性基準色，強度對應變化量
- [ ] 色彩之外的輔助提示（無障礙；03 §3.6）
