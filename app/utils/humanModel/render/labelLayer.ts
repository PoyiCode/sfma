import type { AbstractMesh, Scene } from '@babylonjs/core';
import { AdvancedDynamicTexture, Rectangle, TextBlock } from '@babylonjs/gui';
import type { LabelModel } from './sceneLabels';
import type { PlaceholderMeshMetadata } from './sceneCore';
import { defaultReadCssVar, resolveLabelStyle } from './labelStyle';

// 04 §4.4 標籤呈現綁定：以 Babylon GUI 全螢幕疊層，每部位一文字標籤跟隨其 mesh。
// 注意：AdvancedDynamicTexture→DynamicTexture 需 canvas／2D context，NullEngine（node／jsdom）
// 不可建（spike 確認）；故單元測以 vi.mock('@babylonjs/gui') 驗編排、Model3DView 以注入
// labelLayerFactory 脫鉤。樣式採極簡——token 驅動樣式（§3.7.6 getComputedStyle 讀同組 CSS 變數）
// 為既有 06 line 47 待項，另案。
export interface LabelLayer {
  // 依目前標籤集合（resolveVisibleLabels 產出）差異同步 GUI 控制項：
  // 移除過時、新增（連結各自 mesh）、既有則更新文字；mesh 未載入則略過（補套會再同步）。
  sync(labels: readonly LabelModel[]): void;
  dispose(): void;
}

const RECT_PREFIX = 'label:';
const LABEL_OFFSET_Y_PX = -28; // 標籤浮於部位上方
const LABEL_FONT_SIZE_PX = 13;
const LABEL_PADDING_X_PX = 6;
const LABEL_PADDING_Y_PX = 2;
const LABEL_CORNER_RADIUS = 4;
const LABEL_ALPHA = 0.92; // 微透使模型不全被標籤底色遮擋

// 依 anatomyId 尋連結用 mesh：先試同名（佔位／中線無尾碼即中），否則以 metadata.anatomyId
// 比對（涵蓋雙側 `#L/#R` 名）；標籤側別無關→取首個（優先 enabled）之 mesh。
function findMeshForAnatomyId(scene: Scene, anatomyId: string): AbstractMesh | null {
  const direct = scene.getMeshByName(anatomyId);
  if (direct) return direct;
  let fallback: AbstractMesh | null = null;
  for (const mesh of scene.meshes) {
    const metadata = mesh.metadata as PlaceholderMeshMetadata | null | undefined;
    if (metadata?.anatomyId !== anatomyId) continue;
    if (mesh.isEnabled()) return mesh;
    fallback ??= mesh;
  }
  return fallback;
}

export function createLabelLayer(
  scene: Scene,
  readCssVar: (name: string) => string = defaultReadCssVar,
): LabelLayer {
  const texture = AdvancedDynamicTexture.CreateFullscreenUI('humanModelLabels', true, scene);
  // §3.7.6：掛載時讀一次 semantic token，使標籤色彩與 DOM 主題一致（深淺色適配）。
  // 限制：session 中切換主題不即時重著色（重建檢視即更新）。
  const style = resolveLabelStyle(readCssVar);
  const controls = new Map<string, { rect: Rectangle; text: TextBlock }>();

  function sync(labels: readonly LabelModel[]): void {
    const nextIds = new Set(labels.map((label) => label.anatomyId));
    for (const [anatomyId, control] of controls) {
      if (!nextIds.has(anatomyId)) {
        texture.removeControl(control.rect);
        controls.delete(anatomyId);
      }
    }
    for (const label of labels) {
      // 取消左右群組化後，雙側 mesh 名為 `<anatomyId>#L/#R`→getMeshByName(anatomyId) 找不到；
      // 改以 metadata.anatomyId 尋（涵蓋 #L/#R、佔位無尾碼則 getMeshByName 即中）。標籤側別無關
      // →連結任一側（優先可見）之 mesh。
      const mesh = findMeshForAnatomyId(scene, label.anatomyId);
      if (!mesh) continue; // 幾何尚未載入／已移除：略過（補套於載入後再同步）
      const existing = controls.get(label.anatomyId);
      if (existing) {
        existing.text.text = label.text;
        continue;
      }
      const rect = new Rectangle(RECT_PREFIX + label.anatomyId);
      rect.adaptWidthToChildren = true;
      rect.adaptHeightToChildren = true;
      rect.isHitTestVisible = false; // 標籤不攔截部位點選
      // §3.7.6 token 樣式：底色／邊框取 semantic 變數、與 DOM 主題一致。
      rect.background = style.background;
      rect.color = style.border;
      rect.thickness = 1;
      rect.cornerRadius = LABEL_CORNER_RADIUS;
      rect.alpha = LABEL_ALPHA;
      rect.paddingLeftInPixels = LABEL_PADDING_X_PX;
      rect.paddingRightInPixels = LABEL_PADDING_X_PX;
      rect.paddingTopInPixels = LABEL_PADDING_Y_PX;
      rect.paddingBottomInPixels = LABEL_PADDING_Y_PX;
      const text = new TextBlock(`${RECT_PREFIX}${label.anatomyId}:text`, label.text);
      text.color = style.color;
      text.fontSizeInPixels = LABEL_FONT_SIZE_PX;
      text.resizeToFit = true;
      rect.addControl(text);
      texture.addControl(rect);
      rect.linkWithMesh(mesh);
      rect.linkOffsetYInPixels = LABEL_OFFSET_Y_PX;
      controls.set(label.anatomyId, { rect, text });
    }
  }

  function dispose(): void {
    texture.dispose();
    controls.clear();
  }

  return { sync, dispose };
}
