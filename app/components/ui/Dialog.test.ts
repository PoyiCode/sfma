// @vitest-environment jsdom
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Dialog from './Dialog.vue';

// UModal 於非 Nuxt 環境不可載入；以契約一致替身驗證本包裝之 v-model:open／title／description／body slot 映射。
// 替身僅於 open 時渲染內容，並提供關閉鈕呼 update:open(false)（對等 Reka UI Dialog 之 close）。
const UModalStub = defineComponent({
  name: 'UModal',
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: '' },
    description: { type: String, default: undefined },
    close: { type: [Boolean, Object], default: true },
  },
  emits: ['update:open'],
  template: `<div v-if="open" role="dialog" :aria-label="title">
              <p v-if="description !== undefined">{{ description }}</p>
              <button :aria-label="(close && typeof close === 'object') ? close['aria-label'] : 'close'"
                      @click="$emit('update:open', false)">×</button>
              <slot name="body" />
            </div>`,
});

const mountOpts = { global: { stubs: { UModal: UModalStub } } };

describe('Dialog（包裝 UModal）', () => {
  it('open 時顯標題、說明、關閉鈕與內容', () => {
    const wrapper = mount(Dialog, {
      props: { open: true, title: '匯入還原', description: '選擇衝突處理方式', closeLabel: '關閉' },
      slots: { default: '內容主體' },
      ...mountOpts,
    });
    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.attributes('aria-label')).toBe('匯入還原');
    expect(wrapper.text()).toContain('選擇衝突處理方式');
    expect(wrapper.find('[aria-label="關閉"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('內容主體');
  });

  it('closed 時不渲染內容', () => {
    const wrapper = mount(Dialog, {
      props: { open: false, title: '匯入還原', closeLabel: '關閉' },
      slots: { default: '內容主體' },
      ...mountOpts,
    });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('內容主體');
  });

  it('點關閉鈕發 update:open(false)', async () => {
    const wrapper = mount(Dialog, {
      props: { open: true, title: '匯入還原', closeLabel: '關閉' },
      slots: { default: '內容主體' },
      ...mountOpts,
    });
    await wrapper.get('[aria-label="關閉"]').trigger('click');
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
  });
});
