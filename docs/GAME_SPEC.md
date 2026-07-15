# Joel Football — Product and Acceptance Specification

The project was originally developed under the working title “Skyhead
Showdown.” Its V1 product requirements remain recorded below; the shipped name
is Joel Football.

## Mission

Build an original, playable 2D browser arcade-football game inspired by the
gameplay dynamics of the Head Soccer genre. The supplied screenshot is visual
reference only and must not be shipped, traced, copied, or used as a source
asset.

## Product principles

- Fast matches with readable, predictive ball physics.
- A huge head is both the main shield and the main aerial weapon.
- Kicks are fast and direct; jumps trade ground coverage for aerial control.
- Physical pressure is useful but brief, with counter-play and recovery.
- Power shots are earned, dramatic, and defendable.
- Original art, names, characters, arena, effects, and interface.
- One canvas, responsive presentation, keyboard and touch controls.

## Required experience

### Flow

1. A polished intro screen presents the game title, a play action, concise
   controls, and audio preference.
2. Starting a match transitions into the arena and kicks off after a short
   countdown.
3. The human controls the left player. A provider-driven opponent controls the
   right player.
4. A match lasts 90 seconds. The higher score wins; a tied score enters sudden
   death.
5. After each goal, both fighters immediately return to their kickoff
   positions, default facing, neutral idle sprite frame, and untinted visual
   state for the full countdown.
6. A result overlay supports an immediate rematch or return to the intro.
7. Escape/P pauses and resumes. F toggles fullscreen. R restarts a match.
   Touch layouts provide equivalent pause, resume, restart, menu, and
   fullscreen buttons without displaying keyboard-only instructions.
8. A referee whistle sounds once for each visible countdown second and once
   for a goal, replacing the former goal cheer. Countdown seconds 3 and 2 use
   clipped 180 ms beeps; second 1 uses the full recording, creating a
   beep–beep–beeeeeep cadence. The result signal is exactly three consecutive
   full whistles and is emitted only once per finished match.
9. The home screen opens a bilingual Match Playground where the player chooses
   a persistent field and kickable object before starting. The current choice
   survives refresh, rematch, Settings, and Power Lab navigation.

### Field and object customization

- Fields include three complete background illustrations: the classic
  Skycourt, a newly illustrated Neon Grid night stadium, and a newly illustrated
  Sunset Beach arena. They share gameplay-safe geometry while changing the
  architecture, crowd, environment, lighting, and playing surface—not merely a
  color treatment. Goal and player contrast remains readable.
- Classic and Neon football designs are cosmetic peers and use exactly the
  same balanced physics.
- Party Balloon uses a larger round collider, partial buoyancy, high
  restitution, strong air drag, reduced terminal speed, and extra lift.
- Rugby Ball uses an oval visual, strong spin, and deterministic asymmetric
  surface deflections so ground bounces are awkward without becoming random or
  untestable.
- Soda Can uses a chamfered rectangular collider, extra ground friction,
  tumbling spin, and moderate energy loss.
- Cannonball is dense, low-restitution, low-drag, speed-limited, and responds
  weakly to ordinary kick lift.
- Every object exposes its effective radius/material contract to strike reach,
  swept power collision, bounds recovery, crossbar release, diagnostics, and
  full-ball goal-mouth scoring.

### Human controls

- Move: A/D or Left/Right.
- Directional dash: double-tap either movement direction within 280 ms. The
  chosen arrow remains authoritative: toward the rival challenges them, while
  the opposite arrow creates a reverse defensive dash or a goalward escape.
  It cannot begin in mid-air and retains the normal dash cooldown.
- Jump: W, Up, or Space.
- Kick: X or K.
- Lob: Z or I; Up + Kick is an alternate chord. The lob trades horizontal
  velocity for enough upward lift to clear a grounded opponent and creates a
  parabolic interception opportunity. Its trajectory is distance-adaptive:
  defenders within the close band trigger a bounded maximum-height arc with
  substantial head clearance, while increasing distance progressively trades
  height for horizontal reach and still targets landing space beyond them.
- Power shot: V or J, available only with a full meter.
- Boosted basic kick: repeat either kick button during the current kick/lob
  animation. Up to three extra presses borrow at most 24 meter only when the
  ball is actually hit. A drive gains up to 27% speed; a lob gains up to 27%
  lift and 16% speed. Neither exceeds the standard full-meter power shot.
- Chilena: press the normal Kick twice under a reachable overhead ball for the
  direct goal-centered bicycle kick. Press Lob twice for a high chilena: the
  ball first rises to an apex almost touching the underside of the score display, then redirects from
  that apex toward the center of the opponent's goal. Normal player collision
  remains active, so the defender can block or counter either variant.
- Touch controls expose every gameplay action plus pause, restart, menu, and
  fullscreen on pointer-capable coarse/touch devices.

### Physics and collision dynamics

- The player consists of a large circular head/body collision region and a
  short-lived forward kick sensor.
