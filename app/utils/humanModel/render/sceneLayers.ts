// 3D 可見性（04 §4.1）：合成分層開關與單一部位隱藏 → 每 mesh setEnabled。
// 可見＝該層為開（joint 為 ROM 結構參考、非顯示分層、視為恆顯）且未被單一隱藏。
import type { Scene } from '@babylonjs/core';
import { anatomyEntityById } from '@ptapp/definitions';
import { type AnatomyLayerKey, layerOfEntity } from '../anatomy/anatomyLayers';
import { partKey } from '../anatomy/partKey';
import type { PlaceholderMeshMetadata } from './sceneCore';

export function applyMeshVisibility(
  scene: Scene,
  visibility: Readonly<Record<AnatomyLayerKey, boolean>>,
  hiddenIds: ReadonlySet<string>,
): void {
  for (const mesh of scene.meshes) {
    const metadata = mesh.metadata as PlaceholderMeshMetadata | null | undefined;
    const anatomyId = metadata?.anatomyId;
    if (anatomyId === undefined) continue;
    const entity = anatomyEntityById.get(anatomyId);
    if (entity === undefined) continue;
    const layer = layerOfEntity(entity);
    const layerVisible = layer === null ? true : visibility[layer];
    // 分層為側別無關（左右同層一起開關）；單一隱藏為側別敏感（以 partKey 比對、只藏該側）。
    const key = partKey(anatomyId, metadata?.side ?? null);
    mesh.setEnabled(layerVisible && !hiddenIds.has(key));
  }
}
