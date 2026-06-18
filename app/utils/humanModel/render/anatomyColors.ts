// 解剖型別基底色（04 §4.1/§4.6.3）：2D 檢視器依型別著色，與 3D 一致。
//
// 單一真相＝`infra/asset-pipeline/manifestV1.json` 之 `layerColors`（依型別 10 色；3D 由
// exportGltf 烘焙進 glb 扁平材質）。2D SVG **刻意色彩無關**（設計：app 端依 definitions 驅動著色），
// 故 app 於此鏡射同一組色值供 2D 套用。**與 manifest.layerColors 同步**（anatomyColors.test 釘值防漂移）。
import type { AnatomyEntity } from '@ptapp/shared';

// 型別（manifest「著色層」）→ sRGB hex。鍵＝entity 之色桶（肌肉一律一色、不分深淺；同 manifest layer）。
export const ANATOMY_LAYER_COLORS = {
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
} as const;

export type AnatomyColorKey = keyof typeof ANATOMY_LAYER_COLORS;

// entity → 著色鍵：肌群（muscleGroup）併入 muscle 色桶（同 manifest）；joint 無 mesh→無色。
function colorKeyForType(type: AnatomyEntity['type']): AnatomyColorKey | null {
  if (type === 'muscleGroup') return 'muscle';
  if (type === 'joint') return null;
  return type;
}

// entity → 3D 同型別基底色；無對應色（joint）回 undefined。
export function colorForEntity(entity: AnatomyEntity): string | undefined {
  const key = colorKeyForType(entity.type);
  return key === null ? undefined : ANATOMY_LAYER_COLORS[key];
}
