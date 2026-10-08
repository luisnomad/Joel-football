#!/usr/bin/env python3
"""PixVerse CLI wrapper: reads prompts from files (never through the shell), runs
`pixverse create image`, downloads the results and logs everything to manifest.json.

  pv.py image --id ID --prompt-file F --out DIR [--image REF ...] [--model M]
              [--quality Q] [--aspect-ratio R] [--detail-level L] [--count N] [--seed S]
  pv.py video --id ID --prompt-file F --out DIR --image START [--model v6] [--quality 720p]
              [--aspect-ratio 1:1] [--duration 5] [--seed S] [--count N]        (I2V, no audio)
  pv.py transition --id ID --prompt-file F --out DIR --images K1 K2 ... [--model v6]
              [--quality 720p] [--duration 5] [--seed S] [--count N]          (keyframes, no audio)
  pv.py motion --id ID --out DIR --image CHAR --video MOTION [--model v5.6] [--quality 720p] [--count N]
  pv.py fetch --id ID          (re-download the outputs of a logged run)

Only flags listed by `pixverse create image --help` (CLI 1.4.6) are used. Credits are
measured as the account balance before minus after (`pixverse account info --json`),
because the create output does not promise a cost field. --out is relative to the
project root (config.PROJECT_ROOT); outputs are DIR/<id>_<n>.<ext>.
"""
import argparse, datetime, glob, json, os, shutil, subprocess, sys, tempfile, uuid

import config

ROOT = config.PROJECT_ROOT


def now():
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def pv(*args, timeout=900):
    p = subprocess.run(["pixverse", *args, "--json"], capture_output=True, text=True, timeout=timeout)
    try:
        out = json.loads(p.stdout)
    except json.JSONDecodeError:
        out = None
    return p.returncode, out, p.stdout, p.stderr


def credits():
    code, out, _, err = pv("account", "info")
    if code or not out:
        return None
    return (out.get("credits") or {}).get("total")


def find_ids(obj, keys=("image_id", "imageId", "video_id", "videoId", "id")):
    """Collect generated asset ids from the create output, whatever its nesting."""
    found = []
    if isinstance(obj, dict):
        for k in keys:
            v = obj.get(k)
            if isinstance(v, (int, str)) and str(v).isdigit():
                found.append(str(v))
                break
        for v in obj.values():
            if isinstance(v, (dict, list)):
                found += find_ids(v, keys)
    elif isinstance(obj, list):
        for v in obj:
            found += find_ids(v, keys)
    return list(dict.fromkeys(found))


def download(asset_ids, out_dir, prefix, kind):
    os.makedirs(out_dir, exist_ok=True)
    files = []
    for aid in asset_ids:
        tmp = tempfile.mkdtemp(prefix="pv-")
        code, out, so, se = pv("asset", "download", aid, "--type", kind, "--dest", tmp)
        got = sorted(glob.glob(os.path.join(tmp, "*")))
        if code or not got:
            print(f"download {aid} failed (exit {code})\n{so}\n{se}", file=sys.stderr)
            continue
        ext = os.path.splitext(got[0])[1] or ".png"
        dest = os.path.join(out_dir, f"{prefix}_{len(files)+1}{ext}")
        if os.path.exists(dest):
            sys.exit(f"refusing to overwrite {dest}")
        shutil.move(got[0], dest)
        shutil.rmtree(tmp, ignore_errors=True)
        files.append({"asset_id": aid, "file": config.rel(dest)})
    return files


def read_prompt(path):
    with open(path) as f:  # read in Python: never pass prompts through `cat` (RTK rewrites it to bat)
        return f.read().strip()


def guard_new(aid):
    m = config.load_manifest()
    if aid in m["assets"] and m["assets"][aid].get("files"):
        sys.exit(f"{aid} already has outputs in the manifest; use a new id (e.g. _v2) for a re-roll")


