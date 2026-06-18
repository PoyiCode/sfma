# 06 — 資料模型與 JSON 結構

> 本文件定義各資料的 JSON 結構。所有鍵名一律 **camelCase**（不使用 snake_case，見 [07_dev_conventions.md](07_dev_conventions.md)）。
>
> 儲存分階段（見 [02_architecture.md](02_architecture.md)）：**開發期單機，IndexedDB 為真實來源，提供 JSON 匯出／匯入；未來上傳 PostgreSQL**。此處的 JSON 結構同時是 IndexedDB 儲存格式、**匯出檔格式**、與未來 API 的 DTO，三者一致 — 換儲存來源不換資料模型。

## 6.1 通則

- 每筆資料含 `schemaVersion`，供未來遷移。
- 識別碼欄位以 `xxxId` 命名（`patientId`、`sessionId`、`anatomyId`…）。
- 時間以 ISO 8601 字串（含時區），如 `2026-06-12T09:30:00+08:00`。
- 列舉值：SFMA 分類沿用標準碼 `FN`／`FP`／`DN`／`DP`（為衍生值，由 `dysfunctional` × `painful` 推導，見 6.3）；側別用 `left`／`right`／`null`（單一動作為 `null`）。
- 多語系文字以物件表示：`{ "zh-TW": "...", "en": "..." }`，預設顯示 zh-TW。

## 6.2 個案 Patient

開發期為**手動輸入**。`patientId` 由系統自動產生（**UUID**，見 6.6），不需使用者輸入；表單必填僅 `name`，並可另填人類可讀的 `displayCode`（未填時自動編號，如 `P0001`）— 兩者合計對應草稿的「ID + 姓名」。其餘欄位為未來擴充，開發期選填。

```json
{
  "schemaVersion": 1,
  "patientId": "9f6f2af0-5f24-44f3-9b1e-2c7a1c1d4b5e",
  "displayCode": "P0001",
  "name": "王小明",

  "gender": "male",
  "birthDate": "1980-05-01",
  "contact": { "phone": "", "email": "" },
  "notes": "",
  "createdAt": "2026-06-12T09:00:00+08:00",
  "updatedAt": "2026-06-12T09:00:00+08:00",
  "consentAcknowledgedAt": "2026-06-12T09:00:00+08:00"
}
```

| 欄位 | 型別 | 必填 | 說明 |
| --- | --- | --- | --- |
| `patientId` | string(UUID) | ✓（系統產生） | 個案唯一識別碼，建立時自動產生 |
| `displayCode` | string | — | 人類可讀代碼（未填時自動編號），供顯示與搜尋 |
| `name` | string | ✓ | 姓名 |
| `gender` | string | — | `male`／`female`／`other` |
| `birthDate` | string(date) | — | 出生日期 |
| `contact` | object | — | 聯絡方式 |
| `notes` | string | — | 備註 |
| `createdAt`／`updatedAt` | string(datetime) | — | 建立／更新時間 |
| `consentAcknowledgedAt` | string(datetime) | ✓（建立時確認） | 告知同意確認時間戳；新增個案時取得當事人同意後寫入，未取得不建立個案（08 §8.5、03 §3.3.6） |

## 6.3 評估紀錄 AssessmentSession

一次完整 SFMA 評估為一筆，綁定個案與評估者。開發期無帳號，`assessor` 由設定頁「治療師資料」預設帶入（儲存於 AppSettings，見 6.10），可於評估時修改。

```json
{
  "schemaVersion": 1,
  "sessionId": "S20260612-0001",
  "patientId": "P0001",
  "assessor": { "assessorId": "T01", "name": "李治療師" },
  "assessedAt": "2026-06-12T09:30:00+08:00",

  "patterns": [
    {
      "patternKey": "cervicalFlexion",
      "side": null,
      "dysfunctional": true,
      "painful": false,
      "failedCriteria": ["cannotTouchSternumToChin"],
      "notes": ""
    },
    {
      "patternKey": "cervicalRotation",
      "side": "right",
      "dysfunctional": true,
      "painful": true,
      "failedCriteria": ["noseNotAlignedMidClavicle"],
      "notes": "右轉誘發頸部疼痛"
    },
    {
      "patternKey": "cervicalRotation",
      "side": "left",
      "dysfunctional": false,
      "painful": false,
      "failedCriteria": [],
      "notes": ""
    }
  ],

  "breakouts": [
    {
      "patternKey": "cervicalRotation",
      "side": "right",
      "entryFlowKey": "cervicalRotationBreakout",
      "steps": [
        { "flowKey": "cervicalRotationBreakout", "nodeKey": "activeSupineCervicalRotation80", "result": "DN", "notes": "" },
        { "flowKey": "cervicalRotationBreakout", "nodeKey": "passiveSupineCervicalRotation80", "result": "FN", "notes": "" }
      ],
      "findings": [
        { "flowKey": "cervicalRotationBreakout", "nodeKey": "passiveSupineCervicalRotation80", "findingKey": "activeCervicalSpineRotationSmcd", "findingType": "SMCD" }
      ],
      "classification": "SMCD",
      "notes": ""
    }
  ],

  "bodyAnnotations": [
    {
      "annotationId": "A001",
      "anatomyId": "muscle.sternocleidomastoid",
      "side": "right",
      "findingType": "painful",
      "linkedPatternKey": "cervicalRotation",
      "note": "右側胸鎖乳突肌相關"
    }
  ],

  "summary": {
    "counts": { "FN": 11, "FP": 1, "DN": 2, "DP": 1 },
    "painfulPatterns": ["cervicalRotation:right", "singleLegStance:left"],
    "dysfunctionalPatterns": ["cervicalFlexion", "multiSegmentalFlexion", "cervicalRotation:right"]
  }
}
```

