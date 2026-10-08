#!/usr/bin/env python3
"""Make a horizontal strip tile seamlessly without blurring pixel art.

  seamless.py IN OUT [--overlap 48] [--search 0.25]

1. Find the pair of columns (one in the left `search` fraction, one in the right
   `search` fraction) whose neighbourhoods match best (alpha + colour), and crop the
   strip between them, so the period starts and ends on similar content.
2. Hide the remaining seam: the last `overlap` columns are blended into the first
   ones with an ordered (Bayer 4x4) dither mask instead of a soft crossfade, so every
   output pixel is a real source pixel (no new colours, crisp edges).
Works on RGBA or RGB. Check with --preview: writes OUT_preview.png with 3 copies side by side.
"""
import argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("inp"); ap.add_argument("out")
ap.add_argument("--overlap", type=int, default=48)
ap.add_argument("--search", type=float, default=0.25)
ap.add_argument("--preview", action="store_true")
a = ap.parse_args()

im = np.asarray(Image.open(a.inp).convert("RGBA")).astype(np.float32)
H, W, _ = im.shape
win = 6
feat = np.concatenate([im[..., :3] * (im[..., 3:4] / 255), im[..., 3:4] * 2], axis=2)

def colwin(c):
    return feat[:, max(0, c - win):c + win].reshape(-1)

best = None
L = range(win, int(W * a.search))
R = range(int(W * (1 - a.search)), W - win)
# coarse-to-fine search over column pairs
for cl in L[::4]:
    fl = colwin(cl)
    for cr in R[::4]:
        d = np.mean(np.abs(fl - colwin(cr)))
        if best is None or d < best[0]:
            best = (d, cl, cr)
_, cl, cr = best
for dl in range(-3, 4):
    for dr in range(-3, 4):
        c1, c2 = cl + dl, cr + dr
        if win <= c1 < W - win and win <= c2 < W - win:
            d = np.mean(np.abs(colwin(c1) - colwin(c2)))
            if d < best[0]:
                best = (d, c1, c2)
score, cl, cr = best
tile = im[:, cl:cr].copy()
w = tile.shape[1]
ov = min(a.overlap, w // 4)
# dithered blend: columns [w-ov, w) fade towards the content just before column cl
bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0
lead = im[:, max(0, cl - ov):cl]
if lead.shape[1] == ov:
    for i in range(ov):
        t = (i + 1) / (ov + 1)  # 0 -> keep tile, 1 -> take lead-in content
        col = w - ov + i
        thr = bayer[np.arange(H) % 4, col % 4]
        take = thr < t
        tile[take, col] = lead[take, i]
Image.fromarray(tile.astype(np.uint8), "RGBA").save(a.out)
print(a.out, "cut", cl, cr, "width", w, "match score %.2f" % score, "overlap", ov)
if a.preview:
    t = Image.fromarray(tile.astype(np.uint8), "RGBA")
    pv = Image.new("RGBA", (w * 3, H), (36, 36, 73, 255))
    for k in range(3):
        pv.alpha_composite(t, (k * w, 0))
    pv.save(a.out.replace(".png", "_preview.png"))
