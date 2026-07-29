---
name: create-game-character
description: Create and integrate a new Joel Football roster character from user-provided photos or approved character art. Use when a user asks to add, onboard, replace, or rebuild a real family member or fictional character, including likeness approval, a twelve-pose atlas, portrait, localized roster data, Football/Kickfall/Hockey integration, privacy-safe provenance, geometry audits, screenshots, and complete release-gate testing.
---

# Create Game Character

Create one approved likeness and make every game surface agree with it. Treat
identity, pose consistency, asset geometry, runtime integration, gameplay
fairness, and human approval as separate gates.

Read `references/project-contract.md` and
`references/image-generation.md` completely before editing. Use the `imagegen`
skill for raster generation and `develop-web-game` for live validation when
they are available. Follow every active `AGENTS.md` instruction. When the
repository instructions reference `RTK.md`, read it before shell work and
prefix every shell command with `rtk`.

## 1. Audit and intake

1. Read `progress.md`, the character catalog, atlas builder, animation
   constants, scene loaders, selectors, tests, and service worker.
2. Inspect the dirty worktree and preserve unrelated user changes.
3. Collect or infer only low-risk details:
   - stable lowercase ID;
   - English and Spanish names and labels;
   - age group and body proportions;
   - native facing;
   - outfit, palette, and accent color;
   - speed, jump, kick, dash, and power stats;
   - optional visual scale;
   - whether the person replaces existing art or becomes a new roster member;
   - whether the person is a title/branding character.
4. Ask only for missing information that materially changes identity or
   integration. Do not ask for details the photos or repository already answer.
5. Search the entire repository for the ID, names, old filenames, portraits,
   atlases, baked menu art, scoreboards, splash/icon assets, serialized roster
   fixtures, and cache versions. Record the affected surfaces.

## 2. Protect private photos

- Use supplied photos as private identity references.
- Do not copy them into the repository unless the user explicitly asks.
- Store only approved generated art, transparent derivatives, prompt
  provenance, and a written identity contract.
- Do not identify or infer sensitive traits unrelated to the character.
- Keep the project source directory at
  `source-assets/characters/<id>-v<version>/`.

## 3. Approve one identity anchor

Write the identity contract before generation. Describe stable facial
features, hair, age, expression, skin tone, body proportions, outfit, palette,
and any invariants such as “no gray hair.”

Generate one complete neutral full-body anchor on flat removable chroma.
Inspect the face, hair silhouette, ears, age, anatomy, outfit, hands, shoes,
background uniformity, and edge quality. Show it to the user and stop for
explicit approval. Do not spend time producing twelve poses from an unapproved
likeness.

When the user requests a revision, change only the named variables and preserve
the rest of the approved contract.

## 4. Generate and key the pose sheet

After anchor approval, generate exactly one 4×3 sheet:

1. idle;
2. run contact A;
3. run passing;
4. run contact B;
5. airborne jump;
6. kick contact;
7. high kick/chilena source;
8. dash;
9. stun;
10. kick anticipation;
11. bicycle kick;
12. kick recovery.

Require one identity, head size, body ratio, kit construction, palette, shoe
design, line weight, lighting, and apparent scale across all cells. Require
complete separated figures with no text, grid, props, cropped anatomy, or
extra limbs.

Copy the selected generated source into the project, remove chroma with the
installed imagegen helper, and validate the alpha result. Preserve generated
originals under the image-generation cache. If poses bleed across conceptual
cells, use the builder's connected-component recovery; never accept clipped
hair, hands, or shoe soles merely because dimensions pass.

Save:

- `identity-anchor-chroma.png`
- `identity-anchor.png`
- `pose-sheet-chroma.png`
- `pose-sheet.png`
- `PROMPTS.md`
- `README.md`

## 5. Build and audit runtime assets

Add the character to `CONTACT_SHEET_PLAYERS` in
`scripts/build-character-animation-atlases.py`. Use shared geometry and
manifest data instead of ad hoc runtime offsets.

Before rebuilding, hash unrelated approved atlases. Then run:

```bash
rtk python scripts/build-character-animation-atlases.py
rtk python .agents/skills/create-game-character/scripts/audit_character_atlas.py \
  --atlas public/assets/player-<id>-sheet-v<version>.webp
rtk python .agents/skills/create-game-character/scripts/audit_character_package.py \
  --root . --id <id> --version <version>
rtk python .agents/skills/create-game-character/scripts/audit_character_roster_parity.py \
  --root . --id <id> --cohort <adult|child|auto>
rtk python .agents/skills/create-game-character/scripts/audit_character_motion_parity.py \
  --id <id> \
  --atlas public/assets/player-<id>-sheet-v<version>.webp \
  --reference-atlas public/assets/player-<same-cohort-reference>-sheet-v<version>.webp
```

