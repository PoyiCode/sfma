// @nuxt/eslint 產生 .nuxt/eslint.config.mjs（含 eslint-plugin-vue、typescript-eslint、vue-eslint-parser）。
// 於其上 append 命名規則（07 §7.1）：camelCase/PascalCase/UPPER_CASE、嚴禁 snake_case。
import withNuxt from './.nuxt/eslint.config.mjs';
import configPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default withNuxt(
  {
    // 僅套用於 @typescript-eslint/parser 解析的 TS 檔；naming-convention 需該 parser 之 services，
    // 套到 .vue（vue-eslint-parser）或 .mjs（espree）會拋錯。Vue 元件命名由 eslint-plugin-vue 處理。
    files: ['**/*.{ts,mts,cts,tsx}'],
    // nuxt.config.ts 含 Web App Manifest 標準欄位（short_name／start_url 等）為外部 schema，
    // 非本專案識別字 → 排除命名規則（比照 ptApp 對 vite.config.ts 之處置）。
    ignores: ['nuxt.config.ts'],
    // flat config：naming-convention 規則所屬的 @typescript-eslint plugin 須於同一 config 物件註冊，
    // 並指定 @typescript-eslint/parser（rule 需其 services；無 project 之非型別感知模式即可，同 ptApp）。
    plugins: { '@typescript-eslint': tseslint.plugin },
    languageOptions: { parser: tseslint.parser },
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'import', format: null },
        {
          selector: 'variable',
          format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'typeLike', format: ['PascalCase'] },
        { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
        { selector: 'objectLiteralProperty', format: ['camelCase', 'PascalCase', 'UPPER_CASE'] },
        { selector: 'objectLiteralProperty', modifiers: ['requiresQuotes'], format: null },
        {
          // 數字鍵不限格式：schemaVersion 遷移登錄表以來源版本號為鍵（06 §6.8）
          selector: ['objectLiteralProperty', 'objectLiteralMethod'],
          filter: { regex: '^\\d+$', match: true },
          format: null,
        },
        { selector: 'typeProperty', format: ['camelCase', 'UPPER_CASE'] },
        { selector: 'typeProperty', modifiers: ['requiresQuotes'], format: null },
      ],
      // TS 由編譯器處理未定義識別字；no-undef 對型別參照（如 Console）誤報，依 typescript-eslint 建議關閉
      'no-undef': 'off',
    },
  },
  configPrettier,
);
