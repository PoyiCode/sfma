import { describe, expect, it } from 'vitest';
import { resolveLabelStyle } from './labelStyle';

describe('labelStyle（3D 標籤 token 驅動樣式 §3.7.6）', () => {
  it('讀 --color-text／--color-surface／--color-border 映射', () => {
    const vars: Record<string, string> = {
      '--color-text': '#111111',
      '--color-surface': '#fefefe',
      '--color-border': '#cccccc',
    };
    const style = resolveLabelStyle((name) => vars[name] ?? '');
    expect(style).toEqual({ color: '#111111', background: '#fefefe', border: '#cccccc' });
  });

  it('token 空（無 CSS／jsdom）→ 後備值', () => {
    const style = resolveLabelStyle(() => '');
    expect(style.color).toBeTruthy();
    expect(style.background).toBeTruthy();
    expect(style.border).toBeTruthy();
    // 後備需確保文字與背景可辨（非同值）
    expect(style.color).not.toBe(style.background);
  });

  it('前後空白 trim（getComputedStyle 常帶空白）', () => {
    const style = resolveLabelStyle((name) =>
      name === '--color-text' ? '  #222  ' : name === '--color-surface' ? ' #fff ' : ' #ddd ',
    );
    expect(style.color).toBe('#222');
    expect(style.background).toBe('#fff');
    expect(style.border).toBe('#ddd');
  });
});
