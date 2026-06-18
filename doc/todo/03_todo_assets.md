# 03 — Todo：解剖資料定義與自製圖資

> 階段：開發期｜來源設計：[04_human_model.md](../design/04_human_model.md) §4.6、§4.3.6、[06_data_model.md](../design/06_data_model.md) §6.5、[02_architecture.md](../design/02_architecture.md) §2.5｜前置：[01](01_todo_setup.md)（definitions 套件位置）

2D 與 3D 圖資以**開源資源加工**為主（Z-Anatomy 解剖 mesh ＋ MakeHuman 骨架，見 04 §4.6）。本檔含「資料定義」與「圖資製作」兩部分：資料定義先行，圖資依其命名製作。

## 解剖資料定義（packages/definitions）

- [ ] 解剖實體清單定版：涵蓋的肌肉／神經／骨骼／關節／韌帶／椎間盤範圍與 `anatomyId` 命名表（06 §6.5）⚠ 待 PT 審閱定版
- [ ] `muscle` 實體：`layer`（表／深）、`symmetry`、`relatedJoints`、`actions`、`innervation`、zh-TW／en 名稱
- [ ] `nerve`、`bone`、`ligament` 實體：型別與種子已建（ligament 歸 `passiveStructure` 分層、預設隱藏）；韌帶名稱屬 placeholder、⚠ 待 PT 審閱；副韌帶／距腓等退化件待來源改善重模
- [ ] `disc` 實體（椎間盤）：型別與全脊椎 23 節種子已建、歸 `passiveStructure`；名稱 placeholder、⚠ 待 PT 審閱；半月板過粗待源料改善
- [ ] `capsule` 實體（關節囊）：型別與 4 大關節囊種子已建、歸 `passiveStructure`；名稱 placeholder、⚠ 待 PT 審閱；橈腕／顳顎及肢端小關節囊開殼減面受邊界限，暫緩以守三角面預算
- [ ] `articularDisc` 實體（關節盤）：型別與顳顎關節盤種子已建（與 `disc` 椎間盤分立）、歸 `passiveStructure`；名稱 placeholder、⚠ 待 PT 審閱；半月板／盂唇等待源料改善後擴及
- [ ] 手足遠端骨架：`bone.hand`／`bone.foot` 已建（每側全手 27 骨／全足 26 骨）；後續逐件拆分見「完善 3D 模型」軌（見下匯出條目）
- [ ] 顳頂肌補齊頭皮肌群＋肌肉盤點：顳頂肌已補（顱頂肌／頭皮肌群完整）；其餘真缺深層小肌（interspinales／intertransversarii lumborum／levatores costarum／pyramidalis／transversus thoracis／adductor minimus）部分已補，餘待肌群合併騰出空間；name 待 PT 審閱
- [ ] 筋膜 fascia（第 9 型，04 §4.6.3）：型別與 14 件 curated 主要筋膜已建、歸 `passiveStructure`（標準資產納入）；餘 ~50 筋膜／腱膜／支持帶 demand-first 暫緩；name 待 PT 審閱
- [ ] 韌帶內容擴張 curated 主要韌帶：8 條高價值具名韌帶已補（標準資產納入）；經典膝／踝／肘側副韌帶源料未良模、待源料重模
- [ ] 滑囊 bursa（第 10 型）：型別與 8 件臨床要囊已建（標準資產納入）；餘 ~70 滑囊 demand-first 暫緩；name 待 PT 審閱
- [ ] `joint` 實體：`degreesOfFreedom[]` 之 ROM 上下限 — **依文獻定版，取代佔位值**（06 §6.5）
- [ ] 骨架規格：共用骨架 ≤ 120 bones、骨骼命名、座標與單位約定（04 §4.3.6、07 §7.5）

## 開發用佔位資產（先行解鎖功能開發）

- [ ] 簡化幾何佔位模型（少量部位即可），**命名規則與正式版相同**（mesh／node = `anatomyId`），供 [04 人體模型](04_todo_human_model.md) 先行開發與測試；正式圖資完成後直接替換（04 §4.6）

## 3D 圖資（Z-Anatomy → Blender → glTF；管線見 04 §4.6.3）

- [ ] 匯入 Z-Anatomy `.blend`（已分層），彙整為製作工作檔 — 勘查完成（`inspectBlend.py`）；範圍選取／工作檔待 Stage C
- [ ] 綁骨：匯入 MakeHuman 骨架（≤ 120 bones）對位中立姿態（04 §4.3.3、§4.6.3）
- [ ] 混合綁定：預設逐 mesh 剛性綁主骨；跨關節肌做 skin weights（跨關節肌清單為管線編寫資料；04 §4.3.3）
- [ ] 標準資產：逐肌肉獨立 mesh（≤ 標準資產三角面預算〔現 provisional〕、≤ 200 draw calls〔未達＝逐肌選取粒度，待批次合併或實機放寬〕；04 §4.3.6）— 細節版/精簡版雙 profile 已收斂為單一標準資產
- [ ] 神經束（標準資產）
- [ ] mesh／node 命名一律 = `anatomyId`（04 §4.6.2）— 端到端已驗（含雙側 `.NNN` 尾碼還原）
- [ ] 匯出〔腳本 `exportGltf.py`〕glTF／GLB — 機制已備（join 聚合／curve→mesh／layerColors／雙側綁定／per-layer 及 per-entity 減面）；**待**：MakeHuman 共用骨架 rig；draw-call ≤200 預算（逐件 mesh 數超標，待批次合併或實機放寬）

## 壓縮與發佈管線

- [ ] 幾何壓縮：Draco 已落地（`exportGltf.py` KHR_draco_mesh_compression ＋自帶 `public/draco/` decoder）；meshopt 暫不需（純扁平材質無貼圖、Draco 已足）（02 §2.5）
- [ ] 紋理：KTX2（Basis）；標準資產 ≤ 1024²、完整版（full）無上限（04 §4.3.6）
- [ ] 下載量驗證：標準資產（壓縮後，依 04 §4.3.6 預算；現役約 8 MB）
- [ ] 上傳物件儲存 + CDN 快取設定（公開快取，與個案資料完全分離；08 §8.4）

## 2D 圖資（SVG 三視圖）

- [x] **（管線實作分階段）** A／B／C 三階段已落地（技術＝幾何輪廓投影、非 Freestyle；`export2dSvg.py` 與 3D 共用 `pipelineCommon.py` 解析碼、`manifestV1.json` 單一真相、color-agnostic 由 app 套 CSS）；**唯像素級視覺精緻度待使用者實機 QA 迭代**（04 §4.6.3 步驟 7）

> **註**: 2D模型目前暫時棄用，僅保留圖資生成pipeline

## 審閱與定版

- [ ] ⚠ 物理治療專業審閱：肌肉形狀、層次、神經走向（04 §4.6）→ 修正後定版
- [ ] 效能預算實測與調整：30 fps 底線；04 §4.3.6 之預算為初版，依實測修訂
