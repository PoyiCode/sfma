import { z } from 'zod';
import { breakoutFindingTypeSchema, idSchema, isoDateTimeSchema, sideSchema } from './common';
import {
  failedCriterionCodeSchema,
  sfmaFlowKeySchema,
  sfmaPatternKeySchema,
} from './sfmaDefinitions';

// 評估者（預設由 AppSettings.therapistProfile 帶入；06 §6.3）
export const assessorSchema = z.object({ assessorId: z.string(), name: z.string() });
export type Assessor = z.infer<typeof assessorSchema>;

// 頂層 10 大動作判讀（06 §6.3 patterns[]）；FN/FP/DN/DP 為衍生值不入庫（derive.ts）
export const patternRecordSchema = z.object({
  patternKey: sfmaPatternKeySchema,
  side: sideSchema,
  dysfunctional: z.boolean(),
  painful: z.boolean(),
  failedCriteria: z.array(failedCriterionCodeSchema),
  notes: z.string(),
});
export type PatternRecord = z.infer<typeof patternRecordSchema>;

// Breakout 步驟：result 為 FN/FP/DP/DN 或節點特殊選項碼（06 §6.4 resultOptions）
export const breakoutStepSchema = z.object({
  flowKey: sfmaFlowKeySchema,
  nodeKey: z.string().min(1),
  result: z.string().min(1),
  notes: z.string(),
});
export type BreakoutStep = z.infer<typeof breakoutStepSchema>;

export const breakoutFindingSchema = z.object({
  flowKey: sfmaFlowKeySchema,
  nodeKey: z.string().min(1),
  findingKey: z.string().min(1),
  findingType: breakoutFindingTypeSchema,
});
export type BreakoutFinding = z.infer<typeof breakoutFindingSchema>;

// 二階 Breakout 紀錄（06 §6.3 breakouts[]）；classification 選填 — 進行中（續測）尚無分類
export const breakoutRecordSchema = z.object({
  patternKey: sfmaPatternKeySchema,
  side: sideSchema,
  entryFlowKey: sfmaFlowKeySchema,
  steps: z.array(breakoutStepSchema),
  findings: z.array(breakoutFindingSchema),
  classification: breakoutFindingTypeSchema.optional(),
  notes: z.string(),
});
export type BreakoutRecord = z.infer<typeof breakoutRecordSchema>;

// 人體模型標註（06 §6.3 bodyAnnotations[]）
export const bodyAnnotationSchema = z.object({
  annotationId: idSchema,
  anatomyId: z.string().min(1),
  side: sideSchema,
  findingType: z.enum(['painful', 'dysfunctional', 'note']),
  linkedPatternKey: sfmaPatternKeySchema,
  note: z.string(),
});
export type BodyAnnotation = z.infer<typeof bodyAnnotationSchema>;

// 總覽（衍生快取；唯一寫入點為資料層推導，06 §6.3）
export const assessmentSummarySchema = z.object({
  counts: z.object({
    FN: z.number().int().min(0),
    FP: z.number().int().min(0),
    DN: z.number().int().min(0),
    DP: z.number().int().min(0),
  }),
  painfulPatterns: z.array(z.string()),
  dysfunctionalPatterns: z.array(z.string()),
});
export type AssessmentSummary = z.infer<typeof assessmentSummarySchema>;

export const assessmentSessionSchema = z.object({
  schemaVersion: z.number().int().positive(),
  sessionId: idSchema,
  patientId: idSchema,
  assessor: assessorSchema,
  assessedAt: isoDateTimeSchema,
  patterns: z.array(patternRecordSchema),
  breakouts: z.array(breakoutRecordSchema),
  bodyAnnotations: z.array(bodyAnnotationSchema),
  summary: assessmentSummarySchema,
});
export type AssessmentSession = z.infer<typeof assessmentSessionSchema>;
