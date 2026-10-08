/*
 * Captures the screens touched by the audit batch on a tablet and two phones:
 * menus, setup screens, the match HUD (ball grounded and high), Kickfall and
 * Disc Hockey setup, and the Power Lab (lab, challenge, wrong answer).
 *   node scripts/capture-audit-screens.mjs <outDir> [screen,screen...]
 * Uses port E2E_PORT (default 4184).
 */
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const outDir = process.argv[2] ?? new URL('../output/audit-batch-1/after/', import.meta.url).pathname;
const only = process.argv[3] ? new Set(process.argv[3].split(',')) : null;
const port = Number(process.env.E2E_PORT) || 4184;
const url = `http://127.0.0.1:${port}`;
const devices = [
  { name: 'tablet', width: 1280, height: 800, compact: false },
  { name: 'phone', width: 732, height: 412, compact: true },
  { name: 'pixel', width: 924, height: 412, compact: true },
];

const readState = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (page, ms) => page.evaluate((value) => window.advanceTime(value), ms);
const settle = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const startScene = async (page, key, data = {}) => {
  await page.evaluate(({ sceneKey, sceneData }) => {
    const game = window.__SKYHEAD_GAME__;
    game.scene.getScenes(true).forEach((scene) => { if (scene.scene.key !== sceneKey) game.scene.stop(scene.scene.key); });
    game.scene.start(sceneKey, sceneData);
  }, { sceneKey: key, sceneData: data });
};
const waitMode = (page, modes) => page.waitForFunction(
  (list) => list.includes(JSON.parse(window.render_game_to_text()).mode),
  modes,
  { timeout: 20000 },
);

