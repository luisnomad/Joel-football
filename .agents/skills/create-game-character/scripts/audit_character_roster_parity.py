#!/usr/bin/env python3
"""Build a runtime-scale idle comparison board for the complete character roster."""

from __future__ import annotations

import argparse
import json
import re
import statistics
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


CELL_WIDTH = 320
CELL_HEIGHT = 480
DISPLAY_WIDTH = 280 * (CELL_WIDTH / CELL_HEIGHT)
DISPLAY_HEIGHT = 280
ALPHA_THRESHOLD = 8
ENTRY_PATTERN = re.compile(
    r"Object\.freeze\(\{\s*id:\s*['\"](?P<id>[^'\"]+)['\"]"
    r"(?P<body>.*?)(?=\n\s*\}\),\n\s*(?:Object\.freeze|\]\);))",
    re.DOTALL,
)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    bbox = alpha.point(
        lambda value: 255 if value > ALPHA_THRESHOLD else 0
    ).getbbox()
    if bbox is None:
        raise ValueError("idle frame contains no visible pixels")
    return bbox


def parse_catalog(catalog_path: Path) -> list[dict[str, object]]:
    catalog = catalog_path.read_text(encoding="utf-8")
    characters: list[dict[str, object]] = []
    for match in ENTRY_PATTERN.finditer(catalog):
        body = match.group("body")
        name_match = re.search(r"\bname:\s*['\"]([^'\"]+)['\"]", body)
        sheet_match = re.search(
            r"\bsheetAsset:\s*['\"]([^'\"]+)['\"]", body
        )
        scale_match = re.search(r"\bvisualScale:\s*([0-9.]+)", body)
        if sheet_match is None:
            continue
        characters.append(
            {
                "id": match.group("id"),
                "name": name_match.group(1) if name_match else match.group("id"),
                "sheet_asset": sheet_match.group(1),
                "visual_scale": (
                    float(scale_match.group(1)) if scale_match else 1.0
                ),
            }
        )
    return characters


def collect_roster(root: Path) -> tuple[list[dict[str, object]], list[str]]:
    errors: list[str] = []
    roster: list[dict[str, object]] = []
    catalog_path = root / "src/game/content/characters.js"
    for character in parse_catalog(catalog_path):
        source_name = str(character["sheet_asset"]).replace(".webp", ".png")
        atlas_path = root / "source-assets/animation/final" / source_name
        if not atlas_path.is_file():
            errors.append(
                f"{character['id']}: missing lossless atlas {atlas_path}"
            )
            continue
        atlas = Image.open(atlas_path).convert("RGBA")
        if atlas.size != (CELL_WIDTH * 4, CELL_HEIGHT * 3):
            errors.append(
                f"{character['id']}: atlas is {atlas.width}x{atlas.height}"
            )
            continue
        idle = atlas.crop((0, 0, CELL_WIDTH, CELL_HEIGHT))
        left, top, right, bottom = alpha_bbox(idle)
        scale = float(character["visual_scale"])
        visible_width = (right - left) * (DISPLAY_WIDTH / CELL_WIDTH) * scale
        visible_height = (bottom - top) * (DISPLAY_HEIGHT / CELL_HEIGHT) * scale
        roster.append(
            {
                **character,
                "atlas": str(atlas_path.resolve()),
                "idle": idle,
                "bbox": (left, top, right, bottom),
                "runtime_visible_width": round(visible_width, 2),
                "runtime_visible_height": round(visible_height, 2),
                "runtime_visible_area": round(
                    visible_width * visible_height, 2
                ),
            }
        )
    return roster, errors


