// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { sfmaPatterns } from '@ptapp/definitions';
import type { AssessmentSession } from '@ptapp/shared';
import AssessmentSummaryView from './AssessmentSummaryView.vue';
import { buildAssessmentEntries } from '../../utils/assessment/assessmentForm';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const entries = buildAssessmentEntries(sfmaPatterns);
const firstSingle = entries.find((entry) => entry.side === null)!;

function session(overrides: Partial<AssessmentSession['summary']> = {}): AssessmentSession {
  return {
    schemaVersion: 1,
    sessionId: 's1',
    patientId: 'p1',
    assessor: { assessorId: 'a1', name: '王' },
    assessedAt: '2026-06-10T09:00:00+08:00',
    patterns: [],
    breakouts: [],
    bodyAnnotations: [],
    summary: {
      counts: { FN: 3, FP: 1, DN: 2, DP: 0 },
      painfulPatterns: [],
      dysfunctionalPatterns: [],
      ...overrides,
    },
  };
}

describe('AssessmentSummaryView（05 §5.1/§5.4 評估總覽，只讀）', () => {
  it('分類統計各碼 StatusChip＋計數取自 session.summary.counts', () => {
    const wrapper = mount(AssessmentSummaryView, { props: { session: session(), entries } });
    expect(wrapper.find('[aria-label="功能正常、無疼痛"]').exists()).toBe(true);
    const text = wrapper.get('.assessmentSummaryCountList').text();
    expect(text).toContain('3');
    expect(text).toContain('1');
    expect(text).toContain('2');
  });

  it('無疼痛／功能異常部位時顯空狀態', () => {
    const wrapper = mount(AssessmentSummaryView, { props: { session: session(), entries } });
    // 兩組（疼痛、功能異常、findings）皆空 → 顯 empty 文案
    expect(wrapper.text()).toContain('assessmentSummaryEmpty');
  });

  it('painfulPatterns 含某 pattern key 時列出其本地化名稱', () => {
    const wrapper = mount(AssessmentSummaryView, {
      props: { session: session({ painfulPatterns: [firstSingle.patternKey] }), entries },
    });
    const painfulGroup = wrapper.findAll('.assessmentSummaryGroup')[1]!;
    expect(painfulGroup.find('.assessmentSummaryList').exists()).toBe(true);
    expect(painfulGroup.text()).toContain(firstSingle.definition.name['zh-TW']);
  });
});
