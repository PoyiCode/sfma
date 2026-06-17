# 02 — 技術架構與框架選型

> **方向：Web 優先。** 3D 人體模型為雲端服務，使用者以**網頁瀏覽器**直接開啟，技術以 **JavaScript / TypeScript** 為主。跨平台（iOS／iPadOS／Android／Windows）透過瀏覽器與 **PWA** 達成，不需各平台原生分支。

## 2.1 平台與部署模式

| 項目 | 決策 |
| --- | --- |
| 執行環境 | 網頁瀏覽器（行動與桌面） |
| 跨平台方式 | 響應式 Web + **PWA**（可安裝、可離線快取），單一程式碼涵蓋四平台 |
| 3D 算圖 | **客戶端** WebGL2／WebGPU（瀏覽器內），資產由雲端串流 |
| 3D 資產 | glTF／GLB 放物件儲存，經 **CDN** 分發（即「3D 模型雲端服務」） |
| 資料（開發期） | **單機本地儲存：IndexedDB 為真實來源**，提供 **JSON 匯出／匯入**（備份、轉移） |
| 資料（未來） | **上傳 PostgreSQL**：後端 API + 資料庫成為真實來源，IndexedDB 轉為離線快取 |

> PWA 注意：iOS Safari 對 PWA（推播、儲存配額）有較多限制；若未來需上架 App Store，可用 **Capacitor**（TS 友善）包裝同一份程式碼，不必重寫。

## 2.2 技術堆疊總覽（端到端 TypeScript）

```
瀏覽器（PWA）
├── 前端框架：Nuxt 4（Vue 3 + 內建 Vite，TypeScript）
├── 3D 引擎：Babylon.js（WebGL2 / WebGPU）
└── 本地資料：IndexedDB（開發期真實來源）
    └── JSON 匯出 / 匯入（備份、跨裝置轉移）
        │  HTTPS
        ▼
雲端
├── 前端託管：靜態 SPA / PWA（CDN）
├── 3D 資產服務：物件儲存（glTF/GLB + 紋理）+ CDN
└── 後端（未來補上）：TypeScript API + PostgreSQL + 認證
```

以 **TypeScript 貫穿前後端**，命名慣例（camelCase 變數/函式、PascalCase 類別、無 snake_case）與 TS 生態完全相符（見 [07_dev_conventions.md](07_dev_conventions.md)）。

## 2.3 前端框架選型

**Nuxt 4（Vue 3 + 內建 Vite），渲染模式 SPA（`ssr: false`）**

- 表單密集的部分（個案管理、SFMA 評估表）受益於 Vue 成熟的 UI 生態與元件庫（採 Nuxt UI，見 [03_ui_ux.md](03_ui_ux.md) §3.7）。
- Nuxt 內建 Vite 提供快速開發與建置；採 SPA（`ssr: false`）輸出靜態檔，貼近 local-first（IndexedDB／Babylon 僅客戶端），無 SSR 水合問題，便於 CDN 託管與 PWA。
- Nuxt 檔案式路由（`app/pages/`）與既有 `app/` 慣例結構（見 [07_dev_conventions.md](07_dev_conventions.md) §7.3）。
- 3D 畫布以獨立 Vue 元件（`<ClientOnly>` 包裹）嵌入（見 2.4）。

> 替代方案：Vue 生態另有純 Vue + Vite（少約定、需自行組裝路由／模組）、其他框架如 React、SvelteKit、Angular 亦可達成同等需求；選 Nuxt 4 取其檔案式路由、模組生態（UI／PWA／i18n）與 Vue 心智模型的整合度。

## 2.4 3D 引擎選型

核心需求：骨架模型、**關節受 ROM 限制**的活動、**肌肉收縮／伸展變色**、**LOD 精簡／完整**、分層顯示、標籤、載入雲端 glTF。