> 上例為**節錄**：`patterns` 僅示意 3 筆（完整評估共 15 筆判讀紀錄），`summary` 則為整場評估的推導結果，故引用了節錄外的紀錄（如 `multiSegmentalFlexion`、`singleLegStance:left`）。

### patterns[]（頂層 10 大動作判讀）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `patternKey` | string | 動作鍵（見 6.4） |
| `side` | string\|null | `left`／`right`／`null`（單一動作） |
| `dysfunctional` | boolean | 功能是否異常（UI 依 `failedCriteria` 勾選自動帶入，治療師可覆寫） |
| `painful` | boolean | 是否疼痛 |
| `failedCriteria` | string[] | 未通過的判讀標準碼（見 6.4） |
| `notes` | string | 備註 |

> 雙側動作以兩筆（`side: "left"`／`"right"`）表示。
>
> FN／FP／DN／DP 為**衍生值，不入庫**：FN＝無異常無痛、FP＝無異常有痛、DN＝異常無痛、DP＝異常有痛；於顯示與 summary 即時推導，避免欄位間矛盾（如 category 為 DN 卻 painful 為 true）。

### breakouts[]（二階定位 — 引導流程紀錄，選用）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `patternKey`／`side` | string | 對應的頂層動作（雙側動作左右各一筆） |
| `entryFlowKey` | string | 入口流程（`flowKey` 清單見 [05_assessment.md](05_assessment.md) 5.3.1） |
| `steps[]` | object[] | 依施測順序：`flowKey`、`nodeKey`、`result`（FN/FP/DP/DN 或節點特殊選項碼）、`notes`。主／被動與判準屬節點定義（見 6.4），不入庫 |
| `findings[]` | object[] | **衍生** — 引導引擎依分支結局自動寫入：`flowKey`、`nodeKey`、`findingKey`、`findingType`（`SMCD`／`JMD`／`TED`／`PAIN`／`OTHER` — OTHER 為前庭、本體感覺等其他功能障礙，見 [05_assessment.md](05_assessment.md) 5.3）；顯示文字由定義檔解析。自由模式由治療師手動挑選 |
| `classification` | string | 主要分類：預設由 `findings` 推導（含 PAIN → `PAIN`；否則取第一筆 finding 類型），治療師可覆寫（[05_assessment.md](05_assessment.md) 5.3.4） |
| `notes` | string | 備註 |

### bodyAnnotations[]（與人體模型連動，選用）

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| `annotationId` | string | 標註識別碼 |
| `anatomyId` | string | 對應解剖實體（見 6.5） |
| `side` | string\|null | 側別 |
| `findingType` | string | `painful`／`dysfunctional`／`note` |
| `linkedPatternKey` | string | 關聯的動作 |
| `note` | string | 說明 |

### summary（總覽 — 衍生快取，由 patterns 推導）

| 欄位 | 說明 |
| --- | --- |
| `counts` | 各分類數量，**以判讀紀錄為單位**：10 大動作中 5 項雙側（左右各一筆），共 **15 筆** |
| `painfulPatterns` | 出現疼痛的紀錄（FP 與 DP，含側別），疼痛優先處理 |
| `dysfunctionalPatterns` | 功能異常的紀錄（DN 與 DP，含側別） |

> `summary` 為**衍生快取**：唯一寫入點為資料層的推導函式 — `patterns` 每次變更即重算寫回，UI 只讀不改；**匯入時忽略檔內 `summary`，一律重新推導覆蓋**（見 6.7）。如此匯出檔自包含（總覽可直接閱讀），又不會與 `patterns` 脫節。

## 6.4 SFMA 定義資料（動作鍵、判讀標準與 Breakout 流程）

`patternKey`（camelCase）：

| patternKey | 動作 | 側別 |
| --- | --- | --- |
| `cervicalFlexion` | 頸椎屈曲 | 單一 |
| `cervicalExtension` | 頸椎伸展 | 單一 |
| `cervicalRotation` | 頸椎旋轉 | 左／右 |
| `upperExtremityPattern1Mre` | 上肢模式一（MRE） | 左／右 |
| `upperExtremityPattern2Lrf` | 上肢模式二（LRF） | 左／右 |
| `multiSegmentalFlexion` | 多節段屈曲 | 單一 |
| `multiSegmentalExtension` | 多節段伸展 | 單一 |
| `multiSegmentalRotation` | 多節段旋轉 | 左／右 |
| `singleLegStance` | 單腳站立 | 左／右 |
| `overheadDeepSquat` | 過頭深蹲 | 單一 |

`failedCriteria` 標準碼（對應 [05_assessment.md](05_assessment.md) 5.2 的判讀標準）。完整代碼表：

