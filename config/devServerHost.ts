// dev server host：依開發者模式（建置旗標 VITE_DEV_MODE，02 §2.11、08 §8.9）閘控。
// 開發者模式才綁 0.0.0.0（全介面、區網可及，供 iOS 等實機經 http 區網 IP 測試）；
// 否則 localhost（僅本機，不誤將 dev server 曝露於區網）。非 'true' 一律視為關閉。
// 由 nuxt.config.ts 消費。
export function resolveDevServerHost(viteDevMode: string | undefined): string {
  return viteDevMode === 'true' ? '0.0.0.0' : 'localhost';
}
