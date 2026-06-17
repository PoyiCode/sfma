// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import Button from './Button.vue';

describe('Button（03 §3.7.4 基礎動作鈕）', () => {
  it('顯示子內容，預設 type=button（避免誤觸表單送出）', () => {
    const wrapper = mount(Button, { slots: { default: '儲存' } });
    const btn = wrapper.get('button');
    expect(btn.text()).toBe('儲存');
    expect(btn.attributes('type')).toBe('button');
  });

  it('預設 variant=primary，可指定其他 variant（data-variant）', async () => {
    const wrapper = mount(Button, { slots: { default: '主要' } });
    expect(wrapper.get('button').attributes('data-variant')).toBe('primary');
    await wrapper.setProps({ variant: 'danger' });
    expect(wrapper.get('button').attributes('data-variant')).toBe('danger');
  });

  it('轉發 click 事件', async () => {
    const onClick = vi.fn();
    const wrapper = mount(Button, { attrs: { onClick }, slots: { default: '送出' } });
    await wrapper.get('button').trigger('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('轉發 disabled 屬性', () => {
    const wrapper = mount(Button, { attrs: { disabled: true }, slots: { default: '送出' } });
    expect(wrapper.get('button').attributes('disabled')).toBeDefined();
  });
});
