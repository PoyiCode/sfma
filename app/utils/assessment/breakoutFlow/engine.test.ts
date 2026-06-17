import { describe, expect, it } from 'vitest';
import { sfmaBreakoutFlowByKey } from '@ptapp/definitions';
import {
  applyStepResult,
  createBreakoutState,
  deriveBreakoutClassification,
  getCurrentNode,
  rebuildState,
  rewindToStep,
  type BreakoutEngineState,
} from './engine';

const flows = sfmaBreakoutFlowByKey;

function walk(state: BreakoutEngineState, results: string[]): BreakoutEngineState {
  let current = state;
  for (const result of results) {
    const outcome = applyStepResult(flows, current, result);
    if (outcome.kind !== 'applied') throw new Error(`unexpected ${outcome.kind}`);
    current = outcome.state;
  }
  return current;
}

describe('createBreakoutState／getCurrentNode', () => {
  it('入口流程之起始節點為目前節點', () => {
    const state = createBreakoutState(flows, 'cervicalFlexionBreakout');
    expect(state.currentFlowKey).toBe('cervicalFlexionBreakout');
    expect(getCurrentNode(flows, state)?.nodeKey).toBe('activeSupineCervicalFlexion');
  });

  it('未知流程擲錯', () => {
    expect(() => createBreakoutState(new Map(), 'ankleBreakout')).toThrow(/unknown flow/);
  });
});

describe('applyStepResult — 步進、findings、結束（05 §5.3.3 #2–#4）', () => {
  it('頸屈 FN → 姿勢性 SMCD finding、流程即結束', () => {
    const state = createBreakoutState(flows, 'cervicalFlexionBreakout');
    const outcome = applyStepResult(flows, state, 'FN');
    if (outcome.kind !== 'applied') throw new Error(outcome.kind);
    expect(outcome.events.newFindings.map((f) => f.findingKey)).toEqual([
      'posturalSmcdCervicalFlexion',
    ]);
    expect(outcome.state.currentFlowKey).toBeUndefined();
    expect(outcome.state.completedFlowKeys).toEqual(['cervicalFlexionBreakout']);
    expect(outcome.state.steps).toHaveLength(1);
  });

  it('頸屈 DN→DN 走到 OA 節點；fnBilateral 依 PSCF=DN 產出 JMD finding（priorResult）', () => {
    const state = walk(createBreakoutState(flows, 'cervicalFlexionBreakout'), ['DN', 'DN']);
    expect(getCurrentNode(flows, state)?.nodeKey).toBe('activeSupineOaCervicalFlexion');
    const outcome = applyStepResult(flows, state, 'fnBilateral');
    if (outcome.kind !== 'applied') throw new Error(outcome.kind);
    expect(outcome.events.newFindings.map((f) => f.findingKey)).toEqual([
      'cervicalSpineFlexionJmdTed',
    ]);
  });

  it('結果不在 resultOptions 擲錯；Breakout 已結束擲錯', () => {
    const state = createBreakoutState(flows, 'cervicalFlexionBreakout');
    expect(() => applyStepResult(flows, state, 'nope')).toThrow(/result/);
    const done = walk(state, ['FN']);
    expect(() => applyStepResult(flows, done, 'FN')).toThrow(/completed/);
  });
});

describe('hasFindings 與 instruction（05 §5.3.3 #3；UEP1 Lumbar Locked）', () => {
  it('無先前橘色框 → FN 產出 Postural/Shoulder Girdle SMCD', () => {
    // 主動模式一 FN → 直接轉屈肘；屈肘 FN → Lumbar Locked (CH)
    const state = walk(createBreakoutState(flows, 'upperExtremityPattern1Breakout'), ['FN', 'FN']);
    expect(getCurrentNode(flows, state)?.nodeKey).toBe('activeLumbarLockedChExtensionRotation');
    const outcome = applyStepResult(flows, state, 'FN');
    if (outcome.kind !== 'applied') throw new Error(outcome.kind);
    expect(outcome.events.newFindings.map((f) => f.findingKey)).toEqual([
      'posturalShoulderGirdleSmcd',
    ]);
  });

  it('已有橘色框 → FN 改走 instruction（先處理橘色框）', () => {
    // 模式一 DN → 被動 DN → 90/90 DN → 被動 IR DN（Shoulder IR JMD or TED＝橘色框）→ 肩伸展 FN → Lumbar Locked
    const state = walk(createBreakoutState(flows, 'upperExtremityPattern1Breakout'), [
      'DN',
      'DN',
      'DN',
      'DN',
      'FN',
    ]);
    expect(getCurrentNode(flows, state)?.nodeKey).toBe('activeLumbarLockedChExtensionRotation');
    const outcome = applyStepResult(flows, state, 'FN');
    if (outcome.kind !== 'applied') throw new Error(outcome.kind);
    expect(outcome.events.newFindings).toHaveLength(0);
    expect(outcome.events.instructions).toHaveLength(1);
  });
});