- The selected ball/object uses continuous-feeling arcade physics with its
  configured gravity response, spin/rolling, wall bounce, terminal speed,
  density, restitution, air drag, and reliable collision groups.
- A late/poorly positioned head contact can deflect the ball backward.
- Kicks add a strong horizontal impulse with a smaller lift component.
- The ball-kick sound plays only when a kick actually contacts the ball; a
  missed swing is silent. Kick poses do not display a synthetic oval or strike
  sensor marker beside the character.
- Goals have physical posts/crossbars; the ball can ricochet off them.
- If a slow ball settles on the flat top of either crossbar, it is returned
  toward the playable pitch after a brief dwell instead of remaining stuck.
- A goal counts only when the ball fully crosses a goal line below the bar.
- Goal detection evaluates the one-time swept line crossing at high speed and
  requires the full ball to fit below the crossbar and above the pitch. A shot
  that crosses above the bar cannot become a goal later by falling behind the
  line. Any shot that tunnels completely off-screen is rebounded into view.
- Both players can cross midfield and use the full playable pitch, but cannot
  enter the space behind either goal line.

### Movement and combat

- Ground movement has quick acceleration, braking, a high arcade max speed,
  and stable footing.
- Running must feel fast for the confined arena and use a distance-driven
  four-phase contact/passing/contact/passing cycle instead of sliding or
  alternating directly with the idle drawing.
- Kicks visually progress through anticipation, contact, and recovery while
  retaining the existing strike window, boost taps, and cooldown timing.
- Normal running retains one consistent speed; there is no sustained sprint
  mode. Directional double-tap dash is the single burst-movement mechanic.
- Before overtaking the defender, each player always faces the rival goal;
  retreating is a backpedal and cannot accidentally aim a shot at their own
  net. After overtaking the defender, horizontal movement may turn the attacker
  back toward the defender, while continuing toward goal keeps the goal-facing
  orientation.
- Jump is ground-gated, has responsive air steering, and returns quickly enough
  that a failed aerial defense creates a short rather than prolonged opening.
- Directional dash provides a short burst in the chosen arrow direction and
  has a visible cooldown.
- Direct kick/dash contact briefly stuns and visibly knocks back the opponent.
- Stun has a strict short duration and recovery protection to prevent an
  endless stun lock.

### Power economy and counter-play

- Each player has a 0–100 power meter.
- The meter charges passively and gains more on meaningful ball contacts and
  defensive blocks.
- With a full meter, a power kick consumes the meter and imbues the next valid
  ball strike with a high-speed comet effect.
- A defender who makes a well-timed kick/head block during the counter window
  reverses the power ball, gains extra velocity, and earns meter.
- A power shot expires after a bounded duration and is never an automatic goal.
- Boosted basic kicks flash the spending player's meter and use a stronger
  impact effect. A miss spends no energy.

### Provider-based opponent

- The scene depends on an `AgentProvider` contract, not a concrete bot.
- The contract receives a compact immutable world snapshot and returns an
  action intent: horizontal movement plus jump, kick, lob, directional dash,
  power, and optional kick-boost fields.
- The included heuristic provider predicts ball landing/intercept position,
  guards the right-side defensive third, attacks favorable balls, jumps for
  reachable aerial threats, lobs over a nearby blocking defender, attempts
  counter-kicks, and uses dash/power with cooldown awareness.
- A human-input provider is included or trivially constructible through the
  same contract, demonstrating replaceability by multiplayer or an external
  system/LLM.
- Provider failures must fail safe to a neutral intent rather than crash the
  match.
- Persistent Easy/Normal/Hard difficulty is selected in bilingual Settings.
  Easy strips directional-dash and kick-boost intents from every AI provider at the scene
  boundary; Normal and Hard may use the same mechanics as Joel, with Hard
  requesting them more aggressively. Human providers are never stripped.

### Presentation and original assets

- Original bright rooftop/sports arena with depth, crowd energy, goal frames,
  turf, and sky. It may echo the broad genre mood but not the supplied game's
  composition or branding.
- Two original rival characters with distinct silhouettes and colors, oversized
  expressive heads, small bodies, and readable facing direction.
- Tablet gameplay controls use highly transparent crystal-glass surfaces with
  subtle rims and strong symbols so players, the ball, and goals remain visible
  beneath the controls.
- Original ball, UI marks, power/comet effect, particles, and subtle impact
  feedback.
- The generated art must be committed under `public/assets/` and may not depend
  on the reference screenshot at runtime.
- Assets must render cleanly at the game's target 16:9 logical resolution and
  scale responsively.

### Architecture

- Use a proven 2D JavaScript engine: Phaser 3 with its Matter physics
  integration.
- Vite + modern JavaScript modules; no bespoke engine and no vanilla-canvas
  gameplay implementation.
- Components/modules have narrow roles: configuration, scenes, entities,
  providers, pure gameplay helpers, input, UI, and audio.
