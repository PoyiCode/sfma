import { describe, expect, it } from 'vitest';
import type { AssessmentSession, Patient } from '@ptapp/shared';
import {
  buildPatientListItems,
  filterPatientItems,
  loadPatientListItems,
  summarizePatient,
  type PatientListItemData,
} from './patientListItems';

function patient(patientId: string, name: string, displayCode?: string): Patient {
  return {
    schemaVersion: 1,
    patientId,
    name,
    displayCode,
    consentAcknowledgedAt: '2026-06-13T09:00:00+08:00',
  };
}

function session(
  assessedAt: string,
  dn: number,
  dp: number,
): Pick<AssessmentSession, 'assessedAt' | 'summary'> {
  return {
    assessedAt,
    summary: {
      counts: { FN: 1, FP: 0, DN: dn, DP: dp },
      painfulPatterns: [],
      dysfunctionalPatterns: [],
    },
  };
}

describe('summarizePatient（06 §3.3.8 概況）', () => {
  it('無評估 → kind none、無日期', () => {
    const item = summarizePatient(patient('p1', '王小明', 'P001'), []);
    expect(item.summary).toEqual({ kind: 'none' });
    expect(item.lastAssessedAt).toBeUndefined();
  });

  it('取最新一筆評估（依 assessedAt）並計 DN/DP', () => {
    const item = summarizePatient(patient('p1', '王小明', 'P001'), [
      session('2026-06-01T09:00:00+08:00', 9, 9),
      session('2026-06-10T09:00:00+08:00', 2, 1),
    ]);
    expect(item.lastAssessedAt).toBe('2026-06-10T09:00:00+08:00');
    expect(item.summary).toEqual({ kind: 'flagged', dn: 2, dp: 1 });
  });

  it('最新評估無 DN/DP → kind allFn', () => {
    const item = summarizePatient(patient('p1', '王', 'P001'), [
      session('2026-06-10T09:00:00+08:00', 0, 0),
    ]);
    expect(item.summary).toEqual({ kind: 'allFn' });
  });
});

describe('buildPatientListItems 排序（預設 displayCode 升序）', () => {
  it('依 displayCode 排序', () => {
    const items = buildPatientListItems(
      [patient('p2', '乙', 'P002'), patient('p1', '甲', 'P001')],
      new Map(),
    );
    expect(items.map((i) => i.displayCode)).toEqual(['P001', 'P002']);
  });
});

describe('filterPatientItems', () => {
  const items: PatientListItemData[] = [
    { patientId: 'p1', displayCode: 'P001', name: '王小明', summary: { kind: 'none' } },
    { patientId: 'p2', displayCode: 'P002', name: '陳大華', summary: { kind: 'none' } },
  ];

  it('空字串回傳全部', () => {
    expect(filterPatientItems(items, '   ')).toHaveLength(2);
  });

  it('比對姓名子字串', () => {
    expect(filterPatientItems(items, '小明').map((i) => i.patientId)).toEqual(['p1']);
  });

  it('比對代碼（不分大小寫）', () => {
    expect(filterPatientItems(items, 'p002').map((i) => i.patientId)).toEqual(['p2']);
  });
});

describe('loadPatientListItems（repo 編排）', () => {
  it('讀 listPatients 與各個案評估、組清單', async () => {
    const repo = {
      listPatients: async (): Promise<Patient[]> => [
        patient('p1', '王', 'P001'),
        patient('p2', '陳', 'P002'),
      ],
      listAssessmentsByPatient: async (patientId: string) =>
        patientId === 'p1' ? [session('2026-06-10T09:00:00+08:00', 1, 0) as AssessmentSession] : [],
    };
    const items = await loadPatientListItems(repo);
    expect(items).toHaveLength(2);
    expect(items.find((i) => i.patientId === 'p1')?.summary).toEqual({
      kind: 'flagged',
      dn: 1,
      dp: 0,
    });
    expect(items.find((i) => i.patientId === 'p2')?.summary).toEqual({ kind: 'none' });
  });
});
