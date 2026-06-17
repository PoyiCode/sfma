// 解3d資產 61 — 肌群合併產生器（§4.3.5／§4.3.6 終態：精簡版逐肌群、細節版逐肌肉）。
//
// 宣告式 GROUPS（群→成員肌 anatomyId）為單一真相，產出兩處衍生資料（冪等、可重跑）：
//   (1) manifestV1.json：成員肌標 profiles:["detailed"]（僅細節版逐肌肉）、追加群組件
//       profiles:["simplified"]＋sourceObjects join（精簡版併為單一 node）。零管線改動——
//       既有 sourceObjects join（§4.6.3）＋profiles 過濾（解3d資產 58）即達合併。
//   (2) anatomyEntities.json：追加 muscleGroup 實體（供精簡版合併 node 經 gltfBinding 反查、
//       歸 deep/superficialMuscle 顯示層、顯資訊卡）。
//
// 用法：node infra/asset-pipeline/buildMuscleGroups.mjs
//   （無引數；就地改寫上述兩檔。冪等：每次先清除既有 muscleGroup 衍生再重建。）
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, 'manifestV1.json');
const defsPath = join(here, '..', '..', 'packages', 'definitions', 'src', 'anatomyEntities.json');

// 群：id（muscleGroup.*）／zh-TW／en／預設顯示層（superficial 預設顯／deep 預設隱）／成員肌 anatomyId。
// layer＝群之代表顯示層（混層群取臨床最顯著者；精簡版粗化權衡，設計接受）。
const GROUPS = [
  {
    id: 'muscleGroup.armFlexor',
    zh: '上臂屈肌群',
    en: 'Arm flexors',
    layer: 'superficial',
    members: ['muscle.bicepsBrachii', 'muscle.brachialis', 'muscle.coracobrachialis'],
  },
  {
    id: 'muscleGroup.armExtensor',
    zh: '上臂伸肌群',
    en: 'Arm extensors',
    layer: 'superficial',
    members: ['muscle.tricepsBrachii', 'muscle.anconeus'],
  },
  {
    id: 'muscleGroup.forearmFlexor',
    zh: '前臂屈肌群',
    en: 'Forearm flexors',
    layer: 'superficial',
    members: [
      'muscle.flexorCarpiRadialis',
      'muscle.flexorCarpiUlnaris',
      'muscle.palmarisLongus',
      'muscle.pronatorTeres',
      'muscle.flexorDigitorumSuperficialis',
      'muscle.flexorDigitorumProfundus',
      'muscle.flexorPollicisLongus',
      'muscle.pronatorQuadratus',
    ],
  },
  {
    id: 'muscleGroup.forearmExtensor',
    zh: '前臂伸肌群',
    en: 'Forearm extensors',
    layer: 'superficial',
    members: [
      'muscle.extensorCarpiRadialisLongus',
      'muscle.extensorCarpiRadialisBrevis',
      'muscle.extensorCarpiUlnaris',
      'muscle.extensorDigitorum',
      'muscle.extensorDigitiMinimi',
      'muscle.extensorIndicis',
      'muscle.extensorPollicisLongus',
      'muscle.extensorPollicisBrevis',
      'muscle.abductorPollicisLongus',
      'muscle.supinator',
      'muscle.brachioradialis',
    ],
  },
  {
    id: 'muscleGroup.rotatorCuff',
    zh: '旋轉肌袖',
    en: 'Rotator cuff',
    layer: 'deep',
    members: [
      'muscle.supraspinatus',
      'muscle.infraspinatus',
      'muscle.teresMinor',
      'muscle.subscapularis',
    ],
  },
  {
    id: 'muscleGroup.thenar',
    zh: '大魚際肌群',
    en: 'Thenar muscles',
    layer: 'superficial',
    members: [
      'muscle.abductorPollicisBrevis',
      'muscle.flexorPollicisBrevis',
      'muscle.opponensPollicis',
      'muscle.adductorPollicis',
    ],
  },
  {
    id: 'muscleGroup.hypothenar',
    zh: '小魚際肌群',
    en: 'Hypothenar muscles',
    layer: 'superficial',
    members: [
      'muscle.abductorDigitiMinimiManus',
      'muscle.flexorDigitiMinimiManus',
      'muscle.opponensDigitiMinimiManus',
    ],
  },
  {
    id: 'muscleGroup.handInterossei',
    zh: '手部骨間肌群',
    en: 'Hand intrinsic muscles',
    layer: 'deep',
    members: ['muscle.dorsalInterosseiManus', 'muscle.palmarInterossei', 'muscle.lumbricalsManus'],
  },
  {
    id: 'muscleGroup.quadriceps',
    zh: '股四頭肌',
    en: 'Quadriceps',
    layer: 'superficial',
    members: [
      'muscle.rectusFemoris',
      'muscle.vastusLateralis',
      'muscle.vastusMedialis',
      'muscle.vastusIntermedius',
    ],
  },
  {
    id: 'muscleGroup.hamstring',
    zh: '大腿後肌群',
    en: 'Hamstrings',
    layer: 'superficial',
    members: ['muscle.bicepsFemoris', 'muscle.semitendinosus', 'muscle.semimembranosus'],
  },
  {
    id: 'muscleGroup.hipAdductor',
    zh: '髖內收肌群',
    en: 'Hip adductors',
    layer: 'superficial',
    members: [
      'muscle.adductorLongus',
      'muscle.adductorBrevis',
      'muscle.adductorMagnus',
      'muscle.gracilis',
      'muscle.pectineus',
    ],
  },
  {
    id: 'muscleGroup.gluteal',
    zh: '臀肌群',
    en: 'Gluteal muscles',
    layer: 'superficial',
    members: ['muscle.gluteusMaximus', 'muscle.gluteusMedius', 'muscle.gluteusMinimus'],
  },
  {
    id: 'muscleGroup.deepHipRotator',
    zh: '髖深層外旋肌群',
    en: 'Deep hip rotators',
    layer: 'deep',
    members: [
      'muscle.piriformis',
      'muscle.obturatorInternus',
      'muscle.superiorGemellus',
      'muscle.inferiorGemellus',
      'muscle.quadratusFemoris',
      'muscle.obturatorExternus',
    ],
  },
  {
    id: 'muscleGroup.calf',
    zh: '小腿三頭肌',
    en: 'Calf (triceps surae)',
    layer: 'superficial',
    members: ['muscle.gastrocnemius', 'muscle.soleus', 'muscle.plantaris'],
  },
  {
    id: 'muscleGroup.deepPosteriorLeg',
    zh: '小腿後深層肌群',
    en: 'Deep posterior leg muscles',
    layer: 'deep',
    members: [
      'muscle.tibialisPosterior',
      'muscle.flexorDigitorumLongus',
      'muscle.flexorHallucisLongus',
      'muscle.popliteus',
    ],
  },
  {
    id: 'muscleGroup.anteriorLeg',
    zh: '小腿前肌群',
    en: 'Anterior leg muscles',
    layer: 'superficial',
    members: [
      'muscle.tibialisAnterior',
      'muscle.extensorDigitorumLongus',
      'muscle.extensorHallucisLongus',
      'muscle.fibularisTertius',
    ],
  },
  {
    id: 'muscleGroup.fibular',
    zh: '腓骨肌群',
    en: 'Fibular (peroneal) muscles',
    layer: 'superficial',
    members: ['muscle.fibularisLongus', 'muscle.fibularisBrevis'],
  },
  {
    id: 'muscleGroup.footIntrinsic',
    zh: '足部內在肌群',
    en: 'Foot intrinsic muscles',
    layer: 'superficial',
    members: [
      'muscle.abductorHallucis',
      'muscle.flexorDigitorumBrevis',
      'muscle.abductorDigitiMinimiPedis',
      'muscle.extensorDigitorumBrevis',
      'muscle.extensorHallucisBrevis',
      'muscle.quadratusPlantae',
      'muscle.lumbricalsPedis',
      'muscle.flexorHallucisBrevis',
      'muscle.adductorHallucis',
      'muscle.flexorDigitiMinimiPedis',
      'muscle.plantarInterossei',
      'muscle.dorsalInterosseiPedis',
    ],
  },
  {
    id: 'muscleGroup.abdominal',
    zh: '腹部肌群',
    en: 'Abdominal muscles',
    layer: 'superficial',
    members: [
      'muscle.rectusAbdominis',
      'muscle.externalAbdominalOblique',
      'muscle.internalAbdominalOblique',
      'muscle.transversusAbdominis',
    ],
  },
  {
    id: 'muscleGroup.erectorSpinae',
    zh: '豎脊肌群',
    en: 'Erector spinae',
    layer: 'deep',
    members: ['muscle.iliocostalis', 'muscle.longissimus', 'muscle.spinalis'],
  },
  {
    id: 'muscleGroup.transversospinal',
    zh: '橫突棘肌群',
    en: 'Transversospinales',
    layer: 'deep',
    members: ['muscle.multifidus', 'muscle.semispinalis', 'muscle.rotatores'],
  },
  {
    id: 'muscleGroup.rhomboid',
    zh: '菱形肌群',
    en: 'Rhomboids',
    layer: 'deep',
    members: ['muscle.rhomboidMajor', 'muscle.rhomboidMinor'],
  },
  {
    id: 'muscleGroup.serratusPosterior',
    zh: '後鋸肌群',
    en: 'Serratus posterior',
    layer: 'deep',
    members: ['muscle.serratusPosteriorSuperior', 'muscle.serratusPosteriorInferior'],
  },
  {
    id: 'muscleGroup.intercostal',
    zh: '肋間肌群',
    en: 'Intercostal muscles',
    layer: 'deep',
    members: [
      'muscle.externalIntercostal',
      'muscle.internalIntercostal',
      'muscle.innermostIntercostal',
    ],
  },
  {
    id: 'muscleGroup.pelvicFloor',
    zh: '骨盆底肌群',
    en: 'Pelvic floor muscles',
    layer: 'deep',
    members: ['muscle.pubococcygeus', 'muscle.iliococcygeus', 'muscle.coccygeus'],
  },
  {
    id: 'muscleGroup.pectoral',
    zh: '胸肌群',
    en: 'Pectoral muscles',
    layer: 'superficial',
    members: ['muscle.pectoralisMajor', 'muscle.pectoralisMinor'],
  },
  {
    id: 'muscleGroup.splenius',
    zh: '夾肌群',
    en: 'Splenius muscles',
    layer: 'deep',
    members: ['muscle.spleniusCapitis', 'muscle.spleniusColli'],
  },
  {
    id: 'muscleGroup.scalene',
    zh: '斜角肌群',
    en: 'Scalene muscles',
    layer: 'deep',
    members: ['muscle.scalenusAnterior', 'muscle.scalenusMedius', 'muscle.scalenusPosterior'],
  },
  {
    id: 'muscleGroup.prevertebral',
    zh: '椎前肌群',
    en: 'Prevertebral muscles',
    layer: 'deep',
    members: [
      'muscle.longusCapitis',
      'muscle.longusColli',
      'muscle.rectusCapitisAnterior',
      'muscle.rectusCapitisLateralis',
    ],
  },
  {
    id: 'muscleGroup.suprahyoid',
    zh: '舌骨上肌群',
    en: 'Suprahyoid muscles',
    layer: 'superficial',
    members: ['muscle.digastric', 'muscle.mylohyoid', 'muscle.geniohyoid', 'muscle.stylohyoid'],
  },
  {
    id: 'muscleGroup.infrahyoid',
    zh: '舌骨下肌群',
    en: 'Infrahyoid muscles',
    layer: 'superficial',
    members: ['muscle.sternohyoid', 'muscle.sternothyroid', 'muscle.thyrohyoid', 'muscle.omohyoid'],
  },
  {
    id: 'muscleGroup.suboccipital',
    zh: '枕下肌群',
    en: 'Suboccipital muscles',
    layer: 'deep',
    members: [
      'muscle.rectusCapitisPosteriorMajor',
      'muscle.rectusCapitisPosteriorMinor',
      'muscle.obliquusCapitisSuperior',
      'muscle.obliquusCapitisInferior',
    ],
  },
  {
    id: 'muscleGroup.mastication',
    zh: '咀嚼肌群',
    en: 'Muscles of mastication',
    layer: 'superficial',
    members: [
      'muscle.masseter',
      'muscle.temporalis',
      'muscle.medialPterygoid',
      'muscle.lateralPterygoid',
    ],
  },
  {
    id: 'muscleGroup.epicranius',
    zh: '顱頂肌',
    en: 'Epicranius (scalp)',
    layer: 'superficial',
    members: ['muscle.occipitofrontalis', 'muscle.temporoparietalis'],
  },
  {
    id: 'muscleGroup.facialExpression',
    zh: '顏面表情肌群',
    en: 'Muscles of facial expression',
    layer: 'superficial',
    members: [
      'muscle.orbicularisOculi',
      'muscle.corrugatorSupercilii',
      'muscle.procerus',
      'muscle.orbicularisOris',
      'muscle.zygomaticusMajor',
      'muscle.zygomaticusMinor',
      'muscle.levatorLabiiSuperioris',
      'muscle.levatorAnguliOris',
      'muscle.risorius',
      'muscle.depressorAnguliOris',
      'muscle.depressorLabiiInferioris',
      'muscle.mentalis',
      'muscle.nasalis',
      'muscle.depressorSeptiNasi',
      'muscle.buccinator',
    ],
  },
];

