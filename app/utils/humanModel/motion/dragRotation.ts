// 拖曳旋轉數學（04 §4.3.3 grab-and-turn）：指標投影至關節旋轉平面、量掃掠角、轉鉗制角度。
// 純函式、無 Babylon（向量以 Vec3 表）。node 可測。
import { type ClampResult, type DegreeOfFreedom, clampAngle } from './romClamp';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

const RAD2DEG = 180 / Math.PI;

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function normalize(a: Vec3): Vec3 {
  const l = Math.sqrt(dot(a, a));
  return l > 1e-9 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: 0, z: 0 };
}

// 角度收斂至 (−180, 180]。
export function normalizeDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

// 旋轉平面（法線 axis）之正交單位基底。
export function planeBasis(axis: Vec3): { u: Vec3; v: Vec3 } {
  const n = normalize(axis);
  const ref: Vec3 = Math.abs(n.y) < 0.9 ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  const u = normalize(cross(ref, n));
  const v = cross(n, u);
  return { u, v };
}

// 指標射線與旋轉平面（過 pivot、法線 planeNormal）求交，於平面內以 refDir 為基準量角（弧度）。
// 射線近乎平行平面或交點在後方 → null。
export function pointerAngleInPlane(
  rayOrigin: Vec3,
  rayDir: Vec3,
  pivot: Vec3,
  planeNormal: Vec3,
  refDir: Vec3,
): number | null {
  const n = normalize(planeNormal);
  const denom = dot(rayDir, n);
  if (Math.abs(denom) < 1e-6) return null;
  const t = dot(sub(pivot, rayOrigin), n) / denom;
  if (t < 0) return null;
  const hit: Vec3 = {
    x: rayOrigin.x + rayDir.x * t,
    y: rayOrigin.y + rayDir.y * t,
    z: rayOrigin.z + rayDir.z * t,
  };
  const w = sub(hit, pivot);
  // 平面內基底：u＝refDir 去除法線分量後正規化；v＝n×u。
  const proj = dot(refDir, n);
  const u = normalize(sub(refDir, { x: n.x * proj, y: n.y * proj, z: n.z * proj }));
  const vv = cross(n, u);
  return Math.atan2(dot(w, vv), dot(w, u));
}

// 掃掠角→鉗制角度：自抓取點之角度差（正規化防繞圈）乘 sign 加至起始角、鉗制於 ROM。
// sign 對應 DofAxisMapping.sign（預設 +1）；sign=-1 時正掃掠對應角度遞減（反向 DOF）。
export function dragToAngle(
  startDeg: number,
  grabAngleRad: number,
  currentAngleRad: number,
  dof: Pick<DegreeOfFreedom, 'min' | 'max'>,
  sign: 1 | -1 = 1,
): ClampResult {
  const deltaDeg = normalizeDeg((currentAngleRad - grabAngleRad) * RAD2DEG);
  return clampAngle(dof, startDeg + deltaDeg * sign);
}
