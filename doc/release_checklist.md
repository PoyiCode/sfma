# 發布前檢核表（開發期單機版）

> 對應 [todo/README.md](todo/README.md)「發布檢核：09」與 [todo/09_todo_security.md](todo/09_todo_security.md)「發布前總複核」。
> 範圍：開發期單機（資料存裝置 IndexedDB ＋ 使用者自管匯出檔）。上雲（PostgreSQL／帳號／上架）相關見 [todo/10_todo_future.md](todo/10_todo_future.md)。
> 最後更新：2026-06-18。

## 1. 自動化驗證（每次發布前於 repo root 執行）

```powershell
pnpm lint; if ($?) { pnpm typecheck }; if ($?) { pnpm test }; if ($?) { pnpm build }; if ($?) { pnpm verify:bundle }
```

| 步驟 | 指令 | 預期 |
| --- | --- | --- |
| Lint | `pnpm lint` | ESLint：No issues found |
| 型別 | `pnpm typecheck` | tsc（apps/web ＋ packages/shared ＋ packages/definitions）無錯誤 |
| 測試 | `pnpm test` | 全綠（2026-06-17：web 913／shared 52／definitions 84 ＝ 1049） |
| 建置 | `pnpm build` | 成功（chunk >500kB 警告為既知無害） |
| 後門掃描 | `pnpm verify:bundle` | OK（哨兵 `ptappDevLoggerMarker` 不在 dist） |

## 2. 資安與隱私（todo 09 ／ 設計 08）

- [x] 告知同意 per-patient 閘門：建立個案前顯示目的／項目／範圍／期間／權利 ＋ 必勾「已取得當事人同意」，存檔記 `consentAcknowledgedAt`（`PatientFormView`、`patientSchema`；08 §8.5）
- [x] 當事人權利：本地查詢（`usePatient`／`usePatientList`）／更正（編輯表單）／刪除；刪除個案連動刪其評估（`localStore.deletePatient` 單一交易，已測）
- [x] 匯出檔明文個資警示：匯出前確認對話框提示「明文 JSON 含個資」與存放注意（08 §8.7）
- [x] Service Worker 快取範圍不含個資：`PRECACHE_GLOB_PATTERNS` 白名單回歸測（只含 js/css/html/svg/png/woff2；08 §8.7、§8.4）
- [x] actionLogger／錯誤訊息去個資：`redactPii` 縱深防禦（遮蔽 email／身分證／手機；08 §8.9）
- [x] 正式 bundle 無開發者後門：`verifyProdBundle` 哨兵掃描（與 07 CI 同項；08 §8.9）
- [x] 最小蒐集：僅 `name` 必填、餘選填、`patientId` 系統產生（08 §8.1；`schemas.test` 回歸鎖定）
- [x] 資料安全指引（裝置保護 ＋ 匯出檔處理守則）就地呈現於設定「關於」可展開區塊

## 3. 持久儲存防線整體驗收（todo 09 line 11）

- [x] `navigator.storage.persist()` 啟動申請 ＋ 准駁記錄（`initStorage`；02）
- [x] PWA 安裝引導（`InstallGuide`：Chromium `beforeinstallprompt`／iOS「加入主畫面」指引）
- [x] PWA 預快取殼層 ＋ `navigateFallback`（vite-plugin-pwa）
- [x] 全離線 3D（runtime 快取）：opt-in 開過 3D 後，glb／draco／Babylon chunk 以 workbox runtime CacheFirst cache-on-use → 之後可離線重看（`RUNTIME_CACHING` 單一真相，回歸測 `runtimeCaching.test.ts`；precache 仍不含 3D，不違 2 MiB 上限；SW 需 https／localhost，區網 http 非安全環境不生效；§4.3.5、08 §8.7 不快取個資）

> 2026-06-15：原「長期未匯出提醒（`ExportReminder`）」自動提醒功能已移除。匯出備份仍為最終保全手段（手動匯出＋首啟保全通知提示），但不再主動偵測閾值提醒；防線餘 `persist()`＋PWA 安裝引導＋離線殼層＋手動匯出。

## 4. ⚠ 發布前人為決策閘門（待決——需商業／專業判斷，非開發工作）

