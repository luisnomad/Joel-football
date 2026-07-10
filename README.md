# Joel Football

An original 2D arcade-football duel built with Phaser 3, Matter physics, Vite,
and modern JavaScript modules.

## Run

```bash
npm install
npm run dev
```

Open the displayed local URL. Joel, on the left, is human-controlled; the
right-side rival uses the included heuristic provider. The intro language
switch changes the complete interface between English and Spanish.

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
- Sprint: double-tap the same direction within 280 ms and hold the second press
- Jump: W, Up, or Space
- Kick: X or K
- Lob: Z or I (or hold Up while pressing Kick)
- Dash: C or L
- Power: V or J when the meter is full
- Boosted kick/lob: repeat either kick button during the kick animation; energy
  is spent only if the ball is hit
- Pause: P or Escape
- Restart: R
- Fullscreen: F

Touch controls appear on touch/coarse-pointer devices. The top-row buttons
provide pause, restart, main menu, and fullscreen, so tablet play does not
depend on a keyboard. The pause overlay also exposes resume, restart, and menu.

Settings offers persistent Easy, Normal, and Hard AI difficulty. Easy prevents
the rival from sprinting or boosting basic kicks; Normal and Hard allow both.

Both players can cross midfield. Before passing the defender, retreating is a
backpedal and each character keeps facing the rival goal. After passing the
defender, movement can turn the attacker back toward them; continuing toward
goal still keeps shots aimed at that goal.

## Verify

```bash
npm test
npm run build
npm run test:e2e
```

The browser test writes inspected state screenshots to `output/e2e/` and
exercises bilingual switching, randomized math, earning and accumulating
charges, equipping, refresh persistence, the five-minute penalty, enhanced
power use, full gameplay, and the complete touch system flow.

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
- `src/game/content/`: the ten data-driven superpower definitions and shot
  modifiers.
- `src/game/i18n.js`: centralized English/Spanish interface copy.
- `src/game/input/`, `ui/`, `services/`: narrow platform adapters.
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
      power: false,
      sprint: false,
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
