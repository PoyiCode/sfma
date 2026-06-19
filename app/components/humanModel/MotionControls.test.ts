// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import MotionControls from './MotionControls.vue';
import {
  NEUTRAL_POSE,
  setJointAngle,
  type MotionPose,
} from '../../utils/humanModel/motion/motionPose';

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
  inheritAttrs: true,
  props: { modelValue: { type: String, default: '' }, options: { type: Array, default: () => [] } },
  emits: ['update:modelValue'],
  template: `<div class="segStub" />`,
});
// 肌肉著色開關替身（§4.3.4；繞過 USwitch Nuxt UI 執行期）。
const BaseSwitchStub = defineComponent({
  name: 'BaseSwitch',
  inheritAttrs: true,
  props: { modelValue: { type: Boolean, default: false }, label: { type: String, default: '' } },
  emits: ['update:modelValue'],
  template: `<button class="switchStub" @click="$emit('update:modelValue', !modelValue)" />`,
});
const mountOpts = {
  props: { pose: NEUTRAL_POSE, selectedJoint: 'joint.knee', selectedSide: '#R' as string | null },
  global: { stubs: { BaseButton: BaseButtonStub, BaseSegmentedControl: BaseSegmentedControlStub } },
};

// 肌肉著色測試 helper（§4.3.4）。
function mountShading(props: {
  pose: MotionPose;
  selectedJoint: string;
  selectedSide: string | null;
  muscleShading: boolean;
}) {
  return mount(MotionControls, {
    props,
    global: {
      stubs: {
        BaseButton: BaseButtonStub,
        BaseSegmentedControl: BaseSegmentedControlStub,
        BaseSwitch: BaseSwitchStub,
      },
    },
  });
}

