/*
 * Captures in-game frame strips of every kind of shot (normal kick, powered
 * shot, each super shot, chilena) for visual review of the ball effects.
 *   node scripts/capture-ball-effects.mjs [outDir=output/ball-effects]
 * Writes one PNG per frame (<shot>-<n>.png) cropped around the ball.
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const outDir = process.argv[2] ?? new URL('../output/ball-effects/', import.meta.url).pathname;
const port = 4178;
const url = `http://127.0.0.1:${port}`;
const FRAMES = 10;
const FRAME_MS = 50;

const readState = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (page, ms) => page.evaluate((value) => window.advanceTime(value), ms);

/** Same direct power-press injection the e2e suite uses. */
const pressPower = (page) => page.evaluate(() => {
  const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
  match.leftPlayer.update({
    move: 0, jump: false, kick: false, lob: false, dash: false, dashDirection: 0, power: true,
  }, 1 / 60, match.rightPlayer.sprite.x);
});
const pressKick = (page) => page.evaluate(() => {
  window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer.startKick('drive');
});

const setup = (page, { meter = 12, power = null, ball = { x: 676, y: 529 } } = {}) => page.evaluate((options) => {
  window.__SKYHEAD_DEBUG__.resumePlay();
  if (options.power) window.__SKYHEAD_DEBUG__.grantEquippedPower(options.power, 1);
  window.__SKYHEAD_DEBUG__.setHumanPosition(600);
  window.__SKYHEAD_DEBUG__.setHumanMeter(options.meter);
  window.__SKYHEAD_DEBUG__.setOpponentPosition(1180);
  window.__SKYHEAD_DEBUG__.stunOpponent(4);
  window.__SKYHEAD_DEBUG__.setBall(options.ball);
}, { meter, power, ball });

const film = async (page, name) => {
  for (let index = 0; index < FRAMES; index += 1) {
    // Step real 1/60 s frames: the effects update once per rendered frame, so a
    // single 50 ms step would spawn a whole frame-batch of particles at one point.
    for (let tick = 0; tick < Math.round(FRAME_MS / (1000 / 60)); tick += 1) await advance(page, 1000 / 60);
    const state = await readState(page);
    const spin = await page.evaluate(() => {
      const ball = window.__SKYHEAD_GAME__.scene.getScene('Match').ball.body;
      return { angle: Math.round(ball.rotation * 100) / 100, angularVelocity: Math.round(ball.body.angularVelocity * 1000) / 1000 };
    });
    if (process.env.LOG_SPIN) console.log(name, index, JSON.stringify({ vx: state.ball.vx, vy: state.ball.vy, ...spin }));
    const box = await page.evaluate(({ x, y }) => {
      const canvas = document.querySelector('canvas').getBoundingClientRect();
      const sx = canvas.width / 1280;
      const sy = canvas.height / 720;
      const w = 420;
      const h = 280;
      const left = Math.min(Math.max(canvas.left + x * sx - w / 2, canvas.left), canvas.right - w);
      const top = Math.min(Math.max(canvas.top + y * sy - h / 2, canvas.top), canvas.bottom - h);
      return { x: left, y: top, width: w, height: h };
    }, state.ball);
    await page.screenshot({ path: `${outDir}/${name}-${String(index).padStart(2, '0')}.png`, clip: box });
  }
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    window.localStorage.setItem('skyhead-showdown.player-profile.v2', JSON.stringify({
      playerCharacterId: 'bob',
      opponentId: 'joel',
    }));
  });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && typeof window.advanceTime === 'function');
  for (let attempt = 0; attempt < 20 && (await readState(page)).mode === 'splash'; attempt += 1) await advance(page, 500);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.start('Match'));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(page, 3100);
  // Only the deterministic steps advance the game while filming.
  await page.evaluate(() => window.__SKYHEAD_GAME__.loop.sleep());
  console.log('renderer', await page.evaluate(() => ({ type: window.__SKYHEAD_GAME__.renderer.type, webgl: window.__SKYHEAD_GAME__.renderer.type === 2 })));

  const shots = [
    ['1-kick', async () => { await setup(page); await pressKick(page); }],
    ['2-powered', async () => { await setup(page, { meter: 100 }); await pressPower(page); }],
    ['3-fireball', async () => { await setup(page, { meter: 100, power: 'fireball' }); await pressPower(page); }],
    ['5-chilena', async () => {
      await setup(page, { ball: { x: 610, y: 380 } });
      // Second kick press on an overhead ball (deterministic with the loop paused).
      const chilena = await page.evaluate(() => {
        const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
        match.leftPlayer.kickBoostTaps = 1;
        match.handleStrikes();
        return match.leftPlayer.lastChilenaAttempt;
      });
      console.log('chilena attempt', JSON.stringify(chilena));
      await advance(page, 200);
    }],
    // Last: Big Guy keeps the shooter doubled for 10 s across round resets.
    ['4-big', async () => { await setup(page, { meter: 100, power: 'big' }); await pressPower(page); }],
  ];
  for (const [name, trigger] of shots) {
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').resetRound());
    await advance(page, 3100);
    await trigger();
    const state = await readState(page);
    console.log(name, JSON.stringify({ powerBall: state.powerBall, ball: { vx: state.ball.vx, vy: state.ball.vy } }));
    await film(page, name);
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
