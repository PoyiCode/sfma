// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import PageError from './PageError.vue';

describe('PageError（§3.3.7 資料層錯誤＋重試）', () => {
  it('role=alert 並顯示訊息', () => {
    const wrapper = mount(PageError, { props: { message: '載入失敗' } });
    const root = wrapper.get('[role="alert"]');
    expect(root.text()).toContain('載入失敗');
  });

  it('給 retryLabel 時顯重試鈕並發 retry 事件', async () => {
    const wrapper = mount(PageError, { props: { message: '載入失敗', retryLabel: '重試' } });
    const btn = wrapper.get('button');
    expect(btn.text()).toBe('重試');
    await btn.trigger('click');
    expect(wrapper.emitted('retry')).toHaveLength(1);
  });

  it('未給 retryLabel 時不渲重試鈕', () => {
    const wrapper = mount(PageError, { props: { message: '載入失敗' } });
    expect(wrapper.find('button').exists()).toBe(false);
  });
});
