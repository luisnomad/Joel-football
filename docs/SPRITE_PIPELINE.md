# Sprite pipeline (video-to-sprite, ported from Kick or Treat)

Optional reading: use it only when re-authoring character animation frames with
generated video. Identity, privacy, and release rules in
[the character workflow](characters/WORKFLOW.md),
[project contract](characters/PROJECT_CONTRACT.md), and
[image-generation contract](characters/IMAGE_GENERATION.md) still apply and win on
conflict. Tooling lives in [`tools/sprite-pipeline/`](../tools/sprite-pipeline/).

Written 2026-10-08 from the working pipeline in the sibling repository
`/Volumes/SSD_Storage2TB/Users/luisnomad/Projects/kickortreat` (`pipeline/`).
Nothing has been generated for Joel Football with it yet. Service facts below were
verified in Kick or Treat from 2026-10-02 to 2026-10-07; re-check them before a run.

## 1. Goal

Replace the character frames that "don't look too good" with frames cut from one
continuous, generated animation per action. Every frame of a character then shares
one drawing, one scale, and one palette. Keep gameplay, physics, and the runtime atlas
format unchanged unless the owner approves the larger option in §9.

## 2. Current sprite system (as of commit 4c2b0f0)

### View and camera

Side-view arcade football on a fixed 1280×720 logical stage. There is no scrolling
camera. The pitch ground line is at `y=636`. The goals are side-profile SVGs at both
ends. Two fighters face each other. Art is mirrored with `flipX` when a fighter faces
away from its `nativeFacing`. Tablets are the primary target, with phones in the
compact layout.

### Characters

The catalog in `src/game/content/characters.js` has 8 entries, in this order: `joel`,
`bob`, `lucia`, `luna`, `juan`, `dad`, `mum`, `juanjo`. Joel and the family members are
photo-derived likenesses of real people and need guardian or person approval. Bob is
fictional and is the default opponent. `player-nova-sheet-v2.webp` is a retained
legacy sheet that the catalog does not use.

| id | runtime sheet | nativeFacing | visualScale | special |
| --- | --- | :---: | :---: | --- |
| joel | `player-joel-sheet-v1.webp` | 1 | 1 | title character, child |
| bob | `player-bob-sheet-v2.webp` | -1 | 1 | fictional; legacy frames 0-5 + generated 6-11 |
| lucia | `player-lucia-sheet-v2.webp` | -1 | 1 | prebuilt; not in the current builder |
| luna | `player-luna-sheet-v2.webp` | -1 | 1 | prebuilt; not in the current builder |
| juan | `player-juan-sheet-v3.webp` | 1 | 1 | contact-sheet source |
| dad | `player-dad-sheet-v1.webp` | 1 | 1.2 | idle 405 px, `dad-large` collider, `frameScales` hack |
| mum | `player-mum-sheet-v1.webp` | 1 | 1.2 | `mum-large` collider, per-frame packing scales + `frameScales` hack |
| juanjo | `player-juanjo-sheet-v1.webp` | 1 | 1 | contact-sheet source |

Each character also has `public/assets/player-<id>-portrait.png` (512×512). The portrait
is used by the selectors, and Disc Hockey turns it into the pusher engraving.

### Format and geometry

These values are locked by tests: `test/pure.test.js` "enhanced character animation"
and `test/v2.test.js` "opponent selection".

- One **1280×1440 lossless WebP** per character, made of **4 columns × 3 rows of 320×480**
  cells. The lossless PNG master lives in `source-assets/animation/final/`.
- **Runtime frame order** (`CHARACTER_FRAMES` in `src/game/pure/characterAnimation.js`):

  | cell | 0 | 1 | 2 | 3 | 4 | 5 |
  | --- | --- | --- | --- | --- | --- | --- |
  | pose | idle | legacyRun | jump | legacyKick (chilena) | dash | stun |
  | **cell** | **6** | **7** | **8** | **9** | **10** | **11** |
  | pose | runContactA | runPassing | runContactB | kickAnticipation | kickContact | kickRecovery |

- **Ground anchor:** the visible alpha bottom is at `y=418` in every cell. The builder
  grounds all 12 cells, including jump and chilena, and the engine moves the sprite.
  Each cell keeps at least **8 px** of transparent margin left and right.
- **Idle height:** 380 px (Dad 405). The collision audit requires the idle alpha top
  to be within 4 logical px of the fixed head collider, so **the idle height is
  effectively locked**.
- **Display size:** Football draws a cell at 186.67×280 (×`visualScale`), which is
  0.583× of the source. Kickfall draws it at 84×126, using the same atlas and anchor.
- **Loading:** `this.load.spritesheet(sheetTexture, sheetAsset, { frameWidth: 320, frameHeight: 480 })`
  in `BootScene.js` and `MatchLoadingScene.js` (lazy, lineup only), and in `KickfallScene.js`.
  Portraits are loaded with `load.image`.
- **Animation is code-driven, not Phaser animations.** `Fighter.updatePose()` picks a
  frame number:
  - Stun, chilena (frame 3, rotated around the torso), and dash each hold one frame.
  - The kick runs on a 0.32 s visual timeline (`kickVisualAt`): anticipation from
    0 to 0.05 s, contact from 0.05 to 0.16 s, and recovery from 0.16 to 0.32 s.
  - Airborne uses the jump frame.
  - The run is distance-driven (`RUN_FRAME_DISTANCE = 82` px per phase, about 15
    phases/s at top speed). The 4-phase sequence is A, passing, B, passing.
  - Idle is one still. Breathing exists but is disabled (`IDLE_BREATH_ENABLED = false`).
  - Procedural squash, stretch, lean, and wobble are layered on a visual-only mirror
    sprite (`secondaryMotionAt`, `CharacterVisualRig.js`). The Matter body never changes.
- **Builder:** `scripts/build-character-animation-atlases.py`. It splits a generated
  4×3 pose sheet (or legacy + selected frames) and resizes each frame to a height
  (idle 380, jump 350, max 380). If a frame is wider than 304 px, the builder shrinks
  it to fit. Audits live in `.agents/skills/create-game-character/scripts/`.

### Why it "doesn't look too good" (measured 2026-10-08)

