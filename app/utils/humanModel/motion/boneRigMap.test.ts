import { describe, expect, it } from 'vitest';
import skeleton from '../../../../doc/ref/models/makehuman-default-skeleton.json';
import { BONE_RIG_MAP } from './boneRigMap';
import { JOINT_KINEMATICS, MOVABLE_JOINT_IDS, movableJointDof } from './jointKinematics';

const SKEL_BONES = (skeleton as { bones: Record<string, { head: number[] }> }).bones;

describe('BONE_RIG_MAP（骨骼驅動資料表）', () => {
  it('每個可動關節都有對應', () => {
    for (const jid of MOVABLE_JOINT_IDS) {
      expect(BONE_RIG_MAP[jid], jid).toBeDefined();
    }
  });

  it('每關節 DOF 軸集合＝剛性路 JOINT_KINEMATICS、且各對齊 definitions degreesOfFreedom', () => {
    for (const jid of MOVABLE_JOINT_IDS) {
      const boneAxes = Object.keys(BONE_RIG_MAP[jid]!.dofs).sort();
      const rigidAxes = JOINT_KINEMATICS[jid]!.dofs.map((d) => d.axis).sort();
      expect(boneAxes, jid).toEqual(rigidAxes);
      for (const axis of boneAxes) {
        expect(movableJointDof(jid, axis), `${jid}/${axis}`).toBeDefined();
      }
    }
  });

  it('localAxis 為單位主軸、sign ∈ {1,-1}', () => {
    for (const jid of MOVABLE_JOINT_IDS) {
      for (const [axis, m] of Object.entries(BONE_RIG_MAP[jid]!.dofs)) {
        const sq = m.localAxis[0] ** 2 + m.localAxis[1] ** 2 + m.localAxis[2] ** 2;
        expect(sq, `${jid}/${axis} unit`).toBe(1);
        expect([1, -1], `${jid}/${axis} sign`).toContain(m.sign);
      }
    }
  });

  it('bone 名非空且非 anatomyId 形式（不以 bone./joint. 起頭）', () => {
    for (const jid of MOVABLE_JOINT_IDS) {
      const bone = BONE_RIG_MAP[jid]!.bone;
      expect(bone.length, jid).toBeGreaterThan(0);
      expect(bone.startsWith('bone.') || bone.startsWith('joint.'), jid).toBe(false);
    }
  });

  it('每個 bone 名存在於 MakeHuman 預設骨架（雙側補 .L/.R、單側裸名）', () => {
    for (const jid of MOVABLE_JOINT_IDS) {
      const base = BONE_RIG_MAP[jid]!.bone;
      const bilateral = JOINT_KINEMATICS[jid]?.bilateral === true;
      const cands = bilateral ? [`${base}.L`, `${base}.R`] : [base];
      for (const n of cands) expect(SKEL_BONES[n], `${jid}:${n}`).toBeDefined();
    }
  });

  it('joint.spine 代表骨為腰薦最下段脊椎骨（head 最低者，非上段 spine01）', () => {
    // MakeHuman Y-up：head[1] 最小＝最接近骨盆＝腰薦樞紐。
    const spineNames = Object.keys(SKEL_BONES).filter((n) => /^spine\d+$/.test(n));
    const lowest = spineNames.reduce((a, b) =>
      SKEL_BONES[a]!.head[1]! <= SKEL_BONES[b]!.head[1]! ? a : b,
    );
    expect(BONE_RIG_MAP['joint.spine']!.bone).toBe(lowest);
  });

  it('joint.cervicalSpine 代表骨為頸基（neck01）', () => {
    expect(BONE_RIG_MAP['joint.cervicalSpine']!.bone).toBe('neck01');
  });
});
