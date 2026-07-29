# Disc Hockey mini-game specification

## Product goal

Add a fast, child-friendly, top-down disc hockey mini-game to Joel Football.
Each side moves a round engraved character pusher, strikes a themed puck, and scores through
the rival goal. A match supports either one local player against the computer
or two local players sharing one tablet.

## Bundle and scene boundaries

- The initial application bundle contains only mini-game metadata, setup UI,
  and the generic loading scene.
- Disc Hockey gameplay, rules, AI, and arena rendering live under
  `src/game/minigames/discHockey/` and enter the build through a dynamic
  `import()`.
- Kickfall continues to enter through its own dynamic `import()`. Neither
  gameplay scene may be imported statically by `src/main.js`, the mini-game
  menu, or the setup scene.
- The loading scene resolves a small registry entry by game id and registers
  the returned Phaser scene only when the player starts that mini-game.

## Setup and shared profile

- Reuse the globally selected player and opponent. Both portraits are shown in
  Disc Hockey setup, and either can be cycled without creating a second lineup
  store.
- Persist an independent Disc Hockey difficulty (`easy`, `normal`, `hard`),
  play mode (`computer`, `local`), and arena theme (`ice`, `neon`).
- Kickfall keeps its campaign-specific resume flow. Disc Hockey starts a fresh
  match from its setup screen.

## Match rules

- The authored logical arena is 1280 × 720 in landscape.
- The scoreboard reserves approximately the top 5% of the screen. Static
  audience bands sit beyond the rink along its long edges.
- Player 1 starts on the left and may never cross the center line. Player 2 or
  the computer starts on the right and follows the mirrored restriction.
- Character discs collide with the puck and with their own rink boundaries,
  but the two character discs cannot enter the other side.
- The table uses air-hockey motion: normal strikes lose speed very slowly and
  wall impacts retain most of their energy. Only movement below the dedicated
  soft-hit threshold receives strong settling drag and eventually stops.
- Each theme has its own invisible vector collision map traced from the inner
  edge of that arena image. Player and puck radii are inset from the nearest
  contour segment, angled impacts reflect along the local wall normal, and the
  puck can pass through the mapped goal mouths.
- The puck may cross midfield. Each invisible scoring plane follows the mouth
  of the goal painted into that arena, and a goal is awarded once 40% of the
  puck diameter overlaps the recess while the whole puck fits vertically
  inside its mouth.
- After a goal, play pauses briefly and resets both players and the puck.
- A match contains three minutes of active play. Countdown, goal celebration,
  app suspension, and manual pause time do not consume the match clock.
- The higher score at 0:00 wins; equal scores produce a draw. Rematch and
  return-to-setup actions are available from the result overlay.
- Pause, resume, restart, and leave actions remain available during play.

## Controls and multi-touch

- On touch devices, a touch beginning on the left half owns Player 1 until that
  pointer is released. In local mode, a touch beginning on the right half owns
  Player 2 independently.
- Pointer movement supplies a target position. Touch-owned pushers follow it
  through a direct, speed-capped path that cannot overshoot or oscillate around
  the finger; their measured movement velocity still drives puck strikes.
- Both local players pass through that same touch-motion path and therefore
  use identical maximum speed tuning.
- Pusher artwork and circular collision radii are 10% larger than the original
  Disc Hockey release.
- Every target is clamped to its player's legal half and to the rink.
- Multiple active Phaser pointers are required; one player's release must not
  interrupt the other player's pointer.
- Desktop testing/fallback controls use arrow keys for Player 1, matching the
  other games. Local two-player mode adds WASD for Player 2.

## Computer opponent

- Every difficulty actively chases a reachable puck on its own half instead of
  waiting at the goal. It approaches from the goal side so contact sends the
  puck toward Player 1.
- Easy reacts slowly, moves below player top speed, and hangs back when the
  puck is across midfield.
- Normal reacts faster, steps toward midfield, and tracks predicted puck
  movement.
- Hard reacts almost immediately, patrols just beyond the center line, and
  attacks slow midfield contests on a shallow angle so opposing pushers cannot
  pin the puck head-on.
- The AI obeys the same half-rink boundary and movement limits as a human.

## Arena themes

### Ice

- Bright white/blue ice with crisp blue-red rink markings, subtle skate
  scratches, and readable dark scoreboard text.
- Pushers use a frosted silver medallion, navy rubber bumper, and a dark
  embossed relief made from the selected character's head and shoulders.
- The puck is glossy red enamel with a steel collar and icy cyan vents.

### Neon

- Deep charcoal/navy field with glowing yellow-gold rink lines and hot
  red-orange goal accents.
- Pushers use a black ceramic medallion with a warm engraved relief. Their
  silhouettes remain crisp without any generated glow surrounding the pieces.
- The puck is a black ceramic energy disc with an asymmetric red-orange core
  and segmented gold accents so its rotation remains readable. Its light is
  contained inside the sprite rather than rendered as an external halo.
- Purple and pink are not used in this theme.

Both themes share the same rules and collision solver while using
image-specific wall and goal geometry.
Each arena and its matching pusher/puck sprites are loaded only after that
theme is selected; the inactive theme remains outside both the initial bundle
and that match's network requests. Character engravings are generated once at
runtime from the already-loaded global portrait textures using layered
grayscale highlight and shadow passes rather than circular portrait frames.
The collision maps stay inside the same lazy gameplay module. They are never
rendered: only the midfield separator, centre circle, and centre spot are drawn
over the arena artwork. The glowing side recesses already painted into each
image are the goals; their mouths and 40%-overlap scoring planes are invisible
mapped areas.

## Audio and orientation

- Reuse the main football music rotation, audience ambience, ball impact,
  whistle, click, success, and impact sounds. No new audio payload is added.
- Entering Disc Hockey requests landscape orientation through the platform
  service. Android also retains its manifest-level landscape enforcement.
- Web orientation lock is requested when the browser permits it (normally
  fullscreen/installed mode). The logical game surface itself always stays
  landscape and is scaled rather than re-authored for portrait.

## Diagnostics and verification

- `window.render_game_to_text()` reports mode, theme, play mode, phase,
  score, three-minute clock, match result, both players (including controller and pointer id),
  puck position/velocity/speed and air-table coefficients, the computer's
  current target/tuning, arena bounds, and legal half bounds.
- `window.advanceTime(ms)` advances Disc Hockey in fixed deterministic steps.
- Pure tests cover profile sanitization, half-rink clamping, circle collision,
  goals, direct touch following, clock formatting, AI difficulty tuning, and
  timed match result rules.
- Browser validation covers lazy loading, setup selections, a live match,
  independent simultaneous pointers, half restrictions, scoring/reset, pause,
  result/rematch, both themes, and console errors.
- Production output is inspected to confirm separate Kickfall and Disc Hockey
  JavaScript chunks.