1. **Every frame is a separate still, not one motion.** The 12 poses come from one
   generated contact sheet (or from frames picked by hand), each drawn independently.
   Head size, face, and line weight drift from pose to pose. The run has only 3
   drawings and the kick has 3. Idle, jump, dash, and stun are single stills. The
   result is choppy, popping motion that procedural squash can only partly hide.
2. **Scale pops.** The builder normalises each frame's *height*, and its margin
   enforcer shrinks any pose wider than 304 px. Measured frame widths of exactly 304
   px: Dad 5 frames, Juanjo 3, Juan 1. Their heads shrink in those frames. The game
   then compensates at display time with `frameScales` for Dad
   (`{2: 0.92, 3: 1.12, 9: 1.1, 10: 1.15, 11: 1.18}`) and Mum. Mum's builder entry
   also has 11 hand-tuned packing scales.
3. **Mixed styles in one match.** Bob (and Lucia, Luna, and Nova) use a clean vector
   cel style with bold contours. Joel, Dad, Mum, Juan, and Juanjo use a softly
   painted, thin-line look. Each atlas has 110k-195k unique colours.
4. **Not a true side view.** Most poses are three-quarter views, and `nativeFacing` is
   mixed (+1 or -1). Mirroring a three-quarter drawing flips asymmetric features, and
   run/kick poses read inconsistently against a strict side-on camera.
5. **Proportions.** Heads are about one quarter to one fifth of the body height. The
   genre (and the head-shaped collider) suggests bigger heads, and the head also
   reads small at the 0.58× display scale.
6. **Soft, re-sampled edges.** The chroma key leaves 51k-90k semi-transparent pixels
   per atlas. The frames are then LANCZOS-resampled two or three times (source to
   cell, to frame height, to margin fit) and once more at runtime, which gives
   slightly mushy edges.

## 3. The technique

> An approved reference still feeds an image-to-video clip of one action on a flat
> chroma backdrop. The clip becomes a best loop (or a one-shot window). TostAI Sprite
> Studio mattes it (VRMBG, or a colour-key mask). The result is snapped to one locked
> palette, binary alpha, and one character-wide scale, then written as a sheet plus a
> JSON sidecar (pivot, fps, hit frame). For hits and other poses where video invents
> things, Qwen 2.1 edits key poses of the same reference, and `pose_sheet.py` holds
> them in a keyframe clip that goes through the same pipeline, with a measured scale
> correction. For Joel Football, `pack_atlas.py` then picks the 12 runtime frames.

```text
approved identity anchor (existing, source-assets/characters/<id>-v<ver>/identity-anchor.png)
  │ GPT Image 2.5 i2i (Dreamina, gen.py)            → side-view reference still, flat chroma
  │   owner approves it (likeness gate)
  ├─ maestro.py upload → Minimax H3 i2v (Maestro on ATOM, run_anim_queue.py) → idle/run/kick clips
  │     make_action.py: find_loop | one-shot window → TostAI VRMBG matte → sheet_snap (scale, palette, alpha)
  │                     → <OUTPUT_DIR>/<char>/<action>.png + .json (+ preview GIF)
  ├─ Qwen 2.1 edit (Maestro, run_pose_jobs.py) → jump / chilena / dash / stun key poses
  │     pose_sheet.py: measure scale, align feet, hold → keyframes.py clip → make_action --key
  └─ clean_specks.py / retime_sheet.py → pack_atlas.py PLAN.json → 1280×1440 atlas + portrait
        → audits + in-game review → (approved) install into source-assets/animation/final + public/assets
```

### Step by step for one character

All paths are relative to the head-soccer root. Set this once:

```bash
PY=/Volumes/SSD_Storage2TB/Users/luisnomad/Projects/kickortreat/.venv/bin/python   # has every dependency
SP=tools/sprite-pipeline
```

[AGENTS.md](../AGENTS.md) asks for an `rtk` prefix on shell commands. Use
`rtk proxy $PY …` when RTK does not support a command. Never build an argument from
`$(cat …)` (see §8).

1. **Set up the character work folder.**
   - `mkdir -p source-assets/sprite-pipeline/<id>`
   - Copy `$SP/examples/plans/char.json.example` to `source-assets/sprite-pipeline/<id>/char.json`.
     Set `height` to 380 (Dad 405), `bg` to `green` (or `magenta`, see §8),
     `color_space` to `24bit`, and `colors` to 48-64.
2. **Make the side-view reference still** with GPT Image 2.5 from the *approved anchor*.
   Never use private photos (see §10).
   - Copy `$SP/prompts/stills/TEMPLATE_reference_v1.txt` to `$SP/prompts/stills/<id>_ref_v1.txt`
     and fill in the placeholders.
   - Upload the anchor: `dreamina-canvas resource upload --file source-assets/characters/<id>-v1/identity-anchor.png --format json`.
     This prints a resource UUID.
   - Run:

     ```bash
     $PY $SP/gen.py draft --id <id>_ref --prompt-file $SP/prompts/stills/<id>_ref_v1.txt \
         --out source-assets/sprite-pipeline/<id>/ref --ratio 1:1 --res 1K --ref res:<UUID>
     $PY $SP/gen.py quote --id <id>_ref
     $PY $SP/gen.py run --id <id>_ref --ceiling 3
     ```

     `quote` is free. `run` costs 3 credits per 1K image.
   - Repeat with `_v2` prompts until the image is right.
   - **Stop for owner and guardian approval of the likeness.**
3. **Upload the approved still to Maestro.** Start the tunnel first (§4):
   `$PY $SP/maestro.py upload source-assets/sprite-pipeline/<id>/ref/<id>_ref_1.png`.
   Copy the printed server path; it looks like `/home/luisnomad/apps/maestro-eval/app/uploads/xxxx.png`.
4. **Generate the clips** (H3 runs on the ATOM, so it uses GPU time, not credits).
   - Write `$SP/prompts/anim/<id>_{idle,run,kick}_v1.txt` from the templates (§7).
   - Write `source-assets/sprite-pipeline/anim_queue.json` from the example, with the
     upload path as `start`.
   - Run `$PY $SP/run_anim_queue.py`. It writes one clip at a time to
     `source-assets/sprite-pipeline/<id>/clips/p4_<id>_<action>_h3_1.mp4` and skips
     clips that already exist. A single clip can also be made with
     `$PY $SP/maestro.py run --id p4_<id>_run_h3 --body $SP/maestro_templates/h3_fused_i2v.json --prompt-file … --out … --set image_start=<path> --set resolution=704x704`.
   - **Watch each clip before processing it** (§9).
