#!/usr/bin/env python3
"""Audit one character's pose-to-pose scale against reference atlases."""

from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


CELL_WIDTH = 320
CELL_HEIGHT = 480
FRAME_COUNT = 12
ALPHA_THRESHOLD = 8
DEFAULT_MINIMUM_RATIO = 0.85
DEFAULT_MAXIMUM_RATIO = 1.15
POSE_NAMES = (
    "idle",
    "legacy run",
    "jump",
    "high kick",
    "dash",
    "stun",
    "run A",
    "run passing",
    "run B",
    "kick anticipation",
    "kick contact",
    "kick recovery",
)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bbox = alpha.point(
        lambda value: 255 if value > ALPHA_THRESHOLD else 0
    ).getbbox()
    if bbox is None:
        raise ValueError("frame contains no visible pixels")
    return bbox


def load_frames(path: Path) -> list[dict[str, object]]:
    atlas = Image.open(path).convert("RGBA")
    if atlas.size != (CELL_WIDTH * 4, CELL_HEIGHT * 3):
        raise ValueError(
            f"{path} is {atlas.width}x{atlas.height}; expected 1280x1440"
        )
    frames: list[dict[str, object]] = []
    for frame in range(FRAME_COUNT):
        left = (frame % 4) * CELL_WIDTH
        top = (frame // 4) * CELL_HEIGHT
        cell = atlas.crop((left, top, left + CELL_WIDTH, top + CELL_HEIGHT))
        x1, y1, x2, y2 = alpha_bbox(cell)
        frames.append(
            {
                "frame": frame,
                "image": cell,
                "bbox": (x1, y1, x2, y2),
                "width": x2 - x1,
                "height": y2 - y1,
                "area": (x2 - x1) * (y2 - y1),
            }
        )
    return frames


def create_board(
    target_id: str,
    frames: list[dict[str, object]],
    metrics: list[dict[str, object]],
    output_path: Path,
) -> None:
    columns = 4
    card_width = 320
    card_height = 360
    header_height = 72
    rows = 3
    board = Image.new(
        "RGBA",
        (columns * card_width, header_height + rows * card_height),
        (5, 20, 39, 255),
    )
    draw = ImageDraw.Draw(board)
    font = ImageFont.load_default()
    draw.text(
        (24, 18),
        f"Motion-relative scale parity | target: {target_id}",
        fill=(238, 248, 255, 255),
        font=font,
    )
    draw.text(
        (24, 39),
        "All poses at identical runtime canvas scale | compare face, torso, and perceived body scale across transitions",
        fill=(128, 205, 226, 255),
        font=font,
    )

    for frame, (frame_data, metric) in enumerate(zip(frames, metrics)):
        column = frame % columns
        row = frame // columns
        x = column * card_width
        y = header_height + row * card_height
        ratio = float(metric["target_to_reference_ratio"])
        passing = bool(metric["passes"])
        border = (74, 190, 138, 255) if passing else (255, 104, 104, 255)
        draw.rounded_rectangle(
            (x + 8, y + 8, x + card_width - 8, y + card_height - 8),
            radius=12,
            fill=(12, 43, 65, 255),
            outline=border,
            width=3,
        )
        ground_y = y + 288
        draw.line(
            (x + 20, ground_y, x + card_width - 20, ground_y),
            fill=(94, 207, 224, 255),
            width=2,
        )
        cell = frame_data["image"]
        frame_width = 230
        frame_height = round(CELL_HEIGHT * frame_width / CELL_WIDTH)
        rendered = cell.resize(
            (frame_width, frame_height),
            Image.Resampling.LANCZOS,
        )
        board.alpha_composite(
            rendered,
            (
                x + (card_width - frame_width) // 2,
                ground_y - round(418 * frame_height / CELL_HEIGHT),
            ),
        )
        draw.text(
            (x + 20, y + 305),
            f"{frame:02} {POSE_NAMES[frame]}",
            fill=(238, 248, 255, 255),
            font=font,
        )
        draw.text(
            (x + 20, y + 325),
            (
                f"area/idle {metric['target_area_ratio']:.3f} | "
                f"adult ref {metric['reference_area_ratio']:.3f} | "
                f"relative {ratio:.3f}"
            ),
            fill=border,
            font=font,
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    board.convert("RGB").save(output_path, quality=95)


def audit(
    target_id: str,
    target_atlas: Path,
    reference_atlases: list[Path],
    output_path: Path,
    *,
    minimum_ratio: float,
    maximum_ratio: float,
) -> dict[str, object]:
    errors: list[str] = []
    target_frames = load_frames(target_atlas)
    reference_frames = [load_frames(path) for path in reference_atlases]
    if not reference_frames:
        raise ValueError("At least one reference atlas is required")

    target_idle_area = int(target_frames[0]["area"])
    reference_idle_areas = [
        int(frames[0]["area"]) for frames in reference_frames
    ]
    metrics: list[dict[str, object]] = []
    for frame in range(FRAME_COUNT):
        target_area_ratio = (
            int(target_frames[frame]["area"]) / target_idle_area
        )
        reference_ratios = [
            int(frames[frame]["area"]) / idle_area
            for frames, idle_area in zip(
                reference_frames,
                reference_idle_areas,
            )
        ]
        reference_area_ratio = statistics.median(reference_ratios)
        target_to_reference_ratio = (
            target_area_ratio / reference_area_ratio
        )
        passes = (
            frame == 0
            or minimum_ratio <= target_to_reference_ratio <= maximum_ratio
        )
        if not passes:
            errors.append(
                f"frame {frame} ({POSE_NAMES[frame]}): relative area ratio "
                f"{target_to_reference_ratio:.3f} is outside "
                f"{minimum_ratio:.2f}–{maximum_ratio:.2f}"
            )
        metrics.append(
            {
                "frame": frame,
                "pose": POSE_NAMES[frame],
                "target_width": target_frames[frame]["width"],
                "target_height": target_frames[frame]["height"],
                "target_area_ratio": round(target_area_ratio, 4),
                "reference_area_ratio": round(reference_area_ratio, 4),
                "target_to_reference_ratio": round(
                    target_to_reference_ratio,
                    4,
                ),
                "passes": passes,
            }
        )

    create_board(target_id, target_frames, metrics, output_path)
    return {
        "target": target_id,
        "target_atlas": str(target_atlas.resolve()),
        "reference_atlases": [
            str(path.resolve()) for path in reference_atlases
        ],
        "comparison_image": str(output_path.resolve()),
        "allowed_target_to_reference_ratio": [
            minimum_ratio,
            maximum_ratio,
        ],
        "frames": metrics,
        "human_review_required": [
            "face and head remain the same perceived size across transitions",
            "torso and limb thickness do not pulse between adjacent run frames",
            "jump reads as a compressed pose rather than a larger character",
            "kick anticipation, contact, and recovery play without scale stutter",
            "hair, hands, and shoe soles remain complete after normalization",
        ],
        "errors": errors,
        "ok": not errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--id", required=True, dest="character_id")
    parser.add_argument("--atlas", required=True, type=Path)
    parser.add_argument(
        "--reference-atlas",
        required=True,
        action="append",
        type=Path,
        dest="reference_atlases",
    )
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--minimum-ratio",
        type=float,
        default=DEFAULT_MINIMUM_RATIO,
    )
    parser.add_argument(
        "--maximum-ratio",
        type=float,
        default=DEFAULT_MAXIMUM_RATIO,
    )
    args = parser.parse_args()
    output = args.output or Path(
        f"output/character-audits/{args.character_id}-motion-parity.png"
    )
    report = audit(
        args.character_id,
        args.atlas,
        args.reference_atlases,
        output,
        minimum_ratio=args.minimum_ratio,
        maximum_ratio=args.maximum_ratio,
    )
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