def relp(p):
    return config.rel(os.path.abspath(p)) if os.path.exists(p) else p


def submit(a, tool, args, kind, extra):
    """Log, run `pixverse create ...`, measure credits, download, log again."""
    key = str(uuid.uuid4())
    args = args + ["--idempotency-key", key, "--timeout", str(a.timeout)]
    entry = {"id": a.id, "tool": tool, "phase": a.phase, "status": "submitted",
             "idempotency_key": key, "out_dir": a.out, "submitted": now(), **extra}
    with config.manifest_lock() as mm:
        mm["assets"][a.id] = entry
    before = credits()
    code, out, so, se = pv(*args, timeout=a.timeout + 120)
    after = credits()
    ids = find_ids(out) if out else []
    entry.update(raw=out if out else {"stdout": so[-2000:], "stderr": se[-2000:]}, exit_code=code,
                 asset_ids=ids, credits_before=before, credits_after=after,
                 credits=(before - after) if before is not None and after is not None else None)
    files = download(ids, os.path.join(ROOT, a.out), a.id, kind) if code == 0 and ids else []
    entry.update(files=files, generated=now(), status="presented" if files else "failed")
    with config.manifest_lock() as mm:
        mm["assets"][a.id] = entry
    print(json.dumps({k: entry[k] for k in ("id", "exit_code", "asset_ids", "credits", "files", "status")}, indent=1))
    if not files:
        print(so[-3000:], se[-3000:], file=sys.stderr)
        sys.exit(1)


def video(a):
    guard_new(a.id)
    prompt = read_prompt(a.prompt_file)
    args = ["create", "video", "--prompt", prompt, "--image", a.image, "--model", a.model,
            "--quality", a.quality, "--aspect-ratio", a.aspect_ratio, "--duration", str(a.duration),
            "--count", str(a.count), "--no-audio"]
    if a.seed is not None:
        args += ["--seed", str(a.seed)]
    submit(a, "pixverse create video", args, "video", {
        "prompt_file": relp(a.prompt_file), "model": a.model, "quality": a.quality,
        "aspect_ratio": a.aspect_ratio, "duration": a.duration, "count": a.count, "seed": a.seed,
        "refs": [relp(a.image)]})


def transition(a):
    guard_new(a.id)
    prompt = read_prompt(a.prompt_file)
    args = ["create", "transition", "--images", *a.images, "--prompt", prompt, "--model", a.model,
            "--quality", a.quality, "--duration", str(a.duration), "--count", str(a.count), "--no-audio"]
    if a.seed is not None:
        args += ["--seed", str(a.seed)]
    submit(a, "pixverse create transition", args, "video", {
        "prompt_file": relp(a.prompt_file), "model": a.model, "quality": a.quality,
        "duration": a.duration, "count": a.count, "seed": a.seed, "refs": [relp(p) for p in a.images]})


def motion(a):
    guard_new(a.id)
    args = ["create", "motion-control", "--image", a.image, "--video", a.video, "--model", a.model,
            "--quality", a.quality, "--count", str(a.count)]
    submit(a, "pixverse create motion-control", args, "video", {
        "model": a.model, "quality": a.quality, "count": a.count, "refs": [relp(a.image), relp(a.video)]})


