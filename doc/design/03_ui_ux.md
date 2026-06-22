# 03 — 介面與互動設計

> 執行於**網頁瀏覽器**並以 **PWA** 形式提供（見 [02_architecture.md](02_architecture.md)）。以下方向、響應式與互動設計皆以 Web 實作（CSS 響應式、Pointer Events 統一觸控與滑鼠）。

## 3.1 方向與裝置矩陣

APP 需支援以下組合（取自草稿需求）：

| 方向 | 手機 | 平板 | PC |
| --- | --- | --- | --- |
| 直式 | ✓ | ✓ | — |
| 橫式 | ✓ | ✓ | ✓ |

- **手機直式**：單欄、逐步操作為主（評估逐題、模型全螢幕）。
- **手機橫式**：模型優先，控制項收合為絕對定位浮動工具列（右上、半透明卡片），模型填滿主區。
- **平板直式**：單欄或主從（master-detail）視裝置寬度。
- **平板／PC 橫式**：雙欄／三欄，模型與評估表並排，適合診間衛教。

模型檢視器之版面模式由純函式 `render/viewerLayoutMode(breakpoint, orientation)` 編碼（規則單一來源）：**Compact＋landscape→`modelPriority`**（手機橫式、模型優先）、**Expanded→`sidePanel`**（控制項收為固定寬側欄）、其餘→`standard`（堆疊）；容器 `ModelViewerContent` 以 `useBreakpoint`＋`useOrientation` 算出後傳入，根 `data-layout` 反映、CSS 依此切換 flex 佈局。承接 §3.2 方向訊號。

模型**畫面**整體欄佈局另由純函式 `render/modelPageLayout(breakpoint, orientation)` 決定（檢視器與身體標註清單之並排與否）：寬度足夠時（**Expanded 任一方向**、或 **Medium 橫式**）兩者**並排**（`split`，模型與評估同視、利衛教）；其餘（手機任一、**平板直式單欄**）**堆疊**（`stack`，§3.1 平板直式單欄）。`.modelViewerPage` 以 `data-page-layout` 反映、CSS 切換 flex 方向；`split` 時標註清單收為固定寬側欄（`clamp(280px, 32%, 420px)`）自身捲動。

**iOS 安全區與視口**：`nuxt.config` `app.head`（viewport meta）以 `viewport-fit=cover` 令內容延伸至螢幕邊緣，並以 `env(safe-area-inset-*)` 避讓瀏海／Dynamic Island／home indicator／橫式側邊缺口——AppBar 頂內距與側內距、`appContent` 底／側內距、sticky 底部暫態層（`InstallGuide`／`FirstLaunchNotice`）底內距皆取 `max(原間距, env())`，桌面／非缺口裝置回 0 故零視覺變化。App Shell 高度用 `100dvh`（保 `100vh` 後備）使 iOS 動態工具列顯隱時內容高度正確；`overscroll-behavior-y: contain` 防文件層過捲串聯（誤觸下拉重整／橡皮筋）；`-webkit-tap-highlight-color: transparent` 去 iOS 點按灰閃；表單 input/select 為 16px 以達 iOS 焦點不縮放門檻。

## 3.2 響應式佈局斷點

以邏輯寬度（CSS px）區分佈局，而非裝置型號：

| 斷點 | 寬度範圍 | 佈局 |
| --- | --- | --- |
| Compact | < 600 | 單欄；分頁／步驟導覽；模型與表單全螢幕切換 |
| Medium | 600 – 1024 | 主從雙欄（清單＋內容）；模型可半屏 |
| Expanded | > 1024 | 三欄（導覽＋內容＋模型／屬性）；模型與評估並排 |

方向改變時於同斷點內重排，不重載資料。

方向（直式／橫式）以 `app/useOrientation`（訂閱 `matchMedia('(orientation: landscape)')`，SSR／首繪／無 matchMedia 預設 `portrait`）取得，App Shell 根 `<div.appShell>` 併陳 **`data-orientation`**（同 `data-breakpoint`），各畫面據此於 CSS 內依方向重排。「不重載資料」結構性成立——方向為 CSS／Vue 狀態訊號，不改路由、不重掛元件、不觸發 refetch。

## 3.3 主要畫面與導覽架構

### 3.3.1 畫面樹

```
啟動
 └─ 個案清單（Patient List）
     ├─ 新增／編輯個案（Patient Form）
     └─ 個案詳情（Patient Detail）
         ├─ 評估紀錄清單（Assessment History）
         │   └─ 評估表（SFMA Assessment）
         │       └─ 二階 Breakout 引導流程（選用）
         └─ 人體模型（Human Model Viewer）
全域
 └─ 設定（Settings）：語系、LOD 模式、方向鎖定、預設顯示分層、治療師資料
     └─ 資料管理：匯出全部／匯入還原
```

### 3.3.2 畫面說明

- **個案清單**：搜尋／排序，顯示姓名與 ID（`displayCode`，未填時自動編號，見 [06_data_model.md](06_data_model.md) 6.2）；開發期資料存於本地（IndexedDB）。
- **個案表單**：手動輸入個案個資（開發期欄位見 [06_data_model.md](06_data_model.md)）。
- **個案詳情**：上半部基本資料，下半部分頁切換「評估紀錄」與「人體模型」；提供「**匯出此個案**」（含其全部評估，格式見 [06_data_model.md](06_data_model.md) 6.7）。
- **評估表**：逐項呈現 SFMA 10 大動作，提供疼痛與判讀標準勾選，FN／FP／DN／DP 為即時衍生顯示（不直接勾選，見 [05_assessment.md](05_assessment.md) 5.2）。DN／DP 項可進入**二階 Breakout 引導流程**：步進卡逐一顯示目前測試（名稱、主／被動、判準）與結果選項，依決策樹自動前進並即時累積 findings；提供已走路徑與待測流程佇列顯示、回上一步修改（下游紀錄作廢重走）、疼痛端點顯著提示，亦可切換自由紀錄模式（見 [05_assessment.md](05_assessment.md) 5.3）。
- **人體模型檢視**：3D 畫布、分層開關、標籤開關、視角控制、關節操作（App 為 3D-only）。
- **設定**：語系（預設 zh-tw）、LOD（自動／精簡／完整）、方向鎖定、預設顯示分層、**治療師資料**（預設評估者，見 [06_data_model.md](06_data_model.md) 6.3）、**資料管理**（匯出全部備份／匯入還原；開發期資料僅存於本機，提醒定期匯出）。設定值的持久化結構見 [06_data_model.md](06_data_model.md) 6.10。開發建置之 actionLogger 輸出瀏覽器 console（見 §3.8）。
  - **方向鎖定為盡力而為**：Screen Orientation API 的 `lock()` 於 iOS Safari／PWA 不支援、Android 瀏覽器多要求全螢幕才可鎖定；manifest `orientation` 僅部分平台於安裝後生效。可鎖則鎖；不可鎖時改於方向不符顯示轉向提示，不阻擋操作。

