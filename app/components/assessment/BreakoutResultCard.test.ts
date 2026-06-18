// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import BreakoutResultCard from './BreakoutResultCard.vue';
import type { BreakoutResultCardModel } from '../../utils/assessment/breakoutPresentation';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function mountCard(model: BreakoutResultCardModel) {
  return mount(BreakoutResultCard, { props: { model } });
}

describe('BreakoutResultCard（03 §3.3.9 端點結果卡）', () => {
  it('finding（非 PAIN）：橙色調＋findingType 徽章＋本地化內容', () => {
    const wrapper = mountCard({
      kind: 'finding',
      findingType: 'JMD',
      label: { 'zh-TW': '關節活動受限', en: 'Mobility limited' },
    });
    expect(wrapper.get('.breakoutResultCard').attributes('data-tone')).toBe('finding');
    expect(wrapper.find('.breakoutResultCardBadge').text()).toBe('JMD');
    expect(wrapper.text()).toContain('關節活動受限');
    // 非 PAIN 無 ⚠ 圖示
    expect(wrapper.find('.breakoutResultCardIcon').exists()).toBe(false);
  });

  it('PAIN：紅色調＋⚠ 圖示（不僅靠顏色，§3.6）', () => {
    const wrapper = mountCard({
      kind: 'finding',
      findingType: 'PAIN',
      label: { 'zh-TW': '疼痛', en: 'Pain' },
    });
    expect(wrapper.get('.breakoutResultCard').attributes('data-tone')).toBe('pain');
    expect(wrapper.find('.breakoutResultCardIcon').exists()).toBe(true);
    expect(wrapper.find('.breakoutResultCardBadge').exists()).toBe(false);
  });

  it('goToFlow：accent 色調＋流程名', () => {
    const wrapper = mountCard({ kind: 'goToFlow', flowName: { 'zh-TW': '頸椎流程', en: 'Cervical' } });
    expect(wrapper.get('.breakoutResultCard').attributes('data-tone')).toBe('goToFlow');
    expect(wrapper.text()).toContain('頸椎流程');
  });

  it('next／instruction：neutral 色調', () => {
    const next = mountCard({ kind: 'next', nextName: { 'zh-TW': '下一步', en: 'Next' } });
    expect(next.get('.breakoutResultCard').attributes('data-tone')).toBe('neutral');
    expect(next.text()).toContain('下一步');
    const inst = mountCard({ kind: 'instruction', label: { 'zh-TW': '停止', en: 'Stop' } });
    expect(inst.get('.breakoutResultCard').attributes('data-tone')).toBe('neutral');
    expect(inst.text()).toContain('停止');
  });
});
