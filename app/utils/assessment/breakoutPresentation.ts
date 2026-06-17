import { sfmaBreakoutFlowByKey, sfmaBreakoutFlows } from '@ptapp/definitions';
import type {
  BreakoutFinding,
  BreakoutFindingType,
  BreakoutNode,
  BreakoutRecord,
  LocalizedText,
  SfmaFlowKey,
} from '@ptapp/shared';
import type { BreakoutStepEvents, FlowMap } from './breakoutFlow/engine';
import {
  breakoutFlowMap,
  deriveBreakoutClassification,
  isBreakoutComplete,
  stateFromRecord,
} from './breakoutForm';

// 端點結果卡模型（一卡＝一端點 outcome）。label／flowName／nextName 為已備妥多語系文字，
// 由 06-F2d 疊層解析 flowKey／nodeKey→名後傳入；本卡不碰流程資料、不呼叫引擎。
// 註：原 ptApp 此型別宣告於 BreakoutResultCard.tsx（元件）；移植時將純型別下放至此呈現層模組，
// Phase 4C 之 BreakoutResultCard 元件改自此重新匯入，避免純邏輯層依賴元件。
export type BreakoutResultCardModel =
  | { kind: 'finding'; findingType: BreakoutFindingType; label: LocalizedText }
  | { kind: 'goToFlow'; flowName: LocalizedText }
  | { kind: 'instruction'; label: LocalizedText }
  | { kind: 'next'; nextName: LocalizedText };

// findingKey → 顯示文字：label 僅存於流程 outcome（findings 紀錄只存 key/type），故載入時反查建表一次。
function buildFindingLabelMap(): Map<string, LocalizedText> {
  const map = new Map<string, LocalizedText>();
  for (const flow of sfmaBreakoutFlows) {
    for (const node of flow.nodes) {
      for (const branch of node.branches) {
        for (const outcome of branch.outcomes) {
          if (outcome.kind === 'finding') map.set(outcome.findingKey, outcome.label);
        }
      }
    }
  }
  return map;
}
const findingLabelByKey: ReadonlyMap<string, LocalizedText> = buildFindingLabelMap();

// 查無對照時退回原碼（findings 來自流程 outcome、正常必有 label；此為型別安全後備）。
function fallbackLabel(key: string): LocalizedText {
  return { 'zh-TW': key, en: key };
}

// PAIN 優先穩定排序（findings 面板與多筆結果卡共用；03 §3.3.9 PAIN 置頂）。
function painFirst<T extends { findingType: BreakoutFindingType }>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) => Number(b.findingType === 'PAIN') - Number(a.findingType === 'PAIN'),
  );
}

export function breakoutFindingLabel(findingKey: string): LocalizedText | undefined {
  return findingLabelByKey.get(findingKey);
}

export function breakoutFlowName(flowKey: SfmaFlowKey): LocalizedText | undefined {
  return sfmaBreakoutFlowByKey.get(flowKey)?.name;
}

export function breakoutNodeName(flowKey: SfmaFlowKey, nodeKey: string): LocalizedText | undefined {
  return sfmaBreakoutFlowByKey.get(flowKey)?.nodes.find((node) => node.nodeKey === nodeKey)?.name;
}

// 自注入流程圖取節點名（步驟清單衍生用，與當前節點推導同一份 flows，供測試以 fake 流程脫鉤）。
function nodeNameFromFlows(
  flows: FlowMap,
  flowKey: SfmaFlowKey,
  nodeKey: string,
): LocalizedText | undefined {
  return flows.get(flowKey)?.nodes.find((node) => node.nodeKey === nodeKey)?.name;
}

// 一步事件 → 端點結果卡模型（06-F2c）：findings（PAIN 優先）→ goToFlow → instruction。
// `next` 為自動前進、不出卡（03 §3.3.9 line 158）。
export function resultCardsFromEvents(events: BreakoutStepEvents): BreakoutResultCardModel[] {
  const cards: BreakoutResultCardModel[] = [];
  for (const finding of painFirst(events.newFindings)) {
    cards.push({
      kind: 'finding',
      findingType: finding.findingType,
      label: breakoutFindingLabel(finding.findingKey) ?? fallbackLabel(finding.findingKey),
    });
  }
  for (const flowKey of events.enqueuedFlowKeys) {
    cards.push({ kind: 'goToFlow', flowName: breakoutFlowName(flowKey) ?? fallbackLabel(flowKey) });
  }
  for (const label of events.instructions) {
    cards.push({ kind: 'instruction', label });
  }
  return cards;
}

