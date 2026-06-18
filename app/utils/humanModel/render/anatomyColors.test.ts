import { describe, expect, it } from 'vitest';
import type { AnatomyEntity } from '@ptapp/shared';
import { ANATOMY_LAYER_COLORS, colorForEntity } from './anatomyColors';

// 釘值：須與 infra/asset-pipeline/manifestV1.json 之 layerColors 完全一致（3D 同色之單一真相）。
// 任一漂移→此測失敗，提醒同步。
const EXPECTED_LAYER_COLORS = {
  bone: '#E8DEC8',
  muscle: '#B5413B',
  nerve: '#E6C84B',
  ligament: '#2EB8A6',
  disc: '#6B9AC4',
  capsule: '#9B72CF',
  articularDisc: '#7FB069',
  fascia: '#CBC3BE',
  bursa: '#5FC9D6',
  labrum: '#D98C5F',
};

const entity = (type: AnatomyEntity['type']): AnatomyEntity =>
  ({
    schemaVersion: 1,
    anatomyId: `${type}.x`,
    name: { 'zh-TW': 'x', en: 'x' },
    type,
  }) as AnatomyEntity;

describe('anatomyColors（2D 依型別著色、與 3D manifest.layerColors 一致）', () => {
  it('層色釘值與 manifest.layerColors 同步（10 型別）', () => {
    expect(ANATOMY_LAYER_COLORS).toEqual(EXPECTED_LAYER_COLORS);
  });

  it('colorForEntity 依型別回對應色', () => {
    expect(colorForEntity(entity('bone'))).toBe('#E8DEC8');
    expect(colorForEntity(entity('muscle'))).toBe('#B5413B');
    expect(colorForEntity(entity('nerve'))).toBe('#E6C84B');
    expect(colorForEntity(entity('ligament'))).toBe('#2EB8A6');
    expect(colorForEntity(entity('bursa'))).toBe('#5FC9D6');
  });

  it('muscleGroup 併入 muscle 色桶（同 manifest）', () => {
    expect(colorForEntity(entity('muscleGroup'))).toBe(ANATOMY_LAYER_COLORS.muscle);
  });

  it('joint 無 mesh→無色（undefined）', () => {
    expect(colorForEntity(entity('joint'))).toBeUndefined();
  });
});
