import { describe, expect, it } from 'vitest';
import type { AssessmentSession } from '@ptapp/shared';
import { buildAssessmentRows } from './assessmentHistory';

function session(
  sessionId: string,
  assessedAt: string,
  dn: number,
  dp: number,
  assessorName = '李治療師',
): AssessmentSession {
  return {
    schemaVersion: 1,
    sessionId,
    patientId: 'p1',
    assessor: { assessorId: 'T01', name: assessorName },
    assessedAt,
    patterns: [],
    breakouts: [],
    bodyAnnotations: [],
    summary: {
      counts: { FN: 0, FP: 0, DN: dn, DP: dp },
      painfulPatterns: [],
      dysfunctionalPatterns: [],
    },
  };
}

describe('buildAssessmentRows', () => {
  it('依 assessedAt 降序、映射概況與評估者', () => {
    const rows = buildAssessmentRows([
      session('s1', '2026-06-01T09:00:00+08:00', 1, 0),
      session('s2', '2026-06-10T09:00:00+08:00', 2, 1, '王治療師'),
    ]);
    expect(rows.map((r) => r.sessionId)).toEqual(['s2', 's1']);
    expect(rows[0]).toEqual({
      sessionId: 's2',
      assessedAt: '2026-06-10T09:00:00+08:00',
      assessorName: '王治療師',
      dn: 2,
      dp: 1,
    });
  });

  it('空陣列回傳空', () => {
    expect(buildAssessmentRows([])).toEqual([]);
  });
});