| patternKey | 標準碼 | 判讀標準 |
| --- | --- | --- |
| `cervicalFlexion` | `cannotTouchSternumToChin` | 下巴無法觸及胸骨 |
| `cervicalExtension` | `notWithin10DegreesOfParallel` | 未達與水平面 10 度內 |
| `cervicalRotation` | `noseNotAlignedMidClavicle` | 鼻尖未對齊鎖骨中線 |
| `upperExtremityPattern1Mre` | `notReachInferiorAngleOfScapula` | 未達肩胛骨下角 |
| `upperExtremityPattern2Lrf` | `notReachSpineOfScapula` | 未達肩胛棘 |
| `multiSegmentalFlexion` | `cannotTouchToes` | 無法觸及腳趾 |
| `multiSegmentalFlexion` | `sacralAngleUnder70` | 薦椎角度 < 70 度 |
| `multiSegmentalFlexion` | `nonUniformSpinalCurve` | 脊柱曲線不均勻 |
| `multiSegmentalFlexion` | `lackPosteriorWeightShift` | 缺乏後方重心轉移 |
| `multiSegmentalExtension` | `ueNotMaintain170` | 上肢未達或無法維持 170 度 |
| `multiSegmentalExtension` | `asisNotClearToes` | 髂前上棘未超過腳趾 |
| `multiSegmentalExtension` | `scapulaSpineNotClearHeels` | 肩胛棘未超過腳跟 |
| `multiSegmentalExtension` | `nonUniformExtensionCurve` | 脊柱伸展曲線不均勻 |
| `multiSegmentalRotation` | `pelvisRotationUnder50` | 骨盆旋轉 < 50 度 |
| `multiSegmentalRotation` | `shoulderRotationUnder50` | 肩部旋轉 < 50 度 |
| `multiSegmentalRotation` | `spinePelvicDeviation` | 脊柱／骨盆偏移 |
| `multiSegmentalRotation` | `excessiveKneeFlexion` | 膝過度屈曲 |
| `singleLegStance` | `eyesOpenUnder10s` | 睜眼 < 10 秒 |
| `singleLegStance` | `eyesClosedUnder10s` | 閉眼 < 10 秒 |
| `singleLegStance` | `lossOfHeight` | 失去高度 |
| `overheadDeepSquat` | `lossOfUeStartPosition` | 上肢失去起始位置 |
| `overheadDeepSquat` | `tibiaTorsoNotParallel` | 脛骨與軀幹未達平行或更佳 |
| `overheadDeepSquat` | `thighsNotBreakParallel` | 大腿未低於水平 |
| `overheadDeepSquat` | `lossOfSagittalAlignment` | 失去矢狀面對位（原表此項分左右；APP 記於該側的判讀紀錄） |
| （全部動作） | `excessiveEffortOrControl` | 過度用力／動作控制不足（顯示文字依動作含「明顯不對稱」「重心偏移」等變體） |

題項定義獨立為資料檔（`packages/definitions` 的 `sfmaPatterns.json`），UI 由其生成；單一動作的定義格式如下：

```json
{
  "patternKey": "multiSegmentalFlexion",
  "name": { "zh-TW": "多節段屈曲", "en": "Multi-Segmental Flexion" },
  "side": "single",
  "criteria": [
    { "code": "cannotTouchToes",       "label": { "zh-TW": "無法觸及腳趾",        "en": "Cannot touch toes" } },
    { "code": "sacralAngleUnder70",     "label": { "zh-TW": "薦椎角度 < 70 度",     "en": "Sacral angle < 70°" } },
    { "code": "nonUniformSpinalCurve",  "label": { "zh-TW": "脊柱曲線不均勻",      "en": "Non-uniform spinal curve" } },
    { "code": "lackPosteriorWeightShift","label": { "zh-TW": "缺乏後方重心轉移",    "en": "Lack of posterior weight shift" } },
    { "code": "excessiveEffortOrControl","label": { "zh-TW": "過度用力／動作控制不足","en": "Excessive effort / lack of motor control" } }
  ]
}
```

### Breakout 流程定義（sfmaBreakoutFlows.json）

二階 Breakout 的 16 個決策樹流程同樣獨立為資料檔（`packages/definitions` 的 `sfmaBreakoutFlows.json`），引導引擎與 UI 由其生成。流程清單（`flowKey`）與入口對應見 [05_assessment.md](05_assessment.md) 5.3.1；**分支與端點以 [`../ref/SFMA_form.md`](../ref/SFMA_form.md) §3 為唯一編碼依據**。單一流程的定義格式（節錄頸屈流程第一節點為例）：

```json
{
  "flowKey": "cervicalFlexionBreakout",
  "name": { "zh-TW": "頸屈受限 Breakout", "en": "Limited Cervical Flexion" },
  "sourceRef": "doc/ref/SFMA_form.md §3.1.1",
  "startNodeKey": "activeSupineCervicalFlexion",
  "nodes": [
    {
      "nodeKey": "activeSupineCervicalFlexion",
      "name": { "zh-TW": "主動仰臥頸屈（下巴觸胸）", "en": "Active Supine Cervical Flexion (Chin to Chest)" },
      "mode": "active",
      "criterion": { "zh-TW": "下巴觸胸", "en": "Chin to chest" },
      "resultOptions": ["FN", "DN", "DP", "FP"],
      "branches": [
        {
          "when": { "resultIn": ["FN"] },
          "outcomes": [
            { "kind": "finding", "findingKey": "posturalSmcdCervicalFlexion", "findingType": "SMCD",
              "label": { "zh-TW": "姿勢性 SMCD 影響頸屈", "en": "Postural SMCD affecting Cervical Flexion" } }
          ]
        },
        {
          "when": { "resultIn": ["DN", "DP", "FP"] },
          "outcomes": [ { "kind": "next", "nodeKey": "passiveSupineCervicalFlexion" } ]
        }
      ]
    }
  ]
}
```

