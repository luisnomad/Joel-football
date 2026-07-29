#!/usr/bin/env python3
"""Audit one photo-derived Joel Football character package and integration."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from PIL import Image

from audit_character_atlas import audit as audit_atlas


REQUIRED_SOURCE_FILES = (
    "identity-anchor-chroma.png",
    "identity-anchor.png",
    "pose-sheet-chroma.png",
    "pose-sheet.png",
    "PROMPTS.md",
    "README.md",
)
TEXT_ENCODINGS = ("utf-8", "utf-8-sig")
ALPHA_THRESHOLD = 8


def read_text(path: Path) -> str:
    for encoding in TEXT_ENCODINGS:
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_text()


def image_alpha_report(
    path: Path,
    *,
    expected_size: tuple[int, int] | None = None,
    require_edge_clearance: int = 0,
) -> tuple[dict[str, object], list[str]]:
    errors: list[str] = []
    image = Image.open(path).convert("RGBA")
    alpha = image.getchannel("A")
    bbox = alpha.point(
        lambda value: 255 if value > ALPHA_THRESHOLD else 0
    ).getbbox()
    if expected_size is not None and image.size != expected_size:
        errors.append(
            f"{path} is {image.width}x{image.height}, expected "
            f"{expected_size[0]}x{expected_size[1]}"
        )
    if bbox is None:
        errors.append(f"{path} has no visible alpha")
    elif require_edge_clearance:
        left, top, right, bottom = bbox
        margins = (left, top, image.width - right, image.height - bottom)
        if min(margins) < require_edge_clearance:
            errors.append(
                f"{path} visible alpha is too close to an edge: "
                f"margins={margins}, expected >= {require_edge_clearance}px"
            )
    corners = (
        alpha.getpixel((0, 0)),
        alpha.getpixel((image.width - 1, 0)),
        alpha.getpixel((0, image.height - 1)),
        alpha.getpixel((image.width - 1, image.height - 1)),
    )
    if max(corners) > ALPHA_THRESHOLD:
        errors.append(f"{path} does not have transparent corners")
    return {
        "path": str(path.resolve()),
        "size": {"width": image.width, "height": image.height},
        "visible_bbox": bbox,
        "corner_alpha": corners,
    }, errors


def audit(root: Path, character_id: str, version: int) -> dict[str, object]:
    root = root.resolve()
    source_dir = root / f"source-assets/characters/{character_id}-v{version}"
    lossless_atlas = (
        root
        / f"source-assets/animation/final/player-{character_id}-sheet-v{version}.png"
    )
    runtime_atlas = (
        root / f"public/assets/player-{character_id}-sheet-v{version}.webp"
    )
    portrait = root / f"public/assets/player-{character_id}-portrait.png"
    catalog_path = root / "src/game/content/characters.js"
    builder_path = root / "scripts/build-character-animation-atlases.py"
    errors: list[str] = []
    files: dict[str, bool] = {}
    images: dict[str, object] = {}

    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", character_id):
        errors.append(
            "character id must use lowercase letters, digits, and hyphens"
        )

    for filename in REQUIRED_SOURCE_FILES:
        path = source_dir / filename
        files[str(path.relative_to(root))] = path.is_file()
        if not path.is_file():
            errors.append(f"missing source file: {path.relative_to(root)}")

    for path in (lossless_atlas, runtime_atlas, portrait):
        files[str(path.relative_to(root))] = path.is_file()
        if not path.is_file():
            errors.append(f"missing runtime file: {path.relative_to(root)}")

    for filename in ("identity-anchor.png", "pose-sheet.png"):
        path = source_dir / filename
        if path.is_file():
            report, image_errors = image_alpha_report(path)
            images[filename] = report
            errors.extend(image_errors)

    if portrait.is_file():
        report, image_errors = image_alpha_report(
            portrait,
            expected_size=(512, 512),
            require_edge_clearance=4,
        )
        images["portrait"] = report
        errors.extend(image_errors)

    atlas_reports: dict[str, object] = {}
    for label, path in (
        ("lossless", lossless_atlas),
        ("runtime", runtime_atlas),
    ):
        if not path.is_file():
            continue
        report = audit_atlas(path)
        atlas_reports[label] = report
        errors.extend(f"{label} atlas: {error}" for error in report["errors"])

    catalog_text = read_text(catalog_path) if catalog_path.is_file() else ""
    builder_text = read_text(builder_path) if builder_path.is_file() else ""
    expected_sheet = f"player-{character_id}-sheet-v{version}.webp"
    expected_portrait = f"player-{character_id}-portrait.png"
    integration_checks = {
        "catalog_id": bool(
            re.search(rf"\bid:\s*['\"]{re.escape(character_id)}['\"]", catalog_text)
        ),
        "catalog_sheet": expected_sheet in catalog_text,
        "catalog_portrait": expected_portrait in catalog_text,
        "builder_registration": bool(
            re.search(rf"['\"]{re.escape(character_id)}['\"]\s*:", builder_text)
        ),
    }
    for name, passed in integration_checks.items():
        if not passed:
            errors.append(f"integration check failed: {name}")

    prompts_path = source_dir / "PROMPTS.md"
    readme_path = source_dir / "README.md"
    provenance_checks = {
        "prompt_has_identity_section": False,
        "prompt_has_pose_section": False,
        "readme_mentions_private_photos": False,
        "readme_mentions_runtime_outputs": False,
    }
    if prompts_path.is_file():
        prompts = read_text(prompts_path).lower()
        provenance_checks["prompt_has_identity_section"] = (
            "identity" in prompts and "anchor" in prompts
        )
        provenance_checks["prompt_has_pose_section"] = (
            "pose" in prompts
            and (
                "4×3" in prompts
                or "4x3" in prompts
                or ("4-column" in prompts and "3-row" in prompts)
            )
        )
    if readme_path.is_file():
        readme = read_text(readme_path).lower()
        provenance_checks["readme_mentions_private_photos"] = (
            "private" in readme and "photo" in readme
        )
        provenance_checks["readme_mentions_runtime_outputs"] = (
            expected_sheet.lower() in readme
            and expected_portrait.lower() in readme
        )
    for name, passed in provenance_checks.items():
        if not passed:
            errors.append(f"provenance check failed: {name}")

    return {
        "character": {"id": character_id, "version": version},
        "root": str(root),
        "files": files,
        "images": images,
        "atlases": atlas_reports,
        "integration": integration_checks,
        "provenance": provenance_checks,
        "errors": errors,
        "ok": not errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=Path.cwd())
    parser.add_argument("--id", required=True, dest="character_id")
    parser.add_argument("--version", required=True, type=int)
    args = parser.parse_args()
    report = audit(args.root, args.character_id, args.version)
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
