#!/usr/bin/env python3
"""Build a game sheet from key-pose stills: scale-correct each pose, put its feet on the reference's
ground line, hold each pose N frames, then run the standard pipeline (TostAI matte -> snap with the
character's scale and locked palette).

  pose_sheet.py --char rico --ref REF.png --action knockdown --poses fall:2,down:3[:1.2] [--headroom 1.4]
                [--mode once|loop] [--fps 8] [--hit N] [--game-id rico]

A pose item is name:hold[:scale]. 'scale' corrects Qwen edits that shrank the character (measure with
area ratio vs the reference). Names resolve to <POSES_DIR>/<ID_PREFIX>_pose_<prefix>_<name>_1.png
(config.POSES_DIR, default source-assets/sprite-pipeline/_poses; ID_PREFIX default p4), or to a file
path if the name is an existing path; 'ref' is the reference itself. REF is relative to the project root. --headroom grows the canvas (then shrinks it back) so upscaled or tall
poses are not clipped; the pipeline is told about the shrink, so in-game size is unchanged.
"""
import argparse, json, os, subprocess, sys
import numpy as np
from PIL import Image

import config

ROOT = config.PROJECT_ROOT
P = config.POSES_DIR
ap = argparse.ArgumentParser()
ap.add_argument("--char", required=True); ap.add_argument("--ref", required=True)
ap.add_argument("--action", required=True); ap.add_argument("--poses", required=True)
ap.add_argument("--prefix", default=""); ap.add_argument("--mode", default="once")
ap.add_argument("--fps", type=float, default=8); ap.add_argument("--hit", default="")
ap.add_argument("--game-id", default=""); ap.add_argument("--headroom", type=float, default=1.0)
a = ap.parse_args()
os.makedirs(P, exist_ok=True)
N = 1024
S = round(N * a.headroom)
CFG = os.path.join(config.char_dir(a.char), "char.json")
BG = json.load(open(CFG)).get("bg", "green") if os.path.exists(CFG) else "green"
GREEN = (255, 0, 255) if BG == "magenta" else (0, 255, 0)   # canvas = the character's backdrop colour


def load(p):
    return Image.open(p).convert("RGB").resize((N, N))


def feet(img):
    arr = np.asarray(img).astype(int)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    if BG == "magenta":
        m = ~((r - g > 40) & (b - g > 40) & (np.abs(r - b) < 90))
    else:
        m = ~((g - r > 40) & (g - b > 40))
    ys, xs = np.nonzero(m)
    return (xs.min() + xs.max()) / 2, ys.max()


ref = os.path.join(ROOT, a.ref)
_, ref_bottom = feet(load(ref))
ground = ref_bottom + (S - N)          # reference ground line on the tall canvas
xoff = (S - N) / 2
prefix = a.prefix or a.char
specs = []
for item in a.poses.split(","):
    parts = item.split(":")
    name, hold = parts[0], parts[1]
    scale = float(parts[2]) if len(parts) > 2 else 1.0
    src = ref if name == "ref" else (name if os.path.exists(name) else os.path.join(P, f"{config.ID_PREFIX}_pose_{prefix}_{name}_1.png"))
    img = load(src)
    cx0, by0 = feet(img)
    if scale != 1.0:
        img = img.resize((round(N * scale), round(N * scale)), Image.Resampling.LANCZOS)
    cx, by = cx0 * scale, by0 * scale
    canvas = Image.new("RGB", (S, S), GREEN)
    # subject centre stays at its original x (plus side padding); feet land on the ground line
    canvas.paste(img, (round(xoff + cx0 - cx), round(ground - by)))
    if S != N:
        canvas = canvas.resize((N, N), Image.Resampling.LANCZOS)
    # a pose given as a file path is named by its stem, so the aligned still stays inside POSES_DIR
    stem = os.path.splitext(os.path.basename(name))[0] if os.path.exists(name) else name
    path = os.path.join(P, f"aligned_{prefix}_{a.action}_{stem}.png")
    canvas.save(path)
    specs.append(f"{path}:{hold}")

clip = os.path.join(P, f"kf_{prefix}_{a.action}.mp4")
subprocess.run([sys.executable, os.path.join(config.TOOLS_DIR, "keyframes.py"), clip, "704", *specs], check=True, capture_output=True)
cmd = [sys.executable, os.path.join(config.PIPELINE_DIR, "make_action.py"), "--char", a.char, "--action", a.action, "--clip", clip,
       "--fps", str(a.fps), "--mode", a.mode, "--ref-scale", str(N / S), "--key"]
cmd += ["--whole", "--hit", a.hit or "0"] if a.mode == "once" else ["--min", "2", "--max", str(len(specs) * 3 + 2)]
if a.game_id:
    cmd += ["--game-id", a.game_id]
r = subprocess.run(cmd, capture_output=True, text=True)
print("\n".join(l for l in (r.stdout + r.stderr).splitlines() if "frames " in l or "FAIL" in l or "best loop" in l) or r.stderr[-400:])