| 欄位 | 說明 |
| --- | --- |
| `startNodeKey` | 流程起始節點 |
| `nodes[].mode` | `active`／`passive`（主／被動屬節點定義，session 的 `steps[]` 不另存） |
| `nodes[].criterion` | 判準（含角度，如「50°」），顯示用多語系文字 |
| `nodes[].resultOptions` | 結果選項：標準 `FN`／`FP`／`DP`／`DN`；依原圖增列特殊選項碼（camelCase），如 `fnBilateral`、`bilateralDysfunctional`／`unilateralDysfunctional`、`switchesSides`、`fnKneeStraight`、`fnHipAbducted`、`fnHipAbductedKneeStraight`、`improvedNotFull` |
| `branches[].when` | 條件（可組合）：`resultIn`（本節點結果）、`priorResult: { nodeKey, resultIn }`（同次 Breakout 先前節點結果）、`hasFindings`（本次已累積之 findings，**預設排除 `PAIN`** — 原圖「橘色框」語句；可加 `inFlow`／`findingTypeIn` 篩選，`findingTypeIn` 明確列入 `PAIN`／`OTHER` 時一併檢查，表達 ref §3.7.2「無紅、橘、藍框」條件） |
| `branches[].outcomes[]` | 結局（可複合）：`next`（接續節點）、`finding`（產出發現：`findingKey`、`findingType`、`label`；不必然終止流程）、`goToFlow`（排入其他流程）、`instruction`（指示端點，如「停止並先處理先前 DN」） |

> 引導引擎的行為規則（步進、佇列、回溯、條件缺失之人工擇一）見 [05_assessment.md](05_assessment.md) 5.3.3。

## 6.5 解剖實體（人體模型共用）

人體模型與評估標註共用同一套解剖實體；2D／3D 皆引用相同 `anatomyId`。

> `anatomyId` 為**語意式識別**（如 `muscle.bicepsBrachii`），是 App 對外識別、與資產來源脫鉤。3D／2D 資產由 FMA 命名之開源來源（BodyParts3D／Z-Anatomy）經 **FMA ↔ anatomyId 對照表（crosswalk）** 正規化產製；匯出 glTF 的 node 名與 2D SVG 圖層 id 皆＝`anatomyId`。詳見 [04_human_model.md](04_human_model.md) §4.6.2。

### 肌肉 muscle

```json
{
  "schemaVersion": 1,
  "anatomyId": "muscle.bicepsBrachii",
  "type": "muscle",
  "name": { "zh-TW": "肱二頭肌", "en": "Biceps Brachii" },
  "layer": "superficial",
  "symmetry": "paired",
  "relatedJoints": ["joint.elbow"],
  "actions": [ { "jointId": "joint.elbow", "action": "flexion" } ],
  "innervation": ["nerve.musculocutaneous"]
}
```

| 欄位 | 說明 |
| --- | --- |
| `layer` | `superficial`（表層）／`deep`（深層），對應分層開關 |
| `symmetry` | `paired`（成對）／`midline`（中線）— 刻意不命名為 `side`，與判讀紀錄的 `side`（left／right）區分。**注**：`symmetry` 僅 muscle 型帶；其餘型別之 laterality 由資產管線承載（`manifestV1.json` 成對 entry 之明確 `side` 欄）。選取與標註的左右軸以 partKey `anatomyId@side` 表達（成對部位左右獨立選取），見 [04_human_model.md](04_human_model.md) §4.1 |
| `relatedJoints` | 跨越的關節，供肌肉色彩推導 |
| `actions` | 對各關節的作用（屈／伸／旋…），供收縮／伸展判斷 |
| `innervation` | 神經支配 |

- 深層/小肌補齊 5 件（皆雙側、**重用既有 `muscle` 型、無新型**）：`muscle.interspinales`（棘間肌、deep、聚合頸/胸/腰 3 部）、`muscle.intertransversarii`（橫突間肌、deep、聚合背/腹 2 部）、`muscle.pyramidalis`（錐狀肌、superficial）、`muscle.transversusThoracis`（胸橫肌、deep）、`muscle.adductorMinimus`（內收最小肌、deep）。各 entity 以 per-entity `maxTriangles:800` 上限守預算。actions／innervation 屬教科書佔位（pyramidalis 神經實為 subcostal T12、以既有 `nerve.intercostal` 佔位），發布前須 ⚠ PT 審閱定版。

### 神經 nerve

```json
{
  "schemaVersion": 1,
  "anatomyId": "nerve.musculocutaneous",
  "type": "nerve",
  "name": { "zh-TW": "肌皮神經", "en": "Musculocutaneous Nerve" }
}
```

### 骨骼 bone

```json
{
  "schemaVersion": 1,
  "anatomyId": "bone.humerus",
  "type": "bone",
  "name": { "zh-TW": "肱骨", "en": "Humerus" }
}
```

- 結構為 **minimal 型**（僅 base＋`type`）。多子件骨以匯出管線 `sourceObjects` join 聚合為**單一邏輯骨**（選取/標籤粒度＝邏輯骨）：脊柱（`bone.cervicalVertebrae`＝C1–C7…）、胸廓（`bone.ribs`＝12 肋／`bone.costalCartilages`／`bone.sternum`）、顱（`bone.cranium`＝神經顱＋面顱融合）等。
- **手足遠端骨架**：`bone.hand`（手部骨骼＝腕 8＋掌 5＋指 14＝27 骨/側 join）、`bone.foot`（足部骨骼＝跗 7＋蹠 5＋趾 14＝26 骨/側 join），皆雙側，補腕/踝遠端缺口（手足內在肌之骨支架）。粒度沿用上述聚合先例；實心閉合骨可靠減面，以管線 per-entity `maxTriangles` 上限控其三角面預算佔用（04 §4.3.6）。

