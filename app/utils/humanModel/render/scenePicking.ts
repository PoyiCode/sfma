// 3D 部位點選（04 §4.1）：Babylon pick 結果 → anatomyId（§4.6.2 邊界）。純函式、可 NullEngine 測。
import type { AbstractMesh, PickingInfo } from '@babylonjs/core';
import { partKey } from '../anatomy/partKey';
import type { PlaceholderMeshMetadata } from './sceneCore';

export function anatomyIdOfMesh(mesh: AbstractMesh | null | undefined): string | null {
  const metadata = mesh?.metadata as PlaceholderMeshMetadata | null | undefined;
  return metadata?.anatomyId ?? null;
}

export function anatomyIdFromPick(pickInfo: PickingInfo | null | undefined): string | null {
  if (!pickInfo?.hit) return null;
  return anatomyIdOfMesh(pickInfo.pickedMesh);
}

// 側別限定選取鍵（取消左右群組化）：選取/高亮以 partKey 分流左右。命中 mesh 之 metadata
// anatomyId＋side 組為 partKey；中線無 side→key 即 anatomyId。
export function partKeyOfMesh(mesh: AbstractMesh | null | undefined): string | null {
  const metadata = mesh?.metadata as PlaceholderMeshMetadata | null | undefined;
  if (metadata?.anatomyId === undefined) return null;
  return partKey(metadata.anatomyId, metadata.side ?? null);
}

export function partKeyFromPick(pickInfo: PickingInfo | null | undefined): string | null {
  if (!pickInfo?.hit) return null;
  return partKeyOfMesh(pickInfo.pickedMesh);
}

// 點空白判定（§3.3.8）：pick 未命中任何 mesh（含 null/undefined）即視為背景點擊，供清選取。
// 與 metadata 無關：命中無 anatomyId 之 mesh（防禦性，佔位場景無）不視為背景、不誤清選取。
export function isBackgroundPick(pickInfo: PickingInfo | null | undefined): boolean {
  return !pickInfo?.hit;
}
