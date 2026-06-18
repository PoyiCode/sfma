import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { anatomyEntities, anatomyEntityById } from './index';

// 3D 資產管線輸出（infra/asset-pipeline/manifestV1.json）與 app 解剖真相
// （packages/definitions）之靜態一致性守衛——免 Blender／NullEngine、入 pnpm test。
// 為 todo 08 line 36「anatomyId 三方對應」之 definitions⇄3D-manifest 這一腿
// （glTF-node 腿待 NullEngine、2D-SVG 腿待 Stage B）。設計來源：04 §4.6.2／§4.6.3。

interface ManifestEntity {
  anatomyId: string;
  layer: string;
  name: string;
  sourceObject?: string;
  sourceObjects?: string[];
  profiles?: string[];
}

interface ManifestFile {
  entities: ManifestEntity[];
}

// manifest 來源管線層（layerColors 鍵；非 app 顯示層、非 definitions.type）。
const KNOWN_LAYERS: ReadonlySet<string> = new Set([
  'bone',
  'muscle',
  'nerve',
  'ligament',
  'disc',
  'capsule',
  'articularDisc',
  'fascia',
  'bursa',
  'labrum',
]);

// 細節版/精簡版雙 profile 已收斂為單一資產：實體不再帶 profiles 旗標。

// 設計上不建模、故可缺席於 manifest 的 definitions.type：
// joint＝功能關節無 mesh（manifest deferred.functionalJoint）、
// nerve＝部分為 metadata-only 神經（來源 0-poly／無 mesh，manifest note）。
const EXEMPT_TYPES: ReadonlySet<string> = new Set(['joint', 'nerve']);

function sourcesOf(entity: ManifestEntity): string[] {
  if (typeof entity.sourceObject === 'string' && entity.sourceObject.length > 0) {
    return [entity.sourceObject];
  }
  return Array.isArray(entity.sourceObjects) ? entity.sourceObjects : [];
}

// 不變式 1：manifest anatomyId 中 definitions 不認得者（孤兒 3D 節點）。去重、保序。
function findOrphans(manifestIds: Iterable<string>, knownIds: ReadonlySet<string>): string[] {
  const seen = new Set<string>();
  const orphans: string[] = [];
  for (const id of manifestIds) {
    if (!knownIds.has(id) && !seen.has(id)) {
      seen.add(id);
      orphans.push(id);
    }
  }
  return orphans;
}

// 不變式 2：應被建模（type 非豁免）卻缺席於 manifest 之 definitions 實體（無聲漏建模）。
function findUnmodeled(
  defs: readonly { anatomyId: string; type: string }[],
  manifestIds: ReadonlySet<string>,
  exemptTypes: ReadonlySet<string>,
): { anatomyId: string; type: string }[] {
  return defs
    .filter((d) => !exemptTypes.has(d.type) && !manifestIds.has(d.anatomyId))
    .map((d) => ({ anatomyId: d.anatomyId, type: d.type }));
}

// 不變式 3：每筆紀錄結構——anatomyId/layer/name 非空，且 sourceObject xor sourceObjects。
function findStructuralViolations(entities: readonly ManifestEntity[]): string[] {
  const violations: string[] = [];
  entities.forEach((entity, index) => {
    const label = entity.anatomyId || `#${index}`;
    if (!entity.anatomyId) violations.push(`#${index}: 缺 anatomyId`);
    if (!entity.layer) violations.push(`${label}: 缺 layer`);
    if (!entity.name) violations.push(`${label}: 缺 name`);
    const hasSingle = typeof entity.sourceObject === 'string' && entity.sourceObject.length > 0;
    const hasMany = Array.isArray(entity.sourceObjects) && entity.sourceObjects.length > 0;
    if (hasSingle === hasMany) {
      violations.push(`${label}: sourceObject 與 sourceObjects 須恰有其一`);
    }
  });
  return violations;
}

