import { describe, expect, it } from 'vitest';
import { anatomyEntityById } from '@ptapp/definitions';
import type { AnatomyEntity } from '@ptapp/shared';
import { anatomyDisplayName, describeAnatomyEntity } from './anatomyInfo';

// stub translator：回傳對應 zh-TW 字串（測試自備，不依賴執行期 i18n）。
const MESSAGES: Record<string, string> = {
  anatomyTypeMuscle: '肌肉',
  anatomyTypeNerve: '神經',
  anatomyTypeBone: '骨骼',
  anatomyTypeJoint: '關節',
  anatomyTypeLigament: '韌帶',
  anatomyTypeDisc: '椎間盤',
  anatomyTypeCapsule: '關節囊',
  anatomyTypeArticularDisc: '關節盤',
  anatomyTypeFascia: '筋膜',
  anatomyTypeBursa: '滑囊',
  anatomyTypeLabrum: '關節唇',
  anatomyTypeMuscleGroup: '肌群',
  anatomyLayer: '分層',
  anatomyLayerSuperficial: '淺層',
  anatomyLayerDeep: '深層',
  anatomySymmetry: '對稱',
  anatomySymmetryPaired: '成對',
  anatomySymmetryMidline: '中線',
  anatomyRelatedJoints: '相關關節',
  anatomyActions: '作用',
  anatomyInnervation: '神經支配',
  anatomyRangeOfMotion: '活動範圍',
};
const t = (key: string): string => MESSAGES[key] ?? key;

const biceps = anatomyEntityById.get('muscle.bicepsBrachii')!;
const brachialis = anatomyEntityById.get('muscle.brachialis')!;
const radial = anatomyEntityById.get('nerve.radial')!;
const humerus = anatomyEntityById.get('bone.humerus')!;
const elbow = anatomyEntityById.get('joint.elbow')!;
const acl = anatomyEntityById.get('ligament.anteriorCruciateLigament')!;
const discL5S1 = anatomyEntityById.get('disc.l5S1')!;
const kneeCapsule = anatomyEntityById.get('capsule.knee')!;
const tmjDisc = anatomyEntityById.get('articularDisc.temporomandibular')!;
const thoracolumbarFascia = anatomyEntityById.get('fascia.thoracolumbar')!;
const subacromialBursa = anatomyEntityById.get('bursa.subacromial')!;

describe('describeAnatomyEntity（解剖資訊衍生，注入式 translator）', () => {
  it('肌肉：名稱／型別／分層／對稱／相關關節／作用／神經支配', () => {
    const info = describeAnatomyEntity(biceps, t);
    expect(info.name).toBe('肱二頭肌');
    expect(info.typeLabel).toBe('肌肉');
    const byLabel = Object.fromEntries(info.rows.map((r) => [r.label, r.value]));
    expect(byLabel['分層']).toBe('淺層');
    expect(byLabel['對稱']).toBe('成對');
    expect(byLabel['相關關節']).toBe('肘關節');
    expect(byLabel['作用']).toBe('肘關節（flexion）');
    expect(byLabel['神經支配']).toBe('肌皮神經');
  });

  it('深層肌 layer 值為深層', () => {
    const byLabel = Object.fromEntries(
      describeAnatomyEntity(brachialis, t).rows.map((r) => [r.label, r.value]),
    );
    expect(byLabel['分層']).toBe('深層');
  });

  it('關節：型別與活動範圍（ROM）', () => {
    const info = describeAnatomyEntity(elbow, t);
    expect(info.typeLabel).toBe('關節');
    const rom = info.rows.find((r) => r.label === '活動範圍');
    expect(rom?.value).toContain('0°–145°');
  });

  it('神經／骨骼：僅名稱與型別、無屬性列', () => {
    expect(describeAnatomyEntity(radial, t)).toEqual({ name: '橈神經', typeLabel: '神經', rows: [] });
    expect(describeAnatomyEntity(humerus, t)).toEqual({ name: '肱骨', typeLabel: '骨骼', rows: [] });
  });

  it('韌帶：僅名稱與型別、無屬性列（比照神經/骨骼；解3d資產 ㊿）', () => {
    expect(describeAnatomyEntity(acl, t)).toEqual({
      name: '前十字韌帶',
      typeLabel: '韌帶',
      rows: [],
    });
  });

  it('椎間盤：僅名稱與型別、無屬性列（比照神經/骨骼/韌帶；解3d資產 51）', () => {
    expect(describeAnatomyEntity(discL5S1, t)).toEqual({
      name: '椎間盤 L5–S1',
      typeLabel: '椎間盤',
      rows: [],
    });
  });

  it('關節囊：僅名稱與型別、無屬性列（解3d資產 53）', () => {
    expect(describeAnatomyEntity(kneeCapsule, t)).toEqual({
      name: '膝關節囊',
      typeLabel: '關節囊',
      rows: [],
    });
  });

  it('關節盤：僅名稱與型別、無屬性列（解3d資產 54）', () => {
    expect(describeAnatomyEntity(tmjDisc, t)).toEqual({
      name: '顳顎關節盤',
      typeLabel: '關節盤',
      rows: [],
    });
  });

  it('筋膜：僅名稱與型別、無屬性列（解3d資產 58）', () => {
    expect(describeAnatomyEntity(thoracolumbarFascia, t)).toEqual({
      name: '胸腰筋膜',
      typeLabel: '筋膜',
      rows: [],
    });
  });

  it('滑囊：僅名稱與型別、無屬性列（解3d資產 60）', () => {
    expect(describeAnatomyEntity(subacromialBursa, t)).toEqual({
      name: '肩峰下滑囊',
      typeLabel: '滑囊',
      rows: [],
    });
  });

  it('肌群：名稱／型別／分層（精簡版肌群合併選取單位；解3d資產 61）', () => {
    const quadricepsGroup: AnatomyEntity = {
      schemaVersion: 1,
      anatomyId: 'muscleGroup.quadriceps',
      type: 'muscleGroup',
      name: { 'zh-TW': '股四頭肌', en: 'Quadriceps' },
      layer: 'superficial',
    };
    expect(describeAnatomyEntity(quadricepsGroup, t)).toEqual({
      name: '股四頭肌',
      typeLabel: '肌群',
      rows: [{ label: '分層', value: '淺層' }],
    });
  });
});

describe('anatomyDisplayName', () => {
  it('已知 id 回傳本地化名稱', () => {
    expect(anatomyDisplayName('joint.elbow')).toBe('肘關節');
  });
  it('未知 id 回傳原 id', () => {
    expect(anatomyDisplayName('muscle.doesNotExist')).toBe('muscle.doesNotExist');
  });
});
