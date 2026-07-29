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

## Capacitor-first Android client (2026-07-11)

- Added Capacitor 8 with the Android, App, Screen Orientation, and Haptics
  packages. `npm run build` remains the canonical Vite build and
  `capacitor.config.json` packages `dist/` under
  `com.luisnomad.joelfootball`.
- Generated the native `android/` project, locked phone activity orientation
  to sensor landscape, enabled cutout-safe edge-to-edge layout, and configured
  Capacitor System Bars to inject WebView-safe CSS inset variables.
- Added a strict platform boundary under `src/platform/` with web and Capacitor
  implementations for lifecycle, Back, orientation, fullscreen/immersive mode,
  haptics, and minimizing the Android app. Phaser scenes do not import
  Capacitor.
- Backgrounding now neutralizes keyboard/touch/sprint input and leaves an
  active match on an explicit lifecycle pause screen. Resume never advances the
  match until the player chooses to continue. Android Back pauses/resumes a
  match, dismisses Lab/settings layers, and only minimizes from the main menu.
- Added Android sync/run/APK/AAB scripts plus optional private release-keystore
  configuration. Android keystores and signing properties are ignored.
- Added focused platform unit tests and browser regressions for lifecycle pause,
  held-input release, explicit resume, and non-exiting Back behavior. Current
  unit verification is 62/62 and the Vite production build passes.
- Ran the required web-game Playwright client into
  `output/capacitor-platform-check/`; the latest text state reached live solo
  gameplay and the inspected screenshot rendered correctly.

### Capacitor TODO

- Run the full browser suite after the lifecycle changes.
- Sync and build Android with Java 21 (the machine default Java 26 is newer than
  Gradle 8.14 supports), then verify the generated debug APK signature.
- Test on physical low/mid-range and modern Android devices for stable FPS,
  audio interruptions/Bluetooth latency, cutouts, lock/resume, offline launch,
  WebView texture memory, and persistence across an installed update.
- Before Play release, create and protect the production upload keystore, fill
  `android/keystore.properties`, confirm the final application ID, increment
  versionCode/versionName, and build the signed release AAB.

### Android emulator verification

- The first Pixel 9 Pro/API 37 launch exposed an orientation race: Phaser had
  measured the initial portrait WebView and remained at a 320×180 CSS canvas
  after Android switched to landscape. Added a two-frame scale refresh after
  platform initialization, foreground resume, resize, and orientation change.
- Rebuilt/reinstalled with networking disabled. The live cutout-safe WebView is
  952×426 CSS pixels with a 52 px left camera inset; Phaser now fills the safe
  16:9 area at 758.5×426.7 instead of remaining at 320×180. Inspected
  `output/android-offline-launch.png` after the fix.
- Started a complete solo match offline, backgrounded with an intentionally held
  touch direction, and relaunched. The game returned paused with
  `pauseReason: lifecycle` and the held input cleared. A real Android Back event
  resumed the match while the activity remained visible.
- Wrote a WebView local-storage sentinel, installed the APK again with
  `adb install -r`, relaunched offline, and confirmed the sentinel survived.
- `assembleDebug` succeeds with Java 21. `apksigner` verifies the installable APK
  with v2 signing and one Android Debug signer; packaged assets include the
  local entry point, JS, sprites, and audio.
- The complete browser suite passes after the platform work (one unrelated
  animation timing assertion was flaky on the first run and passed unchanged on
  rerun). Unit verification remains 62/62.

### Visual Studio Code tablet launcher

- Added `npm run android:tablet` and the VS Code task **Android: Launch Tablet**.
  The Node launcher discovers the local Android SDK and installed system images,
  selects Java 21 on macOS, creates/reuses `Joel_Football_Tablet`, builds and
  syncs the debug APK, waits for boot, installs with `adb install -r`, unlocks,
  and starts the Capacitor activity.
- Only the phone AVD `Pixel_9_Pro` existed beforehand. Successfully created the
  Pixel Tablet AVD from the already-installed Android 37 ARM Play Store image
  and ran Joel Football on `emulator-5554` at 2560×1600, 800 dp, landscape,
  fullscreen. The first Android immersive-mode education card is expected and
  disappears after tapping **Got it** once.

## Non-16:9 tablet extended stage

- Added a pure tablet gate: only landscape touch devices with at least a 600 dp
  short side and an aspect ratio materially shorter than 16:9 use the extended
  stage. Phones, desktop browsers, portrait devices, and exact 16:9 tablets
  retain the original Phaser FIT layout.
- Selected Phaser EXPAND for that tablet gate. The 1280×720 gameplay region and
  all Matter coordinates stay unchanged while the canvas grows vertically; a
  16:10 tablet becomes 1280×800 with an 80 px bottom UI band.
- Built a reusable canvas texture from the arena artwork's existing 84 px floor
  strip and tile it through the added band. It preserves the brick, teal panel,
  and central gold-lane pattern rather than showing a flat black bar.
- Intro Play/Lab/Settings actions, Settings Done, and the Power Lab action bar
  are bottom-anchored by the exact added height. Match movement and action
  controls shift down by the same amount, leaving the pitch and players clear.
  Match pause/result shades and Lab challenge shades cover the full extended
  canvas.
- Added three pure layout tests and a dedicated 1280×800 touch-browser flow. It
  verifies the 1280×800 canvas, unchanged gameplay region, relocated settings
  and Lab actions, movement, kick, pause/resume, and zero browser errors.
- Inspected 16:9 gameplay plus extended-tablet intro, settings, Power Lab,
  gameplay, and pause screenshots. The floor repeat and input mapping are
  visually/functionally correct. Current verification: 65/65 unit tests,
  production build, required web-game client, and the full browser suite pass.
- Rebuilt, installed, and launched through `npm run android:tablet`; inspected
  native 2560×1600 Pixel Tablet intro and live-match captures. Capacitor selects
  the same 1280×800 stage, removes both black bars, repeats the floor cleanly,
  and keeps the relocated controls fully visible and responsive.
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

## Character animation spike

- Inspected the two current six-pose character sheets, their actual 185 x 240
  rendering size, frame-selection logic, action timing, and representative
  gameplay captures. The largest discontinuity is the run loop alternating a
  planted idle pose with a full airborne stride; kick and dash also snap to a
  single short-lived frame.
- Recommended retaining raster sprites and adding five targeted drawings per
  character: three additional run-cycle frames plus kick anticipation and
  follow-through. Subtle whole-sprite breathing, lean, bob, squash, and stretch
  should supplement those frames without changing the physics body.
- Rejected automatic SVG conversion for this iteration. Flat tracing does not
  recover joints or occluded artwork, independently traced poses cannot be
  cleanly path-morphed, and Phaser rasterizes standard SVG loads into textures.
- Defined an AI-assisted, human-cleaned frame workflow, trimmed-atlas runtime
  architecture, texture/performance limits, acceptance checks, and a one-player
  vertical-slice decision gate in `docs/CHARACTER_ANIMATION_SPIKE.md`.
- No gameplay code or assets were changed, so no runtime regression test was
  required for this documentation-only spike. The next action is the Joel
  four-frame run and three-frame kick vertical slice.

## Character animation v2 implementation

- Used the built-in image-generation workflow with both original player sheets
  and idle cutouts as identity anchors. Created and visually reviewed a six-cell
  character reference sheet plus a six-cell run/kick candidate sheet for Joel
  and Vex, then generated one targeted Vex kick-recovery candidate.
- Selected three consistent run drawings and three kick drawings per player.
  Removed magenta/green chroma with the installed soft-matte/despill helper,
  cleaned a few disconnected cell-edge artifacts, registered ground anchors,
  and normalized every frame into 320 x 480 cells.
- Packed twelve-frame 1280 x 1440 source sheets and lossless runtime WebP
  sheets. The runtime downloads are about 1.6 MB combined—smaller than the two
  legacy PNG sheets—while decoded texture memory rises modestly from about 12
  MiB to 14.1 MiB.
- Added a pure animation contract. Running now uses authored frames `6 → 7 → 8
  → 7`, advances from distance travelled, emits footstep dust only on the two
  contact phases, and preserves the existing `run-contact`/`run-stride`
  diagnostics. Kicks use anticipation/contact/recovery frames `9 → 10 → 11`
  over the unchanged 160 ms gameplay window.
- Added restrained display-origin secondary motion without rescaling or
  rotating the Matter body. The fixed collider, strike timing, kick boost,
  lob, dash, jump, stun, chilena, Big Guy scaling, and facing rules remain
  authoritative.
- Extended diagnostics and browser assertions to verify the enhanced sheet,
  all three authored run drawings, both planted-foot phases, and staged kick
  logic. Added pure tests for frame sequencing and timing thresholds.
- Visually inspected the reference sheets, selected transparent frames,
  final-size run/kick sequences, runtime atlases, official web-game client
  captures, and refreshed run/sprint/lob/dash gameplay captures.
- Verification: 55/55 unit tests, production build, the complete browser game
  suite, and the required web-game client with no console/page errors. Full
  prompts, selection decisions, mappings, and source paths are recorded in
  `source-assets/animation/README.md`. No remaining animation-v2 TODOs.

## Ground registration, faster cadence, focused powers, and aimed chilenas

- Added a reproducible atlas builder that cleans disconnected chroma fragments,
  enforces eight-pixel horizontal safety margins, and registers every grounded
  Joel and Vex frame to the same source foot anchor (`y=418`). This fixes Joel's
  initial low placement, Vex's clipped rear foot, and chilena landing drift.
- Removed display-origin run bob so authored foot registration remains the sole
  visual ground authority. Reduced distance per run frame from 44 to 30 logical
  pixels, making the `6 → 7 → 8 → 7` cycle about 47% faster without adding
  frame-rate-dependent animation work.
- Reduced the power catalog from ten overlapping or unpredictable choices to
  Fireball, Freeze, Big Guy, Shield, and Hyper. Retired charges migrate into
  Fireball. Freeze now affects the opponent immediately; Shield and Hyper also
  activate immediately. Fireball and Big Guy retain the successful-strike rule.
- Replaced generic status circles with one guarded Phaser pre-FX glow per
  fighter plus a light contrast tint and small particles. Canvas fallback keeps
  the tint, while WebGL receives the pulse, limiting the runtime cost to the two
  existing character sprites.
- Fixed custom match event listeners accumulating on scene restart, which could
  process a single power press multiple times and overwrite its feedback.
- Chilena velocity now points from the ball to the center of the rival goal.
  High aerial attempts drive downward, low attempts rise slightly, and ordinary
  fighter collision remains enabled so the defender can body-block the shot.
- Verification: 58/58 unit tests, production build, and the full desktop/tablet
  browser suite pass. Browser assertions cover atlas padding/anchors, landing
  height, faster frame cycling, instant Freeze/Shield/Hyper behavior, Big Guy,
  goal-centered chilena direction, profile migration, and touch activation.

## High-speed over-goal scoring fix

- Replaced position-based scoring with a swept goal-line crossing rule. The
  crossing height is interpolated at the exact line, and the full ball must fit
  between the underside of the crossbar and the pitch.
- An over-goal fireball can no longer fall behind the line and retroactively
  score because only the original outward crossing is eligible.
- Added a guarded ball recovery for rare high-speed tunneling beyond the left,
  right, or top screen boundary; it returns the ball with a damped inward
  velocity rather than leaving play stuck off-screen.
- Added pure regressions for both goal directions, bar/ground exclusion, and
  delayed falling behind the line, plus a browser fireball scenario and visual
  capture. Verification: 60/60 unit tests, production build, the full
  desktop/tablet browser suite, and the required web-game client pass without
  console or page errors.

## Kick and power-feedback cleanup

- Moved the supplied ball-kick effect from kick-animation start to confirmed
  ball contact. Misses are now silent; ordinary, powered, countered, and AI
  contacts retain the contact sound, while chilena audio remains tied to its
  successful activation.
- Removed the white kick ellipse from the fighter aura. Boost feedback remains
  available through the existing gold impact particles and meter flash.
- Shortened Freeze, Shield, and Hyper activation messages to compact labels and
  added a reusable announcement fitter with an explicit maximum width. Text
  diagnostics now expose the rendered width and font size for regression tests.
- Browser coverage verifies zero ball-effect plays on a miss, exactly one on
  the following contact, no kick marker in the inspected capture, and bounded
  Spanish activation banners. Verification: 60/60 unit tests, production
  build, full desktop/tablet browser suite, and the required web-game client
  pass without console or page errors.

## Mirrored tablet floor extension

- Replaced the repeated tablet floor tile with vertically mirrored bands. The
  first extension reflects the arena's existing floor across its bottom edge;
  additional bands alternate normal and mirrored orientation for taller tablet
  ratios.
- Verified the reflection seam in the 1280×800 touch profile and the native
  2560×1600 Pixel Tablet WebView, on both the intro and live match screens.
- Verification: 65/65 unit tests, production build, full browser gameplay and
  tablet suite, required web-game client, Capacitor sync, debug APK build,
  emulator install, and native screenshot inspection.

## Physical Samsung tablet smoke test (2026-07-11)

- Installed the debug APK with update/persistence semantics and cold-launched it
  over USB on a Samsung SM-X210 running Android 15. The app owns the focused
  fullscreen window at 1920×1200 landscape with no display cutout.
- Captured live solo gameplay after real touch input. The 16:10 extended stage,
  mirrored floor, shifted controls, arena, HUD, animation, and match clock all
  rendered correctly; no crash or ANR occurred.
- Initial HWUI sampling after 6,273 frames reported 12 modern frame-deadline
  misses (0.19%), 8 ms median CPU frame time, 5 ms 95th-percentile GPU time,
  and about 187 MB total PSS / 78 MB graphics memory.
- Hardware finding: this tablet reports no supported vibration motor, so haptic
  requests are ignored safely.
- Follow-up: startup logs contain three non-fatal Capacitor SystemBars safe-area
  CSS injection errors because the target element is temporarily null. The
  screen still fills correctly on this cutout-free tablet, but the injection
  timing should be hardened before relying on it for cutout devices.

## Proposed production-readiness UX slice

- Add final launcher identity: a text-free Joel-and-ball adaptive app icon,
  Android monochrome/themed variant, Play Store artwork, and matching splash.
- Unify package and native version metadata (currently `1.0.0` in package.json
  versus Android `1.0`) and expose version name plus build number through the
  platform-service boundary.
- Add a localized About overlay from an info button at the home screen's top
  left. Credit Luis Nomad / NotJustPrompts.ai, dedicate the game to Joel, and
  show the authoritative installed version/build.
- Migrate the player profile to record both language and its origin. A genuinely
  fresh profile detects and immediately saves the primary device language;
  existing profiles remain unchanged, and any EN/ES press marks the value as a
  durable user choice.
- Remove the dense controls copy from the intro and add one reusable localized
  Help overlay reachable from home and live gameplay. Opening it during a live
  match pauses safely; closing resumes only if Help caused the pause; Android
  Back dismisses Help before affecting the match/activity.
- Replace touch letters K/L/D/P with a consistent authored icon set: boot and
  ball for kick, curved ball trajectory for lob, runner/speed lines for dash,
  and charged ball/lightning burst for power. Use the exact same icons in Help,
  retain non-visual action names in diagnostics/accessibility, and preserve
  current hit areas and colors.
- Release hardening remains: fix the SystemBars safe-area injection race, test
  audio focus/Bluetooth/lock-resume, verify physical low/mid and modern devices,
  create the protected upload key, build the signed release AAB, and complete
  Play listing/privacy/child-audience declarations.

## Production-readiness UX implementation (2026-07-11)

- Unified semantic versioning: `package.json` now supplies Android
  `versionName`, web About metadata, and the native fallback. Capacitor App info
  supplies the installed version/build through `PlatformServices`; the physical
  tablet rendered `Versión 1.0.0 (1)`.
- Migrated profiles to schema 7 with `languageSource`. Fresh profiles detect
  and immediately save the primary device language; old profiles are preserved,
  and EN/ES presses become durable user overrides. Pure and browser coverage
  verifies detection, migration, persistence, and override after reload.
- Replaced the intro's dense controls block with a compact kickoff prompt plus
  top-left About and Help controls. About contains localized credit for Luis
  Nomad / NotJustPrompts.ai, the dedication to Joel, and version/build.
- Added one reusable localized Help overlay for menu and match. A live-match
  Help owns its pause, freezes the clock, resumes only its own pause, converts
  to lifecycle pause if backgrounded, and closes first on Escape/Android Back.
- Integrated the user's hand-picked `jump.svg`, `kick.svg`, `high-kick.svg`, and
  `run.svg` as the live jump/kick/lob/dash symbols and the exact same Help
  legend. Move, power, and system symbols remain crisp code-native vectors.
- Generated a text-free Joel-and-ball launcher master from the established Joel
  art and installed all legacy/adaptive density assets, a monochrome Android 13
  icon, navy adaptive background, and matching portrait/landscape native splash
  images. Master: `public/assets/branding/joel-football-app-icon-master.png`.
- Disabled Capacitor's early SystemBars CSS injection and rely on WebView's
  modern `env(safe-area-inset-*)` support. The previous null-root error is gone;
  Android WebView 149 and the Pixel 9 Pro cutout emulator keep game content out
  of the camera inset. Phaser touch capture is also disabled in favor of the
  existing CSS gesture lock, eliminating Android's non-cancelable touchcancel
  console error without affecting controls.
- Added a portable Gradle runner so `npm run android:apk` and the release bundle
  command select Java 21 automatically on macOS instead of failing under the
  machine's Java 26 default.
- Verification: 68/68 unit tests, production Vite build, required web-game
  client, complete 237-check desktop/phone/tablet browser suite, Java 21 Android
  build, debug APK install/update, physical SM-X210 About/Help/gameplay captures,
  and Pixel 9 Pro cutout capture. No app crash, ANR, safe-area injection error,
  page error, or touch-cancel error remains.

### Production release items still requiring owner credentials/content

- Create and protect the Play upload keystore, fill
  `android/keystore.properties`, then run `npm run android:bundle`.
- Complete final Play listing copy/screenshots, privacy policy, Data Safety, and
  child-audience declarations.
- Complete the remaining physical audio-focus/Bluetooth/call/lock tests and a
  modern physical-device performance run; emulator coverage does not replace
  those hardware checks.

## Soft control icon tuning (2026-07-11)

- Preserved the replacement `run.svg` artwork and normalized its fill to white
  for consistent Phaser/WebView rendering.
- Reduced gameplay glyphs from 84% to 56% of each control radius and set them
  to 62% opacity. Touch-target circles, positions, and interaction areas remain
  unchanged.
- Reduced system glyphs to 72% of their control radius at 78% opacity, while
  Help-overlay examples remain slightly stronger at 90% for legibility.
- Verified 68/68 unit tests, the production build, the required web-game
  client, the complete browser gameplay/touch suite, a fresh Android build, and
  an update install on the connected Samsung SM-X210. Physical-device capture:
  `output/android-real-tablet-icons-soft.png`.

## Opponent renamed to Bob (2026-07-11)

- Replaced the opponent's visible VEX-9 name with Bob on the home screen, live
  HUD, fighter state, and localized English/Spanish result messages.
- Retained the internal `vex` catalog and asset identifiers so artwork and
  future saved roster data remain compatible.
- Verified 68/68 unit tests, the production build, required web-game client,
  complete browser gameplay/touch suite, and inspected both menu and tablet
  match captures for correct rendering.

## Tablet tap highlight and icon retune (2026-07-11)

- Identified the full-canvas blue touch wash as Android WebView's native tap
  highlight on Phaser's single canvas, not a game debug overlay. Explicitly set
  the WebKit tap-highlight color to transparent through the game DOM hierarchy
  and on the canvas itself.
- Increased gameplay glyphs from 56% to 70% of control radius and from 62% to
  68% opacity. Touch targets and system controls remain unchanged.
- Added a browser assertion for the canvas tap-highlight style. Verified 68/68
  unit tests, production web build, full browser gameplay/touch flow, required
  web-game client, and visually inspected the updated 1280×800 match capture.
- Per owner instruction, did not build, sync, install, or launch Android; these
  changes remain web-source-only until the queued changes are ready to deploy.

## Abandon-match confirmation (2026-07-11)

- Added a localized Leave Match confirmation for both the live-match Home icon
  and the pause-menu Abandon action. English and Spanish provide explicit Stay
  and Leave choices plus a progress-loss warning.
- Opening from live play freezes the match and Cancel/Back resumes it. Opening
  from an existing pause returns to that pause on Cancel. Only explicit Leave
  exits; result-screen navigation remains direct because the match is finished.
- The dialog neutralizes held input, hides underlying controls, appears in text
  diagnostics as `abandon-confirm`, and preserves lifecycle pause if the app is
  backgrounded while it is open.
