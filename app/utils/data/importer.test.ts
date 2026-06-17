import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { AssessmentSession } from '@ptapp/shared';
import { createLocalStore } from './localStore';
import { buildFullExport } from './exporter';
import {
  executeImport,
  ImportError,
  parseExportFile,
  planImport,
  readImportFile,
} from './importer';

let dbCounter = 0;
function freshStore() {
  dbCounter += 1;
  return createLocalStore(`imp-test-${dbCounter}`);
}

const CONSENT = '2026-06-13T09:00:00+08:00';

const VALID_PATIENT = {
  schemaVersion: 1,
  patientId: 'p-1',
  displayCode: 'P0001',
  name: '王小明',
  consentAcknowledgedAt: CONSENT,
};

// 型別註記使 patternKey 等收斂為列舉字面量 — roundtrip 測試會直接餵給 saveAssessment
const VALID_SESSION: AssessmentSession = {
  schemaVersion: 1,
  sessionId: 'S1',
  patientId: 'p-1',
  assessor: { assessorId: 'T01', name: '李治療師' },
  assessedAt: '2026-06-13T09:30:00+08:00',
  patterns: [
    {
      patternKey: 'cervicalFlexion',
      side: null,
      dysfunctional: true,
      painful: false,
      failedCriteria: [],
      notes: '',
    },
  ],
  breakouts: [],
  bodyAnnotations: [],
  // 檔內 summary 故意給錯：匯入須忽略並重算（06 §6.7）
  summary: {
    counts: { FN: 9, FP: 9, DN: 9, DP: 9 },
    painfulPatterns: [],
    dysfunctionalPatterns: [],
  },
};

function makeEnvelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    exportVersion: 1,
    schemaVersion: 1,
    exportedAt: '2026-06-13T18:00:00+08:00',
    scope: 'patient',
    patients: [VALID_PATIENT],
    assessments: [VALID_SESSION],
    ...overrides,
  });
}

function expectImportError(fn: () => unknown, code: string) {
  try {
    fn();
    expect.unreachable('應擲 ImportError');
  } catch (error) {
    expect(error).toBeInstanceOf(ImportError);
    expect((error as ImportError).code).toBe(code);
  }
}

describe('parseExportFile（06 §6.7 步驟 1–3）', () => {
  it('合法檔 → 型別化封裝', () => {
    const envelope = parseExportFile(makeEnvelope());
    expect(envelope.patients[0]?.name).toBe('王小明');
  });

  it('非 JSON → invalidJson', () => {
    expectImportError(() => parseExportFile('not-json{'), 'invalidJson');
  });

  it('頂層非物件／缺版本欄位 → invalidEnvelope', () => {
    expectImportError(() => parseExportFile('[1,2]'), 'invalidEnvelope');
    expectImportError(() => parseExportFile('{"patients":[]}'), 'invalidEnvelope');
  });

  it('exportVersion 過新 → unsupportedExportVersion', () => {
    expectImportError(
      () => parseExportFile(makeEnvelope({ exportVersion: 99 })),
      'unsupportedExportVersion',
    );
  });

  it('schemaVersion 過新 → unsupportedSchemaVersion', () => {
    expectImportError(
      () => parseExportFile(makeEnvelope({ schemaVersion: 99 })),
      'unsupportedSchemaVersion',
    );
  });

  it('紀錄 schemaVersion 比現行新 → invalidEnvelope（遷移失敗）', () => {
    expectImportError(
      () => parseExportFile(makeEnvelope({ patients: [{ ...VALID_PATIENT, schemaVersion: 99 }] })),
      'invalidEnvelope',
    );
  });

  it('內容非法（patternKey 錯）→ validationFailed、整檔拒絕', () => {
    const invalidSession = {
      ...VALID_SESSION,
      patterns: [{ ...VALID_SESSION.patterns[0], patternKey: 'nope' }],
    };
    expectImportError(
      () => parseExportFile(makeEnvelope({ assessments: [invalidSession] })),
      'validationFailed',
    );
  });
});

describe('planImport／executeImport（06 §6.7 衝突與步驟 4）', () => {
  it('偵測同識別碼衝突', async () => {
    const store = freshStore();
    const existing = await store.createPatient({ name: '原有', consentAcknowledgedAt: CONSENT });
    const text = makeEnvelope({
      patients: [{ ...VALID_PATIENT, patientId: existing.patientId }],
      assessments: [],
    });
    const plan = await planImport(store, parseExportFile(text));
    expect(plan.conflictingPatientIds).toEqual([existing.patientId]);
    expect(plan.conflictingSessionIds).toEqual([]);
  });

  it('預設 skip：衝突不覆蓋；非衝突寫入且 summary 重算', async () => {
    const store = freshStore();
    const plan = await planImport(store, parseExportFile(makeEnvelope()));
    const result = await executeImport(store, plan);
    expect(result).toMatchObject({
      patientsWritten: 1,
      assessmentsWritten: 1,
      settingsApplied: false,
    });
    expect((await store.getAssessment('S1'))?.summary.counts).toEqual({
      FN: 0,
      FP: 0,
      DN: 1,
      DP: 0,
    });
  });

  it('overwrite 覆蓋既有紀錄', async () => {
    const store = freshStore();
    const existing = await store.createPatient({ name: '原有', consentAcknowledgedAt: CONSENT });
    const text = makeEnvelope({
      patients: [{ ...VALID_PATIENT, patientId: existing.patientId, name: '匯入版' }],
      assessments: [],
    });
    const plan = await planImport(store, parseExportFile(text));
    await executeImport(store, plan, { conflictStrategy: 'overwrite' });
    expect((await store.getPatient(existing.patientId))?.name).toBe('匯入版');
  });

  it('settings 預設略過、applySettings 時套用（06 §6.10）', async () => {
    const store = freshStore();
    const settings = {
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
    const text = makeEnvelope({ scope: 'all', settings });
    const planA = await planImport(store, parseExportFile(text));
    expect(planA.hasSettings).toBe(true);
    await executeImport(store, planA);
    expect(await store.getSettings()).toBeUndefined();
    const planB = await planImport(store, parseExportFile(text));
    const result = await executeImport(store, planB, { applySettings: true });
    expect(result.settingsApplied).toBe(true);
  });
});

describe('整檔拒絕：驗證失敗不寫入任何資料（06 §6.7）', () => {
  it('一筆評估非法 → parse 即擲錯，store 維持空', async () => {
    const store = freshStore();
    const invalidSession = { ...VALID_SESSION, assessor: { assessorId: 'T01' } };
    expect(() => parseExportFile(makeEnvelope({ assessments: [invalidSession] }))).toThrow(
      ImportError,
    );
    expect(await store.listPatients()).toHaveLength(0);
  });
});

describe('匯出→匯入還原（roundtrip）', () => {
  it('full export 經文字往返後可完整匯入新店', async () => {
    const source = freshStore();
    const patient = await source.createPatient({ name: '王小明', consentAcknowledgedAt: CONSENT });
    await source.saveAssessment({
      ...VALID_SESSION,
      sessionId: 'S9',
      patientId: patient.patientId,
    });
    const { envelope } = await buildFullExport(source, new Date(2026, 5, 13));
    const target = freshStore();
    const parsed = await readImportFile({ text: async () => JSON.stringify(envelope) });
    const result = await executeImport(target, await planImport(target, parsed));
    expect(result.patientsWritten).toBe(1);
    expect(result.assessmentsWritten).toBe(1);
    expect((await target.getPatient(patient.patientId))?.name).toBe('王小明');
    expect((await target.getAssessment('S9'))?.summary.counts.DN).toBe(1);
  });
});
