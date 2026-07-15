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