### 3.3.3 App Shell 與斷點映射

App Shell 為單一持久版面元件（對應 [07_dev_conventions.md](07_dev_conventions.md) §7.3 `app/layouts/`），路由視圖渲染進其內容區：

- **頂列 App Bar（持久）**：情境標題（字重 600＋`--tracking-tight` 收緊）＋ 前導區 ＋ 設定 icon ＋ 視需要的 overflow。standalone PWA 下為 APP 自有 bar。
  - **前導區**：非根路徑顯**返回鍵**（堆疊深度 > 1）；根路徑顯 **SFMA 品牌徽記**＝2×2 sage 方格（對角填色，與簽名 `StatusChip`／`SfmaQuadrant` 同構，§3.7.4），佔同一 44px 槽位、保標題置中。
  - **真實 SVG icon**（取代原 `‹`／`⚙` 文字字符）：返回＝chevron-left、設定＝齒輪，`stroke="currentColor"` 隨主題；icon-only 仍配 `aria-label`＋`title`（§3.7.5）。清單列導引箭頭亦改 SVG chevron-right。
- **主內容區**：承載路由視圖。
- **次要／詳情區**（Medium／Expanded）：master-detail。
- **暫態層**：Toast、Dialog、資料保全 Callout（§3.6）浮於 shell 之上，不佔版位。

斷點映射（接 §3.2）：

```
Compact <600        Medium 600–1024       Expanded >1024
┌─────────────┐     ┌──────┬──────────┐   ┌─────┬────────┬──────┐
│ AppBar  ◀ ⚙│     │AppBar         ⚙│   │AppBar            ⚙│
├─────────────┤     ├──────┼──────────┤   ├─────┼────────┼──────┤
│ 路由視圖     │     │ 清單 │ 內容/詳情 │   │清單 │ 內容   │模型/屬性│
└─────────────┘     └──────┴──────────┘   └─────┴────────┴──────┘
   單欄 push/pop        主從雙欄              三欄（§3.2）
```

- Compact：單欄、push/pop 堆疊、返回於頂列。
- Medium／Expanded：清單與內容並存，頂列持久、設定恆在右上。
- App Bar、區域底色／邊框取 §3.7 semantic token（`--color-surface`／`--color-border`）。
- **語系全域即時切換**：`i18n` 以訂閱模式發布語系變更，`AppShell` 於高層訂閱一次，切換語系即令整個路由樹（含各頁、AppBar、暫態層）重繪、`t()` 取最新語系，無需重新導覽；`.appShell` 併陳 `data-locale`（比照 `data-breakpoint`／`data-orientation`）。

### 3.3.4 路由表與 IA

採巢狀路由，params 以 camelCase 對齊 [06_data_model.md](06_data_model.md) ID 命名：

| 路徑 | 畫面 | 備註 |
| --- | --- | --- |
| `/` | 個案清單 | manifest `start_url`、啟動落點 |
| `/patients/new` | 新增個案表單 | |
| `/patients/:patientId` | 個案詳情 | 預設導向 `…/assessments` |
| `/patients/:patientId/edit` | 編輯個案 | |
| `/patients/:patientId/assessments` | 評估紀錄清單 | 詳情分頁 |
| `/patients/:patientId/assessments/new` | 新評估 | |
| `/patients/:patientId/assessments/:sessionId` | 評估表 | Breakout 為本路由頁內狀態（見 §3.3.5） |
| `/patients/:patientId/model` | 人體模型 | 詳情分頁；選填 `?session=<sessionId>` 深連結＝以該評估標註反向高亮部位（見 [04_human_model.md](04_human_model.md) §4.5） |
| `/settings` | 設定 | 頂列 icon 進入；治療師資料／資料管理為頁內區塊 |
| `*` | 找不到路由 | 「找不到」＋回 `/` |

- 詳情分頁＝巢狀路由（`…/assessments` ⇄ `…/model`），可深連結、可被 back，預設導 `assessments`。
- **Breakout 不展開為路由**：`…/assessments/:sessionId` 一路由同時承載判讀表與 Breakout 疊層；stepper 內部步驟為頁內狀態（避免 URL 爆量與 back 地獄）。
- 路由與斷點正交：同一路由於不同斷點渲染不同（compact 全屏／expanded 三欄），路由不變。

### 3.3.5 返回行為

- **預設：瀏覽器／系統 back＝路由層 pop**。Android 系統返回、iOS 邊緣滑動於 standalone PWA 皆映射 `history.back()`。**根路由 `/` 的 back 不攔截** —— 交 OS 退背景。
- **Breakout 與 back 分離**：開啟 Breakout 疊層時推入一個 history entry → **back＝收合整個疊層**回判讀表（單層）；疊層內 **stepper「回上一步」**負責逐步回溯並依 [05_assessment.md](05_assessment.md) §5.3.3 作廢下游重走。破壞性作廢只由 stepper 控制觸發、不因誤觸 back 發生。
- **未存變更守衛**：評估逐步寫入 IndexedDB（中途離開已保存，不需守衛）；守衛只用於**個案表單**等未存草稿 —— 跨 pathname 路由切換（含 back／pop，同頁 query/hash 變動不擾）與 back／關閉分頁時以 navigation blocker ＋ `beforeunload` 觸發 AlertDialog 確認；草稿偵測逐欄比對表單值與初值（create 初值＝空表單、edit＝由 patient 衍生），成功存檔之導航不自攔。

### 3.3.6 首啟流程（安裝引導與告知同意）

兩者分離：

- **首啟通知（資訊性、一次性、非阻擋）**：說明「資料存於本機、請定期匯出」＋安裝引導；dismiss 後以 `AppSettings` 旗標記錄。安裝盡力而為（比照 §3.3.2 方向鎖定）：Chromium 以 `beforeinstallprompt` 延遲後提供「安裝」；iOS 顯示「加入主畫面」指引。
- **告知同意＝個案建立時的閘門**（依 [08_security_privacy.md](08_security_privacy.md) §8.5）：新增個案流程內含告知同意（蒐集目的／項目／範圍／期間／當事人權利），治療師確認「已取得當事人同意」後才寫入；**per-patient** 記錄同意確認時間戳。⟹ 連動 [06_data_model.md](06_data_model.md) `Patient` 增同意確認欄位。