const screens = {
  intro: async (page) => { await startScene(page, 'Intro'); await page.waitForTimeout(700); },
  'football-setup': async (page) => { await startScene(page, 'Customize'); await page.waitForTimeout(700); },
  'mini-games': async (page) => { await startScene(page, 'MiniGames'); await page.waitForTimeout(900); },
  'mini-games-hockey': async (page) => { await startScene(page, 'MiniGames', { tab: 'discHockey' }); await page.waitForTimeout(900); },
  'intro-mini-games': async (page) => { await startScene(page, 'Intro', { tab: 'miniGames', gameId: 'discHockey' }); await page.waitForTimeout(900); },
  'kickfall-setup': async (page) => {
    await startScene(page, 'MiniGameSetup', { gameId: 'kickfall' });
    await page.waitForTimeout(1200);
  },
  // Seed progress with AUDIT_SEED_KICKFALL=1 so the level select has stars and locks.
  'kickfall-levels': async (page) => {
    await startScene(page, 'MiniGameSetup', { gameId: 'kickfall', tab: 'setup' });
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outDir}/${page.deviceName}-kickfall-levels-button.png` });
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup').openLevelSelect());
    await page.waitForTimeout(400);
  },
  'disc-hockey-setup': async (page) => {
    await startScene(page, 'MiniGameSetup', { gameId: 'discHockey' });
    await page.waitForTimeout(1500);
  },
  'kickfall-play': async (page) => {
    await startScene(page, 'MiniGameLoading', { gameId: 'kickfall', level: 1 });
    await page.waitForFunction(() => Boolean(window.__KICKFALL_DEBUG__), null, { timeout: 12000 });
    await advance(page, 3100);
    await advance(page, 1200);
    // Let the real-time camera flash of the level start finish before the shot.
    await page.waitForTimeout(900);
  },
  // Easy "follow the ball" assist: needs AUDIT_SEED_KICKFALL=1 (seeds Easy).
  'kickfall-assist': async (page) => {
    await startScene(page, 'MiniGameLoading', { gameId: 'kickfall', level: 1 });
    await page.waitForFunction(() => Boolean(window.__KICKFALL_DEBUG__), null, { timeout: 12000 });
    await page.evaluate(() => window.__SKYHEAD_GAME__.loop.sleep());
    await advance(page, 3100);
    await advance(page, 2600);
    const state = await readState(page);
    console.log(page.deviceName, 'difficulty', state.difficulty, 'followAssist', JSON.stringify(state.player?.followAssist));
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall')?.cameras.main.resetFX());
    await advance(page, 17);
  },
  'disc-hockey-play': async (page) => {
    await startScene(page, 'MiniGameLoading', { gameId: 'discHockey', sceneData: { mode: 'computer', themeId: 'ice' } });
    await page.waitForFunction(() => Boolean(window.__DISC_HOCKEY_DEBUG__), null, { timeout: 12000 });
    await page.evaluate(() => window.__DISC_HOCKEY_DEBUG__.startPlaying());
    await advance(page, 300);
    await page.waitForTimeout(900);
  },
  'match-hud': async (page) => {
    await startScene(page, 'MatchLoading');
    await waitMode(page, ['countdown', 'playing']);
    await advance(page, 3100);
    // Only deterministic steps from here (the real loop would let the AI run on).
    await page.evaluate(() => window.__SKYHEAD_GAME__.loop.sleep());
    await page.evaluate(() => {
      window.__SKYHEAD_DEBUG__.resumePlay();
      window.__SKYHEAD_DEBUG__.setHumanMeter(100);
      window.__SKYHEAD_DEBUG__.setOpponentPosition(1100);
      window.__SKYHEAD_DEBUG__.stunOpponent(8);
      window.__SKYHEAD_DEBUG__.setBall({ x: 560, y: 600 });
    });
    await advance(page, 900);
    // Camera effects (the kickoff flash) tick on Phaser's real-time loop, which is
    // paused for deterministic captures: clear them so the frame is not washed out.
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').cameras.main.resetFX());
    await advance(page, 17);
  },
  'match-ball-high': async (page) => {
    await page.evaluate(() => window.__SKYHEAD_DEBUG__.setBall({ x: 560, y: 380, vx: 0, vy: 0 }));
    await advance(page, 17);
  },
  'match-frozen-shield': async (page) => {
    await page.evaluate(() => {
      const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
      window.__SKYHEAD_DEBUG__.setBall({ x: 640, y: 300, vx: 0, vy: 0 });
      window.__SKYHEAD_DEBUG__.setHumanPosition(480);
      window.__SKYHEAD_DEBUG__.setOpponentPosition(860);
      match.rightPlayer.applyFreeze(0, 5);
      match.leftPlayer.grantShield(5);
    });
    await advance(page, 300);
  },
  'match-hyper': async (page) => {
    await page.evaluate(() => {
      const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
      match.leftPlayer.shieldTimer = 0;
      match.leftPlayer.activateHyper(5);
    });
    await advance(page, 120);
  },
  'match-big-guy-pop': async (page) => {
    await page.evaluate(() => {
      const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
      match.leftPlayer.hyperTimer = 0;
      match.leftPlayer.activateBigGuy();
    });
    await advance(page, 120);
  },
  'match-big-guy': async (page) => { await advance(page, 900); },
  'power-lab': async (page) => {
    await page.evaluate(() => window.__SKYHEAD_GAME__.loop.wake());
    await startScene(page, 'PowerLab');
    await page.waitForTimeout(800);
  },
  'power-lab-challenge': async (page) => {
    await page.evaluate(() => {
      const scene = window.__SKYHEAD_GAME__.scene.getScenes(true).find((item) => typeof item.openChallenge === 'function');
      scene?.openChallenge();
    });
    await page.waitForTimeout(400);
  },
  // Third right answer in a row: the reward burst with the streak bonus, mid-flight.
  'power-lab-reward': async (page) => {
    await startScene(page, 'PowerLab');
    await page.waitForTimeout(700);
    await page.evaluate(() => window.__SKYHEAD_LAB_DEBUG__.openChallenge());
    for (let answer = 0; answer < 3; answer += 1) {
      await page.evaluate(() => {
        const scene = window.__SKYHEAD_GAME__.scene.getScenes(true).find((item) => typeof item.answerChallenge === 'function');
        if (!scene.challenge) scene.openChallenge?.();
        if (!scene.challenge) return;
        scene.answerChallenge(scene.challenge.problem.answer);
      });
      if (answer < 2) {
        await page.evaluate(() => {
          const scene = window.__SKYHEAD_GAME__.scene.getScenes(true).find((item) => typeof item.answerChallenge === 'function');
          if (typeof scene.closeChallenge === 'function') scene.closeChallenge();
          else scene.nextChallenge?.();
        });
        await page.waitForTimeout(500);
        await page.evaluate(() => {
          const scene = window.__SKYHEAD_GAME__.scene.getScenes(true).find((item) => typeof item.answerChallenge === 'function');
          if (!scene.challenge) scene.openChallenge?.();
        });
        await page.waitForTimeout(300);
      }
    }
    await page.waitForTimeout(650);
  },
  'power-lab-wrong': async (page) => {
    await page.evaluate(() => {
      const scene = window.__SKYHEAD_GAME__.scene.getScenes(true).find((item) => typeof item.answerChallenge === 'function');
      if (!scene?.challenge) return;
      const { problem, choices } = scene.challenge;
      scene.answerChallenge(choices.find((choice) => choice !== problem.answer));
    });
    await page.waitForTimeout(400);
  },
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
    if (process.env.AUDIT_SEED_KICKFALL) {
      await context.addInitScript(() => {
        window.localStorage.setItem('skyhead-showdown.player-profile.v2', JSON.stringify({
          kickfall: { highestUnlockedLevel: 7, lastPlayedLevel: 6, stars: { 1: 3, 2: 3, 3: 2, 4: 1, 5: 3, 6: 2 } },
          difficultyByGame: { kickfall: 'easy' },
        }));
      });
    }
    const page = await context.newPage();
    page.deviceName = device.name;
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && typeof window.advanceTime === 'function');
    for (let attempt = 0; attempt < 20 && (await readState(page)).mode === 'splash'; attempt += 1) await advance(page, 500);
    await waitMode(page, ['intro']);
    for (const [name, run] of Object.entries(screens)) {
      if (only && !only.has(name)) continue;
      await run(page);
      await settle(page);
      await page.screenshot({ path: `${outDir}/${device.name}-${name}.png` });
    }
    if (errors.length) console.log(device.name, 'page errors:', errors.join(' | '));
    await context.close();
  }
  console.log('captured', outDir);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
