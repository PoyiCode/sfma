import type { BodyAnnotationFindingType } from '../../assessment/bodyAnnotationForm';
import type { Translate } from '../anatomy/anatomyInfo';

// findingType 選項與顯示鍵：painful/dysfunctional 複用評估核心術語，note 為標註專屬（04 §4.5）。
export const FINDING_TYPES = ['painful', 'dysfunctional', 'note'] as const;

export const FINDING_TYPE_LABEL_KEY: Record<BodyAnnotationFindingType, string> = {
  painful: 'assessmentPainful',
  dysfunctional: 'assessmentDysfunctional',
  note: 'bodyAnnotationFindingNote',
};

// 非色彩通道符號（03 §3.6、§3.7.5）：高亮以填色傳達 findingType 外，另以符號／文字輔助。
export const FINDING_TYPE_GLYPH: Record<BodyAnnotationFindingType, string> = {
  painful: '⚠',
  dysfunctional: '△',
  note: 'ℹ',
};

// findingType → 本地化顯示文字（依注入 translator）。
export function findingTypeText(findingType: BodyAnnotationFindingType, t: Translate): string {
  return t(FINDING_TYPE_LABEL_KEY[findingType]);
}
