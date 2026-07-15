# Kickfall production obstacle sources

These are the lossless/generated sources for the legacy pocket, production
bumper, and breakable masonry gate. Runtime assets live under
`public/assets/minigames/kickfall/`; only assets requested by the active scene
are packaged.

The oval pocket was superseded by the hand-authored
`kickfall-catch-rail.svg`. The replacement uses the same brick pattern as the
lane and a shallow brake mechanism, so it reads as part of the deck instead of
an open portal pasted over a continuous platform. The original generated files
remain here as non-runtime source history.

## Selected files

| Runtime asset | Chroma source | Full alpha intermediate |
| --- | --- | --- |
| `kickfall-pocket-v1.png` | `kickfall-pocket-v1-chroma.png` | `kickfall-pocket-v1-alpha-full.png` |
| `kickfall-bumper-v1.png` | `kickfall-bumper-v1-chroma.png` | `kickfall-bumper-v1-alpha-full.png` |
| `kickfall-gate-v2.png` | `kickfall-gate-v2-chroma.png` | `kickfall-gate-v2-alpha-full.png` |

## Shared generation direction

- Use case: `stylized-concept`.
- Asset type: production 2D browser-game obstacle sprite.
- Style reference: the clean Level 2 Kickfall browser capture, used only for
  palette, line weight, and the neon maintenance-shaft mood.
- Rendering: crisp premium 2.5D arcade art, hand-painted vector-like edges,
  strong silhouettes readable at gameplay size.
- Backdrop: perfectly flat solid `#00ff00` chroma with no texture, gradient,
  floor, reflection, shadow, text, logo, or watermark.

## Pocket prompt

Create one wide, low-profile oval mechanical intake recessed into a platform,
with a thick cyan/turquoise illuminated metal rim, deep navy-black interior,
small side clamps, layered bevels, and subtle wear. It must clearly read as a
hole that can hold one soccer ball. Use a straight-on slightly top-down view and
a horizontal 3:1 silhouette. No ball, bricks, character, text, or fuzzy glow.

## Bumper prompt

Create one compact floor-mounted blocker with exactly three chunky rounded
amber teeth/pads emerging from a dark navy metal base, like a safe arcade speed
bump that stops a rolling soccer ball until kicked over. Add small cyan
fasteners and orange emissive strips. Keep a horizontal low-profile silhouette;
avoid sharp lethal spikes, tall geometry, balls, bricks, characters, and text.

## Gate prompt

Create one narrow vertical breakable barrier: five staggered rows of chunky
coral-red masonry inside a dark navy industrial frame, with a warm golden safety
rim, recessed mortar, metal corner brackets, chipped edges, and one pale
zig-zag fracture down the center. Keep a clean collision-friendly rectangle,
straight-on view, and roughly 1:2 width-to-height proportions. No loose debris,
ball, platform, character, or text.

The selected gate is the refinement pass that widened the first study and
reduced it to five brick rows while preserving its palette, frame, fracture,
lighting, and material treatment.

## Processing

The built-in image-generation path produced the flat-chroma sources. Each was
processed with the Image Generation skill's `remove_chroma_key.py` using border
sampling, soft matte, despill, thresholds 12/220, and a one-pixel edge
contraction. The alpha results were trimmed and Lanczos-downscaled with
ImageMagick to 512x138 (pocket), 384x109 (bumper), and 192x384 (gate).

Validation: all runtime assets are RGBA with fully transparent corners and were
visually inspected both in isolation and inside the live Phaser board.