// 不分組之大地標肌（兩 profile 皆逐肌顯示）。allowlist 供驗證：每肌須在某群或此清單，
// 否則拋錯（防漏分組/新增肌未歸類）。
const SINGLETONS = new Set([
  'muscle.deltoid',
  'muscle.teresMajor',
  'muscle.sartorius',
  'muscle.iliopsoas',
  'muscle.tensorFasciaeLatae',
  'muscle.quadratusLumborum',
  'muscle.trapezius',
  'muscle.latissimusDorsi',
  'muscle.levatorScapulae',
  'muscle.serratusAnterior',
  'muscle.sternocleidomastoid',
  'muscle.platysma',
  'muscle.diaphragm',
  'muscle.subclavius',
  // 解3d資產 63 補齊之深層小肌（兩 profile 逐肌、未併群；maxTriangles:800 守 detailed 預算）
  'muscle.interspinales',
  'muscle.intertransversarii',
  'muscle.pyramidalis',
  'muscle.transversusThoracis',
  'muscle.adductorMinimus',
]);

const sourcesOf = (e) =>
  e.sourceObjects ? e.sourceObjects : e.sourceObject ? [e.sourceObject] : [];
// 掃描全部來源名取側別尾碼（首源偶缺 .r/.l 尾碼＝源料命名不一致，如左 Iliocostalis colli muscle）。
const sideOf = (e) => {
  for (const s of sourcesOf(e)) {
    if (/\.r$/.test(s)) return 'r';
    if (/\.l$/.test(s)) return 'l';
  }
  return 'mid';
};