- Verified 68/68 unit tests, production web build, full desktop/touch/tablet
  browser suite, required web-game client, and inspected the touch confirmation
  screenshot. No Android build, sync, install, or launch was performed.

## Split direct and high chilenas (2026-07-11)

- Double normal Kick retains the existing direct, goal-centered chilena.
  Double Lob now triggers a distinct high chilena while the same overhead-ball
  reachability and two-press requirements remain in force.
- The high variant launches almost vertically, reaches a tracked apex around
  logical y=190 just below the score/power HUD, then redirects from that exact
  point toward the opponent goal center. Its powered-ball state remains
  blockable and counterable during both trajectory phases.
- Added `rising` and `goalward` trajectory diagnostics, variant-specific strike
  state and HIGH CHILENA / CHILENA ALTA announcements, plus revised bilingual
  Help copy and game specification.
- Verified 69/69 unit tests, production web build, complete desktop/touch/tablet
  suite with separate direct/high-chilena assertions, required web-game client,
  and inspected launch/redirect captures on desktop and touch layouts. No
  Android build, sync, install, or launch was performed.

## Queued Android deployment (2026-07-11)

- With owner authorization, rebuilt and installed the queued Bob rename, tap
  highlight removal, icon retune, abandon confirmation, and split chilena
  behavior on the connected Samsung SM-X210 using update semantics; saved
  Spanish language and local profile data remained intact.
- The first cold launch after unlocking exposed an orientation race: Android
  briefly created the native WebView in portrait, so the one-time tablet gate
  selected 16:9 FIT and produced thin horizontal bars after landscape lock.
  Native startup now evaluates the eventual landscape dimensions before Phaser
  configuration; normal portrait web pages still retain the standard layout.
- Re-verified 70/70 unit tests, production build, full browser gameplay/touch
  suite, required web-game client, Android build, v2 APK signature, update
  install, and physical launch. The live tablet now fills 1920×1200 with the
  mirrored extended floor, larger translucent icons, Bob, and the Spanish
  abandon dialog. A real tap showed no blue WebView highlight; filtered app logs
  contained no crash, Chromium, Capacitor, or page errors.
- Final deployed debug APK SHA-256:
  `55e156f6cfa25608719d9bf412dd02f86eec011fae23242a4d96a803e2fb51f7`.

## Reliable audio mute controls (queued, 2026-07-11)

- Fixed Music and Sound Effects Mute / Turn On controls at the shared web-game
  layer. They now activate on pointer-down, avoiding WebView/browser release
  cancellation and keeping unmute playback inside the user-activation gesture.
- Each transition immediately synchronizes the persisted profile, ArcadeAudio
  state, requested playback, actual media paused/volume values, button label,
  and button color. A short audio click confirms both muting and re-enabling.
- Added diagnostics for each control and underlying media elements. Browser
  coverage now verifies Music and Effects independently in both directions,
  including pointer-down timing, touch layout, labels, persistence, volume zero
  while muted, and restored volume after Turn On.
- Verified 70/70 unit tests, production web build, complete browser gameplay and
  touch suite, required web-game client, and inspected desktop/touch muted-state
  captures. Per owner instruction, no Android build, sync, install, or launch
  was performed; this fix remains queued for the next authorized deployment.

## Stable pressed control icon sizing (queued, 2026-07-11)

- Fixed authored Jump/Kick/Lob/Dash SVG icons ballooning when a gameplay button
  was pressed. Phaser's SVG textures have non-unit base scales after
  `setDisplaySize`; the old animation replaced those with absolute 0.9/1.0
  values, producing texture-resolution-dependent size jumps.
- Each control now records every object's original X/Y scale and applies press
  feedback as a relative multiplier. Authored icons shrink by 10% on press and
  restore their exact configured display dimensions on release; touch targets
  and control positions are unchanged.
- Added live per-control scale diagnostics and browser regression coverage for
  all four authored action icons, with a clean scenario reset before gameplay
  mechanics tests. Verified 70/70 unit tests, production build, full browser and
  touch suite, required web-game client, and inspected the pressed Kick capture.
- Per owner instruction, no Android build, sync, install, or launch was
  performed; this fix remains queued with the audio-control fix.

## Settings panel reflow (queued, 2026-07-11)

- Moved the Settings heading fully inside the panel and reflowed Language,
  Difficulty, Music, and Sound Effects beneath it with consistent spacing.
  The layout remains balanced on both standard 16:9 and extended tablet stages.
- Removed the player-facing audio-cache progress line, its polling timer, and
  its English/Spanish copy. The underlying offline audio cache and diagnostics
  remain intact; only the technical status display was removed.
- Added browser regression checks for title containment and hidden technical
  cache status, and updated all interaction coordinates to the new layout.
  Verified 70/70 unit tests, the production web build, full desktop/touch/tablet
  browser flow, required web-game client, and visually inspected standard,
  touch, and extended-tablet settings captures.
- Per owner instruction, no Android build, sync, install, or launch was
  performed; this fix remains queued with the pending audio and icon fixes.

## Reliable ground-level goal detection (queued, 2026-07-11)

- Reproduced intermittent missed goals at pitch level: Matter may rest the ball
  exactly on, or a fraction of a pixel inside, the ground boundary while the
  scoring rule previously required the full ball to be strictly above it.
- Added a 1.5-pixel goal-mouth tolerance matching normal physics-solver slop.
  Rolling balls now score consistently at either goal while shots above the
  crossbar and balls that fall behind the goal after an earlier miss remain
  non-goals.
- Added symmetric unit coverage and changed the physical browser goal scenario
  to a real ground-level roll. Verified 71/71 unit tests, production web build,
  full desktop/touch/tablet browser flow, required web-game client, and visually
  inspected the captured goal state.
- No Android build, sync, install, or launch was performed; this fix remains
  queued for the next owner-authorized deployment.

## Luna roster and character polish (queued, 2026-07-12)

- Added Luna as the fourth selectable footballer, with her reference-defining
  dark ringlet curls and joyful closed-eye smile carried through both the menu
  portrait and a complete 12-pose gameplay sheet. Her purple/yellow kit keeps
  her visually distinct at gameplay scale.
- Generated the character artwork with OpenAI image generation, using a green
  chroma background for clean local transparency without desaturating the
  purple uniform. The runtime packages the optimized WebP gameplay atlas while
  retaining a high-resolution PNG source alongside it.
- Extended the shared roster metadata, boot loading, selectors, native-facing
  logic, labels, stats, and fallback behavior. The four-character roster now
  supports all 12 ordered, non-duplicate matchups, including Luna playing as
  herself against Joel, Bob, or Lucia.
- Made pointer-down debouncing opt-in per button: rapid selector taps remain
  reliable on Android-style touch input without changing the immediate Music
  and Sound Effects mute behavior. Added an end-to-end assertion that the menu
  selection carries into the actual match.
- Added a lightweight upper-head collision cap so balls contact the visible
  hair/head region instead of passing through it, while preserving the existing
  body center, foot baseline, movement, and jump feel.
- Verified 73/73 unit tests, the production web build, the complete desktop and
  simulated-tablet gameplay suite, and the required web-game Playwright client.
  Visually inspected Luna in standard and extended-tablet selectors, her live
  chilena pose, sprite hair clearance, and the physical head-contact regression.
- Per owner instruction, no Android build, sync, install, or launch was
  performed; Luna and the accumulated polish remain queued for the next
  explicitly authorized tablet deployment.

## iPhone Home Screen fullscreen layout (web, 2026-07-12)

- Added a wide-landscape-phone stage for touch devices below 600 CSS pixels on
  the short side. Instead of fitting a 16:9 canvas with black side bars, Phaser
  now expands the logical width and fills the entire landscape viewport.
- Extended the stadium horizontally beneath iPhone cutout areas, centered the
  original 1280×720 gameplay region, removed shell safe-area letterboxing on
  wide landscape phones, and kept all interactive controls shifted inward from
  the physical edges.
- Enlarged wide-phone menu portraits, labels, buttons, icon buttons, volume
  knobs, and gameplay touch controls by up to 12% without changing desktop,
  16:9 phone, tablet, or Android-native sizing.
- Extended both goal artworks and crossbar colliders into the added side bands,
  keeping their inner posts and scoring lines unchanged while placing the nets
  against the visible phone edges.
- Added iOS standalone/fullscreen metadata plus a game-scoped web manifest with
  landscape orientation and the authored app icon.
- Added unit coverage for wide-phone detection and UI scaling, browser coverage
  requiring an edge-to-edge 844×390 canvas, goal-edge registration, and the
  complete existing touch journey through selectors, settings, gameplay,
  chilenas, powers, pause, and abandon confirmation.
- Verified 75/75 unit tests, production web build, complete desktop/touch/tablet
  browser suite, required web-game client, and visually inspected wide-phone
  menu, Settings, confirmation, and live-match screenshots. Android was not
  rebuilt, synced, installed, or launched.

## Single-fire iPhone character selectors (web, 2026-07-12)

- The first wide-layout release-only attempt did not stop the real-device iOS
  event sequence. Replaced it with an input-layer guard on every touch selector:
  the intended pointer-down changes the character immediately, then the button
  ignores compatibility pointer events for 500 ms after release. Desktop mouse
  selectors keep their original 50 ms cadence.
- Added a wide-phone regression that reproduces an intended press/release plus
  iOS-style compatibility press/release, verifies only one character change,
  waits through the guard, then confirms the next deliberate tap still works.
- Verified 75/75 unit tests, production build, the complete desktop/touch/tablet
  browser suite, and the required web-game client. Android was not rebuilt or
  deployed.

## Uncle Juan and installable mobile web app (web, 2026-07-12)

- Added Uncle Juan / Tío Juan as the fifth selectable footballer, with a
  reference-based menu portrait, a complete optimized 12-pose gameplay atlas,
  native-facing metadata, individual stats, and bilingual names throughout the
  selector, HUD, results, and debug state.
- Normalized portrait dimensions after texture swaps so mixed 512 px and 1024 px
  source art keeps an identical menu footprint. Grounded Juan's kick frame on
  the shared 418 px atlas baseline and verified every pose keeps safe padding.
- Added a mobile-only Install App button. Chromium uses the native PWA prompt
  when it is available; iPhone/iPad displays concise Share → Add to Home Screen
  instructions, because Safari does not expose a programmatic install prompt.
  The button stays hidden in an already installed app and in Capacitor.
- Added a scoped service worker with network-first navigation and cached game
  assets, dedicated 180/192/512 px Home Screen icons derived from the Android
  icon, and separate regular/maskable manifest entries.
- Verified 76/76 unit tests, the production web build, the complete
  desktop/wide-phone/tablet browser suite, and the required web-game Playwright
  client. Visually inspected Juan in the selector and the mobile install modal.
  Android was not rebuilt, synced, installed, or launched.

## Uncle Juanjo and cartoon Uncle Juan refresh (web, 2026-07-12)

- Added Uncle Juanjo / Tío Juanjo as the sixth selectable footballer. His final
  design combines two identity references: today's face plus his signature
  squared black hairline, dark rectangular glasses, broad toothy grin, and
  smiling eyes. His charcoal/burgundy kit and pink accent distinguish him from
  the rest of the roster.
- Replaced Uncle Juan's semi-realistic artwork with a simplified chibi design
  matching Joel, Lucia, and Luna, while preserving his navy/teal kit and adding
  the requested affectionate little belly.
- Generated final portraits and 12-pose source sheets with the built-in image
  generator on chroma green, removed the chroma locally, and extended the
  reproducible atlas builder to pack uneven 4x3 contact sheets into the game's
  exact 320x480 frame contract. Detached speed/stun effects are removed, all
  visible frames retain at least 8 px horizontal padding, and every new pose
  registers on the shared 418 px internal foot line.
- Expanded roster metadata to six characters and all 30 non-duplicate matchups,
  including bilingual labels, native-facing behavior, selector persistence,
  distinct stats, fallbacks, and diagnostic state.
- Verified 76/76 unit tests, production web build, full desktop/wide-phone/
  tablet browser journey, and the required web-game Playwright client. Visually
  inspected both refreshed menu portraits, Juanjo's live match rendering, and
  both complete animation atlases. Android was not rebuilt or deployed.

## Performance and gameplay-polish audit (2026-07-12)

- Audit only: no runtime behavior was changed. The clean production build still
  succeeds and emits one 1,647.01 kB minified / 390.60 kB gzip JavaScript chunk.
- Startup currently preloads the arena, all six portraits, and all six 1280×1440
  fighter atlases before leaving Boot. Those visual files total about 7.8 MiB;
  the six decoded atlases alone occupy about 42.2 MiB as RGBA textures even
  though a match uses only two. Highest-value loading slice: boot the current
  menu pair, idle-prefetch other portraits, and load only the selected match
  atlases behind a small match-loading transition. Convert the 2.7 MiB arena
  PNG to a visually verified WebP/AVIF variant and move legacy/source PNGs out
  of `public/` so they no longer inflate the 27 MiB web distribution and APK.
- Scene code is statically imported into the single entry chunk and Phaser's
  packaged ESM build dominates it. Dynamic scene registration can defer Match
  and Lab code; a separate Phaser vendor chunk improves repeat-deploy caching
  but does not reduce first-load bytes. A custom Phaser Canvas+Matter build is
  the only likely large JS reduction and should be benchmarked before accepting
  its maintenance cost.
- Audio warming is progressive after unlock, but `setScene()` also calls
  `primeMediaFromCache()` during Splash; on a cold cache, `playableUrl()` fetches
  the current track, ambience, ball effect, and whistle in parallel with visual
  boot. Prime only cached entries before unlock, then warm the current music and
  match essentials during idle time; keep the remaining tracks sequential and
  data-saver-aware.
- Fireball/player tunneling remains plausible: power velocity reaches 46
  logical px/tick, Matter collision handling is discrete, and only
  `collisionstart` triggers the counter path. Current browser coverage counters
  at speed 18 and does not place a max-speed fireball through a player. Add a
  swept segment-versus-expanded-player collision test (or power-only physics
  substeps), correct to time of impact, and add mirrored body/head regressions
  at maximum speed.
- Fighter collision geometry has one spawn-facing foot part that does not
  mirror after facing changes, while kick/combat reach is a broad center-point
  rectangle active for the full kick timer. Replace it with a symmetric lower
  body plus a short-lived front-foot strike capsule synchronized to the contact
  animation; include the ball radius and sweep its previous/current position.
- Add a deterministic clash/deadlock resolver for two grounded players pushing
  or kicking toward each other with low relative speed: short symmetric recoil,
  a brief clash cooldown, and an upward ball pop when the ball is trapped
  between their feet. Cover held inward movement plus repeated kicks for both
  sides so the resolver cannot introduce jitter or meter farming.
- Make ordinary lob launch solve a bounded ballistic arc toward a landing point
  just beyond the opponent, with distance/airborne lead and conservative clamps;
  the current lob uses one fixed speed/lift pair and ignores opponent position.
- Touch actions currently form a loose five-button arc. Group Kick and Lob as
  an adjacent primary pair, separate Jump spatially, and treat Dash as movement
  while keeping Power isolated to prevent accidental use. Verify thumb reach,
  simultaneous movement/action, wide-phone safe areas, and an optional mirrored
  layout before changing production coordinates.
- Lower-risk render cleanup: update HUD text/graphics only when score, clock,
  integer meters, or inventory changes; cache the sanitized profile instead of
  cloning it every render; and consider baking each seven-object glass control
  base into a shared texture. Existing Samsung profiling is already healthy,
  so these are secondary to loading and collision correctness.

### Implementation checkpoint

- Added pure, mirrored contracts for swept circle-versus-player-bounds contact,
  opponent-aware lob launch, and grounded inward player-clash detection.
- Focused verification passes: 41/41 `pure.test.js` tests.
- Next: integrate these contracts into MatchScene, add maximum-speed fireball
  and repeated-kick deadlock browser regressions, then stage fighter assets.

### Integrated performance and gameplay polish

- Boot now decodes all six lightweight menu portraits but only the current
  lineup's two 1280×1440 gameplay atlases. A dedicated MatchLoading scene shows
  the arena spinner while loading only newly selected atlases before kickoff.
- Replaced the 2.7 MiB runtime arena PNG with a visually inspected 268 KiB WebP.
  Lossless arena, legacy sheets, generated PNG atlases, goal study, and launcher
  master were preserved under `source-assets/` instead of being copied into
  every web distribution and APK. Updated the reproducible atlas builder paths.
- Cold-start audio priming now uses only existing Cache Storage entries and no
  longer starts four full audio fetches during Splash. Post-gesture warming
  prioritizes the current track, ball, whistle, and match ambience before the
  remaining music, retaining sequential and data-saver behavior.
- Added maximum-speed swept power-ball contact against expanded live player
  bounds. Missed discrete Matter contacts are moved to time of impact and either
  countered during a kick or physically rebounded; diagnostics count saves.
- Centered the physical foot collider so it remains symmetric after facing
  changes. Ball and combat strikes now share a front-foot capsule including the
  ball/player radius and exclude late recovery frames.
- Ordinary lobs now vary bounded speed, lift, and landing target using defender
  distance and airborne position. Close blocks receive steeper chips; distant
  defenders receive faster, longer arcs; mirrored play uses the same contract.
- Added a deterministic inward-push/repeated-kick clash resolver with symmetric
  recoil, cooldown, haptic/particle feedback, and a meter-free upward pop for a
  ball trapped between both players.
- Reorganized touch controls: Kick and Lob are an adjacent primary pair, Jump
  and the now-clearly-visible Dash form an upper action row, Power is isolated,
  and the Left/Right centers moved from 140 px to 180 px apart after visual
  feedback showed the first revision was still too cramped.
- HUD text and Canvas meter geometry now update only when visible score, clock,
  integer meter, flash step, or inventory values change. Phaser is emitted as a
  separate vendor chunk for durable repeat-visit caching across gameplay deploys.
- Verification: 81/81 unit tests, production build, required web-game client
  reaching live gameplay, and complete desktop/wide-phone/tablet browser suite.
  Runtime/public cleanup reduced the generated distribution from about 27 MiB
  to 14 MiB; the game bundle is now a 171.20 kB app chunk plus a cache-stable
  1,481.79 kB Phaser vendor chunk. The first full
  browser run hit the project's known intermittent Escape timing assertion; an
  unchanged rerun and the final post-layout run passed. Visually inspected clean
  captures for the optimized arena, swept fireball save, clash release, revised
  wider movement controls, visible Dash, grouped Kick/Lob, and pressed icon
  scaling. No Android build, sync, install, or launch was performed.

## Directional double-tap dash and simplified controls (2026-07-13)

- Removed the sustained 1.5× sprint mechanic, the standalone Dash touch button,
  and the desktop C/L Dash bindings. Ordinary held movement now has one
  consistent speed and one less action competes for thumb space.
- Double-tapping either movement direction within 280 ms now starts the same
  cooldown-governed ground dash in the direction the player deliberately
  pressed. The direction is never silently redirected, so double-tapping away
  from an opponent produces a true reverse/defensive dash while keeping the
  fighter visually engaged with play.
- Added contextual dash diagnostics that classify the chosen move as a
  challenge, ball recovery, defensive retreat, or attacking run. The ball,
  opponent, facing, and goal geometry inform the purpose without overriding the
  player's arrow input.
- Updated heuristic opponents to emit the same `dashDirection` intent. Easy AI
  strips directional dash capability; Normal and Hard use it selectively for
  pressure, recovery, and positioning.
- Updated English/Spanish onboarding, Help, difficulty copy, provider docs, and
  the gameplay specification. Preserved the retired run icon under
  `source-assets/` instead of shipping it in `public/`.
- Verification: 81/81 unit tests, production build, `git diff --check`, and the
  complete browser gameplay suite all pass. Browser coverage includes real
  keyboard and touch double-taps, forward and reverse dash, airborne rejection,
  the removed C binding/button, and AI difficulty behavior. The required
  web-game client reached live play at 1:22; its state reported a fully warmed
  9/9 audio cache and the new directional-dash controls. Visually inspected the
  live match plus dedicated forward, reverse, touch, landscape-control, and Help
  captures; the wider arrows and four-button action cluster remain clear and
  balanced. No Android build, sync, install, or launch was performed.

## Field and physics-object customization (2026-07-13)

### Implementation checkpoint

- Added a persisted Match Playground selection with three field themes
  (Skycourt, Neon Grid, Sunset Beach) and six kickable objects. Classic and
  Neon footballs intentionally share identical fair-play physics; Balloon,
  Rugby Ball, Soda Can, and Cannonball use distinct material presets.
