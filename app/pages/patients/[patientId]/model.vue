<script setup lang="ts">
// 人體模型檢視容器（03 §3.5、04 §4.1）：取設定預設分層為初值，
// 連動評估（§4.5）：選填 ?session=<sessionId> 深連結→以 useAssessmentSession 同時供
// 反向高亮（由 session 推導，新增標註即時更新）與正向寫入（upsertAnnotation）。
// finding→模型深連結（§3.3.8）：選填 ?pattern=<patternKey> 作為新標註關聯動作預設。
// marker→finding 反向（§3.3.8）：標註→其關聯動作之評估深連結（buildFindingHref，帶 ?pattern=）。
import { computed, ref, watch } from 'vue';
import { sfmaPatterns } from '@ptapp/definitions';
import {
  createUuid,
  type AppSettings,
  type BodyAnnotation,
  type SfmaPatternKey,
} from '@ptapp/shared';
import { localStore } from '../../../utils/data/localStore';
import { actionLogger } from '../../../utils/devtools/actionLogger';
import {
  findBodyAnnotation,
  newBodyAnnotation,
} from '../../../utils/assessment/bodyAnnotationForm';
import { localizeText } from '../../../utils/i18n/localizeText';
import { useAssessmentSession } from '../../../composables/assessment/useAssessmentSession';
import { useBreakpoint } from '../../../composables/app/useBreakpoint';
import { useOrientation } from '../../../composables/app/useOrientation';
import { useLayerVisibility } from '../../../composables/humanModel/useLayerVisibility';
import { useSelectedPart } from '../../../composables/humanModel/useSelectedPart';
import { useHiddenParts } from '../../../composables/humanModel/useHiddenParts';
import { useRenderTier } from '../../../composables/humanModel/useRenderTier';
import { useFpsAutoDegrade } from '../../../composables/humanModel/useFpsAutoDegrade';
import { useFullLodConfirm } from '../../../composables/humanModel/useFullLodConfirm';
import {
  DEFAULT_LAYER_VISIBILITY,
  type LayerVisibility,
} from '../../../utils/humanModel/anatomy/anatomyLayers';
import {
  annotationHighlights,
  type AnnotationHighlights,
} from '../../../utils/humanModel/anatomy/anatomyHighlight';
import { degradeLodTier, type LodTier } from '../../../utils/humanModel/lod/lodTier';
import { detectDeviceCapability } from '../../../utils/humanModel/lod/deviceCapability';
import { viewerLayoutMode } from '../../../utils/humanModel/render/viewerLayoutMode';
import {
  DEFAULT_CAMERA_VIEW,
  type CameraViewKey,
} from '../../../utils/humanModel/render/sceneCamera';
import {
  DEFAULT_CAMERA_REGION,
  type CameraRegionKey,
} from '../../../utils/humanModel/render/sceneCameraFraming';
import { DEFAULT_LABEL_MODE, type LabelMode } from '../../../utils/humanModel/render/sceneLabels';
import {
  NEUTRAL_POSE,
  resetPose as resetMotionPose,
  setJointAngle,
  type MotionPose,
} from '../../../utils/humanModel/motion/motionPose';
import type { BodyAnnotationDraft } from '../../../components/humanModel/BodyAnnotationForm.vue';
import Model3DViewer from '../../../components/humanModel/Model3DViewer.vue';
import BodyAnnotationDialog from '../../../components/humanModel/BodyAnnotationDialog.vue';
import BodyAnnotationList from '../../../components/humanModel/BodyAnnotationList.vue';
import FullLodConfirmDialog from '../../../components/humanModel/FullLodConfirmDialog.vue';
import PageError from '../../../components/base/PageError.vue';
import PageSkeleton from '../../../components/base/PageSkeleton.vue';
import ErrorBoundary from '../../../components/base/ErrorBoundary.vue';

// AppSettings 之 lodMode 聯集（auto/simplified/full）；@ptapp/shared 未另 export 別名，於此取。
type LodMode = AppSettings['lodMode'];

