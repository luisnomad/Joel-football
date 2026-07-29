#!/usr/bin/env python3
"""Validate a Joel Football twelve-frame character atlas."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


ATLAS_SIZE = (1280, 1440)
CELL_SIZE = (320, 480)
GROUND_Y = 418
MIN_SIDE_MARGIN = 8
ALPHA_THRESHOLD = 8
GROUNDED = frozenset({0, 1, 4, 5, 6, 7, 8, 9, 10, 11})


def visible_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    return alpha.point(
        lambda value: 255 if value > ALPHA_THRESHOLD else 0
    ).getbbox()


def audit(path: Path) -> dict[str, object]:
    atlas = Image.open(path).convert("RGBA")
    errors: list[str] = []
    frames: list[dict[str, int]] = []
    if atlas.size != ATLAS_SIZE:
        errors.append(
            f"atlas is {atlas.size[0]}x{atlas.size[1]}, expected 1280x1440"
        )

    for frame in range(12):
        column = frame % 4
        row = frame // 4
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
