<script setup lang="ts">
// 人體模型分層開關（2D／3D 共用，主要操作；04 §4.1）。純展示受控；狀態由 useLayerVisibility 管理。
// 可收合分層面板（03 §3.5）：legend 內 disclosure 按鈕（WAI-ARIA Disclosure 模式），收合時隱藏 body。
import { ref, useId } from 'vue';
import UiButton from '../ui/Button.vue';
import UiCheckbox from '../ui/Checkbox.vue';
import {
  ANATOMY_LAYER_KEYS,
  type AnatomyLayerKey,
  type LayerVisibility,
} from '../../utils/humanModel/anatomy/anatomyLayers';

// 四層名沿用設定頁既有 i18n 鍵（同為分層名，DRY）。
const LAYER_LABEL_KEYS: Record<AnatomyLayerKey, string> = {
  bone: 'settingsLayerBone',
  deepMuscle: 'settingsLayerDeepMuscle',
  superficialMuscle: 'settingsLayerSuperficialMuscle',
  nerve: 'settingsLayerNerve',
  passiveStructure: 'settingsLayerPassiveStructure',
};

interface Props {
  visibility: LayerVisibility;
  // 休眠慣例（對應 ptApp onReset）：true 才顯「還原預設」鈕、發 reset 事件。
  canReset?: boolean;
  // 起始收合（uncontrolled 起始值，沿用 React defaultX 慣例）；手機橫式浮動工具列預設收合（03 §3.5）。
  defaultCollapsed?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  canReset: false,
  defaultCollapsed: false,
});

const emit = defineEmits<{
  setVisible: [layer: AnatomyLayerKey, visible: boolean];
  reset: [];
}>();

const { t } = useI18n();

const collapsed = ref(props.defaultCollapsed);
const bodyId = useId();

const layerKeys = ANATOMY_LAYER_KEYS;
</script>

<template>
  <fieldset class="layerControls">
    <legend class="layerControlsTitle">
      <button
        type="button"
        class="layerControlsToggle"
        :aria-expanded="!collapsed"
        :aria-controls="bodyId"
        @click="collapsed = !collapsed"
      >
        {{ t('modelLayersTitle') }}
        <span class="layerControlsToggleIcon" aria-hidden="true">
          {{ collapsed ? '▸' : '▾' }}
        </span>
      </button>
    </legend>
    <div :id="bodyId" class="layerControlsBody" :hidden="collapsed">
      <UiCheckbox
        v-for="key in layerKeys"
        :key="key"
        :label="t(LAYER_LABEL_KEYS[key])"
        :model-value="visibility[key]"
        @update:model-value="emit('setVisible', key, $event === true)"
      />
      <UiButton v-if="canReset" variant="secondary" @click="emit('reset')">
        {{ t('modelLayersReset') }}
      </UiButton>
    </div>
  </fieldset>
</template>

<style scoped>
.layerControls {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
  margin: 0;
}

.layerControlsTitle {
  padding: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* 可收合分層面板（03 §3.5）：標題即 disclosure 按鈕，撐滿寬、chevron 靠右。 */
.layerControlsToggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  padding: 0;
  background: none;
  border: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-align: start;
}

.layerControlsToggleIcon {
  font-size: var(--font-size-sm);
}

.layerControlsBody {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* 收合時隱藏 body：須以屬性選擇器覆寫上方 display:flex（否則 [hidden] 不生效）。 */
.layerControlsBody[hidden] {
  display: none;
}
</style>
