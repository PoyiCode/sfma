// @vitest-environment jsdom
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Select from './Select.vue';

// USelect 於非 Nuxt 環境不可載入；以契約一致替身（原生 select）驗證本包裝之 items/v-model/aria-label 映射。
const USelectStub = defineComponent({
  name: 'USelect',
  props: {
    modelValue: { type: String, default: '' },
    items: { type: Array as () => { value: string; label: string }[], default: () => [] },
    valueKey: { type: String, default: 'value' },
    labelKey: { type: String, default: 'label' },
  },
  emits: ['update:modelValue'],
  template: `<select :aria-label="$attrs['aria-label']"
              @change="$emit('update:modelValue', $event.target.value)">
              <option v-for="o in items" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>`,
});

const OPTIONS = [
  { value: 'a', label: '甲' },
  { value: 'b', label: '乙' },
];

const mountOpts = { global: { stubs: { USelect: USelectStub } } };

describe('Select（03 §3.7.4 下拉，包裝 USelect）', () => {
  it('options 映射為選項，ariaLabel 透傳', () => {
    const wrapper = mount(Select, { props: { options: OPTIONS, ariaLabel: '側別' }, ...mountOpts });
    const select = wrapper.get('select');
    expect(select.attributes('aria-label')).toBe('側別');
    const opts = wrapper.findAll('option');
    expect(opts).toHaveLength(2);
    expect(opts[0]!.text()).toBe('甲');
  });

  it('v-model：選擇更新 model', async () => {
    const wrapper = mount(Select, {
      props: { options: OPTIONS, ariaLabel: '側別', modelValue: 'a' },
      ...mountOpts,
    });
    await wrapper.get('select').setValue('b');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['b']);
  });
});
