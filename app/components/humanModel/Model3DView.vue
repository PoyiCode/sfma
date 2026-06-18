<script setup lang="ts">
// 模組 04 3D 版 canvas 元件：掌管 Babylon engine 生命週期，掛 sceneCore 場景（§4.3.1）。
// React useRef＋useEffect(init/dispose)＋多 effect 同步 → Vue ref＋onMounted/onBeforeUnmount＋多 watch。
// Babylon 物件（engine/scene/camera/labelLayer）以閉包變數持（非 Vue reactive），避免響應式代理污染。
// Babylon 不可於 SSR/prerender 執行：本元件僅於 client 掛載（import.meta.client 守衛 + 父層 <ClientOnly>）。
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import {
  type AbstractEngine,
  type ArcRotateCamera,
  PointerEventTypes,
  type Scene,
} from '@babylonjs/core';
import { anatomyEntities } from '@ptapp/definitions';
import type { AnatomyLayerKey } from '../../utils/humanModel/anatomy/anatomyLayers';
import {
  applyCameraFraming,
  applyCameraView,
  type CameraFraming,
  type CameraViewKey,
} from '../../utils/humanModel/render/sceneCamera';
import {
  type CameraRegionKey,
  computeFraming,
  computeRadiusLimits,
  DEFAULT_CAMERA_REGION,
  DEFAULT_FILL_FRACTION,
  type Extents,
  horizontalExtentInBand,
  type MeshBounds,
  REGION_Y_BANDS,
} from '../../utils/humanModel/render/sceneCameraFraming';
import { defaultEngineFactory, type EngineFactory } from '../../utils/humanModel/render/engineFactory';
import {
  addDefaultCamera,
  addDefaultLight,
  createModelScene,
} from '../../utils/humanModel/render/sceneCore';
import {
  placeholderScenePopulator,
  type ScenePopulator,
} from '../../utils/humanModel/render/scenePopulator';
import { applyMeshVisibility } from '../../utils/humanModel/render/sceneLayers';
import { isBackgroundPick, partKeyFromPick } from '../../utils/humanModel/render/scenePicking';
import { applyHighlights } from '../../utils/humanModel/render/sceneHighlight';
import {
  DEFAULT_LABEL_MODE,
  resolveVisibleLabels,
  type LabelMode,
} from '../../utils/humanModel/render/sceneLabels';
import { createLabelLayer, type LabelLayer } from '../../utils/humanModel/render/labelLayer';
import type { AnnotationHighlights } from '../../utils/humanModel/anatomy/anatomyHighlight';

// 標籤層工廠（§4.4）：預設真 Babylon GUI 綁定；測試注入假層脫鉤（GUI 需 canvas）。
type LabelLayerFactory = (scene: Scene) => LabelLayer;

interface Props {
  engineFactory?: EngineFactory;
  // 場景填充策略（§4.6.4）：預設同步佔位身體；可注入非同步 glTF 填充器。
  populateScene?: ScenePopulator;
  visibility?: Readonly<Record<AnatomyLayerKey, boolean>>;
  hiddenIds?: readonly string[];
  view?: CameraViewKey;
  // 部位視角（需求 3）：取景 Y 區段（全身／頭部／胸腹／臀腿），正交於 view 之環繞角、可組合。預設 whole。
  region?: CameraRegionKey;
  // 視角強制重套 nonce（§4.3.2）：遞增即重套 view（即使鍵未變），抵銷使用者環繞／縮放／平移。
  viewNonce?: number;
  selectedId?: string | null;
  // 反向高亮（§4.5）：anatomyId → findingType；標註部位以 overlay 著色（選取優先）。
  highlights?: AnnotationHighlights;
  // 標籤系統（§4.4）：showLabels 全域開關（預設 true）、labelMode 顯示模式（all／selected）。
  showLabels?: boolean;
  labelMode?: LabelMode;
  // 標籤層工廠（測試脫鉤）：預設真 Babylon GUI 綁定 createLabelLayer。
  labelLayerFactory?: LabelLayerFactory;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  engineFactory: defaultEngineFactory,
  populateScene: placeholderScenePopulator,
  visibility: undefined,
  hiddenIds: undefined,
  view: undefined,
  region: DEFAULT_CAMERA_REGION,
  viewNonce: undefined,
  selectedId: null,
  highlights: undefined,
  showLabels: true,
  labelMode: DEFAULT_LABEL_MODE,
  labelLayerFactory: createLabelLayer,
  class: undefined,
});