- Prefer pure functions for decisions, snapshots, meter math, scoring helpers,
  and state transitions. Keep Phaser mutation at scene/entity boundaries.
- Avoid inheritance-heavy design, global mutable state, and unnecessary
  frameworks.

### Testability and diagnostics

- Unit tests cover power economy, world-snapshot shaping, prediction, provider
  intent, score/result rules, and pure physics helpers.
- Browser tests exercise intro → match, movement, jump, kick, dash, power,
  pause/resume, goal/result/reset paths where deterministic hooks allow.
- Expose `window.render_game_to_text()` with the current mode, coordinate system,
  timer, scores, player states/cooldowns/meters, ball state, power ownership,
  and active controls.
- Expose `window.advanceTime(ms)` to deterministically advance game updates for
  browser automation.
- No uncaught browser console errors during validated flows.

## Definition of done

- `npm run dev` starts a playable browser build.
- `npm run build`, unit tests, and browser gameplay checks pass.
- Desktop and touch controls work and are readable on the intro screen.
- Screenshots are inspected at intro, active play, power-shot play, pause, and
  result states; gameplay remains legible at desktop and mobile aspect ratios.
- A final independent reviewer checks this document and the original request,
  reports omissions, and every material finding is fixed or explicitly noted.

## V2 — Joel's bilingual Power Lab

### Identity and navigation

- The human-controlled left player is named Joel everywhere visible and in
  gameplay diagnostics; existing art remains original and unchanged.
- The intro offers `Play Match`, `Power Lab`, sound, and a persistent
  `English / Español` language switch.
- English and Spanish cover the intro, Power Lab, match announcements, pause
  and result overlays, controls copy, power names, and feedback messages.

### Learning and inventory loop

- The Power Lab presents five collectible superpowers and four selectable math
  operations: addition, subtraction, multiplication, and division.
- The age-nine difficulty profile uses two-digit addition, subtraction with
  two-digit subtrahends and results of at least ten, multiplication from 3×3
  through 12×12, and exact division using divisors/quotients from 3 through 12.
  Division never presents fractions or division by zero.
- Joel selects a power, then the system randomly selects the operation for a
  four-choice problem. The player cannot choose an easier operation family.
  An incorrect answer awards nothing, closes the attempt, and starts a global
  five-minute Power Lab cooldown so the choices cannot be brute-forced. The
  cooldown deadline persists across navigation and reloads and is shown as a
  live bilingual countdown. A correct answer adds exactly one charge to the
  selected power with no cooldown.
- Charge counts, selected language, the single equipped power, and any active
  math cooldown deadline persist in local storage with schema validation and
  safe defaults.
- Only a power with at least one earned charge can be equipped. Equipping a
  different power atomically replaces the previous selection.

### Superpower catalog

Powers have one of two explicit activation rules. Shot powers augment Joel's
next successful full-meter strike, and a miss does not consume their charge.
Instant powers activate and consume their charge as soon as the power button is
pressed at 100%. The ordinary meter power remains available when no equipped
charge is available.

1. Fireball / Bola de fuego — hotter trail and stronger shot velocity.
2. Ice Freeze / Congelación — instantly freezes the opponent for two seconds,
   independent of ball contact.
3. Big Guy! / ¡Tío Grande! — Joel grows smoothly to twice his normal size for
   ten seconds, then smoothly returns to normal.
4. Shield / Escudo — instantly grants protection from the next physical stun.
5. Hyper Mode / Modo turbo — instantly boosts Joel's run, jump, and dash for
   five seconds.

Profiles from the former ten-power catalog preserve progress: Lightning,
Tornado, Rocket, Boomerang, and Warp charges are consolidated into Fireball,
and retired equipped powers migrate to Fireball.

### Match presentation and rules

- The HUD shows the equipped power and remaining charge count without covering
  gameplay. Power-shot trail color communicates a shot special. Active
  character effects use a pulsing sprite-local glow, contrast tint, and small
  particles instead of a generic circle around the fighter.
- Power activation callouts use short localized labels and are automatically
  reduced to a bounded width instead of expanding across the full playfield.
- Shot charges are consumed only after the powered ball strike succeeds;
  instant charges are consumed on activation. Every effect has a bounded
  duration or a single explicit use and is cleared safely between rounds.
- Countering an enhanced shot removes its character-specific secondary effect;
  the defender returns a normal counter-power shot.
- The provider-driven AI continues to use the standard meter power and does not
  spend Joel's persistent inventory.

### V2 verification

- Pure tests cover all math generators, answer choices, bilingual lookup,
  inventory earning/equipping/consumption, retired-power migration, the five
  focused powers, and goal-centered chilena aiming.
- Browser tests cover language switching and persistence, Lab navigation,
  incorrect/correct answers, charge accumulation, equipping, match HUD state,
  successful charge consumption, and one representative gameplay effect.
- Desktop and tablet screenshots are inspected for the English intro, Spanish
  intro, Power Lab grid, math challenge, success state, and equipped match HUD.
