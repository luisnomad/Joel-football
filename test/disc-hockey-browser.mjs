import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const externalUrl = process.env.DISC_HOCKEY_TEST_URL;
const port = 4176;
const url = externalUrl ?? `http://127.0.0.1:${port}`;
const output = new URL('../output/disc-hockey/', import.meta.url).pathname;

const waitForServer = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
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
const advance = (page, milliseconds) => page.evaluate(
  (duration) => window.advanceTime(duration),
  milliseconds,
);
const clickLogical = async (page, x, y) => {
  const point = await page.locator('canvas').evaluate((canvas, logical) => {
    const rect = canvas.getBoundingClientRect();
    const horizontalOffset = Math.max(0, canvas.width - 1280) / 2;
    return {
      x: rect.left + ((logical.x + horizontalOffset) / canvas.width) * rect.width,
      y: rect.top + (logical.y / canvas.height) * rect.height,
    };
  }, { x, y });
  await page.mouse.click(point.x, point.y);
};
const capture = async (page, name) => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: `${output}${name}.png` });
};

await mkdir(output, { recursive: true });
const server = externalUrl ? null : spawn(
  'npm',
  ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);
await waitForServer();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const touchSession = await context.newCDPSession(page);
const errors = [];
page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

try {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => typeof window.render_game_to_text === 'function'
      && JSON.parse(window.render_game_to_text()).mode === 'intro',
    null,
    { timeout: 12_000 },
  );

  const initialMiniGameResources = await page.evaluate(() => (
    performance.getEntriesByType('resource').map(({ name }) => name)
      .filter((name) => /DiscHockeyScene|KickfallScene|disc-hockey\/(themes|equipment)/.test(name))
  ));
  assert.deepEqual(initialMiniGameResources, [], 'mini-game gameplay chunks must not load at boot');

  await clickLogical(page, 430, 493);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'mini-games');
  let state = await readState(page);
  assert.deepEqual(state.games.map(({ id }) => id), ['kickfall', 'discHockey']);
  await capture(page, '01-mini-games');
  await page.evaluate(async () => {
    const { playerProfileStore } = await import('/src/game/services/PlayerProfile.js');
    playerProfileStore.setLanguage('es');
    window.__SKYHEAD_GAME__.scene.getScene('MiniGames').scene.restart();
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).language === 'es');
  await page.waitForTimeout(150);
  await capture(page, '01b-mini-games-spanish');
  await page.evaluate(async () => {
    const { playerProfileStore } = await import('/src/game/services/PlayerProfile.js');
    playerProfileStore.setLanguage('en');
    window.__SKYHEAD_GAME__.scene.getScene('MiniGames').scene.restart();
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).language === 'en');
  await page.waitForTimeout(150);

  await clickLogical(page, 935, 294);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).gameId === 'discHockey');
  state = await readState(page);
  assert.equal(state.playMode, 'computer');
  assert.equal(state.themeId, 'ice');
  assert.equal(state.playerCharacterId, 'joel');
  assert.equal(state.opponentId, 'bob');
  await capture(page, '02-setup');
  await page.evaluate(async () => {
    const { playerProfileStore } = await import('/src/game/services/PlayerProfile.js');
    playerProfileStore.setLanguage('es');
    window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup').scene.restart({
      gameId: 'discHockey',
    });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).language === 'es');
  await capture(page, '02b-setup-spanish');
  await page.evaluate(async () => {
    const { playerProfileStore } = await import('/src/game/services/PlayerProfile.js');
    playerProfileStore.setLanguage('en');
    window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup').scene.restart({
      gameId: 'discHockey',
    });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).language === 'en');

  await clickLogical(page, 1070, 216);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).playMode === 'local');
  await clickLogical(page, 1070, 314);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).themeId === 'neon');
  await clickLogical(page, 640, 626);
  await page.waitForFunction(
    () => JSON.parse(window.render_game_to_text()).minigame === 'discHockey'
      && JSON.parse(window.render_game_to_text()).theme === 'neon'
      && Boolean(window.__DISC_HOCKEY_DEBUG__),
    null,
    { timeout: 10_000 },
  );
  await page.evaluate(() => window.__DISC_HOCKEY_DEBUG__.startPlaying());
  state = await readState(page);
  assert.equal(state.playMode, 'local');
  assert.equal(state.theme, 'neon');
  assert.equal(state.orientation.logicalLocked, true);
  assert.equal(state.arena.scoreboardPaddingPercent, 5);
  assert.equal(state.arena.audience.static, true);
  assert.deepEqual(state.keyboard, { playerOne: 'Arrow keys', playerTwo: 'WASD' });
  assert.equal(state.themeArtwork.texture, 'disc-hockey-arena-neon');
  assert.equal(state.themeArtwork.pusherTexture, 'disc-hockey-pusher-neon');
  assert.equal(state.themeArtwork.puckTexture, 'disc-hockey-puck-neon');
  assert.equal(state.collisionMap.id, 'neon-inner-wall-v1');
  assert.equal(state.collisionMap.visible, false);
  assert.equal(state.collisionMap.goal.visible, false);
  assert.equal(state.collisionMap.goal.requiredPuckOverlap, 0.4);
  assert.ok(state.collisionMap.contourPointCount >= 24);
  assert.deepEqual(state.match, {
    durationSeconds: 180,
    remainingSeconds: 180,
    clock: '3:00',
  });
  assert.equal(state.players.left.radius, 48.4);
  assert.equal(state.players.right.radius, 48.4);
  await capture(page, '03-neon-local');
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.touchPromptSeconds = 0;
    scene.leftPlayer = { ...scene.leftPlayer, x: 405, y: 455, vx: 0, vy: 0 };
    scene.rightPlayer = { ...scene.rightPlayer, x: 875, y: 305, vx: 0, vy: 0 };
    scene.puck = { ...scene.puck, x: 655, y: 392, vx: -120, vy: 70 };
    scene.updateVisuals();
    scene.updateHud();
  });
  await capture(page, '03b-card-source-neon');
  const firstThemeResources = await page.evaluate(() => (
    performance.getEntriesByType('resource').map(({ name }) => name)
  ));
  assert.ok(firstThemeResources.some((name) => name.includes('neon-arena-v1.webp')));
  assert.ok(firstThemeResources.some((name) => name.includes('pusher-neon-v1.webp')));
  assert.ok(firstThemeResources.some((name) => name.includes('puck-neon-v1.webp')));
  assert.ok(!firstThemeResources.some((name) => name.includes('ice-arena-v1.webp')));
  assert.ok(!firstThemeResources.some((name) => name.includes('pusher-ice-v1.webp')));
  assert.ok(!firstThemeResources.some((name) => name.includes('puck-ice-v1.webp')));

  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.puck = { ...scene.puck, x: 640, y: 150, vx: 0, vy: 0 };
    scene.updateVisuals();
  });
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { id: 101, x: 300, y: 300, radiusX: 8, radiusY: 8, force: 1 },
      { id: 202, x: 980, y: 470, radiusX: 8, radiusY: 8, force: 1 },
    ],
  });
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { id: 101, x: 1100, y: 190, radiusX: 8, radiusY: 8, force: 1 },
      { id: 202, x: 180, y: 570, radiusX: 8, radiusY: 8, force: 1 },
    ],
  });
  state = await readState(page);
  assert.deepEqual(state.activePointers.map(({ side }) => side).sort(), ['left', 'right']);
  assert.equal(state.players.left.target.x, state.arena.centerX - state.players.left.radius);
  assert.equal(state.players.right.target.x, state.arena.centerX + state.players.right.radius);
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x: 405,
      y: 383,
      vx: 0,
      vy: 0,
      target: { x: 591.6, y: 383 },
    };
    scene.rightPlayer = {
      ...scene.rightPlayer,
      x: 875,
      y: 383,
      vx: 0,
      vy: 0,
      target: { x: 688.4, y: 383 },
    };
  });
  state = await readState(page);
  const mirroredTouchStart = {
    leftX: state.players.left.x,
    rightX: state.players.right.x,
  };
  await advance(page, 100);
  state = await readState(page);
  const leftTouchTravel = state.players.left.x - mirroredTouchStart.leftX;
  const rightTouchTravel = mirroredTouchStart.rightX - state.players.right.x;
  assert.ok(
    Math.abs(leftTouchTravel - rightTouchTravel) < 2,
    `Mirrored touches must travel equally: P1 ${leftTouchTravel}, P2 ${rightTouchTravel}`,
  );
  const leftTouchSpeed = Math.hypot(state.players.left.vx, state.players.left.vy);
  const rightTouchSpeed = Math.hypot(state.players.right.vx, state.players.right.vy);
  assert.ok(
    Math.abs(leftTouchSpeed - rightTouchSpeed) < 2,
    `Both local players must use the same direct touch response: P1 ${leftTouchSpeed}, P2 ${rightTouchSpeed}`,
  );
  await advance(page, 550);
  state = await readState(page);
  assert.ok(state.players.left.x <= state.arena.centerX - state.players.left.radius);
  assert.ok(state.players.right.x >= state.arena.centerX + state.players.right.radius);
  assert.notEqual(state.players.left.pointerId, state.players.right.pointerId);
  await capture(page, '04-two-pointers-clamped');

  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { id: 101, x: 105, y: 120, radiusX: 8, radiusY: 8, force: 1 },
      { id: 202, x: 1175, y: 645, radiusX: 8, radiusY: 8, force: 1 },
    ],
  });
  state = await readState(page);
  assert.ok(Math.abs(
    state.players.left.target.wallClearance - state.players.left.radius
  ) < 1);
  assert.ok(Math.abs(
    state.players.right.target.wallClearance - state.players.right.radius
  ) < 1);
  await advance(page, 1400);
  await capture(page, '04b-invisible-wall-clamp');

  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await page.evaluate(() => {
    window.__DISC_HOCKEY_DEBUG__.setScore(4, 4);
    window.__DISC_HOCKEY_DEBUG__.setTime(180);
    window.__DISC_HOCKEY_DEBUG__.score('left');
  });
  await advance(page, 1300);
  state = await readState(page);
  assert.notEqual(state.mode, 'result', 'reaching five goals must not end a timed match');
  assert.deepEqual(state.score, { left: 5, right: 4 });
  assert.deepEqual(state.match, {
    durationSeconds: 180,
    remainingSeconds: 180,
    clock: '3:00',
  });
  await page.evaluate(() => {
    window.__DISC_HOCKEY_DEBUG__.setTime(0);
    window.__DISC_HOCKEY_DEBUG__.finishMatch();
  });
  state = await readState(page);
  assert.equal(state.mode, 'result');
  assert.deepEqual(state.score, { left: 5, right: 4 });
  assert.equal(state.winner, 'left');
  await capture(page, '05-result');

  const resultButtonBounds = await page.evaluate(() => (
    window.__SKYHEAD_GAME__.scene.getScene('DiscHockey').resultButtons
      .map(({ zone }) => {
        const bounds = zone.getBounds();
        return { left: bounds.left, right: bounds.right };
      })
  ));
  assert.ok(
    resultButtonBounds[0].right < resultButtonBounds[1].left,
    'Rematch and Prepare Match must not share a touch hit area',
  );
  await clickLogical(page, 780, 445);
  await page.waitForFunction(() => {
    const setup = JSON.parse(window.render_game_to_text());
    return setup.mode === 'minigame-setup' && setup.gameId === 'discHockey';
  });
  await clickLogical(page, 640, 626);
  await page.waitForFunction(() => (
    JSON.parse(window.render_game_to_text()).minigame === 'discHockey'
    && Boolean(window.__DISC_HOCKEY_DEBUG__)
  ));
  await page.evaluate(() => {
    window.__DISC_HOCKEY_DEBUG__.startPlaying();
    window.__DISC_HOCKEY_DEBUG__.setScore(0, 4);
    window.__DISC_HOCKEY_DEBUG__.setTime(0);
    window.__DISC_HOCKEY_DEBUG__.score('right');
    window.advanceTime(1200);
  });
  state = await readState(page);
  assert.equal(state.mode, 'result');
  assert.equal(state.winner, 'right', 'the rematch regression should exercise a human loss');
  await clickLogical(page, 500, 445);
  await page.waitForFunction(() => {
    const rematch = JSON.parse(window.render_game_to_text());
    return rematch.minigame === 'discHockey' && rematch.mode === 'countdown';
  });
  state = await readState(page);
  assert.deepEqual(state.score, { left: 0, right: 0 });
  assert.deepEqual(state.match, {
    durationSeconds: 180,
    remainingSeconds: 180,
    clock: '3:00',
  });
  assert.equal(state.playMode, 'local');
  assert.equal(state.theme, 'neon');
  await page.evaluate(() => {
    window.__DISC_HOCKEY_DEBUG__.startPlaying();
    window.__DISC_HOCKEY_DEBUG__.setScore(2, 2);
    window.__DISC_HOCKEY_DEBUG__.setTime(0);
    window.__DISC_HOCKEY_DEBUG__.finishMatch();
  });
  state = await readState(page);
  assert.equal(state.mode, 'result');
  assert.equal(state.winner, 'draw');
  await capture(page, '05b-draw-result');
  await clickLogical(page, 500, 445);
  await page.waitForFunction(() => (
    JSON.parse(window.render_game_to_text()).mode === 'countdown'
  ));
  await advance(page, 2600);
  await page.keyboard.press('Escape');
  state = await readState(page);
  assert.equal(state.mode, 'paused');
  assert.equal(state.pauseReason, 'manual');
  const pausedTime = state.match.remainingSeconds;
  await advance(page, 3000);
  state = await readState(page);
  assert.equal(state.match.remainingSeconds, pausedTime, 'the match clock must stop while paused');
  await capture(page, '06-pause');
  await page.keyboard.press('Escape');
  assert.notEqual((await readState(page)).mode, 'paused');

  await page.evaluate(() => (
    window.__SKYHEAD_GAME__.scene.getScene('DiscHockey').leaveToSetup()
  ));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).gameId === 'discHockey');
  await clickLogical(page, 800, 216);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).playMode === 'computer');
  await clickLogical(page, 800, 314);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).themeId === 'ice');
  await clickLogical(page, 640, 626);
  await page.waitForFunction(() => (
    JSON.parse(window.render_game_to_text()).minigame === 'discHockey'
    && JSON.parse(window.render_game_to_text()).theme === 'ice'
    && Boolean(window.__DISC_HOCKEY_DEBUG__)
  ));
  await page.evaluate(() => window.__DISC_HOCKEY_DEBUG__.startPlaying());
  state = await readState(page);
  assert.equal(state.theme, 'ice');
  assert.equal(state.players.right.controller, 'computer-normal');
  assert.deepEqual(state.keyboard, { playerOne: 'Arrow keys', playerTwo: null });
  assert.equal(state.themeArtwork.texture, 'disc-hockey-arena-ice');
  assert.equal(state.themeArtwork.pusherTexture, 'disc-hockey-pusher-ice');
  assert.equal(state.themeArtwork.puckTexture, 'disc-hockey-puck-ice');
  assert.equal(state.collisionMap.id, 'ice-inner-wall-v2');
  assert.deepEqual(state.collisionMap.goal, {
    left: 104,
    right: 1176,
    top: 258,
    bottom: 455,
    requiredPuckOverlap: 0.4,
    visible: false,
  });
  assert.equal(state.collisionMap.visible, false);
  assert.equal(state.collisionMap.goal.visible, false);
  const arrowStartX = state.players.left.x;
  await page.keyboard.down('ArrowRight');
  await advance(page, 360);
  await page.keyboard.up('ArrowRight');
  state = await readState(page);
  assert.ok(state.players.left.x > arrowStartX + 10, 'Player 1 should use the standard arrow keys');
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.difficulty = 'hard';
    scene.phase = 'playing';
    scene.aiThinkTimer = 0;
    scene.rightPlayer = {
      ...scene.rightPlayer,
      x: 1050,
      y: 540,
      vx: 0,
      vy: 0,
      target: null,
    };
    scene.puck = {
      ...scene.puck,
      x: 780,
      y: 540,
      vx: 0,
      vy: 0,
    };
    scene.updateVisuals();
  });
  state = await readState(page);
  assert.equal(state.players.right.controller, 'computer-hard');
  assert.equal(state.puck.speed, 0);
  assert.ok(state.puck.surface.damping < 0.1);
  await advance(page, 850);
  state = await readState(page);
  assert.ok(state.computerAi.target.x < 900, 'Hard AI should leave its goal and pursue a reachable puck');
  assert.ok(state.players.right.x < 950, 'Hard AI should aggressively close the distance');
  assert.ok(state.puck.x < 740, 'Hard AI should strike the stationary puck toward the rival half');
  assert.ok(state.puck.speed > 50, 'The struck puck should keep air-hockey momentum');
  await capture(page, '07-hard-ai-breaks-stalemate');
  await advance(page, 4350);
  await capture(page, '07-ice-computer');

  const loadedResources = await page.evaluate(() => (
    performance.getEntriesByType('resource').map(({ name }) => name)
  ));
  assert.ok(loadedResources.some((name) => name.includes('DiscHockeyScene')));
  assert.ok(loadedResources.some((name) => name.includes('ice-arena-v1.webp')));
  assert.ok(loadedResources.some((name) => name.includes('neon-arena-v1.webp')));
  assert.ok(loadedResources.some((name) => name.includes('pusher-ice-v1.webp')));
  assert.ok(loadedResources.some((name) => name.includes('pusher-neon-v1.webp')));
  assert.ok(loadedResources.some((name) => name.includes('puck-ice-v1.webp')));
  assert.ok(loadedResources.some((name) => name.includes('puck-neon-v1.webp')));
  assert.ok(!loadedResources.some((name) => name.includes('KickfallScene')));
  assert.deepEqual(errors, []);
  console.log('Disc Hockey browser flow passed.');
} catch (error) {
  console.error('Disc Hockey browser errors:', errors);
  throw error;
} finally {
  await browser.close();
  server?.kill('SIGTERM');
}
