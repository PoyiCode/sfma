import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter, type Ref } from 'vue';
import type {
  BreakoutFindingType,
  BreakoutNode,
  BreakoutRecord,
  LocalizedText,
  SfmaFlowKey,
} from '@ptapp/shared';
import { getCurrentNode, type FlowMap } from '../../utils/assessment/breakoutFlow/engine';
import {
  applyBreakoutResult,
  applyBreakoutResultAt,
  breakoutFlowMap,
  breakoutNodeAt,
  deriveBreakoutClassification,
  priorNonSidedResult,
  rewindBreakout,
  setBreakoutClassification,
  stateFromRecord,
} from '../../utils/assessment/breakoutForm';
import {
  breakoutCandidateViews,
  breakoutFindingViews,
  breakoutFlowName,
  breakoutFlowOptions,
  breakoutNodeOptions,
  breakoutStepViews,
  resultCardsFromEvents,
  type BreakoutCandidateView,
  type BreakoutFindingView,
  type BreakoutFlowOption,
  type BreakoutNodeOption,
  type BreakoutResultCardModel,
  type BreakoutStepView,
} from '../../utils/assessment/breakoutPresentation';

// 條件資料缺失時的人工擇一待決狀態（05 §5.3.3 #7；03 §3.3.9）。
export interface BreakoutManualChoice {
  result: string;
  candidateIndices: number[];
  // 自由模式跳測時的節點（resolveManualChoice 於此節點套分支）；guided 為 undefined（用當前節點）。
  target?: { flowKey: SfmaFlowKey; nodeKey: string };
}

export interface UseBreakoutResult {
  node: ComputedRef<BreakoutNode | undefined>;
  flowName: ComputedRef<LocalizedText | undefined>;
  // 不分側測試（sideIndependent）另一側已測之前值（05 §5.3.3 #8）；無則 undefined。
  priorResult: ComputedRef<string | undefined>;
  stepCount: ComputedRef<number>;
  findings: ComputedRef<BreakoutFindingView[]>;
  queuedFlowNames: ComputedRef<LocalizedText[]>;
  resultCards: Ref<BreakoutResultCardModel[]>;
  isComplete: ComputedRef<boolean>;
  manualChoice: Ref<BreakoutManualChoice | undefined>;
  applyResult: (result: string) => void;
  resolveManualChoice: (branchIndex: number) => void;
  manualChoiceCandidates: ComputedRef<BreakoutCandidateView[]>;
  cancelManualChoice: () => void;
  stepViews: ComputedRef<BreakoutStepView[]>;
  // 量化作廢（供確認對話框文案）；不持久化。
  rewindPreview: (stepIndex: number) => { invalidatedSteps: number; invalidatedFindings: number };
  // 回溯至第 stepIndex 步（保留前 stepIndex 步、作廢其後）並樂觀落盤。
  rewind: (stepIndex: number) => void;
  // 完成判讀：record.classification 覆寫優先，否則由 findings 預設推導（含 PAIN→PAIN）。
  classification: ComputedRef<BreakoutFindingType | undefined>;
  isClassificationOverridden: ComputedRef<boolean>;
  setClassification: (classification: BreakoutFindingType) => void;
  // 自由模式（freeform，05 §5.3.3 #9）：不經引導、挑任一流程節點逐筆記錄。
  freeform: Ref<boolean>;
  setFreeform: (on: boolean) => void;
  flowOptions: ComputedRef<BreakoutFlowOption[]>;
  nodeOptions: ComputedRef<BreakoutNodeOption[]>;
  pickedFlowKey: Ref<SfmaFlowKey | undefined>;
  pickedNodeKey: Ref<string | undefined>;
  freeformNode: ComputedRef<BreakoutNode | undefined>;
  setPickedFlow: (flowKey: SfmaFlowKey) => void;
  setPickedNode: (nodeKey: string) => void;
  applyFreeform: (result: string) => void;
}

