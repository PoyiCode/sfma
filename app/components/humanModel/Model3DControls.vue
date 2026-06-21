<script setup lang="ts">
// 3D 檢視器控制列（04 §4.3.2／§4.4／§3.5）：前/後/左/右預設視角切換＋部位視角＋標籤開關＋LOD。
// 純展示受控，狀態由容器管理。各分段以對應 can* 旗標休眠（對應 ptApp onXChange 是否提供）。
// 次要控制（region、label-mode、LOD）收於「顯示選項」disclosure，預設收合（§A）。
import { computed, ref, useId } from 'vue';
import BaseSegmentedControl, { type SegmentedOption } from '../base/SegmentedControl.vue';
import BaseSwitch from '../base/Switch.vue';
import { CAMERA_VIEW_KEYS, type CameraViewKey } from '../../utils/humanModel/render/sceneCamera';
import {
  CAMERA_REGION_KEYS,
  type CameraRegionKey,
} from '../../utils/humanModel/render/sceneCameraFraming';
import { LABEL_MODES, type LabelMode } from '../../utils/humanModel/render/sceneLabels';
import { LOD_OVERRIDES, type LodOverride } from '../../utils/humanModel/lod/lodTier';

const VIEW_LABEL_KEYS: Record<CameraViewKey, string> = {
  front: 'model3dViewFront',
  back: 'model3dViewBack',
  left: 'model3dViewLeft',
  right: 'model3dViewRight',
};
const REGION_LABEL_KEYS: Record<CameraRegionKey, string> = {
  whole: 'model3dRegionWhole',
  head: 'model3dRegionHead',
  chestAbdomen: 'model3dRegionChestAbdomen',
  hipLegs: 'model3dRegionHipLegs',
};
const LABEL_MODE_LABEL_KEYS: Record<LabelMode, string> = {
  all: 'modelLabelModeAll',
  selected: 'modelLabelModeSelected',
};
// LOD 覆寫標籤（§3.5；複用設定頁 i18n「模型細節（LOD）」自動／簡化／完整）。
const LOD_OVERRIDE_LABEL_KEYS: Record<LodOverride, string> = {
  auto: 'settingsLodAuto',
  simplified: 'settingsLodSimplified',
  full: 'settingsLodFull',
};

interface Props {
  view: CameraViewKey;
  // 部位視角（需求 3）：canChangeRegion 提供＝顯全身／頭部／胸腹／臀腿分段（休眠慣例）。
  region?: CameraRegionKey;
  canChangeRegion?: boolean;
  // 標籤開關（§4.4）：canShowLabels＝顯開關；showLabels 為當前值。
  showLabels?: boolean;
  canShowLabels?: boolean;
  // 標籤顯示範圍模式（§4.4 僅顯示選取避免雜亂）：canChangeLabelMode 且標籤開時顯全部／僅選取分段。
  labelMode?: LabelMode;
  canChangeLabelMode?: boolean;
  // LOD 模型細節（§3.5 控制項清單）：canChangeLod 提供＝顯自動／簡化／完整分段；值＝設定單一真相 lodMode。
  lodMode?: LodOverride;
  canChangeLod?: boolean;
  // 運動模式（§4.3.3）：canToggleMotion＝顯關節活動開關；motionMode＝當前。
  motionMode?: boolean;
  canToggleMotion?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  region: 'whole',
  canChangeRegion: false,
  showLabels: undefined,
  canShowLabels: false,
  labelMode: 'all',
  canChangeLabelMode: false,
  lodMode: 'auto',
  canChangeLod: false,
  motionMode: false,
  canToggleMotion: false,
});

const emit = defineEmits<{
  viewChange: [view: CameraViewKey];
  regionChange: [region: CameraRegionKey];
  showLabelsChange: [showLabels: boolean];
  labelModeChange: [mode: LabelMode];
  lodModeChange: [mode: LodOverride];
  motionModeChange: [on: boolean];
}>();

const { t } = useI18n();

const labelsOn = computed(() => props.showLabels ?? true);

// 次要控制 disclosure（§A）：預設收合；hasSecondary 為真方顯外框。
const secondaryCollapsed = ref(true);
const secondaryBodyId = useId();
const hasSecondary = computed(
  () =>
    props.canChangeRegion || props.canShowLabels || props.canChangeLabelMode || props.canChangeLod,
);

