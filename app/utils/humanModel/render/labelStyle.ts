// 04 §3.7.6／§3.7.1 標籤 token 驅動樣式：Babylon GUI 疊層以 getComputedStyle 讀同組
// semantic CSS 變數，使標籤色彩與 DOM 主題（深淺色）一致。純解析、框架無關、可測。
export interface LabelStyle {
  color: string; // 文字色（--color-text）
  background: string; // 底色（--color-surface）
  border: string; // 邊框色（--color-border）
}

// 後備值（無 CSS／jsdom／SSR 時）：取 tokens.css 淺色預設，確保文字與背景可辨。
const FALLBACK: LabelStyle = { color: '#0f172a', background: '#ffffff', border: '#e2e8f0' };

// 讀 CSS 變數（注入便於測試）；空值（未定義／無 DOM）退回後備。
export function resolveLabelStyle(readVar: (name: string) => string): LabelStyle {
  const pick = (name: string, fallback: string) => {
    const value = readVar(name).trim();
    return value === '' ? fallback : value;
  };
  return {
    color: pick('--color-text', FALLBACK.color),
    background: pick('--color-surface', FALLBACK.background),
    border: pick('--color-border', FALLBACK.border),
  };
}

// 預設 CSS 變數讀取：自 document 根元素計算樣式（node／SSR 無 document 時回空→後備）。
export function defaultReadCssVar(name: string): string {
  if (typeof document === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name);
}
