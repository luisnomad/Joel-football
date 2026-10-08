/*
 * Captures the Power Lab on a tablet and a phone: the lab, an open math
 * challenge, and the state after a wrong answer. For UX review.
 *   node scripts/capture-power-lab.mjs [outDir=output/power-lab-review]
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const outDir = process.argv[2] ?? new URL('../output/power-lab-review/', import.meta.url).pathname;
const port = 4179;
const url = `http://127.0.0.1:${port}`;
const devices = [
  { name: 'tablet', width: 1280, height: 800, compact: false },
  { name: 'phone', width: 732, height: 412, compact: true },
];

const readState = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (page, ms) => page.evaluate((value) => window.advanceTime(value), ms);
const shot = async (page, path) => {
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
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.start('PowerLab'));
    await page.waitForTimeout(800);
    await shot(page, `${outDir}/${device.name}-1-lab.png`);
    const opened = await page.evaluate(() => {
      const scene = window.__SKYHEAD_GAME__.scene.getScenes(true).find((item) => typeof item.openChallenge === 'function');
      if (!scene) return null;
      scene.openChallenge();
      return scene.scene.key;
    });
    console.log(device.name, 'challenge scene', opened);
    await page.waitForTimeout(300);
    await shot(page, `${outDir}/${device.name}-2-challenge.png`);
    console.log(device.name, JSON.stringify((await readState(page)).challenge ?? (await readState(page)).mathChallenge ?? null));
    await page.evaluate(() => {
      const scene = window.__SKYHEAD_GAME__.scene.getScenes(true).find((item) => typeof item.answerChallenge === 'function');
      const { problem, choices } = scene.challenge;
      scene.answerChallenge(choices.find((choice) => choice !== problem.answer));
    });
    await page.waitForTimeout(300);
    await shot(page, `${outDir}/${device.name}-3-wrong.png`);
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
