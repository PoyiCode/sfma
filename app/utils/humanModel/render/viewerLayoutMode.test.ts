import { describe, expect, it } from 'vitest';
import { viewerLayoutMode } from './viewerLayoutMode';

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
