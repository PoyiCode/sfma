import { ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue';
import type {
  AssessmentSession,
  BodyAnnotation,
  BreakoutRecord,
  PatternRecord,
} from '@ptapp/shared';
import { actionLogger } from '../../utils/devtools/actionLogger';
import { localStore } from '../../utils/data/localStore';
import type { Repository } from '../../utils/data/repository';
import { upsertRecord } from '../../utils/assessment/assessmentForm';
import { upsertBreakout } from '../../utils/assessment/breakoutForm';
import {
  removeBodyAnnotation,
  upsertBodyAnnotation,
} from '../../utils/assessment/bodyAnnotationForm';

type AssessmentSessionRepo = Pick<Repository, 'getAssessment' | 'saveAssessment'>;

// 埋點識別碼標籤：雙側動作以 patternKey/side 區分，單側（side＝null）僅 patternKey（08 §8.9 不含個資）。
function recordLabel(patternKey: string, side: string | null): string {
  return side ? `${patternKey}/${side}` : patternKey;
}

export type AssessmentSessionState =
  | { status: 'loading' }
  | { status: 'ready'; session: AssessmentSession }
  | { status: 'notFound' }
  | { status: 'error' };

export interface UseAssessmentSessionResult {
  // 唯讀載入狀態（loading/ready/notFound/error）。
  state: Ref<AssessmentSessionState>;
  updateRecord: (record: PatternRecord) => Promise<void>;
  updateBreakout: (record: BreakoutRecord) => Promise<void>;
  upsertAnnotation: (annotation: BodyAnnotation) => Promise<void>;
  removeAnnotation: (annotationId: string) => Promise<void>;
  reload: () => void;
}

// 單一評估 session 載入／編輯（07 §7.3）：預設 localStore，測試注入 mock。
// React useEffect([sessionId, repo, reloadKey]) → Vue watch（immediate）＋cancelled 旗標。
// 各 mutator 於事件處理器內讀 state.value（非 watch）：樂觀更新 → repo.saveAssessment（summary 唯一寫入點重算）→ 回傳值蓋回。
export function useAssessmentSession(
  sessionId: MaybeRefOrGetter<string>,
  repo: AssessmentSessionRepo = localStore,
): UseAssessmentSessionResult {
  const state = ref<AssessmentSessionState>({ status: 'loading' });
  const reloadKey = ref(0);

  watch(
    [() => toValue(sessionId), reloadKey],
    ([id], _prev, onCleanup) => {
      let cancelled = false;
      onCleanup(() => {
        cancelled = true;
      });
      state.value = { status: 'loading' };
      void (async () => {
        try {
          const session = await repo.getAssessment(id);
          if (cancelled) return;
          state.value = session ? { status: 'ready', session } : { status: 'notFound' };
        } catch {
          if (!cancelled) state.value = { status: 'error' };
        }
      })();
    },
    { immediate: true },
  );

  async function persist(next: AssessmentSession): Promise<void> {
    state.value = { status: 'ready', session: next };
    try {
      const saved = await repo.saveAssessment(next);
      state.value = { status: 'ready', session: saved };
    } catch {
      // 保留樂觀值；本地單機持久化失敗極少見
    }
  }

  async function updateRecord(record: PatternRecord): Promise<void> {
    const current = state.value;
    if (current.status !== 'ready') return;
    actionLogger.log('assessment', 'updateRecord', recordLabel(record.patternKey, record.side));
    await persist({
      ...current.session,
      patterns: upsertRecord(current.session.patterns, record),
    });
  }

  async function updateBreakout(record: BreakoutRecord): Promise<void> {
    const current = state.value;
    if (current.status !== 'ready') return;
    actionLogger.log('assessment', 'updateBreakout', recordLabel(record.patternKey, record.side));
    await persist({
      ...current.session,
      breakouts: upsertBreakout(current.session.breakouts, record),
    });
  }

  async function upsertAnnotation(annotation: BodyAnnotation): Promise<void> {
    const current = state.value;
    if (current.status !== 'ready') return;
    await persist({
      ...current.session,
      bodyAnnotations: upsertBodyAnnotation(current.session.bodyAnnotations, annotation),
    });
  }

  async function removeAnnotation(annotationId: string): Promise<void> {
    const current = state.value;
    if (current.status !== 'ready') return;
    await persist({
      ...current.session,
      bodyAnnotations: removeBodyAnnotation(current.session.bodyAnnotations, annotationId),
    });
  }

  function reload(): void {
    state.value = { status: 'loading' };
    reloadKey.value += 1;
  }

  return { state, updateRecord, updateBreakout, upsertAnnotation, removeAnnotation, reload };
}
