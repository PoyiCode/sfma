# 05 — 評估表（SFMA）

> 你提到自己不是物理治療師，故採用參考資料提供的 **SFMA（Selective Functional Movement Assessment，選擇性功能動作評估）** 作為標準評估方法。本文件完整列出需要的欄位、計分方式與判讀標準，並補上二階 Breakout 的結構。資料結構見 [06_data_model.md](06_data_model.md)。
>
> 流程依據：SFMA 計分表與全部判讀流程圖之專案內文字轉錄見 [`../ref/SFMA_form.md`](../ref/SFMA_form.md)（已逐頁目視核對）；本文件之 Breakout 決策樹設計以其 §3 為**唯一編碼依據**。

## 5.1 SFMA 是什麼

SFMA 是針對「有疼痛或動作問題」的個案所用的動作篩檢系統。它以**頂層 10 大基本動作**做篩檢，每個動作判讀為四類之一；凡判讀為**功能異常（DN／DP）**者，再以對應的**二階 Breakout 流程**把問題拆解定位到具體成因（穩定性、關節活動度或組織延展性）。其中 **DN 優先進行 Breakout**（疼痛會干擾動作控制，先解無痛的功能異常）；FP 記錄疼痛、不進 Breakout。

### 計分分類（每個動作判讀為其中一類）

| 縮寫 | 中文 | 功能 | 疼痛 |
| --- | --- | --- | --- |
| **FN** | 功能正常且無痛 | 正常 | 無痛 |
| **FP** | 功能正常但疼痛 | 正常 | 疼痛 |
| **DN** | 功能異常且無痛 | 異常 | 無痛 |
| **DP** | 功能異常且疼痛 | 異常 | 疼痛 |

- **功能（Functional / Dysfunctional）**：動作品質是否達標（由下方各動作的判讀標準決定）。
- **疼痛（Painful / Non-painful）**：動作過程是否誘發疼痛。
- 雙側動作（左／右）需**分別判讀**。

### 關於「總分」

SFMA 不像 FMS 採用單一加總分數。評估表上的「Total Score」實為**總覽**用途。本 APP 以**統計總覽**呈現：各分類（FN／FP／DN／DP）的數量、出現 DP／FP 的部位清單（疼痛優先處理），而非單一積分。

## 5.2 頂層評估表（10 大動作）

每個動作的共通欄位（雙側動作左右各一筆）：

- `dysfunctional`：功能是否異常（勾選任一判讀標準時 UI 自動帶入，治療師可覆寫）
- `painful`：是否疼痛
- `failedCriteria[]`：勾選的判讀標準（「功能異常」的依據）
- `notes`：自由備註

FN／FP／DN／DP 分類由 `dysfunctional` × `painful` **推導**，不另外儲存，避免出現矛盾狀態（見 [06_data_model.md](06_data_model.md) 6.3）。

**動作參考圖（UI）**：每筆判讀卡（`AssessmentEntryCard`）於判讀方格旁顯示該動作的參考圖，供物理治療師評估時直接對照動作。圖源為官方 SFMA score sheet（[`../ref/SFMA_form.pdf`](../ref/SFMA_form.pdf) 第 33 頁）逐動作裁切，存於 `app/assets/sfma/patterns/<patternKey>.png`（10 大動作各一），以 Vite 資產匯入（`patternImage.ts`，`import.meta.glob`）取雜湊 url——自動套 `app.baseURL`（子路徑佈署亦正確）並納入 PWA precache 可離線。缺圖則優雅不顯。

頂層判讀以 `patterns[]` 記錄，**僅含已判讀的筆數**——雙側動作每側獨立一筆（左／右），故總筆數為 5 單一 × 1 ＋ 5 雙側 × 2 ＝ **15**。判讀進度即 `patterns.length / 15`；**尚未判讀者不存於 `patterns[]`**（不可與「已判讀為 FN」混淆——後者為一筆全 `false` 的紀錄）。「已手動」狀態（治療師覆寫自動帶入的 `dysfunctional`）為衍生值（`dysfunctional` ≠ 由 `failedCriteria` 是否非空所推得的自動值），不另外儲存。對應純函式見 `apps/web/src/modules/assessment/assessmentForm.ts`。

### 1. 頸椎屈曲 Cervical Flexion（單一）