安裝引導為獨立 App Shell 暫態層元件 `app/InstallGuide`，與資料保全通知（§3.6 `FirstLaunchNotice`）分離、各持獨立一次性旗標：Chromium 捕捉 `beforeinstallprompt` 延遲後以「安裝」鈕叫起原生安裝、iOS Safari 顯「加入主畫面」指引；關閉或安裝後寫旗標持久化。**盡力而為**（比照 §3.3.2 方向鎖定）：已安裝（standalone）／不支援平台／已關閉皆不渲染。

### 3.3.7 缺頁、空狀態與載入

- `*` 未知路由 → shell 內「找不到」頁 ＋ 回 `/`。
- **無效 `:patientId`／`:sessionId`**（已刪除，或深連結到本機不存在者）→「找不到此個案／評估」空狀態 ＋ 回清單。**此即裝置本地深連結情境**（某裝置有效 URL 在另一裝置不存在），須優雅處理。
- **空狀態**：個案清單／評估清單無資料 → 引導式空狀態 ＋ 新增 CTA。
- **載入／錯誤**：路由邊界顯示 skeleton；資料層錯誤 → 錯誤狀態 ＋ 重試（接 actionLogger，[07_dev_conventions.md](07_dev_conventions.md) §7.6）。頁面層「資料層錯誤＋重試」統一為原件 `base/PageError`（鏡像 `PageSkeleton`，各頁容器共用），容器 `role="alert"` 使錯誤於非同步失敗後出現時即被輔助技術宣讀（WCAG 2.1 §4.1.3 Status Messages，§3.7.5）。

### 3.3.8 主要畫面版面（wireframe 決策）

承 §3.3.2 畫面說明，本節定各主要畫面的版面、列項與狀態（細節層級供實作）。視覺詞彙取 §3.7（token／`StatusChip`），佈局接 §3.3.3 斷點。

- **個案清單**（`/`）：頂列搜尋 ＋「＋ 新增個案」；列項＝**兩層階層**——左欄上行為**代碼 eyebrow**（mono），下行為**姓名**（重、`--tracking-tight`）；右欄上行為上次評估概況（`StatusChip` Quadrant Mark 之 DN／DP 計數，或「全 FN」「尚無評估」），下行為**日期**（mono 讀值）；列末 SVG chevron-right；hover 以 sage 邊框＋微陰影回饋。概況取自衍生快取（[06_data_model.md](06_data_model.md) §6.3）；空清單顯示引導式空狀態 ＋ CTA。
- **個案表單**（`/patients/new`、`…/edit`）：欄位依 06 §6.2（姓名必填，餘選填）；**告知同意＝表單末同意區（inline）**——末段顯示告知同意（可展開全文）＋必勾「已取得當事人同意」，勾選後「儲存」才可按，存檔即寫 `consentAcknowledgedAt`（§3.3.6）；未存草稿離開觸發守衛（§3.3.5）。
- **個案詳情**（`/patients/:patientId`）：頂列姓名·代碼 ＋ 編輯 ＋ 匯出此個案；下半「評估紀錄 ⇄ 人體模型」——**Compact／Medium 分頁、Expanded 模型常駐第 3 欄**與評估並看（醫病同視，§3.6）；評估紀錄列＝日期·結果概況·評估者 → 開啟，每列附「**看模型**」次要動作深連結至 `/patients/:patientId/model?session=<sessionId>`（以該評估標註反向高亮部位，見 §3.3.4 & 04 §4.5），空狀態 ＋「新評估」CTA。
- **評估表**（`…/assessments/:sessionId`）：頂列個案·日期·進度（n/15）·完成；**列項＝手風琴清單**——每動作一列點開填疼痛＋判讀標準勾選 → 即時衍生 FN/FP/DN/DP（`StatusChip`，[05_assessment.md](05_assessment.md) §5.2），收合顯示結果，雙側左右各一（展開版面見 §3.3.9），衍生值可覆寫；**Breakout 容器**＝DN／DP 列「進入 Breakout」開疊層（Compact 全屏 sheet、Expanded 側面板），步進卡逐步互動見 §3.3.9 與 05 §5.3。
- **人體模型檢視**（`…/model` 或詳情第 3 欄）：畫布（**僅 3D**）＋ 控制項（分層、標籤、LOD、視角、關節），Expanded 側欄、Compact 浮動工具列＋可收合分層面板（§3.1、§3.5）；**選取資訊卡＝浮動卡貼近部位**（名稱／屬性／「隱藏此部位」／「＋關聯到評估」，點空白關閉、避免遮擋）；ROM 極限以提示色＋文字（§3.4）。
- **設定**（`/settings`）：四區塊 —— 治療師資料／顯示（語系·主題·LOD·密度·方向鎖定·預設分層）／資料管理（匯出全部·匯入還原＋資料保全提醒）／**關於·授權標示**（SFMA ©、Z-Anatomy CC BY-SA、BodyParts3D、MakeHuman CC0、版本·隱私；對應 [05_assessment.md](05_assessment.md) §5.6、[04_human_model.md](04_human_model.md) §4.6.1）。
  - 「匯出全部備份」按下先開確認 AlertDialog 提示「匯出檔為明文 JSON 且含個資」與存放注意（受控位置、勿上公開雲端／即時通訊、轉移後刪暫存），確認才匯出；匯出成功後以 **success toast**（`useToast`，i18n `toastExportDone`「備份已匯出」）給予即時回饋（[08_security_privacy.md](08_security_privacy.md) §8.7）。
  - 「關於」區塊含可展開「資料安全指引」（Accordion）＝裝置保護（螢幕鎖／磁碟加密／設定檔不共用）＋匯出檔處理守則（受控位置／勿公開雲端·即時通訊／刪暫存），就地呈現 [08_security_privacy.md](08_security_privacy.md) §8.7 指引。

### 3.3.9 評估表與 Breakout 互動細節

