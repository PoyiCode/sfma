import { describe, expect, it } from 'vitest';
import {
  dragToAngle,
  normalizeDeg,
  planeBasis,
  pointerAngleInPlane,
  type Vec3,
} from './dragRotation';

const KNEE = { min: -5, max: 140 } as const;

describe('normalizeDeg', () => {
  it('收斂至 (−180,180]', () => {
    expect(normalizeDeg(10)).toBe(10);
    expect(normalizeDeg(190)).toBe(-170);
    expect(normalizeDeg(-190)).toBe(170);
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(180)).toBe(180);
    expect(normalizeDeg(-180)).toBe(180);
  });
});

describe('planeBasis', () => {
  it('回傳兩兩正交且與軸正交之單位基底', () => {
    const { u, v } = planeBasis({ x: 0, y: 1, z: 0 });
    const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
    expect(Math.abs(dot(u, { x: 0, y: 1, z: 0 }))).toBeLessThan(1e-9); // u ⟂ axis
    expect(Math.abs(dot(u, v))).toBeLessThan(1e-9); // u ⟂ v
    expect(dot(u, u)).toBeCloseTo(1, 9);
    expect(dot(v, v)).toBeCloseTo(1, 9);
  });
});

describe('pointerAngleInPlane', () => {
  // XZ 平面（法線 +Y）過原點、refDir=+X。
  const PIVOT: Vec3 = { x: 0, y: 0, z: 0 };
  const N: Vec3 = { x: 0, y: 1, z: 0 };
  const REF: Vec3 = { x: 1, y: 0, z: 0 };
  it('射線自上方打中 +X 方向 → 角 0', () => {
    const a = pointerAngleInPlane({ x: 1, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }, PIVOT, N, REF);
    expect(a).not.toBeNull();
    expect(a!).toBeCloseTo(0, 6);
  });
  it('平行平面之射線 → null', () => {
    expect(
      pointerAngleInPlane({ x: 1, y: 5, z: 0 }, { x: 1, y: 0, z: 0 }, PIVOT, N, REF),
    ).toBeNull();
  });
  it('交點在射線後方 → null', () => {
    expect(
      pointerAngleInPlane({ x: 1, y: 5, z: 0 }, { x: 0, y: 1, z: 0 }, PIVOT, N, REF),
    ).toBeNull();
  });
});

describe('dragToAngle', () => {
  it('掃掠 delta 加至起始角、範圍內不觸界', () => {
    // grab=0、current=π/2（+90°），start=0 → 90
    expect(dragToAngle(0, 0, Math.PI / 2, KNEE)).toEqual({ value: 90, atLimit: false });
  });
  it('超界鉗制（膝 max 140）', () => {
    // start=120、delta≈+90 → 210 → 夾 140
    const r = dragToAngle(120, 0, Math.PI / 2, KNEE);
    expect(r.value).toBe(140);
    expect(r.atLimit).toBe(true);
  });
  it('繞圈正規化防跳變（current−grab 越 180）', () => {
    // grab=170°、current=−170°：原始 delta −340° → 正規化 +20°
    const grab = (170 * Math.PI) / 180;
    const cur = (-170 * Math.PI) / 180;
    expect(dragToAngle(0, grab, cur, KNEE).value).toBeCloseTo(20, 6);
  });
  it('sign=-1 反向：正掃掠對應角度遞減', () => {
    // grab=0、current=+90°、start=50、sign=-1 → 50 + (90 × −1) = −40 → 夾於膝 min −5
    const r = dragToAngle(50, 0, Math.PI / 2, KNEE, -1);
    expect(r.value).toBe(-5);
    expect(r.atLimit).toBe(true);
  });
  it('sign=+1 預設與顯式一致', () => {
    expect(dragToAngle(0, 0, Math.PI / 2, KNEE)).toEqual(dragToAngle(0, 0, Math.PI / 2, KNEE, 1));
  });
});