- Added original lightweight SVG artwork for the five new object designs. The
  soda can uses a chamfered rectangle collider; all other objects expose their
  effective collision radius for strikes, swept power contact, bounds, and
  goal-mouth scoring.
- Added per-object restitution, air drag, density, speed/lift response, speed
  cap, and deterministic wobble. The balloon receives partial buoyancy, rugby
  and can surface contacts kick sideways/tumble, and the cannonball stays low
  and heavy.
- Added a bilingual customization scene with live field treatment, animated
  object preview, persistent cycling, physics-feel copy, back navigation, and
  direct match launch. The Intro now exposes a dedicated Field & Ball button.
- Added browser regressions for field/object cycling, refresh-safe persistence,
  restoring defaults, direct match launch, cannonball material diagnostics,
  and its measurably reduced ordinary-kick speed/lift. The existing full match,
  scoring, power, desktop, touch, wide-phone, and tablet flows still pass.
- The first visual pass revealed that theme grid/wave graphics sat 0.02 depth
  above default UI and washed across the selection cards. Moved theme treatment
  into the arena layer and reran the required web-game client; the fixed cards
  are opaque and readable while the live field retains its treatment.
- Final verification: 84/84 unit tests, production build, `git diff --check`,
  the required web-game client, and the complete browser suite pass. One first
  browser run reached the project's known intermittent late Escape assertion;
  the unchanged rerun and final post-fix run passed. Visually inspected the
  default playground, Neon+Balloon, Beach+Cannonball, Beach+Soda Can, the home
  screen entry point, and an active Beach+Cannonball match. No new console/page
  errors appeared. No Android build, sync, install, or launch was performed.

### Genuine imagegen arena alternatives

- Replaced the Neon and Beach color treatments after user feedback that they
  were not true alternative fields. Used the built-in Image Generation skill
  in edit mode with the lossless Skycourt as the geometry/composition target.
- Generated two complete goal-free background illustrations: Neon Grid has
  new night architecture, crowd lighting, skyline, floodlights, and violet
  playing surface; Sunset Beach has bamboo terraces, palms, ocean, islands,
  sunset lighting, and a firm sand pitch. Both preserve the side camera,
  center markings, unobstructed level field, and ground-contact line required
  by the existing physics and goal placement.
- Preserved the generated PNGs as `source-assets/arena-neon.png` and
  `source-assets/arena-beach.png`; shipped 1920×1080 WebP derivatives are about
  224 KiB and 248 KiB respectively. Full imagegen prompts are recorded in the
  runtime art manifest.
- Removed runtime tint, wash, grid, and wave painting. Arena records now point
  to distinct Phaser textures, and the Match Playground thumbnails display the
  real images. Boot loads only the persisted arena; entering Match Playground
  lazily loads the two alternatives.
- Replaced scene restarts during selection with live texture/preview updates,
  avoiding unnecessary reloads and pointer-state artifacts while preserving
  immediate profile persistence.
- Verification: 84/84 unit tests, production build, full browser suite, and the
  required web-game client pass. Visually inspected both selection screens and
  an active Beach+Cannonball match; generated architecture stays clear of the
  runtime goals, HUD, fighters, and ball. No Android build, sync, install, or
  launch was performed.

## Distance-adaptive tactical lob revision (2026-07-13)

- Reworked the ordinary lob distance curve around its tactical purpose: a
  defender within 110 logical pixels now triggers a bounded maximum-height
  launch, while distance through 440 pixels progressively trades vertical lift
  for horizontal speed. Landing targets remain at least 220 pixels forward and
  aim beyond the defender within arena bounds.
- Increased standard close-lob lift from roughly -14 to -19 and reduced its
  horizontal launch speed to 7.3. At long range the bounded curve reaches about
  -14.6 lift and 11.4 speed. Airborne defenders add a small extra lift modifier.
- Added deterministic apex/head-clearance diagnostics to each lob plan and
  exposed them through `lastLobStrike` for browser verification.
- Added pure regressions for mirrored close/far behavior, more than 100 pixels
  of planned apex separation, substantial close head clearance, and the
  point-blank height cap. Added a provider regression confirming the AI falls
  back toward a high lob's projected landing point. A rising lob projected to
  land behind the AI now suppresses its premature overhead jump so it stays
  grounded and retreats instead of stopping the ball without moving.
- Browser coverage now measures both complete trajectories: the nearby-defender
  lob launches at least 2.5 velocity units steeper and reaches an actual apex
  over 80 pixels higher than the distant-defender lob. The inspected close-lob
  frame clears the grounded defender by a wide margin near the HUD.
- Verification: 86/86 unit tests, production build, `git diff --check`, the
  required web-game client, and the full browser suite pass. The first final
  browser run hit an unrelated intermittent chilena landing-timing assertion;
  the unchanged rerun passed. Visually inspected the dedicated close-defender
  lob near its apex and a naturally produced AI close lob with a reported
  201-pixel estimated head clearance. No Android build, sync, install, or
  launch was performed.

## Uncle Juanjo sprite registration repair (2026-07-13)

- Traced the apparent haircut to the source contact sheet rather than Phaser:
  Juanjo's anticipation/recovery hair extends above the nominal third-row cell,
  and the rigid 4x3 crop discarded those original pixels. Reworked contact-sheet
  extraction to support a 64-pixel overlap and select the connected subject with
  the greatest coverage in its intended cell. Enabled recovery only for Juanjo,
  so Uncle Juan and the other atlases remain byte-for-byte governed by their
  existing extraction path.
- Preserved the original artwork instead of synthesizing replacement hair. The
  regenerated anticipation and recovery frames now retain the complete crown;
  the recovery silhouette grows from 321 to 339 visible pixels and the
  anticipation silhouette from 315 to 330 while staying on y=418.
- Raised Juanjo's compact knees-up jump from 304 to 350 visible pixels (idle is
  380), removing the in-game shrink pop without making the airborne pose taller
  than his standing silhouette. Grounded pose registration and the fixed
  320x480 runtime cells are unchanged.
- Added browser atlas regressions for jump/idle height ratio and recovered kick
  silhouettes, plus a Juanjo-specific live retreat, real-input jump, and frozen
  three-stage kick visual sequence. Captures are
  `output/e2e/04-juanjo-retreat.png`, `04-juanjo-jump.png`, and
  `04-juanjo-kick-recovery.png`.
- Verification: regenerated source PNG/runtime WebP atlases, 86/86 unit tests,
  production build, `git diff --check`, and the complete browser gameplay/touch
  suite pass. The required web-game client independently selected Uncle Juanjo;
  its final inspected image/state are under
  `output/web-game/juanjo-fix-selector-final/`. One initial full browser pass
  hit the existing intermittent maximum-speed fireball sweep assertion; the
  final unchanged gameplay runs passed. No Android build, sync, install, or
  launch was performed.

## Netlify web release (2026-07-13)

- Rebuilt the game, published the generated bundle into the clean sibling
  `luisnomad.com` repository at `public/games/joel-football/`, and retained the
  legacy `/games/head-soccer/` redirect page.
- Verified 86/86 game tests and a complete 103-page Astro production build,
  then committed the generated site payload as `819cb2f` (`feat: publish latest
  Joel Football web build`) and pushed `main` to the website repository.
- Confirmed the live response is served by Netlify and references the new
  `index-ypwthIlj.js` and `phaser-B61OQUcB.js` bundles. The game JS, corrected
  Juanjo WebP, Neon arena, and Beach arena all return HTTP 200 at their public
  URLs.
- Ran the required web-game client against the production URL. It reached the
  Intro, selected Uncle Juanjo, reported no console/page errors, and produced
  the inspected live capture at `output/web-game/netlify-live/shot-4.png`.

## Uncle Juan jump scale repair (2026-07-13)

- Applied the calibrated contact-sheet jump height already proven for Juanjo to
  Uncle Juan. His knees-up jump silhouette is now 350 pixels instead of 287,
  while idle remains 380 and the internal foot anchor remains y=418.
- Generalized the browser atlas regression so both Juan and Juanjo must retain
  at least 90% of their idle silhouette height during the jump frame.
- Added a dedicated real-input Uncle Juan match scenario and inspected
  `output/e2e/04-juan-jump.png`; the head/torso scale remains consistent while
  the tucked legs still communicate an airborne pose.
- Verification: regenerated the source/runtime atlas, 102/102 unit tests,
  production build, `git diff --check`, complete browser gameplay/Kickfall/touch
  suite, and required web-game client pass. The client independently selected
  Uncle Juan without console/page errors; artifacts are under
  `output/web-game/juan-jump-fix/`. This follow-up has not been redeployed.

## Kickfall mini-game prototype (2026-07-13)

- Recorded the requested falling-ball/brick-gate mini-game in
  `docs/KICKFALL_SPEC.md` before implementation.
- Fixed the prototype scope at one three-tier zigzag, two one-hit gates, eight
  stacking balls, three-second spawns, a two-second danger grace, selected
  character reuse, and explicit victory/defeat/retry/menu flows.
- Chose a dynamic scene import plus a mini-game-only asset directory so neither
  playable code nor exclusive art joins the opening payload.
- Kept Kickfall physics separate from the normal singleton `Ball` and
  ground-specific `Fighter`; only shared character content and UI conventions
  are reused.

### Kickfall TODO

- Implement the lazy loading shell, exclusive asset pack, scene, rules, input,
  collision behavior, feedback, diagnostics, and Intro entry.
- Add unit tests for danger/gate/terminal rules and browser coverage for the
  entry, kick-to-break, drain/victory, defeat, retry, and menu paths.
- Run the required web-game client, inspect active and result screenshots, and
  complete the full unit/build/browser regression pass.

### Kickfall implementation checkpoint

- Added a bilingual Intro entry and a generic loading shell that dynamically
  imports the playable scene. The production build emits Kickfall as its own
  25.36 kB JavaScript chunk.
- Added an exclusive SVG backdrop, ramp, brick gate, and ball pack under the
  mini-game asset directory; the playable scene alone requests them.
- Implemented the three-tier Matter board, two solid breakable gates, stacking
  ball bodies, selected-character movement/jump/kick, simplified touch input,
  armed-ball gate damage, danger recovery/grace, drain accounting, result
  overlays, retry/menu flows, diagnostics, and debug fixtures.
- Existing verification remains green at 86/86 tests, production build, and
  `git diff --check`. The first browser entry found that deterministic stepping
  could run during asset preload before input creation; preload stepping is now
  render-only and has a dedicated guard.

### Kickfall browser and gameplay refinement

- Added six pure rule tests for danger accumulation/recovery, one-hit armed
  gate contact, terminal-state priority, victory quota, and isolated progress.
- Added permanent browser coverage for deferred code/assets, selected-character
  reuse, natural no-input pile-up defeat, real keyboard hits against both gate
  directions, physical bottom-drain accounting, victory, Retry, danger defeat,
  menu return, and an extended-tablet touch kick.
- The first natural-pressure proof exposed a genuine stalled-run case: all
  available balls could settle below the line without room for the next ball.
  A blocked hatch now fills the same grace meter, matching the requested Tetris
  rule. A visible ball-only hatch rail also narrows the top queue so ignored
  balls physically stack upward while the player can still reach their rear.
- Replaced result-container layering with explicit display depths after visual
  inspection found a post-Retry defeat capture with hidden button artwork. The
  corrected defeat, victory, gate-break, Intro entry, and tablet touch layouts
  were visually inspected.
- The first complete browser run reached an unrelated timing-sensitive match
  boost assertion; the next unchanged run passed. After the hatch and drain
  coverage was added, the complete 260-check browser suite passed.

### Kickfall final prototype verification

- Final unit verification passes 92/92 tests across five files, including the
  six new Kickfall rule contracts.
- Final production build succeeds and emits the playable mode as
  `KickfallScene-DVq3Jolc.js` (26.47 kB, 8.42 kB gzip) rather than folding it
  into the 190.24 kB opening application chunk. The existing stable Phaser
  vendor chunk remains the only size warning.
- The required `develop-web-game` client entered the live lazy-loaded mode and
  naturally reached defeat with seven physical balls: six settled against the
  first gate and the seventh stacked above them across the danger line.
- The final 260-check browser suite passes after covering desktop, touch,
  dynamic assets, real gate kicks, actual bottom draining, both result paths,
  retry, and menu return. `git diff --check` also passes.
- Visually inspected `01-intro.png`, `01-kickfall-gate-break.png`,
  `01-kickfall-victory.png`, `01-kickfall-defeat.png`,
  `01-kickfall-natural-pile-up.png`, and
  `08-extended-tablet-kickfall.png`; final UI, controls, stacking, brick debris,
  and overlays are present and legible.
- No Android build, sync, install, or launch was performed.

### Kickfall next steps

- Play-tune spawn interval, kick impulse, character scale, and the top queue
  capacity with human sessions before adding progression.
- Replace Continue's prototype restart with seeded level progression built from
  the validated tier-module rules in `docs/KICKFALL_SPEC.md`.
- Add reinforced gates and special balls one pressure axis at a time only after
  the fixed layout's completion and failure rates are understood.

### Kickfall traversal and density refinement (2026-07-13)

- Reworked the prototype from three thick tiers/two gates to four thinner
  tiers/three gates, with a smaller character and ball scale and a final
  bottom-left drain.
- Replaced slow force accumulation with responsive target-speed movement and
  exposed the active visual frame/pose in diagnostics so the enhanced run
  animation can be browser-verified.
- Split vertical direction from jumping: W/Up and S/Down now perform a short
  adjacent-tier transfer, Space is the dedicated jump, and touch has a four-way
  pad plus separate Jump and Kick controls. Transfers refuse corridors occupied
  by a live brick gate or ball.
- Removed the redundant Intro rule/help panel and moved the primary menu stack
  upward to give the home screen more breathing room.
- Expanded browser contracts to cover movement distance, run animation,
  keyboard tier transfers, separate jump behavior, Gate C, the left drain, and
  touch tier/jump controls.
- Final verification passes 92/92 unit tests, the production build, and the
  complete browser suite across desktop, wide-phone touch, and extended-tablet
  layouts. The browser suite's pre-existing timing-sensitive Escape assertion
  failed once and passed on the immediate unchanged rerun.
- The production build still keeps Kickfall deferred in its own
  `KickfallScene-DVVGhFGW.js` chunk (29.29 kB, 9.29 kB gzip).
- Ran the required web-game client and inspected the refined board. Also
  inspected the final Intro, natural pile-up, gate-break, and extended-tablet
  screenshots; four-tier spacing, three-gate progression, menu cleanup, and
  the directional/jump/kick touch controls are legible and unobstructed.

### Kickfall physics and grounding refinement (2026-07-13)

- Fixed the apparent character levitation by applying the same authored
  418-pixel foot anchor used by the main match to Kickfall's smaller sprite.
  Diagnostics now expose the current ramp surface and visual foot-anchor Y;
  the inspected result differs by only 0.36 px.
- Increased Kickfall gravity, reduced character air drag, and added post-apex
  fall acceleration. Browser coverage now requires a Space jump to return to
  the same ramp within 700 ms on desktop and tablet.
- Made adjacent-tier navigation reliable with a 240 ms input buffer, geometric
  grounded fallback, and nearby clear-corridor selection. Intact gates and
  balls still cannot be crossed.
- Increased ramp inclination and replaced the negligible ball force with a
  bounded downhill target speed. A focused browser fixture now requires useful
  displacement and velocity within 400 ms.
- The first roll-response setting passed displacement but produced only 1.37
  horizontal velocity in the browser fixture, so it was increased and retested.
- Final verification passes 92/92 unit tests, production build, and the complete
  browser suite. The required web-game client was run after both meaningful
  tuning passes; its state showed a successful top-to-upper transfer, prompt
  jump landing, and a 0.36 px foot-to-ramp registration gap. Normal e2e captures
  of the gate break, natural pile-up, and tablet landing were visually inspected
  after one client WebGL readback produced a partial black-frame artifact with
  otherwise complete state and no console errors.

### Kickfall Level 2 challenge prototype (2026-07-13)

- Added two authored level configurations. Level 1 remains the untimed
  eight-ball baseline; Level 2 schedules ten balls every 2.65 seconds and runs
  on a 60-second clock.
- Continue now advances from Level 1 to Level 2, Retry preserves the active
  level, and the final prototype level no longer exposes a misleading Continue
  action.
- Added a cyan ball-only catch pocket on the upper lane and an amber three-tooth
  kick cleat on the lower lane. Unarmed balls remain stalled; a real kick in the
  lane's flow direction releases each ball through the existing armed window.
  Obstacles reset per ball rather than disappearing after one clear.
- Added bilingual level, clock, obstacle, and timeout copy plus concise level,
  timer, obstacle, stalled-ball, and passed-obstacle diagnostics.
- Added two pure contracts for the Level 2 definition and timeout defeat. The
  full browser flow now verifies Level 1 victory, Continue progression, both
  real kick releases, timeout defeat, Level 2 Retry persistence, and the danger
  defeat path.
- The required web-game client passed entry/movement with the new level-aware
  state. The complete browser suite passed twice after adding progression. A
  transient black-block WebGL capture on the first post-kick screenshot was
  resolved by allowing the renderer to settle; the rerun capture is complete.
- Visually inspected the clean Level 1 client capture and the final Level 2
  countdown, obstacle-release, and timeout screenshots. Final verification
  passes 94/94 unit tests, production build, `git diff --check`, and the complete
  desktop/phone/tablet browser suite.

### Kickfall next challenge steps

- Play-tune the 60-second Level 2 clock with human sessions before reducing it.
- Record how often balls stall at each obstacle and whether the player can
  recover without danger-line failure; those rates should guide Level 3.
- Add only one new pressure axis in Level 3, preferably a two-hit reinforced
  gate before introducing moving bumpers or reverse belts.

### Kickfall cross-tier obstacle fix (2026-07-13)

- Reproduced the reported Level 2 pocket bug: obstacle capture considered only
  horizontal distance, so a top-tier ball directly above the upper-tier pocket
  was teleported down and marked as stalled.
- Added a browser regression before the fix. It failed with the top-tier ball's
  `stalledObstacleId` incorrectly set to `pocket-a`.
- Scoped pocket and cleat interactions to both the obstacle's authored tier and
  a small vertical tolerance around that ramp. Correct-lane stall and real-kick
  release behavior remains unchanged.
- Visually inspected the focused Level 2 capture with the ball remaining on the
  top ramp over an empty pocket, plus a live Level 1 run from the required
  web-game client. No client console-error artifact was produced.
- Final verification passes 94/94 unit tests, the production build, and the
  complete browser suite. The first post-fix browser run passed the new
  Kickfall regression and later hit the suite's known timing-sensitive desktop
  Escape assertion; the immediate unchanged rerun passed end to end.

### Kickfall queue and combo-control refinement (2026-07-13)

- Reproduced the obstacle stacking bug with two balls at the pocket: both were
  assigned the same captive state and hold position instead of colliding as a
  queue.
- Obstacles now own one captive-ball slot. The captive becomes a solid physical
  anchor while later balls remain normal ball bodies, visibly queue behind it,
  and advance one at a time as the lead ball is released.
- Kicks within reach prioritize the captive lead ball over nearer queued balls,
  preventing a multi-ball queue from making the obstacle impossible to clear.
- Moved the pocket and cleat prompts above the full ball silhouette; the longer
  Spanish pocket copy no longer renders through the ball.
- Changed tier navigation to require Jump + Up/Down on keyboard and touch.
  Up/Down alone no longer changes lanes, while Jump alone retains the ordinary
  same-lane jump.
- Added pure input-contract coverage and desktop/tablet browser regressions for
  arrow-only input, both lane-transfer directions, ordinary jumping, physical
  queues at both obstacle types, lead-ball kick release, and prompt clearance.
- TDD evidence: the focused input test first failed because the combo resolver
  did not exist, and the browser queue regression first failed with the trailing
  ball incorrectly assigned to `pocket-a`; both pass after implementation.
- Final verification passes 95/95 unit tests, the production build,
  `git diff --check`, and the complete desktop/phone/tablet browser suite. The
  required web-game client entered live Kickfall with the updated control
  diagnostics and produced no console-error artifact.
- Visually inspected clean pocket and cleat queue captures, the corrected prompt
  placement, the tablet character landed after Jump + Down, and the live Level 1
  client board. Resetting completed camera FX before the focused cleat capture
  eliminated the intermittent headless WebGL readback blocks.

### Kickfall production-art pass (2026-07-13)

- Selected a cohesive neon maintenance-shaft direction: a cyan recessed intake,
  an amber three-pad mechanical bumper, and coral masonry inside a navy/gold
  breakable industrial frame.
