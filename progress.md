Original prompt: Create a polished, playable 2D browser game with the dynamics of the Head Soccer genre. Use a proven JavaScript 2D engine; keep the code scalable, modular, reusable, functional where practical, simple, and testable. Include an intro screen, a left-side human player, an intelligent provider-based and replaceable AI on the right, original high-quality background/player/ball assets without using the provided screenshot, arcade collision physics, goals with crossbars, movement, jumping, kicks, dash/combat, chargeable counterable power shots, stats-ready design, and proper tests. Write the requirements down before coding and finish with an independent reviewer subagent.

## 2026-07-09

- Created `docs/GAME_SPEC.md` before implementation. It turns the brief into
  explicit gameplay, architecture, asset, AI, diagnostics, and test criteria.
- Workspace began empty and is not currently a Git repository.
- Selected Phaser 3 + Matter, Vite, Vitest, and browser validation through the
  required `develop-web-game` Playwright client.

## TODO

- Scaffold the Phaser/Vite project and pure gameplay modules.
- Generate and integrate original arena and sprite assets.
- Implement match flow, physics, controls, AI provider, power/counter, combat,
  touch UI, effects, diagnostics, and audio.
- Add unit/browser tests and inspect generated screenshots.
- Run the required reviewer agent and address findings.

## Implementation checkpoint

- Scaffolded Vite + Phaser 3.90 with Matter physics and a single responsive
  canvas.
- Added pure, unit-tested modules for rules, score/clock transitions, meter
  economy, counter velocity, input normalization, immutable world snapshots,
  prediction, provider safety, and the heuristic agent.
- Added replaceable heuristic and human provider adapters.
- Implemented intro, match flow, compound player hitboxes, ball/crossbar
  physics, movement, jump, kick, dash/stun/recovery, power shots, timed
  counters, scoring, golden goal, pause, result/rematch, touch controls,
  synthesized audio, effects, deterministic stepping, and text diagnostics.
- Dependency audit is clean after updating Vite/Vitest to fixed versions.
- First verification: 6 unit tests pass and the production build succeeds.
- Still required: integrate generated art, run browser automation and inspect
  screenshots across all modes, tune gameplay, expand browser coverage, and
  complete the independent review.

## Art, integration, and browser verification checkpoint

- Integrated original goal-free rooftop stadium, ball, power flare, and two
  fictional Caucasian boy rivals requested by the user. Both player sheets are
  live with distinct idle/run/jump/kick/dash/stun frames.
- Replaced the initial floating goal-net treatment with one hand-authored,
  narrow `goal-side.svg`; the right goal reuses it via horizontal mirroring.
  Visual uprights/crossbars align to the same coordinates as Matter scoring and
  collision geometry.
- Fixed compound-body spawn translation, visual origin/physics scaling order,
  explicit pitch grounding, deterministic banner timing, Canvas capture, and
  result-screen camera-flash cleanup discovered through screenshot inspection.
- Added a portable Playwright browser regression suite. It verifies intro →
  match, movement, jump, kick, dash, power, pause/resume, close combat/stun,
  physical goal-line scoring, result/rematch, provider identity, touch layout,
  state diagnostics, and zero browser/page errors.
- Inspected screenshots for intro, jump, dash, power, pause, stun, result, and
  touch landscape states. Current visuals are aligned and legible.
- Current verification: 11 unit tests pass, production build succeeds,
  dependency audit is clean, and all browser scenarios pass.

## Remaining

- Run the independent reviewer subagent against the original request and
  `docs/GAME_SPEC.md`, address every material finding, then perform the final
  unit/build/browser verification pass.

## User gameplay-feel revision

- Increased ground acceleration and top speed substantially for the confined
  pitch.
- Added a cadence-driven two-phase running cycle that alternates planted and
  extended-leg art and emits restrained footstep dust; state diagnostics expose
  the active pose.
- Added a true lob action (`Z`/`I`, also Up + Kick, plus touch `L`) with lower
  forward speed and strong lift. The browser suite verifies initial upward
  velocity and continued ascent into a playable arc.
- Updated heuristic AI to choose a lob when a nearby defender blocks the direct
  shooting lane.