### 韌帶 ligament

```json
{
  "schemaVersion": 1,
  "anatomyId": "ligament.anteriorCruciateLigament",
  "type": "ligament",
  "name": { "zh-TW": "前十字韌帶", "en": "Anterior Cruciate Ligament" }
}
```

- 韌帶為被動穩定結構（如膝十字 ACL/PCL、脊椎前縱／後縱／黃韌帶），對 PT 高臨床價值（ACL 撕裂、脊椎穩定/狹窄）。
- 結構為 **minimal 型**（僅 base＋`type`）：不帶 `relatedJoints`／`function`——膝/脊椎 joint 實體尚未建，避懸空參考。
- 涵蓋 **13 條**：膝十字 ACL/PCL、脊椎前縱／後縱／黃韌帶等 5 條，加 8 條源料確存之高價值具名韌帶——**骨間膜**（前臂 `ligament.interosseousMembraneForearm`／小腿 `ligament.interosseousMembraneLeg`＝旋轉穩定/脛腓聯合高位踝扭傷）、長足底韌帶（足弓）、股骨頭韌帶（圓韌帶）、後薦髂韌帶（薦髂/下背）、肋骨頭放射狀韌帶（肋椎）、指/趾間關節側副韌帶。`ligament` 為傘類，骨間膜（interosseous membrane）亦歸此型。（標準資產納入、被動結構層預設隱藏）。經典膝/踝/肘側副韌帶（MCL/LCL/ATFL/CFL/UCL/RCL）源料未以該名良模，待源料重模。
- 名稱屬臨床佔位，發布前須 ⚠ PT 審閱定版（同其餘解剖種子）。

### 椎間盤 disc

```json
{
  "schemaVersion": 1,
  "anatomyId": "disc.l5S1",
  "type": "disc",
  "name": { "zh-TW": "椎間盤 L5–S1", "en": "Intervertebral Disc L5–S1" }
}
```

- 椎間盤為椎體間纖維軟骨被動結構（突出 herniation／退化 DDD＝脊椎主訴核心），PT 高臨床價值。
- 結構同韌帶之 **minimal 型**（僅 base＋`type`）：不帶 `relatedJoints`／盤內 nucleus/annulus 細部——與 `joint.spine` 耦合為後續。
- anatomyId 以相鄰兩椎節命名（camelCase）：`disc.c2C3`…`disc.c7T1`／`disc.t1T2`…`disc.t12L1`／`disc.l1L2`…`disc.l5S1`（全脊椎 23 節；C1–C2 無盤、薦椎融合無盤＝解剖正確）。
- 名稱屬臨床佔位，發布前須 ⚠ PT 審閱定版（同其餘解剖種子）。

### 關節囊 capsule

```json
{
  "schemaVersion": 1,
  "anatomyId": "capsule.knee",
  "type": "capsule",
  "name": { "zh-TW": "膝關節囊", "en": "Knee Joint Capsule" }
}
```

- 關節囊為包覆滑膜關節之纖維被動結構，PT 高臨床價值：**capsular pattern**（Cyriax 關節囊型受限）、沾黏性肩關節囊炎（frozen shoulder）、髖/膝 OA 關節囊緊縮、TMJ 障礙。
- 結構同韌帶/椎間盤之 **minimal 型**（僅 base＋`type`）：不帶 `relatedJoints`（與對應 joint 耦合為後續）。
- 涵蓋 **16 關節囊（皆雙側）**：4 大肢端〔`capsule.glenohumeral`／`hip`／`knee`／`elbow`〕＋12 主要滑膜關節〔`radiocarpal`／`acromioclavicular`／`sternoclavicular`／`temporomandibular`／`superiorTibiofibular`＋指趾關節囊群 `metacarpophalangeal`／`metatarsophalangeal`／`proximalInterphalangealHand`／`distalInterphalangealHand`／`proximalInterphalangealFoot`／`distalInterphalangealFoot`／`interphalangealGreatToe`〕。指趾關節囊以**整組單一 anatomyId**（源料即整組 mesh，比照肌群）。
- **資產眉角**：關節囊為開殼結構，`layerMaxTriangles.capsule=500`；**開殼 COLLAPSE floor 之減面/預算須於 GLB 重生確認（待 Blender，見 §4.3.6）**。
- 名稱屬臨床佔位，發布前須 ⚠ PT 審閱定版（同其餘解剖種子）。

### 關節盤 articularDisc

```json
{
  "schemaVersion": 1,
  "anatomyId": "articularDisc.temporomandibular",
  "type": "articularDisc",
  "name": { "zh-TW": "顳顎關節盤", "en": "Temporomandibular Articular Disc" }
}
```

