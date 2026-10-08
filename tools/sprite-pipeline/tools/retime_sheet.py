#!/usr/bin/env python3
"""Retime a game sheet in place: drop leading/trailing frames and/or set fps, keeping hit_frame consistent.

  retime_sheet.py SIDECAR.json [--drop-start N] [--drop-end N] [--fps F]
Prints the resulting time to the hit frame.
"""
import argparse, json, os
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("sidecar")
ap.add_argument("--drop-start", type=int, default=0); ap.add_argument("--drop-end", type=int, default=0)
ap.add_argument("--fps", type=float, default=0)
a = ap.parse_args()
sc = json.load(open(a.sidecar))
d = os.path.dirname(a.sidecar)
sheet = Image.open(os.path.join(d, sc["sheet"])).convert("RGBA")
fw, fh, cols, n = sc["frame_width"], sc["frame_height"], sc["columns"], sc["frame_count"]
cells = [sheet.crop(((i % cols) * fw, (i // cols) * fh, (i % cols + 1) * fw, (i // cols + 1) * fh)) for i in range(n)]
cells = cells[a.drop_start:n - a.drop_end]
n = len(cells)
cols = min(cols, n); rows = (n + cols - 1) // cols
out = Image.new("RGBA", (cols * fw, rows * fh), (0, 0, 0, 0))
for i, c in enumerate(cells):
    out.paste(c, ((i % cols) * fw, (i // cols) * fh))
out.save(os.path.join(d, sc["sheet"]))
sc.update(frame_count=n, columns=cols, rows=rows)
for k in sc.get("animations", {}):
    sc["animations"][k]["to"] = n - 1
if "hit_frame" in sc:
    sc["hit_frame"] = max(0, sc["hit_frame"] - a.drop_start)
if a.fps:
    sc["fps"] = a.fps
json.dump(sc, open(a.sidecar, "w"), indent=1)
hf = sc.get("hit_frame")
print(os.path.basename(a.sidecar), "frames", n, "fps", sc["fps"], "hit", hf,
      "time-to-hit %.3fs" % (hf / sc["fps"]) if hf is not None else "")
