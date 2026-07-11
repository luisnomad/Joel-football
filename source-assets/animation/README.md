# Character animation v2 source

Generated on 2026-07-10 with the built-in `imagegen` workflow, using the
original six-pose player sheets and idle cutouts as identity references.

## Deliverables

- `ref-sheets/`: the two approved six-cell character identity sheets on flat
  chroma backgrounds.
- `candidates/`: the generated run/kick candidate sheets and the targeted Vex
  recovery candidate.
- `selected/`: the individual chosen frames after chroma-key removal.
- `final/`: the lossless 1280 x 1440 RGBA source sheets, using twelve 320 x 480
  cells per character.
- `../../public/assets/player-nova-sheet-v2.webp` and
  `../../public/assets/player-vex-sheet-v2.webp`: the lossless WebP runtime
  sheets.

The original generated files under `$CODEX_HOME/generated_images` were copied,
not moved or overwritten. The project-local files are the durable sources.

## Selection

Both candidate sheets use a 3 x 2 grid:

| Cell | Intended pose | Selected |
| ---: | --- | :---: |
| 1 | run rear-foot contact | yes |
| 2 | run passing pose | yes |
| 3 | run opposite-foot contact | yes |
| 4 | kick anticipation | yes |
| 5 | kick contact / early swing | yes |
| 6 | kick recovery | Joel only |

Vex's targeted standalone recovery candidate was selected instead of cell 6
because it provided a clearer downward recovery leg and cleaner support foot.

The final runtime frame mapping is:

| Frame | Pose |
| ---: | --- |
| 0 | legacy idle |
| 1 | legacy run, retained for compatibility |
| 2 | legacy jump |
| 3 | legacy kick, retained for chilena rotation |
| 4 | legacy dash |
| 5 | legacy stun |
| 6 | generated run contact A |
| 7 | generated run passing |
| 8 | generated run contact B |
| 9 | generated kick anticipation |
| 10 | generated kick contact |
| 11 | generated kick recovery |

The live run sequence is `6 → 7 → 8 → 7`, advanced by distance travelled. The
live kick sequence is `9 → 10 → 11`. Gameplay collision and cooldown timing are
unchanged.

All grounded frames (`0`, `1`, and `4` through `11`) share source-space foot
anchor `y=418`. At the runtime scale this maps exactly to logical pitch ground
`y=636` for both characters. Every cell also keeps at least eight transparent
pixels on both horizontal sides so a trailing foot cannot be cut off.

## Post-processing

Generated assets used flat `#ff00ff` for Joel and `#00ff00` for Vex. Each chosen
cell was processed with:

```text
python $CODEX_HOME/skills/.system/imagegen/scripts/remove_chroma_key.py
  --auto-key border
  --soft-matte
  --transparent-threshold 12
  --opaque-threshold 220
  --despill
```

Frames were registered to the shared grounded foot level, normalized to a
320 x 480 cell, and assembled into a 4 x 3 sheet. The reproducible builder is
`scripts/build-character-animation-atlases.py`; it retains the largest connected
alpha component from generated candidates, centers each character with safe
horizontal padding, applies the ground contract, and writes both source PNG and
runtime WebP sheets. Lossless WebP reduces the
two runtime downloads to roughly 1.6 MB combined; decoded RGBA texture memory is
approximately 14.1 MiB combined.

## Prompt set

### Joel reference sheet

```text
Use case: identity-preserve
Asset type: 2D browser game character production reference sheet
Input images: the original Joel six-pose sheet is the primary identity, outfit,
line-art, palette, and proportions reference; the idle cutout is the neutral
full-body identity anchor.
Primary request: create a clean six-cell reference sheet for exactly the same
fictional boy athlete, preserving the polished cel-shaded cartoon style.
Scene/backdrop: perfectly flat solid #ff00ff chroma-key background, without
grid lines, borders, shadows, texture, floor, gradients, or lighting variation.
Subject: a 3 x 2 layout containing neutral standing, athletic ready stance,
head-and-shoulders identity close-up, compact running contact, running passing,
and kick recovery, all facing screen-right.
Consistency constraints: preserve head size, facial features, freckles, brown
hair, teal V-neck jersey with cream collar and coral/gold side panels, coral
shorts, teal socks, cream-and-gold shoes, outline weight, and light direction.
Constraints: one repeated character only; generous cell padding; full bodies;
no ball, props, effects, text, labels, watermark, crops, or magenta in subject.
Avoid: distorted anatomy, extra limbs or fingers, melted shoes, identity,
costume, proportion, or perspective changes.
```

### Vex reference sheet

The Joel reference prompt was mirrored to face screen-left and used `#00ff00`.
Identity invariants were replaced with Vex's swept blond hair, blue eyes, purple
jersey with cyan side panel, navy shorts with cyan piping, purple socks,
cyan-and-gold shoes, and cream wrist wraps.

### Run and kick candidate sheets

```text
Use case: identity-preserve
Asset type: production-ready 2D browser-game animation keyframe candidate sheet
Input images: the original six-pose sheet is the identity/rendering anchor; the
approved reference sheet is the character consistency anchor.
Primary request: draw exactly six side-view keyframes in a precise 3 x 2 grid,
all facing the character's native attack direction.
Top row: rear-foot run contact; planted-foot passing pose; opposite-foot run
contact. The leg and arm phase must clearly change across cells.
Bottom row: kick anticipation with a folded rear leg; early swing with support
foot planted; kick follow-through/recovery with the striking leg lowering.
Scene/backdrop: one perfectly flat removable character-specific chroma color,
with no borders, dividers, shadows, gradients, texture, or floor plane.
Composition: one complete figure per conceptual 512 x 512 cell with generous
padding; constant apparent body scale and ground level.
Consistency constraints: preserve exact identity, head diameter, eye shape,
hair silhouette, torso length, limb thickness, outfit construction, palette,
shoe design, outline thickness, and lighting.
Constraints: six figures only; no ball, goal, props, motion lines, effects,
text, labels, watermark, chroma color inside the subject, or cropped body parts.
Avoid: idle poses in the run row, duplicate poses, floating contact frames,
foot sliding, extra anatomy, melted shoes, costume or perspective changes.
```

The Vex version faced screen-left and used green chroma. The Joel version faced
screen-right and used magenta chroma.

### Targeted Vex recovery

```text
Use case: identity-preserve
Asset type: one production-ready 2D browser-game kick animation keyframe
Primary request: draw exactly the same Vex character facing screen-left in one
follow-through pose immediately after straight-leg contact. Keep the support
foot grounded; bend and lower the kicking leg; lean the torso slightly forward;
balance the arms naturally; keep the eyes looking screen-left.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background without
shadow, gradient, texture, floor, reflection, or lighting variation.
Consistency constraints: preserve the exact supplied face, blue eyes, swept
blond hair, proportions, purple/cyan/navy kit, wrist wraps, socks, shoes,
outlines, and lighting.
Constraints: one uncropped full-body figure only; no ball, props, effects, text,
watermark, or green inside the subject.
Avoid: another full-contact pose, anticipation, running, floating support foot,
distorted anatomy, extra limbs, melted shoes, costume or identity changes.
```
