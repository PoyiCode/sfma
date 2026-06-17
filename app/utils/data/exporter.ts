import {
  CURRENT_SCHEMA_VERSION,
  EXPORT_VERSION,
  toIsoDate,
  toIsoDateTime,
  type AppSettings,
  type AssessmentSession,
  type ExportEnvelope,
  type ExportScope,
  type Patient,
} from '@ptapp/shared';
import { actionLogger } from '../devtools/actionLogger';
import type { Repository } from './repository';

// File System Access API 尚未入 lib.dom，自行宣告最小型別（Chromium 桌面）
interface SaveFilePickerHandle {
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}
declare global {
  interface Window {
    showSaveFilePicker?: (options: {
      suggestedName?: string;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<SaveFilePickerHandle>;
  }
}

// 檔名慣例（06 §6.7）：ptApp-export-{範圍}-{日期}.json
export function exportFileName(scopeTag: string, date: Date): string {
  return `ptApp-export-${scopeTag}-${toIsoDate(date)}.json`;
}

export function buildExportEnvelope(input: {
  scope: ExportScope;
  patients: Patient[];
  assessments: AssessmentSession[];
  settings?: AppSettings;
  exportedAt: Date;
}): ExportEnvelope {
  const envelope: ExportEnvelope = {
    exportVersion: EXPORT_VERSION,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: toIsoDateTime(input.exportedAt),
    scope: input.scope,
    patients: input.patients,
    assessments: input.assessments,
  };
  if (input.settings !== undefined) envelope.settings = input.settings;
  return envelope;
}

export interface ExportFile {
  envelope: ExportEnvelope;
  fileName: string;
}

// 單一個案：該個案＋其全部評估（06 §6.7）
export async function buildPatientExport(
  repo: Repository,
  patientId: string,
  now: Date = new Date(),
): Promise<ExportFile> {
  const patient = await repo.getPatient(patientId);
  if (patient === undefined) throw new Error(`patient not found: ${patientId}`);
  const assessments = await repo.listAssessmentsByPatient(patientId);
  const envelope = buildExportEnvelope({
    scope: 'patient',
    patients: [patient],
    assessments,
    exportedAt: now,
  });
  actionLogger.log('data', 'exportPatient', patientId);
  return { envelope, fileName: exportFileName(patient.displayCode ?? patient.patientId, now) };
}

// 全部備份：所有個案與評估，附 settings（06 §6.7、§6.10）。repo 僅需清單／設定查詢面（最小 DI）。
export async function buildFullExport(
  repo: Pick<Repository, 'listPatients' | 'listAssessmentsByPatient' | 'getSettings'>,
  now: Date = new Date(),
): Promise<ExportFile> {
  const patients = await repo.listPatients();
  const assessments: AssessmentSession[] = [];
  for (const patient of patients) {
    assessments.push(...(await repo.listAssessmentsByPatient(patient.patientId)));
  }
  const settings = await repo.getSettings();
  const envelope = buildExportEnvelope({
    scope: 'all',
    patients,
    assessments,
    settings,
    exportedAt: now,
  });
  actionLogger.log(
    'data',
    'exportAll',
    `patients=${patients.length} assessments=${assessments.length}`,
  );
  return { envelope, fileName: exportFileName('all', now) };
}

export type SaveStrategy = 'fileSystemAccess' | 'webShare' | 'download';

export interface SaveCapabilities {
  hasFileSystemAccess: boolean;
  canShareFiles: boolean;
}

// 平台遞補（06 §6.7）：FSA（Chromium 桌面自選位置）→ Web Share（iOS PWA 主要路徑）→ Blob 下載
export function pickSaveStrategy(caps: SaveCapabilities): SaveStrategy {
  if (caps.hasFileSystemAccess) return 'fileSystemAccess';
  if (caps.canShareFiles) return 'webShare';
  return 'download';
}

export function detectSaveCapabilities(file: File): SaveCapabilities {
  return {
    hasFileSystemAccess: typeof window !== 'undefined' && window.showSaveFilePicker !== undefined,
    canShareFiles:
      typeof navigator !== 'undefined' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] }),
  };
}

// 瀏覽器端產生檔案、不經伺服器（06 §6.7）；使用者取消（AbortError）不視為錯誤
export async function saveExportFile(exportFile: ExportFile): Promise<SaveStrategy | 'cancelled'> {
  const json = JSON.stringify(exportFile.envelope, null, 2);
  const file = new File([json], exportFile.fileName, { type: 'application/json' });
  const strategy = pickSaveStrategy(detectSaveCapabilities(file));
  try {
    if (strategy === 'fileSystemAccess' && window.showSaveFilePicker !== undefined) {
      const handle = await window.showSaveFilePicker({
        suggestedName: exportFile.fileName,
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
    } else if (strategy === 'webShare') {
      await navigator.share({ files: [file] });
    } else {
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = exportFile.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      actionLogger.log('data', 'exportCancelled', exportFile.fileName);
      return 'cancelled';
    }
    throw error;
  }
  actionLogger.log('data', 'exportSaved', `${exportFile.fileName} via=${strategy}`);
  return strategy;
}
