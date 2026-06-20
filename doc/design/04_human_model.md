# 04 — 人體模型

人體模型是 APP 的視覺化與溝通核心，於**瀏覽器內以 Babylon.js 算圖**，3D 資產由**雲端 CDN 串流**（見 [02_architecture.md](02_architecture.md)）。APP 為**僅 3D**，解剖資料見 [06_data_model.md](06_data_model.md)。

## 4.1 共同功能

| 功能 | 說明 |
| --- | --- |
| 展示肌肉 | 依分層顯示肌群／肌束 |
| 展示神經 | 顯示神經束走向 |
| 顯示／隱藏名稱 | 各部位（器官／肌肉／神經）標籤可開關 |
| 分層開關 | 表層肌群、深層肌群（及神經、骨骼、被動結構）可獨立顯示／隱藏（**主要操作**） |
| 單一部位顯示／隱藏 | 點選任一部位可暫時隱藏，以檢視其下的深層結構；「恢復全部」一鍵還原（**輔助操作**） |
| 部位選取 | 點選後顯示名稱與屬性，並可作為評估標註目標 |

### 分層定義

共 5 個顯示分層（`ANATOMY_LAYER_KEYS`），由底到面依序疊合：

| 分層 | 內容 | 預設 |
| --- | --- | --- |
| 骨骼 | 骨架，作為其他層的空間參考 | 顯示 |
| 深層肌群 | 貼近骨骼的深層肌肉 | 隱藏 |
| 表層肌群 | 外層可見肌肉 | 顯示 |
| 神經 | 主要神經束走向 | 隱藏 |
| 被動結構 | 韌帶、椎間盤、關節囊、關節盤、筋膜、滑囊等被動穩定結構 | 隱藏 |

多層可同時開啟；表層與深層可分別控制，以呈現由淺到深的結構。

- **被動結構層**（`passiveStructure`，置末＝由底到面最後疊合）預設隱藏（opt-in），包含六類被動實體：韌帶（`ligament`）、椎間盤（`disc`）、關節囊（`capsule`）、關節盤（`articularDisc`）、筋膜（`fascia`）、滑囊（`bursa`）。獨立成層使其可單獨顯示／隔離，不灌入骨骼層。
- 分層由 `anatomy/anatomyLayers.ts` 之 `layerOfEntity` 將各實體型映射至顯示層；渲染（`applyMeshVisibility`）、3D 標籤（`resolveVisibleLabels`）皆以 `layerOfEntity`／`ANATOMY_LAYER_KEYS` 泛型運作。
- `AppSettings.defaultLayers` 各分層鍵為 optional（向後相容），`ModelViewerPage` 以 `{ ...DEFAULT_LAYER_VISIBILITY, ...settings.defaultLayers }` 補齊完整 5 鍵。

單一部位隱藏屬**檢視狀態**，不寫入資料；隱藏清單顯示於檢視器控制項（`HiddenPartsControls`），可逐一或一鍵全部恢復。檢視狀態以 `anatomy/useHiddenParts.ts` 管理（保加入序、`hide`／`restore`／`restoreAll`／`isHidden`）。隱藏目前選取部位後即清除選取（浮動資訊卡關閉、不再貼附已隱藏部位）。

選取／隱藏的粒度為**單一肌肉**（逐肌肉 node）。

**左右側獨立選取**：臨床評估為單側，成對部位左右獨立選取／高亮／標註／隱藏，沿 `side` 軸分流（FN/FP/標註本帶 `side`，06 §6.5）。anatomyId 仍側別無關；選取鍵為 **partKey**（`anatomy/partKey.ts`：成對部位＝`anatomyId@side`、中線即 anatomyId）。`useSelectedPart` 以 partKey 為鍵；`scenePicking`／`sceneHighlight`／`sceneLayers`／`anatomyHighlight` 皆以 partKey 比對（選左只亮左、單側隱藏、反向高亮側別敏感）。可靠側別來源為 `manifestV1.json` 之成對分組明確 `side` 欄（臨床左右不可互換）；`exportGltf.py` 依 `side` 出 `#L/#R` 節點，`gltfBinding` 解析還原 anatomyId＋side。標註點選自動帶入 `selectedSide`，對話框成對部位顯左／右分段可改。

**3D 點選以 POINTERTAP 辨識**：選取掛在 `scene.onPointerObservable` 之 `PointerEventTypes.POINTERTAP`（pointer-up 且位移在 `Scene.DragMovementThreshold` 內才發），旋轉／平移屬拖曳不發 tap，故不誤選／不誤清選取；輕點（滑鼠／觸控、iOS pinch／單指旋轉皆拖曳）正常選取。

## 4.2 模型檢視範圍與後備（僅 3D）

人體模型畫面 `/patients/:patientId/model`（`ModelViewerPage`）為**僅 3D**，無維度切換；`canRender3D=capability.webglSupported` 為唯一渲染閘。

- **live 3D 載入真實 glb**：3D 視口載入 `/models/anatomyV1.glb`（資產載入鏈 `createGltfMeshLoader`→`createGltfScenePopulator`→`bindAnatomyMetadata`，綁 `anatomyId` metadata→流入 picking／layers／highlight／labels）。glb 為 gitignored（大型二進位），載入／解析失敗時 `createGltfScenePopulatorWithFallback` 退回佔位 box（保 3D 恆有幾何、不空場景）。
- **Babylon 延遲載入**：3D 檢視器組裝件 `render/Model3DViewer.tsx` 以 `lazy(() => import(...))`＋`Suspense` 動態載入，`@babylonjs/loaders/glTF`、`WebGPUEngine`、`@babylonjs/gui` 等隨之落入 3D on-demand chunk；**主 chunk 不含 Babylon**。`ModelViewerPage`（eager route）不 import 載入器。
- **三處安全網 → `PageError`「不支援／載入失敗＋重試」**：
  1. 無 WebGL → `model3dUnsupported`＋重試（重新偵測）；
  2. FPS 降級到底＝精簡（不再退 2D）；
  3. 3D 子樹 `base/ErrorBoundary`（chunk 載入失敗／Babylon render 拋錯）→ `model3dLoadError`＋重試（bump key remount）。`ErrorBoundary` 為可重用原件。
- **個別骨拆分供細節**：原以 `sourceObjects` join 聚合之骨（顱骨、脊椎、肋骨、肋軟骨、胸骨、手、足）拆為個別骨（每骨各得三角面預算→細節大增），可獨立選取／標註／分側（沿用 partKey）；複合肌頭 join 維持（一肌一實體＝臨床正確）。拆分後左右同名個別骨之鏡像幾何經 glTF 匯出器去重為共用 mesh，故載入以 `createInstances:false`（`GLTF_IMPORT_OPTIONS`）令每 node 為獨立 `Mesh`（還原「每部位一 Mesh」假設，使 overlay 高亮／單側可見性一致）。

