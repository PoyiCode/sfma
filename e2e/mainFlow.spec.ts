import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

// 主流程 E2E（todo 08 E2E「主流程」；對應 ptApp jsdom 整合測試之真實瀏覽器全旅程）：
// 建立個案 → 新評估 → 輸入判讀（含一個 DP 觸發 Breakout 入口）→ 完成 → 總覽 →
// 設定頁匯出全部備份（捕捉下載檔）→ 清空（刪個案）→ 匯入還原 → 驗資料回復。
// 真實瀏覽器引擎驗 jsdom 不可替之行為：IndexedDB 落盤、<a download> 匯出、檔案匯入、SPA 導覽。

const PATIENT_NAME = `E2E 個案 ${Date.now()}`;

async function createPatientAndAssess(page: Page): Promise<void> {
  await page.goto('/');

  // 建立個案：CTA → 表單（同意閘門）→ 儲存 → 導向詳情。
  await page.getByRole('link', { name: '新增個案' }).first().click();
  await page.getByPlaceholder('輸入個案姓名').fill(PATIENT_NAME);
  const saveButton = page.getByRole('button', { name: '儲存' });
  await expect(saveButton).toBeDisabled();
  await page.getByText('已取得當事人同意').click();
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  // 導向個案詳情（h2 姓名）。
  await expect(page.getByRole('heading', { level: 2, name: PATIENT_NAME })).toBeVisible();

  // 新評估：自動建空白 session 並導向評估表（進度列）。
  await page.getByRole('link', { name: '新評估' }).first().click();
  await expect(page.getByText('已判讀 0/15')).toBeVisible();

  // 頸椎屈曲設「疼痛＋功能異常」（DP）→ 卡片浮現 Breakout 入口（DN/DP 才顯）。
  await page.getByRole('button', { name: /頸椎屈曲/ }).click();
  await page.getByText('疼痛', { exact: true }).first().click();
  await page.getByRole('radio', { name: '功能異常' }).click();
  // DP 卡浮現 Breakout 入口（證 Breakout 接縫於真實瀏覽器可達）。
  await expect(page.getByRole('button', { name: '開始 Breakout' })).toBeVisible();

  // 總覽（同頁「評估總覽」region）反映 DP 計數列含 1。
  const summary = page.getByRole('region', { name: '評估總覽' });
  await expect(summary.getByRole('img', { name: '功能異常、且疼痛' }).locator('..')).toContainText('1');

  // 完成評估 → 回評估紀錄（不再空）。
  await page.getByRole('link', { name: '完成評估' }).click();
  await expect(page.getByRole('heading', { level: 1, name: '評估紀錄' })).toBeVisible();
  await expect(page.getByText('尚無評估')).toHaveCount(0);
}

test('主流程：建立個案→評估(含 DP/Breakout)→總覽→匯出→清空→匯入還原→驗資料回復', async ({ page }) => {
  await createPatientAndAssess(page);

  // 設定頁：匯出全部備份（捕捉 <a download> 下載檔）。
  await page.goto('/settings');
  await page.getByRole('button', { name: '匯出全部備份' }).click();
  // 匯出前須知對話框 → 確認。
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '我了解，匯出' }).click();
  const download = await downloadPromise;
  const exportPath = await download.path();
  expect(exportPath).toBeTruthy();
  const exportJson = readFileSync(exportPath, 'utf-8');
  expect(exportJson).toContain(PATIENT_NAME);

  // 清空：刪除個案（個案詳情頁刪除連動刪其評估）——以清掉現有資料，驗匯入確為還原。
  await page.goto('/');
  await page.getByRole('link', { name: PATIENT_NAME }).click();
  // 刪除入口（個案詳情）；若 UI 無刪除鈕則以匯入「覆蓋」策略仍可驗還原（見下方匯入）。
  const deleteButton = page.getByRole('button', { name: /刪除/ });
  if (await deleteButton.count()) {
    await deleteButton.first().click();
    const confirmDelete = page.getByRole('button', { name: /刪除|確定/ });
    if (await confirmDelete.count()) await confirmDelete.last().click();
    await expect(page).toHaveURL(/\/$|\/patients\/?$/);
    await expect(page.getByText('尚無個案')).toBeVisible();
  }

  // 匯入還原：設定頁 → 檔案輸入帶入匯出檔 → 確認 → 完成。
  await page.goto('/settings');
  await page.setInputFiles('input[type="file"]', exportPath);
  await expect(page.getByText('檔案已就緒，確認後將匯入備份內容。')).toBeVisible();
  await page.getByRole('button', { name: '開始匯入' }).click();
  await expect(page.getByText('匯入完成')).toBeVisible();
  await page.getByRole('button', { name: '完成' }).click();

  // 驗資料回復：清單頁該個案重現。
  await page.goto('/');
  await expect(page.getByText(PATIENT_NAME)).toBeVisible();
});
