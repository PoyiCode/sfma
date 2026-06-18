// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick } from 'vue';
import { flushPromises } from '@vue/test-utils';
import type { Patient } from '@ptapp/shared';
import { usePatient, type UsePatientResult } from './usePatient';

function patient(patientId: string): Patient {
  return {
    schemaVersion: 1,
    patientId,
    name: '王',
    consentAcknowledgedAt: '2026-06-13T09:00:00+08:00',
  };
}

// 在 effectScope 內執行 composable，使其 watch（immediate）有作用域可掛載；回傳結果與停止函式。
function run(setup: () => UsePatientResult): { result: UsePatientResult; stop: () => void } {
  const scope = effectScope();
  const result = scope.run(setup) as UsePatientResult;
  return { result, stop: () => scope.stop() };
}

describe('usePatient', () => {
  it('找到 → ready', async () => {
    const repo = { getPatient: vi.fn().mockResolvedValue(patient('p1')) };
    const { result, stop } = run(() => usePatient('p1', repo));
    await flushPromises();
    expect(result.state.value.status).toBe('ready');
    expect(result.state.value.status === 'ready' && result.state.value.patient.patientId).toBe('p1');
    stop();
  });

  it('查無 → notFound', async () => {
    const repo = { getPatient: vi.fn().mockResolvedValue(undefined) };
    const { result, stop } = run(() => usePatient('x', repo));
    await flushPromises();
    expect(result.state.value.status).toBe('notFound');
    stop();
  });

  it('讀取失敗 → error', async () => {
    const repo = { getPatient: vi.fn().mockRejectedValue(new Error('boom')) };
    const { result, stop } = run(() => usePatient('p1', repo));
    await flushPromises();
    expect(result.state.value.status).toBe('error');
    stop();
  });

  it('reload 後重新載入', async () => {
    const repo = {
      getPatient: vi
        .fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue(patient('p1')),
    };
    const { result, stop } = run(() => usePatient('p1', repo));
    await flushPromises();
    expect(result.state.value.status).toBe('error');
    result.reload();
    await nextTick();
    await flushPromises();
    expect(result.state.value.status).toBe('ready');
    stop();
  });
});