- Browser checks now assert both running phases and the lob trajectory. Current
  count: 14 unit tests plus the passing multi-state browser suite.

## Final review and verification

- Independent review found and prompted fixes for counter velocity ordering,
  directional flare rotation, async/LLM provider buffering, touch coverage,
  screenshot settling, favicon noise, and a reachable AI-lob fixture.
- Follow-up independent review confirmed every finding fixed and reported no
  remaining material issues.
- Touch browser coverage now functionally presses left, right, jump, kick, lob,
  dash, and power. The desktop suite isolates scenarios to avoid match-flow
  interference and passed twice consecutively.
- Final verification: 14/14 unit tests, production build, two consecutive full
  browser runs, and `npm audit` with zero vulnerabilities. The only build note
  is Vite's expected large-chunk warning for the bundled Phaser engine.

## Tablet, traversal, and facing revision

- Added touch-only intro instructions and persistent top-row pause, restart,
  menu, and fullscreen buttons. The touch pause overlay now provides large
  resume, restart, and main-menu actions, with hidden controls made
  non-interactive.
- Increased running speed and acceleration again. Players can now cross
  midfield and traverse the shared pitch instead of being confined to halves.
- Facing now follows the most recent horizontal movement and persists when the
  player stops. An attacker who overtakes the defender while running toward the
  rival goal therefore stays oriented toward that goal for the next shot.
- Increased jump velocity and air steering, then added a tuned fast-fall so an
  aerial attempt is mobile and resolves in roughly one second rather than
  leaving the player vulnerable for an extended period.
- Strengthened kick and dash knockback so direct contact visibly displaces the
  rival while retaining short stun/recovery protection.
- Removed the duplicate translucent center-circle overlay at floor level; the
  stadium background remains the single source of pitch markings.
- Expanded browser coverage to assert crossing midfield, the overtake/facing
  shot direction, air control and landing time, knockback velocity, touch-only
  instructions, and touch pause/resume/restart/menu flows.
- Final verification for this revision: 14/14 unit tests, production build, all
  25 browser scenarios, and `npm audit` pass with zero vulnerabilities.

## Goal-safe facing and speed revision

- Replaced unconditional last-movement facing with a symmetric positional
  rule. Until a player overtakes the defender, they always face the rival goal
  and retreat by backpedaling. Once past the defender, movement may turn them
  back toward the defender; continuing toward goal remains goal-facing.
- Reset now restores each fighter's default attacking direction so a previous
  round cannot leak its final orientation into the next kickoff.
- Increased normal movement force and maximum speed by exactly 20%. Air
  steering inherits the same increase, while dash speed remains intentionally
  unchanged as a separate ability.
- Added pure tests for both sides of the facing rule and the exact movement
  tuning, plus browser assertions and screenshots for defensive backpedaling,
  post-overtake turning, and goal-directed shots in both positions.
- Final verification: 17/17 unit tests, production build, all 28 browser
  scenarios, visual screenshot inspection, and `npm audit` pass. The only build
  note remains Vite's expected Phaser bundle-size warning.

## Goal crossbar perch regression

- Reproduced the reported left-goal bug before changing gameplay: a zero-spin
  ball remained motionless at `x=67.2, y=401.6` after 2.2 seconds.
- Added a narrowly gated anti-perch rule. It activates only after a nearly
  motionless ball rests level on a crossbar for 0.38 seconds, then gives it a
  small inward/upward roll toward the playable pitch. Fast impacts and normal
  crossbar ricochets do not meet the activation conditions.
- Added mirrored browser regressions for both goals plus before/after visual
  captures. The deterministic debug ball placement now also clears residual
  angular velocity so physics fixtures are isolated.
- Final verification: 17/17 unit tests, production build, all 30 browser
  scenarios, inspected release screenshot, and `npm audit` with zero
  vulnerabilities. Vite's existing Phaser bundle-size warning is unchanged.

## Tablet crystal-glass controls

- Replaced the 58%-opaque navy gameplay-button fill with an 8.5%-opaque
  cool-white glass tint, preserving visibility of players and goals underneath.
