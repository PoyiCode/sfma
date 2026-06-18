import { describe, expect, it } from 'vitest';
import { anatomyEntities, anatomyEntityById } from '@ptapp/definitions';
import {
  JOINT_KINEMATICS,
  MOVABLE_JOINT_IDS,
  movableJointDof,
  resolveSegmentMembership,
  segmentForMuscle,
  SEGMENT_BONES,
} from './jointKinematics';

describe('jointKinematics（運動學表不變式）', () => {
  it('6 個 SFMA 可動關節', () => {
    expect([...MOVABLE_JOINT_IDS].sort()).toEqual(
      [
        'joint.ankle',
        'joint.cervicalSpine',
        'joint.glenohumeral',
        'joint.hip',
        'joint.knee',
        'joint.spine',
      ].sort(),
    );
  });

  it('每個可動關節之 dof.axis 皆對應 definitions 真實 DOF', () => {
    for (const jointId of MOVABLE_JOINT_IDS) {
      const entity = anatomyEntityById.get(jointId);
      expect(entity, jointId).toBeDefined();
      const realAxes = new Set(
        entity!.type === 'joint' ? entity!.degreesOfFreedom.map((d) => d.axis) : [],
      );
      for (const m of JOINT_KINEMATICS[jointId]!.dofs) {
        expect(realAxes.has(m.axis), `${jointId}:${m.axis}`).toBe(true);
      }
    }
  });

  it('每個可動關節 anchor bone 為已知 bone 實體', () => {
    for (const jointId of MOVABLE_JOINT_IDS) {
      const anchor = JOINT_KINEMATICS[jointId]!.pivot.bone;
      expect(anatomyEntityById.get(anchor)?.type, anchor).toBe('bone');
    }
  });

  it('worldAxis 為單位向量、sign 為 ±1', () => {
    for (const jointId of MOVABLE_JOINT_IDS) {
      for (const m of JOINT_KINEMATICS[jointId]!.dofs) {
        const [x, y, z] = m.worldAxis;
        expect(Math.hypot(x, y, z)).toBeCloseTo(1, 6);
        expect(Math.abs(m.sign)).toBe(1);
      }
    }
  });

  it('segmentForMuscle：跨關節肌歸最近端節段', () => {
    // 腿後肌（hip+knee）→ 大腿（joint.hip）；腓腸肌（knee+ankle）→ 小腿（joint.knee）
    expect(segmentForMuscle(['joint.hip', 'joint.knee'])).toBe('joint.hip');
    expect(segmentForMuscle(['joint.knee', 'joint.ankle'])).toBe('joint.knee');
    // 單關節肘肌（elbow，內屬手臂）→ 肩（joint.glenohumeral）
    expect(segmentForMuscle(['joint.elbow'])).toBe('joint.glenohumeral');
    // 不跨任何受擁關節 → null（騎乘基座）
    expect(segmentForMuscle([])).toBeNull();
  });

  it('SEGMENT_BONES：股骨歸大腿、脛骨歸小腿、跟骨歸足', () => {
    expect(SEGMENT_BONES['joint.hip']).toContain('bone.femur');
    expect(SEGMENT_BONES['joint.knee']).toContain('bone.tibia');
    expect(SEGMENT_BONES['joint.ankle']).toContain('bone.calcaneus');
  });

  it('resolveSegmentMembership：成員不重複、骨＋肌皆納', () => {
    const membership = resolveSegmentMembership(anatomyEntities);
    const seen = new Map<string, string>();
    for (const [segId, ids] of membership) {
      for (const id of ids) {
        expect(seen.has(id), `${id} 重複指派（${seen.get(id)} 與 ${segId}）`).toBe(false);
        seen.set(id, segId);
      }
    }
    // 大腿含股骨（骨）與一條髖肌（肌，relatedJoints 含 joint.hip）
    expect(membership.get('joint.hip')).toContain('bone.femur');
    const hipMuscle = anatomyEntities.find(
      (e) => e.type === 'muscle' && (e.relatedJoints ?? []).includes('joint.hip'),
    );
    expect(membership.get('joint.hip')).toContain(hipMuscle!.anatomyId);
  });

  it('movableJointDof 讀 definitions ROM', () => {
    expect(movableJointDof('joint.knee', 'flexionExtension')?.max).toBe(140);
    expect(movableJointDof('joint.knee', 'bogus')).toBeUndefined();
  });
});
