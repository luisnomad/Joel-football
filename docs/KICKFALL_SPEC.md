# Kickfall Mini-Game Specification

Optional reading for Kickfall behavior and acceptance. Read external/global references
only when relevant to the immediate task.

## Product intent

Kickfall is an optional, short arcade mode inside Joel Football. Soccer balls
enter a vertical obstacle course from above and roll through alternating tiers.
The player follows the flow and kicks balls into brick gates to open the route.
Balls collide with one another, the player, platforms, and intact gates. A
level is lost only when its clock expires, and cleared when every scheduled ball
leaves through the bottom drain.

The mode should create a repeating pressure-and-release rhythm:

1. Balls gather against a gate.
2. The player gets behind the nearest ball.
3. A successful kick cracks or destroys the gate.
4. The accumulated balls cascade into the next tier.
5. The player races after them before the level clock expires.

## Entry and character selection

- Enter Kickfall through the Mini-games selection and setup journey.
- Kickfall uses the currently selected player character. The existing Intro
  selector therefore allows every available character to enter the mode.
- The selected rival appears as the opposing kicker in boss levels.
- Returning to the main menu preserves the selected character and normal match
  profile.
- Campaign progress stores the highest unlocked level and last played level.
  Returning players may resume that saved level or deliberately restart Level 1.

## Loading boundary

- The small generic Kickfall loading scene belongs to the main application
  bundle so it can render immediately after the user enters the mode.
- The playable Kickfall scene is loaded with a dynamic `import()`. Vite must
  emit it as a separate application chunk.
- Exclusive assets live under `public/assets/minigames/kickfall/` and are
  requested only by the playable Kickfall scene.
- The chosen character sheet is requested only if Phaser does not already hold
  it in its texture cache.
- Loaded code and textures may remain cached for the rest of the session so a
  retry or second visit is immediate. The requirement is deferred initial
  loading, not forced unloading after every round.