export interface BreakoutFindingView {
  findingType: BreakoutFindingType;
  label: LocalizedText;
  source: LocalizedText | undefined;
}

// findings 面板項（03 §3.3.9 line 161）：每筆 findingType／顯示文字／來源測試名；PAIN 置頂。
export function breakoutFindingViews(findings: readonly BreakoutFinding[]): BreakoutFindingView[] {
  const views: BreakoutFindingView[] = findings.map((finding) => ({
    findingType: finding.findingType,
    label: breakoutFindingLabel(finding.findingKey) ?? fallbackLabel(finding.findingKey),
    source: breakoutNodeName(finding.flowKey, finding.nodeKey),
  }));
  return painFirst(views);
}

export type BreakoutEntryStatus = 'none' | 'inProgress' | 'complete';

export interface BreakoutEntrySummary {
  status: BreakoutEntryStatus;
  // 完成時的判讀分類（record.classification 覆寫優先，否則 deriveBreakoutClassification 預設推導）。
  classification: BreakoutFindingType | undefined;
  // findingType 概況：去重、PAIN 置頂。
  findingTypes: BreakoutFindingType[];
}

// findingType 概況（03 §3.3.9 line 146）：去重保留首見序、PAIN 置頂（與 findings 面板一致）。
export function breakoutFindingTypeSummary(
  findings: readonly BreakoutFinding[],
): BreakoutFindingType[] {
  const seen = new Set<BreakoutFindingType>();
  const distinct: BreakoutFindingType[] = [];
  for (const finding of findings) {
    if (!seen.has(finding.findingType)) {
      seen.add(finding.findingType);
      distinct.push(finding.findingType);
    }
  }
  return distinct.sort((a, b) => Number(b === 'PAIN') - Number(a === 'PAIN'));
}

// 每側卡 Breakout 入口顯示衍生（03 §3.3.9）：未建／走查中／已完成；完成時帶 classification 與概況。
export function breakoutEntrySummary(
  breakout: BreakoutRecord | undefined,
  flows: FlowMap = breakoutFlowMap,
): BreakoutEntrySummary {
  if (breakout === undefined) {
    return { status: 'none', classification: undefined, findingTypes: [] };
  }
  if (!isBreakoutComplete(breakout, flows)) {
    return {
      status: breakout.steps.length > 0 ? 'inProgress' : 'none',
      classification: undefined,
      findingTypes: [],
    };
  }
  return {
    status: 'complete',
    classification: breakout.classification ?? deriveBreakoutClassification(breakout.findings),
    findingTypes: breakoutFindingTypeSummary(breakout.findings),
  };
}

export interface BreakoutFlowOption {
  flowKey: SfmaFlowKey;
  name: LocalizedText;
}

// 自由模式流程挑選資料（05 §5.3.3 #9）：列出所有流程（flowKey＋名），UI 映 Select 選項。
export function breakoutFlowOptions(flows: FlowMap = breakoutFlowMap): BreakoutFlowOption[] {
  return [...flows.values()].map((flow) => ({ flowKey: flow.flowKey, name: flow.name }));
}

export interface BreakoutNodeOption {
  nodeKey: string;
  name: LocalizedText;
}

// 自由模式節點挑選資料：列出指定流程之節點（nodeKey＋名）；查無流程回空陣列。
export function breakoutNodeOptions(
  flowKey: SfmaFlowKey,
  flows: FlowMap = breakoutFlowMap,
): BreakoutNodeOption[] {
  const flow = flows.get(flowKey);
  if (flow === undefined) return [];
  return flow.nodes.map((node) => ({ nodeKey: node.nodeKey, name: node.name }));
}

