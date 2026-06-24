// SFMA 題項／Breakout 決策樹＋解剖實體定義（07 §7.3）：JSON 為資料真相，載入時以 shared zod schema 驗證。
import {
  anatomyEntitySchema,
  sfmaBreakoutFlowSchema,
  sfmaPatternDefinitionSchema,
  type AnatomyEntity,
  type SfmaBreakoutFlow,
  type SfmaFlowKey,
  type SfmaPatternDefinition,
  type SfmaPatternKey,
} from '@ptapp/shared';
import rawAnatomy from './anatomyEntities.json';
import rawFlows from './sfmaBreakoutFlows.json';
import rawPatterns from './sfmaPatterns.json';

export const sfmaPatterns: SfmaPatternDefinition[] = sfmaPatternDefinitionSchema
  .array()
  .parse(rawPatterns);

// patternKey → 頂層動作定義查找（評估卡／Breakout 顯示動作名稱與參考圖共用）
export const sfmaPatternByKey: ReadonlyMap<SfmaPatternKey, SfmaPatternDefinition> = new Map(
  sfmaPatterns.map((pattern) => [pattern.patternKey, pattern]),
);

// Breakout 16 流程決策樹（05 §5.3、ref §3）
export const sfmaBreakoutFlows: SfmaBreakoutFlow[] = sfmaBreakoutFlowSchema.array().parse(rawFlows);

export const sfmaBreakoutFlowByKey: ReadonlyMap<SfmaFlowKey, SfmaBreakoutFlow> = new Map(
  sfmaBreakoutFlows.map((flow) => [flow.flowKey, flow]),
);

// 頂層動作 → Breakout 入口流程（05 §5.3.1 表）
export const sfmaPatternEntryFlows: Record<SfmaPatternKey, SfmaFlowKey> = {
  cervicalFlexion: 'cervicalFlexionBreakout',
  cervicalExtension: 'cervicalExtensionBreakout',
  cervicalRotation: 'cervicalRotationBreakout',
  upperExtremityPattern1Mre: 'upperExtremityPattern1Breakout',
  upperExtremityPattern2Lrf: 'upperExtremityPattern2Breakout',
  multiSegmentalFlexion: 'multiSegmentalFlexionBreakout',
  multiSegmentalExtension: 'spineExtensionBreakout',
  multiSegmentalRotation: 'multiSegmentalRotationBreakout',
  singleLegStance: 'vestibularCoreBreakout',
  overheadDeepSquat: 'overheadDeepSquatBreakout',
};

// 開發用種子解剖實體（03 §解剖資料定義；placeholder——完整清單與 joint ROM 待文獻＋PT 審閱定版，
// 屆時直接替換 anatomyEntities.json；anatomyId 命名與正式版相同故 04 程式無需改動）。
export const anatomyEntities: AnatomyEntity[] = anatomyEntitySchema.array().parse(rawAnatomy);

// anatomyId → 實體查找（04 人體模型 selectByAnatomyId／2D SVG 圖層 id 反查共用）
export const anatomyEntityById: ReadonlyMap<string, AnatomyEntity> = new Map(
  anatomyEntities.map((entity) => [entity.anatomyId, entity]),
);
