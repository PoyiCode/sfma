import { describe, expect, it } from 'vitest';
import { patientSchema } from './patient';
import { assessmentSessionSchema } from './assessment';
import { appSettingsSchema } from './settings';
import { exportEnvelopeSchema } from './export';
import { anatomyEntitySchema } from './anatomy';

// 06 §6.2 範例
const PATIENT = {
  schemaVersion: 1,
  patientId: '9f6f2af0-5f24-44f3-9b1e-2c7a1c1d4b5e',
  displayCode: 'P0001',
  name: '王小明',
  gender: 'male',
  birthDate: '1980-05-01',
  contact: { phone: '', email: '' },
  notes: '',
  createdAt: '2026-06-12T09:00:00+08:00',
  updatedAt: '2026-06-12T09:00:00+08:00',
  consentAcknowledgedAt: '2026-06-12T09:00:00+08:00',
};

// 06 §6.3 範例（節錄）
const SESSION = {
  schemaVersion: 1,
  sessionId: 'S20260612-0001',
  patientId: 'P0001',
  assessor: { assessorId: 'T01', name: '李治療師' },
  assessedAt: '2026-06-12T09:30:00+08:00',
  patterns: [
    {
      patternKey: 'cervicalFlexion',
      side: null,
      dysfunctional: true,
      painful: false,
      failedCriteria: ['cannotTouchSternumToChin'],
      notes: '',
    },
    {
      patternKey: 'cervicalRotation',
      side: 'right',
      dysfunctional: true,
      painful: true,
      failedCriteria: ['noseNotAlignedMidClavicle'],
      notes: '右轉誘發頸部疼痛',
    },
  ],
  breakouts: [
    {
      patternKey: 'cervicalRotation',
      side: 'right',
      entryFlowKey: 'cervicalRotationBreakout',
      steps: [
        {
          flowKey: 'cervicalRotationBreakout',
          nodeKey: 'activeSupineCervicalRotation80',
          result: 'DN',
          notes: '',
        },
      ],
      findings: [
        {
          flowKey: 'cervicalRotationBreakout',
          nodeKey: 'passiveSupineCervicalRotation80',
          findingKey: 'activeCervicalSpineRotationSmcd',
          findingType: 'SMCD',
        },
      ],
      classification: 'SMCD',
      notes: '',
    },
  ],
  bodyAnnotations: [
    {
      annotationId: 'A001',
      anatomyId: 'muscle.sternocleidomastoid',
      side: 'right',
      findingType: 'painful',
      linkedPatternKey: 'cervicalRotation',
      note: '右側胸鎖乳突肌相關',
    },
  ],
  summary: {
    counts: { FN: 11, FP: 1, DN: 2, DP: 1 },
    painfulPatterns: ['cervicalRotation:right'],
    dysfunctionalPatterns: ['cervicalFlexion', 'cervicalRotation:right'],
  },
};

// 06 §6.10 範例
const SETTINGS = {
  schemaVersion: 1,
  settingsId: 'app',
  therapistProfile: { assessorId: 'T01', name: '李治療師' },
  locale: 'zh-TW',
  lodMode: 'auto',
  orientationPreference: 'auto',
  defaultLayers: { bone: true, deepMuscle: false, superficialMuscle: true, nerve: false },
  theme: 'system',
  updatedAt: '2026-06-12T09:00:00+08:00',
};

