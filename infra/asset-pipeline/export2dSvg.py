# 3D→2D SVG 抽取（Stage B、04 §4.6.3 步驟 7）：以**純幾何輪廓投影**自 3D 來源產生
# 三視圖（front／side／back）分層 SVG，圖層 id＝anatomyId。**不渲染、不依賴 GL／addon**
# ——避開正是阻擋 Blender Freestyle 的那類失敗（本機 5.1.2 無 render_freestyle_svg）。
#
# 管線：world_to_camera 投影（向量化）→ 柵格化覆蓋遮罩 → Moore 邊界追蹤 → Douglas–Peucker
# 簡化 → per-orientation SVG ＋ anatomy2dManifest.json。與 3D 共用 pipelineCommon 物件解析
# （2D 不漂移出 3D；見 doc/plans/2026-06-16-2d-stage-b-silhouette.md、…/2026-06-15-…-pipeline.md §2.1）。
#
# 用法：
#   blender.exe -b "<anatomy.blend>" -P export2dSvg.py -- "<manifestV1.json>" "<out_dir>" \
#       [--profile detailed|simplified] [--limit N] [--orientations front,side,back] [--res WxH]
import bpy
import sys
import os
import json
import math
import hashlib
import datetime
import numpy as np
from mathutils import Vector

# 共用物件解析（2D/3D 同源同步保證）。Blender -P 之 __file__＝本腳本路徑、注入同目錄使可 import。
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipelineCommon import (  # noqa: E402（須先注入 sys.path 方可 import）
    resolveSourceNames,
    entityInProfile,
    curveToMesh,
)

# 三方位正交相機（plan §2.2）：方位 → (相機相對全身中心之單位視向偏移)。
# Blender Z-up。相機置於中心 ± 該軸、看向中心；up＝世界 +Z（to_track_quat）。
ORIENTATION_OFFSETS = {
    "front": (0.0, -1.0, 0.0),  # 相機於 −Y、看 +Y（anterior 前面）
    "side": (1.0, 0.0, 0.0),    # 相機於 +X、看 −X（lateral 右側面）
    "back": (0.0, 1.0, 0.0),    # 相機於 +Y、看 −Y（posterior 背面）
}
ALL_ORIENTATIONS = ["front", "side", "back"]

DEFAULT_RES = (512, 1024)  # 直式 1:2，框人形（共用 viewBox `0 0 W H`）
FRAME_MARGIN = 1.08        # 全身框取邊距
SIMPLIFY_EPSILON = 1.0     # Douglas–Peucker 容差（像素）
MIN_CONTOUR_POINTS = 3     # 少於此點數之輪廓略過（雜訊）


def parseArgs():
    """解析 -- 之後的引數：位置 <manifest> <out_dir>＋選填旗標。"""
    raw = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    positional = []
    opts = {"profile": "detailed", "limit": None, "orientations": ALL_ORIENTATIONS, "res": DEFAULT_RES}
    i = 0
    while i < len(raw):
        tok = raw[i]
        if tok == "--profile":
            opts["profile"] = raw[i + 1]; i += 2
        elif tok == "--limit":
            opts["limit"] = int(raw[i + 1]); i += 2
        elif tok == "--orientations":
            opts["orientations"] = [o.strip() for o in raw[i + 1].split(",") if o.strip()]; i += 2
        elif tok == "--res":
            w, h = raw[i + 1].lower().split("x"); opts["res"] = (int(w), int(h)); i += 2
        else:
            positional.append(tok); i += 1
    return positional, opts


def worldAabb(objs):
    """以各物件 bound_box（local 8 角）轉世界，回傳 (minVec, maxVec) 之全身 AABB。"""
    lo = Vector((math.inf, math.inf, math.inf))
    hi = Vector((-math.inf, -math.inf, -math.inf))
    for obj in objs:
        mw = obj.matrix_world
        for corner in obj.bound_box:
            w = mw @ Vector(corner)
            lo = Vector((min(lo.x, w.x), min(lo.y, w.y), min(lo.z, w.z)))
            hi = Vector((max(hi.x, w.x), max(hi.y, w.y), max(hi.z, w.z)))
    return lo, hi


def setupCamera(cam, center, offsetDir, distance, orthoScale, clipEnd):
    """置相機於 center＋offsetDir×distance、看向 center；正交、sensor_fit VERTICAL。"""
    loc = Vector(center) + Vector(offsetDir).normalized() * distance
    cam.location = loc
    direction = Vector(center) - loc
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    cam.data.type = "ORTHO"
    cam.data.sensor_fit = "VERTICAL"
    cam.data.ortho_scale = orthoScale
    cam.data.clip_start = 0.001
    cam.data.clip_end = clipEnd
    # 強制重算 matrix_world：設 location/rotation_euler 後 Blender 惰性更新，
    # 未經 view_layer.update() 讀 cam.matrix_world 會取到陳舊（初始 identity）矩陣
    # → 視矩陣錯誤、投影沿深度軸壓成水平細帶。此更新為正確投影之必須。
    bpy.context.view_layer.update()


