#!/usr/bin/env python3
"""Remove stray specks (confetti, sparks, leaves that H3 invented) from a sprite sheet, in place.

  clean_specks.py SHEET.png SIDECAR.json [--near 3] [--min-frac 0.04]

Per cell, the largest opaque component is the character. Other components survive only if they touch
it after a --near px dilation (hair tips, a held prop) or are at least --min-frac of its area
(a big detached prop). Everything else is cleared. Prints how many pixels were removed per cell.
"""
import argparse, json
import numpy as np
from PIL import Image
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument("sheet"); ap.add_argument("sidecar")
ap.add_argument("--near", type=int, default=3); ap.add_argument("--min-frac", type=float, default=0.04)
a = ap.parse_args()
sc = json.load(open(a.sidecar))
img = np.asarray(Image.open(a.sheet).convert("RGBA")).copy()
fw, fh, cols, n = sc["frame_width"], sc["frame_height"], sc["columns"], sc["frame_count"]
removed = []
for i in range(n):
    x0, y0 = (i % cols) * fw, (i // cols) * fh
    cell = img[y0:y0 + fh, x0:x0 + fw]
    lab, k = ndimage.label(cell[..., 3] > 0, structure=np.ones((3, 3)))
    if k <= 1:
        removed.append(0); continue
    areas = ndimage.sum(np.ones_like(lab), lab, index=range(1, k + 1))
    main = int(np.argmax(areas)) + 1
    near = ndimage.binary_dilation(lab == main, iterations=a.near)
    drop = 0
    for j in range(1, k + 1):
        if j == main:
            continue
        comp = lab == j
        if (comp & near).any() or areas[j - 1] >= a.min_frac * areas[main - 1]:
            continue
        cell[comp] = 0; drop += int(comp.sum())
    removed.append(drop)
Image.fromarray(img, "RGBA").save(a.sheet)
print(a.sheet, "pixels removed per cell:", removed)