- 關節盤為**滑膜關節內纖維軟骨盤**（與 `disc`＝椎間盤 intervertebral 分立），PT 臨床價值：顳顎關節障礙（**TMD**：關節盤前移位 with/without reduction、開口卡頓/絞鎖、顏面/口顎物理治療）。
- 結構同韌帶/椎間盤/關節囊之 **minimal 型**（僅 base＋`type`）：不帶 `relatedJoints`（與對應 joint 耦合為後續）。
- 涵蓋 **3 件關節盤**：顳顎關節盤 `articularDisc.temporomandibular`＋膝**外側/內側半月板** `articularDisc.lateralMeniscus`／`articularDisc.medialMeniscus`（半月板為 articular disc 之一種；半月板撕裂為 MSK-PT 最高頻主訴之一）。
- **資產眉角**：**最終減面品質/預算須於 GLB 重生確認（待 Blender）**。盂唇/髖臼唇另立 `labrum` 型（見下，為纖維軟骨「緣」非「盤」）；TFCC 待源料。
- 名稱屬臨床佔位，發布前須 ⚠ PT 審閱定版（同其餘解剖種子）。

### 筋膜 fascia

```json
{
  "schemaVersion": 1,
  "anatomyId": "fascia.thoracolumbar",
  "type": "fascia",
  "name": { "zh-TW": "胸腰筋膜", "en": "Thoracolumbar fascia" }
}
```

- 筋膜為**包覆肌肉之纖維結締組織鞘膜**（含腱膜 aponeurosis＝特化扁平筋膜，如帽狀腱膜/足底腱膜/掌腱膜），同韌帶/關節囊屬被動結構。PT 高臨床價值：胸腰筋膜（下背痛/核心傳力）、足底腱膜（足底筋膜炎）、闊筋膜/髂脛束（外側膝/髖）、掌腱膜（Dupuytren 攣縮）。
- 結構同韌帶/椎間盤/關節囊/關節盤之 **minimal 型**（僅 base＋`type`）。
- 涵蓋 **14 件 curated 主要筋膜**（使用者「Include fascia」＋擇 Curated major set）：帽狀腱膜 `fascia.epicranialAponeurosis`〔頭頂冠部覆蓋、回應 57 頭皮關切〕、胸腰筋膜、闊筋膜、小腿/前臂/臂筋膜、足底/掌腱膜、腹橫/腹壁包覆筋膜、胸肌/鎖胸筋膜、頸部封套筋膜、髂腰肌筋膜。
- **資產眉角（04 §4.3.6）**：筋膜為**開殼鞘膜**——減面 floor 偏高、且視覺遮蔽其下肌肉；故預設隱藏（passiveStructure，標準資產納入）。其餘 ~50 筋膜/腱膜/支持帶採 demand-first，未納入種子。
- 名稱屬臨床佔位，發布前須 ⚠ PT 審閱定版（同其餘解剖種子）。

### 滑囊 bursa

```json
{
  "schemaVersion": 1,
  "anatomyId": "bursa.subacromial",
  "type": "bursa",
  "name": { "zh-TW": "肩峰下滑囊", "en": "Subacromial bursa" }
}
```

- 滑囊為**充液之纖維囊**，降肌腱/骨摩擦；同韌帶/關節囊/筋膜屬被動結構。PT 高臨床價值＝**滑囊炎 bursitis**：肩峰下/三角肌下（肩夾擠）、大轉子（GTPS）、髕前（女僕膝）、鵝足（內側膝/跑者）、半膜肌（貝克氏囊腫）。
- 結構同韌帶/椎間盤/關節囊/關節盤/筋膜之 **minimal 型**（僅 base＋`type`）。
- 涵蓋 **8 件 curated 臨床滑囊**：肩峰下 `bursa.subacromial`、臀中肌轉子＋皮下轉子（GTPS）、皮下髕前/深層髕下、肱三頭肌腱下（鷹嘴）、鵝足、半膜肌。
- **資產眉角（04 §4.3.6）**：滑囊為小囊（源料 48–192 polyCount）但**多島嶼→減面 floor 高**（~1,472/側、無法降至 cap 500），預設隱藏（passiveStructure，標準資產納入）。其餘 ~70 滑囊採 demand-first，未納入種子。
- 名稱屬臨床佔位，發布前須 ⚠ PT 審閱定版（同其餘解剖種子）。

### 關節唇 labrum

```json
{
  "schemaVersion": 1,
  "anatomyId": "labrum.acetabular",
  "type": "labrum",
  "name": { "zh-TW": "髖臼唇", "en": "Acetabular Labrum" }
}
```

- 關節唇為**滑膜關節窩緣之纖維軟骨「唇/緣」**（與 `articularDisc`＝關節內纖維軟骨「盤」區辨：labrum 環窩緣、非盤），同其餘被動結構歸 `passiveStructure` 層。PT 高臨床價值：髖臼唇撕裂／股骨髖臼夾擠（**FAI**）、肩盂唇撕裂／肩不穩（**SLAP**）。
- 結構同韌帶/椎間盤/關節囊/關節盤之 **minimal 型**（僅 base＋`type`）。
- 涵蓋 **2 件（皆雙側）**：髖臼唇 `labrum.acetabular`、肩盂唇 `labrum.glenoid`。manifest 設 `layer:"labrum"`＋`layerColors.labrum`＝赭橙 `#D98C5F`＋`layerMaxTriangles.labrum=500`。
- **資產眉角**：盂唇/髖臼唇為**開殼緣**，COLLAPSE floor 之減面/預算須於 GLB 重生確認（待 Blender、§4.3.6）。
- 名稱屬臨床佔位，發布前須 ⚠ PT 審閱定版（同其餘解剖種子）。

### 肌群 muscleGroup

```json
{
  "schemaVersion": 1,
  "anatomyId": "muscleGroup.quadriceps",
  "type": "muscleGroup",
  "name": { "zh-TW": "股四頭肌", "en": "Quadriceps" },
  "layer": "superficial"
}
```

