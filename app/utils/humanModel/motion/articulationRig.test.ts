import { NullEngine, TransformNode } from '@babylonjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { anatomyEntities } from '@ptapp/definitions';
import { buildPlaceholderBody, createModelScene } from '../render/sceneCore';
import { NEUTRAL_POSE, setJointAngle } from './motionPose';
import { buildArticulationRig } from './articulationRig';

// 佔位身體（sceneCore）：每 anatomyId 一 box、側別無關（無 #L/#R）。足供 rig 結構測試
// （中線關節 spine/cervical 走無側分支；雙側關節於佔位身體亦解析為單側 fallback）。

describe('articulationRig（剛性節段 rig；NullEngine）', () => {
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

  it('建 rig 後生成樞紐 TransformNode、含脊椎與膝', () => {
    const scene = freshScene();
    const rig = buildArticulationRig(scene);
    expect(rig.pivotKeys.some((k) => k.startsWith('joint.spine'))).toBe(true);
    expect(rig.pivotKeys.some((k) => k.startsWith('joint.knee'))).toBe(true);
    expect(scene.getTransformNodeByName !== undefined).toBe(true);
    rig.dispose();
  });

  it('中立姿態下 mesh 世界座標不變（reparent 保變換）', () => {
    const scene = freshScene();
    const femur = scene.getMeshByName('bone.femur')!;
    const before = femur.getAbsolutePosition().clone();
    const rig = buildArticulationRig(scene);
    rig.applyPose(NEUTRAL_POSE);
    femur.computeWorldMatrix(true);
    expect(femur.getAbsolutePosition().subtract(before).length()).toBeLessThan(1e-4);
    rig.dispose();
  });

  it('膝屈曲改變小腿成員（脛骨）世界座標', () => {
    const scene = freshScene();
    const tibia = scene.getMeshByName('bone.tibia')!;
    const rig = buildArticulationRig(scene);
    const before = tibia.getAbsolutePosition().clone();
    // 佔位身體無 #L/#R，雙側成員 fallback 掛於先訪之 #L 樞紐 → 以 'joint.knee#L' 驅動。
    rig.applyPose(setJointAngle(NEUTRAL_POSE, 'joint.knee#L', 'flexionExtension', 90));
    tibia.computeWorldMatrix(true);
    // 脛骨為膝樞紐之 anchor（樞紐在其上端）：屈曲後其下半旋走、絕對中心應位移
    expect(tibia.getAbsolutePosition().subtract(before).length()).toBeGreaterThan(0.01);
    rig.dispose();
  });

  it('左右獨立：以他側鍵（#R）驅動不動本側成員（脛骨掛於 #L）', () => {
    const scene = freshScene();
    const tibia = scene.getMeshByName('bone.tibia')!;
    const rig = buildArticulationRig(scene);
    const before = tibia.getAbsolutePosition().clone();
    // 脛骨掛於 #L 樞紐；以 'joint.knee#R' 驅動不應移動它（每側獨立姿態鍵）。
    rig.applyPose(setJointAngle(NEUTRAL_POSE, 'joint.knee#R', 'flexionExtension', 90));
    tibia.computeWorldMatrix(true);
    expect(tibia.getAbsolutePosition().subtract(before).length()).toBeLessThan(1e-4);
    rig.dispose();
  });

  it('dispose 後 mesh 還原至樞紐外（parent 非樞紐）且世界座標復原', () => {
    const scene = freshScene();
    const tibia = scene.getMeshByName('bone.tibia')!;
    const before = tibia.getAbsolutePosition().clone();
    const rig = buildArticulationRig(scene);
    rig.applyPose(setJointAngle(NEUTRAL_POSE, 'joint.knee#L', 'flexionExtension', 90));
    rig.dispose();
    tibia.computeWorldMatrix(true);
    expect(tibia.parent instanceof TransformNode && tibia.parent.name.startsWith('pivot:')).toBe(
      false,
    );
    expect(tibia.getAbsolutePosition().subtract(before).length()).toBeLessThan(1e-3);
  });

  it('getPivot 取既有樞紐節點、未知回 null、dispose 後清空', () => {
    const scene = freshScene();
    const rig = buildArticulationRig(scene);
    expect(rig.getPivot('joint.knee', '#L')).not.toBeNull();
    expect(rig.getPivot('joint.spine')).not.toBeNull(); // 中線（side 預設 null）
    expect(rig.getPivot('joint.nope')).toBeNull();
    rig.dispose();
    expect(rig.getPivot('joint.knee', '#L')).toBeNull();
  });
});
