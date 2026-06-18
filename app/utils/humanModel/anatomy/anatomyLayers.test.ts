import { describe, expect, it } from 'vitest';
import type { AnatomyEntity } from '@ptapp/shared';
import { anatomyEntities } from '@ptapp/definitions';
import {
  ANATOMY_LAYER_KEYS,
  DEFAULT_LAYER_VISIBILITY,
  groupAnatomyIdsByLayer,
  layerOfEntity,
} from './anatomyLayers';

const bone: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'bone.humerus',
  type: 'bone',
  name: { 'zh-TW': '肱骨', en: 'Humerus' },
};
const nerve: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'nerve.radial',
  type: 'nerve',
  name: { 'zh-TW': '橈神經', en: 'Radial Nerve' },
};
const superficialMuscle: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'muscle.bicepsBrachii',
  type: 'muscle',
  name: { 'zh-TW': '肱二頭肌', en: 'Biceps Brachii' },
  layer: 'superficial',
  symmetry: 'paired',
  relatedJoints: ['joint.elbow'],
  actions: [{ jointId: 'joint.elbow', action: 'flexion' }],
  innervation: ['nerve.musculocutaneous'],
};
const deepMuscle: AnatomyEntity = {
  ...superficialMuscle,
  anatomyId: 'muscle.brachialis',
  name: { 'zh-TW': '肱肌', en: 'Brachialis' },
  layer: 'deep',
};
const joint: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'joint.elbow',
  type: 'joint',
  name: { 'zh-TW': '肘關節', en: 'Elbow Joint' },
  degreesOfFreedom: [{ axis: 'flexionExtension', min: 0, max: 145, neutral: 0, unit: 'deg' }],
};
const ligament: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'ligament.anteriorCruciateLigament',
  type: 'ligament',
  name: { 'zh-TW': '前十字韌帶', en: 'Anterior Cruciate Ligament' },
};
const disc: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'disc.l5S1',
  type: 'disc',
  name: { 'zh-TW': '椎間盤 L5–S1', en: 'Intervertebral Disc L5–S1' },
};
const capsule: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'capsule.knee',
  type: 'capsule',
  name: { 'zh-TW': '膝關節囊', en: 'Knee Joint Capsule' },
};
const articularDisc: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'articularDisc.temporomandibular',
  type: 'articularDisc',
  name: { 'zh-TW': '顳顎關節盤', en: 'Temporomandibular Articular Disc' },
};
const fascia: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'fascia.thoracolumbar',
  type: 'fascia',
  name: { 'zh-TW': '胸腰筋膜', en: 'Thoracolumbar fascia' },
};
const labrum: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'labrum.acetabular',
  type: 'labrum',
  name: { 'zh-TW': '髖臼唇', en: 'Acetabular Labrum' },
};
const bursa: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'bursa.subacromial',
  type: 'bursa',
  name: { 'zh-TW': '肩峰下滑囊', en: 'Subacromial bursa' },
};
const superficialMuscleGroup: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'muscleGroup.quadriceps',
  type: 'muscleGroup',
  name: { 'zh-TW': '股四頭肌', en: 'Quadriceps' },
  layer: 'superficial',
};
const deepMuscleGroup: AnatomyEntity = {
  ...superficialMuscleGroup,
  anatomyId: 'muscleGroup.rotatorCuff',
  name: { 'zh-TW': '旋轉肌袖', en: 'Rotator cuff' },
  layer: 'deep',
};

describe('解剖分層鍵與預設顯示（04 §4.1）', () => {
  it('五個分層鍵齊全（含被動結構）', () => {
    expect([...ANATOMY_LAYER_KEYS].sort()).toEqual(
      ['bone', 'deepMuscle', 'nerve', 'passiveStructure', 'superficialMuscle'].sort(),
    );
  });

  it('預設顯示：骨骼／深層肌肉／表層肌肉顯示，神經／被動結構隱藏（issue 2）', () => {
    expect(DEFAULT_LAYER_VISIBILITY).toEqual({
      bone: true,
      deepMuscle: true,
      superficialMuscle: true,
      nerve: false,
      passiveStructure: false,
    });
  });

  it('每個分層鍵皆有預設顯示值', () => {
    for (const key of ANATOMY_LAYER_KEYS) {
      expect(typeof DEFAULT_LAYER_VISIBILITY[key]).toBe('boolean');
    }
  });
});

