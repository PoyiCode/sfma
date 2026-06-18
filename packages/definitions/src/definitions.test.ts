import { describe, expect, it } from 'vitest';
import {
  failedCriterionCodeSchema,
  sfmaFlowKeySchema,
  sfmaPatternKeySchema,
  type AnatomyEntity,
  type FailedCriterionCode,
  type SfmaPatternKey,
} from '@ptapp/shared';
import {
  anatomyEntities,
  anatomyEntityById,
  sfmaBreakoutFlowByKey,
  sfmaBreakoutFlows,
  sfmaPatternEntryFlows,
  sfmaPatterns,
} from './index';

// 06 §6.4 代碼表：各動作允許的標準碼（excessiveEffortOrControl 為全動作共通）
const CRITERIA_BY_PATTERN: Record<SfmaPatternKey, FailedCriterionCode[]> = {
  cervicalFlexion: ['cannotTouchSternumToChin', 'excessiveEffortOrControl'],
  cervicalExtension: ['notWithin10DegreesOfParallel', 'excessiveEffortOrControl'],
  cervicalRotation: ['noseNotAlignedMidClavicle', 'excessiveEffortOrControl'],
  upperExtremityPattern1Mre: ['notReachInferiorAngleOfScapula', 'excessiveEffortOrControl'],
  upperExtremityPattern2Lrf: ['notReachSpineOfScapula', 'excessiveEffortOrControl'],
  multiSegmentalFlexion: [
    'cannotTouchToes',
    'sacralAngleUnder70',
    'nonUniformSpinalCurve',
    'lackPosteriorWeightShift',
    'excessiveEffortOrControl',
  ],
  multiSegmentalExtension: [
    'ueNotMaintain170',
    'asisNotClearToes',
    'scapulaSpineNotClearHeels',
    'nonUniformExtensionCurve',
    'excessiveEffortOrControl',
  ],
  multiSegmentalRotation: [
    'pelvisRotationUnder50',
    'shoulderRotationUnder50',
    'spinePelvicDeviation',
    'excessiveKneeFlexion',
    'excessiveEffortOrControl',
  ],
  singleLegStance: [
    'eyesOpenUnder10s',
    'eyesClosedUnder10s',
    'lossOfHeight',
    'excessiveEffortOrControl',
  ],
  overheadDeepSquat: [
    'lossOfUeStartPosition',
    'tibiaTorsoNotParallel',
    'thighsNotBreakParallel',
    'lossOfSagittalAlignment',
    'excessiveEffortOrControl',
  ],
};

const BILATERAL: SfmaPatternKey[] = [
  'cervicalRotation',
  'upperExtremityPattern1Mre',
  'upperExtremityPattern2Lrf',
  'multiSegmentalRotation',
  'singleLegStance',
];

describe('sfmaPatterns（06 §6.4、05 §5.2）', () => {
  it('10 大動作齊全且鍵與列舉一致', () => {
    expect(sfmaPatterns.map((p) => p.patternKey).sort()).toEqual(
      [...sfmaPatternKeySchema.options].sort(),
    );
  });

  it('側別正確（5 單一、5 雙側）', () => {
    for (const pattern of sfmaPatterns) {
      expect(pattern.side).toBe(BILATERAL.includes(pattern.patternKey) ? 'bilateral' : 'single');
    }
  });

  it('各動作標準碼與 06 §6.4 代碼表一一對應', () => {
    for (const pattern of sfmaPatterns) {
      expect(pattern.criteria.map((c) => c.code).sort()).toEqual(
        [...CRITERIA_BY_PATTERN[pattern.patternKey]].sort(),
      );
    }
  });

  it('標籤雙語非空、標準碼皆屬列舉', () => {
    for (const pattern of sfmaPatterns) {
      expect(pattern.name['zh-TW'].length).toBeGreaterThan(0);
      expect(pattern.name.en.length).toBeGreaterThan(0);
      for (const criterion of pattern.criteria) {
        expect(failedCriterionCodeSchema.safeParse(criterion.code).success).toBe(true);
        expect(criterion.label['zh-TW'].length).toBeGreaterThan(0);
        expect(criterion.label.en.length).toBeGreaterThan(0);
      }
    }
  });

  it('入口對應涵蓋全部 10 動作（05 §5.3.1）', () => {
    expect(Object.keys(sfmaPatternEntryFlows).sort()).toEqual(
      [...sfmaPatternKeySchema.options].sort(),
    );
    expect(sfmaPatternEntryFlows.multiSegmentalExtension).toBe('spineExtensionBreakout');
    expect(sfmaPatternEntryFlows.singleLegStance).toBe('vestibularCoreBreakout');
  });
});

describe('sfmaBreakoutFlows（06 §6.4、ref §3）', () => {
  it('16 流程齊全且鍵與列舉一致', () => {
    expect(sfmaBreakoutFlows.map((f) => f.flowKey).sort()).toEqual(
      [...sfmaFlowKeySchema.options].sort(),
    );
    expect(sfmaBreakoutFlowByKey.size).toBe(16);
  });

  it('startNodeKey 與所有 next／priorResult 節點皆存在於同流程、nodeKey 流程內唯一', () => {
    for (const flow of sfmaBreakoutFlows) {
      const nodeKeys = flow.nodes.map((n) => n.nodeKey);
      expect(new Set(nodeKeys).size).toBe(nodeKeys.length);
      expect(nodeKeys).toContain(flow.startNodeKey);
      for (const node of flow.nodes) {
        for (const branch of node.branches) {
          if (branch.when.priorResult !== undefined) {
            expect(nodeKeys).toContain(branch.when.priorResult.nodeKey);
          }
          for (const outcome of branch.outcomes) {
            if (outcome.kind === 'next') expect(nodeKeys).toContain(outcome.nodeKey);
          }
        }
      }
    }
  });

  it('每分支 resultIn 均為節點 resultOptions 子集合；每個 resultOption 至少被一個分支涵蓋', () => {
    for (const flow of sfmaBreakoutFlows) {
      for (const node of flow.nodes) {
        const covered = new Set<string>();
        for (const branch of node.branches) {
          for (const result of branch.when.resultIn ?? []) {
            expect(node.resultOptions).toContain(result);
            covered.add(result);
          }
        }
        expect([...covered].sort()).toEqual([...node.resultOptions].sort());
      }
    }
  });

  it('goToFlow 目標皆存在；同分支 outcomes 內 findingKey 不重複、next 至多一個', () => {
    for (const flow of sfmaBreakoutFlows) {
      for (const node of flow.nodes) {
        for (const branch of node.branches) {
          const findingKeys = branch.outcomes.flatMap((o) =>
            o.kind === 'finding' ? [o.findingKey] : [],
          );
          expect(new Set(findingKeys).size).toBe(findingKeys.length);
          expect(branch.outcomes.filter((o) => o.kind === 'next').length).toBeLessThanOrEqual(1);
          for (const outcome of branch.outcomes) {
            if (outcome.kind === 'goToFlow') {
              expect(sfmaBreakoutFlowByKey.has(outcome.flowKey)).toBe(true);
            }
          }
        }
      }
    }
  });

  it('各流程節點數與 ref §3 對應', () => {
    const expected: Record<string, number> = {
      cervicalFlexionBreakout: 3,
      cervicalRotationBreakout: 3,
      cervicalExtensionBreakout: 1,
      upperExtremityPattern1Breakout: 10,
      upperExtremityPattern2Breakout: 10,
      multiSegmentalFlexionBreakout: 6,
      spineExtensionBreakout: 7,
      lowerBodyExtensionBreakout: 5,
      upperBodyExtensionBreakout: 6,
      multiSegmentalRotationBreakout: 6,
      hipExternalRotationBreakout: 4,
      hipInternalRotationBreakout: 4,
      tibialRotationBreakout: 4,
      vestibularCoreBreakout: 4,
      ankleBreakout: 6,
      overheadDeepSquatBreakout: 5,
    };
    for (const flow of sfmaBreakoutFlows) {
      expect({ [flow.flowKey]: flow.nodes.length }).toEqual({
        [flow.flowKey]: expected[flow.flowKey],
      });
    }
  });

  it('指標端點抽查（ref §3 端點正確性）', () => {
    const cf = sfmaBreakoutFlowByKey.get('cervicalFlexionBreakout');
    const oa = cf?.nodes.find((n) => n.nodeKey === 'activeSupineOaCervicalFlexion');
    expect(oa?.resultOptions).toEqual(['fnBilateral', 'DN', 'DP', 'FP']);

    const ankle = sfmaBreakoutFlowByKey.get('ankleBreakout');
    const inversion = ankle?.nodes.find((n) => n.nodeKey === 'activeSeatedAnkleInversionEversion');
    const proprioceptive = inversion?.branches[0];
    expect(proprioceptive?.when.hasFindings).toEqual({
      has: false,
      findingTypeIn: ['SMCD', 'JMD', 'TED', 'PAIN', 'OTHER'],
    });

    const ods = sfmaBreakoutFlowByKey.get('overheadDeepSquatBreakout');
    const deepSquat = ods?.nodes.find((n) => n.nodeKey === 'deepSquat');
    expect(
      deepSquat?.branches[0]?.outcomes.some(
        (o) => o.kind === 'goToFlow' && o.flowKey === 'spineExtensionBreakout',
      ),
    ).toBe(true);
  });
});

