import { anatomyEntityById } from '@ptapp/definitions';
import type { AnatomyEntity } from '@ptapp/shared';
import { localizeText } from '../../i18n/localizeText';

// 注入式 translator（5A 延後之 i18n 字串建構器）：原 ptApp 依賴自製 t(MessageKey)。
// 改為由呼叫端（元件以 useI18n().t、測試以 stub）注入，使本模組純函式、框架無關。
export type Translate = (key: string) => string;

const TYPE_LABEL_KEYS: Record<AnatomyEntity['type'], string> = {
  muscle: 'anatomyTypeMuscle',
  nerve: 'anatomyTypeNerve',
  bone: 'anatomyTypeBone',
  joint: 'anatomyTypeJoint',
  ligament: 'anatomyTypeLigament',
  disc: 'anatomyTypeDisc',
  capsule: 'anatomyTypeCapsule',
  articularDisc: 'anatomyTypeArticularDisc',
  fascia: 'anatomyTypeFascia',
  bursa: 'anatomyTypeBursa',
  labrum: 'anatomyTypeLabrum',
  muscleGroup: 'anatomyTypeMuscleGroup',
};

export interface AnatomyInfoRow {
  label: string;
  value: string;
}

export interface AnatomyInfo {
  name: string;
  typeLabel: string;
  rows: AnatomyInfoRow[];
}

// anatomyId → 顯示名稱（localizeText；未知 id 回傳原 id 作為退路）。
export function anatomyDisplayName(anatomyId: string): string {
  const entity = anatomyEntityById.get(anatomyId);
  return entity ? localizeText(entity.name) : anatomyId;
}

// 解剖實體 → 資訊卡顯示描述子（名稱／型別／屬性列；04 §4.1 部位選取）。
// 純衍生（依注入 translator）；relation 名以 anatomyEntityById 解析。
export function describeAnatomyEntity(entity: AnatomyEntity, t: Translate): AnatomyInfo {
  const base = { name: localizeText(entity.name), typeLabel: t(TYPE_LABEL_KEYS[entity.type]) };
  switch (entity.type) {
    case 'muscle':
      return {
        ...base,
        rows: [
          {
            label: t('anatomyLayer'),
            value: t(entity.layer === 'deep' ? 'anatomyLayerDeep' : 'anatomyLayerSuperficial'),
          },
          {
            label: t('anatomySymmetry'),
            value: t(
              entity.symmetry === 'paired' ? 'anatomySymmetryPaired' : 'anatomySymmetryMidline',
            ),
          },
          {
            label: t('anatomyRelatedJoints'),
            value: entity.relatedJoints.map(anatomyDisplayName).join('、'),
          },
          {
            label: t('anatomyActions'),
            value: entity.actions
              .map((action) => `${anatomyDisplayName(action.jointId)}（${action.action}）`)
              .join('、'),
          },
          {
            label: t('anatomyInnervation'),
            value: entity.innervation.map(anatomyDisplayName).join('、'),
          },
        ],
      };
    case 'joint':
      return {
        ...base,
        rows: [
          {
            label: t('anatomyRangeOfMotion'),
            value: entity.degreesOfFreedom
              .map((dof) => `${dof.axis} ${dof.min}°–${dof.max}°`)
              .join('、'),
          },
        ],
      };
    // 肌群（精簡版肌群合併選取單位）：顯分層列（與 muscle 同），無關節/動作/神經欄（粗化代表；解3d資產 61）
    case 'muscleGroup':
      return {
        ...base,
        rows: [
          {
            label: t('anatomyLayer'),
            value: t(entity.layer === 'deep' ? 'anatomyLayerDeep' : 'anatomyLayerSuperficial'),
          },
        ],
      };
    // 韌帶／椎間盤／關節囊／關節盤／筋膜／滑囊為 minimal 型（無屬性列），比照神經/骨骼（解3d資產 ㊿／51／53／54／58／60）
    case 'nerve':
    case 'bone':
    case 'ligament':
    case 'disc':
    case 'capsule':
    case 'articularDisc':
    case 'fascia':
    case 'bursa':
    case 'labrum':
      return { ...base, rows: [] };
  }
}
