// glTF 載入橋接（04 §4.6.2/§4.6.4）：載入之 glTF mesh node 名＝anatomyId 但無 metadata；
// 以 anatomyEntityById 反查補上 PlaceholderMeshMetadata，使真實幾何流入既有 picking/
// layers/highlight 邊界（與 buildPlaceholderBody 一致）。純函式、NullEngine 可測。
import type { Scene } from '@babylonjs/core';
import { anatomyEntityById } from '@ptapp/definitions';
import type { AnatomyEntity } from '@ptapp/shared';
import type { AnatomySide } from '../anatomy/partKey';
import type { PlaceholderMeshMetadata } from './sceneCore';

// 側別節點尾碼（解3d資產：取消左右群組化）：成對部位匯出為 `<anatomyId>#L`／`#R`，
// 兩側名相異故 Blender 不再 dedup 群組化；gltfBinding 解析還原 anatomyId（側別無關）＋side。
const SIDE_SUFFIX = /#([LR])$/;
// Blender 物件名唯一性尾碼（`.001`…）：殘留情形（中線單件理應無）仍去之還原 anatomyId。
const BLENDER_DEDUP_SUFFIX = /\.\d{3,}$/;

// 解析 glTF node 名 → 解剖實體（側別無關）＋side。先剝 `#L/#R` 取 side，再精確比對；
// 未中則去 Blender `.NNN` 尾碼重查一次（lookup-first 確保末段數字不誤判、限數字不誤剝 `.foo`）。
function resolveNode(nodeName: string): { entity?: AnatomyEntity; side: AnatomySide | null } {
  let base = nodeName;
  let side: AnatomySide | null = null;
  const sideMatch = base.match(SIDE_SUFFIX);
  if (sideMatch) {
    side = sideMatch[1] === 'L' ? 'left' : 'right';
    base = base.slice(0, base.length - sideMatch[0].length);
  }
  let entity = anatomyEntityById.get(base);
  if (entity === undefined) {
    const stripped = base.replace(BLENDER_DEDUP_SUFFIX, '');
    if (stripped !== base) entity = anatomyEntityById.get(stripped);
  }
  return { entity, side };
}

export function bindAnatomyMetadata(scene: Scene): string[] {
  const bound: string[] = [];
  for (const mesh of scene.meshes) {
    const { entity, side } = resolveNode(mesh.name);
    if (entity === undefined) continue;
    const metadata: PlaceholderMeshMetadata = {
      anatomyId: entity.anatomyId,
      entityType: entity.type,
    };
    if (entity.type === 'muscle') metadata.layer = entity.layer;
    // 成對部位 side 來自 #L/#R；中線無尾碼→side null（metadata 不設）。
    if (side !== null) metadata.side = side;
    mesh.metadata = metadata;
    bound.push(entity.anatomyId);
  }
  return bound;
}