const emit = defineEmits<{
  // partKey（側別限定，取消左右群組化）：點左肱骨上拋 `bone.humerus@left`。
  select: [anatomyId: string];
  // 點空白關閉（§3.3.8）：pick 未命中任何部位時上拋（供清選取收卡）。
  backgroundClick: [];
  // live FPS 取樣（§4.3.5／§4.3.6）：每次算繪後回報 engine.getFps()。
  fps: [fps: number];
  // 場景填充載入態回報（§4.6.4）：建場景起 true、填充 settle 後 false。
  loadingChange: [loading: boolean];
}>();

const canvasRef = ref<HTMLCanvasElement>();

// Babylon 物件以閉包持（非 Vue reactive）：避免響應式代理破壞引擎內部 identity 假設。
let scene: Scene | null = null;
let camera: ArcRotateCamera | null = null;
let engine: AbstractEngine | null = null;
// 自適應框取所需模型包圍盒（§4.3.2）：填充完成後算存；view／viewNonce 重套時讀此重算。
let extents: Extents | null = null;
// 各 mesh 世界 AABB（部位框取精修）：填充後存、供算部位段水平範圍；靜態模型故算一次。
let meshBounds: readonly MeshBounds[] = [];
let labelLayer: LabelLayer | null = null;

// 自適應框取（§4.3.2／需求 3 部位視角）：由模型包圍盒＋實機畫布比例＋部位 yBand 推算
// target/radius/半徑上下限/近裁面。無有效包圍盒或畫布尺寸未定時回 undefined → applyCameraView 沿用 preset。
function buildCameraFraming(
  cam: ArcRotateCamera,
  eng: AbstractEngine,
  ext: Extents | null,
  region: CameraRegionKey,
  bounds: readonly MeshBounds[],
): CameraFraming | undefined {
  if (!ext || ext.max.x < ext.min.x) return undefined;
  const width = eng.getRenderWidth();
  const height = eng.getRenderHeight();
  if (!(width > 0) || !(height > 0)) return undefined;
  const aspect = width / height;
  const band = REGION_Y_BANDS[region];
  const fullHeight = ext.max.y - ext.min.y;
  const yLo = ext.min.y + band.lo * fullHeight;
  const yHi = ext.min.y + band.hi * fullHeight;
  const horizExtent = horizontalExtentInBand(bounds, yLo, yHi);
  const { target, radius } = computeFraming(ext, {
    aspect,
    fov: cam.fov,
    fillFraction: DEFAULT_FILL_FRACTION,
    yBand: band,
    horizExtent,
  });
  // 縮放上下限以全身框取半徑為基準（穩定縮放範圍、不隨部位拉近而壓縮）。
  const wholeRadius = computeFraming(ext, {
    aspect,
    fov: cam.fov,
    fillFraction: DEFAULT_FILL_FRACTION,
    yBand: REGION_Y_BANDS.whole,
  }).radius;
  const { lower, upper, minZ } = computeRadiusLimits(wholeRadius);
  return { target, radius, lower, upper, minZ };
}

// 蒐集場景各「有幾何」mesh 之世界座標 AABB（部位框取精修）。
function collectMeshBounds(sc: Scene): MeshBounds[] {
  const result: MeshBounds[] = [];
  for (const mesh of sc.meshes) {
    if (mesh.getTotalVertices() === 0) continue;
    mesh.computeWorldMatrix(true);
    const box = mesh.getBoundingInfo().boundingBox;
    const min = box.minimumWorld;
    const max = box.maximumWorld;
    result.push({
      minX: min.x,
      maxX: max.x,
      minY: min.y,
      maxY: max.y,
      minZ: min.z,
      maxZ: max.z,
    });
  }
  return result;
}

