// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { effectScope, ref } from 'vue';
import type { BreakoutRecord, SfmaBreakoutFlow } from '@ptapp/shared';
import { createFlowMap } from '../../utils/assessment/breakoutFlow/engine';
import { useBreakout, type UseBreakoutResult } from './useBreakout';

const L = (zh: string) => ({ 'zh-TW': zh, en: zh });
const FLOW_KEY = 'cervicalFlexionBreakout';

function emptyRecord(): BreakoutRecord {
  return {
    patternKey: 'cervicalFlexion',
    side: null,
    entryFlowKey: FLOW_KEY,
    steps: [],
    findings: [],
    notes: '',
  };
}

// 走查 fake 流程：n1 DN→next n2（純前進、不出卡）；n2 DN→JMD finding（端點、流程完成）。
const walkFlow: SfmaBreakoutFlow = {
  flowKey: FLOW_KEY,
  name: L('走查'),
  sourceRef: 'test',
  startNodeKey: 'n1',
  nodes: [
    {
      nodeKey: 'n1',
      name: L('一'),
      mode: 'active',
      resultOptions: ['DN'],
      branches: [{ when: { resultIn: ['DN'] }, outcomes: [{ kind: 'next', nodeKey: 'n2' }] }],
    },
    {
      nodeKey: 'n2',
      name: L('二'),
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

// 人工擇一 fake：m1 分支 0 priorResult 指向缺值節點→undecidable→needsManualChoice。
const manualFlow: SfmaBreakoutFlow = {
  flowKey: FLOW_KEY,
  name: L('擇一'),
  sourceRef: 'test',
  startNodeKey: 'm1',
  nodes: [
    {
      nodeKey: 'm1',
      name: L('M1'),
      mode: 'active',
      resultOptions: ['DN'],
      branches: [
        {
          when: { resultIn: ['DN'], priorResult: { nodeKey: 'absent', resultIn: ['FN'] } },
          outcomes: [{ kind: 'finding', findingKey: 'f-a', findingType: 'SMCD', label: L('A') }],
        },
        {
          when: { resultIn: ['DN'] },
          outcomes: [{ kind: 'finding', findingKey: 'f-b', findingType: 'TED', label: L('B') }],
        },
      ],
    },
  ],
};
const manualFlows = createFlowMap([manualFlow]);

// 受控紀錄：onChange 蓋回 record ref，模擬上層 session 持有真實來源（composable 以 toValue 反應）。
function run(
  flows = walkFlows,
): { result: UseBreakoutResult; record: ReturnType<typeof ref<BreakoutRecord>>; stop: () => void } {
  const scope = effectScope();
  const record = ref<BreakoutRecord>(emptyRecord());
  const result = scope.run(() =>
    useBreakout(
      () => record.value!,
      (next) => {
        record.value = next;
      },
      flows,
    ),
  ) as UseBreakoutResult;
  return { result, record, stop: () => scope.stop() };
}

describe('useBreakout（03 §3.3.9 疊層狀態機）', () => {
  it('純前進步驟事件為空 → resultCards 清空；端點才出卡', () => {
    const { result, stop } = run();
    expect(result.node.value?.nodeKey).toBe('n1');
    // n1 DN：純前進 next，不出卡
    result.applyResult('DN');
    expect(result.node.value?.nodeKey).toBe('n2');
    expect(result.resultCards.value).toHaveLength(0);
    expect(result.stepCount.value).toBe(1);
    // n2 DN：端點 finding，出卡＋流程完成
    result.applyResult('DN');
    expect(result.isComplete.value).toBe(true);
    expect(result.resultCards.value.length).toBeGreaterThan(0);
    expect(result.findings.value.map((f) => f.findingType)).toContain('JMD');
    stop();
  });

  it('classification 由 findings 預設推導；setClassification 覆寫並標記 overridden', () => {
    const { result, stop } = run();
    result.applyResult('DN');
    result.applyResult('DN');
    expect(result.classification.value).toBe('JMD');
    expect(result.isClassificationOverridden.value).toBe(false);
    result.setClassification('PAIN');
    expect(result.classification.value).toBe('PAIN');
    expect(result.isClassificationOverridden.value).toBe(true);
    stop();
  });

  it('rewind 作廢其後步驟、清過渡態，並重設當前節點', () => {
    const { result, stop } = run();
    result.applyResult('DN');
    result.applyResult('DN');
    expect(result.isComplete.value).toBe(true);
    // 自第 0 步重走：保留 0 步、作廢其後
    const preview = result.rewindPreview(0);
    expect(preview.invalidatedSteps).toBeGreaterThan(0);
    result.rewind(0);
    expect(result.node.value?.nodeKey).toBe('n1');
    expect(result.resultCards.value).toHaveLength(0);
    expect(result.findings.value).toHaveLength(0);
    stop();
  });

  it('priorResult 缺值致 undecidable → manualChoice 待決；resolveManualChoice 套分支', () => {
    const { result, stop } = run(manualFlows);
    result.applyResult('DN');
    // 未直接套用，進入人工擇一
    expect(result.manualChoice.value).not.toBeUndefined();
    expect(result.manualChoiceCandidates.value.length).toBeGreaterThan(0);
    // 擇分支 1（TED）
    result.resolveManualChoice(1);
    expect(result.manualChoice.value).toBeUndefined();
    expect(result.findings.value.map((f) => f.findingType)).toContain('TED');
    stop();
  });

  it('cancelManualChoice 清待決態', () => {
    const { result, stop } = run(manualFlows);
    result.applyResult('DN');
    expect(result.manualChoice.value).not.toBeUndefined();
    result.cancelManualChoice();
    expect(result.manualChoice.value).toBeUndefined();
    stop();
  });

  it('freeform：挑流程自動帶首節點、套結果記錄一步', () => {
    const { result, stop } = run();
    result.setFreeform(true);
    expect(result.freeform.value).toBe(true);
    result.setPickedFlow(FLOW_KEY);
    expect(result.pickedNodeKey.value).toBe('n1');
    expect(result.freeformNode.value?.nodeKey).toBe('n1');
    result.applyFreeform('DN');
    expect(result.stepCount.value).toBe(1);
    stop();
  });
});
