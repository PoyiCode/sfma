import { describe, expect, it } from 'vitest';
import { jointForMesh, sideOfMesh, stripSide } from './meshToJoint';

describe('meshToJoint', () => {
  it('stripSide 去 #L/#R 尾碼', () => {
    expect(stripSide('bone.tibia#L')).toBe('bone.tibia');
    expect(stripSide('bone.sacrum')).toBe('bone.sacrum');
  });
  it('sideOfMesh 取側別', () => {
    expect(sideOfMesh('bone.tibia#L')).toBe('#L');
    expect(sideOfMesh('bone.femur#R')).toBe('#R');
    expect(sideOfMesh('bone.sacrum')).toBeNull();
  });
  it('jointForMesh：節段成員→其控制關節', () => {
    expect(jointForMesh('bone.tibia#L')).toBe('joint.knee'); // 脛骨∈小腿（膝）
    expect(jointForMesh('bone.femur#R')).toBe('joint.hip'); // 股骨∈大腿（髖）
    expect(jointForMesh('bone.humerus')).toBe('joint.glenohumeral'); // 肱骨∈手臂（肩）
  });
  it('非任何節段成員（基座）→ null', () => {
    expect(jointForMesh('bone.sacrum')).toBeNull(); // 薦椎為脊椎樞紐 anchor、非節段成員
  });
});
