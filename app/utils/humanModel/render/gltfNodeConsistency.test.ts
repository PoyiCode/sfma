// glTF node ⇄ definitions 一致（anatomyId 三方對應之 **glTF 腿**；todo 08 L20）。
// 解析部署 glb 之 node 名（JSON chunk、免 Draco 解碼），以 gltfBinding 之正規化還原 anatomyId、
// 對 definitions 查核。與 manifestConsistency（definitions⇄manifest 腿）、svg2dConsistency（2D 腿）
// 合為 anatomyId 三方守恆——任一處改名/漏網即被擋下。
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { anatomyEntityById } from '@ptapp/definitions';

const GLB = 'public/models/anatomyV1.glb';
const MANIFEST = 'infra/asset-pipeline/manifestV1.json';
// 部署 glb 為 gitignore 之大型二進位資產（見 public/models/README.md）：缺檔時整組跳過，
// 不硬讀致 ENOENT 失敗（此為資產管線守護測試，唯資產就位時有意義）。
const hasGlb = existsSync(GLB);
// 功能關節無幾何；神經多為 0-poly metadata-only（僅部分有 mesh）→ 不要求每一條皆有 node。
const EXEMPT_FROM_MESH = new Set(['joint', 'nerve']);

// 比照 gltfBinding.ts：去 #L/#R 側別尾碼、Blender .NNN 去重尾碼（3+ 位）。
const SIDE = /#([LR])$/;
const DEDUP = /\.\d{3,}$/;
function baseAnatomyId(node: string): string {
  const b = node.replace(SIDE, '');
  if (anatomyEntityById.has(b)) return b;
  const s = b.replace(DEDUP, '');
  return anatomyEntityById.has(s) ? s : b;
}

function glbMeshNodeNames(): string[] {
  const buf = readFileSync(GLB);
  // glb: 12B header；chunk0 = 4B 長度(@12) + 4B 型別(@16) + JSON(@20)。
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8')) as {
    nodes?: { name?: string; mesh?: number }[];
  };
  return (json.nodes ?? [])
    .filter((n) => n.mesh !== undefined && typeof n.name === 'string')
    .map((n) => n.name as string);
}

function manifestAnatomyIds(): string[] {
  const m = JSON.parse(readFileSync(MANIFEST, 'utf8')) as
    | { entities?: { anatomyId: string }[] }
    | { anatomyId: string }[];
  const arr = Array.isArray(m) ? m : (m.entities ?? []);
  return arr.map((e) => e.anatomyId);
}

describe.skipIf(!hasGlb)('glTF node ⇄ definitions 一致（3-way glTF 腿；todo 08 L20）', () => {
  const names = hasGlb ? glbMeshNodeNames() : [];

  it('部署 glb 含 mesh node（健全性）', () => {
    expect(names.length).toBeGreaterThan(300);
  });

  it('每個 mesh node 解析至已知 anatomyId（無孤兒節點，含神經 mesh）', () => {
    const orphans = [...new Set(names.filter((n) => !anatomyEntityById.has(baseAnatomyId(n))))];
    expect(orphans, `孤兒 glTF node（名不對應 definitions）: ${orphans.join(', ')}`).toEqual([]);
  });

  it('每個已建模 non-exempt 實體於 glb 皆有 mesh node（無默默漏網）', () => {
    const glbBases = new Set(names.map(baseAnatomyId));
    const missing = [
      ...new Set(
        manifestAnatomyIds().filter(
          (id) => !EXEMPT_FROM_MESH.has(anatomyEntityById.get(id)?.type ?? '') && !glbBases.has(id),
        ),
      ),
    ];
    expect(missing, `已建模卻無 glb mesh: ${missing.join(', ')}`).toEqual([]);
  });
});
