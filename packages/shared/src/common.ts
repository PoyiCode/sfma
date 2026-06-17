import { z } from 'zod';

// 各資料結構之現行 schema 版本（06 §6.1、§6.8）
export const CURRENT_SCHEMA_VERSION = 1;

// 多語系文字（06 §6.1）：預設 zh-TW、缺漏回退 en（07 §7.4）
export const localizedTextSchema = z.object({
  'zh-TW': z.string(),
  en: z.string(),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

// 側別：left／right／null（單一動作；06 §6.1）
export const sideSchema = z.enum(['left', 'right']).nullable();
export type Side = z.infer<typeof sideSchema>;

// SFMA 頂層分類（衍生值，不入庫；06 §6.1、§6.3）
export const patternClassificationSchema = z.enum(['FN', 'FP', 'DN', 'DP']);
export type PatternClassification = z.infer<typeof patternClassificationSchema>;

// Breakout finding 類型（06 §6.3；05 §5.3）
export const breakoutFindingTypeSchema = z.enum(['SMCD', 'JMD', 'TED', 'PAIN', 'OTHER']);
export type BreakoutFindingType = z.infer<typeof breakoutFindingTypeSchema>;

// ISO 8601 含時區（06 §6.1），如 2026-06-12T09:30:00+08:00
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
// ISO 日期（如出生日期 1980-05-01）
export const isoDateSchema = z.iso.date();

// 識別碼：非空字串。產生端一律 UUID（06 §6.6），schema 不強制 UUID 格式 —
// 設計範例與測試資料採短代碼（06 §6.6「本文件範例除 6.2 外，為可讀性仍採短代碼」）。
export const idSchema = z.string().min(1);
