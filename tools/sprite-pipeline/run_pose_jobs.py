#!/usr/bin/env python3
"""Run Qwen 2.1 pose edits listed in <WORK_DIR>/pose_jobs.json (skips poses that already exist).

  run_pose_jobs.py [--jobs FILE]

Jobs format: [{"id": "joel_stun", "ref": "<Maestro upload path of the approved reference>"}]
Prompts resolve to <PROMPTS_DIR>/poses/<id>_v1.txt; outputs land in <POSES_DIR>/<ID_PREFIX>_pose_<id>_1.png,
which is the name pose_sheet.py looks for. Runs on the ATOM GPU (no Dreamina credits).
"""
import argparse, json, os, subprocess, sys

import config

ROOT = config.PROJECT_ROOT
ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--jobs", default=config.POSE_JOBS)
a = ap.parse_args()
for j in json.load(open(a.jobs)):
    out = os.path.join(config.POSES_DIR, f"{config.ID_PREFIX}_pose_{j['id']}_1.png")
    if os.path.exists(out):
        print("skip", j["id"], flush=True); continue
    r = subprocess.run([sys.executable, os.path.join(config.PIPELINE_DIR, "maestro.py"), "run", "--id", f"{config.ID_PREFIX}_pose_{j['id']}", "--phase", "4",
                        "--body", os.path.join(config.MAESTRO_TEMPLATES, "qwen21_edit.json"),
                        "--prompt-file", os.path.join(config.PROMPTS_DIR, "poses", f"{j['id']}_v1.txt"),
                        "--out", config.rel(config.POSES_DIR), "--set", "resolution=1024x1024", "--set", "image_refs=" + json.dumps([j["ref"]])],
                       capture_output=True, text=True, cwd=ROOT)
    print(("OK   " if r.returncode == 0 else "FAIL ") + j["id"], flush=True)