**SVG 抽取管線**（`export2dSvg.py`／`assets2d/`、§4.6.3 步驟 7）保留為**資產產生器**，與執行期檢視器分立。

## 4.3 3D 版

### 4.3.1 算圖與資產載入

- 以 **Babylon.js** 在瀏覽器中算圖，**WebGPU 優先、WebGL2 後備**。
- 3D 資產為 **glTF／GLB**，自 **CDN** 載入；幾何以 Draco／meshopt 壓縮、紋理以 KTX2（Basis）壓縮，縮短載入。
- 載入時依裝置能力選擇 LOD 資產（見 4.3.4）。

engine 建立分「決策層（純函式、注入式相依、可測）」與「元件接線」：`render/engineFactory.ts` 之 `createPreferredEngine(canvas, deps?)` 先以 `WebGPUEngine.IsSupportedAsync` 偵測，支援即建 WebGPU engine；不支援或 WebGPU 偵測／初始化任一步驟拋錯，皆退回 WebGL2（不阻斷算圖）。engine 共同基底為 `AbstractEngine`。`Model3DView` 建場景 effect 以 engine 為 `Promise` 與否分流（同步 WebGL2／非同步 WebGPU，後者以 `cancelled` 守衛卸載後才 resolve 之 late engine）。

### 4.3.2 視角與檢視

- 可自由**旋轉視角**、平移、縮放（操作對應見 [03_ui_ux.md](03_ui_ux.md)，以 Pointer Events 統一觸控與滑鼠）；**縮放設拉進/拉遠極限**（避免過度拉進穿入模型而顯示背面），**移動/轉動無慣性**（放開即停）。
- 提供前／後／左／右預設視角與重置（Babylon `ArcRotateCamera`，控制列 `render/Model3DControls.tsx`）。

**相機參數**（`sceneCore.addDefaultCamera`／`sceneCamera.ts`）：縮放半徑下／上限以包圍盒框取半徑為基準；`inertia=0`／`panningInertia=0`（放開即停）；`angularSensibilityX/Y=125`（旋轉靈敏）；`wheelDeltaPercentage`／`pinchDeltaPercentage`＝縮放步進∝當前 radius（近小遠大、平滑無斷崖）。視角切換（含重選目前鍵）與重置皆遞增 `viewNonce` 強制重套 `applyCameraView`（抵銷使用者環繞／縮放／平移）。

**自適應框取**（`render/sceneCameraFraming.ts`，框架無關純函式）：`computeFraming(extents, { aspect, fov, fillFraction, yBand })` 以包圍盒求 target／radius，`DEFAULT_FILL_FRACTION=0.70`（頭頂投影至畫布 ~85%、腳底 ~15%、置中）；`computeRadiusLimits` 給可深縮放至細節之下限與防飛離之上限。`Model3DView` 填充完成後以 `scene.getWorldExtends()` 算 extents、`buildCameraFraming`（讀 `camera.fov`、engine 算 aspect）套至視角；無有效包圍盒（佔位前）則後備固定 preset。

**部位視角**（region）與**方向**（direction）為正交可組合軸：方向決定環繞角（alpha/beta），部位決定取景 Y 區段。`CAMERA_REGION_KEYS=['whole','head','chestAbdomen','hipLegs']`、`REGION_Y_BANDS`（0＝腳底、1＝頭頂、連續覆蓋）；水平半徑取**部位段**水平範圍（`horizontalExtentInBand`），避免窄部位於窄直式螢幕受全身肩臀寬牽制而拉太遠。控制列以部位分段（全身／頭部／胸腹／臀腿）與方向分段並列。

**resize 重新取景**：`Model3DView` resize 處理器於 `engine.resize()` 後以新 aspect re-fit（`applyCameraFraming` 只套 target/radius/半徑上下限/minZ、**不動 alpha/beta**，保留旋轉）；以**寬度守衛**（`lastFitWidth`）僅當算繪寬度改變才 re-fit——行動瀏覽器網址列顯隱僅高度變→不動相機（保留使用者縮放／平移）、方位／版面變更→以新 aspect re-fit。`sceneCamera.ts` 僅 type-only import Babylon（主 chunk 維持 Babylon-free）。

> 版面：`Model3DViewer` 主區恆渲資訊卡預留位（`.model3dCardSlot`，`min-height` 預留典型卡片高度）使選取／取消總高穩定；窄版上下堆疊（`data-layout='standard'`）3D 畫布加高（`min-height`）。

### 4.3.3 關節活動與 ROM 限制

> 工作規格：
> - [doc/design/specs/2026-06-18-motion-mode-design.md](specs/2026-06-18-motion-mode-design.md)（運動模式總覽）
> - [doc/design/specs/2026-06-18-motion-drag-handles-design.md](specs/2026-06-18-motion-drag-handles-design.md)（on-model 拖曳手柄）
> - [doc/design/specs/2026-06-19-motion-per-side-design.md](specs/2026-06-19-motion-per-side-design.md)（左右側別獨立控制）

#### 現役實作：剛性節段旋轉（v1）+ on-model 拖曳手柄

現役 3D 資產**無骨架（0 skins）**，無法使用骨架 rig 驅動。採**剛性節段旋轉**：將人體拆分為節段樹，每個節段對應一組 Babylon `TransformNode`（樞紐），運動模式下驅動旋轉，運動學邏輯位於 `app/utils/humanModel/motion/`。

**互動流程**：

1. 使用者開啟**運動模式（motion mode）**開關，顯示器進入可動狀態。
2. 運動模式下可透過兩種方式驅動關節：
   - **滑桿**：各關節依其 `degreesOfFreedom` 展開對應滑桿（屈／伸、外展／內收、旋轉等）。
   - **on-model 拖曳手柄**（現役）：點選身體部位選擇其控制關節；關節樞紐現自訂**弧形手柄**（逐 DOF 一弧），以**grab-and-turn** 拖曳驅動旋轉（指標投影至旋轉平面、掃掠角判定）。
