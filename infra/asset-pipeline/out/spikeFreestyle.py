# 探針（gitignored、暫用）：驗證 headless Blender 是否能以 render_freestyle_svg 產出含 <path> 之 SVG。
# 隔離單一部位、設正交相機、開 Freestyle SVG、低解析算繪，檢查 SVG 是否生成且含路徑。
import bpy
import sys
import os
import json
import math
import addon_utils


def log(msg):
    print("SPIKE " + msg)


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    manifest_path, out_dir = args[0], args[1]
    os.makedirs(out_dir, exist_ok=True)

    with open(manifest_path, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)
    entities = manifest.get("entities", [])

    # 取首個具 sourceObject（單一 MESH）之 entity 當樣本。
    sample = None
    for ent in entities:
        name = ent.get("sourceObject")
        if name and bpy.data.objects.get(name) is not None:
            obj = bpy.data.objects.get(name)
            if obj.type == "MESH":
                sample = (ent["anatomyId"], obj)
                break
    if sample is None:
        log("FAIL 找不到樣本 MESH 來源")
        return
    anatomy_id, obj = sample
    log("SAMPLE %s <- %s" % (anatomy_id, obj.name))

    # 隱藏全部於算繪、僅顯樣本。
    for o in bpy.data.objects:
        o.hide_render = True
    obj.hide_render = False

    # 樣本世界包圍盒 → 中心與尺寸（設正交相機框取）。
    corners = [obj.matrix_world @ v.co for v in obj.data.vertices] if obj.data.vertices else []
    if not corners:
        # 用 bound_box（local）轉世界。
        corners = [obj.matrix_world @ __import__("mathutils").Vector(c) for c in obj.bound_box]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    zs = [c.z for c in corners]
    cx, cy, cz = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, (min(zs) + max(zs)) / 2
    size = max(max(xs) - min(xs), max(zs) - min(zs)) or 1.0

    cam_data = bpy.data.cameras.new("spikeCam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = size * 1.2
    cam = bpy.data.objects.new("spikeCam", cam_data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = (cx, cy - (max(ys) - min(ys)) - 10.0, cz)
    cam.rotation_euler = (math.radians(90), 0, 0)  # 看向 +Y（front）
    bpy.context.scene.camera = cam

    # 引擎：EEVEE（Freestyle 為線描後處理；Workbench 不支援）。5.x id 容錯。
    for engine_id in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
        try:
            bpy.context.scene.render.engine = engine_id
            log("ENGINE %s" % engine_id)
            break
        except Exception as exc:  # noqa: BLE001
            log("ENGINE_SKIP %s (%s)" % (engine_id, exc))

    ok = addon_utils.enable("render_freestyle_svg", default_set=True)
    log("ADDON %s" % (ok,))

    scene = bpy.context.scene
    scene.render.use_freestyle = True
    scene.render.resolution_x = 512
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    # 附加元件之 svg_export 屬性群。
    svg = getattr(scene, "svg_export", None)
    if svg is None:
        log("FAIL scene.svg_export 不存在（附加元件未註冊屬性）")
        return
    svg.use_svg_export = True
    svg.mode = "FRAME"
    scene.frame_set(1)
    scene.render.filepath = os.path.join(out_dir, "spike_")

    try:
        bpy.ops.render.render(write_still=True)
    except Exception as exc:  # noqa: BLE001
        log("RENDER_ERR %s" % exc)
        return

    # 檢查 SVG 產出（附加元件以 filepath＋frame 命名）。
    found = None
    for fn in os.listdir(out_dir):
        if fn.startswith("spike_") and fn.endswith(".svg"):
            found = os.path.join(out_dir, fn)
            break
    if not found:
        log("FAIL 無 SVG 產出")
        return
    with open(found, "r", encoding="utf-8") as fh:
        content = fh.read()
    has_path = "<path" in content
    log("SVG %s bytes=%d has_path=%s" % (os.path.basename(found), len(content), has_path))
    log("OK" if has_path else "FAIL 無 <path>")


if __name__ == "__main__":
    main()
