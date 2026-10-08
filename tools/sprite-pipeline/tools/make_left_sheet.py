#!/usr/bin/env python3
"""Make a left-facing copy of a sheet whose art contains readable text (e.g. the STOP sign):
mirror every cell, then flip the text region back so it reads correctly.

  make_left_sheet.py SIDECAR.json [--text-color red|yellow|white] [--min-area 60] [--group 0]

Text regions are found per cell as connected blobs of the sign colour (red: R high, G/B low); each blob's
bounding box is mirrored back in place. yellow (e.g. the Mascot's "#1" foam hand) only counts blobs whose
surrounding ring is mostly dark purple (B >= R), so the yellow fur stripes on dark brown are left alone.
white (e.g. the linebacker's "78" jersey) only counts light blobs whose ring is at least 30% blue (B > R + 30; the red digit outline sits between).
--group N merges accepted blobs closer than ~N px (e.g. "#" and "1") and flips each group's box as one,
so multi-glyph text keeps its reading order. Writes <action>_left.png/.json next to the original, with the
pivot x mirrored.
"""
import argparse, json, os
import numpy as np
from PIL import Image
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument("sidecar"); ap.add_argument("--min-area", type=int, default=60)
ap.add_argument("--group", type=int, default=0)
ap.add_argument("--text-color", default="red", choices=["red", "yellow", "white"])
a = ap.parse_args()
sc = json.load(open(a.sidecar)); d = os.path.dirname(a.sidecar)
sheet = np.asarray(Image.open(os.path.join(d, sc["sheet"])).convert("RGBA")).copy()
fw, fh, cols, n = sc["frame_width"], sc["frame_height"], sc["columns"], sc["frame_count"]
out = sheet.copy(); fixed = 0
for i in range(n):
    x0, y0 = (i % cols) * fw, (i // cols) * fh
    cell = sheet[y0:y0 + fh, x0:x0 + fw][:, ::-1].copy()
    r, g, b, al = (cell[..., k].astype(int) for k in range(4))
    if a.text_color == "red":
        txt = (al > 0) & (r > 140) & (g < 90) & (b < 90)
    elif a.text_color == "yellow":
        txt = (al > 0) & (r > 150) & (g > 100) & (b < 110)
    else:
        txt = (al > 0) & (r > 200) & (g > 160) & (b > 140)
    txt = ndimage.binary_closing(txt, iterations=2)
    lab, nlab = ndimage.label(txt)
    keep = np.zeros_like(txt)
    for j, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl is None or (lab[sl] == j).sum() < a.min_area:
            continue
        if a.text_color != "red" and (lab[sl] == j).mean() < 0.25:
            continue   # thin outlines (e.g. the foam hand's border) are not glyphs
        if a.text_color == "yellow":
            blob = lab == j
            ring = ndimage.binary_dilation(blob, iterations=3) & ~blob & (al > 0) & ~txt
            if ring.sum() == 0 or ((b[ring] >= r[ring]) & (r[ring] < 120)).mean() < 0.6:
                continue
        if a.text_color == "white":
            blob = lab == j
            ring = ndimage.binary_dilation(blob, iterations=4) & ~blob & (al > 0) & ~txt
            if ring.sum() == 0 or (b[ring] > r[ring] + 30).mean() < 0.3:   # digits have a red outline inside the blue
                continue
        keep |= lab == j
    if a.group:
        lab = ndimage.label(ndimage.binary_dilation(keep, iterations=a.group))[0]
    else:
        lab = ndimage.label(keep)[0]
    for j, sl in enumerate(ndimage.find_objects(lab), 1):
        if sl is None:
            continue
        gy, gx = np.nonzero((lab == j) & keep)   # tight box around the glyphs themselves
        ys, xs = slice(gy.min(), gy.max() + 1), slice(gx.min(), gx.max() + 1)
        box = cell[ys, xs].copy()
        cell[ys, xs] = box[:, ::-1]
        fixed += 1
    out[y0:y0 + fh, x0:x0 + fw] = cell
name = sc["sheet"].rsplit(".", 1)[0] + "_left"
Image.fromarray(out, "RGBA").save(os.path.join(d, name + ".png"))
side = dict(sc); side["sheet"] = name + ".png"; side["name"] = side.get("name", "") + "_left"
if "pivot" in side:
    side["pivot"] = {"x": fw - side["pivot"]["x"], "y": side["pivot"]["y"]}
side["facing"] = "left"
json.dump(side, open(os.path.join(d, name + ".json"), "w"), indent=1)
print(name, "cells", n, "text regions flipped back:", fixed)
