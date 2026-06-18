// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import ImportDialogView from './ImportDialogView.vue';
import type { ImportPlan } from '../../utils/data/importer';
import type { DataImportPhase } from '../../composables/settings/useDataImport';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// UModal 替身：open 時渲染 title 與 body slot；對等 Reka UI Dialog。
const UModalStub = defineComponent({
  name: 'UModal',
  props: { open: { type: Boolean, default: false }, title: { type: String, default: '' } },
  emits: ['update:open'],
  template: `<div v-if="open" role="dialog" :aria-label="title"><slot name="body" /></div>`,
});

// UCheckbox 替身：原生 checkbox＋label，維持 v-model。
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

function plan(overrides: Partial<ImportPlan> = {}): ImportPlan {
  return {
    envelope: {
      exportVersion: 1,
      schemaVersion: 1,
      exportedAt: '2026-06-13T18:00:00+08:00',
      scope: 'all',
      patients: [],
      assessments: [],
    },
    conflictingPatientIds: [],
    conflictingSessionIds: [],
    hasSettings: false,
    ...overrides,
  };
}

function mountView(phase: DataImportPhase, props: Record<string, unknown> = {}) {
  return mount(ImportDialogView, {
    props: { phase, conflictStrategy: 'skip', applySettings: false, ...props },
    global: { stubs: { UModal: UModalStub, UCheckbox: UCheckboxStub } },
  });
}

describe('ImportDialogView（匯入還原對話框）', () => {
  it('idle 不渲染對話框', () => {
    const wrapper = mountView({ status: 'idle' });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('planned 無衝突無設定：顯就緒訊息＋開始匯入，無策略 radio／無 applySettings', () => {
    const wrapper = mountView({ status: 'planned', plan: plan() });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('settingsImportReady');
    expect(wrapper.find('[role="radio"]').exists()).toBe(false);
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
  });

  it('planned 有衝突：顯衝突文字與策略 radio，點覆蓋發 conflictStrategyChange', async () => {
    const wrapper = mountView({
      status: 'planned',
      plan: plan({ conflictingPatientIds: ['p1'], conflictingSessionIds: ['s1', 's2'] }),
    });
    expect(wrapper.text()).toContain('settingsImportConflict');
    const overwrite = wrapper.findAll('[role="radio"]').find((r) => r.text() === 'settingsImportStrategyOverwrite')!;
    await overwrite.trigger('click');
    expect(wrapper.emitted('conflictStrategyChange')?.at(-1)).toEqual(['overwrite']);
  });

  it('planned hasSettings：顯 applySettings checkbox，勾選發 applySettingsChange', async () => {
    const wrapper = mountView({ status: 'planned', plan: plan({ hasSettings: true }) });
    const checkbox = wrapper.find('input[type="checkbox"]');
    expect(checkbox.exists()).toBe(true);
    await checkbox.setValue(true);
    expect(wrapper.emitted('applySettingsChange')?.at(-1)).toEqual([true]);
  });

  it('planned 點開始匯入發 confirm', async () => {
    const wrapper = mountView({ status: 'planned', plan: plan() });
    const confirm = wrapper.findAll('button').find((b) => b.text() === 'settingsImportConfirm')!;
    await confirm.trigger('click');
    expect(wrapper.emitted('confirm')).toHaveLength(1);
  });

  it('importing 顯匯入中', () => {
    const wrapper = mountView({ status: 'importing' });
    expect(wrapper.text()).toContain('settingsImportImporting');
  });

  it('done 顯結果摘要與完成鈕，點完成發 close', async () => {
    const wrapper = mountView({
      status: 'done',
      result: {
        patientsWritten: 2,
        patientsSkipped: 1,
        assessmentsWritten: 3,
        assessmentsSkipped: 0,
        settingsApplied: false,
      },
    });
    expect(wrapper.text()).toContain('settingsImportDone');
    const done = wrapper.findAll('button').find((b) => b.text() === 'settingsImportDoneAction')!;
    await done.trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);
  });

  it('done settingsApplied 顯已套用設定', () => {
    const wrapper = mountView({
      status: 'done',
      result: {
        patientsWritten: 0,
        patientsSkipped: 0,
        assessmentsWritten: 0,
        assessmentsSkipped: 0,
        settingsApplied: true,
      },
    });
    expect(wrapper.text()).toContain('settingsImportSettingsApplied');
  });

  it('error 以 role=alert 宣讀對應訊息鍵', () => {
    const wrapper = mountView({ status: 'error', code: 'invalidJson' });
    expect(wrapper.find('[role="alert"]').text()).toBe('settingsImportErrorInvalidJson');
  });
});
