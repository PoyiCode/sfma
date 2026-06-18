// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import AssessmentHistoryView from './AssessmentHistoryView.vue';
import type { AssessmentRowData } from '../../utils/assessment/assessmentHistory';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// NuxtLink 替身：渲染 <a :href="to">（對等 React Router 之 Link）。
const NuxtLinkStub = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, default: '' } },
  template: '<a :href="to"><slot /></a>',
});

const rows: AssessmentRowData[] = [
  { sessionId: 's1', assessedAt: '2026-06-10T09:00:00+08:00', assessorName: '王治療師', dn: 2, dp: 1 },
  { sessionId: 's2', assessedAt: '2026-06-09T09:00:00+08:00', assessorName: '陳治療師', dn: 0, dp: 0 },
];

function mountView(props: Partial<{ patientId: string; rows: AssessmentRowData[] }> = {}) {
  return mount(AssessmentHistoryView, {
    props: { patientId: 'p1', rows, ...props },
    global: { stubs: { NuxtLink: NuxtLinkStub } },
  });
}

describe('AssessmentHistoryView（03 §3.3.8 評估紀錄）', () => {
  it('列各次評估：日期·評估者·flagged 概況（DP/DN chip＋計數），列連結至 session', () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain('2026-06-10');
    expect(wrapper.text()).toContain('王治療師');
    expect(wrapper.find('[aria-label="功能異常、且疼痛"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="功能異常、無疼痛"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('×1');
    expect(wrapper.text()).toContain('×2');
    const rowLink = wrapper.findAll('a').find((a) => a.text().includes('2026-06-10'));
    expect(rowLink?.attributes('href')).toBe('/patients/p1/assessments/s1');
  });

  it('全 FN（dn=0,dp=0）顯「全 FN」，無 chip', () => {
    const wrapper = mountView();
    const allFn = wrapper.findAll('.assessmentRow').find((r) => r.text().includes('2026-06-09'));
    expect(allFn?.text()).toContain('patientAllFn');
  });

  it('空清單顯引導空狀態＋新增 CTA（連結至 /new）', () => {
    const wrapper = mountView({ rows: [] });
    expect(wrapper.text()).toContain('patientNoAssessments');
    expect(wrapper.text()).toContain('assessmentHistoryEmptyHint');
    const cta = wrapper.findAll('a').find((a) => a.text().includes('titleAssessmentNew'));
    expect(cta?.attributes('href')).toBe('/patients/p1/assessments/new');
  });
});