5. **Clip to sheet.** Start the Studio tunnel too.
   - Process the **idle first**: the first processed clip sets `ref_height`, and idle
     is the standing reference. Then check `ref_height` (§8).
   - Commands:

     ```bash
     $PY $SP/make_action.py --char <id> --action idle --clip <idle clip> --mode loop --keep 8 --fps 8
     $PY $SP/make_action.py --char <id> --action run  --clip <run clip>  --mode loop --keep 8 --fps 12 --min 8 --max 24
     $PY $SP/make_action.py --char <id> --action kick --clip <kick clip> --mode once --keep 9 --fps 14 --hit auto
     ```

     `process_clips.py` does the same for a `process_plan.json`.
   - Outputs:
     - `source-assets/sprite-pipeline/sheets/<id>/<action>.png` and `.json`
     - a preview GIF in `source-assets/sprite-pipeline/<id>/<action>/`
     - `palette.json`, which is saved on the first action and locked for the rest
6. **Key poses that video gets wrong** (jump, chilena, dash, stun).
   - Write `$SP/prompts/poses/<id>_{jump,chilena,dash,stun}_v1.txt` and `pose_jobs.json`.
     Each job's `ref` is the Maestro upload path.
   - Run `$PY $SP/run_pose_jobs.py`. It writes Qwen outputs to
     `source-assets/sprite-pipeline/_poses/p4_pose_<id>_<pose>_1.png`.
   - Measure each pose's shrink (§8), then build one-cell or few-cell sheets:

     ```bash
     $PY $SP/pose_sheet.py --char <id> --ref source-assets/sprite-pipeline/<id>/ref/<id>_ref_1.png \
         --action stun --prefix <id> --poses stun:1:1.15 --fps 8 --headroom 1.3
     ```

     Repeat for jump, chilena, and dash. The `:1.15` is the measured scale correction.
7. **Clean and retime.**
   - `$PY $SP/tools/clean_specks.py <sheet>.png <sheet>.json` removes confetti and sparks.
   - `$PY $SP/tools/retime_sheet.py <sheet>.json --drop-start N --fps F` adjusts timing
     (it prints time-to-hit).
   - To review: `$PY $SP/tools/view_sheets.py /tmp/review.png <sheet>.png … --x=2`.
8. **Pack the runtime atlas.**
   - Copy `$SP/examples/plans/atlas_plan.example.json` to
     `source-assets/sprite-pipeline/<id>/atlas_plan.json`. Choose the 12 cells from the
     GIF previews (§10 explains which).
   - Run `$PY $SP/pack_atlas.py source-assets/sprite-pipeline/<id>/atlas_plan.json --review /tmp/<id>-atlas.png`.
     It writes to `source-assets/sprite-pipeline/<id>/atlas/` (staging). It validates
     ground `y=418` and the 8 px margins. It **fails instead of shrinking** a frame
     that is too wide (§10).
9. **Audit and review.** Run the five `create-game-character` audits from
   [WORKFLOW.md §5](characters/WORKFLOW.md) against the staged atlas, then the in-game
   checks in §9.
10. **Install, only after approval.** Add `--out-png` and `--out-webp` (with a **new**
    version suffix) and `--portrait`. Then update the catalog and fixtures (§10).

## 4. Tools and services

### Dreamina CLI: GPT Image 2.5 (new images, cloud, costs credits)

- Binary: `dreamina-canvas` (`~/.local/bin`). The binary was v1.0.1 when it was
  verified. The account was signed in, and the credentials were reported to expire
  **2026-11-23** (`dreamina-canvas auth --help`).
- Models (from `dreamina-canvas model list` and `schema`):

  | model | modes | ratio (required) | resolution (required) | count | refs |
  | --- | --- | --- | --- | --- | --- |
  | `dreamina_gpt_image_2_5_flare` (**default**) | t2i, i2i | 21:9 16:9 3:2 4:3 1:1 3:4 2:3 9:16 | 1K/2K/4K | 1 | 1-16 |
  | `dreamina_gpt_image_2_5_sunburst` | same | same | same | 1 | 1-16 |
  | `gpt_image_2` (fallback) | t2i, i2i | same | same | 1-4 | 1-6 |

- Cost is **3 credits per 1K image**, measured for both 2.5 variants. A 1:1 1K output is
  1328×1328 RGB. There is **no seed**: reproducibility comes from the logged prompt
  plus the references.
- Node refs:
  - `--ref res:<UUID>` uses a file uploaded with `resource upload --file F`.
  - `--ref node:node_<id>` uses an existing canvas node and keeps lineage edges.
- Flow (wrapped by `gen.py`):
  1. `node create|edit image` is a free draft.
  2. `node quote` returns `maxCredits`.
  3. `node confirm --credit-ceiling C` returns a token.
  4. `node run --credit-token T` starts the job.
  5. `operation wait`, then `node show`, then `resource download`.
- Gotcha: `node edit image --run` fails (`cli.invalid_command`). Use the confirm and
  run flow instead.
- Upscale only after approval: `node upscale image --node-id N --mode pro --resolution 2K --detail 1..100`.
- **Canvas.** The CLI's *current* canvas is still **Kick or Treat**
  (`6b52c90a-b118-48a6-a17e-648045bcb1e3`). `gen.py` passes `--project-id $DREAMINA_PROJECT_ID`
  on `node create` when it is set. However, `node edit/quote/confirm/run/show` and
  `resource upload` have **no** `--project-id` flag. It is unverified whether they
  resolve a node that lives on a non-current canvas. Test with a free `quote` first.
  Do not run `canvas create --use` without the owner (§10): it switches the canvas
  for the Kick or Treat project too.

### ATOM (GB10, aarch64; `ssh atom`)

**Maestro** is the owner's Wan2GP-based Pinokio app (fork github.com/luisnomad/Maestro).
It lives at `~/apps/maestro-eval` with venv `~/venvs/maestro-eval-py312`, serves
`127.0.0.1:17860`, and has its OpenAPI spec at `/openapi.json`.

