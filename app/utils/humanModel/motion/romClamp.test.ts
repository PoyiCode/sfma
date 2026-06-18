import { describe, expect, it } from 'vitest';
import { clampAngle } from './romClamp';

const ELBOW = { min: 0, max: 145 } as const;

describe('clampAngle（ROM 鉗制；04 §4.3.3 不可超出活動範圍）', () => {
  it('範圍內：原值、未觸界', () => {
    expect(clampAngle(ELBOW, 90)).toEqual({ value: 90, atLimit: false });
  });
  it('超上界：夾回 max、觸界', () => {
    expect(clampAngle(ELBOW, 200)).toEqual({ value: 145, atLimit: true });
  });
  it('超下界：夾回 min、觸界', () => {
    expect(clampAngle({ min: -70, max: 80 }, -120)).toEqual({ value: -70, atLimit: true });
  });
  it('恰在邊界：觸界', () => {
    expect(clampAngle(ELBOW, 145)).toEqual({ value: 145, atLimit: true });
    expect(clampAngle(ELBOW, 0)).toEqual({ value: 0, atLimit: true });
  });
});
