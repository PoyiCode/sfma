// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import type { Patient } from '@ptapp/shared';
import { usePatientList, type UsePatientListResult } from './usePatientList';

function patient(patientId: string, name: string): Patient {
  return {
    schemaVersion: 1,
    patientId,
    name,
    consentAcknowledgedAt: '2026-06-13T09:00:00+08:00',
  };
}

function run(setup: () => UsePatientListResult): {
  result: UsePatientListResult;
  stop: () => void;
} {
  const scope = effectScope();
  const result = scope.run(setup) as UsePatientListResult;
  return { result, stop: () => scope.stop() };
}

describe('usePatientList', () => {
  it('載入成功 → ready＋items', async () => {
    const repo = {
      listPatients: vi.fn().mockResolvedValue([patient('p1', '王')]),
      listAssessmentsByPatient: vi.fn().mockResolvedValue([]),
    };
    const { result, stop } = run(() => usePatientList(repo));
    expect(result.state.value.status).toBe('loading');
    await flushPromises();
    expect(result.state.value.status).toBe('ready');
    expect(result.state.value.status === 'ready' && result.state.value.items).toHaveLength(1);
    stop();
  });

  it('listPatients 失敗 → error；reload 後可復原', async () => {
    const repo = {
      listPatients: vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue([patient('p1', '王')]),
      listAssessmentsByPatient: vi.fn().mockResolvedValue([]),
    };
    const { result, stop } = run(() => usePatientList(repo));
    await flushPromises();
    expect(result.state.value.status).toBe('error');
    result.reload();
    await nextTick();
    await flushPromises();
    expect(result.state.value.status).toBe('ready');
    stop();
  });
});