| 欄位 | 內容 |
| --- | --- |
| 疼痛 | □ 疼痛 |
| 判讀標準 | □ 下巴無法觸及胸骨（Can't touch sternum to chin）<br>□ 過度用力／動作控制不足 |

### 2. 頸椎伸展 Cervical Extension（單一）

| 欄位 | 內容 |
| --- | --- |
| 疼痛 | □ 疼痛 |
| 判讀標準 | □ 未達與水平面 10 度內（Not within 10° of parallel）<br>□ 過度用力／動作控制不足 |

### 3. 頸椎旋轉 Cervical Rotation（左／右）

| 欄位 | 內容 |
| --- | --- |
| 疼痛 | □ 右側疼痛　□ 左側疼痛 |
| 判讀標準（左右各判） | □ 鼻尖未對齊鎖骨中線（Nose not in line with mid-clavicle）<br>□ 過度用力／明顯不對稱／動作控制不足 |

### 4. 上肢模式一 Pattern #1 — MRE（內旋—伸展）（左／右）

| 欄位 | 內容 |
| --- | --- |
| 疼痛 | □ 右側疼痛　□ 左側疼痛 |
| 判讀標準（左右各判） | □ 未達肩胛骨下角（Does not reach inferior angle of scapula）<br>□ 過度用力／明顯不對稱／動作控制不足 |

### 5. 上肢模式二 Pattern #2 — LRF（外旋—屈曲）（左／右）

| 欄位 | 內容 |
| --- | --- |
| 疼痛 | □ 右側疼痛　□ 左側疼痛 |
| 判讀標準（左右各判） | □ 未達肩胛棘（Does not reach spine of scapula）<br>□ 過度用力／明顯不對稱／動作控制不足 |

### 6. 多節段屈曲 Multi-Segmental Flexion（單一）

| 欄位 | 內容 |
| --- | --- |
| 疼痛 | □ 疼痛 |
| 判讀標準 | □ 無法觸及腳趾（Cannot touch toes）<br>□ 薦椎角度 < 70 度（Sacral angle < 70°）<br>□ 脊柱曲線不均勻（Non-uniform spinal curve）<br>□ 缺乏後方重心轉移（Lack of posterior weight shift）<br>□ 過度用力／明顯不對稱／動作控制不足 |

### 7. 多節段伸展 Multi-Segmental Extension（單一）

| 欄位 | 內容 |
| --- | --- |
| 疼痛 | □ 疼痛 |
| 判讀標準 | □ 上肢未達或無法維持 170 度（UE does not achieve/maintain 170°）<br>□ 髂前上棘（ASIS）未超過腳趾<br>□ 肩胛棘未超過腳跟（Spine of scapula does not clear heels）<br>□ 脊柱伸展曲線不均勻（原表記 Uniform spinal curve）<br>□ 過度用力／動作控制不足 |

### 8. 多節段旋轉 Multi-Segmental Rotation（左／右）

| 欄位 | 內容 |
| --- | --- |
| 疼痛 | □ 右側疼痛　□ 左側疼痛 |
| 判讀標準（左右各判） | □ 骨盆旋轉 < 50 度（Pelvis rotation < 50°）<br>□ 肩部旋轉 < 50 度（Shoulders rotation < 50°）<br>□ 脊柱／骨盆偏移（Spine/pelvic deviation）<br>□ 膝過度屈曲（Excessive knee flexion）<br>□ 過度用力／不對稱／動作控制不足 |

### 9. 單腳站立 Single-Leg Stance（左／右）

| 欄位 | 內容 |
| --- | --- |
| 疼痛 | □ 右側疼痛　□ 左側疼痛 |
| 判讀標準（左右各判） | □ 睜眼 < 10 秒（Eyes open < 10s）<br>□ 閉眼 < 10 秒（Eyes closed < 10s）<br>□ 失去高度（Loss of height）<br>□ 過度用力／不對稱／動作控制不足 |

### 10. 過頭深蹲 Overhead Deep Squat（單一）

| 欄位 | 內容 |
| --- | --- |
| 疼痛 | □ 疼痛 |
| 判讀標準 | □ 上肢失去起始位置（Loss of UE start position）<br>□ 脛骨與軀幹未達平行或更佳（Tibia and torso not parallel or better）<br>□ 大腿未低於水平（Thighs do not break parallel）<br>□ 失去矢狀面對位（Loss of sagittal plane alignment）<br>□ 過度用力／重心偏移／動作控制不足 |