3. 旋轉角度由 `clampAngle` 鉗制於 ROM `min`／`max` 內；達到極限時弧轉**琥珀色**並顯**文字說明**（§3.6，非僅顏色）。
4. **雙向同步**：滑桿與 on-model 手柄驅動同一 `pose` 源，互相同步；拖曳手柄時相機自動 detach，避免誤觸模型環繞。
5. **左右側別獨立**：雙側關節（肩／髖／膝／踝）左右各自獨立保持角度（供觀察不對稱）。`pose` 以**節段鍵** `poseKey(jointId, side)` 儲存（雙側 `jointId#L`／`#R`、單側裸 `jointId`）；面板顯**左/右切換鈕**（僅雙側關節）、點 3D 肢體亦切換該側；單側關節（脊椎／頸椎）無側別。
6. **左右鏡像 ROM**：額狀／橫狀面軸（外展內收／內翻外翻／內外旋）左右活動範圍鏡像對稱；definitions 存右側值，左側經 `jointDofForSide` 取 `[-max, -min]`。矢狀面（屈伸／蹠背屈）左右同向不鏡像。

**v1 覆蓋範圍（SFMA 臨床優先 6 關節）**：

| 關節 | 單樞紐近似 | on-model 手柄 |
| --- | --- | --- |
| 頸椎（cervicalSpine） | 是（多椎以單樞紐近似） | ✓（現役） |
| 肩（shoulder） | 否 | ✓（現役） |
| 脊椎（thoracicLumbarSpine） | 是（多椎以單樞紐近似） | ✓（現役） |
| 髖（hip） | 否 | ✓（現役） |
| 膝（knee） | 否 | ✓（現役） |
| 踝（ankle） | 否 | ✓（現役） |

ROM 以**資料定義**（每個關節一筆，見 [06_data_model.md](06_data_model.md) 的 `joint`），便於依文獻調整與本地化；種子 ROM 值為教科書佔位，發布前須 PT 審閱（見 §4.6.4）。

> **待**（以下為後續軌）：
> - **軸／sign 實機目視校正**：各 DOF 旋轉軸方向與正負號待真實資產上目視驗證。rigid 路已校正：肩（盂肱）與髖之 flexionExtension sign＝-1（屈曲＝往前、伸展＝往後）。**bone-path 下肢已校正（2026-06-20）**：自出貨 glb node rest 解析推導 `localAxis = R_rest⁻¹·W`（W＝解剖世界軸）＋ Blender contact sheet 目視確認 sign（`boneRigMap.ts` 髖／膝／踝 6 DOF；修正＝髖內外旋 sign、踝背蹠屈 sign、踝內外翻**斜軸** `[0,0.884,-0.4675]`＋sign）。**bone-path 全身已校正（2026-06-20）**：下肢髖/膝/踝＋上肢肩（盂肱，rest 斜且左右鏡像不對稱→per-side `localAxisLeft`）＋軀幹脊椎/頸椎（FE 世界 X、側屈/旋轉因骨前傾為斜軸；+ROM＝右側屈/左旋/內旋，使用者確認）。見 [bone-path 軸/sign 校正 spec](specs/2026-06-20-bone-path-axis-calibration-design.md)。rigid fallback（`JOINT_KINEMATICS` worldAxis/sign）已同步校正值（2026-06-21；4 sign 翻正：髖/肩外展、踝背蹠屈、踝內外翻）。**此表並供 gizmo arc 方位＋拖曳方向**，故剛性／bone 兩路之 gizmo 與肢體運動方向一致。
> - **髕骨綁定（髕股關節）**：髕骨追蹤股骨滑車溝、非隨脛骨，rig 歸大腿段（`SEGMENT_BONES` 將 `bone.patella` 置 joint.hip／綁 femur 骨），膝屈曲時留股骨前而非隨小腿後盪（2026-06-20；Blender 質心驗證：膝屈 120° 髕骨位移 0.000m〔脛骨 0.114m〕、髖屈 60° 隨大腿 0.221m）。仍為剛綁（未含遠端滑移/傾轉，後續可加角度驅動細化）。
> - **球窩關節旋轉中心（髖/肩）**：旋轉中心＝股骨/肱骨近端**球頭之球心**（`rigSkin._fit_ball_center` 最小二乘球面擬合、迭代去骨幹/粗隆汙染），非 AABB 頂面中心（後者偏上外、致旋轉時球頭擺動脫位）。實證：新樞紐＝球心誤差 <1.5mm、旋轉時球頭定座於關節窩（髖髖臼／肩盂；2026-06-20）。膝/踝鉸鏈樞紐沿用節段骨頂面 anchor。
> - **其餘關節**：肘、腕、指、趾、顳顎關節、胸廓等（目前僅 6 SFMA 關節）
> - **肌肉收縮／伸展著色**（§4.3.4）：關節角推算肌長變化並以 Node Material 顯示
> - **skin 變形（執行期驅動已實作、ship-dark）**：`rigController` 依資產能力選路——載入**帶真骨架**的 GLB 時走骨骼驅動（`boneRig`／`BONE_RIG_MAP`，bone 區域旋轉＋GPU 蒙皮軟變形）、無骨架（現役出貨）走剛性節段 fallback；兩者共用同一 `pose` seam、下游零改動。待：真資產 bone 名與 bone-local 軸/正負之**實機目視校正**、skinned 路徑 gizmo 拖曳手感 on-device 驗證（**擺位已啟用**：`boneRig.getPivot` 回關節中心 TransformNode〔bone head＝球窩關節球心〕、identity 旋轉使 arc 對映世界平面、每次 applyPose 後隨 FK 更新；arc/drag 與剛性路共用）、平滑多椎脊椎、**資產管線綁骨＋蒙皮匯出**（§4.6.3 步驟 3–4，**已實作**：`rigSkin.py`＋exportGltf 整合，產出 rigged `anatomyV1.glb`〔163-bone MakeHuman 骨架、全身剛性綁＋skins、跨關節肌位置漸變蒙皮、structural 驗證通過〕；待 on-device 視覺驗證＋部署）。見 [skin 變形執行期驅動 spec](specs/2026-06-19-skin-deformation-runtime-design.md)、[全身 rig+skin 管線 spec](specs/2026-06-19-fullbody-rig-skin-pipeline-design.md)。
> - **平滑多椎脊椎**：脊椎／頸椎逐椎獨立旋轉（取代單樞紐近似）

### 4.3.4 肌肉收縮／伸展色彩

- 關節活動時，相關肌群依其狀態以**顏色顯示收縮與伸展**。
- 建議色彩映射：發散色階，收縮趨向暖色（紅）、伸展趨向冷色（藍），中性為基準色；強度對應長度變化量。
- 實作：由關節角度（運動模式 pose，§4.3.3；現役無骨架）推算各肌肉長度變化，驅動 **Babylon Node Material** 的材質參數（取代 Unity Shader Graph）。
- 每條肌肉與其跨越的關節、作用（屈／伸／旋等）以資料關聯（見 `muscle` 與 `joint`），使色彩由資料推導而非寫死。
- **著色由資料推導、非量測變形後 mesh**：以關節角相對 `neutral` 的變化 × `actions` 屈／伸／旋計算長度變化純量。正因著色與 mesh 是否軟變形無關，§4.3.3 的**剛性綁定才在視覺上可接受**（剛性肌不軟變形也不影響顏色正確性）。

