// WCAG 2.1 對比工具（§1.4.3 對比、§3.7.5 無障礙驗收）：sRGB hex → 相對亮度 → 對比比值。
// 純函式、無 DOM 相依；供設計系統 token 對比驗收測試與日後前景色選擇共用。

function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

// sRGB 通道（0–255）→ 線性化分量（WCAG 公式）。
function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// 相對亮度 L（0＝黑、1＝白），WCAG §1.4.3。
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

// 對比比值（1–21），與前後景順序無關。
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