- Built the canvas-native glass treatment from a soft shadow, faint accent
  halo, thin refractive outer edge, low-opacity inner rim, restrained specular
  arc, glint, and shadowed white symbol. No extra DOM/CSS overlay was added.
- Reduced the first-pass border weights and opacities after visual feedback so
  the controls read as glass lenses rather than neon rings.
- The complete touch browser flow passes, and the tablet gameplay screenshot
  was inspected with an opponent directly beneath the action cluster.
- Final verification: 17/17 unit tests, production build, all 30 browser
  scenarios, and `npm audit` with zero vulnerabilities. The existing Phaser
  bundle-size warning remains the only build note.

## V1 post-goal visual reset

- Reproduced the stale-pose bug with a browser regression: after a close-range
  kick followed by a goal, the defender's logical pose was idle but its actual
  rendered sprite remained on stunned frame `5` throughout the countdown.
- Fighter reset now immediately restores sprite frame `0`, the default facing,
  and an untinted appearance alongside the existing position and velocity
  reset. No gameplay update is required before the correct pose appears.
- Exposed `visualFrame` in the text diagnostic and asserted frame `0` for both
  players during the post-goal countdown.
- Inspected `04-post-goal-reset.png` after allowing the goal flash to settle;
  both players are visibly neutral at their kickoff positions.
- V1 verification: 17/17 unit tests, production build, all 31 browser
  scenarios, inspected post-goal countdown screenshot, and `npm audit` with
  zero vulnerabilities. Vite's Phaser bundle-size warning is unchanged.

## Bilingual Power Lab and superpower progression

- Renamed the human-facing player identity to Joel in the HUD, results,
  collision identity, intro labels, and text diagnostics.
- Added centralized English/Spanish copy and a persistent main-screen language
  switch. Intro controls, Lab, match announcements, pause, results, and power
  names/descriptions all follow the selected language.
- Added randomized child-friendly addition, non-negative subtraction, times
  tables, and exact division with four unique shuffled answer choices.
- Added ten collectible powers: Fireball, Ice Freeze, Lightning, Tornado,
  Rocket, Rainbow Arc, Boomerang, Warp, Shield, and Hyper Mode. Each has a
  distinct shot or player mechanic and localized content.
- Added a 5×2 Power Lab collection grid, operation selector, focused action
  bar, large math challenge, correct-answer celebration, equip state, charge
  counts, and tablet layout.
- A correct answer earns one persistent charge. A wrong answer awards nothing,
  disables all remaining choices, and stores a global five-minute cooldown as
  an absolute local deadline with a live bilingual countdown.
- Local storage now preserves language, all ten counts, the single equipped
  power, and penalty deadline. Schema sanitization and safe in-memory fallback
  prevent corrupt or unavailable storage from breaking the game.
- Equipped charges augment Joel's next successful full-meter ball strike and
  are consumed only on contact. Missed activations retain inventory; counters
  strip secondary effects; round reset clears bounded match effects.
- Added 12 V2 domain/storage tests and expanded browser coverage through the
  bilingual Lab, correct/wrong attempts, accumulation, equip, refresh, cooldown
  persistence, missed activation, successful Fireball consumption, and touch.
- Inspected English/Spanish intro, desktop/tablet Lab, math challenge, success,
  five-minute penalty, Spanish match overlays, result, and Fireball gameplay.
- Final verification: 29/29 unit tests, production build, all 40 browser
  scenarios, screenshot inspection, and `npm audit` with zero vulnerabilities.
  Vite's expected Phaser bundle-size warning remains the only build note.

## Joel runtime-name hardening

- Confirmed the current source and production bundle already rendered `JOEL`;
  the reported `NOVA` label came from an older running build. Remaining source
  references were only internal texture aliases and historical PNG filenames.
- Added authoritative `HUMAN_PLAYER_ID` / `HUMAN_PLAYER_NAME` constants and now
  use them for fighter construction, collision identity, intro label, initial
  HUD text, and every HUD refresh.
- Renamed runtime texture aliases from `nova` to `joel` while preserving the
  existing asset files, forcing a fresh production bundle hash.
