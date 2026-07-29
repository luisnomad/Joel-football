# Mum v1 character source

## Identity contract

Mum is Joel's mother: a clearly adult woman with a warm medium-brown
complexion, a softly oval face, bright dark-brown almond-shaped eyes, gently
arched brows, a proportionate straight nose, a broad warm smile, and long
near-black wavy hair. Her hair has a visible side part, smooth volume at the
crown, and loose curls falling past her shoulders. Preserve her friendly,
confident expression and recognizable smile.

The game treatment is polished, softly shaded 2D cartoon art with clean dark
outlines, a slightly oversized head, expressive eyes, and compact athletic
adult proportions. She must remain recognizably adult rather than being
de-aged into a child. Her version is intentionally a touch cuter and softer
than the rest of the roster without changing her identity.

Her makeup is cool but gentle: softly defined brows, thin brown
liner/mascara, subtle warm blush, and a muted rose lip tint. Avoid heavy
contouring, dramatic false lashes, glitter, glossy glamour makeup, or an
unrecognizably airbrushed face.

## Kit contract

- Sapphire-blue short-sleeve V-neck jersey.
- Midnight-navy side panels and shorts.
- Warm-gold collar, sleeve, short, and sock trim.
- Sapphire socks with a narrow gold band.
- Cream-and-blue football boots with dark studs.
- One simple navy-and-gold wristband.
- Tiny warm-gold heart stud earrings as a restrained likeness detail.
- No text, number, logo, necklace, prop, or ball.
- Native facing: screen-right (`1`).

## Privacy

Three private family photographs supplied by the user are used only as
identity references. They remain outside the repository. This directory stores
only generated artwork, prompt provenance, and the written identity contract.

## Canonical sources and outputs

- Generated and approved: `identity-anchor-chroma.png`
- Generated and approved: `identity-anchor.png`
- Superseded edge-audit derivative:
  `identity-anchor-keyed-before-edge-contract.png`
- Generated: `pose-sheet-chroma.png`
- Generated and visually inspected: `pose-sheet.png`
- Archived pre-orientation-fix sources:
  `pose-sheet-chroma-before-idle-facing-fix.png` and
  `pose-sheet-before-idle-facing-fix.png`
- Archived pre-head-proportion sources:
  `pose-sheet-chroma-before-head-proportion-fix.png` and
  `pose-sheet-before-head-proportion-fix.png`
- Archived intermediate body-width sources:
  `pose-sheet-chroma-before-strong-body-width-fix.png` and
  `pose-sheet-before-strong-body-width-fix.png`
- Archived rejected overwide body sources:
  `pose-sheet-chroma-rejected-overwide-body.png` and
  `pose-sheet-rejected-overwide-body.png`
- Archived Lucia-calibration intermediates:
  `pose-sheet-chroma-before-lucia-head-presence-fix.png`,
  `pose-sheet-before-lucia-head-presence-fix.png`,
  `pose-sheet-chroma-before-lucia-ratio-final.png`, and
  `pose-sheet-before-lucia-ratio-final.png`
- Archived rejected final Lucia-proportion sources:
  `pose-sheet-chroma-rejected-lucia-proportion.png` and
  `pose-sheet-rejected-lucia-proportion.png`
- Superseded edge-audit derivative:
  `pose-sheet-keyed-before-edge-contract.png`
- Superseded refined-sheet edge-audit derivative:
  `pose-sheet-keyed-before-head-proportion-edge-contract.png`
- Superseded body-width edge-audit derivatives:
  `pose-sheet-keyed-before-body-width-edge-contract.png` and
  `pose-sheet-keyed-before-strong-body-width-edge-contract.png`
- Lossless atlas:
  `source-assets/animation/final/player-mum-sheet-v1.png`
- Runtime atlas: `public/assets/player-mum-sheet-v1.webp`
- Portrait: `public/assets/player-mum-portrait.png`

## Approval and validation

- Identity anchor: approved by the user on 2026-07-29.
- Pose sheet: generated from the approved identity and visually inspected. The
  original graceful adult treatment is canonical, with the standing pose
  corrected to face screen-right. Later head, body-width, and Lucia-proportion
  experiments are archived only for provenance and are not runtime art.
- Geometry audit: passed for all twelve 320×480 frames, ground anchors,
  portrait clearance, and transparent edges. Runtime action packing uses
  pose-specific scale normalization derived from the same-pose area medians
  for Juan, Dad, and Juanjo; the canonical source sheet and idle are unchanged.
- Motion parity: all twelve idle-relative pose footprints pass within
  0.85–1.35 of the adult-reference medians. Mum uses a documented upper
  exception because strict area matching made every bent action pose read
  smaller than her uniquely narrow idle. The fixed-scale comparison board is
  `output/character-audits/mum-motion-parity.png`.
- Runtime integration: Mum is available in Football, Kickfall, and both
  regular and Crazy Disc Hockey, with English `Mum` and Spanish `Mamá`
  labels. Existing creator/branding surfaces remain unchanged.
- Roster parity: the restored idle is 121×380 authored pixels. It now renders
  uniformly at `visualScale: 1.2`, approximately 85×266 visible pixels, after
  live Kickfall comparison showed that its narrow original silhouette read as
  a miniature at scale 1. The uniform enlargement preserves the approved body
  proportions and brings visible area to roughly 98% of Juanjo's. Dad also
  renders at 1.2 from a taller 405-pixel authored idle, keeping Mum below his
  approximately 284-pixel runtime height. Football and
  Kickfall colliders, ground anchors, and Hockey diameter remain
  regulation-sized.
- Release tests: 177/177 unit tests, production build, complete
  Football/Kickfall browser journey, complete Disc Hockey browser journey,
  standalone web-game client state/screenshot review, atlas audit, package
  audit, and `git diff --check`.
- Final art direction: original attempt selected by the user on 2026-07-29.
- Deployment: not authorized.
