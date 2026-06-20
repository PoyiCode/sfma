// 2D SVG ⇄ definitions 一致（anatomyId 三方對應之 **2D 腿**；todo 08 L20）。
// 查核 public/assets2d 之 2dManifest coverage 與三張 SVG 之 data-anatomy-id（"anatomyId@side" / "anatomyId"）
// 之 base 皆為已知 anatomyId、且 coverage 與 SVG 互相一致。與 glTF 腿、manifest 腿合為三方守恆——
// definitions 改名後遺留之孤兒 2D 圖層即被擋下。
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { anatomyEntityById } from '@ptapp/definitions';

const MANIFEST2D = 'public/assets2d/anatomy2dManifest.json';
const SVGS = ['front', 'side', 'back'].map((o) => `public/assets2d/anatomy2d.${o}.svg`);
const basePk = (pk: string): string => pk.split('@')[0]!;

function coverageKeys(): Set<string> {
  const m = JSON.parse(readFileSync(MANIFEST2D, 'utf8')) as { coverage?: Record<string, string[]> };
  const s = new Set<string>();
  for (const arr of Object.values(m.coverage ?? {})) for (const k of arr) s.add(k);
  return s;
}

function svgDataIds(): Set<string> {
  const s = new Set<string>();
  for (const fn of SVGS) {
    for (const m of readFileSync(fn, 'utf8').matchAll(/data-anatomy-id="([^"]+)"/g)) s.add(m[1]!);
  }
  return s;
}

describe('2D SVG ⇄ definitions 一致（3-way 2D 腿；todo 08 L20）', () => {
  const cov = coverageKeys();
  const svg = svgDataIds();

  it('coverage／SVG 非空（健全性）', () => {
    expect(cov.size).toBeGreaterThan(100);
    expect(svg.size).toBeGreaterThan(100);
  });

  it('2dManifest coverage partKey 之 base 皆為已知 anatomyId（無孤兒）', () => {
    const orphan = [...new Set([...cov].map(basePk).filter((b) => !anatomyEntityById.has(b)))];
    expect(orphan, `孤兒 2D coverage: ${orphan.join(', ')}`).toEqual([]);
  });

  it('SVG data-anatomy-id 之 base 皆為已知 anatomyId（無孤兒圖層）', () => {
    const orphan = [...new Set([...svg].map(basePk).filter((b) => !anatomyEntityById.has(b)))];
    expect(orphan, `孤兒 SVG 圖層: ${orphan.join(', ')}`).toEqual([]);
  });

  it('coverage 與 SVG data-anatomy-id 互相一致（無單邊遺漏）', () => {
    expect([...cov].filter((k) => !svg.has(k)).sort(), 'coverage 有但 SVG 無').toEqual([]);
    expect([...svg].filter((k) => !cov.has(k)).sort(), 'SVG 有但 coverage 無').toEqual([]);
  });

  it('joint 不入 2D（功能關節無圖層）', () => {
    const joints = [...cov].map(basePk).filter((b) => anatomyEntityById.get(b)?.type === 'joint');
    expect([...new Set(joints)], `2D 不應含 joint: ${joints.join(', ')}`).toEqual([]);
  });
});
