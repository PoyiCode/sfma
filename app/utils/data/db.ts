import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, AssessmentSession, Patient } from '@ptapp/shared';

// IndexedDB 結構（06 §6.6）：patients／assessments／settings 三個 object store；
// 評估依 patientId 建索引供個案頁查詢
export interface PtAppDb extends DBSchema {
  patients: { key: string; value: Patient };
  assessments: {
    key: string;
    value: AssessmentSession;
    indexes: { byPatientId: string };
  };
  settings: { key: string; value: AppSettings };
}

export const DB_NAME = 'ptapp';
export const DB_VERSION = 1;

export function openPtAppDb(dbName: string = DB_NAME): Promise<IDBPDatabase<PtAppDb>> {
  return openDB<PtAppDb>(dbName, DB_VERSION, {
    upgrade(db) {
      db.createObjectStore('patients', { keyPath: 'patientId' });
      const assessments = db.createObjectStore('assessments', { keyPath: 'sessionId' });
      assessments.createIndex('byPatientId', 'patientId');
      db.createObjectStore('settings', { keyPath: 'settingsId' });
    },
  });
}