- Generated all three opaque source illustrations with the built-in image tool
  on flat chroma backgrounds, preserved the full generated sources under
  `source-assets/minigames/kickfall/`, removed the backgrounds with a soft matte,
  despill, and one-pixel edge contraction, and created downscaled alpha PNGs for
  the lazy-loaded runtime bundle.
- Integrated the pocket, bumper, and gate textures without changing their
  collision dimensions or obstacle rules. Gate destruction now emits cropped
  fragments from the actual masonry art instead of generic rectangles.
- Updated the public manifest, Kickfall art contract, and source prompt/processing
  README so future Level 3 assets can extend the same visual system.
- Final verification passes 95/95 unit tests, the production build,
  `git diff --check`, and the complete desktop/phone/tablet browser suite. The
  browser suite also asserts all three new PNGs remain in the lazy Kickfall
  payload and gate destruction emits fragments from the production texture.
- The required web-game client entered a live Level 1 run with no captured
  console errors. Visually inspected the clean Level 1 gate board, Level 2
  pocket/bumper board, both physical queue fixtures, and the gate-break frame;
  assets are aligned, legible at gameplay scale, and free of chroma fringe.

### Kickfall integrated catch-rail revision (2026-07-13)

- Replaced the floating oval pocket visual with a hand-authored SVG magnetic
  catch rail whose masonry cassette masks and matches the platform below it.
- Kept the existing lane-scoped capture and collision behavior unchanged: the
  board remains physically continuous, only the lead ball is retained, and a
  correctly directed kick releases it.
- Removed the broad glow and above-deck portal silhouette. The new low rollers,
  shallow dark brake channel, fasteners, and cyan rail sit inside the platform
  thickness so queued balls remain visible and the obstacle stays crisp at any
  rendering scale.
- Updated the lazy-payload browser contract and asset/spec documentation. The
  generated oval is retained only as non-runtime source history.
- Verified the new Level 2 empty, cross-tier guard, and two-ball queue captures;
  the rail follows the lane angle, stays inside the platform thickness, and
  leaves both balls readable. The required web-game client reached live
  Kickfall with no captured errors. Final checks pass: 95/95 unit tests,
  production build, `git diff --check`, and the complete desktop/phone/tablet
  browser suite (the known timing-sensitive Escape assertion passed on the
  standard unchanged rerun).

### Kickfall direct-contact kicking fix (2026-07-13)

- Reproduced the reported remote kick with a permanent browser fixture: a ball
  86 px ahead of the player was incorrectly launched and armed by the old
  125×78 px proximity rectangle. The new assertion failed with ball id `2`
  where no kicked ball was expected.
- Replaced the broad selection rectangle with circle-overlap geometry between a
  small 8 px strike shape at the forward boot and the physical 18 px ball. A
  separated ball is ignored; a ball touching the extended kick pose connects.
- Reset `lastKickedBallId` on every kick attempt so diagnostics report misses
  accurately, and moved gate/obstacle debug fixtures into real contact range.
- Added pure mirrored contact tests plus browser regressions and inspected the
  rejected-distance, contact-ready, and launched-ball captures. Final
  verification passes 96/96 unit tests, production build, `git diff --check`,
  the required web-game client with no captured errors, and the complete
  desktop/phone/tablet browser suite on the standard unchanged rerun.

### Kickfall twenty-level campaign (2026-07-13)

- Replaced the labeled danger-line prototype graphic with an integrated dark
  machinery channel and eighteen alternating coral warning inlays. Occupancy
  pulses the texture; the floating danger and intake legends were removed in
  both languages.
- Expanded the two-level prototype into twenty authored configurations. Level
  3 introduces flat lanes with no horizontal roll assist, Level 5 reinforced
  gates with visible health pips, and Level 6 uphill lanes that backslide unless
  the player keeps applying force. Later levels combine larger quotas, faster
  spawns, clocks, obstacles, lane modes, and stronger gates.
- Added rival encounters at Levels 10 and 20. The selected opponent physically
  blocks the bottom route and counter-kicks ordinary balls; only a directly
  player-kicked armed ball can stagger them toward the final drain. Boss defeat
  is an explicit victory condition.
- Persisted `highestUnlockedLevel` and `lastPlayedLevel` in the player profile.
  Returning players can continue at their saved level or restart the campaign
  from Level 1, while Retry remains on the current level.
- TDD began with failing contracts for all twenty levels, the three lane modes,
  reinforced gates, boss victory, and persisted campaign progress. Pure and
  store coverage now passes, and browser fixtures verify Levels 3, 5, 6, 10,
  and 20 plus the resume choice.
- Visually inspected the flat, reinforced, uphill, first-boss, finale, resume,
  and live fresh-profile boards. The required web-game client reached Level 1
  with the textured boundary, `maxLevel: 20`, and no captured console-error
  artifact. Final verification passes 101/101 unit tests, the production build,
  `git diff --check`, and the complete desktop/phone/tablet browser suite.

### Kickfall background boundary and pause flow (2026-07-13)

- Reworked the danger indicator after visual feedback showed the short strip
  reading as a foreground obstacle through the character. It now spans the full
  1280 px playfield as thirty-two repeated low-contrast background panels at a
  depth below platforms and all gameplay entities.
- Replaced the immediate Menu exit with a visible Pause control and the football
  match interaction model. P, Escape, and the HUD control freeze the complete
  simulation and show Resume, Restart Level, and Leave Kickfall.
- Leave Kickfall opens the shared confirmation overlay. Stay restores the
  existing paused run; Leave returns to Intro without erasing unlocked campaign
  progress. The same flow is available on keyboard, mouse, touch, and platform
  Back/lifecycle handling.
- Added browser regressions before implementation. The red run exposed the old
  412 px foreground strip; the green suite verifies background depth/width,
  frozen simulation time, P/Escape, cancel/confirm, and extended-tablet touch.
- Visually inspected the live board, pause menu, leave confirmation, and tablet
  pause capture. The required standalone web-game client reached a paused live
  Level 1 with accurate text diagnostics and no captured console-error artifact.
- Final verification passes 101/101 unit tests, the production build,
  `git diff --check`, and the complete desktop/phone/tablet browser suite.

### Kickfall flat-lane receiving wedges (2026-07-13)

- Added a mirrored triangular wedge against the outer receiving wall of every
  non-top flat tier. The simple deck-colored silhouette follows the supplied
  mockup and replaces the rejected mechanical chute/rail concept.
- The wedge has a real static incline and wall collision. A ball is captured
  only when its physical circle reaches that incline, is carried down the face,
  and then regains its normal bounce and free flat-lane physics immediately
  after clearing the inner tip.
- Kept the top flat feed unchanged because its authored spawn already leaves
  room behind the ball. This preserves the campaign rule that an untouched ball
  on ordinary flat ground stays still and must be pushed or kicked by the player.
- TDD started with a failing mirrored-layout contract, then a Level 4 browser
  fixture exposed an outward Matter rebound. The contact-scoped ramp response
  fixes that rebound without adding a proximity trigger or disabling ball-ball
  collisions.
- Visually inspected the Level 4 right-edge wedge and its released ball. The
  browser assertion verifies at least 70 px of inward travel and 180 px of
  standing/kicking clearance, and confirms the assist has ended before normal
  lane play resumes.
- Final checks pass 102/102 unit tests, the production build, `git diff --check`,
  and the complete desktop/phone/tablet browser suite. The required standalone
  web-game client also booted the packaged canvas with no console-error artifact;
  the feature-specific screenshot and text state came from the deterministic
  Level 4 browser fixture. No follow-up TODO remains for this wedge behavior.

### Kickfall Cosmic Foundry theme system (2026-07-14)

- Generated seven independent production assets with the built-in image tool:
  quiet space-city base, additive Milky Way, additive Moon, lane material,
  energy gate, empty catch rail, and three-pad kick cleat. The first catch-rail
  output incorrectly included a ball, so a targeted edit removed it before the
  runtime alpha pass.
- Kept full generated and alpha-intermediate files under
  `source-assets/kickfall/cosmic/`; optimized runtime WebP/PNG files live under
  `public/assets/minigames/kickfall/themes/cosmic/` and total roughly 436 KiB.
- Added `kickfallThemes.js` with `cosmic` and `workshop` manifests. Themes own
  lazy asset keys, visual palette, and ambient timing only; tier coordinates,
  Matter bodies, obstacle rules, and all level difficulty remain shared.
  Unknown theme IDs resolve to Cosmic Foundry, and scene data/profile can later
  provide a persisted screen-design choice without changing the scene API.
- Rebuilt the scene presentation around the selected theme: layered backdrop,
  three-minute additive Milky Way rotation, timed/ambient Moon travel, subtle
  twinkling stars, neon frame, themed warning boundary and HUD, metal lanes,
  energy gates, integrated traps, wedge panels, damage tint, and theme-cropped
  destruction fragments. Every ambient layer advances on fixed simulation time
  and therefore freezes with pause.
- TDD began with a missing theme module and then missing trap asset keys. Pure
  tests now lock fallback behavior, unique manifests, selected-only loading,
  and the absence of gameplay geometry from themes. Browser checks verify the
  seven Cosmic Foundry files stay out of boot, load only on Kickfall entry, the
  Workshop backdrop stays unloaded, layered diagnostics are present, motion is
  visible, and parallax freezes while paused.
- Visually inspected live Level 1, gate destruction, Level 2 two-ball obstacle
  queues, and the Level 4 flat receiving wedge. The required standalone client
  reached live Cosmic Foundry, advanced its animated layers, spawned four balls,
  and completed a natural pile-up defeat with no console-error artifact.
- Added `docs/KICKFALL_THEMES.md` for future complete or mixed screen designs
  and `docs/KICKFALL_COSMIC_ASSET_PROMPTS.md` with the final built-in prompt set.
- Final checks pass 104/104 unit tests, production build, `git diff --check`,
  and the full desktop/phone/tablet browser suite. One unrelated maximum-speed
  fireball assertion double-counted on the first run; the standard unchanged
  rerun passed the complete suite.

Future option: expose the existing `themeId` scene/profile hook in a screen-
design selector. No rendering or physics refactor is required for that UI.

### Kickfall magnetic capture and corner clearance (2026-07-14)

- Replaced the catch rail's first-frame teleport with a 320 ms magnetic capture
  state. The ball now eases through a lifted arc, rotates, pulses, and remains
  visible behind a cyan energy tether before settling into the held state.
  Kicking during or after the pull cancels the effect cleanly and restores the
  normal dynamic body; following balls still queue against the one lead ball.
- Reduced flat-lane receiving wedges from 88 px to 54 px and made their Matter
  ramp/wall bodies ball-only. Falling players now pass the receiver hardware and
  land on the actual lane below instead of becoming wedged between the ramp and
  the platform above. Ball receiving and inward handoff remain unchanged.
- Increased physical fall acceleration from 0.34 to 0.50 velocity units per
  fixed step and raised terminal fall speed from 14 to 15, removing the floaty
  final half of jumps and unassisted drops.
- Added red-first pure regressions for wedge clearance, the magnetic trajectory,
  and fall acceleration. Browser fixtures verify a visible mid-pull state, the
  final held state, player landing at the problematic Level 4 receiver corner,
  and the existing inward ball handoff after that player test is isolated.
- Visually inspected the magnetic mid-frame and player-clearance captures. The
  complete desktop/phone/tablet browser suite passes, and the required standalone
  web-game client reached live Cosmic Foundry with matching text diagnostics and
  no console-error artifact.

No follow-up TODO remains for this capture/corner/fall-speed pass.

### Kickfall forgiving input, recoverable queues, and timer pressure (2026-07-14)

- Removed the complete danger system: no warning stripe, HUD meter, danger
  counters, diagnostics, force-defeat helper, or danger terminal condition
  remains. Level 1 now provides a forgiving 90-second clock, so every authored
  level uses obstacles and time as its failure pressure. A blocked intake delays
  spawning but cannot defeat the player on its own.
- Added a 140 ms jump buffer so a press just before landing is retained. Any
  Space + Up/Down request that has no valid adjacent lane now falls back to a
  normal jump rather than swallowing the input; successful lane transfers still
  take priority.
- Added contiguous queue charge transfer. The player's kick still requires
  exact foot-to-rear-ball overlap, but its single armed charge travels through
  physically touching balls toward the gate. Only the leading charge can damage
  the gate, preventing a packed queue from becoming an unwinnable wall or
  multiplying one kick into several reinforced-gate hits.
- Fixed a magnetic catch-rail ownership bug reported during this pass. Once a
  rail owns a ball, its attraction now advances independently of the initial
  lane-tolerance check. A displaced ball therefore completes at the hold point
  (or releases from a real directed kick) instead of freezing in midair while
  later balls bypass the occupied rail.
- Added red-first pure regressions for timer-only outcomes, removed danger state,
  jump buffering, and queue charge transfer. Browser fixtures cover blocked
  direction fallback, buffered landing input, a seven-ball rear-kick gate break,
  a 26-second spawn pile that remains in play, the absent warning art, and a
  deliberately displaced magnetic capture watchdog.
- Visually inspected the clean timer-only board, buffered jump, queued gate
  breakthrough, stable held catch-rail ball, and non-fatal pile. The required
  standalone web-game client reached live Level 1 with a 90-second timer, no
  danger diagnostics, and no console-error artifact. Unit tests pass 107/107 and
  the production build passes. Every Kickfall browser assertion passes; the
  complete multi-mode browser run continues beyond Kickfall but currently stops
  later on the unrelated pre-existing tablet-match touch-mash assertion (one
  boost step registered where that test expects two).

Follow-up outside this request: stabilize the normal-match tablet touch-mash
test timing in `test/browser-game.mjs` without changing its boost balance.

### Kickfall animation cadence and queue resistance (2026-07-14)

- Replaced the velocity-multiplied Kickfall run counter (which could advance at
  roughly 26 visual steps per second) with a time-based cadence that scales from
  6 to 9 steps per second. Movement speed and responsiveness are unchanged, but
  each drawing now remains on screen long enough for the three-frame run cycle
  to read cleanly.
- Rebalanced contiguous queue kicks through impact attenuation. Direct contact
  starts at full power and every touching ball-to-ball handoff retains 90%, so
  normal direct gate kicks still break immediately while a seven-ball queue
  reaches its gate at roughly 53% power. The first rear kick visibly damages
  that Level 1 gate; the second deliberate kick clears it.
- Gate health now accepts fractional impact and consumes the armed charge on
  contact. Reinforced gates preserve their authored extra health, so later
  packed queues demand proportionally more work instead of inheriting a free
  full-strength chain reaction.
- Added red-first pure coverage for run-cycle cadence and six-hop impact loss.
  The browser fixture samples the live run frames (requiring a readable 2–5
  transitions across 480 ms and all three run drawings), then verifies the
  seven-ball gate remains active with partial health after one kick and breaks
  after the second.
- Visually inspected the intact first-impact queue and the second-kick gate
  destruction captures. The required standalone web-game client reached live
  Cosmic Foundry with the new ball impact-power diagnostics and no console-error
  artifact. Kickfall unit tests pass 20/20. The complete browser run passes all
  new Kickfall assertions and continues into the normal game, where it stops on
  an unrelated profile-state assertion (`lucia` persisted where that older test
  expects `bob`).

No follow-up TODO remains for this cadence/queue-balance pass.

### Kickfall twenty-stage route audit and uphill receivers (2026-07-14)

- Reproduced the reported impossible route as a missing receiver on a non-top
  uphill lane: reverse roll assist returned every ball to the outer wall, while
  the Level 4 triangular receiver was previously created only for flat lanes.
  A player approaching from inside the board could therefore become trapped on
  the wrong side of the backsliding pile.
- Generalized the existing Level 4 triangle to every non-top lane whose natural
  motion does not carry balls away from the entry (`flat` and `uphill`). The
  wedge remains ball-only, mirrors with lane flow, hands falling balls inward,
  and acts as a chock when an uphill ball rolls back. Top flat/uphill lanes keep
  their existing ball-only intake rail, which the player can walk through.
- Moved the three gate layouts into shared pure configuration and added a
  campaign route auditor. Each stage now checks required receivers, legal player
  strike coordinates, gate entry/exit ordering, obstacle ordering and approach,
  boss approach, ball quota versus required hits, and at least 30 seconds after
  the final scheduled spawn. Concise audit state is exposed through Kickfall
  diagnostics without changing the existing `level` payload contract.
- Added red-first regressions for the missing uphill receiver and all twenty
  complete route audits. A browser campaign loop then restarts Levels 1–20 one
  by one, verifies their audit state, physically drops a ball through every
  required receiver, requires at least 100 px outer-wall clearance, and performs
  a real direct-contact kick from the resulting legal standing position.
- All twenty browser stage checks pass. The tightest measured receiver clearance
  is 182.2 px; the tightest clock margin is Level 2 at 36.15 seconds after its
  final scheduled ball. Captured and visually inspected a labeled 20-stage
  contact sheet plus full-size uphill receiver frames for Levels 7, 13, 18, and
  19. The machine-readable results live in
  `output/e2e/01-kickfall-campaign-audit.json`, and the permanent review table is
  documented in `docs/KICKFALL_STAGE_AUDIT.md`.
- The complete browser test passes the entire Kickfall campaign audit and then
  reaches the same unrelated normal-game profile assertion as the previous pass
  (`lucia` persisted where that older assertion expects `bob`).

No follow-up TODO remains for the twenty-stage route-safety pass.

### Kickfall modal polish and Spanish overflow regression (2026-07-14)

- Reworked the Kickfall pause and outcome cards around compact, explicit layout
  contracts. Titles are smaller, supporting copy has a bounded advanced wrap,
  card shadows and short accent rails replace the heavy frame treatment, and
  progress now sits in a dedicated low-contrast status plate.
- Replaced the result screen's fixed vertical action stack with context-aware
  rows: defeat/final-stage results keep Retry and Main Menu together inside the
  card, while a cleared stage with a successor uses an evenly spaced three-way
  Retry / Continue / Main Menu row. The reusable button helper can now safely
  reposition buttons and refresh localized labels while preserving text fitting.
- Tightened the shared leave-confirmation overlay to the same spacing and type
  hierarchy, while retaining its warning accent and existing cancel/confirm
  behavior for both Kickfall and normal matches.
- Added red-first unit coverage that proves pause, two-action, and three-action
  layouts stay inside their panels. The live browser regression forces the
  longest Spanish timeout copy, asserts every visible element remains within
  the result card, verifies localized actions, and captures
  `output/e2e/01-kickfall-level-2-timeout-es.png`.
- Visually inspected the Spanish timeout, three-action victory, pause, and leave
  confirmation captures. The standalone web-game client reached the live menu
  without console errors. All 110 unit tests and the production build pass. The
  complete browser run passes all Kickfall modal and campaign checks, then stops
  later at the same unrelated persisted-profile assertion (`lucia` where the
  older normal-match fixture expects `bob`).

No follow-up TODO remains for the modal-polish pass.

### Kickfall boss counter-shot strength (2026-07-14)

- Reproduced the weak Level 10 counter as a single-ball velocity overwrite: the
  target immediately transferred its limited impulse into the incoming packed
  queue, so the boss completed his kick animation while the pile barely moved.
- Added a pure contiguous counter-wave resolver. A boss kick now identifies the
  touching same-lane queue, reverses every connected ball with slight distance
  attenuation, clears player attack charge, and suppresses lane roll assist for
  0.9 seconds so the return shot has time to read before gravity retakes control.
- Raised authored counter speed from 10.5 to 14.5 on Level 10 and from 12 to 16
  on the Level 20 finale. The stronger kick adds a small impact burst and camera
  response without changing boss health, cadence, or the player's counterplay.
- Added red-first pure coverage for connected-versus-isolated balls. The live
  Level 10 browser fixture now creates a four-ball queue, requires every ball to
  reverse above 9 velocity units, and verifies each travels at least 115 px away
  from the boss within 360 ms. The reviewed frame is
  `output/e2e/01-kickfall-level-10-boss-counter.png`.
- All 111 unit tests and the production build pass. The required standalone
  web-game client reached live Kickfall without console errors. The complete
  browser run passes the new Level 10 counter-shot regression and all Kickfall
  checks, then stops later at the unchanged unrelated profile fixture mismatch
  (`lucia` where the older normal-match assertion expects `bob`).

No follow-up TODO remains for the boss counter-shot fix.

### Reusable minigame virtual joystick (2026-07-15)

- Replaced Kickfall's four directional touch buttons with a reusable fixed
  eight-way virtual joystick while preserving keyboard input, jump, kick, and
  the existing jump-plus-direction tier-transfer rules.
- Added a pure vector resolver with a configurable dead zone, eight-direction
  quantization, normalized output, and a thumb position clamped to the outer
  radius. Red-first unit coverage verifies neutral, cardinal, diagonal, and
  clamping behavior.