**現役：頂點色著色**（§4.3.3 同管道）——運動模式擺動關節時，相關肌群依 `muscleContractionScalar`
（pose × `muscle.actions`）以**頂點色**（`VertexBuffer.ColorKind`、乘於 albedo）發散著色：收縮暖
（`#D94A2A`）、伸展冷（`#2F6FB0`）、中性＝白（不變），染色強度 ∝ |純量|（lerp 白→暖/冷、上限 0.8）。
**頂點色為 attribute、於 GPU skin/morph 變形之後內插 → skinning-safe**（取代舊 `renderOverlay` outline
shell：其以 rest-pose 殼繪、與 skinned 變形面 z-fighting 致表面雜訊；2026-06-20 修）。運動模式內
**獨立開關**（預設開）；著色開時為**唯一 overlay 權威**（`applyOverlays` 暫停選取/標註高亮、先
`clearMuscleShading` 還原頂點色，運動模式以 gizmo 表達選取關節）。非色彩通道（§3.6）：
MotionControls 顯暖↔冷色階**圖例** ＋「選取關節相關肌群」逐肌**文字態**（收縮/伸展/中性＋量值）。

- **方向明確成對軸**（屈伸/外展內收/內外旋/蹠背屈/內外翻）；複合軸名第一動作為正向。
- **左側鏡像翻轉**：鏡像軸（外展內收/內翻外翻/內外旋）左側收縮方向翻轉，與 `jointDofForSide` 一致。
- **側屈同側收縮**：`lateralFlexion`（軀幹/頸，成對肌）由**肌之側別**定方向（`IPSILATERAL_SIDE_AXES`）——關節向 S 側屈時 S 側肌收縮、對側伸展（+ROM 側屈＝右 → #R 收縮）。`rotation` 因同側/對側**因肌而異**（外腹斜對側、內腹斜同側、多裂肌/迴旋肌對側…）、資料 action 僅單名未載方向 → **不著色**。
- **對未校正世界 sign 免疫**：著色與 rig 讀同一 pose，主動肌縮/拮抗肌伸關係恆成立。

> **待（後續軌）**：Node Material 發散材質（更細緻漸層）；`rotation` 軸著色（待 per-muscle
> 同側/對側方向資料）；肌肉實際長度量測。工作規格：[2026-06-19-muscle-shading-design.md](specs/2026-06-19-muscle-shading-design.md)。

### 4.3.5 LOD：精簡版與完整版

> 目的：每個裝置運算能力不同，需可分級呈現；在 Web 上同時節省**下載頻寬**。

執行期 LOD 階層為 `LOD_TIERS=['full','simplified']`（精細／detailed 執行期階層與 twoD 階層已移除）。手動覆寫選項 `LOD_OVERRIDES=['auto','simplified','full']`。

| 版本 | 內容 | 適用 |
| --- | --- | --- |
| 精簡（simplified） | 現役主要呈現；載入標準資產 glb（`anatomyV1.glb`） | 預設、低階裝置／弱網路 |
| 完整（full） | **未壓縮（無 Draco）、未減面之原始模型（無損）** | **手動 opt-in**：最高畫質、**無視預算**；首載大流量故切換時跳流量確認 |

- **切換機制**：
  - 載入時**依裝置能力選資產**：以 GPU 分級啟發式、`navigator.deviceMemory`、WebGL/WebGPU 能力判斷。`resolveLodTier` 之 `auto`（任何能力）→ `simplified`。
  - 執行期**監測 FPS**，過低時動態降級（切換已載入的較低 LOD）。降級底為 `simplified`（不再退 2D）。
  - 使用者可於設定中**手動覆寫**（自動／精簡／完整）。
- **GPU 分級啟發式**（`lod/gpuTier.ts` `classifyGpuTier`）：軟體算繪 renderer→0；明確旗艦→3；明確入門→1；否則以記憶體＋核心數推估；信號不足→undefined（保守預設精簡）。`deviceCapability` 以 `WEBGL_debug_renderer_info`／`hardwareConcurrency` 三信號呼之填 `gpuTier`。準確度待實機校正，§4.3.6 FPS 自動降級為執行期校正網。
- **完整版（手動 opt-in、無視預算）**：載入未壓縮、未減面之原始模型（無損）；**`auto` 絕不自動選**（體積巨大，實測 37.7 MB），僅使用者明選且 WebGL 可用時解析至 `full`。切換至完整前以**確認對話框**（`useFullLodConfirm`／`FullLodConfirmDialog`，設定頁與檢視器內兩切換點皆攔截）警示大型下載／行動數據（可取消）；FPS 過低時自動降級退至精簡（`full → 精簡`）。
- **資產對應**（`render/modelAsset.ts`）：`resolveModelAssetUrl(tier)`——`full` → `/models/anatomyV1.full.glb`（無損）、其餘 → `/models/anatomyV1.glb`（標準資產）。`anatomyScenePopulatorFor(url)` 每-url memo（同 url 回穩定相同參考、相異 url 回相異填充器）。
- **實作**：精簡與完整共用同一骨架與解剖實體 ID，僅 mesh／材質不同。LOD 架構（`lodTier`／`resolveLodTier`／`degradeLodTier`、設定 `lodMode`、`Model3DControls` LOD 三段）完整保留。

> **單一資產現況**：細節版/精簡版雙 export profile 已收斂為單一標準資產（`anatomyV1.glb`）；原過度簡化之精簡版資產（肌群合併＋激進減面）失逐肌選取與臨床可辨識度〔使用者回報〕已刪。`simplified` 執行期 tier 載此標準資產。未來如需再分版，於 manifest 加 `profiles` 旗標＋新增 `MODEL_ASSET_URLS` 條目即可。