describe('流程佇列與去重（05 §5.3.3 #5）', () => {
  it('Press Up FN → finding＋排入 Lower、Upper（依序）；流程完成後遞補 Lower', () => {
    const state = walk(createBreakoutState(flows, 'spineExtensionBreakout'), ['DN', 'DN']);
    const outcome = applyStepResult(flows, state, 'FN');
    if (outcome.kind !== 'applied') throw new Error(outcome.kind);
    expect(outcome.events.enqueuedFlowKeys).toEqual([
      'lowerBodyExtensionBreakout',
      'upperBodyExtensionBreakout',
    ]);
    expect(outcome.state.currentFlowKey).toBe('lowerBodyExtensionBreakout');
    expect(outcome.state.queuedFlowKeys).toEqual(['upperBodyExtensionBreakout']);
    expect(outcome.events.completedFlowKey).toBe('spineExtensionBreakout');
  });

  it('已完成之流程不再排入（Upper 流程 Go to Lower 被去重）', () => {
    // MSE 鏈：BB w/o UE DN → SLBB DN → Press Up FN（排 Lower、Upper）
    // Lower：FABER FN → Thomas FN（FABER 正常→接續髖伸展）→ 主動髖伸展 FN（脊椎流程無 JMD/TED→SMCD finding）→ Lower 完成 → Upper
    // Upper：單側肩後彎 DN → Lat Stretch 屈髖 DN → Lat Stretch 伸髖 FN → finding＋Go to Lower（已完成→去重）
    let state = walk(createBreakoutState(flows, 'spineExtensionBreakout'), ['DN', 'DN', 'FN']);
    state = walk(state, ['FN', 'FN', 'FN']);
    expect(state.currentFlowKey).toBe('upperBodyExtensionBreakout');
    state = walk(state, ['DN', 'DN']);
    const outcome = applyStepResult(flows, state, 'FN');
    if (outcome.kind !== 'applied') throw new Error(outcome.kind);
    expect(outcome.events.enqueuedFlowKeys).toEqual([]);
    expect(outcome.state.currentFlowKey).toBeUndefined();
  });
});

describe('疼痛端點接續（ref §3.7.2 各站續行）', () => {
  it('Heel Walk DN → 被動背屈 DP → PAIN finding 且接續 Toe Walk', () => {
    const state = walk(createBreakoutState(flows, 'ankleBreakout'), ['DN']);
    const outcome = applyStepResult(flows, state, 'DP');
    if (outcome.kind !== 'applied') throw new Error(outcome.kind);
    expect(outcome.events.newFindings[0]?.findingType).toBe('PAIN');
    expect(getCurrentNode(flows, outcome.state)?.nodeKey).toBe('toeWalk');
  });

  it('踝全 FN 走完 → 本體感覺缺損（OTHER）', () => {
    const state = walk(createBreakoutState(flows, 'ankleBreakout'), ['FN', 'FN']);
    const outcome = applyStepResult(flows, state, 'FN');
    if (outcome.kind !== 'applied') throw new Error(outcome.kind);
    expect(outcome.events.newFindings.map((f) => f.findingKey)).toEqual(['proprioceptiveDeficit']);
    expect(outcome.events.newFindings[0]?.findingType).toBe('OTHER');
    expect(outcome.state.currentFlowKey).toBeUndefined();
  });

  it('踝流程中已有發現時，內外翻 FN 安靜結束（空 outcomes 分支）', () => {
    // Heel Walk DN → 被動背屈 DN（TED finding）→ Toe Walk FN → 內外翻 FN
    const state = walk(createBreakoutState(flows, 'ankleBreakout'), ['DN', 'DN', 'FN']);
    const outcome = applyStepResult(flows, state, 'FN');
    if (outcome.kind !== 'applied') throw new Error(outcome.kind);
    expect(outcome.events.newFindings).toHaveLength(0);
    expect(outcome.state.currentFlowKey).toBeUndefined();
  });
});

describe('ODS 深蹲 FN → instruction＋Go to MSE 鏈（05 §5.3.1）', () => {
  it('deepSquat FN：instruction、排入 spineExtensionBreakout 並遞補', () => {
    const state = createBreakoutState(flows, 'overheadDeepSquatBreakout');
    const outcome = applyStepResult(flows, state, 'FN');
    if (outcome.kind !== 'applied') throw new Error(outcome.kind);
    expect(outcome.events.instructions).toHaveLength(1);
    expect(outcome.state.currentFlowKey).toBe('spineExtensionBreakout');
  });
});

