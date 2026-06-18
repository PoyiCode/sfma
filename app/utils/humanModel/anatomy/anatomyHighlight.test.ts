import { describe, expect, it } from 'vitest';
import type { BodyAnnotation } from '@ptapp/shared';
import { annotationHighlights } from './anatomyHighlight';

function anno(overrides: Partial<BodyAnnotation> = {}): BodyAnnotation {
  return {
    annotationId: 'A001',
    anatomyId: 'muscle.bicepsBrachii',
    side: 'right',
    findingType: 'painful',
    linkedPatternKey: 'cervicalRotation',
    note: '',
    ...overrides,
  };
}

describe('annotationHighlights', () => {
  it('空標註回空對照', () => {
    expect(annotationHighlights([]).size).toBe(0);
  });

  it('單筆：partKey（anatomyId@side）→ findingType', () => {
    const map = annotationHighlights([anno({ findingType: 'dysfunctional' })]);
    expect(map.get('muscle.bicepsBrachii@right')).toBe('dysfunctional');
    expect(map.size).toBe(1);
  });

  it('不同部位各自對應（partKey 含側別）', () => {
    const map = annotationHighlights([
      anno({ annotationId: 'A1', anatomyId: 'muscle.bicepsBrachii', findingType: 'note' }),
      anno({ annotationId: 'A2', anatomyId: 'nerve.radial', findingType: 'painful' }),
    ]);
    expect(map.get('muscle.bicepsBrachii@right')).toBe('note');
    expect(map.get('nerve.radial@right')).toBe('painful');
  });

  it('同 partKey 多筆取最高嚴重度（疼痛優先），與順序無關', () => {
    const lowFirst = annotationHighlights([
      anno({ annotationId: 'A1', findingType: 'note' }),
      anno({ annotationId: 'A2', findingType: 'painful' }),
      anno({ annotationId: 'A3', findingType: 'dysfunctional' }),
    ]);
    expect(lowFirst.get('muscle.bicepsBrachii@right')).toBe('painful');

    const highFirst = annotationHighlights([
      anno({ annotationId: 'A1', findingType: 'painful' }),
      anno({ annotationId: 'A2', findingType: 'note' }),
    ]);
    expect(highFirst.get('muscle.bicepsBrachii@right')).toBe('painful');
  });

  it('同部位不同側別＝兩筆獨立（取消左右群組化）：各自對應、互不影響', () => {
    const map = annotationHighlights([
      anno({ annotationId: 'A1', side: 'left', findingType: 'note' }),
      anno({ annotationId: 'A2', side: 'right', findingType: 'dysfunctional' }),
    ]);
    expect(map.size).toBe(2);
    expect(map.get('muscle.bicepsBrachii@left')).toBe('note');
    expect(map.get('muscle.bicepsBrachii@right')).toBe('dysfunctional');
  });

  it('中線部位（side null）partKey 即 anatomyId', () => {
    const map = annotationHighlights([
      anno({ anatomyId: 'bone.sacrum', side: null, findingType: 'painful' }),
    ]);
    expect(map.get('bone.sacrum')).toBe('painful');
  });
});
