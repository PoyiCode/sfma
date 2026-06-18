import type { AnatomyEntity } from '@ptapp/shared';
import { localizeText } from '../../i18n/localizeText';
import { layerOfEntity, type LayerVisibility } from '../anatomy/anatomyLayers';
import { parsePartKey } from '../anatomy/partKey';

// 04 §4.4 標籤系統：標籤顯示模式——全部可見部位／僅目前選取（避免畫面雜亂）。
export const LABEL_MODES = ['all', 'selected'] as const;
export type LabelMode = (typeof LABEL_MODES)[number];
export const DEFAULT_LABEL_MODE: LabelMode = 'selected';

// 一個標籤模型：anatomyId（對應 mesh／SVG 圖層）＋本地化顯示文字（zh-TW 預設、en 回退）。
export interface LabelModel {
  anatomyId: string;
  text: string;
}

export interface ResolveLabelsParams {
  entities: readonly AnatomyEntity[];
  visibility: LayerVisibility;
  hiddenIds: ReadonlySet<string>;
  selectedId: string | null;
  showLabels: boolean;
  mode?: LabelMode;
}

// 決定哪些部位該顯示標籤（04 §4.4，框架無關，2D／3D 共用之單一決策來源）：
// 全域關閉→空；否則僅「分層可見且未被單一隱藏」之部位（mesh 可見規則與
// sceneLayers.applyMeshVisibility 一致——joint layerOfEntity→null 非顯示分層、
// 層面恆顯，但仍可被單一隱藏）；mode='selected' 再縮至目前選取部位（§4.4
// 僅顯示選取以避免雜亂，selectedId=null 或選取部位不可見→空）。
// 順序沿用 entities 輸入順序（與 groupAnatomyIdsByLayer／buildModel2dLayers 一致由呼叫端決定）。
export function resolveVisibleLabels({
  entities,
  visibility,
  hiddenIds,
  selectedId,
  showLabels,
  mode = DEFAULT_LABEL_MODE,
}: ResolveLabelsParams): LabelModel[] {
  if (!showLabels) return [];
  // selectedId 為 partKey（`anatomyId@side`，取消左右群組化）；標籤側別無關（一部位一標籤）→
  // 以其 anatomyId 比對（否則雙側部位 anatomyId!==partKey 恆不等、selected 模式永不顯標籤）。
  const selectedAnatomyId = selectedId === null ? null : parsePartKey(selectedId).anatomyId;
  const labels: LabelModel[] = [];
  for (const entity of entities) {
    const layer = layerOfEntity(entity);
    const layerVisible = layer === null ? true : visibility[layer];
    if (!layerVisible) continue;
    if (hiddenIds.has(entity.anatomyId)) continue;
    if (mode === 'selected' && entity.anatomyId !== selectedAnatomyId) continue;
    labels.push({ anatomyId: entity.anatomyId, text: localizeText(entity.name) });
  }
  return labels;
}
