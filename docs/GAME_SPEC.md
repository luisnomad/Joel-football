# Skyhead Showdown — Product and Acceptance Specification

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

### Human controls

- Move: A/D or Left/Right.
- Jump: W, Up, or Space.
- Kick: X or K.
- Lob: Z or I; Up + Kick is an alternate chord. The lob trades horizontal
  velocity for enough upward lift to clear a grounded opponent and creates a
  parabolic interception opportunity.
- Dash: C or L.
- Power shot: V or J, available only with a full meter.
- Touch controls expose every gameplay action plus pause, restart, menu, and
  fullscreen on pointer-capable coarse/touch devices.

### Physics and collision dynamics

- The player consists of a large circular head/body collision region and a
  short-lived forward kick sensor.
- The ball uses continuous-feeling arcade physics with gravity, spin/rolling,
  wall bounce, a terminal speed, and reliable collision groups.
- A late/poorly positioned head contact can deflect the ball backward.
- Kicks add a strong horizontal impulse with a smaller lift component.
- Goals have physical posts/crossbars; the ball can ricochet off them.
- If a slow ball settles on the flat top of either crossbar, it is returned
  toward the playable pitch after a brief dwell instead of remaining stuck.
- A goal counts only when the ball fully crosses a goal line below the bar.
- Both players can cross midfield and use the full playable pitch, but cannot
  enter the space behind either goal line.

### Movement and combat

- Ground movement has quick acceleration, braking, a high arcade max speed,
  and stable footing.
- Running must feel fast for the confined arena and visibly alternate planted
  and extended-leg poses instead of sliding a static sprite.
- Before overtaking the defender, each player always faces the rival goal;
  retreating is a backpedal and cannot accidentally aim a shot at their own
  net. After overtaking the defender, horizontal movement may turn the attacker
  back toward the defender, while continuing toward goal keeps the goal-facing
  orientation.
- Jump is ground-gated, has responsive air steering, and returns quickly enough
  that a failed aerial defense creates a short rather than prolonged opening.
- Dash provides a short horizontal burst and has a visible cooldown.
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

### Provider-based opponent

- The scene depends on an `AgentProvider` contract, not a concrete bot.
- The contract receives a compact immutable world snapshot and returns an
  action intent: horizontal movement plus jump, kick, dash, and power booleans.
- The included heuristic provider predicts ball landing/intercept position,
  guards the right-side defensive third, attacks favorable balls, jumps for
  reachable aerial threats, lobs over a nearby blocking defender, attempts
  counter-kicks, and uses dash/power with cooldown awareness.
- A human-input provider is included or trivially constructible through the
  same contract, demonstrating replaceability by multiplayer or an external
  system/LLM.
- Provider failures must fail safe to a neutral intent rather than crash the
  match.

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

- The Power Lab presents ten collectible superpowers and four selectable math
  operations: addition, subtraction, multiplication, and division.
- The age-nine difficulty profile uses two-digit addition, subtraction with
  two-digit subtrahends and results of at least ten, multiplication from 3×3
  through 12×12, and exact division using divisors/quotients from 3 through 12.
  Division never presents fractions or division by zero.
- Joel selects a power and operation, then answers a four-choice problem.
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

Each equipped charge augments Joel's next successful full-meter power strike.
A missed kick does not consume a charge. The ordinary meter power remains
available when no equipped charge is available.

1. Fireball / Bola de fuego — hotter trail and stronger shot velocity.
2. Ice Freeze / Congelación — freezes the defender on contact.
3. Lightning / Relámpago — fastest direct shot.
4. Tornado / Tornado — high-rising, strongly spinning shot.
5. Rocket / Cohete — fast, flat shot for ground openings.
6. Rainbow Arc / Arcoíris — extreme aerial lob over a grounded defender.
7. Boomerang / Bumerán — reverses horizontal direction once in flight.
8. Warp / Teletransporte — jumps forward once without teleporting directly
   across a goal line.
9. Shield / Escudo — grants Joel protection from the next physical stun.
10. Hyper Mode / Modo turbo — temporarily boosts Joel's run, jump, and dash.

### Match presentation and rules

- The HUD shows the equipped power and remaining charge count without covering
  gameplay. Power-shot trail color communicates the active special.
- The charge is consumed only after the powered ball strike succeeds. The
  resulting effect has a bounded duration and is cleared safely between rounds.
- Countering an enhanced shot removes its character-specific secondary effect;
  the defender returns a normal counter-power shot.
- The provider-driven AI continues to use the standard meter power and does not
  spend Joel's persistent inventory.

### V2 verification

- Pure tests cover all math generators, answer choices, bilingual lookup,
  inventory earning/equipping/consumption, sanitization, and all ten shot
  modifiers.
- Browser tests cover language switching and persistence, Lab navigation,
  incorrect/correct answers, charge accumulation, equipping, match HUD state,
  successful charge consumption, and one representative gameplay effect.
- Desktop and tablet screenshots are inspected for the English intro, Spanish
  intro, Power Lab grid, math challenge, success state, and equipped match HUD.
