// 運動學表（04 §4.3.3，剛性節段旋轉）：純資料＋純函式，無 Babylon（軸以 [x,y,z] 表、座標由
// articulationRig 求 AABB）。SFMA 臨床優先 6 關節：頸椎／肩／脊椎／髖／膝／踝。
// 樞紐自幾何計算（anchor bone + AABB 面）；脊椎/頸椎 v1 單樞紐近似（見 §4.3.3 待辦）。
import { anatomyEntities as ALL_ENTITIES, anatomyEntityById } from '@ptapp/definitions';
import type { AnatomyEntity } from '@ptapp/shared';
import type { DegreeOfFreedom } from './romClamp';

export type AxisVec = readonly [number, number, number];
export type AabbFace = 'minX' | 'maxX' | 'minY' | 'maxY' | 'minZ' | 'maxZ';

export interface PivotAnchor {
  // anchor bone anatomyId（側別無關；建 rig 時雙側補 #L/#R）
  bone: string;
  // 取此 bone 世界 AABB 之指定面中心為樞紐
  face: AabbFace;
}

export interface DofAxisMapping {
  // 對齊 definitions joint.degreesOfFreedom[].axis
  axis: string;
  // 旋轉軸（世界座標、單位向量；中立站姿下解剖軸 ≈ 世界軸）
  worldAxis: AxisVec;
  // 正角度方向（依各 DOF 之解剖正向約定；實作時對實機校正）
  sign: 1 | -1;
}

export interface JointKinematics {
  jointId: string;
  pivot: PivotAnchor;
  dofs: readonly DofAxisMapping[];
  // 是否成對（左右各一獨立節段／樞紐）
  bilateral: boolean;
}

export interface SegmentTreeNode {
  jointId: string;
  children: readonly SegmentTreeNode[];
}

// 世界軸（中立站姿；模型 +Y 上）。X＝左右（屈伸軸）、Y＝上下（縱軸＝旋轉）、Z＝前後（側彎／外展軸）。
// 註：sign 與軸於 Task 4 對實機目視校正（見該 task Step 7）。
const X: AxisVec = [1, 0, 0];
const Y: AxisVec = [0, 1, 0];
const Z: AxisVec = [0, 0, 1];

export const MOVABLE_JOINT_IDS: readonly string[] = [
  'joint.hip',
  'joint.knee',
  'joint.ankle',
  'joint.glenohumeral',
  'joint.cervicalSpine',
  'joint.spine',
];

export const JOINT_KINEMATICS: Readonly<Record<string, JointKinematics>> = {
  'joint.hip': {
    jointId: 'joint.hip',
    pivot: { bone: 'bone.femur', face: 'maxY' }, // 股骨頭端（上）
    bilateral: true,
    dofs: [
      // flexionExtension 經實機目視校正為 -1：屈曲（往前，正角→ROM max 120）對應大腿前舉、
      // 伸展（往後，負角→ROM min -20）對應後擺（§4.3.3 軸/sign 校正）。其餘軸仍待校正。
      { axis: 'flexionExtension', worldAxis: X, sign: -1 },
      { axis: 'abductionAdduction', worldAxis: Z, sign: 1 },
      { axis: 'internalExternalRotation', worldAxis: Y, sign: 1 },
    ],
  },
  'joint.knee': {
    jointId: 'joint.knee',
    pivot: { bone: 'bone.tibia', face: 'maxY' }, // 脛骨平台（上）
    bilateral: true,
    dofs: [{ axis: 'flexionExtension', worldAxis: X, sign: 1 }],
  },
  'joint.ankle': {
    jointId: 'joint.ankle',
    pivot: { bone: 'bone.tibia', face: 'minY' }, // 遠端脛骨（下）
    bilateral: true,
    dofs: [
      { axis: 'plantarDorsiflexion', worldAxis: X, sign: 1 },
      { axis: 'inversionEversion', worldAxis: Z, sign: 1 },
    ],
  },
  'joint.glenohumeral': {
    jointId: 'joint.glenohumeral',
    pivot: { bone: 'bone.humerus', face: 'maxY' }, // 肱骨頭端（上）
    bilateral: true,
    dofs: [
      // flexionExtension 經實機目視校正為 -1：屈曲（往前，正角→ROM max 180）對應手臂前舉、
      // 伸展（往後，負角→ROM min -60）對應後擺（§4.3.3 軸/sign 校正）。其餘軸仍待校正。
      { axis: 'flexionExtension', worldAxis: X, sign: -1 },
      { axis: 'abductionAdduction', worldAxis: Z, sign: 1 },
      { axis: 'internalExternalRotation', worldAxis: Y, sign: 1 },
    ],
  },
  'joint.cervicalSpine': {
    jointId: 'joint.cervicalSpine',
    pivot: { bone: 'bone.t1', face: 'maxY' }, // 頸胸交界（T1 上端）；註：bone.t1 屬 spine 節段，此處僅讀其位置定樞紐、不移動之
    bilateral: false,
    dofs: [
      { axis: 'flexionExtension', worldAxis: X, sign: 1 },
      { axis: 'lateralFlexion', worldAxis: Z, sign: 1 },
      { axis: 'rotation', worldAxis: Y, sign: 1 },
    ],
  },
  'joint.spine': {
    jointId: 'joint.spine',
    pivot: { bone: 'bone.sacrum', face: 'maxY' }, // 腰薦交界（薦椎上端）
    bilateral: false,
    dofs: [
      { axis: 'flexionExtension', worldAxis: X, sign: 1 },
      { axis: 'lateralFlexion', worldAxis: Z, sign: 1 },
      { axis: 'rotation', worldAxis: Y, sign: 1 },
    ],
  },
};

