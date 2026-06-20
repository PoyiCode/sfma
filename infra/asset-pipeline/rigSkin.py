# 全身 rig+skin 管線正式模組（Task 5）：供 exportGltf.py 於 mesh 改名為 anatomyId#L/R 後呼用。
#   build_aligned_armature(skel) → 建 163-bone MakeHuman armature、對位 z-anatomy（Umeyama 全域擬合
#     ＋受驅動骨 per-joint snap）。anchor 以**改名後**節點名（anatomyId#L/R）解析（exportGltf 已改名）。
#   bind_meshes(arm, result_objects, anat_to_joint) → 依節段成員把各 mesh 剛性綁至節段骨（雙側補 .L/.R）、
#     無成員→root。跨關節肌位置漸變蒙皮為後續精修（spike 已驗於腿；此處先全剛性，成員校正已消除整段脫離）。
# 對位/snap 邏輯與 buildArmature.py（Task 3 驗證 harness）一致；此為正式可 import 版。
import bpy
import math
import numpy as np
from mathutils import Matrix, Quaternion, Vector

SEGMENT_TO_BONE = {
    "joint.hip": "upperleg01",
    "joint.knee": "lowerleg01",
    "joint.ankle": "foot",
    "joint.glenohumeral": "upperarm01",
    "joint.spine": "spine05",
    "joint.cervicalSpine": "neck01",
}
BILATERAL = {"joint.hip", "joint.knee", "joint.ankle", "joint.glenohumeral"}

# (label, MH bone, anchor anatomyId, side, face)
BINDING = [
    ("hip.L", "upperleg01.L", "bone.femur", "left", "maxZ"),
    ("hip.R", "upperleg01.R", "bone.femur", "right", "maxZ"),
    ("knee.L", "lowerleg01.L", "bone.tibia", "left", "maxZ"),
    ("knee.R", "lowerleg01.R", "bone.tibia", "right", "maxZ"),
    ("ankle.L", "foot.L", "bone.tibia", "left", "minZ"),
    ("ankle.R", "foot.R", "bone.tibia", "right", "minZ"),
    ("shoulder.L", "upperarm01.L", "bone.humerus", "left", "maxZ"),
    ("shoulder.R", "upperarm01.R", "bone.humerus", "right", "maxZ"),
    ("lumbosacral", "spine05", "bone.sacrum", None, "maxZ"),
    ("cervical", "neck01", "bone.t1", None, "maxZ"),
]
SNAP = {
    "upperleg01.L": ("hip.L", ("anchor", "knee.L")),
    "upperleg01.R": ("hip.R", ("anchor", "knee.R")),
    "lowerleg01.L": ("knee.L", ("anchor", "ankle.L")),
    "lowerleg01.R": ("knee.R", ("anchor", "ankle.R")),
    "foot.L": ("ankle.L", ("dir",)),
    "foot.R": ("ankle.R", ("dir",)),
    "upperarm01.L": ("shoulder.L", ("dir",)),
    "upperarm01.R": ("shoulder.R", ("dir",)),
    "spine05": ("lumbosacral", ("dir",)),
    "neck01": ("cervical", ("dir",)),
}


def _node_name(anatomy_id, side):
    return anatomy_id + ("#R" if side == "right" else "#L" if side == "left" else "")


def _yup_to_zup(p):
    return Vector((p[0], -p[2], p[1]))


def _world_aabb(objs):
    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
    return lo, hi


def _face_center(lo, hi, face):
    c = [(lo[i] + hi[i]) / 2 for i in range(3)]
    c[2] = hi[2] if face == "maxZ" else lo[2]
    return Vector(c)


