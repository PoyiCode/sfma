// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { anatomyEntities, anatomyEntityById } from '@ptapp/definitions';
import ModelViewer from './ModelViewer.vue';
import { DEFAULT_LAYER_VISIBILITY } from '../../utils/humanModel/anatomy/anatomyLayers';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const UCheckboxStub = defineComponent({
  name: 'UCheckbox',
  props: { modelValue: { type: Boolean, default: false }, label: { type: String, default: '' } },
  emits: ['update:modelValue'],
  template: `<button role="checkbox" :aria-checked="modelValue"
    @click="$emit('update:modelValue', !modelValue)">{{ label }}</button>`,
});
const mountOpts = { global: { stubs: { UCheckbox: UCheckboxStub } } };

const biceps = anatomyEntityById.get('muscle.bicepsBrachii')!;

describe('ModelViewer（佔位檢視器 View；04 §4.1）', () => {
  it('僅列出落在顯示分層的部位（joint 不列）', () => {
    const wrapper = mount(ModelViewer, {
      props: {
        visibility: { ...DEFAULT_LAYER_VISIBILITY },
        parts: anatomyEntities,
        selected: null,
      },
      ...mountOpts,
    });
    const parts = wrapper.findAll('.modelPart');
    expect(parts.length).toBeGreaterThan(0);
    // joint 不入任一顯示分層，故不列
    const jointName = anatomyEntityById.get('joint.elbow')!.name['zh-TW'];
    expect(wrapper.text()).not.toContain(jointName);
  });

  it('點部位發 selectPart 帶 anatomyId', async () => {
    const wrapper = mount(ModelViewer, {
      props: {
        visibility: { ...DEFAULT_LAYER_VISIBILITY },
        parts: [biceps],
        selected: null,
      },
      ...mountOpts,
    });
    await wrapper.get('.modelPart').trigger('click');
    expect(wrapper.emitted('selectPart')?.at(-1)).toEqual(['muscle.bicepsBrachii']);
  });

  it('selected 時渲染資訊卡', () => {
    const wrapper = mount(ModelViewer, {
      props: {
        visibility: { ...DEFAULT_LAYER_VISIBILITY },
        parts: [biceps],
        selected: biceps,
      },
      ...mountOpts,
    });
    expect(wrapper.find('.anatomyInfoCard').exists()).toBe(true);
  });
});
