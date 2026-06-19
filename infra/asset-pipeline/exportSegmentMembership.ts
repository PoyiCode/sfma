// 節段成員 TS→JSON 橋接（全身 rig+skin 管線 spec §5）：把 jointKinematics 之節段成員
// （單一真相）匯出為 { jointId: [anatomyId...] } 供 bpy 綁定讀，避免 Python 重寫成員邏輯而漂移。
// 由 exportSegmentMembership.test.ts 於 vitest 環境呼叫並側出 out/segmentMembership.json。
import { anatomyEntities } from '@ptapp/definitions';
import {
  MOVABLE_JOINT_IDS,
  resolveSegmentMembership,
} from '../../app/utils/humanModel/motion/jointKinematics';

export function buildMembershipJson(): Record<string, string[]> {
  const membership = resolveSegmentMembership(anatomyEntities);
  const out: Record<string, string[]> = {};
  for (const jointId of MOVABLE_JOINT_IDS) out[jointId] = membership.get(jointId) ?? [];
  return out;
}
