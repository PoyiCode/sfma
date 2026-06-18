// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import BreakoutStepList from './BreakoutStepList.vue';
import type { BreakoutStepView } from '../../utils/assessment/breakoutPresentation';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const steps: BreakoutStepView[] = [
  {
    index: 1,
    flowKey: 'cervicalFlexionBreakout',
    nodeKey: 'n1',
    testName: { 'zh-TW': '主動屈曲', en: 'AF' },
    result: 'DN',
    findingTypes: ['JMD'],
    isCurrent: false,
  },
  {
    index: 2,
    flowKey: 'cervicalFlexionBreakout',
    nodeKey: 'n2',
    testName: { 'zh-TW': '被動屈曲', en: 'PF' },
    result: undefined,
    findingTypes: [],
    isCurrent: true,
  },
];

describe('BreakoutStepList（03 §3.3.9 步驟清單）', () => {
  it('序·測試名·結果碼·finding chip；當前步高亮並顯「目前」', () => {
    const wrapper = mount(BreakoutStepList, { props: { steps } });
    const rows = wrapper.findAll('.breakoutStepRow');
    expect(rows).toHaveLength(2);
    expect(rows[0]!.text()).toContain('主動屈曲');
    expect(rows[0]!.text()).toContain('DN');
    expect(rows[0]!.find('.breakoutStepFindingChip').text()).toBe('JMD');
    // 當前待測步
    expect(rows[1]!.attributes('data-current')).toBe('true');
    expect(rows[1]!.attributes('aria-current')).toBe('step');
    expect(rows[1]!.text()).toContain('breakoutStepCurrent');
  });

  it('rewindable 時已答步顯 ✎ 鈕、當前步不顯；上拋 0-based 索引', async () => {
    const wrapper = mount(BreakoutStepList, { props: { steps, rewindable: true } });
    const rewindButtons = wrapper.findAll('.breakoutStepRewind');
    // 僅已答步（index 1）有
    expect(rewindButtons).toHaveLength(1);
    await rewindButtons[0]!.trigger('click');
    expect(wrapper.emitted('rewindStep')?.at(-1)).toEqual([0]);
  });

  it('未提供 rewindable 時不顯 ✎ 鈕', () => {
    const wrapper = mount(BreakoutStepList, { props: { steps } });
    expect(wrapper.findAll('.breakoutStepRewind')).toHaveLength(0);
  });
});
