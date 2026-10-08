#!/usr/bin/env python3
"""Snap an AI 'pixel art' image onto a true pixel grid with a Mega Drive-style palette.

  pixel_snap.py IN OUT --width 640 [--colors 64] [--preview-scale 3]

Area-downsample to the logical width, quantize to 9-bit RGB (8 levels/channel,
the Mega Drive colour space), reduce to N colours, then nearest-upscale for preview.
"""
import argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("inp"); ap.add_argument("out")
ap.add_argument("--width", type=int, required=True)
ap.add_argument("--colors", type=int, default=64)
ap.add_argument("--preview-scale", type=int, default=0)
a = ap.parse_args()

im = Image.open(a.inp).convert("RGBA")
h = round(im.height * a.width / im.width)
small = im.resize((a.width, h), Image.Resampling.BOX)
px = np.asarray(small).astype(float)
rgb = np.round(px[..., :3] / 255 * 7) / 7 * 255           # 9-bit RGB
alpha = np.where(px[..., 3] >= 128, 255, 0)                 # no semi-transparency
q = Image.fromarray(rgb.astype(np.uint8), "RGB").quantize(a.colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
out = q.convert("RGBA")
out.putalpha(Image.fromarray(alpha.astype(np.uint8)))
if a.preview_scale:
    out = out.resize((a.width * a.preview_scale, h * a.preview_scale), Image.Resampling.NEAREST)
out.save(a.out)
print(a.out, out.size)