- Added the actual rendered HUD strings to diagnostics and a browser assertion
  that the left HUD starts with `JOEL`; inspected the gameplay screenshot.
- Verification: 29/29 unit tests, production build, and all 40 browser scenarios
  pass.

## Spanish fitting and age-nine math difficulty

- Added a pure, tested font-fitting rule to every reusable rectangular button.
  Long localized labels keep their normal size when possible and scale down to
  a readable minimum only when their measured width exceeds the button.
- Split the tablet system-controls copy into intentional heading/action lines,
  centered it, and constrained it to the intro panel width. Spanish no longer
  extends outside the main-menu panel.
- Raised math difficulty to two-digit addition; subtraction with a two-digit
  subtrahend and result of at least ten; multiplication from 3×3 through 12×12;
  and exact division with divisor and quotient from 3 through 12.
- Added domain assertions for every new operand boundary and browser assertions
  against the actual randomized multiplication/addition challenges.
- Inspected Spanish desktop Lab, Spanish tablet intro, challenge, and penalty
  screenshots. Button labels, instructions, cards, and feedback all fit.
- Final verification: 31/31 unit tests, production build, all 42 browser
  scenarios, screenshot inspection, and `npm audit` with zero vulnerabilities.
  Vite's expected Phaser bundle-size warning remains the only build note.

## Netlify website publishing integration

- Chose a generated-folder publishing workflow instead of a filesystem
  symlink: Git stores only a symlink target string, so Netlify's isolated
  checkout of `luisnomad.com` would not contain the sibling game repository.
- Made the Vite build portable below a nested route with a relative base and
  routed every Phaser asset load through `import.meta.env.BASE_URL`.
- Added `npm run publish:website`, which builds the game and replaces only
  `../luisnomad.com/public/games/head-soccer` with the fresh production output.
  `SKYHEAD_WEBSITE_DIR` can override the sibling website path.
- The generated game folder is intentionally committed in the website repo;
  Astro copies it unchanged from `public/` into the Netlify publish directory.
- Verified 31/31 unit tests, the game production build, all 42 game browser
  scenarios, and the complete Astro website production build.
- Served the Astro production output and exercised the real nested route at
  `/games/head-soccer/` with the web-game Playwright client. The intro,
  countdown, live match, AI, sprites, goals, and ball all loaded with no console
  or page errors; the inspected state reached `mode: playing`.
- Website repository status after generation: only `public/games/` is new and
  ready to add, commit, and push. No Git commit or remote push was performed.

## Persistent music, crowd audio, and tablet caching

- Audited the supplied audio and found six music tracks, two crowd recordings,
  and one additional short ball-impact recording. All nine are now used.
- Replaced the single legacy sound toggle with a bilingual Settings scene that
  retains the main-screen EN/ES shortcuts and adds large touch sliders plus
  independent mute switches for music and sound effects.
- Audio settings migrated into the existing local profile as schema version 3.
  Defaults are 15% music and 20% effects; five-percent volume steps, both mute
  flags, language, powers, and cooldowns survive refresh together.
- Music rotates continuously across menus, the Power Lab, and matches. Audience
  ambience starts only in a match, goal scoring plays the supplied crowd cheer,
  and kicks play the supplied ball effect. Synthesized arcade feedback remains
  under the same effects control.
- Playback is intentionally unlocked by the first pointer or keyboard gesture
  to comply with tablet autoplay rules. Hiding the page pauses media; returning
  resumes the requested scene mix.
- Added a service-worker-free Cache Storage adapter. It does not block Phaser's
  visual boot, caches the current music/crowd files opportunistically, then
  warms all nine recordings progressively. Data-saver/2G connections limit the
  warm set to the immediately useful files; normal connections reach 9/9.
- Kept the game non-installable for now: Cache Storage is available directly to
  a window on HTTPS, so an app manifest/service worker/offline shell would add
  complexity without being required for persistent audio caching.
- Preserved the supplied originals in `source-assets/sound` and added the
  repeatable `npm run optimize:audio` pipeline. Music is shipped as metadata-
  stripped 44.1 kHz stereo MP3 at 128 kbps; effect files were already tiny and
  remain untouched. Deployed audio fell from about 8.1 MB to 5.5 MB (32%).
