# Joel character V1

Optional reading for Joel likeness or source-asset work. Read external/global references
only when relevant to the immediate task.

Generated on 2026-07-29 with OpenAI's built-in image generation. Four
guardian-supplied family photos were used as private identity references. The
photos are intentionally not stored in the repository.

## Identity contract

- Dense dark-brown natural curls with close faded sides.
- Warm medium olive-tan skin.
- Long oval face with a gently tapered chin.
- Prominent outward ears.
- Dark almond-shaped eyes, straight dark eyebrows, and a slim nose.
- Joel's recognizable wide smile.
- Child age and proportions matching the supplied references.

The teal V-neck jersey, coral shorts, teal socks, cream-and-gold shoes, and
coral wristband preserve Joel's established game palette.

## Sources

- `identity-anchor-chroma.png`: approved full-body identity and outfit anchor
  on flat magenta.
- `identity-anchor.png`: locally keyed transparent anchor.
- `pose-sheet-chroma.png`: generated twelve-pose 4×3 contact sheet.
- `pose-sheet.png`: locally keyed transparent contact sheet consumed by
  `scripts/build-character-animation-atlases.py`.
- `PROMPTS.md`: the complete identity, pose-sheet, splash, icon, and menu-card
  prompt set used with the built-in image generator.

The generated source files were copied from the built-in image-generation
output. Chroma removal used the installed imagegen helper with border
auto-keying, soft matte, thresholds 12/220, and despill.

## Runtime contract

The atlas builder isolates each pose with bleed-aware cell recovery, normalizes
it to a 320×480 cell, places grounded alpha at `y=418`, preserves at least eight
horizontal transparent pixels, and writes:

- `source-assets/animation/final/player-joel-sheet-v1.png`
- `public/assets/player-joel-sheet-v1.webp`
- `public/assets/player-joel-portrait.png`

Frame order is idle, legacy run, jump, high kick/chilena, dash, stun, run A,
run passing, run B, kick anticipation, kick contact, and kick recovery.
