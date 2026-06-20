import { describe, expect, it } from 'vitest';
import {
  MeshBuilder,
  MorphTarget,
  MorphTargetManager,
  NullEngine,
  Scene,
  VertexBuffer,
} from '@babylonjs/core';
import { correctiveWeight, createMorphTargetController } from './morphTargetController';
import type { MotionPose } from './motionPose';

describe('correctiveWeight', () => {
  it('onset 以下回 0（含絕對值）', () => {
    expect(correctiveWeight(0, 84, 140)).toBe(0);
    expect(correctiveWeight(84, 84, 140)).toBe(0);
    expect(correctiveWeight(-84, 84, 140)).toBe(0);
  });
  it('ref 以上回 1', () => {
    expect(correctiveWeight(140, 84, 140)).toBe(1);
    expect(correctiveWeight(1000, 84, 140)).toBe(1);
  });
  it('區間 smoothstep（中點 0.5、單調遞增）', () => {
    expect(correctiveWeight((84 + 140) / 2, 84, 140)).toBeCloseTo(0.5, 5);
    expect(correctiveWeight(100, 84, 140)).toBeLessThan(correctiveWeight(120, 84, 140));
  });
  it('ref<=onset 防呆回 0', () => {
    expect(correctiveWeight(200, 140, 140)).toBe(0);
  });
});

// 建一具名 corrective morph 之 mesh（box 幾何足夠）。
function meshWithMorph(scene: Scene, meshName: string, morphName: string) {
  const box = MeshBuilder.CreateBox(meshName, { size: 1 }, scene);
  const target = new MorphTarget(morphName, 0, scene);
  target.setPositions(box.getVerticesData(VertexBuffer.PositionKind)!);
  const mgr = new MorphTargetManager(scene);
  mgr.addTarget(target);
  box.morphTargetManager = mgr;
  return target;
}

describe('createMorphTargetController', () => {
  it('neutral pose → corrective influence 0；大屈曲 → influence 1', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const t = meshWithMorph(scene, 'muscle.rectusFemoris#L', 'corr.joint.knee');
    const ctrl = createMorphTargetController(scene);
    ctrl.sync({});
    expect(t.influence).toBe(0);
    ctrl.sync({ 'joint.knee#L': { flexionExtension: 1000 } } as MotionPose);
    expect(t.influence).toBe(1);
    engine.dispose();
  });

  it('左右獨立：joint.knee#L 屈曲只驅動 #L mesh', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const tl = meshWithMorph(scene, 'muscle.rectusFemoris#L', 'corr.joint.knee');
    const tr = meshWithMorph(scene, 'muscle.rectusFemoris#R', 'corr.joint.knee');
    const ctrl = createMorphTargetController(scene);
    ctrl.sync({ 'joint.knee#L': { flexionExtension: 1000 } } as MotionPose);
    expect(tl.influence).toBe(1);
    expect(tr.influence).toBe(0);
    engine.dispose();
  });

  it('非 corr. 前綴 / 未知關節之 morph 不被驅動', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const other = meshWithMorph(scene, 'muscle.x#L', 'someOtherMorph');
    const elbow = meshWithMorph(scene, 'muscle.y#L', 'corr.joint.elbow');
    other.influence = 0.5;
    elbow.influence = 0.5;
    const ctrl = createMorphTargetController(scene);
    ctrl.sync({ 'joint.knee#L': { flexionExtension: 1000 } } as MotionPose);
    expect(other.influence).toBe(0.5);
    expect(elbow.influence).toBe(0.5);
    engine.dispose();
  });

  it('dispose 後 influence 歸 0', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const t = meshWithMorph(scene, 'muscle.rectusFemoris#L', 'corr.joint.knee');
    const ctrl = createMorphTargetController(scene);
    ctrl.sync({ 'joint.knee#L': { flexionExtension: 1000 } } as MotionPose);
    ctrl.dispose();
    expect(t.influence).toBe(0);
    engine.dispose();
  });
});
