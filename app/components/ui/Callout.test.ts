// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Callout from './Callout.vue';

describe('Callout（§3.7.4 提示橫幅）', () => {
  it('role=status，預設 tone=info，顯示標題與內容', () => {
    const wrapper = mount(Callout, {
      props: { title: '提醒' },
      slots: { default: '請先取得同意' },
    });
    const aside = wrapper.get('aside');
    expect(aside.attributes('role')).toBe('status');
    expect(aside.attributes('data-tone')).toBe('info');
    expect(wrapper.get('.calloutTitle').text()).toBe('提醒');
    expect(wrapper.get('.calloutContent').text()).toBe('請先取得同意');
  });

  it('tone 透傳 data-tone', () => {
    const wrapper = mount(Callout, { props: { tone: 'danger' }, slots: { default: 'x' } });
    expect(wrapper.get('aside').attributes('data-tone')).toBe('danger');
  });

  it('給 dismissLabel 時顯關閉鈕並發 dismiss 事件', async () => {
    const wrapper = mount(Callout, {
      props: { dismissLabel: '關閉' },
      slots: { default: 'x' },
    });
    const btn = wrapper.get('button');
    expect(btn.attributes('aria-label')).toBe('關閉');
    await btn.trigger('click');
    expect(wrapper.emitted('dismiss')).toHaveLength(1);
  });

  it('未給 dismissLabel 時不渲關閉鈕', () => {
    const wrapper = mount(Callout, { slots: { default: 'x' } });
    expect(wrapper.find('button').exists()).toBe(false);
  });
});
