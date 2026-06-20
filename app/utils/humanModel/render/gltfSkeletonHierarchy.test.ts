// glTF 骨架階層正確（todo 08 L18）：守護**部署 glb** 之 armature 階層——受驅動骨存在且 FK 鏈完整。
// 階層若於重出時斷裂（如 lowerleg01 不再為 upperleg01 後裔），骨骼驅動 rig 之 FK 即崩、肢段脫節。
// 解析 glb JSON chunk（免 Draco）取 nodes/children/skin。與 gltfNodeConsistency（節點名）互補。
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const GLB = 'public/models/anatomyV1.glb';

interface GlbJson {
  nodes?: { name?: string; children?: number[] }[];
  skins?: { joints: number[] }[];
}
function parseGlb(): GlbJson {
  const buf = readFileSync(GLB);
  const jsonLen = buf.readUInt32LE(12); // chunk0 長度@12、JSON@20
  return JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as GlbJson;
}

describe('glTF 骨架階層正確（todo 08 L18；部署 glb armature FK 鏈）', () => {
  const js = parseGlb();
  const nodes = js.nodes ?? [];
  const idxOf = new Map<string, number>();
  nodes.forEach((n, i) => {
    if (n.name) idxOf.set(n.name, i);
  });
  const parent = new Map<number, number>();
  nodes.forEach((n, i) => {
    for (const c of n.children ?? []) parent.set(c, i);
  });
  const isDescendant = (child: string, ancestor: string): boolean => {
    let i = idxOf.get(child);
    const a = idxOf.get(ancestor);
    if (i === undefined || a === undefined) return false;
    for (let guard = 0; parent.has(i) && guard < 300; guard++) {
      i = parent.get(i)!;
      if (i === a) return true;
    }
    return false;
  };

  it('含 skin 且 joint 數合理（163-bone MakeHuman 骨架）', () => {
    expect((js.skins ?? []).length).toBeGreaterThan(0);
    expect(js.skins![0]!.joints.length).toBeGreaterThan(100);
  });

  it('受驅動骨皆存在（雙側腿/臂＋脊椎/頸代表骨）', () => {
    for (const b of [
      'upperleg01.L',
      'upperleg01.R',
      'lowerleg01.L',
      'lowerleg01.R',
      'foot.L',
      'foot.R',
      'upperarm01.L',
      'upperarm01.R',
      'spine05',
      'neck01',
    ]) {
      expect(idxOf.has(b), `缺骨 ${b}`).toBe(true);
    }
  });

  it('下肢 FK 鏈完整（髖→膝→踝；雙側）', () => {
    for (const s of ['L', 'R']) {
      expect(
        isDescendant(`lowerleg01.${s}`, `upperleg01.${s}`),
        `lowerleg01.${s}⊏upperleg01.${s}`,
      ).toBe(true);
      expect(isDescendant(`foot.${s}`, `lowerleg01.${s}`), `foot.${s}⊏lowerleg01.${s}`).toBe(true);
    }
  });

  it('中軸／上肢 FK 鏈：頸基與上臂皆為腰薦代表骨之後裔（neck01／upperarm01 ⊏ spine05）', () => {
    expect(isDescendant('neck01', 'spine05'), 'neck01⊏spine05').toBe(true);
    expect(isDescendant('upperarm01.L', 'spine05'), 'upperarm01.L⊏spine05').toBe(true);
    expect(isDescendant('upperarm01.R', 'spine05'), 'upperarm01.R⊏spine05').toBe(true);
  });
});
