import { describe, expect, it } from 'vitest';
import type { BreakoutNode, BreakoutRecord, SfmaBreakoutFlow } from '@ptapp/shared';
import { createFlowMap } from './breakoutFlow/engine';
import {
  applyBreakoutResult,
  applyBreakoutResultAt,
  breakoutNodeAt,
  currentBreakoutNode,
  deriveBreakoutClassification,
  findBreakout,
  isBreakoutComplete,
  newBreakoutRecord,
  oppositeSide,
  priorNonSidedResult,
  rewindBreakout,
  setBreakoutClassification,
  stateFromRecord,
  upsertBreakout,
  type ApplyBreakoutOutcome,
} from './breakoutForm';

const L = (zh: string) => ({ 'zh-TW': zh, en: zh });

// fake 流程（與真實內容脫鉤）：n1 DN→next n2、FN→SMCD finding；n2 DN→JMD finding、FN→SMCD finding。
const fakeFlow: SfmaBreakoutFlow = {
  flowKey: 'cervicalFlexionBreakout',
  name: L('測試流程'),
  sourceRef: 'test',
  startNodeKey: 'n1',
  nodes: [
    {
      nodeKey: 'n1',
      name: L('測試一'),
      mode: 'active',
      resultOptions: ['FN', 'DN'],
      branches: [
        { when: { resultIn: ['DN'] }, outcomes: [{ kind: 'next', nodeKey: 'n2' }] },
        {
          when: { resultIn: ['FN'] },
          outcomes: [
            { kind: 'finding', findingKey: 'f-smcd', findingType: 'SMCD', label: L('SMCD') },
          ],
        },
      ],
    },
    {
      nodeKey: 'n2',
      name: L('測試二'),
      mode: 'passive',
      resultOptions: ['FN', 'DN'],
      branches: [
        {
          when: { resultIn: ['DN'] },
          outcomes: [{ kind: 'finding', findingKey: 'f-jmd', findingType: 'JMD', label: L('JMD') }],
        },
        {
          when: { resultIn: ['FN'] },
          outcomes: [
            { kind: 'finding', findingKey: 'f-smcd2', findingType: 'SMCD', label: L('SMCD2') },
          ],
        },
      ],
    },
  ],
};

const flows = createFlowMap([fakeFlow]);

// 第二流程（自由模式跳測用）：m1 DN→TED finding（端點）；FN 無相符分支（測 noMatch）。
const fakeFlowB: SfmaBreakoutFlow = {
  flowKey: 'cervicalRotationBreakout',
  name: L('測試流程B'),
  sourceRef: 'test',
  startNodeKey: 'm1',
  nodes: [
    {
      nodeKey: 'm1',
      name: L('B一'),
      mode: 'active',
      resultOptions: ['FN', 'DN'],
      branches: [
        {
          when: { resultIn: ['DN'] },
          outcomes: [{ kind: 'finding', findingKey: 'f-ted', findingType: 'TED', label: L('TED') }],
        },
      ],
    },
  ],
};
const freeformFlows = createFlowMap([fakeFlow, fakeFlowB]);

function applied(outcome: ApplyBreakoutOutcome): BreakoutRecord {
  if (outcome.kind !== 'applied') throw new Error(`expected applied, got ${outcome.kind}`);
  return outcome.record;
}

describe('breakoutForm（05 §5.3 引擎↔紀錄橋接）', () => {
  it('newBreakoutRecord 依頂層動作帶入入口流程、空白紀錄', () => {
    const rec = newBreakoutRecord('cervicalFlexion', null);
    expect(rec.entryFlowKey).toBe('cervicalFlexionBreakout');
    expect(rec.steps).toEqual([]);
    expect(rec.findings).toEqual([]);
    expect(rec.classification).toBeUndefined();
  });

  it('findBreakout／upsertBreakout 依 pattern×side 取代或附加', () => {
    const a = newBreakoutRecord('cervicalFlexion', null);
    const list = upsertBreakout([], a);
    expect(list).toHaveLength(1);
    expect(findBreakout(list, 'cervicalFlexion', null)).toBe(a);
    const list2 = upsertBreakout(list, { ...a, notes: 'x' });
    expect(list2).toHaveLength(1);
    expect(findBreakout(list2, 'cervicalFlexion', null)?.notes).toBe('x');
  });

  it('currentBreakoutNode 起始為起點節點', () => {
    const rec = newBreakoutRecord('cervicalFlexion', null);
    expect(currentBreakoutNode(rec, flows)?.nodeKey).toBe('n1');
  });

  it('applyBreakoutResult：next 前進並記步，findings 累積至完成', () => {
    const rec0 = newBreakoutRecord('cervicalFlexion', null);
    const rec1 = applied(applyBreakoutResult(rec0, 'DN', {}, flows));
    expect(rec1.steps).toHaveLength(1);
    expect(currentBreakoutNode(rec1, flows)?.nodeKey).toBe('n2');
    expect(isBreakoutComplete(rec1, flows)).toBe(false);

    const rec2 = applied(applyBreakoutResult(rec1, 'DN', {}, flows));
    expect(rec2.findings.map((f) => f.findingType)).toEqual(['JMD']);
    expect(isBreakoutComplete(rec2, flows)).toBe(true);
    expect(deriveBreakoutClassification(rec2.findings)).toBe('JMD');
  });

  it('rewindBreakout 作廢其後步與衍生 findings（量化回報）', () => {
    let rec = newBreakoutRecord('cervicalFlexion', null);
    rec = applied(applyBreakoutResult(rec, 'DN', {}, flows));
    rec = applied(applyBreakoutResult(rec, 'DN', {}, flows));
    expect(rec.steps).toHaveLength(2);
    expect(rec.findings).toHaveLength(1);
    const rw = rewindBreakout(rec, 1, flows);
    expect(rw.record.steps).toHaveLength(1);
    expect(rw.record.findings).toHaveLength(0);
    expect(rw.invalidatedSteps).toBe(1);
    expect(rw.invalidatedFindings).toBe(1);
    expect(currentBreakoutNode(rw.record, flows)?.nodeKey).toBe('n2');
  });

  it('setBreakoutClassification 覆寫分類', () => {
    const rec = newBreakoutRecord('cervicalFlexion', null);
    expect(setBreakoutClassification(rec, 'TED').classification).toBe('TED');
  });
});

