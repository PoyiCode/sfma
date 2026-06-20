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
- [x] 執行期 skin 變形驅動：有真骨架資產時以 pose 驅動 Babylon Skeleton bones 軟變形（`boneRig`／`BONE_RIG_MAP`；`rigController` 依骨架能力選路、無骨架走剛性 fallback；ship-dark；[spec](../design/specs/2026-06-19-skin-deformation-runtime-design.md)）
- [x] 資產管線綁骨＋蒙皮匯出：MakeHuman 163-bone CC0 骨架（headless 取得 `makehuman-default-skeleton.json`）→ Umeyama 對位＋per-joint snap（`rigSkin.build_aligned_armature`）→ 成員驅動剛性綁（`rigSkin.bind_meshes`）→ exportGltf 帶 skins 匯出 rigged `anatomyV1.glb`（5.26MB、1 skin/164 joints、730 全 skinned、驅動骨齊備；structural e2e 通過）。[spec](../design/specs/2026-06-19-fullbody-rig-skin-pipeline-design.md)
- [x] 跨關節肌位置漸變蒙皮（`crossJointBlend` 橋接＋`rigSkin.bind_meshes`：biarticular＋override 跨子節段肌於子關節 anchor 沿 proximal→distal 軸於兩骨間混合；42 mesh blended，spike 技法）
- [x] rigged 資產部署＋squash 修正：收窄跨關節肌 blend 過渡帶（`length×0.18→min(0.03,…)`）消除中度屈曲塊狀塌陷（Blender MCP 驗 ~80° 小腿保有體積）；已部署 `public/models/anatomyV1.glb`
- [x] **極限屈曲 corrective shape keys**（procedural、SDD 實作）：`rigSkin.add_corrective_shapekeys`（保體積目標−LBS 之 ΔP、qb⁻¹ 穩定轉 rest 位移＋clamp，避 M_blend⁻¹ 大角度爆裂）→ exportGltf `export_morph`（**bind/corrective 前 bake decimate**，否則 export_apply 丟 shape-keyed mesh 之 corrective）→ runtime `morphTargetController.ts`（watcher 隨 pose 設 `influence=smoothstep(onset,ref,|角度|)`、契約名 `corr.<distal jointId>`）。實際範圍＝**膝＋踝**（髖恆為近端、無遠端跨髖肌 → 無 candy-wrapper、不生 corrective）。glb 38 morph mesh（knee18/ankle20）、保完整 ROM；MCP 140° 視覺驗證無尖刺、極限角度部分修正（pre-skin morph 先天上限）。[spec](../design/specs/2026-06-20-corrective-shape-keys-design.md)｜[plan](../design/specs/2026-06-20-corrective-shape-keys-plan.md)
- [x] **下肢 bone-path 軸/sign 校正**（procedural 解析推導）：自出貨 glb node rest 解析推導 `localAxis = R_rest⁻¹·W`（W＝解剖世界軸：屈伸X／外展內收Z／旋轉Y）＋ Blender contact sheet 目視確認 sign（`boneRigMap.ts` 髖／膝／踝 6 DOF）。修正＝髖內外旋 sign、踝背蹠屈 sign、踝內外翻**斜軸** `[0,0.884,-0.4675]`＋sign；髖屈伸／外展、膝屈伸 placeholder 經驗證即正確（thigh rest≈Rot(X,180°)）。[spec](../design/specs/2026-06-20-bone-path-axis-calibration-design.md)
- [ ] rigged 資產 on-device 視覺最終驗證；上肢／軀幹 bone-path 軸/sign 校正（同解析法）＋ rigid fallback 同步
- [ ] 修 muscle-shading overlay 於 skinned 幾何之表面噪訊（§4.3.4；目前 skinned 資產下關閉，待修）
- [ ] skinned 路徑 gizmo 精確擺位與 picking 精修：bone 驅動下手柄擺位／拾取（v1 `getPivot` 回 null、手柄不啟用；04 §4.3.3）
- [ ] 其餘關節：肘、腕、指、趾、顳顎關節、胸廓等（04 §4.3.3）
- [ ] 平滑多椎脊椎：頸椎／脊椎逐椎獨立旋轉（取代單樞紐近似）
- [ ] 軸／sign 實機目視校正（各 DOF 旋轉軸方向與正負號待真實資產驗證，含 bone-local 軸校正）

## 肌肉收縮／伸展著色

- [x] 關節角度 → 肌肉長度變化純量（pose × `actions`，方向明確成對軸；`muscleContractionScalar`；04 §4.3.4）
- [x] overlay 發散著色（收縮暖／伸展冷／中性無；運動模式內獨立開關、預設開；`applyMuscleShading`/`applyOverlays`）
- [x] 非色彩輔助（§3.6）：色階圖例＋選取關節相關肌群文字態（MotionControls）
- [ ] Node Material 參數驅動發散材質（更細緻漸層，取代 overlay）
- [ ] `lateralFlexion`／`rotation` 軸著色（資料 action 單名、待左右方向）