- [ ] **SFMA 授權**：對外發布／商業化前向 Functional Movement Systems 確認授權條件，或採替代方案（05 §5.6）
- [ ] **圖資資產授權**：解剖圖資 CC BY-SA 4.0（Z-Anatomy／BodyParts3D；骨架 MakeHuman CC0）標示來源與「資產保持開放」合規（04 §4.6.1、05 §5.6）
- [ ] **解剖臨床資料 PT 審閱**：種子解剖之肌肉 `actions`／`innervation`、關節 ROM、**韌帶名稱**／**椎間盤名稱**／**關節囊名稱**／**關節盤名稱**／**筋膜名稱**皆為教科書佔位值（含解3d資產 ㊿ 之 5 條韌帶 ACL/PCL/前縱/後縱/黃韌帶＋解3d資產 51 之全脊椎 23 節椎間盤 C2-C3…L5-S1＋解3d資產 53 之 4 大關節囊盂肱/髖/膝/肘＋解3d資產 54 之顳顎關節盤＋解3d資產 58 之 14 件 curated 筋膜帽狀腱膜/胸腰/闊筋膜…＋解3d資產 59 之 8 條韌帶骨間膜前臂/小腿/長足底/股骨頭/後薦髂…＋解3d資產 60 之 8 件 curated 滑囊肩峰下/大轉子/髕前/鵝足…＋解3d資產 61 之 35 件 curated 肌群名稱股四頭肌/旋轉肌袖/豎脊肌群/顏面表情肌群…＋解3d資產 62 之 5 骨骼區域名脊柱/顱骨/胸廓/上下肢骨＋3 神經叢名臂/腰/薦神經叢＋解3d資產 63 之 5 深層小肌 actions/innervation 棘間肌/橫突間肌/錐狀肌/胸橫肌/內收最小肌〔pyramidalis 神經實為 subcostal T12、以 nerve.intercostal 佔位〕＋解3d資產 骨盆底補完之 2 肌恥骨肛門肌/肛門外括約肌 actions/innervation〔皆 nerve.pudendal、external anal sphincter 實為陰部神經下直腸支、以 pudendal 主幹佔位〕＋解3d資產 關節內被動結構擴張之名稱〔膝內/外側半月板、髖臼唇/肩盂唇、12 關節囊橈腕/肩鎖/胸鎖/顳顎/上脛腓/指趾群〕＋6 周邊皮/感覺神經〔隱/腓腸/股外側皮/股後皮/橈淺/髂腹股溝、minimal 型無 innervation 屬性〕），對外發布前須由物理治療專業審閱定版（04 §4.6.4；definitions placeholder）
- [ ] **資料保存政策**：定義保存期限與到期／請求刪除流程（08 §8.5）
- [ ] **（選用）匯出檔密碼加密封裝**（08 §8.7）
- [ ] **部署目標與主機端 SPA fallback**：首載深連結需主機回退 index.html（SW `navigateFallback` 已就緒；主機端設定依目標而定）
- [ ] **資安／法遵專業複核**（08 文末要求）

## 5. 資產相依（未完成，緩——待真實資產）

