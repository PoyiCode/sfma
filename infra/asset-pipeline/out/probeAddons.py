# 探針：列出含 svg/freestyle 之 addon 模組，並嘗試各種啟用路徑。
import addon_utils
import bpy


def log(m):
    print("PROBE " + m)


names = [m.__name__ for m in addon_utils.modules()]
hits = [n for n in names if "svg" in n.lower() or "freestyle" in n.lower()]
log("MODULE_COUNT %d" % len(names))
log("HITS %s" % hits)

# 嘗試以可能名稱啟用。
for cand in ["render_freestyle_svg", "bl_ext.blender_org.render_freestyle_svg",
             "bl_ext.system.render_freestyle_svg"]:
    try:
        res = addon_utils.enable(cand, default_set=False)
        log("ENABLE %s -> %s" % (cand, res is not None))
    except Exception as exc:  # noqa: BLE001
        log("ENABLE_ERR %s (%s)" % (cand, exc))

log("HAS_SVG_EXPORT %s" % hasattr(bpy.context.scene, "svg_export"))
