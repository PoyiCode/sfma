import { CURRENT_SCHEMA_VERSION } from '@ptapp/shared';

// schemaVersion 遷移框架（06 §6.8）：載入與匯入共用；匯入採「先遷移、後全驗證」（06 §6.7）
export type MigrationStep = (record: Record<string, unknown>) => Record<string, unknown>;
// key＝來源版本；step 將紀錄由 key 版升至 key+1 版（須一併改寫 schemaVersion）
export type MigrationSteps = Readonly<Record<number, MigrationStep>>;

export function applyMigrations(
  record: Record<string, unknown>,
  steps: MigrationSteps,
  targetVersion: number = CURRENT_SCHEMA_VERSION,
): Record<string, unknown> {
  const version = record.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error(`invalid schemaVersion: ${String(version)}`);
  }
  if (version > targetVersion) {
    throw new Error(`schemaVersion ${version} newer than supported ${targetVersion}`);
  }
  let current = record;
  for (let from = version; from < targetVersion; from += 1) {
    const step = steps[from];
    if (step === undefined) throw new Error(`missing migration step from version ${from}`);
    current = step(current);
  }
  return current;
}

// 現行皆為 v1，尚無遷移步驟；發布新版 schema 時於此登錄（06 §6.8）
export const patientMigrations: MigrationSteps = {};
export const assessmentMigrations: MigrationSteps = {};
export const settingsMigrations: MigrationSteps = {};
