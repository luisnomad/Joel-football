/*
 * Films the reactive goal net: a shot into the right goal (the ball carries
 * into the net and settles) and a crossbar hit (ripple + frame shudder), on
 * tablet, long tablet and phones. For visual review.
 *   node scripts/capture-goal-net.mjs [outDir=output/goal-net-review]
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const outDir = process.argv[2] ?? new URL('../output/goal-net-review/', import.meta.url).pathname;
const port = 4182;
const url = `http://127.0.0.1:${port}`;
const devices = [
  { name: 'tablet', width: 1280, height: 800, compact: false },
  { name: 'long-tablet', width: 1920, height: 800, compact: false },
  { name: 'phone', width: 732, height: 412, compact: true },
  { name: 'pixel', width: 924, height: 412, compact: true },
];
const TICK = 1000 / 60;

const readState = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (page, ms) => page.evaluate((value) => window.advanceTime(value), ms);
const ticks = async (page, count) => { for (let i = 0; i < count; i += 1) await advance(page, TICK); };
const shot = async (page, path) => {
  // Camera flash/shake advance on Phaser's real loop, which is asleep here;
  // clear them so a frozen goal flash does not white out the frame.
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match')?.cameras.main.resetFX());
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
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.start('Match'));
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
    await advance(page, 3100);
    await page.evaluate(() => window.__SKYHEAD_GAME__.loop.sleep());

    // Crossbar hit on the left goal: ripple + shudder.
    await page.evaluate(() => {
      window.__SKYHEAD_DEBUG__.resumePlay();
      window.__SKYHEAD_DEBUG__.setHumanPosition(400);
      window.__SKYHEAD_DEBUG__.setOpponentPosition(900);
      window.__SKYHEAD_DEBUG__.stunOpponent(4);
      window.__SKYHEAD_DEBUG__.setBall({ x: 240, y: 300, vx: -14, vy: 9 });
    });
    for (let frame = 0; frame < 4; frame += 1) {
      await ticks(page, 4);
      await shot(page, `${outDir}/${device.name}-crossbar-${frame}.png`);
    }
    const crossbar = await readState(page);
    console.log(device.name, 'crossbar', JSON.stringify(crossbar.goalNets.left));

    // Goal into the right goal: the ball carries into the net and settles.
    await page.evaluate(() => {
      window.__SKYHEAD_DEBUG__.resumePlay();
      window.__SKYHEAD_DEBUG__.setHumanPosition(400);
      window.__SKYHEAD_DEBUG__.setOpponentPosition(700);
      window.__SKYHEAD_DEBUG__.stunOpponent(4);
      window.__SKYHEAD_DEBUG__.setBall({ x: 1080, y: 520, vx: 22, vy: -2 });
    });
    for (let frame = 0; frame < 6; frame += 1) {
      await ticks(page, frame < 3 ? 4 : 12);
      await shot(page, `${outDir}/${device.name}-goal-${frame}.png`);
    }
    const goal = await readState(page);
    console.log(device.name, 'goal', goal.mode, goal.score.left, JSON.stringify(goal.goalNets.right), JSON.stringify({ x: goal.ball.x, y: goal.ball.y }));
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
