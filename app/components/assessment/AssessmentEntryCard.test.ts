// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import type { PatternRecord } from '@ptapp/shared';
import AssessmentEntryCard from './AssessmentEntryCard.vue';
import type { AssessmentEntry } from '../../utils/assessment/assessmentForm';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// NuxtLink 替身（對等 React MemoryRouter Link）。
const NuxtLinkStub = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, default: '' } },
  template: '<a :href="to"><slot /></a>',
});

// UCheckbox 替身：原生 checkbox（BaseCheckbox 底層為 Nuxt UI UCheckbox）。
const UCheckboxStub = defineComponent({
  name: 'UCheckbox',
  props: { modelValue: { type: Boolean, default: false }, label: { type: String, default: '' } },
  emits: ['update:modelValue'],
  methods: {
    onToggle(event: Event) {
      this.$emit('update:modelValue', (event.target as HTMLInputElement).checked);
    },
  },
  template: `<label><input type="checkbox" :checked="modelValue" :aria-label="label" @change="onToggle" /><span>{{ label }}</span></label>`,
});

const entry: AssessmentEntry = {
  patternKey: 'cervicalFlexion',
  side: 'left',
  definition: {
    patternKey: 'cervicalFlexion',
    name: { 'zh-TW': '頸椎屈曲', en: 'Cervical Flexion' },
    side: 'bilateral',
    criteria: [
      { code: 'cannotTouchSternumToChin', label: { 'zh-TW': '下巴無法觸胸', en: 'Chin to chest' } },
      {
        code: 'noseNotAlignedMidClavicle',
        label: { 'zh-TW': '鼻不對齊鎖骨中點', en: 'Nose not aligned' },
      },
    ],
  },
};

function makeRecord(overrides: Partial<PatternRecord> = {}): PatternRecord {
  return {
    patternKey: 'cervicalFlexion',
    side: 'left',
    painful: false,
    dysfunctional: false,
    failedCriteria: [],
    notes: '',
    ...overrides,
  };
}

function mountCard(
  record: PatternRecord,
  props: Partial<{
    breakoutEnabled: boolean;
    modelHref: string;
  }> = {},
) {
  return mount(AssessmentEntryCard, {
    props: { entry, record, ...props },
    global: { stubs: { NuxtLink: NuxtLinkStub, UCheckbox: UCheckboxStub } },
  });
}

