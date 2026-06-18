// PWA 安裝引導平台判定（03 §3.3.6）。純函式，與 window 事件捕捉（useInstallPrompt）分離以利測試。

// 安裝引導呈現模式：prompt＝Chromium 可叫起原生安裝；iosManual＝iOS Safari 顯加入主畫面指引；hidden＝不顯。
export type InstallMode = 'prompt' | 'iosManual' | 'hidden';

export interface InstallContext {
  userAgent: string;
  standalone: boolean; // 已以已安裝 PWA（standalone）開啟
  canPrompt: boolean; // 已捕捉到 beforeinstallprompt（可叫起原生安裝）
}

// iOS Safari：UA 含 iPhone/iPad/iPod 且為 Safari（排除 iOS 上的 Chrome/Firefox/Edge——皆 WebKit 但非 Safari 分享選單）。
export function isIosSafari(userAgent: string): boolean {
  const isIos = /iphone|ipad|ipod/i.test(userAgent);
  const isSafari = /safari/i.test(userAgent) && !/crios|fxios|edgios/i.test(userAgent);
  return isIos && isSafari;
}

export function resolveInstallMode(ctx: InstallContext): InstallMode {
  if (ctx.standalone) return 'hidden';
  if (ctx.canPrompt) return 'prompt';
  if (isIosSafari(ctx.userAgent)) return 'iosManual';
  return 'hidden';
}