| 引擎 | 語言 | IK / ROM | 肌肉著色 | LOD | 說明 |
| --- | --- | --- | --- | --- | --- |
| **Babylon.js（推薦）** | **TypeScript 原生** | 內建 `BoneIKController` + 自訂角度限制 | **Node Material Editor**（視覺化著色器） | 內建 `mesh.addLODLevel` | 功能齊備、TS 第一，WebGPU 支援佳；引擎與 UI 框架無關，於 Vue 以 `<ClientOnly>` 元件嵌入 |
| Three.js（＋ TresJS） | JS（型別完整） | 需第三方（three-ik）或自訂 | 自訂 GLSL／TSL 或節點庫 | 內建 `THREE.LOD`（距離切換） | 生態最大、範例最多，組裝較多；如需 Vue 宣告式 3D 可搭 TresJS |
| PlayCanvas | JS | 需自行實作 | 編輯器著色器工具 | 需腳本自行實作 | 附**雲端視覺化編輯器**，適合資產協作 |

**推薦 Babylon.js**，因為它把先前我們依賴 Unity 的能力，原生對應到瀏覽器：

| 需求 | 前案（Unity） | 現案（Babylon.js，瀏覽器） |
| --- | --- | --- |
| 關節不可超出 ROM | Animation Rigging IK + 關節限制 | Skeleton/Bone + `BoneIKController` + 自訂角度上下限 |
| 肌肉收縮／伸展變色 | Shader Graph | **Node Material Editor** 驅動材質參數 |
| 精簡版／完整版 | LOD Group | `mesh.addLODLevel` + **依裝置等級下載對應資產** |
| 跨平台 | iOS/Android/Windows 匯出 | 瀏覽器 WebGL2／WebGPU + PWA |
| 標籤 | World-space UI | Babylon GUI（`AdvancedDynamicTexture`） |

> 若團隊偏好宣告式 3D，可改 **Three.js（Vue 以 TresJS 包裝）**，代價是 IK 與節點材質需自行補齊。

## 2.5 3D 模型雲端服務（資產管線）

「3D 模型雲端服務」採**客戶端算圖 + 雲端資產**模式：

```
作者端產出 glTF/GLB（含精簡版 / 完整版 + 骨架）
        ↓ 壓縮（Draco / meshopt）、紋理（KTX2 / Basis）
物件儲存（S3 / Cloudflare R2 / Supabase Storage）
        ↓ CDN 快取
瀏覽器：依裝置能力下載對應 LOD → Babylon.js 算圖
```

- **LOD 依能力下載**：以 `detect-gpu`、`navigator.deviceMemory`、WebGL/WebGPU 能力判斷裝置等級 → 下載精簡或完整版資產。**好處不只效能，也省頻寬**（弱裝置／弱網路下載更小）。
- **壓縮**：幾何用 Draco／meshopt，紋理用 KTX2（Basis）以縮短載入時間。
- **不支援提示**：極弱裝置（無 WebGL）或 3D 載入失敗時，顯 `PageError`「不支援／載入失敗＋重試」（App 為僅 3D、無 2D 後備；見 [04_human_model.md](04_human_model.md) §4.2）。
- **資產存取**：通用解剖模型可公開經 CDN 快取；個案資料才是敏感部分（見 [08_security_privacy.md](08_security_privacy.md)）。

### 客戶端算圖 vs 伺服器端串流（取捨）

| 模式 | 說明 | 取捨 |
| --- | --- | --- |
| **客戶端算圖（推薦）** | 資產下載到瀏覽器，本地 WebGL/WebGPU 算圖 | 成本低、可離線、互動延遲低；依賴裝置 GPU（以 LOD 緩解；無 WebGL 顯不支援訊息） |
| 伺服器端像素串流 | 雲端 GPU 算圖、串流影像到瀏覽器 | 弱裝置也能跑，但需常駐 GPU 伺服器、成本高、有網路延遲 |

v1 採客戶端算圖；像素串流僅在未來面對極端弱裝置時評估。

## 2.6 資料儲存（分階段）

> APP **先獨立開發**：開發期不依賴後端，資料本地儲存並可匯出；**未來補上：資料上傳到 PostgreSQL**。

### 開發期（單機）

