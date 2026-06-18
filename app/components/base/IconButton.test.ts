// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import IconButton from './IconButton.vue';

describe('IconButton（03 §3.7.5 icon-only 鈕）', () => {
  it('label 同時作 aria-label 與 title，icon 以 aria-hidden 呈現', () => {
    const wrapper = mount(IconButton, { props: { label: '關閉', icon: '×' } });
    const btn = wrapper.get('button');
    expect(btn.attributes('aria-label')).toBe('關閉');
    expect(btn.attributes('title')).toBe('關閉');
    const glyph = wrapper.get('.iconButtonGlyph');
    expect(glyph.attributes('aria-hidden')).toBe('true');
    expect(glyph.text()).toBe('×');
  });

  it('預設 type=button', () => {
    const wrapper = mount(IconButton, { props: { label: '設定' } });
    expect(wrapper.get('button').attributes('type')).toBe('button');
  });

  it('轉發 click 事件', async () => {
    const onClick = vi.fn();
    const wrapper = mount(IconButton, { props: { label: '設定' }, attrs: { onClick } });
    await wrapper.get('button').trigger('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
