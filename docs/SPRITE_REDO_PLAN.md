# Sprite redo: owner decisions and plan (2026-10-08)

This document **locks the owner's answers** to the open decisions in `docs/SPRITE_PIPELINE.md` ("Owner decisions needed"). Where they disagree, this one wins. Read `docs/SPRITE_PIPELINE.md` first for the technique, the tools and the gotchas; the skill is `.agents/skills/sprite-pipeline/`.

## Decisions

1. **Cloud use and privacy: approved.** The characters are "close enough" versions, not full likenesses of the family. Uploading the approved derived references to cloud generators (Dreamina, PixVerse) is OK. Never upload private photos; the pipeline never needs them.
2. **Style: one shared style for the whole roster.**
   - Keep the **soft painted look**; the owner loves it. Bob moves to the painted look too (no more cel style).
   - **Normalise style and proportions across all 8 characters**: the same rendering, lighting, outline weight and palette approach.
   - **Heads slightly oversized** for a cartoon feel (a mild big-head look, not chibi).
   - **Strict side view** for gameplay frames (the game mirrors with `flipX`).
   - **This changes collision.** Update the head and body colliders and `kickReach` to match the new proportions, and re-run and update the collider audit and tests. Ball contact must match what the player sees.
3. **Kids versus adults must read at a glance.**
   - Joel, Luna and **Bob** are the kids; lucia, juan, dad, mum and juanjo are adults.
     (Corrected by the owner on 2026-10-08: Bob is a kid.)
   - Keep the on-screen sizes **roughly stable** for fair gameplay (similar collider footprints), but make the difference clearly visible:
     - kids are about 85–90% of adult height, with a bigger head-to-body ratio and shorter limbs;
     - adults have longer legs and broader shoulders.
   - Propose the exact numbers (heights in px, the head ratio per class) with a side-by-side line-up for approval **before** producing everyone. Decide whether colliders differ by class, and keep any gameplay difference small and fair.
4. **Frames and game code: changes approved.**
   - Add a **celebrate** animation (goal or win). It's the only new animation the owner asked for.
   - "Header" in the earlier doc meant a dedicated heading pose (hitting the ball with the head). The owner didn't ask for it, so skip it unless the game already has a header action that would clearly benefit.
   - Moving beyond the fixed 12-frame atlas is allowed (more run and kick frames, smoother animation). Update the runtime, the catalog and the tests to match.
5. **Generators.**
   - **Reference stills:** GPT Image. Dreamina (`dreamina-canvas`) can **create a new canvas**; make a dedicated Joel Football canvas and don't use Kick or Treat's.
   - **PixVerse CLI (`pixverse`) is available, with lots of credits about to expire. Prefer it where it works well.** From its help:
     - `pixverse create image` (T2I/I2I, has a GPT Image model with `--detail-level`);
     - `pixverse create video` (I2V);
     - **`pixverse create transition`:** multi-keyframe transition video. Promising for kicks and celebrations: generate key poses, then let it animate between them.
     - **`pixverse create motion-control`:** a character image plus a motion reference video. Promising for consistent runs and kicks across all 8 characters: one motion reference, eight characters.
     - `pixverse capabilities --json` for models; `pixverse account` for credits.
     - Never guess flags: read `--help` per command.
   - **Evaluate PixVerse against H3 on the Bob pilot** (quality, consistency, flat backdrop, loopability), and pick per animation type. Maestro H3 and Qwen on the ATOM remain the fallback and the edit tool.
6. **ATOM GPU: approved.** Stop `llama-qwen36-fast` and `hermes-voice-atom` during runs (`systemctl --user stop …`; they may already be stopped). Maestro start command: `cd ~/apps/maestro-eval/app; SERVER_PORT=17860 SERVER_NAME=127.0.0.1 nohup ~/venvs/maestro-eval-py312/bin/python launch.py > ~/apps/maestro-eval/logs/maestro-overnight.log 2>&1 &`. Sprite Studio: `docker start tostai-sprite-studio`. Tunnel ports 17860 and 8765 with `ssh -fN -o ServerAliveInterval=30 -L …`.
7. **Large files:**
   - Pipeline work binaries under `source-assets/sprite-pipeline/` (clips, poses, studio runs, sheets) and `tools/sprite-pipeline/manifest.json.lock` are **git-ignored**.
   - Back them up to the NAS with **`scripts/backup_sprite_sources.sh`** (rsync to `/Volumes/QNAP8TB/Backup/head-soccer/sprite-pipeline`, never deletes). Run it after each batch.
   - Final game-ready atlases still go to the tracked game asset folders.
8. **Menus, splash, icons and store art: yes, redo them, and a revamp is welcome.**
   - Once the roster is approved, propose a refreshed menu and UI direction that matches the new painted style. Present 2–3 options as mock-ups first.
   - Then redo the character select cards, splash, app icon and Play Store art.

9. **Style review round 1 (2026-10-08).**
   - **Likeness and build:** keep each character's original likeness and physical
     build from the current sprites. Dad's original sprite looks more like him than
     the round-1 redraw did.
   - **Heads:** bigger heads for all, roughly as big as today's art (adults about
     0.32, kids about 0.38).
   - **Size:** normalise everyone, Dad and Mum included, to one adult size and one kid
     size. (Dad and Mum were only larger because an earlier pass couldn't make them
     work at the standard size.)
   - **Kid colliders:** the lower head reach plus about 3% more jump is provisionally
     accepted; the owner confirms after playing.
   - **Likeness approved** for every round-1 reference except Dad's. Bob is redone as
     a kid anyway.