describe('patientSchema', () => {
  it('接受 06 §6.2 範例', () => {
    expect(patientSchema.parse(PATIENT).name).toBe('王小明');
  });

  it('缺 consentAcknowledgedAt 拒絕（06 §6.2、08 §8.5）', () => {
    const invalid: Record<string, unknown> = { ...PATIENT };
    delete invalid.consentAcknowledgedAt;
    expect(patientSchema.safeParse(invalid).success).toBe(false);
  });

  it('birthDate 非 ISO 日期拒絕', () => {
    expect(patientSchema.safeParse({ ...PATIENT, birthDate: '01/05/1980' }).success).toBe(false);
  });

  it('displayCode 選填', () => {
    const minimal: Record<string, unknown> = { ...PATIENT };
    delete minimal.displayCode;
    expect(patientSchema.safeParse(minimal).success).toBe(true);
  });

  it('最小蒐集：僅 name 為必填使用者輸入，個資欄全可省略（08 §8.1、06 §6.2）', () => {
    // 系統欄（schemaVersion／patientId）＋同意閘門＋name；無 gender／birthDate／contact／notes／displayCode
    const minimal = {
      schemaVersion: 1,
      patientId: '9f6f2af0-5f24-44f3-9b1e-2c7a1c1d4b5e',
      name: '王小明',
      consentAcknowledgedAt: '2026-06-12T09:00:00+08:00',
    };
    expect(patientSchema.safeParse(minimal).success).toBe(true);
  });

  it('name 為必填：缺漏或空字串拒絕', () => {
    const missing: Record<string, unknown> = { ...PATIENT };
    delete missing.name;
    expect(patientSchema.safeParse(missing).success).toBe(false);
    expect(patientSchema.safeParse({ ...PATIENT, name: '' }).success).toBe(false);
  });

  it('個資欄逐欄選填（gender／birthDate／contact／notes）', () => {
    for (const field of ['gender', 'birthDate', 'contact', 'notes'] as const) {
      const without = Object.fromEntries(Object.entries(PATIENT).filter(([key]) => key !== field));
      expect(patientSchema.safeParse(without).success).toBe(true);
    }
  });

  it('patientId 為必填識別碼（系統產生；06 §6.6 不限 UUID 格式但不可缺）', () => {
    const without: Record<string, unknown> = { ...PATIENT };
    delete without.patientId;
    expect(patientSchema.safeParse(without).success).toBe(false);
  });
});

describe('assessmentSessionSchema', () => {
  it('接受 06 §6.3 範例（節錄）', () => {
    const session = assessmentSessionSchema.parse(SESSION);
    expect(session.patterns).toHaveLength(2);
    expect(session.breakouts[0].classification).toBe('SMCD');
  });

  it('patternKey 非列舉值拒絕', () => {
    const invalid = {
      ...SESSION,
      patterns: [{ ...SESSION.patterns[0], patternKey: 'unknownPattern' }],
    };
    expect(assessmentSessionSchema.safeParse(invalid).success).toBe(false);
  });

  it('side 僅 left/right/null', () => {
    const invalid = { ...SESSION, patterns: [{ ...SESSION.patterns[0], side: 'both' }] };
    expect(assessmentSessionSchema.safeParse(invalid).success).toBe(false);
  });

  it('進行中 Breakout 可無 classification（03 §3.3.9 續測）', () => {
    const inProgress = {
      ...SESSION,
      breakouts: [{ ...SESSION.breakouts[0], classification: undefined }],
    };
    expect(assessmentSessionSchema.safeParse(inProgress).success).toBe(true);
  });
});

describe('appSettingsSchema', () => {
  it('接受 06 §6.10 範例', () => {
    expect(appSettingsSchema.parse(SETTINGS).locale).toBe('zh-TW');
  });

  it('settingsId 僅允許固定值 app', () => {
    expect(appSettingsSchema.safeParse({ ...SETTINGS, settingsId: 'other' }).success).toBe(false);
  });

  it('dataSafetyNoticeAcknowledged 選填——缺省與布林皆接受', () => {
    expect(appSettingsSchema.safeParse(SETTINGS).success).toBe(true);
    expect(
      appSettingsSchema.parse({ ...SETTINGS, dataSafetyNoticeAcknowledged: true })
        .dataSafetyNoticeAcknowledged,
    ).toBe(true);
  });

  it('installGuideDismissed 選填——缺省與布林皆接受', () => {
    expect(appSettingsSchema.safeParse(SETTINGS).success).toBe(true);
    expect(
      appSettingsSchema.parse({ ...SETTINGS, installGuideDismissed: true }).installGuideDismissed,
    ).toBe(true);
  });

  // 「完整」LOD 級別（解3d資產：無損載入）：lodMode 含 'full'；'auto'/'simplified' 仍合法。
  it('lodMode 接受 full（完整無損級別）與 auto/simplified', () => {
    expect(appSettingsSchema.safeParse({ ...SETTINGS, lodMode: 'full' }).success).toBe(true);
    expect(appSettingsSchema.parse({ ...SETTINGS, lodMode: 'full' }).lodMode).toBe('full');
    expect(appSettingsSchema.parse({ ...SETTINGS, lodMode: 'auto' }).lodMode).toBe('auto');
    expect(appSettingsSchema.parse({ ...SETTINGS, lodMode: 'simplified' }).lodMode).toBe(
      'simplified',
    );
  });

  // 精細（detailed）LOD 階層移除（2026-06-17 政策改變）：舊設定 lodMode:'detailed' 經 zod preprocess
  // 正規化為 'simplified'（同資產、行為不變；免升 schemaVersion，延續加寬相容慣例）。
  it("lodMode 舊值 'detailed' 正規化為 'simplified'（向後相容）", () => {
    const parsed = appSettingsSchema.safeParse({ ...SETTINGS, lodMode: 'detailed' });
    expect(parsed.success).toBe(true);
    expect(appSettingsSchema.parse({ ...SETTINGS, lodMode: 'detailed' }).lodMode).toBe(
      'simplified',
    );
  });

  // 被動結構分層為新增分層鍵（解3d資產 52）：defaultLayers.passiveStructure 選填、向後相容既有設定
  // （沿用 optional-field 樣式、不升 schemaVersion）；舊設定缺鍵照常 parse，帶鍵則保留。
  it('defaultLayers.passiveStructure 選填——缺省與布林皆接受（向後相容）', () => {
    // 缺省（既有 4 鍵設定）照常通過、值為 undefined。
    expect(appSettingsSchema.safeParse(SETTINGS).success).toBe(true);
    expect(appSettingsSchema.parse(SETTINGS).defaultLayers.passiveStructure).toBeUndefined();
    // 帶鍵時保留（非被 strip）。
    const withPassive = {
      ...SETTINGS,
      defaultLayers: { ...SETTINGS.defaultLayers, passiveStructure: true },
    };
    expect(appSettingsSchema.parse(withPassive).defaultLayers.passiveStructure).toBe(true);
  });
});

