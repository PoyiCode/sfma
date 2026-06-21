import { describe, expect, it } from 'vitest';
import { modelPageLayout, viewerLayoutMode } from './viewerLayoutMode';

describe('viewerLayoutMode（手機橫式模型優先；03 §3.1）', () => {
  it('Compact＋landscape→modelPriority', () => {
    expect(viewerLayoutMode('compact', 'landscape')).toBe('modelPriority');
  });

  it('Compact＋portrait→standard', () => {
    expect(viewerLayoutMode('compact', 'portrait')).toBe('standard');
  });

  it('Expanded 任一方向→sidePanel（控制項側欄）', () => {
    expect(viewerLayoutMode('expanded', 'landscape')).toBe('sidePanel');
    expect(viewerLayoutMode('expanded', 'portrait')).toBe('sidePanel');
  });

  it('Medium 任一方向→standard', () => {
    expect(viewerLayoutMode('medium', 'landscape')).toBe('standard');
    expect(viewerLayoutMode('medium', 'portrait')).toBe('standard');
  });
});

describe('modelPageLayout（模型畫面欄佈局；03 §3.1／§3.2）', () => {
  it('手機（compact）任一方向→stack（單欄）', () => {
    expect(modelPageLayout('compact', 'portrait')).toBe('stack');
    expect(modelPageLayout('compact', 'landscape')).toBe('stack');
  });

  it('平板（medium）直式→stack（單欄）、橫式→split（並排）', () => {
    expect(modelPageLayout('medium', 'portrait')).toBe('stack');
    expect(modelPageLayout('medium', 'landscape')).toBe('split');
  });

  it('Expanded 任一方向→split（模型與評估並排）', () => {
    expect(modelPageLayout('expanded', 'portrait')).toBe('split');
    expect(modelPageLayout('expanded', 'landscape')).toBe('split');
  });
});
