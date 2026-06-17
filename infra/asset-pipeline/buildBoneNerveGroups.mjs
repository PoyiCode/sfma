// 解3d資產 62 — 骨骼/神經合併產生器（續 61 肌群合併；精簡版區域/神經叢、細節版逐骨/逐神經）。
//
// 同 61 機制（`sourceObjects` join＋`profiles` 過濾）純資料表達合併，但**重用既有 bone/nerve
// minimal 型**（區域即骨、神經叢即神經、`anatomyId prefix === type` 不變量天然滿足）——**零
// schema/App/i18n 程式改動**。宣告式 GROUPS 為單一真相，產出（冪等、可重跑）：
//   (1) manifestV1.json：成員標 `profiles:["detailed"]`、追加群組件 `profiles:["simplified"]`＋
//       `sourceObjects` join；bilateral 群（成員皆 r/l）→ .r/.l 兩 node、single 群（midline/混側）→ 1 node。
//   (2) anatomyEntities.json：追加區域/神經叢 bone/nerve 實體。
// **不觸 muscle/muscleGroup 條目**（與 61 generator 互不干擾、僅處理 layer bone/nerve）。
//
// 完善3D模型 detail（2026-06-17）：detailed 聚合骨（顱骨／椎柱／肋骨／肋軟骨／胸骨／手／足）已拆為
// 逐件個別骨，骨數眾多。故**骨骼區域群改以 `match` 述詞涵蓋逐件**（避免硬列上百骨、且新增個別骨
// 自動歸群）；神經叢群仍逐一列舉。精簡版 super-aggregate 已棄用（simplified 暫用 detailed），此
// generator 保持可重跑、與資料一致，惟其產物僅供歷史精簡管線。
//
// 用法：node infra/asset-pipeline/buildBoneNerveGroups.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, 'manifestV1.json');
const defsPath = join(here, '..', '..', 'packages', 'definitions', 'src', 'anatomyEntities.json');

const short = (id) => id.replace(/^bone\./, '');
const CRANIAL = new Set([
  'frontal',
  'occipital',
  'sphenoid',
  'ethmoid',
  'vomer',
  'parietal',
  'temporal',
  'maxilla',
  'zygomatic',
  'nasal',
  'lacrimal',
  'palatine',
  'inferiorNasalConcha',
]);
const CARPALS = new Set([
  'scaphoid',
  'lunate',
  'triquetrum',
  'pisiform',
  'trapezium',
  'trapezoid',
  'capitate',
  'hamate',
]);
const TARSALS = new Set([
  'talus',
  'calcaneus',
  'navicular',
  'cuboid',
  'medialCuneiform',
  'intermediateCuneiform',
  'lateralCuneiform',
]);

// 骨骼區域群（match 述詞涵蓋逐件個別骨；members 由 manifest 動態計算）。
const BONE_GROUP_DEFS = [
  {
    id: 'bone.upperLimb',
    zh: '上肢骨',
    en: 'Upper limb bones',
    match: (s) =>
      ['scapula', 'clavicle', 'humerus', 'radius', 'ulna'].includes(s) ||
      CARPALS.has(s) ||
      /^metacarpal\d+$/.test(s) ||
      /^hand(Proximal|Middle|Distal)Phalanx\d+$/.test(s),
  },
  {
    id: 'bone.lowerLimb',
    zh: '下肢骨',
    en: 'Lower limb bones',
    match: (s) =>
      ['hip', 'femur', 'tibia', 'fibula', 'patella'].includes(s) ||
      TARSALS.has(s) ||
      /^metatarsal\d+$/.test(s) ||
      /^foot(Proximal|Middle|Distal)Phalanx\d+$/.test(s),
  },
  {
    id: 'bone.thoracicCage',
    zh: '胸廓',
    en: 'Thoracic cage',
    match: (s) =>
      /^rib\d+$/.test(s) ||
      /^costalCartilage\d+$/.test(s) ||
      ['manubrium', 'sternumBody', 'xiphoidProcess'].includes(s),
  },
  {
    id: 'bone.vertebralColumn',
    zh: '脊柱',
    en: 'Vertebral column',
    match: (s) => /^[ctl]\d+$/.test(s) || ['sacrum', 'coccyx'].includes(s),
  },
  {
    id: 'bone.skull',
    zh: '顱骨',
    en: 'Skull',
    match: (s) => CRANIAL.has(s) || ['mandible', 'hyoid'].includes(s),
  },
];

