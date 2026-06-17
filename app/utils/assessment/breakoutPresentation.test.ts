import { describe, expect, it } from 'vitest';
import { sfmaBreakoutFlows, sfmaBreakoutFlowByKey } from '@ptapp/definitions';
import type {
  BreakoutFinding,
  BreakoutNode,
  BreakoutRecord,
  SfmaBreakoutFlow,
} from '@ptapp/shared';
import { createFlowMap, type BreakoutStepEvents } from './breakoutFlow/engine';
import { applyBreakoutResult } from './breakoutForm';
import {
  breakoutCandidateViews,
  breakoutEntrySummary,
  breakoutFindingLabel,
  breakoutFindingTypeSummary,
  breakoutFindingViews,
  breakoutFlowName,
  breakoutFlowOptions,
  breakoutNodeName,
  breakoutNodeOptions,
  breakoutStepViews,
  resultCardsFromEvents,
} from './breakoutPresentation';

// 從真實流程資料抓第一筆（符合述詞）finding outcome 的脈絡，避免測試硬編內容
function firstFinding(matches: (findingType: string) => boolean) {
  for (const flow of sfmaBreakoutFlows) {
    for (const node of flow.nodes) {
      for (const branch of node.branches) {
        for (const outcome of branch.outcomes) {
          if (outcome.kind === 'finding' && matches(outcome.findingType)) {
            return {
              flowKey: flow.flowKey,
              nodeKey: node.nodeKey,
              findingKey: outcome.findingKey,
              findingType: outcome.findingType,
              label: outcome.label,
            };
          }
        }
      }
    }
  }
  throw new Error('no matching finding in data');
}

const anyFinding = firstFinding((findingType) => findingType !== 'PAIN');
const painFinding = firstFinding((findingType) => findingType === 'PAIN');

describe('breakoutPresentation（06-F2d 呈現衍生）', () => {
  it('breakoutFindingLabel 反查 findingKey→顯示文字', () => {
    expect(breakoutFindingLabel(anyFinding.findingKey)).toEqual(anyFinding.label);
    expect(breakoutFindingLabel('nonexistentFindingKey')).toBeUndefined();
  });

  it('breakoutFlowName／breakoutNodeName 取定義名稱', () => {
    expect(breakoutFlowName(anyFinding.flowKey)).toEqual(
      sfmaBreakoutFlowByKey.get(anyFinding.flowKey)?.name,
    );
    expect(breakoutNodeName(anyFinding.flowKey, anyFinding.nodeKey)).toEqual(
      sfmaBreakoutFlowByKey
        .get(anyFinding.flowKey)
        ?.nodes.find((node) => node.nodeKey === anyFinding.nodeKey)?.name,
    );
  });

  it('resultCardsFromEvents 將事件轉端點結果卡（finding／goToFlow／instruction）', () => {
    const events: BreakoutStepEvents = {
      newFindings: [
        {
          flowKey: anyFinding.flowKey,
          nodeKey: anyFinding.nodeKey,
          findingKey: anyFinding.findingKey,
          findingType: anyFinding.findingType,
        },
      ],
      instructions: [{ 'zh-TW': '停止並先處理', en: 'Stop and treat' }],
      enqueuedFlowKeys: [painFinding.flowKey],
      completedFlowKey: undefined,
    };
    expect(resultCardsFromEvents(events)).toEqual([
      { kind: 'finding', findingType: anyFinding.findingType, label: anyFinding.label },
      { kind: 'goToFlow', flowName: sfmaBreakoutFlowByKey.get(painFinding.flowKey)?.name },
      { kind: 'instruction', label: { 'zh-TW': '停止並先處理', en: 'Stop and treat' } },
    ]);
  });

  it('resultCardsFromEvents：多筆 finding 時 PAIN 置頂', () => {
    const events: BreakoutStepEvents = {
      newFindings: [
        {
          flowKey: anyFinding.flowKey,
          nodeKey: anyFinding.nodeKey,
          findingKey: anyFinding.findingKey,
          findingType: anyFinding.findingType,
        },
        {
          flowKey: painFinding.flowKey,
          nodeKey: painFinding.nodeKey,
          findingKey: painFinding.findingKey,
          findingType: 'PAIN',
        },
      ],
      instructions: [],
      enqueuedFlowKeys: [],
      completedFlowKey: undefined,
    };
    const cards = resultCardsFromEvents(events);
    expect(cards[0]).toMatchObject({ kind: 'finding', findingType: 'PAIN' });
    expect(cards[1]).toMatchObject({ kind: 'finding', findingType: anyFinding.findingType });
  });

  it('breakoutFindingViews：每筆帶顯示文字＋來源測試名，PAIN 置頂', () => {
    const findings: BreakoutFinding[] = [
      {
        flowKey: anyFinding.flowKey,
        nodeKey: anyFinding.nodeKey,
        findingKey: anyFinding.findingKey,
        findingType: anyFinding.findingType,
      },
      {
        flowKey: painFinding.flowKey,
        nodeKey: painFinding.nodeKey,
        findingKey: painFinding.findingKey,
        findingType: 'PAIN',
      },
    ];
    const views = breakoutFindingViews(findings);
    expect(views[0]?.findingType).toBe('PAIN');
    expect(views[1]).toEqual({
      findingType: anyFinding.findingType,
      label: anyFinding.label,
      source: sfmaBreakoutFlowByKey
        .get(anyFinding.flowKey)
        ?.nodes.find((node) => node.nodeKey === anyFinding.nodeKey)?.name,
    });
  });
});

