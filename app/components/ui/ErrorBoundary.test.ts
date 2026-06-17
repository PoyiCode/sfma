// @vitest-environment jsdom
import { defineComponent, h, nextTick } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ErrorBoundary from './ErrorBoundary.vue';

// 渲染時即拋錯之子元件（模擬 3D 子樹載入／執行期失敗）。
const Boom = defineComponent({
  props: { message: { type: String, default: 'boom' } },
  setup(props) {
    return () => {
      throw new Error(props.message);
    };
  },
});

describe('ErrorBoundary（一般用途錯誤邊界，02 §2.5 後備）', () => {
  it('子樹正常時渲染 default、不渲 fallback', () => {
    const wrapper = mount(ErrorBoundary, {
      slots: { default: () => h('div', '內容'), fallback: () => h('div', '後備') },
    });
    expect(wrapper.text()).toContain('內容');
    expect(wrapper.text()).not.toContain('後備');
  });

  it('子樹拋錯時改渲 fallback 並以該錯誤發 error 事件', async () => {
    // Vue 捕捉錯誤時會於 console 輸出；抑制噪音。
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const wrapper = mount(ErrorBoundary, {
      slots: { default: () => h(Boom, { message: '3D 載入失敗' }), fallback: () => h('div', '後備') },
    });
    await nextTick();
    expect(wrapper.text()).toContain('後備');
    const emitted = wrapper.emitted('error');
    expect(emitted).toHaveLength(1);
    const error = emitted![0]![0] as Error;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('3D 載入失敗');
    spy.mockRestore();
    errSpy.mockRestore();
  });
});
