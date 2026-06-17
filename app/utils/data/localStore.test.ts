import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { AppSettings, AssessmentSession } from '@ptapp/shared';
import { createLocalStore } from './localStore';

let dbCounter = 0;
function freshStore() {
  dbCounter += 1;
  return createLocalStore(`ls-test-${dbCounter}`);
}

const CONSENT = '2026-06-13T09:00:00+08:00';

function makeSession(sessionId: string, patientId: string): AssessmentSession {
  return {
    schemaVersion: 1,
    sessionId,
    patientId,
    assessor: { assessorId: 'T01', name: '李治療師' },
    assessedAt: '2026-06-13T09:30:00+08:00',
    patterns: [
      {
        patternKey: 'cervicalFlexion',
        side: null,
        dysfunctional: true,
        painful: false,
        failedCriteria: ['cannotTouchSternumToChin'],
        notes: '',
      },
    ],
    breakouts: [],
    bodyAnnotations: [],
    // 故意給錯的 summary：寫入時應被重算覆蓋
    summary: {
      counts: { FN: 99, FP: 99, DN: 99, DP: 99 },
      painfulPatterns: ['x'],
      dysfunctionalPatterns: [],
    },
  };
}

const SETTINGS: AppSettings = {
  schemaVersion: 1,
  settingsId: 'app',
  therapistProfile: { assessorId: 'T01', name: '李治療師' },
  locale: 'zh-TW',
  lodMode: 'auto',
  orientationPreference: 'auto',
  defaultLayers: { bone: true, deepMuscle: false, superficialMuscle: true, nerve: false },
  theme: 'system',
  updatedAt: '2026-06-13T09:00:00+08:00',
};

describe('localStore：個案 CRUD', () => {
  it('createPatient 產生 UUID、自動 displayCode、時間戳與 schemaVersion', async () => {
    const store = freshStore();
    const first = await store.createPatient({ name: '王小明', consentAcknowledgedAt: CONSENT });
    expect(first.patientId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.displayCode).toBe('P0001');
    expect(first.schemaVersion).toBe(1);
    expect(first.createdAt).toBeDefined();
    const second = await store.createPatient({ name: '陳大同', consentAcknowledgedAt: CONSENT });
    expect(second.displayCode).toBe('P0002');
    expect(await store.getPatient(first.patientId)).toEqual(first);
    expect(await store.listPatients()).toHaveLength(2);
  });

  it('指定 displayCode 不被覆蓋', async () => {
    const store = freshStore();
    const patient = await store.createPatient({
      name: '王小明',
      displayCode: 'VIP-1',
      consentAcknowledgedAt: CONSENT,
    });
    expect(patient.displayCode).toBe('VIP-1');
  });

  it('updatePatient 寫回變更並更新 updatedAt', async () => {
    const store = freshStore();
    const patient = await store.createPatient({ name: '王小明', consentAcknowledgedAt: CONSENT });
    const updated = await store.updatePatient({ ...patient, notes: '備註' });
    expect(updated.notes).toBe('備註');
    expect(updated.updatedAt).toBeDefined();
    expect((await store.getPatient(patient.patientId))?.notes).toBe('備註');
  });

  it('deletePatient 連同其評估刪除', async () => {
    const store = freshStore();
    const patient = await store.createPatient({ name: '王小明', consentAcknowledgedAt: CONSENT });
    await store.saveAssessment(makeSession('S1', patient.patientId));
    await store.saveAssessment(makeSession('S2', patient.patientId));
    await store.deletePatient(patient.patientId);
    expect(await store.getPatient(patient.patientId)).toBeUndefined();
    expect(await store.listAssessmentsByPatient(patient.patientId)).toHaveLength(0);
  });
});

describe('localStore：評估 CRUD 與 summary 重算', () => {
  it('saveAssessment 重算 summary（唯一寫入點，06 §6.3）', async () => {
    const store = freshStore();
    const saved = await store.saveAssessment(makeSession('S1', 'P-X'));
    expect(saved.summary).toEqual({
      counts: { FN: 0, FP: 0, DN: 1, DP: 0 },
      painfulPatterns: [],
      dysfunctionalPatterns: ['cervicalFlexion'],
    });
    expect((await store.getAssessment('S1'))?.summary.counts.DN).toBe(1);
  });

  it('listAssessmentsByPatient 依索引只回該個案', async () => {
    const store = freshStore();
    await store.saveAssessment(makeSession('S1', 'P-A'));
    await store.saveAssessment(makeSession('S2', 'P-B'));
    const sessions = await store.listAssessmentsByPatient('P-A');
    expect(sessions.map((s) => s.sessionId)).toEqual(['S1']);
  });

  it('deleteAssessment', async () => {
    const store = freshStore();
    await store.saveAssessment(makeSession('S1', 'P-A'));
    await store.deleteAssessment('S1');
    expect(await store.getAssessment('S1')).toBeUndefined();
  });
});

describe('localStore：settings 單例（06 §6.10）', () => {
  it('未存時 undefined；save 後可取回且固定 settingsId', async () => {
    const store = freshStore();
    expect(await store.getSettings()).toBeUndefined();
    await store.saveSettings({ ...SETTINGS, settingsId: 'app' });
    const loaded = await store.getSettings();
    expect(loaded?.settingsId).toBe('app');
    expect(loaded?.locale).toBe('zh-TW');
  });
});

describe('localStore：importBatch（06 §6.7 第 4 步）', () => {
  it('skip：同識別碼不覆蓋；其餘寫入且 summary 重算', async () => {
    const store = freshStore();
    const existing = await store.createPatient({ name: '原有', consentAcknowledgedAt: CONSENT });
    const incoming = { ...existing, name: '匯入版' };
    const result = await store.importBatch(
      { patients: [incoming], assessments: [makeSession('S1', existing.patientId)] },
      { conflictStrategy: 'skip', applySettings: false },
    );
    expect(result).toMatchObject({
      patientsWritten: 0,
      patientsSkipped: 1,
      assessmentsWritten: 1,
      assessmentsSkipped: 0,
    });
    expect((await store.getPatient(existing.patientId))?.name).toBe('原有');
    expect((await store.getAssessment('S1'))?.summary.counts.DN).toBe(1);
  });

  it('overwrite：同識別碼覆蓋', async () => {
    const store = freshStore();
    const existing = await store.createPatient({ name: '原有', consentAcknowledgedAt: CONSENT });
    const result = await store.importBatch(
      { patients: [{ ...existing, name: '匯入版' }], assessments: [] },
      { conflictStrategy: 'overwrite', applySettings: false },
    );
    expect(result.patientsWritten).toBe(1);
    expect((await store.getPatient(existing.patientId))?.name).toBe('匯入版');
  });

  it('settings 僅 applySettings=true 時套用', async () => {
    const store = freshStore();
    await store.importBatch(
      { patients: [], assessments: [], settings: SETTINGS },
      { conflictStrategy: 'skip', applySettings: false },
    );
    expect(await store.getSettings()).toBeUndefined();
    const result = await store.importBatch(
      { patients: [], assessments: [], settings: SETTINGS },
      { conflictStrategy: 'skip', applySettings: true },
    );
    expect(result.settingsApplied).toBe(true);
    expect((await store.getSettings())?.theme).toBe('system');
  });
});
