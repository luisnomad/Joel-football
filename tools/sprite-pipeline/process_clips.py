#!/usr/bin/env python3
"""Process every finished H3 clip in <WORK_DIR>/process_plan.json that has no snapped sheet yet.
Waits for clips to appear; exits when all are processed or the H3 queue is finished (--once to do one pass).

  process_clips.py [--once] [--plan FILE]

Plan format: {"<clip id>": [char, action, mode, keep, fps, game_id]}, e.g.
  {"joel_run": ["joel", "run", "loop", 8, 12, ""], "joel_kick": ["joel", "kick", "once", 8, 14, ""]}
The clip is <WORK_DIR>/<char>/clips/<ID_PREFIX>_<clip id>_h3_1.mp4; the sheet is
<OUTPUT_DIR>/<game_id or char>/<action>.json.
"""
import argparse, json, os, subprocess, sys, time

import config

ROOT = config.PROJECT_ROOT
ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--once", action="store_true")
ap.add_argument("--plan", default=config.PROCESS_PLAN)
a = ap.parse_args()
plan = json.load(open(a.plan))
once = a.once
done = set()
while True:
    pending = 0
    for clip_id, (char, action, mode, keep, fps, gid) in plan.items():
        if clip_id in done:
            continue
        clip = os.path.join(config.clips_dir(char), f"{config.ID_PREFIX}_{clip_id}_h3_1.mp4")
        sheet = os.path.join(config.OUTPUT_DIR, gid or char, action + ".json")
        if os.path.exists(sheet) and os.path.getmtime(sheet) > os.path.getmtime(clip) if os.path.exists(clip) else False:
            done.add(clip_id); continue
        if not os.path.exists(clip):
            pending += 1; continue
        args = [sys.executable, os.path.join(config.PIPELINE_DIR, "make_action.py"), "--char", char, "--action", action,
                "--clip", clip, "--mode", mode, "--keep", str(keep), "--fps", str(fps)]
        if gid: args += ["--game-id", gid]
        if mode == "loop": args += ["--min", "6", "--max", "36"]
        r = subprocess.run(args, capture_output=True, text=True, cwd=ROOT)
        lines = [l for l in (r.stdout + r.stderr).splitlines() if any(k in l for k in ("best loop", "once:", "frames ", "FAILED", "no motion", "drift"))]
        print(("OK   " if r.returncode == 0 else "FAIL ") + clip_id + " | " + " | ".join(l.strip()[:140] for l in lines[-3:]), flush=True)
        done.add(clip_id)
    if once or pending == 0:
        break
    time.sleep(30)