- Kickfall assets are not part of the service worker's install-time shell;
  the worker fetches them in the background after the first visit so the game
  works offline (see [Development](DEVELOPMENT.md#offline-web-play)).

## Art direction and asset contract

- Cosmic Foundry is the default Kickfall theme: deep-space navy, a layered
  violet Milky Way, a blue-white Moon, distant neon city silhouettes, dark
  gunmetal lanes, cyan deck edges, and amber energy hardware.
- The previous neon maintenance-shaft presentation remains registered as the
  `workshop` theme. It is a valid fallback/alternate skin rather than duplicated
  gameplay code.
- Themes own texture keys, lazy asset manifests, palette, and ambient motion
  only. Tier positions, Matter bodies, gates, obstacles, wedges, difficulty,
  and every gameplay rule remain outside the theme registry.
- Only the selected theme's files load after entering Kickfall; neither Cosmic
  Foundry nor Workshop joins the opening application payload.
- The Cosmic Foundry background is assembled from independent base, Milky Way,
  Moon, procedural twinkle, warning, and frame layers. The Milky Way completes
  a restrained three-minute rotation. On timed levels the Moon's position maps
  to remaining time; on untimed levels it follows a slow ambient travel cycle.
  All ambient motion freezes with the game simulation.
- The pocket mechanic is represented by a shallow magnetic catch rail integrated
  into the brick deck, not an open portal. Its matching masonry cassette masks
  the continuous ramp art while its low rollers leave queued balls visible.
  Capture remains renderer-independent, and the SVG remains crisp at every scale.
- The bumper has exactly three rounded mechanical pads and stays low enough that
  ball queues remain visible. It is a readable arcade blocker, not a hazard.
- Gates use framed coral masonry with one pale central fracture. Their alpha art
  does not define collision geometry; the existing 60x112 Matter rectangle
  remains authoritative.
- Every non-top flat or uphill tier has one plain triangular receiving wedge
  against its outer wall. The mirrored wedge uses the deck palette and a single
  readable incline—no floating arrows, machinery, or label—so it looks built
  into the platform rather than added as a separate obstacle.
- Gate destruction crops debris from the production masonry texture so the
  fragments match the intact object.
- The retired danger boundary, warning meter, and intake labels are not rendered.
  The top of the board remains visually open and the clock carries the failure
  pressure.
- Full chroma sources and alpha intermediates remain under `source-assets/`;
  only trimmed/downscaled runtime PNGs live in `public/`.
- Cosmic Foundry runtime assets and authoring rules are documented in
  `docs/KICKFALL_THEMES.md`; the exact built-in image-generation briefs are in
  [optional original Cosmic briefs](archive/docs/KICKFALL_COSMIC_ASSET_PROMPTS.md).

## Campaign board

The campaign uses one validated four-tier board grammar with twenty authored
rule sets. Procedural remixing remains a later option; authored configurations
make the difficulty curve reproducible and keep every route testable.

- Logical canvas: 1280 × 720.
- Four thin tiers form a compact descending zigzag.
- Tiers may be downhill, flat, or uphill while retaining the alternating exits.
- A ball-only intake rail bounds the top queue so neglected balls stack upward;
  the player can move through the rail to get behind the queue.
- Gates A, B, and C occupy their authored tiers and block the route until broken.
- The bottom tier ends at the drain.
- Each gate blocks both the balls and player until it is broken.
- The open end of one tier drops onto the wide receiving end of the next.
- When that receiving tier is flat or uphill, its wall wedge carries the
  falling ball far enough inward for the player to stand behind it and make a
  direct kick. On uphill lanes the same wedge also acts as a chock when gravity
  returns the ball toward the entry wall. Uphill rolling is emulated as
  acceleration along the current surface angle: the shallow lane pulls gently
  toward its entry, while the wedge's much steeper angle accelerates the ball
  back inward. This surface response is applied only to a ball physically
  touching that tier's slope; it never teleports, clamps, or affects a ball on
  the lane below.
- Flat or nearly flat work space around each gate keeps kicks predictable.
- A player-only boundary prevents the character from falling through the final
  drain while balls remain free to exit.

Level 1 values are tuning starting points rather than permanent balance:

| Rule | Level 1 value |
| --- | ---: |
| Ball quota | 8 |
| Spawn interval | 3 seconds |
| Countdown | 2 seconds |
| Level clock | 90 seconds |
| Gate durability | 1 successful kicked-ball impact |
| Active layout gates | 3 |

## Authored progression

- Level 1 is the approachable baseline: eight balls, three-second spawns, a
  forgiving 90-second clock, three one-hit gates, and no secondary obstacles.
- Level 2 schedules ten balls at 2.65-second intervals and adds a 60-second
  hard clock, one catch rail, and one kick cleat.
- Level 3 introduces a flat tier. Flat tiers provide no horizontal roll assist,
  so the player must actively move each ball.
- Level 5 introduces reinforced gates. Their health pips expose the remaining
  number of valid armed-ball impacts.
- Level 6 introduces uphill tiers. Their shallow surface acceleration makes
  unattended balls backslide, so meaningful forward progress requires repeated
  kicks.
- Levels 7–9 combine faster spawns, clocks, obstacles, flat or uphill work, and
  reinforced gates without introducing another new rule.
- Level 10 is the first rival encounter. The opponent kicks unarmed balls
  backward; three player-armed ball impacts push the rival toward the drain.
- Levels 11–19 deepen the same vocabulary with tighter clocks, larger quotas,
  more obstacles, stronger gates, and mixed tier modes.
- Level 20 is the finale: eighteen balls, three-hit gates, three obstacles,
  uphill and flat tiers, and a five-hit rival.
- Retry preserves the current level. Continue unlocks and starts the next
  authored level through Level 20; the finale offers Retry and Main Menu.

The catch rail and kick cleat affect balls only. An ordinary rolling ball is
retained. A clean direct kick releases it immediately, while a deliberate kick
through a connected queue sends diminishing force to the captive ball. The trap
stores that pressure briefly and releases only after its type- and
difficulty-specific resistance is reached. Random pile pressure remains
invalid because only player-armed impulse is transmitted.
Obstacle capture is lane-scoped: the ball must be detected on the obstacle's
authored tier and vertically near that ramp. Sharing the same horizontal
coordinate from a tier above or below never captures or teleports the ball.

## Controls and traversal

- Desktop movement: A/D or Left/Right.
- Desktop tier transfer (one-tap, audit H3, 2026-10-08): a single press of
  W/Up or S/Down moves one tier in that direction. Each press transfers once;
  holding the key does not chain transfers. Up on the top tier and Down on the
  bottom tier do nothing.
- Desktop jump: Space, always a free jump (it no longer combines with a
  vertical direction).
- Desktop kick: X or K.
- Touch exposes the joystick plus separate Jump and Kick controls. Flicking
  the stick straight up or down (the straight vertical sectors) transfers one
  tier. Diagonal sectors only run, so a diagonal sweep while running or jumping
  never changes lane by accident.
- P, Escape, or the visible Pause control freezes simulation and opens the same
  three-action hierarchy as the football match: Resume, Restart Level, and
  Leave Kickfall.
- Leaving an active level always opens a confirmation overlay. Stay returns to
  the existing pause menu; Leave returns to Intro. Unlocked campaign progress
  remains saved even though the current run is discarded.
- A tier transfer is a short, readable move to exactly one adjacent tier.
  The character uses the jump pose during the transfer, but this is a distinct
  lane-navigation action rather than the free jump.
- Tier direction is briefly buffered so a press made on the edge of a landing
  still triggers. If the straight corridor is occupied, the transfer checks a
  few nearby landing positions and uses the first clear path rather than
  silently discarding the input.
- A tier transfer is refused when an intact gate or ball occupies its vertical
  corridor. The player therefore cannot use tier navigation to phase through
  the solid puzzle objects.
- Platforms remain physical for the player and balls. Balls still descend only
  through the alternating open ends.
- Balls and gates always remain solid to the player.
- The player can push balls slowly through body contact, but kicking supplies
  the useful routing impulse.
- The character cannot jump over an intact full-height gate.

## Ball and gate rules

- Kickfall balls are independent Matter bodies with ball-versus-ball collision
  enabled; the normal match ball remains unchanged.
- A kick connects only when a small strike circle at the character's forward
  foot overlaps the ball collider. Proximity alone never launches or arms a ball.
- The struck ball receives forward velocity, a small lift, spin, and an
  approximately 0.65-second armed window.
- Only player-armed impulse can damage a gate.
- Gate contact is checked while the armed window is active instead of relying
  exclusively on `collisionstart`. This covers a ball already resting against
  a gate when kicked.
- One kick cannot damage the same gate or trap more than once.
- Gravity, rolling contact, and pile pressure never damage gates.
- Ramps use a small downhill roll assist so an unblocked ball quickly reaches
  the next gate instead of creeping across the long tier. A kicked ball keeps
  its stronger kick velocity.
- Flat tiers have zero horizontal roll assist. World gravity remains active for
  jumps and tier drops, but balls on the lane do not advance without contact.
- Uphill tiers use a modest reverse roll assist. Balls can climb them after a
  kick, then backslide if the player leaves them unattended.
- The cyan catch rail is the stronger magnetic trap. It centers an unarmed ball
  until a direct kick or enough rapidly accumulated queue pressure frees it in
  the lane's flow direction.
- The amber kick cleat has medium hold strength. It retains an unarmed ball
  immediately upstream but yields to less queue pressure than the catch rail.
- Each obstacle captures only its lead ball. Later balls remain ordinary
  colliding Matter bodies and form a visible queue behind it; kicking near a
  queue prioritizes the captive lead ball so the obstacle remains clearable.
- Obstacles are reusable: every arriving ball must be kicked through, rather
  than permanently disabling the obstacle after the first success.
- Breaking a gate removes its Matter body, emits brick fragments, triggers
  impact feedback, and releases the queue immediately.
- Reinforced gates lose one visible health pip per valid armed-ball impact and
  remain solid until their final hit.
- Force retains 84% of its value per connected ball. Gaps break the pressure
  chain. Rapid kicks into the same lane and direction build a capped
  1.0×/1.25×/1.5× pressure combo.
- Trap resistance and pressure decay vary by the selected Kickfall difficulty;
  transmission and movement physics do not. See `docs/FORCE_SYSTEM.md` for the
  reusable API, exact tuning, invariants, diagnostics, and future Football use.

## Rival encounters

- Boss encounters occur at Levels 10 and 20 and use the currently selected
  rival character.
- The rival patrols the bottom lane, physically blocks the player and balls,
  and kicks ordinary incoming balls backward.
- A ball only damages the rival after a real direct-contact player kick arms it.
  The same armed ball cannot inflict repeated damage from lingering contact.
- Each valid hit staggers the rival toward the final drain. The last required
  hit removes the rival from the route and sends them through the drain.
- Boss-level victory additionally requires the rival to be defeated; draining
  the ball quota alone is not enough.

## Spawn, timers, victory, and defeat

- The first ball enters when the opening countdown finishes.
- Further balls enter on the fixed spawn schedule until the quota is reached.
- A blocked intake delays the next spawn but never causes an independent defeat.
- Every authored level has a clock. A level ends in defeat only when that clock
  reaches zero; countdown time, pause, and result overlays do not consume it.
- A live kick charge transfers forward through a contiguous physical queue one
  touching ball at a time. Each handoff retains 90% of the previous ball's
  impact power, so a direct strike still opens a normal gate but a dense queue
  needs two or more deliberate rear kicks. This lets every kick make progress
  without turning either a pile-up or its solution into an all-or-nothing event.
- A ball counts as drained only after falling through the bottom-left exit.
- Victory requires `spawned === quota`, `drained === quota`, and no active
  balls remaining. Boss levels also require the rival to be defeated.
- Victory and defeat freeze play and show Retry plus Main Menu. Victory exposes
  Continue only when a later authored level exists.

## Stars and combos (audit H1–H2, 2026-10-08)

Rules live in `kickfallRules.js` (`resolveKickfallStars`, `stepKickfallCombo`);
the thresholds are tuning starting points pending an owner playtest.

- **Stars (0–3, victory only):**
  - 1 star: clear the level.
  - 2 stars: also finish with at least 35% of the clock left. On an untimed
    level, finish within 1.4× the spawn schedule.
  - 3 stars: also show skill, with a gate-break combo of 2+ or at most 30% of
    kicks touching no ball (a wasted kick).
- The result panel shows the run's stars as a badge on its top edge. The
  profile keeps each authored level's best result in `kickfall.stars`,
  sanitised to integers 0–3, and a replay never lowers it. The Kickfall card
  in the Mini-games selection (tablet and phone) shows the total out of 60
  next to the Continue level.
- **Combos:** a gate break within 6 seconds of the previous one chains a combo,
  with the multiplier capped at ×3. A combo of 2+ shows a gold "COMBO ×N!"
  banner, extra impact bursts, a camera shake and the power-up sound.
- **Full cascade:** when the level's last gate breaks, play runs at 0.4× speed
  for 0.6 s, scaling Matter's timing. Slow motion always ends before the result
  panel.

## Character fairness

- Character artwork, native facing, visible run frames, and modest speed/jump
  identity are reused.
- Kickfall calibrates every sheet to the shared authored foot anchor, keeping
  feet registered to the physical ramp. Player air drag is low and falling
  accelerates after the jump apex so jumps remain short and responsive.
- The compact board uses a smaller character collider and sprite, smaller
  balls, and thinner platforms so four tiers remain legible at 1280 × 720.
  Gameplay geometry comes from an explicit collision profile. Dad and Mum
  deliberately use larger bodies and matching strike sensors; `visualScale`
  never changes collision geometry implicitly.
- Gate damage is a discrete valid-kick event rather than raw velocity damage,
  so a lower kick statistic does not require extra hits.
- Board dimensions must be playable by the slowest and lowest-jumping
  available character before randomized layouts are introduced.
- If competitive leaderboards are added, movement and jump tuning should be
  normalized or scores should be separated by character.

## Future level generation

Do not place arbitrary platforms and gates independently. Generate boards from
validated tier modules with an explicit directed route:

- Each module declares its ball entry, flow direction, exit, required gate,
  player approach side, capacity, and receiving tier.
- A layout validator confirms that every required gate can be approached from
  upstream and that every open route reaches the drain.
- Parameter randomization may adjust gate position, tier length, decorations,
  durability, spawn schedule, and module order within safe ranges.
- A stored seed makes Retry reproduce the same layout.
- Physics simulation is not treated as the sole solvability proof; handcrafted
  route constraints remain authoritative.

The authored campaign introduces one major pressure axis at a time:

| Stage | Primary addition |
| --- | --- |
| 1–2 | Core downhill loop, clock, catch rail, and cleat |
| 3–5 | Flat tiers and reinforced gates |
| 6–9 | Uphill tiers and combined obstacle pressure |
| 10 | Three-hit rival encounter |
| 11–19 | Mixed modes, larger quotas, tighter clocks, stronger gates |
| 20 | Five-hit rival finale with the full challenge vocabulary |

## Architecture

- `MiniGameLoadingScene`: immediate shell, dynamic code import, transition.
- `KickfallScene`: Phaser orchestration, assets, Matter bodies, input, HUD,
  feedback, results, diagnostics, and deterministic stepping.
- `kickfallRules.js`: renderer-independent constants and state transitions for
  armed gate hits, queue charge transfer, buffered jumps, draining, and terminal
  states.
- Kickfall-specific player and ball behavior must not add multi-tier assumptions
  to the normal `Fighter` or singleton assumptions to the normal `Ball`.
- All runtime state exposed through diagnostics should be concise and limited
  to the current level, active player, balls, gates, obstacles, counters,
  timers, and available actions.

## Campaign acceptance criteria

- Intro visibly offers Kickfall in English and Spanish.
- Changing the selected player changes the character used by Kickfall.
- Entering Kickfall renders a loading screen before its exclusive assets load.
- Production build emits a distinct Kickfall JavaScript chunk.
- Physical balls spawn and collide with each other across all twenty levels.
- The player collides with balls, tiers, and intact gates.
- Kicking a ball toward each of the three gates breaks it and releases the
  queue.
- A/D or Left/Right produces responsive movement with a distance-driven run
  cycle (KICKFALL_RUN_FRAME_DISTANCE travel per phase, about 10 visual steps
  per second at full speed); feet only cycle while the character is genuinely
  covering ground, so no foot sliding at low speed and no flicker at high speed.
- Up/Down alone does not transfer; Space + Up/Down transfers exactly one tier,
  while Space alone remains a normal jump.
- Jump input is buffered across imminent landings. If Space + Up/Down requests
  an unavailable lane, it falls back to a normal jump instead of being discarded.
- Unkicked balls cannot destroy gates.
- Kicking the rear ball in a touching queue transmits one attenuating armed
  charge to the front ball. A seven-ball Level 1 queue damages the gate on its
  first kick and breaks it on the second.
- Balls exit only through the final drain and increment the drained count.
- The level reaches a visible victory state after all eight drain.
- Continue advances through every unlocked authored level up to Level 20.
- Level 2 visibly contains the pocket and cleat, retains unarmed balls at each,
  and releases them after a correctly directed real kick.
- Multiple balls at a Level 2 obstacle remain visibly separated in a physical
  queue, with only the lead ball held by the obstacle.
- A catch-rail attraction always completes even if its owned ball is displaced
  outside the initial lane-tolerance check; it cannot remain suspended forever
  while later balls bypass it.
- Level 2 obstacles ignore balls that pass through the same horizontal position
  on another tier.
- Level 2 reaches a distinct timeout defeat when its 60-second clock expires.
- Retry from Level 2 preserves Level 2 and resets its clock and obstacles.
- Level 3 includes a flat tier whose untouched ball does not advance.
- Non-top flat tiers mirror a physical triangular wedge at their receiving edge;
  a falling ball clears the wall before becoming stationary and kickable.
- Seven unattended balls backrolling on the Level 7 uphill receiver remain a
  broad horizontal lane queue after six seconds; the wedge cannot turn them
  into a vertical column and cannot influence balls on another tier.
- Level 5 contains a reinforced gate that survives its first valid impact.
- Level 6 contains an uphill tier whose unattended ball backslides.
- Levels 10 and 20 contain rivals that counter-kick ordinary balls, take only
  player-armed impacts, and must be defeated before victory.
- Clearing a level unlocks the next level and persists progress. Re-entering
  Kickfall offers Continue at the saved level or Start from Level 1.
- No danger stripe, warning meter, danger diagnostics, or danger defeat remains.
- P, Escape, and the HUD Pause control freeze the countdown, level clock,
  simulation time, player, and balls. Resume continues the same run.
- Restart Level resets the current run. Leave Kickfall requires confirmation;
  Stay restores the pause menu and Leave returns to Intro.
- Retry resets balls, gates, timers, and counters.
- Main Menu returns to Intro cleanly.
- `render_game_to_text()` describes loading, active play, and result states.
- `advanceTime(ms)` advances the mini-game deterministically for browser tests.
- Unit tests, production build, and browser verification pass without new
  uncaught errors.

## Explicitly outside the authored campaign

- Fully procedural layouts.
- Currency, rewards, leaderboards, and cross-device account sync.
- Levels beyond the twenty authored configurations.
- Moving gates, damaging hazards, power-ups, and special ball types.
- Normal-match power meter, lob, dash, chilena, combat, opponent AI, and goals.
- New soundtrack, a complete board re-theme, or animated obstacle state sheets.
