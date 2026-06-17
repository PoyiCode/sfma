// 內容缺口稽核：原始系統 glb（exportSystemsGltf.py 產）vs app 已建模 manifestV1.json。
// 純 node（不需 Blender）：讀 5 系統 glb 之 mesh-node 名（＝原始 Blender 物件名）為「原始已建模」
// 來源集，讀 manifestV1.json 之 sourceObject／sourceObjects 聯集為「app 已消費」集，兩側
// 正規化（去側別／附著後綴）後做集合差，得每系統「原始已有但 app 未納」之缺口。
// 報告驅動未來內容擴張決策；本工具不改 app／manifest／definitions。
//
// glb 為 gitignored 本機產物，clean checkout 無檔屬預期（匯出後分析工具、非 CI 常駐，
// 比照 verifySystemsExport.mjs）。infra 慣例：以執行＋自檢驗證、非 vitest。
//
// 用法：node contentGapAudit.mjs [out_dir] [manifest_path]
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2] ?? join(HERE, 'out');
const manifestPath = process.argv[3] ?? join(HERE, 'manifestV1.json');

// 系統 slug → 顯示名（與 exportSystemsGltf.py SYSTEMS 對齊）。
const SYSTEMS = [
  ['skeletal', '1: Skeletal system'],
  ['muscularInsertions', '2: Muscular insertions'],
  ['joints', '3: Joints'],
  ['muscularSystem', '4: Muscular system'],
  ['nervous', '7: Nervous system & Sense organs'],
];

// 正規化：去 Blender 去重尾碼（.NNN）→ 去側別/附著後綴 token（.l/.r/.el/.e1l/.ol/.or…）
// → 去括號 → lowercase/trim。中線件（Linea alba／Fourth ventricle）無後綴＝單一 base。
function normalizeName(raw) {
  return raw
    .replace(/\.\d{3}$/, '')
    .replace(/\.(?:[eo]\d*)?[lr]$/i, '')
    .replace(/[()]/g, '')
    .toLowerCase()
    .trim();
}

// GLB：12B header ＋ chunk[0]＝JSON（len@12, 資料@20）。
function readGlbJson(path) {
  const buf = readFileSync(path);
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546c67) throw new Error(`非 GLB（magic 0x${magic.toString(16)}）：${path}`);
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
}

// 系統 glb 之 mesh-node 名（typeof n.mesh === 'number'）＝匯出物件名。
function systemSourceNames(path) {
  const gltf = readGlbJson(path);
  return (gltf.nodes ?? []).filter((n) => typeof n.mesh === 'number').map((n) => n.name ?? '');
}

// manifest 全域消費來源（sourceObject XOR sourceObjects）。
function manifestSourceNames(manifest) {
  const names = new Set();
  for (const e of manifest.entities ?? []) {
    if (e.sourceObject) names.add(e.sourceObject);
    if (Array.isArray(e.sourceObjects)) for (const s of e.sourceObjects) names.add(s);
  }
  return names;
}

// 將 raw 名陣列摺成「base → 代表原始名」對照（base 去重、保一代表名供報告樣本）。
function basesWithSample(rawNames) {
  const map = new Map();
  for (const raw of rawNames) {
    const base = normalizeName(raw);
    if (!base) continue;
    if (!map.has(base)) map.set(base, raw);
  }
  return map;
}

function selfCheck(manifestBases, perSystem) {
  const failures = [];
  // 1) 正規化已知案例。
  const cases = [
    ['Humerus.r', 'humerus'],
    ['(Opponens digiti minimi muscle of foot).ol', 'opponens digiti minimi muscle of foot'],
    ['Fibularis brevis muscle.el', 'fibularis brevis muscle'],
    ['Transverse head of adductor hallucis.e1l', 'transverse head of adductor hallucis'],
    ['Linea alba', 'linea alba'],
    ['Fourth ventricle', 'fourth ventricle'],
  ];
  for (const [input, want] of cases) {
    const got = normalizeName(input);
    if (got !== want) failures.push(`normalize("${input}")="${got}" ≠ "${want}"`);
  }
  // 2) 每系統不變式：covered + gap = sourceBases。
  for (const s of perSystem) {
    if (s.coveredCount + s.gapCount !== s.sourceBaseCount) {
      failures.push(
        `${s.slug}：covered(${s.coveredCount})+gap(${s.gapCount}) ≠ sourceBases(${s.sourceBaseCount})`,
      );
    }
  }
  // 3) 已知 covered：humerus 在 manifest bases、且不在 skeletal gap。
  if (!manifestBases.has('humerus')) failures.push('manifest bases 缺 humerus（預期已建模）');
  const skeletal = perSystem.find((s) => s.slug === 'skeletal');
  if (skeletal && skeletal.gapBases.includes('humerus')) {
    failures.push('humerus 不應在 skeletal gap（已建模）');
  }
  // 4) 神經系統：CNS 核團/腦區/腔室為設計性未建模 → gap 應遠多於 covered；
  //    已建模周邊神經（radial nerve）covered、已知 CNS 腔室（fourth ventricle）在 gap。
  const nervous = perSystem.find((s) => s.slug === 'nervous');
  if (nervous) {
    if (nervous.gapCount <= nervous.coveredCount) {
      failures.push(
        `nervous gap(${nervous.gapCount}) 應遠多於 covered(${nervous.coveredCount})（CNS 設計性未建模）`,
      );
    }
    if (!nervous.coveredBases.includes('radial nerve')) {
      failures.push('nervous covered 應含 radial nerve（已建模周邊神經）');
    }
    if (!nervous.gapBases.includes('fourth ventricle')) {
      failures.push('nervous gap 應含 fourth ventricle（CNS 腔室、未建模）');
    }
  }
  // 5) 肌肉附著（Muscular insertions）為已建模肌肉之附著足跡、非新解剖：base 名多與肌肉重疊
  //    → covered 應為多數（> gap），佐證「附著＝肌肉足跡、設計上不另列 app 部位」。
  const insertions = perSystem.find((s) => s.slug === 'muscularInsertions');
  if (insertions && insertions.coveredCount <= insertions.gapCount) {
    failures.push(
      `muscularInsertions covered(${insertions.coveredCount}) 應為多數（> gap ${insertions.gapCount}）：附著足跡多對應已建模肌肉`,
    );
  }
  return failures;
}

