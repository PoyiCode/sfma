# 07 — 開發規範

## 7.1 命名規則

依草稿規定：

| 類別 | 規則 | 範例 |
| --- | --- | --- |
| 變數 / 函式（variable / function） | **camelCase** | `patientId`、`calcSummary()` |
| 類別 / 型別 / 元件（class / type / component） | **PascalCase** | `AssessmentSession`、`HumanModelViewer` |
| 環境變數 | **全大寫**（必要時以底線分隔英文） | `API_BASE_URL`、`LOG_LEVEL` |
| 常數 | 全大寫 | `MAX_ROTATION_DEG` |
| CSS custom property（設計系統 token） | **kebab-case**（連字號，非 snake_case） | `--color-bg`、`--space-4` |

> **嚴禁小寫 snake_case**（如 `patient_id`）。適用範圍：**程式碼**識別字、JSON 鍵名、程式碼檔名（`.ts` 等）；Vue 單檔元件（`.vue`）檔名用 PascalCase（如 `HumanModelViewer.vue`），Nuxt `pages/` 檔案式路由檔名沿 Nuxt 路由慣例（kebab-case／`[param]`，非 snake_case）。設計文件檔名沿用既有的 `NN_name.md` 編號慣例（如 `00_draft.md`、`03_ui_ux.md`），不在此限。CSS custom properties（設計系統 token）依 CSS 慣例用 **kebab-case**（`--color-bg`），屬連字號非底線、不屬 snake_case 之列；TS 端 token 存取器（若有）用 camelCase（見 [03_ui_ux.md](03_ui_ux.md) §3.7.1）。

### 與技術堆疊的契合

本專案以 **TypeScript** 貫穿前後端（見 [02_architecture.md](02_architecture.md)）。TS／JS 生態的慣例與本規則**完全一致**：變數/函式 camelCase、類別/型別/Vue 元件（PascalCase）、常數與環境變數全大寫。因此命名規則可直接以工具強制，無語言慣例衝突。

落實方式：

- **ESLint flat config（`eslint.config.mjs`，以 `@nuxt/eslint` 產生的設定為底）+ `eslint-plugin-vue`**：`@typescript-eslint/naming-convention` 規則強制 camelCase／PascalCase 並禁止 snake_case（套用於 `.ts` 檔）；Vue 元件命名（PascalCase）由 `eslint-plugin-vue` 處理。
- **Prettier**：統一格式。
- **TypeScript `strict`**：開啟嚴格型別。
- 於 CI 與編輯器（lint-staged／pre-commit〔husky〕）執行，避免風格分歧。

### JSON 鍵名

- 一律 camelCase（見 [06_data_model.md](06_data_model.md)）：`patientId`、`failedCriteria`、`anatomyId`。
- 列舉值沿用領域標準碼：SFMA 分類 `FN`／`FP`／`DN`／`DP`、Breakout 分類 `SMCD`／`JMD`／`TED`／`PAIN`／`OTHER`。

## 7.2 資料紀錄策略

APP 先獨立開發，分兩階段（見 [02_architecture.md](02_architecture.md)）：

- **開發期（單機）**：個案與評估存於 **IndexedDB**（真實來源），結構為 camelCase JSON；提供 **JSON 匯出／匯入**（備份、跨裝置轉移，格式見 [06_data_model.md](06_data_model.md) 6.7）。
- **未來**：**資料上傳到 PostgreSQL**，後端成為真實來源，IndexedDB 轉為離線快取。
- **不變式**：資料層以 Repository 介面抽象，上層只面對介面；同一套 DTO 同時是 IndexedDB 格式、匯出檔格式與未來 API 格式 — 換儲存來源不改上層與資料模型。
- 序列化／反序列化集中於資料層（`localStore`／`exporter`，未來 `apiClient`），DTO 鍵名 camelCase。
- 個案個資開發期**手動輸入**，未來自動匯入。
- 匯出檔與未來上雲的保護要求見 [08_security_privacy.md](08_security_privacy.md)。

## 7.3 專案結構（TypeScript 單一儲存庫 monorepo，pnpm workspace）

Nuxt 4 採 `app/` 慣例；前後端同語言，以 pnpm workspace 管理共享型別：

```
sfma/
├── nuxt.config.ts           # Nuxt 設定（SPA ssr:false、模組、PWA manifest、i18n、vite.define 旗標）
├── app.config.ts            # Nuxt UI theme（語意色別名）
├── app/                     # 前端（Nuxt 4 / Vue 3，PWA）
│   ├── pages/               # 檔案式路由（patient、assessment、model、settings…）
│   ├── layouts/             # App Shell 版面
│   ├── components/          # Vue 元件：領域畫面元件 ＋ 自建基礎元件（StatusChip…）
│   │   └──                  #（patient / assessment / humanModel 各區依需分子目錄）
│   ├── composables/         # 區域邏輯 useXxx（useBreakpoint／useOrientation…）
│   ├── stores/              # Pinia store（patient／評估 session／breakout／settings）
│   ├── plugins/             # 啟動接線（*.client.ts：導覽埋點、requestPersistentStorage）
│   ├── utils/               # localStore(IndexedDB) / exporter(匯出入) / dtos
│   │   │                    #（未來加 apiClient：上傳 PostgreSQL）
│   │   ├── devtools/        # 開發者模式：actionLogger / redactPii（僅開發建置，旗標剔除）
│   │   └── pwa/             # PWA 輔助（SW 清理等）
│   └── assets/css/main.css  # Tailwind + Nuxt UI 匯入、設計 token（@theme）
├── i18n/locales/zh-TW.json  # 多語系（@nuxtjs/i18n，zh-TW 預設）
├── public/                  # PWA 圖示、3D 資產（models/draco）、assets2d（2D SVG）
├── config/                  # 純設定邏輯（devServerHost.ts，由 nuxt.config 消費）
├── packages/
│   ├── shared/              # 共享型別與 DTO（單一真相；未來與後端共用）
│   └── definitions/         # sfmaPatterns、sfmaBreakoutFlows、anatomy 等資料定義
└── infra/                   # 部署設定（前端託管、3D 資產 CDN）
                             #（未來補上）後端：TS API + PostgreSQL
```

