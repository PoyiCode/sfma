# 05 — Todo：SFMA 評估表

> 階段：開發期｜來源設計：[05_assessment.md](../design/05_assessment.md)、[06_data_model.md](../design/06_data_model.md) §6.3–6.4｜流程依據：[../ref/SFMA_form.md](../ref/SFMA_form.md)｜前置：[01](01_todo_setup.md)、[02](02_todo_data.md)

## 已完成

- [x] **2×2 判讀方格輸入**（`SfmaQuadrant`）：取代原分離的 `painful` checkbox ＋ `dysfunctional` SegmentedControl；列為功能正常／功能異常 × 欄為無痛／疼痛，`role="radiogroup"` ＋方向鍵導覽，格子 ≥44px。資料模型（`painful`／`dysfunctional`）與手動覆寫邏輯均不變（見 03 §3.3.9 & 05 §5.2）。
- [x] **評估紀錄「看模型」深連結**：`AssessmentHistoryView` 歷程列附次要動作，連至 `/patients/:patientId/model?session=<sessionId>`，以該評估標註反向高亮部位（見 03 §3.3.8 & 04 §4.5）。
- [x] **動作參考圖**：判讀卡（`AssessmentEntryCard`）判讀方格旁、及 Breakout 疊層頂條（`BreakoutOverlayView`，顯來源頂層動作圖）皆顯示該動作參考圖，供 PT 對照動作。圖源為官方 SFMA score sheet（`doc/ref/SFMA_form.pdf` 第 33 頁）裁切，存 `app/assets/sfma/patterns/<patternKey>.png`，經 `patternImage.ts`（`import.meta.glob`）匯入（base 安全、precache 可離線）；來源動作以 `sfmaPatternByKey` 反查（見 05 §5.2）。**註：圖源同受 SFMA 授權約束，見下「待決事項」。**

## ⚠ 待決事項

- [ ] SFMA 授權確認：**對外發布或商業化前**向權利方確認；`sfmaBreakoutFlows.json` 為原版流程圖之數位化，同受約束；替代方案見 05 §5.6 — 統一追蹤於 [09_todo_security.md](09_todo_security.md)