describe('MotionControls（運動控制面板；04 §4.3.3）', () => {
  it('選膝（1 DOF）顯一支滑桿', () => {
    const wrapper = mount(MotionControls, mountOpts);
    const sliders = wrapper.findAll('input[type="range"]');
    expect(sliders).toHaveLength(1);
  });

  it('選肩（3 DOF）顯三支滑桿', () => {
    const wrapper = mount(MotionControls, {
      ...mountOpts,
      props: { pose: NEUTRAL_POSE, selectedJoint: 'joint.glenohumeral', selectedSide: '#R' },
    });
    expect(wrapper.findAll('input[type="range"]')).toHaveLength(3);
  });

  it('滑桿之 min/max = definitions ROM（膝 -5..140）', () => {
    const wrapper = mount(MotionControls, mountOpts);
    const slider = wrapper.find('input[type="range"]');
    expect(slider.attributes('min')).toBe('-5');
    expect(slider.attributes('max')).toBe('140');
  });

  it('移動滑桿發 setJointAngle（jointId, side, axis, 鉗制值）', async () => {
    const wrapper = mount(MotionControls, mountOpts);
    const slider = wrapper.find('input[type="range"]');
    await slider.setValue('90');
    const ev = wrapper.emitted('setJointAngle');
    expect(ev?.[0]).toEqual(['joint.knee', '#R', 'flexionExtension', 90]);
  });

  it('超界輸入被鉗制後上拋（膝 200 → 140）', async () => {
    const wrapper = mount(MotionControls, mountOpts);
    const slider = wrapper.find('input[type="range"]');
    await slider.setValue('200');
    const ev = wrapper.emitted('setJointAngle');
    expect(ev?.[ev.length - 1]).toEqual(['joint.knee', '#R', 'flexionExtension', 140]);
  });

  it('左側鏡像軸滑桿 min/max 取右側鏡像（髖外展/內收 右[-30,45]→左[-45,30]）', () => {
    const right = mount(MotionControls, {
      ...mountOpts,
      props: { pose: NEUTRAL_POSE, selectedJoint: 'joint.hip', selectedSide: '#R' },
    });
    // 髖 dof 序：屈伸／外展內收／內外旋 → 外展內收為第 2 支滑桿
    const rAbd = right.findAll('input[type="range"]')[1]!;
    expect([rAbd.attributes('min'), rAbd.attributes('max')]).toEqual(['-30', '45']);
    const left = mount(MotionControls, {
      ...mountOpts,
      props: { pose: NEUTRAL_POSE, selectedJoint: 'joint.hip', selectedSide: '#L' },
    });
    const lAbd = left.findAll('input[type="range"]')[1]!;
    expect([lAbd.attributes('min'), lAbd.attributes('max')]).toEqual(['-45', '30']);
    // 屈伸（矢狀面）左右一致
    const lFlex = left.findAll('input[type="range"]')[0]!;
    expect([lFlex.attributes('min'), lFlex.attributes('max')]).toEqual(['-20', '120']);
  });

  it('雙側關節顯左/右切換、單側關節（脊椎）不顯', () => {
    const knee = mount(MotionControls, mountOpts);
    expect(knee.find('[data-testid="motion-side"]').exists()).toBe(true);
    const spine = mount(MotionControls, {
      ...mountOpts,
      props: { pose: NEUTRAL_POSE, selectedJoint: 'joint.spine', selectedSide: null },
    });
    expect(spine.find('[data-testid="motion-side"]').exists()).toBe(false);
  });

  it('滑桿讀選取側別之姿態值（#L 與 #R 各自獨立）', () => {
    const poseLeft = setJointAngle(NEUTRAL_POSE, 'joint.knee#L', 'flexionExtension', 75);
    const left = mount(MotionControls, {
      ...mountOpts,
      props: { pose: poseLeft, selectedJoint: 'joint.knee', selectedSide: '#L' },
    });
    expect((left.find('input[type="range"]').element as HTMLInputElement).value).toBe('75');
    // 同 pose 但選 #R → 該側未設、顯中立 0
    const right = mount(MotionControls, {
      ...mountOpts,
      props: { pose: poseLeft, selectedJoint: 'joint.knee', selectedSide: '#R' },
    });
    expect((right.find('input[type="range"]').element as HTMLInputElement).value).toBe('0');
  });

  it('重置鈕發 resetPose', async () => {
    const wrapper = mount(MotionControls, mountOpts);
    await wrapper.find('[data-testid="motion-reset"]').trigger('click');
    expect(wrapper.emitted('resetPose')).toBeTruthy();
  });
});

describe('MotionControls 肌肉著色（§4.3.4）', () => {
  it('著色開（muscleShading=true）→ 顯開關、圖例與相關肌群清單', () => {
    const wrapper = mountShading({
      pose: { 'joint.hip#R': { abductionAdduction: 45 } },
      selectedJoint: 'joint.hip',
      selectedSide: '#R',
      muscleShading: true,
    });
    expect(wrapper.find('[data-testid="muscle-shading-toggle"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="muscle-shading-legend"]').exists()).toBe(true);
    expect(wrapper.findAll('[data-testid="muscle-shading-item"]').length).toBeGreaterThan(0);
  });

  it('著色關（muscleShading=false）→ 不顯圖例與清單', () => {
    const wrapper = mountShading({
      pose: {},
      selectedJoint: 'joint.hip',
      selectedSide: '#R',
      muscleShading: false,
    });
    expect(wrapper.find('[data-testid="muscle-shading-legend"]').exists()).toBe(false);
    expect(wrapper.findAll('[data-testid="muscle-shading-item"]').length).toBe(0);
  });

  it('切換開關 → emit update:muscleShading', async () => {
    const wrapper = mountShading({
      pose: {},
      selectedJoint: 'joint.hip',
      selectedSide: '#R',
      muscleShading: true,
    });
    await wrapper.find('[data-testid="muscle-shading-toggle"]').trigger('click');
    expect(wrapper.emitted('update:muscleShading')).toBeTruthy();
  });
});
