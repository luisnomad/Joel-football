#!/usr/bin/env python3
"""TostAI Sprite Sheet Studio client (Docker container on the ATOM, VRMBG-3.0 matting build).

Needs the tunnel:  ssh -fN -L 8765:127.0.0.1:8765 atom

  studio.py run --id ID --video CLIP.mp4 --cfg CFG.json --out DIR [--mask MASK.mp4] [--set key=value ...]

Uploads the clip, runs the pipeline, waits, copies every output file of the run out of the
container (ssh $ATOM_HOST docker exec $STUDIO_CONTAINER ...) into DIR (relative to the project
root), and logs the run to the manifest.
"""
import argparse, datetime, json, os, sys, time, urllib.parse, urllib.request

import config

ROOT = config.PROJECT_ROOT
API = os.environ.get("STUDIO_API", "http://127.0.0.1:8765")


def call(method, path, body=None, raw=False):
    headers = {} if raw or body is None else {"Content-Type": "application/json"}
    data = body if raw or body is None else json.dumps(body).encode()
    with urllib.request.urlopen(urllib.request.Request(API + path, data=data, method=method, headers=headers), timeout=300) as r:
        out = r.read()
        return json.loads(out) if r.headers.get_content_type() == "application/json" else out


def coerce(v):
    try:
        return json.loads(v)
    except json.JSONDecodeError:
        return v


ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest="cmd", required=True)
r = sub.add_parser("run")
r.add_argument("--id", required=True); r.add_argument("--video", required=True)
r.add_argument("--cfg", required=True); r.add_argument("--out", required=True)
r.add_argument("--mask"); r.add_argument("--phase", default="0"); r.add_argument("--set", action="append")
a = ap.parse_args()

with open(a.video, "rb") as f:
    up = call("POST", "/api/upload?name=" + urllib.parse.quote(f"{a.id}.mp4"), f.read(), raw=True)
with open(a.cfg) as f:
    cfg = json.load(f)
for kv in a.set or []:
    k, v = kv.split("=", 1)
    cfg[k] = coerce(v)
cfg["video"] = up["path"]
if a.mask:
    with open(a.mask, "rb") as f:
        cfg["mask_video"] = call("POST", "/api/upload?sub=masks&name=" + urllib.parse.quote(f"{a.id}_mask.mp4"), f.read(), raw=True)["path"]
cfg["prefix"] = a.id
jid = call("POST", "/api/run", cfg)["id"]
t0 = time.time()
while True:
    job = call("GET", f"/api/job/{jid}")["job"]
    if job.get("state") in ("done", "error", "failed", "cancelled") or job.get("status") in ("done", "error", "failed", "cancelled"):
        break
    time.sleep(3)
state = job.get("state") or job.get("status")
print("state", state, f"{time.time()-t0:.0f}s")
if state != "done":
    print(json.dumps({k: v for k, v in job.items() if k != "log"}, indent=1)[:3000])
    print("\n".join((job.get("log") or [])[-30:]) if isinstance(job.get("log"), list) else str(job.get("log"))[-3000:])
    sys.exit(1)

res = job.get("result") or {}
out_dir = os.path.join(ROOT, a.out)
os.makedirs(out_dir, exist_ok=True)
# pull the run folder straight out of the container (the /files route is for the UI)
import subprocess
# single quotes keep $(...) for the container's shell, not the ATOM host's
remote = f"cd /app/sprite_studio/runs && cd \"$(ls -d *_{a.id} | tail -1)\" && tar cf - ."
pull = subprocess.Popen(["ssh", config.ATOM_HOST, f"docker exec {config.STUDIO_CONTAINER} sh -c '{remote}'"], stdout=subprocess.PIPE)
subprocess.run(["tar", "xf", "-", "-C", out_dir], stdin=pull.stdout, check=True)
if pull.wait() != 0:
    sys.exit("could not copy run outputs from the container")
files = [{"file": os.path.relpath(os.path.join(out_dir, n), ROOT)} for n in sorted(os.listdir(out_dir)) if not n.startswith(".")]
with config.manifest_lock() as m:
    m["assets"][a.id] = {
        "id": a.id, "phase": a.phase, "status": "presented", "tool": "tostai-sprite-studio",
        "source_clip": os.path.relpath(a.video, ROOT), "mask": a.mask and os.path.relpath(a.mask, ROOT), "cfg": {k: v for k, v in cfg.items() if k != "video"},
        "job_id": jid, "verify": res.get("verify"), "files": files,
        "generated": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
    }
print(json.dumps({"verify": res.get("verify"), "files": files}, indent=1)[:3000])
