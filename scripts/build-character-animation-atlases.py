#!/usr/bin/env python3
"""Build registered twelve-frame player atlases from legacy and selected art."""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
CELL_WIDTH = 320
CELL_HEIGHT = 480
GROUND_ANCHOR_Y = 418
SAFE_HORIZONTAL_MARGIN = 8
ALPHA_THRESHOLD = 8
GROUNDED_FRAMES = frozenset({0, 1, 4, 5, 6, 7, 8, 9, 10, 11})

PLAYERS = {
    "joel": {
        "legacy": ROOT / "public/assets/player-nova-sheet.png",
        "selected": ROOT / "source-assets/animation/selected/joel",
        "source_out": ROOT / "source-assets/animation/final/player-nova-sheet-v2.png",
        "runtime_out": ROOT / "public/assets/player-nova-sheet-v2.webp",
        "run_height": 357,
        "kick_height": 347,
    },
    "vex": {
        "legacy": ROOT / "public/assets/player-vex-sheet.png",
        "selected": ROOT / "source-assets/animation/selected/vex",
        "source_out": ROOT / "source-assets/animation/final/player-vex-sheet-v2.png",
        "runtime_out": ROOT / "public/assets/player-vex-sheet-v2.webp",
        "run_height": 346,
        "kick_height": 361,
    },
}

CONTACT_SHEET_PLAYERS = {
    "juan": {
        "sheet": ROOT / "source-assets/animation/selected/juan/contact-sheet.png",
        "source_out": ROOT / "public/assets/player-juan-sheet-v3.png",
        "runtime_out": ROOT / "public/assets/player-juan-sheet-v3.webp",
    },
    "juanjo": {
        "sheet": ROOT / "source-assets/animation/selected/juanjo/contact-sheet.png",
        "source_out": ROOT / "public/assets/player-juanjo-sheet-v1.png",
        "runtime_out": ROOT / "public/assets/player-juanjo-sheet-v1.webp",
    },
}

CONTACT_POSE_MAP = (0, 1, 4, 6, 7, 8, 1, 2, 3, 9, 5, 11)

GENERATED_FRAMES = {
    6: "run-a.png",
    7: "run-passing.png",
    8: "run-b.png",
    9: "kick-anticipation.png",
    10: "kick-contact-v2.png",
    11: "kick-recovery.png",
}


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A")
    binary = alpha.point(lambda value: 255 if value > ALPHA_THRESHOLD else 0)
    bbox = binary.getbbox()
    if bbox is None:
        raise ValueError("Frame contains no visible pixels")
    return bbox