承 §3.3.8（評估表＝手風琴清單、Breakout＝疊層容器），本節定**互動層**：填寫流程、步進卡、端點呈現、回溯與模型連動。**引導引擎語意以 [05_assessment.md](05_assessment.md) §5.3.3 為準，本節只定 UI 對應、不複寫規則**；視覺詞彙取 §3.7（`StatusChip`、臨床色），佈局接 §3.3.3 斷點、返回接 §3.3.5。

**頂層手風琴填寫**

- 收合列＝動作名 · 兩側 `StatusChip` 概況 · `▾`；頂列顯示進度 **n/15**（已判讀筆數）、「在模型上檢視」（深連結至 `…/model?session=<sessionId>`，於模型反向高亮本評估標註部位，見 [04_human_model.md](04_human_model.md) §4.5）與「完成評估」。
- 展開版面：雙側動作＝**左右並排雙欄**，Compact 斷點改**上下堆疊**；每側為獨立卡＝一筆判讀紀錄（與 [06_data_model.md](06_data_model.md) §6.3 的 15 筆 1:1），單一動作退化為單欄。每側卡之**側別標題**（左／右）為 `position: sticky`，高卡片直式捲動時恆可見；側別標題前綴 **mono 短碼徽記 L／R**（sage 描邊，eyebrow 字排，量測識別）。頂列進度 **n/15** 以「讀值」呈現＝eyebrow 小標 ＋ mono 大數字（儀器讀數感，§3.7.3）。
- 每側卡：`failedCriteria[]` 判讀標準勾選、**2×2 判讀方格 `SfmaQuadrant`**（取代原分離的 `painful` checkbox ＋ `dysfunctional` SegmentedControl）——列為「功能正常／功能異常」× 欄為「無痛／疼痛」，單格點按即選取 `painful`／`dysfunctional` 組合並即時寫入；`role="radiogroup"` ＋ 方向鍵導覽，格子 ≥44px。即時該側 `StatusChip`（FN/FP/DN/DP 衍生、不入庫）。勾任一 `failedCriteria` → `dysfunctional` 自動帶「異常」；治療師可覆寫，覆寫後顯「已手動」標記以別於自動值（05 §5.2）。資料模型（`painful`／`dysfunctional`）、`entryClassification`、判讀標準、手動覆寫邏輯均不變，純為輸入介面收斂。
- Breakout 入口置於**展開的每側卡**（非收合列——收合列為 `AccordionTrigger` button，不可巢狀互動控制）：DN 列標「優先」、DP 列標「視疼痛決定」；FP／FN 不顯入口（FP 不進 Breakout，05 §5.3）。收合列既有 DN/DP `StatusChip` 概況作「此列需 Breakout」之訊號。
- 每側卡完成後鈕字改「檢視 Breakout」（進行中「續測 Breakout」），並顯 findingType 概況 chips；**概況與 `classification` 合並為單組**——`classification` 那枚以外框強調並掛 `aria-label`「判讀：X」，避免單發現時 chip 重複。`classification` 取 `record.classification` 覆寫優先、否則預設推導（覆寫下拉見下「完成」）。

**Breakout 疊層版面（焦點優先）**

- 容器與斷點：Compact／Medium＝全屏 sheet；Expanded＝右側 side panel（約 420–480px）與評估表並存。開啟推一個 history entry，系統返回／back＝**收合整層**（不破壞，§3.3.5）。
- 三區：**頂條**＝流程名 · 進度 · 路徑 breadcrumb（可點開為步驟清單）· 「自由模式」切換；**中段步進卡**（主角）；**底摺疊條**＝`發現 N · 待測流程 M`，新發現徽章脈動，Expanded 高度足夠時底欄預設常駐展開（近似稽核清單）。

**步進卡與端點**

- 步進卡：測試名（多語系）· 主／被動 badge · 判準（含角度，如「50°」）· 結果按鈕（≥44px）。**核心 4 碼** FN/FP/DP/DN；**特殊選項碼**（該節點 `resultOptions` 有才出現，列於核心下方為 chip：雙側FN／換邊代償／改善但未全幅／Thomas 達標變體等，05 §5.3.2）。
- 前進：點一般結果＝**自動前進**到下一測試（分支 `next`）；落在端點才停、彈結果卡。
- 端點結果卡四型（左色條，沿用 ref §3 原圖配色與 §3.7.2 臨床色）：**橙＝發現**（`finding` SMCD/JMD/TED，〔記錄並繼續〕，發現不必然結束流程）／**紅＝疼痛端點**（PAIN，顯著「先處理疼痛」，色＋圖示＋文字、不僅靠顏色 §3.6）／**靛＝轉流程**（`goToFlow`，toast「已排入 ⟨流程⟩」）／**灰＝指示／接續**（`instruction`／`next`，如「停止並先處理先前 DN」「再次確認頸椎模式」）。
- 流程佇列：`goToFlow` 去重、依觸發順序排入（MSE「下半身→上半身」、MSR「主流程→髖外轉→髖內轉→脛骨」依原圖）；完成當前流程自動引導下一條（05 §5.3.3 #5）。
- findings 面板：每筆＝findingType chip · 顯示文字 · 來源測試；PAIN 置頂顯著。

**回溯、改步與完成**

- 步驟清單：頂條 breadcrumb 點開＝完整 `steps[]`（序 · 測試 · 結果 · 發現 chip），當前步高亮。
- 跳改：任一較早步 `✎` → **紅色 AlertDialog 量化**「作廢其後 N 步＋M 筆發現，自此重走」，確認後自該步重引導（05 §5.3.3 #6）。「⤺ 回上一步」為退最後一步快捷（同樣作廢該步衍生）。破壞性作廢只由此觸發、不因誤觸 back 發生（§3.3.5）。
- 條件資料缺失：分支所需 `priorResult` 不存在（自由模式／跳測）時，步進卡顯示原圖條件文字＋候選分支按鈕供**人工擇一**，註記寫該步 `notes`（05 §5.3.3 #7）。
- 不分側帶入：CTSIB 等不分側測試於另一側已輸入→帶入前值供確認、可改（05 §5.3.3 #8）。
- 完成：流程／Breakout 走完彈完成結果卡——`classification` 預設推導（含 PAIN→PAIN，否則第一筆 finding 類型）＋**覆寫下拉**，列出本次 `findings[]` 摘要（05 §5.3.4）。
- 續做：重開未完成 Breakout → 開在最後未答步（`steps[]` 已持久化）＋「續測」banner。
- 完成卡判讀列以 `Select` 覆寫下拉（選項＝findingType 碼 SMCD/JMD/TED/PAIN/OTHER，與 finding chip 一致；`classification` 未定〔如全 FN 無 finding 完成〕時首列為空值佔位「尚無判讀」）；覆寫時顯「已手動」標記別於自動推導。`BreakoutOverlayView` 於完成（`isComplete`）時於中段渲完成卡取代步進卡（剛觸發之端點結果卡仍顯）。

