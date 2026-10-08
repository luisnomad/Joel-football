#!/usr/bin/env python3
"""Chroma-green mask video for TostAI's mask_video input (white = subject).

  green_mask.py IN.mp4 OUT_mask.mp4 [--margin 40] [--report] [--bg green|magenta]

A pixel is background when green dominates both other channels by --margin,
whatever its brightness -- so dark green-tinted contact shadows that video
models paint under a subject count as backdrop too. Small specks are removed
and holes inside the subject are filled.
"""
import argparse
import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("inp"); ap.add_argument("out")
ap.add_argument("--margin", type=int, default=40)
ap.add_argument("--report", action="store_true")
ap.add_argument("--bg", choices=["green", "magenta"], default="green")
a = ap.parse_args()

def is_bg(r, g, b, bg, margin):
    """Backdrop test. green: G dominates R and B. magenta: R and B dominate G (for green-skinned characters)."""
    if bg == "magenta":
        return (r - g > margin) & (b - g > margin) & (np.abs(r - b) < 90)
    return (g - r > margin) & (g - b > margin)


cap = cv2.VideoCapture(a.inp)
fps = cap.get(cv2.CAP_PROP_FPS) or 24
w, h = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
vw = cv2.VideoWriter(a.out, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h), isColor=False)
kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
n = 0
while True:
    ok, f = cap.read()
    if not ok:
        break
    b, g, r = (f[..., i].astype(np.int16) for i in range(3))
    bg = is_bg(r, g, b, a.bg, a.margin)
    m = np.where(bg, 0, 255).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, kernel)
    # keep the largest component, fill its holes
    cnt, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    m = np.zeros_like(m)
    if cnt:
        cv2.drawContours(m, [max(cnt, key=cv2.contourArea)], -1, 255, cv2.FILLED)
    vw.write(m)
    if a.report and n % 10 == 0:
        ys, xs = np.nonzero(m)
        print(n, "bbox", (xs.min(), ys.min(), xs.max(), ys.max()) if len(xs) else None)
    n += 1
vw.release()
print(a.out, n, "frames")
