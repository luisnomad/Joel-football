# Joel Football

An original 2D arcade-football duel built with Phaser 3, Matter physics, Vite,
and modern JavaScript modules.

## Run

```bash
npm install
npm run dev
```

Open the displayed local URL. Joel, on the left, is human-controlled; the
right-side rival uses the included heuristic provider. A fresh profile detects
the device language once; the intro switch changes the complete interface
between English and Spanish and permanently respects the player's override.

## Power Lab

The main screen opens Joel's Power Lab, which contains ten distinct powers.
Choose a power, then solve a system-selected problem to earn one charge. Every
challenge independently randomizes between two-digit addition, nontrivial
subtraction, multiplication through 12×12, and exact division using those
tables, so players cannot repeatedly choose the easiest operation. Charges
accumulate locally across refreshes.

An incorrect answer starts a persistent five-minute Lab cooldown. Only an
earned power can be equipped, and equipping a new one replaces the previous
selection. The equipped charge enhances Joel's next successful full-meter
power strike; missed kicks do not consume charges.

## Controls

- Move: A/D or Left/Right
- Directional dash: double-tap either movement direction within 280 ms
- Jump: W, Up, or Space
- Kick: X or K
- Lob: Z or I (or hold Up while pressing Kick)
- Power: V or J when the meter is full
- Boosted kick/lob: repeat either kick button during the kick animation; energy
  is spent only if the ball is hit
- Pause: P or Escape
- Restart: R
- Fullscreen: F

Touch controls appear on touch/coarse-pointer devices. Kid-friendly action
icons replace the old K/L/D/P labels and match the localized Help overlay.
The top-row buttons provide pause, restart, main menu, Help, and fullscreen, so
tablet play does not depend on a keyboard. The pause overlay also exposes
resume, restart, and menu.

The home screen's info button opens localized credits, the dedication to Joel,
and the authoritative installed version/build. Help is available from home and
live play; opening it during a match pauses safely, and Android Back closes it
before affecting the match or activity.

Settings offers persistent Easy, Normal, and Hard AI difficulty. Easy prevents
the rival from using directional dashes or boosting basic kicks; Normal and
Hard allow both.

## Fields and kickable objects

Open **Field & Ball** on the home screen to choose a persistent match setup.
The three fields are Skycourt Stadium, Neon Grid, and Sunset Beach. Object
choices include two football designs plus a party balloon, rugby ball, soda
can, and cannonball.

The football designs deliberately share the same competitive physics. The fun
objects do not: the balloon is buoyant and draggy, the rugby ball wobbles into
unpredictable bounces, the can uses a tumbling box collider, and the cannonball
is heavy, low-bouncing, and hard to lift. Object radius is respected by kicks,
power-shot sweeps, arena recovery, crossbar release, and goal detection.

## Kickfall mini-game

The home screen also opens **Kickfall**, a separately loaded four-tier arcade
course. Level 1 sends eight physical balls toward three brick gates; Level 2
adds ten balls, a 60-second clock, a catch pocket, and a kick cleat that only a
deliberate kick can clear. Balls collide and stack and must be kicked through
before the top hatch or danger line stays blocked for two seconds. The selected
player character carries into the mode;
horizontal movement, adjacent-tier direction, Jump, and Kick are the gameplay
actions.

Kickfall's playable scene is a dynamic Vite import and its backdrop, ramp,
gate, and ball art live under `public/assets/minigames/kickfall/`. Neither the
scene chunk nor those exclusive assets is requested during initial startup.
See `docs/KICKFALL_SPEC.md` for the prototype rules, future validated-layout
generator, difficulty progression, loading boundary, and acceptance criteria.

Both players can cross midfield. Before passing the defender, retreating is a
backpedal and each character keeps facing the rival goal. After passing the
defender, movement can turn the attacker back toward them; continuing toward
goal still keeps shots aimed at that goal.

Lobs adapt to the defender's distance. A nearby defender produces the bounded
maximum-height arc, clearing their head by a wide margin and forcing them to
retreat toward the projected landing point. As distance increases, the launch
trades height for horizontal speed while still targeting space beyond them.

## Verify

```bash
npm test
npm run build
npm run test:e2e
```

The browser test writes inspected state screenshots to `output/e2e/` and
exercises bilingual switching, field/object selection and persistence,
material-specific ball physics, randomized math, earning and accumulating
charges, equipping, refresh persistence, the five-minute penalty, enhanced
power use, full gameplay, and the complete touch system flow.