> **離線快取**：SW 精快取（`pwa/precacheGlobs.ts`）**只收 App 殼層**（進入點 `index-*.js`、`workbox-window*.js`、`css/html/svg/png/woff2`），不以 `**/*.js` 廣納，使 Babylon chunk 於切 3D 時才 on-demand 載入（單檔 >2 MiB 超 workbox precache 上限）。全離線 3D 由 **runtime 快取**（`pwa/runtimeCaching.ts`，三條 CacheFirst：`/models/*.glb`、`/draco/*`、`assets/*.js` lazy chunk，皆 expiration＋`cacheableResponse {0,200}`）補：使用者開過一次 3D 後其資產入快取、之後可離線重看。runtime 快取僅比對靜態資產、不快取個資（隱私不變，§8.7）。runtime 快取由 SW 實作，於 iOS http 區網非安全環境失效（見 [[ios-lan-nonsecure-context]]），實際離線行為待 production https／localhost 端到端驗。

### 4.3.6 效能預算（初版，實測後調整）

> 以下為資產製作與最佳化的**初版預算**，供 LOD 資產製作有具體規格可循；實機跑起來後依量測調整。

- **目標幀率：30 fps**（所有支援裝置的底線；桌面與高階行動裝置以 60 fps 為理想值）。
- 量測基準裝置（建議）：低階＝約 3–4 年前中階 Android／iPhone SE 等級；高階＝近兩年旗艦手機或桌面獨立顯卡。

下表為**標準資產 export profile** 之預算（與執行期 LOD 階層分立；細節版/精簡版雙 profile 已收斂為單一標準 profile）：

| 預算項目 | 標準資產 |
| --- | --- |
| 總三角形數 | ≤ 5,000k |
| Draw calls | ≤ 200 |
| 紋理解析度 | ≤ 2048²（KTX2） |
| 資產下載量（壓縮後） | ≤ 50 MB |
| GPU 記憶體佔用 | ≤ 768 MB |
| 骨架 | 共用同一骨架（≤ 120 bones） |

- 總三角形上限 **5,000k**（自初版 900k 上調以留寬裕 headroom 免內容軌續撞牆；由 `verifyModelBudget.mjs` 稽核 `anatomyV1.glb`，現役 Draco 後約 8 MB）。
- **製作面**：標準資產逐肌肉獨立 mesh（支援單一肌肉選取、隱藏與著色；選取粒度為肌肉）。per-entity 減面上限（`entity.maxTriangles`，cap 取 `min(全域, layerCap, entity.maxTriangles)`）為可重用機制，粗聚合件單件壓緊、不傷同 layer 他件。
- **降級規則**：FPS 低於 25 持續 5 秒 → 自動降一級（**完整 → 精簡**；精簡為最低、不再退 2D），介面提示目前等級（`role="status"`，i18n `modelLodAutoDegraded`）；使用者可於設定覆寫。FPS 取樣 `lod/useFpsAutoDegrade.ts` 以 `scene.onAfterRenderObservable` 回報 `engine.getFps()`。門檻 25fps/5000ms 為工程啟發值，待實機校正。
- **完整版（無損）豁免預算**：`full` 為手動 opt-in 之未壓縮未減面原始模型，**不受上表預算約束**（「無視預算」即其定義）；`verifyModelBudget.mjs` 不對其稽核。
- **預算稽核**：`infra/asset-pipeline/verifyModelBudget.mjs`（純 node 解析 GLB JSON chunk→逐 mesh-node 累計三角面、依 manifest 彙整 per-layer、核對本表）於匯出後執行＋自核。

> **待（軟體軌）**：現役標準 glb 之 draw-call（逐件 node）大於 ≤200，屬逐肌選取粒度之固有張力，倚 FPS 自動降級退為安全網。

## 4.4 標籤系統

- 每個解剖實體具中／英名稱（zh-TW 預設，見 [07_dev_conventions.md](07_dev_conventions.md)）。
- 標籤可全域開關，亦可僅顯示目前選取／目前分層的標籤，避免畫面雜亂。
- 以 Babylon GUI（`AdvancedDynamicTexture`）呈現，標籤位置跟隨 3D 部位。

**決策層**（`render/sceneLabels.ts`，框架無關、可測、2D／3D 單一決策來源）：`LABEL_MODES=['all','selected']`、`DEFAULT_LABEL_MODE='selected'`（預設僅顯目前選取，避免雜亂）；`resolveVisibleLabels({entities,visibility,hiddenIds,selectedId,showLabels,mode})→LabelModel[]`——全域 `showLabels=false`→空；否則僅「分層可見且未被單一隱藏」之部位（規則與 `applyMeshVisibility` 一致）；`mode='selected'` 再縮至 `selectedId`；text＝`resolveLocalized(entity.name)`（zh-TW 預設、en 回退）。selected 模式以 `parsePartKey(selectedId).anatomyId` 比對（涵蓋雙側 partKey）。

**GUI 綁定**（`render/labelLayer.ts`）：`createLabelLayer(scene, readCssVar)`＝`AdvancedDynamicTexture.CreateFullscreenUI` 全螢幕疊層，`sync(labels)` 差異更新（`Rectangle`＋`TextBlock`，`linkWithMesh`（以 metadata.anatomyId 尋 mesh、涵蓋 `#L/#R` 名）跟隨部位、`isHitTestVisible=false` 不攔點選）；`dispose()` 釋放 texture。**樣式 token 驅動**（`render/labelStyle.ts`）：以 `getComputedStyle` 讀 `--color-text`／`--color-surface`／`--color-border`（各有後備），深淺色自動適配（樣式於建層時讀一次，session 中切換主題以重開 3D 更新）。

**接線**：`Model3DView` 加 `showLabels`（預設 true）／`labelMode`（預設 'all'）／`labelLayerFactory`（測試注入脫鉤）；標籤同步獨立 effect、惰性建層、非同步填充補套。`Model3DControls` 提供標籤開關 `Switch`（i18n `modelShowLabels`）與全部／僅選取 `SegmentedControl`（i18n `modelLabelMode{Label,All,Selected}`，標籤開時才顯）；`ModelViewerContent` 持 `showLabels`／`labelMode` state，`handleResetView` 復原（收起標籤、labelMode 回預設）。

## 4.5 與評估的連動

- 在模型上選取部位後，可將其關聯到目前評估紀錄，形成 `bodyAnnotation`（部位 + 評估發現 + 備註）。
- 反向：開啟某筆評估紀錄時，模型可高亮其標註過的部位，重現當時的說明，支援追蹤與衛教。

**反向高亮**（`render/sceneHighlight.ts`）：以 Babylon **mesh overlay**（`renderOverlay`＋`overlayColor`／`overlayAlpha`）呈現，著色語意（對齊 tokens 臨床色）——**painful→red-clinical `#c0392b`、dysfunctional→amber-clinical `#b26a00`、note→slate-500 `#64748b`**；選取＝accent teal-700 `#0e7490`（teal 色調，見 03 §3.7.2）。`applyHighlights(scene, selectedAnatomyId, highlights?)` 逐 mesh 以 partKey 比對：選取→accent；否則標註命中→finding 色；否則清除 overlay。每 mesh 僅一 overlayColor，故**選取優先於標註著色**。`Model3DViewer` 需傳 `selectedKey`（成對部位高亮的接線）。highlights 由 `anatomyHighlight.annotationHighlights(session.bodyAnnotations)` 推導（同部位多筆取最高嚴重度，疼痛優先，06 §6.3）。

