// @vitest-environment jsdom
import { defineComponent } from 'vue';
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import Accordion from './Accordion.vue';

// UAccordion 替身：渲染各 item 之 label，並以 item.slot 名稱注入對應具名 slot（對等本包裝之富內容轉發）。
const UAccordionStub = defineComponent({
  name: 'UAccordion',
  props: {
    items: {
      type: Array as () => { label: string; value: string; content?: string; slot?: string }[],
      default: () => [],
    },
    type: { type: String, default: 'multiple' },
  },
  template: `<div data-accordion :data-type="type">
              <section v-for="it in items" :key="it.value" :data-value="it.value">
                <h3>{{ it.label }}</h3>
                <div class="content"><slot :name="it.slot ?? it.value">{{ it.content }}</slot></div>
              </section>
            </div>`,
});

const ITEMS = [
  { value: 'cervical', trigger: '頸椎', content: '頸椎評估內容' },
  { value: 'lumbar', trigger: '腰椎', content: '腰椎評估內容' },
];

const mountOpts = { global: { stubs: { UAccordion: UAccordionStub } } };

describe('Accordion（03 §3.7.4，包裝 UAccordion）', () => {
  it('items 之 trigger 映射為 label，content 渲於對應區段', () => {
    const wrapper = mount(Accordion, { props: { items: ITEMS }, ...mountOpts });
    expect(wrapper.text()).toContain('頸椎');
    expect(wrapper.text()).toContain('腰椎');
    const sections = wrapper.findAll('section');
    expect(sections).toHaveLength(2);
    expect(sections[0]!.get('.content').text()).toBe('頸椎評估內容');
  });

  it('預設 type=multiple，可指定 single', () => {
    const wrapper = mount(Accordion, { props: { items: ITEMS }, ...mountOpts });
    expect(wrapper.get('[data-accordion]').attributes('data-type')).toBe('multiple');
    const single = mount(Accordion, { props: { items: ITEMS, type: 'single' }, ...mountOpts });
    expect(single.get('[data-accordion]').attributes('data-type')).toBe('single');
  });

  it('具名 slot 覆寫 content（富內容轉發）', () => {
    const wrapper = mount(Accordion, {
      props: { items: ITEMS },
      slots: { cervical: '<strong>自訂頸椎</strong>' },
      ...mountOpts,
    });
    expect(wrapper.html()).toContain('<strong>自訂頸椎</strong>');
  });
});
