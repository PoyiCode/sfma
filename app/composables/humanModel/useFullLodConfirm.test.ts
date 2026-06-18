// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import type { LodOverride } from '../../utils/humanModel/lod/lodTier';
import { useFullLodConfirm, type FullLodConfirm } from './useFullLodConfirm';

function run(
  current: LodOverride,
  apply: (mode: LodOverride) => void,
): { result: FullLodConfirm; stop: () => void } {
  const scope = effectScope();
  const result = scope.run(() => useFullLodConfirm(current, apply)) as FullLodConfirm;
  return { result, stop: () => scope.stop() };
}

describe('useFullLodConfirm（切換至完整前流量確認）', () => {
  it('請求 full（當前非 full）→ 開確認、不立即套用', () => {
    const apply = vi.fn();
    const { result, stop } = run('auto', apply);
    result.requestLodMode('full');
    expect(result.confirmOpen.value).toBe(true);
    expect(apply).not.toHaveBeenCalled();
    stop();
  });

  it('確認後 confirmFull → 套用 full、關閉對話框', () => {
    const apply = vi.fn();
    const { result, stop } = run('auto', apply);
    result.requestLodMode('full');
    result.confirmFull();
    expect(apply).toHaveBeenCalledWith('full');
    expect(result.confirmOpen.value).toBe(false);
    stop();
  });

  it('取消（confirmOpen=false）→ 不套用 full', () => {
    const apply = vi.fn();
    const { result, stop } = run('auto', apply);
    result.requestLodMode('full');
    result.confirmOpen.value = false;
    expect(result.confirmOpen.value).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    stop();
  });

  it('請求非 full（simplified）→ 直接套用、不開對話框', () => {
    const apply = vi.fn();
    const { result, stop } = run('full', apply);
    result.requestLodMode('simplified');
    expect(apply).toHaveBeenCalledWith('simplified');
    expect(result.confirmOpen.value).toBe(false);
    stop();
  });

  it('已是 full 再請求 full → 直接套用、不重複提醒', () => {
    const apply = vi.fn();
    const { result, stop } = run('full', apply);
    result.requestLodMode('full');
    expect(result.confirmOpen.value).toBe(false);
    expect(apply).toHaveBeenCalledWith('full');
    stop();
  });

  it('currentMode 為響應式來源（ref 變更即反映）', () => {
    const apply = vi.fn();
    const current = ref<LodOverride>('auto');
    const scope = effectScope();
    const result = scope.run(() => useFullLodConfirm(current, apply)) as FullLodConfirm;
    // current=auto → full 開確認
    result.requestLodMode('full');
    expect(result.confirmOpen.value).toBe(true);
    result.confirmOpen.value = false;
    // current 變 full → 再請求 full 直接套用、不開確認
    current.value = 'full';
    result.requestLodMode('full');
    expect(result.confirmOpen.value).toBe(false);
    expect(apply).toHaveBeenCalledWith('full');
    scope.stop();
  });
});