describe('layerOfEntity（實體 → 顯示分層）', () => {
  it('骨骼歸入 bone', () => {
    expect(layerOfEntity(bone)).toBe('bone');
  });

  it('神經歸入 nerve', () => {
    expect(layerOfEntity(nerve)).toBe('nerve');
  });

  it('表層肌歸入 superficialMuscle、深層肌歸入 deepMuscle', () => {
    expect(layerOfEntity(superficialMuscle)).toBe('superficialMuscle');
    expect(layerOfEntity(deepMuscle)).toBe('deepMuscle');
  });

  it('關節非顯示分層、回傳 null（ROM 結構參考）', () => {
    expect(layerOfEntity(joint)).toBeNull();
  });

  it('韌帶歸入 passiveStructure（專屬被動結構分層、opt-in 顯示；解3d資產 52）', () => {
    expect(layerOfEntity(ligament)).toBe('passiveStructure');
  });

  it('椎間盤歸入 passiveStructure（同韌帶之被動結構分層；解3d資產 52）', () => {
    expect(layerOfEntity(disc)).toBe('passiveStructure');
  });

  it('關節囊歸入 passiveStructure（同韌帶/椎間盤之被動結構分層；解3d資產 53）', () => {
    expect(layerOfEntity(capsule)).toBe('passiveStructure');
  });

  it('關節盤歸入 passiveStructure（同韌帶/椎間盤/關節囊之被動結構分層；解3d資產 54）', () => {
    expect(layerOfEntity(articularDisc)).toBe('passiveStructure');
  });

  it('筋膜歸入 passiveStructure（同韌帶/椎間盤/關節囊/關節盤之被動結構分層；解3d資產 58）', () => {
    expect(layerOfEntity(fascia)).toBe('passiveStructure');
  });

  it('滑囊歸入 passiveStructure（同韌帶/椎間盤/關節囊/關節盤/筋膜之被動結構分層；解3d資產 60）', () => {
    expect(layerOfEntity(bursa)).toBe('passiveStructure');
  });

  it('關節唇歸入 passiveStructure（新 labrum 型、同其餘被動結構分層；關節內被動結構擴張）', () => {
    expect(layerOfEntity(labrum)).toBe('passiveStructure');
  });

  it('表層肌群歸入 superficialMuscle、深層肌群歸入 deepMuscle（精簡版肌群合併選取單位；解3d資產 61）', () => {
    expect(layerOfEntity(superficialMuscleGroup)).toBe('superficialMuscle');
    expect(layerOfEntity(deepMuscleGroup)).toBe('deepMuscle');
  });
});