- Start or restart it when it is down:

  ```bash
  ssh atom 'cd ~/apps/maestro-eval/app; SERVER_PORT=17860 SERVER_NAME=127.0.0.1 nohup ~/venvs/maestro-eval-py312/bin/python launch.py > ~/apps/maestro-eval/logs/maestro-overnight.log 2>&1 &'
  ```

  It is ready in about 30 s.
- Tunnel: `ssh -fN -o ServerAliveInterval=30 -L 17860:127.0.0.1:17860 atom`.
  `maestro.py` reads `MAESTRO_API`, which defaults to `http://127.0.0.1:17860/api/v1`.
- REST:
  - `POST /api/v1/upload` (multipart) returns the server path.
  - `POST /api/v1/generate` takes a JSON body and returns `job_id`.
  - `GET /api/v1/status/{id}` and `GET /api/v1/file/{name}`.
  - `maestro.py run` loads a **template** from `maestro_templates/`, sets `prompt` from
    `--prompt-file`, applies `--set key=value` overrides (JSON-coerced), then polls,
    downloads, and logs to the manifest. It refuses `image_start`, `image_end`,
    `image_guide`, or `image_refs` values that are not clean absolute paths. This
    guard exists because of RTK decoration.
- Templates:
  - `h3_fused_i2v.json` uses `minimax_h3_fused_turbo`, 4 steps, first-frame i2v.
    Override `image_start=<path>` and `resolution=704x704`.
  - `qwen21_edit.json` uses `qwen_image_21_7B` edit. Override
    `image_refs=["<path>"]` and `resolution=1024x1024`.
  - `qwen21_t2i.json` uses Qwen t2i. It is not used for new characters (GPT 2.5 makes
    new images).
- Timings measured on 2026-10-02:
  - Qwen 2.1 at 1024², 40 steps: about 90 s.
  - H3 at 704²: about 3.5 min. It asked for 49 frames and got about 122 frames
    (5.1 s at 24 fps). Trimming is automatic in `make_action.py`.
- **GPU competitors** are systemd user services: `llama-qwen36-fast.service` (Qwen 35B
  llama.cpp, about 21 GB) and `hermes-voice-atom.service`.
  - Stop them with `ssh atom systemctl --user stop <svc>` **only with the owner's
    permission for that occasion**.
  - Report what you stopped so it can be restarted with `systemctl --user start <svc>`.

**TostAI Sprite Sheet Studio** runs as a Docker container on the ATOM. It is served on
`127.0.0.1:8765`, with the editor at `/editor`.

- Image: `tostai-sprite-studio:arm64`, built locally in `~/apps/tostai-sprite-studio`.
  The upstream image is amd64-only. The arm64 build needs a
  `sed -i s/x86_64-unknown-linux-musl/aarch64-unknown-linux-musl/g Dockerfile` patch.
  VRMBG-3.0 is a gated Hugging Face model; access was granted.
- Restart: `ssh atom docker restart tostai-sprite-studio`. If the container is gone, run:

  ```bash
  ssh atom docker run -d --name tostai-sprite-studio --device nvidia.com/gpu=all -p 127.0.0.1:8765:8765 tostai-sprite-studio:arm64
  ```

  `tostai-sprite-studio:arm64-nomatte` is a fallback image without VRMBG.
- Tunnel: `ssh -fN -L 8765:127.0.0.1:8765 atom`. `studio.py` reads `STUDIO_API`, which
  defaults to `http://127.0.0.1:8765`.
- API:
  - `POST /api/upload?name=clip.mp4` (raw body).
  - `POST /api/run` with a cfg from `studio_templates/`, then `GET /api/job/{id}`.
  - `studio.py` copies the run folder out with
    `ssh atom docker exec tostai-sprite-studio sh -c '…'`. The single quotes keep `$(…)`
    inside the container. A version with the wrong quoting once copied the ATOM home
    dotfiles.
- Templates:
  - `vrmbg_loop.json` (**default for video**): VRMBG matte, then key `#00DD01`
    (`key_tol` 64), then despill. Cells are cropped to the subject with a bottom-centre
    anchor.
  - `mask_loop.json`: uses our own `green_mask.py` mask video (**use it for held-pose
    keyframe clips**).
  - `keyonly_loop.json`: **does nothing on its own**, because the key is only a matte
    repair step. Never use it alone.
- Verify flags: I2 and I4 assume a black backdrop, so I4 "subject intact" always fails
  on chroma clips. Judge by I1, I3, I5, and your own eyes.

**ElevenLabs and Codex** are not relevant to sprites. Kick or Treat generates sound
effects through the bundled Codex CLI and the ElevenLabs hosted MCP (account login,
no API key); see its memory note if sound work comes up.

### Local (Mac)

- **Python:** the Kick or Treat venv has numpy 2.5.3, pillow 12.3.0, opencv-python
  5.0.0, and scipy 1.18.1. To make a separate one, run
  `python3 -m venv <dir> && <dir>/bin/pip install -r tools/sprite-pipeline/requirements.txt`.
- **ffmpeg:** `/opt/homebrew/bin/ffmpeg`, used by `find_loop`, `keyframes`, and `make_action`.

## 5. Scripts (`tools/sprite-pipeline/`)

### Paths and configuration

Every script imports `config.py`. Paths are configurable with environment variables
whose defaults suit Joel Football:

| variable | default | holds |
| --- | --- | --- |
| `SPRITE_PROJECT_ROOT` | repo root | base for relative `--out` and manifest paths |
| `SPRITE_WORK_DIR` | `source-assets/sprite-pipeline` | `<char>/char.json`, `palette.json`, `clips/`, `<action>/` work, `ref/`, `atlas/` staging; queue and plan JSONs |
| `SPRITE_POSES_DIR` | `<WORK_DIR>/_poses` | Qwen pose edits and aligned stills |
| `SPRITE_OUTPUT_DIR` | `<WORK_DIR>/sheets` | snapped per-action sheets and sidecars (**not** `public/`) |
| `SPRITE_GAME_ASSETS` | `public/assets` | runtime art (only touched by explicit `pack_atlas.py --out-*`) |
| `SPRITE_FINAL_DIR` | `source-assets/animation/final` | lossless atlas masters |
| `SPRITE_PROMPTS_DIR` | `tools/sprite-pipeline/prompts` | `stills/`, `anim/`, `poses/` |
| `SPRITE_MANIFEST` | `tools/sprite-pipeline/manifest.json` | generation log (locked read-modify-write) |
| `SPRITE_ID_PREFIX` | `p4` | id prefix for clips and poses (the Kick or Treat phase tag, kept for compatibility) |
| `SPRITE_DEFAULT_HEIGHT` | `380` | `height` when `char.json` has none |
| `DREAMINA_PROJECT_ID` | unset | canvas for new Dreamina nodes |
| `ATOM_HOST` / `STUDIO_CONTAINER` | `atom` / `tostai-sprite-studio` | Studio output copy |
| `MAESTRO_API` / `STUDIO_API` | tunnelled localhost | REST endpoints |

