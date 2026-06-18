import { MeshBuilder, NullEngine, type Scene } from '@babylonjs/core';
import { AdvancedDynamicTexture } from '@babylonjs/gui';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createModelScene } from './sceneCore';
import type { LabelModel } from './sceneLabels';
import { createLabelLayer } from './labelLayer';

// Babylon GUI 需 canvas／2D context（NullEngine 不可建）→ mock 輕量假類驗綁定編排。
vi.mock('@babylonjs/gui', () => {
  class MockControl {
    name: string;
    constructor(name = '') {
      this.name = name;
    }
  }
  class MockTextBlock extends MockControl {
    text: string;
    constructor(name = '', text = '') {
      super(name);
      this.text = text;
    }
  }
  class MockRectangle extends MockControl {
    children: MockControl[] = [];
    linkedMesh: unknown = null;
    linkOffsetYInPixels = 0;
    adaptWidthToChildren = false;
    adaptHeightToChildren = false;
    thickness = 1;
    isHitTestVisible = true;
    addControl(c: MockControl) {
      this.children.push(c);
      return this;
    }
    linkWithMesh(m: unknown) {
      this.linkedMesh = m;
      return this;
    }
  }
  class MockAdvancedDynamicTexture {
    controls: MockControl[] = [];
    disposed = false;
    // 名稱須對齊 Babylon 真實靜態 API（PascalCase）；呼叫端傳之引數 JS 自動忽略。
    // eslint-disable-next-line @typescript-eslint/naming-convention
    static CreateFullscreenUI() {
      return new MockAdvancedDynamicTexture();
    }
    addControl(c: MockControl) {
      this.controls.push(c);
      return this;
    }
    removeControl(c: MockControl) {
      this.controls = this.controls.filter((x) => x !== c);
      return this;
    }
    getControlByName(n: string) {
      return this.controls.find((c) => c.name === n) ?? null;
    }
    dispose() {
      this.disposed = true;
    }
  }
  return {
    AdvancedDynamicTexture: MockAdvancedDynamicTexture,
    Rectangle: MockRectangle,
    TextBlock: MockTextBlock,
  };
});

interface MockRect {
  name: string;
  linkedMesh: unknown;
  background?: string;
  color?: string;
  children: { text: string; color?: string }[];
}
interface MockAdt {
  controls: MockRect[];
  disposed: boolean;
  getControlByName(n: string): MockRect | null;
}

const L = (anatomyId: string, text: string): LabelModel => ({ anatomyId, text });

