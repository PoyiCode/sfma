import type { AssessmentSession } from '@ptapp/shared';

export interface AssessmentRowData {
  sessionId: string;
  assessedAt: string;
  assessorName: string;
  dn: number;
  dp: number;
}

// 評估紀錄列（03 §3.3.8）：依 assessedAt 降序（最新在前），概況取 summary.counts（06 §6.3 衍生快取）。
export function buildAssessmentRows(sessions: readonly AssessmentSession[]): AssessmentRowData[] {
  return [...sessions]
    .sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime())
    .map((s) => ({
      sessionId: s.sessionId,
      assessedAt: s.assessedAt,
      assessorName: s.assessor.name,
      dn: s.summary.counts.DN,
      dp: s.summary.counts.DP,
    }));
}
