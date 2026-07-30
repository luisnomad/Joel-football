# Joel Football character contract

## Repository map

- Catalog: `src/game/content/characters.js`
- Animation constants: `src/game/pure/characterAnimation.js`
- Football renderer: `src/game/entities/Fighter.js`
- Football construction: `src/game/scenes/MatchScene.js`
- Kickfall renderer: `src/game/minigames/kickfall/KickfallScene.js`
- Hockey renderer: `src/game/minigames/discHockey/DiscHockeyScene.js`
- Atlas builder: `scripts/build-character-animation-atlases.py`
- Browser journeys: `test/browser-game.mjs` and
  `test/disc-hockey-browser.mjs`
- Source art: `source-assets/characters/<id>-v<version>/`
- Lossless atlas: `source-assets/animation/final/`
- Runtime atlas and portrait: `public/assets/`

## Runtime naming

- Source folder: `source-assets/characters/<id>-v<version>/`
- Lossless atlas:
  `source-assets/animation/final/player-<id>-sheet-v<version>.png`
- Runtime atlas: `public/assets/player-<id>-sheet-v<version>.webp`
- Portrait: `public/assets/player-<id>-portrait.png`
- Phaser texture keys: `<id>-sheet` and `<id>`

Use semantic names. Do not inherit unrelated fictional-character filenames.

## Atlas geometry

- Atlas: 1280×1440 RGBA or alpha WebP.
- Grid: four columns × three rows.
- Cell: 320×480.
- Runtime frame order: idle, legacy run, jump, high kick/chilena, dash, stun,
  run A, run passing, run B, kick anticipation, kick contact, kick recovery.
- Grounded frames: `0,1,4,5,6,7,8,9,10,11`.
- Visible grounded alpha bottom: source `y=418`.
- Horizontal transparent margin: at least 8 px on each side.
- Portrait: 512×512 RGBA, non-empty, with visible pixels clear of every edge.

The source sheet uses a human-friendly order. The builder maps it to runtime
order through `CONTACT_POSE_MAP`.

## Display and physics

Football's standard enhanced sheet display is 186.67×280 with feet at logical
pitch `y=636`. Every fighter uses a stable authored compound Matter body.
Gameplay size comes only from an explicit collision profile; Dad and Mum use
their intentional larger profiles. Character stats do not redefine the
collider.

Kickfall's standard display is 84×126 and uses the same source ground anchor.
The standard gameplay body is 44×82. An explicit collision profile may opt a
character into a deliberately different body and matching strike geometry.

Disc Hockey derives a monochrome engraving from the portrait. Pusher radius
and displayed diameter are competitive geometry and must remain identical
across characters, including Crazy Mode.

`visualScale` is an optional catalog parameter bounded by
`getCharacterVisualScale` to 0.85–1.20. It alters Football and Kickfall artwork
but never implicitly changes gameplay geometry. `collisionProfile` separately
selects authored Football/Kickfall bodies and strike geometry. Ground anchors
remain unchanged, and Hockey intentionally ignores both size settings.

## Catalog and fixture contract

A new roster entry needs:

- stable `id`;
- English/Spanish `names` and uppercase `labels`;
- portrait and sheet texture keys/assets;
- `nativeFacing` of `1` or `-1`;
- readable accent color;
- five stats;
- optional `visualScale`.
- optional explicit `collisionProfile`.

Update every ordered roster fixture, available-character diagnostic, selector
wrap expectation, lineup count, Crazy Mode exclusion, and lazy-loading
expectation. Search the entire repository instead of relying on one catalog
unit test.

## Cached and baked surfaces

Catalog integration does not update pixels already baked into:

- menu cards;
- setup headers or scoreboards;
- title splash;
- manifest and Android icons;
- Android portrait/landscape splash resources.

Replace baked art or cover it with live localized rendering. When an existing
runtime filename changes content, bump the service-worker version so a
cache-first installation cannot retain the old character.

## Privacy and provenance

Reference photos stay outside the repository by default. The project stores:

- approved generated anchor;
- transparent anchor;
- generated and transparent pose sheets;
- exact prompts and generation date;
- identity contract;
- build/output paths.

Do not commit private photos merely to make generation reproducible.
Reproducibility means retaining the approved derived source and exact prompt,
not copying family photographs.

## Release gate

Require:

1. identity-anchor human approval;
2. pose-sheet visual approval;
3. atlas and package auditors;
4. unchanged hashes for unrelated atlases;
5. unit tests;
6. production build;
7. complete Football/Kickfall browser journey;
8. complete Disc Hockey browser journey;
9. standalone client check when available;
10. roster-parity board and in-game comparison against Joel, an adult, and the
    full roster at runtime scale;
11. screenshot inspection with zero console/page errors;
12. final person/guardian approval.

Deployment is a separate user-authorized action.