definePageMeta({ titleKey: 'titleModel' });

const { t } = useI18n();
useHead({ title: () => t('titleModel') });

const route = useRoute();
const patientId = computed(() => String(route.params.patientId ?? ''));
const sessionId = computed<string | null>(() => {
  const raw = route.query.session;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value != null && value !== '' ? String(value) : null;
});

// ── 設定載入（取預設分層為初值；設定頁尚未上線，故於此就地載入單例）──
type SettingsState =
  | { status: 'loading' }
  | { status: 'ready'; settings: AppSettings }
  | { status: 'error' };
const settingsState = ref<SettingsState>({ status: 'loading' });
const settingsReloadKey = ref(0);

watch(
  settingsReloadKey,
  (_key, _prev, onCleanup) => {
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    settingsState.value = { status: 'loading' };
    void (async () => {
      try {
        const settings = await localStore.getSettings();
        if (cancelled) return;
        settingsState.value = settings ? { status: 'ready', settings } : { status: 'error' };
      } catch {
        if (!cancelled) settingsState.value = { status: 'error' };
      }
    })();
  },
  { immediate: true },
);

function reloadSettings(): void {
  settingsReloadKey.value += 1;
}

async function persistLodMode(mode: LodMode): Promise<void> {
  const current = settingsState.value;
  if (current.status !== 'ready') return;
  // 開發者埋點（07 §7.6）：LOD 切換。
  actionLogger.log('humanModel', 'lodModeChange', mode);
  const next = { ...current.settings, lodMode: mode };
  settingsState.value = { status: 'ready', settings: next };
  try {
    const saved = await localStore.saveSettings(next);
    settingsState.value = { status: 'ready', settings: saved };
  } catch {
    // 保留樂觀值；本地單機持久化失敗極少見。
  }
}

// ── 評估 session（選填 ?session=）：反向高亮＋正向標註 ──
const session = useAssessmentSession(() => sessionId.value ?? '');
const sessionReady = computed(
  () => sessionId.value !== null && session.state.value.status === 'ready',
);
const annotations = computed<readonly BodyAnnotation[] | undefined>(() =>
  session.state.value.status === 'ready' ? session.state.value.session.bodyAnnotations : undefined,
);
const highlights = computed<AnnotationHighlights | undefined>(() =>
  session.state.value.status === 'ready'
    ? annotationHighlights(session.state.value.session.bodyAnnotations)
    : undefined,
);

// finding→模型深連結（§3.3.8）：選填 ?pattern=，驗證為合法動作後作為新標註關聯動作預設。
const defaultLinkedPatternKey = computed<SfmaPatternKey | undefined>(() => {
  const raw = route.query.pattern;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value != null && sfmaPatterns.some((pattern) => pattern.patternKey === value)
    ? (value as SfmaPatternKey)
    : undefined;
});

// marker→finding 反向（§3.3.8）：標註→其關聯動作之評估深連結（帶 ?pattern= 使評估表展開該列）。
const buildFindingHref = computed<((patternKey: SfmaPatternKey) => string) | undefined>(() =>
  sessionId.value !== null
    ? (patternKey: SfmaPatternKey) =>
        `/patients/${patientId.value}/assessments/${sessionId.value}?pattern=${patternKey}`
    : undefined,
);

// 有 ?session= 且就緒方可正向標註；否則入口休眠。
const canAnnotateSession = computed(() => sessionReady.value);

// ── 內層檢視狀態（分層／選取／隱藏／視角／標籤／LOD／FPS）──
// 初值取設定 defaultLayers（向後相容：缺 passiveStructure 補 DEFAULT）。設定就緒前先以預設掛載、
// 就緒後 reset 至設定初值（initialLayers 變更即重置）。
const initialLayers = computed<LayerVisibility>(() =>
  settingsState.value.status === 'ready'
    ? { ...DEFAULT_LAYER_VISIBILITY, ...settingsState.value.settings.defaultLayers }
    : { ...DEFAULT_LAYER_VISIBILITY },
);