const viewOptions: SegmentedOption[] = CAMERA_VIEW_KEYS.map((value) => ({
  value,
  label: t(VIEW_LABEL_KEYS[value]),
}));
const regionOptions: SegmentedOption[] = CAMERA_REGION_KEYS.map((value) => ({
  value,
  label: t(REGION_LABEL_KEYS[value]),
}));
const labelModeOptions: SegmentedOption[] = LABEL_MODES.map((value) => ({
  value,
  label: t(LABEL_MODE_LABEL_KEYS[value]),
}));
const lodOptions: SegmentedOption[] = LOD_OVERRIDES.map((value) => ({
  value,
  label: t(LOD_OVERRIDE_LABEL_KEYS[value]),
}));

function onView(value: string): void {
  const next = CAMERA_VIEW_KEYS.find((k) => k === value);
  if (next) emit('viewChange', next);
}
function onRegion(value: string): void {
  const next = CAMERA_REGION_KEYS.find((k) => k === value);
  if (next) emit('regionChange', next);
}
function onLabelMode(value: string): void {
  const next = LABEL_MODES.find((m) => m === value);
  if (next) emit('labelModeChange', next);
}
function onLod(value: string): void {
  const next = LOD_OVERRIDES.find((m) => m === value);
  if (next) emit('lodModeChange', next);
}
</script>

<template>
  <div class="model3dControls">
    <!-- 主要控制：恆顯 -->
    <BaseSwitch
      v-if="canToggleMotion"
      data-testid="motion-toggle"
      :label="t('modelMotionMode')"
      :model-value="motionMode === true"
      @update:model-value="emit('motionModeChange', $event === true)"
    />
    <BaseSegmentedControl
      v-bind="{ ariaLabel: t('model3dViewLabel') }"
      :model-value="String(view)"
      :options="viewOptions"
      @update:model-value="onView"
    />

    <!-- 次要控制 disclosure（§A）：region／label-mode／LOD 收合於「顯示選項」。 -->
    <div v-if="hasSecondary" class="model3dSecondary">
      <button
        type="button"
        class="model3dSecondaryToggle"
        data-testid="secondary-disclosure-toggle"
        :aria-expanded="!secondaryCollapsed"
        :aria-controls="secondaryBodyId"
        @click="secondaryCollapsed = !secondaryCollapsed"
      >
        {{ t('modelDisplayOptions') }}
        <span class="model3dSecondaryToggleIcon" aria-hidden="true">
          {{ secondaryCollapsed ? '▸' : '▾' }}
        </span>
      </button>
      <div :id="secondaryBodyId" class="model3dSecondaryBody" :hidden="secondaryCollapsed">
        <BaseSegmentedControl
          v-if="canChangeRegion"
          v-bind="{ ariaLabel: t('model3dRegionLabel') }"
          :model-value="String(region)"
          :options="regionOptions"
          @update:model-value="onRegion"
        />
        <BaseSwitch
          v-if="canShowLabels"
          :label="t('modelShowLabels')"
          :model-value="labelsOn"
          @update:model-value="emit('showLabelsChange', $event === true)"
        />
        <BaseSegmentedControl
          v-if="canChangeLabelMode && labelsOn"
          v-bind="{ ariaLabel: t('modelLabelModeLabel') }"
          :model-value="String(labelMode)"
          :options="labelModeOptions"
          @update:model-value="onLabelMode"
        />
        <BaseSegmentedControl
          v-if="canChangeLod"
          v-bind="{ ariaLabel: t('settingsLod') }"
          :model-value="String(lodMode)"
          :options="lodOptions"
          @update:model-value="onLod"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 3D 視角控制列（mirror Model2DControls）：縱向排列控制群。 */
.model3dControls {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* 次要控制 disclosure（§A）：與 LayerControls 風格一致。 */
.model3dSecondary {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3);
}

.model3dSecondaryToggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  padding: 0;
  background: none;
  border: 0;
  font: inherit;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  text-align: start;
}

.model3dSecondaryToggleIcon {
  font-size: var(--font-size-sm);
}

.model3dSecondaryBody {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* 收合時隱藏 body：須以屬性選擇器覆寫上方 display:flex（否則 [hidden] 不生效）。 */
.model3dSecondaryBody[hidden] {
  display: none;
}
</style>