describe('anatomy 種子資料（03 §6.5 解剖實體；placeholder）', () => {
  it('載入非空且全數通過 schema（import 已 parse）', () => {
    expect(anatomyEntities.length).toBeGreaterThan(0);
  });

  it('anatomyId 唯一', () => {
    const ids = anatomyEntities.map((entity) => entity.anatomyId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('anatomyId 前綴與 type 一致', () => {
    for (const entity of anatomyEntities) {
      expect(entity.anatomyId.split('.')[0]).toBe(entity.type);
    }
  });

  it('肌肉參照之關節／神經皆存在於資料集（參照完整性）', () => {
    const jointIds = new Set(
      anatomyEntities.filter((entity) => entity.type === 'joint').map((entity) => entity.anatomyId),
    );
    const nerveIds = new Set(
      anatomyEntities.filter((entity) => entity.type === 'nerve').map((entity) => entity.anatomyId),
    );
    for (const entity of anatomyEntities) {
      if (entity.type !== 'muscle') continue;
      for (const jointId of entity.relatedJoints) expect(jointIds.has(jointId)).toBe(true);
      for (const action of entity.actions) expect(jointIds.has(action.jointId)).toBe(true);
      for (const nerveId of entity.innervation) expect(nerveIds.has(nerveId)).toBe(true);
    }
  });

  it('anatomyEntityById 以 anatomyId 命中', () => {
    const first = anatomyEntities[0]!;
    expect(anatomyEntityById.get(first.anatomyId)).toBe(first);
    expect(anatomyEntityById.get('muscle.doesNotExist')).toBeUndefined();
  });

  it('韌帶實體（膝十字 ACL/PCL＋脊椎前/後縱/黃韌帶）皆定義且型別為 ligament（新增 ligament 實體類型、被動穩定結構；解3d資產 ㊿）', () => {
    const expected: Record<string, AnatomyEntity['type']> = {
      'ligament.anteriorCruciateLigament': 'ligament',
      'ligament.posteriorCruciateLigament': 'ligament',
      'ligament.anteriorLongitudinalLigament': 'ligament',
      'ligament.posteriorLongitudinalLigament': 'ligament',
      'ligament.ligamentaFlava': 'ligament',
    };
    for (const [anatomyId, type] of Object.entries(expected)) {
      expect(anatomyEntityById.get(anatomyId)?.type).toBe(type);
    }
  });

  it('curated 主要韌帶擴張（骨間膜前臂/小腿＋長足底＋股骨頭＋後薦髂＋肋骨頭放射＋指/趾間側副）皆定義且型別為 ligament（既有 ligament 型內容擴張、僅細節版；解3d資產 59）', () => {
    const ligamentIds = [
      'ligament.interosseousMembraneForearm',
      'ligament.interosseousMembraneLeg',
      'ligament.longPlantar',
      'ligament.headOfFemur',
      'ligament.posteriorSacroiliac',
      'ligament.radiateHeadOfRib',
      'ligament.collateralInterphalangealHand',
      'ligament.collateralInterphalangealFoot',
    ];
    expect(ligamentIds).toHaveLength(8);
    for (const id of ligamentIds) {
      expect(anatomyEntityById.get(id)?.type).toBe('ligament');
    }
    // 抽驗 zh-TW 名稱（骨間膜＝高臨床價值、currently 真缺）
    expect(anatomyEntityById.get('ligament.interosseousMembraneForearm')?.name['zh-TW']).toBe(
      '前臂骨間膜',
    );
    expect(anatomyEntityById.get('ligament.interosseousMembraneLeg')?.name['zh-TW']).toBe(
      '小腿骨間膜',
    );
  });

  it('全脊椎椎間盤（C2–C3…L5–S1 共 23 節）皆定義且型別為 disc（新增 disc 實體類型、椎體間纖維軟骨；解3d資產 51）', () => {
    const discIds = [
      'disc.c2C3',
      'disc.c3C4',
      'disc.c4C5',
      'disc.c5C6',
      'disc.c6C7',
      'disc.c7T1',
      'disc.t1T2',
      'disc.t2T3',
      'disc.t3T4',
      'disc.t4T5',
      'disc.t5T6',
      'disc.t6T7',
      'disc.t7T8',
      'disc.t8T9',
      'disc.t9T10',
      'disc.t10T11',
      'disc.t11T12',
      'disc.t12L1',
      'disc.l1L2',
      'disc.l2L3',
      'disc.l3L4',
      'disc.l4L5',
      'disc.l5S1',
    ];
    expect(discIds).toHaveLength(23);
    for (const id of discIds) {
      expect(anatomyEntityById.get(id)?.type).toBe('disc');
    }
  });

  it('關節囊 16 件（4 大肢端＋擴 12 主要滑膜關節：橈腕/肩鎖/胸鎖/顳顎/上脛腓＋掌指/蹠趾/指趾間群）皆定義且型別為 capsule（解3d資產 53＋關節內被動結構擴張）', () => {
    const capsuleIds = [
      'capsule.knee',
      'capsule.elbow',
      'capsule.glenohumeral',
      'capsule.hip',
      'capsule.radiocarpal',
      'capsule.acromioclavicular',
      'capsule.sternoclavicular',
      'capsule.temporomandibular',
      'capsule.superiorTibiofibular',
      'capsule.metacarpophalangeal',
      'capsule.metatarsophalangeal',
      'capsule.proximalInterphalangealHand',
      'capsule.distalInterphalangealHand',
      'capsule.proximalInterphalangealFoot',
      'capsule.distalInterphalangealFoot',
      'capsule.interphalangealGreatToe',
    ];
    expect(capsuleIds).toHaveLength(16);
    for (const id of capsuleIds) {
      expect(anatomyEntityById.get(id)?.type).toBe('capsule');
    }
  });

  it('關節盤（articularDisc）3 件：顳顎關節盤＋膝內/外側半月板（半月板＝articular disc 之一種、循 54 註擴入；關節內被動結構擴張）', () => {
    const articularDiscIds = [
      'articularDisc.temporomandibular',
      'articularDisc.lateralMeniscus',
      'articularDisc.medialMeniscus',
    ];
    expect(articularDiscIds).toHaveLength(3);
    for (const id of articularDiscIds) {
      expect(anatomyEntityById.get(id)?.type).toBe('articularDisc');
    }
  });

  it('關節唇（labrum）2 件：髖臼唇＋肩盂唇（新增 labrum 實體類型、滑膜關節窩緣纖維軟骨、與 articularDisc 區辨；關節內被動結構擴張）', () => {
    const labrumIds = ['labrum.acetabular', 'labrum.glenoid'];
    expect(labrumIds).toHaveLength(2);
    for (const id of labrumIds) {
      expect(anatomyEntityById.get(id)?.type).toBe('labrum');
    }
  });

  it('6 條 MSK 周邊皮/感覺神經（隱/腓腸/股外側皮/股後皮/橈淺/髂腹股溝＝entrapment·感覺評估）皆定義且型別為 nerve（關節內被動結構擴張之神經界定集）', () => {
    const nerveIds = [
      'nerve.saphenous',
      'nerve.sural',
      'nerve.lateralFemoralCutaneous',
      'nerve.posteriorFemoralCutaneous',
      'nerve.superficialRadial',
      'nerve.ilioinguinal',
    ];
    for (const id of nerveIds) {
      expect(anatomyEntityById.get(id)?.type).toBe('nerve');
    }
  });

  it('curated 臨床滑囊（8 件含肩峰下/大轉子/髕前/鵝足/半膜肌…）皆定義且型別為 bursa（新增 bursa 實體類型、滑囊炎部位；trim 至 8 守 detailed 預算；解3d資產 60）', () => {
    const bursaIds = [
      'bursa.subacromial',
      'bursa.trochantericGluteusMedius',
      'bursa.subcutaneousTrochanteric',
      'bursa.subcutaneousPrepatellar',
      'bursa.deepInfrapatellar',
      'bursa.subtendinousTricepsBrachii',
      'bursa.anserine',
      'bursa.semimembranosus',
    ];
    expect(bursaIds).toHaveLength(8);
    for (const id of bursaIds) {
      expect(anatomyEntityById.get(id)?.type).toBe('bursa');
    }
    // 抽驗 zh-TW 名稱（肩峰下＝肩夾擠最常見、鵝足＝內側膝）
    expect(anatomyEntityById.get('bursa.subacromial')?.name['zh-TW']).toBe('肩峰下滑囊');
    expect(anatomyEntityById.get('bursa.anserine')?.name['zh-TW']).toBe('鵝足滑囊');
  });

  it('curated 主要筋膜（14 件含帽狀腱膜/胸腰筋膜/闊筋膜/足底腱膜…）皆定義且型別為 fascia（新增 fascia 實體類型、包覆肌肉之纖維結締組織鞘膜含腱膜；解3d資產 58）', () => {
    const fasciaIds = [
      'fascia.epicranialAponeurosis',
      'fascia.thoracolumbar',
      'fascia.lata',
      'fascia.crural',
      'fascia.antebrachial',
      'fascia.brachial',
      'fascia.plantarAponeurosis',
      'fascia.palmarAponeurosis',
      'fascia.transversalis',
      'fascia.investingAbdominal',
      'fascia.pectoral',
      'fascia.clavipectoral',
      'fascia.cervical',
      'fascia.iliopsoas',
    ];
    expect(fasciaIds).toHaveLength(14);
    for (const id of fasciaIds) {
      expect(anatomyEntityById.get(id)?.type).toBe('fascia');
    }
    // 抽驗 zh-TW 名稱（帽狀腱膜＝回應 57 頭皮頂部覆蓋；胸腰筋膜＝下背 PT 高價值）
    expect(anatomyEntityById.get('fascia.epicranialAponeurosis')?.name['zh-TW']).toBe('帽狀腱膜');
    expect(anatomyEntityById.get('fascia.thoracolumbar')?.name['zh-TW']).toBe('胸腰筋膜');
  });

  it('細節版/精簡版雙 profile 收斂：muscleGroup 合併群組已自種子移除（保留 type、無 instance；§4.3.5/§4.3.6）', () => {
    // 雙 profile 收斂為單一資產 profile 後，精簡版肌群合併之選取單位（muscleGroup）已退役。
    // muscleGroup 型別仍保留於 schema（供未來重新分版），但種子不含任何 instance。
    expect(anatomyEntities.filter((e) => e.type === 'muscleGroup')).toHaveLength(0);
  });

  it('深層小肌補齊（5 件：interspinales/intertransversarii/pyramidalis/transversusThoracis/adductorMinimus）皆定義、型 muscle、層正確（57 暫緩肌、61/62 騰空間後 enrich content；解3d資產 63）', () => {
    const muscles: ReadonlyArray<readonly [string, 'superficial' | 'deep']> = [
      ['muscle.interspinales', 'deep'],
      ['muscle.intertransversarii', 'deep'],
      ['muscle.pyramidalis', 'superficial'],
      ['muscle.transversusThoracis', 'deep'],
      ['muscle.adductorMinimus', 'deep'],
    ];
    for (const [id, layer] of muscles) {
      const entity = anatomyEntityById.get(id);
      expect(entity?.type).toBe('muscle');
      if (entity?.type === 'muscle') expect(entity.layer).toBe(layer);
    }
    expect(anatomyEntityById.get('muscle.interspinales')?.name['zh-TW']).toBe('棘間肌');
    expect(anatomyEntityById.get('muscle.adductorMinimus')?.name['zh-TW']).toBe('內收最小肌');
  });

  it('細節版/精簡版雙 profile 收斂：骨骼區域群／神經叢合併單位已自種子移除（解3d資產 62）', () => {
    // 精簡版合併用之骨區域（bone.upperLimb…）與神經叢（nerve.brachialPlexus…）已退役；
    // 個別骨／神經實體不受影響（仍逐件定義）。
    for (const id of [
      'bone.upperLimb',
      'bone.lowerLimb',
      'bone.thoracicCage',
      'bone.vertebralColumn',
      'bone.skull',
      'nerve.brachialPlexus',
      'nerve.lumbarPlexus',
      'nerve.sacralPlexus',
    ]) {
      expect(anatomyEntityById.has(id)).toBe(false);
    }
  });

  it('上肢主要神經三幹（radial／ulnar／musculocutaneous）皆於資料集定義（供 3D 神經層渲染）', () => {
    for (const nerveId of ['nerve.radial', 'nerve.ulnar', 'nerve.musculocutaneous']) {
      const entity = anatomyEntityById.get(nerveId);
      expect(entity?.type).toBe('nerve');
    }
  });

  it('前臂/腕部主要動作肌、橈尺/腕關節與正中神經皆定義（屈伸腕肌群擴張）', () => {
    const expected: Record<string, AnatomyEntity['type']> = {
      'muscle.flexorCarpiRadialis': 'muscle',
      'muscle.flexorCarpiUlnaris': 'muscle',
      'muscle.extensorCarpiRadialisLongus': 'muscle',
      'muscle.extensorCarpiUlnaris': 'muscle',
      'muscle.pronatorTeres': 'muscle',
      'muscle.supinator': 'muscle',
      'joint.wrist': 'joint',
      'joint.radioulnar': 'joint',
      'nerve.median': 'nerve',
    };
    for (const [anatomyId, type] of Object.entries(expected)) {
      expect(anatomyEntityById.get(anatomyId)?.type).toBe(type);
    }
  });

  it('肩部旋轉肌群、三角肌、盂肱關節、肩胛帶骨與相關神經皆定義（肩部擴張）', () => {
    const expected: Record<string, AnatomyEntity['type']> = {
      'muscle.deltoid': 'muscle',
      'muscle.supraspinatus': 'muscle',
      'muscle.infraspinatus': 'muscle',
      'muscle.teresMinor': 'muscle',
      'muscle.subscapularis': 'muscle',
      'muscle.teresMajor': 'muscle',
      'joint.glenohumeral': 'joint',
      'bone.scapula': 'bone',
      'bone.clavicle': 'bone',
      'nerve.axillary': 'nerve',
      'nerve.suprascapular': 'nerve',
      'nerve.subscapular': 'nerve',
    };
    for (const [anatomyId, type] of Object.entries(expected)) {
      expect(anatomyEntityById.get(anatomyId)?.type).toBe(type);
    }
  });

  it('手指/拇指外在動作肌與手指/拇指關節皆定義（grip 擴張）', () => {
    const expected: Record<string, AnatomyEntity['type']> = {
      'muscle.flexorDigitorumSuperficialis': 'muscle',
      'muscle.flexorDigitorumProfundus': 'muscle',
      'muscle.flexorPollicisLongus': 'muscle',
      'muscle.extensorDigitorum': 'muscle',
      'muscle.extensorPollicisLongus': 'muscle',
      'muscle.abductorPollicisLongus': 'muscle',
      'joint.fingers': 'joint',
      'joint.thumb': 'joint',
    };
    for (const [anatomyId, type] of Object.entries(expected)) {
      expect(anatomyEntityById.get(anatomyId)?.type).toBe(type);
    }
  });

  it('手內在肌大魚際（拇指）肌群皆定義且分層/神經正確（pinch 擴張）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    const thenar = [
      'muscle.abductorPollicisBrevis',
      'muscle.flexorPollicisBrevis',
      'muscle.opponensPollicis',
      'muscle.adductorPollicis',
    ];
    // 皆作用於拇指關節
    for (const id of thenar) {
      expect(muscleById(id).relatedJoints).toContain('joint.thumb');
    }
    // 大魚際表淺（APB／FPB）與深層（OP／AdP）分層
    expect(muscleById('muscle.abductorPollicisBrevis').layer).toBe('superficial');
    expect(muscleById('muscle.flexorPollicisBrevis').layer).toBe('superficial');
    expect(muscleById('muscle.opponensPollicis').layer).toBe('deep');
    expect(muscleById('muscle.adductorPollicis').layer).toBe('deep');
    // 拇內收肌＝尺神經深支；拇短屈肌雙重支配（正中＋尺）
    expect(muscleById('muscle.adductorPollicis').innervation).toEqual(['nerve.ulnar']);
    expect(muscleById('muscle.flexorPollicisBrevis').innervation).toEqual([
      'nerve.median',
      'nerve.ulnar',
    ]);
  });

  it('手內在肌小魚際（小指）肌群皆定義且分層/神經/動作正確（hypothenar 擴張）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    const hypothenar = [
      'muscle.abductorDigitiMinimiManus',
      'muscle.flexorDigitiMinimiManus',
      'muscle.opponensDigitiMinimiManus',
    ];
    // 皆作用於手指關節、皆尺神經（深支）支配
    for (const id of hypothenar) {
      expect(muscleById(id).relatedJoints).toContain('joint.fingers');
      expect(muscleById(id).innervation).toEqual(['nerve.ulnar']);
    }
    // 小魚際表淺（外展／短屈）與深層（對掌）分層
    expect(muscleById('muscle.abductorDigitiMinimiManus').layer).toBe('superficial');
    expect(muscleById('muscle.flexorDigitiMinimiManus').layer).toBe('superficial');
    expect(muscleById('muscle.opponensDigitiMinimiManus').layer).toBe('deep');
    // 動作：外展／屈曲／對掌
    expect(muscleById('muscle.abductorDigitiMinimiManus').actions).toEqual([
      { jointId: 'joint.fingers', action: 'abduction' },
    ]);
    expect(muscleById('muscle.opponensDigitiMinimiManus').actions).toEqual([
      { jointId: 'joint.fingers', action: 'opposition' },
    ]);
  });

  it('手內在肌骨間肌/蚓狀肌皆定義且分層/神經/動作正確（手內在肌全集）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    const deepIntrinsics = [
      'muscle.dorsalInterosseiManus',
      'muscle.palmarInterossei',
      'muscle.lumbricalsManus',
    ];
    // 皆作用於手指關節、皆最深層
    for (const id of deepIntrinsics) {
      expect(muscleById(id).relatedJoints).toContain('joint.fingers');
      expect(muscleById(id).layer).toBe('deep');
    }
    // DAB（背側外展、尺）／PAD（掌側內收、尺）／蚓狀（屈、正中＋尺雙重）
    expect(muscleById('muscle.dorsalInterosseiManus').innervation).toEqual(['nerve.ulnar']);
    expect(muscleById('muscle.palmarInterossei').innervation).toEqual(['nerve.ulnar']);
    expect(muscleById('muscle.lumbricalsManus').innervation).toEqual([
      'nerve.median',
      'nerve.ulnar',
    ]);
    expect(muscleById('muscle.dorsalInterosseiManus').actions).toEqual([
      { jointId: 'joint.fingers', action: 'abduction' },
    ]);
    expect(muscleById('muscle.palmarInterossei').actions).toEqual([
      { jointId: 'joint.fingers', action: 'adduction' },
    ]);
    expect(muscleById('muscle.lumbricalsManus').actions).toEqual([
      { jointId: 'joint.fingers', action: 'flexion' },
    ]);
    // joint.fingers 補外展/內收軸（令骨間肌外展/內收 action 語意成立）
    const fingers = anatomyEntityById.get('joint.fingers');
    if (fingers?.type !== 'joint') throw new Error('joint.fingers 未定義或非關節');
    expect(fingers.degreesOfFreedom.map((d) => d.axis)).toContain('abductionAdduction');
  });

  it('下肢膝部基礎骨/膝關節/股與坐骨神經/股四頭肌與膕旁肌皆定義且分層/神經/動作正確（下肢 kickoff）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 基礎骨／關節／神經皆定義
    const structural: Record<string, AnatomyEntity['type']> = {
      'bone.femur': 'bone',
      'bone.tibia': 'bone',
      'bone.fibula': 'bone',
      'bone.patella': 'bone',
      'joint.knee': 'joint',
      'nerve.femoral': 'nerve',
      'nerve.sciatic': 'nerve',
    };
    for (const [anatomyId, type] of Object.entries(structural)) {
      expect(anatomyEntityById.get(anatomyId)?.type).toBe(type);
    }
    // 股四頭肌＝股神經、膝伸；股中間肌為深層、餘三淺層
    const quadriceps = [
      'muscle.rectusFemoris',
      'muscle.vastusLateralis',
      'muscle.vastusMedialis',
      'muscle.vastusIntermedius',
    ];
    for (const id of quadriceps) {
      expect(muscleById(id).innervation).toEqual(['nerve.femoral']);
      expect(muscleById(id).actions).toContainEqual({ jointId: 'joint.knee', action: 'extension' });
    }
    // 三股肌為單關節膝伸肌（不涉髖）；股直肌為雙關節（髖動作見髖部測試）
    for (const id of [
      'muscle.vastusLateralis',
      'muscle.vastusMedialis',
      'muscle.vastusIntermedius',
    ]) {
      expect(muscleById(id).actions).toEqual([{ jointId: 'joint.knee', action: 'extension' }]);
    }
    expect(muscleById('muscle.vastusIntermedius').layer).toBe('deep');
    expect(muscleById('muscle.rectusFemoris').layer).toBe('superficial');
    // 膕旁肌＝坐骨神經、膝屈；半膜肌深層、半腱/股二頭淺層
    const hamstrings = ['muscle.bicepsFemoris', 'muscle.semitendinosus', 'muscle.semimembranosus'];
    for (const id of hamstrings) {
      expect(muscleById(id).innervation).toEqual(['nerve.sciatic']);
      // 膕旁肌為雙關節（膝屈＋伸髖，髖動作見髖部測試）
      expect(muscleById(id).actions).toContainEqual({ jointId: 'joint.knee', action: 'flexion' });
      expect(muscleById(id).relatedJoints).toContain('joint.knee');
    }
    expect(muscleById('muscle.semimembranosus').layer).toBe('deep');
    expect(muscleById('muscle.bicepsFemoris').layer).toBe('superficial');
    // 膝關節 DOF flexionExtension
    const knee = anatomyEntityById.get('joint.knee');
    if (knee?.type !== 'joint') throw new Error('joint.knee 未定義或非關節');
    expect(knee.degreesOfFreedom.map((d) => d.axis)).toContain('flexionExtension');
  });

  it('下肢髖部髖骨/髖關節/臀與股神經/臀肌群與髂腰肌皆定義且分層/神經/動作正確＋雙關節肌髖動作補記（髖部擴張）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 髖骨／髖關節／臀上下神經皆定義
    const structural: Record<string, AnatomyEntity['type']> = {
      'bone.hip': 'bone',
      'joint.hip': 'joint',
      'nerve.superiorGluteal': 'nerve',
      'nerve.inferiorGluteal': 'nerve',
    };
    for (const [anatomyId, type] of Object.entries(structural)) {
      expect(anatomyEntityById.get(anatomyId)?.type).toBe(type);
    }
    // 臀大肌＝臀下神經、伸髖、淺層
    expect(muscleById('muscle.gluteusMaximus').innervation).toEqual(['nerve.inferiorGluteal']);
    expect(muscleById('muscle.gluteusMaximus').actions).toEqual([
      { jointId: 'joint.hip', action: 'extension' },
    ]);
    expect(muscleById('muscle.gluteusMaximus').layer).toBe('superficial');
    // 臀中/小肌＋闊筋膜張肌＝臀上神經、外展髖
    const abductors = [
      'muscle.gluteusMedius',
      'muscle.gluteusMinimus',
      'muscle.tensorFasciaeLatae',
    ];
    for (const id of abductors) {
      expect(muscleById(id).innervation).toEqual(['nerve.superiorGluteal']);
      expect(muscleById(id).actions).toContainEqual({ jointId: 'joint.hip', action: 'abduction' });
      expect(muscleById(id).relatedJoints).toContain('joint.hip');
    }
    expect(muscleById('muscle.gluteusMedius').layer).toBe('deep');
    expect(muscleById('muscle.tensorFasciaeLatae').layer).toBe('superficial');
    // 髂腰肌＝股神經、屈髖、深層
    expect(muscleById('muscle.iliopsoas').innervation).toEqual(['nerve.femoral']);
    expect(muscleById('muscle.iliopsoas').actions).toEqual([
      { jointId: 'joint.hip', action: 'flexion' },
    ]);
    expect(muscleById('muscle.iliopsoas').layer).toBe('deep');
    // 雙關節大腿肌之髖動作回溯補記：股直肌屈髖、膕旁肌伸髖
    expect(muscleById('muscle.rectusFemoris').actions).toContainEqual({
      jointId: 'joint.hip',
      action: 'flexion',
    });
    expect(muscleById('muscle.rectusFemoris').relatedJoints).toContain('joint.hip');
    for (const id of ['muscle.bicepsFemoris', 'muscle.semitendinosus', 'muscle.semimembranosus']) {
      expect(muscleById(id).actions).toContainEqual({ jointId: 'joint.hip', action: 'extension' });
      expect(muscleById(id).relatedJoints).toContain('joint.hip');
    }
    // 髖關節三軸 DOF
    const hip = anatomyEntityById.get('joint.hip');
    if (hip?.type !== 'joint') throw new Error('joint.hip 未定義或非關節');
    expect(hip.degreesOfFreedom.map((d) => d.axis)).toEqual([
      'flexionExtension',
      'abductionAdduction',
      'internalExternalRotation',
    ]);
  });

  it('下肢內收肌群（內側大腿腔室）與閉孔神經皆定義且分層/神經/動作正確（內收肌群擴張）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 閉孔神經定義
    expect(anatomyEntityById.get('nerve.obturator')?.type).toBe('nerve');
    // 五內收肌皆作用於髖、皆有內收動作
    const adductors = [
      'muscle.adductorLongus',
      'muscle.adductorBrevis',
      'muscle.adductorMagnus',
      'muscle.gracilis',
      'muscle.pectineus',
    ];
    for (const id of adductors) {
      expect(muscleById(id).relatedJoints).toContain('joint.hip');
      expect(muscleById(id).actions).toContainEqual({ jointId: 'joint.hip', action: 'adduction' });
    }
    // 純內收肌（長/短/大）＝閉孔神經（大肌另含坐骨）；分層
    expect(muscleById('muscle.adductorLongus').innervation).toEqual(['nerve.obturator']);
    expect(muscleById('muscle.adductorBrevis').innervation).toEqual(['nerve.obturator']);
    expect(muscleById('muscle.adductorLongus').layer).toBe('superficial');
    expect(muscleById('muscle.adductorBrevis').layer).toBe('deep');
    expect(muscleById('muscle.adductorMagnus').layer).toBe('deep');
    // 內收大肌雙重支配（閉孔＋坐骨）＋伸髖（第四膕旁肌）
    expect(muscleById('muscle.adductorMagnus').innervation).toEqual([
      'nerve.obturator',
      'nerve.sciatic',
    ]);
    expect(muscleById('muscle.adductorMagnus').actions).toContainEqual({
      jointId: 'joint.hip',
      action: 'extension',
    });
    // 股薄肌雙關節（內收髖＋屈膝）、閉孔神經、淺層
    expect(muscleById('muscle.gracilis').innervation).toEqual(['nerve.obturator']);
    expect(muscleById('muscle.gracilis').relatedJoints).toContain('joint.knee');
    expect(muscleById('muscle.gracilis').actions).toContainEqual({
      jointId: 'joint.knee',
      action: 'flexion',
    });
    expect(muscleById('muscle.gracilis').layer).toBe('superficial');
    // 恥骨肌＝股神經、亦屈髖、淺層
    expect(muscleById('muscle.pectineus').innervation).toEqual(['nerve.femoral']);
    expect(muscleById('muscle.pectineus').actions).toContainEqual({
      jointId: 'joint.hip',
      action: 'flexion',
    });
    expect(muscleById('muscle.pectineus').layer).toBe('superficial');
  });

  it('下肢小腿/踝部踝關節/腓神經支/小腿主要動作肌皆定義且分層/神經/動作正確（小腿/踝部擴張）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 踝關節／腓深淺神經皆定義
    const structural: Record<string, AnatomyEntity['type']> = {
      'joint.ankle': 'joint',
      'nerve.tibial': 'nerve',
      'nerve.deepFibular': 'nerve',
      'nerve.superficialFibular': 'nerve',
    };
    for (const [anatomyId, type] of Object.entries(structural)) {
      expect(anatomyEntityById.get(anatomyId)?.type).toBe(type);
    }
    // 五肌皆作用於踝
    const legMuscles = [
      'muscle.gastrocnemius',
      'muscle.soleus',
      'muscle.tibialisAnterior',
      'muscle.fibularisLongus',
      'muscle.fibularisBrevis',
    ];
    for (const id of legMuscles) {
      expect(muscleById(id).relatedJoints).toContain('joint.ankle');
    }
    // 小腿三頭（腓腸/比目魚）＝脛神經、蹠屈；腓腸淺/比目魚深
    for (const id of ['muscle.gastrocnemius', 'muscle.soleus']) {
      expect(muscleById(id).innervation).toEqual(['nerve.tibial']);
      expect(muscleById(id).actions).toContainEqual({
        jointId: 'joint.ankle',
        action: 'plantarflexion',
      });
    }
    expect(muscleById('muscle.gastrocnemius').layer).toBe('superficial');
    expect(muscleById('muscle.soleus').layer).toBe('deep');
    // 腓腸肌雙關節（蹠屈踝＋屈膝）
    expect(muscleById('muscle.gastrocnemius').relatedJoints).toContain('joint.knee');
    expect(muscleById('muscle.gastrocnemius').actions).toContainEqual({
      jointId: 'joint.knee',
      action: 'flexion',
    });
    // 脛前肌＝腓深神經、背屈＋內翻、淺層
    expect(muscleById('muscle.tibialisAnterior').innervation).toEqual(['nerve.deepFibular']);
    expect(muscleById('muscle.tibialisAnterior').actions).toContainEqual({
      jointId: 'joint.ankle',
      action: 'dorsiflexion',
    });
    expect(muscleById('muscle.tibialisAnterior').layer).toBe('superficial');
    // 腓骨長/短肌＝腓淺神經、外翻；長淺/短深
    for (const id of ['muscle.fibularisLongus', 'muscle.fibularisBrevis']) {
      expect(muscleById(id).innervation).toEqual(['nerve.superficialFibular']);
      expect(muscleById(id).actions).toContainEqual({
        jointId: 'joint.ankle',
        action: 'eversion',
      });
    }
    expect(muscleById('muscle.fibularisLongus').layer).toBe('superficial');
    expect(muscleById('muscle.fibularisBrevis').layer).toBe('deep');
    // 踝關節雙軸 DOF（蹠/背屈＋內/外翻）
    const ankle = anatomyEntityById.get('joint.ankle');
    if (ankle?.type !== 'joint') throw new Error('joint.ankle 未定義或非關節');
    expect(ankle.degreesOfFreedom.map((d) => d.axis)).toEqual([
      'plantarDorsiflexion',
      'inversionEversion',
    ]);
  });

  it('下肢足部外在肌（深後屈趾/前伸趾肌群）與足趾關節皆定義且分層/神經/動作正確（足部外在肌擴張）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 足趾關節定義
    expect(anatomyEntityById.get('joint.toes')?.type).toBe('joint');
    // 深後腔室（脛後/屈趾長/屈拇長）＝脛神經、皆深層
    const deepPosterior = [
      'muscle.tibialisPosterior',
      'muscle.flexorDigitorumLongus',
      'muscle.flexorHallucisLongus',
    ];
    for (const id of deepPosterior) {
      expect(muscleById(id).innervation).toEqual(['nerve.tibial']);
      expect(muscleById(id).layer).toBe('deep');
    }
    // 脛後肌＝足內翻（作用踝、非趾）
    expect(muscleById('muscle.tibialisPosterior').relatedJoints).toContain('joint.ankle');
    expect(muscleById('muscle.tibialisPosterior').actions).toContainEqual({
      jointId: 'joint.ankle',
      action: 'inversion',
    });
    // 屈趾/屈拇長肌＝屈趾（作用 joint.toes）
    for (const id of ['muscle.flexorDigitorumLongus', 'muscle.flexorHallucisLongus']) {
      expect(muscleById(id).relatedJoints).toContain('joint.toes');
      expect(muscleById(id).actions).toContainEqual({ jointId: 'joint.toes', action: 'flexion' });
    }
    // 前腔室伸趾肌（伸趾長/伸拇長）＝腓深神經、伸趾
    for (const id of ['muscle.extensorDigitorumLongus', 'muscle.extensorHallucisLongus']) {
      expect(muscleById(id).innervation).toEqual(['nerve.deepFibular']);
      expect(muscleById(id).relatedJoints).toContain('joint.toes');
      expect(muscleById(id).actions).toContainEqual({ jointId: 'joint.toes', action: 'extension' });
    }
    // 伸趾長肌另背屈踝、淺層；伸拇長肌深層
    expect(muscleById('muscle.extensorDigitorumLongus').actions).toContainEqual({
      jointId: 'joint.ankle',
      action: 'dorsiflexion',
    });
    expect(muscleById('muscle.extensorDigitorumLongus').layer).toBe('superficial');
    expect(muscleById('muscle.extensorHallucisLongus').layer).toBe('deep');
    // 足趾關節 DOF flexionExtension
    const toes = anatomyEntityById.get('joint.toes');
    if (toes?.type !== 'joint') throw new Error('joint.toes 未定義或非關節');
    expect(toes.degreesOfFreedom.map((d) => d.axis)).toContain('flexionExtension');
  });

  it('下肢足部內在肌淺層（足底第一層＋足背伸趾短肌群）皆定義且分層/神經/動作正確（足內在肌淺層擴張）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 足底神經（內側/外側）皆定義、為 nerve 型（metadata-only、脛神經分支）
    expect(anatomyEntityById.get('nerve.medialPlantar')?.type).toBe('nerve');
    expect(anatomyEntityById.get('nerve.lateralPlantar')?.type).toBe('nerve');
    // 本切片五肌皆 superficial
    const intrinsicSuperficial = [
      'muscle.abductorHallucis',
      'muscle.flexorDigitorumBrevis',
      'muscle.abductorDigitiMinimiPedis',
      'muscle.extensorDigitorumBrevis',
      'muscle.extensorHallucisBrevis',
    ];
    for (const id of intrinsicSuperficial) {
      expect(muscleById(id).layer).toBe('superficial');
      expect(muscleById(id).relatedJoints).toContain('joint.toes');
    }
    // 足底第一層內側（外展拇/屈趾短）＝內側足底神經
    for (const id of ['muscle.abductorHallucis', 'muscle.flexorDigitorumBrevis']) {
      expect(muscleById(id).innervation).toEqual(['nerve.medialPlantar']);
    }
    // 外展小趾肌＝外側足底神經
    expect(muscleById('muscle.abductorDigitiMinimiPedis').innervation).toEqual([
      'nerve.lateralPlantar',
    ]);
    // 外展肌（外展拇/外展小趾）＝足趾外展
    for (const id of ['muscle.abductorHallucis', 'muscle.abductorDigitiMinimiPedis']) {
      expect(muscleById(id).actions).toContainEqual({ jointId: 'joint.toes', action: 'abduction' });
    }
    // 屈趾短肌＝屈趾
    expect(muscleById('muscle.flexorDigitorumBrevis').actions).toContainEqual({
      jointId: 'joint.toes',
      action: 'flexion',
    });
    // 足背伸趾短肌群（伸趾短/伸拇短）＝腓深神經、伸趾
    for (const id of ['muscle.extensorDigitorumBrevis', 'muscle.extensorHallucisBrevis']) {
      expect(muscleById(id).innervation).toEqual(['nerve.deepFibular']);
      expect(muscleById(id).actions).toContainEqual({ jointId: 'joint.toes', action: 'extension' });
    }
    // joint.toes 補 abductionAdduction 軸（令外展 action 語意成立）
    const toes = anatomyEntityById.get('joint.toes');
    if (toes?.type !== 'joint') throw new Error('joint.toes 未定義或非關節');
    expect(toes.degreesOfFreedom.map((d) => d.axis)).toContain('abductionAdduction');
  });

  it('下肢足部內在肌深層（蹠層 2–4＋骨間肌）皆定義且分層/神經/動作正確（足內在肌全集完成）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 本切片七肌皆 deep、皆作用 joint.toes
    const intrinsicDeep = [
      'muscle.quadratusPlantae',
      'muscle.lumbricalsPedis',
      'muscle.flexorHallucisBrevis',
      'muscle.adductorHallucis',
      'muscle.flexorDigitiMinimiPedis',
      'muscle.plantarInterossei',
      'muscle.dorsalInterosseiPedis',
    ];
    for (const id of intrinsicDeep) {
      expect(muscleById(id).layer).toBe('deep');
      expect(muscleById(id).relatedJoints).toContain('joint.toes');
    }
    // 屈肌群（蹠方/蚓狀/屈拇短/屈小趾短）＝足趾屈
    for (const id of [
      'muscle.quadratusPlantae',
      'muscle.lumbricalsPedis',
      'muscle.flexorHallucisBrevis',
      'muscle.flexorDigitiMinimiPedis',
    ]) {
      expect(muscleById(id).actions).toContainEqual({ jointId: 'joint.toes', action: 'flexion' });
    }
    // 內收拇＋蹠側骨間＝內收；足背骨間＝外展
    for (const id of ['muscle.adductorHallucis', 'muscle.plantarInterossei']) {
      expect(muscleById(id).actions).toContainEqual({ jointId: 'joint.toes', action: 'adduction' });
    }
    expect(muscleById('muscle.dorsalInterosseiPedis').actions).toContainEqual({
      jointId: 'joint.toes',
      action: 'abduction',
    });
    // 屈拇短＝內側足底神經；蚓狀＝內+外側足底神經雙重；餘＝外側足底神經
    expect(muscleById('muscle.flexorHallucisBrevis').innervation).toEqual(['nerve.medialPlantar']);
    expect(muscleById('muscle.lumbricalsPedis').innervation).toEqual([
      'nerve.medialPlantar',
      'nerve.lateralPlantar',
    ]);
    for (const id of [
      'muscle.quadratusPlantae',
      'muscle.adductorHallucis',
      'muscle.flexorDigitiMinimiPedis',
      'muscle.plantarInterossei',
      'muscle.dorsalInterosseiPedis',
    ]) {
      expect(muscleById(id).innervation).toEqual(['nerve.lateralPlantar']);
    }
  });

  it('下肢臀深層旋轉肌群（深六外旋肌）皆定義且分層/神經/動作正確（髖外旋短肌群擴張）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 三支運動神經皆定義、為 nerve 型（metadata-only）
    for (const nv of [
      'nerve.nerveToPiriformis',
      'nerve.nerveToObturatorInternus',
      'nerve.nerveToQuadratusFemoris',
    ]) {
      expect(anatomyEntityById.get(nv)?.type).toBe('nerve');
    }
    // 深六皆 deep、皆作用 joint.hip externalRotation
    const deepSix = [
      'muscle.piriformis',
      'muscle.obturatorInternus',
      'muscle.superiorGemellus',
      'muscle.inferiorGemellus',
      'muscle.quadratusFemoris',
      'muscle.obturatorExternus',
    ];
    for (const id of deepSix) {
      expect(muscleById(id).layer).toBe('deep');
      expect(muscleById(id).relatedJoints).toContain('joint.hip');
      expect(muscleById(id).actions).toContainEqual({
        jointId: 'joint.hip',
        action: 'externalRotation',
      });
    }
    // 神經分配：梨狀肌神經→梨狀肌；閉孔內肌神經→閉孔內肌＋上孖肌；
    // 股方肌神經→股方肌＋下孖肌；閉孔神經（既有）→閉孔外肌
    expect(muscleById('muscle.piriformis').innervation).toEqual(['nerve.nerveToPiriformis']);
    for (const id of ['muscle.obturatorInternus', 'muscle.superiorGemellus']) {
      expect(muscleById(id).innervation).toEqual(['nerve.nerveToObturatorInternus']);
    }
    for (const id of ['muscle.quadratusFemoris', 'muscle.inferiorGemellus']) {
      expect(muscleById(id).innervation).toEqual(['nerve.nerveToQuadratusFemoris']);
    }
    expect(muscleById('muscle.obturatorExternus').innervation).toEqual(['nerve.obturator']);
  });

  it('軀幹前腹壁肌群（核心）與脊椎關節皆定義且分層/神經/動作正確（軀幹新區域 kickoff）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 功能關節 joint.spine、metadata-only 神經 nerve.intercostal 皆定義
    expect(anatomyEntityById.get('joint.spine')?.type).toBe('joint');
    expect(anatomyEntityById.get('nerve.intercostal')?.type).toBe('nerve');
    // 四腹肌皆作用 joint.spine、皆 nerve.intercostal
    const abdominals = [
      'muscle.rectusAbdominis',
      'muscle.externalAbdominalOblique',
      'muscle.internalAbdominalOblique',
      'muscle.transversusAbdominis',
    ];
    for (const id of abdominals) {
      expect(muscleById(id).relatedJoints).toContain('joint.spine');
      expect(muscleById(id).innervation).toEqual(['nerve.intercostal']);
    }
    // 分層：腹直肌/腹外斜肌＝superficial；腹內斜肌/腹橫肌＝deep
    expect(muscleById('muscle.rectusAbdominis').layer).toBe('superficial');
    expect(muscleById('muscle.externalAbdominalOblique').layer).toBe('superficial');
    expect(muscleById('muscle.internalAbdominalOblique').layer).toBe('deep');
    expect(muscleById('muscle.transversusAbdominis').layer).toBe('deep');
    // 腹直肌＝軀幹屈；腹斜肌（內/外）＝旋轉；腹橫肌＝腹壁壓縮（核心穩定）
    expect(muscleById('muscle.rectusAbdominis').actions).toContainEqual({
      jointId: 'joint.spine',
      action: 'flexion',
    });
    for (const id of ['muscle.externalAbdominalOblique', 'muscle.internalAbdominalOblique']) {
      expect(muscleById(id).actions).toContainEqual({ jointId: 'joint.spine', action: 'rotation' });
    }
    expect(muscleById('muscle.transversusAbdominis').actions).toContainEqual({
      jointId: 'joint.spine',
      action: 'compression',
    });
    // joint.spine 三軸 DOF
    const spine = anatomyEntityById.get('joint.spine');
    if (spine?.type !== 'joint') throw new Error('joint.spine 未定義或非關節');
    const axes = spine.degreesOfFreedom.map((d) => d.axis);
    expect(axes).toContain('flexionExtension');
    expect(axes).toContain('lateralFlexion');
    expect(axes).toContain('rotation');
  });

  it('軀幹豎脊肌群（髂肋肌/最長肌/棘肌）皆定義且分層/神經/動作正確（背伸肌擴張）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // metadata-only 神經 nerve.dorsalRami 定義、為 nerve 型
    expect(anatomyEntityById.get('nerve.dorsalRami')?.type).toBe('nerve');
    // 三柱皆 deep、皆作用 joint.spine extension、皆 nerve.dorsalRami
    const erectorSpinae = ['muscle.iliocostalis', 'muscle.longissimus', 'muscle.spinalis'];
    for (const id of erectorSpinae) {
      expect(muscleById(id).layer).toBe('deep');
      expect(muscleById(id).relatedJoints).toContain('joint.spine');
      expect(muscleById(id).innervation).toEqual(['nerve.dorsalRami']);
      expect(muscleById(id).actions).toContainEqual({
        jointId: 'joint.spine',
        action: 'extension',
      });
    }
  });

  it('軀幹深層椎旁肌（多裂肌/半棘肌/迴旋肌）皆定義且分層/神經/動作正確（橫突棘肌群擴張）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 橫突棘肌群三肌皆 deep、皆作用 joint.spine、皆 nerve.dorsalRami（重用 ㉑ 神經）
    const transversospinalis = ['muscle.multifidus', 'muscle.semispinalis', 'muscle.rotatores'];
    for (const id of transversospinalis) {
      expect(muscleById(id).layer).toBe('deep');
      expect(muscleById(id).relatedJoints).toContain('joint.spine');
      expect(muscleById(id).innervation).toEqual(['nerve.dorsalRami']);
      // 纖維斜走→旋轉為共通動作
      expect(muscleById(id).actions).toContainEqual({ jointId: 'joint.spine', action: 'rotation' });
    }
    // 多裂肌/半棘肌兼伸脊
    for (const id of ['muscle.multifidus', 'muscle.semispinalis']) {
      expect(muscleById(id).actions).toContainEqual({
        jointId: 'joint.spine',
        action: 'extension',
      });
    }
  });

  it('背淺層肌（斜方肌/闊背肌）與肩胛胸廓關節皆定義且分層/神經/動作正確（背淺層擴張、橋接肩帶）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 功能關節 joint.scapulothoracic、2 metadata-only 神經皆定義
    expect(anatomyEntityById.get('joint.scapulothoracic')?.type).toBe('joint');
    expect(anatomyEntityById.get('nerve.accessory')?.type).toBe('nerve');
    expect(anatomyEntityById.get('nerve.thoracodorsal')?.type).toBe('nerve');
    // 二肌皆 superficial（背部首見 superficial 層）
    expect(muscleById('muscle.trapezius').layer).toBe('superficial');
    expect(muscleById('muscle.latissimusDorsi').layer).toBe('superficial');
    // 斜方肌＝副神經、作用肩胛胸廓（上提＋後縮）
    expect(muscleById('muscle.trapezius').innervation).toEqual(['nerve.accessory']);
    expect(muscleById('muscle.trapezius').relatedJoints).toContain('joint.scapulothoracic');
    for (const action of ['elevation', 'retraction']) {
      expect(muscleById('muscle.trapezius').actions).toContainEqual({
        jointId: 'joint.scapulothoracic',
        action,
      });
    }
    // 闊背肌＝胸背神經、作用肩關節（伸＋內收）
    expect(muscleById('muscle.latissimusDorsi').innervation).toEqual(['nerve.thoracodorsal']);
    expect(muscleById('muscle.latissimusDorsi').relatedJoints).toContain('joint.glenohumeral');
    for (const action of ['extension', 'adduction']) {
      expect(muscleById('muscle.latissimusDorsi').actions).toContainEqual({
        jointId: 'joint.glenohumeral',
        action,
      });
    }
    // joint.scapulothoracic 三軸 DOF
    const st = anatomyEntityById.get('joint.scapulothoracic');
    if (st?.type !== 'joint') throw new Error('joint.scapulothoracic 未定義或非關節');
    const axes = st.degreesOfFreedom.map((d) => d.axis);
    expect(axes).toContain('elevationDepression');
    expect(axes).toContain('protractionRetraction');
    expect(axes).toContain('upwardDownwardRotation');
  });

  it('頸部前外側肌群（胸鎖乳突肌/斜角肌群）與頸椎功能關節皆定義且分層/神經/動作正確（頸部區開張、SCM 重用副神經）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 新功能關節 joint.cervicalSpine、新 metadata-only 神經 cervicalVentralRami 皆定義
    expect(anatomyEntityById.get('joint.cervicalSpine')?.type).toBe('joint');
    expect(anatomyEntityById.get('nerve.cervicalVentralRami')?.type).toBe('nerve');
    // SCM＝淺層、重用副神經（㉓ 既建）、作用頸椎（屈＋旋轉）
    expect(muscleById('muscle.sternocleidomastoid').layer).toBe('superficial');
    expect(muscleById('muscle.sternocleidomastoid').innervation).toEqual(['nerve.accessory']);
    expect(muscleById('muscle.sternocleidomastoid').relatedJoints).toContain('joint.cervicalSpine');
    for (const action of ['flexion', 'rotation']) {
      expect(muscleById('muscle.sternocleidomastoid').actions).toContainEqual({
        jointId: 'joint.cervicalSpine',
        action,
      });
    }
    // 三斜角肌＝深層、頸脊神經前支、作用頸椎（側屈）
    for (const id of [
      'muscle.scalenusAnterior',
      'muscle.scalenusMedius',
      'muscle.scalenusPosterior',
    ]) {
      expect(muscleById(id).layer).toBe('deep');
      expect(muscleById(id).innervation).toEqual(['nerve.cervicalVentralRami']);
      expect(muscleById(id).actions).toContainEqual({
        jointId: 'joint.cervicalSpine',
        action: 'lateralFlexion',
      });
    }
    // joint.cervicalSpine 三軸 DOF
    const cx = anatomyEntityById.get('joint.cervicalSpine');
    if (cx?.type !== 'joint') throw new Error('joint.cervicalSpine 未定義或非關節');
    const axes2 = cx.degreesOfFreedom.map((d) => d.axis);
    expect(axes2).toContain('flexionExtension');
    expect(axes2).toContain('lateralFlexion');
    expect(axes2).toContain('rotation');
  });

  it('肩胛動作肌群（菱形大/小肌、前鋸肌、提肩胛肌）皆定義且分層/神經/動作正確（補齊 joint.scapulothoracic 軸肩肌群）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 2 metadata-only 神經皆定義
    expect(anatomyEntityById.get('nerve.dorsalScapular')?.type).toBe('nerve');
    expect(anatomyEntityById.get('nerve.longThoracic')?.type).toBe('nerve');
    // 四肌皆 deep、皆作用 joint.scapulothoracic
    for (const id of [
      'muscle.rhomboidMajor',
      'muscle.rhomboidMinor',
      'muscle.serratusAnterior',
      'muscle.levatorScapulae',
    ]) {
      expect(muscleById(id).layer).toBe('deep');
      expect(muscleById(id).relatedJoints).toContain('joint.scapulothoracic');
    }
    // 菱形大/小肌＝肩胛背神經、肩胛內收（retraction）
    for (const id of ['muscle.rhomboidMajor', 'muscle.rhomboidMinor']) {
      expect(muscleById(id).innervation).toEqual(['nerve.dorsalScapular']);
      expect(muscleById(id).actions).toContainEqual({
        jointId: 'joint.scapulothoracic',
        action: 'retraction',
      });
    }
    // 前鋸肌＝胸長神經、肩胛前突＋上旋（無力＝翼狀肩）
    expect(muscleById('muscle.serratusAnterior').innervation).toEqual(['nerve.longThoracic']);
    for (const action of ['protraction', 'upwardRotation']) {
      expect(muscleById('muscle.serratusAnterior').actions).toContainEqual({
        jointId: 'joint.scapulothoracic',
        action,
      });
    }
    // 提肩胛肌＝肩胛背神經、肩胛上提（elevation）
    expect(muscleById('muscle.levatorScapulae').innervation).toEqual(['nerve.dorsalScapular']);
    expect(muscleById('muscle.levatorScapulae').actions).toContainEqual({
      jointId: 'joint.scapulothoracic',
      action: 'elevation',
    });
  });

  it('深層頸椎肌群（頭/頸夾肌、頭/頸長肌）皆定義且分層/神經/動作正確（補齊頸椎深層內在肌、零新基礎建設）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 四肌皆 deep、皆作用既有 joint.cervicalSpine（㉔）
    for (const id of [
      'muscle.spleniusCapitis',
      'muscle.spleniusColli',
      'muscle.longusCapitis',
      'muscle.longusColli',
    ]) {
      expect(muscleById(id).layer).toBe('deep');
      expect(muscleById(id).relatedJoints).toContain('joint.cervicalSpine');
    }
    // 夾肌＝重用脊神經後支 dorsalRami（㉑）、頸椎伸展＋旋轉
    for (const id of ['muscle.spleniusCapitis', 'muscle.spleniusColli']) {
      expect(muscleById(id).innervation).toEqual(['nerve.dorsalRami']);
      for (const action of ['extension', 'rotation']) {
        expect(muscleById(id).actions).toContainEqual({
          jointId: 'joint.cervicalSpine',
          action,
        });
      }
    }
    // 長肌＝重用頸脊神經前支 cervicalVentralRami（㉔）、頸椎屈曲（深層頸屈肌）
    for (const id of ['muscle.longusCapitis', 'muscle.longusColli']) {
      expect(muscleById(id).innervation).toEqual(['nerve.cervicalVentralRami']);
      expect(muscleById(id).actions).toContainEqual({
        jointId: 'joint.cervicalSpine',
        action: 'flexion',
      });
    }
  });

  it('呼吸肌／胸壁（橫膈膜＋三層肋間肌）皆定義且分層/神經/動作正確（首見 midline 肌、joint.thorax 胸廓）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 新功能關節 joint.thorax（含 ribElevation 軸）、新 metadata-only 神經 phrenic 皆定義
    const thorax = anatomyEntityById.get('joint.thorax');
    if (thorax?.type !== 'joint') throw new Error('joint.thorax 未定義或非關節');
    expect(thorax.degreesOfFreedom.map((d) => d.axis)).toContain('ribElevation');
    expect(anatomyEntityById.get('nerve.phrenic')?.type).toBe('nerve');
    // 四肌皆 deep、皆作用 joint.thorax
    for (const id of [
      'muscle.diaphragm',
      'muscle.externalIntercostal',
      'muscle.internalIntercostal',
      'muscle.innermostIntercostal',
    ]) {
      expect(muscleById(id).layer).toBe('deep');
      expect(muscleById(id).relatedJoints).toContain('joint.thorax');
    }
    // 橫膈膜＝首見 midline 肌、膈神經、吸氣
    expect(muscleById('muscle.diaphragm').symmetry).toBe('midline');
    expect(muscleById('muscle.diaphragm').innervation).toEqual(['nerve.phrenic']);
    expect(muscleById('muscle.diaphragm').actions).toContainEqual({
      jointId: 'joint.thorax',
      action: 'inspiration',
    });
    // 三層肋間肌＝重用肋間神經（⑳）；外肋間吸氣、內/最內肋間呼氣
    for (const id of [
      'muscle.externalIntercostal',
      'muscle.internalIntercostal',
      'muscle.innermostIntercostal',
    ]) {
      expect(muscleById(id).innervation).toEqual(['nerve.intercostal']);
    }
    expect(muscleById('muscle.externalIntercostal').actions).toContainEqual({
      jointId: 'joint.thorax',
      action: 'inspiration',
    });
    for (const id of ['muscle.internalIntercostal', 'muscle.innermostIntercostal']) {
      expect(muscleById(id).actions).toContainEqual({
        jointId: 'joint.thorax',
        action: 'expiration',
      });
    }
  });

  it('脊柱骨架（頸/胸/腰椎逐節＋薦骨＋尾骨）皆定義且為 bone 型（椎柱拆逐節個別椎、不再 join；中軸骨架）', () => {
    for (const id of [
      'bone.c1',
      'bone.c2',
      'bone.c7',
      'bone.t1',
      'bone.t12',
      'bone.l1',
      'bone.l5',
      'bone.sacrum',
      'bone.coccyx',
    ]) {
      expect(anatomyEntityById.get(id)?.type).toBe('bone');
    }
    // 拆分後聚合椎柱不再存在（完善3D模型 detail）。
    for (const id of ['bone.cervicalVertebrae', 'bone.thoracicVertebrae', 'bone.lumbarVertebrae']) {
      expect(anatomyEntityById.get(id)).toBeUndefined();
    }
  });

  it('胸廓骨架（肋骨逐根＋肋軟骨逐節＋胸骨三部）皆定義且為 bone 型（拆逐件、不再 join；錨定呼吸肌與 joint.thorax）', () => {
    for (const id of [
      'bone.rib1',
      'bone.rib12',
      'bone.costalCartilage1',
      'bone.manubrium',
      'bone.sternumBody',
      'bone.xiphoidProcess',
    ]) {
      expect(anatomyEntityById.get(id)?.type).toBe('bone');
    }
    // 拆分後聚合胸廓骨不再存在（完善3D模型 detail）。
    for (const id of ['bone.ribs', 'bone.costalCartilages', 'bone.sternum']) {
      expect(anatomyEntityById.get(id)).toBeUndefined();
    }
  });

  it('顱骨個別骨＋下頜骨＋舌骨皆定義且為 bone 型（顱骨拆 13 個別骨、不再 join；中軸骨架頭端）', () => {
    for (const id of [
      'bone.frontal',
      'bone.occipital',
      'bone.sphenoid',
      'bone.ethmoid',
      'bone.vomer',
      'bone.parietal',
      'bone.temporal',
      'bone.maxilla',
      'bone.zygomatic',
      'bone.nasal',
      'bone.lacrimal',
      'bone.palatine',
      'bone.inferiorNasalConcha',
      'bone.mandible',
      'bone.hyoid',
    ]) {
      expect(anatomyEntityById.get(id)?.type).toBe('bone');
    }
    // 拆分後 bone.cranium 不再存在（完善3D模型批次1）。
    expect(anatomyEntityById.get('bone.cranium')).toBeUndefined();
  });

  it('手足骨架（腕/掌/指骨＋跗/蹠/趾骨逐件）皆定義且為 bone 型（拆逐件、不再 join；手足內在肌之骨支架）', () => {
    for (const id of [
      'bone.scaphoid',
      'bone.capitate',
      'bone.metacarpal1',
      'bone.handProximalPhalanx1',
      'bone.talus',
      'bone.calcaneus',
      'bone.metatarsal1',
      'bone.footProximalPhalanx1',
    ]) {
      expect(anatomyEntityById.get(id)?.type).toBe('bone');
    }
    // 拆分後聚合手足骨不再存在（完善3D模型 detail）。
    for (const id of ['bone.hand', 'bone.foot']) {
      expect(anatomyEntityById.get(id)).toBeUndefined();
    }
  });

  it('咀嚼肌群（咬肌/顳肌/翼內肌/翼外肌）與顳顎關節皆定義且分層/神經/動作正確（頭部肌群開張、CN V3）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 新功能關節 joint.temporomandibular（含三軸）、新 metadata-only 神經 mandibular 皆定義
    const tmj = anatomyEntityById.get('joint.temporomandibular');
    if (tmj?.type !== 'joint') throw new Error('joint.temporomandibular 未定義或非關節');
    const axes = tmj.degreesOfFreedom.map((d) => d.axis);
    expect(axes).toContain('depressionElevation');
    expect(axes).toContain('protrusionRetrusion');
    expect(axes).toContain('lateralDeviation');
    expect(anatomyEntityById.get('nerve.mandibular')?.type).toBe('nerve');
    // 四肌皆 relatedJoints [joint.temporomandibular]＋innervation [nerve.mandibular]（CN V3）
    for (const id of [
      'muscle.masseter',
      'muscle.temporalis',
      'muscle.medialPterygoid',
      'muscle.lateralPterygoid',
    ]) {
      expect(muscleById(id).relatedJoints).toContain('joint.temporomandibular');
      expect(muscleById(id).innervation).toEqual(['nerve.mandibular']);
    }
    // 咬肌/顳肌淺層、翼內/外肌深層
    expect(muscleById('muscle.masseter').layer).toBe('superficial');
    expect(muscleById('muscle.temporalis').layer).toBe('superficial');
    expect(muscleById('muscle.medialPterygoid').layer).toBe('deep');
    expect(muscleById('muscle.lateralPterygoid').layer).toBe('deep');
    // 咬肌＝閉口（elevation）、翼外肌＝張口（depression）
    expect(muscleById('muscle.masseter').actions).toContainEqual({
      jointId: 'joint.temporomandibular',
      action: 'elevation',
    });
    expect(muscleById('muscle.lateralPterygoid').actions).toContainEqual({
      jointId: 'joint.temporomandibular',
      action: 'depression',
    });
  });

  it('舌骨上肌群（二腹/下頜舌骨/頦舌骨/莖突舌骨肌）與舌骨運動關節皆定義且分層/神經/動作正確（頸前舌骨吊帶、CN VII/XII＋V3）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 新功能關節 joint.hyoid（含 elevationDepression 軸）、2 新 metadata-only 神經皆定義
    const hyoid = anatomyEntityById.get('joint.hyoid');
    if (hyoid?.type !== 'joint') throw new Error('joint.hyoid 未定義或非關節');
    expect(hyoid.degreesOfFreedom.map((d) => d.axis)).toContain('elevationDepression');
    expect(anatomyEntityById.get('nerve.facial')?.type).toBe('nerve');
    expect(anatomyEntityById.get('nerve.hypoglossal')?.type).toBe('nerve');
    // 四肌皆作用 joint.hyoid（上提舌骨）
    for (const id of [
      'muscle.digastric',
      'muscle.mylohyoid',
      'muscle.geniohyoid',
      'muscle.stylohyoid',
    ]) {
      expect(muscleById(id).relatedJoints).toContain('joint.hyoid');
      expect(muscleById(id).actions).toContainEqual({
        jointId: 'joint.hyoid',
        action: 'elevation',
      });
    }
    // 二腹肌＝淺層、雙重支配（前腹 CN V3 mandibular／後腹 CN VII facial）
    expect(muscleById('muscle.digastric').layer).toBe('superficial');
    expect(muscleById('muscle.digastric').innervation).toEqual([
      'nerve.mandibular',
      'nerve.facial',
    ]);
    // 下頜舌骨肌＝深層、CN V3（nerve to mylohyoid 為 V3 分支）
    expect(muscleById('muscle.mylohyoid').layer).toBe('deep');
    expect(muscleById('muscle.mylohyoid').innervation).toEqual(['nerve.mandibular']);
    // 頦舌骨肌＝深層、CN XII（C1 纖維搭舌下神經）
    expect(muscleById('muscle.geniohyoid').layer).toBe('deep');
    expect(muscleById('muscle.geniohyoid').innervation).toEqual(['nerve.hypoglossal']);
    // 莖突舌骨肌＝淺層、CN VII、不作用顳顎關節（僅上提/後牽舌骨）
    expect(muscleById('muscle.stylohyoid').layer).toBe('superficial');
    expect(muscleById('muscle.stylohyoid').innervation).toEqual(['nerve.facial']);
    expect(muscleById('muscle.stylohyoid').relatedJoints).not.toContain('joint.temporomandibular');
    // 二腹肌/下頜舌骨肌另作用顳顎關節（下壓下頜＝張口）
    for (const id of ['muscle.digastric', 'muscle.mylohyoid']) {
      expect(muscleById(id).actions).toContainEqual({
        jointId: 'joint.temporomandibular',
        action: 'depression',
      });
    }
  });

  it('舌骨下肌群（胸骨舌骨/胸骨甲狀/甲狀舌骨/肩胛舌骨肌）皆定義且分層/神經/動作正確（接同一 joint.hyoid 之下降、頸袢＋CN XII）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 新 metadata-only 神經 ansaCervicalis 定義；joint.hyoid 沿用 ㉜（本切片不新增關節）
    expect(anatomyEntityById.get('nerve.ansaCervicalis')?.type).toBe('nerve');
    // 四肌皆作用既有 joint.hyoid（depression 下降/穩定舌骨）
    for (const id of [
      'muscle.sternohyoid',
      'muscle.sternothyroid',
      'muscle.thyrohyoid',
      'muscle.omohyoid',
    ]) {
      expect(muscleById(id).relatedJoints).toContain('joint.hyoid');
      expect(muscleById(id).actions).toContainEqual({
        jointId: 'joint.hyoid',
        action: 'depression',
      });
    }
    // 胸骨舌骨/肩胛舌骨肌＝淺層帶狀肌平面
    for (const id of ['muscle.sternohyoid', 'muscle.omohyoid']) {
      expect(muscleById(id).layer).toBe('superficial');
    }
    // 胸骨甲狀/甲狀舌骨肌＝深層（貼喉/甲狀軟骨）
    for (const id of ['muscle.sternothyroid', 'muscle.thyrohyoid']) {
      expect(muscleById(id).layer).toBe('deep');
    }
    // 胸骨舌骨/胸骨甲狀/肩胛舌骨肌＝頸袢（ansa cervicalis C1–C3）
    for (const id of ['muscle.sternohyoid', 'muscle.sternothyroid', 'muscle.omohyoid']) {
      expect(muscleById(id).innervation).toEqual(['nerve.ansaCervicalis']);
    }
    // 甲狀舌骨肌＝C1 纖維搭舌下神經（重用 ㉜ nerve.hypoglossal、非頸袢）
    expect(muscleById('muscle.thyrohyoid').innervation).toEqual(['nerve.hypoglossal']);
  });

  it('上臉表情肌群（枕額/眼輪匝/皺眉/鼻錐肌）皆定義且分層/神經正確（首見無關節動作肌群、CN VII 重用 nerve.facial）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // CN VII 顏面神經沿用 ㉜（本切片不新增神經）
    expect(anatomyEntityById.get('nerve.facial')?.type).toBe('nerve');
    // 四肌皆 CN VII、皆無關節動作（表情肌移動皮膚而非關節：relatedJoints []＋actions []）
    for (const id of [
      'muscle.occipitofrontalis',
      'muscle.orbicularisOculi',
      'muscle.corrugatorSupercilii',
      'muscle.procerus',
    ]) {
      expect(muscleById(id).innervation).toEqual(['nerve.facial']);
      expect(muscleById(id).relatedJoints).toEqual([]);
      expect(muscleById(id).actions).toEqual([]);
    }
    // 枕額/眼輪匝/鼻錐肌淺層、皺眉肌深層
    for (const id of ['muscle.occipitofrontalis', 'muscle.orbicularisOculi', 'muscle.procerus']) {
      expect(muscleById(id).layer).toBe('superficial');
    }
    expect(muscleById('muscle.corrugatorSupercilii').layer).toBe('deep');
  });

  it('顳頂肌（頭皮肌、與枕額肌同屬顱頂肌 epicranius）定義且分層/神經正確（補齊頭皮肌群、CN VII 重用 nerve.facial、移動頭皮非關節）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    const temporoparietalis = muscleById('muscle.temporoparietalis');
    expect(temporoparietalis.name['zh-TW']).toBe('顳頂肌');
    // 顱頂肌淺層、雙側、CN VII 顏面神經（沿用 ㉜、本切片不新增神經）、移動頭皮無關節動作
    expect(temporoparietalis.layer).toBe('superficial');
    expect(temporoparietalis.symmetry).toBe('paired');
    expect(temporoparietalis.innervation).toEqual(['nerve.facial']);
    expect(temporoparietalis.relatedJoints).toEqual([]);
    expect(temporoparietalis.actions).toEqual([]);
  });

  it('口周提肌群與口輪匝肌（口輪匝/顴大/顴小/提上唇/提口角/笑肌）皆定義且分層/神經正確（下臉表情肌提肌群、CN VII 重用 nerve.facial、無關節動作）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // CN VII 顏面神經沿用 ㉜（本切片不新增神經）
    expect(anatomyEntityById.get('nerve.facial')?.type).toBe('nerve');
    // 六肌皆 CN VII、皆無關節動作（表情肌移動皮膚而非關節）
    for (const id of [
      'muscle.orbicularisOris',
      'muscle.zygomaticusMajor',
      'muscle.zygomaticusMinor',
      'muscle.levatorLabiiSuperioris',
      'muscle.levatorAnguliOris',
      'muscle.risorius',
    ]) {
      expect(muscleById(id).innervation).toEqual(['nerve.facial']);
      expect(muscleById(id).relatedJoints).toEqual([]);
      expect(muscleById(id).actions).toEqual([]);
    }
    // 口輪匝/顴大/顴小/提上唇/笑肌淺層、提口角肌深層（深於提上唇肌/顴肌、起自犬齒窩）
    for (const id of [
      'muscle.orbicularisOris',
      'muscle.zygomaticusMajor',
      'muscle.zygomaticusMinor',
      'muscle.levatorLabiiSuperioris',
      'muscle.risorius',
    ]) {
      expect(muscleById(id).layer).toBe('superficial');
    }
    expect(muscleById('muscle.levatorAnguliOris').layer).toBe('deep');
  });

  it('口周降肌群與頦肌/鼻肌/頸闊肌（降口角/降下唇/頦/鼻/降鼻中隔/頸闊肌）皆定義且分層/神經正確（完成表情肌系統、CN VII 重用 nerve.facial、無關節動作）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // CN VII 顏面神經沿用 ㉜（本切片不新增神經）
    expect(anatomyEntityById.get('nerve.facial')?.type).toBe('nerve');
    // 六肌皆 CN VII、皆無關節動作（表情肌移動皮膚而非關節）
    for (const id of [
      'muscle.depressorAnguliOris',
      'muscle.depressorLabiiInferioris',
      'muscle.mentalis',
      'muscle.nasalis',
      'muscle.depressorSeptiNasi',
      'muscle.platysma',
    ]) {
      expect(muscleById(id).innervation).toEqual(['nerve.facial']);
      expect(muscleById(id).relatedJoints).toEqual([]);
      expect(muscleById(id).actions).toEqual([]);
    }
    // 降口角肌/鼻肌/頸闊肌淺層
    for (const id of ['muscle.depressorAnguliOris', 'muscle.nasalis', 'muscle.platysma']) {
      expect(muscleById(id).layer).toBe('superficial');
    }
    // 降下唇肌/頦肌/降鼻中隔肌深層
    for (const id of [
      'muscle.depressorLabiiInferioris',
      'muscle.mentalis',
      'muscle.depressorSeptiNasi',
    ]) {
      expect(muscleById(id).layer).toBe('deep');
    }
  });

  it('深層枕下/顱椎肌群（枕下三角四肌＋顱椎前直/側肌）皆定義且分層/神經/動作正確（最深上頸椎節段肌、重用 joint.cervicalSpine＋dorsalRami/cervicalVentralRami）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 六肌皆深層、皆作用既有 joint.cervicalSpine（㉔）
    for (const id of [
      'muscle.rectusCapitisPosteriorMajor',
      'muscle.rectusCapitisPosteriorMinor',
      'muscle.obliquusCapitisSuperior',
      'muscle.obliquusCapitisInferior',
      'muscle.rectusCapitisAnterior',
      'muscle.rectusCapitisLateralis',
    ]) {
      expect(muscleById(id).layer).toBe('deep');
      expect(muscleById(id).relatedJoints).toContain('joint.cervicalSpine');
    }
    // 後群枕下三角四肌＝枕下神經（C1 後支）→重用 dorsalRami（㉑）
    for (const id of [
      'muscle.rectusCapitisPosteriorMajor',
      'muscle.rectusCapitisPosteriorMinor',
      'muscle.obliquusCapitisSuperior',
      'muscle.obliquusCapitisInferior',
    ]) {
      expect(muscleById(id).innervation).toEqual(['nerve.dorsalRami']);
    }
    // 前群顱椎前直/側肌＝C1–C2 前支→重用 cervicalVentralRami（㉔）
    for (const id of ['muscle.rectusCapitisAnterior', 'muscle.rectusCapitisLateralis']) {
      expect(muscleById(id).innervation).toEqual(['nerve.cervicalVentralRami']);
    }
    // 動作：頭後大直肌伸＋轉、頭下斜肌轉、頭前直肌屈
    expect(muscleById('muscle.rectusCapitisPosteriorMajor').actions).toContainEqual({
      jointId: 'joint.cervicalSpine',
      action: 'extension',
    });
    expect(muscleById('muscle.rectusCapitisPosteriorMajor').actions).toContainEqual({
      jointId: 'joint.cervicalSpine',
      action: 'rotation',
    });
    expect(muscleById('muscle.obliquusCapitisInferior').actions).toContainEqual({
      jointId: 'joint.cervicalSpine',
      action: 'rotation',
    });
    expect(muscleById('muscle.rectusCapitisAnterior').actions).toContainEqual({
      jointId: 'joint.cervicalSpine',
      action: 'flexion',
    });
  });

  it('深層核心—腰方肌與骨盆底肌群（腰方肌＋恥尾/髂尾/尾骨/恥骨肛門/肛門外括約肌）皆定義且分層/神經正確（完成核心罐＋骨盆底肌群補完、骨盆底無關節動作）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 2 新 metadata-only 神經皆定義
    expect(anatomyEntityById.get('nerve.lumbarVentralRami')?.type).toBe('nerve');
    expect(anatomyEntityById.get('nerve.pudendal')?.type).toBe('nerve');
    // 腰方肌＝深層、作用 joint.spine（側屈＋伸）、腰神經叢前支
    expect(muscleById('muscle.quadratusLumborum').layer).toBe('deep');
    expect(muscleById('muscle.quadratusLumborum').relatedJoints).toContain('joint.spine');
    expect(muscleById('muscle.quadratusLumborum').innervation).toEqual(['nerve.lumbarVentralRami']);
    for (const action of ['lateralFlexion', 'extension']) {
      expect(muscleById('muscle.quadratusLumborum').actions).toContainEqual({
        jointId: 'joint.spine',
        action,
      });
    }
    // 骨盆底肌群五肌＝深層、陰部神經、無關節動作（支持骨盆底/臟器、自禁機能、非作用骨骼關節）
    // 補完：恥骨肛門肌（提肛肌複合）＋肛門外括約肌（陰部神經下直腸支、以主幹佔位）
    for (const id of [
      'muscle.pubococcygeus',
      'muscle.iliococcygeus',
      'muscle.coccygeus',
      'muscle.puboanalis',
      'muscle.externalAnalSphincter',
    ]) {
      expect(muscleById(id).layer).toBe('deep');
      expect(muscleById(id).innervation).toEqual(['nerve.pudendal']);
      expect(muscleById(id).relatedJoints).toEqual([]);
      expect(muscleById(id).actions).toEqual([]);
    }
  });

  it('前胸壁軸肩肌群（胸大肌＋胸小肌＋鎖骨下肌）皆定義且分層/神經/動作正確（補齊前群軸肩肌、鎖骨下肌無關節動作、3 新胸神經）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 3 新 metadata-only 神經皆定義
    expect(anatomyEntityById.get('nerve.lateralPectoral')?.type).toBe('nerve');
    expect(anatomyEntityById.get('nerve.medialPectoral')?.type).toBe('nerve');
    expect(anatomyEntityById.get('nerve.nerveToSubclavius')?.type).toBe('nerve');
    // 胸大肌＝淺層、作用 joint.glenohumeral（屈/內收/內旋）、胸外側＋內側神經
    expect(muscleById('muscle.pectoralisMajor').layer).toBe('superficial');
    expect(muscleById('muscle.pectoralisMajor').relatedJoints).toContain('joint.glenohumeral');
    expect(muscleById('muscle.pectoralisMajor').innervation).toEqual([
      'nerve.lateralPectoral',
      'nerve.medialPectoral',
    ]);
    for (const action of ['flexion', 'adduction', 'internalRotation']) {
      expect(muscleById('muscle.pectoralisMajor').actions).toContainEqual({
        jointId: 'joint.glenohumeral',
        action,
      });
    }
    // 胸小肌＝深層、作用 joint.scapulothoracic（前伸/下壓/下旋）、胸內側神經
    expect(muscleById('muscle.pectoralisMinor').layer).toBe('deep');
    expect(muscleById('muscle.pectoralisMinor').relatedJoints).toContain('joint.scapulothoracic');
    expect(muscleById('muscle.pectoralisMinor').innervation).toEqual(['nerve.medialPectoral']);
    for (const action of ['protraction', 'depression', 'downwardRotation']) {
      expect(muscleById('muscle.pectoralisMinor').actions).toContainEqual({
        jointId: 'joint.scapulothoracic',
        action,
      });
    }
    // 鎖骨下肌＝深層、鎖骨下肌神經、無關節動作（穩定/下壓鎖骨、模型無胸鎖關節）
    expect(muscleById('muscle.subclavius').layer).toBe('deep');
    expect(muscleById('muscle.subclavius').innervation).toEqual(['nerve.nerveToSubclavius']);
    expect(muscleById('muscle.subclavius').relatedJoints).toEqual([]);
    expect(muscleById('muscle.subclavius').actions).toEqual([]);
  });

  it('後前臂伸肌腔室補全（肱橈肌＋橈側伸腕短肌＋小指/示指/拇短伸肌＋肘肌）皆定義且分層/神經/動作正確（橈神經伸肌群、零新神經/關節）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 6 肌皆 muscle 型、皆橈神經、零新神經（重用 nerve.radial）
    const all = [
      'muscle.brachioradialis',
      'muscle.extensorCarpiRadialisBrevis',
      'muscle.extensorDigitiMinimi',
      'muscle.extensorIndicis',
      'muscle.extensorPollicisBrevis',
      'muscle.anconeus',
    ];
    for (const id of all) {
      expect(muscleById(id).innervation).toEqual(['nerve.radial']);
    }
    // 淺層 4：肱橈肌/橈側伸腕短肌/小指伸肌/肘肌
    for (const id of [
      'muscle.brachioradialis',
      'muscle.extensorCarpiRadialisBrevis',
      'muscle.extensorDigitiMinimi',
      'muscle.anconeus',
    ]) {
      expect(muscleById(id).layer).toBe('superficial');
    }
    // 深層 2：拇短伸肌/示指伸肌
    for (const id of ['muscle.extensorPollicisBrevis', 'muscle.extensorIndicis']) {
      expect(muscleById(id).layer).toBe('deep');
    }
    // 關節/動作
    expect(muscleById('muscle.brachioradialis').actions).toContainEqual({
      jointId: 'joint.elbow',
      action: 'flexion',
    });
    expect(muscleById('muscle.anconeus').actions).toContainEqual({
      jointId: 'joint.elbow',
      action: 'extension',
    });
    for (const action of ['extension', 'radialDeviation']) {
      expect(muscleById('muscle.extensorCarpiRadialisBrevis').actions).toContainEqual({
        jointId: 'joint.wrist',
        action,
      });
    }
    expect(muscleById('muscle.extensorDigitiMinimi').actions).toContainEqual({
      jointId: 'joint.fingers',
      action: 'extension',
    });
    expect(muscleById('muscle.extensorIndicis').actions).toContainEqual({
      jointId: 'joint.fingers',
      action: 'extension',
    });
    expect(muscleById('muscle.extensorPollicisBrevis').actions).toContainEqual({
      jointId: 'joint.thumb',
      action: 'extension',
    });
  });

  it('上肢補全殘餘臂前/前臂屈肌（喙肱肌＋掌長肌＋旋前方肌）皆定義且分層/神經/動作正確（上肢真正全集、零新神經/關節）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 喙肱肌＝深層、肌皮神經、joint.glenohumeral 屈＋內收
    expect(muscleById('muscle.coracobrachialis').layer).toBe('deep');
    expect(muscleById('muscle.coracobrachialis').innervation).toEqual(['nerve.musculocutaneous']);
    for (const action of ['flexion', 'adduction']) {
      expect(muscleById('muscle.coracobrachialis').actions).toContainEqual({
        jointId: 'joint.glenohumeral',
        action,
      });
    }
    // 掌長肌＝淺層、正中神經、joint.wrist 屈腕
    expect(muscleById('muscle.palmarisLongus').layer).toBe('superficial');
    expect(muscleById('muscle.palmarisLongus').innervation).toEqual(['nerve.median']);
    expect(muscleById('muscle.palmarisLongus').actions).toContainEqual({
      jointId: 'joint.wrist',
      action: 'flexion',
    });
    // 旋前方肌＝深層、正中神經、joint.radioulnar 旋前
    expect(muscleById('muscle.pronatorQuadratus').layer).toBe('deep');
    expect(muscleById('muscle.pronatorQuadratus').innervation).toEqual(['nerve.median']);
    expect(muscleById('muscle.pronatorQuadratus').actions).toContainEqual({
      jointId: 'joint.radioulnar',
      action: 'pronation',
    });
  });

  it('下肢補全殘餘（縫匠肌＋膕肌＋蹠肌＋第三腓骨肌）皆定義且分層/神經/動作正確（下肢真正全集、零新神經/關節）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 縫匠肌＝淺層、股神經、joint.hip 屈＋外展＋外旋＋joint.knee 屈
    expect(muscleById('muscle.sartorius').layer).toBe('superficial');
    expect(muscleById('muscle.sartorius').innervation).toEqual(['nerve.femoral']);
    for (const action of ['flexion', 'abduction', 'externalRotation']) {
      expect(muscleById('muscle.sartorius').actions).toContainEqual({
        jointId: 'joint.hip',
        action,
      });
    }
    expect(muscleById('muscle.sartorius').actions).toContainEqual({
      jointId: 'joint.knee',
      action: 'flexion',
    });
    // 膕肌＝深層、脛神經、joint.knee 屈（解鎖膝）
    expect(muscleById('muscle.popliteus').layer).toBe('deep');
    expect(muscleById('muscle.popliteus').innervation).toEqual(['nerve.tibial']);
    expect(muscleById('muscle.popliteus').actions).toContainEqual({
      jointId: 'joint.knee',
      action: 'flexion',
    });
    // 蹠肌＝深層、脛神經、joint.ankle 蹠屈＋joint.knee 屈
    expect(muscleById('muscle.plantaris').layer).toBe('deep');
    expect(muscleById('muscle.plantaris').innervation).toEqual(['nerve.tibial']);
    expect(muscleById('muscle.plantaris').actions).toContainEqual({
      jointId: 'joint.ankle',
      action: 'plantarflexion',
    });
    expect(muscleById('muscle.plantaris').actions).toContainEqual({
      jointId: 'joint.knee',
      action: 'flexion',
    });
    // 第三腓骨肌＝淺層、腓深神經、joint.ankle 背屈＋外翻
    expect(muscleById('muscle.fibularisTertius').layer).toBe('superficial');
    expect(muscleById('muscle.fibularisTertius').innervation).toEqual(['nerve.deepFibular']);
    for (const action of ['dorsiflexion', 'eversion']) {
      expect(muscleById('muscle.fibularisTertius').actions).toContainEqual({
        jointId: 'joint.ankle',
        action,
      });
    }
  });

  it('後鋸肌群（上後鋸肌＋下後鋸肌）皆定義且分層/神經/動作正確（輔助呼吸肌、重用 nerve.intercostal/joint.thorax、零新神經/關節）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    // 二肌皆深層、肋間神經、作用 joint.thorax
    for (const id of ['muscle.serratusPosteriorSuperior', 'muscle.serratusPosteriorInferior']) {
      expect(muscleById(id).layer).toBe('deep');
      expect(muscleById(id).innervation).toEqual(['nerve.intercostal']);
      expect(muscleById(id).relatedJoints).toContain('joint.thorax');
    }
    // 上後鋸肌＝提上肋（吸氣）；下後鋸肌＝降下肋（呼氣）
    expect(muscleById('muscle.serratusPosteriorSuperior').actions).toContainEqual({
      jointId: 'joint.thorax',
      action: 'inspiration',
    });
    expect(muscleById('muscle.serratusPosteriorInferior').actions).toContainEqual({
      jointId: 'joint.thorax',
      action: 'expiration',
    });
  });

  it('頰肌（buccinator）皆定義且分層/神經正確（最後一條 PT 肌、表情肌無關節動作、重用 nerve.facial、零新神經/關節）', () => {
    const muscleById = (id: string) => {
      const entity = anatomyEntityById.get(id);
      if (entity?.type !== 'muscle') throw new Error(`${id} 未定義或非肌肉`);
      return entity;
    };
    expect(muscleById('muscle.buccinator').layer).toBe('deep');
    expect(muscleById('muscle.buccinator').innervation).toEqual(['nerve.facial']);
    expect(muscleById('muscle.buccinator').relatedJoints).toEqual([]);
    expect(muscleById('muscle.buccinator').actions).toEqual([]);
  });
});

describe('Breakout 不分側測試標記（05 §5.3.3 #8）', () => {
  it('CTSIB 節點標記為 sideIndependent，其餘節點未標', () => {
    const flow = sfmaBreakoutFlows.find((f) => f.flowKey === 'vestibularCoreBreakout');
    expect(flow).toBeDefined();
    const byKey = (key: string) => flow?.nodes.find((n) => n.nodeKey === key);
    expect(byKey('vestibularCtsibStaticHead')?.sideIndependent).toBe(true);
    expect(byKey('ctsibDynamicHead')?.sideIndependent).toBe(true);
    // 半跪窄底面積非 CTSIB → 保守不標。
    expect(byKey('halfKneelingNarrowBase')?.sideIndependent).toBeUndefined();
  });
});
