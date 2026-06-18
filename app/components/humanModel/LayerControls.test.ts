// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import LayerControls from './LayerControls.vue';
import { DEFAULT_LAYER_VISIBILITY } from '../../utils/humanModel/anatomy/anatomyLayers';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// UiCheckbox 包裝 UCheckbox（Nuxt UI）；以契約替身驗證映射。
const UCheckboxStub = defineComponent({
  name: 'UCheckbox',
  props: { modelValue: { type: Boolean, default: false }, label: { type: String, default: '' } },
  emits: ['update:modelValue'],
  template: `<button role="checkbox" :aria-checked="modelValue"
    @click="$emit('update:modelValue', !modelValue)">{{ label }}</button>`,
});
const mountOpts = { global: { stubs: { UCheckbox: UCheckboxStub } } };

describe('LayerControls（分層開關；04 §4.1）', () => {
  it('五層各一勾選；勾選態反映 visibility', () => {
    const wrapper = mount(LayerControls, {
      props: { visibility: { ...DEFAULT_LAYER_VISIBILITY } },
      ...mountOpts,
    });
    const boxes = wrapper.findAll('[role="checkbox"]');
    expect(boxes).toHaveLength(5);
    // bone 預設 true、nerve 預設 false
    expect(boxes[0]!.attributes('aria-checked')).toBe('true');
    const nerve = boxes.find((b) => b.text() === 'settingsLayerNerve')!;
    expect(nerve.attributes('aria-checked')).toBe('false');
  });

  it('勾選變更發 setVisible（layer, visible）', async () => {
    const wrapper = mount(LayerControls, {
      props: { visibility: { ...DEFAULT_LAYER_VISIBILITY } },
      ...mountOpts,
    });
    const nerve = wrapper.findAll('[role="checkbox"]').find((b) => b.text() === 'settingsLayerNerve')!;
    await nerve.trigger('click');
    expect(wrapper.emitted('setVisible')?.at(-1)).toEqual(['nerve', true]);
  });

  it('canReset=true 顯「還原預設」鈕、點按發 reset', async () => {
    const wrapper = mount(LayerControls, {
      props: { visibility: { ...DEFAULT_LAYER_VISIBILITY }, canReset: true },
      ...mountOpts,
    });
    const resetBtn = wrapper.findAll('button').find((b) => b.text() === 'modelLayersReset')!;
    await resetBtn.trigger('click');
    expect(wrapper.emitted('reset')).toHaveLength(1);
  });

  it('disclosure 收合切換 aria-expanded', async () => {
    const wrapper = mount(LayerControls, {
      props: { visibility: { ...DEFAULT_LAYER_VISIBILITY } },
      ...mountOpts,
    });
    const toggle = wrapper.get('.layerControlsToggle');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('false');
  });

  it('defaultCollapsed=true 起始收合（body hidden）', () => {
    const wrapper = mount(LayerControls, {
      props: { visibility: { ...DEFAULT_LAYER_VISIBILITY }, defaultCollapsed: true },
      ...mountOpts,
    });
    expect(wrapper.get('.layerControlsBody').attributes('hidden')).toBeDefined();
  });
});