// 人工擇一候選（05 §5.3.3 #7；priorResult 缺值→分支 undecidable）：候選分支索引映為可選描述。
export interface BreakoutCandidateView {
  branchIndex: number;
  // 此分支結局之 findingType（finding outcomes，依序）。
  findingTypes: BreakoutFindingType[];
  // 結局顯示文字：finding／instruction 標籤＋goToFlow 流程名。
  outcomeLabels: LocalizedText[];
  // 擇一依據（disambiguator）：priorResult 之先前測試名＋可接受結果碼；無 priorResult 則 undefined。
  prior: { testName: LocalizedText; resultCodes: string[] } | undefined;
}

export function breakoutCandidateViews(
  node: BreakoutNode,
  candidateIndices: number[],
  flowKey: SfmaFlowKey,
  flows: FlowMap = breakoutFlowMap,
): BreakoutCandidateView[] {
  const flow = flows.get(flowKey);
  return candidateIndices.map((branchIndex) => {
    const branch = node.branches[branchIndex];
    const findingTypes: BreakoutFindingType[] = [];
    const outcomeLabels: LocalizedText[] = [];
    for (const outcome of branch?.outcomes ?? []) {
      if (outcome.kind === 'finding') {
        findingTypes.push(outcome.findingType);
        outcomeLabels.push(outcome.label);
      } else if (outcome.kind === 'instruction') {
        outcomeLabels.push(outcome.label);
      } else if (outcome.kind === 'goToFlow') {
        const name = flows.get(outcome.flowKey)?.name;
        if (name !== undefined) outcomeLabels.push(name);
      }
      // 'next'＝自動前進、無端點摘要，不加標籤。
    }
    const priorResult = branch?.when.priorResult;
    const prior =
      priorResult === undefined
        ? undefined
        : {
            testName:
              flow?.nodes.find((n) => n.nodeKey === priorResult.nodeKey)?.name ??
              fallbackLabel(priorResult.nodeKey),
            resultCodes: priorResult.resultIn,
          };
    return { branchIndex, findingTypes, outcomeLabels, prior };
  });
}

export interface BreakoutStepView {
  // 1-based 顯示序。
  index: number;
  flowKey: SfmaFlowKey;
  nodeKey: string;
  // 測試（節點）名；查無時 View 退回 nodeKey。
  testName: LocalizedText | undefined;
  // 結果碼（FN/FP/DP/DN 或特殊選項碼）；當前待測步未答為 undefined。
  result: string | undefined;
  // 該步衍生 findingType（去重、PAIN 置頂）；當前待測步為空。
  findingTypes: BreakoutFindingType[];
  // breadcrumb 高亮的當前待測節點。
  isCurrent: boolean;
}

// 步驟清單呈現（03 §3.3.9 line 171）：完整 steps[]→序·測試名·結果碼·該步衍生 findingType chip；
// 末附當前待測節點（result undefined、isCurrent，供 breadcrumb 高亮）。完成後無當前步。
// findingType 以該步 flowKey+nodeKey 反查 record.findings（applyBranch 寫入時帶該步節點）。
export function breakoutStepViews(
  record: BreakoutRecord,
  flows: FlowMap = breakoutFlowMap,
): BreakoutStepView[] {
  const views: BreakoutStepView[] = record.steps.map((step, index) => ({
    index: index + 1,
    flowKey: step.flowKey,
    nodeKey: step.nodeKey,
    testName: nodeNameFromFlows(flows, step.flowKey, step.nodeKey),
    result: step.result,
    findingTypes: breakoutFindingTypeSummary(
      record.findings.filter((f) => f.flowKey === step.flowKey && f.nodeKey === step.nodeKey),
    ),
    isCurrent: false,
  }));
  const state = stateFromRecord(record, flows);
  if (state.currentFlowKey !== undefined && state.currentNodeKey !== undefined) {
    views.push({
      index: views.length + 1,
      flowKey: state.currentFlowKey,
      nodeKey: state.currentNodeKey,
      testName: nodeNameFromFlows(flows, state.currentFlowKey, state.currentNodeKey),
      result: undefined,
      findingTypes: [],
      isCurrent: true,
    });
  }
  return views;
}
