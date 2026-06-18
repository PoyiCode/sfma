// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import MotionControls from './MotionControls.vue';
import { NEUTRAL_POSE } from '../../utils/humanModel/motion/motionPose';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// 以契約替身替換包裝元件（避免 jsdom 拉入 Nuxt UI 執行期）；滑桿為原生 input、不需 stub。
const BaseButtonStub = defineComponent({
  name: 'BaseButton',
  inheritAttrs: false,
  template: `<button v-bind="$attrs" @click="$emit('click')"><slot /></button>`,
});
const BaseSegmentedControlStub = defineComponent({
  name: 'BaseSegmentedControl',
  props: { modelValue: { type: String, default: '' }, options: { type: Array, default: () => [] } },
  emits: ['update:modelValue'],
  template: `<div class="segStub" />`,
});
const mountOpts = {
  props: { pose: NEUTRAL_POSE, selectedJoint: 'joint.knee' },
  global: { stubs: { BaseButton: BaseButtonStub, BaseSegmentedControl: BaseSegmentedControlStub } },
};

describe('MotionControls（運動控制面板；04 §4.3.3）', () => {
  it('選膝（1 DOF）顯一支滑桿', () => {
    const wrapper = mount(MotionControls, mountOpts);
    const sliders = wrapper.findAll('input[type="range"]');
    expect(sliders).toHaveLength(1);
  });

  it('選肩（3 DOF）顯三支滑桿', () => {
    const wrapper = mount(MotionControls, {
      ...mountOpts,
      props: { pose: NEUTRAL_POSE, selectedJoint: 'joint.glenohumeral' },
    });
    expect(wrapper.findAll('input[type="range"]')).toHaveLength(3);
  });

  it('滑桿之 min/max = definitions ROM（膝 -5..140）', () => {
    const wrapper = mount(MotionControls, mountOpts);
    const slider = wrapper.find('input[type="range"]');
    expect(slider.attributes('min')).toBe('-5');
    expect(slider.attributes('max')).toBe('140');
  });

  it('移動滑桿發 setJointAngle（jointId, axis, 鉗制值）', async () => {
    const wrapper = mount(MotionControls, mountOpts);
    const slider = wrapper.find('input[type="range"]');
    await slider.setValue('90');
    const ev = wrapper.emitted('setJointAngle');
    expect(ev?.[0]).toEqual(['joint.knee', 'flexionExtension', 90]);
  });

  it('超界輸入被鉗制後上拋（膝 200 → 140）', async () => {
    const wrapper = mount(MotionControls, mountOpts);
    const slider = wrapper.find('input[type="range"]');
    await slider.setValue('200');
    const ev = wrapper.emitted('setJointAngle');
    expect(ev?.[ev.length - 1]).toEqual(['joint.knee', 'flexionExtension', 140]);
  });

  it('重置鈕發 resetPose', async () => {
    const wrapper = mount(MotionControls, mountOpts);
    await wrapper.find('[data-testid="motion-reset"]').trigger('click');
    expect(wrapper.emitted('resetPose')).toBeTruthy();
  });
});
