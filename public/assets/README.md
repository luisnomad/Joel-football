# Skyhead Showdown art manifest

All files in this directory are original art created for this project. Raster
art was generated and locally processed; the runtime goal is a hand-authored
SVG. The provided genre screenshot was treated as context only: it was not
copied, traced, edited, or included in the project.

## Runtime assets

| File | Pixels | Alpha | Suggested use at 1280x720 |
| --- | ---: | :---: | --- |
| `arena-skycourt.png` | 1920x1080 | no | Cover the full logical 16:9 canvas. It contains continuous turf and wall art with no goals, openings, or bays. At 1280x720 the turf foreground spans roughly y=398-636 and its clean ground-contact line is near y=636. |
| `goal-side.svg` | 180x320 viewBox | yes | Runtime goal: a deliberately narrow left-side profile. Display at 150x235, origin `(0.5, 1)`, center `(75, 636)`, then mirror at `(1205, 636)`. |
| `goal-side.png` | 512x479 | yes | Unused generated design study retained as source exploration; runtime code uses the simpler SVG. |
| `player-nova.png` | 512x512 | yes | Left/human boy's idle cutout, facing right. Start near 185-205 px display height. |
| `player-vex.png` | 512x512 | yes | Right/provider boy's idle cutout, facing left. Start near 185-205 px display height. |
| `player-nova-sheet.png` | 1254x1254 | yes | Legacy 3x2 pose source sheet; frame size 418x627. |
| `player-vex-sheet.png` | 1254x1254 | yes | Legacy 3x2 pose source sheet; frame size 418x627. |
| `player-nova-sheet-v2.webp` | 1280x1440 | yes | Runtime 4x3 animation sheet for Joel; twelve 320x480 frames. |
| `player-vex-sheet-v2.webp` | 1280x1440 | yes | Runtime 4x3 animation sheet for Vex; twelve 320x480 frames. |
| `ball.png` | 256x256 | yes | Rotation-safe ball. Start near 58-66 px display diameter. |
| `power-flare.png` | 1024x512 | yes | Right-facing comet overlay with a transparent ball aperture. Flip X for left-facing shots; start near 230-260 px display width and render behind the ball. |

The source-sheet frame order is row-major:

1. idle
2. run
3. jump
4. kick
5. dash
6. stun

The sheets divide exactly into three 418 px columns and two 627 px rows. Each
pose stays inside its cell. The normalized standalone player PNGs are easier
for a simple bob/scale animation; the sheets are available for richer pose
swaps.

The v2 runtime sheets divide into four 320 px columns and three 480 px rows.
Frames 0-5 preserve the legacy actions; frames 6-8 are the selected run contact,
passing, and opposite contact drawings; frames 9-11 are kick anticipation,
contact, and recovery. Full generation prompts and selected transparent frames
are retained under `source-assets/animation/`.
All grounded v2 frames use source foot anchor y=418 and at least eight pixels of
horizontal cell padding. Rebuild them with
`scripts/build-character-animation-atlases.py` after changing selected art.

## Goal placement contract

`goal-side.svg` uses a 180x320 viewBox. Its front scoring upright is at x=151,
the rear upright is at x=20, the top frame runs near y=43-56, and the base sits
at y=300-306. At 150x235 with origin `(0.5, 1)`, the left placement `(75, 636)`
puts that front upright at x≈126 and its top at y≈432, matching the scoring line
and Matter crossbar. The same SVG at `(1205, 636)` with `flipX = true` aligns the
right upright at x≈1154. The diamond net is clipped entirely inside the frame.

## Visual system

- Style: crisp vector-like 2D cel shading with bold dark contours and readable
  silhouettes.
- Arena palette: cyan sky, deep teal structure, coral rails, warm gold accents,
  emerald turf, and cream highlights.
- Nova palette: deep teal, coral, cream, gold, and chestnut brown.
- Vex palette: royal violet, cyan, navy, cream, gold, and sandy blond.
- Both rivals are friendly, entirely fictional Caucasian boys with clearly
  different faces, hair, colors, and silhouettes. Neither depicts a real person
  or an existing character.
- Ball and power art deliberately reuse both rivals' colors to bind the set.
- No embedded text, logos, trademarks, or watermarks.

## Generation prompt set

### Arena

```text
Use case: stylized-concept
Asset type: 2D browser arcade-football arena background
Create an original bright near-future rooftop sports arena high above a coastal
city. Use layered cyan sky, distant geometric skyline and sea haze, compact
grandstands with an abstract diverse crowd, angular teal canopies, coral rails,
gold pennants, glass wind screens, and solar floodlights. Draw a broad, level,
uncluttered emerald pitch from edge to edge in a symmetric exact 16:9 side-on
composition, with a clean horizontal ground-contact line at 88% canvas height
(logical y about 636 at 1280x720). Use a continuous bright low wall and turf at
both edges. Include absolutely no goals, goal mouths, bays, dark tunnels, black
openings, doors, arches, nets, posts, crossbars, players, balls, UI, signs, text,
logos, or mascots. Render as polished original modern animated-series game art
with crisp vector-like shapes, subtle painted texture, dark-teal contour
accents, and warm afternoon light.
```

