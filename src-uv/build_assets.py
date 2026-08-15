import json
from pathlib import Path
from typing import Any


TIME_SCALE = 10_000_000

VOWEL_MAP = {
    "a": "A",
    "i": "I",
    "u": "U",
    "e": "E",
    "o": "O",
}


Bundle = dict[str, Any]


# ==========================
# Bundle
# ==========================

def make_bundle() -> Bundle:
    """空のBundleを作成する。"""
    return {
        "files": [],
        "children": {},
    }


# ==========================
# lab
# ==========================

def parse_lab(path: Path) -> list[dict[str, Any]]:
    """LABファイルを読み込む。"""
    lipsync = []

    with path.open("r", encoding="utf-8") as f:
        for line in f:
            cols = line.strip().split()

            if len(cols) < 3:
                continue

            lipsync.append({
                "start": int(cols[0]),
                "end": int(cols[1]),
                "symbol": cols[2],
            })

    return lipsync


def lab_to_myformat(
    data: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """LABデータをlipsync用の形式へ変換する。"""
    cues = []

    for i, point in enumerate(data):
        value = VOWEL_MAP.get(point["symbol"])

        if value is None:
            for next_point in data[i + 1:]:
                value = VOWEL_MAP.get(next_point["symbol"])

                if value:
                    break

        cues.append({
            "start": point["start"] / TIME_SCALE,
            "value": value or "X",
        })

    if not cues or cues[0]["start"] != 0:
        cues.insert(0, {
            "start": 0.0,
            "value": "X",
        })

    return cues


# ==========================
# brk
# ==========================

def parse_brk(path: Path) -> list[dict[str, Any]]:
    """BRKファイルを読み込む。"""
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
# Asset
# ==========================

def make_asset_entry(
    wav: Path,
    root: Path,
) -> dict[str, Any]:
    """1つのWAVからAssetDataを作成する。"""
    stem = wav.with_suffix("")

    txt = stem.with_suffix(".txt")
    lab = stem.with_suffix(".lab")
    brk = stem.with_suffix(".brk")

    script_text = txt.read_text(
        encoding="utf-8",
    ).strip()

    lipsync = parse_lab(lab)
    breaks = parse_brk(brk)

    return {
        "audio_path": to_relative_path(wav, root),
        "lipsync_path": to_relative_path(lab, root),
        "lipsync_data": lab_to_myformat(lipsync),
        "script_path": to_relative_path(txt, root),
        "script_text": script_text,
        "breaks": breaks,
    }


def to_relative_path(
    path: Path,
    root: Path,
) -> str:
    """rootからの相対パスをTS/JSON向けの形式にする。"""
    return str(path.relative_to(root)).replace("\\", "/")


# ==========================
# Bundle構築
# ==========================

def build_bundle(root: Path) -> Bundle:
    """指定されたディレクトリからBundleを構築する。"""
    root = root.resolve()

    bundle = make_bundle()

    for wav in root.rglob("*.wav"):
        stem = wav.with_suffix("")

        txt = stem.with_suffix(".txt")
        lab = stem.with_suffix(".lab")
        brk = stem.with_suffix(".brk")

        if not txt.exists() or not lab.exists() or not brk.exists():
            print(f"Skip: {wav}")
            continue

        entry = make_asset_entry(
            wav=wav,
            root=root,
        )

        node = bundle

        relative_parent = wav.parent.relative_to(root)

        for part in relative_parent.parts:
            node = node["children"].setdefault(
                part,
                make_bundle(),
            )

        node["files"].append(entry)

    sort_bundle(bundle)

    return bundle


# ==========================
# ソート
# ==========================

def sort_bundle(node: Bundle) -> None:
    """Bundle内のファイル・ディレクトリをソートする。"""

    def sort_key(entry: dict[str, Any]) -> int | float:
        filename = Path(entry["audio_path"]).name
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


# ==========================
# TypeScript出力
# ==========================

def write_typescript(
    bundle: Bundle,
    output: Path,
) -> None:
    """BundleをTypeScriptファイルとして出力する。"""
    output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    with output.open(
        "w",
        encoding="utf-8",
        newline="\n",
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


# ==========================
# Public API
# ==========================

def generate_assets(
    root: Path | str,
    output: Path | str | None = None,
) -> Bundle:
    """
    assetsディレクトリを解析してassets.tsを生成する。

    Args:
        root:
            WAV/TXT/LAB/BRKが格納されているルートディレクトリ。

        output:
            出力するTypeScriptファイル。
            Noneの場合はroot / "assets.ts"。

    Returns:
        構築されたBundle。
    """
    root = Path(root)

    if output is None:
        output = root / "assets.ts"
    else:
        output = Path(output)

    bundle = build_bundle(root)

    write_typescript(
        bundle=bundle,
        output=output,
    )

    return bundle


# ==========================
# CLI
# ==========================

def main() -> None:
    root = Path("../assets/no_longer_human/")
    output = root / "assets.ts"

    generate_assets(
        root=root,
        output=output,
    )

    print()
    print("Done.")
    print(f"Saved : {output}")


if __name__ == "__main__":
    main()
