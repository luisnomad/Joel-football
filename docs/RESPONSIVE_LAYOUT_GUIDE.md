# Joel Football — Responsive Layout Guide

Optional reading for scene layout, scaling, art geometry, or responsive controls. Read external/global references
only when relevant to the immediate task.

This document is the layout contract for Joel Football, Kickfall, Disc Hockey,
and future mini-games. Read it before adding a scene, changing arena art,
altering collision geometry, or modifying Phaser scaling.

The goal is not to make every device run a different version of the game. The
goal is to preserve one authored gameplay space while presenting it according
to two intentionally different experience tiers:

1. regular and tall tablets, including the established 1280×800 Android-tablet
   layout, are the primary and fully optimized experience;
2. phones use an alternative compact layout for casual play, while long tablets
   continue to use the full tablet experience.

## Product decision: tablet-first, phone Casual mode

Joel Football is a children's game. Tablets are the expected primary device
for children and therefore define the product's reference experience. Menu
composition, readability, touch comfort, artwork presentation, complete game
flow, and future mini-games must be fully designed, tested, and optimized for
the supported tablet matrix.

Phones remain supported in the same app as a deliberately limited **Casual
mode**: a parent may hand a phone to a child for a short session, but a phone is
not expected to reproduce the tablet experience without compromise. The
lazy-loaded compact menus, phone control placement, safe-area handling, and
wide-stage treatments exist to keep the core game usable and coherent on
representative phones. They are the practical extent of phone-specific product
work.

This decision establishes the following priorities:

- Never regress, shrink, or redesign the working tablet experience merely to
  make one phone shape look better.
- Keep phone presentation and resources separate and lazy-loaded when they
  differ from tablets.
- Support the main journey and all three games on representative conventional
  16:9 and modern wide phones, with readable menus, visible/reachable core
  controls, aligned collision art, and no crashes or uncovered canvas.
- Do not promise bespoke layouts, art, or equivalent comfort for every extreme
  phone size, density, cutout, or aspect ratio. Very small phones may uniformly
  scale the compact experience below the preferred tablet/average-phone touch
  sizes.
- Treat crashes, blocked navigation, invisible core controls, unsafe cutout
  placement, and art/collision mismatches as phone defects. Minor comfort or
  density limitations on extreme phones are accepted Casual-mode constraints.
- Keep one application, one save/profile, and one game implementation. Casual
  mode is a device presentation tier, not a second product or fork.

Future work may improve phone Casual mode when a fix is isolated, low-risk, and
does not compete with tablet quality. Tablet optimization and child usability
remain the release priority.

## Non-negotiable invariants

- Gameplay and collision geometry are authored in a 1280×720 coordinate space.
- Changing a device aspect ratio must not move a collider away from its painted
  wall, goal, platform, floor, or scoring plane.
- A regular 1280×800 tablet must keep its established geometry and touch-control
  layout unless a change explicitly targets that device class.
- A wide touch device must use the full screen without a one-sided gap.
- Extra space must be intentional, symmetric, and visually quiet. It must not
  look like a duplicated image, rendering error, or exposed canvas background.
- Setup, loading, gameplay, help, pause, confirmation, and result states are all
  part of the responsive feature. A game is not responsive if only active play
  is correct.
- Touch controls must remain readable, reachable, and large enough for a real
  finger after CSS and Phaser scaling.

## Supported stage families

The implementation lives in `src/game/layout/tabletStage.js`. Do not introduce
scene-specific device detection when the shared stage layout can express the
same requirement.

| Family | Representative viewport | Phaser stage | Presentation contract |
| --- | --- | --- | --- |
| Reference 16:9 | 1280×720 | 1280×720 | Authored game fills the stage exactly. |
| Regular/tall tablet | 1280×800 | 1280×800 | Gameplay stays 1280×720; the extra 80 logical pixels extend below it. Existing tablet controls and geometry remain unchanged. |
| Casual conventional phone | 732×412 | 1280×720 | Lazy-loaded compact menus; authored gameplay stage scales uniformly. Core controls remain visible and reachable on the representative profile. |
| Long phone | Pixel 9a-sized 924×412 | Wider than 1280, 720 high | The authored 1280×720 game is centered; horizontal overflow is decorative or UI-only. |
| Long phone | iPhone 15 Pro Max-sized 932×430 | Wider than 1280, 720 high | Same wide-stage contract as Android phones. |
| Long tablet | 1920×800 | Wider than 1280, 720 high | Same wide-stage contract; do not assume that only phones can be wider than 16:9. |