### Generated side-view goal study (not used at runtime)

```text
Use case: stylized-concept
Asset type: reusable transparent 2D side-view football goal sprite
Create exactly one original left-side soccer goal in coherent side profile with
its open scoring mouth facing screen-right toward center field. Place the tall
front scoring upright near the right side. Run its top crossbar/back-depth beam
leftward toward a shorter rear support, connect the supports with a level base
rail, and stretch a large-cell diamond net through the trapezoid behind the
mouth. Use white and warm-cream tubes with cyan, teal, and small gold accents,
matching the bright rooftop skycourt's crisp cel-shaded arcade style. Isolate it
on a perfectly uniform #ff00ff chroma background visible through every net cell.
No turf, field, scenery, shadow, ball, player, text, logo, watermark, second
goal, or front-facing rectangular goal. Keep all net volume left/behind the
front mouth so horizontal mirroring creates the right goal correctly.
```

### Nova pose sheet

```text
Use case: stylized-concept
Asset type: 2D browser arcade-football character sprite source sheet
Create exactly six consistent poses of one original right-facing big-head,
small-body Caucasian boy athlete on a perfectly uniform #ff00ff chroma
background. He is a fictional 10-to-12-year-old with warm light skin, a huge
round head, short tousled chestnut-brown hair, hazel eyes, freckles, and a
friendly grin. His original unbranded outfit uses a deep-teal sport top with a
cream V collar and coral panels, coral shorts, teal socks, and gold-cream shoes.
Arrange a strict 3x2 grid in exact row-major order: idle, run, jump, kick, dash,
stun. Use crisp opaque vector-like cel shading, bold dark-teal outlines, no
shadows, no scenery, no ball, no panel lines, no text, no logos, no watermark,
no real-person likeness, and no recognizable existing character. Keep the same
identity, face, freckles, haircut, outfit, proportions, scale, and direction in
all six clearly different poses, wholly inside their cells.
```

### Vex pose sheet

```text
Use case: stylized-concept
Asset type: 2D browser arcade-football character sprite source sheet
Create exactly six consistent poses of one original left-facing big-head,
small-body Caucasian boy athlete on a perfectly uniform #00ff00 chroma
background. He is a fictional 10-to-12-year-old with fair light skin, rosy
cheeks, a huge slightly square head, a sandy-blond side-swept quiff, blue eyes,
and a mischievous friendly tooth-gap grin. His original unbranded outfit uses a
royal-violet sport top with a cream collar and cyan panels, navy shorts, violet
socks, and gold-cyan shoes. Arrange a strict 3x2 grid in exact row-major order:
idle, run, jump, kick, dash, stun. Use crisp opaque vector-like cel shading,
bold navy outlines, no shadows, no scenery, no ball, no panel lines, no text, no
logos, no watermark, no real-person likeness, and no recognizable existing
character. Keep the same identity, face, tooth gap, haircut, outfit,
proportions, scale, and direction in all six clearly different poses, wholly
inside their cells.
```

### Ball

```text
Use case: stylized-concept
Asset type: 2D browser arcade-football ball sprite
Create one perfectly circular original football, straight-on and centered on a
uniform #ff00ff chroma background. Use broad interlocking curved panels with a
warm cream base, deep-teal pentagons, coral and gold seam accents, a dark-navy
contour, and crisp contained cel-shaded highlights. Make it rotation-friendly,
clear at 48-96 px, and fully opaque. No shadow, text, marks, logo, watermark,
scenery, or extra object.
```

### Power flare

```text
Use case: stylized-concept
Asset type: 2D browser game power-shot comet overlay sprite
Create one right-facing horizontal comet aura on a perfectly uniform #ff00ff
chroma background. Use a thick circular energy ring at the leading right edge,
a long tapered three-prong trail to the left, and a #ff00ff circular aperture
inside the ring for a separate ball sprite. Build the effect from opaque crisp
cream, cyan, gold, coral, and navy cel-shaded shapes with a few nearby diamond
sparks. No smoke, blur, transparency, shadow, ball, people, text, logos,
watermark, or scenery.
```

## Processing and validation

The transparent assets used the built-in GPT Image route to generate flat
chroma-key sources, followed by the Image Generation skill's supported
`remove_chroma_key.py` helper with soft matte and despill. They were then
non-destructively trimmed/resized with ImageMagick. All transparent deliverables
were validated as RGBA (`srgba`) PNGs with fully transparent corner pixels; the
power flare's circular aperture is also fully transparent.

The requested pinned `gpt-image-2` CLI path could not run because
`OPENAI_API_KEY` was not configured in the local environment. The built-in image
tool does not expose an explicit model selector. No `gpt-image-1.5` generation
was used.