**findings 與人體模型連動（雙向 · 選用 · 區域層級）**

- 每筆 finding 提供「標到模型」捷徑（FP／DN／DP 列顯 `Link`「標到模型」，FN 不顯）；模型部位資訊卡提供「＋關聯到評估」（§3.3.8）。兩向寫同一 `bodyAnnotation`，連結帶 `?session=&pattern=` 深連結至模型（見 04 §4.5）。
- 模型端標註管理列表每列提供「回到評估發現」連結，回評估表並初始展開對應動作列；Breakout 進行中不打斷、不強制標註。多數 finding 為功能性診斷類型（非單一精確部位），故採區域層級、選用。雙向（評估↔模型：標到模型＋回到評估發現＋反向高亮＋正向標註 CRUD＋管理列表）完整。**模型端互動細節歸 [04_human_model.md](04_human_model.md)，本節只定接縫**。

**自由模式（freeform）**

- 疊層頂「自由模式」切換（`aria-pressed`）：不經引導、直接以流程 Select→節點 Select 挑任一流程節點逐筆記錄（重用步進卡，點結果即記），`findings`／`classification` 手動指定（05 §5.3.3 #9）；供跳測、補測或不依決策樹之臨床判斷使用。端點結果卡於引導／自由兩模式皆顯。
- **人工擇一候選卡**：套用結果觸發引擎 `needsManualChoice`（分支所需 `priorResult` 缺值致 undecidable，自由跳測尤常觸，05 §5.3.3 #7）時，疊層中段渲候選卡供臨床判斷擇一——每候選列出 prior 依據（先前測試名＋可接受結果碼）＋findingType chips＋結局文字，並提供「重新選擇」取消；引導與自由模式共用同一候選卡。

## 3.4 人體模型操作（手勢與滑鼠對應）

| 操作 | 觸控 | 滑鼠／鍵盤 |
| --- | --- | --- |
| 旋轉視角 | 單指拖曳 | 左鍵拖曳 |
| 平移 | 雙指拖曳 | 中鍵拖曳 |
| 縮放 | 雙指捏合 | 滾輪 |
| 選取部位 | 點擊 | 左鍵點擊 |
| 活動關節 | 在關節控制點上拖曳 | 在關節控制點上拖曳 |
| 重置視角 | 工具列按鈕 | 工具列按鈕／快捷鍵 |

- 關節操作受 ROM 限制：拖曳到範圍邊界即停止，並以提示色標示已達極限（見 [04_human_model.md](04_human_model.md)）。
- 選取部位後，側欄／浮動卡顯示該部位名稱與屬性，並可作為評估標註的目標；資訊卡上提供「**隱藏此部位**」以檢視其下深層結構（見 [04_human_model.md](04_human_model.md) 4.1）。

## 3.5 模型檢視器控制項

固定提供以下控制（佈局隨斷點調整為側欄或浮動工具列）。App 為 3D-only、無維度切換；無 WebGL／3D 載入失敗顯不支援訊息＋重試（`PageError`）。

**主要控制（恆顯）**：
- **視角**：預設視角快捷（前／後／左／右／自訂）、重置
- **標籤**：各部位名稱顯示／隱藏
- **關節活動（motion toggle）**：開啟 / 關閉運動模式

**「顯示選項」收合 disclosure（WAI-ARIA disclosure，預設收合）**：次要控制收入，避免主畫面過雜：
- **部位（region）**：全身／頭部／胸腹／臀腿取景
- **標籤範圍（label-mode）**：全部／僅選取（`SegmentedControl`）
- **LOD**：自動／精簡／完整（`SegmentedControl`；`auto` 解析為精簡，降級鏈 完整→精簡；切換寫回設定單一真相 `lodMode`，設定頁與檢視器同步）

**分層面板（`LayerControls`）**：表層肌群、深層肌群、神經、骨骼；已隱藏部位清單逐一或「恢復全部」還原；可收合（WAI-ARIA Disclosure）。

**患者檢視模式（`patientView`）**：工具列常駐的一鍵切換（`modelPatientView` / `modelExitPatientView`），開啟後隱藏工具列（分層開關／控制列／重置）及已隱藏清單，保留畫布與選取部位資訊卡，令模型填滿空間——適合醫病同視／衛教情境。狀態由 `model.vue` 持有並傳入 `Model3DViewer`（`patientView` prop）。

控制項佈局以純函式 `render/viewerLayoutMode(breakpoint, orientation)` 三模式編碼（§3.1）：`modelPriority`（手機橫式浮動工具列）、`sidePanel`（Expanded 固定寬側欄〔clamp 220–320px〕、模型佔主區）、`standard`（堆疊）；手機橫式浮動工具列下分層面板起始收合、不遮擋模型。選取資訊卡「點空白關閉」：點擊未命中部位之背景即清除選取（命中無 anatomyId 之 mesh 不誤清），未選取時休眠。LOD「完整」（無損 ~38 MB）首載大流量，切換至「完整」前跳流量確認對話框（`AlertDialog`，設定頁與檢視器兩切換點共用），確認才套。

**仍待**：選取資訊卡精準貼近部位定位（需執行期螢幕座標、待真實資產）。

## 3.6 互動與回饋原則

- **即時回饋**：分層開關、標籤、LOD 切換即時反映，無需確認。
- **可逆操作**：模型操作（旋轉、關節）可一鍵重置；評估輸入可修改。
- **醫病同視**：橫式並排佈局讓治療師與個案同時看到模型與說明，支援衛教情境。
- **最少輸入**：評估以點選為主（分類與判讀標準為勾選），減少打字。
- **無障礙**：色彩傳達（肌肉收縮／伸展、ROM 極限）同時輔以文字或圖示，避免僅依賴顏色。
- **資料保全提示**：首次啟動引導**安裝 PWA** 並說明「資料存於本機、請定期匯出」；匯出備份為最終保全手段（手動，見 [08_security_privacy.md](08_security_privacy.md) 8.7）。