### Script reference

| script | usage | notes |
| --- | --- | --- |
| `gen.py` | `draft --id ID --prompt-file F --out DIR [--model M] [--ratio 1:1] [--res 1K] [--count N] [--ref res:UUID\|node:ID …] [--node-id N]`; `quote --id`; `run --id --ceiling N`; `fetch --id` | Dreamina wrapper. Reads the prompt in Python and asserts it round-trips. A second `draft` with the same id edits the node. Outputs are `DIR/<id>_<n>.png`. |
| `maestro.py` | `upload FILE`; `run --id ID --body TEMPLATE --prompt-file P --out DIR [--set k=v …]` | Qwen and H3 on the ATOM. Outputs are `DIR/<id>_<n>.<ext>`. |
| `studio.py` | `run --id ID --video CLIP --cfg CFG --out DIR [--mask MASK] [--set k=v …]` | TostAI. Called by `make_action.py`, rarely by hand. |
| `make_action.py` | `--char C --action A --clip CLIP --mode loop\|once [--keep N] [--fps F] [--hit auto\|N] [--min/--max] [--thresh] [--key] [--ref-scale] [--whole] [--game-id]` | Full clip-to-sheet run. Loop mode uses `find_loop`. Once mode cuts the first action window (the hit is the widest frame). |
| `pose_sheet.py` | `--char C --ref REF --action A --poses name:hold[:scale],… [--prefix P] [--mode once\|loop] [--fps F] [--hit N] [--headroom H]` | Key poses to a sheet. Uses the colour-key mask, not VRMBG. `ref` as a pose name means the reference itself. |
| `run_anim_queue.py` | `[--queue F] [--resolution 704x704]` | H3 batch from `anim_queue.json`. Skips clips that exist. |
| `run_pose_jobs.py` | `[--jobs F]` | Qwen batch from `pose_jobs.json`. Prompt is `prompts/poses/<id>_v1.txt`. |
| `process_clips.py` | `[--once] [--plan F]` | Runs `make_action` for every finished clip in `process_plan.json`. Can run next to the queue. |
| `pack_atlas.py` | `PLAN.json [--out-png] [--out-webp] [--portrait] [--review]` | **New adapter** for the Joel Football 4×3 atlas and portrait. Validates the contract. |
| `tools/sheet_snap.py` | `SIDECAR OUT --height H [--ref-height R] [--colors N] [--palette-json P \| --save-palette P] [--pick i,j \| --keep N] [--fps] [--play] [--hit-frame] [--action] [--color-space 9bit\|24bit]` | Box-downsamples by one factor, then applies the palette and binary alpha. Writes the pivot, fps, `play_mode`, and `hit_frame` to the sidecar. |
| `tools/find_loop.py` | `CLIP [--min 8] [--max 40] [--skip 4] [--trim OUT] [--bg green\|magenta]` | Best seamless (start, period). Prints drift and the per-frame feet row. |
| `tools/green_mask.py` | `IN OUT_mask [--margin 40] [--bg …] [--report]` | Mask video (largest component, holes filled). |
| `tools/key_green.py` | `IN OUT [--margin 40] [--keep-largest] [--min-area 64]` | Keys a green still to binary alpha with despill (green only). |
| `tools/clean_specks.py` | `SHEET SIDECAR [--near 3] [--min-frac 0.04]` | Works in place. Keeps the main body and touching or large parts. |
| `tools/retime_sheet.py` | `SIDECAR [--drop-start N] [--drop-end N] [--fps F]` | Works in place and keeps `hit_frame` consistent. |
| `tools/keyframes.py` | `OUT.mp4 SIZE img:hold …` | Held-still clip at 24 fps. |
| `tools/make_left_sheet.py` | `SIDECAR [--text-color red\|yellow\|white] [--group N]` | Mirrors cells but un-mirrors text. **Not needed here** (see §8). |
| `tools/view_sheets.py` | `OUT.png SHEET … [--x=2]` | Nearest-neighbour enlargement on a dark background. |
| `tools/contact_sheet.py` | `OUT --row "Label" a.png b.png … [--cols x,y] [--w 640]` | Labelled comparison board. |
| `tools/pixel_snap.py` | `IN OUT --width W [--colors N] [--preview-scale S]` | Still image to grid, 9-bit, binary alpha (pixel-art only). |
| `tools/seamless.py` | `IN OUT [--overlap 48] [--preview]` | Tiling strips (backgrounds; not for characters). |

Changes from the Kick or Treat originals:

- Paths come from `config.py`.
- The manifest uses a locked read-modify-write.
- `sheet_snap --color-space` was added, and its default is unchanged.
- `sheet_snap` now casts `ref` to `int`. Without the cast, omitting `--ref-height`
  crashed the JSON write.
- `char.json` `color_space` is passed through.
- The batch runners gained `--help` and file options.
- `gen.py` gained `fetch` docs and `DREAMINA_PROJECT_ID`.
- `pack_atlas.py` is new.

The examples are in `examples/plans/` (`char.json`, the queue and plan formats, and an
atlas plan). `examples/kickortreat/` has a few original prompts, kept for reference
only.

## 6. `char.json`, palette and sidecar conventions

`source-assets/sprite-pipeline/<id>/char.json`:

```json
{"height": 380, "colors": 48, "bg": "green", "color_space": "24bit", "ref_height": 612}
```

- `height`: target subject height in output px for the reference pose. Use 380 here
  (Dad 405) so the idle fills the locked idle height.
