/*
 * Production-build smoke test: serves dist/ with `vite preview`, visits every
 * scene on a tablet and a phone, fails on any page error or console error and
 * captures each scene. Guards the trimmed Phaser build (src/vendor/), whose
 * missing modules would only surface at runtime.
 *   npm run build && node scripts/smoke-production-scenes.mjs [outDir]
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const outDir = process.argv[2] ?? new URL('../output/production-scenes/', import.meta.url).pathname;
const port = Number(process.env.E2E_PORT) || 4186;
const url = `http://127.0.0.1:${port}`;
const devices = [
  { name: 'tablet', width: 1280, height: 800, compact: false },
  { name: 'phone', width: 732, height: 412, compact: true },
];
// [label, scene key to start, data, mode or scene that must become active]
const visits = [
  ['customize', 'Customize', undefined, 'Customize'],
  ['settings', 'Settings', undefined, 'Settings'],
  ['power-lab', 'PowerLab', undefined, 'PowerLab'],
  ['mini-games', 'MiniGames', undefined, 'MiniGames'],
  ['kickfall-setup', 'MiniGameSetup', { gameId: 'kickfall' }, 'MiniGameSetup'],
  ['disc-hockey-setup', 'MiniGameSetup', { gameId: 'discHockey' }, 'MiniGameSetup'],
  ['kickfall', 'MiniGameLoading', { gameId: 'kickfall', level: 1 }, 'Kickfall'],
  ['disc-hockey', 'MiniGameLoading', { gameId: 'discHockey', sceneData: {} }, 'DiscHockey'],
  ['match', 'MatchLoading', undefined, 'Match'],
];

const advance = (page, ms) => page.evaluate((value) => window.advanceTime(value), ms);
const activeScenes = (page) => page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScenes(true).map((scene) => scene.sys.settings.key));

await mkdir(outDir, { recursive: true });
const configArgs = process.env.SMOKE_VITE_CONFIG ? ['--config', process.env.SMOKE_VITE_CONFIG] : [];
const server = spawn('npx', ['vite', 'preview', ...configArgs, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: 'ignore' });
let browser;
const problems = [];
try {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { if ((await fetch(url)).ok) break; } catch { /* warming up */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ headless: true });
  for (const device of devices) {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      screen: { width: device.width, height: device.height },
      hasTouch: true,
      isMobile: device.compact,
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => problems.push(`${device.name}: page error ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`${device.name}: console error ${message.text()}`);
    });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && typeof window.advanceTime === 'function');
    for (let attempt = 0; attempt < 20 && JSON.parse(await page.evaluate(() => window.render_game_to_text())).mode === 'splash'; attempt += 1) {
      await advance(page, 500);
    }
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
    await page.screenshot({ path: `${outDir}/${device.name}-intro.png` });
    for (const [label, key, data, expected] of visits) {
      await page.evaluate(([sceneKey, sceneData]) => {
        const game = window.__SKYHEAD_GAME__;
        for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.sys.settings.key);
        game.scene.start(sceneKey, sceneData);
      }, [key, data]);
      try {
        await page.waitForFunction((sceneKey) => window.__SKYHEAD_GAME__.scene.isActive(sceneKey), expected, { timeout: 30000 });
      } catch {
        problems.push(`${device.name}: ${label} never reached ${expected} (active: ${(await activeScenes(page)).join(', ')})`);
        continue;
      }
      await advance(page, 1200);
      await page.screenshot({ path: `${outDir}/${device.name}-${label}.png` });
      console.log(device.name, label, 'ok', (await activeScenes(page)).join(','));
    }
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log('production scene smoke: all scenes rendered without errors');