describe('AssessmentEntryCard（判讀卡）', () => {
  describe('2×2 判讀方格（SfmaQuadrant 整合）', () => {
    it('顯示 4 個判讀格 FN/FP/DN/DP', () => {
      const wrapper = mountCard(makeRecord());
      const cells = wrapper.findAll('[role="radio"]');
      expect(cells).toHaveLength(4);
      const codes = cells.map((c) => c.text());
      expect(codes).toEqual(['FN', 'FP', 'DN', 'DP']);
    });

    it('初始 FN（painful=false, dysfunctional=false）時 FN 格 aria-checked=true', () => {
      const wrapper = mountCard(makeRecord());
      const cells = wrapper.findAll('[role="radio"]');
      expect(cells[0]!.attributes('aria-checked')).toBe('true'); // FN
      expect(cells[3]!.attributes('aria-checked')).toBe('false'); // DP
    });

    it('點按 DP 格 → emit change，新紀錄 painful=true, dysfunctional=true', async () => {
      const wrapper = mountCard(makeRecord());
      const cells = wrapper.findAll('[role="radio"]');
      await cells[3]!.trigger('click'); // DP
      const emitted = wrapper.emitted('change');
      expect(emitted).toHaveLength(1);
      const newRecord = emitted![0]![0] as PatternRecord;
      expect(newRecord.painful).toBe(true);
      expect(newRecord.dysfunctional).toBe(true);
    });

    it('點按 FP 格 → emit change，新紀錄 painful=true, dysfunctional=false', async () => {
      const wrapper = mountCard(makeRecord());
      await wrapper.findAll('[role="radio"]')[1]!.trigger('click'); // FP
      const newRecord = wrapper.emitted('change')![0]![0] as PatternRecord;
      expect(newRecord.painful).toBe(true);
      expect(newRecord.dysfunctional).toBe(false);
    });

    it('點按 DN 格 → emit change，新紀錄 painful=false, dysfunctional=true', async () => {
      const wrapper = mountCard(makeRecord());
      await wrapper.findAll('[role="radio"]')[2]!.trigger('click'); // DN
      const newRecord = wrapper.emitted('change')![0]![0] as PatternRecord;
      expect(newRecord.painful).toBe(false);
      expect(newRecord.dysfunctional).toBe(true);
    });

    it('點按 FN 格 → emit change，新紀錄 painful=false, dysfunctional=false', async () => {
      const wrapper = mountCard(makeRecord({ painful: true, dysfunctional: true }));
      await wrapper.findAll('[role="radio"]')[0]!.trigger('click'); // FN
      const newRecord = wrapper.emitted('change')![0]![0] as PatternRecord;
      expect(newRecord.painful).toBe(false);
      expect(newRecord.dysfunctional).toBe(false);
    });

    it('failedCriteria 不空但 dysfunctional 為 false 時顯「已手動」', () => {
      // isManualOverride：dysfunctional !== (failedCriteria.length > 0)
      const record = makeRecord({
        failedCriteria: ['cannotTouchSternumToChin'],
        dysfunctional: false,
      });
      const wrapper = mountCard(record);
      expect(wrapper.text()).toContain('assessmentManualOverride');
    });

    it('手動未覆寫時不顯「已手動」', () => {
      const record = makeRecord({
        failedCriteria: ['cannotTouchSternumToChin'],
        dysfunctional: true,
      });
      const wrapper = mountCard(record);
      expect(wrapper.text()).not.toContain('assessmentManualOverride');
    });
  });

  describe('判讀標準（criteria fieldset）', () => {
    it('顯示 criteria 各項', () => {
      const wrapper = mountCard(makeRecord());
      expect(wrapper.text()).toContain('下巴無法觸胸');
      expect(wrapper.text()).toContain('鼻不對齊鎖骨中點');
    });

    it('勾選 criteria 後 emit change，failedCriteria 含該碼', async () => {
      const wrapper = mountCard(makeRecord());
      // UCheckboxStub 渲染 input[type=checkbox] + aria-label；找 criteria 區的第一個
      const checkboxes = wrapper.findAll('fieldset input[type="checkbox"]');
      await checkboxes[0]!.setValue(true);
      const newRecord = wrapper.emitted('change')![0]![0] as PatternRecord;
      expect(newRecord.failedCriteria).toContain('cannotTouchSternumToChin');
    });
  });

  describe('StatusChip 與側別標頭', () => {
    it('顯示側別標籤（左）', () => {
      const wrapper = mountCard(makeRecord());
      expect(wrapper.text()).toContain('assessmentSideLeft');
    });

    it('顯示 StatusChip（data-status=FN）', () => {
      const wrapper = mountCard(makeRecord());
      const chip = wrapper.find('[data-status]');
      expect(chip.attributes('data-status')).toBe('FN');
    });

    it('DP 時 StatusChip data-status=DP', () => {
      const wrapper = mountCard(makeRecord({ painful: true, dysfunctional: true }));
      expect(wrapper.find('[data-status]').attributes('data-status')).toBe('DP');
    });
  });

  describe('Breakout 入口', () => {
    it('DN 時且 breakoutEnabled=true 顯 Breakout 按鈕', () => {
      const record = makeRecord({ dysfunctional: true });
      const wrapper = mountCard(record, { breakoutEnabled: true });
      expect(wrapper.text()).toContain('breakoutEntry');
    });

    it('FN 時 Breakout 按鈕不顯', () => {
      const wrapper = mountCard(makeRecord(), { breakoutEnabled: true });
      expect(wrapper.text()).not.toContain('breakoutEntry');
    });

    it('Breakout 按鈕點按上拋 openBreakout', async () => {
      const record = makeRecord({ dysfunctional: true });
      const wrapper = mountCard(record, { breakoutEnabled: true });
      const btns = wrapper.findAll('button');
      const breakoutBtn = btns.find((b) => b.text().includes('breakoutEntry'));
      await breakoutBtn!.trigger('click');
      expect(wrapper.emitted('openBreakout')).toBeDefined();
    });
  });

  describe('動作參考圖', () => {
    it('顯示該動作的參考圖（含可存取 alt）', () => {
      const wrapper = mountCard(makeRecord());
      const img = wrapper.find('.assessmentEntryCardFigure img');
      expect(img.exists()).toBe(true);
      expect(img.attributes('src')).toBeTruthy();
      // alt＝資料層動作名稱 + i18n 參考圖標籤（t 於測試回傳 key）。
      expect(img.attributes('alt')).toContain('頸椎屈曲');
      expect(img.attributes('alt')).toContain('assessmentMovementReference');
    });
  });

  describe('modelHref 深連結', () => {
    it('FN 時不顯「標到模型」', () => {
      const wrapper = mountCard(makeRecord(), { modelHref: '/model?x=1' });
      expect(wrapper.text()).not.toContain('markOnModel');
    });

    it('DP 且有 modelHref 時顯「標到模型」', () => {
      const record = makeRecord({ painful: true, dysfunctional: true });
      const wrapper = mountCard(record, { modelHref: '/model?x=1' });
      expect(wrapper.text()).toContain('markOnModel');
    });
  });
});