- Added a reusable Phaser component under `src/game/minigames/input/` with
  logical ownership of the initiating pointer, scene-level drag tracking,
  fixed-camera support, glass visuals, lifecycle cleanup, visibility/enabled
  controls, diagnostics, polling state, and an optional change callback.
- Kickfall is the only current consumer. The main match's `TouchControls`,
  `InputController`, movement, and physics remain unchanged.
- The touch-enabled browser pass claims the joystick with one pointer, drags it
  down-right, presses Jump with a second pointer, verifies that Jump does not
  steal joystick ownership, completes the top-to-upper tier transfer, and
  confirms release returns the stick to neutral. The sequence is now permanent
  coverage in the existing tablet browser suite.
- Screenshot inspection exposed and fixed an older Kickfall-only icon-scale
  bug: releasing Jump restored its authored 36 px icon instead of scaling the
  texture to its native size. Active and released joystick screenshots were
  recaptured and inspected after the fix.
- Final verification: all 121 unit tests pass, the production build succeeds,
  the required standalone web-game client reaches live Kickfall without console
  errors, and the focused two-finger tablet scenario passes without page or
  console errors.
- Follow-up multi-pointer verification separately held joystick Down-Right with
  Jump and joystick Right with Kick. In both cases the action fired without
  changing joystick pointer ownership; lifting only the action finger preserved
  movement, and the stick returned to neutral only when its own finger lifted.
  Both partial-release sequences are now permanent tablet browser regressions.

No follow-up TODO remains for the reusable joystick pass.

### Graphical game journeys and shared mobile joystick (2026-07-23)

- Rebuilt the home screen as a graphical journey hub: Football remains the
  large featured experience, Mini-games is a distinct arcade path, and Options
  uses its own illustrated workshop card. The cards use slanted arcade panels,
  large badges, real game imagery, and broad touch targets instead of a stack of
  square text buttons.
- Added a dedicated Mini-games catalog and a Kickfall setup screen with a live
  preview, mission summary, controls, game-specific difficulty, instructions,
  continue/start-over actions, and durable campaign progress. Football now has
  its own setup screen for player, rival, field, ball/object, difficulty,
  instructions, Power Lab, and match launch.
- Moved difficulty out of global Settings and migrated profiles to
  `difficultyByGame.football` and `difficultyByGame.kickfall`. Existing legacy
  difficulty values continue to migrate to Football, while Kickfall defaults to
  Normal. Match AI and Kickfall timer tuning now read only their own setting.
- Promoted the virtual joystick to `src/game/input/` as a shared component,
  enlarged Kickfall's touch stick to a 106 px base radius on tablets, and added
  a horizontal-only mode for Football. Wide-phone UI scaling grows the Football
  stick above 110 px while tablets use a 102 px base radius.
- The multi-pointer browser regression now proves both games preserve joystick
  ownership while a second finger presses an action. Kickfall supports
  down-right + Jump and right + Kick; Football supports right + Kick and right
  + Jump. Releasing the action finger leaves movement active until the joystick
  finger itself lifts.
- Generated and integrated `public/assets/menu/options-workshop-v1.webp` for
  the Options card using the built-in image generator. The Mini-games card uses
  `public/assets/menu/arcade-cosmic-card-v1.webp`, derived from the real
  Kickfall gameplay capture so the game remains immediately recognizable.
- Visually inspected the desktop hub and Football setup plus the 1280×800 hub,
  Mini-games catalog, Kickfall setup, enlarged Kickfall joystick, Football
  setup, and horizontal Football joystick. The captures live under
  `output/e2e/`, including `08-extended-tablet-intro.png`,
  `08-extended-tablet-kickfall.png`, and
  `08-extended-tablet-match.png`.
- Final verification: all 122 unit tests pass, the production build succeeds,
  `git diff --check` is clean, and the complete browser suite passes through
  splash, both navigation journeys, all twenty Kickfall route audits, per-game
  settings, persistence, desktop gameplay, phone touch controls, tablet
  multi-touch, bilingual settings, and the math-penalty flow.

No follow-up TODO remains for the journey/joystick redesign.

### Per-game audio policy and Kickfall catalog copy (2026-07-23)

- Replaced the binary menu/match audio switch with explicit `menu`, `football`,
  and `kickfall` policies. All three currently share the six-track music
  rotation; only Football enables audience ambience. The policy map can grow
  with future mini-games without adding scene-specific mute workarounds.
- Kickfall diagnostics now expose its active audio state. Browser coverage
  verifies `musicRequested: true`, `audienceRequested: false`, and the Kickfall
  policy while Football independently reports music plus audience.
- Updated the Spanish Mini-games catalog subtitle to
  “DESPEJA EL CAMINO A LOS BALONES” and visually inspected the live card at
  `output/kickfall-audio-copy-spanish-2/shot-2.png`.
- Final verification: all 123 unit tests, the complete browser suite, the
  production build, and `git diff --check` pass.

No follow-up TODO remains for this audio/copy tweak.

### Global player selection in Mini-games (2026-07-23)

- Added a graphical “Play as / Juega como” character selector beneath the
  Mini-games catalog card. It uses the existing global `playerCharacterId`,
  skips the active Football rival, retains the touch debounce, and updates the
  portrait, name, accent, and profile immediately.
- Kept the UI child-friendly and implicit: there is no explanatory “shared with
  Football” copy. The same saved choice simply appears in Football and is used
  by Kickfall.
- Browser coverage selects Lucia in Mini-games, verifies the Intro and Football
  setup inherit Lucia, returns the selector to Joel for the campaign fixture,
  and separately launches live Kickfall as Lucia through the standalone
  web-game client.
- Visually inspected the final catalog selector at
  `output/minigames-global-player-final/shot-2.png`.
- Final verification: all 123 unit tests, the complete browser suite, the
  production build, and `git diff --check` pass.

No follow-up TODO remains for the global Mini-games player selector.

### Kickfall gate explosions and trap feedback (2026-07-23)

- Kept this pass entirely inside Kickfall. Breaking a blocker now produces a
  layered burst with 26 themed gate fragments, 28 hot sparks, expanding smoke,
  a short warm screen flash, camera shake, two restrained shockwave rings, and
  a comic `BOOM!` accent. `BOOM!` is now the only gate-break copy; the competing
  “Gate smashed / Muro roto” announcement was removed while the heavy haptic
  remains intact.
- Extended Kickfall's lightweight effect runner with typed effects and optional
  scale animation. This keeps the burst deterministic, automatically cleans up
  every visual, and avoids introducing a second particle system.
- Added red additive overlays to both the pocket and cleat trap textures.
  Kicking their captive ball now starts a 0.38-second pulsing red flash while
  preserving the original sprite detail; ordinary nearby kicks do not trigger
  it.
- Added diagnostics for active debris, sparks, smoke, shockwaves, flash, and
  `BOOM!` layers plus per-trap pulse count, remaining time, and visible alpha.
  Browser regressions assert the complete gate burst and both trap variants.
- Screenshot review caught and corrected an overbearing first-pass shockwave.
  The final rings are thin, slower-expanding, and 50% more transparent than the
  prior subtle pass (25% inner-ring opacity and 16% outer-ring opacity), so
  debris and the kick remain dominant. Reviewed frames are
  `output/e2e/01-kickfall-gate-break.png` and
  `output/e2e/01-kickfall-pocket-kick-flash.png`.
- Final verification: all 123 unit tests pass, the required standalone
  web-game client reaches live Kickfall with the correct per-game audio policy,
  and the complete browser suite passes across Kickfall, Football, menu,
  persistence, localization, and touch flows.

No APK was built or deployed during this pass. No follow-up TODO remains for
the Kickfall visual-feedback work.

### Mini-games opponent-filter regression (2026-07-23)

- Fixed the Mini-games player selector so it always cycles through all six
  characters. A character selected as Football's opponent is no longer hidden
  from Kickfall or future single-player mini-games.
- Kept the exclusion rule inside Football's two-sided setup, where it is still
  required to prevent the same character from occupying both teams. If the
  Mini-games choice conflicts with the saved Football opponent, the existing
  profile invariant moves Football's opponent to another valid character.
- Added an end-to-end regression for the reported case: set Luna as Football's
  opponent, enter Mini-games, select Luna as the player, return to Football,
  and verify the inherited Luna player plus a valid non-Luna opponent.
- Visually inspected the final Luna selector frame at
  `output/e2e/01-mini-games-luna-opponent-selectable.png`. All 123 unit tests,
  the production build, the required standalone web-game client, and the
  complete browser suite pass.

No follow-up TODO remains for the Mini-games opponent-filter regression.

### Kickfall tilted ball-entry wall (2026-07-23)

- Replaced Kickfall's vertical ball-only entry boundary with an 11° ramp that
  leans left at the top. Its bottom remains anchored at the original `x=175`,
  while the top moves to `x=155.2`, preserving the player's starting space and
  directing backed-up balls down and to the right.
- Rotated both the real Matter collision body and its translucent visual, so
  the geometry players see exactly matches the surface used by ball physics.
  Football and every non-Kickfall scene remain untouched.
- Added entry-wall geometry to Kickfall diagnostics and expanded the natural
  pile regression. With five or more balls, the verified queue spans roughly
  103 px horizontally versus 35 px vertically, keeping it materially wider
  than one ball-height instead of forming a vertical column at the entry.
- Visually inspected live Kickfall at
  `output/kickfall-tilted-entry-wall-client/shot-1.png` and the longer natural
  pile at `output/e2e/01-kickfall-natural-pile-up.png`. All 123 unit tests, the
  production build, the required standalone web-game client, and the complete
  browser suite pass.

No follow-up TODO remains for the tilted entry-wall change.

### Kickfall receiver-pile softlock escape (2026-07-23)

- Reproduced the reported Level 7 receiver-ramp state with five balls supporting
  the player. Matter physics held the player on the queue, but Kickfall only
  treated platform contacts as grounded, leaving Jump disabled.
- Added a narrow pure support rule: the player must be above a ball, horizontally
  overlapping it, have their feet within a small top-contact tolerance, and not
  already be moving upward. A supporting ball now refreshes the same short
  grounding window as a platform, allowing an immediate normal jump without
  enabling general air jumps.
- Added a fallback pile kick. Direct forward-foot contacts and trapped balls
  retain priority; only when neither is available can Kick target the ball
  currently supporting the player and send it inward along the lane.
- Diagnostics now identify the current supporting ball. The Level 7 browser
  regression proves both escape routes: Kick releases a real pile ball with
  useful lane velocity, and Jump launches above `5` vertical velocity units
  before clearing support.
- Visually inspected the reproduced state and both escapes at
  `output/e2e/01-kickfall-level-7-receiver-pile-stuck.png`,
  `output/e2e/01-kickfall-level-7-receiver-pile-kick-escape.png`, and
  `output/e2e/01-kickfall-level-7-receiver-pile-escape.png`. Football remains
  untouched.

No follow-up TODO remains for the receiver-pile softlock.

### Shared impulse and pressure system (2026-07-23)

- Added a renderer-independent force module under `src/game/pure/forceSystem.js`
  for contact attenuation, rapid-impact combos, temporary pressure, difficulty
  tuning, and resistance-based permanent damage. It has no Phaser dependency so
  future minigames and Football can adopt it without importing Kickfall rules.
- Kickfall now retains 84% force per connected ball, rewards rapid same-lane
  kicks with a capped 1.0×/1.25×/1.5× combo, and includes a small forward
  approach bonus. Gaps and sub-threshold impulses still break the chain.
- Gates convert surviving force into fractional, one-pip-capped damage. Cleats
  use medium temporary hold resistance and magnetic pockets use stronger
  resistance. Direct captive kicks remain reliable one-hit releases.
- Easy/Normal/Hard scale only resistance and pressure decay. Transmission and
  ball movement stay identical. Stored trap pressure is visible through the
  existing red overlay and diagnostics expose force, hops, combo, resistance,
  and pressure.
- Documented the shared API, invariants, Kickfall tuning, diagnostics, tests,
  and a safe future Football adoption path in `docs/FORCE_SYSTEM.md`; updated
  the Kickfall spec and README to remove the obsolete direct-hit-only model.
- Added five pure force-system tests and updated Kickfall attenuation coverage.
  The live regression uses real four-ball queues: three transmitted contacts
  release the cleat on the second rapid rear kick and the stronger pocket on the
  third, while the obstacle can immediately capture the next queued ball.
- Expanded the chain contact tolerance to the documented 8 px maximum gap after
  a repeated full-suite run exposed a marginal seven-ball gate fixture. The
  final complete browser pass is stable and green.
- Visually inspected the first stored-pressure and breakthrough frames at
  `output/e2e/01-kickfall-pocket-pressure-first-hit.png` and
  `output/e2e/01-kickfall-pocket-pressure-release.png`.
- Final verification: all 129 unit tests, production build, required standalone
  web-game client, complete browser suite, and `git diff --check` pass.

No follow-up TODO remains for the shared force-system pass. Football has not
been changed; `docs/FORCE_SYSTEM.md` records the opt-in integration path.

### Kickfall uphill receiver gravity correction (2026-07-23)

- Reproduced the reported vertical receiver column with seven unattended balls.
  The root cause was not insufficient triangle geometry: the uphill lane's
  artificial target-velocity motor continued pushing every ball up the wedge,
  overpowering Matter gravity indefinitely.
- Rejected and removed a first-pass one-way latch after live feedback. Besides
  feeling nonphysical, its horizontal-only trigger could affect a ball on the
  tier below.
- Replaced uphill target velocity with surface-angle acceleration. The shallow
  lane still backslides unattended balls, but a ball physically touching the
  much steeper receiver gets stronger acceleration down that slope. Fast kicks
  remain untouched, and flat/downhill routes keep their existing behavior.
- Centralized lane-scoped ramp contact math in
  `getKickfallLandingGuideContact`; a unit regression proves the same x
  coordinate on the lane below is not a receiver contact.
- Added a sustained Level 7 browser regression. After six seconds, seven
  backrolling balls remain in one broad horizontal row with at most one ball
  traversing the ramp. The reviewed frame is
  `output/e2e/01-kickfall-level-7-receiver-gravity-pile.png`.
- Updated `docs/KICKFALL_SPEC.md` to record the surface-acceleration model and
  the no-cross-tier/no-column invariants.
- Final verification: all 131 unit tests, production build, required standalone
  web-game client, complete browser suite, screenshot inspection, and
  `git diff --check` pass.

No follow-up TODO remains for the receiver gravity correction. The latch
experiment has no remaining runtime code or diagnostic state.

### Kickfall rescue mission copy (2026-07-23)

- Reframed Kickfall as a race against time to free every trapped ball. Removed
  the ball factory / ballworks story from the English and Spanish mission copy,
  English catalog subtitle, Hard difficulty description, and loading message.
- Added the localized mission and active difficulty description to setup-scene
  diagnostics. Unit coverage asserts the exact bilingual mission and prevents
  factory terminology from returning across the related keys.
- Visually inspected the final setup card at
  `output/e2e/01-kickfall-setup.png`; the shorter English mission wraps cleanly
  in two lines. Spanish uses the matching rescue-and-clock framing.
- Final verification: all unit tests, production build, required standalone
  web-game client, complete browser suite, and `git diff --check` pass.

No follow-up TODO remains for the mission-copy update.

### Help modal safe columns (2026-07-23)

- Replaced the help modal's unbounded row copy with explicit left and right text
  lanes. Both titles and descriptions now wrap inside their lane, with a
  protected gutter before the neighboring control badge and padding at the
  panel edge.
- Applied the shared layout contract to both Kickfall and Football help
  overlays, so future localized copy cannot silently render across columns.
- Added pure geometry coverage plus a live Spanish touch regression that checks
  every Kickfall help label against its rendered Phaser bounds.
- Visually inspected the corrected modal at
  `output/e2e/01-kickfall-help-es-safe-columns.png` and the unaffected Football
  variants at `output/e2e/01-football-help.png` and
  `output/e2e/05-touch-help.png`.
- Final verification: all 133 unit tests, production build, required standalone
  web-game client, complete browser suite, and `git diff --check` pass.

No follow-up TODO remains for the help modal responsiveness fix.

### Analog Football joystick and edge dash (2026-07-23)

- Kept keyboard movement unchanged: A/D and Left/Right remain digital, and the
  existing same-direction double-tap still requests the original directional
  dash with its normal cooldown and combat behavior.
- Football's touch joystick now preserves its horizontal 0–1 displacement
  instead of reducing every active gesture to a button. Partial tilt produces
  proportionally slower acceleration and a lower movement cap; full tilt
  returns to normal running speed.
- Added an 82% outer dash ring with amber visual and haptic feedback. A
  center-to-edge gesture requests one existing directional dash. Holding at the
  edge cannot repeat it; the stick must return inside the neutral dead zone
  before another edge gesture can be recognized, and the existing cooldown
  still applies.
- Fixed the live-input bug found during device testing: pointer movement did
  not forward the configured boost threshold, silently changing it from `0.82`
  to `null` as soon as the thumb moved. Idle diagnostics looked correct while
  the real gesture could therefore never activate.
- Added pure regressions for threshold detection and edge/hold/center/edge
  latching, plus live phone and tablet coverage for analog speed, one-shot dash,
  center rearm, cooldown, and joystick + Kick/Jump multitouch ownership.
- Visually inspected `output/e2e/05-touch-analog-walk.png`,
  `output/e2e/05-touch-joystick-dash.png`, `output/e2e/05-touch-help.png`, and
  `output/e2e/08-extended-tablet-match.png`.
- Final verification: all 135 unit tests, production build, required standalone
  web-game client, complete browser suite, and `git diff --check` pass.

No follow-up TODO remains for the Football analog joystick dash.

### Shared menu button activation (2026-07-23)

- Added `src/game/ui/buttonInput.js` as the game-wide input contract for
  one-shot menu controls. Touch layouts retain accepted activation points for
  500 ms and suppress compatibility pointer sequences within an 18 px logical
  drift radius; other controls remain immediately responsive.
- The shared binding supports both established phases: selectors and mute
  controls still activate on pointer-down so a WebView-cancelled release cannot
  lose the action, while conventional buttons activate on an accepted
  pointer-up. Either path emits exactly one action and one haptic.
- Migrated rectangular buttons, icon buttons, journey cards, Help/About close
  controls, install close, and Power Lab cards. Joysticks, gameplay holds, and
  sliders remain outside the gate because they require continuous pointer
  ownership.
- Removed the old selector-local timers and debounce settings. Added pure and
  binding-level unit coverage for press/release phases, same-position
  compatibility suppression, multiple guarded positions, nearby independent
  controls, rearming, and unguarded desktop input.
- Added a dedicated phone browser regression for player, field, and ball
  selectors: pointer-down, pointer-up, a delayed WebView compatibility
  sequence, and a new deliberate tap after rearming. Reviewed
  `output/e2e/07-touch-football-selectors.png` and the extended tablet setup.
- Hardened the existing analog-dash browser fixture by neutralizing unrelated
  live combat after its long cooldown wait; diagnostics showed the AI could
  otherwise stun the player or trigger a goal pause before the input assertion.
- Final verification: all 141 unit tests, production build, required
  standalone web-game client, complete browser suite, screenshot inspection,
  console-error checks, and `git diff --check` pass.

No follow-up TODO remains for the reusable menu button activation system.

### Netlify web release (2026-07-23)

- Rebuilt the current game and refreshed the generated payload in the clean
  sibling `luisnomad.com` repository, including the new menu artwork and the
  legacy `/games/head-soccer/` redirect.
- Completed the 103-page Astro host build, committed the generated game payload
  as `1840260` (`feat: publish latest Joel Football web build`), and pushed
  `main`.
- Confirmed Netlify serves the new `index-gJKUsoO6.js` bundle, menu artwork,
  game URL, and legacy URL with HTTP 200 responses.
- Ran the required web-game client against the live production URL. It reached
  Football setup, changed the field to Neon Grid, reported no console/page
  errors, and produced the inspected capture at
  `output/web-game/netlify-live-1840260/shot-2.png`.

The current web build is live at
`https://luisnomad.com/games/joel-football/`.

### Football touch arrows with developer joystick switch (2026-07-23)

- Restored Football's two on-screen Left/Right arrows as the default touch
  movement. Their established same-direction double-tap still enters the
  existing one-off dash; keyboard controls remain unchanged.
- Kept the experimental horizontal Football joystick behind a developer-only
  option. Use `VITE_FOOTBALL_TOUCH_MOVEMENT_MODE=joystick` for a developer
  build, or set the Phaser registry key
  `developer:footballTouchMovementMode` and restart Match for a live comparison.
  Invalid and missing values safely resolve to `arrows`; the choice is not
  player-facing or persisted in the profile.
