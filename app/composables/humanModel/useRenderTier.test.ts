// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { effectScope, ref } from 'vue';
import type { LodOverride } from '../../utils/humanModel/lod/lodTier';
import { useRenderTier } from './useRenderTier';

describe('useRenderTier（渲染分級 composable；04 §4.3.5）', () => {
  it('auto → simplified', () => {
    const scope = effectScope();
    const tier = scope.run(() => useRenderTier('auto'))!;
    expect(tier.value).toBe('simplified');
    scope.stop();
  });

  it('simplified → simplified', () => {
    const scope = effectScope();
    const tier = scope.run(() => useRenderTier('simplified'))!;
    expect(tier.value).toBe('simplified');
    scope.stop();
  });

  it('full → full（手動 opt-in 無損）', () => {
    const scope = effectScope();
    const tier = scope.run(() => useRenderTier('full'))!;
    expect(tier.value).toBe('full');
    scope.stop();
  });

  it('override 變更即重算分級（響應式來源）', () => {
    const override = ref<LodOverride>('auto');
    const scope = effectScope();
    const tier = scope.run(() => useRenderTier(override))!;
    expect(tier.value).toBe('simplified');
    override.value = 'full';
    expect(tier.value).toBe('full');
    scope.stop();
  });
});
