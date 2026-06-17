import { requestPersistentStorage } from '../utils/data/initStorage';
import { localStore } from '../utils/data/localStore';
import { actionLogger } from '../utils/devtools/actionLogger';

// 啟動接線（對應 ptApp main.tsx）。
export default defineNuxtPlugin(() => {
  // 申請持久儲存，准駁記入 actionLogger（02 §2.6、08 §8.7）
  void requestPersistentStorage();

  // 啟動套用使用者偏好（06 §6.10）：自 IndexedDB settings 套用主題（color mode）。
  // useColorMode 須於 plugin 同步情境取得（await 後會失去注入情境），故先取再於非同步流程使用。
  const colorMode = useColorMode();
  void (async () => {
    try {
      const settings = await localStore.getSettings();
      if (settings) colorMode.preference = settings.theme;
      // 語系啟動套用待 Phase 6（settings UI + 'en' locale 上線）。
    } catch (error) {
      actionLogger.warn('settings', 'startupApplyFailed', String(error));
    }
  })();
});
