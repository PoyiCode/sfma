# Stage C/E 薄端到端（04 §4.6.3 步驟 5–6）：依 manifestV1.json 選取來源物件、
# 改名為 anatomyId（glTF node 名來源）、匯出 GLB（node 名＝anatomyId）。
# 對載入之記憶體資料改名後匯出選取項；**不存回 .blend、來源檔不變**。
#
# 用法：
#   blender.exe -b "<anatomy.blend>" -P exportGltf.py -- "<manifestV1.json>" "<out_dir>" [profile]
#   profile（選填）＝ detailed（預設）｜simplified；擇 manifest.decimation 對應 cap 與輸出檔名
#   （detailed→anatomyV1.glb、simplified→anatomyV1.simplified.glb；§4.3.6 分級資產）。
#
# entity 來源支援兩式（擇一，§4.6.2）：
#   - sourceObject（單一字串）：單一來源 mesh → 單一 node（原行為）。
#   - sourceObjects（字串陣列）：複合肌之多子頭 → join 聚合為單一 node（§4.6.3 步驟 5）。
# CURVE 來源（神經・血管）以 entity.curveBevel 轉管狀 mesh。
# manifest.layerColors（layer→sRGB hex）有則依 entity.layer 指派扁平基底材質（§4.1 分層辨識色）。
import bpy
import sys
import os
import json

# 共用物件解析（2D/3D 同源同步保證，見 pipelineCommon.py、doc/plans/2026-06-15-3d-to-2d-svg-pipeline.md §2.1）。
# Blender `-P` 之 __file__＝本腳本路徑；注入其所在目錄使同目錄之 pipelineCommon 可 import。
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipelineCommon import (  # noqa: E402（須先注入 sys.path 方可 import）
    resolveSourceNames,
    entityInProfile,
    deselectAll,
    joinObjects,
    curveToMesh,
)


def srgbToLinear(c):
    """單通道 sRGB（0–1）→ linear（glTF baseColorFactor 為 linear 空間）。"""
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexToLinearRgba(hexColor):
    """#RRGGBB（sRGB）→ [r,g,b,1] linear。"""
    h = hexColor.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b), 1.0]


def makeFlatMaterial(name, linearRgba):
    """建一支扁平霧面材質（Principled BSDF：Base Color＝linearRgba、Metallic 0、
    Roughness 偏高），glTF 匯出其 baseColorFactor＝linearRgba。"""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf is not None:
        bsdf.inputs["Base Color"].default_value = linearRgba
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = 0.0
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = 0.7
    return mat


def assignFlatMaterial(obj, mat):
    """以單一材質取代物件 mesh 之所有材質槽（單材質／物件，順帶降 draw call）。"""
    if obj.data is None:
        return
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def triangleCount(mesh):
    """mesh 三角化後之三角面數（每 polygon 之 verts−2；quad→2、ngon→n−2）。
    DECIMATE COLLAPSE 之 ratio 即相對此三角面數，故據此設 ratio 可命中目標上限。"""
    return sum(len(p.vertices) - 2 for p in mesh.polygons)


