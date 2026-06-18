import { describe, expect, it } from 'vitest';
import {
  CAMERA_REGION_KEYS,
  computeFraming,
  computeRadiusLimits,
  DEFAULT_CAMERA_REGION,
  horizontalExtentInBand,
  type MeshBounds,
  REGION_Y_BANDS,
  type Extents,
} from './sceneCameraFraming';

// 直立人形包圍盒：寬 1（X）、高 1.8（Y）、深 0.6（Z），腳底 y=0、頭頂 y=1.8。
const HUMAN: Extents = { min: { x: -0.5, y: 0, z: -0.3 }, max: { x: 0.5, y: 1.8, z: 0.3 } };
const FOV = 0.8;

describe('computeFraming（自適應框取；04 §4.3.2）', () => {
  it('target＝包圍盒中心（whole：Y 中點置中）', () => {
    const { target } = computeFraming(HUMAN, { aspect: 1, fov: FOV, fillFraction: 0.7 });
    expect(target.x).toBeCloseTo(0, 6);
    expect(target.y).toBeCloseTo(0.9, 6);
    expect(target.z).toBeCloseTo(0, 6);
  });

  it('radius 使全身高佔 fill＝0.7（人形高瘦：垂直主導）', () => {
    const { radius } = computeFraming(HUMAN, { aspect: 1, fov: FOV, fillFraction: 0.7 });
    // radius_v = 1.8 / (2·0.7·tan(0.4)) = 3.041
    expect(radius).toBeCloseTo(3.041, 2);
  });

  it('頭頂投影至 85%、腳底 15%（head 85/feet 15 驗算）', () => {
    const { target, radius } = computeFraming(HUMAN, { aspect: 1, fov: FOV, fillFraction: 0.7 });
    const halfViewWorld = radius * Math.tan(FOV / 2); // 視口垂直半幅（世界單位）
    // 投影分數＝0.5 ± (世界偏移 / 全視口高)；頭頂偏移＝max.y−target.y。
    const headFraction = 0.5 + (HUMAN.max.y - target.y) / (2 * halfViewWorld);
    const feetFraction = 0.5 + (HUMAN.min.y - target.y) / (2 * halfViewWorld);
    expect(headFraction).toBeCloseTo(0.85, 4);
    expect(feetFraction).toBeCloseTo(0.15, 4);
  });

  it('窄直式（aspect<1）水平主導：radius 增大以容寬度', () => {
    const wide = computeFraming(HUMAN, { aspect: 1, fov: FOV, fillFraction: 0.7 });
    const portrait = computeFraming(HUMAN, { aspect: 0.5, fov: FOV, fillFraction: 0.7 });
    // aspect 0.5：radius_h = 1.0/(2·0.7·tan(0.4)·0.5) = 3.379 > radius_v 3.041 → 水平主導
    expect(portrait.radius).toBeCloseTo(3.379, 2);
    expect(portrait.radius).toBeGreaterThan(wide.radius);
  });

  it('yBand 區段：target.y 移至該段中心（region-ready）', () => {
    // 頭段 yBand 0.85–1.0 → 中心 0.925 × 1.8 = 1.665
    const { target } = computeFraming(HUMAN, {
      aspect: 1,
      fov: FOV,
      fillFraction: 0.7,
      yBand: { lo: 0.85, hi: 1.0 },
    });
    expect(target.y).toBeCloseTo(1.665, 6);
  });
});

describe('REGION_Y_BANDS（部位視角；需求 3）', () => {
  it('四部位鍵齊備、預設為 whole', () => {
    expect(CAMERA_REGION_KEYS).toEqual(['whole', 'head', 'chestAbdomen', 'hipLegs']);
    expect(DEFAULT_CAMERA_REGION).toBe('whole');
  });

  it('whole＝全段 {0,1}', () => {
    expect(REGION_Y_BANDS.whole).toEqual({ lo: 0, hi: 1 });
  });

  it('各段皆在 [0,1] 內、lo＜hi', () => {
    for (const key of CAMERA_REGION_KEYS) {
      const band = REGION_Y_BANDS[key];
      expect(band.lo).toBeGreaterThanOrEqual(0);
      expect(band.hi).toBeLessThanOrEqual(1);
      expect(band.lo).toBeLessThan(band.hi);
    }
  });

  it('三實體部位連續且自下而上覆蓋全身（hipLegs→chestAbdomen→head）', () => {
    expect(REGION_Y_BANDS.hipLegs.lo).toBeCloseTo(0, 6);
    expect(REGION_Y_BANDS.hipLegs.hi).toBeCloseTo(REGION_Y_BANDS.chestAbdomen.lo, 6);
    expect(REGION_Y_BANDS.chestAbdomen.hi).toBeCloseTo(REGION_Y_BANDS.head.lo, 6);
    expect(REGION_Y_BANDS.head.hi).toBeCloseTo(1, 6);
  });

  it('套 head band：target.y 上移至頭段、radius 較 whole 小（拉近至頭部）', () => {
    const HUMAN: Extents = { min: { x: -0.5, y: 0, z: -0.3 }, max: { x: 0.5, y: 1.8, z: 0.3 } };
    const whole = computeFraming(HUMAN, {
      aspect: 1,
      fov: 0.8,
      fillFraction: 0.7,
      yBand: REGION_Y_BANDS.whole,
    });
    const head = computeFraming(HUMAN, {
      aspect: 1,
      fov: 0.8,
      fillFraction: 0.7,
      yBand: REGION_Y_BANDS.head,
    });
    expect(head.target.y).toBeGreaterThan(whole.target.y);
    expect(head.radius).toBeLessThan(whole.radius);
  });
});