## Android client

The same Vite source is packaged as a Capacitor Android client. `npm run build`
remains canonical and Capacitor always syncs `dist/`; native APIs are isolated
behind `PlatformServices` instead of being imported by Phaser scenes.

```bash
npm run android:apk
npm run android:tablet
```

This produces an installable, debug-signed test APK. The Android scripts select
Java 21 automatically on macOS. Visual Studio Code also exposes the tablet command
as the **Android: Launch Tablet** task. See [docs/ANDROID.md](docs/ANDROID.md) for device
deployment, lifecycle/Back behavior, offline guarantees, release signing, and
the physical-device acceptance checklist.

## Publish through luisnomad.com

The game is built with relative asset URLs, so it can run below any static-site
path. To build it and replace the committed website copy, run:

```bash
npm run publish:website
```

This writes a self-contained build to the sibling Astro repository at
`../luisnomad.com/public/games/joel-football/`. Commit and push that generated
folder from the `luisnomad.com` repository; Astro copies `public/` unchanged and
Netlify publishes it at `/games/joel-football/`. The publish command also keeps
`/games/head-soccer/` as a tiny redirect so existing bookmarks continue to work.

The copy step is intentional. Do not commit a symlink to `dist`: Git would
store the link rather than the sibling build contents, and the target would not
exist in Netlify's isolated checkout. Set `JOEL_FOOTBALL_WEBSITE_DIR` to override
the default sibling repository path on another machine. The former
`SKYHEAD_WEBSITE_DIR` variable remains supported for compatibility.

## Audio delivery

- Menu and match music rotates through all six supplied tracks. Match-only
  audience ambience, the referee whistle, and the short ball impact use the
  supplied effects recordings. The whistle marks every countdown second and
  goal; the countdown uses two 180 ms beeps followed by one full whistle, and
  three consecutive full whistles mark the end of the match.
- Music defaults to 15%; crowd and game effects default to 20%. Both channels
  have persistent volume and mute controls in the bilingual Settings screen.
- Audio is loaded outside Phaser's blocking boot queue. After the first user
  gesture, the recordings warm progressively into a versioned browser Cache
  Storage cache. Data-saver and 2G connections cache only the immediately
  useful files.
- Full-quality sources live in `source-assets/sound`; optimized 128 kbps MP3
  tracks are generated with `npm run optimize:audio`. This requires `ffmpeg`.

## Architecture

- `src/game/scenes/`: Phaser lifecycle and match orchestration.
- `src/game/entities/`: focused Matter-backed ball, fighter, and reusable goal.
- `src/game/ai/`: pluggable provider implementations.
- `src/game/pure/`: renderer-independent rules, snapshots, prediction, intent,
  math challenges, player-profile economy, and power math.
- `src/game/content/`: data-driven characters, match customization, powers,
  physics presets, and shot modifiers.
- `src/game/i18n.js`: centralized English/Spanish interface copy.
- `src/game/input/`, `ui/`, `services/`: narrow platform adapters.
- `src/platform/`: web and Capacitor lifecycle/orientation/haptics/Back adapters.
- `public/assets/`: original generated art plus prompt/processing manifest.
- `docs/GAME_SPEC.md`: acceptance criteria captured before implementation.

An alternative opponent can be injected before the match with:

```js
game.registry.set('agentProvider', {
  id: 'my-provider',
  decide(worldSnapshot) {
    return {
      move: 0,
      jump: false,
      kick: false,
      lob: false,
      dash: false,
      dashDirection: 0,
      power: false,
      kickBoost: 0,
    };
  },
});
```

Provider errors and malformed intents fail safely to a neutral action.

Async network or LLM opponents use the buffered adapter so Phaser never waits
inside a frame. It returns the latest valid intent while a new request is in
flight, applies a request timeout, accepts an `AbortSignal`, and safely keeps
the previous intent on rejection:

```js
import { createBufferedAsyncAgentProvider } from './src/game/ai/BufferedAsyncAgentProvider.js';

game.registry.set('agentProvider', createBufferedAsyncAgentProvider({
  id: 'remote-coach',
  minIntervalMs: 300,
  requestTimeoutMs: 1000,
  async decideAsync(worldSnapshot, { signal }) {
    const response = await fetch('/api/agent-decision', {
      method: 'POST',
      body: JSON.stringify(worldSnapshot),
      headers: { 'content-type': 'application/json' },
      signal,
    });
    return response.json();
  },
}));
```
