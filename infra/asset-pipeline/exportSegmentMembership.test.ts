// 節段成員 TS→JSON 橋接測試＋產出（全身 rig+skin 管線 spec §5）：vitest 為唯一可解析
// workspace TS／@ptapp 之 runner（node/tsx/vite-node 皆缺），故於此斷言並側出 out/segmentMembership.json。
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MOVABLE_JOINT_IDS } from '../../app/utils/humanModel/motion/jointKinematics';
import { buildMembershipJson } from './exportSegmentMembership';

const here = dirname(fileURLToPath(import.meta.url));

describe('exportSegmentMembership（節段成員 TS→JSON 橋接）', () => {
  it('每個可動節段皆有陣列鍵', () => {
    const json = buildMembershipJson();
    for (const jid of MOVABLE_JOINT_IDS) expect(Array.isArray(json[jid]), jid).toBe(true);
    expect(Object.keys(json).length).toBe(MOVABLE_JOINT_IDS.length);
  });

  it('已知成員落在正確節段（含 MUSCLE_SEGMENT_OVERRIDE 修正）', () => {
    const json = buildMembershipJson();
    expect(json['joint.hip']).toContain('bone.femur');
    expect(json['joint.hip']).toContain('muscle.vastusLateralis'); // override → 大腿
    expect(json['joint.knee']).toContain('bone.tibia');
    expect(json['joint.knee']).toContain('muscle.soleus'); // override → 小腿
    expect(json['joint.cervicalSpine']).toContain('muscle.orbicularisOculi'); // 表情肌 → 頭頸
  });

  it('成員不跨節段重複', () => {
    const json = buildMembershipJson();
    const seen = new Set<string>();
    for (const ids of Object.values(json)) {
      for (const id of ids) {
        expect(seen.has(id), id).toBe(false);
        seen.add(id);
      }
    }
  });

  it('側出 out/segmentMembership.json 供 bpy 綁定', () => {
    const json = buildMembershipJson();
    const dir = join(here, 'out');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'segmentMembership.json'), JSON.stringify(json, null, 1));
    expect(json['joint.hip'].length).toBeGreaterThan(0);
  });
});
