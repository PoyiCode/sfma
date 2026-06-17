import { z } from 'zod';
import { idSchema, isoDateSchema, isoDateTimeSchema } from './common';

// 個案（06 §6.2）。displayCode／createdAt／updatedAt 於 schema 選填（表列必填僅 name 與
// consentAcknowledgedAt），但 localStore.createPatient 一律寫入。
export const patientSchema = z.object({
  schemaVersion: z.number().int().positive(),
  patientId: idSchema,
  displayCode: z.string().optional(),
  name: z.string().min(1),
  gender: z.enum(['male', 'female', 'other']).optional(),
  birthDate: isoDateSchema.optional(),
  contact: z.object({ phone: z.string(), email: z.string() }).optional(),
  notes: z.string().optional(),
  createdAt: isoDateTimeSchema.optional(),
  updatedAt: isoDateTimeSchema.optional(),
  // 未取得當事人同意不建立個案（06 §6.2、08 §8.5）
  consentAcknowledgedAt: isoDateTimeSchema,
});
export type Patient = z.infer<typeof patientSchema>;