def build_aligned_armature(skel):
    """建 MakeHuman armature 並對位 z-anatomy。anchor 以改名後節點名（anatomyId#L/R）解析。
    回傳 armature object。須於 exportGltf 改名 mesh 後呼用。"""
    bones = skel["bones"]
    za = {}
    for label, _mh, anat, side, face in BINDING:
        o = bpy.data.objects.get(_node_name(anat, side))
        if o is not None:
            lo, hi = _world_aabb([o])
            za[label] = _face_center(lo, hi, face)
    mh = {l: _yup_to_zup(bones[mhn]["head"]) for l, mhn, *_ in BINDING if mhn in bones}
    labels = [l for l in mh if l in za]
    s = np.array([list(mh[l]) for l in labels])
    d = np.array([list(za[l]) for l in labels])
    ms, md = s.mean(0), d.mean(0)
    sc, dc = s - ms, d - md
    U, D, Vt = np.linalg.svd(sc.T @ dc / len(labels))
    S = np.eye(3)
    if np.linalg.det(U) * np.linalg.det(Vt) < 0:
        S[2, 2] = -1
    R = Vt.T @ S @ U.T
    scale = (D * np.diag(S)).sum() / ((sc ** 2).sum() / len(labels))
    t = md - scale * (R @ ms)

    def xf(p):
        o = scale * (R @ np.array(list(p))) + t
        return Vector((float(o[0]), float(o[1]), float(o[2])))

    arm = bpy.data.objects.new("mh_rig", bpy.data.armatures.new("mh_rig"))
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    created = {}
    for name, b in bones.items():
        e = eb.new(name)
        e.head = xf(_yup_to_zup(b["head"]))
        e.tail = xf(_yup_to_zup(b["tail"]))
        created[name] = e
    for name, b in bones.items():
        if b.get("parent") in created:
            created[name].parent = created[b["parent"]]
    for bname, (hl, ts) in SNAP.items():
        e = created.get(bname)
        if e is None or hl not in za:
            continue
        e.use_connect = False
        oh, ot = e.head.copy(), e.tail.copy()
        e.head = za[hl].copy()
        e.tail = za[ts[1]].copy() if ts[0] == "anchor" and ts[1] in za else e.head + (ot - oh)
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm, za


# jointId → za anchor 標籤基底（雙側補 .L/.R）。
ANCHOR_LABEL = {
    "joint.hip": "hip",
    "joint.knee": "knee",
    "joint.ankle": "ankle",
    "joint.glenohumeral": "shoulder",
    "joint.spine": "lumbosacral",
    "joint.cervicalSpine": "cervical",
}


def _bone_for(jid, side):
    base = SEGMENT_TO_BONE[jid]
    return base + (".L" if side == "left" else ".R") if jid in BILATERAL else base


def _anchor_key(jid, side):
    base = ANCHOR_LABEL[jid]
    return base + (".L" if side == "left" else ".R") if jid in BILATERAL else base


def _add_armature_mod(o, arm):
    m = o.modifiers.new("arm", "ARMATURE")
    m.object = arm
    m.use_vertex_groups = True


