#!/usr/bin/env python3
"""Maestro (ATOM) client: submit Qwen Image 2.1 / H3 / LTX jobs, wait, download, log to manifest.json.

Needs the tunnel:  ssh -fN -L 17860:127.0.0.1:17860 atom

  maestro.py upload FILE                         -> prints server path (for image_start / image_refs)
  maestro.py run --id ID --body BODY.json --prompt-file P.txt --out DIR [--phase P] [--set key=value ...]

BODY.json is a settings template (tools/sprite-pipeline/maestro_templates/); the prompt always comes
from --prompt-file so it is versioned in tools/sprite-pipeline/prompts/. --out is relative to the
project root (config.PROJECT_ROOT).
"""
import argparse, datetime, json, mimetypes, os, sys, time, urllib.request, uuid

import config

ROOT = config.PROJECT_ROOT
API = os.environ.get("MAESTRO_API", "http://127.0.0.1:17860/api/v1")


def req(method, path, body=None, headers=None):
    r = urllib.request.Request(API + path, data=body, method=method, headers=headers or {})
    with urllib.request.urlopen(r, timeout=120) as resp:
        data = resp.read()
    return json.loads(data) if resp.headers.get_content_type() == "application/json" else data


def upload(path):
    boundary = uuid.uuid4().hex
    ctype = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(path, "rb") as f:
        payload = f.read()
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{os.path.basename(path)}\"\r\n"
            f"Content-Type: {ctype}\r\n\r\n").encode() + payload + f"\r\n--{boundary}--\r\n".encode()
    return req("POST", "/upload", body, {"Content-Type": f"multipart/form-data; boundary={boundary}"})


def coerce(v):
    try:
        return json.loads(v)
    except json.JSONDecodeError:
        return v


def run(a):
    with open(a.body) as f:
        body = json.load(f)
    with open(a.prompt_file) as f:
        body["prompt"] = f.read().strip()
    for kv in a.set or []:
        k, v = kv.split("=", 1)
        body[k] = coerce(v)
    # guard: shell-decorated values (the RTK hook turns `cat` into bat output) must never reach Maestro
    for k in ("image_start", "image_end", "image_guide"):
        v = body.get(k)
        if v is not None and (not isinstance(v, str) or not v.startswith("/") or any(c in v for c in "\x1b─│┬┼┴\n")):
            sys.exit(f"refusing to submit: {k} is not a clean absolute path: {v!r}")
    for v in body.get("image_refs") or []:
        if not v.startswith("/") or any(c in v for c in "\x1b─│┬┼┴\n"):
            sys.exit(f"refusing to submit: image_refs entry is not a clean absolute path: {v!r}")
    job = req("POST", "/generate", json.dumps(body).encode(), {"Content-Type": "application/json"})
    job_id = job["job_id"]
    print("job", job_id, job.get("status"), flush=True)
    t0 = time.time()
    while True:
        st = req("GET", f"/status/{job_id}")
        if st["status"] in ("completed", "done", "success", "failed", "error", "cancelled"):
            break
        print(f"  {int(time.time()-t0)}s {st['status']} {st.get('progress')}", flush=True)
        time.sleep(10)
    if st.get("error") or not st.get("output_files"):
        sys.exit(f"Maestro job {job_id} ended {st['status']}: {st.get('error')}")
    out_dir = os.path.join(ROOT, a.out)
    os.makedirs(out_dir, exist_ok=True)
    files = []
    for i, of in enumerate(st["output_files"]):
        name = os.path.basename(of if isinstance(of, str) else of.get("filename") or of.get("path"))
        ext = os.path.splitext(name)[1]
        dest = os.path.join(out_dir, f"{a.id}_{i+1}{ext}")
        with open(dest, "wb") as f:
            f.write(req("GET", "/file/" + urllib.request.quote(name)))
        files.append({"remote": name, "file": os.path.relpath(dest, ROOT)})
    with config.manifest_lock() as m:
        m["assets"][a.id] = {
            "id": a.id, "phase": a.phase, "status": "presented", "tool": "maestro",
            "model": body.get("model_type"), "seed": body.get("seed"),
            "prompt_file": os.path.relpath(a.prompt_file, ROOT),
            "body_template": os.path.relpath(a.body, ROOT), "overrides": a.set or [],
            "refs": [body[k] for k in ("image_start", "image_end") if body.get(k)] + list(body.get("image_refs") or []),
            "job_id": job_id, "elapsed_s": round(time.time() - t0), "files": files,
            "generated": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
        }
    print(json.dumps(files, indent=1))


ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest="cmd", required=True)
u = sub.add_parser("upload"); u.add_argument("file")
r = sub.add_parser("run")
r.add_argument("--id", required=True); r.add_argument("--body", required=True)
r.add_argument("--prompt-file", required=True); r.add_argument("--out", required=True)
r.add_argument("--phase", default="0"); r.add_argument("--set", action="append")
a = ap.parse_args()
if a.cmd == "upload":
    print(json.dumps(upload(a.file)))
else:
    run(a)