- **一鍵重置視角**：工具列「重置視角」一次復原檢視狀態——方位、3D 視角、region、標籤收起、已隱藏部位還原、清選取，皆檢視狀態、不動標註資料；**不重置分層**——分層可見性由 `LayerControls`「還原預設」單獨管理。載入即＝重置視角（初始狀態與重置一致）。
- **資料保全為手動**：無自動「長期未匯出」提醒；資料保全僅靠手動匯出備份（單一個案／全部備份）＋首啟保全通知（`FirstLaunchNotice` 非阻擋 Callout「資料存於本機、請定期匯出」，關閉後以旗標持久化、不再顯示）。
- **預設顯示分層**：骨骼＋深層肌肉＋淺層肌肉預設顯（神經／被動結構預設隱、opt-in）；檢視與設定頁同步。
- 桌面捲軸預留（`scrollbar-gutter: stable`），捲軸顯隱時版面不位移；3D 畫布滾輪縮放不捲動頁面。捲軸槽預留於 **App Shell 內容捲動區**（`layouts/default.vue` `.appScroll`，非 `html`），使持久 App Bar 位於捲動容器之外、恆全寬填滿（無捲軸時不留背景色空隙）；殼層 `height:100dvh`＋`overflow:hidden`、內容區 `overflow-y:auto`，路由切換以內容區回頂。

## 3.7 視覺風格與設計系統

> 風格基調：中性、臨床、**低彩度底色**，使解剖色彩（肌肉紅、神經黃等）與臨床狀態色成為視覺重點。本節定義可實作的設計系統 —— token、主題、字體與比例階、元件層與無障礙規格。

### 3.7.1 實作基底與 token 架構

- **基底**：**Nuxt UI v4（底層 Reka UI 無樣式可存取原件 ＋ Tailwind v4）的 theme 系統 ＋ 自建領域元件**。臨床色彩語意以下述兩層 token 自管，再對應到 Nuxt UI theme。
  - **與原設計的刻意偏離**：原 ptApp 採「CSS custom properties 當 token 層 ＋ Radix 原語」自管最小 bundle；移植到 Nuxt 後改用 Nuxt UI（Reka UI + Tailwind），換取元件生態與一致主題機制。此為與原設計最大的刻意偏離，token→theme 橋接策略見本節末，於後續 UI Phase 落實。
- **兩層 token**（元件只用 semantic 層，不直接碰 primitive）：
  - **primitive**（原始值，僅供參照）：`--slate-50…900`、`--teal-50…800`（accent 色族，jolly-health 健康基調）、間距／字級／圓角／陰影比例階。
  - **semantic**（意圖）：`--color-bg`、`--color-surface`、`--color-text`、`--color-text-muted`、`--color-border`、`--color-accent`、`--color-accent-hover`、`--color-focus`、`--color-danger/warning/success`；另有**前景安全變體** `--color-accent-fg`／`--color-danger-fg`——作文字／狀態標記時用，暗色主題另覆寫淺色（accent-fg `#22D3EE`〔teal-400〕、danger-fg `#F87171`）以達 WCAG AA 4.5:1，與作白字底色之填色 token（`--color-accent`／`--color-danger`）分工；臨床保留色亦納入 semantic 作唯一真相源（`--clinical-contraction`、`--clinical-stretch`、`--clinical-nerve`、`--clinical-finding`），供 DOM 圖例與 Babylon GUI 疊層共用，確保 3D 與表單臨床色一致。
- **主題**：light／dark 以重新定義 semantic token 達成 —— `:root` 為 light、`[data-theme="dark"]` 覆寫；預設跟隨 `@media (prefers-color-scheme)`，使用者可手動覆寫並存入 `AppSettings.theme`（見 [06_data_model.md](06_data_model.md) 6.10）。純 CSS、無 JS 重算。
- **命名**：專案「嚴禁 snake_case」針對 JS／TS 識別字；**設計 token（CSS custom properties／CSS 變數）依 CSS 慣例用 kebab-case**（`--color-bg`，連字號非底線、不違規），Tailwind theme 鍵亦為 kebab-case；TS 端 token 存取器（若有）用 camelCase（見 [07_dev_conventions.md](07_dev_conventions.md)）。

**設計 token 對應 Nuxt UI theme（橋接策略，後續 UI Phase 落實）**：

- semantic token（`--color-bg`、`--color-accent`、`--color-danger` 等）與**臨床保留色**（`--clinical-contraction`／`--clinical-stretch`／`--clinical-nerve`／`--clinical-finding`）仍為臨床語意之唯一真相源，以 CSS 變數（kebab-case）定義。
- 對應到 Nuxt UI（**已落實**）：於 `app/assets/css/main.css` 以 `@theme` 註冊 **sage 品牌色階**，並於 `app.config.ts` 設 `primary: 'sage'`、`neutral: 'slate'`；另於 tokens.css 直接綁 `--ui-color-primary-* → --sage-*`，使 UAccordion/UModal/UCheckbox/USwitch 等元件吃同一組品牌 sage（§3.7.6）。
- light／dark 仍以重新定義 semantic token 達成（`:root` light、`.dark` 覆寫），與 Nuxt UI／Tailwind 的 color-mode 同步；臨床保留色於 DOM 圖例與 Babylon GUI 疊層（`getComputedStyle` 讀同組 CSS 變數）共用，確保 3D 與表單臨床色一致。
- 此為與原 ptApp 設計的刻意偏離（見本節開頭）；token 與 theme 並非 1:1，橋接細節與對比驗收於後續 UI Phase 落實。

### 3.7.2 色彩系統

色彩分三種角色，彼此不混用：

| 角色 | 用途 | 取值（light／dark 摘要） |
| --- | --- | --- |
| Chrome 中性階 | 表面／文字／邊框 | **light（sage 暖調）**：bg `#F4F6F4`、surface `#FFFFFF`、text `#1B2620`、muted `#5F6760`、border `#DDE3DF`；**dark（冷 slate，不變）**：bg `#0F172A`、surface `#1E293B`、text `#E2E8F0`、muted `#94A3B8`、border `#334155` |
| Accent 互動 | 主要動作／選取／focus | **sage 品牌綠**：accent `#596D5D`（sage-500）、hover `#4F6354`（sage-600）、focus `#596D5D`；前景文字 accent-fg light `#4F6354`／dark 提亮至 sage-300 `#ABBCAE`（過 AA 4.5:1） |
| 臨床／語意 | 載 domain 意義，**永不用於 chrome/accent** | contraction `#C0392B` 紅、stretch `#2E73B8` 藍、nerve `#E8B400` 黃、finding `#E67E22` 橙 |