## 5.3 二階 Breakout（評估流程：引導決策樹）

當某頂層動作判讀為**功能異常（DN／DP）**時，執行對應的 Breakout 流程（SFMA 流程圖的入口即為「受限 Limited」模式），把問題定位到下列分類之一。順位：**DN 優先**；DP 由治療師視疼痛狀況決定是否進入；**FP 不進 Breakout**（功能未受限，疼痛另行評估與處理）：

| 縮寫 | 中文 | 意義 |
| --- | --- | --- |
| **SMCD** | 穩定性／動作控制功能障礙 | 活動度足夠，但控制／穩定不足 |
| **JMD** | 關節活動度功能障礙 | 關節本身活動受限 |
| **TED** | 組織延展性功能障礙 | 軟組織延展不足 |
| **PAIN** | 疼痛處理 | 流程中誘發疼痛，優先處理疼痛 |
| **OTHER** | 其他功能障礙 | 三大成因之外的端點：前庭功能障礙、本體感覺缺損（ref §3.7）等，具體名稱由 finding 顯示文字載明 |

Breakout 的共通邏輯：**主動測試 → 被動測試** 比較，藉「主動是否異常、被動是否改善、是否疼痛」推導屬於 SMCD／JMD／TED／PAIN；§3.7 的前庭／本體感覺端點（OTHER）則由 CTSIB、踝內外翻等專屬測試判定，不循此比較邏輯。

**入口政策（有意偏離 ref 導語）**：ref §3 轉錄導語為「頂層測試凡非 FN 者，依對應 breakout 流程逐步測試」（含 FP）；本設計採 **FP 不進 Breakout** — 依據是各流程圖皆以「受限（Limited）」為標題與前提，FP 功能未受限、無受限可拆解（流程**內**的 FP 分支是 Breakout 測試自身的結果，與頂層入口無涉）。

### 5.3.1 流程圖清單與入口對應

Breakout 依 SFMA 原始流程圖編碼為 **16 個決策樹流程**（`flowKey`，camelCase）。分支與端點一律以 [`../ref/SFMA_form.md`](../ref/SFMA_form.md)（下表簡稱 ref）§3 為唯一編碼依據，不憑記憶或二手資料增刪。

| flowKey | 流程 | 來源 | 入口／連入 |
| --- | --- | --- | --- |
| `cervicalFlexionBreakout` | 頸屈受限 | ref §3.1.1 | `cervicalFlexion` 為 DN／DP |
| `cervicalRotationBreakout` | 頸旋轉受限 | ref §3.1.2 | `cervicalRotation` 為 DN／DP（分側） |
| `cervicalExtensionBreakout` | 頸伸展受限 | ref §3.1.3 | `cervicalExtension` 為 DN／DP |
| `upperExtremityPattern1Breakout` | 上肢模式一（MRE） | ref §3.2 | `upperExtremityPattern1Mre` 為 DN／DP（分側） |
| `upperExtremityPattern2Breakout` | 上肢模式二（LRF） | ref §3.3 | `upperExtremityPattern2Lrf` 為 DN／DP（分側） |
| `multiSegmentalFlexionBreakout` | 多節段屈曲 | ref §3.4 | `multiSegmentalFlexion` 為 DN／DP |
| `spineExtensionBreakout` | 脊椎伸展（MSE 入口） | ref §3.5.1 | `multiSegmentalExtension` 為 DN／DP；亦由 ref §3.8 Go to 連入（深蹲〔去除過頭要素〕為 FN、Assisted Squat 為 DN） |
| `lowerBodyExtensionBreakout` | 下半身伸展 | ref §3.5.2 | 由其他流程之 Go to 連入（ref §3.5.1、§3.5.3、§3.6.2–3.6.4） |
| `upperBodyExtensionBreakout` | 上半身伸展 | ref §3.5.3 | 由其他流程之 Go to 連入（ref §3.5.1） |
| `multiSegmentalRotationBreakout` | 多節段旋轉主流程 | ref §3.6.1 | `multiSegmentalRotation` 為 DN／DP（分側） |
| `hipExternalRotationBreakout` | 髖外轉（Part 1） | ref §3.6.2 | 由 ref §3.6.1 Go to 連入 |
| `hipInternalRotationBreakout` | 髖內轉（Part 2） | ref §3.6.3 | 由 ref §3.6.2 Go to 連入 |
| `tibialRotationBreakout` | 脛骨旋轉 | ref §3.6.4 | 由 ref §3.6.2–3.6.3 Go to 連入（§3.6.2 於髖判定正常時直接連入） |
| `vestibularCoreBreakout` | 前庭與核心 | ref §3.7.1 | `singleLegStance` 為 DN／DP（分側） |
| `ankleBreakout` | 踝 | ref §3.7.2 | 由 ref §3.7.1 Go to 連入 |
| `overheadDeepSquatBreakout` | 過頭深蹲 | ref §3.8 | `overheadDeepSquat` 為 DN／DP；深蹲（去除過頭要素）為 FN 或 Assisted Squat 為 DN 時 Go to MSE 流程鏈 |

