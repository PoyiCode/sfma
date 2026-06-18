// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import PatientFormView from './PatientFormView.vue';
import { emptyPatientFormValues, type PatientFormValues } from '../../utils/patient/patientForm';

// useI18n（Nuxt 自動 import）於純 vitest 不存在 → 以恒等 t 全域替身（回傳鍵）。
beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// UCheckbox（Nuxt UI）替身：渲染原生 checkbox＋label，維持 v-model 與 role=checkbox。
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

function mountView(props: Partial<InstanceType<typeof PatientFormView>['$props']> = {}) {
  const defaults = {
    mode: 'create' as const,
    values: { ...emptyPatientFormValues } as PatientFormValues,
    errors: {},
    saving: false,
    saveError: false,
    canSave: false,
  };
  return mount(PatientFormView, {
    props: { ...defaults, ...props },
    global: { stubs: { UCheckbox: UCheckboxStub } },
  });
}

describe('PatientFormView（03 §3.3.8 個案表單）', () => {
  it('create 模式顯示姓名欄與告知同意勾選', () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain('patientFormName');
    expect(wrapper.get('input[type="checkbox"]').attributes('aria-label')).toBe(
      'patientFormConsentCheckbox',
    );
  });

  it('canSave 為 false 時儲存鈕停用', () => {
    const wrapper = mountView({ canSave: false });
    const saveBtn = wrapper.findAll('button').find((b) => b.text() === 'patientFormSave');
    expect(saveBtn?.attributes('disabled')).toBeDefined();
  });

  it('canSave 時送出觸發 submit', async () => {
    const wrapper = mountView({ canSave: true });
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('submit')).toHaveLength(1);
  });

  it('name 錯誤顯示必填訊息並標記 invalid＋aria-describedby 關聯 role=alert', () => {
    const wrapper = mountView({ errors: { name: 'required' } });
    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain('patientFormNameRequired');
    const nameInput = wrapper.get('input.input');
    expect(nameInput.attributes('aria-invalid')).toBe('true');
    expect(nameInput.attributes('aria-describedby')).toBe('patientFormNameError');
    expect(alert.attributes('id')).toBe('patientFormNameError');
  });

  it('name 無錯誤時不標 invalid、無 aria-describedby', () => {
    const wrapper = mountView({ errors: {} });
    const nameInput = wrapper.get('input.input');
    expect(nameInput.attributes('aria-invalid')).toBeUndefined();
    expect(nameInput.attributes('aria-describedby')).toBeUndefined();
  });

  it('輸入姓名回呼 change', async () => {
    const wrapper = mountView();
    await wrapper.get('input.input').setValue('王');
    expect(wrapper.emitted('change')?.at(-1)).toEqual([{ name: '王' }]);
  });

  it('edit 模式不顯示同意勾選、改顯示已取得提示', () => {
    const wrapper = mountView({
      mode: 'edit',
      values: { name: '王', displayCode: 'P001', consentChecked: true },
    });
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false);
    expect(wrapper.text()).toContain('patientFormConsentAlreadyAcknowledged');
  });

  it('saveError 顯示存檔失敗訊息並以 role=alert 宣讀', () => {
    const wrapper = mountView({ saveError: true });
    expect(wrapper.get('[role="alert"]').text()).toContain('patientFormSaveError');
  });

  it('取消觸發 cancel', async () => {
    const wrapper = mountView();
    const cancelBtn = wrapper.findAll('button').find((b) => b.text() === 'patientFormCancel');
    await cancelBtn?.trigger('click');
    expect(wrapper.emitted('cancel')).toHaveLength(1);
  });
});