**非色彩通道**（§3.6）：頁面層恆存之 `BodyAnnotationList`（列每筆標註之部位名＋findingType 文字標籤）為文字通道，使標註資訊不僅靠顏色傳達。

**deep-link**：反向高亮之 session 採選填 query `?session=<sessionId>`（per-patient route `/patients/:patientId/model`，§3.3.4）；`ModelViewerPage` 以 `useAssessmentSession` 同時供反向高亮與正向寫入（單一來源、新增標註即時重新高亮）。finding→模型以選填 `?pattern=<patternKey>`（合法 `sfmaPatterns` key）作新增標註之關聯動作預設；marker→finding 反向以 `BodyAnnotationList` 每列「回到評估發現」`Link` 跳回 `/patients/:patientId/assessments/:sessionId?pattern=...`（與正向對稱）。

**正向連動**（模型→評估，§3.3.8）：選取部位於 `AnatomyInfoCard`「加入評估標註」→ `BodyAnnotationDialog`（Radix `Dialog`）包 `BodyAnnotationForm`（findingType `SegmentedControl`／關聯 SFMA 動作 `Select`／備註 `Input`）→ 送出以 `newBodyAnnotation(createUuid(), anatomyId, side, draft…)`＋`upsertAnnotation` 樂觀落盤；選取「已標註」部位進編輯模式（既有值預填、沿用既有 `annotationId` 覆蓋、提供「移除標註」走 `removeAnnotation`）。`BodyAnnotationList` 逐筆呈現某評估全部標註，支援跳至部位／快速移除。

> **待**：§3.3.8 完整雙向整合中之 3D on-marker 點擊（逐 marker 跳回 finding）仍為後續。

## 4.6 圖資來源與製作

> **設計轉向**：原訂「自行製作以免除授權限制」，經評估以現有製作量能（程序化／AI 輔助為主、手工補縫隙）從零自製完整分層解剖並不切實際。改採**現成開源分層解剖資源為主體**，以 Blender ＋ bpy 腳本程序化加工為 APP 資產，並以穩定的 `anatomyId` 邊界隔離資產、保留日後抽換退路（換自製或買斷資產時程式與資料零改動）。

### 4.6.1 來源資產與授權

| 角色 | 資產 | 授權 | 用途 |
| --- | --- | --- | --- |
| 主體 | Z-Anatomy | CC BY-SA 4.0 | 分層解剖 mesh（骨骼／肌肉／血管／神經／內臟）；上游為 BodyParts3D |
| 骨架 rig | MakeHuman | 匯出模型 CC0 | 提供骨架（≤120 bones）與蒙皮權重來源；皮膚 mesh **不入正式資產**，僅作比例外殼與權重來源 |
| 佔位 | 簡化幾何（自製） | 專案自有 | 開發期佔位，正式資產同名抽換 |

**授權立場（決策）**：接受 CC BY-SA，併入發布前授權閘門控管。

- **相同方式分享只及於 mesh**：僅**解剖資產檔**（及其減面／綁骨改作）帶 CC BY-SA 4.0；APP 程式碼不受影響（Creative Commons 不建議將 CC BY-SA 用於軟體，且 ShareAlike 只及於改作、不及於僅顯示資產的程式）。**MakeHuman 骨架為 CC0、不帶 copyleft**，故 copyleft 僅源於 Z-Anatomy 解剖 mesh。
- **允許商業使用**：CC BY-SA 不禁止商業化；義務為 (a) **標示來源**（APP credits／about 畫面，含 BodyParts3D 指定標示字串）、(b) **資產維持開放**（他人可合法抽用）。本 APP 護城河為 SFMA 評估流程與 UX，非肌肉網格，故 (b) 成本低。
- **併入既有閘門**：與 SFMA 授權（見 [05_assessment.md](05_assessment.md) §5.6）同列「對外發布／商業化前確認」關卡；非新增獨立阻擋。開發期單機本地、無散布，幾近零風險。
- **版本策略**：以 **Z-Anatomy 4.0 為單一上游授權版本**，避免混用 BodyParts3D 2.1-JP。