const L = (zh: string) => ({ 'zh-TW': zh, en: zh });
const WALK_KEY = 'cervicalFlexionBreakout';

// fake 流程：n1 DN→next n2；n2 DN→JMD finding（端點，無 next 即完成）。
const walkFlow: SfmaBreakoutFlow = {
  flowKey: WALK_KEY,
  name: L('走查流程'),
  sourceRef: 'test',
  startNodeKey: 'n1',
  nodes: [
    {
      nodeKey: 'n1',
      name: L('節點一'),
      mode: 'active',
      resultOptions: ['DN'],
      branches: [{ when: { resultIn: ['DN'] }, outcomes: [{ kind: 'next', nodeKey: 'n2' }] }],
    },
    {
      nodeKey: 'n2',
      name: L('節點二'),
      mode: 'passive',
      resultOptions: ['DN'],
      branches: [
        {
          when: { resultIn: ['DN'] },
          outcomes: [{ kind: 'finding', findingKey: 'f-jmd', findingType: 'JMD', label: L('JMD') }],
        },
      ],
    },
  ],
};
const walkFlows = createFlowMap([walkFlow]);

function freshRecord(): BreakoutRecord {
  return {
    patternKey: 'cervicalFlexion',
    side: null,
    entryFlowKey: WALK_KEY,
    steps: [],
    findings: [],
    notes: '',
  };
}

function applied(record: BreakoutRecord, result: string): BreakoutRecord {
  const outcome = applyBreakoutResult(record, result, {}, walkFlows);
  if (outcome.kind !== 'applied') throw new Error(`expected applied, got ${outcome.kind}`);
  return outcome.record;
}

describe('breakoutEntrySummary／breakoutFindingTypeSummary（06-F2d-iv-c2-ii）', () => {
  it('breakoutFindingTypeSummary 去重且 PAIN 置頂', () => {
    const findings: BreakoutFinding[] = [
      { flowKey: WALK_KEY, nodeKey: 'a', findingKey: 'k1', findingType: 'JMD' },
      { flowKey: WALK_KEY, nodeKey: 'b', findingKey: 'k2', findingType: 'JMD' },
      { flowKey: WALK_KEY, nodeKey: 'c', findingKey: 'k3', findingType: 'PAIN' },
      { flowKey: WALK_KEY, nodeKey: 'd', findingKey: 'k4', findingType: 'TED' },
    ];
    expect(breakoutFindingTypeSummary(findings)).toEqual(['PAIN', 'JMD', 'TED']);
  });

  it('undefined → status none', () => {
    expect(breakoutEntrySummary(undefined, walkFlows)).toEqual({
      status: 'none',
      classification: undefined,
      findingTypes: [],
    });
  });

  it('走到一半（有步未完）→ status inProgress', () => {
    const half = applied(freshRecord(), 'DN'); // n1 DN→next n2，未完成
    expect(breakoutEntrySummary(half, walkFlows).status).toBe('inProgress');
  });

  it('走完 → status complete＋classification 推導＋findingTypes 概況', () => {
    const done = applied(applied(freshRecord(), 'DN'), 'DN'); // n2 DN→JMD（端點）
    expect(breakoutEntrySummary(done, walkFlows)).toEqual({
      status: 'complete',
      classification: 'JMD',
      findingTypes: ['JMD'],
    });
  });
});

describe('breakoutStepViews（06-F2e-ii 步驟清單衍生）', () => {
  it('走到一半：已答步＋末附當前待測節點（高亮、無結果碼）', () => {
    const half = applied(freshRecord(), 'DN'); // n1 DN→next n2，n2 未答
    const views = breakoutStepViews(half, walkFlows);
    expect(views).toEqual([
      {
        index: 1,
        flowKey: WALK_KEY,
        nodeKey: 'n1',
        testName: L('節點一'),
        result: 'DN',
        findingTypes: [],
        isCurrent: false,
      },
      {
        index: 2,
        flowKey: WALK_KEY,
        nodeKey: 'n2',
        testName: L('節點二'),
        result: undefined,
        findingTypes: [],
        isCurrent: true,
      },
    ]);
  });

  it('走完：每步帶結果碼與該步衍生 findingType chip，無當前步', () => {
    const done = applied(applied(freshRecord(), 'DN'), 'DN'); // n2 DN→JMD（端點）
    const views = breakoutStepViews(done, walkFlows);
    expect(views).toEqual([
      {
        index: 1,
        flowKey: WALK_KEY,
        nodeKey: 'n1',
        testName: L('節點一'),
        result: 'DN',
        findingTypes: [],
        isCurrent: false,
      },
      {
        index: 2,
        flowKey: WALK_KEY,
        nodeKey: 'n2',
        testName: L('節點二'),
        result: 'DN',
        findingTypes: ['JMD'],
        isCurrent: false,
      },
    ]);
  });

  it('空白紀錄：只含起始節點為當前步', () => {
    const views = breakoutStepViews(freshRecord(), walkFlows);
    expect(views).toEqual([
      {
        index: 1,
        flowKey: WALK_KEY,
        nodeKey: 'n1',
        testName: L('節點一'),
        result: undefined,
        findingTypes: [],
        isCurrent: true,
      },
    ]);
  });
});

