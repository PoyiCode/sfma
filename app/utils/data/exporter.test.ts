import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { exportEnvelopeSchema } from '@ptapp/shared';
import { createLocalStore } from './localStore';
import { buildFullExport, buildPatientExport, exportFileName, pickSaveStrategy } from './exporter';

let dbCounter = 0;
function freshStore() {
  dbCounter += 1;
  return createLocalStore(`exp-test-${dbCounter}`);
}

const CONSENT = '2026-06-13T09:00:00+08:00';

describe('exportFileName（06 §6.7 檔名慣例）', () => {
  it('ptApp-export-{範圍}-{日期}.json', () => {
    expect(exportFileName('P0001', new Date(2026, 5, 12))).toBe(
      'ptApp-export-P0001-2026-06-12.json',
    );
    expect(exportFileName('all', new Date(2026, 5, 12))).toBe('ptApp-export-all-2026-06-12.json');
  });
});

describe('pickSaveStrategy（06 §6.7 平台遞補）', () => {
  it('FSA → Web Share → 下載', () => {
    expect(pickSaveStrategy({ hasFileSystemAccess: true, canShareFiles: true })).toBe(
      'fileSystemAccess',
    );
    expect(pickSaveStrategy({ hasFileSystemAccess: false, canShareFiles: true })).toBe('webShare');
    expect(pickSaveStrategy({ hasFileSystemAccess: false, canShareFiles: false })).toBe('download');
  });
});

describe('buildPatientExport（06 §6.7 單一個案）', () => {
  it('含該個案與其全部評估、檔名用 displayCode、通過 schema', async () => {
    const store = freshStore();
    const patient = await store.createPatient({ name: '王小明', consentAcknowledgedAt: CONSENT });
    const other = await store.createPatient({ name: '陳大同', consentAcknowledgedAt: CONSENT });
    await store.saveAssessment(makeMinimalSession('S1', patient.patientId));
    await store.saveAssessment(makeMinimalSession('S2', other.patientId));
    const { envelope, fileName } = await buildPatientExport(
      store,
      patient.patientId,
      new Date(2026, 5, 13),
    );
    expect(envelope.scope).toBe('patient');
    expect(envelope.patients.map((p) => p.patientId)).toEqual([patient.patientId]);
    expect(envelope.assessments.map((s) => s.sessionId)).toEqual(['S1']);
    expect(envelope.settings).toBeUndefined();
    expect(fileName).toBe('ptApp-export-P0001-2026-06-13.json');
    expect(exportEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });

  it('個案不存在 → 擲錯', async () => {
    await expect(buildPatientExport(freshStore(), 'nope')).rejects.toThrow(/not found/);
  });
});

describe('buildFullExport（06 §6.7 全部備份）', () => {
  it('含全部個案／評估並附 settings', async () => {
    const store = freshStore();
    const a = await store.createPatient({ name: 'A', consentAcknowledgedAt: CONSENT });
    const b = await store.createPatient({ name: 'B', consentAcknowledgedAt: CONSENT });
    await store.saveAssessment(makeMinimalSession('S1', a.patientId));
    await store.saveAssessment(makeMinimalSession('S2', b.patientId));
    await store.saveSettings({
      schemaVersion: 1,
      settingsId: 'app',
      therapistProfile: { assessorId: 'T01', name: '李治療師' },
      locale: 'zh-TW',
      lodMode: 'auto',
      orientationPreference: 'auto',
      defaultLayers: { bone: true, deepMuscle: false, superficialMuscle: true, nerve: false },
      theme: 'system',
      updatedAt: '2026-06-13T09:00:00+08:00',
    });
    const { envelope, fileName } = await buildFullExport(store, new Date(2026, 5, 13));
    expect(envelope.scope).toBe('all');
    expect(envelope.patients).toHaveLength(2);
    expect(envelope.assessments).toHaveLength(2);
    expect(envelope.settings?.locale).toBe('zh-TW');
    expect(fileName).toBe('ptApp-export-all-2026-06-13.json');
    expect(exportEnvelopeSchema.safeParse(envelope).success).toBe(true);
  });
});

function makeMinimalSession(sessionId: string, patientId: string) {
  return {
    schemaVersion: 1,
    sessionId,
    patientId,
    assessor: { assessorId: 'T01', name: '李治療師' },
    assessedAt: '2026-06-13T09:30:00+08:00',
    patterns: [],
    breakouts: [],
    bodyAnnotations: [],
    summary: {
      counts: { FN: 0, FP: 0, DN: 0, DP: 0 },
      painfulPatterns: [],
      dysfunctionalPatterns: [],
    },
  } satisfies Parameters<ReturnType<typeof createLocalStore>['saveAssessment']>[0];
}