const layers = useLayerVisibility(initialLayers.value);
// 設定就緒（initialLayers 變更）即套設定預設分層（一次性，避免使用者後續調整被蓋）。
let layersInitialized = settingsState.value.status === 'ready';
watch(
  () => settingsState.value.status,
  (status) => {
    if (status === 'ready' && !layersInitialized) {
      layersInitialized = true;
      layers.visibility.value = { ...initialLayers.value };
    }
  },
);

const selection = useSelectedPart();
const hidden = useHiddenParts();

const lodMode = computed<LodMode>(() =>
  settingsState.value.status === 'ready' ? settingsState.value.settings.lodMode : 'auto',
);
// 切換至「完整」LOD 之流量確認：包裝 LOD 切換、目標 full 才跳對話框。
const lodConfirm = useFullLodConfirm(lodMode, (mode) => void persistLodMode(mode));
// v-model:open 代理（confirmOpen 為 Ref，模板 v-model 需可寫來源）。
const lodConfirmOpen = computed({
  get: () => lodConfirm.confirmOpen.value,
  set: (value: boolean) => {
    lodConfirm.confirmOpen.value = value;
  },
});

// 手機橫式模型優先佈局（03 §3.1）：規則單一來源＝純函式 viewerLayoutMode。
const breakpoint = useBreakpoint();
const orientation = useOrientation();
const layoutMode = computed(() => viewerLayoutMode(breakpoint.value, orientation.value));

// 標籤預設關（issue 3）：載入即與「重置視角」一致。
const showLabels = ref(false);
const labelMode = ref<LabelMode>(DEFAULT_LABEL_MODE);
const annotating = ref(false);

// 運動模式（§4.3.3）：開關、當前選擇關節、姿態。進運動模式暫停評估標註（獨立模式）。
const motionMode = ref(false);
const motionJoint = ref('joint.knee');
const pose = ref<MotionPose>(NEUTRAL_POSE);

function handleMotionModeChange(on: boolean): void {
  motionMode.value = on;
  if (on) {
    selection.clear();
    pose.value = resetMotionPose();
  }
}
function handleSetJointAngle(jointId: string, axis: string, deg: number): void {
  pose.value = setJointAngle(pose.value, jointId, axis, deg);
}
function handleResetPose(): void {
  pose.value = resetMotionPose();
}

// 裝置能力偵測（建 canvas 探測 WebGL）：canRender3D 為 App 唯一渲染閘（僅 3D）。
const capability = ref(detectDeviceCapability());
const canRender3D = computed(() => capability.value.webglSupported);

// 渲染分級（§4.3.6）：baseTier＝lodMode 解析；live FPS 持續過低則降一級（完整→精簡）。
const baseTier = useRenderTier(lodMode);
const runtimeTier = ref<LodTier>(baseTier.value);
// 設定 lodMode 改變（baseTier 變）即重置執行期分級。
watch(baseTier, (next) => {
  runtimeTier.value = next;
});
// 已自動降級提示（§4.3.6）：runtimeTier 因 FPS 降至低於 baseTier。
const autoDegraded = computed(() => runtimeTier.value !== baseTier.value);

const view = ref<CameraViewKey>(DEFAULT_CAMERA_VIEW);
const region = ref<CameraRegionKey>(DEFAULT_CAMERA_REGION);
// 視角強制重套 nonce（§4.3.2）：每次選視角／部位（含重選同鍵）與重置皆遞增。
const viewNonce = ref(0);
// 3D 載入／執行期失敗時 ErrorBoundary 重試 nonce（遞增即 remount 邊界、重試載入）。
const boundaryNonce = ref(0);
const boundaryFailed = ref(false);

// live FPS 自動降級接線（§4.3.5／§4.3.6）：僅 3D 可渲時取樣，持續低幀 → degradeLodTier 降一級。
function handleFpsDegrade(): void {
  const next = degradeLodTier(runtimeTier.value);
  if (next !== runtimeTier.value) {
    actionLogger.log('humanModel', 'fpsDegrade', `${runtimeTier.value}→${next}`);
  }
  runtimeTier.value = next;
}
const sampleFps = useFpsAutoDegrade({ enabled: canRender3D, onDegrade: handleFpsDegrade });

