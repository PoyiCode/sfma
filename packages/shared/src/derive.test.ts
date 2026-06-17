import { describe, expect, it } from 'vitest';
import { deriveClassification, deriveSummary } from './derive';
import type { PatternRecord } from './assessment';

function record(
  partial: Partial<PatternRecord> & Pick<PatternRecord, 'patternKey'>,
): PatternRecord {
  return {
    side: null,
    dysfunctional: false,
    painful: false,
    failedCriteria: [],
    notes: '',
    ...partial,
  };
}

describe('deriveClassification（06 §6.3 四象限）', () => {
  it.each([
    [false, false, 'FN'],
    [false, true, 'FP'],
    [true, false, 'DN'],
    [true, true, 'DP'],
  ] as const)('dysfunctional=%s painful=%s → %s', (dysfunctional, painful, expected) => {
    expect(deriveClassification(dysfunctional, painful)).toBe(expected);
  });
});

describe('deriveSummary（06 §6.3）', () => {
  it('counts 以判讀紀錄為單位；painful/dysfunctional 鍵含側別、單一動作不含', () => {
    const summary = deriveSummary([
      record({ patternKey: 'cervicalFlexion', dysfunctional: true }),
      record({ patternKey: 'cervicalRotation', side: 'right', dysfunctional: true, painful: true }),
      record({ patternKey: 'cervicalRotation', side: 'left' }),
      record({ patternKey: 'singleLegStance', side: 'left', painful: true }),
    ]);
    expect(summary.counts).toEqual({ FN: 1, FP: 1, DN: 1, DP: 1 });
    expect(summary.painfulPatterns).toEqual(['cervicalRotation:right', 'singleLegStance:left']);
    expect(summary.dysfunctionalPatterns).toEqual(['cervicalFlexion', 'cervicalRotation:right']);
  });

  it('空陣列 → 全 0 與空清單', () => {
    expect(deriveSummary([])).toEqual({
      counts: { FN: 0, FP: 0, DN: 0, DP: 0 },
      painfulPatterns: [],
      dysfunctionalPatterns: [],
    });
  });
});
