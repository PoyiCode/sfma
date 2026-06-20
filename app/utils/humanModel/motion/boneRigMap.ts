// 骨骼驅動資料表（04 §4.3.3 skin 變形）：每個可動關節對應一根 MakeHuman armature bone
// （base 名、雙側於解析時補 .L/.R）＋每個 DOF 之 bone-local 旋轉軸與正負號。
// 與剛性路 JOINT_KINEMATICS[*].pivot.bone（骨 mesh 的 anatomyId）語意不同。
// 上肢/軀幹 軸/正負起始值比照剛性路 worldAxis/sign（placeholder、待校正）；
// 下肢（髖/膝/踝）已校正（2026-06-20）：localAxis = R_rest⁻¹·W 解析推導（W＝解剖世界軸：屈伸=X、
// 外展內收=Z、旋轉=Y）＋ Blender contact sheet 目視確認 sign（見
// doc/design/specs/2026-06-20-bone-path-axis-calibration-design.md）。脊椎/頸椎以單一代表 bone（多椎延後）。
import type { AxisVec } from './jointKinematics';

export interface BoneDofMapping {
  // bone 區域座標之旋轉軸（單位向量；多為主軸，斜骨架如踝內外翻為斜軸）
  localAxis: AxisVec;
  // 正角度方向（待實機校正）
  sign: 1 | -1;
}

export interface BoneJointMapping {
  // MakeHuman armature bone 之 base 名（雙側於 resolveBoneName 補 .L/.R；單側用裸名）
  bone: string;
  // 對齊 definitions joint.degreesOfFreedom[].axis
  dofs: Readonly<Record<string, BoneDofMapping>>;
}

const X: AxisVec = [1, 0, 0];
const Y: AxisVec = [0, 1, 0];
const Z: AxisVec = [0, 0, 1];
// 踝內外翻：foot bone rest frame 相對世界傾斜，達成世界 Z（額狀面）旋轉之 bone-local 軸為斜軸
// （localAxis = R_rest⁻¹·worldZ，由出貨 glb node rest 解析推導；2026-06-20 校正）。
const ANKLE_INV_AXIS: AxisVec = [0, 0.884, -0.4675];

export const BONE_RIG_MAP: Readonly<Record<string, BoneJointMapping>> = {
  // 下肢校正（2026-06-20）。thigh rest≈Rot(X,180°)：localAxis X→世界X、Z→世界−Z、Y→世界−Y。
  'joint.hip': {
    bone: 'upperleg01',
    dofs: {
      flexionExtension: { localAxis: X, sign: -1 }, // +ROM 屈曲＝前抬（錨點驗證）
      abductionAdduction: { localAxis: Z, sign: 1 }, // +ROM 外展＝外張（rest 翻轉使 +Z→世界−Z）
      internalExternalRotation: { localAxis: Y, sign: -1 }, // +ROM 內旋＝世界+Y（rest 翻轉＋sign）
    },
  },
  'joint.knee': {
    bone: 'lowerleg01',
    dofs: {
      flexionExtension: { localAxis: X, sign: 1 }, // +ROM 屈曲＝小腿後勾（校正驗證）
    },
  },
  'joint.ankle': {
    bone: 'foot',
    dofs: {
      plantarDorsiflexion: { localAxis: X, sign: -1 }, // +ROM 背屈＝趾上抬
      inversionEversion: { localAxis: ANKLE_INV_AXIS, sign: -1 }, // +ROM 外翻；斜軸達成世界 Z 旋轉
    },
  },
  'joint.glenohumeral': {
    bone: 'upperarm01',
    dofs: {
      flexionExtension: { localAxis: X, sign: -1 },
      abductionAdduction: { localAxis: Z, sign: 1 },
      internalExternalRotation: { localAxis: Y, sign: 1 },
    },
  },
  'joint.cervicalSpine': {
    bone: 'neck01',
    dofs: {
      flexionExtension: { localAxis: X, sign: 1 },
      lateralFlexion: { localAxis: Z, sign: 1 },
      rotation: { localAxis: Y, sign: 1 },
    },
  },
  'joint.spine': {
    // MakeHuman 預設骨架 spine 鏈：spine05（最下、接骨盆）＝腰薦樞紐；spine01 為上段（近頸）。
    bone: 'spine05',
    dofs: {
      flexionExtension: { localAxis: X, sign: 1 },
      lateralFlexion: { localAxis: Z, sign: 1 },
      rotation: { localAxis: Y, sign: 1 },
    },
  },
};
