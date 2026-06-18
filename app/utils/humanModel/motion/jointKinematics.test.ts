import { describe, expect, it } from 'vitest';
import { anatomyEntities, anatomyEntityById } from '@ptapp/definitions';
import {
  JOINT_KINEMATICS,
  MOVABLE_JOINT_IDS,
  jointDofForSide,
  movableJointDof,
  normalizeSide,
  poseKey,
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

  it('normalizeSide：雙側保證 #L/#R（缺則 #R）、單側為 null', () => {
    expect(normalizeSide('joint.knee', '#L')).toBe('#L');
    expect(normalizeSide('joint.knee', '#R')).toBe('#R');
    expect(normalizeSide('joint.knee', null)).toBe('#R'); // 雙側缺側別→預設 #R
    expect(normalizeSide('joint.spine', '#L')).toBeNull(); // 單側忽略側別
    expect(normalizeSide('joint.cervicalSpine', null)).toBeNull();
    expect(normalizeSide('joint.nope', '#L')).toBeNull(); // 未知關節
  });

  it('poseKey：雙側附 #L/#R 後綴、單側裸 jointId、idempotent', () => {
    expect(poseKey('joint.knee', '#L')).toBe('joint.knee#L');
    expect(poseKey('joint.knee', '#R')).toBe('joint.knee#R');
    expect(poseKey('joint.knee', null)).toBe('joint.knee#R'); // 雙側缺側別→ #R
    expect(poseKey('joint.spine', '#L')).toBe('joint.spine'); // 單側裸鍵
    expect(poseKey('joint.spine', null)).toBe('joint.spine');
    // 先 normalizeSide 再組鍵與直接組鍵結果一致（正規化後 side 為合法值）
    expect(poseKey('joint.knee', normalizeSide('joint.knee', '#L'))).toBe('joint.knee#L');
  });

  it('jointDofForSide：左側鏡像軸取 [-max,-min]、右側與矢狀面原值', () => {
    const range = (jointId: string, axis: string, side: string | null) => {
      const d = jointDofForSide(jointId, axis, side);
      return d ? [d.min, d.max] : undefined;
    };
    // 髖 外展/內收：右 [-30,45]、左鏡像 [-45,30]
    expect(range('joint.hip', 'abductionAdduction', '#R')).toEqual([-30, 45]);
    expect(range('joint.hip', 'abductionAdduction', '#L')).toEqual([-45, 30]);
    // 髖 屈伸（矢狀面）：左右皆原值 [-20,120]
    expect(range('joint.hip', 'flexionExtension', '#L')).toEqual([-20, 120]);
    expect(range('joint.hip', 'flexionExtension', '#R')).toEqual([-20, 120]);
    // 髖 內外旋：右 [-45,45]、左鏡像仍 [-45,45]（對稱→無作用）
    expect(range('joint.hip', 'internalExternalRotation', '#L')).toEqual([-45, 45]);
    // 踝 內翻/外翻：右 [-35,15]、左鏡像 [-15,35]
    expect(range('joint.ankle', 'inversionEversion', '#R')).toEqual([-35, 15]);
    expect(range('joint.ankle', 'inversionEversion', '#L')).toEqual([-15, 35]);
    // 肩 外展/內收：右 [-50,180]、左鏡像 [-180,50]
    expect(range('joint.glenohumeral', 'abductionAdduction', '#L')).toEqual([-180, 50]);
    // 肩 內外旋：右 [-70,90]、左鏡像 [-90,70]
    expect(range('joint.glenohumeral', 'internalExternalRotation', '#L')).toEqual([-90, 70]);
    // 單側關節（脊椎）即使傳 #L 亦不鏡像
    expect(range('joint.spine', 'lateralFlexion', '#L')).toEqual(
      range('joint.spine', 'lateralFlexion', '#R'),
    );
    expect(jointDofForSide('joint.hip', 'bogus', '#L')).toBeUndefined();
  });
});