- Kept Kickfall's independent 8-way joystick enabled and increased its touch
  radius. The shared joystick no longer treats Phaser `gameout` as a release,
  so a held thumb crossing the canvas edge stays clamped until the actual
  pointer release. The larger horizontal Football joystick and edge behavior
  remain available in developer mode for future tuning.
- Made Football Help and serialized control diagnostics follow the active
  developer mode. Production touch Help now explains arrow double-tap; the
  experimental build explains analog movement and the center-to-edge dash.
- Added a pure fail-safe regression plus live phone coverage for default
  arrows, movement reversal, touch double-tap dash, and runtime opt-in. Retained
  phone/tablet coverage for the experimental joystick's analog speed, edge
  dash, edge retention, and simultaneous Kick/Jump pointer ownership.
- Visually inspected `output/e2e/05-touch-football-arrows.png`,
  `output/e2e/08-extended-tablet-kickfall.png`, and
  `output/e2e/08-extended-tablet-left-edge-hold.png`.
- Final verification: all 142 unit tests, the production build, required
  standalone web-game client, complete browser suite, screenshot inspection,
  browser error checks, and `git diff --check` pass.

No player-facing Football joystick setting was added. The current release
default is the simpler two-arrow control while the experiment remains
available for development.

### Netlify web release — Football arrows default (2026-07-23)

- Rebuilt the game with the production-default Football arrows; the
  developer-only joystick environment flag was not enabled.
- Refreshed the generated payload in the clean `luisnomad.com` repository,
  completed the 103-page Astro build, committed it as `974e2ad`
  (`feat: publish Football touch control update`), and pushed `main`.
- Confirmed Netlify serves the new `index-C3pwt-_J.js` bundle and its asset URL
  with HTTP 200. The legacy `/games/head-soccer/` route remains available.
- Ran the required web-game client against the live production URL. It reached
  Football setup, reported no console/page errors, and produced the inspected
  capture at `output/web-game/netlify-live-974e2ad/shot-1.png`.

The current web release is live at
`https://luisnomad.com/games/joel-football/`.

### iOS long-press magnifier guard (2026-07-23)

- Identified the large circular “zoom” shown while holding a Football arrow as
  iOS/Safari's native long-press magnifier. It was displaying a magnified patch
  of the pitch and was not a retained joystick object.
- Applied `touch-action: none`, standard and WebKit-prefixed selection
  suppression, and WebKit touch-callout suppression directly to the game shell,
  game container, and canvas. Canvas image dragging is also disabled.
- Added a narrow game-surface event guard for native `contextmenu`,
  `dragstart`, and `selectstart` events. Phaser pointer handling remains
  unchanged, including simultaneous gameplay touches.
- Added browser assertions for the computed shell/canvas gesture contract and
  cancelled native events. The live touch flow now holds the Right arrow for
  750 ms, proves continuous movement, and captures the held state at
  `output/e2e/05-touch-arrow-long-hold.png`.
- Final verification: all 142 unit tests, production build, required
  standalone web-game client, complete browser suite, screenshot inspection,
  console-error checks, and `git diff --check` pass.

### Netlify web release — iOS long-press hotfix (2026-07-23)

- Published the verified long-press guard through the generated
  `luisnomad.com` game payload and completed the 103-page Astro build.
- Committed and pushed website `main` as `eac711e`
  (`fix: prevent iOS game long-press magnifier`).
- Confirmed Netlify serves `index-CRmlIaBp.js` and `index-DeZdmXRR.css` with
  HTTP 200. The live computed styles report `touch-action: none`,
  `user-select: none`, and `webkitUserSelect: none` on both the shell and
  canvas; `contextmenu`, `dragstart`, and `selectstart` are all cancelled.
- Ran the required standalone game client against production. It reached
  Football setup without console/page errors, and the inspected capture is
  `output/web-game/netlify-live-eac711e/shot-1.png`.

The iOS long-press hotfix is live at
`https://luisnomad.com/games/joel-football/`.

### Cancelable iOS touch capture and Jump visibility (2026-07-23)

- Follow-up device testing proved CSS selection/callout suppression alone did
  not stop iOS's held-touch magnifier. Local Phaser source confirmed the
  regression path: `input.touch.capture: false` registers passive canvas
  `touchstart`/`touchmove` listeners, so the browser default was never
  cancelled. The older arrow behavior had effectively captured those defaults.
- Added reusable `src/platform/gameSurfaceInput.js`. The game shell now
  registers non-passive `touchstart` and `touchmove` listeners and calls
  `preventDefault` only when the event is cancelable. Phaser still receives the
  event first at the canvas target, while noncancelable Android `touchcancel`
  lifecycle events remain untouched.
- Kept context-menu, drag, and selection prevention in the same reusable guard,
  with cleanup support and two focused unit tests. Browser coverage verifies
  all five native defaults are cancelled on the game surface.
- Emphasized Football's Jump control without changing its hit area: glass fill
  increased from 8.5% to 18%, with a stronger cyan accent/rim and an 88%-opaque
  icon. Kick, Lob, Power, arrows, and Kickfall controls retain their existing
  treatment.
- Hardened two unrelated full-suite timing fixtures exposed during repeated
  verification: Escape calls the registered Match handler directly, and the
  mobile chilena landing gets the same short settle window as the desktop
  fixture.
- Visually inspected the held-arrow phone frame at
  `output/e2e/05-touch-arrow-long-hold.png` and the extended-tablet composition
  at `output/e2e/08-extended-tablet-match.png`.
- Final verification: all 144 unit tests, production build, required
  standalone web-game client, complete browser suite, screenshot inspection,
  console-error checks, and `git diff --check` pass.

This follow-up is verified locally but has not yet been published to the
website.

### Netlify web release — held-touch capture and Jump emphasis (2026-07-23)

- Published the verified cancelable-touch guard and brighter Football Jump
  control through the generated `luisnomad.com` game payload.
- Completed the full 103-page Astro production build, committed website
  `main` as `dff0647` (`fix: capture iOS held touches and emphasize Jump`),
  and pushed it to Netlify.
- Confirmed production serves `index-8WS4_nvc.js` and
  `index-DeZdmXRR.css` with HTTP 200.
- Ran the required standalone web-game client against production. It reached
  Football setup without console/page errors; the inspected capture is
  `output/web-game/netlify-live-dff0647/shot-1.png`.
- A live iPhone-sized browser check reports `touch-action: none`,
  `user-select: none`, and `webkitUserSelect: none` on both the shell and
  canvas. Cancelable `touchstart`, `touchmove`, `contextmenu`, `dragstart`,
  and `selectstart` events all report `defaultPrevented: true`.

The mobile web release is live at
`https://luisnomad.com/games/joel-football/`.

### Football pre-joystick control audit (2026-07-23)

- Compared the current worktree with `24e1040`, the immediate pre-Football-
  joystick baseline. That commit explicitly limited joystick use to Kickfall.
- Football's default arrow geometry is unchanged from that baseline: centers
  remain at x=80 and x=260, radius 64. Jump also remains at x=930, y=500,
  radius 56.
- The older `31389cc` layout matches the user's memory of a more compact
  cluster: arrow centers were x=98 and x=238 (140 px apart instead of 180),
  and Jump was x=1020, y=630, radius 60. With radius-64 arrows, the visible
  gap grew from 12 logical px to 52 px in the later layout.
- Jump physics did not change in either the joystick experiment or rollback:
  `jumpVelocity` remains -11.5, the grounded jump branch is equivalent, and
  digital arrows still produce full movement intensity. The newer analog
  movement clamp receives intensity 1 in arrow mode.
- The most plausible source of the perceived weaker jump is ergonomics rather
  than trajectory: the older Jump target was slightly larger and sat on the
  lower action row, much closer to the movement thumb. Current multi-touch
  browser coverage still proves Arrow + Jump fires simultaneously.
- No implementation change was made during this audit. A sensible follow-up
  would be to restore the compact x=98/x=238 arrow spacing and reconsider the
  lower Jump position while preserving its new higher-contrast appearance.

### Compact Football touch layout restoration (2026-07-23)

- Restored the older Football arrow geometry: Left is x=98 and Right is x=238,
  both at y=630 with radius 64. Their circles now have the familiar 12 px rim
  gap instead of the later 52 px gap.
- Returned Jump to its exact older x=1020, y=630, radius-60 placement while
  preserving the brighter emphasized treatment.
- Moved the secondary Lob action to Jump's former upper slot at x=930, y=500,
  radius 56. This avoids overlap and restores the primary Jump/Kick pairing on
  the lower action row.
- Centralized these authored coordinates in exported
  `FOOTBALL_TOUCH_LAYOUT` constants and exposed center/radius diagnostics so
  browser coverage can guard the intended ergonomics.
- Updated touch fixtures and added a real two-pointer phone regression that
  holds compact Right, presses/releases lower Jump independently, and requires
  movement to remain held throughout.

- Visually inspected the restored phone layout at
  `output/e2e/05-touch-football-arrows.png`, its held-arrow state at
  `output/e2e/05-touch-arrow-long-hold.png`, and the extended-tablet action row
  at `output/e2e/08-extended-tablet-match.png`. The compact arrows are distinct
  without a dead-looking gap; Jump/Kick read as the lower primary pair, and Lob
  remains separated above.
- Final verification: all 144 unit tests, production build, required
  standalone web-game client, complete browser suite, two-pointer
  Right-plus-Jump flow, screenshot inspection, console-error checks, and
  `git diff --check` pass.

This layout restoration is verified locally and has not been published yet.

### Disc Hockey mini-game (2026-07-28)

- Recorded the complete product, bundle, input, physics, AI, theme, audio,
  orientation, diagnostics, and verification contract in
  `docs/DISC_HOCKEY_SPEC.md` before implementation.
- Confirmed Kickfall already enters through a dynamic import, but the current
  setup/loading scenes are Kickfall-specific. The implementation will preserve
  Kickfall's separate chunk and generalize only its small shell.
- Disc Hockey will reuse the global player/opponent lineup and existing audio
  assets. Native landscape enforcement already exists; the mini-game will also
  make an explicit platform lock request when entered.

TODO:

- Add the registry-driven mini-game shell and profile fields.
- Implement and unit-test pure Disc Hockey rules/AI.
- Implement the lazy Disc Hockey scene, setup options, both themes, multitouch,
  match flow, pause/result UI, diagnostics, and orientation request.
- Run unit/build/browser verification, inspect both arena screenshots, and
  confirm separate production chunks for both mini-games.

#### Disc Hockey implementation complete

- Added a registry-driven mini-game loader. The production build emits
  `DiscHockeyScene` (~24.3 kB) and `KickfallScene` (~91.0 kB) as independent
  JavaScript chunks; neither gameplay scene is part of the startup bundle.
- Generalized the setup/loading shell without changing Kickfall's saved-level
  flow. The Mini-games menu now offers both cards.
- Added persistent Disc Hockey computer/local mode, Ice/Neon arena choice, and
  independent Easy/Normal/Hard difficulty. Setup reuses and can update the
  globally selected player and opponent.
- Implemented first-to-five top-down play, full-puck goal detection, legal
  half-rink clamps, acceleration-based disc movement, puck momentum/bounces,
  goal resets, result/rematch, pause/restart/leave, keyboard fallback, and
  three genuinely distinct AI tunings.
- Implemented two-pointer local play through Phaser's multi-pointer input. A
  real Chromium CDP two-touch regression holds both players simultaneously,
  crosses both target fingers over midfield, and verifies each target and disc
  remains clamped to its legal half.
- Added procedural white-ice and dark sci-fi arenas with identical geometry.
  The neon theme uses only yellow/gold and red/orange glow accents. Both include
  static audience bands and the top scoreboard.
- Reused Football music, crowd, puck impact, whistle, click, and success audio.
  Entering the game explicitly requests landscape orientation through the
  existing platform service, on top of Android's native landscape enforcement.
- Added deterministic diagnostics, debug fixtures, and fixed-step advancement.
  Updated the README and preserved the full specification in
  `docs/DISC_HOCKEY_SPEC.md`.
- Visually inspected Mini-games, setup, local Neon, clamped two-touch, result,
  pause, and computer Ice captures under `output/disc-hockey/`, plus the final
  required web-game client capture under
  `output/web-game/disc-hockey-final/shot-1.png`.
- Verification passes: 152/152 unit tests, focused Disc Hockey browser flow,
  the complete legacy Football/Kickfall/tablet browser suite, production
  build, required standalone web-game client, and `git diff --check`.

No follow-up TODO remains for the requested Disc Hockey implementation.

#### Disc Hockey visual and controls refinement

- Reflowed the setup screen into stacked, language-safe sections. Spanish and
  English labels no longer compete horizontally with the option buttons, and
  local two-player mode replaces the irrelevant AI difficulty row with its own
  concise explanation.
- Aligned desktop controls with the other games: Player 1 uses arrow keys.
  Local mode adds WASD only for Player 2, while touch remains independently
  tracked one-finger-per-half.
- Replaced the procedural arenas with two generated 1280 × 720 illustrations:
  a scratched ice rink with frosted walls and spectators, and a detailed
  charcoal sci-fi arena with yellow-gold/red-orange lighting. Each selected
  arena image is requested lazily; entering Neon does not download Ice, and
  vice versa.
- Replaced the reused settings/menu artwork with
  `public/assets/menu/disc-hockey-gameplay-card-v1.webp`, derived from a clean
  capture of the finished Neon match.
- Matched gameplay physics to the illustrated inner rail with an 88 px rounded
  collision boundary. Player and puck centers use radius-aware insets, corner
  impacts reflect against the curved normal, and the visible outline has the
  same curve and deliberate gaps at both goal mouths.
- Verification passes: 154 unit tests, production build, complete Disc Hockey
  browser flow (including real two-finger rounded-corner clamps), visual
  inspection of both themes and the Spanish setup, the standalone web-game
  client, the complete Football/Kickfall/tablet browser regression, and
  `git diff --check`.

#### Disc Hockey image-traced collision maps

- Removed the artificial Ice/Neon perimeter strokes and their translucent rink
  fills. Gameplay now draws only the midfield separator, centre circle/spot,
  and goal nets over each arena illustration.
- Replaced the shared rounded rectangle with separate, invisible vector
  contours traced from the playable-surface edge in each generated image.
  Ice includes its narrower side rails and equipment shoulders; Neon follows
  its broader metal wall. The maps live in the lazy Disc Hockey module.
- Disc centers are constrained by their own radius against the nearest contour
  segment. Puck reflections use the corresponding local normal, including at
  multi-segment corners, while players retain their midfield restriction.
- Moved each theme's goal line and net depth to its traced side edge. Goal
  mouths remain open to the puck and still require the whole puck to cross.
- Added diagnostics identifying the selected hidden map, contour point count,
  bounds, goal geometry, and player/target wall clearance. Pure and Chromium
  two-touch coverage verify that both maps remain invisible and radius-safe.
- Final verification passes: 154 unit tests (including a two-radius grid sweep
  over both maps), production build, focused Disc Hockey browser flow,
  standalone web-game client with screenshot/state inspection, full
  Football/Kickfall/tablet browser regression, and `git diff --check`. The
  complete browser suite had one unrelated Football chilena timing flake on
  its first run and passed unchanged on the immediate rerun.

#### Invisible image-mapped goals

- Removed every generated goal fill, outline, post, and net line from both
  themes. The glowing blue/orange side recesses painted into the arena images
  are now the only visual representation of the goals.
- Mapped the hidden goal mouths to those recesses independently: Ice uses its
  blue side panels and Neon uses its narrower orange-lit panels. Scoring lines
  sit deep inside the painted recesses so the whole puck visibly enters the
  image feature before a goal is awarded.
- Goal diagnostics explicitly report `visible: false`; the existing full-puck
  scoring rule and open-mouth collision behavior remain unchanged.
- The focused Chromium flow now reaches match point, drives the real puck into
  the hidden Neon recess, and requires that physical crossing—not a direct
  debug score call—to produce the winning result.
- Final verification passes: 154 unit tests, production build, focused
  Disc Hockey browser/scoring flow, standalone web-game state and screenshot
  inspection, the full Football/Kickfall/tablet browser regression, and
  `git diff --check`.

#### Engraved pushers, themed pucks, and earlier goal detection

- Generated four exact orthographic top-down equipment sprites with the
  built-in image generator, removed their chroma backgrounds, and normalized
  them to transparent 256 px WebP assets. Ice uses frosted silver/navy pushers
  and a red/steel puck; Neon uses black ceramic, yellow-gold, and red-orange.
- Replaced circular portrait frames with theme-specific pusher bodies. The
  selected character is rendered once into a CanvasTexture as a cropped
  head-and-shoulders relief using offset grayscale highlight/shadow layers, so
  it reads as an engraving integrated into the medallion.
- Added asymmetric puck artwork and rotation driven by puck speed. The selected
  theme's arena, pusher, and puck are loaded together only after starting Disc
  Hockey; the inactive equipment does not enter that match's network requests.
- Moved invisible scoring planes to the painted goal entrances. A goal now
  triggers at exactly 40% puck-diameter overlap (39% remains live), while the
  vertical whole-puck mouth requirement stays intact.
- Focused Chromium screenshots and the standalone deterministic web-game
  client confirm the engraved pieces and themed pucks in both arenas, with no
  visible collision or goal overlays.
- Final verification passes: 154 unit tests, focused Disc Hockey browser flow,
  production build with separate Disc Hockey/Kickfall chunks, standalone
  web-game state and screenshot inspection, the complete
  Football/Kickfall/tablet browser regression, and `git diff --check`.

#### Disc Hockey halo cleanup

- Removed the translucent outer glow circles from both engraved pushers and
  the puck in Ice and Neon. The generated equipment art, internal sprite
  lighting, engraving treatment, circular physics, and subtle contact shadows
  remain unchanged.
- Verification passes: focused Disc Hockey unit tests, production build,
  focused Chromium match flow, standalone deterministic client state/capture
  inspection, and `git diff --check`.

#### Mini-game card readability redesign

- Added an opt-in cinematic layout to the shared journey-card component and
  applied it to Kickfall and Disc Hockey. Their artwork is now full-bleed
  beneath an inset dark copy panel with a narrow per-game accent rail.
- Reserved independent geometry for the left badge, top-row title and arrow,
  objective copy, and bottom metadata. The arrow can no longer cover either
  English or Spanish copy, and lighter strokes improve letterform clarity.
- Added a focused Spanish mini-game-menu capture to the Disc Hockey Chromium
  regression so the longer localized strings remain part of visual review.
- Final verification passes: 154 unit tests, production build, focused
  bilingual Disc Hockey browser flow, standalone deterministic client capture,
  full browser/tablet regression, explicit 1280×720 and 1280×800 visual
  inspection, and `git diff --check`.

#### Air-hockey momentum and proactive computer opponent

- Replaced the puck's heavy carpet-like damping with an air-table model:
  normal motion uses `0.06` damping and `0.96` wall restitution, while only
  sub-18 px/s nudges enter a stronger settling zone and eventually stop.
- Removed the AI branch that sent the computer back to goal when a stationary
  puck was reachable near midfield. All levels now get behind and attack pucks
  on their own half; Easy hangs back across midfield, Normal presses, and Hard
  patrols at x=688 with faster prediction and 500 px/s maximum movement.
- Hard mode approaches slow midfield contests on a shallow vertical angle.
  This prevents the human and computer pushers from pinning the puck directly
  between their half-line limits.
- Diagnostics now expose puck speed/surface coefficients and the current
  computer target/tuning. Pure regressions cover long glides, soft settling,
  difficulty press depth, angled midfield contests, and a complete stationary
  puck chase-and-strike.
- Final verification passes: 156 unit tests, production build, focused Disc
  Hockey stalemate/scoring/multitouch flow, standalone Hard-mode client state
  and screenshot inspection, full Football/Kickfall/tablet browser regression,
  and `git diff --check`. The complete browser suite hit an unrelated existing
  Football fireball timing flake on its first run and passed unchanged on the
  immediate rerun.

#### Android 16 tablet landscape enforcement

- Diagnosed native tablet rotation despite the existing
  `android:screenOrientation="sensorLandscape"` declaration. The Android 16
  target ignores fixed-orientation requests on large screens unless an
  exception applies, and the installed app was reported as
  `SCREEN_ORIENTATION_UNSPECIFIED` at runtime.
- Declared the native application category as `game`, which is Android's
  documented exception for game orientation requests, while retaining the
  existing sensor-landscape activity setting and Capacitor runtime lock.
- Rebuilt and installed on the connected Android 16 Samsung SM-X210. With the
  system explicitly locked to portrait, the foreground activity continued to
  report `SCREEN_ORIENTATION_LANDSCAPE` at 1920 × 1200; the original free
  rotation preference was restored afterward.