// ── manifest 變換 ──────────────────────────────────────────────────────────
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
// 冪等：移除既有 muscleGroup 衍生群組件。
const nonGroup = manifest.entities.filter((e) => !String(e.anatomyId).startsWith('muscleGroup.'));

// 建成員肌 side→entry 索引（僅 layer==='muscle' 之逐肌 entry）。
const byIdSide = new Map(); // anatomyId -> {r,l,mid:entry}
for (const e of nonGroup) {
  if (e.layer !== 'muscle') continue;
  if (!byIdSide.has(e.anatomyId)) byIdSide.set(e.anatomyId, {});
  byIdSide.get(e.anatomyId)[sideOf(e)] = e;
}

const grouped = new Set();
for (const g of GROUPS) for (const m of g.members) grouped.add(m);

// 驗證：每肌須已分組或為 singleton。
const errors = [];
for (const id of byIdSide.keys()) {
  if (!grouped.has(id) && !SINGLETONS.has(id))
    errors.push(`未分類肌肉：${id}（請納入某群或 SINGLETONS）`);
}
// 驗證：每群成員須存在且雙側齊全。
for (const g of GROUPS) {
  for (const m of g.members) {
    const sides = byIdSide.get(m);
    if (!sides) {
      errors.push(`群 ${g.id} 成員不存在：${m}`);
      continue;
    }
    if (!sides.r || !sides.l) errors.push(`群 ${g.id} 成員非雙側：${m}（side r/l 不齊）`);
  }
}
if (errors.length) {
  console.error('BUILD_ERR\n' + errors.join('\n'));
  process.exit(1);
}

