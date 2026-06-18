import type { ImportErrorCode } from '../data/importer';

// ImportError 代碼 → 顯示文字鍵（exhaustive；新增代碼時 tsc 強制補齊）。
// 置獨立純函式模組：與 .vue 元件分離、可隔離測試。Nuxt i18n 鍵為純字串（無 MessageKey 型別）。
export function importErrorMessageKey(code: ImportErrorCode | 'unknown'): string {
  switch (code) {
    case 'invalidJson':
      return 'settingsImportErrorInvalidJson';
    case 'invalidEnvelope':
      return 'settingsImportErrorInvalidEnvelope';
    case 'unsupportedExportVersion':
      return 'settingsImportErrorUnsupportedExportVersion';
    case 'unsupportedSchemaVersion':
      return 'settingsImportErrorUnsupportedSchemaVersion';
    case 'validationFailed':
      return 'settingsImportErrorValidationFailed';
    case 'unknown':
      return 'settingsImportErrorUnknown';
  }
}
