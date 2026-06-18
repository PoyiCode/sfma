// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import type { AssessmentSession } from '@ptapp/shared';
import { useAssessmentHistory, type UseAssessmentHistoryResult } from './useAssessmentHistory';

function session(sessionId: string): AssessmentSession {
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
    notes: '',
  } as AssessmentSession;
}

function run(setup: () => UseAssessmentHistoryResult): {
  result: UseAssessmentHistoryResult;
  stop: () => void;
} {
  const scope = effectScope();
  const result = scope.run(setup) as UseAssessmentHistoryResult;
  return { result, stop: () => scope.stop() };
}

describe('useAssessmentHistory（07 §7.3）', () => {
  it('載入成功 → ready，rows 由 buildAssessmentRows 衍生', async () => {
    const repo = { listAssessmentsByPatient: vi.fn().mockResolvedValue([session('s1')]) };
    const { result, stop } = run(() => useAssessmentHistory('p1', repo));
    await flushPromises();
    expect(result.state.value.status).toBe('ready');
    expect(result.state.value.status === 'ready' && result.state.value.rows[0]?.sessionId).toBe('s1');
    expect(repo.listAssessmentsByPatient).toHaveBeenCalledWith('p1');
    stop();
  });

  it('載入失敗 → error', async () => {
    const repo = { listAssessmentsByPatient: vi.fn().mockRejectedValue(new Error('boom')) };
    const { result, stop } = run(() => useAssessmentHistory('p1', repo));
    await flushPromises();
    expect(result.state.value.status).toBe('error');
    stop();
  });

  it('reload 後重新載入', async () => {
    const repo = {
      listAssessmentsByPatient: vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue([session('s1')]),
    };
    const { result, stop } = run(() => useAssessmentHistory('p1', repo));
    await flushPromises();
    expect(result.state.value.status).toBe('error');
    result.reload();
    await nextTick();
    await flushPromises();
    expect(result.state.value.status).toBe('ready');
    stop();
  });
});
