#!/usr/bin/env python3
"""Dreamina CLI wrapper: reads prompts from files (never through the shell),
creates/edits image nodes, runs them, downloads outputs, logs to manifest.json.

  gen.py draft  --id ID --prompt-file F --out DIR [--model M] [--ratio R] [--res 1K] [--count N] [--ref res:UUID ...] [--node-id N] [--phase P]
  gen.py quote  --id ID
  gen.py run    --id ID --ceiling N        (runs, waits, downloads into the asset's out dir)
  gen.py fetch  --id ID                    (re-download outputs)

--out is relative to the project root (config.PROJECT_ROOT). New nodes go to the canvas in
$DREAMINA_PROJECT_ID when set, otherwise to the CLI's current canvas. The canvas is stored
per asset in the manifest and passed as --project-id to every later call (dreamina-canvas
1.0.1 accepts it on node edit/quote/confirm/run/show, resource download and operation
wait), so a non-current canvas works without switching the CLI's current one. The manifest is
config.MANIFEST (tools/sprite-pipeline/manifest.json by default).
"""
import argparse, datetime, json, os, subprocess, sys

import config

ROOT = config.PROJECT_ROOT
DEFAULT_MODEL = "dreamina_gpt_image_2_5_flare"


def cli(*args):
    p = subprocess.run(["dreamina-canvas", *args, "--format", "json", "--non-interactive"],
                       capture_output=True, text=True)
    try:
        out = json.loads(p.stdout)
    except json.JSONDecodeError:
        sys.exit(f"dreamina-canvas {' '.join(args)}\nexit {p.returncode}\n{p.stdout}\n{p.stderr}")
    if not out.get("ok"):
        sys.exit(json.dumps(out, indent=1))
    return out["data"]


def load():
    return config.load_manifest()


def proj(asset=None):
    pid = (asset or {}).get("project_id") or config.DREAMINA_PROJECT_ID
    return ["--project-id", pid] if pid else []


def now():
    return datetime.datetime.now().astimezone().isoformat(timespec="seconds")


def draft(a):
    m = load()
    with open(a.prompt_file) as f:  # read in Python: never pass prompts through `cat` (RTK rewrites it to bat)
        prompt = f.read().strip()
    gen = ["--mode", "i2i" if a.ref else "t2i", "--model", a.model, "--ratio", a.ratio,
           "--resolution", a.res, "--count", str(a.count), "--prompt", prompt, "--title", a.id]
    for r in a.ref or []:
        gen += ["--ref", r]
    prev = m["assets"].get(a.id, {})
    node_id = a.node_id or prev.get("node_id")
    target = (["--node-id", node_id] if node_id else []) + proj(prev)
    data = cli("node", "edit" if node_id else "create", "image", *target, *gen)
    node = data["node"]
    assert node["generation"]["prompt"] == prompt, "prompt did not round-trip cleanly"
    with config.manifest_lock() as m:
        m["assets"][a.id] = {
            **m["assets"].get(a.id, {}),
            "id": a.id, "phase": a.phase, "status": "draft",
            "prompt_file": os.path.relpath(a.prompt_file, ROOT), "model": a.model,
            "ratio": a.ratio, "resolution": a.res, "count": a.count, "seed": None,
            "refs": a.ref or [], "node_id": node["nodeId"],
            "project_id": prev.get("project_id") or config.DREAMINA_PROJECT_ID or None, "out_dir": a.out, "updated": now(),
        }
    print(a.id, node["nodeId"], "draft saved")


def quote(a):
    m = load()
    print(json.dumps(cli("node", "quote", "--node-id", m["assets"][a.id]["node_id"], *proj(m["assets"][a.id])), indent=1))


def run(a):
    m = load()
    asset = m["assets"][a.id]
    conf = cli("node", "confirm", "--node-id", asset["node_id"], "--credit-ceiling", str(a.ceiling), *proj(asset))
    token = conf.get("creditConfirmationToken") or conf.get("token")
    if not token:
        sys.exit("no credit token issued (estimate above ceiling?)\n" + json.dumps(conf, indent=1))
    ran = cli("node", "run", "--node-id", asset["node_id"], "--credit-token", token, *proj(asset))
    print(json.dumps(ran, indent=1)[:800])
    sub_ids = [i.get("submitId") for i in ran.get("items", ran.get("runs", [])) if i.get("submitId")]
    data = {"confirm": conf, "run": ran,
            "wait": [cli("operation", "wait", s, "--timeout", "10m", *proj(asset)) for s in sub_ids]}
    with config.manifest_lock() as m:  # reload under lock: parallel jobs may have written meanwhile
        m["assets"][a.id]["run"] = data
    fetch(a)


def fetch(a):
    m = load()
    asset = m["assets"][a.id]
    shown = cli("node", "show", "--node-id", asset["node_id"], *proj(asset))["nodes"][0]
    node = shown.get("node", shown)
    out = os.path.join(ROOT, asset["out_dir"])
    os.makedirs(out, exist_ok=True)
    files = []
    for res in node.get("resources", []):
        if res.get("status") != "success":
            continue
        dest = os.path.join(out, f"{a.id}_{len(files)+1}.png")
        cli("resource", "download", res["resourceId"], "--output", dest, *proj(asset))
        files.append({"resource_id": res["resourceId"], "file": os.path.relpath(dest, ROOT),
                      "credits": res.get("creditsAmount")})
    with config.manifest_lock() as m:  # reload after the (slow) downloads so parallel jobs' writes are kept
        asset = m["assets"][a.id]
        asset.update(files=files, generated=now(), status="presented" if files else asset["status"])
    print(json.dumps(files, indent=1))


ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest="cmd", required=True)
d = sub.add_parser("draft")
d.add_argument("--id", required=True); d.add_argument("--prompt-file", required=True)
d.add_argument("--out", required=True); d.add_argument("--phase", default="0")
d.add_argument("--model", default=DEFAULT_MODEL); d.add_argument("--ratio", default="16:9")
d.add_argument("--res", default="1K"); d.add_argument("--count", type=int, default=1)
d.add_argument("--ref", action="append"); d.add_argument("--node-id")
q = sub.add_parser("quote"); q.add_argument("--id", required=True)
f = sub.add_parser("fetch"); f.add_argument("--id", required=True)
r = sub.add_parser("run"); r.add_argument("--id", required=True); r.add_argument("--ceiling", type=int, required=True)
a = ap.parse_args()
{"draft": draft, "quote": quote, "run": run, "fetch": fetch}[a.cmd](a)
