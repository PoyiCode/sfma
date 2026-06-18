// 運動姿態（04 §4.3.3）：每關節各自由度之絕對角度（deg）。jointId = anatomyId（如 'joint.knee'）、
// axis = definitions DOF.axis。未設之軸＝中立（由 applyPose 以 DOF.neutral 解釋）。純函式、不可變更新。
export type MotionPose = Readonly<Record<string, Readonly<Record<string, number>>>>;

export const NEUTRAL_POSE: MotionPose = {};

export function setJointAngle(
  pose: MotionPose,
  jointId: string,
  axis: string,
  deg: number,
): MotionPose {
  const joint = { ...(pose[jointId] ?? {}), [axis]: deg };
  return { ...pose, [jointId]: joint };
}

export function jointAngle(pose: MotionPose, jointId: string, axis: string, fallback = 0): number {
  return pose[jointId]?.[axis] ?? fallback;
}

export function resetPose(): MotionPose {
  return NEUTRAL_POSE;
}