> 授權事實來源：[Z-Anatomy](https://www.z-anatomy.com/)（CC BY-SA 4.0、分層）、[BodyParts3D 內容授權](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D/blob/main/LICENSE_content)（CC BY-SA 2.1 JP、FMA 命名）、[MakeHuman 授權說明](http://www.makehumancommunity.org/content/license_explanation.html)（匯出模型 CC0）。

### 4.6.2 anatomyId 與 FMA crosswalk（抽換邊界）

- App 對外識別維持既有**語意式 `anatomyId`**（`muscle.bicepsBrachii`…；見 [06_data_model.md](06_data_model.md) 6.5）— 可讀、與資產來源脫鉤。
- **來源命名**：實際 Z-Anatomy 4.0 `.blend` 以**可讀英文解剖名**命名（如 `Biceps brachii`、`Radius`），非 FMA-ID；名稱帶後綴：`.l`／`.r`（左／右側）、`.ol`／`.or`（變體）、`.j`（幾何物件）、`.t`（文字標籤 FONT 物件，不入 glTF）。管線將**來源英文名→語意式 `anatomyId`** 正規化，維護 **來源名 ↔ anatomyId 對照表（crosswalk）**；FMA-ID 為**選填**追溯欄（初版可略）。
- glTF node 名、2D SVG 圖層 id 皆＝語意式 `anatomyId`，渲染、選取、標籤、肌肉著色皆以此對應；自訂部位照給語意式 `anatomyId`、於 crosswalk 標 custom。
- **雙側（bilateral）side 綁定**：anatomyId 側別無關；側別（left／right）為臨床 `side` 欄。`manifestV1.json` 以成對分組明確 `side` 欄為來源真相，`exportGltf.py` 依之出 `#L/#R` 節點（兩側名相異），`gltfBinding` 解析還原 anatomyId＋side（成對部位左右各為一 mesh、獨立 picking／layers／highlight）。
- **功能性關節為運動學實體、非來源 mesh**：App 之 `joint` 實體（帶 ROM／`degreesOfFreedom`，如 `joint.elbow`）為**運動學構念**，由骨架關節推導（§4.3.3），**無對應單一來源 mesh**。實檔 Z-Anatomy「Joints」collection 多為**結構性韌帶／關節囊**，屬選配顯示幾何、與功能性關節分離；命名正規化以 `custom` 標記功能性關節。
- **抽換保證**：日後換自製或買斷資產，只要維持相同 `anatomyId` 命名（並更新 crosswalk），程式與 runtime 資料零改動 — 此即授權隔離點。

### 4.6.3 製作管線（Blender ＋ bpy 腳本）

中樞為 Blender（Z-Anatomy 原生）；「腳本」步驟為確定性 bpy 自動化（程序化落點），「人工＋AI」步驟需人工判斷／AI 輔助清理。

| # | 步驟 | 性質 |
| --- | --- | --- |
| 1 | 匯入彙整：自 Z-Anatomy `.blend`（已分層為 collections）起 | 人工 |
| 2 | 命名正規化：來源英文解剖名（去 `.l/.r/.j` 等後綴）→語意式 `anatomyId`、抽名稱表 → crosswalk＋`anatomyId↔名稱↔分層` manifest（分層由頂層 collection 推定） | 腳本 |
| 3 | 綁骨：MakeHuman 預設骨架（163 bones、CC0；`makehuman-default-skeleton.json` headless 自開源 `.mhskel`＋`base.obj` 重建）→ Umeyama 全域擬合＋受驅動骨 per-joint snap 對位 z-anatomy（`rigSkin.build_aligned_armature`） | 腳本 |
| 4 | 綁定：成員驅動綁至節段骨（`rigSkin.bind_meshes`，重用 `jointKinematics` 成員）。**僅 `bone.`／`muscle.` 入 rig**；被動結構（韌帶/關節囊/椎間盤/滑囊/筋膜/盂唇…）／神經／血管／臟器**不入旋轉變形、靜態匯出**。**跨關節肌位置漸變蒙皮已實作**（`crossJointBlend` 橋接：biarticular＋override 跨子節段者，於子關節 anchor 沿 proximal→distal 軸於兩骨間混合，42 mesh），其餘剛性綁。**雙側 mesh 綁定前單一化 datablock**（`o.data.users>1→copy`）：避免共享資料致一側骨/肌 mesh 串綁對側骨〔如 tibia#R 同時綁 lowerleg01.R＋.L〕、單側旋轉時夾於左右骨間塌陷脫離（2026-06-21 修） | 腳本 |
| 5 | 減面：逐肌肉 mesh ＋ decimate（標準資產 export profile）；**減面為必經** | 腳本 |
| 6 | 匯出：glTF／GLB，Draco＋（必要時）KTX2；node 名＝`anatomyId` | 腳本 |
| 7 | 2D 抽取：固定正交視角（正／側／背）逐層輸出輪廓→SVG；圖層 id＝`anatomyId`（**資產產生器，與執行期檢視器分立**） | 腳本 |
| 8 | manifest→definitions：ID／名稱／分層 ＋ 關節 ROM ＋ 肌肉 `relatedJoints`／`actions` 組為 definitions JSON（見 [06_data_model.md](06_data_model.md) 6.5） | 腳本 |

步驟 3–4 已腳本化（`rigSkin.py`，headless 可重複；`blender.exe -b z-anatomy.blend -P exportGltf.py -- manifest out standard skeleton.json membership.json` 一次產出 rigged glb；跨關節肌位置漸變蒙皮含於內）。剩餘工時/風險：真實 rig 之**軸/sign 實機校正**（§4.3.3）、**減面品質**（Z-Anatomy 研究級高面數）、rigged 資產 **on-device 視覺驗證＋部署**。**跨關節肌（軟蒙皮）清單**屬管線編寫資料、不入 runtime 實體；初版保守、視 QA 擴充。

**極限屈曲 corrective shape keys**（[spec](specs/2026-06-20-corrective-shape-keys-design.md)）：下肢跨關節肌於極限屈曲（≳120°，尤膝 140°）之 LBS candy-wrapper 塌陷，以 **procedural 生成之 corrective morph** 修正、**保完整臨床 ROM（不封頂）**。`rigSkin.add_corrective_shapekeys`（bind 後）於子關節屈曲 θ_ref 處，取「保體積目標」（兩骨四元數混合旋轉）與 LBS 之 posed 差 ΔP、以穩定 `qb⁻¹` 轉回 rest 位移（**避免 `M_blend⁻¹` 於大角度近奇異而爆裂尖刺**）＋clamp，存為 shape key `corr.<distal jointId>`（僅過渡帶頂點、`|delta|<ε` 稀疏化）。`exportGltf` `export_morph` 帶出為 glTF morph targets；**須於 bind/corrective 前 bake(apply) decimate**——否則 `export_apply` 無法對帶 shape key 之 mesh 套 DECIMATE → corrective 於匯出被丟棄。runtime `motion/morphTargetController.ts` 於 `Model3DView` watcher 隨 pose 變更設 `influence = smoothstep(onset, ref, |角度|)`（膝/髖 `flexionExtension`、踝 `plantarDorsiflexion`；`onset=0.6·ref`、`ref` 自 definitions ROM）；morph 名 `corr.<jointId>` 為契約（Babylon 由 `extras.targetNames` 還原名）。**實際範圍＝膝＋踝**：corrective 以 biarticular 肌之「遠端(子)關節」為鍵，無肌以髖為遠端（髖恆為近端；純髖肌〔gluteus/iliopsoas〕單關節剛綁、無 blend band → 無 candy-wrapper），故**髖無此問題、不生 corrective**（controller 仍保留 `joint.hip` 映射、future-proof）。極限角度為**部分修正**（pre-skin morph 經退化 LBS 之先天上限）；中度角度塌陷由窄過渡帶（上節）已解決。Blender MCP 視覺驗證 140° 無尖刺、幾何連貫。

**來源實況**：來源 Z-Anatomy 4.0 約 7184 物件（MESH 4569／CURVE 951〔神經・血管・支氣管以曲線表示〕／FONT 1660〔`.t` 標籤〕…），總面數約 366 萬多邊形（遠超預算 → **減面為必經**，約 6×）、**無骨架**（rig 由 `doc/ref/models/makehuman-default-skeleton.json` 提供——MakeHuman 預設骨架 163 bones、CC0，headless 自開源 `.mhskel`＋`base.obj` 重建，無 MakeHuman app；步驟 3 對位之）。頂層 collection 即分層系統：`Skeletal system`（→bone）、`Muscular system`＋`Muscular insertions`（→muscle）、`Joints`（→joint）、`Nervous system & Sense organs`（→nerve）、`Cardiovascular system`（→vessel）、`Visceral systems`（→organ）等。FONT 標籤不入 glTF mesh；CURVE 之神經・血管轉 mesh（管狀）。

**共用解析**（`infra/asset-pipeline/pipelineCommon.py`，2D／3D 軌同 import 之同源同步根本保證）：`resolveSourceNames`（`sourceObjects` 優先）／`entityInProfile`（`profiles` 過濾；雙 profile 收斂後實體無 profiles 旗標、一律納入）／`deselectAll`（確定性 deselect、迭代 `view_layer.objects` 全集）／`joinObjects`（headless `temp_override` join）／`curveToMesh`（CURVE→管狀 mesh）。色彩材質、減面、匯出編排留在 `exportGltf.py`。

**步驟 5／6 機制**（`infra/asset-pipeline/exportGltf.py`）：

- **複合肌聚合 join**：多頭肌以多子頭分件存在，manifest entity 來源欄支援 `sourceObject`（單字串）或 `sourceObjects`（字串陣列，子頭群）；後者 join 聚合為單一物件後改名 anatomyId（一邏輯肌＝一可選 mesh）。headless `-b` 模式須 `temp_override` 顯式提供 context（否則 `bpy.ops.object.join` 靜默 no-op）。
- **神經 CURVE→管狀 mesh**：來源若 `type=='CURVE'`，套 manifest 選填 `curveBevel:{depth,resolution}` 後 `convert(target='MESH')` 轉實心管 mesh。
- **解剖分層基底著色**：manifest top-level `layerColors`（layer→sRGB hex）為每 layer 建扁平霧面材質（Principled BSDF、`srgbToLinear`），匯出前取代各物件材質槽（單材質／物件）。基底色＝**解剖辨識**（靜態、隨資產）；收縮／伸展與選取／標註高亮＝**狀態色**（執行期 overlay 疊加，§4.3.4／§4.5）。
- **減面（decimation）**：資料驅動每-mesh 三角面上限——manifest `decimation`（`maxTrianglesPerMesh`、`layerMaxTriangles`〔per-layer〕），逐物件取 `min` 諸 cap，超標者加 Blender `DECIMATE`（`COLLAPSE`、`ratio=cap/tris`）modifier、匯出時 bake；per-entity `maxTriangles` 為粗聚合件單件壓緊機制。開殼／多島嶼結構（肋軟骨、開殼關節囊、聚合韌帶）受 COLLAPSE 邊界保留限制有減面 floor、可能無法降至 cap。
- **profile 輸出**：`exportGltf.py` 選填第 3 引數 `profile`（`standard`〔預設〕｜`full`）擇輸出檔名（`anatomyV1.glb`／`anatomyV1.full.glb`）；`standard` 套 `decimation.maxTrianglesPerMesh`、`full` 無損不減面。細節版/精簡版雙 profile 已收斂為單一標準資產，實體不再帶 `profiles` 旗標、一律納入。
- **GLB Draco 壓縮**：`export_scene.gltf` 套 `export_draco_mesh_compression_enable`（level 6、position 14-bit 量化，解剖尺度視覺無損）。載入端 `render/dracoConfig.ts` `configureDracoDecoder()` 將 `DracoDecoder.DefaultConfiguration` 改指**自帶** `public/draco/`（`draco_decoder_gltf.wasm`＋`draco_wasm_wrapper_gltf.js`，同源 runtime 取用、離線可行），`gltfMeshLoader` 於載入前呼之。

**肌群合併（已退役）**：細節版/精簡版雙 profile 收斂為單一標準資產後，原精簡版肌群合併產生器（`buildMuscleGroups.mjs`／`buildBoneNerveGroups.mjs`）與其 `muscleGroup`／骨區域（`bone.upperLimb`…）／神經叢（`nerve.brachialPlexus`…）合併實體已自 manifest／definitions 移除、產生器腳本已刪。`muscleGroup` 型別保留於 schema 供未來重新分版；屆時以 `sourceObjects` join ＋ manifest `profiles` 旗標重新引入即可。

**2D 抽取**（步驟 7，`infra/asset-pipeline/export2dSvg.py`，**資產產生器**）：因本機 Blender 建置未含 Freestyle，改用**幾何輪廓投影**（zero GL/addon、headless 必成）——三方位正交相機（front −Y／side +X／back −Y、共用 ortho_scale 與 viewBox→疊合對齊）；逐 anatomyId 孤立，以 `world→camera` 投影＋掃描線柵格化覆蓋遮罩＋Moore-neighbor 邊界追蹤＋Douglas–Peucker 簡化，組裝 per-orientation SVG（`<g data-anatomy-id><path d>`、共用 viewBox、**色彩無關**）＋`anatomy2dManifest.json`（provenance：來源 manifest SHA-256）。共用 `pipelineCommon`，2D 不漂移出 3D。資產託管 `apps/web/public/assets2d/`（gitignored）。headless 眉角：設相機 `location`／`rotation_euler` 後須 `view_layer.update()` 才能讀正確 `matrix_world`。輸出為封閉填色剪影輪廓（忽略內孔、像素級精緻度待 QA）。

### 4.6.4 佔位資產、解剖審閱與一致性

- **開發用佔位資產**：正式圖資完成前，以簡化幾何製作**佔位模型**（涵蓋少量代表性部位即可），命名規則與正式版完全相同（node 對應 `anatomyId`），供功能先行開發與測試；正式資產完成後直接替換資產檔、程式碼不需改動。
- **解剖正確性**：圖資定版前由物理治療專業審閱（肌肉形狀、層次、神經走向），修正後再定版。
- 通用圖資非個資，可公開經 CDN 快取；個案相關資料的安全見 [08_security_privacy.md](08_security_privacy.md)。

**3D 載入回饋**：切至 3D 後真正等待為 GLB 下載期間；`Model3DView` 以選填 `onLoadingChange?(loading)` 回報二元載入態（建場景起 true、填充 promise finally false，成功與失敗〔退佔位身體亦 resolve〕皆視為結束），`Model3DViewer` 於 canvas 上顯 `role="status"` 載入疊層（i18n `modelLoading3d`、`pointer-events:none`）。

> **待（發布前 PT 審閱）**：種子解剖之 actions／innervation／ROM／名稱為教科書佔位值，發布前須由 PT 審閱定版（含韌帶／椎間盤／關節囊／關節盤／筋膜／滑囊／肌群／深層小肌等內容軌擴充項；release_checklist §4）。資訊卡精準貼近部位之定位、draw-call ≤60（軟體軌）待真實資產與後續切片。
