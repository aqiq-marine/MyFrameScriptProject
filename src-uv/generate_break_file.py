from pathlib import Path
import sys

from punctuation_analyzer import estimate_breaks


# ==========================
# LAB読み込み
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
                "symbol": cols[2],
            })

    return lipsync


# ==========================
# BRK出力
# ==========================

def write_brk(path: Path, breaks):

    with path.open(
        "w",
        encoding="utf-8",
        newline="\n"
    ) as f:

        for item in breaks:
            f.write(
                f"{item['char']} "
                f"{item['time']:.6f} "
                f"{item['priority']}\n"
            )


# ==========================
# メイン
# ==========================

def process_directory(root: Path):

    for wav in root.rglob("*.wav"):

        stem = wav.with_suffix("")

        txt = stem.with_suffix(".txt")
        lab = stem.with_suffix(".lab")
        brk = stem.with_suffix(".brk")

        if not txt.exists():
            print(f"Skip: TXT not found: {wav}")
            continue

        if not lab.exists():
            print(f"Skip: LAB not found: {wav}")
            continue

        script_text = txt.read_text(
            encoding="utf-8"
        ).strip()

        lipsync = parse_lab(lab)

        breaks = estimate_breaks(
            script_text,
            lipsync
        )

        write_brk(
            brk,
            breaks
        )

        print(f"Generated: {brk}")


# ==========================
# エントリーポイント
# ==========================

if __name__ == "__main__":

    # if len(sys.argv) != 2:
    #     print(
    #         "Usage: python generate_brk.py <directory>"
    #     )
    #     sys.exit(1)

    # root = Path(sys.argv[1])

    root = Path(
        "../assets/no_longer_human/"
    )

    if not root.exists():
        print(f"Directory not found: {root}")
        sys.exit(1)

    if not root.is_dir():
        print(f"Not a directory: {root}")
        sys.exit(1)

    process_directory(root)

    print()
    print("Done.")