def create_board(
    roster: list[dict[str, object]],
    target_id: str,
    output_path: Path,
) -> None:
    columns = 4
    card_width = 280
    card_height = 360
    rows = (len(roster) + columns - 1) // columns
    board = Image.new(
        "RGBA",
        (columns * card_width, 70 + rows * card_height),
        (5, 20, 39, 255),
    )
    draw = ImageDraw.Draw(board)
    font = ImageFont.load_default()
    draw.text(
        (24, 20),
        f"Roster-relative idle parity | target: {target_id}",
        fill=(238, 248, 255, 255),
        font=font,
    )
    draw.text(
        (24, 40),
        "Runtime visualScale applied | shared ground line | compare head/body ratio and perceived prominence",
        fill=(128, 205, 226, 255),
        font=font,
    )

    for index, character in enumerate(roster):
        column = index % columns
        row = index // columns
        x = column * card_width
        y = 70 + row * card_height
        is_target = character["id"] == target_id
        card_color = (20, 63, 89, 255) if is_target else (10, 36, 58, 255)
        border_color = (255, 205, 82, 255) if is_target else (58, 106, 132, 255)
        draw.rounded_rectangle(
            (x + 8, y + 8, x + card_width - 8, y + card_height - 8),
            radius=12,
            fill=card_color,
            outline=border_color,
            width=4 if is_target else 2,
        )
        ground_y = y + 287
        draw.line(
            (x + 24, ground_y, x + card_width - 24, ground_y),
            fill=(94, 207, 224, 255),
            width=2,
        )

        idle = character["idle"]
        scale = float(character["visual_scale"])
        frame_width = round(160 * scale)
        frame_height = round(240 * scale)
        rendered = idle.resize(
            (frame_width, frame_height), Image.Resampling.LANCZOS
        )
        paste_x = x + (card_width - frame_width) // 2
        paste_y = ground_y - round((418 / CELL_HEIGHT) * frame_height)
        board.alpha_composite(rendered, (paste_x, paste_y))

        label = f"{character['name']} ({character['id']})"
        metrics = (
            f"{character['runtime_visible_width']:.0f}x"
            f"{character['runtime_visible_height']:.0f}px visible | "
            f"scale {scale:.2f}"
        )
        draw.text(
            (x + 24, y + 305),
            label,
            fill=(255, 220, 109, 255) if is_target else (238, 248, 255, 255),
            font=font,
        )
        draw.text(
            (x + 24, y + 325),
            metrics,
            fill=(169, 210, 226, 255),
            font=font,
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    board.convert("RGB").save(output_path, quality=95)


def audit(
    root: Path,
    target_id: str,
    output_path: Path,
    *,
    cohort: str,
    minimum_height_ratio: float,
    maximum_height_ratio: float,
    minimum_width_ratio: float,
    maximum_width_ratio: float,
) -> dict[str, object]:
    root = root.resolve()
    roster, errors = collect_roster(root)
    target = next(
        (character for character in roster if character["id"] == target_id),
        None,
    )
    if target is None:
        errors.append(f"target character is not in the audited roster: {target_id}")

    metrics: dict[str, object] = {}
    if target is not None and len(roster) >= 3:
        heights = [
            float(character["runtime_visible_height"]) for character in roster
        ]
        widths = [
            float(character["runtime_visible_width"]) for character in roster
        ]
        median_height = statistics.median(heights)
        median_width = statistics.median(widths)
        height_ratio = (
            float(target["runtime_visible_height"]) / median_height
        )
        width_ratio = float(target["runtime_visible_width"]) / median_width
        metrics = {
            "median_runtime_visible_width": round(median_width, 2),
            "median_runtime_visible_height": round(median_height, 2),
            "target_width_ratio": round(width_ratio, 3),
            "target_height_ratio": round(height_ratio, 3),
            "allowed_width_ratio": [
                minimum_width_ratio,
                maximum_width_ratio,
            ],
            "allowed_height_ratio": [
                minimum_height_ratio,
                maximum_height_ratio,
            ],
        }
        if not minimum_height_ratio <= height_ratio <= maximum_height_ratio:
            errors.append(
                f"{target_id}: runtime visible height ratio "
                f"{height_ratio:.3f} is outside "
                f"{minimum_height_ratio:.2f}–{maximum_height_ratio:.2f}"
            )
        if not minimum_width_ratio <= width_ratio <= maximum_width_ratio:
            errors.append(
                f"{target_id}: runtime visible width ratio "
                f"{width_ratio:.3f} is outside "
                f"{minimum_width_ratio:.2f}–{maximum_width_ratio:.2f}"
            )
        create_board(roster, target_id, output_path)
    elif len(roster) < 3:
        errors.append("roster parity requires at least three valid characters")

    serializable_roster = [
        {
            key: value
            for key, value in character.items()
            if key != "idle"
        }
        for character in roster
    ]
    return {
        "target": target_id,
        "cohort": cohort,
        "comparison_image": str(output_path.resolve()),
        "roster": serializable_roster,
        "metrics": metrics,
        "human_review_required": [
            "head-to-body ratio matches the character's age cohort",
            "target has comparable perceived prominence beside Joel and an adult",
            "feet share the ground line and no hair or shoes are clipped",
            "idle pose and native facing agree with action frames",
        ],
        "errors": errors,
        "ok": not errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--id", required=True, dest="character_id")
    parser.add_argument("--output", type=Path)
    parser.add_argument(
        "--cohort",
        choices=("adult", "child", "auto"),
        default="auto",
        help="Adult targets use a stricter minimum silhouette-presence gate.",
    )
    parser.add_argument("--minimum-height-ratio", type=float)
    parser.add_argument("--maximum-height-ratio", type=float, default=1.20)
    parser.add_argument("--minimum-width-ratio", type=float)
    parser.add_argument("--maximum-width-ratio", type=float, default=1.45)
    args = parser.parse_args()
    output = args.output or (
        args.root
        / "output/character-audits"
        / f"{args.character_id}-roster-parity.png"
    )
    minimum_height_ratio = args.minimum_height_ratio
    if minimum_height_ratio is None:
        minimum_height_ratio = 0.90 if args.cohort == "adult" else 0.82
    minimum_width_ratio = args.minimum_width_ratio
    if minimum_width_ratio is None:
        minimum_width_ratio = 0.85 if args.cohort == "adult" else 0.65
    report = audit(
        args.root,
        args.character_id,
        output,
        cohort=args.cohort,
        minimum_height_ratio=minimum_height_ratio,
        maximum_height_ratio=args.maximum_height_ratio,
        minimum_width_ratio=minimum_width_ratio,
        maximum_width_ratio=args.maximum_width_ratio,
    )
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