describe('自由模式挑選器資料（06-F2g-i）', () => {
  it('breakoutFlowOptions 列出所有流程（flowKey＋名）', () => {
    expect(breakoutFlowOptions(walkFlows)).toEqual([{ flowKey: WALK_KEY, name: L('走查流程') }]);
  });

  it('breakoutNodeOptions 列出指定流程節點（nodeKey＋名）、查無流程回空', () => {
    expect(breakoutNodeOptions(WALK_KEY, walkFlows)).toEqual([
      { nodeKey: 'n1', name: L('節點一') },
      { nodeKey: 'n2', name: L('節點二') },
    ]);
    expect(breakoutNodeOptions('overheadDeepSquatBreakout', walkFlows)).toEqual([]);
  });
});

describe('breakoutCandidateViews（06-F2h 人工擇一候選）', () => {
  const L = (zh: string) => ({ 'zh-TW': zh, en: zh });
  const mcNode: BreakoutNode = {
    nodeKey: 'mc',
    name: L('擇一節點'),
    mode: 'active',
    resultOptions: ['fnBilateral'],
    branches: [
      {
        when: { resultIn: ['fnBilateral'], priorResult: { nodeKey: 'p1', resultIn: ['DN', 'DP'] } },
        outcomes: [
          { kind: 'finding', findingKey: 'f-jmd', findingType: 'JMD', label: L('JMD 結局') },
        ],
      },
      {
        when: { resultIn: ['fnBilateral'], priorResult: { nodeKey: 'p1', resultIn: ['FP'] } },
        outcomes: [
          { kind: 'finding', findingKey: 'f-ted', findingType: 'TED', label: L('TED 結局') },
        ],
      },
    ],
  };
  const mcFlow: SfmaBreakoutFlow = {
    flowKey: 'cervicalFlexionBreakout',
    name: L('頸屈'),
    sourceRef: 'test',
    startNodeKey: 'p1',
    nodes: [
      { nodeKey: 'p1', name: L('被動頸屈'), mode: 'passive', resultOptions: ['DN'], branches: [] },
      mcNode,
    ],
  };
  const mcFlows = createFlowMap([mcFlow]);

  it('每候選帶結局 findingType／結局文字／priorResult 依據（節點名自注入流程解析）', () => {
    const views = breakoutCandidateViews(mcNode, [0, 1], 'cervicalFlexionBreakout', mcFlows);
    expect(views).toHaveLength(2);
    expect(views[0]?.branchIndex).toBe(0);
    expect(views[0]?.findingTypes).toEqual(['JMD']);
    expect(views[0]?.outcomeLabels[0]?.['zh-TW']).toBe('JMD 結局');
    expect(views[0]?.prior?.testName['zh-TW']).toBe('被動頸屈');
    expect(views[0]?.prior?.resultCodes).toEqual(['DN', 'DP']);
    expect(views[1]?.findingTypes).toEqual(['TED']);
    expect(views[1]?.prior?.resultCodes).toEqual(['FP']);
  });

  it('無 priorResult 之候選 prior 為 undefined；goToFlow 結局取流程名', () => {
    const node: BreakoutNode = {
      nodeKey: 'g',
      name: L('G'),
      mode: 'active',
      resultOptions: ['DN'],
      branches: [
        {
          when: { resultIn: ['DN'] },
          outcomes: [{ kind: 'goToFlow', flowKey: 'cervicalRotationBreakout' }],
        },
      ],
    };
    const flow: SfmaBreakoutFlow = {
      flowKey: 'cervicalRotationBreakout',
      name: L('頸旋流程'),
      sourceRef: 'test',
      startNodeKey: 'g',
      nodes: [node],
    };
    const views = breakoutCandidateViews(
      node,
      [0],
      'cervicalRotationBreakout',
      createFlowMap([flow]),
    );
    expect(views[0]?.prior).toBeUndefined();
    expect(views[0]?.findingTypes).toEqual([]);
    expect(views[0]?.outcomeLabels[0]?.['zh-TW']).toBe('頸旋流程');
  });
});
