import { describe, expect, it } from 'vitest';
import { anatomyEntitySchema, jointSchema, muscleSchema } from './anatomy';
import { sfmaBreakoutFlowSchema, sfmaPatternDefinitionSchema } from './sfmaDefinitions';

describe('anatomy schemas（06 §6.5）', () => {
  it('接受肌肉範例', () => {
    const muscle = muscleSchema.parse({
      schemaVersion: 1,
      anatomyId: 'muscle.bicepsBrachii',
      type: 'muscle',
      name: { 'zh-TW': '肱二頭肌', en: 'Biceps Brachii' },
      layer: 'superficial',
      symmetry: 'paired',
      relatedJoints: ['joint.elbow'],
      actions: [{ jointId: 'joint.elbow', action: 'flexion' }],
      innervation: ['nerve.musculocutaneous'],
    });
    expect(muscle.layer).toBe('superficial');
  });

  it('接受關節範例（含 ROM 自由度）', () => {
    const joint = jointSchema.parse({
      schemaVersion: 1,
      anatomyId: 'joint.elbow',
      type: 'joint',
      name: { 'zh-TW': '肘關節', en: 'Elbow Joint' },
      degreesOfFreedom: [{ axis: 'flexionExtension', min: 0, max: 145, neutral: 0, unit: 'deg' }],
    });
    expect(joint.degreesOfFreedom[0].max).toBe(145);
  });

  it('discriminatedUnion 依 type 區分、未知 type 拒絕', () => {
    const nerve = anatomyEntitySchema.parse({
      schemaVersion: 1,
      anatomyId: 'nerve.musculocutaneous',
      type: 'nerve',
      name: { 'zh-TW': '肌皮神經', en: 'Musculocutaneous Nerve' },
    });
    expect(nerve.type).toBe('nerve');
    expect(
      anatomyEntitySchema.safeParse({
        schemaVersion: 1,
        anatomyId: 'organ.heart',
        type: 'organ',
        name: { 'zh-TW': '心臟', en: 'Heart' },
      }).success,
    ).toBe(false);
  });
});

describe('SFMA 定義 schema（06 §6.4）', () => {
  it('接受題項定義範例', () => {
    const pattern = sfmaPatternDefinitionSchema.parse({
      patternKey: 'multiSegmentalFlexion',
      name: { 'zh-TW': '多節段屈曲', en: 'Multi-Segmental Flexion' },
      side: 'single',
      criteria: [
        { code: 'cannotTouchToes', label: { 'zh-TW': '無法觸及腳趾', en: 'Cannot touch toes' } },
      ],
    });
    expect(pattern.criteria).toHaveLength(1);
  });

  it('接受 Breakout 流程定義範例（節錄頸屈第一節點）', () => {
    const flow = sfmaBreakoutFlowSchema.parse({
      flowKey: 'cervicalFlexionBreakout',
      name: { 'zh-TW': '頸屈受限 Breakout', en: 'Limited Cervical Flexion' },
      sourceRef: 'doc/ref/SFMA_form.md §3.1.1',
      startNodeKey: 'activeSupineCervicalFlexion',
      nodes: [
        {
          nodeKey: 'activeSupineCervicalFlexion',
          name: {
            'zh-TW': '主動仰臥頸屈（下巴觸胸）',
            en: 'Active Supine Cervical Flexion (Chin to Chest)',
          },
          mode: 'active',
          criterion: { 'zh-TW': '下巴觸胸', en: 'Chin to chest' },
          resultOptions: ['FN', 'DN', 'DP', 'FP'],
          branches: [
            {
              when: { resultIn: ['FN'] },
              outcomes: [
                {
                  kind: 'finding',
                  findingKey: 'posturalSmcdCervicalFlexion',
                  findingType: 'SMCD',
                  label: {
                    'zh-TW': '姿勢性 SMCD 影響頸屈',
                    en: 'Postural SMCD affecting Cervical Flexion',
                  },
                },
              ],
            },
            {
              when: { resultIn: ['DN', 'DP', 'FP'] },
              outcomes: [{ kind: 'next', nodeKey: 'passiveSupineCervicalFlexion' }],
            },
          ],
        },
      ],
    });
    expect(flow.nodes[0].branches).toHaveLength(2);
  });

  it('outcome 支援 goToFlow／instruction、未知 kind 拒絕', () => {
    const branches = [
      {
        when: { hasFindings: { has: false, findingTypeIn: ['SMCD', 'JMD', 'PAIN'] } },
        outcomes: [
          { kind: 'goToFlow', flowKey: 'ankleBreakout' },
          {
            kind: 'instruction',
            label: { 'zh-TW': '停止並先處理先前 DN', en: 'Stop; treat prior DNs first' },
          },
        ],
      },
    ];
    const flow = sfmaBreakoutFlowSchema.safeParse({
      flowKey: 'vestibularCoreBreakout',
      name: { 'zh-TW': '前庭與核心', en: 'Vestibular & Core' },
      sourceRef: 'doc/ref/SFMA_form.md §3.7.1',
      startNodeKey: 'n1',
      nodes: [
        {
          nodeKey: 'n1',
          name: { 'zh-TW': '節點', en: 'Node' },
          mode: 'active',
          resultOptions: ['FN', 'DN'],
          branches,
        },
      ],
    });
    expect(flow.success).toBe(true);
    const bad = {
      ...branches[0],
      outcomes: [{ kind: 'teleport', nodeKey: 'x' }],
    };
    const invalid = sfmaBreakoutFlowSchema.safeParse({
      flowKey: 'vestibularCoreBreakout',
      name: { 'zh-TW': '前庭與核心', en: 'Vestibular & Core' },
      sourceRef: 'doc/ref/SFMA_form.md §3.7.1',
      startNodeKey: 'n1',
      nodes: [
        {
          nodeKey: 'n1',
          name: { 'zh-TW': '節點', en: 'Node' },
          mode: 'active',
          resultOptions: ['FN', 'DN'],
          branches: [bad],
        },
      ],
    });
    expect(invalid.success).toBe(false);
  });
});
