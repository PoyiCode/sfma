// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import PatientListView from './PatientListView.vue';
import type { PatientListItemData } from '../../utils/patient/patientListItems';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// NuxtLink 替身：渲染 <a :href="to">（對等 React MemoryRouter 下的 Link）。
const NuxtLinkStub = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, default: '' } },
  template: '<a :href="to"><slot /></a>',
});

const items: PatientListItemData[] = [
  {
    patientId: 'p1',
    displayCode: 'P001',
    name: '王小明',
    lastAssessedAt: '2026-06-10T09:00:00+08:00',
    summary: { kind: 'flagged', dn: 2, dp: 1 },
  },
  { patientId: 'p2', displayCode: 'P002', name: '陳大華', summary: { kind: 'none' } },
  {
    patientId: 'p3',
    displayCode: 'P003',
    name: '林美麗',
    lastAssessedAt: '2026-06-11T10:00:00+08:00',
    summary: { kind: 'allFn' },
  },
];

function mountView(props: Partial<{ items: PatientListItemData[]; totalCount: number; query: string }> = {}) {
  return mount(PatientListView, {
    props: { items, totalCount: items.length, query: '', ...props },
    global: { stubs: { NuxtLink: NuxtLinkStub } },
  });
}

describe('PatientListView（03 §3.3.8 個案清單）', () => {
  it('列項顯示代碼·姓名·日期·概況，列連結至詳情', () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain('P001');
    expect(wrapper.text()).toContain('王小明');
    expect(wrapper.text()).toContain('2026-06-10');
    expect(wrapper.text()).toContain('patientNoAssessments');
    expect(wrapper.text()).toContain('patientAllFn');
    const rowLink = wrapper.findAll('a').find((a) => a.text().includes('王小明'));
    expect(rowLink?.attributes('href')).toBe('/patients/p1');
  });

  it('flagged 概況以 StatusChip＋計數呈現', () => {
    const wrapper = mountView();
    expect(wrapper.find('[aria-label="功能異常、且疼痛"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="功能異常、無疼痛"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('×1');
    expect(wrapper.text()).toContain('×2');
  });

  it('搜尋輸入回呼 update:query（v-model）', async () => {
    const wrapper = mountView();
    await wrapper.get('input[type="search"]').setValue('王');
    expect(wrapper.emitted('update:query')?.at(-1)).toEqual(['王']);
  });

  it('空資料庫（total 0）顯示引導空狀態＋新增 CTA、無搜尋框', () => {
    const wrapper = mountView({ items: [], totalCount: 0 });
    expect(wrapper.text()).toContain('patientListEmptyTitle');
    const cta = wrapper.findAll('a').find((a) => a.text().includes('patientAddCta'));
    expect(cta?.attributes('href')).toBe('/patients/new');
    expect(wrapper.find('input[type="search"]').exists()).toBe(false);
  });

  it('有資料但過濾無相符 → 顯示無相符訊息＋仍有搜尋框', () => {
    const wrapper = mountView({ items: [], totalCount: 3, query: 'zzz' });
    expect(wrapper.text()).toContain('patientListNoMatch');
    expect(wrapper.find('input[type="search"]').exists()).toBe(true);
  });
});
