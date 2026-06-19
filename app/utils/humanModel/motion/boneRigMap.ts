// 骨骼驅動資料表（04 §4.3.3 skin 變形）：每個可動關節對應一根 MakeHuman armature bone
// （base 名、雙側於解析時補 .L/.R）＋每個 DOF 之 bone-local 旋轉軸與正負號。
// 與剛性路 JOINT_KINEMATICS[*].pivot.bone（骨 mesh 的 anatomyId）語意不同。
// 軸/正負起始值比照剛性路 worldAxis/sign；真骨架 bone 名與 bone-local 軸/正負為 placeholder、
// 待真資產實機目視校正（與現役 world-sign 校正同軌）。脊椎/頸椎以單一代表 bone（多椎延後）。
import type { AxisVec } from './jointKinematics';

export interface BoneDofMapping {
  // bone 區域座標之旋轉軸（單位主軸）
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

export const BONE_RIG_MAP: Readonly<Record<string, BoneJointMapping>> = {
  'joint.hip': {
    bone: 'upperleg01',
    dofs: {
      flexionExtension: { localAxis: X, sign: -1 },
      abductionAdduction: { localAxis: Z, sign: 1 },
      internalExternalRotation: { localAxis: Y, sign: 1 },
    },
  },
  'joint.knee': {
    bone: 'lowerleg01',
    dofs: {
      flexionExtension: { localAxis: X, sign: 1 },
    },
  },
  'joint.ankle': {
    bone: 'foot',
    dofs: {
      plantarDorsiflexion: { localAxis: X, sign: 1 },
      inversionEversion: { localAxis: Z, sign: 1 },
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
    bone: 'spine01',
    dofs: {
      flexionExtension: { localAxis: X, sign: 1 },
      lateralFlexion: { localAxis: Z, sign: 1 },
      rotation: { localAxis: Y, sign: 1 },
    },
  },
};
