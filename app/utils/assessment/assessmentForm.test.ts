import { describe, expect, it } from 'vitest';
import { sfmaPatterns } from '@ptapp/definitions';
import type { PatternRecord, SfmaPatternDefinition } from '@ptapp/shared';
import {
  assessmentProgress,
  autoDeriveDysfunctional,
  buildAssessmentEntries,
  emptyRecord,
  entryClassification,
  entryId,
  findRecord,
  groupAssessmentEntries,
  isManualOverride,
  setDysfunctional,
  setPainful,
  toggleCriterion,
  upsertRecord,
} from './assessmentForm';

describe('buildAssessmentEntries', () => {
  it('將 10 大動作展開為 15 筆（雙側左右各一、單一一筆 side null）', () => {
    const entries = buildAssessmentEntries(sfmaPatterns);
    expect(entries).toHaveLength(15);
    expect(entries.filter((e) => e.side !== null)).toHaveLength(10); // 5 雙側 × 2
    expect(entries.filter((e) => e.side === null)).toHaveLength(5); // 5 單一
  });

  it('雙側動作產生 left 後 right 兩筆、共用同一定義', () => {
    const def: SfmaPatternDefinition = {
      patternKey: 'cervicalRotation',
      name: { 'zh-TW': '頸椎旋轉', en: 'Cervical Rotation' },
      side: 'bilateral',
      criteria: [],
    };
    const entries = buildAssessmentEntries([def]);
    expect(entries.map((e) => e.side)).toEqual(['left', 'right']);
    expect(entries[0]?.definition).toBe(def);
  });
});

describe('entryId', () => {
  it('單一動作為 patternKey、雙側含側別', () => {
    expect(entryId('overheadDeepSquat', null)).toBe('overheadDeepSquat');
    expect(entryId('cervicalRotation', 'left')).toBe('cervicalRotation:left');
  });
});

describe('emptyRecord', () => {
  it('產生全 false 空白紀錄', () => {
    expect(emptyRecord('cervicalFlexion', null)).toEqual({
      patternKey: 'cervicalFlexion',
      side: null,
      dysfunctional: false,
      painful: false,
      failedCriteria: [],
      notes: '',
    });
  });
});

describe('autoDeriveDysfunctional / isManualOverride', () => {
  it('勾選任一標準即自動異常', () => {
    expect(autoDeriveDysfunctional([])).toBe(false);
    expect(autoDeriveDysfunctional(['cannotTouchToes'])).toBe(true);
  });

  it('dysfunctional 與標準自動值一致＝非手動、相異＝手動', () => {
    const auto: PatternRecord = {
      patternKey: 'multiSegmentalFlexion',
      side: null,
      dysfunctional: true,
      painful: false,
      failedCriteria: ['cannotTouchToes'],
      notes: '',
    };
    expect(isManualOverride(auto)).toBe(false);
    expect(isManualOverride({ ...auto, dysfunctional: false })).toBe(true);
    expect(isManualOverride({ ...auto, failedCriteria: [] })).toBe(true); // 異常但無標準＝手動
  });
});

describe('entryClassification', () => {
  it('依 dysfunctional × painful 推導 FN/FP/DN/DP', () => {
    const base = emptyRecord('cervicalFlexion', null);
    expect(entryClassification(base)).toBe('FN');
    expect(entryClassification({ ...base, painful: true })).toBe('FP');
    expect(entryClassification({ ...base, dysfunctional: true })).toBe('DN');
    expect(entryClassification({ ...base, dysfunctional: true, painful: true })).toBe('DP');
  });
});

