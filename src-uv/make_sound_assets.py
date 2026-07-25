# ==========================
# Bundle構造
# ==========================

import json
from collections import defaultdict
from pathlib import Path

ROOT = Path("../assets/voice_test/")
OUTPUT = ROOT / "assets.ts"


def make_bundle():
    return {
        "files": [],
        "children": {}
    }

bundle = make_bundle()


PUNCTUATIONS = "、。"

VOWELS = {"a", "i", "u", "e", "o"}


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
            "start": p["start"] / 10_000_000,
            "value": value or "X",
        })

    if not (len(cues) > 0 and cues[0]["start"] == 0):
      cues.insert(0, {
          "start": 0.0,
          "value": "X"
      })

    return cues

# ==========================
# スクリプト解析
# ==========================

def script_punctuation_progress(script: str):
    """
    句読点までの発話進捗(0～1)
    """

    spoken = 0
    punctuation_points = []

    for ch in script:
        if ch in PUNCTUATIONS:
            punctuation_points.append(spoken)
        elif not ch.isspace():
            spoken += 1

    if spoken == 0:
        return []

    return [x / spoken for x in punctuation_points]


# ==========================
# lab解析
# ==========================

def pause_progress(lipsync):
    """
    pauまでの母音進捗(0～1)
    """

    vowel_count = 0
    pauses = []

    for cue in lipsync:
        symbol = cue["symbol"]

        if symbol in VOWELS:
            vowel_count += 1

        if symbol == "pau":
            pauses.append({
                "start": cue["start"],
                "vowels": vowel_count
            })

    if vowel_count == 0:
        return []

    for p in pauses:
        p["progress"] = p["vowels"] / vowel_count

    return pauses


# ==========================
# starts推定
# ==========================

def estimate_starts(script_text, lipsync):

    starts = [0]

    script_progress = script_punctuation_progress(script_text)
    pauses = pause_progress(lipsync)

    if not script_progress or not pauses:
        return starts

    used = set()

    for target in script_progress:

        best = None
        best_score = 999

        for i, pause in enumerate(pauses):

            if i in used:
                continue

            diff = abs(target - pause["progress"])

            if diff < best_score:
                best_score = diff
                best = i

        if best is None:
            continue

        used.add(best)

        confidence = max(0.0, 1.0 - best_score * 2.0)

        if confidence < 0.7:
            print(
                f"WARNING confidence={confidence:.2f} "
                f"target={target:.2f} "
                f"pause={pauses[best]['progress']:.2f}"
            )

        starts.append(pauses[best]["start"])

    starts.sort()

    return starts


# ==========================
# メイン
# ==========================

for wav in ROOT.rglob("*.wav"):

    stem = wav.with_suffix("")

    txt = stem.with_suffix(".txt")
    lab = stem.with_suffix(".lab")

    if not txt.exists() or not lab.exists():
        print(f"Skip: {wav}")
        continue

    script_text = txt.read_text(encoding="utf-8").strip()

    lipsync = parse_lab(lab)

    starts = estimate_starts(script_text, lipsync)

    entry = {
        "audio_path": str(wav.relative_to(ROOT)).replace("\\", "/"),
        "lipsync_path": str(lab.relative_to(ROOT)).replace("\\", "/"),
        "lipsync_data": lab_to_myformat(lipsync),
        "script_path": str(txt.relative_to(ROOT)).replace("\\", "/"),
        "script_text": script_text,
        "starts": list(map(lambda s: s / 10_000_000, starts))
    }

    node = bundle

    for part in wav.parent.relative_to(ROOT).parts:
        node = node["children"].setdefault(part, make_bundle())

    node["files"].append(entry)


# ソート
def sort_bundle(node):
    node["files"].sort(key=lambda x: x["audio_path"])

    node["children"] = dict(sorted(node["children"].items()))

    for child in node["children"].values():
        sort_bundle(child)


sort_bundle(bundle)


# ==========================
# TypeScript出力
# ==========================

with OUTPUT.open("w", encoding="utf-8", newline="\n") as f:
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
