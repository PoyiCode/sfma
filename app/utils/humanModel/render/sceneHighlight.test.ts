import { MeshBuilder, NullEngine } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import type { AnnotationHighlights } from '../anatomy/anatomyHighlight';
import { partKey } from '../anatomy/partKey';
import { createModelScene, findMeshByPartKey, type PlaceholderMeshMetadata } from './sceneCore';
import {
  applyHighlights,
  applySelectionHighlight,
  FINDING_OVERLAY_COLOR,
  SELECTION_OVERLAY_COLOR,
} from './sceneHighlight';
import type { AnatomySide } from '../anatomy/partKey';
import type { Scene } from '@babylonjs/core';

// 模擬真實資產之側別 mesh（佔位身體為側別無關後備、不分側；側別 mesh 由 glb #L/#R 經 gltfBinding
// 設 metadata.side——此處直接建帶 side 之 mesh 測選取/高亮之側別分流）。mesh 名＝partKey。
function addSidedMesh(scene: Scene, anatomyId: string, side: AnatomySide | null): void {
  const mesh = MeshBuilder.CreateBox(partKey(anatomyId, side), { size: 1 }, scene);
  const metadata: PlaceholderMeshMetadata = { anatomyId, entityType: 'muscle' };
  if (side !== null) metadata.side = side;
  mesh.metadata = metadata;
}

const BICEPS_L = partKey('muscle.bicepsBrachii', 'left');
const BICEPS_R = partKey('muscle.bicepsBrachii', 'right');
const TRICEPS_L = partKey('muscle.tricepsBrachii', 'left');

describe('sceneHighlight（3D 選取視覺高亮；04 §4.1）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  // 雙側肱二頭肌＋左肱三頭肌（對照）：測側別分流（取消左右群組化）。
  function sidedScene() {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    addSidedMesh(scene, 'muscle.bicepsBrachii', 'left');
    addSidedMesh(scene, 'muscle.bicepsBrachii', 'right');
    addSidedMesh(scene, 'muscle.tricepsBrachii', 'left');
    return scene;
  }

  it('選左只亮左、右側不亮（取消左右群組化）；他部位 false', () => {
    const scene = sidedScene();
    applySelectionHighlight(scene, BICEPS_L);
    expect(findMeshByPartKey(scene, BICEPS_L)?.renderOverlay).toBe(true);
    // ★ 核心：選左肱二頭肌，右側不應高亮 ★
    expect(findMeshByPartKey(scene, BICEPS_R)?.renderOverlay).toBe(false);
    expect(findMeshByPartKey(scene, TRICEPS_L)?.renderOverlay).toBe(false);
  });

  it('改選他側→高亮移轉（前者 false、後者 true）', () => {
    const scene = sidedScene();
    applySelectionHighlight(scene, BICEPS_L);
    applySelectionHighlight(scene, BICEPS_R);
    expect(findMeshByPartKey(scene, BICEPS_L)?.renderOverlay).toBe(false);
    expect(findMeshByPartKey(scene, BICEPS_R)?.renderOverlay).toBe(true);
  });

  it('null → 全部清除高亮', () => {
    const scene = sidedScene();
    applySelectionHighlight(scene, BICEPS_L);
    applySelectionHighlight(scene, null);
    expect(findMeshByPartKey(scene, BICEPS_L)?.renderOverlay).toBe(false);
  });

  it('未知 partKey → 無 mesh 高亮', () => {
    const scene = sidedScene();
    applySelectionHighlight(scene, 'does.not.exist@left');
    expect(findMeshByPartKey(scene, BICEPS_L)?.renderOverlay).toBe(false);
  });

  it('反向高亮（§4.5）：標註命中（partKey）→以 findingType overlay 色高亮、他側不高亮', () => {
    const scene = sidedScene();
    const highlights: AnnotationHighlights = new Map([[BICEPS_L, 'painful']]);
    applyHighlights(scene, null, highlights);
    const bicepsL = findMeshByPartKey(scene, BICEPS_L);
    expect(bicepsL?.renderOverlay).toBe(true);
    expect(bicepsL?.overlayColor.equals(FINDING_OVERLAY_COLOR.painful)).toBe(true);
    expect(findMeshByPartKey(scene, BICEPS_R)?.renderOverlay).toBe(false);
    expect(findMeshByPartKey(scene, TRICEPS_L)?.renderOverlay).toBe(false);
  });

  it('反向高亮（§4.5）：選取優先於標註著色（同 partKey 既選取且標註→accent，非 finding 色）', () => {
    const scene = sidedScene();
    const highlights: AnnotationHighlights = new Map([[BICEPS_L, 'painful']]);
    applyHighlights(scene, BICEPS_L, highlights);
    const bicepsL = findMeshByPartKey(scene, BICEPS_L);
    expect(bicepsL?.renderOverlay).toBe(true);
    expect(bicepsL?.overlayColor.equals(SELECTION_OVERLAY_COLOR)).toBe(true);
    expect(bicepsL?.overlayColor.equals(FINDING_OVERLAY_COLOR.painful)).toBe(false);
  });

  it('反向高亮（§4.5）：清空（無選取＋空 highlights）→ 全部清除', () => {
    const scene = sidedScene();
    applyHighlights(scene, null, new Map([[BICEPS_L, 'dysfunctional']]));
    applyHighlights(scene, null, new Map());
    expect(findMeshByPartKey(scene, BICEPS_L)?.renderOverlay).toBe(false);
  });
});
