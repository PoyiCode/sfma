import { describe, expect, it } from 'vitest';
import { resolveDevServerHost } from './devServerHost';

describe('resolveDevServerHost', () => {
  it("'true' → 0.0.0.0（開發者模式：區網可及）", () => {
    expect(resolveDevServerHost('true')).toBe('0.0.0.0');
  });
  it("'false' → localhost（僅本機）", () => {
    expect(resolveDevServerHost('false')).toBe('localhost');
  });
  it('undefined → localhost（預設關閉）', () => {
    expect(resolveDevServerHost(undefined)).toBe('localhost');
  });
});
