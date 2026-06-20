import { afterEach, describe, expect, it } from 'vitest';
import { MeshBuilder, NullEngine, VertexBuffer } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import { anatomyEntityById } from '@ptapp/definitions';
import type { Muscle } from '@ptapp/shared';
import type { MotionPose } from './motionPose';
import { createModelScene, type PlaceholderMeshMetadata } from '../render/sceneCore';
import { partKey } from '../anatomy/partKey';
import { SELECTION_OVERLAY_COLOR } from '../render/sceneHighlight';
import {
  applyMuscleShading,
  applyOverlays,
  clearMuscleShading,
  contractionState,
  COOL,
  muscleContractionScalar,
  musclesForJoint,
  WARM,
} from './muscleShading';

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
  it('EPSILON 邊界：恰好 0.02 為 neutral（strict >），0.021 為 contract', () => {
    expect(contractionState(0.02)).toBe('neutral'); // 等於 EPSILON → neutral（strict >）
    expect(contractionState(0.021)).toBe('contract');
    expect(contractionState(-0.021)).toBe('stretch');
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

describe('applyMuscleShading（頂點色著色；§4.3.4、skinning-safe）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });

  function addMuscle(scene: Scene, anatomyId: string, side: 'L' | 'R'): void {
    const mesh = MeshBuilder.CreateBox(`${anatomyId}#${side}`, { size: 1 }, scene);
    const metadata: PlaceholderMeshMetadata = {
      anatomyId,
      entityType: 'muscle',
      side: side === 'L' ? 'left' : 'right',
    };
    mesh.metadata = metadata;
  }
  function addBone(scene: Scene, anatomyId: string): void {
    const mesh = MeshBuilder.CreateBox(anatomyId, { size: 1 }, scene);
    mesh.metadata = { anatomyId, entityType: 'bone' } satisfies PlaceholderMeshMetadata;
  }
  function scene(): Scene {
    engine = new NullEngine();
    const s = createModelScene(engine);
    addMuscle(s, 'muscle.gluteusMedius', 'R'); // hip abduction
    addMuscle(s, 'muscle.bicepsFemoris', 'R'); // hip extension（拮抗）
    addBone(s, 'bone.femur');
    return s;
  }
  const get = (s: Scene, name: string) => s.getMeshByName(name)!;
  const vcolor = (m: ReturnType<typeof get>): number[] | null => {
    const d = m.getVerticesData(VertexBuffer.ColorKind);
    return d ? [d[0]!, d[1]!, d[2]!, d[3]!] : null;
  };

  it('收縮肌得暖色頂點色、拮抗肌得冷色：右髖屈曲 +120（不再用 renderOverlay）', () => {
    const s = scene();
    applyMuscleShading(s, { 'joint.hip#R': { flexionExtension: 120 } });
    const bf = get(s, 'muscle.bicepsFemoris#R'); // 髖伸肌 → 屈曲時伸展（冷）
    expect(bf.renderOverlay).toBe(false);
    const c = vcolor(bf)!;
    const f = 0.8; // |scalar|=1 × TINT_STRENGTH
    expect(c[0]).toBeCloseTo(1 + (COOL.r - 1) * f, 3);
    expect(c[1]).toBeCloseTo(1 + (COOL.g - 1) * f, 3);
    expect(c[2]).toBeCloseTo(1 + (COOL.b - 1) * f, 3);
    expect(c[3]).toBe(1);
    const gm = vcolor(get(s, 'muscle.gluteusMedius#R'))!; // 屈曲不動 → 中性 → 白
    expect(gm[0]).toBeCloseTo(1, 5);
    expect(gm[1]).toBeCloseTo(1, 5);
    expect(gm[2]).toBeCloseTo(1, 5);
  });

  it('外展肌外展 +45 → 暖色頂點色（lerp 白→WARM × 0.8、alpha=1）', () => {
    const s = scene();
    applyMuscleShading(s, { 'joint.hip#R': { abductionAdduction: 45 } });
    const c = vcolor(get(s, 'muscle.gluteusMedius#R'))!;
    const f = 0.8;
    expect(c[0]).toBeCloseTo(1 + (WARM.r - 1) * f, 3);
    expect(c[1]).toBeCloseTo(1 + (WARM.g - 1) * f, 3);
    expect(c[2]).toBeCloseTo(1 + (WARM.b - 1) * f, 3);
    expect(c[3]).toBe(1);
  });

  it('非肌肉 mesh 一律清 renderOverlay 殘留', () => {
    const s = scene();
    const bone = get(s, 'bone.femur');
    bone.renderOverlay = true; // 模擬殘留選取
    applyMuscleShading(s, { 'joint.hip#R': { abductionAdduction: 45 } });
    expect(bone.renderOverlay).toBe(false);
  });

  it('中性 pose → 全肌白頂點色、無 renderOverlay', () => {
    const s = scene();
    applyMuscleShading(s, {});
    for (const nm of ['muscle.gluteusMedius#R', 'muscle.bicepsFemoris#R']) {
      const m = get(s, nm);
      expect(m.renderOverlay).toBe(false);
      expect(vcolor(m)![0]).toBeCloseTo(1, 5);
    }
  });

  it('clearMuscleShading 還原已染色肌為白', () => {
    const s = scene();
    applyMuscleShading(s, { 'joint.hip#R': { abductionAdduction: 45 } });
    clearMuscleShading(s);
    const c = vcolor(get(s, 'muscle.gluteusMedius#R'))!;
    expect(c[0]).toBeCloseTo(1, 5);
    expect(c[1]).toBeCloseTo(1, 5);
    expect(c[2]).toBeCloseTo(1, 5);
  });
});

describe('applyOverlays（overlay 單一權威 dispatcher）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function sidedMuscle(s: Scene, anatomyId: string, side: 'L' | 'R'): void {
    const m = MeshBuilder.CreateBox(`${anatomyId}#${side}`, { size: 1 }, s);
    m.metadata = {
      anatomyId,
      entityType: 'muscle',
      side: side === 'L' ? 'left' : 'right',
    } satisfies PlaceholderMeshMetadata;
  }
  function scene(): Scene {
    engine = new NullEngine();
    const s = createModelScene(engine);
    sidedMuscle(s, 'muscle.gluteusMedius', 'R');
    return s;
  }

  it('運動模式+著色開 → 走肌肉著色（外展肌外展得暖色頂點色）', () => {
    const s = scene();
    applyOverlays(s, {
      motionMode: true,
      muscleShading: true,
      pose: { 'joint.hip#R': { abductionAdduction: 45 } },
      selectedKey: null,
    });
    const d = s.getMeshByName('muscle.gluteusMedius#R')!.getVerticesData(VertexBuffer.ColorKind)!;
    expect(d[0]).toBeCloseTo(1 + (WARM.r - 1) * 0.8, 3);
    expect(d[1]).toBeCloseTo(1 + (WARM.g - 1) * 0.8, 3);
  });

  it('運動模式但著色關 → 走選取/標註高亮（選取部位 accent）', () => {
    const s = scene();
    applyOverlays(s, {
      motionMode: true,
      muscleShading: false,
      pose: { 'joint.hip#R': { abductionAdduction: 45 } },
      selectedKey: partKey('muscle.gluteusMedius', 'right'),
    });
    // 選取高亮以 partKey 比對 metadata.anatomyId+side → accent；非肌肉著色色。
    const gm = s.getMeshByName('muscle.gluteusMedius#R')!;
    expect(gm.renderOverlay).toBe(true);
    expect(gm.overlayColor.equals(SELECTION_OVERLAY_COLOR)).toBe(true);
  });

  it('非運動模式 → 走選取/標註高亮', () => {
    const s = scene();
    applyOverlays(s, {
      motionMode: false,
      muscleShading: true,
      pose: {},
      selectedKey: partKey('muscle.gluteusMedius', 'right'),
    });
    expect(
      s.getMeshByName('muscle.gluteusMedius#R')!.overlayColor.equals(SELECTION_OVERLAY_COLOR),
    ).toBe(true);
  });
});
