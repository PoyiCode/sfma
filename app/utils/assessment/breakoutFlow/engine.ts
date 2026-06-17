import type {
  BreakoutBranchCondition,
  BreakoutFinding,
  BreakoutFindingType,
  BreakoutNode,
  BreakoutStep,
  LocalizedText,
  SfmaBreakoutFlow,
  SfmaFlowKey,
} from '@ptapp/shared';

export type FlowMap = ReadonlyMap<SfmaFlowKey, SfmaBreakoutFlow>;
export type BreakoutBranch = BreakoutNode['branches'][number];

// 引導引擎狀態（05 §5.3.3）：不可變，applyStepResult 回傳新物件
export interface BreakoutEngineState {
  entryFlowKey: SfmaFlowKey;
  steps: BreakoutStep[];
  findings: BreakoutFinding[];
  queuedFlowKeys: SfmaFlowKey[];
  completedFlowKeys: SfmaFlowKey[];
  currentFlowKey: SfmaFlowKey | undefined;
  currentNodeKey: string | undefined;
}

export interface BreakoutStepEvents {
  newFindings: BreakoutFinding[];
  instructions: LocalizedText[];
  enqueuedFlowKeys: SfmaFlowKey[];
  completedFlowKey: SfmaFlowKey | undefined;
}

export type ApplyStepOutcome =
  | { kind: 'applied'; state: BreakoutEngineState; events: BreakoutStepEvents }
  | { kind: 'needsManualChoice'; candidateIndices: number[] }
  | { kind: 'noMatch' };

export function createFlowMap(flows: SfmaBreakoutFlow[]): FlowMap {
  return new Map(flows.map((flow) => [flow.flowKey, flow]));
}

function requireFlow(flows: FlowMap, flowKey: SfmaFlowKey): SfmaBreakoutFlow {
  const flow = flows.get(flowKey);
  if (flow === undefined) throw new Error(`unknown flow: ${flowKey}`);
  return flow;
}

export function createBreakoutState(
  flows: FlowMap,
  entryFlowKey: SfmaFlowKey,
): BreakoutEngineState {
  const flow = requireFlow(flows, entryFlowKey);
  return {
    entryFlowKey,
    steps: [],
    findings: [],
    queuedFlowKeys: [],
    completedFlowKeys: [],
    currentFlowKey: entryFlowKey,
    currentNodeKey: flow.startNodeKey,
  };
}

export function getCurrentNode(
  flows: FlowMap,
  state: BreakoutEngineState,
): BreakoutNode | undefined {
  if (state.currentFlowKey === undefined || state.currentNodeKey === undefined) return undefined;
  return requireFlow(flows, state.currentFlowKey).nodes.find(
    (node) => node.nodeKey === state.currentNodeKey,
  );
}

export interface BranchContext {
  currentFlowKey: SfmaFlowKey;
  steps: BreakoutStep[];
  findings: BreakoutFinding[];
}

type ConditionVerdict = 'satisfied' | 'unsatisfied' | 'undecidable';

// 條件語意（06 §6.4）：resultIn＝本節點結果；priorResult＝同流程先前節點（最後一筆，查無→undecidable）；
// hasFindings 預設排除 PAIN（橘色框語句），findingTypeIn 明列者照列檢查，inFlow 過濾流程
export function evaluateCondition(
  when: BreakoutBranchCondition,
  result: string,
  ctx: BranchContext,
): ConditionVerdict {
  if (when.resultIn !== undefined && !when.resultIn.includes(result)) return 'unsatisfied';
  if (when.priorResult !== undefined) {
    const prior = [...ctx.steps]
      .reverse()
      .find(
        (step) => step.flowKey === ctx.currentFlowKey && step.nodeKey === when.priorResult?.nodeKey,
      );
    if (prior === undefined) return 'undecidable';
    if (!when.priorResult.resultIn.includes(prior.result)) return 'unsatisfied';
  }
  if (when.hasFindings !== undefined) {
    const { has, inFlow, findingTypeIn } = when.hasFindings;
    const matched = ctx.findings.filter((finding) => {
      if (inFlow !== undefined && finding.flowKey !== inFlow) return false;
      if (findingTypeIn !== undefined) return findingTypeIn.includes(finding.findingType);
      return finding.findingType !== 'PAIN';
    });
    if (matched.length > 0 !== has) return 'unsatisfied';
  }
  return 'satisfied';
}