describe('horizontalExtentInBand（部位段水平範圍；部位框取精修）', () => {
  // 寬臀（低 Y、X 寬 2）＋窄頭（高 Y、X 窄 0.4）。
  const HIPS: MeshBounds = { minX: -1, maxX: 1, minY: 0, maxY: 1, minZ: -0.4, maxZ: 0.4 };
  const HEAD: MeshBounds = { minX: -0.2, maxX: 0.2, minY: 1.6, maxY: 2, minZ: -0.2, maxZ: 0.2 };
  const BOUNDS = [HIPS, HEAD];

  it('無重疊段回 0（呼叫端後備全身）', () => {
    expect(horizontalExtentInBand(BOUNDS, 1.1, 1.5)).toBe(0);
    expect(horizontalExtentInBand([], 0, 1)).toBe(0);
  });

  it('涵蓋全身＝全身水平跨距（寬臀主導）', () => {
    // X 跨距 [-1,1]=2、Z 跨距 [-0.4,0.4]=0.8 → 取大者 2
    expect(horizontalExtentInBand(BOUNDS, 0, 2)).toBeCloseTo(2, 6);
  });

  it('頭段＝僅頭水平跨距（窄、不含臀寬）', () => {
    // 頭段 [1.6,2]：僅 HEAD 重疊 → X 跨距 0.4
    expect(horizontalExtentInBand(BOUNDS, 1.6, 2)).toBeCloseTo(0.4, 6);
  });

  it('straddle（跨段邊界之件）計入全寬', () => {
    const TALL: MeshBounds = { minX: -1.5, maxX: 1.5, minY: 0, maxY: 2, minZ: 0, maxZ: 0 };
    // 頭段僅 [1.6,2]，但 TALL 橫跨故計入其全寬 3
    expect(horizontalExtentInBand([TALL], 1.6, 2)).toBeCloseTo(3, 6);
  });

  it('取 X 跨距與 Z 跨距較大者', () => {
    const DEEP: MeshBounds = { minX: -0.5, maxX: 0.5, minY: 0, maxY: 1, minZ: -2, maxZ: 2 };
    // X 跨距 1、Z 跨距 4 → 4
    expect(horizontalExtentInBand([DEEP], 0, 1)).toBeCloseTo(4, 6);
  });
});

describe('computeFraming horizExtent（部位段水平覆寫）', () => {
  const HUMAN: Extents = { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 2, z: 1 } };

  it('提供窄 horizExtent：水平主導時半徑較全身小（直式 aspect）', () => {
    // 直式 aspect 0.5 使水平主導；頭段 yBand 高瘦、bandHeight 小
    const opts = { aspect: 0.5, fov: 0.8, fillFraction: 0.7, yBand: REGION_Y_BANDS.head };
    const fullBody = computeFraming(HUMAN, opts); // 後備全身水平＝max(2,2)=2
    const bandAware = computeFraming(HUMAN, { ...opts, horizExtent: 0.4 }); // 頭段窄水平
    expect(bandAware.radius).toBeLessThan(fullBody.radius);
  });

  it('未提供 horizExtent：沿用全身 max(寬,深)（向後相容）', () => {
    const opts = { aspect: 1, fov: 0.8, fillFraction: 0.7 };
    const a = computeFraming(HUMAN, opts);
    const b = computeFraming(HUMAN, { ...opts, horizExtent: 0 }); // 0＝視為未提供、後備
    expect(b.radius).toBeCloseTo(a.radius, 6);
  });
});

describe('computeRadiusLimits（縮放至細節＋防飛離）', () => {
  it('lower 遠小於 whole radius（可深縮放至細節）、upper 略超、minZ 隨尺度', () => {
    const { lower, upper, minZ } = computeRadiusLimits(3.041);
    expect(lower).toBeCloseTo(3.041 * 0.05, 4);
    expect(upper).toBeCloseTo(3.041 * 1.4, 4);
    expect(minZ).toBeCloseTo(3.041 * 0.01, 4);
    expect(lower).toBeLessThan(3.041); // 可拉進至遠小於全身框取半徑
  });
});
