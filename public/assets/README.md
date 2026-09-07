# Joel Football runtime art

This directory contains runtime art plus some retained compatibility assets.
The catalog and scene/theme loaders determine which assets are active.
Lossless masters, legacy sheets, and generated studies live under
`source-assets/` so Vite and Capacitor do not package them. Raster art was
generated and locally processed; runtime assets use optimized WebP, alpha PNG,
or hand-authored SVG according to the asset's needs. The provided genre
screenshot was treated as context only: it was not copied, traced, edited, or
included in the project.

## Runtime assets

| File | Pixels | Alpha | Suggested use at 1280x720 |
| --- | ---: | :---: | --- |
| `arena-skycourt.webp` | 1920x1080 | no | Optimized runtime arena. Cover the full logical 16:9 canvas. It contains continuous turf and wall art with no goals, openings, or bays. At 1280x720 the turf foreground spans roughly y=398-636 and its clean ground-contact line is near y=636. The lossless source PNG lives under `source-assets/`. |
| `arena-neon.webp` | 1920x1080 | no | Imagegen-derived genuine night arena: newly illustrated synthwave architecture, crowd, skyline, lighting, and violet pitch. The generated PNG lives under `source-assets/arena-neon.png`. |
| `arena-beach.webp` | 1920x1080 | no | Imagegen-derived genuine beach arena: bamboo terraces, ocean sunset, islands, palms, and a flat sand pitch. The generated PNG lives under `source-assets/arena-beach.png`. |
| `goal-side.svg` | 180x320 viewBox | yes | Runtime goal: a deliberately narrow left-side profile. Display at 150x235, origin `(0.5, 1)`, center `(75, 636)`, then mirror at `(1205, 636)`. |
| `player-joel-portrait.png` | 512x512 | yes | Joel's real-photo-derived cartoon portrait/full-body selector cutout, facing right. |
| `player-dad-portrait.png` | 512x512 | yes | Dad/Papá's real-photo-derived full-body selector and About-screen creator portrait, facing right. |
| `player-mum-portrait.png` | 512x512 | yes | Mum/Mamá's guardian-approved full-body selector and Hockey engraving source, facing right. |
| `player-bob-portrait.png` | 512x512 | yes | Bob's idle portrait, facing left. Start near 185-205 px display height. |
| `player-joel-sheet-v1.webp` | 1280x1440 | yes | Runtime 4x3 animation sheet for Joel's real-photo-derived likeness; twelve 320x480 frames. |
| `player-dad-sheet-v1.webp` | 1280x1440 | yes | Runtime 4x3 animation sheet for Dad/Papá (Luis Nomad); twelve 320x480 frames with a dedicated 405 px 6'7" idle normalization. |
| `player-mum-sheet-v1.webp` | 1280x1440 | yes | Runtime 4x3 animation sheet for Mum/Mamá; twelve 320x480 frames on the shared adult geometry. |
| `player-bob-sheet-v2.webp` | 1280x1440 | yes | Runtime 4x3 animation sheet for Bob; twelve 320x480 frames. |
| `ball.png` | 256x256 | yes | Rotation-safe ball. Start near 58-66 px display diameter. |
| `ball-neon.svg` | 96x96 viewBox | yes | Cosmetic football variant with the same competitive physics as `ball.png`. |
| `ball-balloon.svg` | 96x112 viewBox | yes | Party balloon used with the large buoyant, high-drag material preset. |
| `ball-rugby.svg` | 128x80 viewBox | yes | Oval rugby visual used with deterministic asymmetric surface wobble. |
| `ball-soda-can.svg` | 72x120 viewBox | yes | Upright soda can used with the chamfered rectangular tumbling collider. |
| `ball-cannonball.svg` | 96x96 viewBox | yes | Dense low-bounce cannonball with an original unlit fuse motif. |
| `power-flare.png` | 1024x512 | yes | Right-facing comet overlay with a transparent ball aperture. Flip X for left-facing shots; start near 230-260 px display width and render behind the ball. |
| `minigames/kickfall/kickfall-catch-rail.svg` | 320x80 | yes | Crisp magnetic catch rail with a platform-matched masonry cassette. Display near 144x36 and keep capture logic separate from the visual. |
| `minigames/kickfall/kickfall-bumper-v1.png` | 384x109 | yes | Amber three-pad mechanical blocker. Display near 82x29; it replaces the prototype triangles without changing ball physics. |
| `minigames/kickfall/kickfall-gate-v2.png` | 192x384 | yes | Coral masonry gate in a navy/gold frame. Display at the authored gate collider size and reuse cropped regions for break debris. |

The v2 runtime sheets divide into four 320 px columns and three 480 px rows.
Frames 0-5 preserve the legacy actions; frames 6-8 are the selected run contact,
passing, and opposite contact drawings; frames 9-11 are kick anticipation,
contact, and recovery. Selected transparent frames remain under `source-assets/animation/`.
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
- Joel palette: deep teal, coral, cream, and gold; his face and dense dark
  curls are based on guardian-supplied family photos.
- Dad/Papá palette: deep navy, golden yellow, royal blue, and cream. His
  photo-derived likeness uses deliberately dark-brown hair and beard with no
  gray, including in the tiny Disc Hockey engraving. His long-legged 6'7"
  silhouette uses a catalog-driven 1.20 visual scale and an explicit
  `dad-large` Football/Kickfall collision profile. Hockey deliberately keeps
  every pusher at the same regulation diameter.
- Mum/Mamá palette: sapphire blue, midnight navy, warm gold, and cream. Her
  approved photo-derived likeness preserves her long dark curls, warm smile,
  and gentle makeup. She uses a 1.20 visual scale, the explicit `mum-large`
  Football/Kickfall collision profile, and the regulation Hockey pusher
  diameter.
- Bob palette: royal violet, cyan, navy, cream, gold, and sandy blond.
- Joel is a guardian-approved cartoon likeness of the real child the game is
  named for. Bob remains fictional. The remaining family roster members use
  their own approved photo-derived likenesses.
- Ball and power art deliberately reuse both rivals' colors to bind the set.
- Match Playground object SVGs are hand-authored, compact, unbranded, and use
  silhouettes that stay readable while rotating at gameplay size.
- No embedded text, logos, trademarks, or watermarks.


## Optional references

Read only for the immediate asset task:

- [Character contract](../../docs/characters/PROJECT_CONTRACT.md): complete roster geometry.
- [Kickfall themes](../../docs/KICKFALL_THEMES.md): active theme manifests and lazy loading.
- [Original art record](../../docs/archive/public/assets/README.md): exact prompts,
  obsolete six-frame sheets, unused goal study, and processing evidence.
