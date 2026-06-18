import { ref, watch, type Ref } from 'vue';
import { localStore } from '../../utils/data/localStore';
import type { Repository } from '../../utils/data/repository';
import {
  loadPatientListItems,
  type PatientListItemData,
} from '../../utils/patient/patientListItems';

type PatientListRepo = Pick<Repository, 'listPatients' | 'listAssessmentsByPatient'>;

export type PatientListState =
  | { status: 'loading' }
  | { status: 'ready'; items: PatientListItemData[] }
  | { status: 'error' };

export interface UsePatientListResult {
  // 唯讀載入狀態（loading/ready/error）。
  state: Ref<PatientListState>;
  // 重新載入清單。
  reload: () => void;
}

// View⇄服務⇄Repository（07 §7.3）：預設 localStore 單例，測試注入 mock repo。
// React useEffect([repo, reloadKey]) → Vue watch（immediate）＋cancelled 旗標。
export function usePatientList(repo: PatientListRepo = localStore): UsePatientListResult {
  const state = ref<PatientListState>({ status: 'loading' });
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
          const items = await loadPatientListItems(repo);
          if (!cancelled) state.value = { status: 'ready', items };
        } catch {
          if (!cancelled) state.value = { status: 'error' };
        }
      })();
    },
    { immediate: true },
  );

  function reload(): void {
    state.value = { status: 'loading' };
    reloadKey.value += 1;
  }

  return { state, reload };
}