- Added pure tests for defaults, sanitization, persistence, track inventory,
  and one-fetch Cache Storage behavior. Browser coverage now verifies desktop
  and tablet settings, live sliders, independent mute, bilingual restart,
  refresh persistence, 9/9 caching, match-only ambience, rotating-music state,
  ball sound, and goal cheer.
- Final verification: 35/35 unit tests, all 52 browser scenarios, production
  game build, all nine MP3 decode checks, dependency audit with zero findings,
  website publish copy, complete Astro production build, and the actual nested
  `/games/head-soccer/` production route. The nested Settings and live match
  were visually inspected with no page or console errors.
- The website repo still has only `public/games/` ready to commit; no commit or
  push was performed.

## Desktop and tablet match abandonment

- Replaced the touch-only pause actions with one shared bilingual pause menu on
  desktop and tablet: Resume, Restart, and a visually distinct Abandon Match.
- Escape now reliably opens that menu on desktop. The first regression run
  exposed that Phaser's symbolic `keydown-ESC` event was not firing in the real
  browser path, so the binding now uses the standardized raw `Escape` key/code.
- Tablet pause exposes the same explicit abandon action instead of relying on
  an ambiguous home icon. The top-row home shortcut also routes through the
  same `abandonMatch()` action.
- Updated English/Spanish intro instructions and pause labels, including
  `ABANDON MATCH` / `ABANDONAR PARTIDO`.
- Diagnostics now list the three available pause actions. Browser coverage
  asserts Escape → paused → abandon → intro on desktop and pause → abandon →
  touch intro on tablet, while retaining resume and restart checks.
- Verification: 35/35 unit tests, all 54 browser scenarios, production build,
  required web-game client pass, inspected desktop/tablet pause screenshots,
  refreshed website publishing copy, and complete Astro production build.
  No page or console errors were produced.

## Power-button reliability and visible Freeze effect

- Reproduced the report with real controls. A full-meter power press consumed
  the meter immediately, opened only a 1.2-second armed window, and gave almost
  no feedback if the ball was not already inside the kick hitbox. A very quick
  desktop V/J tap could also land between sampled frames.
- Desktop power keydowns are now latched until the gameplay loop consumes them,
  matching the existing touch pulse behavior. Input listeners are explicitly
  removed on match shutdown to prevent rematch/restart lifecycle leaks.
- Power now arms for three seconds while preserving the full 100% meter. The
  button automatically attempts a kick; if it misses, the charge and meter are
  retained and pressing Power again retries. Meter and the equipped inventory
  charge are consumed only after an actual powered ball strike.
- Pressing Power before the meter is full now shows a bilingual “needs 100%”
  message. Successful arming shows a fitted two-line instruction plus a player
  aura, so both the control response and required next action are unmistakable.
- Freeze now lasts two seconds and has distinct cyan tinting, an ice ring,
  orbiting ice crystals, impact particles, and a bilingual `VEX-9 FROZEN!`
  announcement. A correctly timed AI counter still neutralizes it by design.
- Added diagnostic `frozen`, `freezeSeconds`, and HUD-announcement state.
  Browser regressions cover early activation, quick desktop taps, missed-shot
  meter retention, retry/contact consumption, successful desktop Freeze,
  recovery, successful tablet Freeze, and existing counter-play.
- Restarting during the new regressions exposed an intermittent Escape issue:
  the generic listener did not survive Phaser scene restart reliably. Escape
  now uses a dedicated Phaser key object, with exactly one listener after each
  restart.
- Verification: 35/35 unit tests, all 60 browser scenarios, required web-game
  client pass, inspected armed/desktop Freeze/tablet Freeze screenshots,
  dependency audit with zero findings, production build, refreshed website
  copy, and complete Astro build. No page or console errors were produced.

## Big Guy power request

- Original prompt for this iteration: replace Rainbow with “Big Guy!” / “¡Tío
  Grande!”, making Joel twice his size for ten seconds with animated expansion
  and contraction.
