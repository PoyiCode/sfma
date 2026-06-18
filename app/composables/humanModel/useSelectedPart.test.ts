// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { actionLogger } from '../../utils/devtools/actionLogger';
import { useSelectedPart, type UseSelectedPart } from './useSelectedPart';

function run(initialId?: string | null): { result: UseSelectedPart; stop: () => void } {
  const scope = effectScope();
  const result = scope.run(() => useSelectedPart(initialId ?? null)) as UseSelectedPart;
  return { result, stop: () => scope.stop() };
}

describe('useSelectedPart（部位選取狀態）', () => {
  it('預設無選取', () => {
    const { result, stop } = run();
    expect(result.selectedId.value).toBeNull();
    expect(result.selected.value).toBeNull();
    stop();
  });

  it('select 設定選取並以 anatomyEntityById 解析為實體', () => {
    const { result, stop } = run();
    result.select('muscle.bicepsBrachii');
    expect(result.selectedId.value).toBe('muscle.bicepsBrachii');
    expect(result.selected.value?.anatomyId).toBe('muscle.bicepsBrachii');
    expect(result.selected.value?.type).toBe('muscle');
    stop();
  });

  it('select 未知 id：selectedId 保留但 selected 為 null', () => {
    const { result, stop } = run();
    result.select('muscle.doesNotExist');
    expect(result.selectedId.value).toBe('muscle.doesNotExist');
    expect(result.selected.value).toBeNull();
    stop();
  });

  it('toggle 同 id 取消、異 id 切換', () => {
    const { result, stop } = run();
    result.toggle('joint.elbow');
    expect(result.selectedId.value).toBe('joint.elbow');
    result.toggle('joint.elbow');
    expect(result.selectedId.value).toBeNull();
    result.toggle('bone.humerus');
    result.toggle('bone.radius');
    expect(result.selectedId.value).toBe('bone.radius');
    stop();
  });

  it('select／toggle 經 actionLogger 埋點（humanModel／anatomyId）', () => {
    const spy = vi.spyOn(actionLogger, 'log');
    const { result, stop } = run();
    result.select('muscle.bicepsBrachii');
    expect(spy).toHaveBeenCalledWith('humanModel', 'selectPart', 'muscle.bicepsBrachii');
    result.toggle('joint.elbow');
    expect(spy).toHaveBeenCalledWith('humanModel', 'togglePart', 'joint.elbow');
    spy.mockRestore();
    stop();
  });

  it('clear 清除選取', () => {
    const { result, stop } = run('nerve.radial');
    expect(result.selectedId.value).toBe('nerve.radial');
    expect(result.selected.value?.type).toBe('nerve');
    result.clear();
    expect(result.selectedId.value).toBeNull();
    expect(result.selected.value).toBeNull();
    stop();
  });
});
