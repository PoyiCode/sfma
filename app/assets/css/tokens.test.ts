import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const css = readFileSync(fileURLToPath(new URL('./tokens.css', import.meta.url)), 'utf8');

describe('tokens.css 設計系統契約（03 §3.7）', () => {
  it('semantic 顏色 token 齊備', () => {
    for (const token of [
      '--color-bg',
      '--color-surface',
      '--color-text',
      '--color-text-muted',
      '--color-border',
      '--color-accent',
      '--color-accent-hover',
      '--color-focus',
      '--color-danger',
      '--color-warning',
      '--color-success',
    ]) {
      expect(css).toContain(token);
    }
  });

  it('臨床保留色 token 齊備（DOM／Babylon 共用唯一真相）', () => {
    for (const token of [
      '--clinical-contraction',
      '--clinical-stretch',
      '--clinical-nerve',
      '--clinical-finding',
    ]) {
      expect(css).toContain(token);
    }
  });

  it('字體、間距、圓角、動效比例階存在', () => {
    for (const token of [
      '--font-sans',
      '--font-mono',
      '--space-1',
      '--space-12',
      '--radius-md',
      '--radius-full',
      '--motion-base',
    ]) {
      expect(css).toContain(token);
    }
  });

  it('主題機制：system 跟隨＋顯式覆寫', () => {
    expect(css).toContain('prefers-color-scheme: dark');
    expect(css).toContain('data-theme');
  });

  it('密度與系統級無障礙基底', () => {
    expect(css).toContain('data-density');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('forced-colors');
    expect(css).toContain(':focus-visible');
  });
});