> **light 主題配色取自 jolly-health.com 品牌**（鼠尾草綠 sage `#596D5D` 為按鈕／焦點／邊框主色，搭暖白與淡 sage 分隔線）——落實本節原「jolly-health 健康基調」之具體取色。dark 主題依需求僅針對 light 換色，維持原冷色 slate 中性，跨主題共用 sage 品牌 accent（暗背景提亮）。完整色階見 `app/assets/css/tokens.css` `--sage-50…950`。
>
> **sage accent 與臨床 functional 綠（`#2E7D32`）之區隔**：兩者皆綠，但 accent sage 為低彩度灰綠（chrome 互動），臨床 functional 為高彩度森林綠（狀態填色）——以**彩度差＋情境**區辨；且 FN/FP/DN/DP 之意義主要由 `StatusChip` 的 **2×2 方格幾何＋字母**承載（§3.7.4），不單靠顏色（§3.6）。原 teal/cyan primitive 保留於 tokens.css 供降級／參照。

- **FN／FP／DN／DP 編碼**：照其本質「`dysfunctional` × `painful` 兩軸積」分軸表達，不另造會與保留色打架的四色板：
  - 功能軸＝填色：functional 綠 `#2E7D32`／dysfunctional 紅 `#C0392B`（二元、色盲安全）。
  - 疼痛軸＝獨立疼痛字符（glyph）：painful 時加疼痛圖示，與填色正交。
  - 字母恆顯（`FN／FP／DN／DP`）→ 天然滿足「不僅依賴顏色」（§3.6）。
  - 結果：FN 綠·無 glyph｜FP 綠＋glyph｜DN 紅·無 glyph｜DP 紅＋glyph。封裝為 `StatusChip` 元件。
- **通用狀態色**：`--danger #C0392B`／`--warning #B26A00`／`--success #2E7D32`。紅同時用於臨床疼痛與破壞性動作（如刪除個案），以**情境＋圖示＋文字**區辨，不靠顏色本身。
- **對比**：全部達 **WCAG AA**（內文 4.5:1、大字／UI 元件 3:1）；狀態 chip 於 light／dark 皆須過 AA。`--color-accent`／`--color-danger` 暗色作前景文字對比不足，故另設前景安全變體 `--color-accent-fg`／`--color-danger-fg`（暗色提亮：accent-fg teal-400 `#22D3EE`、danger-fg `#F87171`），錯誤訊息、AlertDialog 破壞性標題、Breakout pain 端點文字、Button ghost、啟用分頁、選取部位等前景文字／狀態標記皆用之，與作白字底色之填色 token 分工。`--color-focus`（亮 teal-600 `#0891B2`）白字對比不足內文 AA，故僅作 focus 環（UI 元件 3:1）、不作文字。純工具 `app/utils/contrast.ts` ＋驗收測 `app/utils/contrast.test.ts`（讀 `app/assets/css/main.css` 的 `@theme` token 解析 var()、鎖定亮暗雙主題所有意義對比對 ≥4.5）為活的回歸閘門。
- accent 色族取 **sage 鼠尾草綠**（取自 jolly-health.com 品牌；健康／臨床基調，非「AI 紫」indigo；原 teal/cyan 取向之延續與具體取色）。token 兩層架構乾淨（元件僅消費 semantic），唯硬編品牌色處手動同步：PWA `theme_color`（已改 sage `#596d5d`、background `#f4f6f4`）、品牌圖示。
  - **3D 視埠 accent 刻意維持 teal `#0e7490`**（`render/sceneHighlight.ts` 選取覆蓋色、`motion/jointGizmo.ts` 關節控制點）：此非主題 chrome，而是疊在解剖模型上的**功能性回饋**——teal 對紅色肌肉／骨骼對比佳、辨識度高；sage（低彩度綠）疊在綠調組織上會失去對比。故 3D 功能色與 UI chrome accent 分流，為刻意邊界（`jointGizmo.test.ts` 鎖定此值）。

### 3.7.3 字體與比例階

- **字體堆疊（系統、zh-TW 原生、零字體下載）**：
  - `--font-sans: -apple-system, "Segoe UI", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", system-ui, sans-serif;`
  - `--font-mono: "SF Mono", "Cascadia Code", Consolas, "Noto Sans Mono", monospace;`（ID、數字）
  - Latin 取 OS UI 字、CJK 逐字回退到 PingFang TC／JhengHei，兩端皆原生。
- **字排識別「量測儀器」（刻意取向）**：本 APP 為 SFMA **量測／判讀工具**，故把既有系統 **mono 字族升格為一級識別角色**——所有 Latin「讀值」（FN/FP/DN/DP 代碼、ROM 角度、個案代碼、日期、計數、進度 `n/15`）與**結構小標 eyebrow**（畫面別、進度、左右側別 L/R、FINDINGS）一律 mono＋等寬數字（`tabular-nums`）＋字距張開；中文敘述／標題仍走人文無襯線（humanist sans）。**維持零字體下載＋ CJK 原生**——識別來自「mono 作資料字」的策略，非新字檔（下載字無法承載中文標題，與本節零下載原則衝突，故不採）。對應 token：`--tracking-eyebrow 0.08em`、`--tracking-data 0.02em`、`--tracking-tight -0.01em`、`--font-size-eyebrow`；工具類別 `.eyebrow`／`.dataText`（`app/assets/css/main.css`）。標題字重提至 600＋`--tracking-tight` 收緊。
- **字級階**（模組化 ~1.2、rem＠16px）：`xs 12 · sm 14 · base 16 · lg 18 · xl 20 · 2xl 24 · 3xl 30`；行高 內文 1.65（CJK 較寬）、標題 1.3；字重 400／500／700。
- **間距階**（4px base）：`--space-1…12` = `4·8·12·16·20·24·32·40·48`。
- **尺寸與點按**：最小點按目標 `--target-min: 44px`（建議 44–48 CSS px）；控制項高度 comfortable 44／compact 36。
- **圓角**：`sm 4 · md 8 · lg 12 · full 9999`，預設 md 8。
- **陰影／層級**：`0 平面 · 1 卡片 · 2 popover · 3 modal`，克制；dark 以邊框＋微抬升取代重陰影。
- **動效**：`fast 120ms · base 200ms · slow 320ms`，easing `cubic-bezier(0.2,0,0,1)`；遵 `prefers-reduced-motion: reduce` 關閉非必要過場。
- **密度模式**：`[data-density="compact"]` 縮放控制高度與間距，供平板／PC 三欄診間佈局；comfortable 為預設，compact 是否進設定頁待主要畫面（wireframe）設計決定。

