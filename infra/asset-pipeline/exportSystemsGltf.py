# 原始系統不壓縮 glb 匯出（3D 精簡化前＋2D 描繪基準；**不入 App**）。
# 別於 manifest 驅動之 exportGltf.py（策劃、anatomyId 命名、減面、Draco）——本腳本
# **collection 驅動**：直接輸出指定頂層系統集合之原始幾何，因策劃 manifest 不含
# 「Muscular insertions」等系統（實測 0 件），無法以 manifest 達成使用者「輸出系統 1/2/3/4/7」。
# 沿用「之前的方法」＝相同 headless Blender→glb 匯出技術／設定／curveToMesh，惟：
#   - Draco 全關（不壓縮）
#   - 不加 DECIMATE（精簡化前＝全解析度）
#   - 不改名／不套扁平材質（保原始）
# 排除 FONT（標籤）/EMPTY/LIGHT/CAMERA 與零多邊形 MESH（.j 類錨點）；CURVE→管狀 mesh。
#
# 用法：
#   blender.exe -b "<z-anatomy.blend>" -P exportSystemsGltf.py -- "<out_dir>"
import bpy
import sys
import os
import re

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipelineCommon import curveToMesh  # noqa: E402（須先注入 sys.path）

# 頂層系統 collection 名帶數字前綴（實檔「1: Skeletal system」…）；比對前去除前綴。
SYSTEM_PREFIX_RE = re.compile(r"^\s*\d+:\s*")
# 使用者指定之 5 系統 → 輸出檔 slug（camelCase、嚴禁 snake_case）。
SYSTEMS = [
    ("Skeletal system", "skeletal"),
    ("Muscular insertions", "muscularInsertions"),
    ("Joints", "joints"),
    ("Muscular system", "muscularSystem"),
    ("Nervous system & Sense organs", "nervous"),
]
# 神經 CURVE 轉管之 bevel（沿用 manifestV1.json 神經 curveBevel；使神經成可見管狀）。
NERVE_BEVEL = {"depth": 0.0015, "resolution": 2}


def normName(name):
    return SYSTEM_PREFIX_RE.sub("", name).strip()


def gatherSystemObjects(topColl):
    """收集系統 collection 之可算繪幾何：MESH（非零多邊形）＋CURVE→mesh；排除 FONT/EMPTY 等。"""
    result = []
    for obj in topColl.all_objects:
        if obj.type == "CURVE":
            mesh = curveToMesh(obj, NERVE_BEVEL)
            if mesh.data is not None and len(mesh.data.polygons) > 0:
                result.append(mesh)
        elif obj.type == "MESH":
            if obj.data is not None and len(obj.data.polygons) > 0:
                result.append(obj)
    return result


def deselectAllRobust():
    """穩健全取消選取：逐 view_layer 全物件 select_set(False)。
    別於 pipelineCommon.deselectAll（迭代 bpy.context.selected_objects）——後者於 headless
    多次匯出間不可靠（實測：第二次後 selected_objects 失準致選取累積、per-system glb 互相污染），
    迭代 view_layer.objects 全集為確定性、不依賴選取狀態。"""
    for o in bpy.context.view_layer.objects:
        o.select_set(False)


def exportSelection(objs, out_path):
    deselectAllRobust()
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        # 不壓縮（不啟用 Draco）；精簡化前全解析度（不加 DECIMATE，亦不設 cap）。
        export_draco_mesh_compression_enable=False,
    )
    return os.path.getsize(out_path)


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out_dir = args[0] if args else "out"
    os.makedirs(out_dir, exist_ok=True)

    topByName = {}
    for top in bpy.context.scene.collection.children:
        topByName[normName(top.name)] = top

    allObjs = []
    seen = set()
    perSystem = []
    for sysName, slug in SYSTEMS:
        top = topByName.get(sysName)
        if top is None:
            print("SYSTEMS_EXPORT_WARN 找不到系統 collection：%s" % sysName)
            continue
        objs = gatherSystemObjects(top)
        if not objs:
            print("SYSTEMS_EXPORT_WARN 系統無可匯出幾何：%s" % sysName)
            continue
        out_path = os.path.join(out_dir, "anatomyFull.%s.glb" % slug)
        size = exportSelection(objs, out_path)
        print("SYSTEMS_EXPORT system=%s objects=%d bytes=%d -> %s" % (slug, len(objs), size, out_path))
        perSystem.append((slug, len(objs), size))
        for o in objs:
            if o.name not in seen:
                seen.add(o.name)
                allObjs.append(o)

    if not allObjs:
        print("SYSTEMS_EXPORT_ERR 無可匯出物件")
        return

    master_path = os.path.join(out_dir, "anatomyFull.master.glb")
    master_size = exportSelection(allObjs, master_path)
    print("SYSTEMS_EXPORT system=master objects=%d bytes=%d -> %s" % (
        len(allObjs), master_size, master_path))

    per_total = sum(n for _, n, _ in perSystem)
    print("SYSTEMS_EXPORT_OK systems=%d per_system_total=%d master_objects=%d" % (
        len(perSystem), per_total, len(allObjs)))


if __name__ == "__main__":
    main()