// 節段樹（jointId 為節點；root 為固定基座 sentinel 'base'）。巢狀＝移動近端帶動遠端。
export const SEGMENT_TREE: SegmentTreeNode = {
  jointId: 'base',
  children: [
    {
      jointId: 'joint.spine',
      children: [
        { jointId: 'joint.cervicalSpine', children: [] },
        { jointId: 'joint.glenohumeral', children: [] },
      ],
    },
    {
      jointId: 'joint.hip',
      children: [
        {
          jointId: 'joint.knee',
          children: [{ jointId: 'joint.ankle', children: [] }],
        },
      ],
    },
  ],
};

// 節段深度（root 距離；segmentForMuscle 取最小者＝最近端）。
const SEGMENT_DEPTH: Readonly<Record<string, number>> = {
  'joint.spine': 1,
  'joint.hip': 1,
  'joint.cervicalSpine': 2,
  'joint.glenohumeral': 2,
  'joint.knee': 2,
  'joint.ankle': 3,
};

// 同深度平手時之優先序（近端→遠端）。
const SEGMENT_PRIORITY: readonly string[] = [
  'joint.spine',
  'joint.hip',
  'joint.glenohumeral',
  'joint.cervicalSpine',
  'joint.knee',
  'joint.ankle',
];

// 任一關節（含內屬不可動關節）→ 擁有它的可動 segment。內屬關節歸入其所在剛性節段。
export const JOINT_TO_SEGMENT: Readonly<Record<string, string>> = {
  // 軀幹
  'joint.spine': 'joint.spine',
  'joint.thorax': 'joint.spine',
  'joint.scapulothoracic': 'joint.spine',
  // 頭頸
  'joint.cervicalSpine': 'joint.cervicalSpine',
  'joint.temporomandibular': 'joint.cervicalSpine',
  'joint.hyoid': 'joint.cervicalSpine',
  // 手臂（肘以下內屬，肩為近端可動）
  'joint.glenohumeral': 'joint.glenohumeral',
  'joint.elbow': 'joint.glenohumeral',
  'joint.radioulnar': 'joint.glenohumeral',
  'joint.wrist': 'joint.glenohumeral',
  'joint.fingers': 'joint.glenohumeral',
  'joint.thumb': 'joint.glenohumeral',
  // 下肢
  'joint.hip': 'joint.hip',
  'joint.knee': 'joint.knee',
  'joint.ankle': 'joint.ankle',
  'joint.toes': 'joint.ankle',
};

