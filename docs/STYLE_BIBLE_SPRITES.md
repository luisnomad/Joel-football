# Sprite style bible (roster redo)

Optional reading: use it when generating or reviewing character art for the
sprite redo. The owner decisions in [SPRITE_REDO_PLAN.md](SPRITE_REDO_PLAN.md) win
on conflict; the technique is in [SPRITE_PIPELINE.md](SPRITE_PIPELINE.md).

**Status: APPROVED by the owner on 2026-10-08** (references below; the canonical file per character is `source-assets/sprite-pipeline/<id>/ref/<id>_ref_approved.png`). Round-1 decisions are in
[SPRITE_REDO_PLAN.md](SPRITE_REDO_PLAN.md) item 9: Bob is a kid; heads bigger; keep
each character's current likeness and build; normalise Dad and Mum to the adult size.

## 1. One style for all eight

Every character is drawn in the same **soft painted 2D cartoon** look, which is the
look Joel, Dad and Mum already have. Bob, Lucia and Luna move off the bold cel style.

| property | rule |
| --- | --- |
| rendering | smooth hand-painted shading with gentle gradients: one soft shadow tone and one soft highlight per material, with no texture noise, hatching or airbrush glow |
| outline | one thin, even, dark warm-brown contour (not black) around the whole figure, with lighter interior lines |
| light | one key light from the upper left, even and neutral; no rim light, no cast shadow, no ambient occlusion pool under the feet |
| colour | warm, saturated kit colours; skin shaded warm (no grey shadows); a few large, readable shapes per figure |
| view | **strict side view (true profile) facing RIGHT**: one eye visible, the nose in silhouette, the far arm and leg mostly hidden behind the body. The game mirrors with `flipX`, so asymmetric details (a logo, a parting, a watch) must read either way |
| faces | big friendly eyes, readable from the 0.58× in-game scale; the character's real features (glasses, beard, curls, ears) are kept and slightly exaggerated |
| forbidden | text, numbers, logos, ball, props, floor, scenery, shadows, glow, extra people, cropped anatomy |

Locked prompt phrase (`{STYLE}`):

> soft painted 2D cartoon illustration with smooth hand-painted shading, gentle
> gradients, one soft shadow tone and one soft highlight per material, warm
> saturated colours, and a thin even dark warm-brown outline around the whole
> figure; clean readable shapes, no texture noise, no hatching, no glow

## 2. View and stance for references

- Strict side view facing right, standing on one ground line, feet slightly apart
  front to back, knees softly bent: a relaxed sporty ready stance.
- Arms relaxed and close to the body, so the reference stays narrow (see the width
  budget in §4).
- Full figure from the top of the hair to the boot soles, centred on a 1:1 frame with
  generous empty space (the clip generators need headroom).
- Backdrop: one flat, uniform **chroma green `#00FF00`**. This differs from the
  older magenta rule in [IMAGE_GENERATION.md](characters/IMAGE_GENERATION.md) on
  purpose: Bob and Luna wear violet, which a magenta key would eat. No kit colour
  passes the pipeline's green test (G beats R and B by 40), checked in §5.

## 3. Proportions

A big-head cartoon about as bold as today's Juan and Juanjo, not chibi (owner, round 1). Each character keeps the **build and likeness of their current sprite**; only the head ratio and the size class are normalised. Heads are measured from the crown of the skull to
the chin, without hair volume.

| class | characters | idle height (cell px) | world px (×0.583) | head : height | heads tall | build |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| adult | lucia, juan, juanjo, dad, mum | **380** | 222 | **0.32** | ~3.1 | each character's own build from the current sprite; broad shoulders, longer legs |
| kid | joel, luna, bob | **330** (87%) | 193 | **0.38** | ~2.6 | narrow shoulders, short limbs, rounder face |

Consequences:

- Kid and adult heads come out almost the same size in pixels (kid ≈125 px, adult
  ≈122 px in the cell). The difference in stature comes from legs and torso, which
  keeps headers visually fair and reads clearly as "child" versus "grown-up".
- Height variation inside a class is kept within ±3% for gameplay fairness. Dad may
  read tallest and Juanjo stockiest through build, not through height.

Locked prompt phrases (`{PROPORTIONS}`):

