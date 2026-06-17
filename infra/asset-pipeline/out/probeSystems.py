# 一次性探查（gitignored out/）：量化 5 系統之可算繪幾何，並解析 manifest 實體落入哪個系統，
# 以定奪 per-system 匯出採 collection-driven（原始集合）抑或 manifest-driven（策劃子集）。
# 用法：blender -b z-anatomy.blend -P out/probeSystems.py -- manifestV1.json
import bpy
import sys
import json
import re

SYSTEM_PREFIX_RE = re.compile(r"^\s*\d+:\s*")
WANTED = [
    "Skeletal system",
    "Muscular insertions",
    "Joints",
    "Muscular system",
    "Nervous system & Sense organs",
]


def normName(name):
    return SYSTEM_PREFIX_RE.sub("", name).strip()


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    manifest_path = args[0]

    # 每系統 top-level collection（排除 Bonus 等重複/非系統集合）→ all_objects 名集合與型別計數。
    systemSets = {}
    print("=== 系統 collection 可算繪幾何 ===")
    for top in bpy.context.scene.collection.children:
        norm = normName(top.name)
        if norm not in WANTED:
            continue
        names = set()
        counts = {"MESH": 0, "CURVE": 0, "FONT": 0, "EMPTY": 0, "OTHER": 0}
        for o in top.all_objects:
            counts[o.type] = counts.get(o.type, 0) + 1 if o.type in counts else counts["OTHER"] + 1
            if o.type in ("MESH", "CURVE"):
                names.add(o.name)
        systemSets[norm] = names
        renderable = counts["MESH"] + counts["CURVE"]
        print("  %-32s renderable(MESH+CURVE)=%d  MESH=%d CURVE=%d FONT=%d EMPTY=%d"
              % (norm, renderable, counts["MESH"], counts["CURVE"], counts["FONT"], counts.get("EMPTY", 0)))

    with open(manifest_path, "r", encoding="utf-8") as fh:
        manifest = json.load(fh)
    entities = manifest.get("entities", [])

    # 每 manifest 實體：取首來源物件，解析落入哪個系統（依 WANTED 優先序）。
    perSystem = {s: 0 for s in WANTED}
    unassigned = 0
    unassignedSamples = []
    for ent in entities:
        src = ent.get("sourceObject")
        if src is None:
            srcs = ent.get("sourceObjects") or []
            src = srcs[0] if srcs else None
        found = None
        for s in WANTED:
            if src in systemSets.get(s, set()):
                found = s
                break
        if found:
            perSystem[found] += 1
        else:
            unassigned += 1
            if len(unassignedSamples) < 12:
                unassignedSamples.append("%s<-%s" % (ent.get("anatomyId"), src))

    print("\n=== manifest 實體（%d）解析落入系統 ===" % len(entities))
    for s in WANTED:
        print("  %-32s entities=%d" % (s, perSystem[s]))
    print("  %-32s entities=%d" % ("(unassigned/其他系統)", unassigned))
    if unassignedSamples:
        print("  unassigned 樣本:", ", ".join(unassignedSamples))
    print("PROBE_OK")


if __name__ == "__main__":
    main()