Repeat `--reference-atlas` for at least three same-cohort roster characters.
Re-hash unrelated atlases and require identical hashes. Inspect the transparent
pose sheet, packed atlas, portrait, generated roster-parity board, and
motion-parity board visually.
The parity audit applies each catalog `visualScale`, reports the target's idle
silhouette against the roster median, and places every idle frame on one shared
runtime ground line. Its geometry thresholds catch gross scale drift; they do
not replace the required visual judgment of head-to-body ratio and perceived
prominence. Always declare the age cohort from the approved identity contract;
adult mode requires at least 85% of the roster-median visible width and 90% of
its visible height. Treat threshold overrides as exceptions that require a
written identity or design reason.

## 6. Integrate every surface

Update all applicable surfaces:

- `src/game/content/characters.js`: ID, localized names/labels, textures,
  assets, native facing, accent, stats, and optional `visualScale`;
- Boot and lazy loaders;
- Football, Kickfall, and Disc Hockey;
- selectors, setup screens, About/creator surfaces, and diagnostics;
- Crazy Mode inclusion/exclusion;
- serialized roster fixtures, selector wrap expectations, lineup counts, and
  browser-only `available` lists;
- baked menu cards and baked lineup labels;
- title splash, web/native icons, and Android splash resources only when the
  character owns branding;
- source/runtime documentation and prompt provenance;
- versioned filenames and the service-worker version when cached asset
  filenames stay unchanged.

If `visualScale` differs from `1`, prove it is cosmetic:

- Football retains the shared authored compound collider area;
- Kickfall retains the shared 44×82 body;
- grounded feet retain the same pitch/platform anchor;
- Hockey retains the regulation pusher diameter.

Do not deploy, publish, sync Android, or install on the tablet unless the user
explicitly requests it.

## 7. Validate in the actual game

Use focused tests during art iteration. At the final integration gate, run all
of these:

```bash
rtk npm test
rtk npm run build
rtk npm run test:e2e
rtk npm run test:disc-hockey:e2e
rtk git diff --check
```

Also run the standalone client required by the `develop-web-game` skill when it
is available. Treat a flaky failure as unverified until a clean rerun passes;
do not weaken an unrelated assertion to make the suite green.

Capture and visually inspect:

- identity anchor, pose sheet, atlas, and portrait;
- the generated roster-parity board, comparing the target with at least Joel,
  one adult, and the full available roster at runtime scale;
- selector/setup at desktop, tablet, and compact widths;
- Football idle, run loop, jump/landing, kick anticipation/contact/recovery,
  dash, stun, chilena, and Big Guy;
- both left- and right-side facing;
- grounded feet and collider diagnostics;
- Kickfall idle, run, jump, kick, and platform registration;
- normal and Crazy Hockey engravings at regulation pusher size;
- About screen;
- intro/menu/splash/icon surfaces when branding applies.

Compare every screenshot with `render_game_to_text`. Require zero page and
console errors. Explicitly judge whether the target's head-to-body ratio fits
their age cohort and the game's exaggerated head-soccer style. A technically
equal frame height is not sufficient when the character reads materially
smaller or larger beside existing players. Resolve a proportion problem in
the source art when possible; use `visualScale` only for an intentional
whole-character size difference, then prove its collider invariants.

Still screenshots are not sufficient for animation-scale approval. Review run
and kick as adjacent-frame strips or short animations at one fixed runtime
canvas size. Reject any sequence where the face, torso, or overall perceived
body scale pulses between frames, even when each frame independently passes
cell geometry. The motion-parity audit compares each pose's idle-relative
footprint with same-cohort atlases; its numeric gate complements, but does not
replace, this temporal visual review.

## 8. Finish with human approval

Automated tests approve geometry and integration, not identity. Present the
approved anchor, final portrait, pose sheet, and representative in-game
captures. Report:

- project paths and prompt provenance;
- privacy treatment of source photos;
- atlas/package audit results;
- focused and full-suite results;
- any intentionally unchanged legacy surfaces;
- whether deployment remains pending.

Stop before deployment until the person or guardian approves the final
likeness in game.
