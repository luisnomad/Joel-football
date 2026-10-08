#!/usr/bin/env python3
"""Validate a Joel Football character atlas.

Two layouts (src/game/pure/characterAnimation.js CHARACTER_LAYOUTS), detected
from the image size:
  classic    1280x1440, 4x3 cells of 320x480, 12 frames
  roster-v2  2016x1920, 6x4 cells of 336x480, 24 frames (sprite redo)
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


GROUND_Y = 418
MIN_SIDE_MARGIN = 8
ALPHA_THRESHOLD = 8
LAYOUTS = {
    (1280, 1440): {
        "id": "classic", "cell": (320, 480), "columns": 4, "frames": 12,
        "grounded": frozenset({0, 1, 4, 5, 6, 7, 8, 9, 10, 11}),
    },
    (2016, 1920): {
        "id": "roster-v2", "cell": (336, 480), "columns": 6, "frames": 24,
        # every cell except jump (13) and the chilena drawings (17-19)
        "grounded": frozenset(set(range(24)) - {13, 17, 18, 19}),
    },
}


def visible_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    return alpha.point(
        lambda value: 255 if value > ALPHA_THRESHOLD else 0
    ).getbbox()


def audit(path: Path) -> dict[str, object]:
    atlas = Image.open(path).convert("RGBA")
    errors: list[str] = []
    frames: list[dict[str, int]] = []
    layout = LAYOUTS.get(atlas.size)
    if layout is None:
        errors.append(
            f"atlas is {atlas.size[0]}x{atlas.size[1]}, expected "
            + " or ".join(f"{w}x{h}" for w, h in LAYOUTS)
        )
        layout = LAYOUTS[(1280, 1440)]
    CELL_SIZE = layout["cell"]
    GROUNDED = layout["grounded"]

    for frame in range(layout["frames"]):
        column = frame % layout["columns"]
        row = frame // layout["columns"]
        cell = atlas.crop((
            column * CELL_SIZE[0],
            row * CELL_SIZE[1],
            (column + 1) * CELL_SIZE[0],
            (row + 1) * CELL_SIZE[1],
        ))
        bbox = visible_bbox(cell)
        if bbox is None:
            errors.append(f"frame {frame} is empty")
            continue
        left, top, right, bottom = bbox
        frames.append({
            "frame": frame,
            "left": left,
            "top": top,
            "right": right,
            "bottom": bottom,
            "width": right - left,
            "height": bottom - top,
        })
        if min(left, CELL_SIZE[0] - right) < MIN_SIDE_MARGIN:
            errors.append(
                f"frame {frame} side margin is "
                f"{min(left, CELL_SIZE[0] - right)}px, expected >= "
                f"{MIN_SIDE_MARGIN}px"
            )
        if frame in GROUNDED and bottom != GROUND_Y:
            errors.append(
                f"frame {frame} ground is y={bottom}, expected y={GROUND_Y}"
            )

    return {
        "atlas": str(path.resolve()),
        "size": {"width": atlas.width, "height": atlas.height},
        "layout": layout["id"],
        "frames": frames,
        "errors": errors,
        "ok": not errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--atlas", required=True, type=Path)
    args = parser.parse_args()
    report = audit(args.atlas)
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
