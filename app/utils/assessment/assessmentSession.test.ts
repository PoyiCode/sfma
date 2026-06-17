import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION } from '@ptapp/shared';
import { newAssessmentSession } from './assessmentSession';

describe('newAssessmentSession', () => {
  it('建立綁定個案／評估者／日期的空白評估紀錄', () => {
    const session = newAssessmentSession(
      'session-1',
      'patient-1',
      { assessorId: 'assessor-1', name: '王治療師' },
      '2026-06-13T09:00:00+08:00',
    );
    expect(session).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      sessionId: 'session-1',
      patientId: 'patient-1',
      assessor: { assessorId: 'assessor-1', name: '王治療師' },
      assessedAt: '2026-06-13T09:00:00+08:00',
      patterns: [],
      breakouts: [],
      bodyAnnotations: [],
    });
  });

  it('空白紀錄之 summary 計數全為 0', () => {
    const session = newAssessmentSession(
      's',
      'p',
      { assessorId: 'a', name: '' },
      '2026-06-13T09:00:00+08:00',
    );
    expect(session.summary).toEqual({
      counts: { FN: 0, FP: 0, DN: 0, DP: 0 },
      painfulPatterns: [],
      dysfunctionalPatterns: [],
    });
  });
});