- `ref_height`: source px of the standing subject. The first processed clip writes it
  (the 90th percentile of keyed heights), and every later action **reuses** it, so all
  actions share one scale. Verify it (§8).
- `colors`: the locked palette size. Kick or Treat used 24 for normal characters and
  40 for bosses with many materials. For the painted Joel Football look, use 48-64.
- `bg`: `green` or `magenta` (§8).
- `color_space`: `9bit` is the Mega Drive look and the default. `24bit` is recommended
  here: in the port test, a 9-bit, 24-colour snap of Joel's painted art posterised
  the skin, while 24-bit with 64 colours held up.

`palette.json` is `{"palette": ["#RRGGBB", …]}`. The first action writes it, and every
later action of the character is quantised to it.

**Check it against the reference before reuse.** Kick or Treat merged a green skin into
a beige apron at 28 colours.

The sheet sidecar (`<action>.json`) contains:

- `sheet`, `frame_width`, `frame_height`, `columns`, `rows`, `frame_count`;
- `fps`, `play_mode`, `anchor: bottom-center`;
- `pivot {x, y}`, the feet position in a cell;
- `animations`, `action`, `hit_frame` (one-shots);
- `pixel_snap {scale, ref_height, target_height, colors, colour_space, palette}`.

Time to hit is `hit_frame / fps`.

## 7. Prompt templates (Joel Football)

Templates live in `tools/sprite-pipeline/prompts/{stills,anim,poses}/TEMPLATE_*_v1.txt`.

To use one, copy it to `<id>_<action>_v1.txt` and replace these placeholders:

- `{CHAR}`: a short visual description, for example "The curly-haired boy in the teal
  V-neck jersey, coral shorts and cream boots".
- `{STYLE}`: the locked style phrase (§10 decision). A proposal:
  "clean 2D cartoon with bold dark outlines, flat colours and one soft shadow tone".
- `{BG}` and `{BG_NAME}`: "chroma-key green (#00FF00)" and "green", or
  "magenta (#FF00FF)" and "magenta".
- `{PROPORTIONS}`: the head rule (§10 decision). A proposal: "big head-soccer head
  about one third of the total height, compact body, short legs, big boots".

Prompt files are read verbatim. Never edit a prompt that produced an approved asset;
write `_v2` instead.

| action | tool | template | notes |
| --- | --- | --- | --- |
| reference | GPT 2.5 i2i from the approved anchor | `stills/TEMPLATE_reference` | strict side view facing right, one flat backdrop, 1:1 1K, full body with headroom |
| idle | H3 loop | `anim/TEMPLATE_idle` | bouncy ready stance, feet planted, one blink |
| run | H3 loop | `anim/TEMPLATE_run` | "runs in place … does not move forward" (never "treadmill") |
| kick | H3 one-shot | `anim/TEMPLATE_kick` | "exactly ONE powerful kick into empty air", then stands still |
| jump | H3 one-shot or Qwen pose | `anim/TEMPLATE_jump`, `poses/TEMPLATE_jump` | runtime uses one jump frame; a Qwen pose is cheaper |
| header | H3 one-shot | `anim/TEMPLATE_header` | needs a runtime slot (§10 option B) |
| celebrate | H3 loop | `anim/TEMPLATE_celebrate` | "no confetti, no trophy, no flags"; needs option B |
| hit / stun | Qwen pose | `poses/TEMPLATE_stun`, `poses/TEMPLATE_hit` | "invisible blow", no stars (add effects in engine) |
| chilena | Qwen pose | `poses/TEMPLATE_chilena` | horizontal body; the runtime rotates it |
| dash | Qwen pose | `poses/TEMPLATE_dash` | strong forward lean |
| kick contact fix | Qwen pose | `poses/TEMPLATE_kick_contact` | only if the H3 kick has no clean contact frame |
| backdrop swap | Qwen edit | `poses/TEMPLATE_backdrop_magenta` | for green-wearing characters, before H3 |

Rules every template already follows:

- Strict side view, facing RIGHT.
- "Exactly ONE character".
- A locked static camera, centred, with no travel.
- The whole body inside the frame, with space above the head.
- One flat uniform backdrop with "no floor, no shadow, no visual effects, no motion
  lines and no objects of any kind. Nothing under the feet."
- "The style, the big head, the outfit and the colours stay exactly the same in every
  frame".
- **The ball is never mentioned in video or pose prompts.** Not even "no ball", and
  not "football", which also cues a ball. The still template lists "no … ball" because
  GPT stills respect negatives; H3 does not.

## 8. Gotchas

- **Backdrop colour.**
  - Green-skinned or green-wearing characters go on **magenta**. Set `bg: magenta` in
    `char.json`. If the reference is already on green, convert it with
    `poses/TEMPLATE_backdrop_magenta` (Qwen).
  - `make_action` then keys `#CC00FF`: H3 and Qwen "magenta" lands around
    (190-215, 0, 255).
  - Teal, cyan and turquoise kits (Joel `#6ef4ff`-ish, Lucia, Juan) do not pass the
    green test (G must beat R **and** B by 40), so green is fine for them. Check every
    kit, sock and boot colour against the rule before choosing.
- **"treadmill".** Never write it. Kick or Treat's early walk and run prompts used it,
  and that is the lesson learned. Say "runs in place … does not move forward or
  backward".
- **"Exactly ONE"** (character, kick, jump). Without it, H3 repeats the action for the
  whole clip or adds a second person.
- **H3 invents things.**
  - It adds confetti, sparks, leaves, props, contact shadows, attackers, and
    projectiles in hit clips.
  - Write "no visual effects, no motion lines and no objects of any kind" and
    "invisible blow".
  - Run `clean_specks.py` on every sheet.
  - Make hits and other contact poses from **Qwen key poses**, not video.
  - Keep big gestures inside the frame, or they get cropped at the top.
- **H3 clip length.** It returns about 122 frames at 24 fps whatever you request.
  `find_loop` and the one-shot window trim it. The first about 4-6 frames "settle in"
  (`--skip`).
