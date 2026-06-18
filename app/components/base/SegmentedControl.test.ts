// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SegmentedControl from './SegmentedControl.vue';

const OPTIONS = [
  { value: 'left', label: '左' },
  { value: 'right', label: '右' },
];

describe('SegmentedControl（03 §3.7.4 enum 偏好控制項）', () => {
  it('radiogroup 角色＋ariaLabel，選中項 aria-checked=true', () => {
    const wrapper = mount(SegmentedControl, {
      props: { options: OPTIONS, ariaLabel: '側別', modelValue: 'left' },
    });
    const group = wrapper.get('[role="radiogroup"]');
    expect(group.attributes('aria-label')).toBe('側別');
    const radios = wrapper.findAll('[role="radio"]');
    expect(radios[0]!.attributes('aria-checked')).toBe('true');
    expect(radios[0]!.attributes('data-state')).toBe('checked');
    expect(radios[1]!.attributes('aria-checked')).toBe('false');
  });

  it('點選未選項更新 v-model', async () => {
    const wrapper = mount(SegmentedControl, {
      props: { options: OPTIONS, ariaLabel: '側別', modelValue: 'left' },
    });
    await wrapper.findAll('[role="radio"]')[1]!.trigger('click');
    expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['right']);
  });
});
