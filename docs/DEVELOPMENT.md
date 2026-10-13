# Development reference

Optional reading for architecture, opponent providers, or audio processing. Read external/global references only when relevant to the immediate task.

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
  tracks and encoded effects are generated with `npm run optimize:audio`. This
  requires `ffmpeg`.

## Offline web play

- `public/sw.js` (worker version 13, registered as `sw.js?v=13` by
  `src/platform/WebPlatformServices.js`; bump both together) makes one online
  visit enough to play offline. `vite build` runs
  `scripts/precache-manifest.mjs`, which writes the precache list into
  `dist/sw.js`: the shell and every hashed JS/CSS bundle are cached at install;
  every public asset the built code or `index.html` refers to (arenas, sprites,
  mini-game art, sounds) is fetched in the background after activation, and
  each page start asks the worker to resume an interrupted fill. Music tracks
  are skipped on Data Saver. Unreferenced files in `public/assets` are left out.
- Sounds go into the game's own audio cache (`AUDIO_CACHE_NAME`), so they are
  stored once; offline media range requests are answered with 206 slices.
- The build logs the precache size (about 13.5 MB in October 2026: 1.4 MB
  code, 6.8 MB art and effects, 5.2 MB music). Verify with
  `npm run test:offline:e2e`.

## Architecture

- `src/vendor/`: the trimmed Phaser engine (Canvas renderer and Matter only;
  no WebGL, Arcade physics, tilemaps, FX or Phaser sound). `vite.config.js`
  serves it as `phaser` in both dev and build. Before using another Phaser
  game object type or namespace, add it to `phaserGameObjects.js` /
  `phaserCustom.js`. Then run `npm run build` and
  `node scripts/smoke-production-scenes.mjs`.

- `src/game/scenes/`: Phaser lifecycle and match orchestration.
- `src/game/entities/`: focused Matter-backed ball, fighter, and reusable goal.
- `src/game/ai/`: pluggable provider implementations.
- `src/game/pure/`: renderer-independent rules, snapshots, prediction, intent,
  shared impulse/pressure mechanics, math challenges, player-profile economy,
  and power math.
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
