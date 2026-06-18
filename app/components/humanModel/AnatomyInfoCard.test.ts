// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { anatomyEntityById } from '@ptapp/definitions';
import AnatomyInfoCard from './AnatomyInfoCard.vue';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const biceps = anatomyEntityById.get('muscle.bicepsBrachii')!;
const radial = anatomyEntityById.get('nerve.radial')!;

describe('AnatomyInfoCard（部位資訊卡；04 §4.1）', () => {
  it('顯名稱／型別；肌肉顯屬性列', () => {
    const wrapper = mount(AnatomyInfoCard, { props: { entity: biceps } });
    expect(wrapper.get('.anatomyInfoCardName').text()).toContain('肱二頭肌');
    expect(wrapper.get('.anatomyInfoCardType').text()).toBe('anatomyTypeMuscle');
    expect(wrapper.findAll('.anatomyInfoCardRow').length).toBeGreaterThan(0);
  });

  it('神經：無屬性列（dl 不渲染）', () => {
    const wrapper = mount(AnatomyInfoCard, { props: { entity: radial } });
    expect(wrapper.find('.anatomyInfoCardRows').exists()).toBe(false);
  });

  it('成對部位側別後綴併入名稱', () => {
    const wrapper = mount(AnatomyInfoCard, { props: { entity: biceps, side: 'left' } });
    expect(wrapper.get('.anatomyInfoCardName').text()).toContain('assessmentSideLeft');
  });

  it('canAnnotate=false 時不顯標註鈕；true 顯且點按發 annotate', async () => {
    const off = mount(AnatomyInfoCard, { props: { entity: biceps } });
    expect(off.text()).not.toContain('anatomyAnnotate');
    const on = mount(AnatomyInfoCard, { props: { entity: biceps, canAnnotate: true } });
    const btn = on.findAll('button').find((b) => b.text() === 'anatomyAnnotate')!;
    await btn.trigger('click');
    expect(on.emitted('annotate')).toHaveLength(1);
  });

  it('canHide=true 顯隱藏鈕、點按發 hide', async () => {
    const wrapper = mount(AnatomyInfoCard, { props: { entity: biceps, canHide: true } });
    const btn = wrapper.findAll('button').find((b) => b.text() === 'anatomyHide')!;
    await btn.trigger('click');
    expect(wrapper.emitted('hide')).toHaveLength(1);
  });
});
