#!/usr/bin/env python3
"""Run the H3 animation queue (<WORK_DIR>/anim_queue.json) one clip at a time, skipping clips that exist.

  run_anim_queue.py [--queue FILE] [--resolution 704x704]

Queue format: {"queue": [{"id": "joel_run", "char": "joel", "start": "<Maestro upload path>",
                          "prompt": "joel_run_v1"}]}
"start" is the server path printed by `maestro.py upload REF.png`. "prompt" defaults to "<id>_v1" and
resolves to <PROMPTS_DIR>/anim/<prompt>.txt. Clips land in <WORK_DIR>/<char>/clips/<ID_PREFIX>_<id>_h3_1.mp4.
Runs on the ATOM GPU (no Dreamina credits). Needs the Maestro tunnel on :17860.
"""
import argparse, json, os, subprocess, sys

import config

ROOT = config.PROJECT_ROOT
ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument("--queue", default=config.ANIM_QUEUE)
ap.add_argument("--resolution", default="704x704")
a = ap.parse_args()
q = json.load(open(a.queue))
for item in q["queue"]:
    k, char = item["id"], item["char"]
    out = config.rel(config.clips_dir(char))
    if os.path.exists(os.path.join(ROOT, out, f"{config.ID_PREFIX}_{k}_h3_1.mp4")):
        print("skip", k, flush=True)
        continue
    r = subprocess.run([sys.executable, os.path.join(config.PIPELINE_DIR, "maestro.py"), "run", "--id", f"{config.ID_PREFIX}_{k}_h3", "--phase", "4",
                        "--body", os.path.join(config.MAESTRO_TEMPLATES, "h3_fused_i2v.json"),
                        "--prompt-file", os.path.join(config.PROMPTS_DIR, "anim", (item.get("prompt") or f"{k}_v1") + ".txt"),
                        "--out", out, "--set", f"image_start={item['start']}", "--set", f"resolution={a.resolution}"],
                       capture_output=True, text=True, cwd=ROOT)
    tail = (r.stdout + r.stderr).strip().splitlines()[-1:] or [""]
    print(("DONE " if r.returncode == 0 else "FAIL ") + k, tail[0][:200], flush=True)
