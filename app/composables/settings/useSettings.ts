import { ref, watch, type Ref } from 'vue';
import { createUuid, toIsoDateTime, type AppSettings } from '@ptapp/shared';
import { localStore } from '../../utils/data/localStore';
import type { Repository } from '../../utils/data/repository';
import { defaultAppSettings } from '../../utils/settings/settingsModel';

type SettingsRepo = Pick<Repository, 'getSettings' | 'saveSettings'>;

export type SettingsState =
  | { status: 'loading' }
  | { status: 'ready'; settings: AppSettings }
  | { status: 'error' };

export interface UseSettingsResult {
  // 唯讀載入狀態（loading/ready/error）。
  state: Ref<SettingsState>;
  // 樂觀更新 → 持久化 → 以 saveSettings 回傳值蓋回。
  update: (partial: Partial<AppSettings>) => Promise<void>;
  // 重新載入（重設為 loading 後再讀）。
  reload: () => void;
}

// 設定載入/儲存（07 §7.3）：預設 localStore；無設定回預設單例。
// React useEffect([repo, reloadKey]) → Vue watch（immediate）＋cancelled 旗標防舊請求覆寫。
// update 樂觀更新（非 effect 內），故 SSR/水合無虞——本 App SPA、僅 client 執行。
export function useSettings(repo: SettingsRepo = localStore): UseSettingsResult {
  const state = ref<SettingsState>({ status: 'loading' });
  const reloadKey = ref(0);

  watch(
    reloadKey,
    (_key, _prev, onCleanup) => {
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });
      state.value = { status: 'loading' };
      void (async () => {
        try {
          const existing = await repo.getSettings();
          const settings = existing ?? defaultAppSettings(createUuid(), toIsoDateTime(new Date()));
          if (!cancelled) state.value = { status: 'ready', settings };
        } catch {
          if (!cancelled) state.value = { status: 'error' };
        }
      })();
    },
    { immediate: true },
  );

  async function update(partial: Partial<AppSettings>): Promise<void> {
    const current = state.value;
    if (current.status !== 'ready') return;
    const next = { ...current.settings, ...partial };
    state.value = { status: 'ready', settings: next };
    try {
      const saved = await repo.saveSettings(next);
      state.value = { status: 'ready', settings: saved };
    } catch {
      // 保留樂觀值；持久化失敗不還原（單機本地，極少見）
    }
  }

  function reload(): void {
    state.value = { status: 'loading' };
    reloadKey.value += 1;
  }

  return { state, update, reload };
}