// 標籤同步（§4.4）：惰性建層（僅當有標籤可顯或層已存在時建，避免無 visibility 之測試建真 GUI）。
function syncLabels(): void {
  if (!scene || !props.visibility) return;
  const labels = resolveVisibleLabels({
    entities: anatomyEntities,
    visibility: props.visibility,
    hiddenIds: new Set(props.hiddenIds ?? []),
    selectedId: props.selectedId ?? null,
    showLabels: props.showLabels,
    mode: props.labelMode,
  });
  if (labels.length === 0 && !labelLayer) return;
  if (!labelLayer) labelLayer = props.labelLayerFactory(scene);
  labelLayer.sync(labels);
}

onMounted(() => {
  // 僅 client（Babylon 需真 DOM/WebGL；prerender 守衛）。
  if (!import.meta.client) return;
  const canvas = canvasRef.value;
  if (!canvas) return;

  // issue 4：滑鼠滾輪於 3D 畫布僅縮放模型、不捲動頁面（non-passive 方可 preventDefault）。
  const preventWheelScroll = (event: WheelEvent): void => event.preventDefault();
  canvas.addEventListener('wheel', preventWheelScroll, { passive: false });

  let cancelled = false;
  // resize re-fit 之寬度守衛（行動裝置上下滑不重置相機距離）：記錄上次框取時之算繪寬度。
  let lastFitWidth: number | null = null;
  let createdEngineRef: AbstractEngine | null = null;
  let handleResize: (() => void) | null = null;

  const setupScene = (createdEngine: AbstractEngine): void => {
    // 非同步 engine 於卸載後才 resolve：守衛 cancelled，dispose late engine、不建場景。
    if (cancelled) {
      createdEngine.dispose();
      return;
    }
    engine = createdEngine;
    createdEngineRef = createdEngine;
    const builtScene = createModelScene(createdEngine);
    const builtCamera = addDefaultCamera(builtScene);
    builtCamera.attachControl(canvas, true);
    camera = builtCamera;
    addDefaultLight(builtScene);
    // 選取僅於「點按」(POINTERTAP) 觸發、非拖曳（旋轉/平移屬拖曳、超閾值不發 → 不誤選/誤清選取）。
    builtScene.onPointerObservable.add((pointerInfo) => {
      const pickInfo = pointerInfo.pickInfo;
      const key = partKeyFromPick(pickInfo);
      if (key !== null) emit('select', key);
      else if (isBackgroundPick(pickInfo)) emit('backgroundClick');
    }, PointerEventTypes.POINTERTAP);
    scene = builtScene;
    // 場景填充載入態（§4.6.4）：建場景即「載入中」（多 MB GLB 下載期供容器顯回饋）。
    emit('loadingChange', true);
    // 場景填充：同步（佔位）即時就緒；非同步（glTF 載入）幾何於 await 後才出現
    // → 載入完成後（守衛未卸載＋仍為本場景）以最新 props 補套。
    void Promise.resolve(props.populateScene(builtScene))
      .then(() => {
        if (cancelled || scene !== builtScene) return;
        if (props.visibility) {
          applyMeshVisibility(builtScene, props.visibility, new Set(props.hiddenIds ?? []));
        }
        // 自適應框取（§4.3.2）：填充後幾何就緒，以包圍盒算 target/radius/limits/minZ 存。
        extents = builtScene.getWorldExtends();
        meshBounds = collectMeshBounds(builtScene);
        if (props.view) {
          applyCameraView(
            builtCamera,
            props.view,
            buildCameraFraming(builtCamera, createdEngine, extents, props.region, meshBounds),
          );
        }
        lastFitWidth = createdEngine.getRenderWidth();
        applyHighlights(builtScene, props.selectedId ?? null, props.highlights);
        // 標籤補套（§4.4）：標籤須連結載入後之 mesh，故於填充完成後以最新值再同步（惰性建層）。
        syncLabels();
      })
      .finally(() => {
        // 成功與失敗（withFallback 退佔位亦 resolve）皆視為載入結束；守衛卸載／場景已換。
        if (cancelled || scene !== builtScene) return;
        emit('loadingChange', false);
      });
    // live FPS 取樣（§4.3.5）：每次算繪後回報 engine.getFps()。
    builtScene.onAfterRenderObservable.add(() => {
      emit('fps', createdEngine.getFps());
    });
    createdEngine.runRenderLoop(() => {
      builtScene.render();
    });
    // 視窗／方位變更（§4.3.2）：同步畫布尺寸後以新 aspect re-fit 模型。
    // 寬度守衛：行動瀏覽器網址列顯/隱＝僅高度變、寬度不變→不 re-fit（否則重置使用者縮放 radius）。
    handleResize = (): void => {
      createdEngine.resize();
      const width = createdEngine.getRenderWidth();
      if (lastFitWidth !== null && width === lastFitWidth) return;
      const framing = buildCameraFraming(
        builtCamera,
        createdEngine,
        extents,
        props.region,
        meshBounds,
      );
      if (framing) {
        applyCameraFraming(builtCamera, framing);
        lastFitWidth = width;
      }
    };
    window.addEventListener('resize', handleResize);
  };

  // 同步工廠（WebGL2／NullEngine）即時 setup；非同步工廠（WebGPU）於 resolve 後 setup。
  const created = props.engineFactory(canvas);
  if (created instanceof Promise) void created.then(setupScene);
  else setupScene(created);

  onBeforeUnmount(() => {
    cancelled = true;
    canvas.removeEventListener('wheel', preventWheelScroll);
    if (handleResize) window.removeEventListener('resize', handleResize);
    labelLayer?.dispose();
    labelLayer = null;
    const builtScene = scene;
    scene = null;
    camera = null;
    engine = null;
    extents = null;
    meshBounds = [];
    builtScene?.dispose();
    createdEngineRef?.dispose();
  });
});

