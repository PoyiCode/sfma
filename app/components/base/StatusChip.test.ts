// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StatusChip from './StatusChip.vue';

describe('StatusChip（03 §3.7.2 FN／FP／DN／DP 分軸編碼）', () => {
  it('字母恆顯', () => {
    const wrapper = mount(StatusChip, { props: { status: 'DP' } });
    expect(wrapper.get('.statusChipCode').text()).toBe('DP');
  });

  it('功能軸：D 為 dysfunctional、F 為 functional（data-axis）', async () => {
    const wrapper = mount(StatusChip, { props: { status: 'FN' } });
    expect(wrapper.get('[role="img"]').attributes('data-axis')).toBe('functional');
    await wrapper.setProps({ status: 'DN' });
    expect(wrapper.get('[role="img"]').attributes('data-axis')).toBe('dysfunctional');
  });

  it('疼痛軸：P 顯示疼痛 glyph、N 不顯示', async () => {
    const wrapper = mount(StatusChip, { props: { status: 'FP' } });
    expect(wrapper.find('.statusChipPain').exists()).toBe(true);
    await wrapper.setProps({ status: 'FN' });
    expect(wrapper.find('.statusChipPain').exists()).toBe(false);
  });

  it('aria-label 為完整語意（不僅依顏色）、字母對螢幕報讀隱藏', () => {
    const wrapper = mount(StatusChip, { props: { status: 'DP' } });
    const chip = wrapper.get('[role="img"]');
    expect(chip.attributes('aria-label')).toBe('功能異常、且疼痛');
    expect(wrapper.get('.statusChipCode').attributes('aria-hidden')).toBe('true');
  });

  it('四型 data-status 正確', () => {
    for (const status of ['FN', 'FP', 'DN', 'DP'] as const) {
      const wrapper = mount(StatusChip, { props: { status } });
      expect(wrapper.get('[role="img"]').attributes('data-status')).toBe(status);
    }
  });
});
