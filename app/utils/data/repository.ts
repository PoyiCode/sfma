import type { AppSettings, AssessmentSession, Patient } from '@ptapp/shared';

// Repository 介面（02 §2.7–2.8、07 §7.2）：上層僅面對此介面；
// 開發期實作為 localStore（IndexedDB），未來加 apiClient 不動上層。

export interface CreatePatientInput {
  name: string;
  displayCode?: string;
  gender?: Patient['gender'];
  birthDate?: string;
  contact?: Patient['contact'];
  notes?: string;
  // 未取得當事人同意不建立個案（06 §6.2、08 §8.5）
  consentAcknowledgedAt: string;
}

export type ImportConflictStrategy = 'skip' | 'overwrite';

export interface ImportBatch {
  patients: Patient[];
  assessments: AssessmentSession[];
  settings?: AppSettings;
}

export interface ImportResult {
  patientsWritten: number;
  patientsSkipped: number;
  assessmentsWritten: number;
  assessmentsSkipped: number;
  settingsApplied: boolean;
}

export interface Repository {
  listPatients(): Promise<Patient[]>;
  getPatient(patientId: string): Promise<Patient | undefined>;
  createPatient(input: CreatePatientInput): Promise<Patient>;
  updatePatient(patient: Patient): Promise<Patient>;
  /** 連同該個案全部評估紀錄於同一交易刪除 */
  deletePatient(patientId: string): Promise<void>;
  listAssessmentsByPatient(patientId: string): Promise<AssessmentSession[]>;
  getAssessment(sessionId: string): Promise<AssessmentSession | undefined>;
  /** summary 唯一寫入點：寫入前由 patterns 重算（06 §6.3） */
  saveAssessment(session: AssessmentSession): Promise<AssessmentSession>;
  deleteAssessment(sessionId: string): Promise<void>;
  getSettings(): Promise<AppSettings | undefined>;
  saveSettings(settings: AppSettings): Promise<AppSettings>;
  /** 匯入第 4 步：交易性寫入；衝突策略與設定套用由呼叫端（UI）決定（06 §6.7） */
  importBatch(
    batch: ImportBatch,
    options: { conflictStrategy: ImportConflictStrategy; applySettings: boolean },
  ): Promise<ImportResult>;
}
