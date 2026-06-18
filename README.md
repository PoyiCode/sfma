# sfma — 物理治療評估 APP（Nuxt 4）

SFMA（選擇性功能動作評估）APP，**Nuxt 4 + Vue 3** 實作，渲染模式 SPA（`ssr: false`）、PWA 可安裝可離線。由 ptApp（React）移植而來。

- 設計文件：[`doc/design`](doc/design/README.md)（zh-tw）
- 待辦清單：[`doc/todo`](doc/todo/README.md)（移植後仍待辦工作）

技術堆疊：Nuxt 4（Vue 3 + 內建 Vite）、Nuxt UI（Reka UI + Tailwind v4）、Pinia、`@nuxtjs/i18n`（zh-TW 預設）、`@vite-pwa/nuxt`、Babylon.js（3D）。套件管理 **pnpm workspace**。

## 安裝

需要 pnpm：

```bash
pnpm install
```

## 開發

啟動開發伺服器（`http://localhost`）：

```bash
pnpm dev
```

> 開發者模式建置旗標 `VITE_DEV_MODE`（02 §2.11）：dev build 預設開、正式 build 預設關。`VITE_DEV_MODE=true` 時 dev server 綁 `0.0.0.0`（區網可及，供 iOS 等實機經 http 區網 IP 測試），否則綁 `localhost`。

## 建置與預覽

```bash
pnpm build      # SPA 靜態輸出
pnpm preview    # 本機預覽正式建置
```

## 檢查與測試

```bash
pnpm lint       # ESLint flat config（@nuxt/eslint + eslint-plugin-vue + naming-convention）
pnpm typecheck  # nuxt typecheck + packages
pnpm test       # Vitest（單元／元件：@vue/test-utils）
```

詳見 [`doc/design/07_dev_conventions.md`](doc/design/07_dev_conventions.md)（命名、結構、測試規範）。