// 不變式 4：layer ∈ 已知層。
function findVocabularyViolations(
  entities: readonly ManifestEntity[],
  knownLayers: ReadonlySet<string>,
): string[] {
  const violations: string[] = [];
  for (const entity of entities) {
    if (!knownLayers.has(entity.layer)) {
      violations.push(`${entity.anatomyId}: 未知 layer "${entity.layer}"`);
    }
  }
  return violations;
}

// 不變式 5：共享同一 anatomyId 的紀錄群在 layer/name 上一致。
function findLayerNameInconsistencies(entities: readonly ManifestEntity[]): string[] {
  const byId = new Map<string, ManifestEntity[]>();
  for (const entity of entities) {
    const group = byId.get(entity.anatomyId) ?? [];
    group.push(entity);
    byId.set(entity.anatomyId, group);
  }
  const violations: string[] = [];
  for (const [anatomyId, group] of byId) {
    if (new Set(group.map((e) => e.layer)).size > 1) {
      violations.push(`${anatomyId}: layer 不一致`);
    }
    if (new Set(group.map((e) => e.name)).size > 1) {
      violations.push(`${anatomyId}: name 不一致`);
    }
  }
  return violations;
}

// 不變式 6：無來源物件被兩個相異 anatomyId 認領（單一資產內不重複指派）。
function findSourceDoubleClaims(entities: readonly ManifestEntity[]): string[] {
  const owner = new Map<string, string>();
  const violations: string[] = [];
  for (const entity of entities) {
    for (const source of sourcesOf(entity)) {
      const existing = owner.get(source);
      if (existing !== undefined && existing !== entity.anatomyId) {
        violations.push(`"${source}": ${existing} 與 ${entity.anatomyId} 重認`);
      } else {
        owner.set(source, entity.anatomyId);
      }
    }
  }
  return violations;
}

const manifest = JSON.parse(
  readFileSync(new URL('../../../infra/asset-pipeline/manifestV1.json', import.meta.url), 'utf8'),
) as ManifestFile;
const manifestEntities = manifest.entities;
const manifestIds = manifestEntities.map((e) => e.anatomyId);
const manifestIdSet = new Set(manifestIds);

describe('manifest ⇄ definitions 一致性（真實資料、04 §4.6.2）', () => {
  it('manifest 與 definitions 皆成功載入（防真空通過）', () => {
    // 錨點：讀錯／空檔會令下方「零違反」斷言假性通過，故先驗實際載到資料。
    expect(manifestEntities.length).toBeGreaterThan(0);
    expect(anatomyEntities.length).toBeGreaterThan(0);
    expect(manifestIdSet.has('bone.humerus')).toBe(true);
    expect(anatomyEntityById.has('bone.humerus')).toBe(true);
  });

  it('無孤兒 3D 節點：每個 manifest anatomyId ∈ definitions', () => {
    const known = new Set(anatomyEntities.map((e) => e.anatomyId));
    expect(findOrphans(manifestIds, known)).toEqual([]);
  });

  it('無無聲未建模：type 非 joint/nerve 之 definitions 實體皆出現於 manifest', () => {
    expect(findUnmodeled(anatomyEntities, manifestIdSet, EXEMPT_TYPES)).toEqual([]);
  });

  it('manifest 結構完整：anatomyId/layer/name 非空且 source 欄 xor', () => {
    expect(findStructuralViolations(manifestEntities)).toEqual([]);
  });

  it('manifest 詞彙合法：layer ∈ 已知層', () => {
    expect(findVocabularyViolations(manifestEntities, KNOWN_LAYERS)).toEqual([]);
  });

  it('細節版/精簡版雙 profile 已收斂：無實體帶 profiles 旗標', () => {
    const withProfiles = manifestEntities.filter((e) => e.profiles !== undefined);
    expect(withProfiles.map((e) => e.anatomyId)).toEqual([]);
  });

  it('同一 anatomyId 群之 layer/name 一致', () => {
    expect(findLayerNameInconsistencies(manifestEntities)).toEqual([]);
  });

  it('無來源物件被相異 anatomyId 重認', () => {
    expect(findSourceDoubleClaims(manifestEntities)).toEqual([]);
  });
});

