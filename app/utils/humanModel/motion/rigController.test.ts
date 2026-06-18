import { NullEngine } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { anatomyEntities } from '@ptapp/definitions';
import { buildPlaceholderBody, createModelScene } from '../render/sceneCore';
import { NEUTRAL_POSE, setJointAngle } from './motionPose';
import { createRigController } from './rigController';

describe('rigController（依 motionMode/pose 建/套/拆 rig）', () => {
  let engine: NullEngine | undefined;
  afterEach(() => {
    engine?.dispose();
    engine = undefined;
  });
  function freshScene() {
    engine = new NullEngine();
    const scene = createModelScene(engine);
    buildPlaceholderBody(scene, anatomyEntities);
    return scene;
  }

  it('motionMode=false 不建 rig（無 pivot 節點）', () => {
    const scene = freshScene();
    const ctrl = createRigController(scene);
    ctrl.sync(false, NEUTRAL_POSE);
    expect(scene.transformNodes.some((n) => n.name.startsWith('pivot:'))).toBe(false);
    ctrl.dispose();
  });

  it('motionMode=true 建 rig 並套 pose；關閉拆 rig', () => {
    const scene = freshScene();
    const ctrl = createRigController(scene);
    ctrl.sync(true, setJointAngle(NEUTRAL_POSE, 'joint.knee', 'flexionExtension', 45));
    expect(scene.transformNodes.some((n) => n.name.startsWith('pivot:'))).toBe(true);
    ctrl.sync(false, NEUTRAL_POSE);
    expect(scene.transformNodes.some((n) => n.name.startsWith('pivot:'))).toBe(false);
    ctrl.dispose();
  });
});
