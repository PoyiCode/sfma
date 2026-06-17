// @vitest-environment jsdom
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AlertDialog from './AlertDialog.vue';

// UModal 替身（確認型）：open 時渲染 title/description 與 footer slot；對等 Reka UI Dialog 行為。
const UModalStub = defineComponent({
  name: 'UModal',
  props: { open: { type: Boolean, default: false }, title: { type: String, default: '' }, description: { type: String, default: undefined } },
  emits: ['update:open'],
  template: `<div v-if="open" role="alertdialog" :aria-label="title">
              <p v-if="description !== undefined">{{ description }}</p>
              <slot name="footer" />
            </div>`,
});

const mountOpts = { global: { stubs: { UModal: UModalStub } } };

describe('AlertDialog（破壞性確認，包裝 UModal）', () => {
  it('open 時顯標題、說明與取消／確認鈕', () => {
    const wrapper = mount(AlertDialog, {
      props: {
        open: true,
        title: '刪除個案',
        description: '此動作無法復原',
        cancelLabel: '取消',
        actionLabel: '刪除',
        destructive: true,
      },
      ...mountOpts,
    });
    expect(wrapper.get('[role="alertdialog"]').attributes('aria-label')).toBe('刪除個案');
    expect(wrapper.text()).toContain('此動作無法復原');
    expect(wrapper.text()).toContain('取消');
    expect(wrapper.text()).toContain('刪除');
  });

  it('點確認發 confirm 並關閉（update:open false）', async () => {
    const wrapper = mount(AlertDialog, {
      props: { open: true, title: 't', cancelLabel: '取消', actionLabel: '確認' },
      ...mountOpts,
    });
    const buttons = wrapper.findAll('button');
    const action = buttons.find((b) => b.text() === '確認')!;
    await action.trigger('click');
    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
  });

  it('點取消僅關閉、不發 confirm', async () => {
    const wrapper = mount(AlertDialog, {
      props: { open: true, title: 't', cancelLabel: '取消', actionLabel: '確認' },
      ...mountOpts,
    });
    const cancel = wrapper.findAll('button').find((b) => b.text() === '取消')!;
    await cancel.trigger('click');
    expect(wrapper.emitted('confirm')).toBeUndefined();
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false]);
  });
});
