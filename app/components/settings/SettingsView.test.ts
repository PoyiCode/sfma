// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import type { AppSettings } from '@ptapp/shared';
import SettingsView from './SettingsView.vue';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// UModal 替身（AlertDialog/FullLodConfirmDialog 底層）：open 時渲染 footer slot。
const UModalStub = defineComponent({
  name: 'UModal',
  props: { open: { type: Boolean, default: false }, title: { type: String, default: '' } },
  emits: ['update:open'],
  template: `<div v-if="open" role="alertdialog" :aria-label="title"><slot name="footer" /></div>`,
});
// UCheckbox 替身：原生 checkbox。
const UCheckboxStub = defineComponent({
  name: 'UCheckbox',
  props: { modelValue: { type: Boolean, default: false }, label: { type: String, default: '' } },
  emits: ['update:modelValue'],
  methods: {
    onToggle(event: Event) {
      this.$emit('update:modelValue', (event.target as HTMLInputElement).checked);
    },
  },
  template: `<label><input type="checkbox" :checked="modelValue" :aria-label="label"
    @change="onToggle" /><span>{{ label }}</span></label>`,
});
// UAccordion 替身：渲染各列 trigger（label）＋具名 slot 內容。
const UAccordionStub = defineComponent({
  name: 'UAccordion',
  props: { items: { type: Array as () => Array<{ value: string; label: string }>, default: () => [] } },
  template: `<div><div v-for="item in items" :key="item.value">
    <span>{{ item.label }}</span><slot :name="item.value" /></div></div>`,
});

function settings(over: Partial<AppSettings> = {}): AppSettings {
  return {
    schemaVersion: 1,
    settingsId: 'app',
    therapistProfile: { assessorId: 'a1', name: '王治療師' },
    locale: 'zh-TW',
    lodMode: 'auto',
    orientationPreference: 'auto',
    defaultLayers: { bone: true, deepMuscle: false, superficialMuscle: false, nerve: false },
    theme: 'system',
    updatedAt: '2026-06-14T09:00:00+08:00',
    ...over,
  };
}

function mountView(props: Record<string, unknown> = {}) {
  return mount(SettingsView, {
    props: { settings: settings(), dataExport: { exporting: false, exportError: false }, ...props },
    global: { stubs: { UModal: UModalStub, UCheckbox: UCheckboxStub, UAccordion: UAccordionStub } },
  });
}

describe('SettingsView（設定主畫面）', () => {
  it('治療師姓名輸入 → 發 change（therapistProfile.name）', async () => {
    const wrapper = mountView();
    const input = wrapper.find('input.input');
    await input.setValue('李治療師');
    const last = wrapper.emitted('change')?.at(-1)?.[0] as Partial<AppSettings>;
    expect(last.therapistProfile?.name).toBe('李治療師');
  });

  it('語系／主題 SegmentedControl 切換 → 發 change', async () => {
    const wrapper = mountView();
    // theme 選 dark（radio role）。
    const dark = wrapper.findAll('[role="radio"]').find((r) => r.text() === 'settingsThemeDark')!;
    await dark.trigger('click');
    const changes = wrapper.emitted('change')?.map((c) => c[0]) as Array<Partial<AppSettings>>;
    expect(changes.some((c) => c.theme === 'dark')).toBe(true);
  });

  it('分層 checkbox 勾選 → 發 change（defaultLayers）', async () => {
    const wrapper = mountView();
    const nerve = wrapper.findAll('input[type="checkbox"]').find(
      (c) => c.attributes('aria-label') === 'settingsLayerNerve',
    )!;
    await nerve.setValue(true);
    const last = wrapper.emitted('change')?.at(-1)?.[0] as Partial<AppSettings>;
    expect(last.defaultLayers?.nerve).toBe(true);
  });

  it('importEnabled 預設關：不顯匯入拖放區', () => {
    const wrapper = mountView();
    expect(wrapper.find('[data-testid="importDropzone"]').exists()).toBe(false);
  });

  it('importEnabled 開：顯匯入拖放區，選檔發 selectImportFile', async () => {
    const wrapper = mountView({ importEnabled: true });
    const dropzone = wrapper.find('[data-testid="importDropzone"]');
    expect(dropzone.exists()).toBe(true);
    const file = new File(['{}'], 'backup.json', { type: 'application/json' });
    const input = wrapper.find('input[type="file"]');
    Object.defineProperty(input.element, 'files', { value: [file] });
    await input.trigger('change');
    expect(wrapper.emitted('selectImportFile')?.at(-1)).toEqual([file]);
  });

  it('匯出鈕點擊開確認對話框，確認後發 exportAll', async () => {
    const wrapper = mountView();
    const exportBtn = wrapper.findAll('button').find((b) => b.text() === 'settingsExportAll')!;
    await exportBtn.trigger('click');
    const action = wrapper
      .findAll('button')
      .find((b) => b.text() === 'settingsExportConfirmAction')!;
    await action.trigger('click');
    expect(wrapper.emitted('exportAll')).toHaveLength(1);
  });

  it('exportError 為真時 role=alert 顯錯誤', () => {
    const wrapper = mountView({ dataExport: { exporting: false, exportError: true } });
    expect(wrapper.find('[role="alert"]').text()).toBe('settingsExportAllError');
  });
});