// 各節段之骨骼成員（側別無關 anatomyId）。基座（骨盆／薦椎／中軸殘餘）不列＝不動。
export const SEGMENT_BONES: Readonly<Partial<Record<string, readonly string[]>>> = {
  'joint.hip': ['bone.femur'],
  'joint.knee': ['bone.tibia', 'bone.fibula', 'bone.patella'],
  'joint.ankle': [
    'bone.talus',
    'bone.calcaneus',
    'bone.navicular',
    'bone.cuboid',
    'bone.medialCuneiform',
    'bone.intermediateCuneiform',
    'bone.lateralCuneiform',
    'bone.metatarsal1',
    'bone.metatarsal2',
    'bone.metatarsal3',
    'bone.metatarsal4',
    'bone.metatarsal5',
    'bone.footProximalPhalanx1',
    'bone.footProximalPhalanx2',
    'bone.footProximalPhalanx3',
    'bone.footProximalPhalanx4',
    'bone.footProximalPhalanx5',
    'bone.footMiddlePhalanx2',
    'bone.footMiddlePhalanx3',
    'bone.footMiddlePhalanx4',
    'bone.footMiddlePhalanx5',
    'bone.footDistalPhalanx1',
    'bone.footDistalPhalanx2',
    'bone.footDistalPhalanx3',
    'bone.footDistalPhalanx4',
    'bone.footDistalPhalanx5',
  ],
  'joint.glenohumeral': [
    'bone.humerus',
    'bone.radius',
    'bone.ulna',
    'bone.scaphoid',
    'bone.lunate',
    'bone.triquetrum',
    'bone.pisiform',
    'bone.trapezium',
    'bone.trapezoid',
    'bone.capitate',
    'bone.hamate',
    'bone.metacarpal1',
    'bone.metacarpal2',
    'bone.metacarpal3',
    'bone.metacarpal4',
    'bone.metacarpal5',
    'bone.handProximalPhalanx1',
    'bone.handProximalPhalanx2',
    'bone.handProximalPhalanx3',
    'bone.handProximalPhalanx4',
    'bone.handProximalPhalanx5',
    'bone.handMiddlePhalanx2',
    'bone.handMiddlePhalanx3',
    'bone.handMiddlePhalanx4',
    'bone.handMiddlePhalanx5',
    'bone.handDistalPhalanx1',
    'bone.handDistalPhalanx2',
    'bone.handDistalPhalanx3',
    'bone.handDistalPhalanx4',
    'bone.handDistalPhalanx5',
  ],
  'joint.cervicalSpine': [
    'bone.c1',
    'bone.c2',
    'bone.c3',
    'bone.c4',
    'bone.c5',
    'bone.c6',
    'bone.c7',
    'bone.frontal',
    'bone.parietal',
    'bone.temporal',
    'bone.occipital',
    'bone.sphenoid',
    'bone.ethmoid',
    'bone.nasal',
    'bone.lacrimal',
    'bone.zygomatic',
    'bone.maxilla',
    'bone.mandible',
    'bone.palatine',
    'bone.vomer',
    'bone.inferiorNasalConcha',
    'bone.hyoid',
  ],
  // 軀幹（脊椎節段）：胸腰椎＋肋＋胸骨＋肩帶。頭頸與手臂為其子節段、另列。
  'joint.spine': [
    'bone.t1',
    'bone.t2',
    'bone.t3',
    'bone.t4',
    'bone.t5',
    'bone.t6',
    'bone.t7',
    'bone.t8',
    'bone.t9',
    'bone.t10',
    'bone.t11',
    'bone.t12',
    'bone.l1',
    'bone.l2',
    'bone.l3',
    'bone.l4',
    'bone.l5',
    'bone.clavicle',
    'bone.scapula',
  ],
};

// 跨關節肌之節段歸屬：取其 relatedJoints 對應之諸 segment 中「最近端」者（深度最小、平手取優先序）。
// 不對應任何受擁 segment（relatedJoints 皆未在 JOINT_TO_SEGMENT）→ null（騎乘固定基座）。
export function segmentForMuscle(relatedJoints: readonly string[]): string | null {
  const segments = new Set<string>();
  for (const j of relatedJoints) {
    const seg = JOINT_TO_SEGMENT[j];
    if (seg !== undefined) segments.add(seg);
  }
  if (segments.size === 0) return null;
  let best: string | null = null;
  for (const seg of segments) {
    if (best === null) {
      best = seg;
      continue;
    }
    const d = SEGMENT_DEPTH[seg] ?? 99;
    const db = SEGMENT_DEPTH[best] ?? 99;
    if (d < db || (d === db && SEGMENT_PRIORITY.indexOf(seg) < SEGMENT_PRIORITY.indexOf(best))) {
      best = seg;
    }
  }
  return best;
}

