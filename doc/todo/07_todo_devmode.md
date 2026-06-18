# 07 — Todo：開發者模式

> 階段：開發期（**建議於 01 之後盡早建立**：actionLogger 是全模組的埋點基礎）｜來源設計：[02_architecture.md](../design/02_architecture.md) §2.11、[03_ui_ux.md](../design/03_ui_ux.md) §3.8、[08_security_privacy.md](../design/08_security_privacy.md) §8.9｜前置：[01](01_todo_setup.md)

## actionLogger

- [ ] 各模組埋點——僅餘 ROM 鉗制埋點未落地（受阻：待 MakeHuman 骨架 §4.3.3）；其餘埋點點（路由／localStore／匯出匯入／資產載入／LOD 切換／分層／部位選取／評估輸入／Breakout／FPS 自動降級／錯誤警告）皆已完成

## 未來（與登入功能一併實作，列於 [10](10_todo_future.md)）

- devUser mock 認證提供者：跳過登入與權限檢查；僅允許連測試環境（02 §2.11、08 §8.9）
