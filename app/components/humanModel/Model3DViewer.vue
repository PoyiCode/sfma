<script setup lang="ts">
// 3D 檢視器組裝（04 §4.2／§4.6.4）：分層開關＋一鍵重置工具列＋
// Babylon glTF 3D 檢視＋選取資訊卡＋已隱藏清單。純展示受控，狀態由容器管理。
// 視角／標籤以 3D 控制列快捷；反向高亮（§4.5）以 highlights→mesh overlay 著色（選取優先）。
import { computed, ref } from 'vue';
import type { AnatomyEntity } from '@ptapp/shared';
import BaseButton from '../base/Button.vue';
import type {
  AnatomyLayerKey,
  LayerVisibility,
} from '../../utils/humanModel/anatomy/anatomyLayers';
import type { AnnotationHighlights } from '../../utils/humanModel/anatomy/anatomyHighlight';
import type { AnatomySide } from '../../utils/humanModel/anatomy/partKey';
import LayerControls from './LayerControls.vue';
import AnatomyInfoCard from './AnatomyInfoCard.vue';
import HiddenPartsControls from './HiddenPartsControls.vue';
import Model3DView from './Model3DView.vue';
import Model3DControls from './Model3DControls.vue';
import type { LabelMode } from '../../utils/humanModel/render/sceneLabels';
import type { ScenePopulator } from '../../utils/humanModel/render/scenePopulator';
import {
  anatomyScenePopulatorFor,
  resolveModelAssetUrl,
} from '../../utils/humanModel/render/modelAsset';
import type { LodTier, LodOverride } from '../../utils/humanModel/lod/lodTier';
import { DEFAULT_CAMERA_VIEW, type CameraViewKey } from '../../utils/humanModel/render/sceneCamera';
import type { CameraRegionKey } from '../../utils/humanModel/render/sceneCameraFraming';
import type { ViewerLayoutMode } from '../../utils/humanModel/render/viewerLayoutMode';
import MotionControls from './MotionControls.vue';
import type { MotionPose } from '../../utils/humanModel/motion/motionPose';

interface Props {
  // 分層
  visibility: LayerVisibility;
  canResetLayers?: boolean;
  // 檢視與選取
  selected: AnatomyEntity | null;
  // 選取 partKey（側別限定）：供高亮比對；缺＝退 selected.anatomyId（過渡）。selectedSide 供資訊卡顯左/右。
  selectedKey?: string | null;
  selectedSide?: AnatomySide | null;
  canAnnotate?: boolean;
  // 反向高亮（§4.5）：anatomyId → findingType，透傳 Model3DView 以 overlay 著色標註部位。
  highlights?: AnnotationHighlights;
  // 單一部位隱藏（§4.1）：hiddenIds 供 Model3DView 過濾與清單渲染。
  // canHide＝隱藏目前選取部位；canRestore＝清單可還原。
  hiddenIds?: readonly string[];
  canHide?: boolean;
  canRestore?: boolean;
  // 渲染分級（§4.3.6）：擇載入之 glb（simplified／full）；預設 simplified。populateScene 未注入時據此解析。
  tier?: LodTier;
  // 場景填充（§4.6.4）：未注入＝依 tier 解析；可注入覆蓋。
  populateScene?: ScenePopulator;
  // 預設視角（§4.3.2）：view＝目前視角；canChangeView 提供＝顯視角控制列。
  view?: CameraViewKey;
  canChangeView?: boolean;
  // 部位視角（需求 3）：region＝目前部位；canChangeRegion 提供＝控制列顯部位分段。
  region?: CameraRegionKey;
  canChangeRegion?: boolean;
  // 標籤系統（§4.4）：showLabels 控標籤顯隱；canShowLabels 提供＝控制列顯標籤開關。
  showLabels?: boolean;
  canShowLabels?: boolean;
  labelMode?: LabelMode;
  canChangeLabelMode?: boolean;
  // LOD 模型細節（§3.5）：lodMode＝設定單一真相；canChangeLod 提供＝控制列顯 LOD 分段。
  lodMode?: LodOverride;
  canChangeLod?: boolean;
  // 視角強制重套 nonce（§4.3.2）：遞增即重套相機。
  viewNonce?: number;
  // 版面模式（03 §3.1／§3.5）：standard／modelPriority／sidePanel。
  layoutMode?: ViewerLayoutMode;
  // 一鍵重置檢視（03 §3.6）：canResetView 提供＝顯「重置檢視」鈕。
  canResetView?: boolean;
  // 運動模式（§4.3.3）：canToggleMotion＝控制列顯開關；motionMode/pose/motionJoint/motionSide 為當前狀態。
  motionMode?: boolean;
  canToggleMotion?: boolean;
  pose?: MotionPose;
  motionJoint?: string;
  // 選取側別（左右獨立，§4.3.3）：雙側 '#L'/'#R'、單側 null。透傳至 Model3DView（手柄側）與 MotionControls（滑桿側）。
  motionSide?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  canResetLayers: false,
  selectedKey: null,
  selectedSide: null,
  canAnnotate: false,
  highlights: undefined,
  hiddenIds: () => [],
  canHide: false,
  canRestore: false,
  tier: 'simplified',
  populateScene: undefined,
  view: undefined,
  canChangeView: false,
  region: undefined,
  canChangeRegion: false,
  showLabels: undefined,
  canShowLabels: false,
  labelMode: undefined,
  canChangeLabelMode: false,
  lodMode: undefined,
  canChangeLod: false,
  viewNonce: undefined,
  layoutMode: 'standard',
  canResetView: false,
  motionMode: false,
  canToggleMotion: false,
  pose: undefined,
  motionJoint: 'joint.knee',
  motionSide: '#R',
});

