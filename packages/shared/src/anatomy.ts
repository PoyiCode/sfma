import { z } from 'zod';
import { localizedTextSchema } from './common';

// 解剖實體（06 §6.5）：2D／3D、精簡／細節版共用同一 anatomyId
const anatomyBase = {
  schemaVersion: z.number().int().positive(),
  anatomyId: z.string().min(1),
  name: localizedTextSchema,
};

export const muscleSchema = z.object({
  ...anatomyBase,
  type: z.literal('muscle'),
  layer: z.enum(['superficial', 'deep']),
  // 刻意不命名為 side：與判讀紀錄的 side（left/right）區分（06 §6.5）
  symmetry: z.enum(['paired', 'midline']),
  relatedJoints: z.array(z.string()),
  actions: z.array(z.object({ jointId: z.string(), action: z.string() })),
  innervation: z.array(z.string()),
});
export type Muscle = z.infer<typeof muscleSchema>;

export const nerveSchema = z.object({ ...anatomyBase, type: z.literal('nerve') });
export type Nerve = z.infer<typeof nerveSchema>;

export const boneSchema = z.object({ ...anatomyBase, type: z.literal('bone') });
export type Bone = z.infer<typeof boneSchema>;

// 韌帶（06 §6.5）：被動穩定結構（如膝十字／脊椎縱韌帶）。minimal＝base＋type，比照 bone/nerve；
// 膝/脊椎 joint 實體尚未建、暫不加 relatedJoints 以避懸空參考（解3d資產 ㊿）。
export const ligamentSchema = z.object({ ...anatomyBase, type: z.literal('ligament') });
export type Ligament = z.infer<typeof ligamentSchema>;

// 椎間盤（06 §6.5）：椎體間纖維軟骨被動結構（突出/退化＝脊椎主訴）。minimal＝base＋type，
// 比照 ligament；盤內 nucleus/annulus 細部與 joint.spine 耦合為後續（解3d資產 51）。
export const discSchema = z.object({ ...anatomyBase, type: z.literal('disc') });
export type Disc = z.infer<typeof discSchema>;

// 關節囊（06 §6.5）：包覆滑膜關節之纖維被動結構（capsular pattern、沾黏性關節囊炎＝PT 高價值）。
// minimal＝base＋type，比照 ligament/disc（解3d資產 53）。
export const capsuleSchema = z.object({ ...anatomyBase, type: z.literal('capsule') });
export type Capsule = z.infer<typeof capsuleSchema>;

// 關節盤（06 §6.5）：滑膜關節內纖維軟骨盤（TMJ 關節盤＝顳顎關節障礙 TMD 盤前移位/卡頓）。
// 與 disc（椎間盤 intervertebral）分立。minimal＝base＋type，比照 ligament/disc/capsule；
// 半月板/TFCC 同為 articular disc（解3d資產 54 註）→ **半月板已擴入此類型**（膝內/外側半月板、
// 源料 medial 144/lateral 236 verts 良模；解3d資產 關節內被動結構擴張）；TFCC 待源料改善。
export const articularDiscSchema = z.object({ ...anatomyBase, type: z.literal('articularDisc') });
export type ArticularDisc = z.infer<typeof articularDiscSchema>;

// 筋膜（06 §6.5）：包覆肌肉之纖維結締組織鞘膜（含腱膜 aponeurosis，如帽狀腱膜/足底腱膜/掌腱膜）。
// 同 ligament/capsule 屬被動結構、歸 passiveStructure 層。minimal＝base＋type，比照 ligament/disc/
// capsule/articularDisc。開殼鞘膜減面 floor 偏高且遮蔽其下肌肉、simplified 預算已滿→manifest 標
// profiles:["detailed"] 僅納細節版、預設隱藏（解3d資產 58）。
export const fasciaSchema = z.object({ ...anatomyBase, type: z.literal('fascia') });
export type Fascia = z.infer<typeof fasciaSchema>;

// 滑囊（06 §6.5）：充液之纖維囊、降肌腱/骨摩擦（肩峰下/大轉子/髕前等＝滑囊炎 bursitis 常見病灶）。
// 同 ligament/capsule/fascia 屬被動結構、歸 passiveStructure 層。minimal＝base＋type，比照
// ligament/disc/capsule/articularDisc/fascia。預設隱藏、manifest 標 profiles:["detailed"] 僅納
// 細節版（simplified 預算已滿、低階裝置不需；解3d資產 60）。
export const bursaSchema = z.object({ ...anatomyBase, type: z.literal('bursa') });
export type Bursa = z.infer<typeof bursaSchema>;

// 關節唇（06 §6.5）：滑膜關節窩緣之纖維軟骨「唇/緣」（髖臼唇/肩盂唇＝唇撕裂、股骨髖臼夾擠 FAI、
// 肩不穩 SLAP＝PT 高臨床價值）。與 articularDisc（關節內纖維軟骨「盤」如 TMJ 盤/半月板）區辨：
// labrum 為環窩緣、非盤。同屬被動結構、歸 passiveStructure 層。minimal＝base＋type，比照
// ligament/disc/capsule/articularDisc/fascia/bursa（解3d資產 關節內被動結構擴張）。
export const labrumSchema = z.object({ ...anatomyBase, type: z.literal('labrum') });
export type Labrum = z.infer<typeof labrumSchema>;

// 肌群（06 §6.5）：精簡版「肌群合併 mesh」之選取單位（§4.3.5／§4.3.6 終態——精簡版逐肌群、
// 細節版逐肌肉）。base＋type＋layer（superficial/deep，比照 muscle 用以歸 deep/superficialMuscle
// 顯示層）；群組為粗化代表、不帶 muscle 之 relatedJoints/actions/innervation 以避懸空參考。
// 匯出管線以成員肌 profiles:["detailed"]＋群組件 profiles:["simplified"]＋sourceObjects join
// 純資料表達合併、零管線/App 邏輯改動（解3d資產 61）。
export const muscleGroupSchema = z.object({
  ...anatomyBase,
  type: z.literal('muscleGroup'),
  layer: z.enum(['superficial', 'deep']),
});
export type MuscleGroup = z.infer<typeof muscleGroupSchema>;

export const jointSchema = z.object({
  ...anatomyBase,
  type: z.literal('joint'),
  // min/max 即 ROM 上下限，3D 關節活動不可超出（06 §6.5、04）
  degreesOfFreedom: z.array(
    z.object({
      axis: z.string(),
      min: z.number(),
      max: z.number(),
      neutral: z.number(),
      unit: z.literal('deg'),
    }),
  ),
});
export type Joint = z.infer<typeof jointSchema>;

export const anatomyEntitySchema = z.discriminatedUnion('type', [
  muscleSchema,
  nerveSchema,
  boneSchema,
  jointSchema,
  ligamentSchema,
  discSchema,
  capsuleSchema,
  articularDiscSchema,
  fasciaSchema,
  bursaSchema,
  labrumSchema,
  muscleGroupSchema,
]);
export type AnatomyEntity = z.infer<typeof anatomyEntitySchema>;