describe('自由模式跳測（06-F2g-i，05 §5.3.3 #9）', () => {
  it('applyBreakoutResultAt 跳至他流程節點套一步、摺回紀錄、重載穩定', () => {
    const rec0 = newBreakoutRecord('cervicalFlexion', null); // entryFlowKey＝flowA、游標 n1
    const outcome = applyBreakoutResultAt(
      rec0,
      'cervicalRotationBreakout',
      'm1',
      'DN',
      {},
      freeformFlows,
    );
    expect(outcome.kind).toBe('applied');
    if (outcome.kind !== 'applied') return;
    expect(outcome.record.steps).toHaveLength(1);
    expect(outcome.record.steps[0]).toMatchObject({
      flowKey: 'cervicalRotationBreakout',
      nodeKey: 'm1',
      result: 'DN',
    });
    expect(outcome.record.findings.map((f) => f.findingType)).toEqual(['TED']);
    // 重載穩定：rebuildState 以 desync 容忍重放，findings 重現。
    const reState = stateFromRecord(outcome.record, freeformFlows);
    expect(reState.findings.map((f) => f.findingType)).toEqual(['TED']);
  });

  it('applyBreakoutResultAt 結果不觸發任何分支回 noMatch', () => {
    const rec0 = newBreakoutRecord('cervicalFlexion', null);
    // m1 FN 在 resultOptions 內但無相符分支（僅 DN→finding）。
    const outcome = applyBreakoutResultAt(
      rec0,
      'cervicalRotationBreakout',
      'm1',
      'FN',
      {},
      freeformFlows,
    );
    expect(outcome.kind).toBe('noMatch');
  });

  it('breakoutNodeAt 取指定流程節點、查無回 undefined', () => {
    expect(breakoutNodeAt('cervicalFlexionBreakout', 'n2', freeformFlows)?.nodeKey).toBe('n2');
    expect(breakoutNodeAt('cervicalFlexionBreakout', 'nope', freeformFlows)).toBeUndefined();
  });
});

describe('oppositeSide／priorNonSidedResult（05 §5.3.3 #8）', () => {
  const ctsibNode: BreakoutNode = {
    nodeKey: 'vestibularCtsibStaticHead',
    name: L('CTSIB'),
    mode: 'active',
    sideIndependent: true,
    resultOptions: ['FN', 'DN'],
    branches: [],
  };
  const sidedNode: BreakoutNode = {
    ...ctsibNode,
    nodeKey: 'halfKneelingNarrowBase',
    sideIndependent: undefined,
  };
  const otherRecord: BreakoutRecord = {
    patternKey: 'singleLegStance',
    side: 'left',
    entryFlowKey: 'vestibularCoreBreakout',
    steps: [
      {
        flowKey: 'vestibularCoreBreakout',
        nodeKey: 'vestibularCtsibStaticHead',
        result: 'FN',
        notes: '',
      },
    ],
    findings: [],
    notes: '',
  };

  it('oppositeSide：left↔right、single（null）→undefined', () => {
    expect(oppositeSide('left')).toBe('right');
    expect(oppositeSide('right')).toBe('left');
    expect(oppositeSide(null)).toBeUndefined();
  });

  it('不分側節點且另一側有同節點紀錄→回前值', () => {
    expect(priorNonSidedResult(ctsibNode, 'vestibularCoreBreakout', otherRecord)).toBe('FN');
  });

  it('非不分側節點→undefined', () => {
    expect(priorNonSidedResult(sidedNode, 'vestibularCoreBreakout', otherRecord)).toBeUndefined();
  });

  it('無對側紀錄／flowKey 不符／查無該節點→undefined', () => {
    expect(priorNonSidedResult(ctsibNode, 'vestibularCoreBreakout', undefined)).toBeUndefined();
    expect(priorNonSidedResult(ctsibNode, 'ankleBreakout', otherRecord)).toBeUndefined();
  });

  it('node 或 flowKey 為 undefined→undefined', () => {
    expect(priorNonSidedResult(undefined, 'vestibularCoreBreakout', otherRecord)).toBeUndefined();
    expect(priorNonSidedResult(ctsibNode, undefined, otherRecord)).toBeUndefined();
  });
});
