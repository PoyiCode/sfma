import { z } from 'zod';
import { isoDateTimeSchema } from './common';
import { patientSchema } from './patient';
import { assessmentSessionSchema } from './assessment';
import { appSettingsSchema } from './settings';

// 匯出檔信封版本（06 §6.7）；與紀錄之 schemaVersion 分軌
export const EXPORT_VERSION = 1;

export const exportScopeSchema = z.enum(['patient', 'all']);
export type ExportScope = z.infer<typeof exportScopeSchema>;

// 匯出封裝（06 §6.7）：settings 僅 scope 為 all 時附上（選填）
export const exportEnvelopeSchema = z.object({
  exportVersion: z.number().int().positive(),
  schemaVersion: z.number().int().positive(),
  exportedAt: isoDateTimeSchema,
  scope: exportScopeSchema,
  patients: z.array(patientSchema),
  assessments: z.array(assessmentSessionSchema),
  settings: appSettingsSchema.optional(),
});
export type ExportEnvelope = z.infer<typeof exportEnvelopeSchema>;
