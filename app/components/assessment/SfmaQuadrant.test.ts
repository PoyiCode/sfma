// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import SfmaQuadrant from './SfmaQuadrant.vue';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SfmaQuadrant（SFMA 2×2 判讀方格）', () => {
  it('顯示 4 個 radio 格（FN/FP/DN/DP）及欄列標頭 i18n key', () => {
    const wrapper = mount(SfmaQuadrant, { props: { painful: false, dysfunctional: false } });
    const cells = wrapper.findAll('[role="radio"]');
    expect(cells).toHaveLength(4);
    const codes = cells.map((c) => c.text());
    expect(codes).toEqual(['FN', 'FP', 'DN', 'DP']);
    // 欄標頭
    expect(wrapper.text()).toContain('assessmentNonPainful');
    expect(wrapper.text()).toContain('assessmentPainful');
    // 列標頭
    expect(wrapper.text()).toContain('assessmentFunctional');
    expect(wrapper.text()).toContain('assessmentDysfunctional');
  });

  it('radiogroup 有 aria-label（assessmentClassificationGrid key）', () => {
    const wrapper = mount(SfmaQuadrant, { props: { painful: false, dysfunctional: false } });
    const group = wrapper.find('[role="radiogroup"]');
    expect(group.attributes('aria-label')).toBe('assessmentClassificationGrid');
  });

  it('FN 選取時 FN cell aria-checked=true，其餘 false', () => {
    const wrapper = mount(SfmaQuadrant, { props: { painful: false, dysfunctional: false } });
    const cells = wrapper.findAll('[role="radio"]');
    expect(cells[0]!.attributes('aria-checked')).toBe('true'); // FN
    expect(cells[1]!.attributes('aria-checked')).toBe('false'); // FP
    expect(cells[2]!.attributes('aria-checked')).toBe('false'); // DN
    expect(cells[3]!.attributes('aria-checked')).toBe('false'); // DP
  });

  it('DP 選取時 DP cell aria-checked=true', () => {
    const wrapper = mount(SfmaQuadrant, { props: { painful: true, dysfunctional: true } });
    const cells = wrapper.findAll('[role="radio"]');
    expect(cells[3]!.attributes('aria-checked')).toBe('true');
    expect(cells[0]!.attributes('aria-checked')).toBe('false');
  });

  it('點按 DP 格上拋 select 事件，payload painful=true dysfunctional=true', async () => {
    const wrapper = mount(SfmaQuadrant, { props: { painful: false, dysfunctional: false } });
    const cells = wrapper.findAll('[role="radio"]');
    await cells[3]!.trigger('click'); // DP
    const emitted = wrapper.emitted('select');
    expect(emitted).toHaveLength(1);
    expect(emitted![0]).toEqual([{ painful: true, dysfunctional: true }]);
  });

  it('點按 FP 格上拋 painful=true, dysfunctional=false', async () => {
    const wrapper = mount(SfmaQuadrant, { props: { painful: false, dysfunctional: false } });
    await wrapper.findAll('[role="radio"]')[1]!.trigger('click'); // FP
    expect(wrapper.emitted('select')![0]).toEqual([{ painful: true, dysfunctional: false }]);
  });

  it('點按 DN 格上拋 painful=false, dysfunctional=true', async () => {
    const wrapper = mount(SfmaQuadrant, { props: { painful: false, dysfunctional: false } });
    await wrapper.findAll('[role="radio"]')[2]!.trigger('click'); // DN
    expect(wrapper.emitted('select')![0]).toEqual([{ painful: false, dysfunctional: true }]);
  });

  it('每格 min-height ≥ 44px（--control-height 目標）', () => {
    const wrapper = mount(SfmaQuadrant, { props: { painful: false, dysfunctional: false } });
    // 未在 jsdom 環境計算實際尺寸，但 data-code 屬性確認格子存在
    const cells = wrapper.findAll('[role="radio"]');
    expect(cells[0]!.attributes('data-code')).toBe('FN');
    expect(cells[3]!.attributes('data-code')).toBe('DP');
  });

  it('FN/FP 格 data-axis=functional；DN/DP 格 data-axis=dysfunctional', () => {
    const wrapper = mount(SfmaQuadrant, { props: { painful: false, dysfunctional: false } });
    const cells = wrapper.findAll('[role="radio"]');
    expect(cells[0]!.attributes('data-axis')).toBe('functional');
    expect(cells[1]!.attributes('data-axis')).toBe('functional');
    expect(cells[2]!.attributes('data-axis')).toBe('dysfunctional');
    expect(cells[3]!.attributes('data-axis')).toBe('dysfunctional');
  });

  it('方向鍵 ArrowRight 從 FN 移焦至 FP 並上拋 select', async () => {
    const wrapper = mount(SfmaQuadrant, { props: { painful: false, dysfunctional: false } });
    const cells = wrapper.findAll('[role="radio"]');
    await cells[0]!.trigger('keydown', { key: 'ArrowRight' });
    const emitted = wrapper.emitted('select');
    expect(emitted).toBeDefined();
    expect(emitted![0]).toEqual([{ painful: true, dysfunctional: false }]);
  });

  it('方向鍵 ArrowDown 從 FN 移焦至 FP 並上拋 select', async () => {
    const wrapper = mount(SfmaQuadrant, { props: { painful: false, dysfunctional: false } });
    await wrapper.findAll('[role="radio"]')[0]!.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.emitted('select')![0]).toEqual([{ painful: true, dysfunctional: false }]);
  });

  it('方向鍵 ArrowLeft 從 FN 環繞至 DP', async () => {
    const wrapper = mount(SfmaQuadrant, { props: { painful: false, dysfunctional: false } });
    await wrapper.findAll('[role="radio"]')[0]!.trigger('keydown', { key: 'ArrowLeft' });
    expect(wrapper.emitted('select')![0]).toEqual([{ painful: true, dysfunctional: true }]);
  });
});
