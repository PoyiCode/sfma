import { ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';
import type { Patient } from '@ptapp/shared';
import { localStore } from '../../utils/data/localStore';
import type { Repository } from '../../utils/data/repository';

type PatientRepo = Pick<Repository, 'getPatient'>;

export type PatientLoadState =
  | { status: 'loading' }
  | { status: 'ready'; patient: Patient }
  | { status: 'notFound' }
  | { status: 'error' };

export interface UsePatientResult {
  // 唯讀載入狀態（loading/ready/notFound/error）。
  state: Ref<PatientLoadState>;
  // 重新載入（重設為 loading 後再讀）。
  reload: () => void;
}

// 單一個案載入（07 §7.3）：預設 localStore，測試注入 mock。
// React useEffect([patientId, repo, reloadKey]) → Vue watch（immediate）＋cancelled 旗標防止舊請求覆寫。
export function usePatient(
  patientId: MaybeRefOrGetter<string>,
  repo: PatientRepo = localStore,
): UsePatientResult {
  const state = ref<PatientLoadState>({ status: 'loading' });
  const reloadKey = ref(0);

  watch(
    [() => toValue(patientId), reloadKey],
    ([id], _prev, onCleanup) => {
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });
      state.value = { status: 'loading' };
      void (async () => {
        try {
          const patient = await repo.getPatient(id);
          if (cancelled) return;
          state.value = patient ? { status: 'ready', patient } : { status: 'notFound' };
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
