# Phase 0 — Nuxt 地基 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 sfma 從空 Nuxt scaffold 變成可編譯、可 lint、可測、能啟動空殼、設計文件已同步、命名規範已強制的地基。

**Architecture:** 以 `ptApp/apps/web` 為行為規格來源，建立 pnpm workspace（Nuxt app 於根 `app/`，純邏輯／資料於 `packages/*`）。框架無關的純函式（devServerHost／actionLogger／redactPii／devServiceWorker／initStorage）連同其 Vitest 測試近 1:1 照搬；Nuxt 設定為 SPA（`ssr:false`），裝上 Nuxt UI／PWA／i18n／Pinia／ESLint 模組；所有頁面為 placeholder，僅證明「路由通＋Nuxt UI 會渲染＋build/dev 跑得起來」。

**Tech Stack:** Nuxt 4.4 + Vue 3.5（SPA）、Nuxt UI、@vite-pwa/nuxt、@nuxtjs/i18n、@pinia/nuxt、@nuxt/eslint、TypeScript 6、Vitest、pnpm workspace。

**來源路徑前綴（本機）：** `E:\programming\projects\ptApp\apps\web`（WSL：`/mnt/e/programming/projects/ptApp/apps/web`）。下稱 `<ptApp>`。
**目標 repo：** `/mnt/e/programming/projects/sfma`（下稱 repo 根，所有路徑相對於此）。

## Global Constraints

- **套件管理器：pnpm workspace**；移除 npm `package-lock.json`。
- **框架：Nuxt 4.4；渲染 SPA `ssr: false`**（local-first、IndexedDB/Babylon 僅 client）。
- **命名規範（嚴禁 snake_case）**：變數/函式 camelCase、類別/型別/元件 PascalCase、常數/環境變數 UPPER_CASE、CSS token kebab-case。適用程式碼識別字、JSON 鍵名、程式碼檔名。
- **i18n 預設語言 zh-TW**。
- **開發者模式建置旗標 `VITE_DEV_MODE`**：經 `nuxt.config` 的 `vite.define` 靜態替換 → 正式建置 dead-code 剔除（`actionLogger` no-op、哨兵 `ptappDevLoggerMarker` 不得進正式 bundle）。dev server host 由 `VITE_DEV_MODE` 閘控：`'true'`→`0.0.0.0`，否則 `localhost`。
- **packages 名稱維持** `@ptapp/shared`、`@ptapp/definitions`（減少 import 改動）。
- **測試：Vitest**；測試檔與被測檔同層、命名 `xxx.test.ts`。
- **文件語言 zh-tw**。
- **正式建置輸出目錄：`.output/public`**（Nuxt SPA `nuxt build`）。

---

### Task 1: pnpm workspace + tsconfig.base + 根 scripts + Vitest 設定（packages 綠）

**Files:**
- Delete: `package-lock.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Modify: `package.json`（packageManager／engines／scripts）

**Interfaces:**
- Produces: pnpm workspace（`packages/*`）、根 npm scripts（`dev`/`build`/`preview`/`generate`/`postinstall`/`test`/`typecheck`/`lint`/`format`/`verify:bundle`/`prepare`）、根 `vitest.config.ts`（node 環境，include packages/app/config/infra 之 `*.test.ts`）、`tsconfig.base.json`（供 `packages/*/tsconfig.json` 之 `extends`）。

- [ ] **Step 1: 移除 npm lockfile**

```bash
cd /mnt/e/programming/projects/sfma
rm -f package-lock.json
```

- [ ] **Step 2: 建立 `pnpm-workspace.yaml`**

```yaml
packages:
  - 'packages/*'
```

- [ ] **Step 3: 建立 `tsconfig.base.json`**（照搬 `<ptApp>/../tsconfig.base.json`）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "isolatedModules": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "noEmit": true
  }
}
```

- [ ] **Step 4: 建立根 `vitest.config.ts`**（單一根設定，node 環境，涵蓋 packages 與後續 app/config/infra 純測試）

```ts
import { defineConfig } from 'vitest/config';

// Phase 0 測試為框架無關純函式（node 安全：以 typeof navigator/document 守衛）。
// 元件/DOM 測試（@vue/test-utils、@nuxt/test-utils、jsdom）於 Phase 7 另設 project。
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'packages/**/*.test.ts',
      'app/**/*.test.ts',
      'config/**/*.test.ts',
      'infra/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/.nuxt/**', '**/.output/**'],
  },
});
```

- [ ] **Step 5: 改寫 `package.json`**（保留 `name`/`type`/`private`；加 packageManager、engines、scripts）

```json
{
  "name": "sfma",
  "type": "module",
  "private": true,
  "packageManager": "pnpm@11.3.0",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "generate": "nuxt generate",
    "preview": "nuxt preview",
    "postinstall": "nuxt prepare",
    "test": "vitest run",
    "typecheck": "nuxt typecheck && tsc --noEmit -p packages/shared && tsc --noEmit -p packages/definitions",
    "lint": "eslint .",
    "format": "prettier --write .",
    "verify:bundle": "node infra/scripts/verifyProdBundle.mjs",
    "prepare": "husky"
  },
  "dependencies": {
    "nuxt": "^4.4.8",
    "vue": "^3.5.35",
    "vue-router": "^5.1.0"
  },
  "devDependencies": {
    "husky": "^9.1.7",
    "vitest": "^4.1.8"
  }
}
```

> `husky` 於此即納入（非 Task 3）：`prepare: husky` 為 install 生命週期腳本，husky 未裝會使 `pnpm install` 失敗。

- [ ] **Step 6: 安裝並驗證 packages 測試綠**

Run:
```bash
cd /mnt/e/programming/projects/sfma
pnpm install
pnpm test
```
Expected: `pnpm install` 成功（生成 `pnpm-lock.yaml`）；`pnpm test` 跑出 `packages/shared` 與 `packages/definitions` 既有測試且全綠（PASS）。

> pnpm 11 預設封鎖原生 build 腳本。首次 install 會於 `pnpm-workspace.yaml` 追加 `allowBuilds` 提示；將 Nuxt/Vite 之 `esbuild`、`@parcel/watcher` 設為 `true` 後再跑一次 `pnpm install`。

> 注意：`nuxt prepare`（postinstall）此時可能因尚無模組設定而僅生成 `.nuxt` 基礎型別，屬正常。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: pnpm workspace 地基（tsconfig.base、根 scripts、vitest config）"
```

---

### Task 2: Nuxt 核心設定（SPA + DEV_MODE define）+ devServerHost（測試+實作）

**Files:**
- Create: `config/devServerHost.ts`
- Create: `config/devServerHost.test.ts`
- Modify: `nuxt.config.ts`
- Create: `.env`、`.env.development`

**Interfaces:**
- Produces: `resolveDevServerHost(viteDevMode: string | undefined): string`（`'true'`→`'0.0.0.0'`，否則 `'localhost'`）；`nuxt.config` 設 `ssr:false`、`vite.define['import.meta.env.VITE_DEV_MODE']`（靜態替換）、`devServer.host`。
- Consumes（後續 Task）：`import.meta.env.VITE_DEV_MODE` 靜態旗標。

- [ ] **Step 1: 寫 failing test**（照搬 `<ptApp>/src/config/devServerHost.test.ts` 之行為）

`config/devServerHost.test.ts`：
```ts
import { describe, expect, it } from 'vitest';
import { resolveDevServerHost } from './devServerHost';

