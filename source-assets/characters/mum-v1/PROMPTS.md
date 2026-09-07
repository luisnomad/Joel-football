# Mum v1 generation prompts

Generation date: 2026-07-29

## Reference roles

Private family photographs are not copied into the repository and their local
paths are intentionally omitted.

1. Front smiling photograph: primary face, hair, complexion, and smile
   identity reference.
2. Profile photograph: nose, chin, forehead, and hair-volume identity
   reference.
3. Smiling three-quarter photograph: expression, eyes, cheek shape, and
   three-quarter likeness reference.
4. Existing roster portrait: rendering style and cute proportion reference
   only; it must not influence Mum's identity, age, hair, or outfit.

## Identity anchor v1

Use case: stylized-concept

Asset type: Joel Football roster-character identity anchor

Primary request: Create one complete full-body cartoon football character of
Mum, Joel's mother, using reference images 1-3 exclusively for her identity
and reference image 4 exclusively for the game's rendering style. She should
look gorgeous, warm, confident, and a little cuter and softer than the existing
roster while remaining clearly and recognizably the adult woman in the photos.

Subject and likeness: Preserve her warm medium-brown complexion; softly oval
face; bright dark-brown almond-shaped eyes; gently arched brows; proportionate
straight nose; broad friendly smile; and long near-black wavy hair with a
visible side part, smooth crown volume, and loose curls falling past her
shoulders. Preserve her adult age and warm expression. Do not copy any facial
features, age, hair, or outfit from reference image 4.

Makeup: Cool but gentle makeup—softly defined brows, thin brown liner and
mascara, subtle warm blush, and muted rose lip tint. Keep skin natural and
recognizable. No heavy contour, dramatic false lashes, glitter, glossy glamour
makeup, or beauty-filter airbrushing.

Style/medium: Match the repository's polished, softly shaded 2D cartoon style:
clean dark outlines, appealing expressive eyes, softly modeled skin and fabric,
a slightly oversized head, and compact athletic adult proportions. Use a cute
Head-Soccer-ready silhouette, but do not turn her into a child or teenager.

Composition/framing: Exactly one complete uncropped figure in a relaxed neutral
three-quarter idle stance, facing screen-right. Show every strand silhouette,
both ears as naturally visible, both hands and all fingers, both legs, both
shoes, and all studs. Center the figure with generous padding on every side.

Kit: Sapphire-blue short-sleeve V-neck jersey, midnight-navy side panels and
shorts, warm-gold collar/sleeve/short trim, sapphire socks with a narrow gold
band, cream-and-blue football boots with dark studs, one simple navy-and-gold
wristband, and tiny warm-gold heart stud earrings. No necklace.

Scene/backdrop: Perfectly flat opaque solid `#ff00ff` chroma-key background for
later removal. It must be one uniform color with no shadows, gradient, texture,
reflection, floor plane, halo, glow, or lighting variation. Do not use
`#ff00ff` anywhere in the subject.

Constraints: Stable adult likeness and age; one figure only; anatomically
coherent hands and feet; consistent lighting; crisp separated silhouette; no
cropping.

Avoid: Text, letters, numbers, logos, crest, watermark, signature, ball, puck,
prop, scenery, floor, cast shadow, contact shadow, reflection, duplicate
figure, extra limbs, missing fingers, gray hair, short hair, straight hair,
childlike age, masculine facial hair, exaggerated hourglass anatomy, sexualized
clothing, cleavage, or high heels.

## Pose sheet

The user approved the identity anchor on 2026-07-29.

### Reference roles

1. Approved transparent full-body Mum anchor: canonical identity, adult body
   proportions, face, hair, makeup, outfit, palette, shoes, line weight, and
   lighting reference.
2. Private front photograph: supporting face and smile identity reference.
3. Private profile photograph: supporting nose, forehead, chin, and hair-volume
   identity reference.
4. Private smiling three-quarter photograph: supporting eyes, cheeks, and warm
   expression identity reference.
5. Approved existing roster pose sheet: layout and football pose language only;
   it must not influence Mum's identity, age, hair, body, makeup, or kit.

### Pose sheet v1

Use case: stylized-concept

Asset type: Joel Football twelve-pose source sheet