// 神經叢群（逐一列舉成員）。
const NERVE_GROUPS = [
  {
    id: 'nerve.brachialPlexus',
    zh: '臂神經叢',
    en: 'Brachial plexus',
    layer: 'nerve',
    members: [
      'nerve.radial',
      'nerve.ulnar',
      'nerve.musculocutaneous',
      'nerve.median',
      'nerve.axillary',
      'nerve.suprascapular',
      'nerve.subscapular',
    ],
  },
  {
    id: 'nerve.lumbarPlexus',
    zh: '腰神經叢',
    en: 'Lumbar plexus',
    layer: 'nerve',
    members: ['nerve.femoral', 'nerve.obturator'],
  },
  {
    id: 'nerve.sacralPlexus',
    zh: '薦神經叢',
    en: 'Sacral plexus',
    layer: 'nerve',
    members: [
      'nerve.sciatic',
      'nerve.superiorGluteal',
      'nerve.tibial',
      'nerve.deepFibular',
      'nerve.superficialFibular',
    ],
  },
];

// 不分組之 manifest bone/nerve（兩 profile 皆逐件）。拆分後骨皆歸區域群；周邊皮神經分支非三大
// 神經叢成員，保留逐件（singleton）。
const SINGLETONS = new Set([
  'nerve.saphenous',
  'nerve.sural',
  'nerve.lateralFemoralCutaneous',
  'nerve.posteriorFemoralCutaneous',
  'nerve.superficialRadial',
  'nerve.ilioinguinal',
]);

const sourcesOf = (e) =>
  e.sourceObjects ? e.sourceObjects : e.sourceObject ? [e.sourceObject] : [];
const sideOf = (e) => {
  for (const s of sourcesOf(e)) {
    if (/\.r$/.test(s)) return 'r';
    if (/\.l$/.test(s)) return 'l';
  }
  return 'mid';
};

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const boneGroupIds = new Set(BONE_GROUP_DEFS.map((g) => g.id));
const nerveGroupIds = new Set(NERVE_GROUPS.map((g) => g.id));
const groupIds = new Set([...boneGroupIds, ...nerveGroupIds]);

// 冪等：移除既有群組件（本 generator 之 bone/nerve 區域/神經叢 id）。
const base = manifest.entities.filter((e) => !groupIds.has(e.anatomyId));

// 骨骼群成員＝manifest 中逐件個別骨（排除群 id 自身）依 match 述詞動態歸群。
const errors = [];
const individualBoneIds = [
  ...new Set(base.filter((e) => e.layer === 'bone').map((e) => e.anatomyId)),
];
const BONE_GROUPS = BONE_GROUP_DEFS.map((g) => ({
  id: g.id,
  zh: g.zh,
  en: g.en,
  layer: 'bone',
  members: individualBoneIds.filter((id) => g.match(short(id))),
}));
// 每件個別骨須恰好歸入一群（避免漏歸/重歸）。
for (const id of individualBoneIds) {
  const hit = BONE_GROUP_DEFS.filter((g) => g.match(short(id)));
  if (hit.length === 0 && !SINGLETONS.has(id))
    errors.push(`未分類 ${id}（請納入某骨骼群之 match 或 SINGLETONS）`);
  if (hit.length > 1) errors.push(`${id} 重複歸群：${hit.map((g) => g.id).join('/')}`);
}

