// 10 大動作的「動作參考圖」（05 §5.2、03 §3.3.9）：取自官方 SFMA score sheet
// （doc/ref/SFMA_form.pdf 第 33 頁）逐動作裁切，供物理治療師評估時直接對照動作。
// 以 Vite import.meta.glob（eager、?url）取雜湊後 url：資產經打包、自動套 app.baseURL
// （子路徑佈署如 GitHub Pages 亦正確），且納入 PWA precache 可離線。檔名＝patternKey。
import type { SfmaPatternKey } from '@ptapp/shared';

const MODULES = import.meta.glob<string>('../../assets/sfma/patterns/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const PATTERN_IMAGE_BY_KEY: Partial<Record<SfmaPatternKey, string>> = {};
for (const [path, url] of Object.entries(MODULES)) {
  const fileName = path.split('/').pop();
  if (!fileName) continue;
  const key = fileName.replace(/\.png$/, '') as SfmaPatternKey;
  PATTERN_IMAGE_BY_KEY[key] = url;
}

// 取該動作之參考圖 url；缺圖回 undefined（卡片據此不顯圖，優雅退場）。
export function patternImageUrl(patternKey: SfmaPatternKey): string | undefined {
  return PATTERN_IMAGE_BY_KEY[patternKey];
}
