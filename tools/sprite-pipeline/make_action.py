#!/usr/bin/env python3
"""One character action, end to end: H3 clip -> trimmed clip -> TostAI (VRMBG) -> snapped sheet -> game.

  make_action.py --char rico --action walk --clip CLIP.mp4 --mode loop  [--keep 12] [--fps 12]
  make_action.py --char rico --action kick --clip CLIP.mp4 --mode once  [--keep 9]  [--fps 14] [--hit auto|N]

Character settings live in <WORK_DIR>/<char>/char.json (config.WORK_DIR, default source-assets/sprite-pipeline):
  {"height": 380, "ref_height": <source px of the standing subject>, "colors": 24, "bg": "green",
   "color_space": "9bit"}
"bg": "magenta" is for green characters (green skin, green kit, a dino suit) whose clips use a magenta backdrop.
"color_space": "9bit" (default, Mega Drive levels as in Kick or Treat) or "24bit" (keep full colour, still
one locked palette of "colors" entries) -- see docs/SPRITE_PIPELINE.md for the Joel Football choice.
Snapped sheets go to <OUTPUT_DIR>/<game-id>/<action>.png/.json (config.OUTPUT_DIR), work files to
<WORK_DIR>/<char>/<action>/.
ref_height is measured from the first clip processed (tallest subject) and then reused, so every action of
a character shares one scale. The palette is saved from the first action and locked for the rest.

Loops: the best seamless period is found automatically (tools/find_loop.py).
One-shots: the active window is where the pose departs from the rest pose; the hit frame ("auto") is the
frame where the subject is widest (e.g. the leg fully extended in a kick).
"""
import argparse, json, os, subprocess, sys
import cv2
import numpy as np

import config

ROOT = config.PROJECT_ROOT
PY = sys.executable
T = config.TOOLS_DIR

ap = argparse.ArgumentParser()
ap.add_argument("--char", required=True); ap.add_argument("--action", required=True)
ap.add_argument("--clip", required=True); ap.add_argument("--mode", choices=["loop", "once"], required=True)
ap.add_argument("--keep", type=int, default=0); ap.add_argument("--fps", type=float, default=12)
ap.add_argument("--hit", default="")
ap.add_argument("--min", type=int, default=10); ap.add_argument("--max", type=int, default=36)
ap.add_argument("--thresh", type=float, default=6.0, help="once: pose-change threshold")
ap.add_argument("--game-id", default="", help="sprite folder name in the game (default: --char)")
ap.add_argument("--key", action="store_true", help="colour-key mask instead of VRMBG (for flat-green keyframe clips)")
ap.add_argument("--ref-scale", type=float, default=1.0, help="multiply the character ref_height (when frames were shrunk)")
ap.add_argument("--whole", action="store_true", help="once: use the whole clip (keyframe clips), hit from --hit")
a = ap.parse_args()

work = os.path.join(config.char_dir(a.char), a.action)
os.makedirs(work, exist_ok=True)
charcfg_path = os.path.join(config.char_dir(a.char), "char.json")
charcfg = json.load(open(charcfg_path)) if os.path.exists(charcfg_path) else {"height": config.DEFAULT_HEIGHT, "colors": 24}
BG = charcfg.get("bg", "green")