### 3.7.4 元件層

- **Nuxt UI（Reka UI）原件**：UModal（Dialog）／UModal 破壞性確認變體（AlertDialog）、UPopover、UDropdownMenu、UTooltip、UTabs、USwitch、UCheckbox、URadioGroup、USelect、USlider、UToast、Accordion（UAccordion）、ULabel、以及 Reka UI VisuallyHidden 等。
- **設計系統擁有的基礎套件**（建在 Nuxt UI 原件＋theme token、領域中性，僅消費 semantic token）：以 Nuxt UI 元件為底並按需薄封裝——`UButton`／`UButton` icon-only、`UInput`／`USelect`／`UCheckbox`／`URadioGroup`／`USwitch`／`USlider`、`UTabs`、`UModal`（含 AlertDialog 變體）、`UPopover`／`UTooltip`、`UToast`、`UDropdownMenu`、`UCard`、`UBadge`、`Callout`（資料保全提示，以 UAlert／UCard 封裝）、`SegmentedControl`（LOD、相機視角、標籤模式、密度；以 URadioGroup／UTabs 樣式封裝）。
- **唯一帶領域味的 token 綁定元件＝APP 簽名標記**：`StatusChip`＝**Quadrant Mark**——把 SFMA 判讀的 2×2 心智模型（功能軸 × 疼痛軸）畫成**微縮方格**，亮起的格「位置即答案」（左上 FN／右上 FP／左下 DN／右下 DP；功能列綠、異常列紅），與全尺寸輸入元件 `SfmaQuadrant` **同構**（同列＝功能/異常、同欄＝無痛/疼痛），先讀「形」再讀「字」。仍遵 §3.7.2 分軸編碼（功能軸填色＋疼痛軸獨立 glyph ✳＋字母恆顯，mono 代碼）。此標記貫穿個案清單／評估列頭／總覽／Breakout，並以同一 2×2 幾何延伸為 **App Bar 品牌徽記**（sage 對角填色，§3.3.3）——令「此 APP 即那張 2×2」之識別一致。
- **領域畫面元件**（個案卡、評估 stepper、Breakout 步進卡…）屬後續主要畫面（wireframe）與評估互動設計，本節不展開。

### 3.7.5 無障礙規格（系統級）

- **WCAG 2.1 AA** 為基線。
- 鍵盤：所有互動可達可操作；`:focus-visible` 顯示 `--color-focus` 2px 外框；合理 tab 序；Esc 關閉浮層（Nuxt UI／Reka UI 內建）。「跳至主內容」skip link（WCAG 2.4.1 Bypass Blocks）置於 `.appShell` 最前、`:focus` 時滑入，焦點移入 `<main id="appMain" tabindex="-1">`。**焦點環強化**：`SegmentedControl`（父層 `overflow:hidden` 截斷 outline）與 `Accordion`（Reka UI 可能以 `outline:none` 覆寫）改以 **inset `box-shadow`** 取代 `outline` 呈現焦點指示，確保不被容器裁切。`SfmaQuadrant` 格子同樣套用 inset box-shadow 焦點環。
- **不僅依賴顏色**（§3.6）升為系統規則：狀態／意義一律配文字或圖示。
- 點按目標 ≥44px；遵 `prefers-reduced-motion`；`forced-colors`／高對比模式下 token 優雅退化。
- 語意 HTML＋Reka UI（Nuxt UI 底層）ARIA；icon-only 按鈕配 VisuallyHidden 文字。根 `<html lang>` 隨目前語系動態同步（WCAG 3.1.1 Language of Page；以 `@nuxtjs/i18n` 套用、`nuxt.config` 靜態 `zh-TW` 為無 JS 後備），切英文時報讀器以英語朗讀。
- **狀態訊息宣讀**（WCAG 4.1.3 Status Messages）：動態錯誤路徑全覆蓋——頁面層資料錯誤（`base/PageError`）、表單欄位錯誤、inline 操作錯誤（匯出／匯入）皆加 `role="alert"`，出現時即被宣讀、無需取得焦點。
- **表單欄位錯誤無障礙**：受驗證輸入失效態以 `aria-invalid='true'` 紅框（`--color-danger-fg`）＋錯誤訊息 `role="alert"` ＋ `aria-describedby` 關聯（WCAG 1.3.1／3.3.1／4.1.3）；紅框＋文字＋aria-invalid 三者並存，不僅依賴顏色（§3.6）。

### 3.7.6 檔案結構（供後續實作）

- `app/assets/css/main.css`：`@import "tailwindcss"; @import "@nuxt/ui"; @import "./tokens.css";` ＋ 以 **`@theme` 註冊 sage 品牌色階**（`--color-sage-50…950`，值同 tokens.css `--sage-*`）供 Nuxt UI primary 解析；另含 `.button`、**`.eyebrow`／`.dataText`** 字排工具類別；全域載入（`nuxt.config` `css`）。
- `app.config.ts`：Nuxt UI `ui.colors` 設定 **`primary: 'sage'`**（對應上述 @theme 色階）、`neutral: 'slate'`（與 dark 主題一致）。
- `tokens.css`：另直接綁定 `--ui-color-primary-50…950 → --sage-*`（與 `@theme`／`app.config` 互為保險），確保 U* 元件焦點／選取／開關態恆為品牌 sage；色彩唯一真相仍為 tokens.css semantic 變數。
- `app/components/`：自建領域元件（`StatusChip`、`SegmentedControl`、`Callout` 等），以 Nuxt UI 元件為底、僅消費 semantic token。
- Babylon GUI 疊層以 `getComputedStyle` 讀同組 CSS 變數，與 DOM 視覺一致。

## 3.8 動作記錄（dev → 瀏覽器 console）

開發者模式（見 [02_architecture.md](02_architecture.md) 2.11）之動作記錄：dev 建置 `actionLogger` 直接輸出至**瀏覽器開發者工具 console**（`console.log/warn/error`）。**無畫面內面板、無快捷鍵／設定頁開關**——以瀏覽器原生 console 之過濾／搜尋／保存取代面板功能。

- **輸出**：dev 模式每筆 `[module] action — <detail>`（detail 經 `redactPii` 去個資），對應 `console.log`（info）／`console.warn`／`console.error`。
- 正式建置 `actionLogger` 為 no-op、記錄程式碼不打包。
