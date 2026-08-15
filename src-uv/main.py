from pathlib import Path
import sys

from generate_break_file import process_directory
from build_assets import generate_assets


if __name__ == "__main__":

    if len(sys.argv) != 2:
        print(
            "Usage: python main.py <directory>"
        )
        sys.exit(1)

    root = Path(sys.argv[1])

    if not root.exists():
        print(f"Directory not found: {root}")
        sys.exit(1)

    if not root.is_dir():
        print(f"Not a directory: {root}")
        sys.exit(1)

    print("generating break files.")

    process_directory(root)

    print()
    print("Done.")

    print()
    print("building assets.ts")

    output = root / "assets.ts"

    generate_assets(
        root=root,
        output=output,
    )

    print()
    print("Done.")
    print(f"Saved : {output}")