def keep_largest_alpha_component(image: Image.Image) -> Image.Image:
    """Discard disconnected chroma-removal fragments while retaining soft edges."""

    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    alpha_bytes = alpha.tobytes()
    width, height = rgba.size
    total = width * height
    solid = bytearray(value > ALPHA_THRESHOLD for value in alpha_bytes)
    visited = bytearray(total)
    largest: list[int] = []

    for seed in range(total):
        if not solid[seed] or visited[seed]:
            continue
        component: list[int] = []
        queue = deque([seed])
        visited[seed] = 1
        while queue:
            index = queue.pop()
            component.append(index)
            x = index % width
            y = index // width
            if x > 0:
                neighbor = index - 1
                if solid[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if x + 1 < width:
                neighbor = index + 1
                if solid[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if y > 0:
                neighbor = index - width
                if solid[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
            if y + 1 < height:
                neighbor = index + width
                if solid[neighbor] and not visited[neighbor]:
                    visited[neighbor] = 1
                    queue.append(neighbor)
        if len(component) > len(largest):
            largest = component

    if not largest:
        raise ValueError("Generated frame contains no connected subject")

    cleaned_alpha = bytearray(total)
    for index in largest:
        cleaned_alpha[index] = alpha_bytes[index]
    rgba.putalpha(Image.frombytes("L", rgba.size, bytes(cleaned_alpha)))
    return rgba


def resize_to_height(image: Image.Image, target_height: int) -> Image.Image:
    target_width = max(1, round(image.width * target_height / image.height))
    return image.resize((target_width, target_height), Image.Resampling.LANCZOS)


def enforce_horizontal_margin(content: Image.Image) -> Image.Image:
    maximum_width = CELL_WIDTH - SAFE_HORIZONTAL_MARGIN * 2
    if content.width <= maximum_width:
        return content
    target_height = max(1, round(content.height * maximum_width / content.width))
    return content.resize((maximum_width, target_height), Image.Resampling.LANCZOS)


def normalize_content(
    content: Image.Image,
    *,
    frame: int,
    original_top: int | None = None,
    grounded: bool | None = None,
) -> Image.Image:
    content = enforce_horizontal_margin(content)
    x = (CELL_WIDTH - content.width) // 2
    is_grounded = frame in GROUNDED_FRAMES if grounded is None else grounded
    y = GROUND_ANCHOR_Y - content.height if is_grounded else original_top
    if y is None:
        raise ValueError(f"Frame {frame} is airborne but has no original top offset")
    if x < 0 or y < 0 or x + content.width > CELL_WIDTH or y + content.height > CELL_HEIGHT:
        raise ValueError(
            f"Frame {frame} does not fit: content={content.size}, position=({x}, {y})"
        )
    cell = Image.new("RGBA", (CELL_WIDTH, CELL_HEIGHT), (0, 0, 0, 0))
    cell.alpha_composite(content, (x, y))
    return cell


def legacy_cells(sheet_path: Path) -> dict[int, Image.Image]:
    sheet = Image.open(sheet_path).convert("RGBA")
    cells: dict[int, Image.Image] = {}
    for frame in range(6):
        column = frame % 3
        row = frame // 3
        cell = sheet.crop((column * 418, row * 627, column * 418 + 418, row * 627 + 627))
        cell = cell.resize((CELL_WIDTH, CELL_HEIGHT), Image.Resampling.LANCZOS)
        bbox = alpha_bbox(cell)
        content = cell.crop(bbox)
        cells[frame] = normalize_content(content, frame=frame, original_top=bbox[1])
    return cells


def generated_cells(player: dict[str, object]) -> dict[int, Image.Image]:
    selected_dir = Path(player["selected"])
    cells: dict[int, Image.Image] = {}
    for frame, filename in GENERATED_FRAMES.items():
        image = Image.open(selected_dir / filename).convert("RGBA")
        image = keep_largest_alpha_component(image)
        bbox = alpha_bbox(image)
        content = image.crop(bbox)
        target_height = int(player["run_height"] if frame <= 8 else player["kick_height"])
        content = resize_to_height(content, target_height)
        cells[frame] = normalize_content(content, frame=frame)
    return cells


def validate_cell(player_name: str, frame: int, cell: Image.Image) -> None:
    left, top, right, bottom = alpha_bbox(cell)
    left_margin = left
    right_margin = CELL_WIDTH - right
    if min(left_margin, right_margin) < SAFE_HORIZONTAL_MARGIN:
        raise ValueError(
            f"{player_name} frame {frame} has unsafe horizontal margins: "
            f"left={left_margin}, right={right_margin}"
        )
    if frame in GROUNDED_FRAMES and bottom != GROUND_ANCHOR_Y:
        raise ValueError(
            f"{player_name} frame {frame} ground anchor is {bottom}, expected {GROUND_ANCHOR_Y}"
        )
    print(
        f"{player_name:4} frame={frame:02} bounds={right-left}x{bottom-top} "
        f"offset={left},{top} margins={left_margin},{right_margin} bottom={bottom}"
    )


def build_player(player_name: str, player: dict[str, object]) -> None:
    cells = legacy_cells(Path(player["legacy"]))
    cells.update(generated_cells(player))
    atlas = Image.new("RGBA", (CELL_WIDTH * 4, CELL_HEIGHT * 3), (0, 0, 0, 0))
    for frame in range(12):
        cell = cells[frame]
        validate_cell(player_name, frame, cell)
        atlas.alpha_composite(cell, ((frame % 4) * CELL_WIDTH, (frame // 4) * CELL_HEIGHT))

    source_out = Path(player["source_out"])
    runtime_out = Path(player["runtime_out"])
    source_out.parent.mkdir(parents=True, exist_ok=True)
    runtime_out.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(source_out, format="PNG", optimize=True)
    atlas.save(runtime_out, format="WEBP", lossless=True, quality=90, method=6)


def contact_sheet_source_cells(sheet_path: Path) -> list[Image.Image]:
    """Split an uneven generated 4x3 contact sheet into clean character cells."""

    sheet = Image.open(sheet_path).convert("RGBA")
    cells: list[Image.Image] = []
    for source_frame in range(12):
        column = source_frame % 4
        row = source_frame // 4
        left = round(column * sheet.width / 4)
        right = round((column + 1) * sheet.width / 4)
        top = round(row * sheet.height / 3)
        bottom = round((row + 1) * sheet.height / 3)
        cell = keep_largest_alpha_component(sheet.crop((left, top, right, bottom)))
        cells.append(cell.crop(alpha_bbox(cell)))
    return cells


def build_contact_sheet_player(player_name: str, player: dict[str, object]) -> None:
    source_cells = contact_sheet_source_cells(Path(player["sheet"]))
    idle = source_cells[0]
    scale = 380 / idle.height
    atlas = Image.new("RGBA", (CELL_WIDTH * 4, CELL_HEIGHT * 3), (0, 0, 0, 0))

    for frame, source_frame in enumerate(CONTACT_POSE_MAP):
        source = source_cells[source_frame]
        width = max(1, round(source.width * scale))
        height = max(1, round(source.height * scale))
        content = source.resize((width, height), Image.Resampling.LANCZOS)
        if content.height > 380:
            content = resize_to_height(content, 380)
        content = enforce_horizontal_margin(content)
        # Resampling can leave a fully transparent outer row. Trim once more
        # so the visible pixels, not the nominal bitmap edge, hit the baseline.
        content = content.crop(alpha_bbox(content))
        # Phaser moves the whole sprite for jumps and chilenas, so keeping the
        # artwork on one internal foot line prevents pose-to-pose visual pops.
        cell = normalize_content(content, frame=frame, grounded=True)
        validate_cell(player_name, frame, cell)
        atlas.alpha_composite(cell, ((frame % 4) * CELL_WIDTH, (frame // 4) * CELL_HEIGHT))

    source_out = Path(player["source_out"])
    runtime_out = Path(player["runtime_out"])
    source_out.parent.mkdir(parents=True, exist_ok=True)
    runtime_out.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(source_out, format="PNG", optimize=True)
    atlas.save(runtime_out, format="WEBP", lossless=True, quality=90, method=6)


def main() -> None:
    for player_name, player in PLAYERS.items():
        build_player(player_name, player)
    for player_name, player in CONTACT_SHEET_PLAYERS.items():
        build_contact_sheet_player(player_name, player)


if __name__ == "__main__":
    main()
