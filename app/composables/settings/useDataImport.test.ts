// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import type { ImportResult } from '../../utils/data/repository';
import { useDataImport, type UseDataImportResult } from './useDataImport';

function fakeRepo(overrides: Record<string, unknown> = {}) {
  const result: ImportResult = {
    patientsWritten: 1,
    patientsSkipped: 0,
    assessmentsWritten: 2,
    assessmentsSkipped: 0,
    settingsApplied: false,
  };
  return {
    getPatient: vi.fn().mockResolvedValue(undefined),
    getAssessment: vi.fn().mockResolvedValue(undefined),
    importBatch: vi.fn().mockResolvedValue(result),
    ...overrides,
  };
}

function validEnvelopeText(): string {
  return JSON.stringify({
    exportVersion: 1,
    schemaVersion: 1,
    exportedAt: '2026-06-13T18:00:00+08:00',
    scope: 'all',
    patients: [],
    assessments: [],
  });
}

function fileOf(text: string) {
  return { text: () => Promise.resolve(text) };
}

function run(setup: () => UseDataImportResult): { result: UseDataImportResult; stop: () => void } {
  const scope = effectScope();
  const result = scope.run(setup) as UseDataImportResult;
  return { result, stop: () => scope.stop() };
}

describe('useDataImport', () => {
  it('初始 idle、open=false', () => {
    const { result, stop } = run(() => useDataImport(fakeRepo()));
    expect(result.phase.value.status).toBe('idle');
    expect(result.open.value).toBe(false);
    stop();
  });

  it('selectFile 合法檔 → planned（plan 帶空衝突）、open=true', async () => {
    const { result, stop } = run(() => useDataImport(fakeRepo()));
    await result.selectFile(fileOf(validEnvelopeText()));
    expect(result.phase.value.status).toBe('planned');
    expect(result.open.value).toBe(true);
    if (result.phase.value.status === 'planned') {
      expect(result.phase.value.plan.conflictingPatientIds).toEqual([]);
      expect(result.phase.value.plan.hasSettings).toBe(false);
    }
    stop();
  });

  it('selectFile 非 JSON → error code invalidJson', async () => {
    const { result, stop } = run(() => useDataImport(fakeRepo()));
    await result.selectFile(fileOf('not-json{'));
    expect(result.phase.value.status).toBe('error');
    if (result.phase.value.status === 'error') {
      expect(result.phase.value.code).toBe('invalidJson');
    }
    stop();
  });

  it('confirmImport 帶 conflictStrategy／applySettings → done，executeImport 收到選項', async () => {
    const repo = fakeRepo();
    const { result, stop } = run(() => useDataImport(repo));
    await result.selectFile(fileOf(validEnvelopeText()));
    result.conflictStrategy.value = 'overwrite';
    result.applySettings.value = true;
    await result.confirmImport();
    expect(result.phase.value.status).toBe('done');
    if (result.phase.value.status === 'done') {
      expect(result.phase.value.result.patientsWritten).toBe(1);
    }
    expect(repo.importBatch).toHaveBeenCalledWith(expect.anything(), {
      conflictStrategy: 'overwrite',
      applySettings: true,
    });
    stop();
  });

  it('reset 回 idle', async () => {
    const { result, stop } = run(() => useDataImport(fakeRepo()));
    await result.selectFile(fileOf(validEnvelopeText()));
    result.reset();
    expect(result.phase.value.status).toBe('idle');
    expect(result.open.value).toBe(false);
    stop();
  });

  it('新一次 selectFile 重置 conflictStrategy／applySettings 為預設', async () => {
    const { result, stop } = run(() => useDataImport(fakeRepo()));
    await result.selectFile(fileOf(validEnvelopeText()));
    result.conflictStrategy.value = 'overwrite';
    result.applySettings.value = true;
    await result.selectFile(fileOf(validEnvelopeText()));
    expect(result.conflictStrategy.value).toBe('skip');
    expect(result.applySettings.value).toBe(false);
    stop();
  });
});
