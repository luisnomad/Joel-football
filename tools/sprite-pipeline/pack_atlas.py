#!/usr/bin/env python3
"""Adapter: pack snapped action sheets (sheet_snap.py output) into Joel Football's runtime atlas.

  pack_atlas.py PLAN.json [--out-png FILE] [--out-webp FILE] [--portrait FILE] [--review FILE]

Two layouts (src/game/pure/characterAnimation.js CHARACTER_LAYOUTS), chosen by the plan's "layout":

"roster-v2" (sprite redo): 2016x1920, 6 columns x 4 rows of 336x480 cells, 24 frames:
   0-2 idle loop   3-8 run loop (contacts at 3 and 6; the sprint alternates 3 and 6)
   9-12 kick (wind-up, CONTACT 10, follow, recover)   13 jump   14-16 hit (impact, stagger, recover)
   17-19 chilena (takeoff, CONTACT 18, follow)   20-23 celebrate loop
The packer also measures the gameplay points and writes them next to the atlas (<atlas>.json):
   kickReach       world px from the cell centre to the boot tip on the kick contact frame
   chilenaContact  source-cell point {x, y} of the boot on the chilena contact frame

"classic" (default, the original format): 1280x1440, 4 columns x 3 rows of 320x480 cells, in this
runtime order (CHARACTER_FRAMES):

   0 idle            1 legacyRun        2 jump              3 legacyKick (chilena, rotated at runtime)
   4 dash            5 stun             6 runContactA       7 runPassing
   8 runContactB     9 kickAnticipation 10 kickContact      11 kickRecovery

Contract enforced here (docs/characters/PROJECT_CONTRACT.md): every frame's visible alpha bottom sits
on y=418 (the builder grounds all twelve, including jump and chilena; the game moves the sprite) and
keeps >= 8 px of transparent margin left and right.

Unlike scripts/build-character-animation-atlases.py this adapter does NOT renormalise each frame's
height: sheet_snap.py already put every action of the character on one shared scale (same ref_height),
and per-frame resizing is what made heads pulse between frames. One global "scale" applies to all
twelve frames. A frame that is too wide fails loudly; lower the scale (or char.json height) instead of
shrinking that one frame.

PLAN.json:
  {
    "char": "joel",
    "sheets_dir": "source-assets/sprite-pipeline/sheets/joel",   (optional, default <OUTPUT_DIR>/<char>)
    "scale": 1.0,                                                  (optional global factor)
    "frames": [["idle", 0], ["run", 2], ["jump", 0], ["chilena", 0],
               ["dash", 0], ["stun", 1], ["run", 0], ["run", 2],
               ["run", 4], ["kick", 2], ["kick", 4], ["kick", 7]]
  }
Each entry is [action sheet name, cell index] in the runtime order above. The cell is placed with the
sheet's pivot x (feet centre) on the cell centre x=160, shifted only if that breaks the side margin.

Defaults write to <WORK_DIR>/<char>/atlas/ (staging). Pass --out-png/--out-webp/--portrait explicitly
to install into source-assets/animation/final/ and public/assets/ once the owner has approved.
"""
import argparse, json, os, sys

import numpy as np
from PIL import Image

import config

LAYOUTS = {
    "classic": dict(cell_w=320, cols=4, rows=3, kick_contact=10, chilena_contact=None),
    "roster-v2": dict(cell_w=336, cols=6, rows=4, kick_contact=10, chilena_contact=18),
}
CELL_H = 480
GROUND_Y = 418
MARGIN = 8
DISPLAY_SCALE = 280 / 480   # one cell is drawn 280 world px tall at visualScale 1

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("plan")
ap.add_argument("--out-png"); ap.add_argument("--out-webp"); ap.add_argument("--portrait")
ap.add_argument("--review", help="also write an enlarged review strip of the atlas on a dark background")
a = ap.parse_args()

plan = json.load(open(a.plan))
char = plan["char"]
sheets_dir = plan.get("sheets_dir")
sheets_dir = os.path.join(config.PROJECT_ROOT, sheets_dir) if sheets_dir else os.path.join(config.OUTPUT_DIR, char)
scale = float(plan.get("scale", 1.0))
layout = plan.get("layout", "classic")
if layout not in LAYOUTS:
    sys.exit(f"unknown layout {layout!r}; use one of {sorted(LAYOUTS)}")
L = LAYOUTS[layout]
CELL_W, COLS, ROWS = L["cell_w"], L["cols"], L["rows"]
if len(plan["frames"]) != COLS * ROWS:
    sys.exit(f"plan needs exactly {COLS * ROWS} frames, got {len(plan['frames'])}")

cache = {}


