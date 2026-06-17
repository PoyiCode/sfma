# 3D→2D 管線共用物件解析（單一真相、同步的根本保證）。
#
# `exportGltf.py`（3D GLB）與 `export2dSvg.py`（2D Freestyle 線稿，Stage B）**同 import 本模組**
# → 兩者對同一 `manifestV1.json` 解析出**完全相同的 per-anatomyId 物件集**（同一份程式碼解析
# 同一批物件、2D 不可能漂移出 3D 沒有的部位）。此即 2D／3D 外觀一致與「3D 改、2D 同改」之
# 最強同步保證（見 doc/plans/2026-06-15-3d-to-2d-svg-pipeline.md §2.1、04 §4.6.3 步驟 7）。
#
# 本模組僅含**物件解析**（哪些來源物件屬某 anatomyId、profile 過濾、CURVE 轉 mesh、join 聚合、
# 取消選取）；色彩材質／減面／匯出編排屬各匯出器專屬，不入此處。
# 頂層 import bpy：join/curve/deselect 需之，僅於 Blender 內執行（同 exportGltf.py 慣例）。
import bpy


def resolveSourceNames(ent):
    """回傳此 entity 之來源物件名清單（sourceObjects 優先；否則包裝 sourceObject）。
    sourceObjects（字串陣列）＝複合肌多子頭；sourceObject（單一字串）＝單一來源（§4.6.2）。"""
    names = ent.get("sourceObjects")
    if names:
        return list(names)
    single = ent.get("sourceObject")
    return [single] if single else []


def entityInProfile(ent, profile):
    """此 entity 是否納入指定 profile（detailed｜simplified）。
    entity.profiles（選填字串陣列）列納入之 profile；缺省＝兩 profile 皆納（向後相容）。
    供「僅細節版」補充被動結構（如筋膜：開殼鞘膜減面 floor 高、低階裝置不需、且 simplified
    預算已滿）排除於精簡版、維持輕量（解3d資產 58）。"""
    profiles = ent.get("profiles")
    return profiles is None or profile in profiles


def deselectAll():
    """逐一取消目前選取（headless `-b` 模式下 bpy.ops.object.select_all 無視窗 context
    會靜默 no-op，故不用 operator、直接操作 object.select_set）。"""
    for obj in list(bpy.context.selected_objects):
        obj.select_set(False)


def joinObjects(objs):
    """將 objs join 為單一物件並回傳之（首件為 active＝join 目標）。單件直接回傳。
    呼叫端須確保 objs 非空。headless 下 bpy.ops.object.join 需顯式 context.temp_override
    提供 active／selected_editable_objects，否則靜默 no-op（子頭不會被併入）。"""
    if len(objs) == 1:
        return objs[0]
    with bpy.context.temp_override(
        active_object=objs[0],
        selected_editable_objects=objs,
        selected_objects=objs,
    ):
        bpy.ops.object.join()
    return objs[0]


def curveToMesh(obj, bevel):
    """將 CURVE 物件轉為實心管狀 mesh 並回傳（同一物件、就地轉換、名稱不變）。
    bevel（選填 dict）：depth＝管半徑、resolution＝圓周細分；有則覆寫來源 curve 設定。
    headless 下 bpy.ops.object.convert 須 temp_override 提供 active／selected，否則 no-op。
    非 CURVE 物件原樣回傳。"""
    if obj.type != "CURVE":
        return obj
    if bevel:
        if "depth" in bevel:
            obj.data.bevel_depth = bevel["depth"]
        if "resolution" in bevel:
            obj.data.bevel_resolution = bevel["resolution"]
    with bpy.context.temp_override(
        active_object=obj,
        selected_editable_objects=[obj],
        selected_objects=[obj],
    ):
        bpy.ops.object.convert(target="MESH")
    return obj
