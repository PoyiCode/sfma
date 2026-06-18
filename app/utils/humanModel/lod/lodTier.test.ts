import { describe, expect, it } from 'vitest';
import { degradeLodTier, LOD_TIERS, resolveLodTier } from './lodTier';

describe('lodTier（LOD 分級決策）', () => {
  it('LOD_TIERS 為 full/simplified（精細與 2D〔twoD〕階層皆已移除）', () => {
    expect(LOD_TIERS).toEqual(['full', 'simplified']);
  });

  it('override=full → full（無損；手動 opt-in）', () => {
    expect(resolveLodTier('full')).toBe('full');
  });

  it('override=simplified → simplified', () => {
    expect(resolveLodTier('simplified')).toBe('simplified');
  });

  it('auto → simplified（精細階層移除後 auto 皆解析現役 glb）', () => {
    expect(resolveLodTier('auto')).toBe('simplified');
  });

  it('degradeLodTier：完整→精簡、精簡為最低（不再退 2D）', () => {
    expect(degradeLodTier('full')).toBe('simplified');
    expect(degradeLodTier('simplified')).toBe('simplified');
  });
});