The physical Pixel 9a resolution of 2424×1080 produces a 1616×720 logical
stage. Disc Hockey must still render its playable rink at exactly 1280×720 in
that stage.

Non-touch desktop browsers retain the normal fitted presentation. Touch-device
expansion must not accidentally change desktop scaling.

## Compact-phone composition: short, not narrow

A Pixel-class 21:9 phone has less vertical room than a tablet but more
horizontal room than the authored 16:9 layout. Do not solve that device by
shrinking a tablet menu uniformly. Treat it as a distinct, horizontal-first
composition selected by `window.__JOEL_DEVICE__.resourceProfile`.

- Prefer side-by-side regions, short tab rows, split previews, and horizontal
  card shelves over vertically stacked tablet panels.
- Spend the extra width on larger readable copy and comfortable touch targets;
  do not fill it with empty margins while compressing the useful content.
- Use horizontal scrolling for variable-length collections such as game cards,
  characters, powers, or future mini-games. Keep the selected item obvious and
  allow the next item to peek in when that improves discoverability.
- Do not turn every choice into a carousel. Two or three fixed actions that fit
  comfortably should remain visible together. Scrolling is appropriate when
  the item count is open-ended or when showing all items would make each one too
  small to read or touch.
- Keep primary navigation fixed while a shelf scrolls. A child must never have
  to rediscover Football, Mini-games, Settings, Back, or Play because a content
  row moved.
- Avoid nested horizontal scrollers and avoid mixing horizontal and vertical
  drag gestures in the same compact panel.
- A selected game may replace the full backdrop at 100% image opacity. Never
  blend unrelated football and mini-game backgrounds behind the same menu.
- Put player, difficulty, arena, and control details in focused setup tabs. Do
  not duplicate those controls below the discovery shelf.

Compact-phone copy should target a comfortable final CSS size after Phaser
scaling. Logical pixel values alone are not evidence of readability.

### Phone-only Casual menu

The metallic console menu is the compact-phone Casual-mode presentation.
Regular and extended tablets keep the established journey-card menus so the
working primary experience is never placed at risk by phone-specific changes.

- Keep the console implementation inside the lazy-loaded `src/game/compact/`
  bundle. Tablet scenes must not import compact menu chrome or inherit its
  layout constants.
- Reuse one phone visual language across Football, Mini-games, Settings, setup,
  Lab, help, and About: opaque navy inset panels, layered blue-metal frames,
  cyan active rails, framed previews, and a dark trapezoidal primary action.
- Preserve each game's existing background art. The console occupies the
  foreground; it does not require new arena images or blended backdrops.
- Use the installed game fonts. Do not add a network font dependency to imitate
  a concept mockup; native and offline builds must render identically.
- Every mini-game setup uses the same tab order: Players, Setup, How to Play.
  Game-specific content changes inside that contract rather than inventing new
  navigation.
- Phone touch zones may be taller than their visible controls. The compact tab
  and button primitives keep a minimum 78 logical-pixel interaction height so
  the short visual composition does not create correspondingly tiny targets.

Treat tablet and phone tester feedback as two measurements: visual preference
and task usability. A visually preferred menu that is slower or harder for a
child to operate should not automatically replace the established tablet flow.

## Coordinate model for wide stages

For a horizontal stage wider than 1280:

```text
horizontalOverflow = stageWidth - 1280
horizontalOffset   = horizontalOverflow / 2
stageLeft          = -horizontalOffset
stageRight         = 1280 + horizontalOffset
camera.scrollX     = -horizontalOffset
playable region    = 0..1280
```

The camera exposes equal space on both sides of the authored game. Content that
must cover the complete screen starts at `stageLeft` and uses `stageWidth`.
Content anchored to gameplay continues to use coordinates `0..1280`.

Be explicit about which edge a UI element belongs to:

- gameplay-edge controls remain relative to `0` or `1280`;
- fixed-to-camera device-edge controls use stage coordinates directly: left
  controls keep their 16:9 `x`, while right controls add the complete
  `horizontalOverflow` (equivalently `stageWidth - authoredRightGutter`);
- world-space device-edge controls account for camera scroll as well as the
  desired visible gutter;
- centered panels remain centered at `x = 640` after the camera is centered.

Never compensate for a missing camera offset by nudging individual panels. That
usually fixes one screen while leaving loaders, overlays, and other mini-games
off-center.

## Artwork and collision geometry

