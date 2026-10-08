# Roster sprite batch: resume note (paused 2026-10-08)

Paused on the owner's request so another session can use the ATOM (Maestro). **Do
not resume ATOM work (Sprite Studio or Maestro) until told.**

Recipe: `docs/SPRITE_PILOT_BOB.md` §2. Layout: roster-v2, the same cell order as Bob
(§5). Everything below is **staged only**: nothing is installed into `public/assets`
or `source-assets/animation/final`, and nothing is committed.

## State at pause

- **ATOM:** nothing of the roster fork is running or queued on Maestro or Studio.
  All 21 local H3 clips (idle, kick and celebrate × 7) finished before the pause.
- **PixVerse (cloud):** batch complete. Cloud-H3 runs (768p, 1:1, 5 s) and the 7 GPT
  Image poses exist for all 7 characters.
  - Roster spend in the manifest: **2,030 credits** (cap 2,600).
  - The account balance fell 3,996 → 1,939 (2,057). That is 27 credits more than the
    manifest, spent by something outside this batch.
- **Helper:** `tools/sprite-pipeline/tools/roster_process.py STEP CHAR`. Run it with
  `/Volumes/SSD_Storage2TB/Users/luisnomad/Projects/kickortreat/.venv/bin/python`
  from the repository root.
  - `idle`, `kick`, `celebrate`, `run` and `poses` use **Sprite Studio on the ATOM**.
  - `review`, `strips`, `sheets` and `pack` are local.

| character | clips (local H3 + cloud run) | GPT poses | sheets | atlas (staged) |
| --- | --- | --- | --- | --- |
| joel | done; kick re-rolled once (`p4_joel_kick_h3r2_1.mp4`: H3 invented a ball in both; r2 is used, its ball is detached and removed) | done | all 7 | **done**: `joel/atlas/`, review `review/joel_atlas_v1.png` |
| luna | done | done | all 7 | **done**: `luna/atlas/`, review `review/luna_atlas_v1.png` |
| lucia | done | done | all 7 | **done**: `lucia/atlas/`, review `review/lucia_atlas_v1.png` |
| juan | done, reviewed (the kick clip kicks twice; the window logic keeps the first) | done, reviewed: on-model | `idle` only (`ref_height` 564) | not yet |
| juanjo | done, **not yet reviewed** | done, **not yet reviewed** | none | not yet |
| dad | done, **not yet reviewed** (the run was recovered from `pixverse asset list` after a killed process; it was charged once) | done, **not yet reviewed** | none | not yet |
| mum | done, **not yet reviewed** | done, **not yet reviewed** | none | not yet |

## Remaining steps (exact commands)

```bash
cd /Volumes/SSD_Storage2TB/Users/luisnomad/Projects/head-soccer
PY=/Volumes/SSD_Storage2TB/Users/luisnomad/Projects/kickortreat/.venv/bin/python
R="$PY tools/sprite-pipeline/tools/roster_process.py"
```

**juan** (`idle` done):

```bash
$R kick juan        # re-run: the interrupted run left kick_trim but no kick.json
$R celebrate juan
$R run juan         # computes ref-scale itself: cloud standing 614 / ref_height 564 = 1.0887
$R poses juan
$R sheets juan      # look at it
$R pack juan        # check idleHeight ~380, kickReach, chilenaContact; look at review/juan_atlas_v1.png
zsh scripts/backup_sprite_sources.sh
```

**juanjo, dad, mum** (in that order, each one complete):

```bash
$R review <id>      # LOOK first: green held, one character, one kick, no ball/props, identity stable; poses on-model
$R idle <id>        # sets ref_height; check it is about the idle clip's standing p90
$R kick <id>
$R celebrate <id>
$R run <id>         # ref-scale = cloud standing / ref_height (cloud standing measured: juanjo 634, dad 652, mum 646)
$R poses <id>
$R sheets <id>
$R pack <id>
zsh scripts/backup_sprite_sources.sh
```

Then build `review/roster_v2_lineup.png`: the idle cells of all 8 at in-game scale
(×0.583) on one ground line (Bob from `public/assets/player-bob-sheet-v3.webp`), plus a
24-cell strip per character.

## Re-rolls intended

- None queued.
- If the review of juanjo, dad or mum shows a bad clip, re-roll it **once** with a new
  seed:
  - local H3 (ATOM, needs permission):
    `maestro.py run --id p4_<id>_<action>_h3r2 --body maestro_templates/h3_fused_i2v.json --prompt-file prompts/anim/<id>_<action>_v1.txt --out source-assets/sprite-pipeline/<id>/clips --set image_start=<upload> --set resolution=704x704 --set seed=<new>`.
    Uploads are in `roster_uploads.json`.
  - a run: cloud `pv.py video ... --model minimax-h3` (150 credits).
  - Then process with `CLIP_<ACTION>=<path> $R <step> <id>`.
- An off-model GPT pose: re-roll once as `<id>_pose_<pose>_gpt_v2`. The helper prefers
  `_v2_1` files.
- H3 invented a ball in 3 of 5 reviewed kicks (Joel twice, Lucia). The helper
  tolerates a detached ball (largest component) and an attached blob (sharpness-picked
  contact frame), but **look at kick cells 9–12 in every review**.

## Known quality notes (finished characters)

- **joel:** idleHeight 328, kickReach 76, chilenaContact (237, 143). Celebrate turns
  toward the camera at times. Some H3 motion blur on the rear boot in a run cell.
- **luna:** idleHeight 330, kickReach 80, chilenaContact (227, 156). Run cell 7 has
  motion-blur ghosting on the legs.
- **lucia:** idleHeight 382, kickReach 93, chilenaContact (237, 95). Clean.