縮寫「(CH)」（Lumbar Locked 測試之手位變化，ref §3.2）為原文標示，已登錄 [README](README.md) 縮寫表。

### 5.3.2 決策樹資料模型（資料驅動）

決策樹獨立為資料檔 `sfmaBreakoutFlows.json`（`packages/definitions`），引導引擎與 UI 由其生成；完整 JSON 格式見 [06_data_model.md](06_data_model.md) 6.4。模型要點：

- **節點（node）＝測試**：名稱（多語系）、主動／被動（`mode`）、判準（含角度，如「50°」）、結果選項。端點（診斷框、疼痛框、Go to 框）**不是節點**，而是分支的結局 — 簡化資料與引擎。
- **結果選項（resultOptions）**：預設 `FN`／`FP`／`DP`／`DN` 四碼；部分節點依原圖增列特殊選項碼（camelCase），如 `fnBilateral`（雙側 FN）、`bilateralDysfunctional`／`unilateralDysfunctional`（雙側／單側異常，ref §3.4 單腳前彎）、`switchesSides`（換邊代償）、`fnKneeStraight`／`fnHipAbducted`／`fnHipAbductedKneeStraight`（Modified Thomas 之達標姿勢變體）、`improvedNotFull`（改善但未全幅）。
- **分支（branches）**：以 `when` 條件比對，可組合 —
  - `resultIn`：本節點結果；
  - `priorResult`：同一次 Breakout 內先前節點的結果（如 OA 屈曲端點視 PSCF 結果而異、ODS 抱脛測試視半跪背屈結果而異、髖旋轉「若 Seated Passive Rotation 為 DN」）；
  - `hasFindings`：本次 Breakout 已累積之 findings — **預設排除 `PAIN`**（即原圖「若先前無橘色框發現…」語句），可加 `inFlow`／`findingTypeIn` 篩選（如「脊椎伸展是否異常」）；`findingTypeIn` 明確列入 `PAIN`／`OTHER` 時則一併檢查，以表達 ref §3.7.2「無紅色、橘色或陽性藍色框」之端點條件。
- **結局（outcomes，可複合）**：
  - `next` — 接續同流程下一節點；
  - `finding` — 產出發現（`findingType`：SMCD／JMD／TED／PAIN／OTHER ＋ 顯示文字），對應原圖橘／綠色診斷框、紅色疼痛端點與前庭／本體感覺類發現（OTHER，ref §3.7）；**finding 不必然終止流程**（如 ref §3.5.1 被動 Lumbar Locked FN → Thorax SMCD 後仍續測肘撐）；
  - `goToFlow` — 排入其他流程（原圖藍色「Go to …」）；
  - `instruction` — 指示端點（如「停止並先處理先前 DN」「再次確認頸椎模式」）。

### 5.3.3 引導引擎行為（guided 模式）

> UI 對應（手風琴填寫、步進卡、端點結果卡、佇列／findings 面板、回溯改步、完成與 classification 覆寫）見 [03_ui_ux.md](03_ui_ux.md) §3.3.9。

