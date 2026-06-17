import { requestPersistentStorage } from '../utils/data/initStorage';

// 啟動接線（對應 ptApp main.tsx）。
// Phase 0：申請持久儲存已可獨立運作；theme/locale 啟動套用依賴資料層（Phase 1）→ 此處留佔位 no-op。
export default defineNuxtPlugin(() => {
  // 申請持久儲存，准駁記入 actionLogger（02 §2.6、08 §8.7）
  void requestPersistentStorage();

  // TODO(Phase 1)：自 settings 套用主題偏好（initThemeFromSettings）
  // TODO(Phase 1)：自 settings 套用語系偏好（initLocaleFromSettings）
});
