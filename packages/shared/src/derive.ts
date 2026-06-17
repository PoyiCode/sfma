import type { PatternClassification } from './common';
import type { AssessmentSummary, PatternRecord } from './assessment';

// FN/FP/DN/DP 為衍生值，不入庫（06 §6.3）：顯示與 summary 即時推導，避免欄位間矛盾
export function deriveClassification(
  dysfunctional: boolean,
  painful: boolean,
): PatternClassification {
  if (dysfunctional) return painful ? 'DP' : 'DN';
  return painful ? 'FP' : 'FN';
}

// 紀錄鍵：單一動作為 patternKey、雙側含側別（06 §6.3 summary 範例格式）
function recordKey(record: PatternRecord): string {
  return record.side === null ? record.patternKey : `${record.patternKey}:${record.side}`;
}

// summary 推導（衍生快取；06 §6.3）：唯一寫入點為資料層 — patterns 變更即重算寫回、
// 匯入時忽略檔內 summary 重新推導，UI 只讀。
export function deriveSummary(patterns: readonly PatternRecord[]): AssessmentSummary {
  const counts = { FN: 0, FP: 0, DN: 0, DP: 0 };
  const painfulPatterns: string[] = [];
  const dysfunctionalPatterns: string[] = [];
  for (const record of patterns) {
    counts[deriveClassification(record.dysfunctional, record.painful)] += 1;
    if (record.painful) painfulPatterns.push(recordKey(record));
    if (record.dysfunctional) dysfunctionalPatterns.push(recordKey(record));
  }
  return { counts, painfulPatterns, dysfunctionalPatterns };
}