describe('一致性檢查純函式之牙齒（合成壞資料）', () => {
  it('findOrphans 偵出不在 definitions 之 anatomyId', () => {
    expect(
      findOrphans(['bone.humerus', 'bone.fake', 'bone.fake'], new Set(['bone.humerus'])),
    ).toEqual(['bone.fake']);
  });

  it('findUnmodeled 偵出缺席之非豁免實體、放行 joint/nerve', () => {
    const defs = [
      { anatomyId: 'muscle.fake', type: 'muscle' },
      { anatomyId: 'joint.fake', type: 'joint' },
      { anatomyId: 'nerve.fake', type: 'nerve' },
      { anatomyId: 'bone.real', type: 'bone' },
    ];
    expect(findUnmodeled(defs, new Set(['bone.real']), EXEMPT_TYPES)).toEqual([
      { anatomyId: 'muscle.fake', type: 'muscle' },
    ]);
  });

  it('findStructuralViolations 偵出 source 欄非 xor 與缺欄', () => {
    const neither: ManifestEntity = { anatomyId: 'a', layer: 'bone', name: 'A' };
    const both: ManifestEntity = {
      anatomyId: 'b',
      layer: 'bone',
      name: 'B',
      sourceObject: 'X',
      sourceObjects: ['Y'],
    };
    const ok: ManifestEntity = { anatomyId: 'c', layer: 'bone', name: 'C', sourceObject: 'Z' };
    const violations = findStructuralViolations([neither, both, ok]);
    expect(violations).toContain('a: sourceObject 與 sourceObjects 須恰有其一');
    expect(violations).toContain('b: sourceObject 與 sourceObjects 須恰有其一');
    expect(violations.some((v) => v.startsWith('c:'))).toBe(false);
  });

  it('findVocabularyViolations 偵出未知 layer', () => {
    const entities: ManifestEntity[] = [
      { anatomyId: 'a', layer: 'bogus', name: 'A', sourceObject: 'X' },
      { anatomyId: 'b', layer: 'bone', name: 'B', sourceObject: 'Y' },
    ];
    const violations = findVocabularyViolations(entities, KNOWN_LAYERS);
    expect(violations).toContain('a: 未知 layer "bogus"');
    expect(violations.some((v) => v.startsWith('b:'))).toBe(false);
  });

  it('findLayerNameInconsistencies 偵出同 anatomyId 之矛盾中介資料', () => {
    const entities: ManifestEntity[] = [
      { anatomyId: 'm', layer: 'muscle', name: 'M', sourceObject: 'X' },
      { anatomyId: 'm', layer: 'bone', name: 'M2', sourceObject: 'Y' },
    ];
    const violations = findLayerNameInconsistencies(entities);
    expect(violations).toContain('m: layer 不一致');
    expect(violations).toContain('m: name 不一致');
  });

  it('findSourceDoubleClaims 偵出來源被相異 anatomyId 重認、放行同 anatomyId 共用', () => {
    const clash: ManifestEntity[] = [
      { anatomyId: 'muscle.a', layer: 'muscle', name: 'A', sourceObject: 'Shared' },
      { anatomyId: 'muscle.b', layer: 'muscle', name: 'B', sourceObject: 'Shared' },
    ];
    expect(findSourceDoubleClaims(clash)).toHaveLength(1);

    const sameOwner: ManifestEntity[] = [
      { anatomyId: 'muscle.a', layer: 'muscle', name: 'A', sourceObject: 'Shared' },
      { anatomyId: 'muscle.a', layer: 'muscle', name: 'A', sourceObjects: ['Shared'] },
    ];
    expect(findSourceDoubleClaims(sameOwner)).toEqual([]);
  });
});
