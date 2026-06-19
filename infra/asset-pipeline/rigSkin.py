# 全身 rig+skin 管線正式模組（Task 5）：供 exportGltf.py 於 mesh 改名為 anatomyId#L/R 後呼用。
#   build_aligned_armature(skel) → 建 163-bone MakeHuman armature、對位 z-anatomy（Umeyama 全域擬合
#     ＋受驅動骨 per-joint snap）。anchor 以**改名後**節點名（anatomyId#L/R）解析（exportGltf 已改名）。
#   bind_meshes(arm, result_objects, anat_to_joint) → 依節段成員把各 mesh 剛性綁至節段骨（雙側補 .L/.R）、
#     無成員→root。跨關節肌位置漸變蒙皮為後續精修（spike 已驗於腿；此處先全剛性，成員校正已消除整段脫離）。
# 對位/snap 邏輯與 buildArmature.py（Task 3 驗證 harness）一致；此為正式可 import 版。
import bpy
import math
import numpy as np
from mathutils import Vector

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
    return arm


def bind_meshes(arm, result_objects, anat_to_joint):
    """把 result_objects（已改名 anatomyId#L/R 之 mesh）依成員剛性綁至節段骨；無成員→root。
    **僅綁 bone./muscle.**——被動結構（ligament/capsule/disc/bursa/fascia/labrum…）／神經／血管／
    臟器不入 rig（不需旋轉變形），匯出為靜態 mesh（不蒙皮）。回傳已綁定數。"""
    bound = 0
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
        jid = anat_to_joint.get(anat)
        if jid:
            base = SEGMENT_TO_BONE[jid]
            bone = base + (".L" if side == "left" else ".R") if jid in BILATERAL else base
        else:
            bone = "root"
        vg = o.vertex_groups.get(bone) or o.vertex_groups.new(name=bone)
        vg.add(range(len(o.data.vertices)), 1.0, "REPLACE")
        m = o.modifiers.new("arm", "ARMATURE")
        m.object = arm
        m.use_vertex_groups = True
        bound += 1
    return bound