export type MatchBranchResult =
  | { kind: 'matched'; branchIndex: number }
  | { kind: 'needsManualChoice'; candidateIndices: number[] }
  | { kind: 'noMatch' };

// 順序即優先序：第一個滿足者勝出；resultIn 相符的分支中只要有 undecidable（priorResult 缺值，
// 05 §5.3.3 #7 條件資料缺失）即整組交由人工擇一
export function matchBranch(
  node: BreakoutNode,
  result: string,
  ctx: BranchContext,
): MatchBranchResult {
  const candidateIndices: number[] = [];
  let undecidable = false;
  for (const [index, branch] of node.branches.entries()) {
    if (branch.when.resultIn !== undefined && !branch.when.resultIn.includes(result)) continue;
    candidateIndices.push(index);
    if (evaluateCondition(branch.when, result, ctx) === 'undecidable') undecidable = true;
  }
  if (undecidable) return { kind: 'needsManualChoice', candidateIndices };
  for (const index of candidateIndices) {
    const branch = node.branches[index];
    if (branch !== undefined && evaluateCondition(branch.when, result, ctx) === 'satisfied') {
      return { kind: 'matched', branchIndex: index };
    }
  }
  return { kind: 'noMatch' };
}

export interface ApplyStepOptions {
  notes?: string;
  manualBranchIndex?: number;
}

export function applyStepResult(
  flows: FlowMap,
  state: BreakoutEngineState,
  result: string,
  options: ApplyStepOptions = {},
): ApplyStepOutcome {
  const node = getCurrentNode(flows, state);
  if (node === undefined || state.currentFlowKey === undefined) {
    throw new Error('breakout already completed');
  }
  if (!node.resultOptions.includes(result)) {
    throw new Error(`result not in resultOptions: ${result}`);
  }
  const ctx: BranchContext = {
    currentFlowKey: state.currentFlowKey,
    steps: state.steps,
    findings: state.findings,
  };
  let branchIndex = options.manualBranchIndex;
  if (branchIndex === undefined) {
    const match = matchBranch(node, result, ctx);
    if (match.kind !== 'matched') return match;
    branchIndex = match.branchIndex;
  }
  return {
    kind: 'applied',
    ...applyBranch(flows, state, node, result, branchIndex, options.notes),
  };
}

// 結局處理（06 §6.4 outcomes 可複合）；goToFlow 去重：已完成／佇列中／目前流程不重排
function applyBranch(
  flows: FlowMap,
  state: BreakoutEngineState,
  node: BreakoutNode,
  result: string,
  branchIndex: number,
  notes = '',
): { state: BreakoutEngineState; events: BreakoutStepEvents } {
  const flowKey = state.currentFlowKey as SfmaFlowKey;
  const branch = node.branches[branchIndex];
  if (branch === undefined) throw new Error(`unknown branch: ${branchIndex}`);
  const step: BreakoutStep = { flowKey, nodeKey: node.nodeKey, result, notes };
  const newFindings: BreakoutFinding[] = [];
  const instructions: LocalizedText[] = [];
  const enqueuedFlowKeys: SfmaFlowKey[] = [];
  let nextNodeKey: string | undefined;
  const queued = [...state.queuedFlowKeys];
  for (const outcome of branch.outcomes) {
    if (outcome.kind === 'finding') {
      newFindings.push({
        flowKey,
        nodeKey: node.nodeKey,
        findingKey: outcome.findingKey,
        findingType: outcome.findingType,
      });
    } else if (outcome.kind === 'instruction') {
      instructions.push(outcome.label);
    } else if (outcome.kind === 'goToFlow') {
      const isDuplicate =
        outcome.flowKey === flowKey ||
        state.completedFlowKeys.includes(outcome.flowKey) ||
        queued.includes(outcome.flowKey);
      if (!isDuplicate) {
        queued.push(outcome.flowKey);
        enqueuedFlowKeys.push(outcome.flowKey);
      }
    } else {
      nextNodeKey = outcome.nodeKey;
    }
  }
  let completedFlowKey: SfmaFlowKey | undefined;
  let currentFlowKey: SfmaFlowKey | undefined = flowKey;
  let currentNodeKey = nextNodeKey;
  const completed = [...state.completedFlowKeys];
  if (nextNodeKey === undefined) {
    completedFlowKey = flowKey;
    completed.push(flowKey);
    const upNext = queued.shift();
    currentFlowKey = upNext;
    currentNodeKey = upNext === undefined ? undefined : requireFlow(flows, upNext).startNodeKey;
  }
  return {
    state: {
      ...state,
      steps: [...state.steps, step],
      findings: [...state.findings, ...newFindings],
      queuedFlowKeys: queued,
      completedFlowKeys: completed,
      currentFlowKey,
      currentNodeKey,
    },
    events: { newFindings, instructions, enqueuedFlowKeys, completedFlowKey },
  };
}