- **真實來源：IndexedDB**（瀏覽器內），儲存個案與評估，結構即 [06_data_model.md](06_data_model.md) 的 camelCase JSON。
- **匯出／匯入**：以 JSON 檔匯出（單一個案或全部備份）、匯入還原；用於備份、跨裝置轉移，亦是未來首次上傳 PostgreSQL 的種子資料（格式見 [06_data_model.md](06_data_model.md) 6.7）。
- 資料層以 **Repository 介面**抽象，上層只面對介面；開發期實作為 `localStore`（IndexedDB）＋ `exporter`。
- **持久性防護**：IndexedDB 可能被瀏覽器**自動清除**（iOS Safari 對未安裝的網站有 7 天閒置清除政策；各瀏覽器於儲存壓力下亦可能逐出）。對策：啟動時呼叫 `navigator.storage.persist()` 申請持久儲存（Safari 17／iOS 17 起支援，WebKit 依啟發式授予 — 安裝為主畫面 App 時最可能獲准；更舊版 iOS 不支援、呼叫無效屬預期）、引導使用者**安裝 PWA**（安裝後豁免閒置清除並提高 persist() 獲准機率；iOS 的主要防線）、並以**手動匯出備份**作為最終保全手段（見 [08_security_privacy.md](08_security_privacy.md) 8.7）。

### 未來（上傳 PostgreSQL）

- **後端**：TypeScript（Node；Fastify／NestJS 或無伺服器函式），與前端同語言。
- **資料庫：PostgreSQL**（自建或託管 Postgres，如 Supabase／RDS；採 Supabase 可同時取得認證與 Row-Level Security）。
- **切換方式**：新增 `apiClient` 實作上傳／同步；PostgreSQL 成為真實來源，IndexedDB 轉為離線快取。DTO 鍵名與結構不變，上層程式不動。
- 上雲後適用 [08_security_privacy.md](08_security_privacy.md) 的全部要求（認證、加密、存取隔離）。

## 2.7 模組架構

```
前端（瀏覽器 / PWA）
├── App Shell / 路由（Nuxt 檔案式路由）
├── Modules
│   ├── Patient        個案管理（表單、清單）
│   ├── Assessment     SFMA 評估（題項與 Breakout 決策樹由資料生成）
│   │   └── breakoutFlow  Breakout 引導引擎（分支／流程佇列／回溯）
│   └── HumanModel     人體模型（Babylon 場景）
│       ├── anatomy    解剖資料層（肌肉/神經/關節）
│       ├── render     LOD / 分層 / 標籤
│       └── interact   旋轉 / ROM 關節 / 選取
├── Data
│   ├── localStore     IndexedDB（開發期真實來源）
│   ├── exporter       JSON 匯出 / 匯入（備份、轉移）
│   ├── apiClient      （未來）上傳 PostgreSQL 的型別化客戶端
│   └── dtos           序列化資料物件（camelCase）
├── devtools           開發者模式：actionLogger（輸出瀏覽器 console，僅開發建置）
└── i18n               多語系（zh-TW 預設）

雲端
├── Storage + CDN（3D 資產，開發期即使用）
└── 後端（未來補上）：API（CRUD、認證）+ PostgreSQL
```

UI 與資料解耦：View ⇄ 狀態／服務 ⇄ Repository 介面（`localStore`／`exporter`，未來加 `apiClient`）。

## 2.8 資料流

```
使用者操作
   ↓
Vue 元件（View） ⇄ 狀態/服務層
                        ↓
                 Repository 介面
                 ├── 開發期：localStore（IndexedDB）
                 │          └─ exporter（JSON 匯出/匯入）
                 └── 未來：apiClient ⇄ 後端 API ⇄ PostgreSQL
                           （上傳/同步；IndexedDB 轉為快取）

3D：Babylon 場景 → 依能力選 LOD → 由 CDN 取 glTF 資產（與個案資料分離）
```

## 2.9 跨平台與裝置適配

| 項目 | 策略 |
| --- | --- |
| 瀏覽器涵蓋 | 桌面與行動主流瀏覽器；**WebGPU 優先、WebGL2 後備**確保相容 |
| 安裝/離線 | PWA（**`@vite-pwa/nuxt`**）：可安裝、Service Worker 快取殼層與資產；**路由採 History API**（Nuxt SPA），SW 提供導覽後備（離線回殼層），主機設 SPA rewrite（hash 為無法 rewrite 時退路；見 [03_ui_ux.md](03_ui_ux.md) §3.3.4–3.3.5）。SW 註冊由模組以 `registerType:'autoUpdate'` 接管（正式建置自動註冊並更新）。**開發模式停用 SW（取消離線載入）**：`nuxt.config` `pwa.devOptions.enabled:false`、dev 不註冊 SW；必要時清除先前 prod／preview 殘留 SW＋快取（避免 dev 回舊版資產）。正式建置離線能力不變。 |
| 方向（直/橫） | 響應式重排，見 [03_ui_ux.md](03_ui_ux.md) |
| 裝置效能分級 | 載入時依能力選 LOD 資產；執行期監測 FPS 動態降級（完整→精簡為底）；可手動覆寫；無 WebGL 顯不支援訊息 |
| 輸入 | 觸控與滑鼠/鍵盤皆支援（Pointer Events 統一處理） |

