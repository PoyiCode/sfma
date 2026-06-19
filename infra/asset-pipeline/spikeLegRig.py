# 一條腿綁骨蒙皮可行性 spike（throwaway；04 §4.3.3 skin 變形 de-risk）。
# 目的：把右腿跨膝肌（股四頭/腿後/腓腸）以最小 3 骨 armature ＋ 自動權重（ARMATURE_AUTO）綁定，
# 彎膝算圖前後對比，判定「自動蒙皮的解剖 mesh 變形可不可接受」。非管線正式產物。
#
# 跑法（headless）：blender.exe -b <z-anatomy.blend> -P spikeLegRig.py -- <manifest.json> <outdir>
import bpy, json, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
MANIFEST, OUTDIR = argv[0], argv[1]

TARGET_BONES = ["bone.femur", "bone.tibia", "bone.fibula", "bone.patella"]
TARGET_MUSCLES = [
    "muscle.rectusFemoris", "muscle.vastusLateralis", "muscle.vastusMedialis",
    "muscle.vastusIntermedius", "muscle.bicepsFemoris", "muscle.semitendinosus",
    "muscle.semimembranosus", "muscle.gastrocnemius",
]
TARGET = set(TARGET_BONES + TARGET_MUSCLES)


def log(*a):
    print("[spike]", *a)


