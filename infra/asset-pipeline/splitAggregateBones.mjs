// 一次性轉換：把 detailed 聚合骨拆為個別骨（完善3D模型 detail；不再 join、每件獨立）。
// 單一真相 = 此腳本之命名表；同時改 manifestV1.json（join entry → 逐來源物件 entry、雙側帶 side）
// 與 anatomyEntities.json（聚合實體 → 個別 bone 實體）。執行後以 definitions/manifestConsistency 測驗。
// 用法：node infra/asset-pipeline/splitAggregateBones.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const MANIFEST = 'infra/asset-pipeline/manifestV1.json';
const DEFS = 'packages/definitions/src/anatomyEntities.json';

const ZH_NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
const FINGER = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
const ORD_EN = [
  '',
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
  'Eleventh',
  'Twelfth',
];

// 去側尾碼 .l/.r/.ol/.or → {base, side}
function splitSide(name) {
  const m = name.match(/^(.*?)\.(o?[lr])$/i);
  if (!m) return { base: name, side: null };
  return { base: m[1], side: /r$/i.test(m[2]) ? 'right' : 'left' };
}

// 顯式命名表（不規則骨）：base source name → {id, zh, en}
const TABLE = {
  // 椎骨
  'Atlas (C1)': { id: 'bone.c1', zh: '寰椎（第一頸椎）', en: 'Atlas (C1)' },
  'Axis (C2)': { id: 'bone.c2', zh: '樞椎（第二頸椎）', en: 'Axis (C2)' },
  Sacrum: { id: 'bone.sacrum', zh: '薦骨', en: 'Sacrum' },
  Coccyx: { id: 'bone.coccyx', zh: '尾骨', en: 'Coccyx' },
  // 胸骨
  'Manubrium of sternum': { id: 'bone.manubrium', zh: '胸骨柄', en: 'Manubrium of sternum' },
  'Body of sternum': { id: 'bone.sternumBody', zh: '胸骨體', en: 'Body of sternum' },
  'Xiphoid process': { id: 'bone.xiphoidProcess', zh: '劍突', en: 'Xiphoid process' },
  // 腕骨
  'Scaphoid bone': { id: 'bone.scaphoid', zh: '舟狀骨', en: 'Scaphoid bone' },
  'Lunate bone': { id: 'bone.lunate', zh: '月狀骨', en: 'Lunate bone' },
  'Triquetrum bone': { id: 'bone.triquetrum', zh: '三角骨', en: 'Triquetrum bone' },
  'Pisiform bone': { id: 'bone.pisiform', zh: '豌豆骨', en: 'Pisiform bone' },
  'Trapezium bone': { id: 'bone.trapezium', zh: '大多角骨', en: 'Trapezium bone' },
  'Trapezoid bone': { id: 'bone.trapezoid', zh: '小多角骨', en: 'Trapezoid bone' },
  'Capitate bone': { id: 'bone.capitate', zh: '頭狀骨', en: 'Capitate bone' },
  'Hamate bone': { id: 'bone.hamate', zh: '鉤骨', en: 'Hamate bone' },
  // 跗骨
  Talus: { id: 'bone.talus', zh: '距骨', en: 'Talus' },
  Calcaneus: { id: 'bone.calcaneus', zh: '跟骨', en: 'Calcaneus' },
  'Navicular bone': { id: 'bone.navicular', zh: '足舟狀骨', en: 'Navicular bone' },
  'Cuboid bone': { id: 'bone.cuboid', zh: '骰骨', en: 'Cuboid bone' },
  'Medial cuneiform bone': {
    id: 'bone.medialCuneiform',
    zh: '內側楔狀骨',
    en: 'Medial cuneiform bone',
  },
  'Intermediate cuneiform bone': {
    id: 'bone.intermediateCuneiform',
    zh: '中間楔狀骨',
    en: 'Intermediate cuneiform bone',
  },
  'Lateral cuneiform bone': {
    id: 'bone.lateralCuneiform',
    zh: '外側楔狀骨',
    en: 'Lateral cuneiform bone',
  },
};

// 序數詞（大小寫不敏感）→ 數字；找不到回 -1。
function ordNum(w) {
  const c = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  return ORD_EN.indexOf(c);
}