- Traced Rainbow through the data-driven power catalog, profile persistence,
  successful powered-strike flow, Fighter rendering/physics, diagnostics, and
  browser tests.
- Compatibility decision: migrate saved `rainbow` charges and equipment to the
  new `big` power instead of discarding a child's earned inventory.
- Added a pure ten-second transformation state with 0.4-second smoothstep grow
  and shrink phases. Fighter scale drives both the rendered sprite and Matter
  compound hitbox around a foot-level anchor, so the larger Joel remains
  grounded and gains genuinely larger interception/contact reach.

## Multiplayer architecture investigation

- Explored the current roster, provider/input seams, Phaser/Matter update loop,
  match lifecycle, powers, profile trust boundary, publishing model, and test
  hooks for a selectable-character and same-LAN multiplayer approach.
- Validated the working baseline: 37/37 unit tests, production build, current
  browser E2E suite, and the required web-game Playwright client all complete.
- Added `MULTIPLAYER-APPROACH.md` with a four-character roster plan, a local
  Node/Colyseus authoritative server, headless Matter.js simulation extraction,
  QR plus manual host/port/room/PIN joining, input/state/reconnect protocols,
  phased file-level implementation, security limits, and acceptance tests.
- No gameplay implementation was changed for this investigation.
- Final document handoff after later worktree changes: 44/44 unit tests and the
  production build pass. Two browser-suite reruns stopped at different tablet
  settings touch assertions (music-slider adjustment and effects mute), so Phase
  0 in the approach explicitly requires stabilizing that baseline before the
  simulation extraction begins.
- Replaced the bilingual Lab card and shot contract, added live diagnostics for
  remaining seconds/scale, and verified the selected Spanish name and copy fit
  the existing card without resizing regressions.
- Browser coverage activates Big Guy through a real V-key powered strike,
  asserts exact 2× scale and grounded physics, samples the closing shrink, and
  confirms exact return to 1× after expiry. Two consecutive complete browser
  runs passed; grown/shrinking screenshots were visually inspected.
- Verification for this iteration: 37/37 unit tests, production build, all 67
  browser scenarios twice, required web-game client match pass, and dependency
  audit with zero vulnerabilities. No remaining TODOs for Big Guy.

## Automatic loading splash request

- Original prompt for this iteration: remove the splash interaction and all
  overlay text; show only the selected image plus a small bottom-right spinner,
  then automatically cross-fade through white into the menu after required
  assets are cached or five seconds elapse, whichever happens first.
- The required visual cache is Phaser's completed BootScene preload. Splash
  begins its asset-ready transition only after that point, with the five-second
  deadline measured from the first inline page paint so it is a true startup
  cap rather than an additional five-second wait.
- Follow-up clarified that children should have time to enjoy the artwork. The
  asset-ready transition now has a strict three-second minimum display time,
  while retaining the five-second cap.
- A full regression run exposed the existing intermittent Phaser Escape-key
  pause listener again. It now uses one lifecycle-bound browser `keydown`
  listener, avoiding scene-restart timing loss without double toggles.
- Final startup behavior: image and bottom-right spinner only; no prompt or
  input; three-second minimum measured from first paint; required-texture-cache
  readiness thereafter; five-second intentional cap; 420 ms fade to white,
  menu scene swap, then 460 ms white reveal.
- Inspected desktop, tablet, image-to-white, and white-to-menu captures. The
  official web-game client confirmed automatic Splash → Intro → Match flow.
  Final verification: 37/37 unit tests, all 71 browser scenarios twice,
  production game build, zero dependency vulnerabilities, refreshed website
  copy, and complete Astro production build. No remaining splash TODOs.

## System-selected Math Lab operations

- Original prompt for this iteration: children must not choose the operation
  type because they will repeatedly select the easiest option.
- Added a pure uniform operation selector and removed operation state, buttons,
  scene parameters, debug selection, and action diagnostics from the Lab. Each
  newly opened challenge independently chooses addition, subtraction,
  multiplication, or division.
- Replaced the selector row with a bilingual, non-interactive random-math
  banner and updated the subtitle. Browser diagnostics expose
  `operationMode: random` plus only the last system-selected operation.
