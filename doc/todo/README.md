# 物理治療 APP — Todo 清單

依據 [`../design`](../design/README.md) 設計文件拆解的工作項目，依**功能與階段**分檔。

> - 本專案已由 ptApp（React）**移植至 Nuxt 4（Vue 3）**（Phase 0–7 完成）；下列為移植後**仍待辦**之工作，多數受阻於真實 3D 骨架資產、實機 QA、PT 審閱與雲端階段。
> - 編號為建議施作順序（依賴關係），**非時程規劃**。
> - 每項可追溯至設計文件章節（如「02 §2.6」＝ `../design/02_architecture.md` 2.6 節）。
> - ⚠ 標示「待決事項」：需人為決策（商業／專業判斷），非純開發工作。

## 檔案導覽

### 開發期（單機）

| 檔案 | 範圍 | 主要來源設計 |
| --- | --- | --- |
| [01_todo_setup.md](01_todo_setup.md) | 專案建置與開發規範 | 02、07 |
| [02_todo_data.md](02_todo_data.md) | 資料層（IndexedDB、匯出／匯入） | 06、02 |
| [03_todo_assets.md](03_todo_assets.md) | 解剖資料定義與自製圖資 | 04 §4.6、06 §6.5、02 §2.5 |
| [04_todo_human_model.md](04_todo_human_model.md) | 人體模型（3D 檢視器） | 04 |
| [05_todo_assessment.md](05_todo_assessment.md) | SFMA 評估表 | 05、06 |
| [06_todo_ui_ux.md](06_todo_ui_ux.md) | 介面、畫面與響應式 | 03 |
| [07_todo_devmode.md](07_todo_devmode.md) | 開發者模式 | 02 §2.11、03 §3.8 |
| [08_todo_testing.md](08_todo_testing.md) | 測試 | 07 §7.7 |
| [09_todo_security.md](09_todo_security.md) | 資安、隱私與合規 | 08、05 §5.6 |

### 未來階段

| 檔案 | 範圍 | 主要來源設計 |
| --- | --- | --- |
| [10_todo_future.md](10_todo_future.md) | 上傳 PostgreSQL、帳號、上架 | 02 §2.6、06 §6.9、08 |

## 建議施作脈絡（依賴關係，非時程）

```
01 建置 ──→ 02 資料層 ──→ 05 評估表 ──┐
   │                                  ├──→ 06 介面整合 ──→（發布檢核：09）
   └──→ 03 定義/圖資 ──→ 04 人體模型 ──┘
07 開發者模式：01 之後盡早建立（actionLogger 供全模組埋點）
08 測試：隨各功能持續累積，非最後一次補
09 資安合規：伴隨全程，發布前總複核
10 未來階段：PostgreSQL／帳號／上架
```

### 對齊 Nuxt 移植 Phase（0–7 已完成）

| 移植 Phase | 範圍 | 對應 todo 檔 |
| --- | --- | --- |
| 0 地基 | pnpm workspace、nuxt.config（SPA）、Nuxt UI/PWA/i18n/Pinia 模組、tooling、app shell 骨架、設計文件同步 | 01 |
| 1 資料層+devtools | IndexedDB localStore/exporter/importer/migrations、actionLogger | 02、07 |
| 2 設計系統+UI 原語 | 設計 token → Nuxt UI theme；基礎元件 | 06（§3.7 部分） |
| 3 定義/圖資接線 | definitions/anatomy、2D 圖資 | 03 |
| 4 patient+assessment | 個案管理、SFMA 評估＋breakout | 05 |
| 5 人體模型 | Babylon 場景、LOD、分層、互動 | 04 |
| 6 介面整合+PWA+i18n | app shell 整合、routing、settings、PWA caching、安裝引導 | 06 |
| 7 測試+資安 | 測試補齊、資安/隱私發布檢核 | 08、09 |

> 發布前總複核：見 [發布前檢核表](../release_checklist.md)（自動化驗證鏈＋資安/隱私＋持久儲存三防線＋待決閘門）。