def cell(action, i):
    if action not in cache:
        sc = json.load(open(os.path.join(sheets_dir, action + ".json")))
        cache[action] = (sc, Image.open(os.path.join(sheets_dir, sc["sheet"])).convert("RGBA"))
    sc, sheet = cache[action]
    fw, fh, cols, n = sc["frame_width"], sc["frame_height"], sc["columns"], sc["frame_count"]
    if not 0 <= i < n:
        sys.exit(f"{action}: cell {i} out of range (0..{n - 1})")
    c = sheet.crop(((i % cols) * fw, (i // cols) * fh, (i % cols + 1) * fw, (i // cols + 1) * fh))
    return c, sc.get("pivot", {}).get("x", fw // 2)


atlas = Image.new("RGBA", (CELL_W * COLS, CELL_H * ROWS), (0, 0, 0, 0))
for k, (action, i) in enumerate(plan["frames"]):
    c, pivot_x = cell(action, int(i))
    bbox = c.getchannel("A").point(lambda v: 255 if v > 0 else 0).getbbox()
    if bbox is None:
        sys.exit(f"frame {k} ({action}[{i}]) is empty")
    content = c.crop(bbox)
    px = (pivot_x - bbox[0]) * scale
    if scale != 1.0:
        # NEAREST keeps the snapped palette and binary alpha intact
        content = content.resize((max(1, round(content.width * scale)), max(1, round(content.height * scale))),
                                 Image.Resampling.NEAREST)
    if content.width > CELL_W - 2 * MARGIN or content.height > GROUND_Y:
        sys.exit(f"frame {k} ({action}[{i}]) is {content.width}x{content.height}; the cell allows "
                 f"{CELL_W - 2 * MARGIN}x{GROUND_Y}. Lower 'scale' for the whole character, do not shrink one frame.")
    x = round(CELL_W / 2 - px)
    x = min(max(x, MARGIN), CELL_W - MARGIN - content.width)
    y = GROUND_Y - content.height
    atlas.alpha_composite(content, ((k % COLS) * CELL_W + x, (k // COLS) * CELL_H + y))
    print(f"frame {k:2} <- {action}[{i}]  {content.width}x{content.height}  x={x} margins={x},{CELL_W - x - content.width}")

# validation (same rules as the repository builder)
arr = np.asarray(atlas)
for k in range(COLS * ROWS):
    x0, y0 = (k % COLS) * CELL_W, (k // COLS) * CELL_H
    al = arr[y0:y0 + CELL_H, x0:x0 + CELL_W, 3] > 8
    ys, xs = np.nonzero(al)
    assert ys.max() + 1 == GROUND_Y, f"frame {k} bottom {ys.max() + 1} != {GROUND_Y}"
    assert xs.min() >= MARGIN and CELL_W - (xs.max() + 1) >= MARGIN, f"frame {k} breaks the {MARGIN}px margin"

# gameplay measurements (art faces RIGHT: the boot is the rightmost / topmost alpha)
def frame_alpha(k):
    x0, y0 = (k % COLS) * CELL_W, (k // COLS) * CELL_H
    return arr[y0:y0 + CELL_H, x0:x0 + CELL_W, 3] > 8


measures = {"layout": layout, "cellWidth": CELL_W, "cellHeight": CELL_H, "groundY": GROUND_Y}
al = frame_alpha(L["kick_contact"])
ys, xs = np.nonzero(al)
measures["kickReach"] = round((xs.max() + 1 - CELL_W / 2) * DISPLAY_SCALE)
if L["chilena_contact"] is not None:
    al = frame_alpha(L["chilena_contact"])
    ys, xs = np.nonzero(al)
    top = ys.min()
    band = xs[ys <= top + 14]          # the boot: the top 14 source rows of the drawing
    measures["chilenaContact"] = {"x": int(round(band.mean())), "y": int(top + 7)}
idle = frame_alpha(0)
ys, _ = np.nonzero(idle)
measures["idleHeight"] = int(GROUND_Y - ys.min())
print("measures", json.dumps(measures))

stage = os.path.join(config.char_dir(char), "atlas")
out_png = a.out_png or os.path.join(stage, f"player-{char}-sheet.png")
out_webp = a.out_webp or os.path.join(stage, f"player-{char}-sheet.webp")
for p in (out_png, out_webp):
    os.makedirs(os.path.dirname(os.path.abspath(p)), exist_ok=True)
atlas.save(out_png, format="PNG", optimize=True)
atlas.save(out_webp, format="WEBP", lossless=True, quality=90, method=6)
print("atlas", atlas.size, "->", out_png, out_webp)
with open(os.path.splitext(out_png)[0] + ".json", "w") as f:
    json.dump(measures, f, indent=1)

portrait = a.portrait or os.path.join(stage, f"player-{char}-portrait.png")
idle = atlas.crop((0, 0, CELL_W, CELL_H))
idle = idle.crop(idle.getchannel("A").getbbox())
f = min(470 / idle.height, 460 / idle.width)
idle = idle.resize((max(1, round(idle.width * f)), max(1, round(idle.height * f))), Image.Resampling.LANCZOS)
pt = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
pt.alpha_composite(idle, ((512 - idle.width) // 2, 492 - idle.height))
os.makedirs(os.path.dirname(os.path.abspath(portrait)), exist_ok=True)
pt.save(portrait, format="PNG", optimize=True)
print("portrait ->", portrait)

if a.review:
    bg = Image.new("RGBA", atlas.size, (36, 36, 73, 255))
    bg.alpha_composite(atlas)
    for k in range(1, COLS):
        bg.paste((90, 90, 130, 255), (k * CELL_W, 0, k * CELL_W + 1, atlas.height))
    for k in range(ROWS):
        bg.paste((255, 120, 0, 255), (0, k * CELL_H + GROUND_Y, atlas.width, k * CELL_H + GROUND_Y + 1))
    bg.convert("RGB").save(a.review)
    print("review ->", a.review)
