import {
  CURRENT_SCHEMA_VERSION,
  createUuid,
  deriveSummary,
  nextDisplayCode,
  toIsoDateTime,
  type AppSettings,
  type AssessmentSession,
  type Patient,
} from '@ptapp/shared';
import type { IDBPDatabase } from 'idb';
import { actionLogger } from '../devtools/actionLogger';
import { DB_NAME, openPtAppDb, type PtAppDb } from './db';
import {
  applyMigrations,
  assessmentMigrations,
  patientMigrations,
  settingsMigrations,
  type MigrationSteps,
} from './migrations';
import type { CreatePatientInput, ImportBatch, ImportResult, Repository } from './repository';

// 載入時依紀錄自身 schemaVersion 升級（06 §6.8）；現行 v1 為直通
function migrate<T>(record: T, steps: MigrationSteps): T {
  return applyMigrations(record as unknown as Record<string, unknown>, steps) as unknown as T;
}

// 寫入 IndexedDB 前一律轉純資料：上層（Vue composables）可能傳入 reactive proxy，
// 結構化複製 proxy 於真實瀏覽器擲 DataCloneError。DTO 皆 camelCase JSON（無 Date／函式），
// JSON 往返無損且深層去 proxy；框架無關（不依賴 Vue）。fake-indexeddb 不強制結構化複製，
// 故此防線於實機才實質生效、測試行為不受影響。
function toStorable<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// 開發期 Repository 實作：IndexedDB 為真實來源（02 §2.6–2.8）
export function createLocalStore(dbName: string = DB_NAME): Repository {
  let dbPromise: Promise<IDBPDatabase<PtAppDb>> | undefined;
  function db(): Promise<IDBPDatabase<PtAppDb>> {
    dbPromise ??= openPtAppDb(dbName);
    return dbPromise;
  }

  return {
    async listPatients() {
      const records = await (await db()).getAll('patients');
      return records.map((record) => migrate(record, patientMigrations));
    },

    async getPatient(patientId) {
      const record = await (await db()).get('patients', patientId);
      return record === undefined ? undefined : migrate(record, patientMigrations);
    },

    async createPatient(input: CreatePatientInput) {
      const database = await db();
      const now = toIsoDateTime(new Date());
      const existing = await database.getAll('patients');
      const patient: Patient = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        patientId: createUuid(),
        displayCode: input.displayCode ?? nextDisplayCode(existing.map((p) => p.displayCode)),
        name: input.name,
        createdAt: now,
        updatedAt: now,
        consentAcknowledgedAt: input.consentAcknowledgedAt,
      };
      if (input.gender !== undefined) patient.gender = input.gender;
      if (input.birthDate !== undefined) patient.birthDate = input.birthDate;
      if (input.contact !== undefined) patient.contact = input.contact;
      if (input.notes !== undefined) patient.notes = input.notes;
      await database.put('patients', patient);
      actionLogger.log('data', 'createPatient', patient.patientId);
      return patient;
    },

    async updatePatient(patient) {
      const updated: Patient = toStorable({ ...patient, updatedAt: toIsoDateTime(new Date()) });
      await (await db()).put('patients', updated);
      actionLogger.log('data', 'updatePatient', patient.patientId);
      return updated;
    },

    async deletePatient(patientId) {
      const database = await db();
      const tx = database.transaction(['patients', 'assessments'], 'readwrite');
      const sessionKeys = await tx
        .objectStore('assessments')
        .index('byPatientId')
        .getAllKeys(patientId);
      for (const key of sessionKeys) await tx.objectStore('assessments').delete(key);
      await tx.objectStore('patients').delete(patientId);
      await tx.done;
      actionLogger.log('data', 'deletePatient', `${patientId} sessions=${sessionKeys.length}`);
    },

    async listAssessmentsByPatient(patientId) {
      const records = await (await db()).getAllFromIndex('assessments', 'byPatientId', patientId);
      return records.map((record) => migrate(record, assessmentMigrations));
    },

    async getAssessment(sessionId) {
      const record = await (await db()).get('assessments', sessionId);
      return record === undefined ? undefined : migrate(record, assessmentMigrations);
    },

    async saveAssessment(session) {
      // summary 唯一寫入點：patterns 變更即重算寫回，UI 只讀（06 §6.3）
      const saved: AssessmentSession = toStorable({
        ...session,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        summary: deriveSummary(session.patterns),
      });
      await (await db()).put('assessments', saved);
      actionLogger.log('data', 'saveAssessment', saved.sessionId);
      return saved;
    },

    async deleteAssessment(sessionId) {
      await (await db()).delete('assessments', sessionId);
      actionLogger.log('data', 'deleteAssessment', sessionId);
    },

    async getSettings() {
      const record = await (await db()).get('settings', 'app');
      return record === undefined ? undefined : migrate(record, settingsMigrations);
    },

    async saveSettings(settings) {
      const saved: AppSettings = toStorable({
        ...settings,
        schemaVersion: CURRENT_SCHEMA_VERSION,
        settingsId: 'app',
        updatedAt: toIsoDateTime(new Date()),
      });
      await (await db()).put('settings', saved);
      actionLogger.log('data', 'saveSettings', 'app');
      return saved;
    },

    async importBatch(batch: ImportBatch, options) {
      const database = await db();
      const tx = database.transaction(['patients', 'assessments', 'settings'], 'readwrite');
      const result: ImportResult = {
        patientsWritten: 0,
        patientsSkipped: 0,
        assessmentsWritten: 0,
        assessmentsSkipped: 0,
        settingsApplied: false,
      };
      const patients = tx.objectStore('patients');
      for (const patient of batch.patients) {
        if (
          options.conflictStrategy === 'skip' &&
          (await patients.getKey(patient.patientId)) !== undefined
        ) {
          result.patientsSkipped += 1;
          continue;
        }
        await patients.put(patient);
        result.patientsWritten += 1;
      }
      const assessments = tx.objectStore('assessments');
      for (const session of batch.assessments) {
        if (
          options.conflictStrategy === 'skip' &&
          (await assessments.getKey(session.sessionId)) !== undefined
        ) {
          result.assessmentsSkipped += 1;
          continue;
        }
        // 匯入時忽略檔內 summary、一律重新推導覆蓋（06 §6.3、§6.7）
        await assessments.put({ ...session, summary: deriveSummary(session.patterns) });
        result.assessmentsWritten += 1;
      }
      if (batch.settings !== undefined && options.applySettings) {
        await tx.objectStore('settings').put({ ...batch.settings, settingsId: 'app' });
        result.settingsApplied = true;
      }
      await tx.done;
      actionLogger.log(
        'data',
        'importBatch',
        `patients=${result.patientsWritten}/${batch.patients.length} assessments=${result.assessmentsWritten}/${batch.assessments.length}`,
      );
      return result;
    },
  };
}

// App 共用單例：上層經 Repository 介面使用（02 §2.7）；DB 於首次操作時才開啟
export const localStore: Repository = createLocalStore();
