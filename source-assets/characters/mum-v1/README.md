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

## Canonical sources and runtime contract

- `identity-anchor-chroma.png` and `identity-anchor.png`: approved identity anchor.
- `pose-sheet-chroma.png` and `pose-sheet.png`: canonical twelve-pose source.
- [PROMPTS.md](PROMPTS.md): canonical prompts and processing settings.
- Lossless atlas: `source-assets/animation/final/player-mum-sheet-v1.png`.
- Runtime outputs: `public/assets/player-mum-sheet-v1.webp` and
  `public/assets/player-mum-portrait.png`.

Catalog `visualScale: 1.2` changes the artwork; the explicit `mum-large`
collision profile controls Football/Kickfall geometry independently. Ground
anchors remain registered, and Hockey keeps regulation pusher diameter.

Preserve the original adult silhouette with the screen-right idle correction.
The later head/body-width/Lucia experiments are not canonical. Action packing
uses same-pose adult-reference normalization; the documented motion-area upper
exception is 1.35 because strict matching made bent poses read too small.
Revalidate this exception if source art or packing changes.

Optional reading for this character: [previous decisions and validation](../../../docs/archive/source-assets/characters/mum-v1/README.md).
For rebuilds, use the [shared contract](../../../docs/characters/PROJECT_CONTRACT.md)
and validate the current outputs; old test counts are historical evidence.
