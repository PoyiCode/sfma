// 預設視角／重置（04 §4.3.2）：資料化 ArcRotateCamera 之前/後/左/右取景。
// 四向以 alpha 90° 等距、anchor 於 addDefaultCamera 現行預設（front）；beta/radius 一致。
// alpha→解剖方位之對應暫定、待正式 glTF 朝向校正。NullEngine 可測。
// 刻意僅以 type-only 引入 Babylon（不 import 任何 value）——本檔被主 chunk 容器
// （ModelViewerPage）引入取 CAMERA_VIEW_KEYS／DEFAULT_CAMERA_VIEW，value 引入會將整包
// @babylonjs/core 拉進主 chunk。設 target 故以 camera.target.set(...) 原地改寫、不 new Vector3。
import type { ArcRotateCamera } from '@babylonjs/core';
import type { Vec3 } from './sceneCameraFraming';

export const CAMERA_VIEW_KEYS = ['front', 'back', 'left', 'right'] as const;
export type CameraViewKey = (typeof CAMERA_VIEW_KEYS)[number];

export const DEFAULT_CAMERA_VIEW: CameraViewKey = 'front';

interface CameraView {
  alpha: number;
  beta: number;
  radius: number;
}

// beta/radius 比照 addDefaultCamera（π/2.5、4）；front 之 alpha 即現行預設 -π/2。
const VIEW_BETA = Math.PI / 2.5;
const VIEW_RADIUS = 4;

export const CAMERA_VIEW_PRESETS: Readonly<Record<CameraViewKey, CameraView>> = {
  front: { alpha: Math.PI / 2, beta: VIEW_BETA, radius: VIEW_RADIUS },
  right: { alpha: 0, beta: VIEW_BETA, radius: VIEW_RADIUS },
  back: { alpha: -Math.PI / 2, beta: VIEW_BETA, radius: VIEW_RADIUS },
  left: { alpha: Math.PI, beta: VIEW_BETA, radius: VIEW_RADIUS },
};

/**
 * 自適應框取（取自 sceneCameraFraming 的 computeFraming＋computeRadiusLimits）。
 * 提供時，applyCameraView 以此覆寫 target/radius/半徑上下限/近裁面。
 */
export interface CameraFraming {
  target: Vec3;
  radius: number;
  lower: number;
  upper: number;
  minZ: number;
}

/**
 * 只套自適應框取（target/radius/半徑上下限/近裁面），**不動 alpha/beta**（方向／旋轉）。
 * 供 resize 重新取景：視窗／方位變更後以新 aspect re-fit 模型、保留使用者旋轉（§4.3.2）。
 * 原地改寫 _target（不走 setTarget／set target——二者會依 position 反推 alpha/beta，
 * 且 setTarget 需 new Vector3 而引入 Babylon value）；position 由 alpha/beta/radius+target 推導。
 */
export function applyCameraFraming(camera: ArcRotateCamera, framing: CameraFraming): void {
  camera.target.set(framing.target.x, framing.target.y, framing.target.z);
  camera.radius = framing.radius;
  camera.lowerRadiusLimit = framing.lower;
  camera.upperRadiusLimit = framing.upper;
  camera.minZ = framing.minZ;
}

/**
 * 套用視角：alpha/beta 恆由方向 preset。
 * - 提供 framing 時：target/radius/半徑上下限/近裁面取自 framing（自適應實機框取）。
 * - 未提供時：沿用 preset 固定 radius（佔位、無模型時後備），不動 target/limits。
 */
export function applyCameraView(
  camera: ArcRotateCamera,
  key: CameraViewKey,
  framing?: CameraFraming,
): void {
  const view = CAMERA_VIEW_PRESETS[key];
  camera.alpha = view.alpha;
  camera.beta = view.beta;

  if (framing) {
    applyCameraFraming(camera, framing);
  } else {
    camera.radius = view.radius;
  }
}
