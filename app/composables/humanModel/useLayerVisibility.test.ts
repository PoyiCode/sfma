// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { actionLogger } from '../../utils/devtools/actionLogger';
import {
  DEFAULT_LAYER_VISIBILITY,
  type LayerVisibility,
} from '../../utils/humanModel/anatomy/anatomyLayers';
import { useLayerVisibility, type UseLayerVisibility } from './useLayerVisibility';

function run(initial?: LayerVisibility): { result: UseLayerVisibility; stop: () => void } {
  const scope = effectScope();
  const result = scope.run(() => useLayerVisibility(initial)) as UseLayerVisibility;
  return { result, stop: () => scope.stop() };
}

describe('useLayerVisibility（分層顯示狀態）', () => {
  it('預設初值＝設計 §4.1 預設顯示', () => {
    const { result, stop } = run();
    expect(result.visibility.value).toEqual(DEFAULT_LAYER_VISIBILITY);
    stop();
  });

  it('可接受自訂初值（如設定 defaultLayers）', () => {
    const initial: LayerVisibility = {
      bone: false,
      deepMuscle: true,
      superficialMuscle: false,
      nerve: true,
      passiveStructure: true,
    };
    const { result, stop } = run(initial);
    expect(result.visibility.value).toEqual(initial);
    stop();
  });

  it('setVisible 設定單一分層', () => {
    const { result, stop } = run();
    result.setVisible('deepMuscle', true);
    expect(result.visibility.value.deepMuscle).toBe(true);
    expect(result.visibility.value.bone).toBe(true);
    expect(result.visibility.value.nerve).toBe(false);
    stop();
  });

  it('toggle 翻轉單一分層', () => {
    const { result, stop } = run();
    result.toggle('nerve');
    expect(result.visibility.value.nerve).toBe(true);
    result.toggle('nerve');
    expect(result.visibility.value.nerve).toBe(false);
    stop();
  });

  it('reset 還原至初值', () => {
    const initial: LayerVisibility = {
      bone: true,
      deepMuscle: false,
      superficialMuscle: true,
      nerve: false,
      passiveStructure: false,
    };
    const { result, stop } = run(initial);
    result.toggle('bone');
    result.setVisible('nerve', true);
    expect(result.visibility.value).not.toEqual(initial);
    result.reset();
    expect(result.visibility.value).toEqual(initial);
    stop();
  });

  it('setVisible／toggle 經 actionLogger 埋點（humanModel／layer）', () => {
    const spy = vi.spyOn(actionLogger, 'log');
    const { result, stop } = run();
    result.setVisible('deepMuscle', true);
    expect(spy).toHaveBeenCalledWith('humanModel', 'layerVisibility', 'deepMuscle=true');
    result.toggle('nerve');
    expect(spy).toHaveBeenCalledWith('humanModel', 'layerToggle', 'nerve');
    spy.mockRestore();
    stop();
  });

  it('setVisible 設為同值時不更換 visibility 參考（避免無謂重繪）', () => {
    const { result, stop } = run();
    const before = result.visibility.value;
    result.setVisible('bone', true); // 已是 true
    expect(result.visibility.value).toBe(before);
    stop();
  });
});