- 肌群原為**精簡版「肌群合併 mesh」之選取單位**。細節版/精簡版雙 export profile 已收斂為單一標準資產，肌群合併**退役**、種子已無 `muscleGroup` instance；**型別保留於 schema** 供未來重新分版。結構＝`base`＋`type`＋`layer`（`superficial`／`deep`，比照 `muscle` 歸 `deepMuscle`／`superficialMuscle` 顯示層）；群組為粗化代表、不帶 `relatedJoints`／`actions`／`innervation`。
- 原規劃 35 件 curated 臨床功能/區域肌群（148 成員肌）；收斂後不再產出，個別肌（含 deltoid／trapezius／latissimusDorsi／sartorius／iliopsoas／diaphragm…）皆逐肌呈現。
- **資產製作**：原以宣告式產生器 `infra/asset-pipeline/buildMuscleGroups.mjs` 合併產出；收斂後產生器已退役（刪除）、manifest 無 `muscleGroup` node。未來重新分版時以 `sourceObjects` join ＋ manifest `profiles` 旗標重新引入即可。

> 分層（見 [04_human_model.md](04_human_model.md) 4.1）與實體的對應：骨骼層＝`type: "bone"`、神經層＝`type: "nerve"`、表層／深層肌群＝`type: "muscle"`（`muscleGroup` 型保留但種子無 instance）依 `layer` 區分；**韌帶 `type: "ligament"`、椎間盤 `type: "disc"`、關節囊 `type: "capsule"`、關節盤 `type: "articularDisc"`、筋膜 `type: "fascia"` 與滑囊 `type: "bursa"` 皆歸專屬「被動結構」顯示層（`passiveStructure`）、隨被動結構開關（預設隱藏、opt-in）**；以 `defaultLayers.passiveStructure` 選填欄位向後相容、免 schema 遷移。骨骼／神經／韌帶／椎間盤／關節囊／關節盤／筋膜／滑囊同樣可選取、標籤。
>
> **區域/神經叢合併（已退役）**：原精簡版以重用 `bone`／`nerve` 型之合併 node 呈現骨骼 5 區域（`bone.upperLimb`／`lowerLimb`／`thoracicCage`／`vertebralColumn`／`skull`）與神經 3 神經叢（`nerve.brachialPlexus`／`lumbarPlexus`／`sacralPlexus`）；雙 profile 收斂後此等合併 node 已自 manifest／definitions 移除，骨骼與神經皆逐件呈現。

### 關節 joint（含 ROM）

```json
{
  "schemaVersion": 1,
  "anatomyId": "joint.elbow",
  "type": "joint",
  "name": { "zh-TW": "肘關節", "en": "Elbow Joint" },
  "degreesOfFreedom": [
    { "axis": "flexionExtension", "min": 0, "max": 145, "neutral": 0, "unit": "deg" }
  ]
}
```

- `degreesOfFreedom[]`：每個自由度一筆，`min`／`max` 即 **ROM 上下限**，3D 關節活動不可超出（見 [04_human_model.md](04_human_model.md)）。
- 上例角度為**佔位值**，正式數值應依文獻設定。

## 6.6 持久化配置（分階段）

| 資料 | 開發期（單機） | 未來（上傳 PostgreSQL） |
| --- | --- | --- |
| 個案 Patient | **IndexedDB（真實來源）** | PostgreSQL 為真實來源，IndexedDB 轉為離線快取 |
| 評估 AssessmentSession | **IndexedDB（真實來源）** | 同上 |
| 設定 AppSettings（含治療師資料，見 6.10） | **IndexedDB（真實來源，單例）** | 未來隨帳號雲端同步（待定） |
| 解剖實體（muscles/nerves/joints） | 隨前端發佈，瀏覽器快取 | 不變（唯讀參考資料） |
| SFMA 定義（sfmaPatterns、sfmaBreakoutFlows） | 隨前端發佈，瀏覽器快取 | 不變（唯讀題項與流程定義） |
| 3D 模型資產（glTF/GLB） | 物件儲存 + CDN，Service Worker 快取 | 不變（唯讀，依 LOD 選取，見 [04_human_model.md](04_human_model.md)） |

- **識別碼**：自開發期即用 **UUID**（`patientId`、`sessionId`…），未來上傳 PostgreSQL 時不會與他機資料衝突；另設人類可讀的 `displayCode`（選填，未填時自動編號，如 `P0001`）供顯示與搜尋（見 6.2）。本文件範例除 6.2 外，為可讀性仍採短代碼。
- 個案資料（含匯出檔）的保護見 [08_security_privacy.md](08_security_privacy.md)。

## 6.7 匯出與匯入（開發期必備功能）

### 匯出

- **範圍**：
  - 單一個案：該個案 + 其全部評估紀錄。
  - 全部資料：所有個案與評估，並附 `settings`（完整備份；見 6.10）。
- **格式**：單一 JSON 封裝檔，內容即本文件的資料結構原樣打包：

```json
{
  "exportVersion": 1,
  "schemaVersion": 1,
  "exportedAt": "2026-06-12T18:00:00+08:00",
  "scope": "patient",
  "patients": [ { "...": "Patient 結構（見 6.2）" } ],
  "assessments": [ { "...": "AssessmentSession 結構（見 6.3）" } ],
  "settings": { "...": "AppSettings 結構（見 6.10）；選用，僅 scope 為 all 時包含" }
}
```

