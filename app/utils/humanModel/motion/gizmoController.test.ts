import { NullEngine } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { anatomyEntities } from '@ptapp/definitions';
import { buildPlaceholderBody, createModelScene } from '../render/sceneCore';
import { buildArticulationRig } from './articulationRig';
import { NEUTRAL_POSE } from './motionPose';
import { createGizmoController } from './gizmoController';

const NOOP_CB = {
  onAngle: () => {},
  onDragStart: () => {},
  onDragEnd: () => {},
  getPoseAngle: () => 0,
};

describe('gizmoController（手柄生命週期；NullEngine）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function fresh() {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    buildPlaceholderBody(scene, anatomyEntities);
    const rig = buildArticulationRig(scene);
    return { scene, rig };
  }

  it('motionMode+joint 建手柄；關閉拆除', () => {
    const { scene, rig } = fresh();
    const ctrl = createGizmoController(scene, (j, s) => rig.getPivot(j, s), NOOP_CB);
    ctrl.sync(true, 'joint.knee', '#L', NEUTRAL_POSE);
    expect(scene.meshes.some((m) => m.name.startsWith('gizmo:joint.knee'))).toBe(true);
    ctrl.sync(false, null, null, NEUTRAL_POSE);
    expect(scene.meshes.some((m) => m.name.startsWith('gizmo:'))).toBe(false);
    ctrl.dispose();
    rig.dispose();
  });

  it('改選關節重建手柄', () => {
    const { scene, rig } = fresh();
    const ctrl = createGizmoController(scene, (j, s) => rig.getPivot(j, s), NOOP_CB);
    ctrl.sync(true, 'joint.knee', '#L', NEUTRAL_POSE);
    ctrl.sync(true, 'joint.hip', '#L', NEUTRAL_POSE);
    expect(scene.meshes.some((m) => m.name.startsWith('gizmo:joint.knee'))).toBe(false);
    expect(scene.meshes.some((m) => m.name.startsWith('gizmo:joint.hip'))).toBe(true);
    ctrl.dispose();
    rig.dispose();
  });
});