def main():
    man = json.load(open(MANIFEST, encoding="utf-8"))
    src_names = set()
    bone_src = {}
    for e in man["entities"]:
        if e.get("side") == "right" and e["anatomyId"] in TARGET:
            names = e.get("sourceObjects") or ([e["sourceObject"]] if e.get("sourceObject") else [])
            src_names.update(names)
            if e["anatomyId"] in TARGET_BONES:
                bone_src[e["anatomyId"]] = names
    log("source objects:", sorted(src_names))

    keep = {bpy.data.objects[n] for n in src_names if n in bpy.data.objects}
    missing = src_names - {o.name for o in keep}
    if missing:
        log("WARNING missing source objects:", missing)

    # 先解除 keep 物件對「即將刪除之父」的 parent（保世界變換），避免刪父後位移
    for o in keep:
        if o.parent and o.parent not in keep:
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
    # 刪除非目標物件（減負載、只算右腿）
    for o in list(bpy.data.objects):
        if o not in keep:
            bpy.data.objects.remove(o, do_unlink=True)
    meshes = [o for o in keep if o.type == "MESH"]
    log("kept meshes:", len(meshes))

    # z-anatomy 為互動圖譜，預設多數部位 hide_render／排除於 view layer（骨骼可見、肌肉隱藏）。
    # 強制 keep 物件可見並改掛主集合（永不排除），否則肌肉不算圖。
    for o in keep:
        o.hide_render = False
        o.hide_viewport = False
        o.display_type = "TEXTURED"
        for attr in ("visible_camera", "visible_diffuse", "visible_glossy"):
            if hasattr(o, attr):
                setattr(o, attr, True)
        try:
            o.hide_set(False)
        except Exception:  # noqa: BLE001
            pass
        for c in list(o.users_collection):
            c.objects.unlink(o)
        bpy.context.scene.collection.objects.link(o)
    log("forced-visible + relinked to master:", len(keep))
    for o in [x for x in keep if x.type == "MESH"][:6]:
        me = o.data
        log("MESH", o.name, "v", len(me.vertices), "poly", len(me.polygons),
            "mats", len(me.materials), "disp", o.display_type, "hr", o.hide_render)

    # 世界 AABB
    def wb(objs):
        lo = Vector((math.inf,) * 3)
        hi = Vector((-math.inf,) * 3)
        for o in objs:
            o.data.update() if hasattr(o.data, "update") else None
            for c in o.bound_box:
                w = o.matrix_world @ Vector(c)
                for i in range(3):
                    lo[i] = min(lo[i], w[i])
                    hi[i] = max(hi[i], w[i])
        return lo, hi

    femur = [bpy.data.objects[n] for n in bone_src["bone.femur"]]
    tibia = [bpy.data.objects[n] for n in bone_src["bone.tibia"]]
    flo, fhi = wb(femur)
    tlo, thi = wb(tibia)
    ext = [fhi[i] - flo[i] for i in range(3)]
    up = ext.index(max(ext))  # 股骨最長軸＝鉛直長軸
    horiz = [i for i in range(3) if i != up]
    log("up axis:", up, "femur ext:", [round(x, 3) for x in ext])

    def end(lo, hi, axis, hiend):
        c = [(lo[i] + hi[i]) / 2 for i in range(3)]
        c[axis] = hi[axis] if hiend else lo[axis]
        return Vector(c)

    hip = end(flo, fhi, up, True)     # 股骨近端（上）
    knee = end(tlo, thi, up, True)    # 脛骨近端（上）＝膝
    ankle = end(tlo, thi, up, False)  # 脛骨遠端（下）＝踝
    log("hip", [round(x, 3) for x in hip], "knee", [round(x, 3) for x in knee], "ankle", [round(x, 3) for x in ankle])

    # 建最小 3 骨 armature
    arm_data = bpy.data.armatures.new("legrig")
    arm = bpy.data.objects.new("legrig", arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm_data.edit_bones
    b1 = eb.new("upperleg01.R"); b1.head = hip; b1.tail = knee
    b2 = eb.new("lowerleg01.R"); b2.head = knee; b2.tail = ankle; b2.parent = b1; b2.use_connect = True
    foot_tail = Vector(ankle); foot_tail[horiz[1]] += (thi[horiz[1]] - tlo[horiz[1]]) * 1.5 + 0.05
    b3 = eb.new("foot.R"); b3.head = ankle; b3.tail = foot_tail; b3.parent = b2; b3.use_connect = True
    bpy.ops.object.mode_set(mode="OBJECT")

    # 自動權重綁定（headless 需 temp_override）
    for o in meshes:
        o.select_set(True)
    arm.select_set(True)
    with bpy.context.temp_override(active_object=arm, selected_editable_objects=meshes + [arm], selected_objects=meshes + [arm]):
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    log("bound", len(meshes), "meshes to armature")

    # 自動權重（bone heat）對部分 mesh 會失敗（"no skin"）→ 無頂點群、隨關節不動。
    # 後備：偵測無 deform 群之 mesh，依其質心就近剛性綁至最近骨（weight 1.0）使其跟動。
    bone_mids = {"upperleg01.R": (hip + knee) / 2, "lowerleg01.R": (knee + ankle) / 2, "foot.R": (ankle + foot_tail) / 2}

    def has_real_weight(o):
        idx = {vg.index for vg in o.vertex_groups if vg.name in bone_mids}
        if not idx:
            return False
        for v in o.data.vertices:
            for g in v.groups:
                if g.group in idx and g.weight > 0.0:
                    return True
        return False

    # 後備＝沿腿鉛直軸之位置漸變權重（非剛性單骨）：膝以上→大腿、膝以下→小腿、踝以下→足，
    # 關節處平滑過渡。使跨關節肌（如腓腸肌：起點在股骨、肌腹在小腿）在膝彎曲時於關節處變形、
    # 而非整條剛性甩動穿模。等同 bone-heat 應做之事、此處顯式補上。
    knee_z, ankle_z = knee[up], ankle[up]
    band = (knee_z - ankle_z) * 0.18  # 過渡半寬

    def split(z, joint_z):
        if z >= joint_z + band:
            return 0.0
        if z <= joint_z - band:
            return 1.0
        return (joint_z + band - z) / (2.0 * band)

    for o in meshes:
        if has_real_weight(o):
            continue
        vg_up = o.vertex_groups.get("upperleg01.R") or o.vertex_groups.new(name="upperleg01.R")
        vg_lo = o.vertex_groups.get("lowerleg01.R") or o.vertex_groups.new(name="lowerleg01.R")
        vg_ft = o.vertex_groups.get("foot.R") or o.vertex_groups.new(name="foot.R")
        for v in o.data.vertices:
            z = (o.matrix_world @ v.co)[up]
            tk = split(z, knee_z)
            ta = split(z, ankle_z)
            vg_up.add([v.index], 1.0 - tk, "REPLACE")
            vg_lo.add([v.index], tk * (1.0 - ta), "REPLACE")
            vg_ft.add([v.index], tk * ta, "REPLACE")
        log("positional-blend fallback:", o.name)

    # 指派全新材質（肌肉 muscle-red / 骨 bone-pale）取代來源解剖暗材質；EEVEE 必遵材質、
    # 不受 headless Workbench 忽略 display.shading 之累。並平滑著色去刻面噪訊。
    bone_names = {n for ns in bone_src.values() for n in ns}

    def mk_mat(name, rgb):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
            if "Roughness" in bsdf.inputs:
                bsdf.inputs["Roughness"].default_value = 0.6
        m.diffuse_color = (*rgb, 1.0)
        return m

    mus_mat = mk_mat("spikeMuscle", (0.62, 0.13, 0.11))
    bon_mat = mk_mat("spikeBone", (0.90, 0.86, 0.76))
    for o in meshes:
        o.data.materials.clear()
        o.data.materials.append(bon_mat if o.name in bone_names else mus_mat)
        me = o.data
        me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
        me.update()

    # 算圖設定（Workbench：headless 可靠；MATERIAL 色用上面材質之 diffuse_color＝紅肌/淡骨）
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_WORKBENCH"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 1200
    # z-anatomy 為線稿圖譜：(1) Freestyle 墨線、(2) COMPOSITOR node tree 只輸出其風格化線稿層、
    # 丟棄表面 render → 表面 pass 從不進最終圖（先前所有材質/引擎/著色變更皆作用於被丟棄的 pass）。
    # 關掉 Freestyle＋compositing＋node tree，讓 Workbench 表面直出。
    scene.render.use_freestyle = False
    scene.render.use_compositing = False
    scene.render.use_sequencer = False
    scene.use_nodes = False
    sh = scene.display.shading
    sh.light = "STUDIO"
    sh.color_type = "MATERIAL"
    sh.show_shadows = True
    sh.show_cavity = False
    sh.show_object_outline = False

    # ortho 相機，純側視（沿 mediolateral 軸看矢狀面屈曲）
    center = (hip + ankle) / 2
    leglen = (hip - ankle).length
    cam_data = bpy.data.cameras.new("cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = leglen * 1.7
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    offset = Vector((0, 0, 0))
    offset[horiz[0]] = leglen * 1.8   # 沿 mediolateral 軸（純側視）
    offset[horiz[1]] = leglen * 0.05
    offset[up] = leglen * 0.05
    cam.location = center + offset
    cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()

    pbone = arm.pose.bones["lowerleg01.R"]
    pbone.rotation_mode = "XYZ"

    def render(name, deg):
        pbone.rotation_euler = (math.radians(deg), 0, 0)  # 先試 bone-local X 為屈曲軸
        bpy.context.view_layer.update()
        scene.render.filepath = OUTDIR.rstrip("/\\") + "/spike_" + name + ".png"
        bpy.ops.render.render(write_still=True)
        log("rendered", scene.render.filepath)

    render("neutral", 0)
    render("flex60", 60)
    render("flex90", 90)

    # 順帶匯出 skinned glb（次要產物；失敗不影響算圖）
    try:
        for o in meshes:
            o.select_set(True)
        arm.select_set(True)
        bpy.ops.export_scene.gltf(
            filepath=OUTDIR.rstrip("/\\") + "/spike_leg.glb",
            export_format="GLB",
            use_selection=True,
            export_skins=True,
            export_yup=True,
        )
        log("exported glb")
    except Exception as ex:  # noqa: BLE001
        log("glb export failed (non-fatal):", ex)


main()
