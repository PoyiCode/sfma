<script setup lang="ts">
// 3D 檢視器控制列（04 §4.3.2／§4.4／§3.5）：前/後/左/右預設視角切換＋部位視角＋標籤開關＋LOD。
// 純展示受控，狀態由容器管理。各分段以對應 can* 旗標休眠（對應 ptApp onXChange 是否提供）。
import { computed } from 'vue';
import UiSegmentedControl, { type SegmentedOption } from '../ui/SegmentedControl.vue';
import UiSwitch from '../ui/Switch.vue';
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
});

const emit = defineEmits<{
  viewChange: [view: CameraViewKey];
  regionChange: [region: CameraRegionKey];
  showLabelsChange: [showLabels: boolean];
  labelModeChange: [mode: LabelMode];
  lodModeChange: [mode: LodOverride];
}>();

const { t } = useI18n();

const labelsOn = computed(() => props.showLabels ?? true);

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
    <UiSegmentedControl
      v-bind="{ ariaLabel: t('model3dViewLabel') }"
      :model-value="String(view)"
      :options="viewOptions"
      @update:model-value="onView"
    />
    <UiSegmentedControl
      v-if="canChangeRegion"
      v-bind="{ ariaLabel: t('model3dRegionLabel') }"
      :model-value="String(region)"
      :options="regionOptions"
      @update:model-value="onRegion"
    />
    <UiSwitch
      v-if="canShowLabels"
      :label="t('modelShowLabels')"
      :model-value="labelsOn"
      @update:model-value="emit('showLabelsChange', $event === true)"
    />
    <UiSegmentedControl
      v-if="canChangeLabelMode && labelsOn"
      v-bind="{ ariaLabel: t('modelLabelModeLabel') }"
      :model-value="String(labelMode)"
      :options="labelModeOptions"
      @update:model-value="onLabelMode"
    />
    <UiSegmentedControl
      v-if="canChangeLod"
      v-bind="{ ariaLabel: t('settingsLod') }"
      :model-value="String(lodMode)"
      :options="lodOptions"
      @update:model-value="onLod"
    />
  </div>
</template>

<style scoped>
/* 3D 視角控制列（mirror Model2DControls）：縱向排列控制群。 */
.model3dControls {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
</style>
