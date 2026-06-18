/**
 * 自適應相機框取（framework-agnostic、純函式、可測）。
 *
 * 設計依 04 §4.3.2：以模型包圍盒推算 ArcRotateCamera 的 target／radius，使
 * 全身（或指定 yBand 區段）以 fillFraction 垂直填充畫布並置中——fill=0.70 時
 * 頭頂（maxY）投影至畫布 85%、腳底（minY）至 15%。
 *
 * 形狀刻意對齊 Babylon `scene.getWorldExtends()` 之 { min, max } Vector3，
 * 整合層可直接餵入而無框架耦合。
 */

export type Vec3 = { x: number; y: number; z: number };

export type Extents = { min: Vec3; max: Vec3 };

/** 單一 mesh 之世界座標 AABB（部位框取精修：算部位段水平範圍用）。 */
export type MeshBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

/** Y 軸取景區段（以 0–1 比例表全高）；whole＝{ lo: 0, hi: 1 }。 */
export type YBand = { lo: number; hi: number };

export type FramingOptions = {
  /** 畫布寬高比（width / height）。 */
  aspect: number;
  /** 相機垂直視角（弧度）。 */
  fov: number;
  /** 取景區段於畫布的垂直填充比例（0–1）；0.70 ⟹ head 85／feet 15。 */
  fillFraction: number;
  /** Y 軸取景區段（region-ready）；省略＝全身。 */
  yBand?: YBand;
  /**
   * 部位段水平範圍（世界單位；部位框取精修）：提供且 >0 時，水平半徑以此計（取景區段之實際水平
   * 跨距），否則沿用全身包圍盒 max(X 寬, Z 深)。窄部位（頭）於窄直式螢幕得以貼近、不受全身肩臀寬牽制。
   */
  horizExtent?: number;
};

export type Framing = {
  /** 相機注視點（包圍盒水平中心、yBand 區段垂直中心）。 */
  target: Vec3;
  /** 相機半徑（distance to target），使區段以 fillFraction 填充。 */
  radius: number;
};

export type RadiusLimits = {
  /** 最小半徑：可深縮放至細節。 */
  lower: number;
  /** 最大半徑：略超全身、防飛離。 */
  upper: number;
  /** 近裁面：隨尺度下調以容深縮放、免近縮裁切。 */
  minZ: number;
};

const WHOLE_BAND: YBand = { lo: 0, hi: 1 };

/**
 * 預設垂直填充比例：0.70 ⟹ 頭頂投影至畫布 85%、腳底 15%（04 §4.3.2）。
 * 整合層與測試共用此常數，確保框取數值一致。
 */
export const DEFAULT_FILL_FRACTION = 0.7;

/**
 * 部位視角鍵（需求 3）：whole＝全身、head＝頭部、chestAbdomen＝胸部+腹部、hipLegs＝臀部+腿部。
 * 部位（取景 Y 區段）與方向（front/back/left/right 環繞角）正交，可組合（如 正面＋頭部）。
 */
export const CAMERA_REGION_KEYS = ['whole', 'head', 'chestAbdomen', 'hipLegs'] as const;
export type CameraRegionKey = (typeof CAMERA_REGION_KEYS)[number];

export const DEFAULT_CAMERA_REGION: CameraRegionKey = 'whole';

/**
 * 各部位之取景 Y 區段（0＝腳底、1＝頭頂；連續覆蓋全身）。
 * 校正值：依標準人體比例近似（腿長約半身高、頭+頸約頂端 20%）；俟正式 glb 實機可再調。
 */
export const REGION_Y_BANDS: Readonly<Record<CameraRegionKey, YBand>> = {
  whole: { lo: 0, hi: 1 },
  hipLegs: { lo: 0, hi: 0.5 },
  chestAbdomen: { lo: 0.5, hi: 0.8 },
  head: { lo: 0.8, hi: 1 },
};

/**
 * 部位段水平範圍（部位框取精修）：取所有「世界 Y 範圍與 [yLo, yHi] 有重疊」之 mesh AABB，
 * 回其整體 `max(X 跨距, Z 跨距)`；無任何重疊回 0（呼叫端後備全身水平）。
 * 橫跨段邊界之件計入全寬（straddle 過計、對局部解剖件影響小）。
 */
export function horizontalExtentInBand(
  bounds: readonly MeshBounds[],
  yLo: number,
  yHi: number,
): number {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let found = false;
  for (const b of bounds) {
    if (b.maxY < yLo || b.minY > yHi) continue; // 與該段無 Y 重疊
    if (b.minX < minX) minX = b.minX;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.minZ < minZ) minZ = b.minZ;
    if (b.maxZ > maxZ) maxZ = b.maxZ;
    found = true;
  }
  if (!found) return 0;
  return Math.max(maxX - minX, maxZ - minZ);
}

/**
 * 由包圍盒與畫布參數推算框取（target／radius）。
 *
 * - target.x／z＝包圍盒水平中心；target.y＝yBand 區段中心。
 * - bandHeight＝Y 全高×(hi−lo)；maxHoriz＝部位段水平範圍（horizExtent>0 時）否則全身 max(X 寬, Z 深)。
 * - radius＝max(垂直主導, 水平主導)：
 *   - radius_v＝bandHeight ／ (2·fill·tan(fov/2))
 *   - radius_h＝maxHoriz ／ (2·fill·tan(fov/2)·aspect)
 */
export function computeFraming(extents: Extents, options: FramingOptions): Framing {
  const { aspect, fov, fillFraction } = options;
  const yBand = options.yBand ?? WHOLE_BAND;

  const { min, max } = extents;
  const fullHeight = max.y - min.y;
  const width = max.x - min.x;
  const depth = max.z - min.z;

  const target: Vec3 = {
    x: (min.x + max.x) / 2,
    y: min.y + ((yBand.lo + yBand.hi) / 2) * fullHeight,
    z: (min.z + max.z) / 2,
  };

  const bandHeight = fullHeight * (yBand.hi - yBand.lo);
  // 水平範圍：部位段實際跨距（horizExtent>0）優先，否則後備全身 max(X 寬, Z 深)〔任一旋轉皆容納〕。
  const maxHoriz =
    options.horizExtent && options.horizExtent > 0 ? options.horizExtent : Math.max(width, depth);

  const tanHalfFov = Math.tan(fov / 2);
  const radiusVertical = bandHeight / (2 * fillFraction * tanHalfFov);
  const radiusHorizontal = maxHoriz / (2 * fillFraction * tanHalfFov * aspect);
  const radius = Math.max(radiusVertical, radiusHorizontal);

  return { target, radius };
}

/** 縮放比例常數（相對全身框取半徑）。 */
const LOWER_RADIUS_RATIO = 0.05;
const UPPER_RADIUS_RATIO = 1.4;
const MIN_Z_RATIO = 0.01;

/**
 * 由全身框取半徑推算半徑上下限與近裁面，使「縮放至細節＋防飛離」成立。
 */
export function computeRadiusLimits(wholeRadius: number): RadiusLimits {
  return {
    lower: wholeRadius * LOWER_RADIUS_RATIO,
    upper: wholeRadius * UPPER_RADIUS_RATIO,
    minZ: wholeRadius * MIN_Z_RATIO,
  };
}
