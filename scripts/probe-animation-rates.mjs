/*
 * Measures how often a character's displayed animation frame actually changes
 * in the running game (drawings per second) for idle, the run from standstill to
 * top speed, a kick and the goal celebration. Diagnostic for animation tuning.
 *   node scripts/probe-animation-rates.mjs [characterId=bob]
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const characterId = process.argv[2] ?? 'bob';
const root = new URL('..', import.meta.url).pathname;
const port = 4177;
const url = `http://127.0.0.1:${port}`;
const TICK = 1000 / 60;

const readState = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (page, ms) => page.evaluate((value) => window.advanceTime(value), ms);

const sample = async (page, seconds, onTick = null) => {
  const rows = [];
  for (let tick = 0; tick < Math.round(seconds * 60); tick += 1) {
    if (onTick) await onTick(tick);
    await advance(page, TICK);
    const state = await readState(page);
    rows.push({ frame: state.players.left.visualFrame, vx: state.players.left.vx, pose: state.players.left.pose });
  }
  return rows;
};

const changesPerSecond = (rows) => {
  let changes = 0;
  for (let index = 1; index < rows.length; index += 1) if (rows[index].frame !== rows[index - 1].frame) changes += 1;
  return changes / (rows.length / 60);
};

const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], { cwd: root, stdio: 'ignore' });
let browser;
try {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { if ((await fetch(url)).ok) break; } catch { /* warming up */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript((id) => {
    window.localStorage.setItem('skyhead-showdown.player-profile.v2', JSON.stringify({
      playerCharacterId: id,
      opponentId: id === 'joel' ? 'bob' : 'joel',
    }));
  }, characterId);
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && typeof window.advanceTime === 'function');
  for (let attempt = 0; attempt < 20 && (await readState(page)).mode === 'splash'; attempt += 1) await advance(page, 500);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.start('Match'));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(page, 3100);
  // Stop Phaser's real-time loop: only advanceTime() steps the game, so the
  // measured rates are per game second (the real loop would add extra steps).
  await page.evaluate(() => window.__SKYHEAD_GAME__.loop.sleep());
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(200);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1180);
    window.__SKYHEAD_DEBUG__.setBall({ x: 1100, y: 200 });
  });

  const idle = await sample(page, 2);
  await page.keyboard.down('d');
  // Let the game see the keydown before virtual time steps (same race the e2e suite guards).
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  const run = await sample(page, 1.2);
  await page.keyboard.up('d');
  const accel = run.slice(0, 24);
  const top = run.slice(-30);
  const speedPxPerSecond = (rows) => (rows.reduce((sum, row) => sum + Math.abs(row.vx), 0) / rows.length) * 60;

  await advance(page, 800);
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').registerGoal('left'));
  const celebrate = await sample(page, 0.8);

  const report = {
    character: characterId,
    layout: (await readState(page)).players.left.atlasLayout,
    idleDrawingsPerSecond: changesPerSecond(idle),
    idleFrames: [...new Set(idle.map((row) => row.frame))],
    runAccelerationDrawingsPerSecond: changesPerSecond(accel),
    runAccelerationSpeed: Math.round(speedPxPerSecond(accel)),
    runTopDrawingsPerSecond: changesPerSecond(top),
    runTopSpeed: Math.round(speedPxPerSecond(top)),
    runFrames: [...new Set(run.map((row) => row.frame))],
    celebrateDrawingsPerSecond: changesPerSecond(celebrate.filter((row) => row.pose === 'celebrate')),
    celebrateFrames: [...new Set(celebrate.filter((row) => row.pose === 'celebrate').map((row) => row.frame))],
  };
  console.log(JSON.stringify(report, null, 1));
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
