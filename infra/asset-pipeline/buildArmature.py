# 全身 rig+skin 管線 Task 3：由 makehuman-default-skeleton.json 建 163-bone armature、
# 對位 z-anatomy（Y-up→Z-up＋Umeyama 相似擬合於關鍵關節對應點）。throwaway 驗證階段以
# 「z-anatomy 骨 mesh（淡）＋關鍵關節亮球」算圖目視對位。
# 跑法：blender.exe -b z-anatomy.blend -P buildArmature.py -- <skeleton.json> <manifest.json> <outdir>
import bpy, json, sys, math
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
SKEL_JSON, MANIFEST, OUTDIR = argv[0], argv[1], argv[2]


def log(*a):
    print("[arma]", *a)


# 受 binding／driving 之關鍵關節：(label, MH bone, z-anatomy anchor anatomyId, side, face)
# MH 關節點＝該 bone head；z-anatomy anchor＝該骨 mesh 世界 AABB 指定面中心（Z-up）。
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

# 受驅動骨之精確 snap：head→關節 anchor；腿骨 tail→子關節 anchor（exact）、其餘保方向重根。
# 只 snap 受驅動/綁定骨（v1 mesh 依成員綁此六骨）；非驅動中介骨隨全域擬合（不影響 v1）。
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


def yup_to_zup(p):
    # MakeHuman Y-up → Blender/z-anatomy Z-up：(x,y,z)→(x,-z,y)
    return Vector((p[0], -p[2], p[1]))


def manifest_src(manifest, anatomy_id, side):
    for e in manifest["entities"]:
        if e["anatomyId"] == anatomy_id and (side is None or e.get("side") == side):
            return e.get("sourceObjects") or ([e["sourceObject"]] if e.get("sourceObject") else [])
    return []


def world_aabb(objs):
    lo = Vector((math.inf,) * 3)
    hi = Vector((-math.inf,) * 3)
    for o in objs:
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3):
                lo[i] = min(lo[i], w[i])
                hi[i] = max(hi[i], w[i])
    return lo, hi


def face_center(lo, hi, face):
    c = [(lo[i] + hi[i]) / 2 for i in range(3)]
    if face == "maxZ":
        c[2] = hi[2]
    elif face == "minZ":
        c[2] = lo[2]
    return Vector(c)


