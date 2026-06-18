import { ref, type Ref } from 'vue';
import { actionLogger } from '../../utils/devtools/actionLogger';
import {
  DEFAULT_LAYER_VISIBILITY,
  type AnatomyLayerKey,
  type LayerVisibility,
} from '../../utils/humanModel/anatomy/anatomyLayers';

export type { LayerVisibility };

export interface UseLayerVisibility {
  visibility: Ref<LayerVisibility>;
  setVisible: (layer: AnatomyLayerKey, visible: boolean) => void;
  toggle: (layer: AnatomyLayerKey) => void;
  reset: () => void;
}

// 人體模型分層顯示狀態（檢視狀態、不寫入資料；04 §4.1）。
// 初值取使用者設定之 defaultLayers（設定 §6.10），未提供則用設計 §4.1 預設。
export function useLayerVisibility(
  initial: LayerVisibility = DEFAULT_LAYER_VISIBILITY,
): UseLayerVisibility {
  const visibility = ref<LayerVisibility>({ ...initial });

  function setVisible(layer: AnatomyLayerKey, visible: boolean): void {
    actionLogger.log('humanModel', 'layerVisibility', `${layer}=${String(visible)}`);
    // 設為同值時不更換參考（避免無謂重繪）。
    if (visibility.value[layer] !== visible) {
      visibility.value = { ...visibility.value, [layer]: visible };
    }
  }

  function toggle(layer: AnatomyLayerKey): void {
    actionLogger.log('humanModel', 'layerToggle', layer);
    visibility.value = { ...visibility.value, [layer]: !visibility.value[layer] };
  }

  function reset(): void {
    visibility.value = { ...initial };
  }

  return { visibility, setVisible, toggle, reset };
}
