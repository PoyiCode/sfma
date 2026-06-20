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

  it('localAxis（含 localAxisLeft）為單位向量（含校正斜軸）、sign ∈ {1,-1}', () => {
    for (const jid of MOVABLE_JOINT_IDS) {
      for (const [axis, m] of Object.entries(BONE_RIG_MAP[jid]!.dofs)) {
        for (const ax of [m.localAxis, m.localAxisLeft]) {
          if (!ax) continue;
          const sq = ax[0] ** 2 + ax[1] ** 2 + ax[2] ** 2;
          expect(sq, `${jid}/${axis} unit`).toBeCloseTo(1, 4);
        }
        expect([1, -1], `${jid}/${axis} sign`).toContain(m.sign);
      }
    }
  });

  it('下肢校正值（2026-06-20：localAxis=R_rest⁻¹·W 解析推導＋contact sheet 目視確認 sign）', () => {
    const hip = BONE_RIG_MAP['joint.hip']!.dofs;
    expect(hip.flexionExtension).toEqual({ localAxis: [1, 0, 0], sign: -1 });
    expect(hip.abductionAdduction).toEqual({ localAxis: [0, 0, 1], sign: 1 });
    expect(hip.internalExternalRotation).toEqual({ localAxis: [0, 1, 0], sign: -1 });
    expect(BONE_RIG_MAP['joint.knee']!.dofs.flexionExtension).toEqual({
      localAxis: [1, 0, 0],
      sign: 1,
    });
    const ankle = BONE_RIG_MAP['joint.ankle']!.dofs;
    expect(ankle.plantarDorsiflexion).toEqual({ localAxis: [1, 0, 0], sign: -1 });
    // 踝內外翻：斜軸（foot rest 傾斜，bone-local 達成世界 Z 旋轉）＋ +ROM 外翻 → sign=-1
    expect(ankle.inversionEversion!.sign).toBe(-1);
    expect(ankle.inversionEversion!.localAxis[0]).toBe(0);
    expect(ankle.inversionEversion!.localAxis[1]).toBeCloseTo(0.884, 3);
    expect(ankle.inversionEversion!.localAxis[2]).toBeCloseTo(-0.4675, 3);
  });

  it('上肢/軀幹校正值（2026-06-20：解析推導斜軸＋目視確認 sign）', () => {
    const gh = BONE_RIG_MAP['joint.glenohumeral']!.dofs;
    expect(gh.flexionExtension!.sign).toBe(-1);
    expect(gh.abductionAdduction!.sign).toBe(-1);
    expect(gh.internalExternalRotation!.sign).toBe(1);
    // 肩 rest 斜且左右鏡像不對稱 → per-side localAxis（左右 Y 反號）
    expect(gh.flexionExtension!.localAxisLeft).toBeDefined();
    expect(gh.flexionExtension!.localAxis[0]).toBeCloseTo(0.625, 2);
    expect(gh.flexionExtension!.localAxisLeft![1]).toBeCloseTo(
      -gh.flexionExtension!.localAxis[1],
      2,
    );
    // 軀幹/頸：FE 為世界 X（無 left override）；側屈/旋轉為斜軸、sign +1
    const sp = BONE_RIG_MAP['joint.spine']!.dofs;
    expect(sp.flexionExtension).toEqual({ localAxis: [1, 0, 0], sign: 1 });
    expect(sp.lateralFlexion!.sign).toBe(1);
    expect(sp.lateralFlexion!.localAxis[2]).toBeCloseTo(0.883, 2);
    const cv = BONE_RIG_MAP['joint.cervicalSpine']!.dofs;
    expect(cv.flexionExtension).toEqual({ localAxis: [1, 0, 0], sign: 1 });
    expect(cv.rotation!.localAxis[1]).toBeCloseTo(0.926, 2);
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
