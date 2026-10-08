/*
 * Review captures for installed roster-v2 characters: each listed character vs
 * Bob at kickoff on tablet and phone, its chilena at the moment of boot contact,
 * the Power Lab with painted icons, and the goal frame close-up.
 *   node scripts/capture-roster-integration.mjs [outDir] [ids=joel,luna,lucia]
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const outDir = process.argv[2] ?? new URL('../output/integration-roster3/', import.meta.url).pathname;
const ids = (process.argv[3] ?? 'joel,luna,lucia').split(',');
const port = 4202;
const url = `http://127.0.0.1:${port}`;
const devices = [
  { name: 'tablet', width: 1280, height: 800, compact: false },
  { name: 'phone', width: 732, height: 412, compact: true },
];

const readState = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (page, ms) => page.evaluate((value) => window.advanceTime(value), ms);
const shot = async (page, path, clip) => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path, ...(clip ? { clip } : {}) });
};

const openMatch = async (browser, device, playerId, ballTypeId = 'classic') => {
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    screen: { width: device.width, height: device.height },
    hasTouch: true,
    isMobile: device.compact,
  });
  await context.addInitScript(({ id, ball }) => {
    window.localStorage.setItem('skyhead-showdown.player-profile.v2', JSON.stringify({
      playerCharacterId: id,
      opponentId: id === 'bob' ? 'joel' : 'bob',
      ballTypeId: ball,
      equippedPowerId: 'fireball',
      powers: { fireball: 2, ice: 0, big: 0, shield: 0, hyper: 0 },
    }));
  }, { id: playerId, ball: ballTypeId });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && typeof window.advanceTime === 'function');
  for (let attempt = 0; attempt < 20 && (await readState(page)).mode === 'splash'; attempt += 1) await advance(page, 500);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  return { context, page };
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
    for (const id of ids) {
      const { context, page } = await openMatch(browser, device, id);
      await page.evaluate(() => window.__SKYHEAD_GAME__.scene.start('Match'));
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
      await advance(page, 3100);
      await page.evaluate(() => window.__SKYHEAD_GAME__.loop.sleep());
      await page.evaluate(() => {
        window.__SKYHEAD_DEBUG__.resumePlay();
        window.__SKYHEAD_DEBUG__.setHumanPosition(520);
        window.__SKYHEAD_DEBUG__.setOpponentPosition(760);
        window.__SKYHEAD_DEBUG__.stunOpponent(6);
        window.__SKYHEAD_DEBUG__.setBall({ x: 640, y: 200 });
      });
      await advance(page, 200);
      await shot(page, `${outDir}/${device.name}-${id}-vs-bob.png`);
      // Chilena: second kick press on an overhead ball, then step to boot contact.
      await page.evaluate(() => {
        window.__SKYHEAD_DEBUG__.setHumanPosition(600);
        window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
        window.__SKYHEAD_DEBUG__.setBall({ x: 610, y: 380 });
        const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
        match.leftPlayer.kickBoostTaps = 1;
        match.handleStrikes();
      });
      let state = await readState(page);
      for (let tick = 0; tick < 40 && !state.players.left.lastChilenaContact; tick += 1) {
        await advance(page, 1000 / 60);
        state = await readState(page);
      }
      await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer.updatePose());
      await shot(page, `${outDir}/${device.name}-${id}-chilena-contact.png`);
      console.log(device.name, id, JSON.stringify({
        layout: state.players.left.atlasLayout,
        contact: state.players.left.lastChilenaContact,
        displayHeight: state.players.left.displayHeight,
      }));
      if (id === ids[0]) {
        const box = await page.evaluate(() => {
          const canvas = document.querySelector('canvas').getBoundingClientRect();
          const sx = canvas.width / 1280;
          return { x: canvas.right - 260 * sx, y: canvas.top + 330 * sx, width: 260 * sx, height: 330 * sx };
        });
        await shot(page, `${outDir}/${device.name}-goal-frame.png`, box);
      }
      await context.close();
    }
    // Every painted ball in flight (same display boxes as the old vector art).
    if (process.env.CAPTURE_BALLS !== '0') {
      for (const ball of ['classic', 'neon-ball', 'balloon', 'rugby', 'soda-can', 'cannonball']) {
        const { context: ballContext, page: ballPage } = await openMatch(browser, device, ids[0], ball);
        await ballPage.evaluate(() => window.__SKYHEAD_GAME__.scene.start('Match'));
        await ballPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
        await advance(ballPage, 3100);
        await ballPage.evaluate(() => {
          window.__SKYHEAD_DEBUG__.resumePlay();
          window.__SKYHEAD_DEBUG__.setHumanPosition(300);
          window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
          window.__SKYHEAD_DEBUG__.stunOpponent(6);
          window.__SKYHEAD_DEBUG__.setBall({ x: 640, y: 420, vx: 3, vy: -4 });
        });
        await advance(ballPage, 150);
        const ballState = (await readState(ballPage)).ball;
        const clip = await ballPage.evaluate(({ x, y }) => {
          const canvas = document.querySelector('canvas').getBoundingClientRect();
          const scale = canvas.width / 1280;
          return { x: canvas.left + (x - 120) * scale, y: canvas.top + (y - 120) * scale, width: 240 * scale, height: 240 * scale };
        }, ballState);
        await shot(ballPage, `${outDir}/${device.name}-ball-${ball}.png`, clip);
        console.log(device.name, 'ball', ball, ballState.typeId);
        await ballContext.close();
      }
      const { context: pickerContext, page: pickerPage } = await openMatch(browser, device, ids[0], 'rugby');
      await pickerPage.evaluate(() => window.__SKYHEAD_GAME__.scene.start('Customize'));
      await pickerPage.waitForTimeout(900);
      await shot(pickerPage, `${outDir}/${device.name}-ball-picker.png`);
      await pickerContext.close();
    }
    const { context, page } = await openMatch(browser, device, ids[0]);
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.start('PowerLab'));
    await page.waitForTimeout(900);
    await shot(page, `${outDir}/${device.name}-power-lab.png`);
    await context.close();
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
