import { describe, expect, it } from 'vitest';
import { anatomyEntityById } from '@ptapp/definitions';
import type { Muscle } from '@ptapp/shared';
import type { MotionPose } from './motionPose';
import { contractionState, muscleContractionScalar, musclesForJoint } from './muscleShading';

function muscle(id: string): Muscle {
  const e = anatomyEntityById.get(id);
  if (e === undefined || e.type !== 'muscle') throw new Error(`not a muscle: ${id}`);
  return e;
}

describe('muscleContractionScalar（收縮純量；§4.3.4）', () => {
  it('主動肌於該動作全幅 → +1（收縮）：右髖外展肌外展至 +45', () => {
    // gluteusMedius: [{joint.hip, abduction}]；hip abductionAdduction 右 ROM [-30,45]
    const pose: MotionPose = { 'joint.hip#R': { abductionAdduction: 45 } };
    expect(muscleContractionScalar(muscle('muscle.gluteusMedius'), pose, '#R')).toBeCloseTo(1, 5);
  });

  it('主動肌反向 → −1（伸展）：右髖外展肌內收至 −30', () => {
    const pose: MotionPose = { 'joint.hip#R': { abductionAdduction: -30 } };
    expect(muscleContractionScalar(muscle('muscle.gluteusMedius'), pose, '#R')).toBeCloseTo(-1, 5);
  });

  it('左側鏡像軸翻轉：左髖外展（pose 落 −45）→ +1（收縮）', () => {
    // 左側 jointDofForSide 鏡像為 [-45,30]；左外展＝負端、dir 翻轉。
    const pose: MotionPose = { 'joint.hip#L': { abductionAdduction: -45 } };
    expect(muscleContractionScalar(muscle('muscle.gluteusMedius'), pose, '#L')).toBeCloseTo(1, 5);
  });

  it('拮抗肌伸展：髖屈曲 +120 時膕旁肌（hip extension）→ −1', () => {
    // bicepsFemoris: [{knee, flexion},{hip, extension}]；只動髖→ knee 貢獻 0。
    const pose: MotionPose = { 'joint.hip#R': { flexionExtension: 120 } };
    expect(muscleContractionScalar(muscle('muscle.bicepsFemoris'), pose, '#R')).toBeCloseTo(-1, 5);
  });

  it('半幅 → 比例量值：髖屈曲 +60（ROM 0..120）→ ≈ +0.5', () => {
    // rectusFemoris: [{knee, extension},{hip, flexion}]；只動髖→ +60/120=0.5。
    const pose: MotionPose = { 'joint.hip#R': { flexionExtension: 60 } };
    expect(muscleContractionScalar(muscle('muscle.rectusFemoris'), pose, '#R')).toBeCloseTo(0.5, 5);
  });

  it('多動作求和後 clamp 至 [−1,1]', () => {
    // rectusFemoris 髖屈曲滿(+1) + 膝伸展滿(膝 ROM [-5,140]，extension=負端 −5 → +1) → 和 2 → clamp 1。
    const pose: MotionPose = {
      'joint.hip#R': { flexionExtension: 120 },
      'joint.knee#R': { flexionExtension: -5 },
    };
    expect(muscleContractionScalar(muscle('muscle.rectusFemoris'), pose, '#R')).toBeCloseTo(1, 5);
  });

  it('空 pose → 0（中性）', () => {
    expect(muscleContractionScalar(muscle('muscle.gluteusMedius'), {}, '#R')).toBe(0);
  });

  it('僅作用非可動關節（如肘）→ 0（pose 無該關節項）', () => {
    // bicepsBrachii: [{elbow, flexion}]；運動 pose 僅含可動 6 關節→ 肘無項→ delta 0。
    const pose: MotionPose = { 'joint.hip#R': { flexionExtension: 120 } };
    expect(muscleContractionScalar(muscle('muscle.bicepsBrachii'), pose, null)).toBe(0);
  });
});

describe('contractionState（純量→文字態）', () => {
  it('正→contract、負→stretch、近零→neutral', () => {
    expect(contractionState(0.5)).toBe('contract');
    expect(contractionState(-0.5)).toBe('stretch');
    expect(contractionState(0)).toBe('neutral');
    expect(contractionState(0.01)).toBe('neutral'); // 在 EPSILON 內
  });
});

describe('musclesForJoint（選取關節相關肌群）', () => {
  it('取作用於髖且 v1 會著色之肌（含 gluteusMedius）', () => {
    const ids = musclesForJoint('joint.hip').map((m) => m.anatomyId);
    expect(ids).toContain('muscle.gluteusMedius');
    expect(ids).toContain('muscle.rectusFemoris');
    expect(ids.length).toBeGreaterThan(0);
  });
  it('全回傳項皆為 muscle 型別', () => {
    expect(musclesForJoint('joint.hip').every((m) => m.type === 'muscle')).toBe(true);
  });
  it('非可動關節（肘）→ 空集', () => {
    expect(musclesForJoint('joint.elbow')).toEqual([]);
  });
});
