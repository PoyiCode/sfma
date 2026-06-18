import type { LocalizedText } from '@ptapp/shared';

// 資料驅動多語系解析（07 §7.4；對應 ptApp resolveLocalized）：UI 介面字串走 useI18n().t；
// 資料層 LocalizedText（題項名稱、判讀標準標籤、Breakout 節點文字等）走此解析。
// LocalizedText schema 保證 zh-TW 與 en 皆有值，無需回退。目前僅 zh-TW locale 上線（'en' 待 Phase 6）。
export type DataLocale = keyof LocalizedText;

export function localizeText(text: LocalizedText, locale: DataLocale = 'zh-TW'): string {
  return text[locale];
}
