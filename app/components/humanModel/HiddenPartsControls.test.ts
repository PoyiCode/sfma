// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import HiddenPartsControls from './HiddenPartsControls.vue';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('HiddenPartsControls（已隱藏部位清單；04 §4.1）', () => {
  it('無隱藏部位時休眠（不渲染）', () => {
    const wrapper = mount(HiddenPartsControls, { props: { hiddenIds: [] } });
    expect(wrapper.find('.hiddenPartsControls').exists()).toBe(false);
  });

  it('逐筆顯部位名（成對併側別後綴）', () => {
    const wrapper = mount(HiddenPartsControls, {
      props: { hiddenIds: ['bone.humerus@left', 'nerve.radial'] },
    });
    const items = wrapper.findAll('.hiddenPartsItem');
    expect(items).toHaveLength(2);
    expect(items[0]!.text()).toContain('肱骨');
    expect(items[0]!.text()).toContain('assessmentSideLeft');
  });

  it('「恢復全部」發 restoreAll；逐筆「恢復」發 restore 帶 partKey', async () => {
    const wrapper = mount(HiddenPartsControls, {
      props: { hiddenIds: ['bone.humerus@left'] },
    });
    const buttons = wrapper.findAll('button');
    const restoreAll = buttons.find((b) => b.text() === 'hiddenPartsRestoreAll')!;
    await restoreAll.trigger('click');
    expect(wrapper.emitted('restoreAll')).toHaveLength(1);
    const restore = wrapper.find('.hiddenPartsItem button');
    await restore.trigger('click');
    expect(wrapper.emitted('restore')?.at(-1)).toEqual(['bone.humerus@left']);
  });
});
