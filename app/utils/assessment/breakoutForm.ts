import { sfmaBreakoutFlows, sfmaPatternEntryFlows } from '@ptapp/definitions';
import type {
  BreakoutFindingType,
  BreakoutNode,
  BreakoutRecord,
  SfmaFlowKey,
  SfmaPatternKey,
  Side,
} from '@ptapp/shared';
import {
  applyStepResult,
  createFlowMap,
  deriveBreakoutClassification,
  getCurrentNode,
  rebuildState,
  rewindToStep,
  type ApplyStepOptions,
  type BreakoutEngineState,
  type BreakoutStepEvents,
  type FlowMap,
} from './breakoutFlow/engine';

// 預設流程圖：16 流程定義建一次（05 §5.3.1）；橋接函式可注入 flows 供測試以 fake 流程脫鉤驗證。
export const breakoutFlowMap: FlowMap = createFlowMap(sfmaBreakoutFlows);

export { deriveBreakoutClassification };

// 新空白 Breakout 紀錄：entryFlowKey 由頂層動作對應（05 §5.3.1）；classification 未定（進行中尚無分類）。
export function newBreakoutRecord(patternKey: SfmaPatternKey, side: Side): BreakoutRecord {
  return {
    patternKey,
    side,
    entryFlowKey: sfmaPatternEntryFlows[patternKey],
    steps: [],
    findings: [],
    notes: '',
  };
}

// 另一側（雙側用）：left↔right；single（null）無對側回 undefined。
export function oppositeSide(side: Side): Side | undefined {
  if (side === 'left') return 'right';
  if (side === 'right') return 'left';
  return undefined;
}

// 不分側測試（sideIndependent）之另一側前值（05 §5.3.3 #8）：另一側同 (flowKey,nodeKey)
// 已測之 result；非不分側／無對側紀錄／查無該步→undefined。
export function priorNonSidedResult(
  node: BreakoutNode | undefined,
  flowKey: SfmaFlowKey | undefined,
  otherSideRecord: BreakoutRecord | undefined,
): string | undefined {
  if (node?.sideIndependent !== true || flowKey === undefined || otherSideRecord === undefined) {
    return undefined;
  }
  return otherSideRecord.steps.find(
    (step) => step.flowKey === flowKey && step.nodeKey === node.nodeKey,
  )?.result;
}

// 取既有 Breakout 紀錄（未建回 undefined）；一個 pattern×side 至多一筆（entryFlowKey 由 pattern 決定）。
export function findBreakout(
  breakouts: readonly BreakoutRecord[],
  patternKey: SfmaPatternKey,
  side: Side,
): BreakoutRecord | undefined {
  return breakouts.find((b) => b.patternKey === patternKey && b.side === side);
}

// 寫入紀錄：同 pattern×side 既有則取代、否則附加（不變動原陣列）。
export function upsertBreakout(
  breakouts: readonly BreakoutRecord[],
  record: BreakoutRecord,
): BreakoutRecord[] {
  const index = breakouts.findIndex(
    (b) => b.patternKey === record.patternKey && b.side === record.side,
  );
  if (index === -1) return [...breakouts, record];
  const next = [...breakouts];
  next[index] = record;
  return next;
}

// 手動覆寫分類（05 §5.3.4；不變動原紀錄）。
export function setBreakoutClassification(
  record: BreakoutRecord,
  classification: BreakoutFindingType,
): BreakoutRecord {
  return { ...record, classification };
}

// 由持久化紀錄重建引擎執行態（游標／佇列）；findings 作為歧義消解預言機（engine rebuildState，05 §5.3.3 #6）。
export function stateFromRecord(
  record: BreakoutRecord,
  flows: FlowMap = breakoutFlowMap,
): BreakoutEngineState {
  return rebuildState(flows, record.entryFlowKey, record.steps, record.findings);
}

