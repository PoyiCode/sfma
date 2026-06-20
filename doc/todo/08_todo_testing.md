# 08 — Todo：測試

> 階段：開發期（**隨各功能持續累積**，非最後一次補齊）｜來源設計：[07_dev_conventions.md](../design/07_dev_conventions.md) §7.7｜前置：[01](01_todo_setup.md)

## 基礎建設

- [x] Playwright 安裝與設定（Chromium／WebKit／Firefox）—— 已安裝 `playwright`／`@playwright/test`、`playwright.config.ts`（build→preview webServer、baseURL、chromium/webkit/firefox projects）就緒；chromium 二進位已下載。**待**：本機（WSL2）缺系統相依（`libnspr4.so` 等）且無 sudo 終端，瀏覽器無法啟動 → 實機執行待 CI（ubuntu-latest 具相依，`--with-deps`）。
- [x] @nuxt/test-utils 整合測試接入：獨立設定 `vitest.nuxt.config.ts`（`environment: 'nuxt'`、`pnpm test:nuxt`，與主 `test` 分立）；`app/*.nuxt.test.ts` 於真實 Nuxt runtime context 以真實 composable＋localStore＋fake-indexeddb 驗跨層接縫（clinicalFlow／breakoutFlow／annotationFlow）。
- [x] CI 接入：lint → typecheck → 單元／元件 → **test:nuxt** → build → verify:bundle 已串接；E2E 另立 job（`playwright install --with-deps chromium` + `pnpm test:e2e`）。

## 單元測試（純函式 — 邏輯與場景分離原則）

- [ ] ROM 鉗制計算（待真實 3D——ROM 上下限已定義，鉗制計算屬 3D 執行期）
- [ ] 肌肉長度 → 色彩推導（待真實 3D——收縮視覺化未實作）

## 3D 場景測試（NullEngine）

- [ ] 骨架階層正確（待 MakeHuman 骨架——NullEngine 環境已備、骨架到位即可測）
- [ ] ROM 限制有套用（超出範圍被鉗制）（待 MakeHuman 骨架，04 §4.3.3）
- [x] `anatomyId` **三方對應完整**：glTF node／2D SVG 圖層 id／definitions 實體三方一致且無孤兒（04 §4.6.2）。三腿皆靜態守恆測：① definitions⇄3D-manifest（`manifestConsistency.test.ts`，既有）；② **glTF-node 腿**（`render/gltfNodeConsistency.test.ts`，新——解析部署 glb 之 JSON chunk node 名、免 Draco、以 gltfBinding 正規化對 definitions 查孤兒＋non-exempt 漏網；連帶涵蓋 20 條有 mesh 之神經〔manifest 測 blanket-exempt 之缺口〕）；③ **2D-SVG 腿**（`anatomy/svg2dConsistency.test.ts`，新——2dManifest coverage＋SVG `data-anatomy-id` base 對 definitions、coverage⇄SVG 互核）。審計結果無孤兒（730 glTF mesh node／730 2D partKey 全解析）。**FMA crosswalk N/A**：本專案 FMA＝Selective Functional Movement Assessment（評估協定）、非 Foundational Model of Anatomy 本體，無 FMA id／crosswalk。
- [ ] LOD 效能預算量測：三角面／draw calls／下載量／GPU 記憶體對照 04 §4.3.6；基準裝置 FPS（≥ 30 fps 底線）—— 靜態三角面/預算上限對照已由 `verifyModelBudget.mjs` 核；**待實機**：GPU 記憶體量測＋基準裝置 FPS ≥30 底線

## E2E（Playwright）

> 核心臨床流程／Breakout／模型標註連動之「連貫接縫」已以 @nuxt/test-utils 整合測試（`environment: 'nuxt'`，真實 composable＋localStore＋fake-indexeddb）覆蓋（`app/clinicalFlow.nuxt.test.ts`／`breakoutFlow.nuxt.test.ts`／`annotationFlow.nuxt.test.ts`，`pnpm test:nuxt`）；主流程 E2E spec（`e2e/mainFlow.spec.ts`）已撰寫，待瀏覽器系統相依（CI／實機）執行。**取捨註**：本機 @nuxt/test-utils 之 renderSuspended/mountSuspended 對 route-target 頁元件渲染不穩（Nuxt env fork 啟動偶卡、router 重入、3D 頁需 WebGL），故整合測以容器 composable 直驅同等「跨層接縫」（受控輸入→mutator→落盤→summary/highlight 衍生），完整頁面互動全旅程改由下方 E2E spec 於真實瀏覽器覆蓋。

- [x] 主流程 E2E spec 撰寫：建立個案 → 評估（含 DP 觸發 Breakout 入口）→ 總覽 → 匯出（捕捉下載檔）→ 清空 → 匯入還原 → 驗資料回復（`e2e/mainFlow.spec.ts`）。**待實機/CI 執行**：本機瀏覽器系統相依缺、無 sudo 不可裝 → spec/config/script/CI step 就緒，俟 ubuntu CI 跑。其中「建立→評估→Breakout→總覽＋§4.5 模型標註→反向高亮」資料接縫已由 `test:nuxt` 整合測覆蓋。
- [ ] WebKit 引擎跑主流程（近似 iOS Safari；驗 IndexedDB 與下載／分享行為）
- [ ] PWA 離線啟動：殼層與靜態資產快取後，斷網重開 App 可用（02 §2.1）
- [ ] 響應式：三斷點下主要畫面可用性
- [ ] 授權標示存在：about／credits 畫面顯示 SFMA 與圖資（Z-Anatomy／BodyParts3D）來源標示（發布前合規；05 §5.6、[09_todo_security.md](09_todo_security.md)）

## 視覺回歸（選用）

- [ ] 關鍵視角截圖比對（正／側／背、收縮變色）；基準圖於固定 CI 環境產生、容忍少量像素差（待真實 3D＋CI 基準環境）
