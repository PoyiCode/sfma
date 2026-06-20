import { describe, expect, it } from 'vitest';
import { correctiveWeight } from './morphTargetController';

describe('correctiveWeight', () => {
  it('onset 以下回 0（含絕對值）', () => {
    expect(correctiveWeight(0, 84, 140)).toBe(0);
    expect(correctiveWeight(84, 84, 140)).toBe(0);
    expect(correctiveWeight(-84, 84, 140)).toBe(0);
  });
  it('ref 以上回 1', () => {
    expect(correctiveWeight(140, 84, 140)).toBe(1);
    expect(correctiveWeight(1000, 84, 140)).toBe(1);
  });
  it('區間 smoothstep（中點 0.5、單調遞增）', () => {
    expect(correctiveWeight((84 + 140) / 2, 84, 140)).toBeCloseTo(0.5, 5);
    expect(correctiveWeight(100, 84, 140)).toBeLessThan(correctiveWeight(120, 84, 140));
  });
  it('ref<=onset 防呆回 0', () => {
    expect(correctiveWeight(200, 140, 140)).toBe(0);
  });
});
