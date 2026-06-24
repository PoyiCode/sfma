// Breakout 各步驟測試的「測試參考圖」（03 §3.3.9）：取自官方 SFMA score sheet
// （doc/ref/SFMA_form.pdf 之 breakout 流程頁）逐測試裁切，供物理治療師執行二階測試時對照。
// 與 patternImage 同法以 Vite import.meta.glob（eager、?url）取雜湊後 url：資產經打包、
// 自動套 app.baseURL（子路徑佈署如 GitHub Pages 亦正確），且納入 PWA precache 可離線。
// 檔名＝breakout node 之 nodeKey。
const MODULES = import.meta.glob<string>('../../assets/sfma/breakout/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const STEP_IMAGE_BY_KEY: Record<string, string> = {};
for (const [path, url] of Object.entries(MODULES)) {
  const fileName = path.split('/').pop();
  if (!fileName) continue;
  STEP_IMAGE_BY_KEY[fileName.replace(/\.png$/, '')] = url;
}

// 取該 breakout 步驟之測試參考圖 url；缺圖回 undefined（卡片據此不顯圖，優雅退場）。
export function breakoutStepImageUrl(nodeKey: string): string | undefined {
  return STEP_IMAGE_BY_KEY[nodeKey];
}
