import { describe, expect, it } from 'vitest';
import type { ImportErrorCode } from '../data/importer';
import { importErrorMessageKey } from './importErrorMessage';

describe('importErrorMessageKey（匯入錯誤代碼 → i18n 鍵）', () => {
  it('每個代碼皆對應 settingsImportError* 鍵', () => {
    const cases: Array<[ImportErrorCode | 'unknown', string]> = [
      ['invalidJson', 'settingsImportErrorInvalidJson'],
      ['invalidEnvelope', 'settingsImportErrorInvalidEnvelope'],
      ['unsupportedExportVersion', 'settingsImportErrorUnsupportedExportVersion'],
      ['unsupportedSchemaVersion', 'settingsImportErrorUnsupportedSchemaVersion'],
      ['validationFailed', 'settingsImportErrorValidationFailed'],
      ['unknown', 'settingsImportErrorUnknown'],
    ];
    for (const [code, key] of cases) {
      expect(importErrorMessageKey(code)).toBe(key);
    }
  });
});
