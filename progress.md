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
