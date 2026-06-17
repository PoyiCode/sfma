// 正式 bundle 驗證（08 §8.9）：dist 內不得含開發者模式專屬程式碼。
// 用法：pnpm build 之後執行 `node infra/scripts/verifyProdBundle.mjs`；CI 於 build 後跑。
// 哨兵：`ptappDevLoggerMarker` 為 dev-only 記錄路徑標記（actionLogger.ts dead branch、VITE_DEV_MODE
// 靜態替換後正式建置剔除）；2026-06-17 移除畫面內行動主控台後，由此哨兵守住開發者記錄路徑之建置隔離。
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const FORBIDDEN_MARKERS = ['ptappDevLoggerMarker'];

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const distDir = join(root, '.output/public');
if (!existsSync(distDir)) {
  console.error('.output/public 不存在 — 請先執行 pnpm build');
  process.exit(2);
}

function collectFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const fullPath = join(dir, name);
    if (statSync(fullPath).isDirectory()) return collectFiles(fullPath);
    return /\.(js|css|html)$/.test(name) ? [fullPath] : [];
  });
}

const offending = [];
for (const file of collectFiles(distDir)) {
  const content = readFileSync(file, 'utf8');
  for (const marker of FORBIDDEN_MARKERS) {
    if (content.includes(marker)) offending.push({ file: file.slice(root.length + 1), marker });
  }
}

if (offending.length > 0) {
  console.error('正式 bundle 含開發者模式程式碼（08 §8.9 違規）：');
  for (const { file, marker } of offending) console.error(`  ${file} ← "${marker}"`);
  process.exit(1);
}
console.log(`verifyProdBundle: OK（${FORBIDDEN_MARKERS.length} 個哨兵皆不在 dist）`);