- [ ] 04 人體模型真 3D（Babylon／glTF）：**render 層＋glTF 載入鏈已就緒**（2026-06-14：sceneCore/layers/picking/camera/highlight/gltfBinding/scenePopulator＋LOD 子系統＋`gltfMeshLoader`〔`@babylonjs/loaders` `ImportMeshAsync`〕；`createGltfScenePopulator(createGltfMeshLoader('/models/<name>.glb'))` 即完整填充器；託管＝`apps/web/public/`〔gitignored glb〕）；**仍待**：(1) Blender 匯出覆蓋擴大（✅ `anatomyV1.glb` 已重生為**全身 382 node**（2026-06-15、Blender 5.1.2 已安裝；**196 邏輯部位**雙側/中線——四肢＋軀幹＋頭頸＋胸廓＋中軸骨架＋骨盆全肌骨架＋全表情/咀嚼/呼吸肌；多頭 `sourceObjects` join、神經 CURVE `curveBevel` 轉管；分層基底著色〔`layerColors`，材質 3〕；**🏁 肌源已罄**〔㊹ buccinator 收尾〕；**✅ Stage D 減面已落地**〔㊺、cap=1800 DECIMATE COLLAPSE：算繪 2.7M→**577,425 ≤600k 細節版預算**、檔案 30.67→**8.37 MB（−73%）**、`EXPORT_OK selected=382 decimated=226`、node/雙側綁定不變、app 零改〕；複製至 `apps/web/public/models/`〔gitignored〕；actions/ROM 為教科書佔位值〔§4 PT 審閱閘門〕；後續主為**精簡版 ≤150k 肌群合併／Draco·meshopt 壓縮／draw-call 批次**）、(2) **live opt-in 3D 接入已落地**（2026-06-14：`ModelViewerContent` 以 `useRenderTier` 判能力，具 WebGL 顯「顯示維度」2D⇄3D 切換、預設 2D、切 3D 才 lazy 載 Babylon〔3D chunk on-demand、不 precache；**全離線 3D（2026-06-16）**：開過 3D 後 glb／draco／chunk 以 runtime CacheFirst cache-on-use → 可離線重看，§4.2／§4.3.5〕）；**仍待真實資產之子項**：LOD 自動／手動切換 UI、執行期 FPS 動態降級、3D 精準貼近部位定位（§4.6 Z-Anatomy 管線）
- [ ] 模型檢視器精準貼近部位定位：待真實資產與執行期座標（getScreenCTM／letterbox）
- [x] 04 人體模型正式 2D 三視圖（SVG）：**3D→2D 抽取管線 A/B/C 三階段全落地**（2026-06-16；技術＝**幾何輪廓投影**，非 Freestyle〔本機 Blender 5.1.2 無 `render_freestyle_svg` addon、經 AskUserQuestion 改技術繞過〕）：**A ✅** 抽 `pipelineCommon.py` 共用物件解析（純重構、重匯 GLB byte-identical 核對）／**B ✅** `export2dSvg.py` world→camera 投影＋柵格化覆蓋遮罩＋Moore 邊界追蹤＋DP 簡化→封閉填色剪影 SVG＋`anatomy2dManifest.json`＋產 `assets2d/`〔bpy 慣例實檔重跑驗：三方位 **267/267 detailed 部位 100% 涵蓋**〕／**C（已移除執行期消費，2026-06-17）** 原 `Model2DView` 消費真實 SVG，**2026-06-17 政策移除 2D 模型→App 僅 3D、執行期 2D 檢視器已刪**；**SVG 抽取管線（A `pipelineCommon.py`／B `export2dSvg.py`／`assets2d/` 產出）保留**為資產產生器（與執行期 2D 檢視器分立、見 04 §4.2）。資產 `apps/web/public/assets2d/` **gitignored**。**像素級視覺精緻度待使用者實機 QA 迭代**。**⚠ 同步義務**：**任何 3D `manifestV1.json` 變更（新增／改名／刪除部位、或來源幾何改動）須同時重跑 2D 抽取器重生 SVG**（`blender -b <blend> -P export2dSvg.py -- manifestV1.json out2d/`，與 `exportGltf.py` 並跑、再複製至 `public/assets2d/`），由 app 端一致性測試（2D anatomyId ⊆ 3D）把關漂移。見 [04 §4.6.3](04_human_model.md)、[plans/2026-06-15-3d-to-2d-svg-pipeline.md](plans/2026-06-15-3d-to-2d-svg-pipeline.md)、[plans/2026-06-16-2d-stage-b-silhouette.md](plans/2026-06-16-2d-stage-b-silhouette.md)
- [x] 原始系統不壓縮 glb 基準（精簡化前／2D 描繪參考、**不入 App**）：**collection 驅動** `exportSystemsGltf.py` 輸出原始 `z-anatomy.blend` 系統 1/2/3/4/7 之 master＋5 per-system glb 至 `out/`（gitignored）；`verifySystemsExport.mjs` 核 master mesh-node＝系統聯集（2026-06-16：2641＝277/705/409/669/581）。**非 App 資產**（與 manifest 驅動 `anatomyV1.glb` 並存、不同用途）。**同步註**：3D 來源 `.blend` 幾何變更時可重跑此器更新基準（非發布閘門、屬參考素材）。見 [04 §4.6.3](04_human_model.md)、[plans/2026-06-16-uncompressed-master-export.md](plans/2026-06-16-uncompressed-master-export.md)。**內容缺口稽核（2026-06-16）**：`contentGapAudit.mjs` 以此基準比對 app `manifestV1.json`，量化原始已建模但 app 未納之解剖（驅動未來內容擴張決策、非發布閘門）；報告見 [analysis/contentGapAudit.md](analysis/contentGapAudit.md)

---

> 本表為開發期工程面之發布就緒總覽；§4 待決閘門與 §5 資產相依須由具相應職權者於對外發布前處理。正式上線前應由具資安／法遵專業者複核（依設計 08 文末要求）。
