// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import { sfmaPatterns } from '@ptapp/definitions';
import type { BodyAnnotation } from '@ptapp/shared';
import BodyAnnotationList from './BodyAnnotationList.vue';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const NuxtLinkStub = defineComponent({
  name: 'NuxtLink',
  props: { to: { type: String, default: '' } },
  template: '<a :href="to"><slot /></a>',
});
const mountOpts = { global: { stubs: { NuxtLink: NuxtLinkStub } } };

const firstPatternKey = sfmaPatterns[0]!.patternKey;

function annotation(overrides: Partial<BodyAnnotation> = {}): BodyAnnotation {
  return {
    annotationId: 'a1',
    anatomyId: 'bone.humerus',
    side: 'left',
    findingType: 'painful',
    linkedPatternKey: firstPatternKey,
    note: '',
    ...overrides,
  };
}

describe('BodyAnnotationList（標註管理列表；04 §4.5）', () => {
  it('空清單顯空態提示', () => {
    const wrapper = mount(BodyAnnotationList, {
      props: { annotations: [], patterns: sfmaPatterns },
      ...mountOpts,
    });
    expect(wrapper.find('.bodyAnnotationListEmpty').exists()).toBe(true);
  });

  it('逐筆顯部位名（含側別）、findingType、關聯動作名', () => {
    const wrapper = mount(BodyAnnotationList, {
      props: { annotations: [annotation()], patterns: sfmaPatterns },
      ...mountOpts,
    });
    const row = wrapper.get('.bodyAnnotationListRow');
    expect(row.text()).toContain('肱骨');
    expect(row.text()).toContain('assessmentSideLeft');
    expect(row.text()).toContain('assessmentPainful');
  });

  it('canSelect 時點主鈕發 select 帶 partKey；selectedAnatomyId 標記 aria-current', async () => {
    const wrapper = mount(BodyAnnotationList, {
      props: {
        annotations: [annotation()],
        patterns: sfmaPatterns,
        canSelect: true,
        selectedAnatomyId: 'bone.humerus@left',
      },
      ...mountOpts,
    });
    const main = wrapper.get('.bodyAnnotationListRowMain');
    expect(main.attributes('aria-current')).toBe('true');
    await main.trigger('click');
    expect(wrapper.emitted('select')?.at(-1)).toEqual(['bone.humerus@left']);
  });

  it('canSelect=false 時主鈕 disabled', () => {
    const wrapper = mount(BodyAnnotationList, {
      props: { annotations: [annotation()], patterns: sfmaPatterns },
      ...mountOpts,
    });
    expect(wrapper.get('.bodyAnnotationListRowMain').attributes('disabled')).toBeDefined();
  });

  it('canRemove 時顯移除鈕、點按發 remove 帶 annotationId', async () => {
    const wrapper = mount(BodyAnnotationList, {
      props: { annotations: [annotation()], patterns: sfmaPatterns, canRemove: true },
      ...mountOpts,
    });
    const removeBtn = wrapper
      .findAll('button')
      .find((b) => b.attributes('aria-label') === 'bodyAnnotationRemove')!;
    await removeBtn.trigger('click');
    expect(wrapper.emitted('remove')?.at(-1)).toEqual(['a1']);
  });

  it('buildFindingHref 提供時渲「回到評估發現」深連結', () => {
    const wrapper = mount(BodyAnnotationList, {
      props: {
        annotations: [annotation()],
        patterns: sfmaPatterns,
        buildFindingHref: (key: string) => `/finding/${key}`,
      },
      ...mountOpts,
    });
    const link = wrapper.get('a');
    expect(link.attributes('href')).toBe(`/finding/${firstPatternKey}`);
    expect(link.text()).toBe('backToFinding');
  });
});
