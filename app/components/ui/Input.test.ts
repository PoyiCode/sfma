// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Input from './Input.vue';

describe('Input（03 §3.7.4 基礎輸入）', () => {
  it('預設 type=text', () => {
    const wrapper = mount(Input);
    expect(wrapper.get('input').attributes('type')).toBe('text');
  });

  it('v-model 雙向綁定：輸入更新 model', async () => {
    const wrapper = mount(Input, { props: { modelValue: '初始' } });
    const input = wrapper.get('input');
    expect((input.element as HTMLInputElement).value).toBe('初始');
    await input.setValue('改寫');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['改寫']);
  });

  it('透傳 aria-invalid 等原生屬性', () => {
    const wrapper = mount(Input, { attrs: { 'aria-invalid': 'true' } });
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('true');
  });
});
