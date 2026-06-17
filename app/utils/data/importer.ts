import {
  CURRENT_SCHEMA_VERSION,
  EXPORT_VERSION,
  exportEnvelopeSchema,
  type ExportEnvelope,
} from '@ptapp/shared';
import { actionLogger } from '../devtools/actionLogger';
import {
  applyMigrations,
  assessmentMigrations,
  patientMigrations,
  settingsMigrations,
} from './migrations';
import type { ImportConflictStrategy, ImportResult, Repository } from './repository';

export type ImportErrorCode =
  | 'invalidJson'
  | 'invalidEnvelope'
  | 'unsupportedExportVersion'
  | 'unsupportedSchemaVersion'
  | 'validationFailed';

// 匯入錯誤以代碼表示；顯示文字由 UI 層 i18n 對應（07 §7.4），message 僅供診斷
export class ImportError extends Error {
  readonly code: ImportErrorCode;

  constructor(code: ImportErrorCode, message: string) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ImportError('invalidEnvelope', `${label} is not an object`);
  }
  return value as Record<string, unknown>;
}

// 匯入四步驟之 1–3（06 §6.7）：信封驗證 → 版本遷移 → zod 整檔驗證。
// zod schema 只描述現行版本，故必須「先遷移、後全驗證」。
export function parseExportFile(text: string): ExportEnvelope {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('invalidJson', 'not valid JSON');
  }
  const envelope = asRecord(raw, 'envelope');
  const { exportVersion, schemaVersion } = envelope;
  if (typeof exportVersion !== 'number' || typeof schemaVersion !== 'number') {
    throw new ImportError('invalidEnvelope', 'missing exportVersion/schemaVersion');
  }
  if (exportVersion > EXPORT_VERSION) {
    throw new ImportError(
      'unsupportedExportVersion',
      `exportVersion ${exportVersion} > supported ${EXPORT_VERSION}`,
    );
  }
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new ImportError(
      'unsupportedSchemaVersion',
      `schemaVersion ${schemaVersion} > supported ${CURRENT_SCHEMA_VERSION}`,
    );
  }
  if (!Array.isArray(envelope.patients) || !Array.isArray(envelope.assessments)) {
    throw new ImportError('invalidEnvelope', 'patients/assessments must be arrays');
  }

  // 先遷移：各紀錄依自身 schemaVersion 升至現行版（06 §6.8）
  let migrated: Record<string, unknown>;
  try {
    migrated = {
      ...envelope,
      schemaVersion: CURRENT_SCHEMA_VERSION,
      patients: envelope.patients.map((record, index) =>
        applyMigrations(asRecord(record, `patients[${index}]`), patientMigrations),
      ),
      assessments: envelope.assessments.map((record, index) =>
        applyMigrations(asRecord(record, `assessments[${index}]`), assessmentMigrations),
      ),
      settings:
        envelope.settings === undefined
          ? undefined
          : applyMigrations(asRecord(envelope.settings, 'settings'), settingsMigrations),
    };
  } catch (error) {
    if (error instanceof ImportError) throw error;
    throw new ImportError(
      'invalidEnvelope',
      error instanceof Error ? error.message : String(error),
    );
  }

  // 後全驗證：失敗整檔拒絕、不部分寫入（06 §6.7）
  const result = exportEnvelopeSchema.safeParse(migrated);
  if (!result.success) {
    throw new ImportError('validationFailed', result.error.message);
  }
  return result.data;
}

// 檔案讀取（input file／拖放皆得 File 物件；UI 於 06 介面輪接上）
export async function readImportFile(file: { text(): Promise<string> }): Promise<ExportEnvelope> {
  return parseExportFile(await file.text());
}

export interface ImportPlan {
  envelope: ExportEnvelope;
  conflictingPatientIds: string[];
  conflictingSessionIds: string[];
  hasSettings: boolean;
}

// 衝突偵測（06 §6.7）：供 UI 詢問「略過（預設）／覆蓋」。repo 僅需查詢面（最小 DI、便於上層注入）。
export async function planImport(
  repo: Pick<Repository, 'getPatient' | 'getAssessment'>,
  envelope: ExportEnvelope,
): Promise<ImportPlan> {
  const conflictingPatientIds: string[] = [];
  for (const patient of envelope.patients) {
    if ((await repo.getPatient(patient.patientId)) !== undefined) {
      conflictingPatientIds.push(patient.patientId);
    }
  }
  const conflictingSessionIds: string[] = [];
  for (const session of envelope.assessments) {
    if ((await repo.getAssessment(session.sessionId)) !== undefined) {
      conflictingSessionIds.push(session.sessionId);
    }
  }
  return {
    envelope,
    conflictingPatientIds,
    conflictingSessionIds,
    hasSettings: envelope.settings !== undefined,
  };
}

// 第 4 步：交易性寫入（localStore.importBatch）；預設 skip／不套用 settings（06 §6.7、§6.10）。
// repo 僅需 importBatch 面（最小 DI、便於上層注入）。
export async function executeImport(
  repo: Pick<Repository, 'importBatch'>,
  plan: ImportPlan,
  options: { conflictStrategy?: ImportConflictStrategy; applySettings?: boolean } = {},
): Promise<ImportResult> {
  const result = await repo.importBatch(
    {
      patients: plan.envelope.patients,
      assessments: plan.envelope.assessments,
      settings: plan.envelope.settings,
    },
    {
      conflictStrategy: options.conflictStrategy ?? 'skip',
      applySettings: options.applySettings ?? false,
    },
  );
  actionLogger.log(
    'data',
    'import',
    `patients=${result.patientsWritten} assessments=${result.assessmentsWritten} settingsApplied=${String(result.settingsApplied)}`,
  );
  return result;
}