const emit = defineEmits<{
  setVisible: [layer: AnatomyLayerKey, visible: boolean];
  resetLayers: [];
  selectPart: [partKey: string];
  annotate: [];
  // 點空白關閉（§3.3.8）：3D pick 未命中部位時上拋（供清選取收卡）。
  backgroundClick: [];
  hide: [];
  restorePart: [anatomyId: string];
  restoreAll: [];
  viewChange: [view: CameraViewKey];
  regionChange: [region: CameraRegionKey];
  showLabelsChange: [showLabels: boolean];
  labelModeChange: [mode: LabelMode];
  lodModeChange: [mode: LodOverride];
  resetView: [];
  fps: [fps: number];
  motionModeChange: [on: boolean];
  setJointAngle: [jointId: string, side: string | null, axis: string, deg: number];
  resetPose: [];
  motionJointChange: [jointId: string];
  // 點 3D 肢體選關節＋側別（左右獨立，§4.3.3）；面板左/右切換則發 motionSideChange。
  selectMotionJoint: [jointId: string, side: string | null];
  motionSideChange: [side: string | null];
}>();

const { t } = useI18n();

// 未注入 populateScene 時依 tier 解析填充器（每-url memo→穩定參考，免 Model3DView 重建場景）。
const scenePopulator = computed<ScenePopulator>(
  () => props.populateScene ?? anatomyScenePopulatorFor(resolveModelAssetUrl(props.tier)),
);

// 3D 模型載入態（§4.6.4）：3D 掛載即載入中（多 MB GLB 下載期），Model3DView 填充 settle 後清。
const isModelLoading = ref(true);

// 高亮比對 id：選取 partKey 優先、退 selected.anatomyId（過渡）。
const viewSelectedId = computed(() => props.selectedKey ?? props.selected?.anatomyId ?? null);
</script>

