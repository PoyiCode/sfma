// @vitest-environment jsdom
// 患者檢視（Feature B §B）整合：patientView 切換工具列顯隱＋切換鈕行為。
// Model3DView 需 Babylon WebGL canvas，以最小 stub 取代；ClientOnly 以 default slot 直透。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { mount } from '@vue/test-utils';
import Model3DViewer from './Model3DViewer.vue';
import { DEFAULT_LAYER_VISIBILITY } from '../../utils/humanModel/anatomy/anatomyLayers';

beforeEach(() => {
  vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));
  // app.baseURL 取自 Nuxt auto-import；單元測試以根站台 '/' stub（子路徑前綴邏輯見 resolveModelAssetUrl）。
  vi.stubGlobal('useRuntimeConfig', () => ({ app: { baseURL: '/' } }));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// ClientOnly：直接渲染 default slot（在 jsdom 中相當於 SSR=false 行為）。
const ClientOnlyStub = defineComponent({
  name: 'ClientOnly',
  setup(_, { slots }) {
    return () => slots.default?.();
  },
});

// 重量子元件替身（僅驗 Model3DViewer 自身 chrome）。
const NoopStub = defineComponent({ template: '<div />' });

const mountOpts = {
  global: {
    stubs: {
      ClientOnly: ClientOnlyStub,
      Model3DView: NoopStub,
      LayerControls: NoopStub,
      Model3DControls: NoopStub,
      BaseButton: NoopStub,
      AnatomyInfoCard: NoopStub,
      HiddenPartsControls: NoopStub,
      MotionControls: NoopStub,
    },
  },
};

const baseProps = {
  visibility: { ...DEFAULT_LAYER_VISIBILITY },
  selected: null,
  canResetView: true,
  canChangeView: true,
  canRestore: true,
};

describe('Model3DViewer — 患者檢視（§B）', () => {
  it('患者檢視切換鈕恆顯（patientView=false）', () => {
    const wrapper = mount(Model3DViewer, { props: { ...baseProps }, ...mountOpts });
    expect(wrapper.find('[data-testid="patient-view-toggle"]').exists()).toBe(true);
  });

  it('患者檢視切換鈕恆顯（patientView=true）', () => {
    const wrapper = mount(Model3DViewer, {
      props: { ...baseProps, patientView: true },
      ...mountOpts,
    });
    expect(wrapper.find('[data-testid="patient-view-toggle"]').exists()).toBe(true);
  });

  it('patientView=false 時 .model3dToolbar 存在', () => {
    const wrapper = mount(Model3DViewer, { props: { ...baseProps }, ...mountOpts });
    expect(wrapper.find('.model3dToolbar').exists()).toBe(true);
  });

  it('patientView=true 時 .model3dToolbar 不存在', () => {
    const wrapper = mount(Model3DViewer, {
      props: { ...baseProps, patientView: true },
      ...mountOpts,
    });
    expect(wrapper.find('.model3dToolbar').exists()).toBe(false);
  });

  it('點按切換鈕發 patientViewChange(true)（目前 false）', async () => {
    const wrapper = mount(Model3DViewer, { props: { ...baseProps }, ...mountOpts });
    await wrapper.get('[data-testid="patient-view-toggle"]').trigger('click');
    expect(wrapper.emitted('patientViewChange')?.at(-1)).toEqual([true]);
  });

  it('點按切換鈕發 patientViewChange(false)（目前 true）', async () => {
    const wrapper = mount(Model3DViewer, {
      props: { ...baseProps, patientView: true },
      ...mountOpts,
    });
    await wrapper.get('[data-testid="patient-view-toggle"]').trigger('click');
    expect(wrapper.emitted('patientViewChange')?.at(-1)).toEqual([false]);
  });
});