describe('labelLayer（3D 標籤 Babylon GUI 綁定 §4.4）', () => {
  let engine: NullEngine;
  let scene: Scene;

  beforeEach(() => {
    engine = new NullEngine();
    scene = createModelScene(engine);
  });
  afterEach(() => {
    engine.dispose();
    vi.restoreAllMocks();
  });

  function makeMeshes() {
    MeshBuilder.CreateBox('muscle.bicepsBrachii', { size: 1 }, scene);
    MeshBuilder.CreateBox('bone.humerus', { size: 1 }, scene);
  }
  function spyCreate() {
    return vi.spyOn(AdvancedDynamicTexture, 'CreateFullscreenUI');
  }
  function adtFrom(spy: ReturnType<typeof spyCreate>): MockAdt {
    return spy.mock.results[0]!.value as unknown as MockAdt;
  }

  it('建立：CreateFullscreenUI 以 scene 建全螢幕疊層', () => {
    const spy = spyCreate();
    createLabelLayer(scene);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]![2]).toBe(scene);
  });

  it('sync：每標籤一控制（命名 label:<id>／連結 mesh／文字）', () => {
    makeMeshes();
    const spy = spyCreate();
    const layer = createLabelLayer(scene);
    const adt = adtFrom(spy);
    layer.sync([L('muscle.bicepsBrachii', '肱二頭肌'), L('bone.humerus', '肱骨')]);
    expect(adt.controls).toHaveLength(2);
    const rect = adt.getControlByName('label:muscle.bicepsBrachii');
    expect(rect).toBeTruthy();
    expect(rect?.linkedMesh).toBe(scene.getMeshByName('muscle.bicepsBrachii'));
    expect(rect?.children[0]?.text).toBe('肱二頭肌');
  });

  it('sync：雙側 mesh 名為 <id>#L/#R（取消左右群組化）→ 以 metadata.anatomyId 尋得並連結（getMeshByName 找不到亦顯標籤）', () => {
    // 模擬 glb 載入後之雙側 mesh：名帶 #L/#R、metadata.anatomyId 為側別無關 id。
    const left = MeshBuilder.CreateBox('bone.fibula#L', { size: 1 }, scene);
    left.metadata = { anatomyId: 'bone.fibula', side: 'left' };
    const right = MeshBuilder.CreateBox('bone.fibula#R', { size: 1 }, scene);
    right.metadata = { anatomyId: 'bone.fibula', side: 'right' };
    expect(scene.getMeshByName('bone.fibula')).toBeNull(); // 裸名找不到（前 bug 致無標籤）
    const spy = spyCreate();
    const layer = createLabelLayer(scene);
    const adt = adtFrom(spy);
    layer.sync([L('bone.fibula', '腓骨')]);
    const rect = adt.getControlByName('label:bone.fibula');
    expect(rect).toBeTruthy();
    // 連結任一側（皆 enabled→取首個）之 mesh。
    expect([left, right]).toContain(rect?.linkedMesh);
  });

  it('sync：mesh 不存在則略過（補套會再同步）', () => {
    const spy = spyCreate();
    const layer = createLabelLayer(scene);
    const adt = adtFrom(spy);
    layer.sync([L('muscle.bicepsBrachii', '肱二頭肌')]); // 尚無 mesh
    expect(adt.controls).toHaveLength(0);
  });

  it('re-sync：更新文字並重用控制（不重複建立）', () => {
    makeMeshes();
    const spy = spyCreate();
    const layer = createLabelLayer(scene);
    const adt = adtFrom(spy);
    layer.sync([L('muscle.bicepsBrachii', '肱二頭肌')]);
    const rect1 = adt.getControlByName('label:muscle.bicepsBrachii');
    layer.sync([L('muscle.bicepsBrachii', '二頭肌（改）')]);
    expect(adt.controls).toHaveLength(1);
    expect(adt.getControlByName('label:muscle.bicepsBrachii')).toBe(rect1);
    expect(rect1?.children[0]?.text).toBe('二頭肌（改）');
  });

  it('re-sync：移除已不在集合之過時控制', () => {
    makeMeshes();
    const spy = spyCreate();
    const layer = createLabelLayer(scene);
    const adt = adtFrom(spy);
    layer.sync([L('muscle.bicepsBrachii', '肱二頭肌'), L('bone.humerus', '肱骨')]);
    layer.sync([L('muscle.bicepsBrachii', '肱二頭肌')]);
    expect(adt.controls).toHaveLength(1);
    expect(adt.getControlByName('label:bone.humerus')).toBeNull();
  });

  it('dispose：釋放 texture', () => {
    const spy = spyCreate();
    const layer = createLabelLayer(scene);
    const adt = adtFrom(spy);
    layer.dispose();
    expect(adt.disposed).toBe(true);
  });

  it('套 token 樣式（注入 readVar）：text 色／rect 底色／邊框取自 CSS 變數（§3.7.6）', () => {
    makeMeshes();
    const vars: Record<string, string> = {
      '--color-text': '#101010',
      '--color-surface': '#f8f8f8',
      '--color-border': '#dadada',
    };
    const spy = spyCreate();
    const layer = createLabelLayer(scene, (name) => vars[name] ?? '');
    const adt = adtFrom(spy);
    layer.sync([L('muscle.bicepsBrachii', '肱二頭肌')]);
    const rect = adt.getControlByName('label:muscle.bicepsBrachii');
    expect(rect?.background).toBe('#f8f8f8');
    expect(rect?.color).toBe('#dadada');
    expect(rect?.children[0]?.color).toBe('#101010');
  });

  it('預設 readVar 於無 DOM 環境套後備樣式、不崩', () => {
    makeMeshes();
    const spy = spyCreate();
    const layer = createLabelLayer(scene); // 預設 readVar：node 無 document → 後備
    const adt = adtFrom(spy);
    layer.sync([L('bone.humerus', '肱骨')]);
    const rect = adt.getControlByName('label:bone.humerus');
    expect(rect?.background).toBeTruthy();
    expect(rect?.children[0]?.color).toBeTruthy();
  });
});
