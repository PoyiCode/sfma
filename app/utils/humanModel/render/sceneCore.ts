// 模組 04 3D 版場景核心（04 §4.3.1）。以注入 Engine 建 Scene，便於 NullEngine 無頭測試。
// 佔位身體（§4.6.4）：逐 AnatomyEntity 建 box，node 名＝anatomyId（§4.6.2 抽換邊界），
// metadata 帶型別／分層供後續切片（分層過濾、點選反查）。位置為開發用排列、非解剖真實座標。
import {
  type AbstractEngine,
  ArcRotateCamera,
  HemisphericLight,
  MeshBuilder,
  Scene,
  Vector3,
} from '@babylonjs/core';
import type { AnatomyEntity } from '@ptapp/shared';
import type { AnatomySide } from '../anatomy/partKey';

// layer 僅存在於 muscle 變體（AnatomyEntity 為依 type 之判別聯集）。
type MuscleLayer = Extract<AnatomyEntity, { type: 'muscle' }>['layer'];

export interface PlaceholderMeshMetadata {
  anatomyId: string;
  entityType: AnatomyEntity['type'];
  layer?: MuscleLayer;
  // 側別（解3d資產：取消左右群組化）：成對部位每側一 mesh、各帶 side；中線部位不設（無側）。
  side?: AnatomySide;
}

// 接受 AbstractEngine：WebGL2 Engine／NullEngine／WebGPUEngine 皆可建場景（§4.3.1）。
export function createModelScene(engine: AbstractEngine): Scene {
  return new Scene(engine);
}

// 佔位排列：沿 x 軸等距分布、避免重疊（真實座標待正式 glTF 資產）。
const PLACEHOLDER_SPACING = 1.5;

// 佔位身體為側別無關後備（box；無真實資產時用）：每 anatomyId 單件、不設 side——側別由真實資產
// 承載（3D glb 之 #L/#R 經 gltfBinding 設 metadata.side、2D 之 per-side 圖層 id）。選取/高亮以
// partKey 分流，佔位部位 side 為 null→partKey 即 anatomyId（無側可選即不分側、語意一致）。
export function buildPlaceholderBody(scene: Scene, entities: readonly AnatomyEntity[]): void {
  entities.forEach((entity, index) => {
    const existing = scene.getMeshByName(entity.anatomyId);
    if (existing) existing.dispose();
    const mesh = MeshBuilder.CreateBox(entity.anatomyId, { size: 1 }, scene);
    mesh.position = new Vector3((index - (entities.length - 1) / 2) * PLACEHOLDER_SPACING, 0, 0);
    const metadata: PlaceholderMeshMetadata = {
      anatomyId: entity.anatomyId,
      entityType: entity.type,
    };
    if (entity.type === 'muscle') metadata.layer = entity.layer;
    mesh.metadata = metadata;
  });
}

export function findMeshByAnatomyId(scene: Scene, anatomyId: string) {
  return scene.getMeshByName(anatomyId);
}

// 依 partKey（側別限定）取確切 mesh（真實資產 mesh 名＝partKey；佔位為 anatomyId＝無側 partKey）。
export function findMeshByPartKey(scene: Scene, key: string) {
  return scene.getMeshByName(key);
}

// 鏡頭拉進/拉遠極限（§4.3.2）：預設視角 radius 4（同 sceneCamera VIEW_RADIUS）；下限防過度拉進穿入
// 模型內部而顯示背面（使用者回報），上限防拉遠成空景。實際值可俟正式 glb 包圍盒再校。
const CAMERA_DEFAULT_RADIUS = 4;
const CAMERA_LOWER_RADIUS_LIMIT = 2;
const CAMERA_UPPER_RADIUS_LIMIT = 8;
// 環繞旋轉靈敏度（angularSensibility 為「除數」：越小越靈敏）。Babylon 預設 1000；125＝1/8
// ＝**8 倍靈敏**（使用者偏好旋轉更靈敏、實機調校確認）。X/Y 同值＝水平/垂直一致。
const CAMERA_ANGULAR_SENSIBILITY = 125;
// 自適應縮放比率（使用者需求）：每滾輪刻度／pinch 改變 radius 之比例＝**∝ 當前距離**
// （`delta ≈ deltaY × 0.01 × pct × radius`）→ 近（radius 小）步進小、遠（radius 大）步進大、
// 乘法漸近極限＝平滑無斷崖。取代 Babylon 預設固定除數 `wheelPrecision=3`（單刻度 ~33 單位 ≫
// radius 範圍 [2,8]＝一格撞極限之斷崖）。0.05 為起始值、可調（大＝快、小＝細）。wheel/pinch 同值。
const CAMERA_ZOOM_DELTA_PERCENTAGE = 0.05;

// 預設環繞相機，便於旋轉檢視（建構即設為 scene.activeCamera；完整預設視角/重置為後續切片，§4.3.2）。
export function addDefaultCamera(scene: Scene): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    'modelCamera',
    -Math.PI / 2,
    Math.PI / 2.5,
    CAMERA_DEFAULT_RADIUS,
    Vector3.Zero(),
    scene,
  );
  // 限制拉進/拉遠極限：避免過度拉進穿入模型內部（顯示背面）、或拉遠成空景。
  camera.lowerRadiusLimit = CAMERA_LOWER_RADIUS_LIMIT;
  camera.upperRadiusLimit = CAMERA_UPPER_RADIUS_LIMIT;
  // 移動/轉動/平移無慣性：放開即停、不滑行（使用者偏好）。
  camera.inertia = 0;
  camera.panningInertia = 0;
  // 旋轉靈敏度（使用者偏好：較預設靈敏 8 倍）。
  camera.angularSensibilityX = CAMERA_ANGULAR_SENSIBILITY;
  camera.angularSensibilityY = CAMERA_ANGULAR_SENSIBILITY;
  // 自適應縮放（使用者需求）：滾輪／pinch 步進 ∝ 當前距離（近小遠大、平滑無斷崖）；
  // deltaPercentage≠0 即取代固定 wheelPrecision。
  camera.wheelDeltaPercentage = CAMERA_ZOOM_DELTA_PERCENTAGE;
  camera.pinchDeltaPercentage = CAMERA_ZOOM_DELTA_PERCENTAGE;
  return camera;
}

export function addDefaultLight(scene: Scene): HemisphericLight {
  return new HemisphericLight('modelLight', new Vector3(0, 1, 0), scene);
}
