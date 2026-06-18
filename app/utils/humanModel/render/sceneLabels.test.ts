import { describe, expect, it } from 'vitest';
import type { AnatomyEntity } from '@ptapp/shared';
import { DEFAULT_LAYER_VISIBILITY, type LayerVisibility } from '../anatomy/anatomyLayers';
import { DEFAULT_LABEL_MODE, LABEL_MODES, resolveVisibleLabels } from './sceneLabels';

const BONE: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'bone.humerus',
  name: { 'zh-TW': '肱骨', en: 'Humerus' },
  type: 'bone',
};
const SUPERFICIAL: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'muscle.bicepsBrachii',
  name: { 'zh-TW': '肱二頭肌', en: 'Biceps brachii' },
  type: 'muscle',
  layer: 'superficial',
  symmetry: 'paired',
  relatedJoints: [],
  actions: [],
  innervation: [],
};
const DEEP: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'muscle.brachialis',
  name: { 'zh-TW': '肱肌', en: 'Brachialis' },
  type: 'muscle',
  layer: 'deep',
  symmetry: 'paired',
  relatedJoints: [],
  actions: [],
  innervation: [],
};
const NERVE: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'nerve.radial',
  name: { 'zh-TW': '橈神經', en: 'Radial nerve' },
  type: 'nerve',
};
const JOINT: AnatomyEntity = {
  schemaVersion: 1,
  anatomyId: 'joint.elbow',
  name: { 'zh-TW': '肘關節', en: 'Elbow' },
  type: 'joint',
  degreesOfFreedom: [],
};

const ENTITIES: readonly AnatomyEntity[] = [BONE, SUPERFICIAL, DEEP, NERVE, JOINT];
const ALL_VISIBLE: LayerVisibility = {
  bone: true,
  deepMuscle: true,
  superficialMuscle: true,
  nerve: true,
  passiveStructure: true,
};

function ids(labels: ReturnType<typeof resolveVisibleLabels>): string[] {
  return labels.map((l) => l.anatomyId);
}

describe('sceneLabels（3D 標籤集合決策 §4.4）', () => {
  it('模式常數齊備、預設 selected（僅選取部位、避免雜亂）', () => {
    expect(LABEL_MODES).toEqual(['all', 'selected']);
    expect(DEFAULT_LABEL_MODE).toBe('selected');
  });

  it('showLabels=false → 空（全域關閉）', () => {
    expect(
      resolveVisibleLabels({
        entities: ENTITIES,
        visibility: ALL_VISIBLE,
        hiddenIds: new Set(),
        selectedId: null,
        showLabels: false,
      }),
    ).toEqual([]);
  });

  it("mode='all'：僅分層可見部位（神經預設關排除、深層 issue 2 後預設顯）、joint 納入、text 本地化", () => {
    const labels = resolveVisibleLabels({
      entities: ENTITIES,
      visibility: DEFAULT_LAYER_VISIBILITY,
      hiddenIds: new Set(),
      selectedId: null,
      showLabels: true,
      mode: 'all',
    });
    expect(ids(labels)).toEqual([
      'bone.humerus',
      'muscle.bicepsBrachii',
      'muscle.brachialis',
      'joint.elbow',
    ]);
    expect(labels.find((l) => l.anatomyId === 'muscle.bicepsBrachii')?.text).toBe('肱二頭肌');
    expect(labels.find((l) => l.anatomyId === 'joint.elbow')?.text).toBe('肘關節');
  });

  it('單一隱藏部位排除（即使分層可見）', () => {
    const labels = resolveVisibleLabels({
      entities: ENTITIES,
      visibility: ALL_VISIBLE,
      hiddenIds: new Set(['bone.humerus']),
      selectedId: null,
      showLabels: true,
      mode: 'all',
    });
    expect(ids(labels)).not.toContain('bone.humerus');
    expect(ids(labels)).toContain('muscle.brachialis');
  });

  it('joint 可被單一隱藏（layer null 但 hiddenIds 命中→排除）', () => {
    const labels = resolveVisibleLabels({
      entities: ENTITIES,
      visibility: ALL_VISIBLE,
      hiddenIds: new Set(['joint.elbow']),
      selectedId: null,
      showLabels: true,
      mode: 'all',
    });
    expect(ids(labels)).not.toContain('joint.elbow');
  });

  it("mode='selected'：僅選取部位、餘排除", () => {
    const labels = resolveVisibleLabels({
      entities: ENTITIES,
      visibility: ALL_VISIBLE,
      hiddenIds: new Set(),
      selectedId: 'muscle.bicepsBrachii',
      showLabels: true,
      mode: 'selected',
    });
    expect(ids(labels)).toEqual(['muscle.bicepsBrachii']);
  });

  it("mode='selected'：selectedId 為 partKey（雙側 anatomyId@side）→ 仍對應該 anatomyId 之標籤（取消左右群組化、標籤側別無關）", () => {
    const labels = resolveVisibleLabels({
      entities: ENTITIES,
      visibility: ALL_VISIBLE,
      hiddenIds: new Set(),
      selectedId: 'muscle.bicepsBrachii@left', // 3D 點選上拋之 partKey
      showLabels: true,
      mode: 'selected',
    });
    expect(ids(labels)).toEqual(['muscle.bicepsBrachii']);
  });

  it("mode='selected' 但選取部位分層關 → 空", () => {
    const labels = resolveVisibleLabels({
      entities: ENTITIES,
      visibility: DEFAULT_LAYER_VISIBILITY, // nerve 預設關（深層 issue 2 後預設開、改用神經測層關）
      hiddenIds: new Set(),
      selectedId: 'nerve.radial',
      showLabels: true,
      mode: 'selected',
    });
    expect(labels).toEqual([]);
  });

  it("mode='selected' 且 selectedId=null → 空", () => {
    const labels = resolveVisibleLabels({
      entities: ENTITIES,
      visibility: ALL_VISIBLE,
      hiddenIds: new Set(),
      selectedId: null,
      showLabels: true,
      mode: 'selected',
    });
    expect(labels).toEqual([]);
  });
});
