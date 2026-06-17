import { describe, expect, it } from 'vitest';
import { toIsoDate, toIsoDateTime } from './time';

describe('toIsoDateTime', () => {
  it('輸出 ISO 8601 含本地時區位移（06 §6.1）', () => {
    const date = new Date(2026, 5, 13, 9, 30, 0);
    const text = toIsoDateTime(date);
    expect(text).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(new Date(text).getTime()).toBe(date.getTime());
  });

  it('以本地時間欄位輸出（不轉 UTC）', () => {
    const date = new Date(2026, 0, 2, 3, 4, 5);
    expect(toIsoDateTime(date).startsWith('2026-01-02T03:04:05')).toBe(true);
  });
});

describe('toIsoDate', () => {
  it('輸出 YYYY-MM-DD', () => {
    expect(toIsoDate(new Date(2026, 5, 13))).toBe('2026-06-13');
  });
});