describe('groupAnatomyIdsByLayer（依分層彙整 anatomyId）', () => {
  it('字面量實體依分層歸類、joint 不入任一層、韌帶與椎間盤併入 passiveStructure', () => {
    const grouped = groupAnatomyIdsByLayer([
      bone,
      nerve,
      superficialMuscle,
      deepMuscle,
      joint,
      ligament,
      disc,
    ]);
    expect(grouped).toEqual({
      bone: ['bone.humerus'],
      deepMuscle: ['muscle.brachialis'],
      superficialMuscle: ['muscle.bicepsBrachii'],
      nerve: ['nerve.radial'],
      passiveStructure: ['ligament.anteriorCruciateLigament', 'disc.l5S1'],
    });
  });

  it('每個分層鍵皆存在（空層為空陣列）', () => {
    const grouped = groupAnatomyIdsByLayer([joint]);
    for (const key of ANATOMY_LAYER_KEYS) {
      expect(Array.isArray(grouped[key])).toBe(true);
    }
    expect(grouped.bone).toEqual([]);
    expect(grouped.passiveStructure).toEqual([]);
  });

  it('整合 03 種子：上肢全集＋下肢膝至足全集＋臀深六＋軀幹前腹壁/豎脊/橫突棘/背淺層/肩胛動作肌＋頸部前外側/深層頸椎肌＋呼吸肌＋脊柱/胸廓/顱骨架＋咀嚼肌＋舌骨上肌群實體分層正確（四肢全集＋軀幹核心＋背伸＋深層椎旁＋背淺層＋軸肩肌群＋頸前外側＋頸深層＋呼吸胸壁＋中軸骨架脊柱胸廓顱＋頭部咀嚼＋頸前舌骨上肌群＋舌骨下帶狀肌＋上臉表情肌＋口周提肌群＋口周降肌群/頸闊肌＋深層枕下/顱椎肌群＋深層核心後壁腰方肌＋骨盆底肌群＋前胸壁軸肩肌群＋後前臂伸肌腔室＋上肢殘餘臂前/前臂屈肌＋下肢殘餘縫匠/膕/蹠/第三腓骨肌＋後鋸肌群＋頰肌＋韌帶〔膝十字/脊椎縱/黃韌帶歸 passiveStructure 層〕＋椎間盤〔全脊椎 23 節歸 passiveStructure 層〕＋關節囊〔盂肱/髖/膝/肘 4 大關節囊歸 passiveStructure 層〕）', () => {
    const grouped = groupAnatomyIdsByLayer(anatomyEntities);
    // 逐肌（muscle.*）分層；肌群（muscleGroup.*）另於下方測試（解3d資產 61）。
    expect(grouped.superficialMuscle.filter((id) => id.startsWith('muscle.')).sort()).toEqual(
      [
        'muscle.bicepsBrachii',
        'muscle.tricepsBrachii',
        'muscle.flexorCarpiRadialis',
        'muscle.flexorCarpiUlnaris',
        'muscle.extensorCarpiRadialisLongus',
        'muscle.extensorCarpiUlnaris',
        'muscle.pronatorTeres',
        'muscle.deltoid',
        'muscle.teresMajor',
        'muscle.flexorDigitorumSuperficialis',
        'muscle.extensorDigitorum',
        'muscle.abductorPollicisBrevis',
        'muscle.flexorPollicisBrevis',
        'muscle.abductorDigitiMinimiManus',
        'muscle.flexorDigitiMinimiManus',
        'muscle.rectusFemoris',
        'muscle.vastusLateralis',
        'muscle.vastusMedialis',
        'muscle.bicepsFemoris',
        'muscle.semitendinosus',
        'muscle.gluteusMaximus',
        'muscle.tensorFasciaeLatae',
        'muscle.adductorLongus',
        'muscle.gracilis',
        'muscle.pectineus',
        'muscle.gastrocnemius',
        'muscle.tibialisAnterior',
        'muscle.fibularisLongus',
        'muscle.extensorDigitorumLongus',
        'muscle.abductorHallucis',
        'muscle.flexorDigitorumBrevis',
        'muscle.abductorDigitiMinimiPedis',
        'muscle.extensorDigitorumBrevis',
        'muscle.extensorHallucisBrevis',
        'muscle.rectusAbdominis',
        'muscle.externalAbdominalOblique',
        'muscle.trapezius',
        'muscle.latissimusDorsi',
        'muscle.sternocleidomastoid',
        'muscle.masseter',
        'muscle.temporalis',
        'muscle.digastric',
        'muscle.stylohyoid',
        'muscle.sternohyoid',
        'muscle.omohyoid',
        'muscle.occipitofrontalis',
        'muscle.temporoparietalis',
        'muscle.orbicularisOculi',
        'muscle.procerus',
        'muscle.orbicularisOris',
        'muscle.zygomaticusMajor',
        'muscle.zygomaticusMinor',
        'muscle.levatorLabiiSuperioris',
        'muscle.risorius',
        'muscle.depressorAnguliOris',
        'muscle.nasalis',
        'muscle.platysma',
        'muscle.pectoralisMajor',
        'muscle.brachioradialis',
        'muscle.extensorCarpiRadialisBrevis',
        'muscle.extensorDigitiMinimi',
        'muscle.anconeus',
        'muscle.palmarisLongus',
        'muscle.sartorius',
        'muscle.fibularisTertius',
        // 淺層小肌（解3d資產 63、補 57 暫緩）
        'muscle.pyramidalis',
      ].sort(),
    );
    expect(grouped.deepMuscle.filter((id) => id.startsWith('muscle.')).sort()).toEqual(
      [
        'muscle.brachialis',
        'muscle.supinator',
        'muscle.supraspinatus',
        'muscle.infraspinatus',
        'muscle.teresMinor',
        'muscle.subscapularis',
        'muscle.flexorDigitorumProfundus',
        'muscle.flexorPollicisLongus',
        'muscle.extensorPollicisLongus',
        'muscle.abductorPollicisLongus',
        'muscle.opponensPollicis',
        'muscle.adductorPollicis',
        'muscle.opponensDigitiMinimiManus',
        'muscle.dorsalInterosseiManus',
        'muscle.palmarInterossei',
        'muscle.lumbricalsManus',
        'muscle.vastusIntermedius',
        'muscle.semimembranosus',
        'muscle.gluteusMedius',
        'muscle.gluteusMinimus',
        'muscle.iliopsoas',
        'muscle.adductorBrevis',
        'muscle.adductorMagnus',
        'muscle.soleus',
        'muscle.fibularisBrevis',
        'muscle.tibialisPosterior',
        'muscle.flexorDigitorumLongus',
        'muscle.flexorHallucisLongus',
        'muscle.extensorHallucisLongus',
        'muscle.quadratusPlantae',
        'muscle.lumbricalsPedis',
        'muscle.flexorHallucisBrevis',
        'muscle.adductorHallucis',
        'muscle.flexorDigitiMinimiPedis',
        'muscle.plantarInterossei',
        'muscle.dorsalInterosseiPedis',
        'muscle.piriformis',
        'muscle.obturatorInternus',
        'muscle.superiorGemellus',
        'muscle.inferiorGemellus',
        'muscle.quadratusFemoris',
        'muscle.obturatorExternus',
        'muscle.internalAbdominalOblique',
        'muscle.transversusAbdominis',
        'muscle.iliocostalis',
        'muscle.longissimus',
        'muscle.spinalis',
        'muscle.multifidus',
        'muscle.semispinalis',
        'muscle.rotatores',
        'muscle.scalenusAnterior',
        'muscle.scalenusMedius',
        'muscle.scalenusPosterior',
        'muscle.rhomboidMajor',
        'muscle.rhomboidMinor',
        'muscle.serratusAnterior',
        'muscle.levatorScapulae',
        'muscle.spleniusCapitis',
        'muscle.spleniusColli',
        'muscle.longusCapitis',
        'muscle.longusColli',
        'muscle.diaphragm',
        'muscle.externalIntercostal',
        'muscle.internalIntercostal',
        'muscle.innermostIntercostal',
        'muscle.medialPterygoid',
        'muscle.lateralPterygoid',
        'muscle.mylohyoid',
        'muscle.geniohyoid',
        'muscle.sternothyroid',
        'muscle.thyrohyoid',
        'muscle.corrugatorSupercilii',
        'muscle.levatorAnguliOris',
        'muscle.depressorLabiiInferioris',
        'muscle.mentalis',
        'muscle.depressorSeptiNasi',
        'muscle.rectusCapitisPosteriorMajor',
        'muscle.rectusCapitisPosteriorMinor',
        'muscle.obliquusCapitisSuperior',
        'muscle.obliquusCapitisInferior',
        'muscle.rectusCapitisAnterior',
        'muscle.rectusCapitisLateralis',
        'muscle.quadratusLumborum',
        'muscle.pubococcygeus',
        'muscle.iliococcygeus',
        'muscle.coccygeus',
        'muscle.puboanalis',
        'muscle.externalAnalSphincter',
        'muscle.pectoralisMinor',
        'muscle.subclavius',
        'muscle.extensorIndicis',
        'muscle.extensorPollicisBrevis',
        'muscle.coracobrachialis',
        'muscle.pronatorQuadratus',
        'muscle.popliteus',
        'muscle.plantaris',
        'muscle.serratusPosteriorSuperior',
        'muscle.serratusPosteriorInferior',
        'muscle.buccinator',
        // 深層小肌（解3d資產 63、補 57 暫緩）
        'muscle.interspinales',
        'muscle.intertransversarii',
        'muscle.transversusThoracis',
        'muscle.adductorMinimus',
      ].sort(),
    );
    expect(grouped.nerve.sort()).toEqual(
      [
        'nerve.musculocutaneous',
        'nerve.radial',
        'nerve.ulnar',
        'nerve.median',
        'nerve.axillary',
        'nerve.suprascapular',
        'nerve.subscapular',
        'nerve.femoral',
        'nerve.sciatic',
        'nerve.superiorGluteal',
        'nerve.inferiorGluteal',
        'nerve.obturator',
        'nerve.tibial',
        'nerve.deepFibular',
        'nerve.superficialFibular',
        'nerve.medialPlantar',
        'nerve.lateralPlantar',
        'nerve.nerveToPiriformis',
        'nerve.nerveToObturatorInternus',
        'nerve.nerveToQuadratusFemoris',
        'nerve.intercostal',
        'nerve.dorsalRami',
        'nerve.accessory',
        'nerve.thoracodorsal',
        'nerve.cervicalVentralRami',
        'nerve.dorsalScapular',
        'nerve.longThoracic',
        'nerve.phrenic',
        'nerve.mandibular',
        'nerve.facial',
        'nerve.hypoglossal',
        'nerve.ansaCervicalis',
        'nerve.lumbarVentralRami',
        'nerve.pudendal',
        'nerve.saphenous',
        'nerve.sural',
        'nerve.lateralFemoralCutaneous',
        'nerve.posteriorFemoralCutaneous',
        'nerve.superficialRadial',
        'nerve.ilioinguinal',
        'nerve.lateralPectoral',
        'nerve.medialPectoral',
        'nerve.nerveToSubclavius',
      ].sort(),
    );
    // 骨骼層＝所有 bone 型實體：拆逐件後個別骨眾多（椎/肋/腕/跗…），改派生斷言（避免逐一硬列、
    // 每批拆分皆破測）；個別骨之存在與聚合骨之移除由 definitions.test 把關（完善3D模型 detail）。
    expect(grouped.bone.sort()).toEqual(
      anatomyEntities
        .filter((e) => e.type === 'bone')
        .map((e) => e.anatomyId)
        .sort(),
    );
    // 拆分後聚合骨不再入骨骼層（detailed 8 聚合骨＋顱骨皆已拆逐件）。
    for (const id of [
      'bone.cervicalVertebrae',
      'bone.thoracicVertebrae',
      'bone.lumbarVertebrae',
      'bone.ribs',
      'bone.costalCartilages',
      'bone.sternum',
      'bone.hand',
      'bone.foot',
      'bone.cranium',
    ]) {
      expect(grouped.bone).not.toContain(id);
    }
    // 仍含逐件代表骨（拆分到位）＋既有四肢長骨（精簡版區域群已退役）。
    for (const id of [
      'bone.c1',
      'bone.t12',
      'bone.l5',
      'bone.rib1',
      'bone.manubrium',
      'bone.scaphoid',
      'bone.talus',
      'bone.frontal',
      'bone.humerus',
      'bone.femur',
    ]) {
      expect(grouped.bone).toContain(id);
    }
    // 被動結構分層（解3d資產 52）：13 韌帶＋23 椎間盤＋16 關節囊＋3 關節盤〔含 2 半月板〕＋2 關節唇＋14 筋膜＋8 滑囊、隨「被動結構」開關（預設隱藏）。
    expect(grouped.passiveStructure.sort()).toEqual(
      [
        'ligament.anteriorCruciateLigament',
        'ligament.posteriorCruciateLigament',
        'ligament.anteriorLongitudinalLigament',
        'ligament.posteriorLongitudinalLigament',
        'ligament.ligamentaFlava',
        'ligament.interosseousMembraneForearm',
        'ligament.interosseousMembraneLeg',
        'ligament.longPlantar',
        'ligament.headOfFemur',
        'ligament.posteriorSacroiliac',
        'ligament.radiateHeadOfRib',
        'ligament.collateralInterphalangealHand',
        'ligament.collateralInterphalangealFoot',
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
        'articularDisc.temporomandibular',
        'articularDisc.lateralMeniscus',
        'articularDisc.medialMeniscus',
        'labrum.acetabular',
        'labrum.glenoid',
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
        'bursa.subacromial',
        'bursa.trochantericGluteusMedius',
        'bursa.subcutaneousTrochanteric',
        'bursa.subcutaneousPrepatellar',
        'bursa.deepInfrapatellar',
        'bursa.subtendinousTricepsBrachii',
        'bursa.anserine',
        'bursa.semimembranosus',
      ].sort(),
    );
    // joint（elbow／wrist／radioulnar／glenohumeral／fingers／thumb／knee／hip／ankle／toes／spine／scapulothoracic／cervicalSpine／thorax／temporomandibular／hyoid）非顯示分層，不入任一層
    const allGrouped = Object.values(grouped).flat();
    for (const jointId of [
      'joint.elbow',
      'joint.wrist',
      'joint.radioulnar',
      'joint.glenohumeral',
      'joint.fingers',
      'joint.thumb',
      'joint.knee',
      'joint.hip',
      'joint.ankle',
      'joint.toes',
      'joint.spine',
      'joint.scapulothoracic',
      'joint.cervicalSpine',
      'joint.thorax',
      'joint.temporomandibular',
      'joint.hyoid',
    ]) {
      expect(allGrouped).not.toContain(jointId);
    }
  });

  it('細節版/精簡版雙 profile 收斂：muscleGroup 合併單位已退役、不再出現於分層彙整（§4.3.5/§4.3.6）', () => {
    const grouped = groupAnatomyIdsByLayer(anatomyEntities);
    const muscleGroupIds = [...grouped.superficialMuscle, ...grouped.deepMuscle].filter((id) =>
      id.startsWith('muscleGroup.'),
    );
    expect(muscleGroupIds).toEqual([]);
  });
});
