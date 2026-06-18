import { ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';
import { localStore } from '../../utils/data/localStore';
import type { Repository } from '../../utils/data/repository';
import { buildAssessmentRows, type AssessmentRowData } from '../../utils/assessment/assessmentHistory';

type AssessmentHistoryRepo = Pick<Repository, 'listAssessmentsByPatient'>;

export type AssessmentHistoryState =
  | { status: 'loading' }
  | { status: 'ready'; rows: AssessmentRowData[] }
  | { status: 'error' };

export interface UseAssessmentHistoryResult {
  // 唯讀載入狀態（loading/ready/error）。
  state: Ref<AssessmentHistoryState>;
  // 重新載入。
  reload: () => void;
}

// 評估紀錄載入（07 §7.3）：預設 localStore，測試注入 mock。
// React useEffect([patientId, repo, reloadKey]) → Vue watch（immediate）＋cancelled 旗標防止舊請求覆寫。
export function useAssessmentHistory(
  patientId: MaybeRefOrGetter<string>,
  repo: AssessmentHistoryRepo = localStore,
): UseAssessmentHistoryResult {
  const state = ref<AssessmentHistoryState>({ status: 'loading' });
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
          const sessions = await repo.listAssessmentsByPatient(id);
          if (!cancelled) state.value = { status: 'ready', rows: buildAssessmentRows(sessions) };
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