describe('anatomyEntitySchema（解剖實體 discriminatedUnion；06 §6.5）', () => {
  // 韌帶為新增實體類型（解3d資產 ㊿）：minimal＝base＋type，比照 bone/nerve。
  const LIGAMENT = {
    schemaVersion: 1,
    anatomyId: 'ligament.anteriorCruciateLigament',
    type: 'ligament',
    name: { 'zh-TW': '前十字韌帶', en: 'Anterior Cruciate Ligament' },
  };

  it('韌帶實體 parse 通過（ligament 納入 discriminatedUnion、minimal 型）', () => {
    const parsed = anatomyEntitySchema.parse(LIGAMENT);
    expect(parsed.type).toBe('ligament');
    expect(parsed.anatomyId).toBe('ligament.anteriorCruciateLigament');
  });

  it('未知 type 拒絕（discriminatedUnion 列舉外）', () => {
    expect(anatomyEntitySchema.safeParse({ ...LIGAMENT, type: 'tendon' }).success).toBe(false);
  });

  // 椎間盤為新增實體類型（解3d資產 51）：minimal＝base＋type，比照 bone/nerve/ligament。
  const DISC = {
    schemaVersion: 1,
    anatomyId: 'disc.l5S1',
    type: 'disc',
    name: { 'zh-TW': '腰椎間盤 L5–S1', en: 'Intervertebral Disc L5–S1' },
  };

  it('椎間盤實體 parse 通過（disc 納入 discriminatedUnion、minimal 型）', () => {
    const parsed = anatomyEntitySchema.parse(DISC);
    expect(parsed.type).toBe('disc');
    expect(parsed.anatomyId).toBe('disc.l5S1');
  });

  // 關節囊為新增實體類型（解3d資產 53）：minimal＝base＋type，比照 ligament/disc。
  const CAPSULE = {
    schemaVersion: 1,
    anatomyId: 'capsule.knee',
    type: 'capsule',
    name: { 'zh-TW': '膝關節囊', en: 'Knee Joint Capsule' },
  };

  it('關節囊實體 parse 通過（capsule 納入 discriminatedUnion、minimal 型）', () => {
    const parsed = anatomyEntitySchema.parse(CAPSULE);
    expect(parsed.type).toBe('capsule');
    expect(parsed.anatomyId).toBe('capsule.knee');
  });

  // 關節盤為新增實體類型（解3d資產 54）：滑膜關節內纖維軟骨盤（TMJ 盤＝TMD），
  // 與 disc（椎間盤 intervertebral）分立。minimal＝base＋type，比照 ligament/disc/capsule。
  const ARTICULAR_DISC = {
    schemaVersion: 1,
    anatomyId: 'articularDisc.temporomandibular',
    type: 'articularDisc',
    name: { 'zh-TW': '顳顎關節盤', en: 'Temporomandibular Articular Disc' },
  };

  it('關節盤實體 parse 通過（articularDisc 納入 discriminatedUnion、minimal 型）', () => {
    const parsed = anatomyEntitySchema.parse(ARTICULAR_DISC);
    expect(parsed.type).toBe('articularDisc');
    expect(parsed.anatomyId).toBe('articularDisc.temporomandibular');
  });

  // 筋膜為新增實體類型（解3d資產 58）：包覆肌肉之纖維結締組織鞘膜（含腱膜 aponeurosis），
  // 與 ligament/capsule 同屬被動結構。minimal＝base＋type，比照 ligament/disc/capsule/articularDisc。
  const FASCIA = {
    schemaVersion: 1,
    anatomyId: 'fascia.thoracolumbar',
    type: 'fascia',
    name: { 'zh-TW': '胸腰筋膜', en: 'Thoracolumbar fascia' },
  };

  it('筋膜實體 parse 通過（fascia 納入 discriminatedUnion、minimal 型）', () => {
    const parsed = anatomyEntitySchema.parse(FASCIA);
    expect(parsed.type).toBe('fascia');
    expect(parsed.anatomyId).toBe('fascia.thoracolumbar');
  });

  // 滑囊為新增實體類型（解3d資產 60）：充液之纖維囊、降肌腱/骨摩擦（滑囊炎＝PT 常見病），
  // 同 ligament/capsule/fascia 屬被動結構。minimal＝base＋type，比照 ligament/disc/capsule/fascia。
  const BURSA = {
    schemaVersion: 1,
    anatomyId: 'bursa.subacromial',
    type: 'bursa',
    name: { 'zh-TW': '肩峰下滑囊', en: 'Subacromial bursa' },
  };

  it('滑囊實體 parse 通過（bursa 納入 discriminatedUnion、minimal 型）', () => {
    const parsed = anatomyEntitySchema.parse(BURSA);
    expect(parsed.type).toBe('bursa');
    expect(parsed.anatomyId).toBe('bursa.subacromial');
  });

  // 肌群為新增實體類型（解3d資產 61）：精簡版肌群合併之選取單位（§4.3.5）。base＋type＋layer
  // （superficial/deep，比照 muscle 用以歸 deep/superficialMuscle 顯示層）；無 muscle 之關節/動作/
  // 神經欄（群組為粗化代表，避懸空參考）。
  const MUSCLE_GROUP = {
    schemaVersion: 1,
    anatomyId: 'muscleGroup.quadriceps',
    type: 'muscleGroup',
    name: { 'zh-TW': '股四頭肌', en: 'Quadriceps' },
    layer: 'superficial',
  };

  it('肌群實體 parse 通過（muscleGroup 納入 discriminatedUnion、含 layer）', () => {
    const parsed = anatomyEntitySchema.parse(MUSCLE_GROUP);
    expect(parsed.type).toBe('muscleGroup');
    expect(parsed.anatomyId).toBe('muscleGroup.quadriceps');
    if (parsed.type === 'muscleGroup') expect(parsed.layer).toBe('superficial');
  });

  it('肌群實體拒絕未知 layer（僅 superficial/deep）', () => {
    expect(anatomyEntitySchema.safeParse({ ...MUSCLE_GROUP, layer: 'middle' }).success).toBe(false);
  });
});

describe('exportEnvelopeSchema', () => {
  it('接受 patient 範圍封裝（06 §6.7）', () => {
    const envelope = {
      exportVersion: 1,
      schemaVersion: 1,
      exportedAt: '2026-06-12T18:00:00+08:00',
      scope: 'patient',
      patients: [PATIENT],
      assessments: [SESSION],
    };
    expect(exportEnvelopeSchema.parse(envelope).patients).toHaveLength(1);
  });

  it('all 範圍可附 settings', () => {
    const envelope = {
      exportVersion: 1,
      schemaVersion: 1,
      exportedAt: '2026-06-12T18:00:00+08:00',
      scope: 'all',
      patients: [],
      assessments: [],
      settings: SETTINGS,
    };
    expect(exportEnvelopeSchema.parse(envelope).settings?.theme).toBe('system');
  });

  it('scope 非法值拒絕', () => {
    const envelope = {
      exportVersion: 1,
      schemaVersion: 1,
      exportedAt: '2026-06-12T18:00:00+08:00',
      scope: 'partial',
      patients: [],
      assessments: [],
    };
    expect(exportEnvelopeSchema.safeParse(envelope).success).toBe(false);
  });
});
