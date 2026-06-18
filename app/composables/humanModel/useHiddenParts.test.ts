// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { effectScope } from 'vue';
import { useHiddenParts, type UseHiddenParts } from './useHiddenParts';

function run(): { result: UseHiddenParts; stop: () => void } {
  const scope = effectScope();
  const result = scope.run(() => useHiddenParts()) as UseHiddenParts;
  return { result, stop: () => scope.stop() };
}

describe('useHiddenParts（單一部位隱藏檢視狀態；04 §4.1）', () => {
  it('初值無隱藏', () => {
    const { result, stop } = run();
    expect(result.hiddenIds.value).toEqual([]);
    expect(result.isHidden('muscle.bicepsBrachii')).toBe(false);
    stop();
  });

  it('hide 加入、isHidden 反映、hiddenIds 依加入序', () => {
    const { result, stop } = run();
    result.hide('muscle.bicepsBrachii');
    result.hide('bone.humerus');
    expect(result.hiddenIds.value).toEqual(['muscle.bicepsBrachii', 'bone.humerus']);
    expect(result.isHidden('muscle.bicepsBrachii')).toBe(true);
    stop();
  });

  it('重複 hide 同 id 不重出', () => {
    const { result, stop } = run();
    result.hide('muscle.bicepsBrachii');
    result.hide('muscle.bicepsBrachii');
    expect(result.hiddenIds.value).toEqual(['muscle.bicepsBrachii']);
    stop();
  });

  it('restore 移除單一', () => {
    const { result, stop } = run();
    result.hide('muscle.bicepsBrachii');
    result.hide('bone.humerus');
    result.restore('muscle.bicepsBrachii');
    expect(result.hiddenIds.value).toEqual(['bone.humerus']);
    stop();
  });

  it('restoreAll 清空', () => {
    const { result, stop } = run();
    result.hide('muscle.bicepsBrachii');
    result.hide('bone.humerus');
    result.restoreAll();
    expect(result.hiddenIds.value).toEqual([]);
    stop();
  });
});