def bind_meshes(arm, result_objects, anat_to_joint, za=None, cross_joint=None):
    """把 result_objects（已改名 anatomyId#L/R 之 mesh）綁至骨架。
    **僅綁 bone./muscle.**——被動結構／神經／血管／臟器不入 rig（不需旋轉變形）、靜態匯出。
    跨關節肌（cross_joint）於子關節處沿 proximal→distal 軸位置漸變蒙皮（spike 技法）；其餘剛性綁
    至節段骨（無成員→root）。za＝build_aligned_armature 回傳之關節 anchor。回傳已綁定數。"""
    za = za or {}
    cross_joint = cross_joint or {}
    bound = 0
    blended = 0
    for o in result_objects:
        if o.type != "MESH":
            continue
        name = o.name
        side = None
        anat = name
        if name.endswith("#L"):
            side, anat = "left", name[:-2]
        elif name.endswith("#R"):
            side, anat = "right", name[:-2]
        if not (anat.startswith("bone.") or anat.startswith("muscle.")):
            continue  # 被動結構/神經/血管/臟器：不入 rig、靜態匯出

        # 跨關節肌位置漸變蒙皮：於子關節 anchor 沿 proximal→distal 軸於兩骨間平滑混合。
        bp = cross_joint.get(anat)
        if bp:
            p_anchor = za.get(_anchor_key(bp["proximal"], side))
            d_anchor = za.get(_anchor_key(bp["distal"], side))
            if p_anchor is not None and d_anchor is not None and (d_anchor - p_anchor).length > 1e-6:
                axis = (d_anchor - p_anchor)
                length = axis.length
                axis = axis / length
                # 過渡半寬：localize 至關節處 ~3cm crease（過寬→大區塊 LBS 塌陷、中度屈曲即壓扁）。
                band = min(0.03, length * 0.5)
                pbone = _bone_for(bp["proximal"], side)
                dbone = _bone_for(bp["distal"], side)
                vg_p = o.vertex_groups.get(pbone) or o.vertex_groups.new(name=pbone)
                vg_d = o.vertex_groups.get(dbone) or o.vertex_groups.new(name=dbone)
                mw = o.matrix_world
                for i, v in enumerate(o.data.vertices):
                    t = (mw @ v.co - d_anchor).dot(axis)
                    wd = max(0.0, min(1.0, (t + band) / (2.0 * band)))
                    vg_d.add([i], wd, "REPLACE")
                    vg_p.add([i], 1.0 - wd, "REPLACE")
                _add_armature_mod(o, arm)
                bound += 1
                blended += 1
                continue

        # 剛性綁定（非跨關節肌或 anchor 不全）
        jid = anat_to_joint.get(anat)
        bone = _bone_for(jid, side) if jid else "root"
        vg = o.vertex_groups.get(bone) or o.vertex_groups.new(name=bone)
        vg.add(range(len(o.data.vertices)), 1.0, "REPLACE")
        _add_armature_mod(o, arm)
        bound += 1
    return bound, blended


# === 極限屈曲 corrective shape keys（spec 2026-06-20）===
# 子關節屈曲 ROM max（與 definitions 對齊；morph 於此角度烘焙全量修正）。
CORRECTIVE_REF_DEG = {
    "joint.knee": 140.0,
    "joint.hip": 120.0,
    "joint.ankle": 50.0,
}
# Blender 子骨屈曲姿勢：(euler 軸 index, sign)。膝已驗 local-X 正＝矢狀屈曲；髖/踝待 MCP 校正（Task 6）。
CORRECTIVE_POSE_AXIS = {
    "joint.knee": (0, 1.0),
    "joint.hip": (0, 1.0),
    "joint.ankle": (0, 1.0),
}
CORRECTIVE_EPS = 1e-4  # rest-space delta 門檻（m）；以下不寫入（稀疏化）。


def _vgroup_weights(o, vg_index):
    """回 {vertex_index: weight}（指定 vertex group 之逐頂點權重）。"""
    w = {}
    for v in o.data.vertices:
        for g in v.groups:
            if g.group == vg_index:
                w[v.index] = g.weight
                break
    return w


