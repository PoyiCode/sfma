import type { BreakoutRecord, LocalizedText, Side } from '@ptapp/shared';
import { entryId, type AssessmentEntry } from './assessmentForm';
import { breakoutFindingViews, type BreakoutFindingView } from './breakoutPresentation';

export interface SummaryPatternView {
  key: string;
  name: LocalizedText;
  side: Side;
}

// summary 之 pattern key 清單（entryId 格式：patternKey 或 patternKey:side）→ 顯示視圖（名稱＋側別）。
// 依 entries 既有順序輸出（穩定排序）；查無對應之 key 略過（如已刪動作）。資料層衍生快取，UI 只讀。
export function summaryPatternViews(
  keys: readonly string[],
  entries: readonly AssessmentEntry[],
): SummaryPatternView[] {
  const keySet = new Set(keys);
  const views: SummaryPatternView[] = [];
  for (const entry of entries) {
    const key = entryId(entry.patternKey, entry.side);
    if (keySet.has(key)) {
      views.push({ key, name: entry.definition.name, side: entry.side });
    }
  }
  return views;
}

export interface BreakoutOverviewRow {
  key: string;
  name: LocalizedText;
  side: Side;
  findings: BreakoutFindingView[];
}

// 各動作 Breakout findings 一覽（05 §5.4 line 212、L40）：僅列有 findings 之 breakout，
// 依 entries 順序、含側別；findings 經 breakoutFindingViews（PAIN 置頂、附顯示文字與來源）。
export function breakoutFindingsOverview(
  breakouts: readonly BreakoutRecord[],
  entries: readonly AssessmentEntry[],
): BreakoutOverviewRow[] {
  const rows: BreakoutOverviewRow[] = [];
  for (const entry of entries) {
    const breakout = breakouts.find(
      (record) => record.patternKey === entry.patternKey && record.side === entry.side,
    );
    if (!breakout || breakout.findings.length === 0) continue;
    rows.push({
      key: entryId(entry.patternKey, entry.side),
      name: entry.definition.name,
      side: entry.side,
      findings: breakoutFindingViews(breakout.findings),
    });
  }
  return rows;
}
