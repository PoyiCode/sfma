import { describe, expect, it } from 'vitest';
import { bodyAnnotationSchema, type BodyAnnotation } from '@ptapp/shared';
import {
  findBodyAnnotation,
  newBodyAnnotation,
  removeBodyAnnotation,
  upsertBodyAnnotation,
} from './bodyAnnotationForm';

function sample(overrides: Partial<BodyAnnotation> = {}): BodyAnnotation {
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

describe('newBodyAnnotation', () => {
  it('以選取部位＋關聯動作建一筆，符合 schema', () => {
    const a = newBodyAnnotation(
      'A001',
      'muscle.bicepsBrachii',
      'right',
      'painful',
      'cervicalRotation',
    );
    expect(a).toEqual(sample());
    expect(() => bodyAnnotationSchema.parse(a)).not.toThrow();
  });

  it('note 預設空字串、可帶入備註與 null 側別', () => {
    const a = newBodyAnnotation(
      'A002',
      'bone.cervicalSpine',
      null,
      'note',
      'cervicalFlexion',
      '中線壓痛',
    );
    expect(a.note).toBe('中線壓痛');
    expect(a.side).toBeNull();
    expect(() => bodyAnnotationSchema.parse(a)).not.toThrow();
  });
});

describe('findBodyAnnotation', () => {
  const list = [sample(), sample({ annotationId: 'A002', side: 'left' })];

  it('依 anatomyId×side 取既有首筆', () => {
    expect(findBodyAnnotation(list, 'muscle.bicepsBrachii', 'left')?.annotationId).toBe('A002');
  });

  it('未建回 undefined、側別不同不誤配', () => {
    expect(findBodyAnnotation(list, 'muscle.deltoid', 'right')).toBeUndefined();
    expect(
      findBodyAnnotation([sample({ side: 'right' })], 'muscle.bicepsBrachii', 'left'),
    ).toBeUndefined();
  });
});

describe('upsertBodyAnnotation', () => {
  it('新 annotationId 附加', () => {
    const next = upsertBodyAnnotation([sample()], sample({ annotationId: 'A002' }));
    expect(next.map((a) => a.annotationId)).toEqual(['A001', 'A002']);
  });

  it('同 annotationId 取代且保位、不變動原陣列', () => {
    const original = [sample(), sample({ annotationId: 'A002', note: '舊' })];
    const next = upsertBodyAnnotation(original, sample({ annotationId: 'A002', note: '新' }));
    expect(next[1]?.note).toBe('新');
    expect(next).not.toBe(original);
    expect(original[1]?.note).toBe('舊');
  });
});

describe('removeBodyAnnotation', () => {
  it('依 annotationId 移除、缺則原樣、不變動原陣列', () => {
    const original = [sample(), sample({ annotationId: 'A002' })];
    expect(removeBodyAnnotation(original, 'A001').map((a) => a.annotationId)).toEqual(['A002']);
    expect(removeBodyAnnotation(original, 'NOPE')).toEqual(original);
    expect(original).toHaveLength(2);
  });
});
