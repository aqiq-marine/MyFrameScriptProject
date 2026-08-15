import json
from pathlib import Path


ROOT = Path("../assets/no_longer_human/")
OUTPUT = ROOT / "assets.ts"

TIME_SCALE = 10_000_000


# ==========================
# Bundle構造
# ==========================

def make_bundle():
    return {
        "files": [],
        "children": {}
    }


bundle = make_bundle()


# ==========================
# lab読み込み
# ==========================

def parse_lab(path: Path):
    lipsync = []

    with path.open("r", encoding="utf-8") as f:
        for line in f:
            cols = line.strip().split()

            if len(cols) < 3:
                continue

            lipsync.append({
                "start": int(cols[0]),
                "end": int(cols[1]),
                "symbol": cols[2]
            })

    return lipsync


# ==========================
# lipsync変換
# ==========================

VOWEL_MAP = {
    "a": "A",
    "i": "I",
    "u": "U",
    "e": "E",
    "o": "O",
}


def lab_to_myformat(data):
    cues = []

    for i, p in enumerate(data):
        value = VOWEL_MAP.get(p["symbol"])

        if value is None:
            for nxt in data[i + 1:]:
                value = VOWEL_MAP.get(nxt["symbol"])

                if value:
                    break

        cues.append({
            "start": p["start"] / TIME_SCALE,
            "value": value or "X",
        })

    if not (len(cues) > 0 and cues[0]["start"] == 0):
        cues.insert(0, {
            "start": 0.0,
            "value": "X"
        })

    return cues


# ==========================
# brk読み込み
# ==========================

def parse_brk(path: Path):
    breaks = []

    with path.open("r", encoding="utf-8") as f:
        for line_number, line in enumerate(f, start=1):
            line = line.strip()

            if not line:
                continue

            cols = line.split()

            if len(cols) < 3:
                print(
                    f"WARNING invalid brk: "
                    f"{path}:{line_number}"
                )
                continue

            try:
                char = int(cols[0])
                time = float(cols[1])
                priority = int(cols[2])
            except ValueError:
                print(
                    f"WARNING invalid brk: "
                    f"{path}:{line_number}"
                )
                continue

            breaks.append({
                "char": char,
                "time": time,
                "priority": priority,
            })

    return breaks


# ==========================
# メイン
# ==========================

for wav in ROOT.rglob("*.wav"):

    stem = wav.with_suffix("")

    txt = stem.with_suffix(".txt")
    lab = stem.with_suffix(".lab")
    brk = stem.with_suffix(".brk")

    if not txt.exists() or not lab.exists() or not brk.exists():
        print(f"Skip: {wav}")
        continue

    script_text = txt.read_text(
        encoding="utf-8"
    ).strip()

    lipsync = parse_lab(lab)

    breaks = parse_brk(brk)

    entry = {
        "audio_path": str(
            wav.relative_to(ROOT)
        ).replace("\\", "/"),

        "lipsync_path": str(
            lab.relative_to(ROOT)
        ).replace("\\", "/"),

        "lipsync_data": lab_to_myformat(lipsync),

        "script_path": str(
            txt.relative_to(ROOT)
        ).replace("\\", "/"),

        "script_text": script_text,

        "breaks": breaks,
    }

    node = bundle

    for part in wav.parent.relative_to(ROOT).parts:
        node = node["children"].setdefault(
            part,
            make_bundle()
        )

    node["files"].append(entry)


# ==========================
# ソート
# ==========================

def sort_bundle(node):

    def sort_key(x):
        filename = Path(x["audio_path"]).name
        number = filename.split("_", 1)[0]

        try:
            return int(number)
        except ValueError:
            return float("inf")

    node["files"].sort(key=sort_key)

    node["children"] = dict(
        sorted(node["children"].items())
    )

    for child in node["children"].values():
        sort_bundle(child)


sort_bundle(bundle)


# ==========================
# TypeScript出力
# ==========================

with OUTPUT.open(
    "w",
    encoding="utf-8",
    newline="\n"
) as f:

    f.write("export const assets = ")

    json.dump(
        bundle,
        f,
        ensure_ascii=False,
        indent=2,
    )

    f.write(";\n\n")
    f.write("export type AssetData = typeof assets;\n\n")
    f.write("export default assets;\n")


print()
print("Done.")
print(f"Saved : {OUTPUT}")