const selected = computed(() => selection.selected.value);
const selectedSide = computed(() => selection.selectedSide.value);
const canAnnotate = computed(
  () => !motionMode.value && canAnnotateSession.value && selected.value !== null,
);
// 既有標註（同 anatomyId＋同側別）→ 編輯模式（左右各自獨立）。
const existing = computed<BodyAnnotation | undefined>(() =>
  selected.value !== null
    ? findBodyAnnotation(annotations.value ?? [], selected.value.anatomyId, selectedSide.value)
    : undefined,
);
// 對話框 remount key（部位／側別／既有標註變更時重置表單）。
const dialogKey = computed(() =>
  selected.value
    ? `${selected.value.anatomyId}@${selectedSide.value ?? ''}:${existing.value?.annotationId ?? 'new'}`
    : 'none',
);
const selectedName = computed(() => (selected.value ? localizeText(selected.value.name) : ''));

function handleAnnotationSubmit(draft: BodyAnnotationDraft): void {
  if (selected.value && canAnnotateSession.value) {
    // 既有則沿用其 annotationId（upsert 覆蓋免重複）、否則新建。側別：對話框可覆寫、否則自動帶入點選側。
    void session.upsertAnnotation(
      newBodyAnnotation(
        existing.value?.annotationId ?? createUuid(),
        selected.value.anatomyId,
        draft.side ?? selectedSide.value,
        draft.findingType,
        draft.linkedPatternKey,
        draft.note,
      ),
    );
  }
  annotating.value = false;
}

function handleAnnotationRemove(): void {
  if (existing.value && canAnnotateSession.value) {
    void session.removeAnnotation(existing.value.annotationId);
  }
  annotating.value = false;
}

// 單一部位隱藏（§4.1）：隱藏目前選取部位並清選取，使浮動資訊卡關閉。
function handleHide(): void {
  if (selected.value && selection.selectedId.value !== null) {
    hidden.hide(selection.selectedId.value);
    selection.clear();
  }
}

// 選視角（含重選目前鍵）：bump nonce 使 3D 相機重套（§4.3.2，抵銷使用者環繞）。
function handleViewChange(next: CameraViewKey): void {
  view.value = next;
  viewNonce.value += 1;
}

// 選部位（含重選目前部位）：bump nonce 使 3D 相機以對應 yBand 重框取（需求 3）。
function handleRegionChange(next: CameraRegionKey): void {
  region.value = next;
  viewNonce.value += 1;
}

// 一鍵重置檢視（03 §3.6）：復原視圖狀態（3D 視角／標籤／已隱藏／選取），不動標註資料、不重置分層。
function handleResetView(): void {
  view.value = DEFAULT_CAMERA_VIEW;
  region.value = DEFAULT_CAMERA_REGION;
  viewNonce.value += 1;
  showLabels.value = false;
  labelMode.value = DEFAULT_LABEL_MODE;
  hidden.restoreAll();
  selection.clear();
  motionMode.value = false;
  pose.value = resetMotionPose();
}

// LOD 切換寫回設定單一真相（§3.5／§3.6）；經 useFullLodConfirm（目標 full 才跳確認）。
function handleLodModeChange(mode: LodMode): void {
  lodConfirm.requestLodMode(mode);
}

function retryCapability(): void {
  capability.value = detectDeviceCapability();
}

function retryBoundary(): void {
  boundaryFailed.value = false;
  boundaryNonce.value += 1;
}
</script>