// 可見性套用（合成分層×單一隱藏）：visibility／hiddenIds 任一變更時重算。
watch(
  () => [props.visibility, props.hiddenIds] as const,
  () => {
    if (scene && props.visibility) {
      applyMeshVisibility(scene, props.visibility, new Set(props.hiddenIds ?? []));
    }
  },
);

// 視角套用（§4.3.2／需求 3）：view／region／viewNonce 任一變更時套用視角。
// region 變更即以對應 yBand 重框取；viewNonce 使「重選目前視角／部位」與「重置」於鍵未變時仍重套。
watch(
  () => [props.view, props.region, props.viewNonce] as const,
  () => {
    if (camera && props.view) {
      const framing = engine
        ? buildCameraFraming(camera, engine, extents, props.region, meshBounds)
        : undefined;
      applyCameraView(camera, props.view, framing);
    }
  },
);

// 高亮（§4.1 選取＋§4.5 反向標註）：selectedId／highlights 任一變更時重套合成高亮（選取優先）。
watch(
  () => [props.selectedId, props.highlights] as const,
  () => {
    if (scene) applyHighlights(scene, props.selectedId ?? null, props.highlights);
  },
);

// 標籤同步（§4.4）：標籤相關 prop 任一變更時，以 resolveVisibleLabels 算集合→labelLayer.sync。
watch(
  () => [props.showLabels, props.labelMode, props.visibility, props.hiddenIds, props.selectedId] as const,
  () => syncLabels(),
);
</script>

<template>
  <canvas ref="canvasRef" :class="['model3dView', props.class]" aria-label="3D 人體模型" />
</template>

<style scoped>
/* 3D canvas：填滿容器、觸控不卷動（pointer 操作由 Babylon 接管）。 */
.model3dView {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 320px;
  outline: none;
  touch-action: none;
  background: var(--color-surface);
  border-radius: var(--radius-md);
}
</style>
