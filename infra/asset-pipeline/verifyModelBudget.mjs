// app 模型 GLB 三角面預算驗證（exportGltf.py 之後執行）。
// 純 node 解析 GLB（不需 Blender）：讀 JSON chunk、逐 mesh-node 累計三角面
// （indices accessor.count/3；Draco 壓縮下 accessor.count 仍＝解壓後計數，glTF 規範），
// 核對標準資產 ≤5,000k（解3d資產 67 自 900k 上調、見 04 §4.3.6；細節版/精簡版雙 profile 已收斂）。
// 另依 manifest 將 node→layer 彙整 per-layer 三角面，供超標時定位（被動結構/開殼件）。
// glb 為 gitignored 本機產物，clean checkout 無檔屬預期（匯出後驗證工具、非 CI 常駐，
// 比照 verifySystemsExport.mjs）。
//
// 用法：node verifyModelBudget.mjs [models_dir] [manifest_path]
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const modelsDir = process.argv[2] ?? join(HERE, 'out');
const manifestPath = process.argv[3] ?? join(HERE, 'manifestV1.json');

// 04 §4.3.6 標準資產算繪三角面預算（provisional、實測後調整）。
// 上限解3d資產 67 自 900k 上調至 5,000k（使用者持 iOS 實機 FPS、寬裕 headroom 免內容軌續撞牆；
// 現用量 965k 為上限 19%；FPS<25/5s 自動降級為安全網）。full（無損）不受預算約束、不在此稽核。
const BUDGETS = {
  'anatomyV1.glb': { label: 'standard', max: 5000000 },
};

function readGlbJson(path) {
  const buf = readFileSync(path);
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546c67) throw new Error(`非 GLB（magic 0x${magic.toString(16)}）：${path}`);
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
}

// node 名（＝anatomyId、去 Blender .NNN 去重尾碼）→ manifest layer。
function buildLayerByAnatomyId(manifest) {
  const map = new Map();
  for (const e of manifest.entities ?? []) {
    if (e.anatomyId && e.layer) map.set(e.anatomyId, e.layer);
  }
  return map;
}

function anatomyIdOf(nodeName) {
  return nodeName.replace(/\.\d{3}$/, '');
}

// 一 primitive 之三角面：有 indices → count/3；否則 POSITION count/3（皆 TRIANGLES 模式）。
function primitiveTriangles(gltf, prim) {
  const accessors = gltf.accessors ?? [];
  if (typeof prim.indices === 'number') return Math.floor(accessors[prim.indices].count / 3);
  const pos = prim.attributes?.POSITION;
  if (typeof pos === 'number') return Math.floor(accessors[pos].count / 3);
  return 0;
}

function analyze(path, layerByAnatomyId) {
  const gltf = readGlbJson(path);
  const nodes = gltf.nodes ?? [];
  const meshes = gltf.meshes ?? [];
  let total = 0;
  let meshNodes = 0;
  const byLayer = {};
  for (const n of nodes) {
    if (typeof n.mesh !== 'number') continue;
    meshNodes += 1;
    let tris = 0;
    for (const prim of meshes[n.mesh].primitives ?? []) tris += primitiveTriangles(gltf, prim);
    total += tris;
    const layer = layerByAnatomyId.get(anatomyIdOf(n.name ?? '')) ?? '(unknown)';
    byLayer[layer] = (byLayer[layer] ?? 0) + tris;
  }
  return {
    total,
    meshNodes,
    byLayer,
    sizeMb: (readFileSync(path).length / (1024 * 1024)).toFixed(2),
  };
}

function main() {
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : { entities: [] };
  const layerByAnatomyId = buildLayerByAnatomyId(manifest);

  console.log(`== app 模型三角面預算（${modelsDir}）==`);
  let ok = true;
  let anyFound = false;
  for (const [file, budget] of Object.entries(BUDGETS)) {
    const path = join(modelsDir, file);
    if (!existsSync(path)) {
      console.log(`  [缺] ${file}（${budget.label}）`);
      continue;
    }
    anyFound = true;
    const a = analyze(path, layerByAnatomyId);
    const pass = a.total <= budget.max;
    ok = ok && pass;
    const pct = ((a.total / budget.max) * 100).toFixed(1);
    console.log(
      `  ${file}  ${budget.label}  三角面=${a.total} / ${budget.max}（${pct}%）  node=${a.meshNodes}  ${a.sizeMb}MB  ${pass ? 'OK' : '✗ 超標'}`,
    );
    const layers = Object.entries(a.byLayer).sort((x, y) => y[1] - x[1]);
    console.log('    per-layer: ' + layers.map(([l, t]) => `${l}=${t}`).join('  '));
  }

  if (!anyFound) {
    console.log('VERIFY_SKIP 無 glb（先跑 exportGltf.py 並複製至此目錄）');
    process.exit(0);
  }
  if (!ok) {
    console.log('VERIFY_FAIL 三角面超出 §4.3.6 預算');
    process.exit(1);
  }
  console.log('VERIFY_OK 皆在預算內');
}

main();