describe('resolveDevServerHost', () => {
  it("'true' → 0.0.0.0（開發者模式：區網可及）", () => {
    expect(resolveDevServerHost('true')).toBe('0.0.0.0');
  });
  it("'false' → localhost（僅本機）", () => {
    expect(resolveDevServerHost('false')).toBe('localhost');
  });
  it('undefined → localhost（預設關閉）', () => {
    expect(resolveDevServerHost(undefined)).toBe('localhost');
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `pnpm test -- config/devServerHost.test.ts`
Expected: FAIL（`Cannot find module './devServerHost'`）。

- [ ] **Step 3: 寫實作 `config/devServerHost.ts`**（照搬 ptApp 原檔）

```ts
// dev server host：依開發者模式（建置旗標 VITE_DEV_MODE，02 §2.11、08 §8.9）閘控。
// 開發者模式才綁 0.0.0.0（全介面、區網可及，供 iOS 等實機經 http 區網 IP 測試）；
// 否則 localhost（僅本機，不誤將 dev server 曝露於區網）。非 'true' 一律視為關閉。
// 由 nuxt.config.ts 消費。
export function resolveDevServerHost(viteDevMode: string | undefined): string {
  return viteDevMode === 'true' ? '0.0.0.0' : 'localhost';
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `pnpm test -- config/devServerHost.test.ts`
Expected: PASS（3 passed）。

- [ ] **Step 5: 改寫 `nuxt.config.ts`**

```ts
import { resolveDevServerHost } from './config/devServerHost';

// 開發者模式建置旗標：VITE_DEV_MODE='true' 才開（dev server 綁 0.0.0.0、actionLogger 輸出 console）。
// 經 vite.define 靜態替換 import.meta.env.VITE_DEV_MODE → 正式建置 dead-code 剔除（02 §2.11、08 §8.9）。
const VITE_DEV_MODE = process.env.VITE_DEV_MODE ?? 'false';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  ssr: false, // SPA：local-first（IndexedDB/Babylon 僅 client），無 SSR 水合問題（master plan F-3）
  devtools: { enabled: true },
  devServer: {
    host: resolveDevServerHost(VITE_DEV_MODE),
    port: 5173,
  },
  vite: {
    define: {
      'import.meta.env.VITE_DEV_MODE': JSON.stringify(VITE_DEV_MODE),
    },
  },
});
```

- [ ] **Step 6: 建立 env 檔**

`.env`（正式預設關閉）：
```
VITE_DEV_MODE=false
```
`.env.development`（dev 預設開）：
```
VITE_DEV_MODE=true
```

- [ ] **Step 7: 驗證 dev 與 build 啟動**

Run:
```bash
pnpm build
```
Expected: `nuxt build` 成功，生成 `.output/public`（SPA）。

> dev 啟動可選驗（背景跑後關閉）：`pnpm dev` 應於 `http://localhost:5173`（或 `VITE_DEV_MODE=true` 時 `0.0.0.0:5173`）啟動，顯示預設 Nuxt 畫面。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: Nuxt SPA 核心設定 + VITE_DEV_MODE 旗標 + devServerHost 閘控"
```

---

### Task 3: Tooling — @nuxt/eslint + ESLint flat（vue + naming-convention）+ Prettier + husky + lint-staged

**Files:**
- Modify: `package.json`（devDependencies、lint-staged、modules 由 nuxt.config）
- Modify: `nuxt.config.ts`（加 `@nuxt/eslint` module）
- Create: `eslint.config.mjs`
- Create: `.prettierrc.json`、`.prettierignore`
- Create: `.husky/pre-commit`

**Interfaces:**
- Consumes: Task 2 的 `nuxt.config.ts`。
- Produces: `pnpm lint` 強制 naming-convention（禁 snake_case）；pre-commit 跑 lint-staged。

- [ ] **Step 1: 安裝 tooling 相依**

```bash
pnpm add -D @nuxt/eslint eslint typescript-eslint eslint-config-prettier prettier husky lint-staged vue-tsc
```

- [ ] **Step 2: 在 `nuxt.config.ts` 的 `modules` 加入 `@nuxt/eslint`**

於 `defineNuxtConfig({...})` 內新增（若尚無 `modules` 則新增此鍵）：
```ts
  modules: ['@nuxt/eslint'],
```

- [ ] **Step 3: 建立 `eslint.config.mjs`**（以 Nuxt 產生的扁平設定為底，append naming-convention，照搬 ptApp 07 §7.1 規則）

```js
// @nuxt/eslint 產生 .nuxt/eslint.config.mjs（含 eslint-plugin-vue、typescript-eslint、vue-eslint-parser）。
// 於其上 append 命名規則（07 §7.1）：camelCase/PascalCase/UPPER_CASE、嚴禁 snake_case。
import withNuxt from './.nuxt/eslint.config.mjs';
import configPrettier from 'eslint-config-prettier';

export default withNuxt(
  {
    files: ['**/*.{ts,tsx,vue,mjs}'],
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
    },
  },
  configPrettier,
);
```

- [ ] **Step 4: 建立 Prettier 設定**（照搬 ptApp）

`.prettierrc.json`：
```json
{ "singleQuote": true, "printWidth": 100 }
```
`.prettierignore`：
```
.nuxt
.output
dist
node_modules
public
pnpm-lock.yaml
```

- [ ] **Step 5: 加 `lint-staged` 設定到 `package.json`**（副檔名加 `.vue`）

於 `package.json` 根新增：
```json
  "lint-staged": {
    "*.{ts,tsx,vue}": ["eslint --fix", "prettier --write"],
    "*.{css,html,json,yml,yaml,mjs,md}": ["prettier --write"]
  }
```

- [ ] **Step 6: 設定 husky pre-commit**

```bash
pnpm exec husky init
```
覆寫 `.husky/pre-commit` 內容為：
```sh
pnpm exec lint-staged
```

- [ ] **Step 7: 跑 lint 驗證**

Run:
```bash
pnpm install
pnpm lint
```
Expected: `pnpm lint` 綠（0 errors）。若 `.nuxt/eslint.config.mjs` 尚未生成，先跑 `pnpm postinstall`（`nuxt prepare`）再 lint。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: ESLint(@nuxt/eslint + naming-convention) + Prettier + husky + lint-staged"
```

---

### Task 4: devtools — actionLogger + redactPii（測試+實作）+ verifyProdBundle 哨兵

**Files:**
- Create: `app/utils/devtools/redactPii.ts`
- Create: `app/utils/devtools/redactPii.test.ts`
- Create: `app/utils/devtools/actionLogger.ts`
- Create: `app/utils/devtools/actionLogger.test.ts`
- Create: `infra/scripts/verifyProdBundle.mjs`

**Interfaces:**
- Consumes: `import.meta.env.VITE_DEV_MODE`（Task 2 靜態替換）。
- Produces:
  - `redactPii(text: string): string`
  - `interface ActionLogger { log/warn/error(module: string, action: string, detail?: string): void }`
  - `createConsoleActionLogger(out?: ConsoleSink): ActionLogger`、`createNoopActionLogger(): ActionLogger`
  - `actionLogger: ActionLogger`（singleton；dev→console、prod→no-op）
  - `infra/scripts/verifyProdBundle.mjs`（掃 `.output/public`，禁含 `ptappDevLoggerMarker`）

- [ ] **Step 1: 寫 redactPii failing test**（照搬 ptApp 行為要點）

`app/utils/devtools/redactPii.test.ts`：
```ts
import { describe, expect, it } from 'vitest';
import { redactPii } from './redactPii';

describe('redactPii', () => {
  it('遮蔽 email', () => {
    expect(redactPii('寄到 a.b+1@mail.example.com 了')).toBe('寄到 [已遮蔽:電子郵件] 了');
  });
  it('遮蔽身分證', () => {
    expect(redactPii('A123456789')).toBe('[已遮蔽:身分證]');
  });
  it('遮蔽手機', () => {
    expect(redactPii('0912345678')).toBe('[已遮蔽:電話]');
  });
  it('UUID 不被誤遮蔽', () => {
    const uuid = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
    expect(redactPii(uuid)).toBe(uuid);
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `pnpm test -- app/utils/devtools/redactPii.test.ts`
Expected: FAIL（找不到模組）。

- [ ] **Step 3: 寫 `redactPii.ts`**（照搬 ptApp 原檔）

```ts
// 去個資（PII）遮蔽：開發者動作記錄 detail 的縱深防禦（08 §8.9）。
// detail 慣例僅含識別碼（如 patientId UUID）；此為防呼叫端不慎帶入結構化個資的最後防線。
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const ROC_ID_PATTERN = /\b[A-Z][12]\d{8}\b/g;
const TW_MOBILE_PATTERN = /\b09\d{8}\b/g;

export function redactPii(text: string): string {
  return text
    .replace(EMAIL_PATTERN, '[已遮蔽:電子郵件]')
    .replace(ROC_ID_PATTERN, '[已遮蔽:身分證]')
    .replace(TW_MOBILE_PATTERN, '[已遮蔽:電話]');
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `pnpm test -- app/utils/devtools/redactPii.test.ts`
Expected: PASS（4 passed）。

- [ ] **Step 5: 寫 actionLogger failing test**

`app/utils/devtools/actionLogger.test.ts`：
```ts
import { describe, expect, it, vi } from 'vitest';
import { createConsoleActionLogger, createNoopActionLogger } from './actionLogger';

describe('createConsoleActionLogger', () => {
  it('格式 [module] action — detail（detail 經 redactPii）', () => {
    const out = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const logger = createConsoleActionLogger(out);
    logger.log('navigation', 'routeChange', '/a→/b');
    expect(out.log).toHaveBeenCalledWith('[navigation] routeChange — /a→/b');
  });
  it('無 detail 時僅 [module] action', () => {
    const out = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    createConsoleActionLogger(out).warn('data', 'persistStorage');
    expect(out.warn).toHaveBeenCalledWith('[data] persistStorage');
  });
  it('detail 內個資被遮蔽', () => {
    const out = { log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    createConsoleActionLogger(out).log('settings', 'x', 'a@b.com');
    expect(out.log).toHaveBeenCalledWith('[settings] x — [已遮蔽:電子郵件]');
  });
});

describe('createNoopActionLogger', () => {
  it('不呼叫任何 sink、不拋', () => {
    const logger = createNoopActionLogger();
    expect(() => logger.log('m', 'a', 'd')).not.toThrow();
  });
});
```

- [ ] **Step 6: 跑測試確認 fail**

Run: `pnpm test -- app/utils/devtools/actionLogger.test.ts`
Expected: FAIL（找不到模組）。

- [ ] **Step 7: 寫 `actionLogger.ts`**（照搬 ptApp 原檔，gate 用 `import.meta.env.VITE_DEV_MODE`）

```ts
// 全 APP 共用動作記錄（02 §2.11、07 §7.6）：dev 模式輸出至瀏覽器 console、正式建置 no-op。
// 呼叫點不需條件包裹：正式建置 singleton 為 no-op。
import { redactPii } from './redactPii';

export interface ActionLogger {
  log(module: string, action: string, detail?: string): void;
  warn(module: string, action: string, detail?: string): void;
  error(module: string, action: string, detail?: string): void;
}

type ConsoleSink = Pick<Console, 'log' | 'warn' | 'error'>;

function formatLine(module: string, action: string, detail?: string): string {
  const head = `[${module}] ${action}`;
  return detail === undefined ? head : `${head} — ${redactPii(detail)}`;
}

export function createConsoleActionLogger(out: ConsoleSink = console): ActionLogger {
  return {
    log: (module, action, detail) => out.log(formatLine(module, action, detail)),
    warn: (module, action, detail) => out.warn(formatLine(module, action, detail)),
    error: (module, action, detail) => out.error(formatLine(module, action, detail)),
  };
}

export function createNoopActionLogger(): ActionLogger {
  return { log: () => {}, warn: () => {}, error: () => {} };
}

// 旗標經 vite.define 靜態替換後 dead branch 可消除（02 §2.11）
export const actionLogger: ActionLogger =
  import.meta.env.VITE_DEV_MODE === 'true' ? createConsoleActionLogger() : createNoopActionLogger();

// 正式建置隔離哨兵（08 §8.9 verifyProdBundle）：dev-only 記錄路徑標記。
// VITE_DEV_MODE 建置期靜態替換 → 正式建置此 dead branch 連同字串整段剔除，dist 不含 ptappDevLoggerMarker。
if (import.meta.env.VITE_DEV_MODE === 'true') {
  (globalThis as Record<string, unknown>).__ptappDevLoggerMarker = 'ptappDevLoggerMarker';
}
```

- [ ] **Step 8: 跑測試確認 pass**

Run: `pnpm test -- app/utils/devtools/actionLogger.test.ts`
Expected: PASS（4 passed）。

- [ ] **Step 9: 寫 `infra/scripts/verifyProdBundle.mjs`**（照搬 ptApp，distDir 改 `.output/public`）

```js
// 正式 bundle 驗證（08 §8.9）：正式輸出內不得含開發者模式專屬程式碼。
// 用法：pnpm build 後執行 `node infra/scripts/verifyProdBundle.mjs`；CI 於 build 後跑。
// 哨兵 ptappDevLoggerMarker：actionLogger.ts dead branch（VITE_DEV_MODE 靜態替換後正式建置剔除）。
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
console.log(`verifyProdBundle: OK（${FORBIDDEN_MARKERS.length} 個哨兵皆不在輸出）`);
```

> 註：完整 `pnpm build && pnpm verify:bundle` 之有效驗證於 Task 10（navigation plugin 匯入 actionLogger 後 marker 才會進 bundle 路徑）與 Task 12 最終門檻執行。

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: devtools actionLogger + redactPii（建置旗標 dead-code）+ verifyProdBundle 哨兵"
```

---

### Task 5: CI workflow（pnpm）

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: 根 scripts（lint/typecheck/test/build/verify:bundle）。

- [ ] **Step 1: 建立 `.github/workflows/ci.yml`**（照搬 ptApp，移除尚未存在的步驟）

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4 # 版本取根 package.json 之 packageManager
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
      - run: pnpm verify:bundle
      # E2E（Playwright）於 Phase 7 測試輪加入（07 §7.7）
```

- [ ] **Step 2: 本機預演 CI 指令鏈**

Run:
```bash
pnpm install --frozen-lockfile
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm verify:bundle
```
Expected: 全部成功（綠）。

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "ci: lint→typecheck→test→build→verify:bundle（pnpm）"
```

---

### Task 6: Pinia — @pinia/nuxt + 空 store 骨架

**Files:**
- Modify: `nuxt.config.ts`（modules 加 `@pinia/nuxt`）
- Create: `app/stores/app.ts`

**Interfaces:**
- Produces: `useAppStore()`（空骨架，內容隨模組長出）。

- [ ] **Step 1: 安裝**

```bash
pnpm add pinia @pinia/nuxt
```

- [ ] **Step 2: `nuxt.config.ts` modules 加入 `@pinia/nuxt`**

```ts
  modules: ['@nuxt/eslint', '@pinia/nuxt'],
```

- [ ] **Step 3: 建立空 store `app/stores/app.ts`**

```ts
import { defineStore } from 'pinia';

// App 全域 store 骨架（Phase 0 佔位；patient/assessment/settings 等 store 於各模組 Phase 加入）。
export const useAppStore = defineStore('app', {
  state: () => ({ ready: false }),
});
```

- [ ] **Step 4: 驗證 build**

Run: `pnpm postinstall && pnpm build`
Expected: 成功。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: @pinia/nuxt + 空 app store 骨架"
```

---

### Task 7: i18n — @nuxtjs/i18n（zh-TW 預設）+ 殼層 locale 骨架

**Files:**
- Modify: `nuxt.config.ts`（modules 加 `@nuxtjs/i18n`、i18n 設定）
- Create: `i18n/locales/zh-TW.json`

**Interfaces:**
- Produces: 預設 locale `zh-TW`、`$t('titlePatients')` 等殼層字串；`<html lang>` 由模組管理。
- Consumes（後續）：頁面以 `useI18n()`／`$t` 取字串。

- [ ] **Step 1: 安裝**

```bash
pnpm add @nuxtjs/i18n
```

- [ ] **Step 2: `nuxt.config.ts` 加入 `@nuxtjs/i18n` 與設定**

modules 與新 `i18n` 區塊：
```ts
  modules: ['@nuxt/eslint', '@pinia/nuxt', '@nuxtjs/i18n'],
  i18n: {
    defaultLocale: 'zh-TW',
    locales: [{ code: 'zh-TW', language: 'zh-TW', file: 'zh-TW.json' }],
    strategy: 'no_prefix', // 單機 app 不以網址前綴分語系
    bundle: { optimizeTranslationDirective: false },
  },
```

- [ ] **Step 3: 建立 `i18n/locales/zh-TW.json`**（先搬殼層必要字串，取自 `<ptApp>/src/i18n/index.ts`；模組字串隨各 Phase 補）

```json
{
  "appTitle": "物理治療評估",
  "notFound": "找不到頁面",
  "skipToContent": "跳至主內容",
  "backHome": "回首頁",
  "navBack": "返回",
  "navSettings": "設定",
  "titlePatients": "個案清單",
  "titlePatientNew": "新增個案",
  "titlePatientDetail": "個案詳情",
  "titlePatientEdit": "編輯個案",
  "titleAssessments": "評估紀錄",
  "titleAssessmentNew": "新評估",
  "titleAssessmentSession": "評估表",
  "titleModel": "人體模型",
  "titleSettings": "設定",
  "screenTodo": "此畫面尚在建置"
}
```

- [ ] **Step 4: 驗證 build**

Run: `pnpm postinstall && pnpm build`
Expected: 成功；i18n 模組註冊、預設 zh-TW。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: @nuxtjs/i18n（zh-TW 預設）+ 殼層 locale 骨架"
```

---

### Task 8: PWA — @vite-pwa/nuxt manifest + dev SW off + devServiceWorker（測試+實作）

**Files:**
- Modify: `nuxt.config.ts`（modules 加 `@vite-pwa/nuxt`、pwa 設定）
- Create: `app/utils/pwa/devServiceWorker.ts`
- Create: `app/utils/pwa/devServiceWorker.test.ts`

**Interfaces:**
- Produces:
  - PWA manifest（name/short_name/lang/theme/icons）、`registerType:'autoUpdate'`、dev `devOptions.enabled:false`
  - `unregisterServiceWorkersAndClearCaches(deps?: ServiceWorkerCleanupDeps): Promise<void>`
- 說明：precache／runtimeCaching 白名單**延後 Phase 6**；本 Task 僅最小 manifest + 模組裝好 + dev 清 SW 工具。

- [ ] **Step 1: 安裝**

```bash
pnpm add -D @vite-pwa/nuxt
```

- [ ] **Step 2: `nuxt.config.ts` 加入 `@vite-pwa/nuxt` 與最小 pwa 設定**

modules 與新 `pwa` 區塊：
```ts
  modules: ['@nuxt/eslint', '@pinia/nuxt', '@nuxtjs/i18n', '@vite-pwa/nuxt'],
  pwa: {
    registerType: 'autoUpdate',
    devOptions: { enabled: false }, // 開發模式停用 SW（取消離線載入）；正式建置不受影響
    manifest: {
      name: '物理治療評估',
      short_name: 'sfma',
      lang: 'zh-TW',
      display: 'standalone',
      start_url: '/',
      theme_color: '#0e7490',
      background_color: '#F8FAFC',
      icons: [
        { src: 'icons/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    // workbox precache/runtimeCaching 白名單於 Phase 6 上線（殼層完成後才有意義）
  },
```

- [ ] **Step 3: 寫 devServiceWorker failing test**（照搬 ptApp 行為：注入式、無支援略過不拋）

`app/utils/pwa/devServiceWorker.test.ts`：
```ts
import { describe, expect, it, vi } from 'vitest';
import { unregisterServiceWorkersAndClearCaches } from './devServiceWorker';

describe('unregisterServiceWorkersAndClearCaches', () => {
  it('反註冊所有 SW 並清空所有 cache', async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const serviceWorker = {
      getRegistrations: vi.fn().mockResolvedValue([{ unregister }, { unregister }]),
    } as unknown as ServiceWorkerContainer;
    const del = vi.fn().mockResolvedValue(true);
    const cacheStorage = {
      keys: vi.fn().mockResolvedValue(['a', 'b']),
      delete: del,
    } as unknown as CacheStorage;

    await unregisterServiceWorkersAndClearCaches({ serviceWorker, cacheStorage });

    expect(unregister).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith('a');
    expect(del).toHaveBeenCalledWith('b');
  });

  it('不支援（null）時安全略過、不拋', async () => {
    await expect(
      unregisterServiceWorkersAndClearCaches({ serviceWorker: null, cacheStorage: null }),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 4: 跑測試確認 fail**

Run: `pnpm test -- app/utils/pwa/devServiceWorker.test.ts`
Expected: FAIL（找不到模組）。

- [ ] **Step 5: 寫 `devServiceWorker.ts`**（照搬 ptApp 原檔）

```ts
// 開發模式停用離線載入（取消 Service Worker）：dev 不註冊 SW，並主動移除既有 SW 與其快取——
// 清除先前 prod build／preview 殘留之 SW，否則於 dev 持續攔截、回舊版資產。
// 純函式、注入式（便於測試）、環境守衛：jsdom 與非安全 http 區網無 navigator.serviceWorker／caches，安全略過。
export interface ServiceWorkerCleanupDeps {
  serviceWorker?: ServiceWorkerContainer | null;
  cacheStorage?: CacheStorage | null;
}

function resolveDeps(deps: ServiceWorkerCleanupDeps): {
  serviceWorker: ServiceWorkerContainer | null;
  cacheStorage: CacheStorage | null;
} {
  const serviceWorker =
    'serviceWorker' in deps
      ? (deps.serviceWorker ?? null)
      : typeof navigator !== 'undefined' && 'serviceWorker' in navigator
        ? navigator.serviceWorker
        : null;
  const cacheStorage =
    'cacheStorage' in deps
      ? (deps.cacheStorage ?? null)
      : typeof globalThis !== 'undefined' && 'caches' in globalThis
        ? globalThis.caches
        : null;
  return { serviceWorker, cacheStorage };
}

export async function unregisterServiceWorkersAndClearCaches(
  deps: ServiceWorkerCleanupDeps = {},
): Promise<void> {
  const { serviceWorker, cacheStorage } = resolveDeps(deps);
  if (serviceWorker) {
    try {
      const registrations = await serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch {
      // 不支援／非安全環境：略過。
    }
  }
  if (cacheStorage) {
    try {
      const keys = await cacheStorage.keys();
      await Promise.all(keys.map((key) => cacheStorage.delete(key)));
    } catch {
      // 略過。
    }
  }
}
```

- [ ] **Step 6: 跑測試確認 pass**

Run: `pnpm test -- app/utils/pwa/devServiceWorker.test.ts`
Expected: PASS（2 passed）。

- [ ] **Step 7: 驗證 build**

Run: `pnpm postinstall && pnpm build`
Expected: 成功；PWA manifest 產生於 `.output/public`。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: @vite-pwa/nuxt manifest + dev SW 停用 + devServiceWorker 清理工具"
```

---

### Task 9: App shell — @nuxt/ui + app.vue(UApp) + 預設 layout + placeholder 頁

**Files:**
- Modify: `nuxt.config.ts`（modules 加 `@nuxt/ui`）
- Modify: `app/app.vue`
- Create: `app/layouts/default.vue`
- Create: `app/pages/index.vue`
- Create: `app/pages/settings.vue`
- Create: `app/pages/patients/new.vue`
- Create: `app/pages/patients/[patientId].vue`
- Create: `app/pages/patients/[patientId]/index.vue`
- Create: `app/pages/patients/[patientId]/assessments/index.vue`
- Create: `app/pages/patients/[patientId]/assessments/new.vue`
- Create: `app/pages/patients/[patientId]/assessments/[sessionId].vue`
- Create: `app/pages/patients/[patientId]/model.vue`
- Create: `app/pages/patients/[patientId]/edit.vue`
- Create: `app/pages/[...notFound].vue`

**Interfaces:**
- Consumes: `@nuxtjs/i18n` 之 `$t`（Task 7）。
- Produces: 路由骨架（對映 `<ptApp>/src/app/router.tsx`）；每頁 placeholder + `useHead` 標題。

> **路由對映說明（faithful 註記）**：原 `router.tsx` 中 `patients/:patientId/edit` 為與 detail 平行的獨立頁；Nuxt 檔案路由下 `patients/[patientId]/edit.vue` 會成為 `patients/[patientId].vue` 的子路由（渲染於其 `<NuxtPage>`）。Phase 0 placeholder 不受影響；「edit 是否獨立於 detail 殼層」之確切呈現於 Phase 4 定案。

- [ ] **Step 1: 安裝 Nuxt UI**

```bash
pnpm add @nuxt/ui
```

- [ ] **Step 2: `nuxt.config.ts` modules 加入 `@nuxt/ui`**

```ts
  modules: ['@nuxt/ui', '@nuxt/eslint', '@pinia/nuxt', '@nuxtjs/i18n', '@vite-pwa/nuxt'],
```

- [ ] **Step 3: 改寫 `app/app.vue`**（移除 NuxtWelcome → UApp + Layout + Page）

```vue
<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

- [ ] **Step 4: 建立 `app/layouts/default.vue`**（AppBar 殼，鏡像 `<ptApp>` AppShell/AppBar，內容 placeholder）

```vue
<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <div class="appShell">
    <a class="skipLink" href="#appMain">{{ t('skipToContent') }}</a>
    <header class="appBar">
      <h1 class="appBarTitle">{{ t('appTitle') }}</h1>
      <UButton :to="'/settings'" :aria-label="t('navSettings')" icon="i-lucide-settings" variant="ghost" />
    </header>
    <main id="appMain" class="appContent" tabindex="-1">
      <slot />
    </main>
  </div>
</template>
```

> 註：完整 AppBar（情境標題、返回鍵、master-detail、方向/斷點 data-*）於 Phase 6 移植；此處僅殼層 placeholder。

- [ ] **Step 5: 建立各 placeholder 頁**

`app/pages/index.vue`（病患清單）：
```vue
<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titlePatients') });
</script>

<template>
  <UCard>
    <h2>{{ t('titlePatients') }}（placeholder）</h2>
    <p>{{ t('screenTodo') }}（Phase 4）</p>
    <UButton to="/settings">{{ t('navSettings') }}</UButton>
  </UCard>
</template>
```

`app/pages/settings.vue`：
```vue
<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titleSettings') });
</script>

<template>
  <UCard>
    <h2>{{ t('titleSettings') }}（placeholder）</h2>
    <p>{{ t('screenTodo') }}（Phase 6）</p>
    <UButton to="/">{{ t('backHome') }}</UButton>
  </UCard>
</template>
```

`app/pages/patients/new.vue`：
```vue
<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titlePatientNew') });
</script>

<template>
  <UCard><h2>{{ t('titlePatientNew') }}（placeholder）</h2><p>{{ t('screenTodo') }}（Phase 4）</p></UCard>
</template>
```

`app/pages/patients/[patientId].vue`（detail 父頁，含巢狀出口）：
```vue
<script setup lang="ts">
const { t } = useI18n();
const route = useRoute();
useHead({ title: () => t('titlePatientDetail') });
</script>

<template>
  <UCard>
    <h2>{{ t('titlePatientDetail') }}（placeholder）— id: {{ route.params.patientId }}</h2>
    <NuxtPage />
  </UCard>
</template>
```

`app/pages/patients/[patientId]/index.vue`（導向 assessments）：
```vue
<script setup lang="ts">
const route = useRoute();
await navigateTo(`/patients/${route.params.patientId}/assessments`, { replace: true });
</script>

<template><div /></template>
```

`app/pages/patients/[patientId]/assessments/index.vue`：
```vue
<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titleAssessments') });
</script>

<template><div><h3>{{ t('titleAssessments') }}（placeholder）</h3><p>{{ t('screenTodo') }}（Phase 4）</p></div></template>
```

`app/pages/patients/[patientId]/assessments/new.vue`：
```vue
<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titleAssessmentNew') });
</script>

<template><div><h3>{{ t('titleAssessmentNew') }}（placeholder）</h3></div></template>
```

`app/pages/patients/[patientId]/assessments/[sessionId].vue`：
```vue
<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titleAssessmentSession') });
</script>

<template><div><h3>{{ t('titleAssessmentSession') }}（placeholder）</h3></div></template>
```

`app/pages/patients/[patientId]/model.vue`：
```vue
<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titleModel') });
</script>

<template><div><h3>{{ t('titleModel') }}（placeholder）</h3><p>{{ t('screenTodo') }}（Phase 5）</p></div></template>
```

`app/pages/patients/[patientId]/edit.vue`：
```vue
<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('titlePatientEdit') });
</script>

<template><div><h3>{{ t('titlePatientEdit') }}（placeholder）</h3></div></template>
```

`app/pages/[...notFound].vue`（404，保留 layout 殼層）：
```vue
<script setup lang="ts">
const { t } = useI18n();
useHead({ title: () => t('notFound') });
</script>

<template>
  <UCard><h2>{{ t('notFound') }}</h2><UButton to="/">{{ t('backHome') }}</UButton></UCard>
</template>
```

- [ ] **Step 6: 驗證 build 與 dev 路由**

Run:
```bash
pnpm postinstall
pnpm build
```
Expected: `nuxt build` 成功（所有頁面編譯通過）。

手動 dev 驗證（背景啟動後操作再關閉）：
```bash
pnpm dev
```
Expected：`/` 顯示病患清單 placeholder（Nuxt UI `UCard`/`UButton` 渲染）；點設定鈕到 `/settings`；手動進 `/patients/p1` 顯示 detail placeholder 並自動導向 `/patients/p1/assessments`；亂打網址 `/zzz` 顯示 404 placeholder（仍在 layout 殼內）。

> Phase 0 不為路由建自動化元件測試（@vue/test-utils／@nuxt/test-utils 於 Phase 7 設置）；此處以 `pnpm build` 成功 + dev 手動 smoke 為驗收。

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: App shell（@nuxt/ui UApp + 預設 layout + 路由 placeholder 頁）"
```

---

### Task 10: 啟動 plugins — navigation actionLogger + persistentStorage + theme/locale no-op 骨架

**Files:**
- Create: `app/utils/data/initStorage.ts`
- Create: `app/utils/data/initStorage.test.ts`
- Create: `app/plugins/actionLoggerNavigation.client.ts`
- Create: `app/plugins/appStartup.client.ts`

**Interfaces:**
- Consumes: `actionLogger`（Task 4）、Vue Router（`useRouter`）。
- Produces:
  - `requestPersistentStorage(storage?): Promise<'granted' | 'denied' | 'unsupported'>`
  - navigation plugin：路由 `afterEach` → `actionLogger.log('navigation','routeChange', 'from→to')`（令 actionLogger 進 client bundle，使 verifyProdBundle 成為有效守衛）
  - startup plugin：`requestPersistentStorage()`；theme/locale 啟動套用為 **no-op 佔位**（Phase 1 接資料層）

- [ ] **Step 1: 寫 initStorage failing test**（照搬 ptApp 行為）

`app/utils/data/initStorage.test.ts`：
```ts
import { describe, expect, it, vi } from 'vitest';
import { requestPersistentStorage } from './initStorage';

describe('requestPersistentStorage', () => {
  it('persist() → true 回 granted', async () => {
    expect(await requestPersistentStorage({ persist: vi.fn().mockResolvedValue(true) })).toBe('granted');
  });
  it('persist() → false 回 denied', async () => {
    expect(await requestPersistentStorage({ persist: vi.fn().mockResolvedValue(false) })).toBe('denied');
  });
  it('無 storage 回 unsupported', async () => {
    expect(await requestPersistentStorage(undefined)).toBe('unsupported');
  });
});
```

- [ ] **Step 2: 跑測試確認 fail**

Run: `pnpm test -- app/utils/data/initStorage.test.ts`
Expected: FAIL（找不到模組）。

- [ ] **Step 3: 寫 `initStorage.ts`**（照搬 ptApp，import 路徑改 devtools 新位置）

```ts
import { actionLogger } from '../devtools/actionLogger';

export type PersistResult = 'granted' | 'denied' | 'unsupported';

// 啟動時申請持久儲存（02 §2.6、08 §8.7）：對抗瀏覽器自動清除 IndexedDB。
export async function requestPersistentStorage(
  storage: Pick<StorageManager, 'persist'> | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.storage,
): Promise<PersistResult> {
  if (storage === undefined || typeof storage.persist !== 'function') {
    actionLogger.warn('data', 'persistStorage', 'unsupported');
    return 'unsupported';
  }
  try {
    if (await storage.persist()) {
      actionLogger.log('data', 'persistStorage', 'granted');
      return 'granted';
    }
    actionLogger.warn('data', 'persistStorage', 'denied');
    return 'denied';
  } catch {
    actionLogger.warn('data', 'persistStorage', 'unsupported');
    return 'unsupported';
  }
}
```

- [ ] **Step 4: 跑測試確認 pass**

Run: `pnpm test -- app/utils/data/initStorage.test.ts`
Expected: PASS（3 passed）。

- [ ] **Step 5: 寫 navigation plugin `app/plugins/actionLoggerNavigation.client.ts`**

```ts
import { actionLogger } from '../utils/devtools/actionLogger';

// 導覽埋點（02 §2.11；正式建置 actionLogger 為 no-op，免條件包裹）。
// 對應 ptApp main.tsx 之 router.subscribe；Nuxt 以 Vue Router afterEach。
export default defineNuxtPlugin(() => {
  const router = useRouter();
  router.afterEach((to, from) => {
    if (to.fullPath !== from.fullPath) {
      actionLogger.log('navigation', 'routeChange', `${from.fullPath}→${to.fullPath}`);
    }
  });
});
```

- [ ] **Step 6: 寫 startup plugin `app/plugins/appStartup.client.ts`**（persistentStorage 接線；theme/locale 留 no-op 佔位）

```ts
import { requestPersistentStorage } from '../utils/data/initStorage';

// 啟動接線（對應 ptApp main.tsx）。
// Phase 0：申請持久儲存已可獨立運作；theme/locale 啟動套用依賴資料層（Phase 1）→ 此處留佔位 no-op。
export default defineNuxtPlugin(() => {
  // 申請持久儲存，准駁記入 actionLogger（02 §2.6、08 §8.7）
  void requestPersistentStorage();

  // TODO(Phase 1)：自 settings 套用主題偏好（initThemeFromSettings）
  // TODO(Phase 1)：自 settings 套用語系偏好（initLocaleFromSettings）
});
```

> 說明：PWA SW 之 `registerType:'autoUpdate'`（Task 8）已由 `@vite-pwa/nuxt` 在正式建置自動註冊、dev 停用（`devOptions.enabled:false`），無需手寫 register；dev 清理殘留 SW 之 `unregisterServiceWorkersAndClearCaches`（Task 8）於 Phase 6 PWA 上線輪接入啟動流程。

- [ ] **Step 7: 驗證 build + verify:bundle（哨兵此時有效）**

Run:
```bash
pnpm postinstall
pnpm build
pnpm verify:bundle
```
Expected: build 成功；`verify:bundle` 印出 `verifyProdBundle: OK`（正式建置 `VITE_DEV_MODE=false`，actionLogger dead branch 與 `ptappDevLoggerMarker` 已剔除）。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: 啟動 plugins（navigation 埋點 + persistentStorage；theme/locale 佔位）"
```

---

### Task 11: 設計文件同步（02/03/07 改寫 + plans 標注 + todo 校準 + CLAUDE/README）

**Files:**
- Modify: `doc/design/02_architecture.md`
- Modify: `doc/design/03_ui_ux.md`
- Modify: `doc/design/07_dev_conventions.md`
- Modify: `doc/design/README.md`（技術方向附註）
- Modify: `doc/todo/01_todo_setup.md`、`doc/todo/README.md`
- Modify: `CLAUDE.md`、`README.md`
- Modify: `doc/plans/README.md`（若無則 Create，加歷史參照標注）

**Interfaces:** 無程式介面；deliverable 為文件與程式碼/規格一致（「設計同步必守」），02/03/07 無 React 殘留。

> 此 Task 為編輯性工作；以下為**逐檔精確修改點**（依 master plan E 段）。語言 zh-tw。

- [ ] **Step 1: 改寫 `doc/design/02_architecture.md`**

逐處替換（保留章節結構與非框架內容）：
- 抬頭與 2.2／2.3：前端框架 `React + TypeScript + Vite` → **`Nuxt 4 + Vue 3 + TypeScript`（SPA `ssr:false`）**；技術堆疊圖之「React + TypeScript + Vite」行改為「Nuxt 4（Vue 3 + 內建 Vite）」。
- 2.3 推薦框架段：改述為 Nuxt 4（表單密集受惠於 Nuxt UI 生態；SPA 輸出靜態檔利於 CDN/PWA）；替代方案改列 React/SvelteKit/Angular。
- 2.4 3D 表格：`Three.js + react-three-fiber` 一列改為框架中立敘述（Babylon 場景框架無關，Vue 以 `<ClientOnly>` 包裹）；移除「React 宣告式 3D」措辭或改為「Vue 宣告式 3D（TresJS）」之取捨註記。
- 2.7 模組架構圖：`App Shell / 路由（React Router）` → `App Shell / 路由（Nuxt 檔案式路由）`；`devtools … 僅開發建置` 維持。
- 2.8 資料流圖：`React 元件（View）` → `Vue 元件（View）`。
- 2.9 安裝/離線列：`main.tsx 僅 import.meta.env.PROD 才 registerSW()` → 改述為 `@vite-pwa/nuxt registerType:'autoUpdate'`（正式自動註冊、dev `devOptions.enabled:false` 停用）；`vite.config devOptions.enabled:false` → `nuxt.config pwa.devOptions.enabled:false`；History API 路由維持（Nuxt SPA）。
- 2.11 開發者模式：`環境變數 VITE_DEV_MODE` 維持，但「dead code elimination」處補述經 `nuxt.config vite.define` 靜態替換；`main.tsx` 字樣 → `nuxt.config`／plugin；dev host 由 `nuxt.config devServer.host` 閘控。

- [ ] **Step 2: 改寫 `doc/design/03_ui_ux.md` 設計系統段（§3.7 一帶）**

- 設計系統由「自訂 CSS custom properties token（`--color-bg` 等）+ Radix 原語」改為 **Nuxt UI（底層 Reka UI + Tailwind）theme**；保留 kebab-case token 命名原則，新增「設計 token → Nuxt UI `app.config.ts` / Tailwind theme」對應策略段（master plan 風險：此為與原設計最大刻意偏離；落實於 Phase 2）。
- 元件原語清單（Accordion/Dialog/AlertDialog/Checkbox/RadioGroup/Switch/Select…）改標 Nuxt UI 對應元件（UAccordion/UModal…）。

- [ ] **Step 3: 改寫 `doc/design/07_dev_conventions.md`**

- §7.1 與技術堆疊契合段：`React 元件 PascalCase` → `Vue 元件（PascalCase 檔名與 SFC）`；naming-convention 規則表保留不動。落實方式 react plugins → `@nuxt/eslint` + `eslint-plugin-vue`。
- §7.3 專案結構：整段改 Nuxt `app/` 慣例（`app/pages`、`app/layouts`、`app/composables`、`app/plugins`、`app/stores`、`app/utils`、`app/components`），`packages/*` 與 `infra/` 維持；移除 `apps/web/src` React 樹。
- §7.7 測試規範：元件測試工具 `Vitest + Testing Library`（React）→ `Vitest + @vue/test-utils（+ @nuxt/test-utils）`；其餘（NullEngine、Playwright、純函式原則）維持。

- [ ] **Step 4: 校準 `doc/design/README.md` 技術方向附註**

- 第 21 行「技術方向：Web 優先…以 PWA 達成」維持；若有 React 字樣改 Nuxt/Vue。

- [ ] **Step 5: 校準 todo**

- `doc/todo/01_todo_setup.md`：改為 Nuxt 地基項目（pnpm workspace、nuxt.config SPA、Nuxt UI/PWA/i18n/Pinia 模組、ESLint/Prettier/husky、CI），對齊本 Phase 0 plan。
- `doc/todo/README.md`：施作脈絡圖對齊 master plan D 之 Phase 0–7。

- [ ] **Step 6: 同步 `CLAUDE.md` 與 `README.md`**

- `CLAUDE.md`：確認「移植 React→Nuxt、source path」與選型（pnpm、Nuxt UI、SPA、@nuxtjs/i18n）一致；補一行指向 `doc/plans/2026-06-18-nuxt-migration-master-plan.md`。
- `README.md`：更新為 Nuxt 專案啟動說明（`pnpm install`、`pnpm dev`、`pnpm build`）。

- [ ] **Step 7: 標注既有 plans 為歷史參照**

- `doc/plans/README.md`（若無則建立）：加說明「`2026-06-1x-*` 系列為 ptApp（React）歷史微計畫，作為行為規格參照，非 Nuxt 實作依據；Nuxt 各 Phase 另出新 plan（`2026-06-18-*`）」。

- [ ] **Step 8: 驗證無 React 殘留（02/03/07）**

Run:
```bash
grep -rniE 'react|react-router|vite-plugin-pwa|\.tsx|main\.tsx' doc/design/02_architecture.md doc/design/03_ui_ux.md doc/design/07_dev_conventions.md || echo "OK：02/03/07 無 React 殘留"
```
Expected: 印出 `OK：02/03/07 無 React 殘留`（或僅剩刻意保留之對照性提及）。

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "docs: 設計文件同步 Nuxt（02/03/07 改寫、todo 校準、plans 歷史標注）"
```

---

### Task 12: 最終驗收門檻 + commit

**Files:** 無新增；執行完整驗收鏈。

- [ ] **Step 1: 全鏈驗收**

Run（於 repo 根，依序）：
```bash
pnpm install
pnpm test
pnpm lint
pnpm typecheck
pnpm build
pnpm verify:bundle
```
Expected：全部綠——
- `pnpm test`：packages 既有測試 + 新增純函式測試（devServerHost／redactPii／actionLogger／devServiceWorker／initStorage）全 PASS。
- `pnpm lint`：0 errors（naming-convention 生效）。
- `pnpm typecheck`：Nuxt app + packages 型別通過。
- `pnpm build`：SPA 輸出 `.output/public` 成功。
- `pnpm verify:bundle`：`verifyProdBundle: OK`（正式建置無 `ptappDevLoggerMarker`）。

- [ ] **Step 2: dev smoke（手動）**

Run: `pnpm dev`（背景啟動後操作再關閉）
Expected：`/`、`/settings`、`/patients/:id`（→ 自動導向 assessments）、404 皆可走；Nuxt UI 元件渲染正常。

- [ ] **Step 3: 確認 Phase 0 驗收條目**

逐項打勾（對照 `2026-06-18-phase-0-foundation.md` 驗收門檻）：pnpm workspace、SPA nuxt.config、四模組（UI/PWA/i18n/Pinia）+ ESLint、tooling 綠、設計文件 02/03/07 已同步、todo 對齊、app shell placeholder 可走。

- [ ] **Step 4: Commit（若有殘留變更）**

```bash
git add -A
git commit -m "chore: Phase 0 地基驗收通過（install/test/lint/typecheck/build/verify:bundle 綠）"
```

---

## Self-Review（撰寫者自審）

**1. Spec coverage（對照 `2026-06-18-phase-0-foundation.md` 0-A…0-I）：**
- 0-A workspace/tsconfig.base/packages 綠 → Task 1 ✔
- 0-B nuxt.config SPA/modules/devServer host/runtimeConfig → Task 2（核心+host）、各模組於 Task 6/7/8/9 裝入 ✔
- 0-C tooling（ESLint naming/Prettier/husky/lint-staged/CI） → Task 3、Task 5 ✔
- 0-D 設計文件同步 → Task 11 ✔
- 0-E app shell placeholder/routing → Task 9 ✔
- 0-F devtools + 啟動 plugins → Task 4、Task 10 ✔
- 0-G i18n bootstrap → Task 7 ✔
- 0-H PWA bootstrap → Task 8 ✔
- 0-I Pinia → Task 6 ✔
- 驗收門檻 → Task 12 ✔

**2. Placeholder scan：** 各程式步驟均含完整碼或精確指令；Task 11 為編輯性、以逐檔精確修改點＋grep 驗證收斂，非「TODO」式佔位。頁面內容之「placeholder」字樣為**刻意產物**（Phase 0 界線），非計畫缺漏。

**3. Type consistency：** `resolveDevServerHost`、`ActionLogger`/`actionLogger`、`unregisterServiceWorkersAndClearCaches`/`ServiceWorkerCleanupDeps`、`requestPersistentStorage`/`PersistResult`、`useAppStore` 之命名於定義（Task 2/4/8/10/6）與引用（Task 10 plugins、Task 5 CI）一致；i18n key（`titlePatients` 等）於 locale（Task 7）與頁面/layout（Task 9）一致。

**4. 已知刻意偏離（非缺陷）：** 設計 token → Nuxt UI theme 非 1:1（master plan F 風險，03 §3.7 改寫、Phase 2 落實）；`patients/[patientId]/edit` 巢狀 vs 獨立之確切呈現延後 Phase 4。

---

## 執行修正記錄（2026-06-18 實作時的計畫偏差）

實作過程中發現的計畫不足／環境細節，已於程式碼落實，茲記錄使計畫與現況一致：

- **開發者模式旗標機制（Task 2 修正）**：Nuxt 僅自動載入 `.env`、不載 `.env.<mode>`，故**不採 mode-based env 檔**。改於 `nuxt.config.ts` 以 `process.env.VITE_DEV_MODE ?? (NODE_ENV==='production' ? 'false' : 'true')` 推導，再經 `vite.define` 靜態替換。`compatibilityDate` 沿用 scaffold 的 `2025-07-15`。
- **pnpm + Nuxt 模組解析（Task 6–9 修正）**：
  - `postinstall: nuxt prepare` 會在 `pnpm add` 時觸發；若 `nuxt.config` 列了尚未安裝的模組即失敗並回滾 `package.json`。安裝模組須用 `pnpm add --ignore-scripts ...`，全部到位後再跑一次 `pnpm install`（單次 `nuxt prepare`）。
  - `@nuxt/ui` 的傳遞相依 Nuxt 模組（`@nuxt/icon`／`@nuxt/fonts`／`@nuxtjs/color-mode`）在 pnpm 隔離結構下無法由專案根解析 → 須**顯式加為直接相依**，並加 `.npmrc` `shamefully-hoist=true`。
  - pnpm 11 build 核准：`pnpm-workspace.yaml` `allowBuilds` 需含 `esbuild`/`@parcel/watcher`/`unrs-resolver`/`vue-demi` → `true`。
- **ESLint flat config（Task 3 修正）**：`naming-convention` 需 `@typescript-eslint` plugin 與 `@typescript-eslint/parser` 於**同一 config 物件**註冊；且僅套用於 `**/*.{ts,mts,cts,tsx}`（套到 `.vue`/`.mjs` 會因 parser services 不符而拋錯，Vue 命名交 eslint-plugin-vue）。另需 `'no-undef': 'off'`（TS 型別參照如 `Console` 誤報）、`ignores: ['nuxt.config.ts']`（PWA manifest 標準 snake_case 欄位為外部 schema）。
- **typescript 直接相依（Task 1/Tooling 修正）**：`pnpm typecheck` 的 `tsc` 需 `typescript` 直接相依（`^6.0.3`）方能連結 `node_modules/.bin/tsc`。
- **Nuxt UI 樣式入口（Task 9 修正）**：Nuxt UI v4 需 `app/assets/css/main.css`（`@import "tailwindcss"; @import "@nuxt/ui";`）並於 `nuxt.config css` 引入；placeholder 按鈕改用文字（不引 icon 套件）。
- **as-built 版本**：`@nuxt/ui` v4.8、`@nuxtjs/i18n` v10、`@nuxt/eslint` v1.16、`@vite-pwa/nuxt` v1.1、`eslint` v10、`pinia` v3、`typescript` 6.0.3。
- **Task 11 偏差（待決）**：doc-sync 子代理在改寫時**移除了 sfma `doc/plans/` 下約 90 篇 ptApp 歷史微計畫**（原 master plan E 規劃為「保留並標注歷史參照」）。原始檔完整存於 `ptApp/doc/plans/`（253 篇），可隨時還原。處置待使用者決定（還原並標注 vs 維持移除、改於 README 指向 ptApp）。
