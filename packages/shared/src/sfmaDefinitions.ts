import { z } from 'zod';
import { breakoutFindingTypeSchema, localizedTextSchema } from './common';

// 頂層 10 大動作鍵（06 §6.4）
export const sfmaPatternKeySchema = z.enum([
  'cervicalFlexion',
  'cervicalExtension',
  'cervicalRotation',
  'upperExtremityPattern1Mre',
  'upperExtremityPattern2Lrf',
  'multiSegmentalFlexion',
  'multiSegmentalExtension',
  'multiSegmentalRotation',
  'singleLegStance',
  'overheadDeepSquat',
]);
export type SfmaPatternKey = z.infer<typeof sfmaPatternKeySchema>;

// failedCriteria 標準碼完整表（06 §6.4）
export const failedCriterionCodeSchema = z.enum([
  'cannotTouchSternumToChin',
  'notWithin10DegreesOfParallel',
  'noseNotAlignedMidClavicle',
  'notReachInferiorAngleOfScapula',
  'notReachSpineOfScapula',
  'cannotTouchToes',
  'sacralAngleUnder70',
  'nonUniformSpinalCurve',
  'lackPosteriorWeightShift',
  'ueNotMaintain170',
  'asisNotClearToes',
  'scapulaSpineNotClearHeels',
  'nonUniformExtensionCurve',
  'pelvisRotationUnder50',
  'shoulderRotationUnder50',
  'spinePelvicDeviation',
  'excessiveKneeFlexion',
  'eyesOpenUnder10s',
  'eyesClosedUnder10s',
  'lossOfHeight',
  'lossOfUeStartPosition',
  'tibiaTorsoNotParallel',
  'thighsNotBreakParallel',
  'lossOfSagittalAlignment',
  'excessiveEffortOrControl',
]);
export type FailedCriterionCode = z.infer<typeof failedCriterionCodeSchema>;

// 二階 Breakout 16 流程（05 §5.3.1）
export const sfmaFlowKeySchema = z.enum([
  'cervicalFlexionBreakout',
  'cervicalRotationBreakout',
  'cervicalExtensionBreakout',
  'upperExtremityPattern1Breakout',
  'upperExtremityPattern2Breakout',
  'multiSegmentalFlexionBreakout',
  'spineExtensionBreakout',
  'lowerBodyExtensionBreakout',
  'upperBodyExtensionBreakout',
  'multiSegmentalRotationBreakout',
  'hipExternalRotationBreakout',
  'hipInternalRotationBreakout',
  'tibialRotationBreakout',
  'vestibularCoreBreakout',
  'ankleBreakout',
  'overheadDeepSquatBreakout',
]);
export type SfmaFlowKey = z.infer<typeof sfmaFlowKeySchema>;

// —— 定義檔 schema（packages/definitions 的內容資料於模組 05 撰寫，以此驗證）——

// 題項定義（sfmaPatterns.json 單筆；06 §6.4）
export const sfmaPatternDefinitionSchema = z.object({
  patternKey: sfmaPatternKeySchema,
  name: localizedTextSchema,
  side: z.enum(['single', 'bilateral']),
  criteria: z.array(z.object({ code: failedCriterionCodeSchema, label: localizedTextSchema })),
});
export type SfmaPatternDefinition = z.infer<typeof sfmaPatternDefinitionSchema>;

// 分支條件（06 §6.4 branches[].when；可組合）。
// hasFindings.has=false 表達「無 findings」（ref §3.7.2「無紅橘藍框」）；
// 引擎預設排除 PAIN，findingTypeIn 明確列入 PAIN／OTHER 時一併檢查（05 §5.3.3）。
export const breakoutBranchConditionSchema = z.object({
  resultIn: z.array(z.string().min(1)).optional(),
  priorResult: z
    .object({ nodeKey: z.string().min(1), resultIn: z.array(z.string().min(1)) })
    .optional(),
  hasFindings: z
    .object({
      has: z.boolean(),
      inFlow: sfmaFlowKeySchema.optional(),
      findingTypeIn: z.array(breakoutFindingTypeSchema).optional(),
    })
    .optional(),
});
export type BreakoutBranchCondition = z.infer<typeof breakoutBranchConditionSchema>;

// 分支結局（06 §6.4 branches[].outcomes[]；可複合；端點不是節點）
export const breakoutOutcomeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('next'), nodeKey: z.string().min(1) }),
  z.object({
    kind: z.literal('finding'),
    findingKey: z.string().min(1),
    findingType: breakoutFindingTypeSchema,
    label: localizedTextSchema,
  }),
  z.object({ kind: z.literal('goToFlow'), flowKey: sfmaFlowKeySchema }),
  z.object({ kind: z.literal('instruction'), label: localizedTextSchema }),
]);
export type BreakoutOutcome = z.infer<typeof breakoutOutcomeSchema>;

export const breakoutNodeSchema = z.object({
  nodeKey: z.string().min(1),
  name: localizedTextSchema,
  mode: z.enum(['active', 'passive']),
  criterion: localizedTextSchema.optional(),
  // 不分側測試（如 CTSIB）：另一側已測時 UI 帶入前值供確認（05 §5.3.3 #8）。
  sideIndependent: z.boolean().optional(),
  resultOptions: z.array(z.string().min(1)),
  branches: z.array(
    z.object({ when: breakoutBranchConditionSchema, outcomes: z.array(breakoutOutcomeSchema) }),
  ),
});
export type BreakoutNode = z.infer<typeof breakoutNodeSchema>;

// Breakout 流程定義（sfmaBreakoutFlows.json 單筆；06 §6.4）
export const sfmaBreakoutFlowSchema = z.object({
  flowKey: sfmaFlowKeySchema,
  name: localizedTextSchema,
  sourceRef: z.string(),
  startNodeKey: z.string().min(1),
  nodes: z.array(breakoutNodeSchema),
});
export type SfmaBreakoutFlow = z.infer<typeof sfmaBreakoutFlowSchema>;
