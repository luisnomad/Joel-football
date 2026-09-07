> Historical record. Optional reading only for asset provenance, previous instructions, or dated verification associated with this file.
> This is past evidence, not current instructions or proof of release readiness.
> Original location: `source-assets/characters/dad-v1/README.md`; bare relative paths in the record use that location.
> Read external/global references only when relevant to the immediate task; verify changing claims before relying on them.

# Dad / Papá character V1

Generated on 2026-07-29 with OpenAI's built-in image generation. Four
user-supplied photographs of Luis Nomad were used as private identity
references. The photographs are intentionally not stored in the repository.

## Identity contract

- Short textured dark-brown hair with a subtle side sweep and tapered sides.
- Full, neatly shaped dark-brown beard and moustache.
- No gray, silver, white, blond, or salt-and-pepper hair in any pose.
- Light warm skin.
- Tall rectangular-oval face with a strong jaw.
- Thick straight eyebrows, deep-set brown/hazel eyes, and a substantial
  straight nose.
- Calm, confident adult expression.
- A deliberately tall 6'7" silhouette: long legs, long arms, a long torso,
  adult shoulders, and a smaller head-to-body ratio than the compact roster.

The deep navy V-neck jersey, golden-yellow trim and shorts, royal-blue side
panels, navy-and-gold socks, cream-and-navy boots, and cobalt wristband are
Dad's fixed game kit.

## Sources

- `identity-anchor-chroma.png`: approved full-body identity and outfit anchor
  on flat magenta.
- `identity-anchor.png`: locally keyed transparent anchor.
- `pose-sheet-chroma.png`: generated twelve-pose 4×3 contact sheet.
- `pose-sheet.png`: locally keyed transparent contact sheet consumed by
  `scripts/build-character-animation-atlases.py`.
- `identity-anchor-compact-v1*.png` and `pose-sheet-compact-v1*.png`: archived
  superseded compact-proportion experiment; never used at runtime.
- `PROMPTS.md`: the complete identity and pose-sheet prompt set.

Chroma removal used the installed imagegen helper with border auto-keying, soft
matte, thresholds 12/220, and despill.

## Runtime contract

The atlas builder isolates each pose with bleed-aware cell recovery, gives Dad
a dedicated 405-pixel tall normalization inside each 320×480 cell, places
grounded alpha at `y=418`, preserves at least eight horizontal transparent
pixels, and writes:

- `source-assets/animation/final/player-dad-sheet-v1.png`
- `public/assets/player-dad-sheet-v1.webp`
- `public/assets/player-dad-portrait.png`

Frame order is idle, legacy run, jump, high kick/chilena, dash, stun, run A,
run passing, run B, kick anticipation, kick contact, and kick recovery.

The character catalog applies `visualScale: 1.2` in Football and Kickfall.
That scales only Dad's rendered artwork. Football retains the shared compound
player collider, Kickfall retains its shared 44×82 body, grounded display
origins remain registered to the same foot line, and Disc Hockey intentionally
keeps the regulation pusher diameter.

## Validation

The runtime atlas passed the reusable character auditor: 1280×1440 pixels,
twelve non-empty 320×480 frames, at least eight transparent pixels on both
horizontal sides, and grounded visible alpha ending at `y=418`. At runtime the
405-pixel authored idle and `visualScale: 1.2` produce approximately 284
visible pixels of height, keeping Dad clearly taller than Mum. Football,
Kickfall, Hockey, selector, and About screenshots remain human visual gates
before tablet deployment.