## 2.10 安全與隱私

- **開發期（單機）**：個案資料不離開裝置（除使用者主動匯出）；重點為裝置保護與匯出檔的處理。
- **未來（上傳 PostgreSQL）**：認證、傳輸/儲存加密、存取控制、個資法（PDPA）合規成為必要設計。

兩階段要求見 [08_security_privacy.md](08_security_privacy.md)。

## 2.11 開發者模式（Developer Mode）

供開發與除錯用的執行模式，與正式模式的差異：

| 項目 | 正式模式 | 開發者模式 |
| --- | --- | --- |
| 認證 | 未來上傳 PostgreSQL 後需登入 | **不需任何認證**：以內建測試身分（devUser）直接進入 APP |
| 動作記錄輸出 | 無 | `actionLogger` 輸出至**瀏覽器 console**（無畫面內面板） |
| dev server host | `localhost`（僅本機） | `0.0.0.0`（全介面、區網可及，供 iOS 等實機經 http 區網 IP 測試） |

### 啟用方式

- 以**建置旗標**控制：環境變數 `VITE_DEV_MODE=true` 的建置才包含開發者功能；正式建置為 `false`，免認證路徑與記錄程式碼於建置時剔除（dead code elimination），**正式版不存在任何執行期開關可開啟**。剔除機制：`nuxt.config` 以 `process.env.VITE_DEV_MODE ?? (NODE_ENV==='production' ? 'false' : 'true')` 推導預設（Nuxt 僅自動載入 `.env`、不載 `.env.<mode>`），再經 `vite.define` **靜態替換** `import.meta.env.VITE_DEV_MODE`，正式建置即可由打包器靜態剔除死碼。
- 開發建置之 `actionLogger` 直接輸出至瀏覽器 console（無畫面內面板、無執行期顯隱切換；見 [03_ui_ux.md](03_ui_ux.md) §3.8）。
- dev server host 由 `VITE_DEV_MODE` 閘控，於 `nuxt.config` `devServer.host`（取值邏輯抽於 `config/devServerHost.ts`）：開發者模式綁 `0.0.0.0`（區網可及供 iOS 等實機經 http 區網 IP 測試），否則 `localhost`（僅本機）；僅影響 dev server，不誤曝露非開發者模式之服務（見 [08_security_privacy.md](08_security_privacy.md) §8.9）。

### 免認證

- 開發期（單機）本無帳號，APP 開啟即用，開發者模式自然成立。
- 未來補上登入後：開發者模式以 **mock 認證提供者**注入測試身分（devUser），跳過登入畫面與權限檢查；僅允許連測試環境，不可指向正式資料庫（見 [08_security_privacy.md](08_security_privacy.md) 8.9）。

### 動作記錄（actionLogger → 瀏覽器 console）

- **集中記錄**：全 APP 共用一個 `actionLogger`，各模組關鍵動作統一經 `actionLogger.log(module, action, detail?)` 記錄（導覽路由切換／資料層讀寫匯出匯入／人體模型資產載入·LOD·分層·部位選取／評估判讀輸入·Breakout 步進／錯誤警告）。
- **dev 模式輸出瀏覽器 console**（`console.log/warn/error`）；正式模式 `actionLogger` 為 no-op，呼叫點無需條件判斷、記錄程式碼不打包進正式版。
- 記錄以識別碼指涉個案、`redactPii` 去結構化個資（不含姓名等；慣例見 [07_dev_conventions.md](07_dev_conventions.md) 7.6、[08_security_privacy.md](08_security_privacy.md) 8.9）。
