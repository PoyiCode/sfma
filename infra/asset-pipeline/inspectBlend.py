# Z-Anatomy .blend 結構勘查（04 §4.6.3 步驟 1–2 偵察）。
# 以 Blender 背景模式執行，輸出 JSON 報告供 glTF 匯出管線規劃（集合分層、命名慣例、
# 骨架、面數概況）。不修改來源檔。
#
# 用法：
#   blender.exe -b "<anatomy.blend>" -P inspectBlend.py -- "<out_report.json>"
#
# 設計依據：§4.6.2（FMA→anatomyId crosswalk）、§4.6.3（製作管線）、§4.3.6（面數預算）。
import bpy
import sys
import json
import re

FMA_RE = re.compile(r"FMA\d+", re.IGNORECASE)
NAME_SAMPLE_CAP = 60


def argv_after_ddash():
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1:]
    return []


def collection_tree(coll, depth=0, acc=None):
    if acc is None:
        acc = []
    acc.append(
        {
            "name": coll.name,
            "depth": depth,
            "directObjects": len(coll.objects),
            "allObjects": len(coll.all_objects),
            "childCollections": [c.name for c in coll.children],
        }
    )
    for child in coll.children:
        collection_tree(child, depth + 1, acc)
    return acc


def main():
    out = argv_after_ddash()
    out_path = out[0] if out else "blend_report.json"

    type_counts = {}
    mesh_objects = 0
    total_polys = 0
    total_verts = 0
    max_poly = {"name": None, "polys": 0}
    name_samples = []
    fma_named = 0
    armatures = []

    for obj in bpy.data.objects:
        type_counts[obj.type] = type_counts.get(obj.type, 0) + 1
        if FMA_RE.search(obj.name):
            fma_named += 1
        if len(name_samples) < NAME_SAMPLE_CAP:
            name_samples.append({"name": obj.name, "type": obj.type})
        if obj.type == "MESH" and obj.data is not None:
            mesh_objects += 1
            polys = len(obj.data.polygons)
            verts = len(obj.data.vertices)
            total_polys += polys
            total_verts += verts
            if polys > max_poly["polys"]:
                max_poly = {"name": obj.name, "polys": polys}
        if obj.type == "ARMATURE" and obj.data is not None:
            armatures.append({"name": obj.name, "boneCount": len(obj.data.bones)})

    # 場景根集合之分層樹（Z-Anatomy 以 collections 分層）。
    scenes = []
    for scene in bpy.data.scenes:
        scenes.append(
            {
                "name": scene.name,
                "collectionTree": collection_tree(scene.collection),
            }
        )

    report = {
        "blendFile": bpy.data.filepath,
        "blenderVersion": bpy.app.version_string,
        "totalObjects": len(bpy.data.objects),
        "objectTypeCounts": type_counts,
        "meshStats": {
            "meshObjects": mesh_objects,
            "totalPolygons": total_polys,
            "totalVertices": total_verts,
            "maxPolygonObject": max_poly,
        },
        "armatures": armatures,
        "fmaNamedObjects": fma_named,
        "totalCollections": len(bpy.data.collections),
        "totalMaterials": len(bpy.data.materials),
        "totalImages": len(bpy.data.images),
        "nameSamples": name_samples,
        "scenes": scenes,
    }

    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)

    print("INSPECT_OK objects=%d meshes=%d polys=%d armatures=%d fma=%d -> %s" % (
        report["totalObjects"], mesh_objects, total_polys, len(armatures), fma_named, out_path,
    ))


if __name__ == "__main__":
    main()