1. **進入**：頂層動作判讀為 DN（優先）／DP 時，UI 建議進入其入口流程（5.3.1 表）；治療師可延後或略過。
2. **步進**：每步顯示目前測試（名稱、主／被動、判準）與結果選項；輸入結果後依分支規則前進，依序寫入 `steps[]`。
3. **findings 累積**：沿途產出的 findings 自動寫入紀錄（原圖橘色診斷框；紅色疼痛端點與前庭／本體感覺類發現亦各為一筆 finding）；後續「若先前無…框」類條件以此判定。
4. **疼痛端點**：產出 `PAIN` finding（Treat Pain／Treat Chemical Pain／疼痛端點），UI 顯著提示「先處理疼痛」；是否續行依該分支編碼之 outcomes — 「Treat Pain — Go to …」為 finding＋`goToFlow`、ref §3.7.2 各站疼痛後仍接續下一站為 finding＋`next`，無後續 outcome 者結束該流程。
5. **流程佇列**：`goToFlow` 將目標流程排入佇列（去重、依觸發順序；MSE「Lower 再 Upper」與 MSR「主流程 → 髖外轉 → 髖內轉 → 脛骨」之順序依原圖），完成目前流程後依序引導。
6. **回溯修改**：修改第 i 步結果 → 第 i 步之後的 steps 與其衍生 findings 一併作廢，自該步重新引導（UI 需確認）。
7. **條件資料缺失**：分支條件所需的先前結果不存在（自由模式、跳測）→ 顯示原圖條件文字，由治療師人工擇一分支，於該步 `notes` 註記。
8. **側別**：雙側頂層動作左右各一筆 Breakout 紀錄；流程內本身不分側的測試（如 CTSIB）已於另一側輸入時，UI 帶入前值供確認、可修改。
9. **自由模式（freeform）後備**：不經引導、直接挑選任一流程節點逐筆紀錄；findings 與 classification 由治療師手動指定。

### 5.3.4 分類結果（classification）

- 引導模式：`classification` 預設由 findings 推導 — findings 含 PAIN 者預設 `PAIN`（疼痛優先），否則取第一筆 finding 的類型；治療師可覆寫。
- 完整紀錄結構（`entryFlowKey`／`steps[]`／`findings[]`／`classification`）見 [06_data_model.md](06_data_model.md) 6.3。

### 5.3.5 編碼備註（sfmaBreakoutFlows.json 與 ref §3 之對應規則）

`sfmaBreakoutFlows.json` 編碼時對轉錄文字的詮釋性決策，集中載明於此（與資料檔同步維護）：

1. **複合端點型別**：「X JMD &/or TED」「X TED &/or JMD」等複合診斷端點，`findingType` 取**首列類型**（如 `JMD`），`label` 保留完整複合文字；classification 推導（5.3.4）與 UI 色彩依 `findingType`。
2. **mode 未標示之測試**：原圖未冠 Active/Passive 者（C1–C2、Supine Cervical Extension、Prone Rocking、CTSIB、Heel/Toe Walk、Half-Kneeling、Quadruped Diagonals、Deep Squat、Assisted Squat 等）依測試性質編 `active`；抱膝／抱脛／Lat Stretch 類自助伸展測試編 `passive`。
3. **轉錄一致性補全**（均經逐流程二次核對）：
   - ODS（ref §3.8）：Half-Kneeling Dorsiflexion 之 FP/DP「Treat Pain」後**仍接續**抱脛測試 — 由抱脛測試分支「FN 且踝背屈為 DP or FP」之存在反推原圖有此連線。
   - 下半身伸展（ref §3.5.2）：Modified Thomas 為單純 FN 且 FABER 為 FN 時**接續** Prone Active Hip Extension（依轉錄頂層「接續 →」佈局）；FN 且 FABER 受限依原文「停止並先處理 FABER」。
   - 髖內轉（ref §3.6.3）「若先前無髖旋轉功能障礙跡象」以兩條 `hasFindings(inFlow: 髖外轉／髖內轉)` 分支表達（`inFlow` 一次僅能指一個流程）。
   - 上肢模式一／二（ref §3.2–§3.3）：被動分型測試之橘色診斷端點（SMCD／JMD／TED）後**仍接續**該測試組主動測試 FN 之去向 — 否則 Lumbar Locked 之「若先前無橘色框發現」永無可達情境；疼痛端點依通則結束流程。
   - 髖外轉／內轉（ref §3.6.2–§3.6.3）：坐姿被動旋轉 DN 之橘色端點後**仍接續**俯臥主動測試（由俯臥 FN 之「若 Seated Passive Rotation 為 DN」反推原圖有此連線）；且該條件以 `hasFindings`（同流程屈髖位 JMD/TED finding）表達而非 `priorResult` — 經主動坐姿 FN 直達俯臥測試時坐姿被動未測，`priorResult` 缺值會在正常引導路徑觸發不必要的人工擇一。