// Breakout 疊層控制 composable（03 §3.3.9）：record 為唯一真實來源（受控於上層 session，以
// MaybeRefOrGetter 注入使 record 變更時衍生值即時重算），onChange 樂觀持久化（接 useAssessmentSession.updateBreakout）。
// 過渡態（resultCards／manualChoice）為區域態：每套用一步即由該步事件重設——純前進步驟事件為空 → resultCards 清空（端點才出卡）。
// flows 可注入供測試以 fake 流程脫鉤（預設 16 真實流程）。
export function useBreakout(
  record: MaybeRefOrGetter<BreakoutRecord>,
  onChange: (record: BreakoutRecord) => void,
  flows: FlowMap = breakoutFlowMap,
  otherSideRecord?: MaybeRefOrGetter<BreakoutRecord | undefined>,
): UseBreakoutResult {
  const resultCards = ref<BreakoutResultCardModel[]>([]);
  const manualChoice = ref<BreakoutManualChoice | undefined>(undefined);
  const freeform = ref(false);
  const pickedFlowKey = ref<SfmaFlowKey | undefined>(undefined);
  const pickedNodeKey = ref<string | undefined>(undefined);

  const state = computed(() => stateFromRecord(toValue(record), flows));
  const node = computed(() => getCurrentNode(flows, state.value));
  const flowName = computed(() =>
    breakoutFlowName(state.value.currentFlowKey ?? toValue(record).entryFlowKey),
  );
  const findings = computed(() => breakoutFindingViews(toValue(record).findings));
  const queuedFlowNames = computed(() =>
    state.value.queuedFlowKeys
      .map((flowKey) => breakoutFlowName(flowKey))
      .filter((name): name is LocalizedText => name !== undefined),
  );
  const stepViews = computed(() => breakoutStepViews(toValue(record), flows));
  const priorResult = computed(() =>
    priorNonSidedResult(node.value, state.value.currentFlowKey, toValue(otherSideRecord)),
  );

  function applyResult(result: string): void {
    const outcome = applyBreakoutResult(toValue(record), result, {}, flows);
    if (outcome.kind === 'applied') {
      resultCards.value = resultCardsFromEvents(outcome.events);
      manualChoice.value = undefined;
      onChange(outcome.record);
    } else if (outcome.kind === 'needsManualChoice') {
      manualChoice.value = { result, candidateIndices: outcome.candidateIndices };
    }
  }

  function resolveManualChoice(branchIndex: number): void {
    const choice = manualChoice.value;
    if (choice === undefined) return;
    // target 存在＝自由模式跳測，於該節點套分支；否則沿用引導當前節點。
    const outcome =
      choice.target === undefined
        ? applyBreakoutResult(toValue(record), choice.result, { manualBranchIndex: branchIndex }, flows)
        : applyBreakoutResultAt(
            toValue(record),
            choice.target.flowKey,
            choice.target.nodeKey,
            choice.result,
            { manualBranchIndex: branchIndex },
            flows,
          );
    if (outcome.kind === 'applied') {
      resultCards.value = resultCardsFromEvents(outcome.events);
      manualChoice.value = undefined;
      onChange(outcome.record);
    }
  }

  const manualChoiceCandidates = computed<BreakoutCandidateView[]>(() => {
    const choice = manualChoice.value;
    if (choice === undefined) return [];
    // target 存在＝自由跳測節點；否則引導當前節點。
    const choiceNode =
      choice.target === undefined
        ? node.value
        : breakoutNodeAt(choice.target.flowKey, choice.target.nodeKey, flows);
    const choiceFlowKey = choice.target?.flowKey ?? state.value.currentFlowKey;
    if (choiceNode === undefined || choiceFlowKey === undefined) return [];
    return breakoutCandidateViews(choiceNode, choice.candidateIndices, choiceFlowKey, flows);
  });

  function cancelManualChoice(): void {
    manualChoice.value = undefined;
  }

  function rewindPreview(stepIndex: number): { invalidatedSteps: number; invalidatedFindings: number } {
    const { invalidatedSteps, invalidatedFindings } = rewindBreakout(toValue(record), stepIndex, flows);
    return { invalidatedSteps, invalidatedFindings };
  }

  function rewind(stepIndex: number): void {
    const { record: next } = rewindBreakout(toValue(record), stepIndex, flows);
    resultCards.value = [];
    manualChoice.value = undefined;
    onChange(next);
  }

  const classification = computed(
    () => toValue(record).classification ?? deriveBreakoutClassification(toValue(record).findings),
  );
  const isClassificationOverridden = computed(() => toValue(record).classification !== undefined);

  function setClassification(next: BreakoutFindingType): void {
    onChange(setBreakoutClassification(toValue(record), next));
  }

  const flowOptions = computed(() => breakoutFlowOptions(flows));
  const nodeOptions = computed(() =>
    pickedFlowKey.value === undefined ? [] : breakoutNodeOptions(pickedFlowKey.value, flows),
  );
  const freeformNode = computed(() =>
    pickedFlowKey.value === undefined || pickedNodeKey.value === undefined
      ? undefined
      : breakoutNodeAt(pickedFlowKey.value, pickedNodeKey.value, flows),
  );

  function setFreeform(on: boolean): void {
    freeform.value = on;
    manualChoice.value = undefined;
  }

  function setPickedFlow(flowKey: SfmaFlowKey): void {
    pickedFlowKey.value = flowKey;
    // 自動挑該流程首節點，挑流程即可記錄。
    pickedNodeKey.value = flows.get(flowKey)?.nodes[0]?.nodeKey;
    manualChoice.value = undefined;
  }

  function setPickedNode(nodeKey: string): void {
    pickedNodeKey.value = nodeKey;
    manualChoice.value = undefined;
  }

  function applyFreeform(result: string): void {
    if (pickedFlowKey.value === undefined || pickedNodeKey.value === undefined) return;
    const outcome = applyBreakoutResultAt(
      toValue(record),
      pickedFlowKey.value,
      pickedNodeKey.value,
      result,
      {},
      flows,
    );
    if (outcome.kind === 'applied') {
      resultCards.value = resultCardsFromEvents(outcome.events);
      manualChoice.value = undefined;
      onChange(outcome.record);
    } else if (outcome.kind === 'needsManualChoice') {
      manualChoice.value = {
        result,
        candidateIndices: outcome.candidateIndices,
        target: { flowKey: pickedFlowKey.value, nodeKey: pickedNodeKey.value },
      };
    }
  }

  return {
    node,
    flowName,
    priorResult,
    stepCount: computed(() => toValue(record).steps.length),
    findings,
    queuedFlowNames,
    resultCards,
    isComplete: computed(() => state.value.currentNodeKey === undefined),
    manualChoice,
    applyResult,
    resolveManualChoice,
    manualChoiceCandidates,
    cancelManualChoice,
    stepViews,
    rewindPreview,
    rewind,
    classification,
    isClassificationOverridden,
    setClassification,
    freeform,
    setFreeform,
    flowOptions,
    nodeOptions,
    pickedFlowKey,
    pickedNodeKey,
    freeformNode,
    setPickedFlow,
    setPickedNode,
    applyFreeform,
  };
}
