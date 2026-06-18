// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import Model3DControls from './Model3DControls.vue';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// UiSwitch 包裝 USwitch（Nuxt UI）；以契約替身驗證映射。
const USwitchStub = defineComponent({
  name: 'USwitch',
  props: { modelValue: { type: Boolean, default: false }, label: { type: String, default: '' } },
  emits: ['update:modelValue'],
  template: `<button role="switch" :aria-checked="modelValue"
    @click="$emit('update:modelValue', !modelValue)">{{ label }}</button>`,
});
const mountOpts = { global: { stubs: { USwitch: USwitchStub } } };

describe('Model3DControls（3D 控制列；04 §4.3.2／§4.4／§3.5）', () => {
  it('恆顯方向視角分段（前/後/左/右）；其餘休眠', () => {
    const wrapper = mount(Model3DControls, { props: { view: 'front' }, ...mountOpts });
    const groups = wrapper.findAll('[role="radiogroup"]');
    expect(groups).toHaveLength(1);
    expect(groups[0]!.attributes('aria-label')).toBe('model3dViewLabel');
    expect(wrapper.find('[role="switch"]').exists()).toBe(false);
  });

  it('選視角發 viewChange 帶新鍵', async () => {
    const wrapper = mount(Model3DControls, { props: { view: 'front' }, ...mountOpts });
    const back = wrapper.findAll('[role="radiogroup"] button').find((b) => b.text() === 'model3dViewBack')!;
    await back.trigger('click');
    expect(wrapper.emitted('viewChange')?.at(-1)).toEqual(['back']);
  });

  it('canChangeRegion 顯部位分段', () => {
    const wrapper = mount(Model3DControls, {
      props: { view: 'front', canChangeRegion: true, region: 'whole' },
      ...mountOpts,
    });
    const groups = wrapper.findAll('[role="radiogroup"]');
    expect(groups.some((g) => g.attributes('aria-label') === 'model3dRegionLabel')).toBe(true);
  });

  it('canShowLabels 顯標籤開關、點按發 showLabelsChange', async () => {
    const wrapper = mount(Model3DControls, {
      props: { view: 'front', canShowLabels: true, showLabels: true },
      ...mountOpts,
    });
    const sw = wrapper.get('[role="switch"]');
    await sw.trigger('click');
    expect(wrapper.emitted('showLabelsChange')?.at(-1)).toEqual([false]);
  });

  it('canChangeLabelMode 且標籤開時顯標籤範圍分段；標籤關時不顯', () => {
    const on = mount(Model3DControls, {
      props: { view: 'front', canChangeLabelMode: true, showLabels: true, labelMode: 'all' },
      ...mountOpts,
    });
    expect(
      on.findAll('[role="radiogroup"]').some((g) => g.attributes('aria-label') === 'modelLabelModeLabel'),
    ).toBe(true);
    const off = mount(Model3DControls, {
      props: { view: 'front', canChangeLabelMode: true, showLabels: false, labelMode: 'all' },
      ...mountOpts,
    });
    expect(
      off.findAll('[role="radiogroup"]').some((g) => g.attributes('aria-label') === 'modelLabelModeLabel'),
    ).toBe(false);
  });

  it('canChangeLod 顯 LOD 分段、選擇發 lodModeChange', async () => {
    const wrapper = mount(Model3DControls, {
      props: { view: 'front', canChangeLod: true, lodMode: 'auto' },
      ...mountOpts,
    });
    const lodGroup = wrapper
      .findAll('[role="radiogroup"]')
      .find((g) => g.attributes('aria-label') === 'settingsLod')!;
    const full = lodGroup.findAll('button').find((b) => b.text() === 'settingsLodFull')!;
    await full.trigger('click');
    expect(wrapper.emitted('lodModeChange')?.at(-1)).toEqual(['full']);
  });
});
