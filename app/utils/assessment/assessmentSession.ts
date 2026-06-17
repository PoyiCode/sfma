import {
  CURRENT_SCHEMA_VERSION,
  deriveSummary,
  type Assessor,
  type AssessmentSession,
} from '@ptapp/shared';

// 建立空白評估紀錄（05 §5.4：綁定個案、評估者、日期）。sessionId／assessedAt 由呼叫端帶入
// （createUuid／toIsoDateTime），純函式不呼叫 new Date()／createUuid 以利測試。
// summary 以 deriveSummary([]) 預填（型別需要）；持久化時 repo.saveAssessment 為唯一寫入點會重算。
export function newAssessmentSession(
  sessionId: string,
  patientId: string,
  assessor: Assessor,
  assessedAt: string,
): AssessmentSession {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    sessionId,
    patientId,
    assessor,
    assessedAt,
    patterns: [],
    breakouts: [],
    bodyAnnotations: [],
    summary: deriveSummary([]),
  };
}
