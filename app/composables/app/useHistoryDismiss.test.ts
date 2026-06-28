// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useHistoryDismiss } from './useHistoryDismiss';

function mountWith(onDismiss: () => void) {
  let dismiss: () => void = () => {};
  const Comp = defineComponent({
    setup() {
      dismiss = useHistoryDismiss(onDismiss);
      return () => h('div');
    },
  });
  const wrapper = mount(Comp);
  return { wrapper, dismiss: () => dismiss() };
}

afterEach(() => vi.restoreAllMocks());

describe('useHistoryDismiss（03 §3.3.5）', () => {
  it('掛載：推哨兵 history entry 並監聽 popstate', () => {
    const push = vi.spyOn(window.history, 'pushState');
    const onDismiss = vi.fn();
    const { wrapper } = mountWith(onDismiss);
    expect(push).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('dismiss() 退掉哨兵（history.back）', () => {
    const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { wrapper, dismiss } = mountWith(vi.fn());
    dismiss();
    expect(back).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('卸載後不再回應 popstate（移除監聽）', () => {
    const onDismiss = vi.fn();
    const { wrapper } = mountWith(onDismiss);
    wrapper.unmount();
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
