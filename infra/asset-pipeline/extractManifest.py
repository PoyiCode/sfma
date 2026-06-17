# Stage B（04 §4.6.3 步驟 2）：Z-Anatomy .blend 命名正規化 → crosswalk + manifest 草案。
# 逐 MESH/CURVE：去後綴（.l/.r/.ol/.or/.j 與 Blender .NNN 重複碼）取基名、依頂層 collection
# 指派分層、左右標 side、提議語意式 anatomyId＝<layer>.<lowerCamelBase>（去尾端分層字以
# 對齊既有命名：如「Radial nerve」→ nerve.radial）。輸出供人工／PT 審閱，非最終定版。
#
# 用法：
#   blender.exe -b "<anatomy.blend>" -P extractManifest.py -- "<out_dir>"
#
# 產出（out_dir，gitignore）：crosswalk.csv（逐來源物件）、manifest.json（去重 anatomyId）。
import bpy
import sys
import os
import csv
import json
import re

# 頂層系統 collection → 分層（§4.6 實檔勘查）。
SYSTEM_LAYER = {
    "Skeletal system": "bone",
    "Muscular system": "muscle",
    "Muscular insertions": "muscle",
    "Joints": "joint",
    "Nervous system & Sense organs": "nerve",
    "Cardiovascular system": "vessel",
    "Lymphoid organs": "lymph",
    "Visceral systems": "organ",
    "Regions of human body": "region",
}
# 一物件可同屬多系統（如另被 Bonus 引用）；依此序擇優先解剖系統。
SYSTEM_PRIORITY = [
    "Skeletal system",
    "Muscular system",
    "Muscular insertions",
    "Joints",
    "Nervous system & Sense organs",
    "Cardiovascular system",
    "Lymphoid organs",
    "Visceral systems",
    "Regions of human body",
]
# 分層之尾端「型別字」：基名末字若等於此則去除（對齊 nerve.radial／joint.elbow 慣例）。
LAYER_TAIL_WORD = {
    "bone": "bone",
    "muscle": "muscle",
    "joint": "joint",
    "nerve": "nerve",
}

DUP_RE = re.compile(r"\.\d{3}$")  # Blender 去重碼 .001
SUFFIX_RE = re.compile(r"\.(ol|or|l|r|j|t)$", re.IGNORECASE)  # 解剖後綴
# 頂層系統 collection 名帶數字前綴（實檔：「1: Skeletal system」…）；比對前去除。
SYSTEM_PREFIX_RE = re.compile(r"^\s*\d+:\s*")
INCLUDED_TYPES = ("MESH", "CURVE")


def normalize_system_name(name):
    return SYSTEM_PREFIX_RE.sub("", name).strip()


def parse_name(name):
    n = name.strip()
    while DUP_RE.search(n):
        n = DUP_RE.sub("", n)
    side = None
    suffix = None
    m = SUFFIX_RE.search(n)
    if m:
        suffix = m.group(1).lower()
        n = SUFFIX_RE.sub("", n)
        if suffix in ("l", "ol"):
            side = "left"
        elif suffix in ("r", "or"):
            side = "right"
    paren = n.startswith("(") and n.endswith(")")
    if paren:
        n = n[1:-1]
    return n.strip(), side, suffix, paren


def to_anatomy_id(base, layer):
    words = [w for w in re.split(r"[^A-Za-z0-9]+", base) if w]
    tail = LAYER_TAIL_WORD.get(layer)
    if tail and len(words) > 1 and words[-1].lower() == tail:
        words = words[:-1]
    if not words:
        return None
    camel = words[0].lower() + "".join(w[:1].upper() + w[1:].lower() for w in words[1:])
    return "%s.%s" % (layer, camel)


def build_system_object_sets():
    sets = {}
    for top in bpy.context.scene.collection.children:
        system = normalize_system_name(top.name)
        if system in SYSTEM_LAYER:
            sets[system] = set(o.name for o in top.all_objects)
    return sets


def resolve_system(obj_name, system_sets):
    for system in SYSTEM_PRIORITY:
        members = system_sets.get(system)
        if members and obj_name in members:
            return system
    return None


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out_dir = args[0] if args else "out"
    os.makedirs(out_dir, exist_ok=True)

    system_sets = build_system_object_sets()

    rows = []
    manifest = {}  # anatomyId -> aggregate
    layer_counts = {}
    unassigned = 0

    for obj in bpy.data.objects:
        if obj.type not in INCLUDED_TYPES:
            continue
        system = resolve_system(obj.name, system_sets)
        layer = SYSTEM_LAYER.get(system) if system else None
        base, side, suffix, paren = parse_name(obj.name)
        anatomy_id = to_anatomy_id(base, layer) if layer else None
        polys = len(obj.data.polygons) if (obj.type == "MESH" and obj.data) else 0

        rows.append(
            {
                "sourceName": obj.name,
                "objectType": obj.type,
                "system": system or "",
                "layer": layer or "",
                "baseName": base,
                "side": side or "",
                "suffix": suffix or "",
                "paren": "1" if paren else "",
                "proposedAnatomyId": anatomy_id or "",
                "polyCount": polys,
                "include": "",  # 人工審閱填
            }
        )

        if anatomy_id is None:
            unassigned += 1
            continue
        layer_counts[layer] = layer_counts.get(layer, 0) + 1
        entry = manifest.setdefault(
            anatomy_id,
            {
                "anatomyId": anatomy_id,
                "name": base,
                "layer": layer,
                "sides": set(),
                "sourceCount": 0,
                "types": set(),
            },
        )
        if side:
            entry["sides"].add(side)
        entry["sourceCount"] += 1
        entry["types"].add(obj.type)

    # 寫 crosswalk.csv
    cw_path = os.path.join(out_dir, "crosswalk.csv")
    with open(cw_path, "w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=[
                "sourceName", "objectType", "system", "layer", "baseName",
                "side", "suffix", "paren", "proposedAnatomyId", "polyCount", "include",
            ],
        )
        writer.writeheader()
        for r in sorted(rows, key=lambda x: (x["layer"], x["proposedAnatomyId"], x["sourceName"])):
            writer.writerow(r)

    # 寫 manifest.json（去重 anatomyId）
    manifest_list = []
    for entry in manifest.values():
        manifest_list.append(
            {
                "anatomyId": entry["anatomyId"],
                "name": entry["name"],
                "layer": entry["layer"],
                "sides": sorted(entry["sides"]),
                "bilateral": entry["sides"] == {"left", "right"},
                "sourceCount": entry["sourceCount"],
                "types": sorted(entry["types"]),
            }
        )
    manifest_list.sort(key=lambda e: (e["layer"], e["anatomyId"]))
    mf_path = os.path.join(out_dir, "manifest.json")
    with open(mf_path, "w", encoding="utf-8") as fh:
        json.dump(
            {
                "sourceObjects": len(rows),
                "uniqueAnatomyIds": len(manifest_list),
                "unassigned": unassigned,
                "layerCounts": layer_counts,
                "entities": manifest_list,
            },
            fh,
            ensure_ascii=False,
            indent=2,
        )

    print("EXTRACT_OK rows=%d uniqueIds=%d unassigned=%d layers=%s -> %s" % (
        len(rows), len(manifest_list), unassigned, json.dumps(layer_counts), out_dir,
    ))


if __name__ == "__main__":
    main()