function main() {
  if (!existsSync(manifestPath)) {
    console.log(`AUDIT_FAIL 找不到 manifest：${manifestPath}`);
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const manifestRaw = manifestSourceNames(manifest);
  const manifestBaseMap = basesWithSample([...manifestRaw]);
  const manifestBases = new Set(manifestBaseMap.keys());

  console.log(`== 內容缺口稽核（${outDir}）==`);
  console.log(
    `manifest entities=${(manifest.entities ?? []).length} 來源名=${manifestRaw.size} → bases=${manifestBases.size}\n`,
  );

  const perSystem = [];
  let missingFile = false;
  for (const [slug, display] of SYSTEMS) {
    const path = join(outDir, `anatomyFull.${slug}.glb`);
    if (!existsSync(path)) {
      console.log(`  [缺] anatomyFull.${slug}.glb`);
      missingFile = true;
      continue;
    }
    const raw = systemSourceNames(path);
    const baseMap = basesWithSample(raw);
    const gapBases = [];
    const coveredBases = [];
    for (const base of baseMap.keys()) {
      if (manifestBases.has(base)) coveredBases.push(base);
      else gapBases.push(base);
    }
    gapBases.sort();
    coveredBases.sort();
    const entry = {
      slug,
      display,
      rawCount: raw.length,
      sourceBaseCount: baseMap.size,
      coveredCount: coveredBases.length,
      gapCount: gapBases.length,
      coveredBases,
      gapBases,
      gapSamples: gapBases.slice(0, 30).map((b) => baseMap.get(b)),
    };
    perSystem.push(entry);
    console.log(
      `  ${slug.padEnd(18)} raw=${String(entry.rawCount).padStart(4)} bases=${String(
        entry.sourceBaseCount,
      ).padStart(4)} covered=${String(entry.coveredCount).padStart(4)} gap=${String(
        entry.gapCount,
      ).padStart(4)}`,
    );
  }

  const failures = selfCheck(manifestBases, perSystem);
  const totalGap = perSystem.reduce((a, s) => a + s.gapCount, 0);
  const totalSource = perSystem.reduce((a, s) => a + s.sourceBaseCount, 0);
  const totalCovered = perSystem.reduce((a, s) => a + s.coveredCount, 0);
  console.log(
    `\n  合計 bases=${totalSource} covered=${totalCovered} gap=${totalGap}（注：跨系統 base 可重複計數）`,
  );

  const report = {
    note: '內容缺口稽核：原始系統 glb vs app manifestV1.json。base 為去側別/附著後綴正規化名；covered＝被任一 manifest entity 消費（全域）；gap＝原始已建模但 app 未納。',
    outDir,
    manifest: {
      path: manifestPath,
      entities: (manifest.entities ?? []).length,
      sourceNames: manifestRaw.size,
      bases: manifestBases.size,
    },
    systems: perSystem,
    totals: { sourceBases: totalSource, covered: totalCovered, gap: totalGap },
  };
  const jsonPath = join(outDir, 'contentGap.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`  → ${jsonPath}`);

  if (failures.length > 0) {
    console.log('\nAUDIT_FAIL 自檢未過：');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  if (missingFile) {
    console.log('\nAUDIT_FAIL 有系統 glb 缺漏（先跑 exportSystemsGltf.py）');
    process.exit(1);
  }
  console.log('\nAUDIT_OK 自檢通過、報告已產出');
}

main();
