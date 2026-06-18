// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { sfmaPatterns } from '@ptapp/definitions';
import BodyAnnotationForm from './BodyAnnotationForm.vue';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// BaseSelect 包裝 USelect（Nuxt UI，非 Nuxt 環境不可載入）；以契約替身驗證映射。
const USelectStub = defineComponent({
  name: 'USelect',
  props: {
    modelValue: { type: String, default: '' },
    items: { type: Array as () => { value: string; label: string }[], default: () => [] },
  },
  emits: ['update:modelValue'],
  methods: {
    onChange(event: Event): void {
      this.$emit('update:modelValue', (event.target as HTMLSelectElement).value);
    },
  },
  template: `<select :value="modelValue" @change="onChange">
    <option v-for="it in items" :key="it.value" :value="it.value">{{ it.label }}</option>
  </select>`,
});
const mountOpts = { global: { stubs: { USelect: USelectStub } } };

const firstPatternKey = sfmaPatterns[0]!.patternKey;

describe('BodyAnnotationForm（部位標註表單；04 §4.5）', () => {
  it('新增模式：預設 painful＋首個動作；送出上拋草稿（note trim、side）', async () => {
    const wrapper = mount(BodyAnnotationForm, {
      props: { patterns: sfmaPatterns },
      ...mountOpts,
    });
    await wrapper.get('form').trigger('submit');
    const draft = wrapper.emitted('submit')?.at(-1)?.[0];
    expect(draft).toMatchObject({
      findingType: 'painful',
      linkedPatternKey: firstPatternKey,
      note: '',
      side: null,
    });
  });

  it('編輯模式（initial）：送出鈕文字為儲存', () => {
    const wrapper = mount(BodyAnnotationForm, {
      props: {
        patterns: sfmaPatterns,
        initial: { findingType: 'note', linkedPatternKey: firstPatternKey, note: '備註內容' },
      },
      ...mountOpts,
    });
    const submit = wrapper.find('button[type="submit"]');
    expect(submit.text()).toBe('bodyAnnotationSave');
  });

  it('sided=true 顯左/右側別分段（defaultSide 預填）', () => {
    const wrapper = mount(BodyAnnotationForm, {
      props: { patterns: sfmaPatterns, sided: true, defaultSide: 'right' },
      ...mountOpts,
    });
    // 兩個 segmented（findingType + side）
    expect(wrapper.findAll('[role="radiogroup"]').length).toBe(2);
  });

  it('canRemove=true 顯移除鈕、點按發 remove', async () => {
    const wrapper = mount(BodyAnnotationForm, {
      props: { patterns: sfmaPatterns, canRemove: true },
      ...mountOpts,
    });
    const removeBtn = wrapper.findAll('button').find((b) => b.text() === 'bodyAnnotationRemove')!;
    await removeBtn.trigger('click');
    expect(wrapper.emitted('remove')).toHaveLength(1);
  });

  it('取消鈕發 cancel', async () => {
    const wrapper = mount(BodyAnnotationForm, {
      props: { patterns: sfmaPatterns },
      ...mountOpts,
    });
    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === 'bodyAnnotationCancel')!;
    await cancelBtn.trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