Primary request: Create exactly one evenly spaced 4-column by 3-row sprite pose
sheet containing exactly twelve separate full-body figures of the approved Mum
character. Image 1 is canonical and controls her identity, adult proportions,
face, long side-parted near-black curls, gentle makeup, sapphire/navy/gold kit,
cream-and-blue boots, tiny heart studs, line work, shading, apparent scale, and
lighting in every cell. Images 2-4 only reinforce her real identity. Image 5
controls only the 4×3 layout and football action language; do not borrow that
person's identity, age, facial features, hair, body, or outfit.

Required source order:

1. Row 1 column 1: neutral three-quarter idle, facing screen-right.
2. Row 1 column 2: run contact A, athletic screen-right sprint, one planted
   contact foot.
3. Row 1 column 3: run passing pose, weight moving between strides.
4. Row 1 column 4: run contact B, opposite planted contact foot.
5. Row 2 column 1: airborne jump, knees lifted, clearly off the ground.
6. Row 2 column 2: forward kick contact, screen-right kicking leg extended.
7. Row 2 column 3: high-kick/chilena source, dynamic backward-leaning high kick.
8. Row 2 column 4: low explosive forward dash, screen-right.
9. Row 3 column 1: stunned standing pose, one hand touching her head, modest
   small gold cartoon stars allowed only as the stun effect.
10. Row 3 column 2: kick anticipation, planted and wound up.
11. Row 3 column 3: bicycle kick, fully airborne with a clear readable
    silhouette.
12. Row 3 column 4: kick recovery, follow-through returning to balance.

Consistency: Every cell is the same clearly adult Mum with the same face,
recognizable smile/eyes, long wavy hair and side part, head size, adult
head/body ratio, skin tone, gentle makeup, kit construction, sleeve length,
gold piping, wristband, heart studs, socks, shoes, studs, limb thickness,
outline weight, shading, light direction, and apparent scale. Preserve her cute
but adult character design. Hair may move naturally with the action but must
keep the same length, texture, part, and silhouette language.

Composition: One character per conceptual cell; all twelve figures complete
and uncropped with full hair, ears, hands, wrists, fingers, legs, shoes, soles,
and studs. Keep generous empty separation around every figure and between
conceptual cells. No figure, hair, hand, or shoe may cross into another cell.
No drawn grid or cell borders.

Backdrop: One perfectly flat, opaque, uniform solid `#ff00ff` chroma-key
background covering the entire canvas. No texture, shadows, gradient, floor
plane, halo, glow, or lighting variation. Do not use `#ff00ff` in Mum.

Avoid: More or fewer than twelve figures, duplicate poses, identity drift,
de-aging, gray hair, short or straight hair, heavy makeup, changed kit colors,
changed shoes, changed jewelry, facial hair, extra limbs, missing fingers,
merged anatomy, cropped anatomy, grid, panels, borders, labels, text, letters,
numbers, logos, ball, puck, prop, scenery, floor, cast shadows, contact shadows,
reflections, signature, or watermark.

### Pose-sheet chroma removal

Canonical settings:

```text
--auto-key border
--soft-matte
--transparent-threshold 12
--opaque-threshold 220
--despill
--edge-contract 1
```

The first pose-sheet derivative omitted `--edge-contract 1`. A
neutral-background audit found a faint one-pixel magenta halo around a few
moving curls and shoe soles, so it was preserved as
`pose-sheet-keyed-before-edge-contract.png` and superseded by the canonical
contracted matte. The figures and poses were not changed.

### Approved orientation correction

After reviewing the sheet, the user reported that the standing sprite faced
the wrong side. Only source cell 1 (idle) was horizontally mirrored within a
384×360 crop, large enough to include its few pixels of boot bleed while ending
before row 2. The face, makeup, outfit, proportions, scale, and other eleven
poses were not regenerated or changed. Both the chroma and transparent
pre-correction sheets are archived alongside the canonical corrected sheets.
The corrected idle now shares the action poses' screen-right native facing.


The original adult treatment with the corrected idle is canonical. Current
visual scale and collision profile come from the catalog, not old experiments.

Optional reading only for provenance investigation: [full generation record](../../../docs/archive/source-assets/characters/mum-v1/PROMPTS.md).
Read external/global generation references only when relevant to the immediate task.
