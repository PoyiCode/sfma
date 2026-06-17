// @vitest-environment jsdom
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Switch from './Switch.vue';

// USwitch 於非 Nuxt 環境不可載入；以契約一致替身驗證本包裝之 prop 映射與 v-model 接線。
const USwitchStub = defineComponent({
  name: 'USwitch',
  props: { modelValue: { type: Boolean, default: false }, label: { type: String, default: '' }, disabled: Boolean },
  emits: ['update:modelValue'],
  template: `<button role="switch" :aria-checked="modelValue" :disabled="disabled"
              @click="$emit('update:modelValue', !modelValue)">{{ label }}</button>`,
});

const mountOpts = { global: { stubs: { USwitch: USwitchStub } } };

describe('Switch（03 §3.7.4 基礎開關，包裝 USwitch）', () => {
  it('label 傳入、disabled 透傳', () => {
    const wrapper = mount(Switch, { props: { label: '開發者模式', disabled: true }, ...mountOpts });
    const sw = wrapper.get('[role="switch"]');
    expect(sw.text()).toBe('開發者模式');
    expect(sw.attributes('disabled')).toBeDefined();
  });

  it('v-model：點擊切換並發 update:modelValue', async () => {
    const wrapper = mount(Switch, { props: { label: '開發者模式', modelValue: false }, ...mountOpts });
    await wrapper.get('[role="switch"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([true]);
  });
});
