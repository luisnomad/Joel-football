#!/usr/bin/env python3
"""Snap a TostAI sheet (PNG + sidecar JSON) to in-game pixel scale with ONE palette for all frames.

  sheet_snap.py SIDECAR.json OUT_PREFIX --height 130 [--ref-height 0] [--colors 24]
                [--palette-json P.json | --save-palette P.json]
                [--pick 0,2,4,...  | --keep 10] [--fps 12] [--play loop|once] [--hit-frame 3] [--action walk]
                [--gif-scale 3] [--color-space 9bit|24bit]

- every cell is BOX-downsampled by the same factor (so relative motion is kept); the factor maps
  --ref-height source px (default: the tallest subject in this sheet) to --height px. Use the same
  --ref-height for every action of a character so they all share one scale.
- colours go to the Mega Drive 9-bit space (default, --color-space 9bit). --color-space 24bit skips that
  step and keeps full colour (for Joel Football's painted HD style); the palette is still locked. With --palette-json the character's locked palette is used
  (so all actions share it); otherwise one median-cut palette is built over ALL frames (and saved with
  --save-palette).
- --pick keeps the listed source frames, --keep N picks N evenly spaced frames.
- alpha becomes binary. The sidecar gets "pivot" = feet position inside a cell (x centre, y = median
  bottom row of the subject), plus "action", "fps", "play_mode" and "hit_frame".
Writes OUT_PREFIX.png, OUT_PREFIX.json and OUT_PREFIX.gif (preview).
"""
import argparse, json, os
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument("sidecar"); ap.add_argument("out")
ap.add_argument("--height", type=int, required=True)
ap.add_argument("--colors", type=int, default=24)
ap.add_argument("--ref-height", type=int, default=0)
ap.add_argument("--palette-json"); ap.add_argument("--save-palette")
ap.add_argument("--pick", default=""); ap.add_argument("--keep", type=int, default=0)
ap.add_argument("--fps", type=float, default=0); ap.add_argument("--play", default="")
ap.add_argument("--hit-frame", type=int, default=-1); ap.add_argument("--action", default="")
ap.add_argument("--gif-scale", type=int, default=3)
ap.add_argument("--color-space", choices=["9bit", "24bit"], default="9bit",
                help="9bit = Mega Drive levels (Kick or Treat default); 24bit = full colour")
a = ap.parse_args()
LEVELS = 7 if a.color_space == "9bit" else 255


def to_space(v):
    return np.round(np.asarray(v, dtype=float) / 255 * LEVELS) / LEVELS * 255

sc = json.load(open(a.sidecar))
sheet = Image.open(os.path.join(os.path.dirname(a.sidecar), sc["sheet"])).convert("RGBA")
fw, fh, cols, n = sc["frame_width"], sc["frame_height"], sc["columns"], sc["frame_count"]
cells = [sheet.crop(((i % cols) * fw, (i // cols) * fh, (i % cols + 1) * fw, (i // cols + 1) * fh)) for i in range(n)]
if a.pick:
    cells = [cells[int(i)] for i in a.pick.split(",")]
elif a.keep and a.keep < len(cells):
    idx = np.round(np.linspace(0, len(cells) - 1, a.keep)).astype(int)
    cells = [cells[i] for i in idx]
n = len(cells)


def bbox(c):
    ys = np.nonzero(np.asarray(c)[..., 3] > 0)[0]
    return (ys.min(), ys.max()) if len(ys) else (0, 0)


ref = int(a.ref_height or max(b - t + 1 for t, b in map(bbox, cells)))  # int(): numpy ints break json.dump
f = a.height / ref
cw, ch = max(1, round(fw * f)), max(1, round(fh * f))
small = []
for c in cells:
    s = np.asarray(c.resize((cw, ch), Image.Resampling.BOX)).astype(float)
    rgb = to_space(s[..., :3])
    small.append((rgb.astype(np.uint8), s[..., 3] >= 128))

if a.palette_json:
    hexes = json.load(open(a.palette_json))["palette"]
    flat = [int(h[i:i + 2], 16) for h in hexes for i in (1, 3, 5)]
    pal_img = Image.new("P", (1, 1))
    pal_img.putpalette(flat + [0] * (768 - len(flat)))
    ncol = len(hexes)
else:
    opaque = np.concatenate([rgb[m] for rgb, m in small]).reshape(-1, 1, 3)
    pal_img = Image.fromarray(opaque, "RGB").quantize(a.colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    pal = np.array(pal_img.getpalette()[: 3 * a.colors], dtype=float)
    pal_img.putpalette([int(v) for v in to_space(pal)] + [0] * (768 - 3 * a.colors))
    ncol = a.colors
out_cells, bottoms = [], []
for rgb, m in small:
    q = Image.fromarray(rgb, "RGB").quantize(palette=pal_img, dither=Image.Dither.NONE).convert("RGBA")
    arr = np.asarray(q).copy()
    arr[..., 3] = np.where(m, 255, 0)
    out_cells.append(Image.fromarray(arr, "RGBA"))
    ys = np.nonzero(m.any(1))[0]
    if len(ys):
        bottoms.append(int(ys.max()))

rows = (n + cols - 1) // cols if n >= cols else 1
cols = min(cols, n)
out = Image.new("RGBA", (cols * cw, rows * ch), (0, 0, 0, 0))
for i, c in enumerate(out_cells):
    out.paste(c, ((i % cols) * cw, (i // cols) * ch))
assert out.width <= 4096 and out.height <= 4096, "sheet over 4096 px"
out.save(a.out + ".png")
palette = pal_img.getpalette()[: 3 * ncol]
hexpal = ["#%02X%02X%02X" % tuple(palette[i:i + 3]) for i in range(0, len(palette), 3)]
if a.save_palette:
    json.dump({"palette": hexpal}, open(a.save_palette, "w"), indent=1)
fps = a.fps or sc.get("fps", 24)
play = a.play or sc.get("play_mode", "loop")
side = {**sc, "name": os.path.basename(a.out), "sheet": os.path.basename(a.out + ".png"),
        "frame_width": cw, "frame_height": ch, "columns": cols, "rows": rows, "frame_count": n,
        "fps": fps, "play_mode": play, "anchor": "bottom-center",
        "pivot": {"x": cw // 2, "y": int(np.median(bottoms)) + 1 if bottoms else ch},
        "animations": {a.action or "play": {"from": 0, "to": n - 1, "loop": play == "loop"}},
        "pixel_snap": {"scale": round(f, 5), "ref_height": ref, "target_height": a.height, "colors": ncol,
                       "colour_space": "9-bit RGB (Mega Drive)" if a.color_space == "9bit" else "24-bit RGB", "palette": hexpal}}
if a.action:
    side["action"] = a.action
if a.hit_frame >= 0:
    side["hit_frame"] = a.hit_frame
json.dump(side, open(a.out + ".json", "w"), indent=1)
frames = []
for c in out_cells:
    bg = Image.new("RGBA", c.size, (36, 36, 73, 255)); bg.alpha_composite(c)
    frames.append(bg.resize((cw * a.gif_scale, ch * a.gif_scale), Image.Resampling.NEAREST).convert("P"))
frames[0].save(a.out + ".gif", save_all=True, append_images=frames[1:], duration=round(1000 / fps), loop=0 if play == "loop" else 1)
print(a.out, "frames", n, "cells", cw, "x", ch, "sheet", out.size, "pivot", side["pivot"], "colors", ncol)