// 規則骨之 pattern 解析（回 {id, zh, en} 或 null）
function patternMap(base) {
  let m;
  if ((m = base.match(/^Vertebra C(\d+)$/)))
    return { id: `bone.c${m[1]}`, zh: `第${ZH_NUM[+m[1]]}頸椎`, en: `C${m[1]} vertebra` };
  if ((m = base.match(/^Vertebra T(\d+)$/)))
    return { id: `bone.t${m[1]}`, zh: `第${ZH_NUM[+m[1]]}胸椎`, en: `T${m[1]} vertebra` };
  if ((m = base.match(/^Vertebra L(\d+)$/)))
    return { id: `bone.l${m[1]}`, zh: `第${ZH_NUM[+m[1]]}腰椎`, en: `L${m[1]} vertebra` };
  if ((m = base.match(/^(\w+) rib$/))) {
    const n = ordNum(m[1]);
    if (n > 0) return { id: `bone.rib${n}`, zh: `第${ZH_NUM[n]}肋骨`, en: `${ORD_EN[n]} rib` };
  }
  if ((m = base.match(/^Costal cartilage of (\w+) rib$/))) {
    const n = ordNum(m[1]);
    if (n > 0)
      return {
        id: `bone.costalCartilage${n}`,
        zh: `第${ZH_NUM[n]}肋軟骨`,
        en: `${ORD_EN[n]} costal cartilage`,
      };
  }
  if ((m = base.match(/^(\w+) metacarpal bone$/))) {
    const n = ordNum(m[1]);
    if (n > 0)
      return {
        id: `bone.metacarpal${n}`,
        zh: `第${ZH_NUM[n]}掌骨`,
        en: `${ORD_EN[n]} metacarpal bone`,
      };
  }
  if ((m = base.match(/^(\w+) metatarsal bone$/))) {
    const n = ordNum(m[1]);
    if (n > 0)
      return {
        id: `bone.metatarsal${n}`,
        zh: `第${ZH_NUM[n]}蹠骨`,
        en: `${ORD_EN[n]} metatarsal bone`,
      };
  }
  if ((m = base.match(/^(Proximal|Middle|Distal) phalanx of (\w+) finger of (hand|foot)$/))) {
    const pos = m[1];
    const f = FINGER[m[2].toLowerCase()];
    const part = m[3];
    if (f) {
      const posZh = pos === 'Proximal' ? '近節' : pos === 'Middle' ? '中節' : '遠節';
      const digitZh = part === 'hand' ? `第${ZH_NUM[f]}指` : `第${ZH_NUM[f]}趾`;
      const boneZh = part === 'hand' ? '指骨' : '趾骨';
      return {
        id: `bone.${part}${pos}Phalanx${f}`,
        zh: `${digitZh}${posZh}${boneZh}`,
        en: `${pos} phalanx of ${m[2]} ${part === 'hand' ? 'finger' : 'toe'}`,
      };
    }
  }
  return null;
}

function resolve(base) {
  return TABLE[base] ?? patternMap(base);
}

const TARGETS = [
  'bone.cervicalVertebrae',
  'bone.thoracicVertebrae',
  'bone.lumbarVertebrae',
  'bone.ribs',
  'bone.costalCartilages',
  'bone.sternum',
  'bone.hand',
  'bone.foot',
];

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
// anatomyEntities.json 為頂層陣列（非 {entities}）。
const defsArr = JSON.parse(readFileSync(DEFS, 'utf8'));

const newManifestEntries = [];
const newDefIds = new Map(); // id -> {zh,en}
let srcCount = 0;
const unresolved = [];

for (const e of manifest.entities) {
  if (!TARGETS.includes(e.anatomyId)) {
    newManifestEntries.push(e);
    continue;
  }
  const src = e.sourceObjects ?? (e.sourceObject ? [e.sourceObject] : []);
  for (const s of src) {
    srcCount += 1;
    const { base, side } = splitSide(s);
    const r = resolve(base);
    if (!r) {
      unresolved.push(s);
      continue;
    }
    const entry = { anatomyId: r.id, sourceObject: s };
    if (side) entry.side = side;
    entry.layer = 'bone';
    entry.name = r.en;
    entry.profiles = ['detailed'];
    newManifestEntries.push(entry);
    newDefIds.set(r.id, { zh: r.zh, en: r.en });
  }
}

if (unresolved.length) {
  console.error('UNRESOLVED source objects:\n' + unresolved.join('\n'));
  process.exit(1);
}

manifest.entities = newManifestEntries;

// definitions：移除聚合實體、加個別骨（dedup 雙側）
let defsOut = defsArr.filter((d) => !TARGETS.includes(d.anatomyId));
const existing = new Set(defsOut.map((d) => d.anatomyId));
let added = 0;
for (const [id, nm] of newDefIds) {
  if (existing.has(id)) continue;
  defsOut.push({
    schemaVersion: 1,
    anatomyId: id,
    type: 'bone',
    name: { 'zh-TW': nm.zh, en: nm.en },
  });
  existing.add(id);
  added += 1;
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
writeFileSync(DEFS, JSON.stringify(defsOut, null, 2) + '\n');

console.log(
  `OK: 來源物件 ${srcCount} → manifest entries; 新增 definitions 個別骨 ${added} 種; manifest entities ${manifest.entities.length}; definitions entities ${defsOut.length}`,
);
