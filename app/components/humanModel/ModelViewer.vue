<script setup lang="ts">
// 人體模型檢視器 View（純展示受控；04 §4.1、§4.6）。
// 佔位 viewport 以部位清單呈現可見分層之部位，待 3D／2D 資產到位再換成實體渲染。
import { computed } from 'vue';
import type { AnatomyEntity } from '@ptapp/shared';
import LayerControls from './LayerControls.vue';
import AnatomyInfoCard from './AnatomyInfoCard.vue';
import { layerOfEntity, type AnatomyLayerKey, type LayerVisibility } from '../../utils/humanModel/anatomy/anatomyLayers';
import { anatomyDisplayName } from '../../utils/humanModel/anatomy/anatomyInfo';

interface Props {
  visibility: LayerVisibility;
  // 休眠慣例（對應 ptApp onResetLayers）：true 才顯分層「還原預設」鈕。
  canResetLayers?: boolean;
  parts: readonly AnatomyEntity[];
  selected: AnatomyEntity | null;
  // 休眠慣例（對應 ptApp onAnnotate）：部位資訊卡顯「加入評估標註」鈕。
  canAnnotate?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  canResetLayers: false,
  canAnnotate: false,
});

const emit = defineEmits<{
  setVisible: [layer: AnatomyLayerKey, visible: boolean];
  resetLayers: [];
  selectPart: [anatomyId: string];
  annotate: [];
}>();

const { t } = useI18n();

// 僅列出落在「目前顯示分層」的部位；joint（layerOfEntity 回 null）不列。
const visibleParts = computed(() =>
  props.parts.filter((part) => {
    const layer = layerOfEntity(part);
    return layer !== null && props.visibility[layer];
  }),
);
</script>

<template>
  <div class="modelViewer">
    <LayerControls
      :visibility="visibility"
      :can-reset="canResetLayers"
      @set-visible="(layer, visible) => emit('setVisible', layer, visible)"
      @reset="emit('resetLayers')"
    />
    <div class="modelViewport">
      <p class="modelViewportHint">{{ t('modelViewportHint') }}</p>
      <ul class="modelPartList">
        <li v-for="part in visibleParts" :key="part.anatomyId">
          <button
            type="button"
            class="modelPart"
            :aria-pressed="selected?.anatomyId === part.anatomyId"
            @click="emit('selectPart', part.anatomyId)"
          >
            {{ anatomyDisplayName(part.anatomyId) }}
          </button>
        </li>
      </ul>
    </div>
    <AnatomyInfoCard
      v-if="selected"
      :entity="selected"
      :can-annotate="canAnnotate"
      @annotate="emit('annotate')"
    />
  </div>
</template>

<style scoped>
.modelViewer {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.modelViewport {
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg);
  padding: var(--space-4);
}

.modelViewportHint {
  margin: 0 0 var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.modelPartList {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.modelPart {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background: var(--color-surface);
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

.modelPart[aria-pressed='true'] {
  border-color: var(--color-accent-fg);
  color: var(--color-accent-fg);
}
</style>