def projectPixels(verts, viewMatrixNp, orthoScale, w, h):
    """世界座標 (N,3) → 像素座標 (N,2)，y 朝下（SVG/影像原點左上）。
    正交＋sensor_fit VERTICAL：垂直全幅＝orthoScale、水平全幅＝orthoScale×(w/h)。"""
    cam = verts @ viewMatrixNp[:3, :3].T + viewMatrixNp[:3, 3]  # 世界→相機空間
    horizFull = orthoScale * (w / h)
    cox = 0.5 + cam[:, 0] / horizFull
    coy = 0.5 + cam[:, 1] / orthoScale
    px = cox * w
    py = (1.0 - coy) * h
    return np.stack([px, py], axis=1)


def rasterizeTriangles(mask, w, h, pix, tris):
    """以掃描線填三角面入 mask（bytearray、1＝覆蓋）。pix=(N,2) 像素座標、tris=(T,3) 頂點索引。
    每掃描線以 bytearray 切片賦值整段填色（C 速）。"""
    for t in tris:
        ax, ay = pix[t[0]]
        bx, by = pix[t[1]]
        cx, cy = pix[t[2]]
        # 依 y 排序三頂點
        if ay > by:
            ax, ay, bx, by = bx, by, ax, ay
        if by > cy:
            bx, by, cx, cy = cx, cy, bx, by
        if ay > by:
            ax, ay, bx, by = bx, by, ax, ay
        yTop = max(0, int(math.floor(ay)))
        yBot = min(h - 1, int(math.ceil(cy)))
        if yBot < yTop:
            continue
        dAC = (cy - ay) or 1e-9
        dAB = (by - ay) or 1e-9
        dBC = (cy - by) or 1e-9
        for y in range(yTop, yBot + 1):
            yc = y + 0.5
            if yc < ay or yc > cy:
                continue
            xAC = ax + (cx - ax) * (yc - ay) / dAC
            if yc <= by:
                xOther = ax + (bx - ax) * (yc - ay) / dAB
            else:
                xOther = bx + (cx - bx) * (yc - by) / dBC
            xa = xAC if xAC < xOther else xOther
            xb = xOther if xAC < xOther else xAC
            xi0 = max(0, int(math.floor(xa)))
            xi1 = min(w - 1, int(math.ceil(xb)))
            if xi1 < xi0:
                continue
            base = y * w
            mask[base + xi0:base + xi1 + 1] = b"\x01" * (xi1 + 1 - xi0)


# Moore 8-鄰域、順時針：E, SE, S, SW, W, NW, N, NE
MOORE = [(1, 0), (1, 1), (0, 1), (-1, 1), (-1, 0), (-1, -1), (0, -1), (1, -1)]


def mooreTrace(mask, w, h, sx, sy):
    """自起點 (sx,sy) 以 Moore-neighbor 追蹤連通元件外輪廓、回傳像素點清單（閉合）。"""
    def isFg(x, y):
        return 0 <= x < w and 0 <= y < h and mask[y * w + x]

    start = (sx, sy)
    contour = [start]
    cur = start
    back = (sx - 1, sy)  # 掃描序下、起點左側必為背景
    maxSteps = w * h * 4
    steps = 0
    while steps < maxSteps:
        steps += 1
        dx, dy = back[0] - cur[0], back[1] - cur[1]
        try:
            k0 = MOORE.index((dx, dy))
        except ValueError:
            k0 = 0
        found = None
        for k in range(1, 9):
            i = (k0 + k) % 8
            nx, ny = cur[0] + MOORE[i][0], cur[1] + MOORE[i][1]
            if isFg(nx, ny):
                found = (nx, ny)
                pj = (k0 + k - 1) % 8
                back = (cur[0] + MOORE[pj][0], cur[1] + MOORE[pj][1])
                break
        if found is None:
            break  # 孤立像素
        cur = found
        if cur == start:
            break
        contour.append(cur)
    return contour


def floodMark(mask, visited, w, h, sx, sy):
    """8-連通 flood fill 標記整個元件為已追蹤（避免重複自同一元件起追）。"""
    stack = [(sx, sy)]
    while stack:
        x, y = stack.pop()
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
        idx = y * w + x
        if visited[idx] or not mask[idx]:
            continue
        visited[idx] = 1
        stack.extend([
            (x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1),
            (x + 1, y + 1), (x - 1, y - 1), (x + 1, y - 1), (x - 1, y + 1),
        ])