const GROUPS = [...BONE_GROUPS, ...NERVE_GROUPS];

// 建成員 side→entry 索引（僅本 generator 處理之 layer：bone/nerve）。
const layers = new Set(GROUPS.map((g) => g.layer));
const byIdSide = new Map();
for (const e of base) {
  if (!layers.has(e.layer)) continue;
  if (!byIdSide.has(e.anatomyId)) byIdSide.set(e.anatomyId, {});
  byIdSide.get(e.anatomyId)[sideOf(e)] = e;
}

const grouped = new Set();
for (const g of GROUPS) for (const m of g.members) grouped.add(m);

// 群 id 不得撞既有 entity（避免覆蓋逐件）。
for (const g of GROUPS) if (byIdSide.has(g.id)) errors.push(`群 id 撞既有 entity：${g.id}`);
// 每 manifest bone/nerve entry 須已分組或為 singleton。
for (const id of byIdSide.keys()) {
  if (!grouped.has(id) && !SINGLETONS.has(id))
    errors.push(`未分類 ${id}（請納入某群或 SINGLETONS）`);
}
// 每群成員須存在於 manifest。
for (const g of GROUPS)
  for (const m of g.members) {
    if (!byIdSide.has(m)) errors.push(`群 ${g.id} 成員不存在於 manifest：${m}`);
  }
if (errors.length) {
  console.error('BUILD_ERR\n' + errors.join('\n'));
  process.exit(1);
}

// 成員標 profiles:["detailed"]；singleton 移除 profiles（兩 profile）。冪等重設。
for (const [id, sides] of byIdSide) {
  for (const e of Object.values(sides)) {
    if (grouped.has(id)) e.profiles = ['detailed'];
    else delete e.profiles;
  }
}

// 追加群組件。bilateral 群（成員皆具 r 且 l、無 mid）→ .r/.l 兩 node；否則 single 群 → 1 node（併全來源）。
const groupEntries = [];
for (const g of GROUPS) {
  const memberSides = g.members.map((m) => byIdSide.get(m));
  const isBilateral = memberSides.every((s) => s.r && s.l && !s.mid);
  if (isBilateral) {
    for (const side of ['r', 'l']) {
      const srcs = [];
      for (const s of memberSides) srcs.push(...sourcesOf(s[side]));
      groupEntries.push({
        anatomyId: g.id,
        sourceObjects: srcs,
        layer: g.layer,
        name: g.en,
        profiles: ['simplified'],
      });
    }
  } else {
    // single（midline/混側，如 skull：cranium 僅 .r＋mandible/hyoid midline）→ 併全成員全來源為單一 node。
    const srcs = [];
    for (const s of memberSides) for (const e of Object.values(s)) srcs.push(...sourcesOf(e));
    groupEntries.push({
      anatomyId: g.id,
      sourceObjects: srcs,
      layer: g.layer,
      name: g.en,
      profiles: ['simplified'],
    });
  }
}
manifest.entities = [...base, ...groupEntries];
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

// definitions：追加區域/神經叢實體（重用 bone/nerve minimal 型）。
const defs = JSON.parse(readFileSync(defsPath, 'utf8'));
const defsBase = defs.filter((e) => !groupIds.has(e.anatomyId));
const groupEntities = GROUPS.map((g) => ({
  schemaVersion: 1,
  anatomyId: g.id,
  type: g.layer, // bone | nerve（重用型）
  name: { 'zh-TW': g.zh, en: g.en },
}));
writeFileSync(defsPath, JSON.stringify([...defsBase, ...groupEntities], null, 2) + '\n', 'utf8');

console.log(
  `BUILD_OK groups=${GROUPS.length} members=${grouped.size} singletons=${SINGLETONS.size} ` +
    `groupEntries=${groupEntries.length} manifest.entities=${manifest.entities.length} ` +
    `defs=${defsBase.length + groupEntities.length}`,
);