describe('條件資料缺失 → 人工擇一（05 §5.3.3 #7）', () => {
  it('MSF 抱膝節點缺 PSLR 先前結果 → needsManualChoice，manualBranchIndex 可續行', () => {
    // 以 rebuildState 構造「直接站在抱膝節點、無 PSLR 步驟」的自由情境
    const state = rebuildState(flows, 'multiSegmentalFlexionBreakout', [
      {
        flowKey: 'multiSegmentalFlexionBreakout',
        nodeKey: 'supineKneeToChest',
        result: 'FN',
        notes: '',
      },
    ]);
    // rebuild 對人工情境的步驟採用 desync 容忍：最後一步即端點 → Breakout 結束
    expect(state.currentFlowKey).toBeUndefined();

    // 直接以引擎驗證 needsManualChoice：站在抱膝節點、無步驟歷史
    const fresh = {
      ...createBreakoutState(flows, 'multiSegmentalFlexionBreakout'),
      currentNodeKey: 'supineKneeToChest',
    };
    const outcome = applyStepResult(flows, fresh, 'FN');
    expect(outcome.kind).toBe('needsManualChoice');
    if (outcome.kind !== 'needsManualChoice') throw new Error('unreachable');
    expect(outcome.candidateIndices.length).toBeGreaterThanOrEqual(2);

    const manual = applyStepResult(flows, fresh, 'FN', {
      manualBranchIndex: outcome.candidateIndices[1],
      notes: '人工擇一：PSLR 未測',
    });
    if (manual.kind !== 'applied') throw new Error(manual.kind);
    expect(manual.state.steps[0]?.notes).toBe('人工擇一：PSLR 未測');
  });
});

describe('rebuildState／rewindToStep（05 §5.3.3 #6）', () => {
  it('重放 3 步與逐步 applyStepResult 結果一致', () => {
    const replayed = rebuildState(flows, 'cervicalFlexionBreakout', [
      {
        flowKey: 'cervicalFlexionBreakout',
        nodeKey: 'activeSupineCervicalFlexion',
        result: 'DN',
        notes: '',
      },
      {
        flowKey: 'cervicalFlexionBreakout',
        nodeKey: 'passiveSupineCervicalFlexion',
        result: 'DN',
        notes: '',
      },
      {
        flowKey: 'cervicalFlexionBreakout',
        nodeKey: 'activeSupineOaCervicalFlexion',
        result: 'DN',
        notes: '',
      },
    ]);
    const walked = walk(createBreakoutState(flows, 'cervicalFlexionBreakout'), ['DN', 'DN', 'DN']);
    expect(replayed).toEqual(walked);
  });

  it('回溯第 1 步：之後步驟與衍生 findings 作廢、回到該步節點', () => {
    const walked = walk(createBreakoutState(flows, 'cervicalFlexionBreakout'), ['DN', 'DN', 'DN']);
    expect(walked.findings).toHaveLength(1); // oaFlexionJmdTed
    const { state, invalidatedSteps, invalidatedFindings } = rewindToStep(flows, walked, 1);
    expect(invalidatedSteps).toBe(2);
    expect(invalidatedFindings).toBe(1);
    expect(state.steps).toHaveLength(1);
    expect(state.findings).toHaveLength(0);
    expect(getCurrentNode(flows, state)?.nodeKey).toBe('passiveSupineCervicalFlexion');
  });

  it('回溯含佇列之紀錄：佇列重算（spineExtension Press Up FN 後回溯）', () => {
    const walked = walk(createBreakoutState(flows, 'spineExtensionBreakout'), ['DN', 'DN', 'FN']);
    expect(walked.queuedFlowKeys).toEqual(['upperBodyExtensionBreakout']);
    const { state } = rewindToStep(flows, walked, 2);
    expect(state.queuedFlowKeys).toEqual([]);
    expect(state.completedFlowKeys).toEqual([]);
    expect(state.currentFlowKey).toBe('spineExtensionBreakout');
    expect(getCurrentNode(flows, state)?.nodeKey).toBe('pressUp');
  });

  it('priorResult 歧義由既有 findings 消解（OA fnBilateral 重放）', () => {
    const steps = [
      {
        flowKey: 'cervicalFlexionBreakout',
        nodeKey: 'activeSupineCervicalFlexion',
        result: 'DN',
        notes: '',
      },
      {
        flowKey: 'cervicalFlexionBreakout',
        nodeKey: 'passiveSupineCervicalFlexion',
        result: 'FP',
        notes: '',
      },
      {
        flowKey: 'cervicalFlexionBreakout',
        nodeKey: 'activeSupineOaCervicalFlexion',
        result: 'fnBilateral',
        notes: '',
      },
    ] as const;
    const replayed = rebuildState(flows, 'cervicalFlexionBreakout', [...steps]);
    // PSCF=FP → JMD/TED ＋ 可能 SMCD 兩筆 findings
    expect(replayed.findings.map((f) => f.findingKey).sort()).toEqual([
      'cervicalFlexionPossibleSmcd',
      'cervicalSpineFlexionJmdTed',
    ]);
  });
});

describe('deriveBreakoutClassification（05 §5.3.4）', () => {
  const finding = (findingKey: string, findingType: 'SMCD' | 'JMD' | 'TED' | 'PAIN' | 'OTHER') => ({
    flowKey: 'ankleBreakout' as const,
    nodeKey: 'heelWalk',
    findingKey,
    findingType,
  });

  it('含 PAIN 優先 PAIN；否則取第一筆；空 → undefined', () => {
    expect(deriveBreakoutClassification([finding('a', 'TED'), finding('b', 'PAIN')])).toBe('PAIN');
    expect(deriveBreakoutClassification([finding('a', 'TED'), finding('b', 'JMD')])).toBe('TED');
    expect(deriveBreakoutClassification([])).toBeUndefined();
  });
});