describe('findRecord / upsertRecord', () => {
  it('findRecord 依 patternKey＋side 取紀錄、未判讀回 undefined', () => {
    const records: PatternRecord[] = [emptyRecord('cervicalRotation', 'left')];
    expect(findRecord(records, 'cervicalRotation', 'left')).toBe(records[0]);
    expect(findRecord(records, 'cervicalRotation', 'right')).toBeUndefined();
  });

  it('upsertRecord 既有取代、不存在附加、不變動原陣列', () => {
    const base: PatternRecord[] = [emptyRecord('cervicalRotation', 'left')];
    const added = upsertRecord(base, emptyRecord('cervicalRotation', 'right'));
    expect(added).toHaveLength(2);
    expect(base).toHaveLength(1);
    const updated = upsertRecord(added, {
      ...emptyRecord('cervicalRotation', 'left'),
      painful: true,
    });
    expect(updated).toHaveLength(2);
    expect(findRecord(updated, 'cervicalRotation', 'left')?.painful).toBe(true);
  });
});

describe('assessmentProgress', () => {
  it('回傳已判讀筆數與總筆數（n/15）', () => {
    const entries = buildAssessmentEntries(sfmaPatterns);
    const patterns: PatternRecord[] = [
      emptyRecord('cervicalFlexion', null),
      emptyRecord('cervicalRotation', 'left'),
    ];
    expect(assessmentProgress(patterns, entries)).toEqual({ assessed: 2, total: 15 });
  });
});

describe('toggleCriterion', () => {
  it('勾選標準＝加入並自動帶「異常」', () => {
    const record = toggleCriterion(emptyRecord('multiSegmentalFlexion', null), 'cannotTouchToes');
    expect(record.failedCriteria).toEqual(['cannotTouchToes']);
    expect(record.dysfunctional).toBe(true);
  });

  it('取消最後一個標準＝移除並自動回「功能正常」', () => {
    const checked = toggleCriterion(emptyRecord('multiSegmentalFlexion', null), 'cannotTouchToes');
    const unchecked = toggleCriterion(checked, 'cannotTouchToes');
    expect(unchecked.failedCriteria).toEqual([]);
    expect(unchecked.dysfunctional).toBe(false);
  });

  it('變更標準會重新貼齊自動值、清除先前手動覆寫', () => {
    const manual = { ...emptyRecord('multiSegmentalFlexion', null), dysfunctional: true }; // 無標準卻異常＝手動
    expect(isManualOverride(manual)).toBe(true);
    const snapped = toggleCriterion(manual, 'cannotTouchToes');
    expect(snapped.dysfunctional).toBe(true);
    expect(isManualOverride(snapped)).toBe(false);
  });

  it('不變動原紀錄', () => {
    const base = emptyRecord('multiSegmentalFlexion', null);
    toggleCriterion(base, 'cannotTouchToes');
    expect(base.failedCriteria).toEqual([]);
  });
});

describe('groupAssessmentEntries', () => {
  it('15 題項依動作分為 10 組（雙側 2 筆、單一 1 筆），順序保留', () => {
    const groups = groupAssessmentEntries(buildAssessmentEntries(sfmaPatterns));
    expect(groups).toHaveLength(10);
    expect(groups.filter((g) => g.entries.length === 2)).toHaveLength(5); // 5 雙側
    expect(groups.filter((g) => g.entries.length === 1)).toHaveLength(5); // 5 單一
    expect(groups[0]?.patternKey).toBe(sfmaPatterns[0]?.patternKey); // 順序保留
  });

  it('每組共用其動作定義', () => {
    const groups = groupAssessmentEntries(buildAssessmentEntries(sfmaPatterns));
    for (const group of groups) {
      expect(group.definition.patternKey).toBe(group.patternKey);
      for (const entry of group.entries) {
        expect(entry.definition).toBe(group.definition);
      }
    }
  });
});

describe('setPainful / setDysfunctional', () => {
  it('setPainful 設定疼痛、不動其他欄位', () => {
    const record = setPainful(emptyRecord('cervicalFlexion', null), true);
    expect(record.painful).toBe(true);
    expect(record.dysfunctional).toBe(false);
    expect(record.failedCriteria).toEqual([]);
  });

  it('setDysfunctional 手動設定功能軸、不動 failedCriteria（成為手動覆寫）', () => {
    const record = setDysfunctional(emptyRecord('cervicalFlexion', null), true);
    expect(record.dysfunctional).toBe(true);
    expect(record.failedCriteria).toEqual([]);
    expect(isManualOverride(record)).toBe(true);
  });
});
