import { Color3, NullEngine, type StandardMaterial, TransformNode } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { createModelScene } from '../render/sceneCore';
import { NEUTRAL_POSE, setJointAngle } from './motionPose';
import { createJointGizmo } from './jointGizmo';

const NOOP_CB = {
  onAngle: () => {},
  onDragStart: () => {},
  onDragEnd: () => {},
  getPoseAngle: () => 0,
};

describe('jointGizmo（弧手柄建構；NullEngine）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function fresh() {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    const pivot = new TransformNode('pivot:test', scene);
    return { scene, pivot };
  }

  it('肩（3 DOF）建 3 弧、掛於 pivot、帶 axis metadata', () => {
    const { scene, pivot } = fresh();
    const g = createJointGizmo(scene, pivot, 'joint.glenohumeral', NOOP_CB);
    const arcs = scene.meshes.filter((m) => m.name.startsWith('gizmo:joint.glenohumeral'));
    expect(arcs).toHaveLength(3);
    expect(arcs.every((a) => a.parent === pivot)).toBe(true);
    expect(arcs.every((a) => typeof a.metadata?.gizmoAxis === 'string')).toBe(true);
    g.dispose();
  });

  it('膝（1 DOF）建 1 弧', () => {
    const { scene, pivot } = fresh();
    const g = createJointGizmo(scene, pivot, 'joint.knee', NOOP_CB);
    expect(scene.meshes.filter((m) => m.name.startsWith('gizmo:joint.knee'))).toHaveLength(1);
    g.dispose();
  });

  it('update：觸 ROM 邊界轉琥珀、範圍內回 accent', () => {
    const { scene, pivot } = fresh();
    const g = createJointGizmo(scene, pivot, 'joint.knee', NOOP_CB);
    const arc = scene.meshes.find((m) => m.name.startsWith('gizmo:joint.knee'))!;
    const mat = arc.material as StandardMaterial;
    g.update(setJointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension', 140)); // max
    expect(mat.emissiveColor.equals(Color3.FromHexString('#b26a00'))).toBe(true);
    g.update(setJointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension', 45));
    expect(mat.emissiveColor.equals(Color3.FromHexString('#0e7490'))).toBe(true);
    g.dispose();
  });

  it('dispose 移除弧 mesh', () => {
    const { scene, pivot } = fresh();
    const g = createJointGizmo(scene, pivot, 'joint.knee', NOOP_CB);
    g.dispose();
    expect(scene.meshes.filter((m) => m.name.startsWith('gizmo:joint.knee'))).toHaveLength(0);
  });
});