#### Direct tablet pusher tracking

- Tablet testing confirmed the refreshed native bundle corrected the apparent
  early-goal behavior, so the artwork-mapped collision and scoring geometry
  were left unchanged.
- Added a touch-only pusher profile with 1200 px/s maximum speed and an 80 Hz
  response, versus the existing 440 px/s keyboard profile. Both human pushers
  use the faster profile while actively owned by a pointer; keyboard and AI
  tuning are unchanged.
- A deterministic 100 ms measurement on the installed tablet moved the pusher
  112.8 logical pixels toward a 210 px target and reached 1199.6 px/s. The
  focused 13-test Disc Hockey suite, full Disc Hockey Chromium flow, required
  standalone web-game client capture, production/native build, Android install,
  orientation override test, and device error-log check all pass.

#### Hockey rematch routing and Football touch-action swap

- Reproduced both Disc Hockey result actions end to end and found that the
  Rematch and Prepare Match hit areas overlapped by 30 logical pixels. The
  topmost Prepare Match button could therefore intercept a rematch tap near
  the shared edge.
- Narrowed and separated both result buttons. Rematch performs a clean Hockey
  match reset with the same mode and arena, while Prepare Match continues to
  open the Disc Hockey setup.
- Found a second setup race during end-to-end reproduction: the Play button
  could submit the scene's cached profile snapshot while the visible setup
  already reflected newer global choices. Hockey launch now reads the live
  global profile at activation time.
- Swapped the Football touch positions of Power and the high-kick/Lob action:
  Power now occupies `(930, 500)` and Lob occupies `(1195, 475)`. Their sizes,
  actions, colors, and keyboard bindings are unchanged.
- Final verification passes: 157 unit tests; focused Disc Hockey browser flow
  including human loss, Prepare Match → Hockey setup → Hockey, and Rematch →
  fresh Hockey; the complete Football/Kickfall/touch browser suite; standalone
  web-game client capture; production/native build; Android install; direct
  on-tablet route and touch-position assertions; device screenshot inspection;
  device error-log check; and `git diff --check`. The complete browser suite
  hit its known high-speed fireball sweep timing flake once and passed
  unchanged on the immediate rerun.

#### Ice collision recalibration and symmetric local touch

- Retraced the Ice arena's hidden collision contour against its own artwork.
  The wall now follows the painted rounded boundary and bends into the recessed
  side goals instead of stopping at the former x=188/1092 approximation.
- Moved the Ice scoring planes to the actual goal entrances at x=104/1176.
  The existing 40%-inside scoring rule and full-puck vertical mouth check remain
  unchanged; the Neon map is untouched.
- Routed both local human pushers through one shared movement helper, removing
  the duplicated Player 1/Player 2 touch-speed branches.
- Added regressions for the Ice v2 map coordinates and mirrored simultaneous
  touch travel. On the installed Samsung SM-X210 build, two real active touch
  pointers each travelled 152.8 logical pixels in 100 ms and reached mirrored
  1199.97 px/s velocities. The old Ice plane no longer scored, while 40%
  overlap at the new painted entrance did.
- Final verification passes: 158 unit tests, focused Disc Hockey browser flow,
  production build with the separate Hockey chunk, native debug APK build and
  install, exact on-tablet collision-map/state assertions, two-finger tracking
  measurement, goal-depth check, and native screenshot inspection.

#### Three-minute Hockey matches and larger, direct pushers

- Replaced first-to-five with a fixed 180-second active-play clock. Countdown,
  goal pauses, manual pause, and app suspension do not consume match time.
  The higher score at 0:00 wins and a tied score now produces a bilingual draw
  result; rematch restores the full 3:00.
- Updated the HUD, setup objective, mini-game card copy, diagnostics, English
  and Spanish strings, README, and Disc Hockey specification for timed play.
- Increased both pusher art and circular physics radii exactly 10%, from 44 to
  48.4 logical pixels.
- Increased touch capacity to 2400 px/s and separated touch from keyboard/AI
  acceleration. Touch-owned pushers now use a direct speed-capped follower,
  preventing overshoot and the stutter found during the first tablet check.
- On the installed Samsung SM-X210, simultaneous human pushers followed six
  consecutive 30-pixel finger movements exactly on every 60 Hz step:
  230/1050, 260/1020, 290/990, 320/960, 350/930, and 380/900. A 205-pixel jump
  reached both targets within 100 ms and remained stationary without rebound.
- Final verification passes: 161 unit tests, the focused timed Hockey browser
  flow (including five-goal continuation, timeout win/loss/draw, rematch clock
  reset, pause clock freeze, enlarged boundaries, and simultaneous touch),
  required standalone web-game client capture, production/native builds,
  Android install, direct device state assertions, continuous two-touch trace,
  and native screenshot inspection.

#### Android immersive fullscreen

- Enabled Android immersive mode for the Capacitor activity, hiding both the
  status bar and Samsung's navigation/taskbar while the game has focus.
- Configured transient system bars: an edge swipe may reveal the controls
  temporarily, after which Android hides them again.
- Reapplied immersive mode on activity creation, resume, and regained window
  focus so returning from system UI does not leave the tablet taskbar visible.
- Added a fullscreen launch-theme flag to avoid showing system chrome during
  startup.
- Built and installed the debug APK on the Samsung SM-X210. A 1920×1200 device
  capture contains only the game, and Android's window state reports both
  `statusBars` and `navigationBars` (the Samsung `TaskbarWindow`) as hidden.

#### Release validation for web publication

- Re-ran all 161 unit tests, the dedicated Disc Hockey browser flow, and the
  complete Football/Kickfall/touch browser suite; all pass.
- Rebuilt the production bundle and confirmed Disc Hockey and Kickfall remain
  separate lazy-loaded chunks.
- Ran the standalone web-game client against the production preview. Its
  screenshot and `render_game_to_text` state agree on the fully rendered
  Football setup screen, with no new browser errors.

#### Additional sound-effects integration (2026-07-29)

- Original prompt for this iteration: map the newly added files under
  `public/assets/sound` to suitable game events and add them to the game.
- Audited all nine additions and their durations. Chosen map: ordinary button
  feedback, forward menu entry, alternating Football/Hockey goal stingers,
  power earning/activation, Kickfall wall destruction and level victory, plus
  theme-specific Ice/Neon Hockey contact.
- Added all nine files to the shared effects media layer, effects-volume/mute
  handling, cold-cache restoration, normal progressive warming, and
  diagnostics. The complete reusable audio inventory is now 18 unique files;
  data-saver mode still warms only the immediately useful subset.
- Replaced the synthesized generic click with the supplied button cue while
  retaining synthesis as a browser fallback. Forward journey/game transitions
  use the separate menu-entry cue.
- Football and Hockey goals alternate `GOAL_1` and `GOAL_2` while preserving
  the referee whistle. Kickfall gates and the boss use the wall break; a
  victorious board uses the three-second finish cue. Hockey uses distinct Ice
  and Neon hits with a 280 ms anti-chatter cooldown. Power Lab rewards, instant
  powers, and successful powered ball contact use the new power-up cue.
- Browser diagnostics and regressions now assert each event family, both
  Hockey theme variants, cache completeness, and goal-stinger playback.
- Final verification passes: 161/161 unit tests, production build, focused
  Disc Hockey browser flow, complete Football/Kickfall/tablet browser suite,
  standalone deterministic web-game client, visual screenshot inspection,
  zero browser/page errors, and `git diff --check`.

No follow-up TODO remains for this sound-effects integration.

#### Velocity-scaled Hockey contact volume (2026-07-29)

- Original prompt for this follow-up: make light pusher–puck touches play at
  50% of the configured effect level and progressively harder hits reach 100%.
- Added a pure, linear closing-speed curve: 0 px/s maps to 50%, 450 px/s maps
  to 75%, and 900 px/s or faster maps to 100%. Sideways pusher movement does
  not falsely increase loudness because only velocity along the contact normal
  contributes.
- The scale is relative to the current effects channel, so the existing volume
  slider and mute setting remain authoritative. Per-play volume is set directly
  on the selected Ice/Neon media element.
- Added collision and audio diagnostics for the last impact speed, requested
  volume scale, and effective media volume.
- Pure tests cover the curve boundaries and collision-speed extraction. The
  focused browser flow verifies a damped 39.96 px/s light touch at 52.2% and a
  real midfield-clamped 1,896 px/s strike at 100%.
- Final verification passes: 162/162 unit tests, production build, focused
  Disc Hockey browser flow, complete Football/Kickfall/tablet browser suite,
  standalone deterministic web-game client, screenshot inspection, zero
  browser/page errors, and `git diff --check`.

No follow-up TODO remains for velocity-scaled Hockey contact audio.

#### Disc Hockey anti-camping crease rule (2026-07-29)

- Original prompt for this iteration: prevent a player who is ahead from
  permanently parking their pusher in the center of their own goal.
- Selected a symmetric four-second crease rule with a visible warning,
  defensive-puck exception, pusher ejection, and brief movement penalty.
- The rule detects only deep occupancy inside each theme's painted goal mouth.
  It applies symmetrically and regardless of score, keeping the behavior
  predictable instead of switching rules when the lead changes.
- A puck within 300 logical pixels of the defender's goal resets the timer
  immediately, preserving legitimate saves. With the puck safely away, a
  countdown ring and bilingual `MOVE!` / `¡MUÉVETE!` warning appear after
  one second.
- Reaching four seconds produces a bilingual crease-violation banner, ejects
  the pusher physically into the rink, and freezes movement for the remainder
  of a 1.25-second penalty. The puck, score, match clock, and touch ownership
  remain intact.
- Added diagnostics for crease occupancy, nearby-puck exemption, warning and
  penalty timers, mirrored violation counts, and the last violation.
- Updated the English/Spanish setup explanation, README, and Disc Hockey spec.
  Inspected both setup languages plus Neon warning/ejection/frozen and Ice
  warning captures; all text and effects fit cleanly.
- Final verification passes: 164/164 unit tests, production build, focused
  Disc Hockey browser flow, complete Football/Kickfall/tablet browser suite,
  standalone deterministic web-game client, screenshot inspection, zero
  browser/page errors, and `git diff --check`.

No follow-up TODO remains for the anti-camping crease rule.

#### Mechanical Hockey ejection and frozen visual (2026-07-29)

- Original prompt for this refinement: visually communicate the frozen pusher
  and replace the teleport-like ejection with a metallic piece emerging from
  inside the goal to push the offender in a random direction.
- Selected a bounded inward random push, telescoping goal piston, and metallic
  lock treatment. After visual review, the lock was rejected in favor of the
  earlier translucent frozen-pusher state; the piston remains.
- Follow-up timing request: extend the camping cycle to four seconds. The first
  second detects occupancy, then the warning visibly counts `3`, `2`, `1`
  before ejection.
- The pusher now moves instead of teleporting: a telescoping metallic piston
  extends from behind the offender's goal, pushes inward for 320 ms at a
  random angle bounded to ±24 degrees, and retracts. Both goals mirror the
  same behavior, and arena collision clamping keeps the movement legal.
- After the piston retracts, the pusher returns to the preferred translucent,
  cool-tinted frozen treatment until movement unlocks. The rejected metal
  crossbars, bolts, lock ring, and `LOCKED` label were removed.
- Diagnostics distinguish warning, ejection, and frozen states and expose the
  generated ejection vector. Browser coverage asserts the visible `3 → 2 → 1`
  sequence, inward motion from both goals, frozen input blocking, and recovery.
- Final verification passes: 164/164 unit tests, production build, focused
  Disc Hockey browser flow, complete Football/Kickfall/tablet browser suite,
  standalone deterministic web-game client, Neon warning/piston/frozen visual
  inspection, zero browser/page errors, and `git diff --check`.

No follow-up TODO remains for the mechanical Hockey ejection refinement.

#### Disc Hockey Crazy Mode (2026-07-29)

- Original prompt for this iteration: add `Crazy Mode!` / `¡Modo Loco!`, a
  computer-only fixed-Hard challenge against four random coordinated AI
  pushers. Add a bottom energy bar charged by intentional hits, defensive
  saves, and passive recovery; arm the human pusher with `power_up_1`, consume
  the next intentional hit with `powered_up_shot`, knock rival pushers aside
  with the unstoppable puck, and empty the energy bar on a camping violation.
- Follow-up decisions: use a red-orange armed hue/pulse, preserve full charge
  when the computer scores, end a powered shot on a player goal or the
  opponent's back wall, and retain side-wall ricochets.
- Audit complete: the current scene assumes one right pusher throughout AI,
  collision, visuals, crease state, and diagnostics. Implementation will add a
  Crazy-only right-side squad while preserving the existing single-player and
  local-two-player paths.
- Added the persisted `crazy` setup choice with English/Spanish `Crazy!` /
  `¡Loco!` presentation, four mystery rivals, fixed-Hard explanation, and
  Crazy-specific instructions. Matches choose four unique character rivals
  while excluding the human.
- Added striker, interceptor, defender, and goalkeeper role auctions with role
  retention, predicted defensive positioning, attack-lane clearance, legal
  half clamping, teammate separation, and team-aware right-crease time.
- Added the bottom Crazy Power bar: 1%/s passive recovery, +6% intentional
  hits, +14% defensive saves, contact/recharge cooldowns, and a 120 px/s human
  closing-speed requirement. Incidental incoming-puck collisions neither
  charge nor consume the armed shot.
- Full charge plays `power_up_1`, adds a red-orange pusher pulse, and arms one
  shot. Intentional activation plays the newly cached `powered_up_shot`,
  transfers a hot trail to a 1450 px/s puck, knocks each rival aside once, and
  remains active through side-wall bounces until a goal or opponent back wall.
- Computer goals preserve full comeback charge. Player goals disarm unused
  full charge. A confirmed human crease violation empties/disarms the bar and
  blocks passive recharge during the frozen penalty.
- Fixed a live-review regression where the armed pulse used Phaser's native
  scale of 1 and enlarged every 106 px pusher sprite to its 256 px source
  size. The pulse now multiplies the intended display diameter. Diagnostics
  and browser coverage assert both the 48.4 px physics radius and 104–107 px
  visual diameter for all four rivals.
- Pure Hockey coverage now exercises unique roster selection, intentional
  contact/save classification, charging bounds, powered-puck creation,
  knockback, back-wall expiry, all four coordinated roles, shot-lane clearance,
  safe-goalkeeper positioning, and teammate separation. Focused browser
  coverage passes the complete Crazy setup/charge/arm/shot/knockback/camping
  flow with zero page errors.
- Final visual inspection covers English/Spanish Crazy setup, four-rival live
  play, the corrected standard pusher scale, bright full energy bar, armed
  red-orange pusher, powered-puck trail, and crease-piston energy drain.
- Final verification passes: 168/168 unit tests, focused Disc Hockey browser
  flow, complete Football/Kickfall/tablet browser suite, production build,
  standalone deterministic web-game client, zero browser/page errors, and
  `git diff --check`.

No follow-up TODO remains for Disc Hockey Crazy Mode.

#### Input-independent Hockey crease timing (2026-07-29)

- Original bug report: goal-camping detection triggered on time while a
  finger/mouse remained down, but took much longer after releasing input.
- Root cause: releasing a pointer cleared its target and ownership but retained
  the last direct-touch velocity. The keyboard-style fallback then integrated
  that residual velocity, allowing an apparently parked pusher to drift across
  the crease boundary and reset the timer.
- Pointer release now atomically clears ownership/target and both velocity
  components. Human players with neither pointer nor keyboard input also stop
  immediately, including Player 2 in local mode.
- Added a pure immutable release-control unit test and a deterministic browser
  comparison that starts with identical residual velocity, measures the held
  timer, releases the pointer, and requires the released timer to match within
  30 ms.
- Focused verification passes: 25/25 Disc Hockey unit tests, deterministic
  held-versus-released browser timing, released-state screenshot inspection,
  standalone client sanity check, zero page errors, and `git diff --check`.
  The complete regression suite remains intentionally deferred until the
  user's queued feedback is clear.

No follow-up TODO remains for input-independent crease timing.

#### Crazy Mode corner-puck recovery (2026-07-29)

- Original bug report: in Crazy Mode, two or more computer pushers can converge
  on a puck at the rounded opponent corner and collectively pin it against the
  boards.
- Root cause: every support role independently tracked the puck or its
  predicted path. Near an end-board corner, the striker, defender, and
  goalkeeper targets collapsed into the same narrow contact lane despite the
  normal teammate-separation pass.
- Added mirrored top/bottom corner recovery. Within the last 150 px of the
  opponent end and 130 px of a corner, the nearest striker becomes the sole
  retriever and approaches from an inward diagonal for a banked release. The
  goalkeeper returns to center, while the defender and interceptor immediately
  open into a spaced recovery formation away from the puck.
- Exposed the active corner-recovery side in the Crazy squad diagnostics.
  Focused pure coverage checks both mirrored corners, one-and-only-one nearby
  retriever, diagonal approach direction, and more than 180 px of support
  clearance.
- Focused verification passes: 27/27 Disc Hockey unit tests, the full
  deterministic Disc Hockey browser flow, live bottom-corner escape, visual
  inspection of `output/disc-hockey/09b-crazy-corner-recovery.png`, standalone
  web-game client sanity, zero browser/page errors, and `git diff --check`.
  The complete cross-game regression suite remains intentionally deferred
  until the user's queued feedback is clear.

No follow-up TODO remains for Crazy Mode corner-puck recovery.

#### Real-photo-derived Joel character V1 (2026-07-29)

- Replaced the fictional Joel with a real-photo-derived likeness based on four
  guardian-supplied reference photographs. The private photographs remain
  outside the repository; the approved generated anchor, transparent source,
  exact 4×3 pose sheet, identity contract, and prompt provenance live under
  `source-assets/characters/joel-v1/`.
- Added a manifest-driven Joel build to
  `scripts/build-character-animation-atlases.py`. It uses bleed-aware source
  recovery, normalizes all twelve 320×480 frames, grounds standing poses at
  `y=418`, and writes the versioned runtime atlas plus a 512×512 transparent
  selector portrait.
- Replaced Joel across Football, Kickfall, and Disc Hockey, including the intro
  hero, selectors, tiny Hockey engraving, baked Kickfall/Hockey menu cards,
  startup splash, web manifest icons, Android launcher/adaptive icons, and
  native portrait/landscape splashes. Runtime asset filenames and the service
  worker were versioned to prevent stale cache-first artwork.
- Added `scripts/build-title-character-brand-assets.py` so approved title
  masters reproducibly generate all web and Android branding sizes.
- Installed the reusable personal Codex skill `$onboard-game-character` with a
  repository contract and automated atlas auditor. A hypothetical second
  person was used to forward-test its audit, generation, integration, privacy,
  geometry, and human-approval gates.
- Geometry audit passes: 1280×1440 atlas, twelve non-empty frames, complete
  hair/hands/shoes, safe transparent side margins, and identical `y=418`
  grounded baselines. Visual review covers the intro, selectors, all Football
  actions, Kickfall, standard and Crazy Hockey, menu cards, web splash, icon,
  and native Android splash.
- Release-gate verification passes: 171/171 unit tests, production build,
  complete Football/Kickfall/tablet browser suite, complete deterministic Disc
  Hockey browser suite, required standalone web-game client, zero page errors,
  and `git diff --check`.

Tablet deployment remains intentionally pending Joel/guardian likeness
approval.

#### Dad / Papá character V1 and onboarding-agent field test (2026-07-29)

- Used the installed `$onboard-game-character` workflow with four private
  photographs of Luis Nomad to add the new `dad` roster member. English uses
  Dad/DAD and Spanish uses Papá/PAPÁ. The photographs remain outside the
  repository.
- Luis approved the original tall adult cartoon anchor with a deep navy,
  golden-yellow, royal-blue, and cream kit. The superseded compact experiment
  remains archived as provenance only. Dark-brown scalp hair, moustache, and
  beard are an explicit identity invariant; gray, silver, blond, and
  salt-and-pepper hair are prohibited in every pose.
- Regenerated a consistent twelve-pose 4×3 sheet from the approved tall
  anchor, removed its flat magenta background locally, added it to the shared
  atlas builder with bleed-aware recovery, and produced the versioned runtime
  atlas and 512×512 portrait.
- The atlas auditor passes: 1280×1440, twelve non-empty 320×480 frames, every
  grounded frame ending at `y=418`, minimum eight-pixel side margin, complete
  hair/hands/shoes, and a size-corrected jump. Dad's idle art uses a dedicated
  405-pixel 6'7" normalization versus the standard 380 pixels, while his
  gameplay collider remains unchanged. Hash comparison proved no previously
  approved character atlas changed during the build.