- **Qwen shrinks and reframes characters.** Feet move up 20-60 px at 1024, and the
  scale can drop to 0.7×.
  - Measure the linear scale against the reference: `sqrt(subject area / reference area)`
    for standing poses, or lying length vs standing height for lying poses.
  - Pass the correction as `name:hold:scale` in `pose_sheet.py`, with `--headroom` so
    upscaled poses are not clipped.
  - `pose_sheet.py` puts every pose's feet on the reference's ground row, including
    airborne poses, because the engine adds the height.
  - Qwen sometimes also changes the style. Retry, or fall back to GPT 2.5 i2i.
- **Pose sheets use the colour-key mask, not VRMBG.** VRMBG carries state between
  frames and leaks background blobs when held poses jump. `pose_sheet.py` passes
  `--key` automatically.
- **`ref_height` skew.**
  - It is measured once, from the first processed clip. Specks, contact shadows, or a
    raised arm inflate it, and then **every** action comes out too small.
  - Process idle first, and compare `ref_height` with the idle's real standing height
    (open the idle preview, or check that `pack_atlas.py` reports a 380 px idle).
  - If it is wrong, edit `char.json`, delete `palette.json` if needed, and re-run.
- **`_left` sheets.**
  - `make_left_sheet.py` exists so text (a STOP sign, a jersey number) still reads
    after mirroring.
  - Joel Football mirrors with `flipX` and its art has no text, so do not use it.
  - Its red "text" detector flagged Joel's coral shorts in 25 places during the port
    test.
  - If a future kit gets a number, add text-safe left sheets *and* runtime support,
    or keep numbers off the art.
- **RTK shell hook.**
  - `cat` is rewritten to `bat`, and `ls` and `grep` output is decorated or
    summarised.
  - `$(cat file)` puts ANSI codes and box borders into arguments, which once corrupted
    a paid Dreamina prompt. A `cat >> file <<EOF` heredoc wrote decorations into a doc.
  - Read files in Python, write files with an editor or Python, and use `/bin/ls` or
    `rtk proxy grep` when exact output matters. Check written docs for `\x1b`.
  - `gen.py` asserts the prompt round-trips, and `maestro.py` rejects decorated paths.
- **Parallel manifest race.**
  - Kick or Treat ran `gen.py` jobs, the H3 queue, and the clip processor at once.
  - Each loaded `manifest.json`, worked for minutes, then saved a stale copy over the
    others' entries.
  - Here every write goes through `config.manifest_lock()` (flock plus re-read plus
    atomic replace) after the slow work. Keep it that way. Separate queues can run in
    parallel; never two runs with the same id.
- **Small sprites.** Auto-snapping works at about 28 px and up. Under about 24 px
  (Kickfall at 84×126 is fine), it needs a dedicated small pass.
- **Seeds.** Dreamina has none. Maestro templates carry fixed seeds (`20261002`,
  `20261003`); change the seed with `--set seed=N` for a re-roll.
- **Studio quoting.** Keep the single-quoted `docker exec … sh -c '…'` in `studio.py`.
- **Maestro paths.** `image_start` and `image_refs` must be the server paths returned
  by `maestro.py upload`, not local paths.
- **Do not re-run an approved action casually.** `make_action` overwrites the sheet
  and preview of that action. The palette stays locked unless you delete
  `palette.json`.

## 9. QA checklist (per character)

- [ ] The reference still is the approved identity, in strict side view, facing right,
      on a flat backdrop, with full body and headroom, and approved by the owner and
      guardian.
- [ ] Each clip was watched in full: one character, no props or confetti, no floor or
      shadow, no travel, no camera move, and the identity is stable.
- [ ] `find_loop` seam diff is low, and drift is a few px over the loop. The feet row is
      stable in idle, and alternates in run.
- [ ] One-shot window: `hit_frame` is the real contact or extension frame. Time to hit
      matches the runtime (kick contact shows from 0.05 to 0.16 s; see the frame picks
      in §10).
- [ ] `ref_height` is plausible, and the idle measures 380 px (Dad 405) in the packed
      atlas.
- [ ] One `palette.json` per character. Skin, hair, and kit hues survive. Compare the
      first sheet with the reference side by side.
- [ ] `clean_specks.py` has been run, and no stray pixels remain at 2× view.
- [ ] Qwen poses were scale-corrected: head width matches idle within about 3%.
- [ ] Contact sheet: `contact_sheet.py` or `view_sheets.py` shows all 12 packed frames
      next to Joel, one adult, and the old atlas. Heads do not pulse between frames.
- [ ] `pack_atlas.py` validation passes (`y=418`, ≥8 px margins). No frame needed
      shrinking.
- [ ] The five `create-game-character` audits pass (atlas, package, roster parity,
      motion parity, collision coverage), and unrelated atlas hashes are unchanged.
- [ ] In game: run, kick, jump, dash, stun, and chilena on both sides. Kickfall at
      84×126. Selector portrait and Hockey engraving. Zero console errors.
- [ ] Full gate from [WORKFLOW.md §7](characters/WORKFLOW.md), plus final person or
      guardian approval in game.

## 10. Migration plan for Joel Football

### Keep the runtime format (option A, recommended first)

Produce exactly today's atlas with `pack_atlas.py`, so the game code does not change.

**Frame picks:**

| runtime cell | source | pick |
| --- | --- | --- |
| 0 idle | H3 idle loop | the most neutral frame (keep the whole loop for later) |
| 1 legacyRun | H3 run loop | any mid-stride frame (only non-enhanced sheets use it) |
| 2 jump | Qwen pose (or H3 jump peak) | top of jump, knees tucked |
| 3 chilena | Qwen pose | horizontal bicycle kick |
| 4 dash | Qwen pose | strong forward lean |
| 5 stun | Qwen pose | dizzy |
| 6 / 7 / 8 run A / passing / B | H3 run loop | contact A = widest stride, passing = narrowest (legs crossed), contact B = the opposite-leg widest |
| 9 / 10 / 11 kick | H3 kick one-shot | `hit_frame - 2` (wind-up), `hit_frame` (extended), `hit_frame + 3` (follow-through) |

**Width budget.** Idle is fixed at 380 px tall (Dad 405) because of the collider audit.
Every frame must then fit within 304 px of width. A full-extension side-view kick,
dash, or chilena with big heads can exceed that. `pack_atlas.py` refuses to shrink a
single frame, because per-frame shrinking caused the scale pops. To get a frame under
304 px:

