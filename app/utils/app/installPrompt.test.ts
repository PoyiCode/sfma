import { describe, expect, it } from 'vitest';
import { isIosSafari, resolveInstallMode } from './installPrompt';

const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD_SAFARI =
  'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36';
const DESKTOP_CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

describe('isIosSafari', () => {
  it('iPhone／iPad Safari 為真', () => {
    expect(isIosSafari(IPHONE_SAFARI)).toBe(true);
    expect(isIosSafari(IPAD_SAFARI)).toBe(true);
  });

  it('iOS Chrome（CriOS）與 Android／桌面 Chrome 為偽', () => {
    expect(isIosSafari(IPHONE_CHROME)).toBe(false);
    expect(isIosSafari(ANDROID_CHROME)).toBe(false);
    expect(isIosSafari(DESKTOP_CHROME)).toBe(false);
  });
});

describe('resolveInstallMode', () => {
  it('已以 standalone 開啟 → hidden（即使可提示）', () => {
    expect(
      resolveInstallMode({ userAgent: ANDROID_CHROME, standalone: true, canPrompt: true }),
    ).toBe('hidden');
  });

  it('可提示且非 standalone → prompt', () => {
    expect(
      resolveInstallMode({ userAgent: ANDROID_CHROME, standalone: false, canPrompt: true }),
    ).toBe('prompt');
  });

  it('不可提示但為 iOS Safari → iosManual', () => {
    expect(
      resolveInstallMode({ userAgent: IPHONE_SAFARI, standalone: false, canPrompt: false }),
    ).toBe('iosManual');
  });

  it('不可提示且非 iOS Safari → hidden', () => {
    expect(
      resolveInstallMode({ userAgent: ANDROID_CHROME, standalone: false, canPrompt: false }),
    ).toBe('hidden');
  });
});