10. **Chilena contact (owner requirement, 2026-10-08).** The chilena needs a real
    animation, *and* the ball must only be struck when the boot visibly meets it.
    - Today: the shot is applied instantly on the second kick press
      (`Fighter.attemptChilena` → `ball.applyStrikeVelocity` at t=0), and one drawing
      (frame 3) is spun 360° over 0.58 s. The ball leaves before any foot is near it.
      `test/browser-game.mjs` locks that in (ball `vx > 24` right after the press;
      rotation 65–180°).
    - **Design (owner clarification: the player jumps and meets the ball).**
      Eligibility already guarantees the ball is overhead and in reach, so an eligible
      chilena **always connects**: the move adapts to the ball, not the other way round.
      1. Same trigger and eligibility (second press, ball overhead).
      2. At takeoff, predict the ball's position over the next few tenths of a second
         and solve the jump (clamped velocity), and the contact time if needed (a
         higher ball gives a later contact), so that the boot tip of the **contact
         drawing** arrives at the ball. Measure the boot tip per character as a new
         `chilenaContact {x, y}`, the same way `kickReach` is measured.
      3. Play the frame sequence: lean-back takeoff, then scissor, then **contact**
         (body near horizontal, kicking boot straight over the head), then
         follow-through, then landing. Orientation comes from the drawings; drop or
         greatly reduce the procedural 360° spin.
      4. **Apply the shot at the contact frame**, not on the press. If the ball was
         knocked off its predicted path in the meantime, still strike at contact as
         long as it is within a forgiving radius of the boot. Only a ball that has
         clearly left (for example cleared by the opponent) is not struck.
      5. Update the browser and pure tests to the new contract (the strike happens at
         the contact frame with the boot on the ball; an eligible chilena connects
         from varied overhead positions; the landing is unchanged).
    - Art: key poses for takeoff, contact and follow-through (GPT Image or Qwen), with
      in-betweens from `pixverse create transition` between them. Measure
      `chilenaContact` from the contact frame. The ball is never drawn.

## Plan

1. **Setup:**
   - create the Joel Football Dreamina canvas;
   - check `pixverse capabilities` and the account credits;
   - stop the GPU services and start Maestro and Sprite Studio;
   - confirm `tools/sprite-pipeline` runs with `--help`.
2. **Style bible:** write `docs/STYLE_BIBLE_SPRITES.md`, covering the painted style, side view, head ratio, the kid and adult proportions, palette approach, outline and target heights.
   - Generate **one style anchor**: Bob redrawn in the shared style, side view.
   - Make a **line-up** of all 8 characters as reference stills at the proposed proportions.
   - **Stop for owner approval.**
3. **Bob pilot:**
   - idle, run, kick, jump, the bicycle kick ("chilena"), dash, stun and **celebrate**;
   - A/B PixVerse (video, transition, motion-control) against H3;
   - snap into sheets;
   - integrate with the runtime and collider changes;
   - test in game.
   - **Stop for owner review.**
4. **Roster:** Joel, Luna, Lucia, Dad, Mum, Juan, Juanjo, reusing the pilot's winning recipe per animation. Back up to the NAS after each character.
5. **Integration:** runtime and catalog changes for the new frames, the colliders and `kickReach` per character, the service-worker cache bump, and tests and audits passing.
6. **Menus and UI revamp:** 2–3 mock-up options, then the owner's pick, then the build. Then the splash, icon and store art.

**Rules:** report failures honestly, never invent CLI flags, log every generation in `tools/sprite-pipeline/manifest.json`, and don't commit or push unless the owner asks.

## Progress

- **2026-10-08 (commit 3d1496e):** Bob v3, Joel v2, Luna v3 and Lucia v3 installed
  as roster-v2 atlases with the framed chilena and the `kid` collision profile.
- **2026-10-11: roster complete (plan steps 4-5), uncommitted, awaiting owner review.**
  - New roster-v2 atlases for Juan (v4), Juanjo (v2), Dad (v2) and Mum (v2), with
    their new side-view portraits (the pipeline regenerates portraits on install,
    as the first four did).
  - Bob v4, Joel v3, Luna v4 and Lucia v4 reinstalled from the fixed
    background-removal build: the grey patch that filled enclosed gaps in the
    hit-reaction cells is gone (`output/roster-v2-integration/`).
  - Dad and Mum normalised to the standard adult size (§9): no `visualScale`,
    no `frameScales`, standard collider; `dad-large`/`mum-large` removed.
  - `kickReach` and `chilenaContact` come from each atlas's measures json; a unit
    test now ties the catalog to `source-assets/sprite-pipeline/<id>/atlas/*.json`
    and checks every sheet, master and portrait is installed. Service worker v12.
  - Open: the framed chilena trigger (76.8 px, calibrated on Bob) admits low balls
    that the adults' higher contact boots cannot meet; the planner turns those
    presses into ordinary kicks (see AUDIT B2 status). Classic-layout code is now
    unused by the catalog (AUDIT I2).
