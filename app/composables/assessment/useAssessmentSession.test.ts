// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import { flushPromises } from '@vue/test-utils';
import type {
  AssessmentSession,
  BodyAnnotation,
  BreakoutRecord,
  PatternRecord,
} from '@ptapp/shared';
import { useAssessmentSession, type UseAssessmentSessionResult } from './useAssessmentSession';

function session(sessionId: string, over: Partial<AssessmentSession> = {}): AssessmentSession {
  return {
    schemaVersion: 1,
    sessionId,
    patientId: 'p1',
    assessedAt: '2026-06-10T09:00:00+08:00',
    assessor: { assessorId: 'a1', name: '王' },
    patterns: [],
    breakouts: [],
    bodyAnnotations: [],
    summary: {
      counts: { FN: 0, FP: 0, DN: 0, DP: 0 },
      painfulPatterns: [],
      dysfunctionalPatterns: [],
    },
    ...over,
  } as AssessmentSession;
}

const record: PatternRecord = {
  patternKey: 'cervicalFlexion',
  side: null,
  dysfunctional: true,
  painful: false,
  failedCriteria: [],
  notes: '',
};
const breakout: BreakoutRecord = {
  patternKey: 'cervicalFlexion',
  side: null,
  entryFlowKey: 'cervicalFlexionBreakout',
  steps: [],
  findings: [],
  notes: '',
};
const annotation: BodyAnnotation = {
  annotationId: 'an1',
  anatomyId: 'biceps',
  side: 'left',
  findingType: 'painful',
  linkedPatternKey: 'cervicalFlexion',
  note: '',
};

function run(setup: () => UseAssessmentSessionResult): {
  result: UseAssessmentSessionResult;
  stop: () => void;
} {
  const scope = effectScope();
  const result = scope.run(setup) as UseAssessmentSessionResult;
  return { result, stop: () => scope.stop() };
}

// echo saveAssessment that tags the persisted record (via assessedAt) so we can prove the
// repo's RETURNED value is applied to state, not merely the optimistic value.
const PERSISTED_MARK = '2099-01-01T00:00:00+08:00';
function echoRepo(initial: AssessmentSession | undefined) {
  return {
    getAssessment: vi.fn().mockResolvedValue(initial),
    saveAssessment: vi.fn(async (s: AssessmentSession) => ({ ...s, assessedAt: PERSISTED_MARK })),
  };
}

describe('useAssessmentSession（07 §7.3）', () => {
  it('載入成功 → ready 帶 session；以 sessionId 呼叫 repo', async () => {
    const repo = echoRepo(session('s1'));
    const { result, stop } = run(() => useAssessmentSession('s1', repo));
    await flushPromises();
    expect(result.state.value.status).toBe('ready');
    expect(result.state.value.status === 'ready' && result.state.value.session.sessionId).toBe(
      's1',
    );
    expect(repo.getAssessment).toHaveBeenCalledWith('s1');
    stop();
  });

  it('查無資料（undefined）→ notFound', async () => {
    const repo = echoRepo(undefined);
    const { result, stop } = run(() => useAssessmentSession('missing', repo));
    await flushPromises();
    expect(result.state.value.status).toBe('notFound');
    stop();
  });

  it('載入失敗 → error', async () => {
    const repo = {
      getAssessment: vi.fn().mockRejectedValue(new Error('boom')),
      saveAssessment: vi.fn(),
    };
    const { result, stop } = run(() => useAssessmentSession('s1', repo));
    await flushPromises();
    expect(result.state.value.status).toBe('error');
    stop();
  });

  it('reload 後重新載入（先失敗後成功）', async () => {
    const repo = {
      getAssessment: vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue(session('s1')),
      saveAssessment: vi.fn(),
    };
    const { result, stop } = run(() => useAssessmentSession('s1', repo));
    await flushPromises();
    expect(result.state.value.status).toBe('error');
    result.reload();
    await nextTick();
    await flushPromises();
    expect(result.state.value.status).toBe('ready');
    stop();
  });

  it('sessionId 變更 → 以新 id 重新載入', async () => {
    const id = ref('s1');
    const repo = echoRepo(undefined);
    repo.getAssessment.mockImplementation(async (x: string) => session(x));
    const { result, stop } = run(() => useAssessmentSession(id, repo));
    await flushPromises();
    expect(result.state.value.status === 'ready' && result.state.value.session.sessionId).toBe(
      's1',
    );
    id.value = 's2';
    await nextTick();
    await flushPromises();
    expect(repo.getAssessment).toHaveBeenLastCalledWith('s2');
    expect(result.state.value.status === 'ready' && result.state.value.session.sessionId).toBe(
      's2',
    );
    stop();
  });

  it('updateRecord：樂觀更新 → 寫入 repo → 套用回傳值', async () => {
    const repo = echoRepo(session('s1'));
    const { result, stop } = run(() => useAssessmentSession('s1', repo));
    await flushPromises();
    await result.updateRecord(record);
    expect(repo.saveAssessment).toHaveBeenCalledTimes(1);
    // saveAssessment 收到合併後的 patterns（含本筆）
    const arg = repo.saveAssessment.mock.calls[0]![0] as AssessmentSession;
    expect(arg.patterns).toHaveLength(1);
    expect(arg.patterns[0]?.patternKey).toBe('cervicalFlexion');
    // 最終狀態採 repo 回傳值（assessedAt 標記）證明非僅停在樂觀值
    expect(result.state.value.status === 'ready' && result.state.value.session.assessedAt).toBe(
      PERSISTED_MARK,
    );
    stop();
  });

  it('updateBreakout / upsertAnnotation / removeAnnotation 皆寫入 repo', async () => {
    const repo = echoRepo(session('s1'));
    const { result, stop } = run(() => useAssessmentSession('s1', repo));
    await flushPromises();
    await result.updateBreakout(breakout);
    await result.upsertAnnotation(annotation);
    expect(repo.saveAssessment).toHaveBeenCalledTimes(2);
    const afterUpsert = repo.saveAssessment.mock.calls[1]![0] as AssessmentSession;
    expect(afterUpsert.bodyAnnotations).toHaveLength(1);
    await result.removeAnnotation('an1');
    const afterRemove = repo.saveAssessment.mock.calls[2]![0] as AssessmentSession;
    expect(afterRemove.bodyAnnotations).toHaveLength(0);
    stop();
  });

  it('非 ready 狀態下 mutator 為 no-op（不呼叫 repo）', async () => {
    const repo = echoRepo(undefined); // → notFound
    const { result, stop } = run(() => useAssessmentSession('missing', repo));
    await flushPromises();
    expect(result.state.value.status).toBe('notFound');
    await result.updateRecord(record);
    expect(repo.saveAssessment).not.toHaveBeenCalled();
    stop();
  });

  it('persist 失敗 → 保留樂觀值（仍為 ready，不轉 error）', async () => {
    const repo = {
      getAssessment: vi.fn().mockResolvedValue(session('s1')),
      saveAssessment: vi.fn().mockRejectedValue(new Error('disk full')),
    };
    const { result, stop } = run(() => useAssessmentSession('s1', repo));
    await flushPromises();
    await result.updateRecord(record);
    expect(result.state.value.status).toBe('ready');
    // 樂觀寫入仍在（patterns 含本筆），未因儲存失敗而回退或轉 error
    expect(
      result.state.value.status === 'ready' && result.state.value.session.patterns,
    ).toHaveLength(1);
    stop();
  });
});