def main():
    skel = json.load(open(SKEL_JSON, encoding="utf-8"))
    manifest = json.load(open(MANIFEST, encoding="utf-8"))
    bones = skel["bones"]
    log("skeleton bones:", len(bones))

    # z-anatomy anchors（對應點）
    za_anchor = {}
    for label, mh_bone, anat, side, face in BINDING:
        names = manifest_src(manifest, anat, side)
        objs = [bpy.data.objects[n] for n in names if n in bpy.data.objects]
        if not objs:
            log("WARN no z-anatomy mesh for", label, anat, side, names)
            continue
        lo, hi = world_aabb(objs)
        za_anchor[label] = face_center(lo, hi, face)
    log("resolved anchors:", len(za_anchor), "/", len(BINDING))

    # MH 關節點（Y-up→Z-up）
    mh_pt = {}
    for label, mh_bone, *_ in BINDING:
        if mh_bone in bones:
            mh_pt[label] = yup_to_zup(bones[mh_bone]["head"])

    # Umeyama 相似擬合：MH → z-anatomy（用兩者皆有之對應點）
    labels = [l for l in mh_pt if l in za_anchor]
    src = np.array([list(mh_pt[l]) for l in labels])
    dst = np.array([list(za_anchor[l]) for l in labels])
    log("correspondences:", len(labels), labels)
    mu_s, mu_d = src.mean(0), dst.mean(0)
    sc, dc = src - mu_s, dst - mu_d
    H = sc.T @ dc / len(labels)
    U, D, Vt = np.linalg.svd(H)
    S = np.eye(3)
    if np.linalg.det(U) * np.linalg.det(Vt) < 0:
        S[2, 2] = -1
    R = (Vt.T @ S @ U.T)
    var_s = (sc ** 2).sum() / len(labels)
    scale = (D * np.diag(S)).sum() / var_s
    t = mu_d - scale * (R @ mu_s)
    log("fit scale:", round(float(scale), 4))

    def xform(p):
        v = np.array(list(p))
        out = scale * (R @ v) + t
        return Vector((float(out[0]), float(out[1]), float(out[2])))

    # 對位殘差（cm；z-anatomy≈公尺）：單一相似擬合無法令比例不同之 MH/z-anatomy 全對應點重合，
    # 殘差大者＝需後續精確 snap。
    log("residuals (cm) after global fit:")
    for l in labels:
        d = (xform(mh_pt[l]) - za_anchor[l]).length * 100.0
        log("   %-12s %.2f" % (l, d))

    # 建 armature（Y-up→Z-up→xform）
    arm_data = bpy.data.armatures.new("mh_rig")
    arm = bpy.data.objects.new("mh_rig", arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones
    created = {}
    for name, b in bones.items():
        e = eb.new(name)
        e.head = xform(yup_to_zup(b["head"]))
        e.tail = xform(yup_to_zup(b["tail"]))
        created[name] = e
    for name, b in bones.items():
        p = b.get("parent")
        if p and p in created:
            created[name].parent = created[p]
    # 精確 snap 受驅動骨（edit mode 內）
    snapped = {}
    for bname, (head_label, tail_spec) in SNAP.items():
        e = created.get(bname)
        if e is None or head_label not in za_anchor:
            continue
        e.use_connect = False
        old_h, old_t = e.head.copy(), e.tail.copy()
        e.head = za_anchor[head_label].copy()
        if tail_spec[0] == "anchor" and tail_spec[1] in za_anchor:
            e.tail = za_anchor[tail_spec[1]].copy()
        else:
            e.tail = e.head + (old_t - old_h)
        snapped[bname] = (e.head.copy(), e.tail.copy())
    bpy.ops.object.mode_set(mode="OBJECT")
    log("armature built:", len(created), "bones; snapped:", len(snapped))

    # 驗證視覺化：隱藏全部、只顯骨 mesh（淡）＋關鍵關節亮球（對位後 MH bone head 與 z-anatomy anchor 各一）
    bone_names = set()
    for e in manifest["entities"]:
        if e.get("layer") == "bone":
            for n in (e.get("sourceObjects") or ([e["sourceObject"]] if e.get("sourceObject") else [])):
                bone_names.add(n)
    keep = {bpy.data.objects[n] for n in bone_names if n in bpy.data.objects}
    for o in list(bpy.data.objects):
        # 刪非骨 mesh ＋ 全部 FONT/CURVE（z-anatomy 標籤/曲線雜訊）；留 armature。
        if o.type in ("FONT", "CURVE"):
            bpy.data.objects.remove(o, do_unlink=True)
        elif o.type == "MESH" and o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    pale = bpy.data.materials.new("pale")
    pale.diffuse_color = (0.9, 0.87, 0.78, 1.0)
    for o in keep:
        o.hide_render = False
        o.hide_viewport = False
        for c in list(o.users_collection):
            c.objects.unlink(o)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.clear()
        o.data.materials.append(pale)
        o.data.polygons.foreach_set("use_smooth", [True] * len(o.data.polygons))

    # 球：z-anatomy anchor（綠）＋對位後 MH 關節 bone head（紅）；兩者應重合＝對位佳
    def sphere(name, pos, rgb, dia):
        m = bpy.data.meshes.new(name)
        ob = bpy.data.objects.new(name, m)
        bpy.context.scene.collection.objects.link(ob)
        bpy.ops.object.select_all(action="DESELECT")
        bm = bpy.data.objects[name]
        # 用 primitive
        bpy.data.objects.remove(ob, do_unlink=True)
        bpy.ops.mesh.primitive_uv_sphere_add(radius=dia / 2, location=pos)
        s = bpy.context.active_object
        s.name = name
        mat = bpy.data.materials.new(name + "m")
        mat.diffuse_color = (*rgb, 1.0)
        s.data.materials.append(mat)
        return s

    # 受驅動骨以橙柱呈現（snapped head→tail，應落在對應骨內）；z-anatomy anchor 綠球。
    def cylinder(name, h, t, rgb, rad):
        vec = t - h
        if vec.length < 1e-6:
            return
        bpy.ops.mesh.primitive_cylinder_add(radius=rad, depth=vec.length, location=(h + t) / 2)
        c = bpy.context.active_object
        c.name = name
        c.rotation_mode = "QUATERNION"
        c.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(vec.normalized())
        m = bpy.data.materials.new(name + "m")
        m.diffuse_color = (*rgb, 1.0)
        c.data.materials.append(m)

    for bname, (h, t) in snapped.items():
        cylinder("drv_" + bname, h, t, (1.0, 0.5, 0.1), 0.012)
    for label in labels:
        sphere("za_" + label, za_anchor[label], (0.2, 1.0, 0.3), 0.05)  # 綠＝anchor

    # 算圖
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.use_freestyle = False
    scene.render.use_compositing = False
    scene.use_nodes = False
    scene.render.resolution_x = 800
    scene.render.resolution_y = 1300
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.color_type = "MATERIAL"
    sh.show_shadows = False
    sh.show_cavity = False
    sh.show_object_outline = False

    lo, hi = world_aabb(list(keep))
    center = (lo + hi) / 2
    diag = (hi - lo).length
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = diag * 1.05
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    def render(name, offset):
        cam.location = center + offset
        cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = OUTDIR.rstrip("/\\") + "/arma_" + name + ".png"
        bpy.ops.render.render(write_still=True)
        log("rendered", scene.render.filepath)

    render("front", Vector((0, -diag, 0)))
    render("side", Vector((diag, 0, 0)))


main()
