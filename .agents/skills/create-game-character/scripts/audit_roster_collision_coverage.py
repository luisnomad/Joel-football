#!/usr/bin/env python3
"""Audit Football idle head coverage for every catalog character."""

from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

from PIL import Image


CELL_WIDTH = 320
CELL_HEIGHT = 480
SOURCE_GROUND_Y = 418
WORLD_GROUND_Y = 636
DISPLAY_HEIGHT = 280
ALPHA_THRESHOLD = 8
MAX_IDLE_TOP_GAP = 4
STANDARD_HEAD_TOP = -116
STANDARD_BODY_BOTTOM = 70
HEAD_CAP_RADIUS = 40


def visible_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    return alpha.point(
        lambda value: 255 if value > ALPHA_THRESHOLD else 0
    ).getbbox()


def load_runtime_metadata(root: Path) -> list[dict[str, object]]:
    script = """
      import { CHARACTERS, getCharacterFrameScale, getCharacterVisualScale }
        from './src/game/content/characters.js';
      import { getFootballCollisionGeometry }
        from './src/game/content/characterCollisionProfiles.js';
      console.log(JSON.stringify(CHARACTERS.map((character) => ({
        id: character.id,
        sheetAsset: character.sheetAsset,
        visualScale: getCharacterVisualScale(character),
        idleFrameScale: getCharacterFrameScale(character, 0),
        collisionProfile: character.collisionProfile ?? 'standard',
        collision: getFootballCollisionGeometry(character),
      }))));
    """
    result = subprocess.run(
        ["node", "--input-type=module", "--eval", script],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def collider_top(collision: dict[str, object]) -> float:
    body_scale = float(collision["bodyScale"])
    head_cap_y = float(collision["headCapY"])
    unscaled_top = min(STANDARD_HEAD_TOP, head_cap_y - HEAD_CAP_RADIUS)
    height = (STANDARD_BODY_BOTTOM - unscaled_top) * body_scale
    return WORLD_GROUND_Y - height


def audit(root: Path) -> dict[str, object]:
    characters = load_runtime_metadata(root)
    errors: list[str] = []
    reports: list[dict[str, object]] = []

    for character in characters:
        asset = root / "public" / "assets" / str(character["sheetAsset"])
        if not asset.exists():
            errors.append(f"{character['id']}: missing atlas {asset}")
            continue
        atlas = Image.open(asset).convert("RGBA")
        idle = atlas.crop((0, 0, CELL_WIDTH, CELL_HEIGHT))
        bbox = visible_bbox(idle)
        if bbox is None:
            errors.append(f"{character['id']}: idle frame is empty")
            continue

        _, source_top, _, source_bottom = bbox
        visual_scale = float(character["visualScale"])
        frame_scale = float(character["idleFrameScale"])
        source_to_world = DISPLAY_HEIGHT / CELL_HEIGHT * visual_scale * frame_scale
        visual_top = WORLD_GROUND_Y + (
            source_top - SOURCE_GROUND_Y
        ) * source_to_world
        physics_top = collider_top(character["collision"])
        idle_top_gap = max(0.0, physics_top - visual_top)
        covered = idle_top_gap <= MAX_IDLE_TOP_GAP
        report = {
            "id": character["id"],
            "asset": str(asset.relative_to(root)),
            "collisionProfile": character["collisionProfile"],
            "visualScale": visual_scale,
            "sourceIdleTop": source_top,
            "sourceIdleBottom": source_bottom,
            "worldVisualTop": round(visual_top, 2),
            "worldColliderTop": round(physics_top, 2),
            "idleTopGap": round(idle_top_gap, 2),
            "covered": covered,
        }
        reports.append(report)
        if not covered:
            errors.append(
                f"{character['id']}: idle art extends {idle_top_gap:.2f}px "
                f"above collider (maximum {MAX_IDLE_TOP_GAP}px)"
            )

    return {
        "scope": (
            "Nominal grounded idle pose. Action limbs are governed by strike "
            "sensors and are not expected to reshape the stable main body."
        ),
        "maximumIdleTopGap": MAX_IDLE_TOP_GAP,
        "characters": reports,
        "errors": errors,
        "ok": not errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--out", type=Path)
    args = parser.parse_args()
    root = args.root.resolve()
    report = audit(root)
    encoded = json.dumps(report, indent=2)
    print(encoded)
    if args.out:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(f"{encoded}\n", encoding="utf-8")
    raise SystemExit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