def traceContours(mask, w, h):
    """回傳遮罩中各連通元件之外輪廓清單（每元件一條閉合多邊形）。"""
    visited = bytearray(w * h)
    contours = []
    for y in range(h):
        rowbase = y * w
        for x in range(w):
            idx = rowbase + x
            if mask[idx] and not visited[idx]:
                contour = mooreTrace(mask, w, h, x, y)
                if len(contour) >= MIN_CONTOUR_POINTS:
                    contours.append(contour)
                floodMark(mask, visited, w, h, x, y)
    return contours


def simplify(points, eps):
    """Douglas–Peucker 疏化（迭代式、避遞迴深度）。points＝[(x,y),…]。"""
    n = len(points)
    if n < 3:
        return points
    keep = [False] * n
    keep[0] = keep[n - 1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        segLen = math.hypot(dx, dy) or 1e-9
        maxD = -1.0
        maxI = -1
        for i in range(a + 1, b):
            px, py = points[i]
            # 點到線段距離（叉積 / 段長）
            d = abs((px - ax) * dy - (py - ay) * dx) / segLen
            if d > maxD:
                maxD = d
                maxI = i
        if maxD > eps and maxI != -1:
            keep[maxI] = True
            stack.append((a, maxI))
            stack.append((maxI, b))
    return [points[i] for i in range(n) if keep[i]]


def contourToPath(points):
    """輪廓點 → SVG path d（M…L…Z），座標四捨五入至 1 位小數。"""
    if len(points) < MIN_CONTOUR_POINTS:
        return None
    head = "M%s %s" % (round(points[0][0], 1), round(points[0][1], 1))
    rest = "".join("L%s %s" % (round(x, 1), round(y, 1)) for x, y in points[1:])
    return head + rest + "Z"


def collectMeshTriangles(objs, curveBevel):
    """回傳 (verts (M,3) float64, tris (T,3) int) 之合併陣列（該 anatomyId 全來源物件、世界座標）。
    CURVE 先轉管狀 mesh（curveToMesh、就地、不存回）。"""
    vertChunks = []
    triChunks = []
    base = 0
    for obj in objs:
        obj = curveToMesh(obj, curveBevel)
        if obj.type != "MESH" or obj.data is None:
            continue
        mesh = obj.data
        mesh.calc_loop_triangles()
        nv = len(mesh.vertices)
        nt = len(mesh.loop_triangles)
        if nv == 0 or nt == 0:
            continue
        co = np.empty(nv * 3, dtype=np.float64)
        mesh.vertices.foreach_get("co", co)
        co = co.reshape(nv, 3)
        mw = np.array(obj.matrix_world)
        world = co @ mw[:3, :3].T + mw[:3, 3]
        tri = np.empty(nt * 3, dtype=np.int64)
        mesh.loop_triangles.foreach_get("vertices", tri)
        tri = tri.reshape(nt, 3) + base
        vertChunks.append(world)
        triChunks.append(tri)
        base += nv
    if not vertChunks:
        return None, None
    return np.concatenate(vertChunks), np.concatenate(triChunks)


def buildPartPaths(verts, tris, viewMatrixNp, orthoScale, w, h):
    """單一 anatomyId 於某方位：投影→柵格化→追蹤→簡化→path 字串清單。"""
    pix = projectPixels(verts, viewMatrixNp, orthoScale, w, h)
    mask = bytearray(w * h)
    rasterizeTriangles(mask, w, h, pix, tris)
    if not any(mask):
        return []
    paths = []
    for contour in traceContours(mask, w, h):
        simplified = simplify(contour, SIMPLIFY_EPSILON)
        d = contourToPath(simplified)
        if d:
            paths.append(d)
    return paths


def main():
    positional, opts = parseArgs()
    if len(positional) < 2:
        print("SVG2D_ERR 需要 <manifestV1.json> <out_dir> 引數")
        return
    manifestPath, outDir = positional[0], positional[1]
    profile = opts["profile"]
    w, h = opts["res"]
    orientations = [o for o in opts["orientations"] if o in ORIENTATION_OFFSETS]
    os.makedirs(outDir, exist_ok=True)

    with open(manifestPath, "r", encoding="utf-8") as fh:
        manifestText = fh.read()
    manifest = json.loads(manifestText)
    entities = manifest.get("entities", [])

    # 依 **partKey（側別限定）** 聚合來源物件（解3d資產：取消左右群組化）——成對部位逐側獨立群組、
    # data-anatomy-id＝anatomyId@side（中線即 anatomyId），與 3D partKey 一致；app 以此鍵側別分流。
    byId = {}
    order = []
    for ent in entities:
        if not entityInProfile(ent, profile):
            continue
        aid = ent["anatomyId"]
        side = ent.get("side")
        pk = ("%s@%s" % (aid, side)) if side else aid
        if pk not in byId:
            byId[pk] = {"names": [], "bevel": ent.get("curveBevel")}
            order.append(pk)
        byId[pk]["names"].extend(resolveSourceNames(ent))
    if opts["limit"] is not None:
        order = order[:opts["limit"]]

    # 全身 AABB（取所有納入物件）→ 相機中心／共用 ortho_scale。
    allObjs = []
    for aid in order:
        for name in byId[aid]["names"]:
            obj = bpy.data.objects.get(name)
            if obj is not None:
                allObjs.append(obj)
    if not allObjs:
        print("SVG2D_ERR 找不到任何來源物件")
        return
    lo, hi = worldAabb(allObjs)
    center = ((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, (lo.z + hi.z) / 2)
    xR, yR, zR = hi.x - lo.x, hi.y - lo.y, hi.z - lo.z
    aspect = w / h
    # sensor_fit VERTICAL：ortho_scale＝垂直全幅；水平全幅＝ortho_scale×aspect。
    # 須 zR≤ortho_scale 且 max(xR,yR)≤ortho_scale×aspect → ortho_scale≥max(zR, max(xR,yR)/aspect)。
    orthoScale = max(zR, max(xR, yR) / aspect) * FRAME_MARGIN
    maxExtent = max(xR, yR, zR)
    distance = maxExtent * 2.0 + 1.0
    clipEnd = distance * 3.0 + maxExtent

    cam = bpy.data.objects.new("twoDCam", bpy.data.cameras.new("twoDCam"))
    bpy.context.scene.collection.objects.link(cam)
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.resolution_percentage = 100
    scene.render.pixel_aspect_x = 1.0
    scene.render.pixel_aspect_y = 1.0

    # 預先收集各部位之合併三角面（與方位無關、只算一次）。
    partGeom = {}
    for aid in order:
        objs = [bpy.data.objects.get(n) for n in byId[aid]["names"]]
        objs = [o for o in objs if o is not None]
        if not objs:
            continue
        verts, tris = collectMeshTriangles(objs, byId[aid]["bevel"])
        if verts is not None:
            partGeom[aid] = (verts, tris)
    print("SVG2D_INFO parts=%d (geom=%d) orientations=%s res=%dx%d" % (
        len(order), len(partGeom), ",".join(orientations), w, h))

    coverage = {}
    for orientation in orientations:
        setupCamera(cam, center, ORIENTATION_OFFSETS[orientation], distance, orthoScale, clipEnd)
        viewMatrixNp = np.array(cam.matrix_world.inverted())
        groups = []
        covered = []
        for aid in order:
            if aid not in partGeom:
                continue
            verts, tris = partGeom[aid]
            paths = buildPartPaths(verts, tris, viewMatrixNp, orthoScale, w, h)
            if not paths:
                continue
            covered.append(aid)
            pathTags = "".join('<path d="%s"/>' % d for d in paths)
            groups.append('<g data-anatomy-id="%s">%s</g>' % (aid, pathTags))
        coverage[orientation] = covered
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" '
            'data-orientation="%s">%s</svg>'
        ) % (w, h, orientation, "".join(groups))
        outPath = os.path.join(outDir, "anatomy2d.%s.svg" % orientation)
        with open(outPath, "w", encoding="utf-8") as fh:
            fh.write(svg)
        print("SVG2D_OK orientation=%s parts=%d bytes=%d -> %s" % (
            orientation, len(covered), len(svg.encode("utf-8")), outPath))

    # 資產 manifest（provenance）：來源 manifest 雜湊／產生時刻／解析度／涵蓋。
    assetManifest = {
        "viewBox": "0 0 %d %d" % (w, h),
        "resolution": {"x": w, "y": h},
        "orientations": orientations,
        "coverage": coverage,
        "provenance": {
            "sourceManifest": os.path.basename(manifestPath),
            "sourceManifestSha256": hashlib.sha256(manifestText.encode("utf-8")).hexdigest(),
            "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "tool": "export2dSvg.py",
            "profile": profile,
            "technique": "geometric-silhouette-projection",
        },
    }
    manifestOut = os.path.join(outDir, "anatomy2dManifest.json")
    with open(manifestOut, "w", encoding="utf-8") as fh:
        json.dump(assetManifest, fh, ensure_ascii=False, indent=2)
    print("SVG2D_DONE manifest=%s" % manifestOut)


if __name__ == "__main__":
    main()
