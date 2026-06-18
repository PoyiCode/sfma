import { describe, expect, it } from 'vitest';
import {
  FINDING_TYPES,
  FINDING_TYPE_GLYPH,
  FINDING_TYPE_LABEL_KEY,
  findingTypeText,
} from './findingTypeLabel';

// stub translator（測試自備，不依賴執行期 i18n）。
const MESSAGES: Record<string, string> = {
  assessmentPainful: '疼痛',
  assessmentDysfunctional: '功能異常',
  bodyAnnotationFindingNote: '備註',
};
const t = (key: string): string => MESSAGES[key] ?? key;

describe('findingType 標籤與符號', () => {
  it('每個 findingType 皆有 label 鍵與 glyph 符號', () => {
    for (const findingType of FINDING_TYPES) {
      expect(FINDING_TYPE_LABEL_KEY[findingType]).toBeTruthy();
      expect(FINDING_TYPE_GLYPH[findingType]).toBeTruthy();
    }
  });

  it('glyph 三型互異（非色彩通道需可辨）', () => {
    const glyphs = FINDING_TYPES.map((f) => FINDING_TYPE_GLYPH[f]);
    expect(new Set(glyphs).size).toBe(FINDING_TYPES.length);
  });

  it('findingTypeText 取本地化文字（注入 stub translator）', () => {
    expect(findingTypeText('painful', t)).toBe('疼痛');
    expect(findingTypeText('dysfunctional', t)).toBe('功能異常');
    expect(findingTypeText('note', t)).toBe('備註');
  });
});
