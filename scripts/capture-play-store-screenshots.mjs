import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('..', import.meta.url));
const resources = fileURLToPath(new URL('../Play Store Resources/', import.meta.url));
const port = 4188;
const url = `http://127.0.0.1:${port}`;

const localizations = [
  { directory: 'en-US', locale: 'en-US', language: 'en' },
  { directory: 'es-ES', locale: 'es-ES', language: 'es' },
];

const devices = [
  {
    directory: 'phone',
    viewport: { width: 960, height: 540 },
    deviceScaleFactor: 2,
    isMobile: true,
    compact: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Mobile Safari/537.36',
  },
  {
    directory: 'tablet',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1.5,
    isMobile: false,
    compact: false,
  },
];

const waitForServer = async () => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite did not become ready at ${url}`);
};

const readState = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const waitForMode = (page, mode) => page.waitForFunction(
  (expected) => JSON.parse(window.render_game_to_text()).mode === expected,
  mode,
);
const startScene = (page, key, data = {}) => page.evaluate(({ sceneKey, sceneData }) => {
  const active = window.__SKYHEAD_GAME__.scene.getScenes(true).at(-1);
  active.scene.start(sceneKey, sceneData);
}, { sceneKey: key, sceneData: data });
const advance = (page, milliseconds) => page.evaluate(
  (duration) => window.advanceTime(duration),
  milliseconds,
);
const capture = async (page, path) => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.screenshot({ path });
};

const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let browser;
const manifest = [];
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  for (const localization of localizations) {
    for (const device of devices) {
      const output = `${resources}${localization.directory}/${device.directory}/`;
      await mkdir(output, { recursive: true });
      const context = await browser.newContext({
        viewport: device.viewport,
        screen: device.viewport,
        deviceScaleFactor: device.deviceScaleFactor,
        hasTouch: true,
        isMobile: device.isMobile,
        locale: localization.locale,
        ...(device.userAgent ? { userAgent: device.userAgent } : {}),
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`);
      });

      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await waitForMode(page, 'splash');
      await advance(page, 3000);
      await waitForMode(page, 'intro');
      await page.waitForFunction(() => !document.getElementById('startup-splash'));
      let state = await readState(page);
      assert.equal(state.language, localization.language);
      assert.equal(Boolean(state.compactPhoneUi), device.compact);

      await startScene(page, 'Customize');
      await waitForMode(page, 'football-setup');
      await capture(page, `${output}04-build-your-match.png`);

      if (device.compact) {
        await startScene(page, 'Intro', { tab: 'miniGames' });
        await waitForMode(page, 'intro');
      } else {
        await startScene(page, 'MiniGames');
        await waitForMode(page, 'mini-games');
      }
      await capture(page, `${output}05-choose-a-mini-game.png`);

      await startScene(page, 'MatchLoading');
      await page.waitForFunction(() => Boolean(window.__SKYHEAD_DEBUG__), null, { timeout: 12_000 });
      await advance(page, 3100);
      await page.evaluate(() => {
        window.__SKYHEAD_DEBUG__.resumePlay();
        window.__SKYHEAD_DEBUG__.setIncomingPower({
          owner: 'left', x: 650, y: 285, vx: 12, vy: -1.5,
        });
      });
      await advance(page, 80);
      await capture(page, `${output}01-football-action.png`);

      await startScene(page, 'MiniGameLoading', { gameId: 'kickfall', level: 1 });
      await page.waitForFunction(() => Boolean(window.__KICKFALL_DEBUG__), null, { timeout: 12_000 });
      await page.evaluate(() => {
        window.__KICKFALL_DEBUG__.startPlaying();
        window.__KICKFALL_DEBUG__.prepareFlowBall('top');
      });
      await advance(page, 350);
      await capture(page, `${output}02-kickfall-action.png`);

      await startScene(page, 'MiniGameLoading', {
        gameId: 'discHockey',
        sceneData: { mode: 'computer', themeId: 'ice' },
      });
      await page.waitForFunction(() => Boolean(window.__DISC_HOCKEY_DEBUG__), null, { timeout: 12_000 });
      await page.evaluate(() => {
        window.__DISC_HOCKEY_DEBUG__.startPlaying();
        window.__DISC_HOCKEY_DEBUG__.setScore(2, 1);
        window.__DISC_HOCKEY_DEBUG__.setTime(97);
        window.__DISC_HOCKEY_DEBUG__.setPuck({ x: 650, y: 350, vx: 9, vy: -3 });
      });
      await advance(page, 120);
      await capture(page, `${output}03-disc-hockey-action.png`);

      assert.deepEqual(errors, [], `${localization.directory}/${device.directory} errors:\n${errors.join('\n')}`);
      manifest.push({
        locale: localization.directory,
        device: device.directory,
        width: device.viewport.width * device.deviceScaleFactor,
        height: device.viewport.height * device.deviceScaleFactor,
        screenshots: [
          '01-football-action.png',
          '02-kickfall-action.png',
          '03-disc-hockey-action.png',
          '04-build-your-match.png',
          '05-choose-a-mini-game.png',
        ],
      });
      await context.close();
    }
  }

  await writeFile(
    `${resources}screenshots-manifest.json`,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  console.log('Play Store screenshot capture passed for English/Spanish phone and tablet listings.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
