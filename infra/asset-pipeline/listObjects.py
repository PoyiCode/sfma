# Z-Anatomy .blend 物件查詢（04 §4.6.3 管線規劃輔助）：依關鍵字列出來源物件名／
# 型別／面數，供規劃 sourceObject 命名——雙側 .l/.r、複合肌子頭聚合、神經 CURVE 等。
# 不修改來源檔。
#
# 用法：
#   blender.exe -b "<anatomy.blend>" -P listObjects.py -- <keyword> [<keyword> ...]
#
# 輸出：每筆 `LIST_ITEM<TAB>name<TAB>type<TAB>polys`；結尾 `LIST_OK matches=N`。
import bpy
import sys


def argv_after_ddash():
    if "--" in sys.argv:
        return sys.argv[sys.argv.index("--") + 1:]
    return []


def main():
    keywords = [k.lower() for k in argv_after_ddash()]
    if not keywords:
        print("LIST_ERR 需要至少一個關鍵字")
        return
    matches = []
    for obj in bpy.data.objects:
        low = obj.name.lower()
        if any(k in low for k in keywords):
            polys = len(obj.data.polygons) if (obj.type == "MESH" and obj.data is not None) else 0
            matches.append((obj.name, obj.type, polys))
    matches.sort()
    for name, typ, polys in matches:
        print("LIST_ITEM\t%s\t%s\t%d" % (name, typ, polys))
    print("LIST_OK matches=%d keywords=%s" % (len(matches), ",".join(keywords)))


if __name__ == "__main__":
    main()