// —— 回溯與重建（05 §5.3.3 #6）——

// 以紀錄重放重建引擎狀態。歧義消解預言機（oracle）：人工擇一過的步驟無分支資訊，
// 以「該步實際產出的 findings」與「下一步的節點」回推所走分支；皆無法判別時取第一候選。
// 與目前游標脫鉤的步驟（自由模式）採 desync 容忍：硬移游標至該步節點後續算。
export function rebuildState(
  flows: FlowMap,
  entryFlowKey: SfmaFlowKey,
  steps: BreakoutStep[],
  findingsOracle?: BreakoutFinding[],
): BreakoutEngineState {
  let state = createBreakoutState(flows, entryFlowKey);
  for (const [index, step] of steps.entries()) {
    if (state.currentFlowKey !== step.flowKey || state.currentNodeKey !== step.nodeKey) {
      state = { ...state, currentFlowKey: step.flowKey, currentNodeKey: step.nodeKey };
    }
    const node = getCurrentNode(flows, state);
    if (node === undefined) break;
    const ctx: BranchContext = {
      currentFlowKey: step.flowKey,
      steps: state.steps,
      findings: state.findings,
    };
    const match = matchBranch(node, step.result, ctx);
    let branchIndex: number;
    if (match.kind === 'matched') {
      branchIndex = match.branchIndex;
    } else if (match.kind === 'needsManualChoice') {
      branchIndex = disambiguateBranch(
        node,
        match.candidateIndices,
        step,
        steps[index + 1],
        findingsOracle,
      );
    } else {
      break;
    }
    state = applyBranch(flows, state, node, step.result, branchIndex, step.notes).state;
  }
  return state;
}

function disambiguateBranch(
  node: BreakoutNode,
  candidateIndices: number[],
  step: BreakoutStep,
  nextStep: BreakoutStep | undefined,
  findingsOracle: BreakoutFinding[] | undefined,
): number {
  const recordedKeys = (findingsOracle ?? [])
    .filter((f) => f.flowKey === step.flowKey && f.nodeKey === step.nodeKey)
    .map((f) => f.findingKey)
    .sort();
  for (const index of candidateIndices) {
    const branch = node.branches[index];
    if (branch === undefined) continue;
    const outcomes = branch.outcomes;
    const branchKeys = outcomes.flatMap((o) => (o.kind === 'finding' ? [o.findingKey] : [])).sort();
    const nextNodeKey = outcomes.find((o) => o.kind === 'next')?.nodeKey;
    const findingsAgree =
      findingsOracle === undefined || JSON.stringify(branchKeys) === JSON.stringify(recordedKeys);
    const nextAgrees =
      nextStep === undefined || nextStep.flowKey !== step.flowKey
        ? nextNodeKey === undefined
        : nextNodeKey === nextStep.nodeKey;
    if (findingsAgree && nextAgrees) return index;
  }
  return candidateIndices[0] ?? 0;
}

export interface RewindResult {
  state: BreakoutEngineState;
  invalidatedSteps: number;
  invalidatedFindings: number;
}

// 回溯：保留前 stepIndex 步、其後 steps 與衍生 findings 作廢並重建佇列／游標；
// 量化數字供 UI 紅色作廢 AlertDialog 使用（03 §3.3.9）
export function rewindToStep(
  flows: FlowMap,
  state: BreakoutEngineState,
  stepIndex: number,
): RewindResult {
  const kept = state.steps.slice(0, stepIndex);
  const rebuilt = rebuildState(flows, state.entryFlowKey, kept, state.findings);
  return {
    state: rebuilt,
    invalidatedSteps: state.steps.length - kept.length,
    invalidatedFindings: state.findings.length - rebuilt.findings.length,
  };
}

// classification 預設推導（05 §5.3.4）：含 PAIN 者 PAIN 優先，否則第一筆 finding 類型
export function deriveBreakoutClassification(
  findings: BreakoutFinding[],
): BreakoutFindingType | undefined {
  if (findings.some((finding) => finding.findingType === 'PAIN')) return 'PAIN';
  return findings[0]?.findingType;
}
