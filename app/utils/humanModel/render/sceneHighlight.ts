// 3D 視覺高亮（04 §4.1 選取／§4.5 反向標註）：以 mesh overlay 標示部位（renderOverlay＋
// overlayColor）。renderOverlay 由 outlineRenderer 側效模組安裝於 Mesh.prototype（setter 僅
// lazy-load 元件＋存布林、NullEngine 安全）；overlayColor/Alpha 為 AbstractMesh 建構即有。
// 純函式、可 NullEngine 測。
import '@babylonjs/core/Rendering/outlineRenderer';
import { Color3, type Scene } from '@babylonjs/core';
import type { AnnotationFindingType, AnnotationHighlights } from '../anatomy/anatomyHighlight';
import { partKey } from '../anatomy/partKey';
import type { PlaceholderMeshMetadata } from './sceneCore';

// 選取覆蓋色：accent teal-700（#0e7490）；半透明覆蓋不掩蓋形狀。
export const SELECTION_OVERLAY_COLOR = new Color3(14 / 255, 116 / 255, 144 / 255);
const SELECTION_OVERLAY_ALPHA = 0.4;

// 反向標註覆蓋色（§4.5）：對齊 2D／tokens 之臨床語意——painful＝red-clinical #c0392b、
// dysfunctional＝amber-clinical #b26a00、note＝slate-500 #64748b。
export const FINDING_OVERLAY_COLOR: Readonly<Record<AnnotationFindingType, Color3>> = {
  painful: new Color3(192 / 255, 57 / 255, 43 / 255),
  dysfunctional: new Color3(178 / 255, 106 / 255, 0),
  note: new Color3(100 / 255, 116 / 255, 139 / 255),
};
const HIGHLIGHT_OVERLAY_ALPHA = 0.35;

const EMPTY_HIGHLIGHTS: AnnotationHighlights = new Map();

// 合成選取高亮（§4.1）與反向標註高亮（§4.5）：每 mesh 僅一 overlayColor，故**選取優先於標註著色**
// （選取部位顯 accent、忽略其標註色——2D 為描邊＋填色可並存，3D 單 overlay 取捨）。
// 選取＝null 且 highlights 為空即全清。同部位多筆標註之嚴重度取捨由 annotationHighlights 處理。
// selectedKey／highlights 皆以 **partKey**（側別限定）為鍵：選左肱骨僅左肱骨 mesh 亮（取消左右群組化）。
export function applyHighlights(
  scene: Scene,
  selectedKey: string | null,
  highlights: AnnotationHighlights = EMPTY_HIGHLIGHTS,
): void {
  for (const mesh of scene.meshes) {
    const metadata = mesh.metadata as PlaceholderMeshMetadata | null | undefined;
    const anatomyId = metadata?.anatomyId;
    if (anatomyId === undefined) continue;
    const key = partKey(anatomyId, metadata?.side ?? null);
    if (key === selectedKey) {
      mesh.renderOverlay = true;
      mesh.overlayColor = SELECTION_OVERLAY_COLOR;
      mesh.overlayAlpha = SELECTION_OVERLAY_ALPHA;
      continue;
    }
    const finding = highlights.get(key);
    if (finding !== undefined) {
      mesh.renderOverlay = true;
      mesh.overlayColor = FINDING_OVERLAY_COLOR[finding];
      mesh.overlayAlpha = HIGHLIGHT_OVERLAY_ALPHA;
    } else {
      mesh.renderOverlay = false;
    }
  }
}

// 選取高亮薄包裝（§4.1）：等同無反向標註之 applyHighlights。
export function applySelectionHighlight(scene: Scene, selectedKey: string | null): void {
  applyHighlights(scene, selectedKey);
}
