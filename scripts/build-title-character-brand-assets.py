#!/usr/bin/env python3
"""Build web and Android branding derivatives from approved title art."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BACKGROUND = (7, 16, 31, 255)

WEB_ICON_OUTPUTS = {
    "joel-football-apple-touch-icon-v2.png": 180,
    "joel-football-icon-v2-192.png": 192,
    "joel-football-icon-v2-512.png": 512,
}

ANDROID_ICON_SIZES = {
    "mdpi": (48, 108),
    "hdpi": (72, 162),
    "xhdpi": (96, 216),
    "xxhdpi": (144, 324),
    "xxxhdpi": (192, 432),
}

ANDROID_SPLASHES = {
    "drawable/splash.png": (480, 320, 173),
    "drawable-land-mdpi/splash.png": (480, 320, 173),
    "drawable-land-hdpi/splash.png": (800, 480, 259),
    "drawable-land-xhdpi/splash.png": (1280, 720, 389),
    "drawable-land-xxhdpi/splash.png": (1600, 960, 518),
    "drawable-land-xxxhdpi/splash.png": (1920, 1280, 691),
    "drawable-port-mdpi/splash.png": (320, 480, 173),
    "drawable-port-hdpi/splash.png": (480, 800, 259),
    "drawable-port-xhdpi/splash.png": (720, 1280, 389),
    "drawable-port-xxhdpi/splash.png": (960, 1600, 518),
    "drawable-port-xxxhdpi/splash.png": (1280, 1920, 691),
}


def resized_square(image: Image.Image, size: int) -> Image.Image:
    return image.resize((size, size), Image.Resampling.LANCZOS)


def centered_square_canvas(
    image: Image.Image,
    *,
    canvas_size: tuple[int, int],
    art_size: int,
) -> Image.Image:
    canvas = Image.new("RGBA", canvas_size, BACKGROUND)
    art = resized_square(image, art_size)
    canvas.alpha_composite(
        art,
        ((canvas.width - art.width) // 2, (canvas.height - art.height) // 2),
    )
    return canvas


def build_web(icon: Image.Image, splash: Image.Image) -> None:
    branding_dir = ROOT / "public/assets/branding"
    branding_dir.mkdir(parents=True, exist_ok=True)
    for filename, size in WEB_ICON_OUTPUTS.items():
        resized_square(icon, size).save(branding_dir / filename, optimize=True)

    splash_out = ROOT / "public/assets/splash/joel-football-option-a-v2.webp"
    splash_out.parent.mkdir(parents=True, exist_ok=True)
    splash.resize((1280, 720), Image.Resampling.LANCZOS).save(
        splash_out,
        format="WEBP",
        quality=88,
        method=6,
    )


def build_android(icon: Image.Image) -> None:
    resource_dir = ROOT / "android/app/src/main/res"
    for density, (legacy_size, foreground_size) in ANDROID_ICON_SIZES.items():
        mipmap_dir = resource_dir / f"mipmap-{density}"
        mipmap_dir.mkdir(parents=True, exist_ok=True)
        legacy = resized_square(icon, legacy_size)
        legacy.save(mipmap_dir / "ic_launcher.png", optimize=True)
        legacy.save(mipmap_dir / "ic_launcher_round.png", optimize=True)
        centered_square_canvas(
            icon,
            canvas_size=(foreground_size, foreground_size),
            art_size=round(foreground_size * 0.78),
        ).save(mipmap_dir / "ic_launcher_foreground.png", optimize=True)

    for relative_path, (width, height, art_size) in ANDROID_SPLASHES.items():
        output = resource_dir / relative_path
        output.parent.mkdir(parents=True, exist_ok=True)
        centered_square_canvas(
            icon,
            canvas_size=(width, height),
            art_size=art_size,
        ).save(output, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--icon",
        type=Path,
        default=ROOT / "source-assets/branding/joel-football-app-icon-master-v2.png",
    )
    parser.add_argument(
        "--splash",
        type=Path,
        default=ROOT / "source-assets/splash/joel-football-option-a-v2.png",
    )
    args = parser.parse_args()

    icon = Image.open(args.icon).convert("RGBA")
    splash = Image.open(args.splash).convert("RGB")
    build_web(icon, splash)
    build_android(icon)
    print(f"Built branding from {args.icon} and {args.splash}")


if __name__ == "__main__":
    main()