def run(*cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode:
        sys.exit(f"FAILED: {' '.join(cmd)}\n{r.stdout}\n{r.stderr}")
    return r.stdout


def is_bg(r, g, b, bg, margin):
    if bg == "magenta":
        return (r - g > margin) & (b - g > margin) & (np.abs(r - b) < 90)
    return (g - r > margin) & (g - b > margin)


def keyed_frames(path, margin=40):
    cap = cv2.VideoCapture(path)
    out = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        b, g, r = (f[..., i].astype(np.int16) for i in range(3))
        m = ~is_bg(r, g, b, BG, margin)
        out.append((f, m))
    return out


trimmed = os.path.join(work, f"{a.action}_trim.mp4")
hit_src = None
if a.mode == "loop":
    print(run(PY, os.path.join(T, "find_loop.py"), a.clip, "--min", str(a.min), "--max", str(a.max), "--skip", "6", "--trim", trimmed, "--bg", BG).strip())
elif a.whole:
    import shutil
    shutil.copy(a.clip, trimmed)
    hit_src = int(a.hit) if a.hit.isdigit() else 0
else:
    fr = keyed_frames(a.clip)
    feats = [cv2.resize(np.where(m[..., None], f, 0).astype(np.uint8), (96, 96), interpolation=cv2.INTER_AREA).astype(np.float32) for f, m in fr]
    rest = feats[3]
    diff = np.array([np.mean(np.abs(x - rest)) for x in feats])
    active = np.nonzero(diff > a.thresh)[0]
    active = active[active > 3]
    if not len(active):
        sys.exit(f"no motion found above threshold {a.thresh} (max diff {diff.max():.1f})")
    s, e = max(0, active[0] - 2), min(len(fr) - 1, active[0] + 2)
    # take only the FIRST action: extend until the pose comes back near rest (after at least 6 frames),
    # because video models tend to repeat the action for the rest of the clip
    while e + 1 < len(fr) and not (e - s >= 6 and diff[e + 1] < a.thresh * 0.8):
        e += 1
    e = min(len(fr) - 1, e + 2)
    if e - s > 36:
        # video models repeat or keep swaying: centre a ~0.9 s window on the first strong peak of motion
        strong = [i for i in range(s, e + 1) if diff[i] > 0.7 * diff[s:e + 1].max()]
        t = strong[0]
        while t + 1 <= e and diff[t + 1] >= diff[t]:
            t += 1
        s, e = max(0, t - 12), min(len(fr) - 1, t + 9)
        print(f"once: long window, centred on motion peak at {t}")
    widths = []
    for f, m in fr[s:e + 1]:
        xs = np.nonzero(m.any(0))[0]
        widths.append(xs.max() - xs.min() if len(xs) else 0)
    hit_src = int(np.argmax(widths))
    print(f"once: active frames {s}..{e} ({e - s + 1} frames), widest (hit) at +{hit_src}; diff max {diff.max():.1f}")
    h, w = fr[0][0].shape[:2]
    vw = cv2.VideoWriter(trimmed + ".raw.mp4", cv2.VideoWriter_fourcc(*"mp4v"), 24, (w, h))
    for f, _ in fr[s:e + 1]:
        vw.write(f)
    vw.release()
    run("ffmpeg", "-v", "error", "-y", "-i", trimmed + ".raw.mp4", "-c:v", "libx264", "-crf", "4", "-pix_fmt", "yuv420p", trimmed)
    os.remove(trimmed + ".raw.mp4")

# scale reference: the tallest subject in the first processed clip of this character
if "ref_height" not in charcfg:
    hs = []
    for f, m in keyed_frames(trimmed):
        ys = np.nonzero(m.any(1))[0]
        hs.append(ys.max() - ys.min() + 1 if len(ys) else 0)
    charcfg["ref_height"] = int(np.percentile(hs, 90))
    json.dump(charcfg, open(charcfg_path, "w"), indent=1)
    print("char ref_height set to", charcfg["ref_height"])

# TostAI: VRMBG matte + key + despill, cells cropped to the subject, bottom-centre anchor
studio_id = f"{a.char}_{a.action}"
studio_args = [PY, os.path.join(config.PIPELINE_DIR, "studio.py"), "run", "--id", studio_id, "--video", trimmed,
               "--out", os.path.relpath(os.path.join(work, "studio"), ROOT), "--phase", "4",
               "--set", f"play_mode={'loop' if a.mode == 'loop' else 'once'}"]
if BG == "magenta":
    studio_args += ["--set", "key_color=#CC00FF"]   # Qwen/H3 "magenta" lands around (190-215, 0, 255)
if a.key:
    mask = trimmed.replace(".mp4", "_mask.mp4")
    run(PY, os.path.join(T, "green_mask.py"), trimmed, mask, "--bg", BG)
    studio_args += ["--cfg", os.path.join(config.STUDIO_TEMPLATES, "mask_loop.json"), "--mask", mask]
else:
    studio_args += ["--cfg", os.path.join(config.STUDIO_TEMPLATES, "vrmbg_loop.json")]
print(run(*studio_args).strip()[-600:])
sidecar = os.path.join(work, "studio", f"{studio_id}.json")

# pick frames: evenly spaced, and for one-shots make sure the hit frame survives
n_src = json.load(open(sidecar))["frame_count"]
keep = a.keep or n_src
idx = list(np.round(np.linspace(0, n_src - 1, min(keep, n_src))).astype(int))
hit_out = -1
if a.mode == "once":
    hs = int(a.hit) if a.hit.isdigit() else hit_src
    if hs is not None:
        nearest = int(np.argmin([abs(i - hs) for i in idx]))
        idx[nearest] = hs
        idx = sorted(set(idx))
        hit_out = idx.index(hs)
pal = os.path.join(config.char_dir(a.char), "palette.json")
game_id = a.game_id or a.char
dest_dir = os.path.join(config.OUTPUT_DIR, game_id)
os.makedirs(dest_dir, exist_ok=True)
args = [PY, os.path.join(T, "sheet_snap.py"), sidecar, os.path.join(dest_dir, a.action),
        "--height", str(charcfg["height"]), "--ref-height", str(round(charcfg["ref_height"] * a.ref_scale)),
        "--pick", ",".join(map(str, idx)), "--fps", str(a.fps), "--play", a.mode, "--action", a.action]
args += ["--palette-json", pal] if os.path.exists(pal) else ["--save-palette", pal, "--colors", str(charcfg.get("colors", 24))]
if hit_out >= 0:
    args += ["--hit-frame", str(hit_out)]
if charcfg.get("color_space"):
    args += ["--color-space", charcfg["color_space"]]
print(run(*args).strip())
gif = os.path.join(dest_dir, a.action + ".gif")
os.replace(gif, os.path.join(work, a.action + "_preview.gif"))
print("preview:", os.path.relpath(os.path.join(work, a.action + "_preview.gif"), ROOT))
