// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { useFpsAutoDegrade } from './useFpsAutoDegrade';

// 注入時鐘：以可變閉包變數驅動 now()，於取樣間推進。
describe('useFpsAutoDegrade（live FPS 自動降級接線；04 §4.3.5／§4.3.6）', () => {
  it('啟用＋持續低於門檻達 sustainedMs → 觸發 onDegrade 一次', () => {
    let clock = 0;
    const onDegrade = vi.fn();
    const scope = effectScope();
    const sample = scope.run(() =>
      useFpsAutoDegrade({ enabled: true, onDegrade, now: () => clock }),
    )!;
    clock = 0;
    sample(10); // 起算低幀視窗
    clock = 4999;
    sample(10); // 未達 5000ms
    expect(onDegrade).not.toHaveBeenCalled();
    clock = 5000;
    sample(10); // 達門檻持續 → 降級
    expect(onDegrade).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it('門檻以上（復原）清連續區間，未累積到不降級', () => {
    let clock = 0;
    const onDegrade = vi.fn();
    const scope = effectScope();
    const sample = scope.run(() =>
      useFpsAutoDegrade({ enabled: true, onDegrade, now: () => clock }),
    )!;
    clock = 0;
    sample(10);
    clock = 3000;
    sample(60); // 復原 → 清窗
    clock = 6000;
    sample(10); // 新視窗起算 6000
    clock = 7000;
    sample(10); // 僅 1000ms
    expect(onDegrade).not.toHaveBeenCalled();
    scope.stop();
  });

  it('停用時 sample 為 no-op（不觸發）', () => {
    let clock = 0;
    const onDegrade = vi.fn();
    const scope = effectScope();
    const sample = scope.run(() =>
      useFpsAutoDegrade({ enabled: false, onDegrade, now: () => clock }),
    )!;
    clock = 0;
    sample(5);
    clock = 10000;
    sample(5);
    expect(onDegrade).not.toHaveBeenCalled();
    scope.stop();
  });

  it('停用會重置視窗——重新啟用須重新累積整個視窗', async () => {
    let clock = 0;
    const onDegrade = vi.fn();
    const enabled = ref(true);
    const scope = effectScope();
    const sample = scope.run(() =>
      useFpsAutoDegrade({ enabled, onDegrade, now: () => clock }),
    )!;
    clock = 0;
    sample(10); // 視窗起算 0
    enabled.value = false; // 停用 → watch 重置視窗
    await Promise.resolve();
    enabled.value = true; // 重新啟用
    await Promise.resolve();
    clock = 4000;
    sample(10); // 視窗重新起算 4000
    clock = 8000;
    sample(10); // 8000−4000＝4000 < 5000，不降
    expect(onDegrade).not.toHaveBeenCalled();
    clock = 9000;
    sample(10); // 9000−4000＝5000 → 降級
    expect(onDegrade).toHaveBeenCalledTimes(1);
    scope.stop();
  });

  it('採注入 config（門檻／持續時長）', () => {
    let clock = 0;
    const onDegrade = vi.fn();
    const scope = effectScope();
    const sample = scope.run(() =>
      useFpsAutoDegrade({
        enabled: true,
        onDegrade,
        config: { thresholdFps: 30, sustainedMs: 1000 },
        now: () => clock,
      }),
    )!;
    clock = 0;
    sample(20); // 低於 30
    clock = 1000;
    sample(20); // 達 1000ms → 降級
    expect(onDegrade).toHaveBeenCalledTimes(1);
    scope.stop();
  });
});