<template>
  <PageSkeleton
    v-if="settingsState.status === 'loading'"
    :label="t('loading')"
    class="modelViewerStatus"
  />
  <PageError
    v-else-if="settingsState.status === 'error'"
    class="modelViewerStatus"
    :message="t('settingsLoadError')"
    :retry-label="t('retry')"
    @retry="reloadSettings"
  />
  <PageError
    v-else-if="!canRender3D"
    class="modelViewerStatus"
    :message="t('model3dUnsupported')"
    :retry-label="t('retry')"
    @retry="retryCapability"
  />
  <div v-else class="modelViewerPage">
    <p v-if="autoDegraded" class="modelLodNotice" role="status">
      {{ t('modelLodAutoDegraded') }}
    </p>
    <PageError
      v-if="boundaryFailed"
      class="modelViewerStatus"
      :message="t('model3dLoadError')"
      :retry-label="t('retry')"
      @retry="retryBoundary"
    />
    <ErrorBoundary v-else :key="boundaryNonce" @error="boundaryFailed = true">
      <template #fallback>
        <PageError
          class="modelViewerStatus"
          :message="t('model3dLoadError')"
          :retry-label="t('retry')"
          @retry="retryBoundary"
        />
      </template>
      <Model3DViewer
        :tier="runtimeTier"
        :layout-mode="layoutMode"
        :visibility="layers.visibility.value"
        :can-reset-layers="true"
        :selected="selected"
        :selected-key="selection.selectedId.value"
        :selected-side="selectedSide"
        :can-annotate="canAnnotate"
        :highlights="highlights"
        :hidden-ids="hidden.hiddenIds.value"
        :can-hide="selected !== null"
        :can-restore="true"
        :view="view"
        :can-change-view="true"
        :region="region"
        :can-change-region="true"
        :view-nonce="viewNonce"
        :show-labels="showLabels"
        :can-show-labels="true"
        :label-mode="labelMode"
        :can-change-label-mode="true"
        :lod-mode="lodMode"
        :can-change-lod="true"
        :can-reset-view="true"
        :can-toggle-motion="true"
        :motion-mode="motionMode"
        :pose="pose"
        :motion-joint="motionJoint"
        @set-visible="layers.setVisible"
        @reset-layers="layers.reset"
        @select-part="selection.toggle"
        @annotate="annotating = true"
        @background-click="selected ? selection.clear() : undefined"
        @hide="handleHide"
        @restore-part="hidden.restore"
        @restore-all="hidden.restoreAll"
        @view-change="handleViewChange"
        @region-change="handleRegionChange"
        @show-labels-change="showLabels = $event"
        @label-mode-change="labelMode = $event"
        @lod-mode-change="handleLodModeChange"
        @reset-view="handleResetView"
        @motion-mode-change="handleMotionModeChange"
        @set-joint-angle="handleSetJointAngle"
        @reset-pose="handleResetPose"
        @motion-joint-change="motionJoint = $event"
        @fps="sampleFps"
      />
    </ErrorBoundary>

    <BodyAnnotationDialog
      v-if="selected && canAnnotateSession"
      :key="dialogKey"
      v-model:open="annotating"
      :part-name="selectedName"
      :patterns="sfmaPatterns"
      :initial="existing"
      :default-linked-pattern-key="defaultLinkedPatternKey"
      :sided="selectedSide !== null"
      :default-side="selectedSide"
      :can-remove="existing !== undefined"
      @submit="handleAnnotationSubmit"
      @remove="handleAnnotationRemove"
    />

    <!-- 切換至「完整」LOD 之流量確認（無損模型巨大、首載大流量）；確認才套 full。 -->
    <FullLodConfirmDialog v-model:open="lodConfirmOpen" @confirm="lodConfirm.confirmFull" />

    <BodyAnnotationList
      v-if="annotations"
      :annotations="annotations"
      :patterns="sfmaPatterns"
      :selected-anatomy-id="selection.selectedId.value"
      :can-select="true"
      :can-remove="canAnnotateSession"
      :build-finding-href="buildFindingHref"
      @select="selection.select"
      @remove="session.removeAnnotation"
    />
  </div>
</template>

<style scoped>
.modelViewerPage {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.modelViewerStatus {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

/* LOD 自動降級提示（§4.3.6 介面提示等級）：3D 持續低幀自動降級時之狀態列。 */
.modelLodNotice {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