<template>
  <div class="model3dViewer" :data-layout="layoutMode">
    <div class="model3dToolbar">
      <LayerControls
        :visibility="visibility"
        :can-reset="canResetLayers"
        :default-collapsed="layoutMode === 'modelPriority'"
        @set-visible="(layer, visible) => emit('setVisible', layer, visible)"
        @reset="emit('resetLayers')"
      />
      <Model3DControls
        v-if="canChangeView"
        :view="view ?? DEFAULT_CAMERA_VIEW"
        :region="region"
        :can-change-region="canChangeRegion"
        :show-labels="showLabels"
        :can-show-labels="canShowLabels"
        :label-mode="labelMode"
        :can-change-label-mode="canChangeLabelMode"
        :lod-mode="lodMode"
        :can-change-lod="canChangeLod"
        :motion-mode="motionMode"
        :can-toggle-motion="canToggleMotion"
        @view-change="emit('viewChange', $event)"
        @region-change="emit('regionChange', $event)"
        @show-labels-change="emit('showLabelsChange', $event)"
        @label-mode-change="emit('labelModeChange', $event)"
        @lod-mode-change="emit('lodModeChange', $event)"
        @motion-mode-change="emit('motionModeChange', $event)"
      />
      <BaseButton v-if="canResetView" variant="secondary" @click="emit('resetView')">
        {{ t('modelResetView') }}
      </BaseButton>
    </div>
    <div class="model3dMain">
      <div class="model3dCanvasArea">
        <ClientOnly>
          <Model3DView
            :visibility="visibility"
            :hidden-ids="hiddenIds"
            :selected-id="viewSelectedId"
            :highlights="highlights"
            :show-labels="showLabels"
            :label-mode="labelMode"
            :view="view"
            :region="region"
            :view-nonce="viewNonce"
            :populate-scene="scenePopulator"
            :motion-mode="motionMode"
            :pose="pose"
            :motion-joint="motionJoint"
            :motion-side="motionSide"
            @select="emit('selectPart', $event)"
            @background-click="emit('backgroundClick')"
            @fps="emit('fps', $event)"
            @loading-change="isModelLoading = $event"
            @set-joint-angle="(j, s, a, d) => emit('setJointAngle', j, s, a, d)"
            @select-motion-joint="(j, s) => emit('selectMotionJoint', j, s)"
          />
        </ClientOnly>
        <p v-if="isModelLoading" class="model3dLoading" role="status">
          {{ t('modelLoading3d') }}
        </p>
      </div>
      <!-- 資訊卡預留位（恆佔位）：避免選取/取消選取時主區總高變動、畫面跳動。 -->
      <div class="model3dCardSlot">
        <MotionControls
          v-if="motionMode"
          :pose="pose ?? {}"
          :selected-joint="motionJoint"
          :selected-side="motionSide"
          @set-joint-angle="(j, s, a, d) => emit('setJointAngle', j, s, a, d)"
          @reset-pose="emit('resetPose')"
          @update:selected-joint="emit('motionJointChange', $event)"
          @update:selected-side="emit('motionSideChange', $event)"
        />
        <AnatomyInfoCard
          v-else-if="selected"
          :entity="selected"
          :side="selectedSide ?? null"
          :can-annotate="canAnnotate"
          :can-hide="canHide"
          @annotate="emit('annotate')"
          @hide="emit('hide')"
        />
      </div>
      <HiddenPartsControls
        v-if="canRestore"
        :hidden-ids="hiddenIds"
        @restore="emit('restorePart', $event)"
        @restore-all="emit('restoreAll')"
      />
    </div>
  </div>
</template>

<style scoped>
/* 3D 檢視器組裝佈局（mirror Model2DViewer）：工具列＋主檢視，沿用三佈局模式（03 §3.1／§3.5）。 */
.model3dViewer {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.model3dToolbar {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.model3dMain {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  min-width: 0;
}

/* canvas 區（§4.6.4）：定位脈絡，使載入疊層可覆於 canvas 上。 */
.model3dCanvasArea {
  position: relative;
}

/* 部位資訊卡預留位（§4.1）：恆佔位、min-height 預留典型卡片高度→選取/取消選取時主區總高穩定。 */
.model3dCardSlot {
  min-height: 25rem;
}

/* 直式（standard）版面 3D 畫布加高（§4.3.2）。:deep() 穿透至子元件 Model3DView 之 canvas。 */
.model3dViewer[data-layout='standard'] :deep(.model3dView) {
  min-height: 480px;
}

/* 3D 模型載入疊層（多 MB GLB 下載期回饋）：覆於 canvas 上、不擋互動。 */
.model3dLoading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  padding: var(--space-3);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  pointer-events: none;
}

/* 手機橫式（Compact＋landscape）：模型優先、控制項收為浮動工具列（03 §3.1）。 */
.model3dViewer[data-layout='modelPriority'] {
  position: relative;
}

.model3dViewer[data-layout='modelPriority'] .model3dToolbar {
  position: absolute;
  inset-block-start: var(--space-2);
  inset-inline-end: var(--space-2);
  z-index: 1;
  flex-direction: row;
  flex-wrap: wrap;
  gap: var(--space-2);
  max-width: min(60%, 360px);
  padding: var(--space-2);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-1);
}

/* Expanded：控制項收為側欄、模型佔主區（03 §3.5）。 */
.model3dViewer[data-layout='sidePanel'] {
  flex-direction: row;
  align-items: flex-start;
}

.model3dViewer[data-layout='sidePanel'] .model3dToolbar {
  flex: 0 0 clamp(220px, 22%, 320px);
}

.model3dViewer[data-layout='sidePanel'] .model3dMain {
  flex: 1 1 auto;
}
</style>
