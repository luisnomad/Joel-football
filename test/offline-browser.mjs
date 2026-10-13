/*
 * Offline after one visit (production build). Serves dist/ with `vite preview`,
 * visits once online WITHOUT any gesture (so the in-page audio warm-up never
 * runs), lets the service worker precache, then goes offline and checks that:
 *   - a reload boots to the main menu,
 *   - every arena background, Football, Kickfall and Disc Hockey load,
 *   - every game sound is available (and a music track plays via a range request),
 *   - no same-origin request fails.
 *   npm run build && E2E_PORT=4402 node test/offline-browser.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const port = Number(process.env.E2E_PORT) || 4402;
const url = `http://127.0.0.1:${port}/`;
const output = new URL('../output/offline/', import.meta.url).pathname;

if (!existsSync(`${root}dist/index.html`)) {
  console.error('dist/ is missing: run `npm run build` first.');
  process.exit(1);
}

const arcadeAudioSource = await readFile(`${root}src/game/services/ArcadeAudio.js`, 'utf8');
const namedSoundCount = (arcadeAudioSource.match(/soundUrl\('[^']+\.mp3'\)/g) ?? []).length;

const readState = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (page, ms) => page.evaluate((value) => window.advanceTime(value), ms);
const startScene = (page, key, data) => page.evaluate(([sceneKey, sceneData]) => {
  const game = window.__SKYHEAD_GAME__;
  for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.sys.settings.key);
  game.scene.start(sceneKey, sceneData);
}, [key, data]);
const waitForScene = (page, key, timeout = 20_000) => page.waitForFunction(
  (sceneKey) => window.__SKYHEAD_GAME__?.scene.isActive(sceneKey),
  key,
  { timeout },
);
const waitForIntro = async (page) => {
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && typeof window.advanceTime === 'function', null, { timeout: 25_000 });
  for (let attempt = 0; attempt < 30 && (await readState(page)).mode !== 'intro'; attempt += 1) {
    await advance(page, 500);
  }
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro', null, { timeout: 10_000 });
};
const cacheEntryCount = (page) => page.evaluate(async () => {
  let total = 0;
  for (const name of await caches.keys()) total += (await (await caches.open(name)).keys()).length;
  return total;
});

await mkdir(output, { recursive: true });
const server = spawn(
  process.execPath,
  [`${root}node_modules/vite/bin/vite.js`, 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: 'ignore' },
);
let browser;
try {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { if ((await fetch(url)).ok) break; } catch { /* warming up */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    screen: { width: 1280, height: 800 },
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];
  let offline = false;
  page.on('pageerror', (error) => errors.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('requestfailed', (request) => {
    if (offline && request.url().startsWith(url)) failedRequests.push(`${request.url()} ${request.failure()?.errorText ?? ''}`);
  });

  // One online visit, no gesture, no other scene visited.
  await page.goto(url, { waitUntil: 'load' });
  await waitForIntro(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 15_000 })
    .catch(() => {});
  // Wait until the caches stop growing (or 90 s pass).
  let lastCount = -1;
  let stableSince = Date.now();
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const count = await cacheEntryCount(page);
    if (count !== lastCount) {
      lastCount = count;
      stableSince = Date.now();
    } else if (Date.now() - stableSince > 3_000) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const cacheSummary = await page.evaluate(async () => {
    const summary = {};
    for (const name of await caches.keys()) summary[name] = (await (await caches.open(name)).keys()).length;
    return summary;
  });
  console.log('caches after one online visit:', JSON.stringify(cacheSummary));

  await context.setOffline(true);
  offline = true;
  await page.reload({ waitUntil: 'domcontentloaded' }).catch((error) => errors.push(`offline reload: ${error.message}`));
  await waitForIntro(page).catch((error) => {
    throw new Error(`offline reload did not boot: ${error.message}\nerrors: ${errors.join('\n')}\nfailed: ${failedRequests.join('\n')}`);
  });
  await page.screenshot({ path: `${output}offline-intro.png` });

  // Arena backgrounds: the setup screen loads every theme.
  await startScene(page, 'Customize');
  await waitForScene(page, 'Customize');
  await page.waitForFunction(() => !window.__SKYHEAD_GAME__.scene.getScene('Customize').load.isLoading(), null, { timeout: 15_000 });
  await advance(page, 400);
  const arenaTextures = await page.evaluate(() => ['arena-skycourt', 'arena-neon', 'arena-beach']
    .map((key) => [key, window.__SKYHEAD_GAME__.textures.exists(key)]));
  assert.deepEqual(arenaTextures.filter(([, loaded]) => !loaded), [], `arena backgrounds missing offline: ${JSON.stringify(arenaTextures)}`);
  await page.screenshot({ path: `${output}offline-customize.png` });

  // A football match plays offline.
  await startScene(page, 'MatchLoading');
  await waitForScene(page, 'Match');
  for (let step = 0; step < 10; step += 1) await advance(page, 500);
  const match = await readState(page);
  assert.equal(match.mode, 'playing', `match did not run offline: ${match.mode}`);
  await page.screenshot({ path: `${output}offline-match.png` });

  // Both mini-games (lazy chunks + art) load offline.
  for (const [gameId, sceneKey] of [['kickfall', 'Kickfall'], ['discHockey', 'DiscHockey']]) {
    await startScene(page, 'MiniGameLoading', gameId === 'kickfall' ? { gameId, level: 1 } : { gameId, sceneData: {} });
    await waitForScene(page, sceneKey, 30_000);
    await advance(page, 1200);
    await page.screenshot({ path: `${output}offline-${gameId}.png` });
  }
  const missingTextures = await page.evaluate(() => {
    const game = window.__SKYHEAD_GAME__;
    const scene = game.scene.getScenes(true).at(-1);
    return scene.children.list
      .filter((child) => child.texture?.key === '__MISSING')
      .map((child) => child.name || child.type);
  });
  assert.deepEqual(missingTextures, [], 'mini-game drew missing-texture placeholders offline');

  // Every game sound, without the in-page audio warm-up having run online.
  const audio = await page.evaluate(async () => {
    const diagnostics = window.__SKYHEAD_AUDIO_DEBUG__.diagnostics();
    const cached = await window.__SKYHEAD_AUDIO_DEBUG__.warmAll();
    return { cached, trackCount: diagnostics.trackCount ?? diagnostics.music?.trackCount };
  });
  const expectedSounds = namedSoundCount + 6;
  assert.equal(audio.cached, expectedSounds, `only ${audio.cached}/${expectedSounds} sounds available offline`);
  const mediaPlayback = await page.evaluate(() => new Promise((resolve) => {
    const media = new Audio('./assets/sound/track2.mp3');
    media.preload = 'auto';
    const timer = setTimeout(() => resolve('timeout'), 10_000);
    media.addEventListener('canplay', () => { clearTimeout(timer); resolve(`canplay ${Math.round(media.duration)}s`); }, { once: true });
    media.addEventListener('error', () => { clearTimeout(timer); resolve(`error ${media.error?.code}`); }, { once: true });
    media.load();
  }));
  assert.match(mediaPlayback, /^canplay \d+s$/, `music element could not load offline: ${mediaPlayback}`);

  assert.deepEqual(failedRequests, [], 'same-origin requests failed offline');
  assert.deepEqual(errors.filter((error) => !/Failed to load resource/.test(error)), [], 'page errors offline');
  console.log(`Offline after one visit passed: ${JSON.stringify(arenaTextures)}; ${audio.cached} sounds; ${mediaPlayback}.`);
  await context.close();
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
