import { describe, expect, it } from 'vitest';
import { BONE_RIG_MAP } from './boneRigMap';
import { JOINT_KINEMATICS, MOVABLE_JOINT_IDS, movableJointDof } from './jointKinematics';

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
});