- **adult:** "a big cartoon head: the skull from crown to chin is about 0.32 of the full
  standing height (about 3 heads tall without the hair) … the same body build as
  image 1, grown adult proportions with broad shoulders and longer legs"
- **kid:** "a young child with a big cartoon head: the skull from crown to chin is about
  0.38 of the full standing height (about 2.6 heads tall without the hair) …
  narrow shoulders, a short torso, short arms and legs, a round young face"
- The exact wording is in `tools/sprite-pipeline/prompts/stills/*_ref_v2.txt` (v3 for Bob).

## 4. Size, colliders and the width budget (proposal)

Before the redo, `standard` collision used `headTop: 222`, and Dad and Mum used
`dad-large` and `mum-large` (`bodyScale` 1.2, `headTop` 284 and 266, plus
`visualScale` 1.2 and `frameScales` hacks). **Implemented 2026-10-11:** all five
adults are on `standard` (idle 382-383 px), the kids on `kid`, and the large
profiles, Dad's and Mum's `visualScale` and their `frameScales` are gone.

Proposal:

1. **All five adults share one size**: idle 380 px, `standard` profile, `visualScale` 1.
   Dad and Mum lose the 1.2 scale and the `frameScales`. Their old 1.2 size existed to
   give realistic small-headed drawings presence. With big heads they no longer need
   it. At 284 px, Dad would also make the kids look 68% of his height instead of the
   requested 85–90%.
2. **A new `kid` profile** for Joel, Luna and Bob: the same body width and `bodyScale` 1 (the
   same footprint on the ground), with `headTop: 193`. Their head collider sits about
   29 world px lower, which matches what the player sees.
3. **Fairness offset:** the lower head reach is a small header disadvantage. Offset it
   with about +3% jump for the kids (Joel 1.04 → 1.07, Luna 1.06 → 1.09, Bob 1.08 →
   1.11). Provisionally accepted; the owner confirms after playing.
4. `kickReach` is re-measured per character from the new kick contact frame, as the
   plan requires.

**Width budget:** each 320×480 cell allows a 304 px wide drawing. A big-headed adult at
380 px is about 150–190 px wide standing. A side-view kick or dash reaches roughly
1.4–1.7× the standing width, so it is near the limit. The Bob pilot measures this; the
fallbacks are a more compact kick, or a wider cell in the option B atlas, which the
plan allows.

## 5. Per-character kit and identity contract

Identity comes from the approved derived references only: the identity anchors for
Joel, Dad and Mum, and the current portraits for the others. The kits keep each
character's established palette. These descriptions fill `{CHAR}`.

| id | class | identity | kit | green-test risk |
| --- | --- | --- | --- | --- |
| bob | kid | fictional boy; tall swept-up spiky blond hair; fair skin with rosy cheeks; bright blue eyes; cheeky grin with a small gap tooth | violet jersey with a cyan side panel and cream collar and cuffs; navy shorts with a cyan side stripe; violet socks; cyan-and-gold boots; cream wristbands | none (violet, cyan) |
| joel | kid | boy; dense dark-brown curls with close faded sides; warm olive-tan skin; prominent ears; dark almond eyes; wide smile | teal V-neck jersey with a coral side panel; coral shorts; teal socks; cream-and-gold boots; coral wristband | teal: G−B small, passes |
| luna | kid | girl; big voluminous light-brown curly hair; light-tan skin; joyful smile | lilac-purple jersey with a white collar and a gold side panel; dark purple-navy shorts with a lilac stripe; gold socks; purple-and-white boots; white wristbands | none |
| lucia | adult | young woman (keep her current face and build, drawn as a grown-up); long straight dark-brown hair; light skin; brown eyes; warm smile | teal jersey with a coral side panel and white collar; navy shorts with a teal stripe; coral socks; teal-and-white boots; white wristbands | teal: passes |
| juan | adult | man; shaved bald head; short dark beard; light-tan skin; friendly eyes | navy polo shirt with small white dots and a collar; navy shorts with teal trim; teal socks; white-and-navy trainers; a bracelet | teal: passes |
| juanjo | adult | man; short black hair; black rectangular glasses; big wide smile; tan skin; stocky build | charcoal V-neck jersey with a maroon side panel and white trim; charcoal shorts; maroon-and-white socks; maroon-and-white boots; a wristwatch | none |
| dad | adult | man; short dark-brown hair; full trimmed dark beard; tan skin; tall athletic build | navy jersey with a yellow V-neck and yellow side panels; yellow shorts; navy socks with yellow bands; cream-and-gold boots; blue wristband | none |
| mum | adult | woman; long wavy dark hair; warm tan skin; bright smile | royal-blue jersey with navy panels and gold trim; navy shorts with gold trim; royal-blue socks with gold bands; white-and-blue boots; wristbands | none |