- 套件管理：**pnpm workspace**（`pnpm-workspace.yaml`）。
- 人體模型（Babylon 場景）邏輯於 `app/composables`／`app/utils` 抽框架無關純邏輯，Vue 元件以 `<ClientOnly>` 嵌入畫布（見 [02_architecture.md](02_architecture.md) §2.4）。
- UI 與資料解耦：View（Vue 元件）⇄ 狀態（Pinia／composable）⇄ Repository 介面（`localStore`／`exporter`，未來加 `apiClient`）。
- 解剖資料、SFMA 題項定義為**資料檔**（`packages/definitions`），避免寫死於程式碼。
- 共享型別放 `packages/shared`，前後端引用同一份，確保 DTO 一致。

## 7.4 多語系（i18n）

- 文件與介面預設語言 **zh-tw**（依專案 `CLAUDE.md`：`doc language: zh-tw`）。
- 顯示字串集中於 `i18n`，不在程式碼內寫死中文。
- 資料層多語系文字以物件表示 `{ "zh-TW": "...", "en": "..." }`，預設取 zh-TW，缺漏時回退 en。

## 7.5 單位與座標約定

- 角度：度（degree），ROM 與旋轉上限以度表示。
- 長度（如有）：公分（cm）或公尺（m），於資料中以 `unit` 標明。
- 3D 座標系與骨架命名於人體模型模組內統一定義；各 LOD 版本共用同一骨架與 `anatomyId`。

## 7.6 動作記錄慣例（actionLogger）

供開發者模式的動作記錄使用（dev 輸出至瀏覽器 console；見 [02_architecture.md](02_architecture.md) §2.11）：

- 各模組的關鍵動作（導覽、資料讀寫、匯出／匯入、3D 載入與 LOD 切換、評估輸入、錯誤）一律經共用的 `actionLogger.log(module, action, detail?)` 記錄，不各自另建記錄機制。
- `module`、`action` 以 camelCase 命名（如 `humanModel`、`lodSwitch`）。
- `detail` 以識別碼（如 `patientId`）指涉個案，**不得記錄姓名等個資**（見 [08_security_privacy.md](08_security_privacy.md) 8.9）。
- 正式建置中 `actionLogger` 為 no-op，呼叫點不需以條件包裹。

## 7.7 測試規範

| 層級 | 工具 | 範圍 |
| --- | --- | --- |
| 單元測試 | **Vitest** | 純邏輯：ROM 鉗制計算、肌肉長度→色彩推導、LOD 決策、summary 推導、Breakout 決策樹引擎（分支／條件／回溯）、匯出／匯入與 schema 遷移 |
| 元件測試 | Vitest + `@vue/test-utils`（+ `@nuxt/test-utils`） | 表單、評估 UI、檢視器控制項 |
| 3D 場景 | Babylon **NullEngine**（無頭，免 GPU） | 場景組裝正確性：骨架階層、ROM 限制有套用、分層開關後的可見性、mesh ↔ `anatomyId` 對應 |
| 視覺回歸（選用） | Playwright 截圖比對 | 關鍵視角（正／側／背、收縮變色）；基準圖須於固定 CI 環境產生，容忍少量像素差 |
| E2E | **Playwright** | 主流程：建立個案 → 評估（含 Breakout）→ 匯出 → 清空 → 匯入還原 |

- **選型理由**：Vitest 與 Vite 同生態、TS 原生、速度快；Playwright 跨引擎（Chromium／WebKit／Firefox，WebKit 近似 iOS Safari），且能操作 IndexedDB、Service Worker 與檔案下載。
- **3D 測試原則：邏輯與場景分離** — 可測的計算（ROM、長度、LOD 決策）抽成不依賴 Babylon 的純函式，用單元測試覆蓋；NullEngine 驗證場景結構；真實渲染效果靠視覺回歸與人工檢視。
- 測試檔與被測檔同層，命名 `xxx.test.ts`。
- CI 順序：lint → 單元／元件 → E2E（headless）。

## 7.8 文件規範

- 設計文件置於 `./doc`（依 `CLAUDE.md`），本設計集中於 `./doc/design`。
- 文件語言 zh-tw。
- 縮寫沿用 [README.md](README.md) 的名詞對照表，首次出現附中英全名。
