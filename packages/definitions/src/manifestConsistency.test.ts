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

// LOD profile（detailed＝個別部位、simplified＝合併 muscleGroup）。
const RENDER_PROFILES = ['detailed', 'simplified'] as const;
const KNOWN_PROFILES: ReadonlySet<string> = new Set(RENDER_PROFILES);

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

// profiles 缺席／空＝出現於所有 profile（預設）；否則僅列出之 profile。
function inProfile(entity: ManifestEntity, profile: string): boolean {
  const { profiles } = entity;
  return !Array.isArray(profiles) || profiles.length === 0 || profiles.includes(profile);
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

// 不變式 4：layer ∈ 已知層、profile token ∈ 已知 profile。
function findVocabularyViolations(
  entities: readonly ManifestEntity[],
  knownLayers: ReadonlySet<string>,
  knownProfiles: ReadonlySet<string>,
): string[] {
  const violations: string[] = [];
  for (const entity of entities) {
    if (!knownLayers.has(entity.layer)) {
      violations.push(`${entity.anatomyId}: 未知 layer "${entity.layer}"`);
    }
    for (const profile of entity.profiles ?? []) {
      if (!knownProfiles.has(profile)) {
        violations.push(`${entity.anatomyId}: 未知 profile "${profile}"`);
      }
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

// 不變式 6：逐 profile，無來源物件被兩個相異 anatomyId 認領（同一 LOD 內不重複指派）。
// 跨 profile 同一 mesh 可對應不同 anatomyId（detailed→個別肌、simplified→群），故必逐 profile。
function findSourceDoubleClaims(entities: readonly ManifestEntity[], profile: string): string[] {
  const owner = new Map<string, string>();
  const violations: string[] = [];
  for (const entity of entities) {
    if (!inProfile(entity, profile)) continue;
    for (const source of sourcesOf(entity)) {
      const existing = owner.get(source);
      if (existing !== undefined && existing !== entity.anatomyId) {
        violations.push(`[${profile}] "${source}": ${existing} 與 ${entity.anatomyId} 重認`);
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

  it('manifest 詞彙合法：layer ∈ 已知層、profile ∈ 已知 profile', () => {
    expect(findVocabularyViolations(manifestEntities, KNOWN_LAYERS, KNOWN_PROFILES)).toEqual([]);
  });

  it('同一 anatomyId 群之 layer/name 一致', () => {
    expect(findLayerNameInconsistencies(manifestEntities)).toEqual([]);
  });

  it('逐 profile 無來源物件被相異 anatomyId 重認', () => {
    for (const profile of RENDER_PROFILES) {
      expect(findSourceDoubleClaims(manifestEntities, profile)).toEqual([]);
    }
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

  it('findVocabularyViolations 偵出未知 layer/profile', () => {
    const entities: ManifestEntity[] = [
      { anatomyId: 'a', layer: 'bogus', name: 'A', sourceObject: 'X' },
      { anatomyId: 'b', layer: 'bone', name: 'B', sourceObject: 'Y', profiles: ['medium'] },
    ];
    const violations = findVocabularyViolations(entities, KNOWN_LAYERS, KNOWN_PROFILES);
    expect(violations).toContain('a: 未知 layer "bogus"');
    expect(violations).toContain('b: 未知 profile "medium"');
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

  it('findSourceDoubleClaims 偵出同 profile 內重認、放行跨 profile 共用', () => {
    const sameProfile: ManifestEntity[] = [
      {
        anatomyId: 'muscle.a',
        layer: 'muscle',
        name: 'A',
        sourceObject: 'Shared',
        profiles: ['detailed'],
      },
      {
        anatomyId: 'muscle.b',
        layer: 'muscle',
        name: 'B',
        sourceObject: 'Shared',
        profiles: ['detailed'],
      },
    ];
    expect(findSourceDoubleClaims(sameProfile, 'detailed')).toHaveLength(1);

    const crossProfile: ManifestEntity[] = [
      {
        anatomyId: 'muscle.a',
        layer: 'muscle',
        name: 'A',
        sourceObject: 'Shared',
        profiles: ['detailed'],
      },
      {
        anatomyId: 'muscleGroup.g',
        layer: 'muscle',
        name: 'G',
        sourceObjects: ['Shared'],
        profiles: ['simplified'],
      },
    ];
    expect(findSourceDoubleClaims(crossProfile, 'detailed')).toEqual([]);
    expect(findSourceDoubleClaims(crossProfile, 'simplified')).toEqual([]);
  });
});