// 目前待測節點（流程走完回 undefined）。
export function currentBreakoutNode(
  record: BreakoutRecord,
  flows: FlowMap = breakoutFlowMap,
): BreakoutNode | undefined {
  return getCurrentNode(flows, stateFromRecord(record, flows));
}

// Breakout 是否走完（無待測節點且佇列清空）。
export function isBreakoutComplete(
  record: BreakoutRecord,
  flows: FlowMap = breakoutFlowMap,
): boolean {
  return stateFromRecord(record, flows).currentNodeKey === undefined;
}

export type ApplyBreakoutOutcome =
  | { kind: 'applied'; record: BreakoutRecord; events: BreakoutStepEvents }
  | { kind: 'needsManualChoice'; candidateIndices: number[] }
  | { kind: 'noMatch' };

// 套用一步結果：重建態 → applyStepResult → 新 steps/findings 摺回紀錄；需人工擇一／無相符時原樣回報（05 §5.3.3）。
export function applyBreakoutResult(
  record: BreakoutRecord,
  result: string,
  options: ApplyStepOptions = {},
  flows: FlowMap = breakoutFlowMap,
): ApplyBreakoutOutcome {
  const outcome = applyStepResult(flows, stateFromRecord(record, flows), result, options);
  if (outcome.kind !== 'applied') return outcome;
  return {
    kind: 'applied',
    record: { ...record, steps: outcome.state.steps, findings: outcome.state.findings },
    events: outcome.events,
  };
}

// 取指定流程節點（供自由模式渲染步進卡）；查無回 undefined。
export function breakoutNodeAt(
  flowKey: SfmaFlowKey,
  nodeKey: string,
  flows: FlowMap = breakoutFlowMap,
): BreakoutNode | undefined {
  return flows.get(flowKey)?.nodes.find((node) => node.nodeKey === nodeKey);
}

// 自由模式跳測（05 §5.3.3 #9）：將游標硬移至指定（flowKey,nodeKey）後套一步，摺回紀錄。
// 不經引導路徑、可挑任一流程節點（補測／跳測）；引擎於 rebuildState 以 desync 容忍重放，
// 產出之 steps/findings 在重載穩定。節點不存在拋錯（挑選器僅提供有效節點）。
// 回傳同 applyBreakoutResult 之 union（applied／needsManualChoice／noMatch）。
export function applyBreakoutResultAt(
  record: BreakoutRecord,
  flowKey: SfmaFlowKey,
  nodeKey: string,
  result: string,
  options: ApplyStepOptions = {},
  flows: FlowMap = breakoutFlowMap,
): ApplyBreakoutOutcome {
  if (breakoutNodeAt(flowKey, nodeKey, flows) === undefined) {
    throw new Error(`unknown node: ${flowKey}/${nodeKey}`);
  }
  const base = stateFromRecord(record, flows);
  const state: BreakoutEngineState = {
    ...base,
    currentFlowKey: flowKey,
    currentNodeKey: nodeKey,
  };
  const outcome = applyStepResult(flows, state, result, options);
  if (outcome.kind !== 'applied') return outcome;
  return {
    kind: 'applied',
    record: { ...record, steps: outcome.state.steps, findings: outcome.state.findings },
    events: outcome.events,
  };
}

export interface RewindBreakoutResult {
  record: BreakoutRecord;
  invalidatedSteps: number;
  invalidatedFindings: number;
}

// 回溯：保留前 stepIndex 步、其後 steps 與衍生 findings 作廢並重建佇列／游標；量化供 UI 紅色作廢 AlertDialog（03 §3.3.9）。
export function rewindBreakout(
  record: BreakoutRecord,
  stepIndex: number,
  flows: FlowMap = breakoutFlowMap,
): RewindBreakoutResult {
  const result = rewindToStep(flows, stateFromRecord(record, flows), stepIndex);
  return {
    record: { ...record, steps: result.state.steps, findings: result.state.findings },
    invalidatedSteps: result.invalidatedSteps,
    invalidatedFindings: result.invalidatedFindings,
  };
}
