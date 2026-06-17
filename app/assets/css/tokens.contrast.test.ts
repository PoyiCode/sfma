import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast';

// 設計系統 token 對比驗收（§3.7.5「WCAG AA 對比」）：直接讀 tokens.css、解析 var() 鏈，
// 斷言所有意義文字／按鈕填色對在「亮」「暗」雙主題皆達 WCAG 2.1 AA 正常文字 4.5:1。
// 此測為活的回歸閘門——日後改動 token 值若跌破 AA 會立即失敗。

// 先去除 CSS 註解，避免註解黏附到後續宣告而誤吞 token。
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

function extractBlock(selector: RegExp): string {
  const match = css.match(selector);
  if (!match?.[1]) throw new Error(`找不到區塊：${selector}`);
  return match[1];
}

function parseDecls(block: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const decl of block.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const name = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (name.startsWith('--')) map[name] = value;
  }
  return map;
}

// base＝ :root（亮，含 primitive）；dark＝ :root[data-theme='dark'] 覆寫（applyThemePreference 所設）。
const base = parseDecls(extractBlock(/:root\s*\{([^}]*)\}/));
const darkOverrides = parseDecls(extractBlock(/:root\[data-theme='dark'\]\s*\{([^}]*)\}/));
const lightMap = base;
const darkMap = { ...base, ...darkOverrides };

function resolve(map: Record<string, string>, token: string, seen = new Set<string>()): string {
  const value = map[token];
  if (value === undefined) throw new Error(`未定義 token：${token}`);
  const varMatch = value.match(/^var\((--[a-z0-9-]+)\)$/i);
  if (varMatch?.[1]) {
    if (seen.has(token)) throw new Error(`var() 循環：${token}`);
    seen.add(token);
    return resolve(map, varMatch[1], seen);
  }
  return value;
}

const THEMES: ReadonlyArray<[string, Record<string, string>]> = [
  ['light', lightMap],
  ['dark', darkMap],
];

// 前景文字／狀態標記對（皆 ≥4.5 正常文字 AA）。
const TEXT_PAIRS: ReadonlyArray<[string, string]> = [
  ['--color-text', '--color-bg'],
  ['--color-text', '--color-surface'],
  ['--color-text-muted', '--color-bg'],
  ['--color-text-muted', '--color-surface'],
  ['--color-accent-fg', '--color-bg'],
  ['--color-accent-fg', '--color-surface'],
  ['--color-danger-fg', '--color-bg'],
  ['--color-danger-fg', '--color-surface'],
];

// 按鈕填色：白字置於填色之上（填色 token 不變、兩主題同值）。
const FILL_PAIRS: ReadonlyArray<[string, string]> = [
  ['#ffffff', '--color-accent'],
  ['#ffffff', '--color-danger'],
];

const AA_NORMAL = 4.5;

describe('tokens.css WCAG AA 對比', () => {
  for (const [themeName, map] of THEMES) {
    for (const [fg, bg] of TEXT_PAIRS) {
      it(`[${themeName}] ${fg} / ${bg} ≥ ${AA_NORMAL}:1`, () => {
        const ratio = contrastRatio(resolve(map, fg), resolve(map, bg));
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
    for (const [fg, bg] of FILL_PAIRS) {
      it(`[${themeName}] ${fg} 白字 / ${bg} 填色 ≥ ${AA_NORMAL}:1`, () => {
        const ratio = contrastRatio(fg, resolve(map, bg));
        expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL);
      });
    }
  }
});
