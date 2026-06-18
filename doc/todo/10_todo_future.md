# 10 — Todo：未來擴充（上傳 PostgreSQL、帳號、上架）

> 階段：**未來**（非開發期範圍，僅備忘）｜來源設計：[02_architecture.md](../design/02_architecture.md) §2.6、[06_data_model.md](../design/06_data_model.md) §6.9、[08_security_privacy.md](../design/08_security_privacy.md) §8.2–8.6、§8.8、[01_overview.md](../design/01_overview.md) §1.5

## 後端與資料庫

- [ ] 託管選型：Supabase（含認證 + RLS）vs 自建（Fastify／NestJS + 託管 Postgres）（02 §2.6）
- [ ] 資料表：`patients`、`assessments` 主表；巢狀結構（patterns／breakouts／bodyAnnotations）先 `jsonb`，需查詢分析時再正規化（06 §6.9）
- [ ] API：CRUD + 認證（Email／OAuth、session／JWT、登出與逾時；08 §8.2）
- [ ] 授權隔離：擁有者／院所界線（RLS 或 API 層檢查）

## 前端銜接

- [ ] `apiClient` 實作 Repository 介面（DTO 鍵名與結構不變，上層不動；02 §2.6）
- [ ] 首次上傳：以匯出格式批次匯入後端作種子資料（UUID 不衝突；06 §6.7、§6.9）
- [ ] IndexedDB 轉離線快取：同步策略與衝突解決
- [ ] 登入／登出 UI；登出時清除本地敏感快取（08 §8.7）
- [ ] devUser mock 認證提供者：開發者模式跳過登入；僅允許測試環境（02 §2.11、08 §8.9）

## 安全與合規（上雲後全面適用）

- [ ] TLS 傳輸 + at-rest 儲存加密；敏感欄位級加密與金鑰管理（08 §8.3）
- [ ] 稽核紀錄：個案資料的存取與變更（誰、何時、做了什麼；08 §8.6）
- [ ] 委外與資料所在地：DPA、data residency（08 §8.5）
- [ ] 環境隔離：開發者模式僅能連測試環境（08 §8.9）

## 其他擴充

- [ ] Capacitor 包裝上架 App Store 評估（02 §2.1）
- [ ] 其他量表外掛（FMS、特殊測試）、動作錄製、客製化標註範本、AR（01 §1.5）
- [ ] 院所多角色與權限（管理者、唯讀；08 §8.2）
- [ ] 伺服器端像素串流評估（僅當極端弱裝置需求出現；02 §2.5）
