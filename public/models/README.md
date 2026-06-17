# 人體模型 glTF 資產（開發用）

此目錄存放 **3D 人體模型 glb**，由 Vite 開發伺服器／建置直接以靜態資產服務。

- **執行期 URL**：`/models/<name>.glb`（如 `/models/anatomyV1.glb`）。
- **不入 git**：`*.glb`／`*.gltf` 由 `.gitignore` 排除（大型二進位不入非遠端 repo）。本 `README.md` 為唯一受版控檔。
- **來源**：由 `infra/asset-pipeline`（Blender headless 匯出，見 [04 §4.6](../../../../doc/design/04_human_model.md)）產至 `infra/asset-pipeline/out/`，再複製到此供開發。
  ```bash
  cp infra/asset-pipeline/out/anatomyV1.glb apps/web/public/models/anatomyV1.glb
  ```
- **載入**：app 端以 `render/gltfMeshLoader.ts` `createGltfMeshLoader('/models/<name>.glb')` 串 `createGltfScenePopulator` 載入並綁定 `anatomyId` metadata（mesh node 名＝anatomyId）。

> **目前 `anatomyV1.glb`**：上肢 33 邏輯部位**雙側**＝66 node（`<anatomyId>`＋鏡像 instance `<anatomyId>.001`），由 `infra/asset-pipeline/manifestV1.json` 匯出——骨 humerus／radius／ulna／scapula／clavicle；肌（肘）brachialis／bicepsBrachii／tricepsBrachii＋（前臂腕）flexorCarpiRadialis／flexorCarpiUlnaris／extensorCarpiRadialisLongus／extensorCarpiUlnaris／pronatorTeres／supinator＋（肩）deltoid／supraspinatus／infraspinatus／teresMinor／subscapularis／teresMajor＋（指/拇外在）**flexorDigitorumSuperficialis**／**flexorDigitorumProfundus**／**flexorPollicisLongus**／**extensorDigitorum**／**extensorPollicisLongus**／**abductorPollicisLongus**；神經 radial／ulnar／musculocutaneous／median／axillary／suprascapular／subscapular。複合/多頭肌（biceps／triceps／FCU／ECU／pronatorTeres／deltoid 三部／**FDS 兩頭**）以 manifest `sourceObjects` 陣列於 `exportGltf` join 聚合為單一 node；神經來源為 CURVE、以 `curveBevel` 於 `exportGltf` 轉管狀 mesh（subscapular 為兩段 curve join；一邏輯部位＝一可選 mesh）。總三角面約 163k（600k 細節版預算 27%）。
>
> **載入接通（2026-06-14）**：live 3D（`Model3DViewer`）已**預設載入本 glb**——`populateScene` 預設 `createGltfScenePopulatorWithFallback(createGltfMeshLoader('/models/anatomyV1.glb'))`，glb 在則顯真實幾何、**缺檔／載入失敗則退佔位 box**（本 glb gitignore，乾淨建置可能無檔）。`@babylonjs/loaders` 隨 `Model3DViewer` lazy import 落 3D on-demand chunk、主 chunk 不含。
>
> **覆蓋擴大（2026-06-14）**：複合肌聚合（biceps＝Long+Short head、triceps＝Long+Lateral+Medial head 子頭 join，4→6 部位）與**神經 CURVE→管狀 mesh**（radial／ulnar／musculocutaneous 三主幹，6→9 部位）**皆已完成**——`exportGltf` 經 manifest `sourceObjects` join／`curveBevel` 轉管，definitions 補 `nerve.ulnar`（三幹齊備）、app 零改、自動經載入路徑顯示（神經屬 nerve 層、預設隱藏可開）。
>
> **分層基底著色（2026-06-14）**：源材質皆白→3D 未選取難辨；`exportGltf` 依 manifest `layerColors`（layer→sRGB hex）指派扁平基底材質（骨象牙 `#E8DEC8`／肌紅 `#B5413B`／神經黃 `#E6C84B`，材質 9→3）。未選取顯解剖分層色、選取／標註仍 overlay（app 零改）。
>
> **內容擴張（2026-06-15）**：前臂/腕部（屈伸腕 4 肌＋旋前圓肌/旋後肌＋正中神經＋wrist/radioulnar 關節，9→16）＋肩部（rotator cuff＋deltoid＋teresMajor＋scapula/clavicle＋盂肱關節＋axillary/suprascapular/subscapular 神經，16→27）＋指/拇外在動作肌（FDS/FDP/FPL/ED/EPL/APL＋fingers/thumb 功能關節，27→33）。definitions＋manifest 內容，既有機制零新增、app 渲染碼零改。actions/ROM 為教科書佔位值、發布前經 PT 審閱。上肢自此涵蓋肘/腕/肩/指主要動作肌。
>
> **待續**：手內在小肌（thenar/hypothenar/interossei/lumbricals，另案）／新區域（下肢/脊椎，宜使用者定）／decimation（現 27% 預算、緩）／2D SVG（另案）；擴大後同樣自動經此載入路徑顯示、無需再改 app。
