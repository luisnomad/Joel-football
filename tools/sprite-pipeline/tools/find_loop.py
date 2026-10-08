#!/usr/bin/env python3
"""Find the best seamless loop in a chroma-green (or --bg magenta) character clip, and trim it.

  find_loop.py CLIP.mp4 [--min 8] [--max 40] [--skip 4] [--trim OUT.mp4] [--mask-out OUT_mask.mp4]

For every start s and period p, compare the subject silhouette+colour at s and s+p
(downsampled, keyed). The best (s, p) has the lowest seam difference. Also reports horizontal
drift of the subject (a walk cycle must stay in place) and per-frame bottom row (feet).
--trim writes frames [s, s+p) as a new clip (so frame s+p == frame s when looped).
"""
import argparse, subprocess
import cv2
import numpy as np

ap = argparse.ArgumentParser()
ap.add_argument("clip")
ap.add_argument("--min", type=int, default=8); ap.add_argument("--max", type=int, default=40)
ap.add_argument("--skip", type=int, default=4, help="ignore the first N frames (H3 settles in)")
ap.add_argument("--trim"); ap.add_argument("--margin", type=int, default=40)
ap.add_argument("--bg", choices=["green", "magenta"], default="green")
a = ap.parse_args()


def is_bg(r, g, b, bg, margin):
    """Backdrop test. green: G dominates R and B. magenta: R and B dominate G (for green-skinned characters)."""
    if bg == "magenta":
        return (r - g > margin) & (b - g > margin) & (np.abs(r - b) < 90)
    return (g - r > margin) & (g - b > margin)

cap = cv2.VideoCapture(a.clip)
fps = cap.get(cv2.CAP_PROP_FPS) or 24
feats, cx, bottom, frames = [], [], [], []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(f)
    b, g, r = (f[..., i].astype(np.int16) for i in range(3))
    m = ~is_bg(r, g, b, a.bg, a.margin)
    ys, xs = np.nonzero(m)
    cx.append(xs.mean() if len(xs) else 0)
    bottom.append(ys.max() if len(ys) else 0)
    small = cv2.resize(np.where(m[..., None], f, 0).astype(np.uint8), (96, 96), interpolation=cv2.INTER_AREA).astype(np.float32)
    feats.append(small)
n = len(feats)
best = None
for s in range(a.skip, n):
    for p in range(a.min, min(a.max, n - 1 - s) + 1):
        d = float(np.mean(np.abs(feats[s] - feats[s + p])))
        # also require the frame after the seam to match (motion continuity)
        if s + p + 1 < n:
            d += 0.5 * float(np.mean(np.abs(feats[s + 1] - feats[s + p + 1])))
        if best is None or d < best[0]:
            best = (d, s, p)
d, s, p = best
drift = cx[s + p - 1] - cx[s]
print(f"frames {n} @ {fps:.0f}fps  best loop: start {s} period {p} ({p / fps:.2f}s)  seam diff {d:.1f}")
print(f"subject x: start {cx[s]:.0f} end {cx[s + p - 1]:.0f} drift {drift:+.0f}px over the loop; "
      f"clip-wide x range {min(cx):.0f}..{max(cx):.0f}")
print("feet (bottom row) over loop:", bottom[s:s + p])
if a.trim:
    h, w = frames[0].shape[:2]
    vw = cv2.VideoWriter(a.trim, cv2.VideoWriter_fourcc(*"mp4v"), fps, (w, h))
    for f in frames[s:s + p]:
        vw.write(f)
    vw.release()
    # re-encode near-losslessly so TostAI/ffmpeg read it cleanly
    tmp = a.trim + ".tmp.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a.trim, "-c:v", "libx264", "-crf", "4", "-pix_fmt", "yuv420p", tmp], check=True)
    subprocess.run(["mv", tmp, a.trim], check=True)
    print("trimmed ->", a.trim)