def add_corrective_shapekeys(arm, result_objects, anat_to_joint, za, cross_joint):
    """跨關節肌極限屈曲 corrective shape key：保體積目標（四元數混合旋轉）− LBS 之 rest-space
    delta。須於 bind_meshes 後、export 前呼用。回 (mesh 數, target 數)。"""
    import bpy
    n_mesh = 0
    n_target = 0
    for o in result_objects:
        if o.type != "MESH":
            continue
        name = o.name
        side, anat = None, name
        if name.endswith("#L"):
            side, anat = "left", name[:-2]
        elif name.endswith("#R"):
            side, anat = "right", name[:-2]
        bp = cross_joint.get(anat)
        if not bp:
            continue
        distal = bp["distal"]
        ref = CORRECTIVE_REF_DEG.get(distal)
        if ref is None:
            continue
        dbone = _bone_for(distal, side)
        pbone = _bone_for(bp["proximal"], side)
        if dbone not in arm.pose.bones or pbone not in arm.pose.bones:
            continue
        vg_d = o.vertex_groups.get(dbone)
        vg_p = o.vertex_groups.get(pbone)
        if vg_d is None or vg_p is None:
            continue
        wd = _vgroup_weights(o, vg_d.index)
        wp = _vgroup_weights(o, vg_p.index)
        band = [i for i in wd if wd[i] > 1e-6 and wp.get(i, 0.0) > 1e-6]
        if not band:
            continue

        # rest 世界蒙皮基底矩陣（mathutils，供 to_quaternion／反矩陣）。
        Mp_rest = arm.matrix_world @ arm.pose.bones[pbone].bone.matrix_local
        Md_rest = arm.matrix_world @ arm.pose.bones[dbone].bone.matrix_local

        # 子骨屈曲 ref。
        axis_i, sign = CORRECTIVE_POSE_AXIS[distal]
        pbd = arm.pose.bones[dbone]
        old_mode, old_euler = pbd.rotation_mode, tuple(pbd.rotation_euler)
        pbd.rotation_mode = "XYZ"
        eul = [0.0, 0.0, 0.0]
        eul[axis_i] = math.radians(ref) * sign
        pbd.rotation_euler = eul
        bpy.context.view_layer.update()

        Sp_m = (arm.matrix_world @ arm.pose.bones[pbone].matrix) @ Mp_rest.inverted()
        Sd_m = (arm.matrix_world @ arm.pose.bones[dbone].matrix) @ Md_rest.inverted()

        pbd.rotation_euler = old_euler
        pbd.rotation_mode = old_mode
        bpy.context.view_layer.update()

        Sp = np.array(Sp_m)
        Sd = np.array(Sd_m)
        qp = Sp_m.to_quaternion()
        qd = Sd_m.to_quaternion()
        tp, td = Sp_m.translation, Sd_m.translation

        mw = o.matrix_world
        mwi = mw.inverted()
        if o.data.users > 1:
            o.data = o.data.copy()  # 避免共享 datablock 致 shape key 重複/幾何串擾（.001）
        if o.data.shape_keys is None:
            o.shape_key_add(name="Basis", from_mix=False)
        key = o.shape_key_add(name="corr.%s" % distal, from_mix=False)

        wrote = 0
        for i in band:
            a = wp.get(i, 0.0)
            b = wd.get(i, 0.0)
            s = a + b
            if s <= 1e-9:
                continue
            a, b = a / s, b / s
            co = o.data.vertices[i].co
            p_w = mw @ co
            # LBS（線性矩陣混合）。
            M = a * Sp + b * Sd
            # 保體積目標：四元數混合旋轉（對齊半球）＋線性平移。
            qb = qp * a + (qd if qd.dot(qp) >= 0 else qd * -1.0) * b
            qb.normalize()
            T = Matrix.Translation(a * tp + b * td) @ qb.to_matrix().to_4x4()
            target_w = T @ p_w
            # 穩定 corrective：取 LBS 與保體積目標於 posed 空間之差 ΔP，以穩定的混合旋轉 qb⁻¹ 轉回 rest
            # 位移。直接解 M_blend⁻¹·target 於大角度近奇異（兩骨旋轉相距大→混合矩陣退化）會爆裂尖刺；
            # 改以有界位移（≈塌陷距離）＋clamp 5cm 防殘餘尖刺，犧牲精確換穩定（退化處改為部分修正、不爆）。
            lbs_w = M @ np.array([p_w[0], p_w[1], p_w[2], 1.0])
            dP = Vector((target_w[0] - lbs_w[0], target_w[1] - lbs_w[1], target_w[2] - lbs_w[2]))
            d_rest = qb.inverted() @ dP
            if d_rest.length > 0.05:
                d_rest = d_rest * (0.05 / d_rest.length)
            new_local = mwi @ (p_w + d_rest)
            if (new_local - co).length < CORRECTIVE_EPS:
                continue
            key.data[i].co = new_local
            wrote += 1
        if wrote == 0:
            o.shape_key_remove(key)
            continue
        n_mesh += 1
        n_target += 1
    return n_mesh, n_target
