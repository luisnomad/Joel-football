"""Shared paths and settings for the sprite pipeline (ported from Kick or Treat).

Every script imports this module instead of deriving paths from its own location.
Override any value with an environment variable; the defaults suit Joel Football
(head-soccer). Paths written to manifest.json are relative to PROJECT_ROOT.

  SPRITE_PROJECT_ROOT   repository root                  (default: two levels above this file)
  SPRITE_WORK_DIR       per-character work folders        (default: source-assets/sprite-pipeline)
                        <WORK_DIR>/<char>/char.json, palette.json, clips/, <action>/ work files
  SPRITE_POSES_DIR      Qwen pose edits + aligned stills  (default: <WORK_DIR>/_poses)
  SPRITE_OUTPUT_DIR     snapped per-action sheets + JSON  (default: <WORK_DIR>/sheets)
                        Deliberately NOT public/: the game loads one packed 4x3 atlas per
                        character, built by pack_atlas.py from these sheets.
  SPRITE_GAME_ASSETS    the game's runtime art folder     (default: public/assets)
  SPRITE_FINAL_DIR      lossless atlas masters            (default: source-assets/animation/final)
  SPRITE_PROMPTS_DIR    versioned prompt files            (default: tools/sprite-pipeline/prompts)
  SPRITE_MANIFEST       generation log                    (default: tools/sprite-pipeline/manifest.json)
  SPRITE_ID_PREFIX      prefix of queue/pose ids          (default: p4, the Kick or Treat phase tag)
  SPRITE_DEFAULT_HEIGHT char.json "height" when missing   (default: 380 = Joel Football idle height in a 480 px cell)
  DREAMINA_PROJECT_ID   Dreamina canvas for new nodes     (default: unset = the CLI's current canvas)
  ATOM_HOST             ssh host running Maestro/Studio   (default: atom)
  STUDIO_CONTAINER      TostAI Sprite Studio container    (default: tostai-sprite-studio)
  MAESTRO_API / STUDIO_API are read by maestro.py / studio.py directly (tunnelled localhost ports).
"""
import contextlib
import fcntl
import json
import os
import tempfile

PIPELINE_DIR = os.path.dirname(os.path.abspath(__file__))
TOOLS_DIR = os.path.join(PIPELINE_DIR, "tools")
MAESTRO_TEMPLATES = os.path.join(PIPELINE_DIR, "maestro_templates")
STUDIO_TEMPLATES = os.path.join(PIPELINE_DIR, "studio_templates")


def _path(env, default):
    v = os.environ.get(env)
    if not v:
        return default
    return v if os.path.isabs(v) else os.path.join(PROJECT_ROOT, v)


PROJECT_ROOT = os.path.abspath(os.environ.get("SPRITE_PROJECT_ROOT") or os.path.dirname(os.path.dirname(PIPELINE_DIR)))
WORK_DIR = _path("SPRITE_WORK_DIR", os.path.join(PROJECT_ROOT, "source-assets", "sprite-pipeline"))
POSES_DIR = _path("SPRITE_POSES_DIR", os.path.join(WORK_DIR, "_poses"))
OUTPUT_DIR = _path("SPRITE_OUTPUT_DIR", os.path.join(WORK_DIR, "sheets"))
GAME_ASSETS_DIR = _path("SPRITE_GAME_ASSETS", os.path.join(PROJECT_ROOT, "public", "assets"))
FINAL_DIR = _path("SPRITE_FINAL_DIR", os.path.join(PROJECT_ROOT, "source-assets", "animation", "final"))
PROMPTS_DIR = _path("SPRITE_PROMPTS_DIR", os.path.join(PIPELINE_DIR, "prompts"))
MANIFEST = _path("SPRITE_MANIFEST", os.path.join(PIPELINE_DIR, "manifest.json"))
ID_PREFIX = os.environ.get("SPRITE_ID_PREFIX", "p4")
DEFAULT_HEIGHT = int(os.environ.get("SPRITE_DEFAULT_HEIGHT", "380"))
DREAMINA_PROJECT_ID = os.environ.get("DREAMINA_PROJECT_ID", "")
ATOM_HOST = os.environ.get("ATOM_HOST", "atom")
STUDIO_CONTAINER = os.environ.get("STUDIO_CONTAINER", "tostai-sprite-studio")

# queue / plan files used by the batch runners
ANIM_QUEUE = os.path.join(WORK_DIR, "anim_queue.json")
POSE_JOBS = os.path.join(WORK_DIR, "pose_jobs.json")
PROCESS_PLAN = os.path.join(WORK_DIR, "process_plan.json")


def char_dir(char):
    return os.path.join(WORK_DIR, char)


def clips_dir(char):
    return os.path.join(WORK_DIR, char, "clips")


def rel(path):
    """Project-relative path for manifest entries."""
    return os.path.relpath(path, PROJECT_ROOT)


@contextlib.contextmanager
def manifest_lock():
    """Load manifest.json under an exclusive lock, yield it, write it back atomically.

    Kick or Treat lost entries when parallel gen.py / maestro.py / studio.py runs each
    loaded the manifest, worked for minutes, then saved their stale copy over the others'
    writes. Do the slow work first, then take this lock only around the read-modify-write.
    """
    os.makedirs(os.path.dirname(MANIFEST), exist_ok=True)
    with open(MANIFEST + ".lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if os.path.exists(MANIFEST):
            with open(MANIFEST) as f:
                m = json.load(f)
        else:
            m = {"tool": "sprite-pipeline", "assets": {}}
        m.setdefault("assets", {})
        yield m
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(MANIFEST), suffix=".tmp")
        with os.fdopen(fd, "w") as f:
            json.dump(m, f, indent=2)
            f.write("\n")
        os.replace(tmp, MANIFEST)


def load_manifest():
    if os.path.exists(MANIFEST):
        with open(MANIFEST) as f:
            return json.load(f)
    return {"tool": "sprite-pipeline", "assets": {}}
