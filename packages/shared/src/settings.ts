import { z } from 'zod';
import { isoDateTimeSchema } from './common';
import { assessorSchema } from './assessment';

// 設定單例（固定 settingsId: "app"；06 §6.10）
export const appSettingsSchema = z.object({
  schemaVersion: z.number().int().positive(),
  settingsId: z.literal('app'),
  therapistProfile: assessorSchema,
  locale: z.enum(['zh-TW', 'en']),
  // LOD 模型細節（§4.3.5）：auto/簡化＋「完整」（full＝無損載入、無視預算、手動 opt-in）。
  // 精細（detailed）階層已移除（2026-06-17 政策改變）；舊設定 'detailed' 經 preprocess 正規化為
  // 'simplified'（同資產、行為不變；免升 schemaVersion，延續加寬相容慣例）。
  lodMode: z.preprocess(
    (value) => (value === 'detailed' ? 'simplified' : value),
    z.enum(['auto', 'simplified', 'full']),
  ),
  orientationPreference: z.enum(['auto', 'portrait', 'landscape']),
  defaultLayers: z.object({
    bone: z.boolean(),
    deepMuscle: z.boolean(),
    superficialMuscle: z.boolean(),
    nerve: z.boolean(),
    // 被動結構分層（韌帶＋椎間盤；04 §4.1）：選填、向後相容既有設定（不升 schemaVersion）。
    // 缺鍵之舊設定於檢視器初值補 DEFAULT_LAYER_VISIBILITY.passiveStructure（預設隱藏）。
    passiveStructure: z.boolean().optional(),
  }),
  theme: z.enum(['system', 'light', 'dark']),
  // 首啟資料保全通知是否已確認（03 §3.3.6、§3.6）；選填，向後相容既有設定。
  dataSafetyNoticeAcknowledged: z.boolean().optional(),
  // 首啟安裝引導是否已關閉（03 §3.3.6）；選填，向後相容既有設定。
  installGuideDismissed: z.boolean().optional(),
  updatedAt: isoDateTimeSchema,
});
export type AppSettings = z.infer<typeof appSettingsSchema>;
