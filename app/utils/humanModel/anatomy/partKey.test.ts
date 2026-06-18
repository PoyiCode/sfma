import { describe, expect, it } from 'vitest';
import { partKey, parsePartKey } from './partKey';

describe('partKey（側別限定選取鍵）', () => {
  it('中線（side null）→ key 即 anatomyId', () => {
    expect(partKey('bone.sacrum', null)).toBe('bone.sacrum');
  });

  it('成對 → anatomyId@side', () => {
    expect(partKey('bone.humerus', 'left')).toBe('bone.humerus@left');
    expect(partKey('bone.humerus', 'right')).toBe('bone.humerus@right');
  });

  it('parsePartKey 往返成對', () => {
    expect(parsePartKey('bone.humerus@left')).toEqual({ anatomyId: 'bone.humerus', side: 'left' });
    expect(parsePartKey('bone.humerus@right')).toEqual({
      anatomyId: 'bone.humerus',
      side: 'right',
    });
  });

  it('parsePartKey 中線（無 @）→ side null', () => {
    expect(parsePartKey('bone.sacrum')).toEqual({ anatomyId: 'bone.sacrum', side: null });
  });

  it('parsePartKey 非預期 @ 尾碼 → 整串視為 anatomyId（防禦）', () => {
    expect(parsePartKey('weird@middle')).toEqual({ anatomyId: 'weird@middle', side: null });
  });
});