- Added a bounded catalog-level `visualScale` parameter after live review
  showed that Dad's narrower tall-adult proportions still felt smaller than
  Joel's oversized head-soccer silhouette. Dad now renders at 1.20× in
  Football and Kickfall. Football retains the same authored compound collider
  area as his opponent, Kickfall retains the same 44×82 body, all feet stay on
  their shared ground/platform lines, and Hockey ignores this parameter to
  preserve one regulation pusher diameter.
- Dad is selectable as player or opponent in Football, Kickfall, and Disc
  Hockey; can appear as a Crazy rival; and is excluded from the Crazy squad
  when Dad is the human player. His gold accent and sturdy stats are
  speed/jump/dash 0.98, kick 1.04, and power 1.08.
- The About panel now shows Dad's portrait beside the existing creator credit
  and explicitly labels `Luis Nomad · Dad` / `Luis Nomad · Papá`, while keeping
  NotJustPrompts.ai and the dedication to Joel.
- Live screenshot review caught a baked `JOEL / BOB` scoreboard in the Hockey
  setup that disagreed with selected characters. It is now covered by dynamic
  localized lineup labels, including DAD, PAPÁ, and CRAZY SQUAD/EQUIPO LOCO.
- The agent field test exposed two reusable lessons now added to the skill:
  update every serialized/browser-only roster fixture, and audit baked lineup
  labels separately from catalog-driven portraits.
- Visual validation passes for the portrait selectors, Football idle/run/jump
  and three-stage kick, Kickfall ground/run/kick, normal Hockey engraving,
  Crazy-rival engraving, About panel, and dynamic Hockey header. Feet share the
  Football pitch and Kickfall platform baselines; Hockey keeps the standard
  104–107 px visual diameter.
- Release-gate verification passes: 173/173 unit tests, production build,
  complete Football/Kickfall/tablet browser journey, complete deterministic
  Disc Hockey browser journey, standalone web-game client state/error sanity,
  atlas audit, zero page errors, and `git diff --check`. The existing Phaser
  chunk-size warning remains informational.

Luis approved the tall identity anchor. Tablet deployment remains intentionally
pending the final combined pre-deployment review.

#### Crazy Mode goal-lip dead-zone recovery (2026-07-29)

- Reproduced the reported Ice-arena pile-up at the upper-right goal lip with a
  stationary puck and three Crazy rivals accumulating around it.
- Root cause: the goal is wide enough for the puck, but outside its narrow
  central strip there is not enough wall clearance for a full-size pusher to
  take the normal behind-the-puck approach.
- Extended the existing one-retriever board recovery to both goal lips using
  the actual puck and pusher radii. One striker now takes a diagonal bank
  approach while the goalkeeper, defender, and interceptor vacate the pocket;
  the goalkeeper's recovery anchor stays at least 195 px behind the puck.
- Added mirrored pure regressions for the upper and lower goal lips plus an
  end-to-end Ice-arena cluster. In the captured browser run, the three support
  players cleared by more than 180 logical pixels and the puck resolved within
  1.8 seconds instead of remaining pinned.
- Verification passes: 175/175 unit tests, the complete deterministic Disc
  Hockey browser journey, production build with separate Hockey/Kickfall
  chunks, required standalone web-game client screenshot/state review,
  complete Football/Kickfall/touch browser suite, and `git diff --check`.

Tablet deployment remains pending the existing combined Joel/Dad artwork
review; this fix has not overridden that release gate.

#### Held-pointer crease timing at goal lips (2026-07-29)

- Reproduced the reported delay at the painted goal lip with real browser
  mouse-down and CDP touch ownership held continuously through the four-second
  camping window.
- The previous crease test used only the pusher center vertically and reset all
  accumulated time on a tiny boundary crossing. Held input continually samples
  those edge coordinates, so harmless mouse/finger movement could repeatedly
  restart the clock even though the circular pusher still occupied the goal.
- Crease occupancy now uses the full circular pusher footprint vertically and
  retains an active timer through an 8 px spatial exit hysteresis. A genuinely
  departed pusher still resets immediately beyond that margin, and a
  threatening puck still clears the timer immediately.
- Added pure upper-lip, boundary-jitter, and true-exit regressions. Browser
  coverage holds a real mouse pointer and a real touch pointer at the lip and
  requires both to trigger the same piston violation after 4.05 seconds while
  ownership remains active.
- Verification passes: 175/175 unit tests, complete deterministic Disc Hockey
  browser journey, held-touch ejection screenshot inspection, production build
  with separate Hockey/Kickfall chunks, standalone web-game client
  screenshot/state review, and `git diff --check`.
- The broad cross-game browser suite currently stops in separate concurrent Mum
  animation work: first at the enhanced-run-cycle assertion and, on retry,
  while decoding that changing atlas. No Hockey or crease assertion failed.

Tablet deployment remains pending the existing combined character-art review.

#### Project-owned character-creation agent (2026-07-29)

- Added the repository-scoped `$create-game-character` skill under
  `.agents/skills/create-game-character/`, the official Codex discovery
  location for workflows that should travel with a project.
- The agent owns the complete photo-to-roster workflow: privacy-safe intake,
  written identity contract, single-anchor human approval, twelve-pose
  generation, chroma removal, atlas packing, catalog/runtime integration,
  cached and baked surface audits, visual-scale fairness checks, full browser
  coverage, and final person/guardian approval before deployment.
- Added project-specific references for image-generation prompts, source and
  runtime naming, atlas geometry, optional `visualScale`, Football/Kickfall
  collider invariants, regulation Hockey pusher size, localization, fixtures,
  branding, caching, privacy, and release gates.
- Added deterministic atlas and package auditors. The package auditor checks
  canonical source files, transparent corners, portrait size/clearance,
  lossless and runtime atlas geometry, catalog and builder registration, and
  prompt/privacy/runtime provenance.
- Validation passes: official skill `quick_validate.py`, Python compilation,
  complete Dad package audit, complete Joel package audit, and
  `git diff --check`. The Dad forward test caught and corrected an overly
  narrow pose-sheet provenance matcher before Joel also passed.

The agent is ready for the next user-supplied character photos. Invoke it with
`$create-game-character`. It intentionally stops for anchor approval and again
before any deployment.

#### Mum character identity gate (2026-07-29)

- Started the project-owned `$create-game-character` workflow for Joel's mum
  from three private front/profile/three-quarter family photographs.
- The photographs remain outside the repository. Only the written identity and
  kit contract, exact prompt provenance, generated anchor, and transparent
  derivative are stored under `source-assets/characters/mum-v1/`.
- The proposed roster identity is `mum`, localized as `Mum` / `Mamá`, with a
  sapphire, midnight-navy, and warm-gold kit, native right-facing artwork, and
  gentle makeup: softly defined brows, thin brown liner/mascara, subtle blush,
  and muted rose lips.
- Generated one full-body likeness candidate and removed its flat magenta
  background. A neutral-background audit found a small curl-edge fringe in the
  first derivative; the canonical transparent anchor uses the prescribed
  one-pixel matte contraction and preserves the complete face, hair, hands,
  kit, shoes, and studs.

The user approved Mum's identity anchor on 2026-07-29. The twelve-pose sheet,
atlas package, roster integration, and release validation may now proceed.

- Generated Mum's exact 4×3 source sheet in the required human-friendly order:
  idle, three running stages, jump, kick contact, chilena source, dash, stun,
  anticipation, bicycle kick, and recovery.
- The sheet contains twelve separated complete figures with a stable adult
  likeness, kit, makeup, hair language, head/body ratio, shoes, and lighting.
  Neutral-background inspection confirmed intact curls, hands, and soles.
- As with the approved anchor, the first keyed sheet showed a faint one-pixel
  magenta edge around a few moving curls. The canonical transparent sheet uses
  the allowed one-pixel matte contraction; the uncontracted derivative is kept
  as provenance.
- User review caught that the standing/idle source faced opposite Mum's
  screen-right action poses. Only the complete idle cell was horizontally
  mirrored in both canonical chroma and transparent sheets. The initial
  341-pixel conceptual crop left boot-bleed remnants; visual inspection caught
  that intermediate mistake, and the final 384×360 replacement includes the
  full silhouette without touching row 2. Atlas bounds returned to their
  original 121×380 idle geometry and the portrait now uses the corrected
  direction.
- Packed the corrected sources into a lossless 1280×1440 atlas, twelve runtime
  frames, a WebP runtime atlas, and a 512×512 selector portrait. Mum is
  registered after Dad in the data-driven roster as `Mum` / `Mamá`, with
  native screen-right facing and standard adult visual scale and colliders.
- Integrated Mum across Football setup and play, Kickfall, normal Disc Hockey,
  and Crazy Disc Hockey. Existing creator and branding surfaces were left
  unchanged because Mum is a playable family character, not the app creator.
- Visual review covers the corrected idle, both facing states, complete
  Football run/jump/kick/dash/stun/chilena/Big Guy set, Kickfall
  idle/run/jump/kick, both Hockey modes, and selection screens. Feet align to
  the Football and Kickfall ground anchors, while Hockey uses the regulation
  pusher diameter.
- Final validation passes: 175/175 unit tests, production build, full
  Football/Kickfall browser journey, deterministic Disc Hockey browser
  journey, standalone web-game client screenshot/state review, atlas audit,
  package audit, and `git diff --check`. Browser journeys reported zero page
  or console errors. Tablet deployment remains deliberately pending Mum's
  final in-game guardian approval.

#### Mum roster-relative proportion refinement (2026-07-29)

- In-game comparison showed that Mum and Joel had identical authored and
  runtime idle heights, but Mum's realistic adult head/body ratio and narrower
  silhouette made her read materially smaller in the head-soccer style.
- Refined all twelve source poses with a controlled 10–12% increase to Mum's
  complete head and hair while preserving her adult identity, gentle makeup,
  kit, body scale, limb lengths, pose order, screen-right direction, and
  gameplay geometry. The previous corrected sources remain archived.
- Added a roster-relative parity auditor to the project character agent. It
  applies catalog `visualScale`, measures the target against roster medians,
  and renders every idle on one shared ground line for mandatory visual review
  of head/body ratio and perceived prominence. The agent now explicitly
  requires comparison with Joel, an adult, and the full roster; equal canvas
  height alone is no longer sufficient.
- The head-only candidate measured 137×380 authored pixels versus Joel's
  133×380, with both at `visualScale: 1`. Unrelated source and runtime atlas
  hashes remained byte-identical after rebuilding.
- The first body-width pass reached only about 86 px of runtime idle width and
  was rejected as still too thin. A stronger body-width candidate reached the
  target metrics but was also rejected during visual review because it made
  Mum read much too broad and muscular.
- The parity auditor now accepts an explicit age cohort. Adult mode enforces at
  least 85% of roster-median visible width and 90% of median height unless a
  documented identity/design exception is supplied.
- At that stage, an experimental candidate used Lucia as the sole body
  proportion reference, with Mum's own adult face, makeup, voluminous wavy
  hair, and kit. The slim body remained unchanged while head and hair presence
  were calibrated across all twelve poses.
- That final Lucia-proportion candidate was 161×380. At the experimental adult
  `visualScale: 1.1`, she renders at approximately 103×244 visible pixels
  versus Lucia's 108×215: comparable overall presence with the same slim
  cartoon language, while Mum remains visibly taller and adult. Football and
  Kickfall colliders remain the shared regulation geometry; Hockey ignores
  cosmetic scale as required.
- Final user review preferred the original Mum treatment after all. Restored
  the exact pre-head-refinement chroma and transparent sheets, which already
  include the corrected screen-right idle, and removed Mum's experimental
  `visualScale: 1.1`. All later proportion candidates remain archived but are
  excluded from runtime.
- The comparison workflow still did its job: it exposed the relative width
  clearly enough for an informed art-direction choice. Mum's 67.4% median-width
  ratio is now a documented user-approved exception (`minimum-width-ratio
  0.65`), rather than an accidental pass. Geometry, grounding, and collider
  gates remain non-negotiable.

#### Mum animation-scale normalization (2026-07-29)

- Live review found that Mum's approved idle was internally much smaller than
  several generated action poses. The shared 320×480 cells and ground anchor
  were correct, but her jump looked larger and adjacent run/kick frames pulsed
  in perceived size.
- Measured every runtime pose as an idle-relative visible area and compared the
  result with the same poses for adult references Juan, Dad, and Juanjo. Mum's
  actions occupied 1.78–2.23× her idle area before correction, versus adult
  reference medians of 1.16–1.55×.
- Added deterministic per-frame packing scales for Mum. The approved source
  sheet and idle remain unchanged; only runtime action packing is normalized.
  All frames retain the shared `y=418` ground anchor, safe side margins, and
  unchanged gameplay colliders.
- Added `audit_character_motion_parity.py` to the project character agent. It
  compares all twelve pose footprints with same-cohort atlases, produces a
  fixed-scale motion board, and requires temporal visual review of the face,
  torso, run loop, jump, and three-stage kick rather than approving isolated
  screenshots alone.
- The normalized atlas, package, roster-parity, and motion-parity audits pass.
  Unrelated approved atlas hashes remain byte-identical. The service-worker
  cache version advanced to V7 so installed builds cannot retain the old Mum
  atlas under its unchanged filename.
- Final verification passes: 175/175 unit tests, production build, complete
  Football/Kickfall browser journey, complete Disc Hockey browser journey,
  standalone web-game client state/screenshot review, skill validation, and
  `git diff --check`, with zero page or console errors. The Disc Hockey driver
  now waits through the selector input lock and confirms each expected roster
  transition, eliminating a five-click timing race exposed during this run.

#### Mum whole-character presence correction (2026-07-29)

- Direct Kickfall comparison with Juanjo confirmed that equal authored height
  was insufficient: Mum's original narrow silhouette still read as a
  miniature at runtime.
- Preserved the exact user-selected source art and normalized motion atlas.
  Mum now uses uniform `visualScale: 1.2`, making her approximately 85×266
  visible pixels and about 98% of Juanjo's visible area without widening or
  redrawing her body. Dad also moves from 1.1 to 1.2; his taller 405-pixel
  authored idle renders at approximately 284 pixels, preserving the intended
  6'7" hierarchy above Mum.
- Football retains the shared compound collider, Kickfall retains its 44×82
  gameplay body, both modes retain their existing foot anchors, and Hockey
  continues to ignore cosmetic scale and use one regulation pusher diameter.
- Subsequent live review showed that the first adult-area normalization had
  over-corrected the atlas: every non-standing Mum pose read smaller even
  though frame-to-frame stutter was reduced. Rebalanced the action packing
  around temporal sequences instead. Run frames now occupy approximately
  319–329 authored pixels of visible height, kick stages approximately
  310–321, and jump approximately 306; this restores action presence while
  keeping adjacent frames steady and avoiding the original oversized jump.
- Advanced the service-worker cache contract to V8 because the normalized Mum
  atlas changed under its existing runtime filename.
- Final verification passes: 177/177 unit tests, production build, complete
  Football/Kickfall browser journey, complete deterministic Disc Hockey
  journey, atlas/package/roster/motion audits, official skill validation,
  standalone web-game client screenshot/state review, unchanged hashes for
  every unrelated approved atlas, and `git diff --check`. Browser journeys
  reported zero page or console errors.

#### Cross-game Hockey character selection regression (2026-07-29)

- Fixed the Disc Hockey Player 1 carousel so it no longer hides the character
  currently stored as Football's opponent. Selecting that character now uses
  the existing profile-lineup sanitizer to move the conflicting opponent to a
  valid fallback, matching the established Mini-games/Kickfall behavior.
- The rival carousel still excludes the active Player 1 character, so a match
  cannot end up with the same character on both sides.
- Added a browser regression that stores Luna as the Football opponent, selects
  Luna from the Disc Hockey setup, and verifies the resulting Hockey lineup is
  Luna versus Joel. Updated later roster-cycle assertions to cover the complete
  Player 1 roster rather than relying on the old hidden-character behavior.
- Validation passes: 175/175 unit tests, deterministic Disc Hockey browser
  journey with zero page/console errors, production build, standalone
  web-game client smoke run, screenshot/state review, and `git diff --check`.

#### Crazy Mode overdrive striker (2026-07-29)

- Made the dynamically assigned striker the squad's single overdrive attacker:
  25 ms target reactions, 780 px/s top speed, and response 22 versus the three
  Hard-support roles at 500 px/s and response 12. The added closing velocity
  also produces harder legal puck impacts through the existing collision
  physics.
- Added a compact orange downward chevron over the current striker. It makes
  the threat readable as roles move between rivals without restoring any
  surrounding pusher glow.
- Crazy diagnostics now expose each squad member's `aggressive`, `maxSpeed`,
  and `response` values. Pure tests require exactly the striker to receive the
  overdrive profile; browser coverage verifies exactly one marked attacker and
  deterministically proves it closes from x=1020 and sends a stationary puck
  toward the human goal within 350 ms.
- The focused 31-test Hockey suite, full 176-test unit suite, production
  build, required standalone-client smoke run, and complete deterministic
  Hockey browser journey pass. The browser reported zero page/console errors;
  the overdrive gameplay screenshot and text state were visually inspected.

#### Crazy striker corner-release follow-up (2026-07-29)

- Live Ice-field feedback exposed that the overdrive striker could make the
  intended angled corner contact but then keep driving into the puck, pinning
  it against the curved upper-right wall.
- Split corner recovery into a bank-jab and release. A slow/stationary puck
  retains the close angled contact target; once the puck reaches 120 px/s, the
  striker retreats 190 px inward and 160 px away from that wall so the rebound
  has a clear escape lane.
- The first live replay showed that target retreat alone could move the puck
  down the side rail without bringing it far enough into open ice. Corner
  contact now guarantees a bank vector of at least 520 px/s inward and 320
  px/s away from the wall. The same physical striker retains the release role
  for 0.55 seconds after contact, preventing immediate reacquisition when the
  puck crosses the formal corner-zone boundary.
- Added a pure top-corner rebound test plus a deterministic Ice-field browser
  fixture matching the reported position. It verifies the initial close jab,
  the symmetric top/bottom bank vector, a retreat target more than 190 px from
  the moving puck, and actual extraction past x=1000 from the upper-right
  corner after the rebound.
- Final verification passes: 177/177 unit tests, the complete deterministic
  Hockey browser journey with zero page/console errors, required standalone
  client smoke/state/screenshot review, production build, and diff hygiene.

## 2026-07-29

Animation, movement, and collision polish across the match and Kickfall, on
the `poc/animation-polish` and `poc/strike-collision` branches.

- Sprite animation overhaul: physics sprites are now invisible bodies with a
  display-only mirror sprite per character, unlocking squash/stretch/lean
  without touching the Matter collider. Secondary motion shipped: run plant
  dips, dash lean, stun wobble, landing squash, takeoff stretch, kick
  anticipation/contact accents; idle breathing exists but is disabled behind
  IDLE_BREATH_ENABLED after review. The chilena rotates the mirror sprite
  instead of a dedicated one.
- Run cadence is distance-driven in both games (RUN_FRAME_DISTANCE 82 match,
  KICKFALL_RUN_FRAME_DISTANCE 70 Kickfall), readable at top speed with no
  foot sliding. Kick visuals play anticipation/contact/follow-through on a
  0.32 s KICK_VISUAL_SECONDS timeline while strikes still connect instantly;
  Kickfall player and boss share the staging.
- Movement speed and force raised to 1.728x of the original base after three
  playtest rounds.
- Colliders scale with character visualScale around the feet anchor in the
  match and Kickfall, fixing balls passing through the heads of scaled-up
  characters. colliderHeadTop per character (Dad, Mum) extends headCap
  coverage over their taller foreheads; acceleration stays uniform via
  footprint-scaled move force.
- Strike capsule follows the measured boot tip: per-character kickReach and
  PLAYER_TUNING.strikeCapsuleRadius 24 replace the fixed 106/44 pole that
  reached roughly two ball-widths past the artwork.
- frameScales per character re-enlarge atlas-shrunk action frames at display
  time (Dad/Mum kicks and chilena drawing) and pull Dad's oversized jump down.
- Chilena trigger zone scales with character height; players resettle to
  kickoff partway through the goal celebration instead of freezing in their
  scoring pose.
- The browser e2e harness was hardened along the way: one-frame input settle
  in hold/touch helpers, deterministic pose checks, atomic goal/sweep
  fixtures, and touchPulse injection for kick-boost mashing.
- Verification: 181/181 unit tests and the full browser e2e suite green;
  screenshot review in output/animation-poc/. Docs updated in
  docs/CHARACTER_ANIMATION_SPIKE.md and docs/KICKFALL_SPEC.md.
