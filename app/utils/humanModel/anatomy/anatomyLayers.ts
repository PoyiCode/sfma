import type { AnatomyEntity } from '@ptapp/shared';

// 04 §4.1 分層定義：人體模型的五個顯示分層，2D 與 3D 檢視器共用。
// 順序＝骨骼→深層肌群→表層肌群→神經→被動結構，供分層開關 UI 直接列出
// （被動結構＝韌帶＋椎間盤，置末＝由底到面最後疊合）。
export const ANATOMY_LAYER_KEYS = [
  'bone',
  'deepMuscle',
  'superficialMuscle',
  'nerve',
  'passiveStructure',
] as const;
export type AnatomyLayerKey = (typeof ANATOMY_LAYER_KEYS)[number];

// 分層可見性狀態（每層開關布林）；純型別，框架無關之單一真相（hook／renderer／標籤共用）。
export type LayerVisibility = Record<AnatomyLayerKey, boolean>;

// 預設顯示狀態（04 §4.1：骨骼＋深層肌肉＋淺層肌肉顯示、神經隱藏、被動結構隱藏）。
// 神經與被動結構（韌帶／椎間盤／…）預設隱藏＝opt-in，避免恆顯灌入骨架（issue 2／解3d資產 52）。
export const DEFAULT_LAYER_VISIBILITY: Readonly<Record<AnatomyLayerKey, boolean>> = {
  bone: true,
  deepMuscle: true,
  superficialMuscle: true,
  nerve: false,
  passiveStructure: false,
};

// 將解剖實體歸入顯示分層；joint 為 ROM 結構參考、非顯示分層，回傳 null（04 §4.1）。
export function layerOfEntity(entity: AnatomyEntity): AnatomyLayerKey | null {
  switch (entity.type) {
    case 'bone':
      return 'bone';
    // 韌帶／椎間盤／關節囊／關節盤／筋膜／滑囊／關節唇歸專屬「被動結構」顯示層、隨 passiveStructure 開關（預設隱藏、opt-in）；
    // 以 defaultLayers.passiveStructure 選填向後相容免 settings 遷移（解3d資產 52／53／54／58／60／關節內被動結構擴張、04 §4.1）。
    case 'ligament':
      return 'passiveStructure';
    case 'disc':
      return 'passiveStructure';
    case 'capsule':
      return 'passiveStructure';
    case 'articularDisc':
      return 'passiveStructure';
    case 'fascia':
      return 'passiveStructure';
    case 'bursa':
      return 'passiveStructure';
    case 'labrum':
      return 'passiveStructure';
    case 'nerve':
      return 'nerve';
    case 'muscle':
      return entity.layer === 'deep' ? 'deepMuscle' : 'superficialMuscle';
    // 肌群（精簡版肌群合併之選取單位）比照 muscle 依 layer 歸 deep/superficialMuscle 顯示層
    // （隨既有肌群開關顯隱、不另立分層鍵；解3d資產 61）。
    case 'muscleGroup':
      return entity.layer === 'deep' ? 'deepMuscle' : 'superficialMuscle';
    case 'joint':
      return null;
  }
}

// 依顯示分層彙整各層 anatomyId，供 renderer 以 anatomyId 對應 mesh／SVG 圖層；
// 每層皆存在（空層為空陣列），joint 不入任一層（04 §4.1、§4.6.2）。
export function groupAnatomyIdsByLayer(
  entities: readonly AnatomyEntity[],
): Record<AnatomyLayerKey, string[]> {
  const grouped: Record<AnatomyLayerKey, string[]> = {
    bone: [],
    deepMuscle: [],
    superficialMuscle: [],
    nerve: [],
    passiveStructure: [],
  };
  for (const entity of entities) {
    const layer = layerOfEntity(entity);
    if (layer !== null) grouped[layer].push(entity.anatomyId);
  }
  return grouped;
}
