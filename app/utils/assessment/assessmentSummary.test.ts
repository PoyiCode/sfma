import { describe, expect, it } from 'vitest';
import type { BreakoutRecord, SfmaPatternDefinition } from '@ptapp/shared';
import { buildAssessmentEntries } from './assessmentForm';
import { breakoutFindingsOverview, summaryPatternViews } from './assessmentSummary';

const DEFS: SfmaPatternDefinition[] = [
  {
    patternKey: 'cervicalFlexion',
    side: 'single',
    name: { 'zh-TW': '頸椎屈曲', en: 'Cervical Flexion' },
    criteria: [],
  } as unknown as SfmaPatternDefinition,
  {
    patternKey: 'multiSegmentalRotation',
    side: 'bilateral',
    name: { 'zh-TW': '多節段旋轉', en: 'Multi-segmental Rotation' },
    criteria: [],
  } as unknown as SfmaPatternDefinition,
];
const ENTRIES = buildAssessmentEntries(DEFS); // cervicalFlexion(null), msr:left, msr:right

describe('summaryPatternViews', () => {
  it('依 entries 順序解析 key（含側別）、查無對應略過', () => {
    const views = summaryPatternViews(
      ['multiSegmentalRotation:right', 'cervicalFlexion', 'ghost:left'],
      ENTRIES,
    );
    expect(views.map((v) => v.key)).toEqual(['cervicalFlexion', 'multiSegmentalRotation:right']);
    expect(views[0]?.side).toBeNull();
    expect(views[1]?.side).toBe('right');
    expect(views[0]?.name).toEqual({ 'zh-TW': '頸椎屈曲', en: 'Cervical Flexion' });
  });

  it('空清單回空陣列', () => {
    expect(summaryPatternViews([], ENTRIES)).toEqual([]);
  });
});

describe('breakoutFindingsOverview', () => {
  const breakouts: BreakoutRecord[] = [
    {
      patternKey: 'multiSegmentalRotation',
      side: 'left',
      entryFlowKey: 'rotationBreakout',
      steps: [],
      findings: [
        { flowKey: 'rotationBreakout', nodeKey: 'n1', findingKey: 'f-smcd', findingType: 'SMCD' },
        { flowKey: 'rotationBreakout', nodeKey: 'n2', findingKey: 'f-pain', findingType: 'PAIN' },
      ],
    } as unknown as BreakoutRecord,
    {
      patternKey: 'cervicalFlexion',
      side: null,
      entryFlowKey: 'cervicalBreakout',
      steps: [],
      findings: [],
    } as unknown as BreakoutRecord,
  ];

  it('僅列有 findings 之 breakout、依 entries 順序、PAIN 置頂', () => {
    const rows = breakoutFindingsOverview(breakouts, ENTRIES);
    expect(rows).toHaveLength(1); // cervicalFlexion 無 findings 略過
    expect(rows[0]?.key).toBe('multiSegmentalRotation:left');
    expect(rows[0]?.side).toBe('left');
    expect(rows[0]?.findings.map((f) => f.findingType)).toEqual(['PAIN', 'SMCD']); // painFirst
  });

  it('無 breakouts 回空陣列', () => {
    expect(breakoutFindingsOverview([], ENTRIES)).toEqual([]);
  });
});