def addDecimateModifier(obj, cap):
    """步驟 5 減面（04 §4.6.3）：若 obj 三角面數 > cap，加 DECIMATE COLLAPSE modifier
    （ratio＝cap/tris）使其降至約 cap、回傳 True；≤cap 者不動、回傳 False。
    實際減面於匯出 export_apply=True 時 bake（不存回來源 .blend）。"""
    if obj.data is None:
        return False
    tris = triangleCount(obj.data)
    if tris <= cap:
        return False
    mod = obj.modifiers.new(name="anatomyDecimate", type="DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = cap / tris
    return True


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if len(args) < 2:
        print("EXPORT_ERR 需要 <manifestV1.json> <out_dir> [profile] 引數")
        return
    manifest_path, out_dir = args[0], args[1]
    # 分級資產 profile（§4.3.6）：detailed（預設）｜simplified；擇對應 cap 與輸出檔名。
    profile = args[2] if len(args) >= 3 else "detailed"
    if profile not in ("detailed", "simplified", "full"):
        print("EXPORT_ERR 未知 profile：%s（detailed｜simplified｜full）" % profile)
        return
    # full（無損，解3d資產「完整」級別）：取 detailed 同一批實體，但**無減面**（cap=None）、
    # **無 Draco**（見匯出旗標 useDraco）——載入端得未壓縮、未量化之原始幾何，無視預算。
    filterProfile = "detailed" if profile == "full" else profile
    os.makedirs(out_dir, exist_ok=True)

    with open(manifest_path, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)
    entities = manifest.get("entities", [])

    # 分層基底色（§4.1 辨識色）：layer→扁平材質快取（同層共用一支，降材質數／draw call）。
    layerColors = manifest.get("layerColors", {})
    layerMaterials = {}
    for layer, hexColor in layerColors.items():
        layerMaterials[layer] = makeFlatMaterial(
            "base.%s" % layer, hexToLinearRgba(hexColor)
        )

    # 先逐 entity 解析來源、（必要時）join 聚合、改名為 anatomyId；最後一次選取全部匯出。
    # 分兩階段（先 join／改名、後選取）避免 join 之選取操作與匯出選取互擾。
    resultObjects = []
    resultLayers = []
    resultMaxTriangles = []
    missing = []
    for ent in entities:
        anatomy_id = ent["anatomyId"]
        # 分級資產 profile 過濾（解3d資產 58、共用 pipelineCommon.entityInProfile）：
        # 不含當前 profile 者整件跳過——供「僅細節版」補充被動結構（如筋膜）排除於精簡版、維持輕量。
        if not entityInProfile(ent, filterProfile):
            continue
        srcNames = resolveSourceNames(ent)
        bevel = ent.get("curveBevel")
        objs = []
        for name in srcNames:
            obj = bpy.data.objects.get(name)
            if obj is None:
                missing.append(name)
            else:
                # CURVE（神經・血管）先轉管狀 mesh，方可入 glTF／與 mesh 同流程 join。
                objs.append(curveToMesh(obj, bevel))
        if not objs:
            continue
        # 多子頭 join 為單一物件（複合肌）；單件即原物件。記憶體內改名、不存回。
        result = joinObjects(objs)
        # 側別節點名（解3d資產：取消左右群組化）：成對部位依 manifest 明確 side 加 #L/#R 尾碼
        # （兩側名相異、Blender 不再 dedup 群組化；app gltfBinding 解析還原 anatomyId＋side）。
        # 中線（無 side）節點名即 anatomyId。side 來源為 manifest 明確欄（非來源命名推測，避左右互換）。
        side = ent.get("side")
        node_name = anatomy_id + ("#R" if side == "right" else "#L" if side == "left" else "")
        result.name = node_name
        if result.data is not None:
            result.data.name = node_name
        # 分層基底著色（有設 layerColors 且該 layer 有色才指派）。
        mat = layerMaterials.get(ent.get("layer"))
        if mat is not None:
            assignFlatMaterial(result, mat)
        resultObjects.append(result)
        # 平行記錄 layer（供 per-layer 減面上限；名稱於匯出才 .NNN 去重、此處可能撞名故不用 dict）。
        resultLayers.append(ent.get("layer"))
        # 平行記錄 per-entity 減面上限（選填 maxTriangles；供粗聚合件〔如 bone.hand/foot〕較全域/分層更緊
        # 之單件 cap、不動同 layer 其他件品質——解3d資產 55）。
        resultMaxTriangles.append(ent.get("maxTriangles"))

    if missing:
        print("EXPORT_WARN 找不到來源物件：%s" % ", ".join(missing))
    if not resultObjects:
        print("EXPORT_ERR 無可匯出物件")
        return

    # 步驟 5 減面（04 §4.3.6 細節版 ≤600k 三角面、§4.6.3「減面為必經」）：
    # manifest.decimation.detailedMaxTrianglesPerMesh＝每-mesh 三角面全域上限；
    # 缺省／0 → 跳過（向後相容）。逐物件加 DECIMATE COLLAPSE、匯出時 bake。
    # per-layer 上限（decimation.layerMaxTriangles：layer→cap）：對該 layer 物件取
    # min(layerCap, 全域 cap)，使簡單被動結構（如椎間盤）以較緊 cap 省預算、不動肌肉品質
    # （兩 profile 皆套用；解3d資產 51）。per-entity 上限（entity.maxTriangles）：對該件再取
    # min（更緊），供粗聚合件單件壓更緊而不動同 layer 其他件（解3d資產 55）。
    decimation = manifest.get("decimation", {})
    # full（無損）跳過減面（cap=None → 下方 `if cap` 區塊整段不執行）；其餘依 profile 取每-mesh 全域上限。
    if profile == "full":
        cap = None
    else:
        capKey = "simplifiedMaxTrianglesPerMesh" if profile == "simplified" else "detailedMaxTrianglesPerMesh"
        cap = decimation.get(capKey)
    layerCaps = decimation.get("layerMaxTriangles", {})
    decimated = 0
    if cap:
        for obj, layer, entCap in zip(resultObjects, resultLayers, resultMaxTriangles):
            caps = [cap]
            layerCap = layerCaps.get(layer)
            if layerCap is not None:
                caps.append(layerCap)
            if entCap is not None:
                caps.append(entCap)
            effectiveCap = min(caps)
            if addDecimateModifier(obj, effectiveCap):
                decimated += 1

    deselectAll()
    selected = []
    for obj in resultObjects:
        obj.select_set(True)
        selected.append(obj.name)
    bpy.context.view_layer.objects.active = resultObjects[0]

    out_name = {
        "simplified": "anatomyV1.simplified.glb",
        "full": "anatomyV1.full.glb",
    }.get(profile, "anatomyV1.glb")
    out_path = os.path.join(out_dir, out_name)
    # full（無損）關 Draco：得未量化原始幾何（檔大、無視預算）；其餘 profile 仍 Draco 壓縮傳輸。
    useDraco = profile != "full"
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        # Draco 網格壓縮（KHR_draco_mesh_compression；GLB 壓縮切片）：縮小傳輸體積（行動/區網首載）。
        # 載入端 Babylon glTF 以 DracoDecoder.Default 解碼、配置自帶 public/draco/（apps/web render/dracoConfig.ts）。
        # 量化為有損——位置 14-bit 於解剖尺度視覺無損；無 UV/頂點色故 texcoord/color 量化無作用。皆 Blender 預設、明列利重現。
        export_draco_mesh_compression_enable=useDraco,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=10,
        export_draco_generic_quantization=12,
    )

    out_bytes = os.path.getsize(out_path)
    print("EXPORT_OK profile=%s selected=%d decimated=%d cap=%s bytes=%d -> %s | nodes=%s" % (
        profile, len(selected), decimated, cap, out_bytes, out_path, ",".join(selected),
    ))


if __name__ == "__main__":
    main()
