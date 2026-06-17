import { describe, expect, it } from 'vitest';
import { redactPii } from './redactPii';

describe('redactPii', () => {
  it('遮蔽 email', () => {
    expect(redactPii('寄到 a.b+1@mail.example.com 了')).toBe('寄到 [已遮蔽:電子郵件] 了');
  });
  it('遮蔽身分證', () => {
    expect(redactPii('A123456789')).toBe('[已遮蔽:身分證]');
  });
  it('遮蔽手機', () => {
    expect(redactPii('0912345678')).toBe('[已遮蔽:電話]');
  });
  it('UUID 不被誤遮蔽', () => {
    const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    expect(redactPii(uuid)).toBe(uuid);
  });
});