def image(a):
    guard_new(a.id)
    prompt = read_prompt(a.prompt_file)
    key = str(uuid.uuid4())
    args = ["create", "image", "--prompt", prompt, "--model", a.model, "--quality", a.quality,
            "--aspect-ratio", a.aspect_ratio, "--count", str(a.count), "--idempotency-key", key,
            "--timeout", str(a.timeout)]
    if a.detail_level:
        args += ["--detail-level", a.detail_level]
    if a.seed is not None:
        args += ["--seed", str(a.seed)]
    refs = a.image or []
    if len(refs) == 1:
        args += ["--image", refs[0]]
    elif refs:
        args += ["--images", *refs]
    entry = {
        "id": a.id, "tool": "pixverse create image", "phase": a.phase, "status": "submitted",
        "prompt_file": config.rel(os.path.abspath(a.prompt_file)), "model": a.model,
        "quality": a.quality, "aspect_ratio": a.aspect_ratio, "detail_level": a.detail_level,
        "count": a.count, "seed": a.seed, "refs": [config.rel(os.path.abspath(r)) if os.path.exists(r) else r for r in refs],
        "idempotency_key": key, "out_dir": a.out, "submitted": now(),
    }
    with config.manifest_lock() as mm:
        mm["assets"][a.id] = entry
    before = credits()
    code, out, so, se = pv(*args, timeout=a.timeout + 120)
    after = credits()
    ids = find_ids(out) if out else []
    entry.update(raw=out if out else {"stdout": so[-2000:], "stderr": se[-2000:]}, exit_code=code,
                 asset_ids=ids, credits_before=before, credits_after=after,
                 credits=(before - after) if before is not None and after is not None else None)
    files = download(ids, os.path.join(ROOT, a.out), a.id, "image") if code == 0 and ids else []
    entry.update(files=files, generated=now(), status="presented" if files else "failed")
    with config.manifest_lock() as mm:  # reload under lock: parallel jobs may have written meanwhile
        mm["assets"][a.id] = entry
    print(json.dumps({k: entry[k] for k in ("id", "exit_code", "asset_ids", "credits", "files", "status")}, indent=1))
    if not files:
        print(so[-3000:], se[-3000:], file=sys.stderr)
        sys.exit(1)


def fetch(a):
    asset = config.load_manifest()["assets"][a.id]
    kind = "image" if asset.get("tool") == "pixverse create image" else "video"
    files = download(asset["asset_ids"], os.path.join(ROOT, asset["out_dir"]), a.id + "_refetch", kind)
    with config.manifest_lock() as mm:
        mm["assets"][a.id].setdefault("refetched", []).extend(files)
    print(json.dumps(files, indent=1))


ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
sub = ap.add_subparsers(dest="cmd", required=True)
i = sub.add_parser("image")
i.add_argument("--id", required=True); i.add_argument("--prompt-file", required=True)
i.add_argument("--out", required=True); i.add_argument("--phase", default="style")
i.add_argument("--image", action="append", help="reference image (repeat for several)")
i.add_argument("--model", default="gpt-image-2.5-flare"); i.add_argument("--quality", default="1080p")
i.add_argument("--aspect-ratio", default="1:1")
i.add_argument("--detail-level", choices=["low", "medium", "high", "xhigh", "max"])
i.add_argument("--count", type=int, default=1); i.add_argument("--seed", type=int)
i.add_argument("--timeout", type=int, default=600)
for name, need_prompt in (("video", True), ("transition", True), ("motion", False)):
    v = sub.add_parser(name)
    v.add_argument("--id", required=True); v.add_argument("--out", required=True)
    v.add_argument("--phase", default="pilot"); v.add_argument("--quality", default="720p")
    v.add_argument("--count", type=int, default=1); v.add_argument("--timeout", type=int, default=900)
    if need_prompt:
        v.add_argument("--prompt-file", required=True); v.add_argument("--model", default="v6")
        v.add_argument("--duration", type=int, default=5); v.add_argument("--seed", type=int)
    if name == "video":
        v.add_argument("--image", required=True); v.add_argument("--aspect-ratio", default="1:1")
    if name == "transition":
        v.add_argument("--images", nargs="+", required=True)
    if name == "motion":
        v.add_argument("--image", required=True); v.add_argument("--video", required=True)
        v.add_argument("--model", default="v5.6")
f = sub.add_parser("fetch"); f.add_argument("--id", required=True)
a = ap.parse_args()
{"image": image, "video": video, "transition": transition, "motion": motion, "fetch": fetch}[a.cmd](a)
