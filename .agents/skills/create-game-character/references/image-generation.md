# Image-generation contract

## Reference selection

Use no more than five references per generation:

### Identity anchor

1. strongest front or three-quarter photo;
2. profile photo;
3. smiling/expression photo;
4. optional additional identity photo;
5. one existing roster image for art direction only.

Label each image's role in the prompt. State that real photos control identity
and the roster image controls only rendering style.

### Pose sheet

1. approved full-body identity anchor;
2–4. strongest identity photographs;
5. one approved 4×3 roster sheet for layout and pose language only.

The approved anchor controls face, body proportions, outfit, palette, line
weight, and lighting.

## Anchor prompt requirements

Request:

- one complete full-body figure;
- the repository's polished, softly shaded 2D cartoon style;
- a neutral three-quarter idle pose and explicit native facing;
- stable likeness and age;
- exact kit construction and palette;
- flat opaque `#ff00ff` chroma;
- no text, logo, prop, ball, floor, shadow, scenery, crop, duplicate, or
  subject-colored magenta.

List negative identity constraints explicitly. Examples: no gray hair, no
facial hair, keep freckles, retain glasses, preserve a child's age, or retain
an unusually tall adult body ratio.

## Pose-sheet prompt requirements

Require an evenly spaced 4×3 sheet in this exact source order:

| Row | Column 1 | Column 2 | Column 3 | Column 4 |
| --- | --- | --- | --- | --- |
| 1 | idle | run contact A | run passing | run contact B |
| 2 | airborne jump | kick contact | high kick/chilena | dash |
| 3 | stun | kick anticipation | bicycle kick | kick recovery |

Require:

- exactly twelve single-character figures;
- complete hair, hands, wrists, shoes, and studs;
- coherent anatomy and no duplicate limbs;
- one stable head/body ratio;
- consistent outfit construction, limb thickness, shoes, and wrist details;
- generous separation between conceptual cells;
- one flat opaque `#ff00ff` background;
- no grid, labels, numbers, text, ball, puck, props, scenery, floor, shadows,
  glow, extra people, or cropped anatomy.

Before accepting the sheet, compare its idle and action proportions with the
approved roster style reference. Match the game’s perceived prominence, not
only its canvas occupancy: inspect head-to-body ratio, face size, shoulder
width, and silhouette weight beside Joel and an adult character. Preserve the
subject’s real age and identity while translating them into the same
exaggerated head-soccer visual language.

## Chroma removal

Use the installed helper:

```bash
rtk python /absolute/path/to/imagegen/scripts/remove_chroma_key.py \
  --input <chroma.png> \
  --out <transparent.png> \
  --auto-key border \
  --soft-matte \
  --transparent-threshold 12 \
  --opaque-threshold 220 \
  --despill
```

Use `--force` only when replacing a previously archived canonical derivative
with explicit user approval. Validate:

- alpha channel exists;
- corners are transparent;
- subject coverage is plausible;
- no magenta fringe remains;
- hair, fingers, and shoes are intact.

If a thin fringe remains, retry once with `--edge-contract 1`. Do not silently
switch image models or use a true-transparency CLI fallback without following
the active imagegen skill's approval rules.

## Provenance files

`PROMPTS.md` must include:

- generation date;
- identity-anchor prompt;
- every approved revision prompt;
- pose-sheet prompt;
- reference-image roles without copying private photo paths into public docs;
- explicit rejected/superseded directions;
- chroma-removal settings.

`README.md` must include:

- concise identity contract;
- kit contract;
- private-photo treatment;
- canonical and archived sources;
- runtime outputs;
- geometry and validation results;
- remaining human approval status.