### Collision-authored art

If collision coordinates were traced from an image, the art and collision map
are one contract. Do not stretch one without regenerating and validating the
other.

Disc Hockey is the reference case:

- arena image bounds remain `0..1280`;
- arena display width remains `1280`;
- collision bounds remain `104..1176`;
- decorative left and right treatments remain outside `0..1280`;
- the camera centers the complete composition on the wider device.

Stretching the rink to 1616 while keeping its collision map at 1280 makes the
painted walls and invisible walls disagree. This is a gameplay bug, not a
cosmetic issue.

### Decorative backgrounds

Backgrounds without collision-authored landmarks may be widened, cropped, or
extended. Choose the treatment according to the art:

- use a centered cover crop when losing peripheral detail is harmless;
- use a strongly blurred and darkened continuation when the source can support
  it without creating a visible repetition;
- use bespoke, theme-aware matte wings when the central image contains precise
  architecture or a playable field;
- keep extensions low-contrast so they do not compete with gameplay.

Do not mirror or repeat a recognizable strip of arena art. Repeated spectators,
walls, lights, or machinery read as a rendering glitch. Disc Hockey therefore
uses quiet Ice and Neon matte wings rather than duplicated rink fragments.

For tall tablets, extend below the 720-high gameplay region with a deliberate
floor, frame, or themed lower band. Do not scale the gameplay vertically to
consume the extra height.

## Full-screen coverage

Every full-screen visual must cover the actual stage, not just 1280×720:

- scene backdrop and color wash;
- asset/code loading background;
- scoreboard or HUD bar intended to reach both device edges;
- pause and result shades;
- help and confirmation scrims;
- bottom extension on tall tablets.

For a centered wide camera, a common correct form is:

```js
surface.fillRect(-horizontalOffset, 0, stageLayout.width, stageLayout.height);
```

Starting the surface at `x = 0` leaves the left overflow uncovered after the
camera moves. Using width `1280` leaves one or both overflow regions uncovered.

## Setup and loading screens

Setup screens exposed the original one-sided-gap failure. A widened backdrop is
not sufficient: the scene camera must also center the 1280-wide authored UI.

Each game must validate this complete sequence:

1. hub or game-selection card;
2. setup screen;
3. code-loading screen;
4. asset-loading screen;
5. countdown;
6. active play;
7. help or instructions;
8. pause and confirmation;
9. result and restart/leave actions.

If a mini-game is lazy-loaded, test both loading layers. They are easy to miss
during local development because cached assets make them appear only briefly.

## Touch controls

- Test controls using their final CSS size, not only their logical Phaser
  radius.
- Compact-phone system controls use the larger, higher-contrast treatment. The
  regular tablet retains its established sizes and opacity.
- Phone Football's top row uses a 39.6 authored radius (10% above the former
  36), while the established tablet branch remains radius 28. On the
  representative 732×412 and Pixel-class profiles this produces a physical
  touch diameter above 44 CSS pixels. The 568×320 extreme fallback is allowed
  to scale below that target under the documented Casual-mode constraint.
- Preserve the 16:9 edge gutters when the stage widens. Do not add half the
  horizontal overflow to every control: that recenters the entire controller
  cluster and makes edge controls harder to find by feel.
- Keep action controls clear of cutouts, rounded corners, and gesture areas.
- A translucent control must still have a strong symbol and a comfortable hit
  area. Low alpha on both the surface and symbol makes a control disappear on a
  bright field.
- Pause, restart, home, help, and fullscreen actions need the same attention as
  movement and kick controls.
- Verify multi-touch ownership after repositioning a joystick or action button.
  Visual placement and interactive-zone placement must remain identical.

Safe-area values must not asymmetrically shrink or push the entire landscape
canvas. The game surface is full-bleed on short/wide touch devices; individual
edge UI handles any required inset.

## Splash screen

The web splash uses a centered `object-fit: cover` presentation so it remains
full-bleed instead of exposing letterbox bands. Splash artwork must therefore
keep the title, hero character, and other critical branding inside a central
crop-safe area.

Check the following separately:

- regular tablet crop;
- long phone crop;
- long tablet crop;
- spinner visibility and safe-area clearance;
- fade-to-white and fade-to-menu transitions;
- native Android splash assets at phone and tablet densities.

Do not stretch splash art to a new aspect ratio. Crop it proportionally.

## Known failure patterns