- **檔名慣例**：`ptApp-export-{範圍}-{日期}.json`，例：`ptApp-export-P0001-2026-06-12.json`、`ptApp-export-all-2026-06-12.json`。
- **實作**：瀏覽器端產生檔案，不經任何伺服器。依平台能力遞補：
  1. **File System Access API**（Chromium 桌面）：使用者自選儲存位置。
  2. **Web Share API（含檔案）**：iOS／Android 喚起系統**分享面板** — 存到「檔案」App、AirDrop、傳給其他 App（iOS PWA 的主要匯出路徑）。
  3. 後備：Blob + `<a download>` 觸發下載。

### 匯入

- 讀取同格式檔案，依序四步：**信封驗證**（檢查 `exportVersion`／`schemaVersion` 與頂層結構是否齊備）→ **版本遷移**（`schemaVersion` 落後時先轉換到現行結構，見 6.8）→ **整檔結構驗證**（以共享型別對應的**現行** zod schema 檢查全部內容；失敗即整檔拒絕，不部分寫入）→ **交易性寫入 IndexedDB**（寫入時忽略檔內 `summary`，重新推導覆蓋，見 6.3）。
  - 順序註記：zod schema 只描述**現行**版本結構，故必須「**先遷移、後全驗證**」— 舊版檔案才不會在遷移前被現行 schema 拒絕。
- **衝突處理**：相同識別碼已存在時，由使用者選擇「略過」或「覆蓋」；預設略過。
- **設定套用**：檔內含 `settings`（全部備份）時，詢問是否套用到本機設定；預設略過（見 6.10）。

### 用途

1. 備份與還原（單機開發期資料只在瀏覽器內，匯出是唯一的保全手段）。
2. 跨裝置／跨瀏覽器轉移。
3. **未來上傳 PostgreSQL 的種子資料**：首次上線時以同一格式批次匯入後端。

> 匯出檔含個案個資，檔案的存放與傳遞注意事項見 [08_security_privacy.md](08_security_privacy.md)。

## 6.8 版本與遷移

- 每筆資料的 `schemaVersion` 於載入（含匯入）時檢查；版本落後則套用遷移轉換到最新結構後再使用。
- 解剖資料與 SFMA 定義為唯讀參考資料；個案與評估為使用者資料。

## 6.9 與未來 PostgreSQL 的銜接

- **結構對應**：`patients`、`assessments` 兩張主表；`patterns`／`breakouts`／`bodyAnnotations` 等巢狀結構初期可放 `jsonb` 欄位，需要查詢分析時再正規化成子表。
- **上傳流程**：登入 → 批次上傳本地紀錄（UUID 不衝突）→ 成功後 PostgreSQL 成為真實來源，IndexedDB 轉為離線快取。
- **一致性**：共享型別放於 `packages/shared`（見 [07_dev_conventions.md](07_dev_conventions.md)），`localStore`、`exporter` 與未來的 `apiClient`／後端引用同一份 DTO 定義；鍵名（camelCase）、識別碼與列舉全程一致。

## 6.10 設定資料 AppSettings（含治療師資料）

設定頁的選項（見 [03_ui_ux.md](03_ui_ux.md) 3.3）需持久化：與個案資料同樣存於 **IndexedDB**（單例紀錄，固定 `settingsId: "app"`），經 Repository 介面存取，含 `schemaVersion` 供遷移。

```json
{
  "schemaVersion": 1,
  "settingsId": "app",
  "therapistProfile": { "assessorId": "T01", "name": "李治療師" },
  "locale": "zh-TW",
  "lodMode": "auto",
  "orientationPreference": "auto",
  "defaultLayers": { "bone": true, "deepMuscle": false, "superficialMuscle": true, "nerve": false },
  "theme": "system",
  "updatedAt": "2026-06-12T09:00:00+08:00"
}
```

| 欄位 | 說明 |
| --- | --- |
| `therapistProfile` | 治療師資料：建立評估時 `assessor` 的預設來源（見 6.3） |
| `locale` | 介面語系（預設 `zh-TW`，缺漏回退 en；見 [07_dev_conventions.md](07_dev_conventions.md) 7.4） |
| `lodMode` | `auto`／`simplified`／`full`（`full`＝完整無損、手動 opt-in；見 [04_human_model.md](04_human_model.md) 4.3.5）。精細 `detailed` 階層已移除；舊設定值 `'detailed'` 經 zod preprocess 正規化為 `'simplified'`（同資產、行為不變；不升 `schemaVersion`） |
| `orientationPreference` | `auto`／`portrait`／`landscape` — **盡力而為**，平台限制見 [03_ui_ux.md](03_ui_ux.md) 3.3 |
| `defaultLayers` | 預設顯示分層（對應 [04_human_model.md](04_human_model.md) 4.1）。`bone`／`deepMuscle`／`superficialMuscle`／`nerve` 必填；`passiveStructure`（韌帶／椎間盤／關節囊／關節盤／筋膜／滑囊）**選填**、向後相容既有設定（缺鍵＝隱藏，不升 `schemaVersion`） |
| `theme` | `system`／`light`／`dark` |

- 開發者模式的 console 開關為**執行期狀態**（僅開發建置存在，見 [02_architecture.md](02_architecture.md) 2.11），不入此 schema。
- 匯出與還原：「全部備份」附 `settings`（見 6.7），跨裝置轉移時治療師資料與偏好不遺失；匯入時詢問是否套用，預設略過。
