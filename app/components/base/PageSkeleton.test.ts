// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import PageSkeleton from './PageSkeleton.vue';

describe('PageSkeleton（§3.3.7 路由邊界載入）', () => {
  it('role=status + aria-busy，label 供報讀', () => {
    const wrapper = mount(PageSkeleton, { props: { label: '載入中' } });
    const root = wrapper.get('[role="status"]');
    expect(root.attributes('aria-busy')).toBe('true');
    expect(wrapper.get('.pageSkeletonLabel').text()).toBe('載入中');
  });

  it('行數＝lines + 標題列（預設 3 行）', () => {
    const wrapper = mount(PageSkeleton, { props: { label: '載入中' } });
    expect(wrapper.findAll('.pageSkeletonLine')).toHaveLength(3);
    expect(wrapper.findAll('.pageSkeletonTitle')).toHaveLength(1);
  });

  it('可指定 lines', () => {
    const wrapper = mount(PageSkeleton, { props: { label: '載入中', lines: 5 } });
    expect(wrapper.findAll('.pageSkeletonLine')).toHaveLength(5);
  });
});