// 成員肌標 profiles:["detailed"]；singleton 移除 profiles（兩 profile）。冪等重設。
for (const [id, sides] of byIdSide) {
  for (const e of Object.values(sides)) {
    if (grouped.has(id)) e.profiles = ['detailed'];
    else delete e.profiles;
  }
}

// 追加群組件（每群 .r/.l，profiles:["simplified"]，sourceObjects＝成員該側來源 join）。
const groupEntriesR = [];
const groupEntriesL = [];
for (const g of GROUPS) {
  for (const side of ['r', 'l']) {
    const srcs = [];
    for (const m of g.members) srcs.push(...sourcesOf(byIdSide.get(m)[side]));
    const entry = {
      anatomyId: g.id,
      sourceObjects: srcs,
      layer: 'muscle',
      name: g.en,
      profiles: ['simplified'],
    };
    (side === 'r' ? groupEntriesR : groupEntriesL).push(entry);
  }
}
manifest.entities = [...nonGroup, ...groupEntriesR, ...groupEntriesL];
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

// ── definitions 變換 ──────────────────────────────────────────────────────
const defs = JSON.parse(readFileSync(defsPath, 'utf8'));
const defsNoGroup = defs.filter((e) => !String(e.anatomyId).startsWith('muscleGroup.'));
const groupEntities = GROUPS.map((g) => ({
  schemaVersion: 1,
  anatomyId: g.id,
  type: 'muscleGroup',
  name: { 'zh-TW': g.zh, en: g.en },
  layer: g.layer,
}));
writeFileSync(defsPath, JSON.stringify([...defsNoGroup, ...groupEntities], null, 2) + '\n', 'utf8');

const memberCount = grouped.size;
console.log(
  `BUILD_OK groups=${GROUPS.length} members=${memberCount} singletons=${SINGLETONS.size} ` +
    `manifest.entities=${manifest.entities.length} (groupR=${groupEntriesR.length} groupL=${groupEntriesL.length}) ` +
    `defs=${defsNoGroup.length + groupEntities.length}`,
);