1. Ask for more compact poses: a "knee-height kick" instead of a full split.
2. Lower the whole character's scale.

   This changes the idle height, which needs the collider audit and possibly a
   `collisionProfile` change. That is an owner decision.

**Catalog and fixture changes.** These are data changes, not engine changes, and they
follow WORKFLOW §6:

- Use new versioned filenames (`player-<id>-sheet-v<next>.webp`) and update
  `sheetAsset` in `characters.js`. Update `test/v2.test.js` expectations for Joel,
  Dad, and Mum, and the builder registration or archive notes.
- **Remove `frameScales`** for Dad and Mum. The new frames share one scale, and these
  factors would now *distort* them.
- **Re-measure `kickReach`**, the boot tip on the contact frame.
- Bump the service-worker cache version.
- Regenerate the portraits (`pack_atlas.py --portrait`). This changes the Disc Hockey
  engraving, so check it.
- Decide what happens to `scripts/build-character-animation-atlases.py` entries for
  migrated characters. Either retire them, or keep the builder as is and treat
  `pack_atlas.py` output as the master (recommended). Running the old builder would
  overwrite the new atlases from the old pose sheets.

### More frames (option B, after A proves the look; needs code)

The generated loops already contain 8-12 good frames per action. The runtime could
use them with:

- a 6×4 atlas of 320×480 cells (1920×1920, inside the 2048 guardrail in the archived
  spike doc);
- a frame-index table in `characterAnimation.js` (idle loop 4-6, run 6-8, kick 4-5,
  plus header 3 and celebrate 4-6);
- `RUN_VISUAL_SEQUENCE` and `kickVisualAt` updated;
- Fighter and Kickfall changes, and new tests.

Texture memory per character goes from about 7 MiB to about 14 MiB decoded. Two
fighters load at a time, so check this against PERFORMANCE_BENCHMARK.

### Order

1. **Bob, technical pilot.** He is fictional, so there is no likeness gate. He is the
   default opponent and is always on screen, and his clean cel style already suits H3
   and a locked palette. Prove the full loop end to end, through option A, the audits,
   and in-game review. Use the pilot to lock `{STYLE}`, `{PROPORTIONS}`, the colour
   count, and the width budget.
2. **Joel**, the title character. This needs guardian approval of the side-view
   reference. Branding art (splash, icons, menu cards) still shows old Joel; decide
   whether to update it.
3. **Lucia and Luna.** Their sources are not in the builder today. Confirm their
   identity anchors with the owner.
4. **Dad and Mum.** Remove `frameScales`, keep the 1.2 `visualScale`, keep Dad's
   405 px idle, and keep the explicit colliders.
5. **Juan and Juanjo.**

Rebuild one character per change set, and keep unrelated atlas hashes identical.

### Targets

All cells are 320×480. Idle is 380 px tall (Dad 405), on the ground line `y=418`, with
side margins of at least 8 px. Use binary alpha, 24-bit colour, and one locked palette
of 48-64 colours per character.

Clip settings:

| action | `--keep` | fps |
| --- | ---: | ---: |
| idle loop | 8 | 8 |
| run loop | 8 | 12 |
| kick one-shot | 9 | 14 |

Runtime fps does not matter in option A, because the game drives frames by distance
and timeline. The sheets keep the values for option B.

### Effort and credits (estimates)

**Dreamina:** 3 credits per 1K still.

- Style probe for the pilot: about 6-10 stills, or **20-30 credits**.
- Reference per character: 3-5 tries, or **9-15 credits**.
- Total for 8 characters: about **100-150 credits**.
- 2K or 4K upscales of approved stills cost extra. Quote them first.

**ATOM GPU:** no credits, but it competes with the owner's LLM services.

- Per character:
  - 3 H3 clips × 2-3 attempts × about 3.5 min, or about 20-30 min.
  - 4 Qwen poses × about 2 tries × 1.5 min, or about 12 min.
  - TostAI matting, a few minutes.
- Total for the roster: **about 6-8 GPU hours**, which suits an overnight run if the
  owner allows stopping the LLM services.

**Agent and owner time:**

- Pilot (Bob): 1.5-2 days, including style lock and option A integration.
- Each later character: about 0.5-1 day (selection, QA, audits, in-game review),
  plus approval round-trips.
- Full roster: about **6-9 working days**.
- Option B: about 2-3 more days of runtime and test work.

### Owner decisions needed

> **Update 2026-10-08:** the owner has answered all of these. See `docs/SPRITE_REDO_PLAN.md`, which takes precedence.


1. **Privacy and cloud use.** Dreamina is a CapCut/ByteDance cloud service. Previous
   Joel Football likenesses were made with OpenAI image generation.
   - Is it acceptable to upload the *approved derived anchors* of real family members,
     including a child, to Dreamina?
   - Private photos must never be uploaded; this plan never needs them.
   - If it is not acceptable, the reference step falls back to the existing OpenAI
     route, and only H3, Qwen, and TostAI (local on the ATOM) are reused.
2. **Style.**
   - Keep the soft painted look, or move the whole roster to the clean cel style
     (as Bob is drawn)? Clean cel survives H3, palette locking, and the 0.58×
     downscale better.
   - Strict side view instead of three-quarter view?
   - Bigger heads, and how big? A bigger head than the fixed collider could mislead
     ball contact, so the collision audit must pass.
3. **Width budget versus idle height** (see the width budget above). Accept more
   compact poses, or allow a scale or collider change.
4. **Option B** (more frames, header and celebrate) and its code and tests.
5. **Dreamina canvas.** Reuse the Kick or Treat canvas, or create a Joel Football
   canvas. Switching the *current* canvas affects the other project's runs.
6. **ATOM GPU time.** Permission to stop `llama-qwen36-fast` and `hermes-voice-atom`
   during runs.
7. **Where binaries live.** `source-assets/` is tracked in git (122 MB today). Clips
   (`source-assets/sprite-pipeline/*/clips/*.mp4`) and Studio run folders are large.
   - Commit them, ignore them, or back them up to the NAS like Kick or Treat does?
   - This port did not change `.gitignore`.
8. **Baked surfaces.** Menu cards, splash, icons, and store art still show the old
   look. Decide whether to redo them, and when.
