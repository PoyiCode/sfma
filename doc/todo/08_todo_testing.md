# 08 — Todo：測試

> 階段：開發期（**隨各功能持續累積**，非最後一次補齊）｜來源設計：[07_dev_conventions.md](../design/07_dev_conventions.md) §7.7｜前置：[01](01_todo_setup.md)

## 基礎建設

- [ ] Playwright 安裝與設定（Chromium／WebKit／Firefox）（待安裝）
- [ ] CI 接入：lint → 單元／元件 → E2E（headless）—— 部分：CI 已跑 lint→typecheck→test→build→verify:bundle，測試檔同層命名已合規；E2E 待 Playwright

## 單元測試（純函式 — 邏輯與場景分離原則）

- [ ] ROM 鉗制計算（待真實 3D——ROM 上下限已定義，鉗制計算屬 3D 執行期）
- [ ] 肌肉長度 → 色彩推導（待真實 3D——收縮視覺化未實作）

## 3D 場景測試（NullEngine）

- [ ] 骨架階層正確（待 MakeHuman 骨架——NullEngine 環境已備、骨架到位即可測）
- [ ] ROM 限制有套用（超出範圍被鉗制）（待 MakeHuman 骨架，04 §4.3.3）
- [ ] `anatomyId` **三方對應完整**：glTF node／2D SVG 圖層 id／definitions 實體三方一致且無孤兒，FMA ↔ anatomyId crosswalk 完整（04 §4.6.2）—— definitions ⇄ 3D-manifest 腿已落地（靜態測）；**仍待**：glTF-node 執行期腿（待 NullEngine 載 .glb）、2D-SVG 圖層 id 腿、FMA crosswalk
- [ ] LOD 效能預算量測：三角面／draw calls／下載量／GPU 記憶體對照 04 §4.3.6；基準裝置 FPS（≥ 30 fps 底線）—— 靜態三角面/預算上限對照已由 `verifyModelBudget.mjs` 核；**待實機**：GPU 記憶體量測＋基準裝置 FPS ≥30 底線

## E2E（Playwright）

> 全段待 Playwright 安裝與設定（見基礎建設）。核心臨床流程／Breakout／模型標註連動之「連貫接縫」已先以 jsdom 整合測試覆蓋（`clinicalFlow`／`breakoutFlow`／`annotationFlow`），其餘需真實瀏覽器引擎、jsdom 不可替。

- [ ] 主流程：建立個案 → 評估（含 Breakout）→ 總覽 → 匯出 → 清空 → 匯入還原 —— 部分：建立→評估→Breakout→總覽＋§4.5 模型標註→反向高亮 接縫已 jsdom 整合測；匯出→清空→匯入經真實 UI 全旅程＋WebKit／離線仍俟 Playwright
- [ ] WebKit 引擎跑主流程（近似 iOS Safari；驗 IndexedDB 與下載／分享行為）
- [ ] PWA 離線啟動：殼層與靜態資產快取後，斷網重開 App 可用（02 §2.1）
- [ ] 響應式：三斷點下主要畫面可用性
- [ ] 授權標示存在：about／credits 畫面顯示 SFMA 與圖資（Z-Anatomy／BodyParts3D）來源標示（發布前合規；05 §5.6、[09_todo_security.md](09_todo_security.md)）

## 視覺回歸（選用）

- [ ] 關鍵視角截圖比對（正／側／背、收縮變色）；基準圖於固定 CI 環境產生、容忍少量像素差（待真實 3D＋CI 基準環境）
