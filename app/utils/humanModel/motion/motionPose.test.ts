import { describe, expect, it } from 'vitest';
import { jointAngle, NEUTRAL_POSE, resetPose, setJointAngle } from './motionPose';

describe('motionPose（運動姿態不可變 reducer）', () => {
  it('setJointAngle 不變更原 pose、回傳新值', () => {
    const next = setJointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension', 30);
    expect(jointAngle(next, 'joint.knee', 'flexionExtension')).toBe(30);
    expect(NEUTRAL_POSE).toEqual({});
  });
  it('同關節多軸並存、互不覆蓋', () => {
    let p = setJointAngle(NEUTRAL_POSE, 'joint.hip', 'flexionExtension', 40);
    p = setJointAngle(p, 'joint.hip', 'abductionAdduction', 10);
    expect(jointAngle(p, 'joint.hip', 'flexionExtension')).toBe(40);
    expect(jointAngle(p, 'joint.hip', 'abductionAdduction')).toBe(10);
  });
  it('jointAngle 未設回 fallback（預設 0）', () => {
    expect(jointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension')).toBe(0);
    expect(jointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension', -5)).toBe(-5);
  });
  it('resetPose 回中立空姿態', () => {
    expect(resetPose()).toEqual({});
  });
});