// 肌肉節段歸屬人工校正（curated override；§4.3.3「半自動分群＋人工校正」）：
// segmentForMuscle 以 relatedJoints（肌「作用」的關節）推節段，但外在肌之肌腹（belly）位於其所跨
// 關節的「近端」節段——單關節肌時兩者背離，使肌腹被誤歸遠端節段、隨遠端剛性旋轉而整條脫離。
// 此 map 把這類肌歸正確節段（肌腹所在）。無法以 relatedJoints 自動辨識（如三角肌亦單關節 [盂肱]
// 但肌腹罩於上臂、歸手臂才對），故採資料化人工校正。涵蓋下肢；肘/腕/指為手臂內屬關節、上肢全段
// 同動故無此問題。
export const MUSCLE_SEGMENT_OVERRIDE: Readonly<Record<string, string>> = {
  // 股四頭單關節三頭：肌腹在股骨 → 大腿（非小腿），膝旋轉不帶動
  'muscle.vastusLateralis': 'joint.hip',
  'muscle.vastusMedialis': 'joint.hip',
  'muscle.vastusIntermedius': 'joint.hip',
  // 小腿外在肌：肌腹在脛／腓骨 → 小腿（非足），踝旋轉不帶動（肌腱過踝至足）
  'muscle.soleus': 'joint.knee',
  'muscle.tibialisAnterior': 'joint.knee',
  'muscle.tibialisPosterior': 'joint.knee',
  'muscle.fibularisLongus': 'joint.knee',
  'muscle.fibularisBrevis': 'joint.knee',
  'muscle.fibularisTertius': 'joint.knee',
  'muscle.extensorDigitorumLongus': 'joint.knee',
  'muscle.extensorHallucisLongus': 'joint.knee',
  'muscle.flexorDigitorumLongus': 'joint.knee',
  'muscle.flexorHallucisLongus': 'joint.knee',
};

// 解析各節段之全部成員（側別無關 anatomyId）：curated 骨 ＋ 由 override／relatedJoints 推導之肌。
export function resolveSegmentMembership(
  entities: readonly AnatomyEntity[],
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const segId of MOVABLE_JOINT_IDS) result.set(segId, [...(SEGMENT_BONES[segId] ?? [])]);
  for (const e of entities) {
    if (e.type !== 'muscle') continue;
    const seg = MUSCLE_SEGMENT_OVERRIDE[e.anatomyId] ?? segmentForMuscle(e.relatedJoints ?? []);
    if (seg !== null) result.get(seg)!.push(e.anatomyId);
  }
  return result;
}

// 讀 definitions 之某關節某軸 DOF（ROM 來源）。
export function movableJointDof(jointId: string, axis: string): DegreeOfFreedom | undefined {
  const entity = anatomyEntityById.get(jointId);
  if (entity === undefined || entity.type !== 'joint') return undefined;
  return entity.degreesOfFreedom.find((d) => d.axis === axis);
}

// 側別正規化（左右獨立，§4.3.3）：雙側關節→保證 '#L'/'#R'（缺則預設 '#R'）；單側關節→null。
// 供 poseKey 與 rig getPivot 之側別一致（雙側 pivot 鍵帶後綴、單側不帶）。
export function normalizeSide(jointId: string, side: string | null): string | null {
  return JOINT_KINEMATICS[jointId]?.bilateral === true ? (side ?? '#R') : null;
}

// 姿態鍵（左右獨立，§4.3.3）：雙側關節附 #L/#R 後綴、單側關節用裸 jointId。與 rig pivotKey 同規則，
// 使 pose 每側獨立。idempotent：poseKey(j, poseKey 已正規化之 side) 不變。
export function poseKey(jointId: string, side: string | null): string {
  const s = normalizeSide(jointId, side);
  return s === null ? jointId : `${jointId}${s}`;
}

// 額狀／橫狀面動作於身體中線左右鏡像（外展/內收、內翻/外翻、內旋/外旋）；
// 矢狀面（屈伸／蹠背屈）左右同向、不鏡像。單一世界 sign 驅動雙側，故左側 ROM＝右側鏡像。
const MIRRORED_AXES: ReadonlySet<string> = new Set([
  'abductionAdduction',
  'inversionEversion',
  'internalExternalRotation',
]);

// 是否為左右鏡像軸（額狀／橫狀面：外展內收／內翻外翻／內外旋）。包裝 MIRRORED_AXES、不外露 Set。
export function isMirroredAxis(axis: string): boolean {
  return MIRRORED_AXES.has(axis);
}

// 側別感知 ROM（左右鏡像，§4.3.3）：definitions 存右側值。雙側關節之鏡像軸左側取 [-max, -min]；
// 右側、矢狀面軸、單側關節皆原值。對稱範圍（如 [-45,45]）鏡像為無作用，故與右側相同。
export function jointDofForSide(
  jointId: string,
  axis: string,
  side: string | null,
): DegreeOfFreedom | undefined {
  const dof = movableJointDof(jointId, axis);
  if (dof === undefined) return undefined;
  if (side === '#L' && MIRRORED_AXES.has(axis) && JOINT_KINEMATICS[jointId]?.bilateral === true) {
    return { ...dof, min: -dof.max, max: -dof.min };
  }
  return dof;
}

// 便利：全部成員一次解析（rig 用）。
export const segmentMembershipAll = (): Map<string, string[]> =>
  resolveSegmentMembership(ALL_ENTITIES);