- Verified correct-answer earning and wrong-answer cooldown against randomly
  selected operations on desktop and tablet, including operation-specific
  age-nine operand bounds. The revised English/Spanish Lab and challenge were
  visually inspected and the official web-game client confirmed there is no
  operation-selection action.
- Final verification: 38/38 unit tests, all 73 browser scenarios, production
  game build, zero dependency vulnerabilities, refreshed Netlify website copy,
  and complete Astro production build. No remaining random-operation TODOs.

## Sprint, meter-backed kick boost, and AI difficulty

- Added a shared double-tap direction contract with a 280 ms window. Holding
  the second same-direction press starts a 1.5× sustained sprint; release,
  reversal, dash, stun, and knockback stop it. A sprint already underway keeps
  its momentum through a jump, while an airborne double-tap cannot start one.
- Sprint presentation uses faster run-pose cadence, takeoff/step dust, and
  subtle speed lines. Dash remains an independent short aggressive lunge.
- Added optional provider intent fields `sprint` and `kickBoost`. They pass
  through the same normalized Fighter mechanics for keyboard, touch, heuristic
  AI, human providers, buffered network providers, and future LLM providers.
- Repeated kick/lob taps during the active kick pose add up to three boost
  steps. Each step costs at most eight meter, the total strength caps at 27%
  for a drive, and a lob gains more lift than speed. A full basic boost remains
  weaker than a 100% power shot.
- The first kick contact remains immediate. Further taps during that same pose
  continue accelerating the already-launched ball, making the mechanic usable
  at real child tapping speeds. Meter is deducted only after contact; a miss is
  free. Gold impact particles, camera feedback, and a brief meter flash show
  the cost.
- Added persistent bilingual Easy/Normal/Hard Settings. Easy strips both
  advanced intents at the MatchScene AI boundary (including custom AI
  providers); Normal and Hard allow them, with Hard choosing them more
  aggressively. Human providers are never restricted.
- Updated English/Spanish intro instructions, Settings layout, diagnostics,
  provider documentation, README controls, and the acceptance spec. Both
  Settings languages and desktop/tablet gameplay captures were inspected.
- Final verification: 45/45 unit tests, 211 real-browser assertions covering
  desktop and touch sprint/boost/difficulty flows, the required web-game client
  with no console errors, production build, dependency audit with zero
  vulnerabilities, refreshed `luisnomad.com` game copy, and a complete Astro
  production build. No remaining TODOs for this iteration.

## Big Guy zero-count badge fix

- A `2×` ability icon beside the actual `×0` inventory count made an empty Big
  Guy card look as though it owned two charges. Inventory persistence and
  counts were correct; the ambiguity was purely presentational.
- Added a regression test that rejects numeric or multiplier-like icons for Big
  Guy, confirmed it failed against `2×`, then changed the badge to `G`.
- Visually inspected English and Spanish Power Lab captures showing `G` and the
  single authoritative `×0` count. Final verification: 46/46 unit tests, the
  complete 211-assertion desktop/tablet browser suite, official web-game client
  with no console errors, refreshed website copy, and successful Astro build.

## Referee whistle match signals

- Added the supplied 0.85-second whistle recording to the active effects cache
  and effects-volume channel. It replaces the former audience goal cheer, so
  the active cache remains nine files rather than growing on tablets.
- Added a pure countdown transition helper: the visible 3–2–1 seconds each
  request one whistle exactly once, while repeated fixed-update frames and the
  `GO` frame request none. New rounds reset the transition state correctly.
- Goals play one immediate whistle. A guarded result transition requests three
  whistles at 0.9-second intervals; duplicate result calls do not schedule a
  second sequence, and scene changes/muting/page hiding cancel pending timers.
- Audio diagnostics expose requested/started whistles, the latest sequence
  size, and pending sounds. Settings copy and product documentation now describe
  the referee signals rather than the retired goal cheer.
- Final verification: 48/48 unit tests, 222 browser assertions including real
  three-whistle timing, official web-game client showing exactly three
  countdown playbacks and no console errors, production build, and dependency
  audit with zero vulnerabilities. Refreshed the website game copy and
  completed the enclosing Astro production build.
