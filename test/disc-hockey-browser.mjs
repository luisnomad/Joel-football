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
const canvasPoint = (page, x, y) => (
  page.locator('canvas').evaluate((canvas, logical) => {
    const rect = canvas.getBoundingClientRect();
    const horizontalOffset = Math.max(0, canvas.width - 1280) / 2;
    return {
      x: rect.left + ((logical.x + horizontalOffset) / canvas.width) * rect.width,
      y: rect.top + (logical.y / canvas.height) * rect.height,
    };
  }, { x, y })
);
const clickLogical = async (page, x, y) => {
  const point = await canvasPoint(page, x, y);
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
    playerProfileStore.setOpponent('luna');
    window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup').scene.restart({
      gameId: 'discHockey',
    });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).opponentId === 'luna');
  for (let click = 0; click < 3; click += 1) {
    await clickLogical(page, 277, 300);
    await page.waitForTimeout(60);
  }
  state = await readState(page);
  assert.equal(
    state.playerCharacterId,
    'luna',
    'a Football opponent must remain selectable as the Disc Hockey player',
  );
  assert.equal(
    state.opponentId,
    'joel',
    'selecting that character should move the conflicting opponent to a valid fallback',
  );
  await capture(page, '02a-football-opponent-selectable-as-hockey-player');
  await page.evaluate(async () => {
    const { playerProfileStore } = await import('/src/game/services/PlayerProfile.js');
    playerProfileStore.setPlayerCharacter('joel');
    playerProfileStore.setOpponent('bob');
    window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup').scene.restart({
      gameId: 'discHockey',
    });
  });
  await page.waitForFunction(() => {
    const current = JSON.parse(window.render_game_to_text());
    return current.playerCharacterId === 'joel' && current.opponentId === 'bob';
  });
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

  await clickLogical(page, 935, 216);
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
  assert.deepEqual(state.antiCamping, {
    warningSeconds: 1,
    violationSeconds: 4,
    penaltySeconds: 1.25,
    boundaryHysteresis: 8,
    ejectionSeconds: 0.5,
    ejectionPushSeconds: 0.32,
    ejectionSpeed: 650,
    maximumEjectionAngleDegrees: 24,
    rightTeamSeconds: 0,
    violations: { left: 0, right: 0 },
    lastViolation: null,
  });
  const neonShotPlaysBefore = state.audio.gameEffectPlays.hockeyNeon;
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x: 560,
      y: 360,
      vx: 0,
      vy: 0,
      target: null,
      pointerId: null,
    };
    scene.puck = { ...scene.puck, x: 625, y: 360, vx: -40, vy: 0 };
  });
  await advance(page, 34);
  state = await readState(page);
  assert.equal(
    state.audio.gameEffectPlays.hockeyNeon,
    neonShotPlaysBefore + 1,
    'Neon pusher contact should use the supplied Hockey shot',
  );
  assert.ok(
    Math.abs(state.lastCollisionSound.impactSpeed - 40) < 0.1,
    `the light fixture should retain its near-40 px/s closing speed; ${JSON.stringify(state.lastCollisionSound)}`,
  );
  assert.equal(state.lastCollisionSound.volumeScale, 0.522, 'a light puck touch should stay just above the 50% volume floor');
  assert.equal(state.audio.lastGameEffectPlayback.effectId, 'hockeyNeon');
  assert.ok(
    Math.abs(
      state.audio.lastGameEffectPlayback.volumeScale
        - (0.5 + state.lastCollisionSound.impactSpeed / 900 * 0.5),
    ) < 0.0001,
    'the media element should receive the same light-impact volume scale',
  );
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.collisionSoundCooldown = 0;
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x: 560,
      y: 360,
      vx: 0,
      vy: 0,
      target: { x: 620, y: 360 },
      pointerId: 999,
    };
    scene.puck = { ...scene.puck, x: 625, y: 360, vx: 0, vy: 0 };
  });
  await advance(page, 17);
  state = await readState(page);
  assert.equal(
    state.audio.gameEffectPlays.hockeyNeon,
    neonShotPlaysBefore + 2,
    'the hard-contact fixture should trigger a second Neon shot',
  );
  assert.ok(
    state.lastCollisionSound.impactSpeed >= 900,
    `the direct strike should clear the full-volume threshold; ${JSON.stringify(state.lastCollisionSound)}`,
  );
  assert.equal(state.lastCollisionSound.volumeScale, 1, 'a fast direct pusher strike should reach 100% of the effects-channel volume');
  assert.equal(state.audio.lastGameEffectPlayback.volumeScale, 1);
  await capture(page, '03-neon-local');
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.touchPromptSeconds = 0;
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x: 405,
      y: 455,
      vx: 0,
      vy: 0,
      target: null,
      pointerId: null,
    };
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
    const x = scene.collisionMap.goalLineLeft + scene.leftPlayer.radius;
    const y = (scene.collisionMap.goalTop + scene.collisionMap.goalBottom) / 2;
    scene.pointerOwners.clear();
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x,
      y,
      vx: 900,
      vy: -120,
      target: { x, y },
      pointerId: 701,
      creaseSeconds: 0,
      penaltySeconds: 0,
    };
    scene.pointerOwners.set(701, 'left');
    scene.puck = { ...scene.puck, x: 640, y: 160, vx: 0, vy: 0 };
  });
  await advance(page, 1050);
  state = await readState(page);
  const heldCreaseSeconds = state.players.left.crease.seconds;
  assert.equal(state.players.left.crease.warning, true);

  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    const x = scene.collisionMap.goalLineLeft + scene.leftPlayer.radius;
    const y = (scene.collisionMap.goalTop + scene.collisionMap.goalBottom) / 2;
    scene.pointerOwners.clear();
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x,
      y,
      vx: 900,
      vy: -120,
      target: { x, y },
      pointerId: 702,
      creaseSeconds: 0,
      penaltySeconds: 0,
    };
    scene.pointerOwners.set(702, 'left');
    window.__DISC_HOCKEY_DEBUG__.releasePointer(702);
    scene.puck = { ...scene.puck, x: 640, y: 160, vx: 0, vy: 0 };
  });
  state = await readState(page);
  assert.equal(state.players.left.pointerId, null);
  assert.equal(state.players.left.vx, 0, 'pointer release must immediately stop residual horizontal motion');
  assert.equal(state.players.left.vy, 0, 'pointer release must immediately stop residual vertical motion');
  await advance(page, 1050);
  state = await readState(page);
  assert.equal(state.players.left.crease.warning, true);
  assert.ok(
    Math.abs(state.players.left.crease.seconds - heldCreaseSeconds) < 0.03,
    `crease timing must match while held or released; held ${heldCreaseSeconds}, released ${state.players.left.crease.seconds}`,
  );
  await capture(page, '03c0-neon-crease-released-warning');

  const creaseLipPosition = await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    const position = {
      x: scene.collisionMap.goalLineLeft + scene.leftPlayer.radius,
      y: scene.collisionMap.goalTop - scene.leftPlayer.radius / 2,
    };
    scene.pointerOwners.clear();
    scene.leftPlayer = {
      ...scene.leftPlayer,
      ...position,
      vx: 0,
      vy: 0,
      target: null,
      pointerId: null,
      creaseSeconds: 0,
      penaltySeconds: 0,
      ejectionSeconds: 0,
    };
    scene.creaseViolations.left = 0;
    scene.lastCreaseViolation = null;
    scene.puck = { ...scene.puck, x: 640, y: 160, vx: 0, vy: 0 };
    return position;
  });
  const creaseLipPoint = await canvasPoint(
    page,
    creaseLipPosition.x,
    creaseLipPosition.y,
  );
  await page.mouse.move(creaseLipPoint.x, creaseLipPoint.y);
  await page.mouse.down();
  await advance(page, 4050);
  state = await readState(page);
  assert.equal(state.antiCamping.violations.left, 1);
  assert.notEqual(state.players.left.pointerId, null, 'mouse ownership should remain held through the violation');
  await page.mouse.up();

  await page.evaluate((position) => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.pointerOwners.clear();
    scene.leftPlayer = {
      ...scene.leftPlayer,
      ...position,
      vx: 0,
      vy: 0,
      target: null,
      pointerId: null,
      creaseSeconds: 0,
      penaltySeconds: 0,
      ejectionSeconds: 0,
    };
    scene.creaseViolations.left = 0;
    scene.lastCreaseViolation = null;
    scene.puck = { ...scene.puck, x: 640, y: 160, vx: 0, vy: 0 };
  }, creaseLipPosition);
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      {
        id: 303,
        x: creaseLipPoint.x,
        y: creaseLipPoint.y,
        radiusX: 8,
        radiusY: 8,
        force: 1,
      },
    ],
  });
  await advance(page, 4050);
  state = await readState(page);
  assert.equal(state.antiCamping.violations.left, 1);
  assert.notEqual(state.players.left.pointerId, null, 'touch ownership should remain held through the violation');
  await capture(page, '03c1-neon-held-pointer-crease-ejection');
  await touchSession.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.creaseViolations.left = 0;
    scene.lastCreaseViolation = null;
  });

  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.pointerOwners.clear();
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x: scene.collisionMap.goalLineLeft + scene.leftPlayer.radius,
      y: (scene.collisionMap.goalTop + scene.collisionMap.goalBottom) / 2,
      vx: 0,
      vy: 0,
      target: null,
      pointerId: null,
      creaseSeconds: 0,
      penaltySeconds: 0,
    };
    scene.puck = { ...scene.puck, x: 640, y: 160, vx: 0, vy: 0 };
    scene.updateVisuals();
  });
  await advance(page, 1050);
  state = await readState(page);
  assert.equal(state.players.left.crease.inCrease, true);
  assert.equal(state.players.left.crease.puckThreatening, false);
  assert.equal(state.players.left.crease.warning, true);
  assert.ok(state.players.left.crease.seconds >= 1 && state.players.left.crease.seconds < 1.1);
  assert.equal(state.antiCamping.violations.left, 0, 'the warning must precede punishment');
  assert.match(
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('DiscHockey').creaseWarningTexts.left.text),
    /^MOVE!\s+3$/,
  );
  await capture(page, '03c-neon-crease-warning');
  await advance(page, 1000);
  assert.match(
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('DiscHockey').creaseWarningTexts.left.text),
    /^MOVE!\s+2$/,
  );
  await advance(page, 1000);
  assert.match(
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('DiscHockey').creaseWarningTexts.left.text),
    /^MOVE!\s+1$/,
  );

  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.puck = {
      ...scene.puck,
      x: scene.collisionMap.goalLineLeft + 200,
      y: scene.collisionMap.goalTop + 40,
      vx: 0,
      vy: 0,
    };
  });
  await advance(page, 50);
  state = await readState(page);
  assert.equal(state.players.left.crease.puckThreatening, true);
  assert.equal(state.players.left.crease.seconds, 0, 'a nearby attacking puck should immediately clear the camping timer');
  assert.equal(state.players.left.crease.warning, false, 'legitimate defense must not retain a stale warning');

  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.puck = { ...scene.puck, x: 640, y: 160, vx: 0, vy: 0 };
  });
  await advance(page, 4050);
  state = await readState(page);
  assert.equal(state.antiCamping.violations.left, 1);
  assert.equal(state.antiCamping.lastViolation.side, 'left');
  assert.ok(
    Math.abs(state.antiCamping.lastViolation.ejectionAngleDegrees) <= 24,
    'the random ejection angle must stay inside the inward safety cone',
  );
  assert.equal(state.players.left.crease.ejecting, true);
  assert.equal(state.players.left.crease.frozen, false);
  assert.ok(state.players.left.crease.ejectionVelocity.x > 0);
  assert.ok(
    state.players.left.x > state.collisionMap.goal.left + state.players.left.radius,
    'the piston should physically push a left-side camper inward',
  );
  assert.ok(state.players.left.crease.penaltySeconds > 1, 'the ejected pusher should begin a brief movement penalty');
  assert.equal(
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('DiscHockey').creaseNoticeText.text),
    'CREASE VIOLATION!',
  );
  await capture(page, '03d-neon-crease-ejection');

  await advance(page, 500);
  state = await readState(page);
  assert.equal(state.players.left.crease.ejecting, false, 'the goal piston should retract after its short stroke');
  assert.equal(state.players.left.crease.frozen, true, 'the pusher should become translucent and frozen after ejection');
  assert.ok(state.players.left.crease.penaltySeconds > 0.3);
  const frozenLeftX = state.players.left.x;
  const frozenLeftY = state.players.left.y;
  await capture(page, '03e-neon-crease-frozen');

  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.leftPlayer.pointerId = 999;
    scene.leftPlayer.target = { x: 560, y: scene.leftPlayer.y };
  });
  await advance(page, 200);
  state = await readState(page);
  assert.equal(state.players.left.x, frozenLeftX, 'the pusher must remain frozen during the penalty');
  assert.equal(state.players.left.y, frozenLeftY);
  await advance(page, 900);
  assert.ok((await readState(page)).players.left.x > frozenLeftX, 'movement should return after the short penalty expires');

  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.rightPlayer = {
      ...scene.rightPlayer,
      x: scene.collisionMap.goalLineRight - scene.rightPlayer.radius,
      y: (scene.collisionMap.goalTop + scene.collisionMap.goalBottom) / 2,
      vx: 0,
      vy: 0,
      target: null,
      pointerId: null,
      creaseSeconds: 0,
      penaltySeconds: 0,
    };
    scene.puck = { ...scene.puck, x: 640, y: 160, vx: 0, vy: 0 };
  });
  const rightCreaseStartX = await page.evaluate(
    () => window.__SKYHEAD_GAME__.scene.getScene('DiscHockey').rightPlayer.x,
  );
  await advance(page, 4050);
  state = await readState(page);
  assert.equal(state.antiCamping.violations.right, 1, 'the mirrored goal must enforce the same rule');
  assert.equal(state.players.right.crease.ejecting, true);
  assert.ok(state.players.right.crease.ejectionVelocity.x < 0);
  assert.ok(state.players.right.x < rightCreaseStartX, 'the mirrored piston must push inward from the right goal');
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.resetRound();
    scene.releaseAllPointers();
    scene.phase = 'playing';
    scene.announcementText.setText('');
  });

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
  const audioBeforeJoelGoal = (await readState(page)).audio;
  await page.evaluate(() => {
    window.__DISC_HOCKEY_DEBUG__.setScore(4, 4);
    window.__DISC_HOCKEY_DEBUG__.setTime(180);
    window.__DISC_HOCKEY_DEBUG__.score('left');
  });
  await advance(page, 1300);
  state = await readState(page);
  assert.notEqual(state.mode, 'result', 'reaching five goals must not end a timed match');
  assert.deepEqual(state.score, { left: 5, right: 4 });
  assert.equal(state.audio.goalStingerPlays, audioBeforeJoelGoal.goalStingerPlays + 1);
  assert.equal(
    state.audio.gameEffectPlays.joelGoal,
    audioBeforeJoelGoal.gameEffectPlays.joelGoal + 1,
    "Joel's Hockey goal should play his VAMOS signature effect",
  );
  assert.equal(state.audio.lastGameEffectPlayback.effectId, 'joelGoal');
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
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.rightPlayer = {
      ...scene.rightPlayer,
      vx: 0,
      vy: 0,
      penaltySeconds: 0,
      target: null,
    };
    scene.aiTarget = { x: scene.rightPlayer.x, y: scene.rightPlayer.y };
    scene.aiThinkTimer = 999;
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x: scene.collisionMap.goalLineLeft + scene.leftPlayer.radius,
      y: (scene.collisionMap.goalTop + scene.collisionMap.goalBottom) / 2,
      vx: 0,
      vy: 0,
      target: null,
      pointerId: null,
      creaseSeconds: 0,
      penaltySeconds: 0,
    };
    scene.puck = { ...scene.puck, x: 640, y: 160, vx: 0, vy: 0 };
  });
  await advance(page, 1600);
  state = await readState(page);
  assert.equal(state.players.left.crease.warning, true, 'the Ice goal should use the same warning geometry');
  await capture(page, '07a-ice-crease-warning');
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.resetRound();
    scene.phase = 'playing';
  });
  state = await readState(page);
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
  const iceShotPlaysBefore = state.audio.gameEffectPlays.hockeyIce;
  await advance(page, 850);
  state = await readState(page);
  assert.ok(state.computerAi.target.x < 900, 'Hard AI should leave its goal and pursue a reachable puck');
  assert.ok(state.players.right.x < 950, 'Hard AI should aggressively close the distance');
  assert.ok(state.puck.x < 740, 'Hard AI should strike the stationary puck toward the rival half');
  assert.ok(state.puck.speed > 50, 'The struck puck should keep air-hockey momentum');
  assert.ok(state.audio.gameEffectPlays.hockeyIce > iceShotPlaysBefore, 'Ice pusher contact should use the supplied ice shot');
  await capture(page, '07-hard-ai-breaks-stalemate');
  await advance(page, 4350);
  await capture(page, '07-ice-computer');

  await page.evaluate(() => (
    window.__SKYHEAD_GAME__.scene.getScene('DiscHockey').leaveToSetup()
  ));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).gameId === 'discHockey');
  await clickLogical(page, 1120, 216);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).playMode === 'crazy');
  state = await readState(page);
  assert.equal(state.difficulty, 'hard', 'Crazy Mode difficulty must be fixed to Hard');
  await capture(page, '08-crazy-setup');
  await page.evaluate(async () => {
    const { playerProfileStore } = await import('/src/game/services/PlayerProfile.js');
    playerProfileStore.setLanguage('es');
    window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup').scene.restart({
      gameId: 'discHockey',
    });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).language === 'es');
  assert.equal((await readState(page)).playMode, 'crazy');
  await capture(page, '08b-modo-loco-setup-spanish');
  await page.evaluate(async () => {
    const { playerProfileStore } = await import('/src/game/services/PlayerProfile.js');
    playerProfileStore.setLanguage('en');
    window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup').scene.restart({
      gameId: 'discHockey',
    });
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).language === 'en');
  await clickLogical(page, 640, 626);
  await page.waitForFunction(() => (
    JSON.parse(window.render_game_to_text()).minigame === 'discHockey'
    && JSON.parse(window.render_game_to_text()).playMode === 'crazy'
    && Boolean(window.__DISC_HOCKEY_DEBUG__)
  ));
  await page.evaluate(() => window.__DISC_HOCKEY_DEBUG__.startPlaying());
  state = await readState(page);
  assert.equal(state.difficulty, 'hard');
  assert.equal(state.players.rightSquad.length, 4);
  assert.equal(new Set(state.players.rightSquad.map(({ id }) => id)).size, 4);
  assert.ok(
    state.players.rightSquad.every(({ id }) => id !== state.players.left.id),
    'Crazy Mode must never select the human character as a rival',
  );
  assert.equal(new Set(state.computerAi.squad.map(({ role }) => role)).size, 4);
  const aggressiveRivals = state.computerAi.squad.filter(({ aggressive }) => aggressive);
  assert.equal(aggressiveRivals.length, 1, 'Crazy Mode must have exactly one overdrive attacker');
  assert.equal(aggressiveRivals[0].role, 'striker');
  assert.ok(
    aggressiveRivals[0].maxSpeed > state.computerAi.tuning.maxSpeed * 1.5,
    'the overdrive striker must be materially faster than Hard support AI',
  );
  state.players.rightSquad.forEach((rival) => {
    assert.equal(rival.radius, 48.4, 'Crazy pushers must retain the normal pusher size');
    assert.ok(
      rival.visualDiameter > 104 && rival.visualDiameter < 107,
      `Crazy artwork must retain the normal visual diameter; got ${rival.visualDiameter}`,
    );
    assert.match(rival.controller, /^computer-hard-/);
  });
  assert.deepEqual(state.crazyPower.charging, {
    passivePerSecond: 1,
    intentionalHitGain: 6,
    defensiveSaveGain: 14,
  });
  await advance(page, 2000);
  state = await readState(page);
  assert.ok(state.crazyPower.energy >= 1.9, 'passive comeback charging should advance during play');
  await capture(page, '09-crazy-four-rivals');

  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    const positions = {
      striker: { x: 1020, y: 383 },
      interceptor: { x: 1090, y: 185 },
      defender: { x: 1090, y: 575 },
      goalkeeper: { x: 1130, y: 383 },
    };
    scene.rightPlayers = scene.rightPlayers.map((player) => ({
      ...player,
      ...positions[player.crazyRole],
      vx: 0,
      vy: 0,
      penaltySeconds: 0,
      knockbackSeconds: 0,
      aiTarget: null,
    }));
    scene.rightPlayer = scene.rightPlayers[0];
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x: 420,
      y: 383,
      vx: 0,
      vy: 0,
      target: null,
      pointerId: null,
    };
    scene.puck = {
      ...scene.puck,
      x: 820,
      y: 383,
      vx: 0,
      vy: 0,
      powered: false,
    };
    scene.aiThinkTimer = 0;
  });
  await advance(page, 350);
  state = await readState(page);
  const overdriveIndex = state.computerAi.squad.findIndex(({ aggressive }) => aggressive);
  const overdrivePlayer = state.players.rightSquad[overdriveIndex];
  assert.ok(
    overdrivePlayer.x < 970,
    `the overdrive striker should close immediately from x=1020; got ${overdrivePlayer.x}`,
  );
  assert.ok(
    state.puck.vx < -250,
    `the overdrive striker should deliver a forceful shot toward the human goal; got ${state.puck.vx}`,
  );
  await capture(page, '09a-crazy-overdrive-striker');

  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x: 420,
      y: 383,
      vx: 0,
      vy: 0,
      pointerId: null,
      target: null,
    };
    scene.puck = {
      ...scene.puck,
      x: 1100,
      y: 570,
      vx: 0,
      vy: 0,
      powered: false,
    };
    const clusteredPositions = [
      { x: 995, y: 570 },
      { x: 1040, y: 465 },
      { x: 950, y: 525 },
      { x: 1040, y: 360 },
    ];
    scene.rightPlayers = scene.rightPlayers.map((player, index) => ({
      ...player,
      ...clusteredPositions[index],
      vx: 0,
      vy: 0,
      aiTarget: clusteredPositions[index],
      penaltySeconds: 0,
      knockbackSeconds: 0,
    }));
    scene.rightPlayer = scene.rightPlayers[0];
    scene.aiThinkTimer = 0;
    scene.updateVisuals();
  });
  await advance(page, 17);
  state = await readState(page);
  const cornerRetriever = state.computerAi.squad.filter(
    ({ role, cornerRecovery }) => role === 'striker' && cornerRecovery === 'bottom',
  );
  const cornerSupport = state.computerAi.squad.filter(({ role }) => role !== 'striker');
  assert.equal(cornerRetriever.length, 1, 'exactly one Crazy rival should retrieve a corner puck');
  cornerSupport.forEach(({ target }) => {
    assert.ok(
      Math.hypot(target.x - 1100, target.y - 570) > 180,
      'support rivals should clear the corner retrieval lane',
    );
  });
  await advance(page, 260);
  await capture(page, '09b-crazy-corner-recovery');
  await advance(page, 1200);
  state = await readState(page);
  assert.ok(
    state.puck.x < 1040 || state.puck.y < 510,
    'the single retriever should bank the puck out of the opponent corner',
  );

  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.phase = 'playing';
    scene.goalPause = 0;
    scene.announcementText.setText('');
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x: 420,
      y: 383,
      vx: 0,
      vy: 0,
      pointerId: null,
      target: null,
    };
    scene.puck = {
      ...scene.puck,
      x: 1100,
      y: 157,
      vx: 0,
      vy: 0,
      powered: false,
    };
    const positions = {
      striker: { x: 1025, y: 250 },
      interceptor: { x: 860, y: 220 },
      defender: { x: 940, y: 500 },
      goalkeeper: { x: 1090, y: 383 },
    };
    scene.rightPlayers = scene.rightPlayers.map((player) => ({
      ...player,
      ...positions[player.crazyRole],
      vx: 0,
      vy: 0,
      aiTarget: null,
      penaltySeconds: 0,
      knockbackSeconds: 0,
      cornerReleaseSeconds: 0,
      cornerReleaseCorner: null,
      cornerPhase: null,
      cornerRecovery: null,
    }));
    scene.rightPlayer = scene.rightPlayers[0];
    scene.aiThinkTimer = 0;
    scene.updateVisuals();
  });
  await advance(page, 17);
  state = await readState(page);
  const topCornerStriker = state.computerAi.squad.find(
    ({ role, cornerRecovery }) => role === 'striker' && cornerRecovery === 'top',
  );
  assert.ok(topCornerStriker, 'the overdrive striker should claim the upper-right corner puck');
  assert.ok(
    Math.hypot(topCornerStriker.target.x - 1100, topCornerStriker.target.y - 157) < 100,
    'the first phase should approach closely enough to bank the stationary puck',
  );
  await advance(page, 260);
  state = await readState(page);
  const retreatingStriker = state.computerAi.squad.find(({ role }) => role === 'striker');
  assert.ok(state.puck.speed >= 120, 'the corner jab should create a live rebound');
  assert.ok(
    Math.hypot(
      retreatingStriker.target.x - state.puck.x,
      retreatingStriker.target.y - state.puck.y,
    ) > 190,
    'the striker should retreat out of the moving puck’s escape lane',
  );
  await capture(page, '09c-crazy-top-corner-release');
  await advance(page, 1400);
  state = await readState(page);
  assert.ok(
    state.puck.x < 1000,
    `the puck must escape the upper-right corner; got (${state.puck.x}, ${state.puck.y})`,
  );
  await capture(page, '09d-crazy-top-corner-escaped');

  const goalLipScoreBefore = state.score.left;
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.phase = 'playing';
    scene.goalPauseTimer = 0;
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x: 420,
      y: 500,
      vx: 0,
      vy: 0,
      pointerId: null,
      target: null,
    };
    scene.puck = {
      ...scene.puck,
      x: 1135,
      y: 300,
      vx: 0,
      vy: 0,
      powered: false,
    };
    const goalLipCluster = [
      { x: 1020, y: 300 },
      { x: 1050, y: 220 },
      { x: 1045, y: 385 },
      { x: 960, y: 270 },
    ];
    scene.rightPlayers = scene.rightPlayers.map((player, index) => ({
      ...player,
      ...goalLipCluster[index],
      vx: 0,
      vy: 0,
      aiTarget: goalLipCluster[index],
      penaltySeconds: 0,
      knockbackSeconds: 0,
    }));
    scene.rightPlayer = scene.rightPlayers[0];
    scene.aiThinkTimer = 0;
    scene.updateVisuals();
  });
  await advance(page, 17);
  state = await readState(page);
  const goalLipRetriever = state.computerAi.squad.filter(
    ({ role, cornerRecovery }) => role === 'striker' && cornerRecovery === 'top',
  );
  const goalLipSupport = state.computerAi.squad.filter(({ role }) => role !== 'striker');
  assert.equal(goalLipRetriever.length, 1, 'exactly one Crazy rival should clear the upper goal lip');
  goalLipSupport.forEach(({ target }) => {
    assert.ok(
      Math.hypot(target.x - 1135, target.y - 300) > 180,
      'support rivals should vacate the goal-lip pocket',
    );
  });
  await advance(page, 1800);
  state = await readState(page);
  assert.ok(
    state.score.left > goalLipScoreBefore
      || state.puck.x < 1040
      || state.puck.y > 360,
    'the clustered squad must release the puck from the upper goal lip',
  );
  await capture(page, '09c-crazy-goal-lip-recovery');

  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    window.__DISC_HOCKEY_DEBUG__.setCrazyPower(0);
    scene.phase = 'playing';
    scene.goalPauseTimer = 0;
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x: 480,
      y: 383,
      vx: 0,
      vy: 0,
      pointerId: 909,
      target: { x: 620, y: 383 },
    };
    scene.puck = {
      ...scene.puck,
      x: 550,
      y: 383,
      vx: 0,
      vy: 0,
      powered: false,
    };
    scene.rightPlayers = scene.rightPlayers.map((player, index) => ({
      ...player,
      x: 820 + index * 75,
      y: 180 + index * 110,
      aiTarget: { x: 820 + index * 75, y: 180 + index * 110 },
      penaltySeconds: 0,
    }));
    scene.rightPlayer = scene.rightPlayers[0];
    scene.aiThinkTimer = 999;
  });
  await advance(page, 17);
  state = await readState(page);
  assert.equal(state.crazyPower.lastGain.source, 'intentional-hit');
  assert.equal(state.crazyPower.lastGain.amount, 6);
  assert.ok(state.crazyPower.energy >= 6 && state.crazyPower.energy <= 100);

  const powerUpPlaysBefore = state.audio.gameEffectPlays.powerUp;
  const poweredShotPlaysBefore = state.audio.gameEffectPlays.poweredShot;
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    window.__DISC_HOCKEY_DEBUG__.setCrazyPower(100);
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x: 480,
      y: 383,
      vx: 0,
      vy: 0,
      pointerId: null,
      target: null,
    };
    scene.puck = {
      ...scene.puck,
      x: 640,
      y: 160,
      vx: 0,
      vy: 0,
      powered: false,
    };
  });
  state = await readState(page);
  assert.equal(state.crazyPower.armed, true);
  assert.equal(state.audio.gameEffectPlays.powerUp, powerUpPlaysBefore + 1);
  await capture(page, '10-crazy-armed');
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x: 480,
      y: 383,
      vx: 0,
      vy: 0,
      pointerId: 910,
      target: { x: 620, y: 383 },
    };
    scene.puck = {
      ...scene.puck,
      x: 550,
      y: 383,
      vx: 0,
      vy: 0,
      powered: false,
    };
  });
  await advance(page, 17);
  state = await readState(page);
  assert.equal(state.crazyPower.armed, false);
  assert.equal(state.crazyPower.energy, 0);
  assert.equal(state.puck.powered, true);
  assert.ok(state.puck.speed >= 1450);
  assert.equal(state.audio.gameEffectPlays.poweredShot, poweredShotPlaysBefore + 1);
  await capture(page, '11-crazy-powered-shot');

  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.leftPlayer = {
      ...scene.leftPlayer,
      pointerId: null,
      target: null,
      vx: 0,
      vy: 0,
    };
    scene.puck = {
      ...scene.puck,
      x: 760,
      y: 383,
      vx: 1450,
      vy: 0,
      powered: true,
    };
    scene.rightPlayers[0] = {
      ...scene.rightPlayers[0],
      x: 825,
      y: 383,
      vx: 0,
      vy: 0,
      aiTarget: { x: 825, y: 383 },
      knockbackSeconds: 0,
      lastPoweredHitSerial: 0,
    };
    scene.rightPlayer = scene.rightPlayers[0];
    scene.aiThinkTimer = 999;
  });
  await advance(page, 17);
  state = await readState(page);
  assert.ok(state.computerAi.squad[0].knockbackSeconds > 0);
  assert.equal(state.puck.powered, true, 'rival contact must not stop the Super Shot');

  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    scene.puck = {
      ...scene.puck,
      x: 1100,
      y: 190,
      vx: 1450,
      vy: 0,
      powered: true,
    };
    scene.rightPlayers = scene.rightPlayers.map((player, index) => ({
      ...player,
      x: 760 + index * 95,
      y: 300 + (index % 2) * 150,
      aiTarget: { x: 760 + index * 95, y: 300 + (index % 2) * 150 },
      penaltySeconds: 99,
    }));
    scene.rightPlayer = scene.rightPlayers[0];
  });
  await advance(page, 150);
  assert.equal((await readState(page)).puck.powered, false, 'the opponent back wall should end the Super Shot');

  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
    window.__DISC_HOCKEY_DEBUG__.setCrazyPower(100);
    scene.leftPlayer = {
      ...scene.leftPlayer,
      x: scene.collisionMap.goalLineLeft + scene.leftPlayer.radius,
      y: (scene.collisionMap.goalTop + scene.collisionMap.goalBottom) / 2,
      vx: 0,
      vy: 0,
      target: null,
      pointerId: null,
      creaseSeconds: 0,
      penaltySeconds: 0,
    };
    scene.puck = {
      ...scene.puck,
      x: 640,
      y: 160,
      vx: 0,
      vy: 0,
      powered: false,
    };
  });
  await advance(page, 4050);
  state = await readState(page);
  assert.equal(state.crazyPower.energy, 0);
  assert.equal(state.crazyPower.armed, false);
  assert.equal(state.crazyPower.lastDrain, 'crease-violation');
  assert.equal(state.antiCamping.lastViolation.energyEmptied, true);
  await capture(page, '12-crazy-camping-drains-power');

  await page.evaluate(() => {
    window.__DISC_HOCKEY_DEBUG__.setCrazyPower(100);
    window.__DISC_HOCKEY_DEBUG__.score('right');
  });
  state = await readState(page);
  assert.equal(state.crazyPower.energy, 100, 'a computer goal should preserve comeback charge');
  assert.equal(state.crazyPower.armed, true);

  await page.evaluate(() => (
    window.__SKYHEAD_GAME__.scene.getScene('DiscHockey').leaveToSetup()
  ));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).gameId === 'discHockey');
  await clickLogical(page, 800, 216);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).playMode === 'computer');
  await clickLogical(page, 800, 314);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).themeId === 'ice');
  for (const expectedPlayerId of ['bob', 'lucia', 'luna', 'juan', 'dad']) {
    let selectedPlayerId = (await readState(page)).playerCharacterId;
    for (let attempt = 0; selectedPlayerId !== expectedPlayerId && attempt < 3; attempt += 1) {
      await clickLogical(page, 277, 300);
      await page.waitForTimeout(120);
      selectedPlayerId = (await readState(page)).playerCharacterId;
    }
    assert.equal(selectedPlayerId, expectedPlayerId);
  }
  state = await readState(page);
  assert.equal(state.playerCharacterId, 'dad');
  assert.deepEqual(state.headerLineup, { left: 'DAD', right: 'JOEL' });
  await capture(page, '13-dad-setup');
  await clickLogical(page, 640, 626);
  await page.waitForFunction(() => (
    JSON.parse(window.render_game_to_text()).minigame === 'discHockey'
    && JSON.parse(window.render_game_to_text()).players?.left?.id === 'dad'
    && Boolean(window.__DISC_HOCKEY_DEBUG__)
  ));
  await page.evaluate(() => window.__DISC_HOCKEY_DEBUG__.startPlaying());
  state = await readState(page);
  assert.equal(state.players.left.id, 'dad');
  assert.equal(state.players.left.name, 'Dad');
  assert.ok(state.players.left.visualDiameter > 104 && state.players.left.visualDiameter < 107);
  await capture(page, '14-dad-normal-hockey');

  await page.evaluate(() => (
    window.__SKYHEAD_GAME__.scene.getScene('DiscHockey').leaveToSetup()
  ));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).gameId === 'discHockey');
  let selectedPlayerId = (await readState(page)).playerCharacterId;
  for (let attempt = 0; selectedPlayerId !== 'mum' && attempt < 3; attempt += 1) {
    await clickLogical(page, 277, 300);
    await page.waitForTimeout(120);
    selectedPlayerId = (await readState(page)).playerCharacterId;
  }
  assert.equal(selectedPlayerId, 'mum');
  state = await readState(page);
  assert.equal(state.playerCharacterId, 'mum');
  assert.deepEqual(state.headerLineup, { left: 'MUM', right: 'JOEL' });
  await capture(page, '15-mum-setup');
  await clickLogical(page, 640, 626);
  await page.waitForFunction(() => (
    JSON.parse(window.render_game_to_text()).minigame === 'discHockey'
    && JSON.parse(window.render_game_to_text()).players?.left?.id === 'mum'
    && Boolean(window.__DISC_HOCKEY_DEBUG__)
  ));
  await page.evaluate(() => window.__DISC_HOCKEY_DEBUG__.startPlaying());
  state = await readState(page);
  assert.equal(state.players.left.id, 'mum');
  assert.equal(state.players.left.name, 'Mum');
  assert.ok(state.players.left.visualDiameter > 104 && state.players.left.visualDiameter < 107);
  await capture(page, '16-mum-normal-hockey');

  await page.evaluate(() => (
    window.__SKYHEAD_GAME__.scene.getScene('DiscHockey').leaveToSetup()
  ));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).gameId === 'discHockey');
  await clickLogical(page, 1120, 216);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).playMode === 'crazy');
  state = await readState(page);
  assert.equal(state.playerCharacterId, 'mum');
  assert.deepEqual(state.headerLineup, { left: 'MUM', right: 'CRAZY SQUAD' });
  await capture(page, '17-mum-crazy-setup');
  await clickLogical(page, 640, 626);
  await page.waitForFunction(() => (
    JSON.parse(window.render_game_to_text()).minigame === 'discHockey'
    && JSON.parse(window.render_game_to_text()).playMode === 'crazy'
    && JSON.parse(window.render_game_to_text()).players?.left?.id === 'mum'
    && Boolean(window.__DISC_HOCKEY_DEBUG__)
  ));
  await page.evaluate(() => window.__DISC_HOCKEY_DEBUG__.startPlaying());
  state = await readState(page);
  assert.equal(state.players.left.id, 'mum');
  assert.ok(state.players.left.visualDiameter > 104 && state.players.left.visualDiameter < 107);
  assert.equal(state.players.rightSquad.length, 4);
  assert.ok(state.players.rightSquad.every(({ id }) => id !== 'mum'));
  await capture(page, '18-mum-crazy-hockey');

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
