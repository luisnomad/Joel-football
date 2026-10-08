/*
 * Captures Kickfall's gate-break combo banner and the star result screen on a
 * tablet and a phone. For visual review.
 *   node scripts/capture-kickfall-rating.mjs [outDir=output/kickfall-rating-review]
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const outDir = process.argv[2] ?? new URL('../output/kickfall-rating-review/', import.meta.url).pathname;
const port = 4183;
const url = `http://127.0.0.1:${port}`;
const devices = [
  { name: 'tablet', width: 1280, height: 800, compact: false },
  { name: 'phone', width: 732, height: 412, compact: true },
];

const readState = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (page, ms) => page.evaluate((value) => window.advanceTime(value), ms);
const shot = async (page, path) => {
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall')?.cameras.main.resetFX());
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path });
};

await mkdir(outDir, { recursive: true });
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], { cwd: root, stdio: 'ignore' });
let browser;
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
    });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && typeof window.advanceTime === 'function');
    for (let attempt = 0; attempt < 20 && (await readState(page)).mode === 'splash'; attempt += 1) await advance(page, 500);
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.start('MiniGameLoading', { gameId: 'kickfall', level: 1 }));
    await page.waitForFunction(() => Boolean(window.__KICKFALL_DEBUG__), null, { timeout: 30000 });
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown', null, { timeout: 30000 });
    await page.evaluate(() => window.__KICKFALL_DEBUG__.startPlaying());
    await advance(page, 300);
    // Two gate breaks in quick succession: the second one is a COMBO x2.
    await page.evaluate(() => {
      const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
      scene.breakGate(scene.gates[0]);
    });
    await advance(page, 400);
    await page.evaluate(() => {
      const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
      scene.breakGate(scene.gates[1]);
    });
    await advance(page, 120);
    await shot(page, `${outDir}/${device.name}-1-combo.png`);
    console.log(device.name, 'rating', JSON.stringify((await readState(page)).rating));
    await page.evaluate(() => window.__KICKFALL_DEBUG__.forceVictory());
    await advance(page, 200);
    await shot(page, `${outDir}/${device.name}-2-result-stars.png`);
    console.log(device.name, 'result', JSON.stringify((await readState(page)).rating));
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
