# Bob pilot: generator comparison and frame recipe

Optional reading: use it when producing animation for a roster character in the
sprite redo. Decisions are in [SPRITE_REDO_PLAN.md](SPRITE_REDO_PLAN.md); the
technique is in [SPRITE_PIPELINE.md](SPRITE_PIPELINE.md); the look is in
[STYLE_BIBLE_SPRITES.md](STYLE_BIBLE_SPRITES.md).

**Status:** generation comparison and runtime integration done (2026-10-08); **owner
review pending** (plan step 3 STOP). Nothing is committed. Every run is logged in `tools/sprite-pipeline/manifest.json`.

## 1. Comparison results (Bob, approved reference `bob_ref_approved.png`)

Prompts are `tools/sprite-pipeline/prompts/anim/bob_*_v1.txt` (from the templates) and
`prompts/stills/bob_pose_*_gpt_v1.txt` / `bob_chilena_c*_v1.txt`.

| test | generator | cost | result |
| --- | --- | --- | --- |
| idle, run, kick I2V | PixVerse `v6`, 720p, 1:1, 5 s | 40 credits/clip | **Rejected.** Ignores the flat backdrop: after about 0.5 s it paints a forest (idle) or a brown floor (run, kick). The kick plays twice. The run motion itself is good. |
| idle, run, kick, celebrate I2V | Maestro H3 (local, ATOM), 704² | GPU only | **Winner.** The green holds, the identity is stable, there is exactly one kick, and the celebrate loop is clean. Weakness: motion blur on the fastest run frames and one kick frame. |
| run I2V | PixVerse cloud `minimax-h3`, 768p | **150 credits** | The green holds, and it is a little crisper with a longer stride than local H3. It still blurs feet on 2 of 8 frames. Optional upgrade, not required. |
| jump, dash, stun, chilena poses | GPT Image 2.5 (PixVerse i2i) | 20 credits/image | **Winner.** On-model, clean green, strong readable poses. |
| jump, dash, stun, chilena poses | Qwen 2.1 edit (local) | GPU only | Good identity, but the chilena is wrong (a forward dive), the stun is weaker, and the backdrop has faint vertical banding. Fallback only. |
| chilena 3-keyframe transition | PixVerse `transition` `v5` (the only model allowed for 3+ images) | 48 credits | **Rejected.** It wanders back and forth around the contact pose, ends on the wrong pose, and runs 5.5 s instead of the requested 3 s. |
| run via motion-control (Joel driven by Bob's run) | PixVerse `motion-control` `v5.6` | 60 credits | **Rejected.** It replaces the flat green with a texture, changes Joel's kit colours (blue/red instead of teal/coral) and loses the painted style and likeness. |

## 2. Recipe per animation (for the roster)

This is the recipe built during this pilot, revised after the owner's playtest. The
owner's required set is: run, jump, chilena, celebrate, sprint and react when hit. The
game also needs idle and kick.

| animation | source | atlas cells | processing |
| --- | --- | --- | --- |
| idle | local H3 I2V | 3 | `make_action --mode loop --keep 8 --fps 8` (**process first**: sets `ref_height`); pick tallest, mid, low |
| run | **cloud H3** (PixVerse `minimax-h3`, 768p, 1:1, 5 s; owner-approved for runs) | 6 | `--mode loop --keep 8 --fps 12 --min 8 --max 24`; pass `--ref-scale` (see §3); drop the 2 blurriest |
| sprint | reuses the run's two opposite full strides | 0 | runtime alternates them at 16 fps with a 9° lean |
| kick | local H3 I2V | 4 | find the real window yourself (§3), cut it, `--mode once --whole --hit N --keep 12`; pick wind-up, clean extension, follow, recover |
| jump | GPT Image 2.5 i2i from the approved reference | 1 | `pose_sheet.py` |
| react when hit | GPT Image 2.5 i2i: impact, stagger (dizzy), recover | 3 | `pose_sheet.py --poses impact:1,stagger:1,recover:1` |
| chilena | GPT Image 2.5 i2i: takeoff, **contact**, follow-through | 3 | `pose_sheet.py`; the contact frame defines `chilenaContact` |
| celebrate | local H3 I2V | 4 | `--mode loop --keep 8 --fps 10 --min 8 --max 30` (the hop height is kept) |

GPT Image could not produce a distinct second sprint stride: three tries (130 credits)
returned the same leg configuration. Hence the sprint reuses the video run strides.

## 3. Gotchas found in the pilot

- **Kick one-shot window:** `make_action --mode once` latched onto the *backswing* as
  the first motion peak and cut the clip at contact, so there was no recovery. Measure
  per-frame subject width over the raw clip, cut the real window (Bob: frames 9–50,
  contact at 27), then use `--whole --hit`.
- **Motion blur blobs:** H3 leaves a detached-looking but connected blur blob ahead of
  the boot on the fastest frame. `clean_specks` cannot remove it (it touches the boot).
  Pick the neighbouring clean extension frame as the runtime contact frame.
- **Scale across generators:** `ref_height` is in source pixels of the first clip. A
  clip from another generator or resolution (cloud H3 at 768p) snaps at the wrong
  scale (Bob's run came out about 8% too big). Measure and pass `--ref-scale`.
- **Studio "ERODED" flag** fires on every chroma clip (about 50% "lost alpha") while
  the frames are intact; it is the black-backdrop check. Judge by eye.
- **RTK heredocs:** a prompt written with `cat > file <<EOF` got `bat` decorations
  (box borders, ANSI codes). Write prompts with an editor tool or Python, and check
  every prompt for `\x1b` before a paid run.
- **SSH tunnels** to the ATOM die between sessions even when Maestro and Studio keep
  running; reopen them with `-o ExitOnForwardFailure=yes`.

## 4. Width budget measured

At kid scale (idle 330 px) the widest frames are: kick contact 255 px, chilena
follow-through 263 px, dash 232 px. At adult scale (380 px) the chilena follow-through
reaches about 303 px, which is at the 304 px limit of a 320 px cell. The new atlas
therefore uses **336 px wide cells** (see the integration notes).

## 5. Runtime integration (option B, `roster-v2` atlas)

**Atlas:** `public/assets/player-bob-sheet-v3.webp` (master
`source-assets/animation/final/player-bob-sheet-v3.png`), 2016×1920, 6×4 cells of
336×480, packed by `pack_atlas.py` from `source-assets/sprite-pipeline/bob/atlas_plan.json`.
The old `player-bob-sheet-v2.webp` stays on disk, unused.

| cells | content |
| --- | --- |
| 0–2 | idle loop (ping-pong; cell 0 is the tallest, for the portrait and the collider audit) |
| 3–8 | run loop (contacts at cells 3 and 6; the **sprint** alternates 3 and 6, leaning 9°) |
| 9–12 | kick: wind-up, **contact 10**, follow, recover |
| 13 | jump |
| 14–16 | react when hit: impact, stagger (also held while frozen), recover |
| 17–19 | chilena: takeoff, **contact 18**, follow-through |
| 20–23 | celebrate loop |

The layout was rebalanced after the owner's playtest to animate sprint and hit
(idle 3, kick 5→4, the separate dash and stun cells replaced by the hit sequence).

**Code** (layouts keep the classic 12-frame characters byte-for-byte on their old frames):

- `src/game/pure/characterAnimation.js`: `CHARACTER_LAYOUTS` (`classic`, `roster-v2`),
  `getCharacterLayout`, the per-layout idle, run, kick, chilena and celebrate resolvers.
- `src/game/content/characters.js`: Bob's `atlasLayout`, `nativeFacing: 1`,
  `kickReach: 73`, `chilenaContact {x: 210, y: 141}`, `collisionProfile: 'kid'`, and
  jump 1.08 → 1.11. Also `getCharacterSheetFrameConfig` for the three loaders.
- `src/game/content/characterCollisionProfiles.js`: `kid` profile (adult footprint,
  `headTop` 193).
- `src/game/pure/chilena.js` + `Fighter.js`: the **framed chilena**:
  - The press starts the move only if a forward plan (`planFramedChilena`, the same
    controller as in-game) says the contact boot will meet the ball. Otherwise the
    press stays an ordinary kick (`lastChilenaAttempt.reason: 'ball-unreachable'`;
    in practice chest-high balls on the far side of the boot).
  - Trigger zone (owner decision 2026-10-12, every character): the ball must be
    overhead, at or above head level and within one body width (43 px each side)
    of the body-to-boot span, and no higher than the contact boot reaches on the
    character's ordinary jump (`framedChilenaZone`). Anything else is an
    ordinary kick (`ball-not-overhead`, `ball-too-far-sideways`,
    `ball-too-high-or-far`).
  - In flight, the jump is steered every tick so the contact drawing's boot meets
    the ball, capped (`chilenaFlightLimits`) so the body never climbs past its
    ordinary jump apex or drifts more than 43 px sideways before contact. The
    shot is applied **at contact**, and MatchScene announces it then.
  - Contact is a boot-to-ball-surface gap of ≤12 px, or ≤32 px at the planned time or
    at closest approach.
  - The body ignores the ball from takeoff until 0.2 s after contact. The upright
    collider's head cap would otherwise bat away the ball the (horizontal) drawing's
    boot just struck. Found by the browser test: the shot left upward at 36 px/tick.
- `MatchScene.js`: the scorer celebrates through the goal phase; the match winner
  celebrates on the result screen.
- `KickfallScene.js`: layout-aware frames and display width.
- `public/sw.js` + `WebPlatformServices.js`: worker v9 → v10.

**Tests:**

- `test/sprite-redo.test.js` (12 tests):
  - classic layout equivalence;
  - the roster-v2 tables;
  - the kid collider;
  - contact rules;
  - a 5,000+ case planner sweep (≥85% of the eligible zone reachable, every
    reachable plan within 32 px).
- `test/framed-chilena-browser.mjs` (in the real game, Bob as player):
  - still ball: contact gap 0–10 px;
  - moving ball: −2 to 11 px;
  - drawn boot = gameplay boot (0.00 px);
  - shot aimed at the goal;
  - chest-high far ball refused;
  - celebrate loop on a goal.
- Fixtures updated: `test/v2.test.js` (Bob's facing and new contract),
  `test/browser-game.mjs` (layout-aware atlas metrics, Kickfall boss contact frame),
  and the service-worker tests.
- Audits made layout-aware: `audit_character_atlas.py` (detects roster-v2 by size) and
  `audit_roster_collision_coverage.py` (cell width). The roster- and motion-parity
  audits still compare classic frame indices and are not meaningful for a single
  roster-v2 character yet.

## 6. Known limitations at review time

- Motion blur from H3 remains on some run frames (cells 4, 5, 7) and the kick swing
  (cell 10). Options: cloud `minimax-h3` for runs (150 credits/clip), or re-roll.
- Bob is the only roster-v2 character, so matches mix the new painted profile art with
  the old three-quarter art until the roster is redone.
- The chilena trigger zone is unchanged; the reachability plan refuses its lowest
  part (chest height).

## 7. Owner playtest round 1 (2026-10-08)

- **Smoothness:** extra drawings alone did not help, because the cadence was too slow.
  Measured per game second with `scripts/probe-animation-rates.mjs` (Phaser's real loop
  paused):

  | animation | before | after |
  | --- | --- | --- |
  | idle | 6 | ~10 |
  | celebrate | 8 | ~12 |
  | run | distance-only, ~7 at mid-pitch speed | floor 14, cap 24, following ground speed in between |

  Changes:
  - `CHARACTER_LAYOUTS['roster-v2']` gained `runMinDrawingsPerSecond`,
    `runMaxDrawingsPerSecond`, `idleFps` and `celebrateFps`, plus `runCycleAdvance`.
  - Idle and celebrate now run on a game-time `animationClock` (fixed step), not the
    wall clock.
  - Classic characters keep their old timing (4–5 run drawings/s).
- **Size:** Bob feels much smaller than the adult-sized sprites. Owner: do not change
  it yet (kid vs adult).
- **Video source:** Dreamina has no H3 (Seedance only). Cloud H3 is PixVerse
  `minimax-h3`, at 150 credits per 5 s clip.
- **Website links:** the game now links to the shared ARKD BOX pages,
  `arkdbox.com/legal/` and `arkdbox.com/support/?game=joel-football` (moved on main,
  commits 5a9a7d2 and 14edd37).

## 8. Ball and super-shot effects (2026-10-08)

Owner: "the ball animation needs a review, especially the super shots".

- **Found:**
  - Every power shot (standard power, Fireball, Big Guy, chilena) used one static
    comet sticker (`power-flare.png`, bold cel style) plus a trail of stacked circles.
    It flipped only left or right, ignored the flight angle, and stayed at full size
    on a stopped ball.
  - Its per-type colour never showed: the game renders with **Phaser's Canvas
    renderer** (`src/main.js`), which ignores `setTint`.
- **Now** (`src/game/effects/PowerBallEffects.js`, `src/game/pure/powerBallVisuals.js`):
  - a glow and a tapered streak along the real path;
  - pooled particles stepped by the game clock, with colours baked into runtime
    textures. Identities:

    | shot | look |
    | --- | --- |
    | standard power | cyan or orange energy, by side |
    | Fireball and chilenas | flames, embers and smoke |
    | Big Guy | gold sparkles |

  - Everything scales with ball speed and fades out (0.25 s) when the power ends.
  - The flare image is no longer loaded.
- **Ball spin** was already physical (about 14 rad/s after a strike) and is left alone:
  changing angular velocity would alter tuned bounces.
- **Open (owner decision):** other tint and `preFX` effects are also no-ops under Canvas:
  the Fighter status glow and tints (frozen, shield, hyper, chilena), Kickfall
  flashes and gate tints, Disc Hockey puck and pusher tints, and the tinted control
  icons. The options are to bake colours, or to switch to WebGL (tablet performance
  test needed).
- Review: `scripts/capture-ball-effects.mjs` films every shot type;
  `output/ball-effects-review/{before,after}.png`.