## 6. Palette and snapping

- 24-bit colour, one locked palette of **48–64** colours per character, binary alpha
  (`char.json`: `color_space: 24bit`, `colors: 56` to start).
- The shared outline colour and the light direction are what tie the roster together;
  the kit colours stay per character.

## 7. Review round 1 (2026-10-08, awaiting owner)

Generated on PixVerse `gpt-image-2.5-flare`, 1080p, detail `high`, 2 candidates
each, 25 credits per image (450 in total). Review images are in
`source-assets/sprite-pipeline/review/`.

- Bob anchor: `bob_ref_v2_1` (v1 heads were too small; v2 enlarged them).
- Line-up picks: joel v1_2, luna v1_1, lucia v1_2, juan v1_1, juanjo v1_2, dad v1_1,
  mum v1_2.
- Findings:
  - The shared style, strict profile and identities hold across all eight.
  - At in-game size, the new figures read smaller and slimmer than today's art
    (about 100–137 px wide versus about 180 px). Today's Juan and Juanjo are more
    big-headed (about 0.33) than this spec (0.28).
  - Kid heads came out at adult ratios (Joel about 0.28 versus the 0.34 target). The
    kids read as kids through height and limbs only.
  - Dad's head is the smallest of the adults (his realistic anchor pulled it down).
  - Bob's skin rendered warm-tan rather than fair.

## 8. Review round 2 (2026-10-08, awaiting owner)

Prompts: `bob_ref_v3` and `<id>_ref_v2` (Dad `dad_ref_v3`). Image 1 is now the
character's **current sprite** (it holds the likeness and build the owner knows).
Image 2 is the style anchor: `bob_ref_v3_1` for the kids and `bob_ref_v2_1` (style
only) for the adults. In total 18 images (450 credits) in round 2.

- Picks: joel v2_1, luna v2_2, bob v3_1, lucia v2_1, juan v2_1, juanjo v2_1, dad v3_3,
  mum v2_2. Board: `source-assets/sprite-pipeline/review/lineup_v2.png`.
- Kids now read as kids, heads are bigger, and Juan and Juanjo are stocky again.
- Dad v2 had tall, messy hair; v3 asks for his short, neat hair and trimmed beard.
- Still open: in-game the profiles are narrower than today's three-quarter art, and
  Dad's head is still the smallest of the adults.

## 9. Head fix for Dad and Mum (2026-10-08, approved)

Owner feedback on round 2: Dad and Mum's heads were much smaller than the other
adults' (measured: Dad 0.21 hair-top-to-neck versus about 0.28 for Juan, Juanjo and
Lucia). Their original sprites have realistic small heads, which pulled the
proportions back. Fix: an i2i **edit** of the picked images (`dad_ref_v3_3`,
`mum_ref_v2_2`) that enlarges only the head, with approved Juan attached purely as a
head-size guide (`dad_ref_v4_headfix`, `mum_ref_v3_headfix`; 4 candidates each, 200
credits). Dad now measures 0.26–0.27.

- Picks: dad `dad_ref_v4_headfix_3` (tidiest hair), mum `mum_ref_v3_headfix_2`.
- Board: `source-assets/sprite-pipeline/review/lineup_v3.png`; before and after in
  `dad_headfix.png` and `mum_headfix.png`.
- Lesson: when a reference sprite has small-headed proportions, edit the
  proportions after the redraw, with a size guide, instead of re-prompting.

## 10. Generation log

Every still and clip is logged in `tools/sprite-pipeline/manifest.json`. Prompts live
in `tools/sprite-pipeline/prompts/` and are never edited after use; re-rolls get `_v2`.
