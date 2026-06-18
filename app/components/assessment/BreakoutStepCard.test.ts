// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import type { BreakoutNode } from '@ptapp/shared';
import BreakoutStepCard from './BreakoutStepCard.vue';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const node: BreakoutNode = {
  nodeKey: 'n1',
  name: { 'zh-TW': '頸椎主動屈曲', en: 'Cervical AF' },
  mode: 'active',
  criterion: { 'zh-TW': '下巴觸胸', en: 'Chin to chest' },
  resultOptions: ['FN', 'DN', 'dysfunctional'],
  branches: [],
};

describe('BreakoutStepCard（03 §3.3.9 步進卡）', () => {
  it('顯測試名·判準·主被動 badge，核心碼依固定順序篩出', () => {
    const wrapper = mount(BreakoutStepCard, { props: { node } });
    expect(wrapper.text()).toContain('頸椎主動屈曲');
    expect(wrapper.text()).toContain('下巴觸胸');
    expect(wrapper.find('.breakoutStepCardMode').attributes('data-mode')).toBe('active');
    const coreButtons = wrapper.findAll('.breakoutStepCardCore button');
    // FN, DN（resultOptions 含；FP/DP 不含被濾掉），順序 FN→DN
    expect(coreButtons.map((b) => b.text())).toEqual(['FN', 'DN']);
  });

  it('特殊碼以本地化標籤鈕呈現，點按上拋原碼', async () => {
    const wrapper = mount(BreakoutStepCard, { props: { node } });
    const special = wrapper.findAll('.breakoutStepCardSpecial button');
    expect(special).toHaveLength(1);
    // i18n key 替身回傳鍵名
    expect(special[0]!.text()).toBe('breakoutResultDysfunctional');
    await special[0]!.trigger('click');
    expect(wrapper.emitted('result')?.at(-1)).toEqual(['dysfunctional']);
  });

  it('核心碼點按上拋該碼', async () => {
    const wrapper = mount(BreakoutStepCard, { props: { node } });
    await wrapper.findAll('.breakoutStepCardCore button')[0]!.trigger('click');
    expect(wrapper.emitted('result')?.at(-1)).toEqual(['FN']);
  });

  it('priorResult 存在時顯「沿用前值」鈕，點按上拋前值（05 §5.3.3 #8）', async () => {
    const wrapper = mount(BreakoutStepCard, { props: { node, priorResult: 'FN' } });
    const priorBtn = wrapper.get('.breakoutStepCardPrior button');
    await priorBtn.trigger('click');
    expect(wrapper.emitted('result')?.at(-1)).toEqual(['FN']);
  });
});
