// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Skeleton from './Skeleton.vue';

describe('Skeleton（§3.3.7 載入佔位）', () => {
  it('aria-hidden、預設 variant=text', () => {
    const wrapper = mount(Skeleton);
    const span = wrapper.get('span');
    expect(span.attributes('aria-hidden')).toBe('true');
    expect(span.attributes('data-variant')).toBe('text');
  });

  it('variant 透傳 data-variant', () => {
    const wrapper = mount(Skeleton, { props: { variant: 'circle' } });
    expect(wrapper.get('span').attributes('data-variant')).toBe('circle');
  });

  it('width/height 套用為 inline style', () => {
    const wrapper = mount(Skeleton, { props: { width: '40%', height: '12px' } });
    const style = wrapper.get('span').attributes('style') ?? '';
    expect(style).toContain('width: 40%');
    expect(style).toContain('height: 12px');
  });
});