4. **記錄範圍近似**：原文「髖或脊椎伸展活動度異常」（ref §3.5.3）等部位限定語，以 `findingTypeIn: ["JMD","TED"]`（全紀錄範圍）近似 — 同一次 Breakout 紀錄內的流程鏈即該部位脈絡。
5. **`priorResult` 僅在同流程內查找**：跨流程同名節點（如 `activeLumbarLockedIrExtensionRotation` 同時存在於脊椎伸展、上半身伸展、多節段旋轉流程）各自獨立。
6. **不分側測試標記（`sideIndependent`）**：依 §5.3.3 #8，流程內本身不分側之測試標 `sideIndependent: true`，雙側頂層動作之另一側已測時 UI 帶入前值供確認、可改測（查另一側同 `(flowKey,nodeKey)` 之 result）。現標記：`vestibularCoreBreakout` 之 `vestibularCtsibStaticHead`、`ctsibDynamicHead`（CTSIB，§5.3.3 #8 明列之例；其入口 `singleLegStance` 為 bilateral）；半跪窄底面積、四足對角線等側別語意曖昧者保守不標，俟臨床確認再增補。

## 5.4 評估流程（資料面）

```
建立評估紀錄（綁定個案、評估者、日期）
        ↓
逐項判讀 10 大動作 → 每項記 dysfunctional / painful / failedCriteria / notes
        ↓
DN（優先）與 DP → Breakout 引導流程（依決策樹逐步施測，自動累積 findings 與
classification；亦可自由紀錄）；FP 僅記錄疼痛
        ↓
產生總覽：各分類數量、疼痛部位清單、功能異常部位清單、Breakout findings 一覽
        ↓
（選用）將發現標註回人體模型對應部位 bodyAnnotation
```

評估與人體模型的連動為 **3D 專用**（2D 執行期檢視器已移除）；由評估發現標註至模型、以及自模型反向高亮對應評估項目，皆對 3D 檢視器運作。

## 5.5 給非治療師的提醒

- 本 APP 的角色是**紀錄與視覺化工具**，判讀仍由具資格的物理治療師依其專業執行。
- 各動作的角度與標準取自 SFMA 參考資料；臨床應用請以治療師判斷與最新版 SFMA 手冊為準。

## 5.6 授權與智財（待商業決策）

- 「SFMA」為 Functional Movement Systems（FMS）之商標；其計分表與流程圖內容受版權保護（參考 PDF 即聲明未經書面同意禁止重製）。
- 本設計將 SFMA 的計分結構與測試流程數位化為 APP 內表單，供臨床紀錄之用。**若 APP 對外發布或商業化，應先向權利方確認授權條件**。
- 取得授權前的替代方案：僅供內部／個人使用；不重製原版表單版面與原文；或改以中性的自訂評估範本呈現。
- 此為商業決策，在此記錄風險與選項。評估模組為**資料驅動**（題項由 `sfmaPatterns.json`、Breakout 決策樹由 `sfmaBreakoutFlows.json` 定義生成；後者為原版流程圖之數位化，與 [`../ref/SFMA_form.md`](../ref/SFMA_form.md) 同受本節授權注意約束），未來若需替換或改寫題項，不影響程式架構。
- **解剖圖資授權**：3D／2D 圖資以開源資源加工 — Z-Anatomy（CC BY-SA 4.0，上游 BodyParts3D）為解剖 mesh 主體、骨架取自 MakeHuman（匯出模型 CC0）。義務：**標示來源**（含 BodyParts3D 指定字串）與**資產檔以 CC BY-SA 散布**（保持開放）；ShareAlike 只及於資產改作、APP 程式碼不受影響，copyleft 僅源於 Z-Anatomy mesh。與 SFMA 授權同列「對外發布／商業化前確認」關卡。詳見 [04_human_model.md](04_human_model.md) §4.6.1。
