// @vitest-environment jsdom
// Breakout 頂條動作參考圖（與評估卡同源）：驗證來源頂層動作圖渲染＋可存取 alt。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import BreakoutOverlayView from './BreakoutOverlayView.vue';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const Noop = defineComponent({ name: 'Noop', template: '<div />' });

const baseProps = {
  flowName: { 'zh-TW': '頸椎屈曲 Breakout', en: 'Cervical Flexion Breakout' },
  patternKey: 'cervicalFlexion' as const,
  patternName: { 'zh-TW': '頸椎屈曲', en: 'Cervical Flexion' },
  stepCount: 0,
  node: undefined,
  resultCards: [],
  findings: [],
  queuedFlowNames: [],
  stepViews: [],
  rewindPreview: () => ({ invalidatedSteps: 0, invalidatedFindings: 0 }),
  classification: undefined,
  classificationOverridden: false,
  freeform: {
    active: false,
    flowOptions: [],
    nodeOptions: [],
    pickedFlowKey: undefined,
    pickedNodeKey: undefined,
    node: undefined,
  },
  manualChoiceCandidates: [],
};

function mountView() {
  return mount(BreakoutOverlayView, {
    props: baseProps,
    global: {
      stubs: {
        BaseButton: Noop,
        BaseIconButton: Noop,
        BaseAlertDialog: Noop,
        BreakoutStepCard: Noop,
        BreakoutStepList: Noop,
        BreakoutCompletionCard: Noop,
        BreakoutFreeformPicker: Noop,
        BreakoutManualChoiceCard: Noop,
        BreakoutResultCard: Noop,
        BreakoutFindingsBar: Noop,
      },
    },
  });
}

describe('BreakoutOverlayView — 來源動作參考圖', () => {
  it('頂條顯示來源頂層動作的參考圖（含可存取 alt）', () => {
    const wrapper = mountView();
    const img = wrapper.find('.breakoutOverlayFigure img');
    expect(img.exists()).toBe(true);
    expect(img.attributes('src')).toBeTruthy();
    expect(img.attributes('alt')).toContain('頸椎屈曲');
    expect(img.attributes('alt')).toContain('assessmentMovementReference');
  });
});
