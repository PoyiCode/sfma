// 節段成員 TS→JSON 橋接（全身 rig+skin 管線 spec §5）：把 jointKinematics 之節段成員
// （單一真相）匯出為 { jointId: [anatomyId...] } 供 bpy 綁定讀，避免 Python 重寫成員邏輯而漂移。
// 由 exportSegmentMembership.test.ts 於 vitest 環境呼叫並側出 out/segmentMembership.json。
import { anatomyEntities } from '@ptapp/definitions';
import {
  JOINT_TO_SEGMENT,
  MOVABLE_JOINT_IDS,
  MUSCLE_SEGMENT_OVERRIDE,
  SEGMENT_TREE,
  type SegmentTreeNode,
  resolveSegmentMembership,
  segmentForMuscle,
} from '../../app/utils/humanModel/motion/jointKinematics';

export function buildMembershipJson(): Record<string, string[]> {
  const membership = resolveSegmentMembership(anatomyEntities);
  const out: Record<string, string[]> = {};
  for (const jointId of MOVABLE_JOINT_IDS) out[jointId] = membership.get(jointId) ?? [];
  return out;
}

export interface BlendPair {
  proximal: string;
  distal: string;
}

function segmentChildren(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  const walk = (node: SegmentTreeNode): void => {
    map[node.jointId] = node.children.map((c) => c.jointId);
    node.children.forEach(walk);
  };
  walk(SEGMENT_TREE);
  return map;
}

// 跨關節肌 blend pair：肌肉之 relatedJoints 觸及其指派節段（最近端/override）之**子節段**者，
// 應於該子關節處於 proximal↔distal 兩骨間位置漸變蒙皮（spike 已驗）。例：股直肌 hip→knee、
// 腓腸肌 knee→ankle。純單關節肌（如臀大肌）不入。供 rigSkin.bind_meshes 用。
export function buildCrossJointBlend(): Record<string, BlendPair> {
  const children = segmentChildren();
  const out: Record<string, BlendPair> = {};
  for (const e of anatomyEntities) {
    if (!e.anatomyId.startsWith('muscle.')) continue;
    const related = e.relatedJoints ?? [];
    const proximal = MUSCLE_SEGMENT_OVERRIDE[e.anatomyId] ?? segmentForMuscle(related);
    if (!proximal) continue;
    const relatedSegs = new Set(
      related.map((j) => JOINT_TO_SEGMENT[j]).filter((s): s is string => Boolean(s)),
    );
    const distal = (children[proximal] ?? []).find((c) => relatedSegs.has(c));
    if (distal) out[e.anatomyId] = { proximal, distal };
  }
  return out;
}
