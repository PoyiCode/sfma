import {
  deriveClassification,
  type FailedCriterionCode,
  type PatternClassification,
  type PatternRecord,
  type SfmaPatternDefinition,
  type SfmaPatternKey,
  type Side,
} from '@ptapp/shared';

// 評估表單一筆描述（一個 pattern×side 組合）：對應 patterns[] 至多一筆紀錄（05 §5.2）。
export interface AssessmentEntry {
  patternKey: SfmaPatternKey;
  side: Side;
  definition: SfmaPatternDefinition;
}

// 展開 10 大動作定義為 15 筆評估描述：單一→1 筆（side null）、雙側→左右各 1 筆（左先右後）。
export function buildAssessmentEntries(
  definitions: readonly SfmaPatternDefinition[],
): AssessmentEntry[] {
  const entries: AssessmentEntry[] = [];
  for (const definition of definitions) {
    if (definition.side === 'bilateral') {
      entries.push({ patternKey: definition.patternKey, side: 'left', definition });
      entries.push({ patternKey: definition.patternKey, side: 'right', definition });
    } else {
      entries.push({ patternKey: definition.patternKey, side: null, definition });
    }
  }
  return entries;
}

// 紀錄鍵：單一動作為 patternKey、雙側含側別（與 shared/derive.ts recordKey 同格式；06 §6.3）。
export function entryId(patternKey: SfmaPatternKey, side: Side): string {
  return side === null ? patternKey : `${patternKey}:${side}`;
}

// 空白紀錄（全 false）：「已判讀為 FN」（存於 patterns[]）與「尚未判讀」（不存於 patterns[]）有別。
export function emptyRecord(patternKey: SfmaPatternKey, side: Side): PatternRecord {
  return { patternKey, side, dysfunctional: false, painful: false, failedCriteria: [], notes: '' };
}

// 勾選任一判讀標準即自動「功能異常」（05 §5.2）。
export function autoDeriveDysfunctional(failedCriteria: readonly FailedCriterionCode[]): boolean {
  return failedCriteria.length > 0;
}

// 「已手動」＝治療師覆寫了標準自動帶入之 dysfunctional 值（衍生、不入庫；05 §5.2、03 §3.3.9）。
export function isManualOverride(record: PatternRecord): boolean {
  return record.dysfunctional !== autoDeriveDysfunctional(record.failedCriteria);
}

// 單筆即時分類（FN/FP/DN/DP；衍生不入庫）。
export function entryClassification(record: PatternRecord): PatternClassification {
  return deriveClassification(record.dysfunctional, record.painful);
}

// 取既有紀錄（未判讀回 undefined）。
export function findRecord(
  patterns: readonly PatternRecord[],
  patternKey: SfmaPatternKey,
  side: Side,
): PatternRecord | undefined {
  return patterns.find((record) => record.patternKey === patternKey && record.side === side);
}

// 寫入紀錄：同 pattern×side 既有則取代、否則附加（回傳新陣列、不變動原陣列）。
export function upsertRecord(
  patterns: readonly PatternRecord[],
  record: PatternRecord,
): PatternRecord[] {
  const index = patterns.findIndex(
    (existing) => existing.patternKey === record.patternKey && existing.side === record.side,
  );
  if (index === -1) return [...patterns, record];
  const next = [...patterns];
  next[index] = record;
  return next;
}

// 進度：已判讀筆數（patterns.length）／總筆數（entries.length＝15）。
export function assessmentProgress(
  patterns: readonly PatternRecord[],
  entries: readonly AssessmentEntry[],
): { assessed: number; total: number } {
  return { assessed: patterns.length, total: entries.length };
}

// 切換某判讀標準的勾選狀態（不變動原紀錄）；變更後 dysfunctional 重新貼齊自動值
// （勾任一標準→異常；05 §5.2、03 §3.3.9）。治療師若隨後手動調整 dysfunctional，
// isManualOverride 即顯「已手動」，直到下次標準變更再次貼齊。
export function toggleCriterion(record: PatternRecord, code: FailedCriterionCode): PatternRecord {
  const failedCriteria = record.failedCriteria.includes(code)
    ? record.failedCriteria.filter((existing) => existing !== code)
    : [...record.failedCriteria, code];
  return { ...record, failedCriteria, dysfunctional: autoDeriveDysfunctional(failedCriteria) };
}

// 同一動作的各側題項分為一組（10 組）：保留動作順序，雙側組含 left／right 兩筆、單一組一筆。
export interface AssessmentEntryGroup {
  patternKey: SfmaPatternKey;
  definition: SfmaPatternDefinition;
  entries: AssessmentEntry[];
}

export function groupAssessmentEntries(
  entries: readonly AssessmentEntry[],
): AssessmentEntryGroup[] {
  const groups: AssessmentEntryGroup[] = [];
  const byKey = new Map<SfmaPatternKey, AssessmentEntryGroup>();
  for (const entry of entries) {
    let group = byKey.get(entry.patternKey);
    if (!group) {
      group = { patternKey: entry.patternKey, definition: entry.definition, entries: [] };
      byKey.set(entry.patternKey, group);
      groups.push(group);
    }
    group.entries.push(entry);
  }
  return groups;
}

// 設定疼痛（不變動原紀錄、不動功能軸與標準）。
export function setPainful(record: PatternRecord, painful: boolean): PatternRecord {
  return { ...record, painful };
}

// 手動設定功能軸（不變動原紀錄、不動 failedCriteria）；與標準自動值相異即成「已手動」覆寫。
export function setDysfunctional(record: PatternRecord, dysfunctional: boolean): PatternRecord {
  return { ...record, dysfunctional };
}
