// 原始系統 glb 匯出完整性驗證（exportSystemsGltf.py 之後執行）。
// 純 node 解析 glb（不需 Blender）：讀 GLB JSON chunk、計 node 數與 mesh-node 數
// （node.mesh 有值＝一個幾何實例≈一個匯出物件），核對 master＝5 系統之聯集（無遺漏／無重複）。
// glb 為 gitignored 本機產物，clean checkout 無檔屬預期（此為匯出後驗證工具，非 CI 常駐）。
//
// 用法：node verifySystemsExport.mjs [out_dir]
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SYSTEM_SLUGS = ['skeletal', 'muscularInsertions', 'joints', 'muscularSystem', 'nervous'];
const outDir = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), 'out');

// GLB：12B header（magic／version／length）＋ chunk[0]＝JSON（len@12, type@16, 資料@20）。
function readGlbJson(path) {
  const buf = readFileSync(path);
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546c67) throw new Error(`非 GLB（magic 0x${magic.toString(16)}）：${path}`);
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.toString('utf8', 20, 20 + jsonLen));
}

function stats(path) {
  const gltf = readGlbJson(path);
  const nodes = gltf.nodes ?? [];
  const meshNodes = nodes.filter((n) => typeof n.mesh === 'number');
  const sizeMb = (readFileSync(path).length / (1024 * 1024)).toFixed(1);
  return {
    nodes: nodes.length,
    meshNodes: meshNodes.length,
    meshes: (gltf.meshes ?? []).length,
    sizeMb,
    sampleNames: meshNodes.slice(0, 5).map((n) => n.name ?? '(unnamed)'),
  };
}

function main() {
  let ok = true;
  let systemMeshTotal = 0;
  console.log(`== 原始系統 glb 完整性（${outDir}）==`);
  for (const slug of SYSTEM_SLUGS) {
    const path = join(outDir, `anatomyFull.${slug}.glb`);
    if (!existsSync(path)) {
      console.log(`  [缺] anatomyFull.${slug}.glb`);
      ok = false;
      continue;
    }
    const s = stats(path);
    systemMeshTotal += s.meshNodes;
    console.log(
      `  ${slug.padEnd(18)} meshNodes=${s.meshNodes} nodes=${s.nodes} meshes=${s.meshes} ${s.sizeMb}MB  e.g. ${s.sampleNames.join(', ')}`,
    );
  }

  const masterPath = join(outDir, 'anatomyFull.master.glb');
  if (!existsSync(masterPath)) {
    console.log('  [缺] anatomyFull.master.glb');
    console.log('VERIFY_FAIL master 不存在');
    process.exit(1);
  }
  const m = stats(masterPath);
  console.log(
    `  ${'master'.padEnd(18)} meshNodes=${m.meshNodes} nodes=${m.nodes} meshes=${m.meshes} ${m.sizeMb}MB`,
  );

  // master mesh-node 數應＝5 系統 mesh-node 總和（聯集無遺漏、無跨系統重複）。
  console.log(
    `\n  per-system mesh-node 總和 = ${systemMeshTotal}；master mesh-node = ${m.meshNodes}`,
  );
  if (m.meshNodes !== systemMeshTotal) {
    console.log(`VERIFY_FAIL master(${m.meshNodes}) ≠ 系統總和(${systemMeshTotal})`);
    process.exit(1);
  }
  if (!ok) {
    console.log('VERIFY_FAIL 有系統 glb 缺漏');
    process.exit(1);
  }
  console.log(`VERIFY_OK 6 檔齊備、master mesh-node＝系統總和(${systemMeshTotal})`);
}

main();