| Symptom | Likely cause | Corrective direction |
| --- | --- | --- |
| Gap on only one side | Stage expanded but camera stayed at `scrollX = 0`, or a wash starts at `x = 0` after camera centering | Center the camera once and cover `stageLeft..stageRight`. |
| Equal blank bars on a long phone | Fixed/FIT canvas selected instead of horizontal expansion | Verify touch and wide-aspect detection, including portrait-start fallback. |
| Painted wall and collision do not match | Collision-authored artwork was stretched independently | Restore 1280×720 art or regenerate both art and collision data together. |
| Side treatment looks like a glitch | Recognizable arena strip was repeated or mirrored | Use heavy blur/darkening or a bespoke quiet matte. |
| Pause/help is tiny or nearly invisible | Tablet-sized logical control and low alpha were reused on a phone | Apply the wide-device touch target and contrast treatment only on wide stages. |
| Controls drift inward on a long phone | Half the overflow was added to fixed-to-camera controls | Keep left controls at their authored x and add the full overflow only to right controls. |
| Gameplay is centered but pause/result leaves a strip | Overlay shade still uses 1280 width | Size all full-screen overlays from `stageLayout`. |
| Setup is centered but loader jumps sideways | Loading scene has its own fixed camera/background | Test code and asset loaders as independent scenes. |
| Regular tablet changes after a phone fix | Device-class condition is too broad | Preserve and assert the exact 1280×800 branch. |
| Wide tablet still letterboxes | Logic assumes every device with a large short side is a regular tablet | Classify by touch and aspect ratio, not by “phone” dimensions. |
| Splash has bands or distorted branding | `contain` or non-proportional scaling is used | Use centered cover cropping and crop-safe artwork. |

## Required browser regression matrix

The automated matrix is `test/responsive-layout-browser.mjs` and runs with:

```bash
npm run test:responsive:e2e
```

It currently validates:

- regular tablet: 1280×800;
- Pixel 9a-sized phone: 924×412;
- long tablet: 1920×800.

The broader journeys add 1280×720 and 844×390 coverage. When changing layout,
run:

```bash
npm test
npm run test:e2e
npm run test:disc-hockey:e2e
npm run test:responsive:e2e
npm run build
npm run android:apk
```

Responsive screenshots are written to `output/responsive-layout/`. Inspect the
images; numeric assertions cannot determine whether a side treatment looks
accidental, whether important splash art was cropped, or whether translucent
controls disappear against a bright background.

## New mini-game checklist

Before a new mini-game is considered complete:

- [ ] Its setup scene uses the shared stage layout and centered wide camera.
- [ ] Its code-loading and asset-loading states cover the complete stage.
- [ ] Its gameplay coordinate system is explicitly documented.
- [ ] Collision-authored art remains locked to its collision coordinates.
- [ ] Horizontal and vertical overflow have intentional themed treatments.
- [ ] HUD bars, pause shades, help, confirmations, and result overlays cover the
      complete stage.
- [ ] Touch controls are readable and reachable on both regular tablets and
      long phones/tablets.
- [ ] Compact-phone menus use the available horizontal space before adding
      vertical stacking, and any horizontal shelf has a clear selected state.
- [ ] Scrolling is limited to collections that genuinely need it; primary
      navigation and Play/Back actions remain fixed.
- [ ] The 1280×800 tablet layout is visually unchanged unless the feature
      explicitly requires a tablet change.
- [ ] Splash and hub cards still crop and scale cleanly after adding new art.
- [ ] `serializeState()` reports the logical stage or enough geometry to audit
      it.
- [ ] Debug diagnostics expose important artwork and collision bounds.
- [ ] The responsive browser matrix enters the setup and active gameplay scene.
- [ ] Screenshots are inspected at regular-tablet, long-phone, and long-tablet
      sizes.
- [ ] At least one real regular tablet and one real long phone receive a release
      smoke test before shipping.

## Review questions

Use these questions during implementation and code review:

1. Which objects belong to the authored 1280×720 gameplay space?
2. Which surfaces must cover the complete device stage?
3. Is any visible landmark being scaled independently from collision data?
4. What fills horizontal overflow, and does it look intentional?
5. What fills vertical overflow on a tall tablet?
6. Where do setup, loading, pause, help, and result screens get their dimensions?
7. Are controls anchored to a gameplay edge or a device edge?
8. What exact test prevents the regular tablet from regressing?
9. Which screenshot proves the long-phone result?
10. Does the new mini-game add a path to the responsive browser matrix?

If any answer is unclear, the responsive implementation is not finished.
