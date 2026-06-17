// @vitest-environment jsdom
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Checkbox from './Checkbox.vue';

// UCheckbox 於非 Nuxt 環境不可載入（依賴 #imports/#build 虛擬模組）。
// 以契約一致的測試替身驗證「本包裝」之 prop 映射與 v-model 接線（行為交予 Nuxt UI／Reka UI）。
const UCheckboxStub = defineComponent({
  name: 'UCheckbox',
  props: { modelValue: { type: Boolean, default: false }, label: { type: String, default: '' }, disabled: Boolean },
  emits: ['update:modelValue'],
  template: `<button role="checkbox" :aria-checked="modelValue" :disabled="disabled"
              @click="$emit('update:modelValue', !modelValue)">{{ label }}</button>`,
});

const mountOpts = { global: { stubs: { UCheckbox: UCheckboxStub } } };

describe('Checkbox（03 §3.7.4 基礎勾選，包裝 UCheckbox）', () => {
  it('label 傳入、disabled 透傳', () => {
    const wrapper = mount(Checkbox, { props: { label: '已取得同意', disabled: true }, ...mountOpts });
    const box = wrapper.get('[role="checkbox"]');
    expect(box.text()).toBe('已取得同意');
    expect(box.attributes('disabled')).toBeDefined();
  });

  it('v-model：點擊切換並發 update:modelValue', async () => {
    const wrapper = mount(Checkbox, { props: { label: '同意', modelValue: false }, ...mountOpts });
    await wrapper.get('[role="checkbox"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([true]);
  });

  it('受控 modelValue 反映於 aria-checked', () => {
    const wrapper = mount(Checkbox, { props: { label: '同意', modelValue: true }, ...mountOpts });
    expect(wrapper.get('[role="checkbox"]').attributes('aria-checked')).toBe('true');
  });
});
