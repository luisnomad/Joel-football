#!/usr/bin/env python3
"""Key a chroma-green still to RGBA (binary alpha) with despill.

  key_green.py IN OUT [--margin 40] [--keep-largest] [--min-area 64]

Background = green dominates R and B by --margin (any brightness, so dark green
tints count too). Edge pixels that still lean green get their G clamped to
max(R, B). --min-area drops specks smaller than N px; --keep-largest keeps only
the biggest component (single-object stills such as the moon).
"""
import argparse
import cv2
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("inp"); ap.add_argument("out")
ap.add_argument("--margin", type=int, default=40)
ap.add_argument("--keep-largest", action="store_true")
ap.add_argument("--min-area", type=int, default=64)
a = ap.parse_args()

rgb = np.asarray(Image.open(a.inp).convert("RGB")).astype(np.int16)
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
fg = ~((g - r > a.margin) & (g - b > a.margin))
fg = cv2.morphologyEx(fg.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)).astype(bool)

n, lab, stats, _ = cv2.connectedComponentsWithStats(fg.astype(np.uint8), connectivity=8)
keep = np.zeros(n, bool)
if a.keep_largest and n > 1:
    keep[1 + np.argmax(stats[1:, cv2.CC_STAT_AREA])] = True
else:
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] >= a.min_area
fg = keep[lab]

# despill: green-leaning pixels within 3 px of the edge
edge = fg & ~cv2.erode(fg.astype(np.uint8), np.ones((7, 7), np.uint8)).astype(bool)
spill = edge & (g > np.maximum(r, b))
out = rgb.copy()
out[..., 1] = np.where(spill, np.maximum(r, b), g)
rgba = np.dstack([out.astype(np.uint8), np.where(fg, 255, 0).astype(np.uint8)])
Image.fromarray(rgba, "RGBA").save(a.out)
print(a.out, "fg %.1f%%" % (100 * fg.mean()), "components", int(keep.sum()), "despilled", int(spill.sum()))
