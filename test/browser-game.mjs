import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const output = new URL('../output/e2e/', import.meta.url).pathname;
const port = 4175;
const url = `http://127.0.0.1:${port}`;

const waitForServer = async () => {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server is still warming up.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Vite did not become ready at ${url}`);
};

const readState = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));

const readAnimationAtlasMetrics = (page) => page.evaluate(async () => {
  const analyze = async (filename) => {
    const image = new Image();
    image.src = new URL(`assets/${filename}`, window.location.href).href;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const frames = [];
    for (let frame = 0; frame < 12; frame += 1) {
      const originX = (frame % 4) * 320;
      const originY = Math.floor(frame / 4) * 480;
      let left = 320;
      let top = 480;
      let right = 0;
      let bottom = 0;
      for (let y = 0; y < 480; y += 1) {
        for (let x = 0; x < 320; x += 1) {
          const alphaIndex = ((originY + y) * canvas.width + originX + x) * 4 + 3;
          if (pixels[alphaIndex] <= 8) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x + 1);
          bottom = Math.max(bottom, y + 1);
        }
      }
      frames.push({ frame, left, top, right, bottom });
    }
    return { width: image.naturalWidth, height: image.naturalHeight, frames };
  };
  return {
    joel: await analyze('player-joel-sheet-v1.webp'),
    dad: await analyze('player-dad-sheet-v1.webp'),
    mum: await analyze('player-mum-sheet-v1.webp'),
    vex: await analyze('player-vex-sheet-v2.webp'),
    lucia: await analyze('player-lucia-sheet-v2.webp'),
    luna: await analyze('player-luna-sheet-v2.webp'),
    juan: await analyze('player-juan-sheet-v3.webp'),
    juanjo: await analyze('player-juanjo-sheet-v1.webp'),
  };
});

const advance = (page, milliseconds) => page.evaluate((ms) => window.advanceTime(ms), milliseconds);

// Give the browser exactly one real frame to dispatch the DOM input event
// into the game before virtual time is stepped; without it the event can race
// the deterministic stepper and whole holds/taps are silently dropped.
// Bounded to a single frame so timing-sensitive assertions keep their sample
// points.
const settleInputEvent = (page) => page.evaluate(
  () => new Promise((resolve) => requestAnimationFrame(resolve)),
);

const hold = async (page, key, milliseconds) => {
  await page.keyboard.up(key);
  await page.keyboard.down(key);
  await settleInputEvent(page);
  await advance(page, milliseconds);
  await page.keyboard.up(key);
};

const holdCombo = async (page, keys, milliseconds) => {
  await Promise.all(keys.map((key) => page.keyboard.up(key)));
  for (const key of keys) await page.keyboard.down(key);
  await settleInputEvent(page);
  await advance(page, milliseconds);
  await Promise.all(keys.map((key) => page.keyboard.up(key)));
};

// Deterministic alternative to tiny keyboard holds: injects the press directly
// through the input controller, so real frames between CDP calls cannot burn
// gameplay timers (kick-boost taps must land inside the 160 ms kick window).
const touchPulse = (page, action, milliseconds = 17) => page.evaluate(
  ({ action: name, milliseconds: ms }) => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Match');
    scene.inputController.setTouch(name, true);
    window.advanceTime(ms);
    scene.inputController.setTouch(name, false);
  },
  { action, milliseconds },
);

const kickKickfallObstacleQueue = async (page, obstacleId) => {
  const connected = await page.evaluate((id) => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    const obstacle = scene.obstacles.find((candidate) => candidate.id === id);
    const captive = scene.balls.find((ball) => ball.id === obstacle?.stalledBallId);
    if (!obstacle || !captive) return false;
    const queue = scene.balls
      .filter((ball) => ball !== captive && scene.tierForBall(ball)?.id === obstacle.tierId)
      .sort((a, b) => (
        (a.body.x - obstacle.holdX) * -obstacle.flow
        - (b.body.x - obstacle.holdX) * -obstacle.flow
      ));
    queue.forEach((ball, index) => {
      if (ball.body.body.isStatic) ball.body.setStatic(false);
      ball.body.setPosition(
        obstacle.holdX - obstacle.flow * (38 * (index + 1)),
        obstacle.holdY,
      );
      ball.body.setVelocity(0, 0);
      ball.body.setAngularVelocity(0);
      ball.armedUntil = 0;
      ball.impactPower = 0;
    });
    const rear = queue.at(-1);
    if (!rear) return false;
    scene.player.setPosition(rear.body.x - obstacle.flow * 46, rear.body.y - 24);
    scene.player.setVelocity(0, 0);
    scene.currentTierId = obstacle.tierId;
    scene.setFacing(obstacle.flow);
    scene.groundedUntil = scene.simulationSeconds + 1;
    scene.kickCooldown = 0;
    return scene.startKick();
  }, obstacleId);
  assert.equal(connected, true, `the ${obstacleId} pressure fixture should start with real foot contact`);
  await advance(page, 180);
};

const pressDesktopPower = (page) => page.evaluate(() => {
  const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
  match.inputController.keyboardPulse.power = false;
  match.inputController.touch.power = false;
  if (match.currentIntents.left) match.currentIntents.left.power = false;
  match.leftPlayer.update({
    move: 0,
    jump: false,
    kick: false,
    lob: false,
    dash: false,
    dashDirection: 0,
    power: true,
    kickBoost: 0,
  }, 1 / 60, match.rightPlayer.sprite.x);
});

const capture = async (page, path) => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path });
};

const canvasPoint = (page, logicalX, logicalY) =>
  page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    const horizontalOffset = Math.max(0, canvas.width - 1280) / 2;
    return {
      x: rect.left + ((x + horizontalOffset) / canvas.width) * rect.width,
      y: rect.top + (y / canvas.height) * rect.height,
    };
  }, { x: logicalX, y: logicalY });

const stagePoint = (page, stageX, stageY) =>
  page.evaluate(({ x, y }) => {
    const canvas = document.querySelector('canvas');
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.left + (x / canvas.width) * rect.width,
      y: rect.top + (y / canvas.height) * rect.height,
    };
  }, { x: stageX, y: stageY });

const touchControl = async (page, logicalX, logicalY, milliseconds = 60) => {
  const point = await canvasPoint(page, logicalX, logicalY);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  // Let the game process the pointerdown before virtual time steps, same
  // race as the keyboard holds.
  await settleInputEvent(page);
  await advance(page, milliseconds);
  await page.mouse.up();
};

const waitThroughSplash = async (page, screenshotPath) => {
  await page.waitForFunction(() => (
    typeof window.render_game_to_text === 'function'
    && JSON.parse(window.render_game_to_text()).mode === 'splash'
  ));
  const splashState = await readState(page);
  assert.equal(splashState.title, 'Joel Football');
  assert.equal(splashState.selectedArtwork, 'option-a');
  assert.equal(splashState.requiredAssetsReady, true);
  assert.equal(splashState.autoAdvance, true);
  assert.equal(splashState.minDisplayMs, 3000);
  assert.equal(splashState.maxDisplayMs, 5000);
  assert.deepEqual(splashState.actions, [], 'the splash should not require input');
  const overlayState = await page.evaluate(() => {
    const overlay = document.getElementById('startup-splash');
    const spinner = overlay?.querySelector('.startup-spinner');
    const bounds = spinner?.getBoundingClientRect();
    return {
      text: overlay?.textContent?.trim() ?? null,
      spinnerVisible: !!spinner && getComputedStyle(spinner).display !== 'none',
      spinnerAnimation: spinner ? getComputedStyle(spinner).animationName : '',
      spinnerRight: bounds ? window.innerWidth - bounds.right : null,
      spinnerBottom: bounds ? window.innerHeight - bounds.bottom : null,
    };
  });
  assert.equal(overlayState.text, '', 'the splash overlay should contain no visible copy');
  assert.equal(overlayState.spinnerVisible, true);
  assert.equal(overlayState.spinnerAnimation, 'startup-spin');
  assert.ok(overlayState.spinnerRight < 50 && overlayState.spinnerBottom < 50, 'the spinner should sit in the bottom-right corner');
  if (screenshotPath) await capture(page, screenshotPath);
  await page.waitForFunction(() => document.getElementById('startup-splash')?.classList.contains('is-fading-to-white'));
  const splashElapsedMs = await page.evaluate(() => performance.now() - window.__JOEL_SPLASH_STARTED_AT__);
  assert.ok(splashElapsedMs >= 2950, `the splash should linger for at least three seconds; got ${splashElapsedMs}ms`);
  if (screenshotPath) {
    await page.waitForFunction(() => Number.parseFloat(
      getComputedStyle(document.getElementById('startup-splash'), '::after').opacity,
    ) > 0.42);
    await capture(page, screenshotPath.replace('.png', '-fade-white.png'));
  }
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await page.waitForFunction(() => document.getElementById('startup-splash')?.classList.contains('is-revealing-menu'));
  if (screenshotPath) {
    await page.waitForFunction(() => {
      const opacity = Number.parseFloat(getComputedStyle(document.getElementById('startup-splash')).opacity);
      return opacity > 0.3 && opacity < 0.7;
    });
    await capture(page, screenshotPath.replace('.png', '-fade-menu.png'));
  }
  await page.waitForFunction(() => !document.getElementById('startup-splash'));
};

const answerForChallenge = ({ operation, left, right }) => {
  if (operation === 'addition') return left + right;
  if (operation === 'subtraction') return left - right;
  if (operation === 'multiplication') return left * right;
  return left / right;
};

const assertAgeAppropriateChallenge = (challenge) => {
  assert.ok(['addition', 'subtraction', 'multiplication', 'division'].includes(challenge.operation));
  if (challenge.operation === 'addition') {
    assert.ok(challenge.left >= 10 && challenge.right >= 10);
  } else if (challenge.operation === 'subtraction') {
    assert.ok(challenge.right >= 10 && challenge.left - challenge.right >= 10);
  } else if (challenge.operation === 'multiplication') {
    assert.ok(challenge.left >= 3 && challenge.left <= 12);
    assert.ok(challenge.right >= 3 && challenge.right <= 12);
  } else {
    assert.ok(challenge.right >= 3 && challenge.right <= 12);
    assert.ok(challenge.left / challenge.right >= 3 && challenge.left / challenge.right <= 12);
    assert.equal(challenge.left % challenge.right, 0);
  }
};

const answerChallenge = async (page, challenge, correct = true) => {
  const answer = answerForChallenge(challenge);
  const target = correct ? answer : challenge.choices.find((choice) => choice !== answer);
  const index = challenge.choices.indexOf(target);
  await touchControl(page, 400 + index * 160, 430, 35);
};

await mkdir(output, { recursive: true });
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const page = await desktop.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitThroughSplash(page, `${output}/00-splash-option-a.png`);
  let state = await readState(page);
  assert.equal(state.mode, 'intro');
  assert.equal(state.title, 'Joel Football');
  assert.equal(state.playerCharacter.id, 'joel');
  assert.equal(state.opponent.id, 'bob', 'Bob should remain the default opponent for existing profiles');
  assert.equal(state.language, 'en');
  assert.deepEqual(state.journeys, [
    { id: 'football', primary: true, destination: 'football-setup' },
    { id: 'mini-games', primary: false, destination: 'mini-games' },
  ]);
  assert.deepEqual(state.difficultyByGame, {
    football: 'normal',
    kickfall: 'normal',
    discHockey: 'normal',
  });
  assert.equal(state.audio.settings.musicVolume, 0.15);
  assert.equal(state.audio.settings.effectsVolume, 0.2);
  assert.equal(state.audio.trackCount, 6, 'all six supplied music tracks should rotate');
  const tapHighlight = await page.locator('canvas').evaluate((canvas) => getComputedStyle(canvas).webkitTapHighlightColor);
  assert.equal(tapHighlight, 'rgba(0, 0, 0, 0)', 'the Phaser canvas must not show Android WebView tap highlighting');
  const bootTextureState = await page.evaluate(() => {
    const textures = window.__SKYHEAD_GAME__.textures;
    return Object.fromEntries(['joel-sheet', 'dad-sheet', 'mum-sheet', 'vex-sheet', 'lucia-sheet', 'luna-sheet', 'juan-sheet', 'juanjo-sheet']
      .map((key) => [key, textures.exists(key)]));
  });
  assert.deepEqual(bootTextureState, {
    'joel-sheet': true,
    'dad-sheet': false,
    'mum-sheet': false,
    'vex-sheet': true,
    'lucia-sheet': false,
    'luna-sheet': false,
    'juan-sheet': false,
    'juanjo-sheet': false,
  }, 'Boot should decode only the current lineup atlases');
  const bootArenaTextureState = await page.evaluate(() => {
    const textures = window.__SKYHEAD_GAME__.textures;
    return Object.fromEntries(['arena-skycourt', 'arena-neon', 'arena-beach']
      .map((key) => [key, textures.exists(key)]));
  });
  assert.deepEqual(bootArenaTextureState, {
    'arena-skycourt': true,
    'arena-neon': false,
    'arena-beach': false,
  }, 'Boot should load only the persisted arena; alternatives belong to the customization screen');
  const groundedVisualFrames = new Set([0, 1, 4, 5, 6, 7, 8, 9, 10, 11]);
  const atlasMetrics = await readAnimationAtlasMetrics(page);
  for (const [player, atlas] of Object.entries(atlasMetrics)) {
    assert.deepEqual([atlas.width, atlas.height], [1280, 1440]);
    for (const frame of atlas.frames) {
      assert.ok(
        frame.left >= 8 && 320 - frame.right >= 8,
        `${player} frame ${frame.frame} must keep at least 8 px of horizontal padding; got ${JSON.stringify(frame)}`,
      );
      if (groundedVisualFrames.has(frame.frame)) {
        assert.equal(frame.bottom, 418, `${player} grounded frame ${frame.frame} must share the foot baseline`);
      }
    }
  }
  assert.ok(atlasMetrics.lucia.frames[8].top >= 8, 'Lucia run-contact-B hair must have visible top padding');
  assert.ok(atlasMetrics.luna.frames.every((frame) => frame.top >= 8), 'every Luna pose must keep her curls below the frame edge');
  assert.ok(atlasMetrics.juan.frames.every((frame) => frame.top >= 8), 'every Uncle Juan pose must keep his head below the frame edge');
  assert.ok(atlasMetrics.dad.frames.every((frame) => frame.top >= 8), 'every Dad pose must keep his dark hair below the frame edge');
  assert.ok(atlasMetrics.mum.frames.every((frame) => frame.top >= 8), 'every Mum pose must keep her curls below the frame edge');
  assert.ok(atlasMetrics.juanjo.frames.every((frame) => frame.top >= 8), 'every Uncle Juanjo pose must keep his hair and glasses below the frame edge');
  const visibleHeight = (frame) => frame.bottom - frame.top;
  assert.ok(
    visibleHeight(atlasMetrics.dad.frames[0]) >= visibleHeight(atlasMetrics.joel.frames[0]) * 1.05,
    '6-foot-7 Dad must retain a visibly taller idle silhouette than Joel',
  );
  for (const player of ['juan', 'dad', 'juanjo']) {
    assert.ok(
      visibleHeight(atlasMetrics[player].frames[2]) >= visibleHeight(atlasMetrics[player].frames[0]) * 0.9,
      `${player} jump must retain at least 90% of its idle silhouette height`,
    );
  }
  const visibleArea = (frame) => (frame.right - frame.left) * visibleHeight(frame);
  const adultMotionReferences = ['juan', 'dad', 'juanjo'];
  const mumIdleArea = visibleArea(atlasMetrics.mum.frames[0]);
  for (let frame = 1; frame < 12; frame += 1) {
    const referenceRatios = adultMotionReferences
      .map((player) => (
        visibleArea(atlasMetrics[player].frames[frame])
        / visibleArea(atlasMetrics[player].frames[0])
      ))
      .sort((a, b) => a - b);
    const adultMedianRatio = referenceRatios[1];
    const mumRatio = visibleArea(atlasMetrics.mum.frames[frame]) / mumIdleArea;
    assert.ok(
      mumRatio / adultMedianRatio >= 0.85 && mumRatio / adultMedianRatio <= 1.35,
      `Mum frame ${frame} must keep adult-relative motion scale; got ${mumRatio / adultMedianRatio}`,
    );
  }
  assert.ok(
    [9, 11].every((frame) => visibleHeight(atlasMetrics.juanjo.frames[frame]) >= 330),
    'Uncle Juanjo anticipation and recovery must recover the hair pixels above their source-sheet cells',
  );
  await capture(page, `${output}/01-intro.png`);

  const kickfallBeforeEntry = await page.evaluate(() => performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => /kickfall|KickfallScene|DiscHockeyScene/i.test(name)));
  assert.deepEqual(kickfallBeforeEntry, [], 'mini-game code and exclusive assets must not join the opening payload');

  await touchControl(page, 640, 252, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  await touchControl(page, 785, 205, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).opponent?.id === 'lucia');
  await page.waitForTimeout(60);
  await touchControl(page, 785, 205, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).opponent?.id === 'luna');
  await touchControl(page, 82, 52, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await touchControl(page, 430, 493, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'mini-games');
  state = await readState(page);
  assert.ok(
    state.playerCharacter.available.some(({ id }) => id === 'luna'),
    'a Football opponent must remain available as the Mini-games player',
  );
  for (const characterId of ['bob', 'lucia', 'luna']) {
    await touchControl(page, 745, 586, 35);
    await page.waitForFunction(
      (expectedId) => JSON.parse(window.render_game_to_text()).playerCharacter?.id === expectedId,
      characterId,
    );
    await page.waitForTimeout(60);
  }
  await capture(page, `${output}/01-mini-games-luna-opponent-selectable.png`);
  await touchControl(page, 82, 52, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await touchControl(page, 640, 252, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  state = await readState(page);
  assert.deepEqual(
    [state.playerCharacter.id, state.opponent.id],
    ['luna', 'joel'],
    'selecting Luna for Mini-games should keep Football lineups valid by moving the conflicting opponent',
  );
  await touchControl(page, 785, 205, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).opponent?.id === 'bob');
  for (const characterId of ['lucia', 'joel']) {
    await page.waitForTimeout(60);
    await touchControl(page, 85, 205, 35);
    await page.waitForFunction(
      (expectedId) => JSON.parse(window.render_game_to_text()).playerCharacter?.id === expectedId,
      characterId,
    );
  }
  await touchControl(page, 82, 52, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');

  await touchControl(page, 430, 493, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'mini-games');
  state = await readState(page);
  assert.deepEqual(state.games, [
    {
      id: 'kickfall',
      title: 'Kickfall',
      highestUnlockedLevel: 1,
      lastPlayedLevel: 1,
      difficulty: 'normal',
    },
    {
      id: 'discHockey',
      title: 'Disc Hockey',
      difficulty: 'normal',
      mode: 'computer',
      themeId: 'ice',
    },
  ]);
  assert.deepEqual(state.playerCharacter, {
    id: 'joel',
    name: 'Joel',
    sharedWithFootball: true,
    available: [
      { id: 'joel', name: 'Joel' },
      { id: 'bob', name: 'Bob' },
      { id: 'lucia', name: 'Lucia' },
      { id: 'luna', name: 'Luna' },
      { id: 'juan', name: 'Uncle Juan' },
      { id: 'dad', name: 'Dad' },
      { id: 'mum', name: 'Mum' },
      { id: 'juanjo', name: 'Uncle Juanjo' },
    ],
  });
  await touchControl(page, 745, 586, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).playerCharacter?.id === 'bob');
  await page.waitForTimeout(60);
  await touchControl(page, 745, 586, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).playerCharacter?.id === 'lucia');
  await touchControl(page, 82, 52, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  assert.equal((await readState(page)).playerCharacter.id, 'lucia', 'the Mini-games player selection should update the global profile');
  await touchControl(page, 640, 252, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  assert.equal((await readState(page)).playerCharacter.id, 'lucia', 'Football should immediately inherit the Mini-games player selection');
  await touchControl(page, 82, 52, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await touchControl(page, 430, 493, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'mini-games');
  assert.equal((await readState(page)).playerCharacter.id, 'lucia');
  await touchControl(page, 535, 586, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).playerCharacter?.id === 'bob');
  await page.waitForTimeout(60);
  await touchControl(page, 535, 586, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).playerCharacter?.id === 'joel');
  await capture(page, `${output}/01-mini-games.png`);
  await touchControl(page, 345, 294, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'minigame-setup');
  state = await readState(page);
  assert.equal(state.gameId, 'kickfall');
  assert.equal(state.difficulty, 'normal');
  assert.deepEqual(state.mission, {
    title: 'YOUR MISSION',
    description: 'Race the clock! Break through gates and free every trapped ball before time runs out.',
  });
  assert.ok(!/factory|ballworks/i.test(state.mission.description));
  assert.equal(state.progress.highestUnlockedLevel, 1);
  assert.equal(state.progress.lastPlayedLevel, 1);
  await capture(page, `${output}/01-kickfall-setup.png`);
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup');
    scene.language = 'es';
    scene.isTouchLayout = true;
    scene.openHelp();
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).modal === 'help');
  const helpColumnBounds = await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup');
    const textBounds = (value) => {
      const text = scene.children.list.find((child) => child.text === value && child.visible);
      if (!text) return null;
      const bounds = text.getBounds();
      return {
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom,
      };
    };
    return {
      layout: scene.infoOverlay.layout,
      left: [
        'MOVER',
        'Corre y elige un carril superior o inferior',
        'SALTAR',
        'Mantén una dirección al saltar para cambiar de carril',
      ].map(textBounds),
      right: [
        'CAMBIAR DE CARRIL',
        'Mantén arriba o abajo mientras saltas',
        'CHUTAR',
        'Rompe muros y libera balones atrapados',
      ].map(textBounds),
    };
  });
  assert.ok(
    helpColumnBounds.left.every(Boolean) && helpColumnBounds.right.every(Boolean),
    'all Spanish touch help labels should render',
  );
  for (const bounds of helpColumnBounds.left) {
    assert.ok(
      bounds.right <= helpColumnBounds.layout.columns[0].textRight + 1,
      `left help copy must stay in its safe column; right=${bounds.right}`,
    );
  }
  for (const bounds of helpColumnBounds.right) {
    assert.ok(
      bounds.right <= helpColumnBounds.layout.columns[1].textRight + 1,
      `right help copy must stay in its safe column; right=${bounds.right}`,
    );
  }
  assert.ok(
    Math.max(...helpColumnBounds.left.map(({ right }) => right))
      < helpColumnBounds.layout.columns[1].badgeX - helpColumnBounds.layout.badgeRadius,
    'the left help column must not render under the right-side badges',
  );
  await capture(page, `${output}/01-kickfall-help-es-safe-columns.png`);
  await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup');
    scene.closeHelp();
    scene.language = 'en';
    scene.isTouchLayout = false;
  });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).modal === null);
  await touchControl(page, 640, 620, 35);
  await page.waitForFunction(() => ['countdown', 'playing'].includes(JSON.parse(window.render_game_to_text()).mode));
  state = await readState(page);
  assert.equal(state.minigame, 'kickfall');
  assert.equal(state.difficulty, 'normal');
  assert.equal(state.audio.sceneMode, 'kickfall');
  assert.deepEqual(state.audio.scenePolicy, { music: true, audience: false });
  assert.equal(state.audio.musicRequested, true, 'Kickfall should continue the shared game soundtrack');
  assert.equal(state.audio.audienceRequested, false, 'crowd ambience must remain exclusive to Football');
  assert.equal(state.selectedCharacter.id, 'joel', 'Kickfall should use the currently selected player');
  assert.equal(state.progress.quota, 8);
  assert.equal(state.gates.length, 3);
  assert.equal(state.balls.length, 0);
  assert.equal(state.theme.id, 'cosmic');
  assert.equal(state.theme.name, 'Cosmic Foundry');
  assert.deepEqual(state.theme.textureKeys, {
      backdrop: 'kickfall-cosmic-backdrop',
      milkyWay: 'kickfall-cosmic-milky-way',
      moon: 'kickfall-cosmic-moon',
      platform: 'kickfall-cosmic-platform',
      gate: 'kickfall-cosmic-gate',
      catchRail: 'kickfall-cosmic-catch',
      cleat: 'kickfall-cosmic-cleat',
  });
  assert.deepEqual(state.theme.layers, { backdrop: true, milkyWay: true, moon: true, stars: 10 });
  assert.ok(Number.isFinite(state.theme.motion.milkyWayAngle));
  assert.ok(Number.isFinite(state.theme.motion.moonX));
  const kickfallAfterEntry = await page.evaluate(() => performance.getEntriesByType('resource')
    .map((entry) => entry.name)
    .filter((name) => name.includes('kickfall') || name.includes('KickfallScene')));
  assert.ok(kickfallAfterEntry.some((name) => name.includes('KickfallScene')), 'Kickfall scene code should load on entry');
  assert.ok(kickfallAfterEntry.some((name) => name.includes('kickfall-ball.svg')), 'Kickfall assets should load on entry');
  for (const asset of [
    'cosmic-backdrop-v1.webp',
    'cosmic-milky-way-v1.webp',
    'cosmic-moon-v1.webp',
    'cosmic-platform-v1.webp',
    'cosmic-gate-v1.png',
    'cosmic-catch-v1.png',
    'cosmic-cleat-v1.png',
  ]) {
    assert.ok(kickfallAfterEntry.some((name) => name.includes(asset)), `${asset} should stay in the lazy Cosmic Foundry payload`);
  }
  assert.ok(!kickfallAfterEntry.some((name) => name.includes('kickfall-backdrop.svg')), 'an unselected theme must not be loaded');
  const removedDangerArt = await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    const visibleText = scene.children.list
      .filter((child) => typeof child.text === 'string' && child.visible)
      .map((child) => child.text);
    return {
      hasDangerLegend: visibleText.includes('DANGER LINE'),
      hasHatchLegend: visibleText.includes('HATCH'),
      hasBoundary: Boolean(scene.dangerBoundary),
      hasHudMeter: Boolean(scene.dangerTrack || scene.dangerFill),
    };
  });
  assert.deepEqual(removedDangerArt, {
    hasDangerLegend: false,
    hasHatchLegend: false,
    hasBoundary: false,
    hasHudMeter: false,
  }, 'the retired danger threshold must leave no background stripe or HUD meter');
  assert.equal(state.danger, undefined, 'danger state should be removed from gameplay diagnostics');
  assert.equal(state.timer.enabled, true, 'Level 1 should use a forgiving clock instead of danger-line defeat');
  assert.equal(state.timer.totalSeconds, 90);

  await page.evaluate(() => window.__KICKFALL_DEBUG__.startPlaying());
  state = await readState(page);
  const cosmicMotionStart = state.theme.motion;
  await advance(page, 800);
  state = await readState(page);
  assert.ok(state.theme.motion.milkyWayAngle > cosmicMotionStart.milkyWayAngle + 0.02);
  assert.ok(state.theme.motion.moonX < cosmicMotionStart.moonX, 'the Moon should advance with the active Level 1 clock');
  await capture(page, `${output}/01-kickfall-cosmic-theme.png`);

  await page.keyboard.press('Escape');
  state = await readState(page);
  assert.equal(state.mode, 'paused', 'Escape should pause Kickfall instead of leaving immediately');
  assert.equal(state.pauseReason, 'manual');
  assert.equal(state.modal, null);
  assert.deepEqual(state.pauseActions, ['resume', 'restart level', 'leave Kickfall']);
  const pauseStartSeconds = await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').simulationSeconds);
  const pausedCosmicMotion = state.theme.motion;
  await capture(page, `${output}/01-kickfall-pause.png`);
  await advance(page, 600);
  assert.equal(
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').simulationSeconds),
    pauseStartSeconds,
    'Kickfall simulation time must remain frozen while paused',
  );
  assert.deepEqual((await readState(page)).theme.motion, pausedCosmicMotion, 'background parallax must freeze with gameplay');
  await page.keyboard.press('Escape');
  assert.equal((await readState(page)).mode, 'playing', 'Escape should resume from the pause menu');
  await page.keyboard.press('p');
  assert.equal((await readState(page)).mode, 'paused', 'P should share the match pause shortcut');
  await touchControl(page, 775, 475, 35);
  state = await readState(page);
  assert.equal(state.modal, 'abandon-confirm', 'leaving Kickfall must require confirmation');
  assert.deepEqual(state.confirmationActions, ['stay', 'leave Kickfall']);
  await capture(page, `${output}/01-kickfall-leave-confirm.png`);
  await page.keyboard.press('Escape');
  state = await readState(page);
  assert.equal(state.mode, 'paused');
  assert.equal(state.modal, null, 'Escape should cancel leave confirmation and restore pause');
  await touchControl(page, 640, 390, 35);
  assert.equal((await readState(page)).mode, 'playing');

  await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.startPlaying();
    window.__KICKFALL_DEBUG__.clearBalls();
  });
  await advance(page, 120);
  state = await readState(page);
  assert.ok(
    Math.abs(state.player.platformSurfaceY - state.player.visualGroundAnchorY) < 3,
    `Kickfall feet should meet the ramp; gap=${state.player.platformSurfaceY - state.player.visualGroundAnchorY}`,
  );
  const kickfallStartX = state.player.x;
  const kickfallRunFrames = [];
  await page.keyboard.down('d');
  for (let sample = 0; sample < 12; sample += 1) {
    await advance(page, 40);
    kickfallRunFrames.push((await readState(page)).player.visualFrame);
  }
  await page.keyboard.up('d');
  state = await readState(page);
  assert.ok(state.player.x > kickfallStartX + 80, `Kickfall movement should respond immediately; moved ${state.player.x - kickfallStartX}px`);
  assert.ok(
    kickfallRunFrames.some((frame) => [6, 7, 8].includes(frame)),
    `Kickfall running should use animated run frames; got ${kickfallRunFrames.join(',')}`,
  );
  const kickfallRunTransitions = kickfallRunFrames.slice(1)
    .filter((frame, index) => frame !== kickfallRunFrames[index]).length;
  assert.ok(
    kickfallRunTransitions >= 2 && kickfallRunTransitions <= 5,
    `Kickfall running should hold each pose long enough to read; frames=${kickfallRunFrames.join(',')}`,
  );
  assert.ok(new Set(kickfallRunFrames).size >= 3, 'Kickfall running should still cycle through all three run drawings');

  await hold(page, 'ArrowDown', 20);
  await advance(page, 380);
  state = await readState(page);
  assert.equal(state.player.tierId, 'top', 'Down alone must not transfer the player');
  await holdCombo(page, ['ArrowDown', 'Space'], 20);
  await advance(page, 380);
  state = await readState(page);
  assert.equal(state.player.tierId, 'upper', 'Jump + Down should transfer exactly one tier lower');
  assert.ok(state.player.y > 240, 'Jump + Down should visibly land the character on the platform below');
  await holdCombo(page, ['s', 'Space'], 20);
  await advance(page, 380);
  assert.equal((await readState(page)).player.tierId, 'lower');
  await holdCombo(page, ['ArrowUp', 'Space'], 20);
  await advance(page, 380);
  state = await readState(page);
  assert.equal(state.player.tierId, 'upper', 'Jump + Up should transfer exactly one tier higher');
  assert.ok(Math.abs(state.player.platformSurfaceY - state.player.visualGroundAnchorY) < 3);
  await hold(page, 'Space', 20);
  state = await readState(page);
  assert.equal(state.player.tierId, 'upper', 'the dedicated jump must stay on the current tier');
  assert.ok(state.player.vy < 0, 'Space should apply a normal upward jump impulse');
  await advance(page, 700);
  state = await readState(page);
  assert.equal(state.player.grounded, true, 'Kickfall jump should return to the ramp promptly');
  assert.ok(Math.abs(state.player.platformSurfaceY - state.player.visualGroundAnchorY) < 3);

  await holdCombo(page, ['ArrowUp', 'Space'], 20);
  await advance(page, 380);
  assert.equal((await readState(page)).player.tierId, 'top');
  await holdCombo(page, ['ArrowUp', 'Space'], 20);
  state = await readState(page);
  assert.equal(state.player.tierId, 'top', 'a blocked upward transfer must stay on the top lane');
  assert.ok(state.player.vy < 0, 'jump plus an unavailable lane direction should fall back to a normal jump');
  await advance(page, 700);

  const bufferedJumpFixture = await page.evaluate(() => window.__KICKFALL_DEBUG__.prepareBufferedJump('upper'));
  await hold(page, 'Space', 20);
  await advance(page, 60);
  state = await readState(page);
  assert.equal(state.player.tierId, 'upper');
  assert.ok(
    state.player.y < bufferedJumpFixture.expectedLandingY - 20,
    `a jump pressed just before landing should launch on contact; ${JSON.stringify(state.player)}`,
  );
  await capture(page, `${output}/01-kickfall-buffered-jump.png`);
  await advance(page, 700);

  const remoteKickBallId = await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.clearBalls();
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    scene.spawnTimer = 999;
    scene.setFacing(1);
    scene.kickCooldown = 0;
    scene.lastKickedBallId = null;
    return scene.spawnBall({
      x: scene.player.x + 86,
      y: scene.player.y + 22,
      vx: 0,
      vy: 0,
    }).id;
  });
  await hold(page, 'x', 40);
  state = await readState(page);
  assert.equal(
    state.player.lastKickedBallId,
    null,
    'Kickfall must not kick a nearby ball when the kicking foot does not touch it',
  );
  assert.equal(state.balls.find((ball) => ball.id === remoteKickBallId).armedSeconds, 0);
  await capture(page, `${output}/01-kickfall-remote-kick-rejected.png`);

  const contactKickBallId = await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.clearBalls();
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    scene.spawnTimer = 999;
    scene.setFacing(1);
    scene.kickCooldown = 0;
    scene.lastKickedBallId = null;
    return scene.spawnBall({
      x: scene.player.x + 52,
      y: scene.player.y + 22,
      vx: 0,
      vy: 0,
    }).id;
  });
  await capture(page, `${output}/01-kickfall-direct-contact-ready.png`);
  await hold(page, 'x', 40);
  state = await readState(page);
  assert.equal(state.player.lastKickedBallId, contactKickBallId, 'direct foot-to-ball contact should still kick');
  assert.ok(state.balls.find((ball) => ball.id === contactKickBallId).armedSeconds > 0);
  await capture(page, `${output}/01-kickfall-direct-kick-contact.png`);

  const flowBallId = await page.evaluate(() => window.__KICKFALL_DEBUG__.prepareFlowBall('top'));
  const flowBallStartX = (await readState(page)).balls.find((ball) => ball.id === flowBallId).x;
  await advance(page, 400);
  state = await readState(page);
  const flowBall = state.balls.find((ball) => ball.id === flowBallId);
  assert.ok(flowBall.x > flowBallStartX + 25, `the ramp should carry a ball quickly; moved ${flowBall.x - flowBallStartX}px`);
  assert.ok(flowBall.vx > 2.5, `the downhill ball should have useful speed; vx=${flowBall.vx}`);

  await advance(page, 26_000);
  state = await readState(page);
  assert.equal(state.mode, 'playing', 'a crowded spawn column must not trigger the retired danger defeat');
  assert.equal(state.defeatReason, null);
  assert.equal(state.danger, undefined);
  assert.ok(state.progress.spawned >= 5, 'the untouched board should receive a substantial ball queue');
  assert.ok(state.balls.length >= 5, 'the untouched board should retain a visible physical pile');
  assert.deepEqual(
    state.entryWall,
    { angleDegrees: -11, topX: 155.2, bottomX: 175 },
    'the ball-entry wall should lean left at the top while preserving its original bottom anchor',
  );
  const naturalTopQueue = state.balls.filter((ball) => ball.y < 210 && ball.x < 430);
  const naturalQueueXSpan = Math.max(...naturalTopQueue.map((ball) => ball.x))
    - Math.min(...naturalTopQueue.map((ball) => ball.x));
  const naturalQueueYSpan = Math.max(...naturalTopQueue.map((ball) => ball.y))
    - Math.min(...naturalTopQueue.map((ball) => ball.y));
  assert.ok(naturalTopQueue.length >= 5, 'the entry-wall fixture should retain a representative top-lane queue');
  assert.ok(
    naturalQueueXSpan > 100 && naturalQueueXSpan > naturalQueueYSpan * 2.5,
    `the tilted wall should spread the pile horizontally; xSpan=${naturalQueueXSpan}, ySpan=${naturalQueueYSpan}`,
  );
  await page.waitForTimeout(150);
  await capture(page, `${output}/01-kickfall-natural-pile-up.png`);
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').scene.restart({ level: 1 }));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');

  await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.startPlaying();
    window.__KICKFALL_DEBUG__.prepareGateKick('gate-a');
  });
  await hold(page, 'x', 80);
  state = await readState(page);
  assert.equal(state.gates.find((gate) => gate.id === 'gate-a').active, false, 'a real kick should break the contacted gate');
  assert.ok(state.player.lastKickedBallId, 'the kick should report the struck ball');
  assert.ok(state.visualEffects.gateDebris >= 24, 'the explosion should throw a chunky burst of themed gate debris');
  assert.equal(state.visualEffects.shockwaves, 2, 'the explosion should have two expanding shockwaves');
  assert.ok(state.visualEffects.sparks >= 24, 'the explosion should spray a dense field of hot sparks');
  assert.ok(state.visualEffects.smoke >= 9, 'the explosion should leave a visible cloud of smoke');
  assert.equal(state.visualEffects.boomText, 1, 'the explosion should include its comic BOOM accent');
  assert.ok(state.audio.gameEffectPlays.wallBreak >= 1, 'breaking a gate should use the supplied wall-break effect');
  assert.equal(
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').announcementText.text),
    '',
    'BOOM should replace the old gate-broken announcement instead of competing with it',
  );
  assert.ok(
    await page.evaluate(() => {
      const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
      return scene.effects
        .filter((effect) => effect.item.texture?.key === scene.theme.textureKeys.gate).length >= 12;
    }),
    'breaking a production gate should emit fragments cropped from the selected theme texture',
  );
  await capture(page, `${output}/01-kickfall-gate-break.png`);

  const gateQueueIds = await page.evaluate(() => window.__KICKFALL_DEBUG__.prepareGateQueue('gate-b', 7));
  await capture(page, `${output}/01-kickfall-gate-queue-ready.png`);
  const queueContact = await page.evaluate((rearId) => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    const rear = scene.balls.find((ball) => ball.id === rearId);
    const tier = scene.getTier('upper');
    scene.player.setPosition(rear.body.x - tier.flow * 46, rear.body.y - 24);
    scene.player.setVelocity(0, 0);
    const footX = scene.player.x + scene.facing * 30;
    const footY = scene.player.y + 24;
    return {
      playerX: scene.player.x,
      playerY: scene.player.y,
      facing: scene.facing,
      ballX: rear.body.x,
      ballY: rear.body.y,
      footDistance: Math.hypot(rear.body.x - footX, rear.body.y - footY),
    };
  }, gateQueueIds.at(-1));
  assert.equal(
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').startKick()),
    true,
    `the packed-queue fixture must begin with a real foot-to-rear-ball collision; ${JSON.stringify(queueContact)}`,
  );
  await advance(page, 180);
  state = await readState(page);
  assert.equal(state.player.lastKickedBallId, gateQueueIds.at(-1), 'the player should directly kick only the rear ball');
  const gateAfterFirstQueueKick = state.gates.find((gate) => gate.id === 'gate-b');
  assert.equal(gateAfterFirstQueueKick.active, true, 'one rear kick must not clear an entire seven-ball queue');
  assert.ok(
    gateAfterFirstQueueKick.health > 0 && gateAfterFirstQueueKick.health < gateAfterFirstQueueKick.maxHealth,
    `the attenuated queue kick should still make visible progress; ${JSON.stringify(gateAfterFirstQueueKick)}`,
  );
  await capture(page, `${output}/01-kickfall-gate-queue-first-impact.png`);
  assert.equal(await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    const tier = scene.getTier('upper');
    const rear = scene.balls
      .filter((ball) => scene.tierForBall(ball)?.id === tier.id)
      .sort((a, b) => (a.body.x - b.body.x) * -tier.flow)[0];
    scene.player.setPosition(rear.body.x - tier.flow * 46, rear.body.y - 24);
    scene.player.setVelocity(0, 0);
    scene.currentTierId = tier.id;
    scene.setFacing(tier.flow);
    scene.groundedUntil = scene.simulationSeconds + 1;
    scene.kickCooldown = 0;
    return scene.startKick();
  }), true, 'the packed queue should remain directly kickable after its first impact');
  await advance(page, 180);
  state = await readState(page);
  assert.equal(
    state.gates.find((gate) => gate.id === 'gate-b').active,
    false,
    'a second deliberate rear kick should finish the seven-ball queue',
  );
  await capture(page, `${output}/01-kickfall-gate-queue-breakthrough.png`);

  await page.evaluate(() => window.__KICKFALL_DEBUG__.prepareGateKick('gate-c'));
  await hold(page, 'x', 80);
  state = await readState(page);
  assert.equal(state.gates.find((gate) => gate.id === 'gate-c').active, false, 'the third lower-tier gate should break from a real kick');

  const drainedBeforeFixture = state.progress.drained;
  await page.evaluate(() => window.__KICKFALL_DEBUG__.prepareDrain());
  await advance(page, 2000);
  state = await readState(page);
  assert.equal(state.progress.drained, drainedBeforeFixture + 1, 'a ball falling through the bottom-left exit should count as drained');

  await page.evaluate(() => window.__KICKFALL_DEBUG__.forceVictory());
  state = await readState(page);
  assert.equal(state.mode, 'victory');
  assert.equal(state.progress.drained, 8);
  assert.equal(state.level.number, 1);
  assert.deepEqual(state.actions, ['retry', 'continue', 'main menu']);
  assert.ok(state.audio.gameEffectPlays.levelFinished >= 1, 'winning a Kickfall level should use the supplied finish cue');
  await capture(page, `${output}/01-kickfall-victory.png`);

  await touchControl(page, 640, 490, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  state = await readState(page);
  assert.deepEqual(state.level, {
    number: 2,
    maxLevel: 20,
    hasNext: true,
    tierModes: ['downhill', 'downhill', 'downhill', 'downhill'],
  });
  assert.deepEqual(state.campaign, { highestUnlockedLevel: 2, lastPlayedLevel: 2 });
  assert.deepEqual(state.timer, { enabled: true, totalSeconds: 60, remainingSeconds: 60 });
  assert.equal(state.progress.quota, 10);
  assert.equal(state.spawn.intervalSeconds, 2.65);
  assert.deepEqual(state.obstacles.map(({ id, type, tierId }) => ({ id, type, tierId })), [
    { id: 'pocket-a', type: 'pocket', tierId: 'upper' },
    { id: 'cleat-a', type: 'cleat', tierId: 'lower' },
  ]);
  await capture(page, `${output}/01-kickfall-level-2.png`);

  const topLaneBallId = await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.startPlaying();
    window.__KICKFALL_DEBUG__.clearBalls();
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    scene.spawnTimer = 999;
    return scene.spawnBall({ x: 490, y: 158, vx: 0, vy: 0 }).id;
  });
  await advance(page, 40);
  state = await readState(page);
  const topLaneBall = state.balls.find((ball) => ball.id === topLaneBallId);
  assert.equal(
    topLaneBall.stalledObstacleId,
    null,
    'an upper-lane pocket must not capture a ball directly above it on the top lane',
  );
  assert.ok(topLaneBall.y < 220, 'a top-lane ball must remain on its own lane above the pocket');
  await page.waitForTimeout(180);
  await capture(page, `${output}/01-kickfall-pocket-lane-guard.png`);

  const magneticBallFixture = await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.clearBalls();
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    const obstacle = scene.obstacles.find((candidate) => candidate.id === 'pocket-a');
    scene.spawnTimer = 999;
    const startX = obstacle.holdX - obstacle.flow * 44;
    const ball = scene.spawnBall({ x: startX, y: obstacle.holdY, vx: obstacle.flow * 2.2, vy: 0 });
    ball.spawnedAt = scene.simulationSeconds;
    return { id: ball.id, startX, targetX: obstacle.holdX };
  });
  await advance(page, 64);
  state = await readState(page);
  const attractingPocketBall = state.balls.find((ball) => ball.id === magneticBallFixture.id);
  assert.equal(attractingPocketBall.stalledObstacleId, 'pocket-a');
  assert.equal(attractingPocketBall.magnetCapture?.phase, 'attracting');
  assert.ok(
    attractingPocketBall.x > magneticBallFixture.targetX + 4
      && attractingPocketBall.x < magneticBallFixture.startX,
    `a pocket must visibly pull its ball through space instead of teleporting it; ${JSON.stringify(attractingPocketBall)}`,
  );
  await capture(page, `${output}/01-kickfall-pocket-magnet-pull.png`);
  await advance(page, 340);
  state = await readState(page);
  const heldMagneticBall = state.balls.find((ball) => ball.id === magneticBallFixture.id);
  assert.equal(heldMagneticBall.magnetCapture?.phase, 'held');
  assert.ok(Math.abs(heldMagneticBall.x - magneticBallFixture.targetX) <= 1);

  const displacedCaptureFixture = await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.clearBalls();
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    const obstacle = scene.obstacles.find((candidate) => candidate.id === 'pocket-a');
    const ball = scene.spawnBall({
      x: obstacle.holdX - obstacle.flow * 42,
      y: obstacle.holdY,
      vx: obstacle.flow * 2,
      vy: 0,
    });
    return { id: ball.id, targetX: obstacle.holdX, targetY: obstacle.holdY };
  });
  await advance(page, 40);
  await page.evaluate((id) => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    const ball = scene.balls.find((candidate) => candidate.id === id);
    ball.body.setPosition(ball.body.x, ball.body.y - 52);
  }, displacedCaptureFixture.id);
  await advance(page, 420);
  state = await readState(page);
  const recoveredCaptureBall = state.balls.find((ball) => ball.id === displacedCaptureFixture.id);
  assert.equal(
    recoveredCaptureBall.magnetCapture?.phase,
    'held',
    'a captured ball displaced outside lane tolerance must not freeze in the attracting phase',
  );
  assert.ok(Math.abs(recoveredCaptureBall.x - displacedCaptureFixture.targetX) <= 1);
  assert.ok(Math.abs(recoveredCaptureBall.y - displacedCaptureFixture.targetY) <= 1);
  await capture(page, `${output}/01-kickfall-pocket-capture-watchdog.png`);

  const pocketQueueIds = await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.clearBalls();
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    const obstacle = scene.obstacles.find((candidate) => candidate.id === 'pocket-a');
    scene.spawnTimer = 999;
    const lead = scene.spawnBall({ x: obstacle.holdX, y: obstacle.holdY, vx: 0, vy: 0 });
    lead.stalledObstacleId = obstacle.id;
    const trailing = scene.spawnBall({ x: obstacle.holdX + 72, y: obstacle.holdY - 2, vx: -7, vy: 0 });
    return { leadId: lead.id, trailingId: trailing.id };
  });
  await advance(page, 320);
  state = await readState(page);
  const leadPocketBall = state.balls.find((ball) => ball.id === pocketQueueIds.leadId);
  const trailingPocketBall = state.balls.find((ball) => ball.id === pocketQueueIds.trailingId);
  assert.equal(leadPocketBall.stalledObstacleId, 'pocket-a');
  assert.equal(
    trailingPocketBall.stalledObstacleId,
    null,
    'only the lead ball should be captured; following balls must queue through physical collisions',
  );
  assert.ok(
    Math.hypot(leadPocketBall.x - trailingPocketBall.x, leadPocketBall.y - trailingPocketBall.y) >= 34,
    'queued balls should remain visually distinguishable instead of sharing one hold position',
  );
  const pocketPromptClearance = await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    const obstacle = scene.obstacles.find((candidate) => candidate.id === 'pocket-a');
    const label = obstacle.visualObjects.find((object) => typeof object.text === 'string');
    return {
      labelBottom: label.y + label.height / 2,
      captiveBallTop: obstacle.holdY - 18,
    };
  });
  assert.ok(
    pocketPromptClearance.labelBottom < pocketPromptClearance.captiveBallTop - 3,
    `the pocket prompt must sit above the captive ball; ${JSON.stringify(pocketPromptClearance)}`,
  );
  await page.waitForTimeout(180);
  await capture(page, `${output}/01-kickfall-pocket-queue.png`);

  const pocketBallId = await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.startPlaying();
    return window.__KICKFALL_DEBUG__.prepareObstacleKick('pocket-a');
  });
  await advance(page, 100);
  state = await readState(page);
  assert.equal(state.balls.find((ball) => ball.id === pocketBallId).stalledObstacleId, 'pocket-a');
  await hold(page, 'x', 80);
  state = await readState(page);
  const flashingPocket = state.obstacles.find((obstacle) => obstacle.id === 'pocket-a');
  assert.equal(flashingPocket.flashCount, 1, 'kicking a trapped ball should pulse its pocket once');
  assert.ok(flashingPocket.flashSeconds > 0, 'the pocket damage pulse should remain visible after contact');
  assert.ok(flashingPocket.flashAlpha >= 0.35, `the pocket should be visibly red during its pulse; alpha=${flashingPocket.flashAlpha}`);
  await capture(page, `${output}/01-kickfall-pocket-kick-flash.png`);
  await advance(page, 180);
  state = await readState(page);
  assert.ok(state.balls.find((ball) => ball.id === pocketBallId).passedObstacleIds.includes('pocket-a'));
  assert.equal(state.obstacles.find((obstacle) => obstacle.id === 'pocket-a').releasedBalls, 1);

  const cleatQueueIds = await page.evaluate(() => {
    const leadId = window.__KICKFALL_DEBUG__.prepareObstacleKick('cleat-a');
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    const obstacle = scene.obstacles.find((candidate) => candidate.id === 'cleat-a');
    const trailing = scene.spawnBall({ x: obstacle.holdX - 72, y: obstacle.holdY - 2, vx: 7, vy: 0 });
    return { leadId, trailingId: trailing.id };
  });
  await advance(page, 320);
  state = await readState(page);
  const leadCleatBall = state.balls.find((ball) => ball.id === cleatQueueIds.leadId);
  const trailingCleatBall = state.balls.find((ball) => ball.id === cleatQueueIds.trailingId);
  assert.equal(leadCleatBall.stalledObstacleId, 'cleat-a');
  assert.equal(trailingCleatBall.stalledObstacleId, null, 'the cleat should retain only its lead ball');
  assert.ok(
    Math.hypot(leadCleatBall.x - trailingCleatBall.x, leadCleatBall.y - trailingCleatBall.y) >= 34,
    'balls behind the cleat should form a visible physical queue',
  );
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').cameras.main.resetFX());
  await advance(page, 40);
  await page.waitForTimeout(500);
  await capture(page, `${output}/01-kickfall-cleat-queue.png`);
  await hold(page, 'x', 80);
  state = await readState(page);
  const flashingCleat = state.obstacles.find((obstacle) => obstacle.id === 'cleat-a');
  assert.equal(flashingCleat.flashCount, 1, 'the shared trap pulse should also cover the cleat obstacle');
  assert.ok(flashingCleat.flashAlpha >= 0.35, `the cleat should be visibly red during its pulse; alpha=${flashingCleat.flashAlpha}`);
  await advance(page, 180);
  state = await readState(page);
  assert.ok(
    state.balls.find((ball) => ball.id === cleatQueueIds.leadId).passedObstacleIds.includes('cleat-a'),
    'a kick should prioritize and release the captive lead ball even when another ball is queued behind it',
  );
  assert.equal(state.obstacles.find((obstacle) => obstacle.id === 'cleat-a').releasedBalls, 1);
  assert.equal(state.progress.obstacleClears, 2);
  await page.waitForTimeout(180);
  await capture(page, `${output}/01-kickfall-level-2-obstacles.png`);

  const pocketPressureIds = await page.evaluate(
    () => window.__KICKFALL_DEBUG__.prepareObstacleQueue('pocket-a', 4),
  );
  assert.equal(pocketPressureIds.length, 4);
  await kickKickfallObstacleQueue(page, 'pocket-a');
  state = await readState(page);
  let pressuredPocket = state.obstacles.find((obstacle) => obstacle.id === 'pocket-a');
  assert.ok(
    pressuredPocket.pressure > 0 && pressuredPocket.pressure < pressuredPocket.resistance,
    `one rear kick should visibly pressure but not release the strong pocket; ${JSON.stringify(pressuredPocket)}`,
  );
  assert.equal(pressuredPocket.lastImpactHops, 3);
  assert.equal(pressuredPocket.stalledBallId, pocketPressureIds[0]);
  assert.equal(state.forceSystem.comboMultiplier, 1);
  await capture(page, `${output}/01-kickfall-pocket-pressure-first-hit.png`);

  await kickKickfallObstacleQueue(page, 'pocket-a');
  state = await readState(page);
  pressuredPocket = state.obstacles.find((obstacle) => obstacle.id === 'pocket-a');
  assert.ok(
    pressuredPocket.pressure > 1 && pressuredPocket.pressure < pressuredPocket.resistance,
    `two rapid rear kicks should build pressure without trivializing the pocket; ${JSON.stringify(pressuredPocket)}`,
  );
  assert.equal(state.forceSystem.comboMultiplier, 1.25);

  await kickKickfallObstacleQueue(page, 'pocket-a');
  state = await readState(page);
  pressuredPocket = state.obstacles.find((obstacle) => obstacle.id === 'pocket-a');
  assert.equal(pressuredPocket.pressure, 0);
  assert.equal(state.forceSystem.comboMultiplier, 1.5);
  assert.ok(
    state.balls.find((ball) => ball.id === pocketPressureIds[0]).passedObstacleIds.includes('pocket-a'),
    'the pressure wave should free the captive endpoint instead of only moving the intervening balls',
  );
  assert.notEqual(
    pressuredPocket.stalledBallId,
    pocketPressureIds[0],
    `the third rapid rear kick should release the original pocket captive; ${JSON.stringify(pressuredPocket)}`,
  );
  await capture(page, `${output}/01-kickfall-pocket-pressure-release.png`);

  const cleatPressureIds = await page.evaluate(
    () => window.__KICKFALL_DEBUG__.prepareObstacleQueue('cleat-a', 4),
  );
  await kickKickfallObstacleQueue(page, 'cleat-a');
  state = await readState(page);
  const cleatAfterOnePressureHit = state.obstacles.find((obstacle) => obstacle.id === 'cleat-a');
  assert.ok(
    cleatAfterOnePressureHit.pressure > 0
      && cleatAfterOnePressureHit.pressure < cleatAfterOnePressureHit.resistance,
    'one remote kick should not release the medium cleat through three intervening balls',
  );
  await kickKickfallObstacleQueue(page, 'cleat-a');
  state = await readState(page);
  const pressuredCleat = state.obstacles.find((obstacle) => obstacle.id === 'cleat-a');
  assert.ok(
    state.balls.find((ball) => ball.id === cleatPressureIds[0]).passedObstacleIds.includes('cleat-a'),
  );
  assert.notEqual(
    pressuredCleat.stalledBallId,
    cleatPressureIds[0],
    'the weaker cleat should release its original captive after two rapid rear kicks',
  );

  await page.evaluate(() => {
    window.__SKYHEAD_GAME__.scene.getScene('Kickfall').language = 'es';
  });
  assert.equal(await page.evaluate(() => window.__KICKFALL_DEBUG__.forceTimeout()), true);
  await advance(page, 80);
  state = await readState(page);
  assert.equal(state.mode, 'defeat');
  assert.equal(state.defeatReason, 'timeout');
  assert.deepEqual(state.actions, ['retry', 'main menu']);
  const timeoutModal = await page.evaluate(() => {
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    const bounds = (object) => {
      const value = object.getBounds();
      return {
        left: value.left,
        right: value.right,
        top: value.top,
        bottom: value.bottom,
        width: value.width,
        height: value.height,
      };
    };
    return {
      panel: bounds(scene.resultPanel),
      title: bounds(scene.resultTitle),
      copy: bounds(scene.resultCopy),
      progress: bounds(scene.resultProgress),
      retry: bounds(scene.retryButton.background),
      menu: bounds(scene.resultMenuButton.background),
      copyText: scene.resultCopy.text,
      retryLabel: scene.retryButton.text.text,
      menuLabel: scene.resultMenuButton.text.text,
    };
  });
  for (const key of ['title', 'copy', 'progress', 'retry', 'menu']) {
    assert.ok(timeoutModal[key].left >= timeoutModal.panel.left, `${key} should stay inside the result card on the left`);
    assert.ok(timeoutModal[key].right <= timeoutModal.panel.right, `${key} should stay inside the result card on the right`);
    assert.ok(timeoutModal[key].top >= timeoutModal.panel.top, `${key} should stay inside the result card at the top`);
    assert.ok(timeoutModal[key].bottom <= timeoutModal.panel.bottom, `${key} should stay inside the result card at the bottom`);
  }
  assert.ok(timeoutModal.copy.width <= 580, 'the long Spanish timeout copy should wrap to the designed measure');
  assert.equal(timeoutModal.retry.top, timeoutModal.menu.top, 'the two defeat actions should share one compact row');
  assert.match(timeoutModal.copyText, /Se acabó el tiempo/);
  assert.equal(timeoutModal.retryLabel, 'REINTENTAR');
  assert.equal(timeoutModal.menuLabel, 'MENÚ PRINCIPAL');
  await capture(page, `${output}/01-kickfall-level-2-timeout-es.png`);

  await touchControl(page, 520, 490, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  assert.equal((await readState(page)).level.number, 2, 'Retry should preserve the current Kickfall level');

  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').scene.restart({ level: 3 }));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  state = await readState(page);
  assert.equal(state.level.number, 3);
  assert.deepEqual(state.lanes.map(({ mode }) => mode), ['flat', 'downhill', 'downhill', 'downhill']);
  assert.deepEqual(state.landingGuides, [], 'the top feed already leaves room behind its spawned ball');
  const manualBallId = await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.startPlaying();
    return window.__KICKFALL_DEBUG__.prepareFlowBall('top');
  });
  const manualBallStart = (await readState(page)).balls.find((ball) => ball.id === manualBallId).x;
  await advance(page, 450);
  state = await readState(page);
  const manualBall = state.balls.find((ball) => ball.id === manualBallId);
  assert.ok(Math.abs(manualBall.x - manualBallStart) < 8, `a flat lane must not carry an untouched ball; moved ${manualBall.x - manualBallStart}`);
  assert.ok(Math.abs(manualBall.vx) < 0.8, `a flat lane must require active pushing; vx=${manualBall.vx}`);
  await capture(page, `${output}/01-kickfall-level-3-flat.png`);

  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').scene.restart({ level: 4 }));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  state = await readState(page);
  const upperLandingGuide = state.landingGuides.find(({ tierId }) => tierId === 'upper');
  assert.ok(upperLandingGuide, 'the right-entry flat upper lane should have a receiving wedge');
  assert.equal(upperLandingGuide.height, 54, 'the receiving wedge must leave player-sized vertical clearance');
  const playerDropFixture = await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.startPlaying();
    return window.__KICKFALL_DEBUG__.prepareLandingGuidePlayerDrop('upper');
  });
  await advance(page, 520);
  state = await readState(page);
  assert.equal(state.player.tierId, 'upper', 'a player falling at the receiving corner must reach the lane below');
  assert.equal(state.player.grounded, true, 'the player must land instead of remaining wedged in the corner');
  assert.ok(
    state.player.y >= playerDropFixture.expectedLandingY - 4,
    `the player should fall through the ball guide onto the lane; ${JSON.stringify(state.player)}`,
  );
  await capture(page, `${output}/01-kickfall-level-4-player-clearance.png`);
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').recoverPlayer());
  const flatDropBallId = await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.startPlaying();
    return window.__KICKFALL_DEBUG__.prepareLandingGuideDrop('upper');
  });
  const flatDropStart = (await readState(page)).balls.find(({ id }) => id === flatDropBallId);
  await advance(page, 1150);
  state = await readState(page);
  const flatDropBall = state.balls.find(({ id }) => id === flatDropBallId);
  await capture(page, `${output}/01-kickfall-level-4-flat-entry-wedge.png`);
  assert.ok(
    flatDropStart.x - flatDropBall.x >= 70,
    `the mirrored receiving wedge should carry a falling ball inward; moved ${flatDropStart.x - flatDropBall.x}px`,
  );
  assert.ok(
    1220 - flatDropBall.x >= 180,
    `the wedge must leave enough space to stand behind and kick left; clearance=${1220 - flatDropBall.x}px`,
  );
  assert.ok(flatDropBall.passedLandingGuideIds.includes('flat-entry-upper'));

  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').scene.restart({ level: 5 }));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  state = await readState(page);
  assert.equal(state.gates.find((gate) => gate.id === 'gate-b').health, 2);
  await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.startPlaying();
    window.__KICKFALL_DEBUG__.prepareGateKick('gate-b');
  });
  await hold(page, 'x', 80);
  state = await readState(page);
  assert.deepEqual(
    [state.gates.find((gate) => gate.id === 'gate-b').active, state.gates.find((gate) => gate.id === 'gate-b').health],
    [true, 1],
    'a reinforced gate should survive its first direct armed hit',
  );
  await page.evaluate(() => window.__KICKFALL_DEBUG__.prepareGateKick('gate-b'));
  await hold(page, 'x', 80);
  assert.equal((await readState(page)).gates.find((gate) => gate.id === 'gate-b').active, false);
  await capture(page, `${output}/01-kickfall-level-5-reinforced.png`);

  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').scene.restart({ level: 6 }));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  state = await readState(page);
  assert.equal(state.lanes[0].mode, 'uphill');
  assert.ok(state.lanes[0].angle < 0 && state.lanes[0].rollAssist < 0);
  const uphillBallId = await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.startPlaying();
    return window.__KICKFALL_DEBUG__.prepareFlowBall('top');
  });
  const uphillBallStart = (await readState(page)).balls.find((ball) => ball.id === uphillBallId).x;
  await advance(page, 700);
  state = await readState(page);
  assert.ok(
    state.balls.find((ball) => ball.id === uphillBallId).x < uphillBallStart - 8,
    `an untouched uphill ball should roll backward against the route; ${JSON.stringify(state.balls.find((ball) => ball.id === uphillBallId))}`,
  );
  await capture(page, `${output}/01-kickfall-level-6-uphill.png`);

  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').scene.restart({ level: 7 }));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  const receiverPileFixture = await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.startPlaying();
    return window.__KICKFALL_DEBUG__.prepareReceiverPileEscape('upper');
  });
  state = await readState(page);
  assert.equal(state.player.grounded, true, 'a player resting on a receiver ball pile should have jump footing');
  assert.ok(
    receiverPileFixture.ballIds.includes(state.player.supportingBallId),
    `the receiver pile should identify one of its supporting balls; ${JSON.stringify(state.player)}`,
  );
  await capture(page, `${output}/01-kickfall-level-7-receiver-pile-stuck.png`);
  await hold(page, 'x', 40);
  state = await readState(page);
  assert.ok(
    receiverPileFixture.ballIds.includes(state.player.lastKickedBallId),
    `kick should release a supporting pile ball when no forward target is reachable; ${JSON.stringify(state.player)}`,
  );
  assert.ok(
    state.balls.find((ball) => ball.id === state.player.lastKickedBallId).vx < -1,
    'the pile kick should send its support ball inward along the upper lane',
  );
  await capture(page, `${output}/01-kickfall-level-7-receiver-pile-kick-escape.png`);
  const jumpPileFixture = await page.evaluate(() => window.__KICKFALL_DEBUG__.prepareReceiverPileEscape('upper'));
  state = await readState(page);
  assert.equal(state.player.grounded, true, 'reset receiver pile should still provide jump footing');
  await hold(page, 'Space', 60);
  state = await readState(page);
  assert.ok(state.player.vy < -4.5, `jump should launch cleanly from the receiver pile; vy=${state.player.vy}`);
  assert.ok(
    state.player.y < jumpPileFixture.startY - 8,
    `jump should move the player away from the pile; start=${jumpPileFixture.startY}, y=${state.player.y}`,
  );
  assert.equal(state.player.supportingBallId, null, 'the launched player should no longer be treated as ball-supported');
  await capture(page, `${output}/01-kickfall-level-7-receiver-pile-escape.png`);

  const gravityPileFixture = await page.evaluate(
    () => window.__KICKFALL_DEBUG__.prepareReceiverGravityPile('upper', 7),
  );
  assert.equal(gravityPileFixture.ballIds.length, 7);
  await advance(page, 6000);
  state = await readState(page);
  const settledGravityBalls = state.balls.filter(
    (ball) => gravityPileFixture.ballIds.includes(ball.id),
  );
  const gravityXs = settledGravityBalls.map((ball) => ball.x);
  const gravityYs = settledGravityBalls.map((ball) => ball.y);
  const gravityHorizontalSpan = Math.max(...gravityXs) - Math.min(...gravityXs);
  const gravityVerticalSpan = Math.max(...gravityYs) - Math.min(...gravityYs);
  assert.ok(
    gravityHorizontalSpan >= 155,
    `seven uphill balls should remain a broad lane queue; horizontal span=${gravityHorizontalSpan}`,
  );
  assert.ok(
    gravityVerticalSpan <= 55,
    `ramp gravity must roll balls back down instead of building a column; vertical span=${gravityVerticalSpan}`,
  );
  assert.ok(
    settledGravityBalls.filter((ball) => (
      (ball.x - gravityPileFixture.entryX) * gravityPileFixture.flow
        < gravityPileFixture.width
    )).length <= 1,
    `at most one moving ball may be traversing the ramp; ${JSON.stringify(settledGravityBalls)}`,
  );
  await capture(page, `${output}/01-kickfall-level-7-receiver-gravity-pile.png`);

  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').scene.restart({ level: 10 }));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  state = await readState(page);
  assert.deepEqual([state.level.number, state.boss.health, state.boss.active], [10, 3, true]);
  const bossKickQueue = await page.evaluate(() => {
    window.__KICKFALL_DEBUG__.startPlaying();
    window.__KICKFALL_DEBUG__.clearBalls();
    const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
    scene.boss.kickCooldown = 0;
    return Array.from({ length: 4 }, (_, index) => {
      const ball = scene.spawnBall({
        x: scene.boss.sprite.x + 54 + index * 38,
        y: scene.boss.sprite.y + 22,
        vx: 0,
        vy: 0,
      });
      return { id: ball.id, startX: ball.body.x };
    });
  });
  await advance(page, 80);
  state = await readState(page);
  const counteredQueue = bossKickQueue.map(({ id }) => state.balls.find((ball) => ball.id === id));
  assert.ok(counteredQueue.every((ball) => ball.vx > 9), 'the saboteur counter-shot should reverse the touching queue');
  await advance(page, 360);
  state = await readState(page);
  bossKickQueue.forEach(({ id, startX }) => {
    const ball = state.balls.find((candidate) => candidate.id === id);
    assert.ok(ball.x > startX + 115, `boss-countered ball ${id} should be sent visibly backward; ${JSON.stringify(ball)}`);
  });
  await capture(page, `${output}/01-kickfall-level-10-boss-counter.png`);
  const bossStartX = state.boss.x;
  for (let hit = 0; hit < 3; hit += 1) {
    await page.evaluate(() => window.__KICKFALL_DEBUG__.prepareBossHit());
    await hold(page, 'x', 80);
    await advance(page, 180);
  }
  state = await readState(page);
  assert.equal(state.boss.defeated, true);
  assert.ok(state.boss.x === null || state.boss.x < bossStartX - 150, 'player-kicked balls should drive the rival toward the drain');
  await capture(page, `${output}/01-kickfall-level-10-boss.png`);

  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').scene.restart({ level: 20 }));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  state = await readState(page);
  assert.equal(state.level.number, 20);
  assert.equal(state.level.hasNext, false);
  assert.equal(state.boss.maxHealth, 5);
  assert.deepEqual(state.level.tierModes, ['uphill', 'flat', 'uphill', 'downhill']);
  assert.equal(state.progress.quota, 18);
  await capture(page, `${output}/01-kickfall-level-20-finale.png`);

  const campaignRouteAudit = [];
  for (let levelNumber = 1; levelNumber <= 20; levelNumber += 1) {
    await page.evaluate((level) => {
      window.__SKYHEAD_GAME__.scene.getScene('Kickfall').scene.restart({ level });
    }, levelNumber);
    await page.waitForFunction(
      (level) => {
        const snapshot = JSON.parse(window.render_game_to_text());
        return snapshot.mode === 'countdown' && snapshot.level?.number === level;
      },
      levelNumber,
    );
    state = await readState(page);
    assert.equal(state.routeAudit.valid, true, `Level ${levelNumber} route audit: ${state.routeAudit.issues.join('; ')}`);
    assert.deepEqual(state.routeAudit.issues, []);
    assert.ok(
      state.routeAudit.finishWindowSeconds >= 30,
      `Level ${levelNumber} must leave a useful finish window after its last spawn`,
    );
    const expectedReceiverTierIds = state.lanes
      .slice(1)
      .filter(({ mode }) => mode !== 'downhill')
      .map(({ id }) => id);
    assert.deepEqual(
      state.routeAudit.receivers.map(({ tierId }) => tierId),
      expectedReceiverTierIds,
      `Level ${levelNumber} must protect every flat/uphill receiving wall`,
    );
    assert.ok(state.routeAudit.receivers.every(({ receiverClear }) => receiverClear));

    const receiverResults = [];
    for (const tierId of expectedReceiverTierIds) {
      const fixture = await page.evaluate((receiverTierId) => {
        window.__KICKFALL_DEBUG__.startPlaying();
        const id = window.__KICKFALL_DEBUG__.prepareLandingGuideDrop(receiverTierId);
        const snapshot = JSON.parse(window.render_game_to_text());
        const guide = snapshot.landingGuides.find(({ tierId: idToMatch }) => idToMatch === receiverTierId);
        return { ballId: id, guide };
      }, tierId);
      assert.ok(fixture.ballId, `Level ${levelNumber} ${tierId} receiver fixture must spawn a ball`);
      await advance(page, 1200);
      state = await readState(page);
      const receivedBall = state.balls.find(({ id }) => id === fixture.ballId);
      assert.ok(receivedBall, `Level ${levelNumber} ${tierId} receiver must retain its test ball`);
      const entryClearance = Math.abs(receivedBall.x - fixture.guide.entryX);
      assert.ok(
        entryClearance >= 100,
        `Level ${levelNumber} ${tierId} must leave player space behind the received ball; clearance=${entryClearance}`,
      );
      assert.ok(
        receivedBall.passedLandingGuideIds.includes(fixture.guide.id),
        `Level ${levelNumber} ${tierId} receiver must hand the ball onto the lane`,
      );
      const kickAccess = await page.evaluate(({ ballId, receiverTierId }) => {
        const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
        const ball = scene.balls.find(({ id }) => id === ballId);
        const tier = scene.getTier(receiverTierId);
        const playerX = ball.body.x - tier.flow * 46;
        const minX = Math.max(58, tier.left + 22);
        const maxX = Math.min(1222, tier.left + tier.width - 22);
        scene.player.setPosition(playerX, ball.body.y - 24);
        scene.player.setVelocity(0, 0);
        scene.currentTierId = tier.id;
        scene.setFacing(tier.flow);
        scene.groundedUntil = scene.simulationSeconds + 1;
        scene.kickCooldown = 0;
        return {
          playerX,
          minX,
          maxX,
          directKickConnected: scene.startKick(),
        };
      }, { ballId: fixture.ballId, receiverTierId: tierId });
      assert.ok(
        kickAccess.playerX >= kickAccess.minX && kickAccess.playerX <= kickAccess.maxX,
        `Level ${levelNumber} ${tierId} must have a legal standing coordinate behind the ball; ${JSON.stringify(kickAccess)}`,
      );
      assert.equal(
        kickAccess.directKickConnected,
        true,
        `Level ${levelNumber} ${tierId} received ball must remain directly kickable`,
      );
      receiverResults.push({ tierId, entryClearance, kickAccess });
      await advance(page, 80);
    }
    await capture(page, `${output}/01-kickfall-audit-level-${String(levelNumber).padStart(2, '0')}.png`);
    campaignRouteAudit.push({
      level: levelNumber,
      valid: state.routeAudit.valid,
      tierModes: state.level.tierModes,
      finishWindowSeconds: state.routeAudit.finishWindowSeconds,
      gateHealth: state.gates.map(({ id, maxHealth }) => ({ id, maxHealth })),
      obstacles: state.obstacles.map(({ id, type, tierId }) => ({ id, type, tierId })),
      bossHits: state.boss?.maxHealth ?? 0,
      receivers: receiverResults,
    });
  }
  await writeFile(
    `${output}/01-kickfall-campaign-audit.json`,
    JSON.stringify(campaignRouteAudit, null, 2),
  );

  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').scene.start('Intro'));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await touchControl(page, 430, 493, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'mini-games');
  await touchControl(page, 345, 294, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'minigame-setup');
  state = await readState(page);
  assert.deepEqual(state.progress, { highestUnlockedLevel: 2, lastPlayedLevel: 2 });
  assert.ok(state.actions.includes('continue Kickfall'));
  assert.ok(state.actions.includes('start Kickfall from level 1'));
  await capture(page, `${output}/01-kickfall-resume-choice.png`);
  await touchControl(page, 745, 620, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  assert.equal((await readState(page)).level.number, 2);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'paused');
  await touchControl(page, 775, 475, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).modal === 'abandon-confirm');
  await touchControl(page, 775, 438, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'minigame-setup');
  await touchControl(page, 82, 52, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'mini-games');
  await touchControl(page, 82, 52, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  state = await readState(page);
  assert.equal(state.playerCharacter.id, 'joel');

  await touchControl(page, 640, 252, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  state = await readState(page);
  assert.deepEqual(await page.evaluate(() => {
    const textures = window.__SKYHEAD_GAME__.textures;
    return Object.fromEntries(['arena-skycourt', 'arena-neon', 'arena-beach']
      .map((key) => [key, textures.exists(key)]));
  }), {
    'arena-skycourt': true,
    'arena-neon': true,
    'arena-beach': true,
  }, 'opening Match Playground should lazily load the two alternative arena images');
  assert.deepEqual(state.arena.available.map(({ id }) => id), ['skycourt', 'neon', 'beach']);
  assert.deepEqual(state.ballType.available.map(({ id }) => id), [
    'classic', 'neon-ball', 'balloon', 'rugby', 'soda-can', 'cannonball',
  ]);
  assert.equal(state.ballType.id, 'classic');
  await touchControl(page, 580, 430, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).arena?.id === 'neon');
  await touchControl(page, 1155, 430, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).ballType?.id === 'neon-ball');
  await touchControl(page, 1155, 430, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).ballType?.id === 'balloon');
  state = await readState(page);
  assert.equal(state.arena.id, 'neon');
  assert.equal(state.ballType.id, 'balloon');
  assert.equal(state.ballType.family, 'balloon');
  assert.ok(state.ballType.liftScale > 1 && state.ballType.frictionAir > 0.01);
  await capture(page, `${output}/01-customize-neon-balloon.png`);

  await touchControl(page, 580, 430, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).arena?.id === 'beach');
  for (const id of ['rugby', 'soda-can', 'cannonball']) {
    await touchControl(page, 1155, 430, 35);
    await page.waitForFunction((nextId) => JSON.parse(window.render_game_to_text()).ballType?.id === nextId, id);
  }
  state = await readState(page);
  assert.equal(state.arena.id, 'beach');
  assert.equal(state.ballType.id, 'cannonball');
  assert.ok(state.ballType.density > 0.007 && state.ballType.liftScale < 0.6);
  await capture(page, `${output}/01-customize-beach-cannonball.png`);
  await touchControl(page, 785, 660, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(page, 3200);
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(480);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1020);
    window.__SKYHEAD_DEBUG__.setBall({ x: 590, y: 560 });
    window.__SKYHEAD_DEBUG__.humanKick();
  });
  await advance(page, 140);
  state = await readState(page);
  assert.deepEqual(state.customization, { arenaThemeId: 'beach', ballTypeId: 'cannonball' });
  assert.equal(state.ball.family, 'cannonball');
  assert.equal(state.ball.shape, 'circle');
  assert.equal(state.ball.density, 0.0075);
  assert.equal(state.ball.speedScale, 0.7);
  assert.equal(state.ball.liftScale, 0.58);
  assert.ok(state.ball.vx > 8 && state.ball.vx < 14, `the cannonball should leave a normal kick slowly; vx=${state.ball.vx}`);
  assert.ok(state.ball.vy > -5, `the cannonball should resist ordinary kick lift; vy=${state.ball.vy}`);
  await capture(page, `${output}/01-match-beach-cannonball.png`);
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').scene.start('Intro'));
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  assert.deepEqual((await readState(page)).customization, { arenaThemeId: 'beach', ballTypeId: 'cannonball' });
  await touchControl(page, 640, 252, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  await touchControl(page, 580, 430, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).arena?.id === 'skycourt');
  await touchControl(page, 1155, 430, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).ballType?.id === 'classic');
  assert.deepEqual(
    { arena: (await readState(page)).arena.id, ball: (await readState(page)).ballType.id },
    { arena: 'skycourt', ball: 'classic' },
  );
  await touchControl(page, 82, 52, 30);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');

  await touchControl(page, 640, 252, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  for (let step = 0; step < 3; step += 1) {
    await touchControl(page, 375, 205, 35);
    await page.waitForTimeout(60);
  }
  state = await readState(page);
  assert.equal(state.playerCharacter.id, 'juan', 'Uncle Juan should be selectable as the human player');
  assert.equal(state.playerCharacter.name, 'Uncle Juan');
  await capture(page, `${output}/01-football-setup-juan.png`);
  await touchControl(page, 375, 205, 35);
  await page.waitForTimeout(60);
  state = await readState(page);
  assert.equal(state.playerCharacter.id, 'dad', 'Dad should follow Uncle Juan in the selector');
  assert.equal(state.playerCharacter.name, 'Dad');
  await capture(page, `${output}/01-football-setup-dad.png`);
  await touchControl(page, 375, 205, 35);
  await page.waitForTimeout(60);
  state = await readState(page);
  assert.equal(state.playerCharacter.id, 'mum', 'Mum should follow Dad in the selector');
  assert.equal(state.playerCharacter.name, 'Mum');
  await capture(page, `${output}/01-football-setup-mum.png`);
  await touchControl(page, 375, 205, 35);
  await page.waitForTimeout(60);
  state = await readState(page);
  assert.equal(state.playerCharacter.id, 'juanjo', 'Uncle Juanjo should follow Mum in the selector');
  assert.equal(state.playerCharacter.name, 'Uncle Juanjo');
  await capture(page, `${output}/01-football-setup-juanjo.png`);
  await touchControl(page, 375, 205, 35);
  await page.waitForTimeout(60);
  assert.equal((await readState(page)).playerCharacter.id, 'joel', 'the selector should wrap from Juanjo back to Joel');

  await touchControl(page, 785, 205, 35);
  state = await readState(page);
  assert.equal(state.opponent.id, 'lucia', 'the right selector arrow should choose Lucia');
  await capture(page, `${output}/01-football-setup-lucia.png`);
  await touchControl(page, 495, 205, 35);
  assert.equal((await readState(page)).opponent.id, 'bob', 'the left selector arrow should wrap back to Bob');
  await touchControl(page, 785, 205, 35);
  assert.equal((await readState(page)).opponent.id, 'lucia');
  await page.waitForTimeout(60);
  await touchControl(page, 375, 205, 35);
  assert.equal((await readState(page)).playerCharacter.id, 'bob', 'the player selector must skip Lucia while she is selected opposite');
  await touchControl(page, 85, 205, 35);
  assert.equal((await readState(page)).playerCharacter.id, 'joel');
  await touchControl(page, 495, 205, 35);
  assert.equal((await readState(page)).opponent.id, 'bob');
  await page.waitForTimeout(60);
  await touchControl(page, 375, 205, 35);
  assert.equal((await readState(page)).playerCharacter.id, 'lucia', 'Lucia should be selectable as the human player');
  await page.waitForTimeout(60);
  await touchControl(page, 495, 205, 35);
  state = await readState(page);
  assert.deepEqual([state.playerCharacter.id, state.opponent.id], ['lucia', 'joel']);
  await capture(page, `${output}/01-football-setup-lucia-player.png`);
  await page.waitForTimeout(60);
  await touchControl(page, 375, 205, 35);
  state = await readState(page);
  assert.deepEqual([state.playerCharacter.id, state.opponent.id], ['luna', 'joel']);
  await capture(page, `${output}/01-football-setup-luna-player.png`);
  await page.waitForTimeout(60);
  await touchControl(page, 85, 205, 35);
  assert.equal((await readState(page)).playerCharacter.id, 'lucia');

  await touchControl(page, 1218, 52, 30);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).modal === 'help');
  await capture(page, `${output}/01-football-help.png`);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).modal === null);
  await touchControl(page, 82, 52, 30);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');

  await touchControl(page, 44, 48, 30);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).modal === 'about');
  state = await readState(page);
  assert.equal(state.modalAppInfo.version, '1.0.0');
  assert.equal(state.modalAppInfo.build, 'web');
  assert.deepEqual(state.modalCreatorCharacter, { id: 'dad', name: 'Dad' });
  await capture(page, `${output}/01-about.png`);
  await page.evaluate(() => window.__SKYHEAD_PLATFORM_DEBUG__.backForTesting());
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).modal === null);

  await touchControl(page, 1020, 493, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'settings');
  state = await readState(page);
  assert.equal(state.audio.musicRequested, true, 'the first user gesture should unlock menu music');
  assert.equal(state.audio.audienceRequested, false, 'crowd ambience should stay off in menus');
  assert.ok(state.audio.gameEffectPlays.menuEnter >= 1, 'forward navigation should use the supplied menu-enter feedback');
  await page.evaluate(() => window.__SKYHEAD_AUDIO_DEBUG__.warmAll());
  state = await readState(page);
  assert.equal(state.audio.cache.cachedCount, state.audio.cache.total, 'all audio should be reusable from Cache Storage');
  assert.deepEqual(state.difficultyByGame, {
    football: 'normal',
    kickfall: 'normal',
    discHockey: 'normal',
  });
  assert.equal(state.settingsLayout.titleInsidePanel, true, 'the Settings title should stay fully inside the panel');
  assert.equal(state.technicalAudioCacheVisible, false, 'technical audio-cache status should not be shown to players');
  await capture(page, `${output}/01-settings.png`);

  await touchControl(page, 92, 52, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await touchControl(page, 640, 252, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  await touchControl(page, 942, 224, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).difficulty === 'easy');
  assert.equal((await readState(page)).difficulty, 'easy');
  await touchControl(page, 785, 660, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(page, 3200);
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(300);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setOpponentMeter(24);
    window.__SKYHEAD_DEBUG__.setBall({ x: 720, y: 520 });
  });
  await advance(page, 180);
  state = await readState(page);
  assert.equal(state.difficulty, 'easy');
  assert.equal(state.aiAdvancedMechanicsEnabled, false);
  assert.equal(state.lastAiAdvancedIntent.dashDirection, 0, 'Easy AI must not use directional dashes');
  assert.equal(state.lastAiAdvancedIntent.kickBoost, 0, 'Easy AI must not boost kicks');
  assert.equal(state.players.right.dashTimer, 0);
  await page.keyboard.press('Escape');
  await touchControl(page, 775, 475, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).modal === 'abandon-confirm');
  await touchControl(page, 775, 438, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await touchControl(page, 1020, 493, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'settings');
  assert.equal((await readState(page)).difficultyByGame.football, 'easy', 'football difficulty should persist after leaving a match');

  await touchControl(page, 600, 347, 35);
  state = await readState(page);
  assert.equal(state.audio.settings.musicVolume, 0.6, 'the music slider should use touch-friendly five-percent steps');
  const musicMutePoint = await canvasPoint(page, 935, 347);
  await page.mouse.move(musicMutePoint.x, musicMutePoint.y);
  await page.mouse.down();
  state = await readState(page);
  assert.equal(state.audio.settings.musicMuted, true, 'music mute must activate on pointerdown before WebView can cancel the release');
  assert.equal(state.audio.musicRequested, false);
  assert.equal(state.audio.media.musicPaused, true);
  assert.equal(state.audio.media.musicVolume, 0);
  assert.deepEqual(state.audioControls.music, { muted: true, label: 'TURN ON', enabled: true });
  await capture(page, `${output}/01-settings-music-muted.png`);
  await page.mouse.up();
  await page.mouse.down();
  state = await readState(page);
  assert.equal(state.audio.settings.musicMuted, false, 'music Turn On must reactivate on pointerdown');
  assert.equal(state.audio.musicRequested, true);
  assert.equal(state.audio.media.musicVolume, 0.6);
  assert.deepEqual(state.audioControls.music, { muted: false, label: 'MUTE', enabled: true });
  await page.mouse.up();
  await touchControl(page, 935, 517, 35);
  state = await readState(page);
  assert.equal(state.audio.settings.effectsMuted, true, 'effects should have an independent mute switch');
  assert.equal(state.audio.media.ballEffectVolume, 0);
  assert.equal(state.audio.media.whistleEffectVolume, 0);
  assert.deepEqual(state.audioControls.effects, { muted: true, label: 'TURN ON', enabled: true });
  await capture(page, `${output}/01-settings-effects-muted.png`);
  await touchControl(page, 935, 517, 35);
  state = await readState(page);
  assert.equal(state.audio.settings.effectsMuted, false);
  assert.ok(state.audio.media.ballEffectVolume > 0);
  assert.ok(state.audio.media.whistleEffectVolume > 0);
  assert.deepEqual(state.audioControls.effects, { muted: false, label: 'MUTE', enabled: true });
  await touchControl(page, 510, 517, 35);
  assert.equal((await readState(page)).audio.settings.effectsVolume, 0.4);
  await touchControl(page, 685, 188, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).language === 'es');
  state = await readState(page);
  assert.equal(state.mode, 'settings');
  assert.equal(state.audio.settings.musicVolume, 0.6, 'language changes must preserve audio settings');
  assert.equal(state.difficultyByGame.football, 'easy', 'language changes must preserve football difficulty');
  await capture(page, `${output}/01-settings-es.png`);
  await touchControl(page, 640, 640, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');

  state = await readState(page);
  assert.equal(state.language, 'es', 'the Settings language switch should select Spanish');
  await capture(page, `${output}/01-intro-es.png`);

  await touchControl(page, 640, 252, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  await touchControl(page, 1050, 224, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).difficulty === 'normal');
  await touchControl(page, 430, 660, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'power-lab');
  state = await readState(page);
  assert.equal(state.language, 'es');
  assert.equal(state.powers.fireball, 0);
  assert.equal(state.operationMode, 'random');
  assert.equal(state.lastOperation, null);
  assert.ok(!state.actions.includes('select operation'), 'the child should have no operation selector');
  await capture(page, `${output}/01-power-lab-es.png`);

  await touchControl(page, 805, 638, 35);
  state = await readState(page);
  assertAgeAppropriateChallenge(state.challenge);
  assert.equal(state.lastOperation, state.challenge.operation);
  await capture(page, `${output}/01-math-challenge.png`);
  await answerChallenge(page, state.challenge, true);
  state = await readState(page);
  assert.equal(state.challenge?.status, 'success');
  assert.equal(state.powers.fireball, 1, 'a correct answer should earn one selected charge');
  assert.equal(state.mathLockRemainingMs, 0, 'correct answers should not start a penalty');
  assert.ok(state.audio.gameEffectPlays.powerUp >= 1, 'earning a power charge should use the supplied power-up cue');
  await capture(page, `${output}/01-math-success.png`);
  await touchControl(page, 640, 595, 30);
  await touchControl(page, 1090, 638, 30);
  state = await readState(page);
  assert.equal(state.equippedPowerId, 'fireball', 'an earned power should be equipable');

  await touchControl(page, 805, 638, 35);
  state = await readState(page);
  await answerChallenge(page, state.challenge, true);
  await touchControl(page, 640, 595, 30);
  state = await readState(page);
  assert.equal(state.powers.fireball, 2, 'correct challenges should accumulate charges');

  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitThroughSplash(page);
  state = await readState(page);
  assert.equal(state.language, 'es', 'language should persist across refresh');
  assert.equal(state.audio.settings.musicVolume, 0.6, 'music volume should persist across refresh');
  assert.equal(state.audio.settings.effectsVolume, 0.4, 'effects volume should persist across refresh');
  assert.deepEqual(state.difficultyByGame, {
    football: 'normal',
    kickfall: 'normal',
    discHockey: 'normal',
  }, 'per-game difficulties should persist across refresh');
  assert.equal(state.playerCharacter.id, 'lucia', 'the selected player should persist across refresh');
  assert.equal(state.opponent.id, 'joel', 'the selected opponent should persist across refresh');
  await touchControl(page, 640, 252, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  await touchControl(page, 430, 660, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'power-lab');
  state = await readState(page);
  assert.equal(state.powers.fireball, 2, 'earned charges should persist across refresh');
  assert.equal(state.equippedPowerId, 'fireball', 'equipped power should persist across refresh');
  await touchControl(page, 74, 48, 30);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  await touchControl(page, 82, 52, 30);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');

  state = await readState(page);
  const countdownWhistlesBefore = state.audio.whistleRequestedPlays;
  const countdownWhistlePlaysBefore = state.audio.whistlePlays;
  await touchControl(page, 640, 252, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  await touchControl(page, 785, 660, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  state = await readState(page);
  assert.equal(state.players.left.visualFrame, 0);
  assert.equal(state.players.right.visualFrame, 0);
  assert.ok(Math.abs(state.players.left.visualGroundAnchorY - 636) < 0.2, `left kickoff foot anchor should be 636; got ${state.players.left.visualGroundAnchorY}`);
  assert.ok(Math.abs(state.players.right.visualGroundAnchorY - 636) < 0.2, `right kickoff foot anchor should be 636; got ${state.players.right.visualGroundAnchorY}`);
  assert.equal(state.players.left.visualGroundAnchorY, state.players.right.visualGroundAnchorY);
  await advance(page, 3200);
  state = await readState(page);
  assert.equal(state.mode, 'playing');
  assert.equal(state.opponentProvider, 'heuristic-v1');
  assert.equal(state.players.left.name, 'Lucia');
  assert.equal(state.players.left.id, 'joel');
  assert.equal(state.playerCharacter.id, 'lucia');
  assert.equal(state.opponent.id, 'joel');
  assert.equal(state.players.right.name, 'Joel');
  assert.equal(state.players.left.displayHeight, 280, 'gameplay characters should use the taller natural sprite ratio');
  assert.equal(state.players.right.displayHeight, 280);
  assert.ok(Math.abs(state.players.left.displayWidth / state.players.left.displayHeight - 2 / 3) < 0.01);
  assert.equal(state.players.left.facing, 1, 'the selected player should face the opponent at kickoff');
  assert.equal(state.players.right.facing, -1, 'the selected opponent should face the player at kickoff');
  assert.deepEqual(
    [state.players.left.nativeFacing, state.players.left.visualFlipped],
    [-1, true],
    'Lucia gameplay art should mirror from its native left-facing direction on the player side',
  );
  assert.deepEqual(
    [state.players.right.nativeFacing, state.players.right.visualFlipped],
    [1, true],
    'Joel gameplay art should mirror from its native right-facing direction on the opponent side',
  );
  assert.ok(Math.abs(state.players.left.visualGroundAnchorY - 636) < 0.2);
  assert.ok(Math.abs(state.players.right.visualGroundAnchorY - 636) < 0.2);
  assert.equal(state.players.left.visualGroundAnchorY, state.players.right.visualGroundAnchorY);
  await capture(page, `${output}/02-ground-baseline.png`);
  assert.ok(state.hud.leftName.startsWith('LUCIA'), `the rendered left HUD label should say Lucia; got ${state.hud.leftName}`);
  assert.ok(state.hud.rightName.endsWith('JOEL'), `the rendered right HUD label should say Joel; got ${state.hud.rightName}`);
  assert.equal(state.audio.sceneMode, 'football');
  assert.deepEqual(state.audio.scenePolicy, { music: true, audience: true });
  assert.equal(state.audio.musicRequested, true, 'music should continue into the match');
  assert.equal(state.audio.audienceRequested, true, 'audience ambience should be active only during the match');
  assert.equal(state.audio.whistleRequestedPlays, countdownWhistlesBefore + 3, 'the 3–2–1 countdown should request one whistle per second');
  assert.equal(state.audio.whistlePlays, countdownWhistlePlaysBefore + 3, 'all three countdown whistles should begin playback');
  assert.deepEqual(state.audio.recentWhistles.slice(-3), [
    { label: 'countdown-short', cutoffMs: 180 },
    { label: 'countdown-short', cutoffMs: 180 },
    { label: 'countdown-long', cutoffMs: null },
  ], 'the countdown should sound like beep–beep–beeeeeep');
  assert.equal(state.difficulty, 'normal');
  assert.equal(state.aiAdvancedMechanicsEnabled, true);
  assert.equal(state.controls.chilena, 'double kick: direct; double lob: high arc');

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(340);
    window.__SKYHEAD_DEBUG__.setHumanMeter(0);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 340, y: 390, vx: 0, vy: 12 });
  });
  await advance(page, 100);
  state = await readState(page);
  assert.ok(state.players.left.meter >= 4.5, `a ball landing on the visible head should register contact; meter=${state.players.left.meter}`);
  assert.ok(state.ball.vy < 0, `head contact should rebound the descending ball; vy=${state.ball.vy}`);
  await capture(page, `${output}/02-head-contact-regression.png`);

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(300);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 720, y: 520 });
  });
  await advance(page, 50);
  state = await readState(page);
  assert.equal(state.lastAiAdvancedIntent.dashDirection, -1, 'Normal AI should dash toward a distant defensive target');
  assert.ok(state.players.right.dashTimer > 0 && state.players.right.dashCooldown > 0, 'the shared Fighter mechanic should execute the AI dash intent');
  await capture(page, `${output}/02-ai-directional-dash.png`);

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(300);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(700);
    window.__SKYHEAD_DEBUG__.setOpponentMeter(24);
    window.__SKYHEAD_DEBUG__.setBall({ x: 622, y: 537 });
  });
  await advance(page, 120);
  state = await readState(page);
  assert.equal(state.lastBoostedStrike?.side, 'right', 'Normal AI should use the provider kick-boost intent');
  assert.ok(
    state.lastBoostedStrike?.energySpent >= 8 && state.lastBoostedStrike?.energySpent <= 16,
    'Normal AI should spend one boost step per intent while leaving the maximum mash to Hard',
  );

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(340);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 640, y: 300 });
  });
  state = await readState(page);
  const startingX = state.players.left.x;
  const runPoses = new Set();
  const runVisualFrames = new Set();
  const runAnimationStages = new Set();
  await page.keyboard.down('d');
  for (let sample = 0; sample < 8; sample += 1) {
    await advance(page, 90);
    const player = (await readState(page)).players.left;
    runPoses.add(player.pose);
    runVisualFrames.add(player.visualFrame);
    runAnimationStages.add(player.animationStage);
  }
  await page.keyboard.up('d');
  state = await readState(page);
  const runDistance = state.players.left.x - startingX;
  assert.ok(runDistance > 95, `20%-faster movement should cover the pitch decisively; got ${runDistance}`);
  assert.ok(runPoses.has('run-stride') && runPoses.has('run-contact'), 'running should alternate two leg poses');
  assert.equal(state.players.left.enhancedAnimation, true);
  assert.ok(runVisualFrames.has(6) && runVisualFrames.has(7) && runVisualFrames.has(8), `running should use all three authored drawings; got ${[...runVisualFrames]}`);
  assert.ok(runAnimationStages.has('contact-a') && runAnimationStages.has('contact-b'), 'running should alternate planted feet');
  assert.ok(Math.abs(state.players.left.visualGroundAnchorY - 636) < 0.2, 'running feet should stay registered to the pitch');
  await capture(page, `${output}/02-run-cycle.png`);

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(400);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  await page.keyboard.down('d');
  await advance(page, 35);
  await page.keyboard.up('d');
  await advance(page, 80);
  await page.keyboard.down('d');
  await advance(page, 60);
  state = await readState(page);
  assert.equal(state.players.left.dashDirection, 1, 'double-tapping toward the opponent should dash right');
  assert.ok(state.players.left.dashTimer > 0 && state.players.left.dashCooldown > 0);
  assert.deepEqual(state.humanDashResolution, { direction: 1, purpose: 'challenge' });
  await capture(page, `${output}/02-human-directional-dash.png`);
  await page.keyboard.up('d');
  await advance(page, 180);

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(700);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(900);
    window.__SKYHEAD_DEBUG__.setBall({ x: 600, y: 540 });
    const input = window.__SKYHEAD_GAME__.scene.getScene('Match').inputController;
    input.setTouch('left', true);
    input.setTouch('left', false);
    input.setTouch('left', true);
  });
  await advance(page, 60);
  state = await readState(page);
  assert.equal(
    state.players.left.dashDirection,
    -1,
    `the opposite arrow should create a reverse defensive dash; ${JSON.stringify({ player: state.players.left, intent: state.currentIntent.left, resolution: state.humanDashResolution })}`,
  );
  assert.ok(state.players.left.vx < -8, `reverse dash should produce decisive leftward velocity; vx=${state.players.left.vx}`);
  assert.deepEqual(state.humanDashResolution, { direction: -1, purpose: 'recover-ball' });
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').inputController.setTouch('left', false));
  await capture(page, `${output}/02-human-reverse-dash.png`);

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(400);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  await hold(page, 'Space', 70);
  await page.keyboard.down('d');
  await advance(page, 25);
  await page.keyboard.up('d');
  await advance(page, 60);
  await page.keyboard.down('d');
  await advance(page, 65);
  assert.equal((await readState(page)).players.left.dashCooldown, 0, 'a double-tap started in mid-air must not create a dash');
  await page.keyboard.up('d');

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(590);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  await hold(page, 'd', 700);
  state = await readState(page);
  assert.ok(state.players.left.x > 650, `normal running should still cross midfield without a sprint mode; x=${state.players.left.x}`);
  await capture(page, `${output}/02-cross-midfield.png`);

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(500);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(900);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  await hold(page, 'a', 100);
  state = await readState(page);
  assert.equal(state.players.left.facing, 1, 'retreating behind the defender should still face the rival goal');
  await capture(page, `${output}/02-defensive-facing.png`);
  await page.evaluate(({ x }) => window.__SKYHEAD_DEBUG__.setBall({ x: x + 78, y: 537 }), state.players.left);
  await hold(page, 'x', 80);
  assert.ok((await readState(page)).ball.vx > 10, 'a defensive-side shot should still travel toward the rival goal');

  await advance(page, 520);
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(950);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(700);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  await hold(page, 'a', 80);
  assert.equal((await readState(page)).players.left.facing, -1, 'after overtaking, moving back may face the defender');
  await capture(page, `${output}/02-passed-turn.png`);

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(800);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(700);
    window.__SKYHEAD_DEBUG__.setBall({ x: 878, y: 537 });
  });
  await hold(page, 'd', 80);
  state = await readState(page);
  assert.equal(state.players.left.facing, 1, 'running toward the rival goal should keep facing that goal after overtaking');
  await hold(page, 'x', 80);
  assert.ok((await readState(page)).ball.vx > 10, 'the post-overtake shot should travel toward the rival goal');

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(400);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    // Keep the ball clear of the air-drift landing corridor.
    window.__SKYHEAD_DEBUG__.setBall({ x: 200, y: 300 });
  });
  state = await readState(page);
  const groundY = state.players.left.y;
  await hold(page, 'Space', 100);
  state = await readState(page);
  assert.ok(state.players.left.y < groundY - 4 && state.players.left.vy < 0, 'jump should create upward movement');
  await capture(page, `${output}/02-jump-pose.png`);

  const airborneX = state.players.left.x;
  await hold(page, 'd', 250);
  state = await readState(page);
  assert.ok(state.players.left.x > airborneX + 20, 'air control should remain fast enough to escape pressure');
  await advance(page, 900);
  for (let extra = 0; extra < 5 && !(await readState(page)).players.left.grounded; extra += 1) {
    await advance(page, 200);
  }
  state = await readState(page);
  assert.ok(
    state.players.left.y > 540 && Math.abs(state.players.left.vy) < 1.8,
    `fast-fall tuning should finish a jump shortly after one second; y=${state.players.left.y}, vy=${state.players.left.vy}`,
  );

  state = await readState(page);
  await page.evaluate(({ x }) => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(x);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    // Park the ball far above the pitch so the whiff cannot accidentally
    // connect (and the live AI cannot knock it into the strike capsule).
    window.__SKYHEAD_DEBUG__.setBall({ x: 640, y: 140 });
  }, state.players.left);
  const ballEffectBefore = (await readState(page)).audio.ballEffectPlays;
  await hold(page, 'x', 50);
  state = await readState(page);
  assert.ok(state.players.left.kickCooldown > 0, 'kick should start its cooldown');
  assert.equal(state.audio.ballEffectPlays, ballEffectBefore, 'a missed kick must remain silent');
  await capture(page, `${output}/02-kick-miss-no-marker.png`);

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(24);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.stunOpponent(1);
    window.__SKYHEAD_DEBUG__.setBall({ x: 678, y: 537 });
  });
  const connectedBallEffectBefore = (await readState(page)).audio.ballEffectPlays;
  await hold(page, 'x', 17);
  state = await readState(page);
  assert.ok(state.ball.vx > 15, 'the initial basic kick should connect immediately');
  assert.equal(state.audio.ballEffectPlays, connectedBallEffectBefore + 1, 'ball contact should play one kick sound');
  for (let tap = 0; tap < 3; tap += 1) {
    await touchPulse(page, 'kick');
  }
  assert.equal((await readState(page)).players.left.kickBoostTaps, 3, 'three extra presses should cap the queued kick boost');
  state = await readState(page);
  assert.equal(state.lastBoostedStrike?.side, 'left');
  assert.equal(state.lastBoostedStrike?.shotType, 'drive');
  assert.equal(state.lastBoostedStrike?.energySpent, 24);
  assert.ok(state.ball.vx > 18.5 && state.ball.vx < 23, `boosted drive should be stronger but below a power shot; got ${state.ball.vx}`);
  assert.ok(state.players.left.meter < 12, 'the full boost cost should be deducted after the contact reward');
  assert.ok(state.meterFlash.left > 0, 'the energy meter should flash after paying for a boosted hit');
  await capture(page, `${output}/02-boosted-drive.png`);

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(24);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  for (const key of ['x', 'k', 'x', 'k']) {
    await hold(page, key, 17);
  }
  await advance(page, 220);
  state = await readState(page);
  assert.equal(state.lastBoostedStrike, null, 'a missed mash kick must not create a paid strike');
  assert.equal(state.players.left.lastKickBoostSpent, 0);
  assert.ok(state.players.left.meter >= 24, 'a miss must preserve the queued energy');

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(24);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 678, y: 537 });
  });
  await hold(page, 'z', 17);
  for (const key of ['i', 'z', 'i']) {
    await hold(page, key, 17);
  }
  state = await readState(page);
  assert.equal(state.lastBoostedStrike?.shotType, 'lob');
  assert.ok(state.ball.vy < -12.5 && state.ball.vx > 10, `boosted lob should still be rising faster after repeated taps; got ${state.ball.vx}, ${state.ball.vy}`);
  assert.ok(state.lastLobStrike?.targetX > state.lastLobStrike?.opponentX, 'a rightward lob should aim beyond the defender');

  await advance(page, 600);
  state = await readState(page);
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 678, y: 537 });
  });
  await hold(page, 'z', 80);
  state = await readState(page);
  assert.equal(state.players.left.pose, 'lob');
  assert.ok(state.ball.vy < -9 && state.ball.vx > 6, 'lob should launch upward with a slower forward component');
  const lobLaunchY = state.ball.y;
  await capture(page, `${output}/02-lob-shot.png`);
  await advance(page, 380);
  assert.ok((await readState(page)).ball.y < lobLaunchY - 30, 'lob should rise into a playable arc above a defender');

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(790);
    window.__SKYHEAD_DEBUG__.stunOpponent(2);
    window.__SKYHEAD_DEBUG__.setBall({ x: 678, y: 537 });
  });
  await hold(page, 'z', 17);
  state = await readState(page);
  const closeLobLaunchVy = state.ball.vy;
  const closeLobPlan = state.lastLobStrike;
  assert.ok(closeLobPlan.opponentDistance < 120, 'the close-lob fixture should use the maximum-height distance band');
  assert.ok(closeLobPlan.predictedClearance > 140, `close lob should clear the estimated head by a wide margin; ${JSON.stringify(closeLobPlan)}`);
  let closeLobApexY = state.ball.y;
  await advance(page, 360);
  closeLobApexY = Math.min(closeLobApexY, (await readState(page)).ball.y);
  await capture(page, `${output}/02-close-defender-high-lob.png`);
  for (let step = 0; step < 8; step += 1) {
    await advance(page, 80);
    closeLobApexY = Math.min(closeLobApexY, (await readState(page)).ball.y);
  }

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.stunOpponent(2);
    window.__SKYHEAD_DEBUG__.setBall({ x: 678, y: 537 });
  });
  await hold(page, 'z', 17);
  state = await readState(page);
  const farLobLaunchVy = state.ball.vy;
  const farLobPlan = state.lastLobStrike;
  let farLobApexY = state.ball.y;
  for (let step = 0; step < 12; step += 1) {
    await advance(page, 80);
    farLobApexY = Math.min(farLobApexY, (await readState(page)).ball.y);
  }
  assert.ok(closeLobLaunchVy < farLobLaunchVy - 2.5, `close launch must be visibly steeper; close=${closeLobLaunchVy}, far=${farLobLaunchVy}`);
  assert.ok(closeLobApexY < farLobApexY - 80, `close defender should produce a much higher actual apex; close=${closeLobApexY}, far=${farLobApexY}`);
  assert.ok(closeLobPlan.predictedApexY < farLobPlan.predictedApexY - 100);
  assert.ok(farLobPlan.targetX > farLobPlan.opponentX, 'even the flatter distant lob should target space beyond the defender');

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(20);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 600, y: 280, vx: 0, vy: -1 });
  });
  const chilenaMissesBefore = (await readState(page)).players.left.chilenaSuccesses;
  await hold(page, 'x', 17);
  await hold(page, 'k', 17);
  state = await readState(page);
  assert.equal(state.players.left.chilenaSuccesses, chilenaMissesBefore, 'an overhead ball more than one player-height away must be unreachable');
  assert.notEqual(state.powerBall.superpowerId, 'chilena');
  assert.ok(state.players.left.meter >= 20 && state.players.left.meter < 100, 'an unreachable attempt must not award the meter');
  await advance(page, 240);

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(12);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 620, y: 360, vx: 0.2, vy: -2 });
  });
  const chilenaSuccessesBefore = (await readState(page)).players.left.chilenaSuccesses;
  await hold(page, 'x', 17);
  state = await readState(page);
  assert.equal(state.players.left.chilenaSuccesses, chilenaSuccessesBefore, 'one kick press must not trigger a chilena');
  await hold(page, 'k', 17);
  state = await readState(page);
  assert.equal(state.players.left.chilenaSuccesses, chilenaSuccessesBefore + 1, 'the second fast kick press should trigger a reachable chilena');
  assert.equal(state.players.left.chilenaActive, true);
  assert.equal(state.players.left.pose, 'chilena');
  assert.equal(state.players.left.facing, -1, 'Joel should turn his back to the rival goal during the rotation');
  assert.ok(state.players.left.vy < 0, 'the chilena should lift Joel into the air');
  assert.equal(state.players.left.meter, 100, 'a successful chilena should fully reward the energy meter');
  assert.equal(state.powerBall.active, true);
  assert.equal(state.powerBall.owner, 'left');
  assert.equal(state.powerBall.superpowerId, 'chilena');
  assert.ok(state.ball.vx > 24 && state.ball.vy > 0, `an aerial chilena should aim down toward the rival goal center; got ${state.ball.vx}, ${state.ball.vy}`);
  assert.equal(state.lastChilenaStrike?.side, 'left');
  assert.equal(state.lastChilenaStrike?.meterAfter, 100);
  assert.equal(state.hud.announcement, '¡CHILENA!');
  await advance(page, 150);
  state = await readState(page);
  assert.ok(state.players.left.chilenaRotation > 65 && state.players.left.chilenaRotation < 180, `the sprite should visibly rotate clockwise; got ${state.players.left.chilenaRotation}`);
  await capture(page, `${output}/02-chilena.png`);
  await advance(page, 1150);
  state = await readState(page);
  for (let attempt = 0; attempt < 8 && !state.players.left.grounded; attempt += 1) {
    await advance(page, 50);
    state = await readState(page);
  }
  assert.equal(state.players.left.chilenaActive, false, 'Joel should land even if the shot reaches the goal during his rotation');
  assert.equal(state.players.left.chilenaRotation, 0);
  assert.equal(state.players.left.facing, 1, 'Joel should face the rival goal again after landing');
  assert.equal(state.players.left.grounded, true);
  assert.ok(Math.abs(state.players.left.y - 547) < 8, `the visual-only rotation must return Joel to his normal ground height; got y=${state.players.left.y}`);
  assert.ok(groundedVisualFrames.has(state.players.left.visualFrame), `chilena landing should restore a grounded pose; got frame ${state.players.left.visualFrame}`);
  assert.ok(Math.abs(state.players.left.visualGroundAnchorY - 636) < 0.2, 'chilena landing should return Joel to the shared foot baseline');
  await capture(page, `${output}/02-chilena-landing.png`);

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(12);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 620, y: 360, vx: 0, vy: -1 });
  });
  const lobChilenaSuccessesBefore = (await readState(page)).players.left.chilenaSuccesses;
  await hold(page, 'z', 17);
  await hold(page, 'i', 17);
  state = await readState(page);
  assert.equal(state.players.left.chilenaSuccesses, lobChilenaSuccessesBefore + 1);
  assert.equal(state.powerBall.superpowerId, 'chilena-lob');
  assert.equal(state.powerBall.trajectory?.phase, 'rising');
  assert.equal(state.lastChilenaStrike?.variant, 'lob');
  assert.ok(state.ball.vx > 0 && state.ball.vx < 4, `the high chilena should rise almost vertically; got vx=${state.ball.vx}`);
  assert.ok(state.ball.vy < -11, `the high chilena should launch upward; got vy=${state.ball.vy}`);
  assert.equal(state.hud.announcement, '¡CHILENA ALTA!');
  await capture(page, `${output}/02-lob-chilena-launch.png`);
  let lobChilenaApexY = state.ball.y;
  for (let step = 0; step < 80 && state.powerBall.trajectory?.phase === 'rising'; step += 1) {
    await advance(page, 1000 / 60);
    state = await readState(page);
    lobChilenaApexY = Math.min(lobChilenaApexY, state.ball.y);
  }
  assert.equal(state.powerBall.trajectory?.phase, 'goalward', 'the high chilena should redirect after reaching its apex');
  assert.ok(lobChilenaApexY >= 130 && lobChilenaApexY <= 165, `the high chilena apex should rise to the underside of the score display; got y=${lobChilenaApexY}`);
  assert.ok(state.ball.vx > 20 && state.ball.vy > 0, `the redirected high chilena should target the goal center; got ${state.ball.vx}, ${state.ball.vy}`);
  assert.equal(state.powerBall.effectTriggered, true);
  await capture(page, `${output}/02-lob-chilena-redirect.png`);
  await advance(page, 1150);

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(500);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });

  await hold(page, 'c', 60);
  state = await readState(page);
  assert.equal(state.players.left.dashCooldown, 0, 'the retired C shortcut must not trigger a dash');

  await advance(page, 1100);
  state = await readState(page);
  assert.equal(state.language, 'es', 'the selected language should carry into match UI');
  assert.equal(state.inventory.equippedPowerId, 'fireball');
  assert.equal(state.inventory.equippedCount, 2);
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(70);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.stunOpponent(2);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  await pressDesktopPower(page);
  await advance(page, 40);
  state = await readState(page);
  assert.ok(state.players.left.meter >= 70, 'an early power press should not consume partial meter');
  assert.equal(state.hud.announcement, 'EL PODER NECESITA 100%', 'an early press should explain why power did not activate');

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(100);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.stunOpponent(2);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  await pressDesktopPower(page);
  await advance(page, 85);
  state = await readState(page);
  assert.equal(state.powerBall.active, false, 'a missed power kick should not create a power ball');
  assert.equal(state.inventory.equippedCount, 2, 'a missed power kick must not consume an earned charge');
  assert.equal(state.players.left.meter, 100, 'a missed power kick must keep the full meter for a retry');
  assert.equal(state.players.left.powerArmed, true, 'a quick desktop tap should latch and visibly arm power');
  await capture(page, `${output}/02-power-armed.png`);
  await advance(page, 1300);
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(100);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.stunOpponent(2);
    window.__SKYHEAD_DEBUG__.setBall({ x: 676, y: 529 });
  });
  await pressDesktopPower(page);
  await advance(page, 85);
  state = await readState(page);
  assert.equal(state.powerBall.active, true, 'full-meter power input should empower the ball');
  assert.equal(state.powerBall.owner, 'left');
  assert.equal(state.powerBall.superpowerId, 'fireball', 'the equipped charge should augment a successful power strike');
  assert.equal(state.inventory.equippedCount, 1, 'a successful enhanced strike should consume exactly one charge');
  assert.ok(state.ball.vx > 26, 'Fireball should launch faster than the standard power shot');
  await capture(page, `${output}/02-power-shot.png`);

  await page.keyboard.press('r');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(page, 3100);
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.grantEquippedPower('ice', 1);
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(100);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(820);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  await pressDesktopPower(page);
  await advance(page, 85);
  state = await readState(page);
  assert.equal(state.powerBall.active, false, 'Freeze should not require or create a powered ball');
  assert.deepEqual(state.lastInstantPower, { powerId: 'ice', target: 'right' });
  assert.equal(state.players.right.frozen, true, 'Freeze should immobilize the opponent immediately on the power press');
  assert.ok(state.players.right.freezeSeconds > 1, 'Freeze should last long enough to be unmistakable');
  assert.equal(state.inventory.equippedCount, 0, 'Freeze should consume one charge when it activates');
  assert.ok(state.players.left.meter < 1, 'an instant power should spend the full meter immediately');
  assert.equal(state.hud.announcement, '¡RIVAL CONGELADO!');
  assert.ok(state.hud.announcementWidth <= 760, 'Freeze feedback should stay within its banner width');
  await capture(page, `${output}/02-freeze-power.png`);
  await advance(page, 2200);
  assert.equal((await readState(page)).players.right.frozen, false, 'the opponent should recover after Freeze expires');

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.grantEquippedPower('shield', 1);
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(100);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.stunOpponent(2);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  await pressDesktopPower(page);
  await advance(page, 85);
  state = await readState(page);
  assert.equal(state.players.left.shield, 1, 'Shield should activate immediately without a ball strike');
  assert.deepEqual(state.lastInstantPower, { powerId: 'shield', target: 'left' });
  assert.equal(state.hud.announcement, '¡ESCUDO ACTIVO!');
  assert.ok(state.hud.announcementWidth <= 760, 'Shield feedback should stay compact');
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer.applyStun(-1));
  state = await readState(page);
  assert.equal(state.players.left.shield, 0, 'Shield should absorb exactly the next physical stun');
  assert.equal(state.players.left.stunned, false, 'the blocked hit should not stun Joel');

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.grantEquippedPower('hyper', 1);
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(100);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.stunOpponent(2);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  await pressDesktopPower(page);
  await advance(page, 85);
  state = await readState(page);
  assert.ok(state.players.left.hyperSeconds > 4.7, 'Hyper should activate its five-second movement boost immediately');
  assert.deepEqual(state.lastInstantPower, { powerId: 'hyper', target: 'left' });
  assert.equal(state.hud.announcement, '¡TURBO ACTIVO!');
  assert.ok(state.hud.announcementWidth <= 760, 'Hyper feedback should stay compact');
  await capture(page, `${output}/02-hyper-glow.png`);

  await page.keyboard.press('r');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(page, 3100);
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.grantEquippedPower('big', 1);
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(100);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.stunOpponent(12);
    window.__SKYHEAD_DEBUG__.setBall({ x: 676, y: 529 });
  });
  await pressDesktopPower(page);
  await advance(page, 450);
  state = await readState(page);
  assert.equal(state.powerBall.superpowerId, 'big', 'Big Guy should activate from a successful powered strike');
  assert.ok(state.players.left.bigGuySeconds > 9.5, 'Big Guy should remain active for ten seconds');
  assert.equal(state.players.left.bigGuyScale, 2, 'Joel should finish expanding to exactly twice his normal size');
  assert.equal(state.players.left.grounded, true, 'the larger physics body should keep its feet grounded');
  assert.equal(state.hud.announcement, '¡TÍO GRANDE!');
  await capture(page, `${output}/02-big-guy-grown.png`);

  await page.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    window.__SKYHEAD_DEBUG__.setBall({ x: 640, y: 220 });
    match.ball.freeze();
  });
  await advance(page, 8800);
  state = await readState(page);
  assert.equal(state.players.left.bigGuyScale, 2, 'Joel should remain fully enlarged before the closing animation');
  const millisecondsToShrinkSample = Math.max(0, (state.players.left.bigGuySeconds - 0.28) * 1000);
  await advance(page, millisecondsToShrinkSample);
  state = await readState(page);
  assert.ok(
    state.players.left.bigGuyScale > 1 && state.players.left.bigGuyScale < 2,
    `Joel should visibly shrink near expiry; got ${state.players.left.bigGuyScale}`,
  );
  await capture(page, `${output}/02-big-guy-shrinking.png`);
  await advance(page, 500);
  state = await readState(page);
  assert.equal(state.players.left.bigGuySeconds, 0);
  assert.equal(state.players.left.bigGuyScale, 1, 'Joel should return exactly to normal size after ten seconds');
  assert.equal(state.players.left.grounded, true, 'shrinking should not lift Joel away from the pitch');

  await page.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    match.inputController.setTouch('left', true);
    window.__SKYHEAD_PLATFORM_DEBUG__.setActiveForTesting(false);
  });
  state = await readState(page);
  assert.equal(state.mode, 'paused', 'backgrounding should pause an active match');
  assert.equal(state.pauseReason, 'lifecycle');
  assert.equal(
    await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').inputController.touch.left),
    false,
    'backgrounding should release held touch input',
  );
  await page.evaluate(() => window.__SKYHEAD_PLATFORM_DEBUG__.setActiveForTesting(true));
  assert.equal((await readState(page)).mode, 'paused', 'resume should require an explicit player action');
  await capture(page, `${output}/03-lifecycle-pause.png`);
  await page.evaluate(() => window.__SKYHEAD_PLATFORM_DEBUG__.backForTesting());
  assert.equal((await readState(page)).mode, 'playing', 'Back should dismiss the pause overlay');
  await page.evaluate(() => window.__SKYHEAD_PLATFORM_DEBUG__.backForTesting());
  assert.equal((await readState(page)).mode, 'paused', 'Back should pause instead of exiting during a match');
  await page.evaluate(() => window.__SKYHEAD_PLATFORM_DEBUG__.backForTesting());
  assert.equal((await readState(page)).mode, 'playing');

  await page.keyboard.press('p');
  state = await readState(page);
  assert.equal(state.mode, 'paused');
  const pausedAt = state.timer.secondsLeft;
  await advance(page, 500);
  assert.equal((await readState(page)).timer.secondsLeft, pausedAt, 'pause should freeze the match clock');
  await capture(page, `${output}/03-paused.png`);
  await page.keyboard.press('p');
  assert.notEqual((await readState(page)).mode, 'paused');

  await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    window.__SKYHEAD_GAME__.scene.getScene('Match').onEscapeKey(event);
  });
  state = await readState(page);
  assert.equal(state.mode, 'paused', 'Escape should open the desktop pause menu');
  assert.deepEqual(state.pauseActions, ['resume', 'restart', 'abandon match']);
  await capture(page, `${output}/03-desktop-abandon-menu.png`);
  await touchControl(page, 775, 475, 40);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).modal === 'abandon-confirm');
  await touchControl(page, 775, 438, 40);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  assert.equal((await readState(page)).audio.sceneMode, 'menu', 'abandoning should return to the main menu');
  await touchControl(page, 640, 252, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  await touchControl(page, 785, 660, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(page, 3100);
  assert.equal((await readState(page)).mode, 'playing');

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(400);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setIncomingPower({ owner: 'right', x: 476, y: 547, vx: -18 });
    window.__SKYHEAD_DEBUG__.humanKick();
  });
  await advance(page, 34);
  state = await readState(page);
  assert.equal(state.powerBall.owner, 'left', 'counter should reverse power-ball ownership');
  assert.ok(state.ball.vx > 34, `counter should nearly double the incoming speed; got ${state.ball.vx}`);
  await capture(page, `${output}/03-counter-power.png`);

  // Pause the live loop so the manual sweep below is atomic: otherwise the
  // real-time frame loop can register a second save between the scripted
  // handleSweptPowerContact call and the state read.
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').scene.pause());
  state = await readState(page);
  const sweptSavesBefore = state.physicsPolish.sweptPlayerSaves;
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(500);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1000);
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    match.leftPlayer.kickTimer = 0;
    match.previousBallPosition = { x: 590, y: 520 };
    match.ball.body.setPosition(420, 520);
    match.ball.body.setVelocity(-46, 0);
    match.powerBall = {
      active: true,
      owner: 'right',
      ttl: 3,
      counterFlash: 0.32,
      superpowerId: 'fireball',
      elapsed: 0,
      effectTriggered: false,
      color: 0xff5a24,
      trajectory: null,
    };
    match.handleSweptPowerContact();
  });
  state = await readState(page);
  assert.equal(state.physicsPolish.sweptPlayerSaves, sweptSavesBefore + 1, 'a maximum-speed fireball sweep should register the player');
  assert.ok(state.ball.x > state.players.left.x && state.ball.vx > 0, 'the swept body save should place and rebound the ball outside Joel');
  await capture(page, `${output}/03-swept-fireball-save.png`);
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').scene.resume());

  const clashesBefore = state.physicsPolish.clashCount;
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(590);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(680);
    window.__SKYHEAD_DEBUG__.setBall({ x: 635, y: 600, vx: 0, vy: 0 });
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    match.currentIntents = {
      left: { move: 1 },
      right: { move: -1 },
    };
    for (let step = 0; step < 14; step += 1) match.handlePlayerClash(1 / 60);
  });
  state = await readState(page);
  assert.equal(state.physicsPolish.clashCount, clashesBefore + 1, 'a sustained face-to-face push should resolve exactly once');
  assert.equal(state.physicsPolish.lastClashPoppedBall, true, 'a ball trapped between both players should pop free');
  assert.ok(
    Math.abs(state.players.left.vx) + Math.abs(state.players.right.vx) > 4 && state.ball.vy < -8,
    `the clash should push both players and lift the ball; ${JSON.stringify({
      leftVx: state.players.left.vx,
      rightVx: state.players.right.vx,
      ballVy: state.ball.vy,
    })}`,
  );
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').cameras.main.resetFX());
  await advance(page, 120);
  await capture(page, `${output}/03-player-clash-release.png`);

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(500);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(900);
    window.__SKYHEAD_DEBUG__.setBall({ x: 68, y: 373 });
  });
  await advance(page, 250);
  state = await readState(page);
  assert.ok(
    state.ball.x < 148 && state.ball.y < 396,
    `fixture should reproduce a ball perched above the left goal; x=${state.ball.x}, y=${state.ball.y}`,
  );
  await capture(page, `${output}/03-goal-perch-regression.png`);
  await advance(page, 600);
  state = await readState(page);
  assert.ok(state.ball.x > 148, `a perched ball should roll back into play; x=${state.ball.x}, y=${state.ball.y}`);
  await capture(page, `${output}/03-goal-perch-released.png`);

  await page.evaluate(() => window.__SKYHEAD_DEBUG__.setBall({ x: 1212, y: 373 }));
  await advance(page, 250);
  state = await readState(page);
  assert.ok(state.ball.x > 1132 && state.ball.y < 396, 'fixture should reproduce a ball perched above the right goal');
  await advance(page, 700);
  state = await readState(page);
  assert.ok(state.ball.x < 1132, `the mirrored right goal should also return a perched ball to play; x=${state.ball.x}, y=${state.ball.y}`);

  await advance(page, 520);
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(590);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(660);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
    window.__SKYHEAD_DEBUG__.humanKick();
  });
  await advance(page, 60);
  state = await readState(page);
  assert.equal(state.players.right.stunned, true, 'a close-range kick should briefly stun the rival');
  assert.ok(state.players.right.x > 665 && state.players.right.vx > 5, 'a kick should visibly knock the rival backward');
  await capture(page, `${output}/03-combat-stun.png`);

  const scoreBeforeOverGoalShot = (await readState(page)).score.left;
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(500);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(900);
    window.__SKYHEAD_DEBUG__.stunOpponent(3);
    window.__SKYHEAD_DEBUG__.setIncomingPower({ owner: 'left', x: 1110, y: 390, vx: 46, vy: -1 });
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    match.powerBall.counterFlash = 0.32;
  });
  await advance(page, 260);
  state = await readState(page);
  assert.equal(state.mode, 'playing', 'a high-speed power shot above the crossbar must remain a miss');
  assert.equal(state.score.left, scoreBeforeOverGoalShot, 'an over-goal fireball must not increment the score');
  await page.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    match.previousBallPosition = { x: 1310, y: 400 };
    match.ball.body.setPosition(1340, 410);
    match.ball.body.setVelocity(46, 2);
  });
  await advance(page, 34);
  state = await readState(page);
  assert.equal(state.score.left, scoreBeforeOverGoalShot, 'falling after an over-goal exit must not retroactively score');
  assert.ok(state.ball.x <= 1280 - state.ball.radius, `an off-screen power ball should rebound into view; x=${state.ball.x}`);
  assert.ok(state.ball.outOfBoundsRecoveries > 0, 'the out-of-bounds safeguard should record the recovery');
  await capture(page, `${output}/03-over-goal-fireball-regression.png`);

  const beforeGoalState = await readState(page);
  assert.equal(beforeGoalState.opponent.id, 'joel');
  const scoreBefore = beforeGoalState.score.right;
  const goalCheerBefore = beforeGoalState.audio.goalCheerPlays;
  const goalStingersBefore = beforeGoalState.audio.goalStingerPlays;
  const joelGoalEffectsBefore = beforeGoalState.audio.gameEffectPlays.joelGoal;
  const standardGoalEffectsBefore = beforeGoalState.audio.gameEffectPlays.goal1
    + beforeGoalState.audio.gameEffectPlays.goal2;
  const goalWhistlesBefore = beforeGoalState.audio.whistleRequestedPlays;
  const goalWhistlePlaysBefore = beforeGoalState.audio.whistlePlays;
  await page.evaluate(() => window.__SKYHEAD_DEBUG__.setBall({ x: 140, y: 614, vx: -18 }));
  await advance(page, 100);
  state = await readState(page);
  assert.equal(state.mode, 'goal');
  assert.equal(state.score.right, scoreBefore + 1, 'a ball rolling across the left goal line should score for opponent Joel');
  assert.equal(state.audio.goalCheerPlays, goalCheerBefore, 'the former audience goal effect should no longer play');
  assert.equal(state.audio.goalStingerPlays, goalStingersBefore + 1, 'Joel scoring should play one goal celebration');
  assert.equal(state.audio.gameEffectPlays.joelGoal, joelGoalEffectsBefore + 1, "Joel's goal should play his VAMOS signature effect");
  assert.equal(
    state.audio.gameEffectPlays.goal1 + state.audio.gameEffectPlays.goal2,
    standardGoalEffectsBefore,
    "Joel's signature effect should replace the standard goal stingers",
  );
  assert.equal(state.audio.lastGameEffectPlayback.effectId, 'joelGoal');
  assert.equal(state.audio.whistleRequestedPlays, goalWhistlesBefore + 1, 'a goal should request one whistle');
  assert.equal(state.audio.whistlePlays, goalWhistlePlaysBefore + 1, 'the goal whistle should begin playback immediately');
  assert.deepEqual(state.audio.recentWhistles.at(-1), { label: 'goal', cutoffMs: null }, 'the goal should retain a full-length whistle');
  await capture(page, `${output}/04-ground-goal-regression.png`);
  await advance(page, 1800);
  state = await readState(page);
  assert.equal(state.mode, 'countdown');
  await page.waitForTimeout(220);
  await capture(page, `${output}/04-post-goal-reset.png`);
  state = await readState(page);
  assert.equal(state.players.left.visualFrame, 0, 'the scorer should show its initial idle frame during the countdown');
  assert.equal(state.players.right.visualFrame, 0, 'the defender should show its initial idle frame during the countdown');

  const finalWhistlesBefore = state.audio.whistleRequestedPlays;
  const finalWhistlePlaysBefore = state.audio.whistlePlays;
  await page.evaluate(() => window.__SKYHEAD_DEBUG__.forceResult('left'));
  state = await readState(page);
  assert.equal(state.mode, 'result');
  assert.equal(state.score.winner, 'left');
  assert.equal(state.audio.lastWhistleSequenceCount, 3, 'the final signal should schedule exactly three whistles');
  assert.equal(state.audio.whistleRequestedPlays, finalWhistlesBefore + 3);
  assert.equal(state.audio.whistlePlays, finalWhistlePlaysBefore + 1, 'the first final whistle should play immediately');
  assert.equal(state.audio.pendingWhistles, 2);
  await page.evaluate(() => window.__SKYHEAD_DEBUG__.forceResult('left'));
  assert.equal((await readState(page)).audio.whistleRequestedPlays, finalWhistlesBefore + 3, 'showing the result twice must not duplicate the final signal');
  await page.waitForTimeout(1950);
  state = await readState(page);
  assert.equal(state.audio.whistlePlays, finalWhistlePlaysBefore + 3, 'all three final whistles should play in sequence');
  assert.equal(state.audio.pendingWhistles, 0);
  assert.deepEqual(state.audio.recentWhistles.slice(-3), [
    { label: 'final', cutoffMs: null },
    { label: 'final', cutoffMs: null },
    { label: 'final', cutoffMs: null },
  ], 'the match-end sequence should retain three full whistles');
  await capture(page, `${output}/04-result.png`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(page, 3100);
  state = await readState(page);
  assert.equal(state.mode, 'playing');
  assert.ok(state.ball.y > 340, 'rematch should resume Matter physics after the countdown');

  assert.deepEqual(errors, [], `browser emitted errors:\n${errors.join('\n')}`);
  await desktop.close();

  const juanContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const juanPage = await juanContext.newPage();
  const juanErrors = [];
  juanPage.on('pageerror', (error) => juanErrors.push(error.stack ?? error.message));
  juanPage.on('console', (message) => {
    if (message.type() === 'error') juanErrors.push(`console: ${message.text()}`);
  });
  await juanPage.goto(url, { waitUntil: 'domcontentloaded' });
  await waitThroughSplash(juanPage);
  await touchControl(juanPage, 640, 252, 35);
  await juanPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  for (let step = 0; step < 3; step += 1) {
    await touchControl(juanPage, 375, 205, 35);
    await juanPage.waitForTimeout(60);
  }
  let juanState = await readState(juanPage);
  assert.equal(juanState.playerCharacter.id, 'juan');
  await touchControl(juanPage, 785, 660, 40);
  await juanPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(juanPage, 3100);
  await juanPage.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(520);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(900);
    window.__SKYHEAD_DEBUG__.setBall({ x: 1040, y: 510 });
  });
  await hold(juanPage, 'Space', 34);
  await advance(juanPage, 50);
  juanState = await readState(juanPage);
  assert.equal(juanState.players.left.visualFrame, 2, 'Juan should use the size-corrected jump frame while airborne');
  assert.equal(juanState.players.left.pose, 'jump');
  await capture(juanPage, `${output}/04-juan-jump.png`);
  assert.deepEqual(juanErrors, [], `Uncle Juan browser emitted errors:\n${juanErrors.join('\n')}`);
  await juanContext.close();

  const dadContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const dadPage = await dadContext.newPage();
  const dadErrors = [];
  dadPage.on('pageerror', (error) => dadErrors.push(error.stack ?? error.message));
  dadPage.on('console', (message) => {
    if (message.type() === 'error') dadErrors.push(`console: ${message.text()}`);
  });
  await dadPage.goto(url, { waitUntil: 'domcontentloaded' });
  await waitThroughSplash(dadPage);
  await touchControl(dadPage, 640, 252, 35);
  await dadPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  for (let step = 0; step < 4; step += 1) {
    await touchControl(dadPage, 375, 205, 35);
    await dadPage.waitForTimeout(60);
  }
  await touchControl(dadPage, 495, 205, 35);
  let dadState = await readState(dadPage);
  assert.equal(dadState.playerCharacter.id, 'dad');
  assert.equal(dadState.opponent.id, 'joel');
  await capture(dadPage, `${output}/04-dad-setup.png`);
  await touchControl(dadPage, 785, 660, 40);
  await dadPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(dadPage, 3100);
  dadState = await readState(dadPage);
  assert.equal(dadState.mode, 'playing');
  assert.equal(dadState.players.left.name, 'Dad');
  assert.deepEqual([dadState.players.left.nativeFacing, dadState.players.left.visualFlipped], [1, false]);
  assert.equal(dadState.players.left.visualScale, 1.2);
  assert.equal(dadState.players.left.displayHeight, 336);
  assert.equal(dadState.players.right.displayHeight, 280);
  assert.ok(
    Math.abs(dadState.players.left.collisionArea / dadState.players.right.collisionArea - 1.44) < 0.01,
    `Dad’s 120% artwork must use a 120% collider so the ball cannot pass through his head; ${JSON.stringify({ dad: dadState.players.left.collisionArea, rival: dadState.players.right.collisionArea })}`,
  );
  assert.ok(Math.abs(dadState.players.left.visualGroundAnchorY - 636) < 0.2);
  await capture(dadPage, `${output}/04-dad-idle.png`);

  await dadPage.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    const fighter = match.leftPlayer;
    fighter.stunTimer = 0;
    fighter.stunProtection = 2;
    fighter.kickTimer = 0;
    fighter.dashTimer = 0;
    fighter.chilenaActive = false;
    fighter.sprite.setFrame(6);
    fighter.currentPose = 'run-contact-a';
    fighter.currentAnimationStage = 'contact-a';
    match.scene.pause();
  });
  dadState = await readState(dadPage);
  assert.ok([6, 7, 8].includes(dadState.players.left.visualFrame), 'Dad should use his complete enhanced run cycle');
  await capture(dadPage, `${output}/04-dad-run.png`);
  await dadPage.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').scene.resume());

  await dadPage.evaluate(() => {
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.sprite.setVelocityY(-11.5);
    fighter.updatePose();
  });
  dadState = await readState(dadPage);
  assert.equal(dadState.players.left.visualFrame, 2, 'Dad should use the size-corrected jump frame while airborne');
  assert.equal(dadState.players.left.pose, 'jump');
  await capture(dadPage, `${output}/04-dad-jump.png`);
  await dadPage.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').scene.pause());

  await dadPage.evaluate(() => {
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.kickCooldown = 0;
    fighter.stunTimer = 0;
    fighter.startKick();
    fighter.kickVisualTimer = 0.28;
    fighter.updatePose();
  });
  assert.deepEqual(
    [(await readState(dadPage)).players.left.visualFrame, (await readState(dadPage)).players.left.animationStage],
    [9, 'anticipation'],
  );
  await dadPage.evaluate(() => {
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.kickVisualTimer = 0.2;
    fighter.updatePose();
  });
  assert.deepEqual(
    [(await readState(dadPage)).players.left.visualFrame, (await readState(dadPage)).players.left.animationStage],
    [10, 'contact'],
  );
  await dadPage.evaluate(() => {
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.kickVisualTimer = 0.05;
    fighter.updatePose();
  });
  dadState = await readState(dadPage);
  assert.deepEqual([dadState.players.left.visualFrame, dadState.players.left.animationStage], [11, 'recovery']);
  await capture(dadPage, `${output}/04-dad-kick-recovery.png`);

  await dadPage.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').scene.start('Intro'));
  await dadPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await touchControl(dadPage, 430, 493, 35);
  await dadPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'mini-games');
  assert.equal((await readState(dadPage)).playerCharacter.id, 'dad');
  await touchControl(dadPage, 345, 294, 35);
  await dadPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).gameId === 'kickfall');
  await touchControl(dadPage, 640, 620, 35);
  await dadPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).minigame === 'kickfall');
  await dadPage.evaluate(() => {
    window.__KICKFALL_DEBUG__.startPlaying();
    window.__KICKFALL_DEBUG__.clearBalls();
  });
  await advance(dadPage, 120);
  dadState = await readState(dadPage);
  assert.equal(dadState.selectedCharacter.id, 'dad');
  assert.equal(dadState.player.visualScale, 1.2);
  assert.equal(dadState.player.displayHeight, 151.2);
  assert.ok(Math.abs(dadState.player.collisionWidth - 52.8) < 0.01);
  assert.ok(Math.abs(dadState.player.collisionHeight - 98.4) < 0.01);
  assert.ok(
    Math.abs(dadState.player.platformSurfaceY - dadState.player.visualGroundAnchorY) < 3,
    'Dad must share Kickfall’s platform foot line',
  );
  await dadPage.keyboard.down('d');
  await advance(dadPage, 360);
  await dadPage.keyboard.up('d');
  dadState = await readState(dadPage);
  assert.ok([6, 7, 8].includes(dadState.player.visualFrame));
  await dadPage.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').startKick());
  await advance(dadPage, 70);
  dadState = await readState(dadPage);
  assert.ok([9, 10, 11].includes(dadState.player.visualFrame));
  await capture(dadPage, `${output}/04-dad-kickfall.png`);
  assert.deepEqual(dadErrors, [], `Dad browser emitted errors:\n${dadErrors.join('\n')}`);
  await dadContext.close();

  const mumContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const mumPage = await mumContext.newPage();
  const mumErrors = [];
  mumPage.on('pageerror', (error) => mumErrors.push(error.stack ?? error.message));
  mumPage.on('console', (message) => {
    if (message.type() === 'error') mumErrors.push(`console: ${message.text()}`);
  });
  await mumPage.goto(url, { waitUntil: 'domcontentloaded' });
  await waitThroughSplash(mumPage);
  await touchControl(mumPage, 640, 252, 35);
  await mumPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  for (let step = 0; step < 5; step += 1) {
    await touchControl(mumPage, 375, 205, 35);
    await mumPage.waitForTimeout(60);
  }
  await touchControl(mumPage, 495, 205, 35);
  let mumState = await readState(mumPage);
  assert.equal(mumState.playerCharacter.id, 'mum');
  assert.equal(mumState.playerCharacter.name, 'Mum');
  assert.equal(mumState.opponent.id, 'joel');
  await capture(mumPage, `${output}/04-mum-setup.png`);
  await touchControl(mumPage, 785, 660, 40);
  await mumPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(mumPage, 3100);
  mumState = await readState(mumPage);
  assert.equal(mumState.mode, 'playing');
  assert.equal(mumState.players.left.name, 'Mum');
  assert.deepEqual([mumState.players.left.nativeFacing, mumState.players.left.visualFlipped], [1, false]);
  assert.equal(mumState.players.left.visualScale, 1.2);
  assert.equal(mumState.players.left.displayHeight, 336);
  const mumBaseCollisionArea = mumState.players.left.collisionArea;
  assert.ok(
    Math.abs(mumBaseCollisionArea / mumState.players.right.collisionArea - 1.44) < 0.01,
    `Mum's 120% artwork must use a 120% collider so the ball cannot pass through her head; ${JSON.stringify({ mum: mumBaseCollisionArea, rival: mumState.players.right.collisionArea })}`,
  );
  assert.ok(Math.abs(mumState.players.left.visualGroundAnchorY - 636) < 0.2);
  await capture(mumPage, `${output}/04-mum-idle-right.png`);

  await mumPage.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    const fighter = match.leftPlayer;
    match.scene.pause();
    fighter.setFacing(-1);
    fighter.updatePose();
  });
  mumState = await readState(mumPage);
  assert.deepEqual([mumState.players.left.facing, mumState.players.left.visualFlipped], [-1, true]);
  await capture(mumPage, `${output}/04-mum-idle-left.png`);
  await mumPage.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    const fighter = match.leftPlayer;
    fighter.stunTimer = 0;
    fighter.stunProtection = 2;
    fighter.setFacing(1);
    fighter.updatePose();
  });

  // Drive the pose directly instead of a live key hold: background pages
  // throttle requestAnimationFrame, which makes keyboard-driven checks flaky.
  await mumPage.evaluate(() => {
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.sprite.setVelocityX(8);
    fighter.runCycle = 2;
    fighter.updatePose();
  });
  mumState = await readState(mumPage);
  assert.ok(
    [6, 7, 8].includes(mumState.players.left.visualFrame),
    `Mum should use her complete enhanced run cycle; ${JSON.stringify(mumState.players.left)}`,
  );
  await capture(mumPage, `${output}/04-mum-run.png`);
  await mumPage.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    match.leftPlayer.stunTimer = 0;
    match.leftPlayer.stunProtection = 1;
    match.leftPlayer.updatePose();
    match.scene.resume();
  });

  await mumPage.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    const fighter = match.leftPlayer;
    window.__SKYHEAD_DEBUG__.setHumanPosition(520);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 140 });
    // Pause atomically with the setup so the live loop cannot drop the ball
    // or the AI under her landing spot; advanceForTesting still steps
    // deterministically while the Phaser scene is paused.
    match.scene.pause();
    fighter.sprite.setVelocityY(-11.5);
    fighter.updatePose();
  });
  mumState = await readState(mumPage);
  assert.equal(mumState.players.left.visualFrame, 2);
  assert.equal(mumState.players.left.pose, 'jump');
  await capture(mumPage, `${output}/04-mum-jump.png`);
  await advance(mumPage, 1100);
  mumState = await readState(mumPage);
  assert.equal(mumState.players.left.grounded, true);
  assert.ok(Math.abs(mumState.players.left.visualGroundAnchorY - 636) < 0.2);
  await capture(mumPage, `${output}/04-mum-landed.png`);
  await mumPage.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').scene.pause());

  await mumPage.evaluate(() => {
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.kickCooldown = 0;
    fighter.stunTimer = 0;
    fighter.startKick();
    fighter.kickVisualTimer = 0.28;
    fighter.updatePose();
  });
  assert.deepEqual(
    [(await readState(mumPage)).players.left.visualFrame, (await readState(mumPage)).players.left.animationStage],
    [9, 'anticipation'],
  );
  await capture(mumPage, `${output}/04-mum-kick-anticipation.png`);
  await mumPage.evaluate(() => {
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.kickVisualTimer = 0.2;
    fighter.updatePose();
  });
  assert.deepEqual(
    [(await readState(mumPage)).players.left.visualFrame, (await readState(mumPage)).players.left.animationStage],
    [10, 'contact'],
  );
  await capture(mumPage, `${output}/04-mum-kick-contact.png`);
  await mumPage.evaluate(() => {
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.kickVisualTimer = 0.05;
    fighter.updatePose();
  });
  assert.deepEqual(
    [(await readState(mumPage)).players.left.visualFrame, (await readState(mumPage)).players.left.animationStage],
    [11, 'recovery'],
  );
  await capture(mumPage, `${output}/04-mum-kick-recovery.png`);

  await mumPage.evaluate(() => {
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.kickTimer = 0;
    fighter.dashCooldown = 0;
    fighter.startDash(1);
    fighter.updatePose();
  });
  mumState = await readState(mumPage);
  assert.equal(mumState.players.left.visualFrame, 4);
  assert.equal(mumState.players.left.pose, 'dash');
  await capture(mumPage, `${output}/04-mum-dash.png`);

  await mumPage.evaluate(() => {
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.dashTimer = 0;
    fighter.stunTimer = 1;
    fighter.updatePose();
  });
  mumState = await readState(mumPage);
  assert.equal(mumState.players.left.visualFrame, 5);
  assert.equal(mumState.players.left.pose, 'stun');
  await capture(mumPage, `${output}/04-mum-stun.png`);

  await mumPage.evaluate(() => {
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.stunTimer = 0;
    fighter.chilenaActive = true;
    fighter.chilenaElapsed = 0.16;
    fighter.setFacing(-fighter.baseFacing);
    fighter.updatePose();
    fighter.syncChilenaVisual(95);
  });
  mumState = await readState(mumPage);
  assert.equal(mumState.players.left.chilenaActive, true);
  assert.equal(mumState.players.left.pose, 'chilena');
  assert.ok(mumState.players.left.chilenaRotation > 90);
  await capture(mumPage, `${output}/04-mum-chilena.png`);

  await mumPage.evaluate(() => {
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.finishChilena();
    fighter.setBigGuyScale(2);
    fighter.updatePose();
  });
  mumState = await readState(mumPage);
  assert.equal(mumState.players.left.bigGuyScale, 2);
  assert.ok(
    mumState.players.left.collisionArea >= mumBaseCollisionArea * 3.99
      && mumState.players.left.collisionArea <= mumBaseCollisionArea * 4.01,
    'Big Guy Mum should intentionally scale the gameplay body to four times its normal area',
  );
  await capture(mumPage, `${output}/04-mum-big-guy.png`);
  await mumPage.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    match.leftPlayer.setBigGuyScale(1);
    match.scene.resume();
    match.scene.start('Intro');
  });
  await mumPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await touchControl(mumPage, 430, 493, 35);
  await mumPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'mini-games');
  assert.equal((await readState(mumPage)).playerCharacter.id, 'mum');
  await touchControl(mumPage, 345, 294, 35);
  await mumPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).gameId === 'kickfall');
  await touchControl(mumPage, 640, 620, 35);
  await mumPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).minigame === 'kickfall');
  await mumPage.evaluate(() => {
    window.__KICKFALL_DEBUG__.startPlaying();
    window.__KICKFALL_DEBUG__.clearBalls();
  });
  await advance(mumPage, 120);
  mumState = await readState(mumPage);
  assert.equal(mumState.selectedCharacter.id, 'mum');
  assert.equal(mumState.player.visualScale, 1.2);
  assert.equal(mumState.player.displayHeight, 151.2);
  assert.ok(Math.abs(mumState.player.collisionWidth - 52.8) < 0.01);
  assert.ok(Math.abs(mumState.player.collisionHeight - 98.4) < 0.01);
  assert.ok(Math.abs(mumState.player.platformSurfaceY - mumState.player.visualGroundAnchorY) < 3);
  await capture(mumPage, `${output}/04-mum-kickfall-idle.png`);
  await mumPage.keyboard.down('d');
  await advance(mumPage, 360);
  await mumPage.keyboard.up('d');
  mumState = await readState(mumPage);
  assert.ok([6, 7, 8].includes(mumState.player.visualFrame));
  await capture(mumPage, `${output}/04-mum-kickfall-run.png`);
  await mumPage.keyboard.down('Space');
  await advance(mumPage, 34);
  await mumPage.keyboard.up('Space');
  await advance(mumPage, 70);
  mumState = await readState(mumPage);
  assert.equal(mumState.player.visualFrame, 2);
  assert.equal(mumState.player.animationPose, 'jump');
  await capture(mumPage, `${output}/04-mum-kickfall-jump.png`);
  await advance(mumPage, 900);
  await mumPage.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Kickfall').startKick());
  await advance(mumPage, 70);
  mumState = await readState(mumPage);
  assert.ok([9, 10, 11].includes(mumState.player.visualFrame));
  await capture(mumPage, `${output}/04-mum-kickfall-kick.png`);
  assert.deepEqual(mumErrors, [], `Mum browser emitted errors:\n${mumErrors.join('\n')}`);
  await mumContext.close();

  const juanjoContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const juanjoPage = await juanjoContext.newPage();
  const juanjoErrors = [];
  juanjoPage.on('pageerror', (error) => juanjoErrors.push(error.stack ?? error.message));
  juanjoPage.on('console', (message) => {
    if (message.type() === 'error') juanjoErrors.push(`console: ${message.text()}`);
  });
  await juanjoPage.goto(url, { waitUntil: 'domcontentloaded' });
  await waitThroughSplash(juanjoPage);
  await touchControl(juanjoPage, 640, 252, 35);
  await juanjoPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  for (let step = 0; step < 6; step += 1) {
    await touchControl(juanjoPage, 375, 205, 35);
    await juanjoPage.waitForTimeout(60);
  }
  let juanjoState = await readState(juanjoPage);
  assert.equal(juanjoState.playerCharacter.id, 'juanjo');
  await capture(juanjoPage, `${output}/04-juanjo-intro.png`);
  await touchControl(juanjoPage, 785, 660, 40);
  await juanjoPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(juanjoPage, 3100);
  juanjoState = await readState(juanjoPage);
  assert.equal(juanjoState.mode, 'playing');
  assert.equal(juanjoState.playerCharacter.id, 'juanjo');
  assert.equal(juanjoState.players.left.name, 'Uncle Juanjo');
  assert.deepEqual([juanjoState.players.left.nativeFacing, juanjoState.players.left.visualFlipped], [1, false]);
  assert.ok(Math.abs(juanjoState.players.left.visualGroundAnchorY - 636) < 0.2);
  await capture(juanjoPage, `${output}/04-juanjo-match.png`);

  await juanjoPage.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(520);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(900);
    window.__SKYHEAD_DEBUG__.setBall({ x: 1040, y: 510 });
  });
  // Drive the pose directly instead of a live key hold: background pages
  // throttle requestAnimationFrame, which makes keyboard-driven checks flaky.
  await juanjoPage.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    const fighter = match.leftPlayer;
    match.scene.pause();
    fighter.setFacing(1);
    fighter.sprite.setVelocityX(-8);
    fighter.runCycle = 2;
    fighter.updatePose();
  });
  juanjoState = await readState(juanjoPage);
  assert.ok([6, 7, 8].includes(juanjoState.players.left.visualFrame), 'backpedaling should use a complete enhanced run frame');
  assert.equal(juanjoState.players.left.visualFlipped, false, 'Juanjo should keep facing the opponent while retreating');
  await capture(juanjoPage, `${output}/04-juanjo-retreat.png`);
  await juanjoPage.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').scene.resume());

  await juanjoPage.evaluate(() => {
    window.__SKYHEAD_DEBUG__.setHumanPosition(520);
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.sprite.setVelocityY(-11.5);
    fighter.updatePose();
  });
  juanjoState = await readState(juanjoPage);
  assert.equal(juanjoState.players.left.visualFrame, 2, 'Juanjo should use the size-corrected jump frame while airborne');
  assert.equal(juanjoState.players.left.pose, 'jump');
  await capture(juanjoPage, `${output}/04-juanjo-jump.png`);
  await juanjoPage.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').scene.pause());

  await juanjoPage.evaluate(() => {
    window.__SKYHEAD_DEBUG__.setHumanPosition(520);
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.kickCooldown = 0;
    fighter.stunTimer = 0;
    fighter.startKick();
    fighter.kickVisualTimer = 0.28;
    fighter.updatePose();
  });
  assert.deepEqual(
    [(await readState(juanjoPage)).players.left.visualFrame, (await readState(juanjoPage)).players.left.animationStage],
    [9, 'anticipation'],
  );
  await juanjoPage.evaluate(() => {
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.kickVisualTimer = 0.2;
    fighter.updatePose();
  });
  assert.deepEqual(
    [(await readState(juanjoPage)).players.left.visualFrame, (await readState(juanjoPage)).players.left.animationStage],
    [10, 'contact'],
  );
  await juanjoPage.evaluate(() => {
    const fighter = window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer;
    fighter.kickVisualTimer = 0.05;
    fighter.updatePose();
  });
  juanjoState = await readState(juanjoPage);
  assert.deepEqual([juanjoState.players.left.visualFrame, juanjoState.players.left.animationStage], [11, 'recovery']);
  await capture(juanjoPage, `${output}/04-juanjo-kick-recovery.png`);
  assert.deepEqual(juanjoErrors, [], `Uncle Juanjo browser emitted errors:\n${juanjoErrors.join('\n')}`);
  await juanjoContext.close();

  const mobile = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const mobilePage = await mobile.newPage();
  const mobileErrors = [];
  mobilePage.on('pageerror', (error) => mobileErrors.push(error.stack ?? error.message));
  mobilePage.on('console', (message) => {
    if (message.type() === 'error') mobileErrors.push(`console: ${message.text()}`);
  });
  let mobileState;
  await mobilePage.goto(url, { waitUntil: 'domcontentloaded' });
  await waitThroughSplash(mobilePage, `${output}/05-touch-splash-option-a.png`);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.inputMode, 'touch');
  assert.equal(mobileState.install.method, 'instructions', 'mobile web should offer Home Screen installation guidance');
  assert.ok(mobileState.actions.includes('install app'));
  assert.ok(mobileState.stageLayout.width > 1280, 'extra-wide landscape phones should expand horizontally');
  const mobileCanvas = await mobilePage.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const bounds = canvas.getBoundingClientRect();
    return {
      left: Math.round(bounds.left),
      top: Math.round(bounds.top),
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      bitmapWidth: canvas.width,
      bitmapHeight: canvas.height,
    };
  });
  assert.deepEqual(mobileCanvas, {
    left: 0,
    top: 0,
    width: 844,
    height: 390,
    bitmapWidth: mobileState.stageLayout.width,
    bitmapHeight: 720,
  }, 'wide-phone canvas should fill the entire landscape viewport without side bars');
  const nativeHoldGuard = await mobilePage.evaluate(() => {
    const shell = document.querySelector('#game-shell');
    const canvas = document.querySelector('canvas');
    const readStyles = (element) => {
      const styles = getComputedStyle(element);
      return {
        touchAction: styles.touchAction,
        userSelect: styles.userSelect,
        webkitUserSelect: styles.webkitUserSelect,
      };
    };
    const blockedEvents = Object.fromEntries(
      ['touchstart', 'touchmove', 'contextmenu', 'dragstart', 'selectstart'].map((eventName) => {
        const event = new Event(eventName, { bubbles: true, cancelable: true });
        (eventName.startsWith('touch') ? shell : canvas).dispatchEvent(event);
        return [eventName, event.defaultPrevented];
      }),
    );
    return {
      shell: readStyles(shell),
      canvas: readStyles(canvas),
      blockedEvents,
    };
  });
  for (const [target, styles] of Object.entries({
    shell: nativeHoldGuard.shell,
    canvas: nativeHoldGuard.canvas,
  })) {
    assert.equal(styles.touchAction, 'none', `${target} must opt out of native touch gestures`);
    assert.equal(styles.userSelect, 'none', `${target} must disable standard selection`);
    assert.equal(styles.webkitUserSelect, 'none', `${target} must disable iOS WebKit selection`);
  }
  assert.deepEqual(
    nativeHoldGuard.blockedEvents,
    {
      touchstart: true,
      touchmove: true,
      contextmenu: true,
      dragstart: true,
      selectstart: true,
    },
    'the game surface must cancel native touch, long-press, dragging, and selection defaults',
  );
  assert.deepEqual(mobileState.journeys.map(({ id }) => id), ['football', 'mini-games']);
  await touchControl(mobilePage, 1125, 662, 35);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.modal, 'install');
  await capture(mobilePage, `${output}/05-touch-install.png`);
  await mobilePage.evaluate(() => window.__SKYHEAD_PLATFORM_DEBUG__.backForTesting());
  assert.equal((await readState(mobilePage)).modal, null);
  await capture(mobilePage, `${output}/05-touch-intro.png`);

  await touchControl(mobilePage, 640, 252, 45);
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  const playerNextPoint = await canvasPoint(mobilePage, 375, 205);
  await mobilePage.mouse.move(playerNextPoint.x, playerNextPoint.y);
  await mobilePage.mouse.down();
  await advance(mobilePage, 45);
  assert.equal((await readState(mobilePage)).playerCharacter.id, 'lucia', 'selector should activate once on touch-down');
  await mobilePage.mouse.up();
  assert.equal((await readState(mobilePage)).playerCharacter.id, 'lucia', 'release must not advance the selector again');
  await mobilePage.waitForTimeout(60);
  // Reproduce iOS's compatibility pointer sequence emitted just after touchend.
  await mobilePage.mouse.down();
  await advance(mobilePage, 45);
  assert.equal((await readState(mobilePage)).playerCharacter.id, 'lucia', 'an iOS compatibility press must be ignored');
  await mobilePage.mouse.up();
  assert.equal((await readState(mobilePage)).playerCharacter.id, 'lucia', 'compatibility release must also preserve the choice');
  await mobilePage.waitForTimeout(550);
  await mobilePage.mouse.down();
  await advance(mobilePage, 45);
  assert.equal((await readState(mobilePage)).playerCharacter.id, 'luna', 'the next deliberate tap should work after the guard');
  await mobilePage.mouse.up();
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.playerCharacter.id, 'luna', 'the tablet selector should let Luna play as herself');
  assert.equal(mobileState.opponent.id, 'bob');
  await capture(mobilePage, `${output}/05-touch-football-setup-luna.png`);

  await touchControl(mobilePage, 82, 52, 45);
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await touchControl(mobilePage, 1020, 493, 45);
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'settings');
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.audio.settings.musicVolume, 0.15);
  assert.equal(mobileState.audio.settings.effectsVolume, 0.2);
  assert.deepEqual(mobileState.difficultyByGame, {
    football: 'normal',
    kickfall: 'normal',
    discHockey: 'normal',
  });
  await touchControl(mobilePage, 935, 347, 40);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.audio.settings.musicMuted, true, 'tablet Music mute should work from a real touch layout');
  assert.equal(mobileState.audioControls.music.label, 'TURN ON');
  await capture(mobilePage, `${output}/05-touch-settings-music-muted.png`);
  await mobilePage.waitForTimeout(550);
  await touchControl(mobilePage, 935, 347, 40);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.audio.settings.musicMuted, false);
  assert.equal(mobileState.audioControls.music.label, 'MUTE');
  await touchControl(mobilePage, 935, 517, 40);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.audio.settings.effectsMuted, true, 'tablet settings should mute effects by touch');
  assert.equal(mobileState.audioControls.effects.label, 'TURN ON');
  await mobilePage.waitForTimeout(550);
  await touchControl(mobilePage, 935, 517, 40);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.audio.settings.effectsMuted, false);
  assert.equal(mobileState.audioControls.effects.label, 'MUTE');
  await capture(mobilePage, `${output}/05-touch-settings.png`);
  await touchControl(mobilePage, 92, 52, 40);
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');

  await touchControl(mobilePage, 640, 252, 45);
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  await touchControl(mobilePage, 785, 660, 50);
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(mobilePage, 3100);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.touchControls, true);
  assert.equal(mobileState.players.left.name, 'Luna', 'the selected tablet player should carry into the match');
  assert.equal(mobileState.players.right.name, 'Bob', 'the selected tablet opponent should carry into the match');
  assert.equal(mobileState.audio.audienceRequested, true, 'tablet matches should request the audience ambience');
  assert.equal(mobileState.footballTouchMovementMode, 'arrows');
  assert.equal(mobileState.controls.move, 'on-screen left/right arrows');
  assert.equal(mobileState.controls.dash, 'double-tap the left/right arrow');
  assert.equal(mobileState.controls.chilena, 'double kick: direct; double lob: high arc');
  assert.equal(mobileState.touchControlVisuals.movementMode, 'arrows');
  assert.equal(mobileState.touchControlVisuals.joystick, null);
  assert.ok(mobileState.touchControlVisuals.left);
  assert.ok(mobileState.touchControlVisuals.right);
  const mobileControlOffset = (mobileState.stageLayout.width - 1280) / 2;
  assert.deepEqual(
    [
      mobileState.touchControlVisuals.left.x - mobileControlOffset,
      mobileState.touchControlVisuals.left.y,
      mobileState.touchControlVisuals.left.authoredRadius,
    ],
    [98, 630, 64],
    'Football Left should use the restored compact layout',
  );
  assert.deepEqual(
    [
      mobileState.touchControlVisuals.right.x - mobileControlOffset,
      mobileState.touchControlVisuals.right.y,
      mobileState.touchControlVisuals.right.authoredRadius,
    ],
    [238, 630, 64],
    'Football Right should sit only 12 logical pixels from Left at their rims',
  );
  assert.deepEqual(
    [
      mobileState.touchControlVisuals.jump.x - mobileControlOffset,
      mobileState.touchControlVisuals.jump.y,
      mobileState.touchControlVisuals.jump.authoredRadius,
    ],
    [1020, 630, 60],
    'Football Jump should return to the familiar lower action row',
  );
  assert.deepEqual(
    [
      mobileState.touchControlVisuals.lob.x - mobileControlOffset,
      mobileState.touchControlVisuals.lob.y,
      mobileState.touchControlVisuals.lob.authoredRadius,
    ],
    [1195, 475, 56],
    'Lob should occupy the former Power position',
  );
  assert.deepEqual(
    [
      mobileState.touchControlVisuals.power.x - mobileControlOffset,
      mobileState.touchControlVisuals.power.y,
      mobileState.touchControlVisuals.power.authoredRadius,
    ],
    [930, 500, 50],
    'Power should occupy the former high-kick position',
  );
  await capture(mobilePage, `${output}/05-touch-football-arrows.png`);
  const mobileGoalBounds = await mobilePage.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    return match.goals.map(({ image }) => {
      const bounds = image.getBounds();
      return { left: Math.round(bounds.left), right: Math.round(bounds.right) };
    });
  });
  const mobileStageEdge = (mobileState.stageLayout.width - 1280) / 2;
  assert.ok(mobileGoalBounds[0].left <= -mobileStageEdge + 1, 'the left goal should reach the wide-phone edge');
  assert.ok(mobileGoalBounds[1].right >= 1280 + mobileStageEdge - 1, 'the right goal should reach the wide-phone edge');

  await touchControl(mobilePage, 1162, 54, 35);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.modal, 'help');
  assert.equal(mobileState.mode, 'paused');
  assert.equal(mobileState.pauseReason, 'help');
  const helpTimerBefore = mobileState.timer.secondsLeft;
  await advance(mobilePage, 900);
  assert.equal((await readState(mobilePage)).timer.secondsLeft, helpTimerBefore, 'Help must freeze a live match');
  await capture(mobilePage, `${output}/05-touch-help.png`);
  await mobilePage.evaluate(() => window.__SKYHEAD_PLATFORM_DEBUG__.backForTesting());
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.modal, null);
  assert.equal(mobileState.mode, 'playing', 'Back should close Help and resume only the match Help paused');

  await touchControl(mobilePage, 184, 54, 35);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.modal, 'abandon-confirm');
  assert.equal(mobileState.mode, 'paused');
  assert.equal(mobileState.pauseReason, 'abandon-confirm');
  assert.deepEqual(mobileState.confirmationActions, ['stay', 'leave match']);
  const abandonTimerPaused = mobileState.timer.secondsLeft;
  await advance(mobilePage, 900);
  assert.equal((await readState(mobilePage)).timer.secondsLeft, abandonTimerPaused, 'the abandon confirmation must freeze the match');
  await capture(mobilePage, `${output}/05-touch-abandon-confirm.png`);
  await mobilePage.evaluate(() => window.__SKYHEAD_PLATFORM_DEBUG__.backForTesting());
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.modal, null);
  assert.equal(mobileState.mode, 'playing', 'Back should cancel abandon and safely resume the live match');

  const authoredControlPoints = {
    jump: [1020, 630],
    kick: [1165, 610],
    lob: [1195, 475],
  };
  assert.equal(mobileState.touchControlVisuals.dash, undefined, 'directional double-tap should not need a separate Dash button');
  assert.equal(mobileState.touchControlVisuals.jump.emphasized, true);
  assert.ok(
    mobileState.touchControlVisuals.jump.surfaceFillAlpha
      > mobileState.touchControlVisuals.kick.surfaceFillAlpha * 2,
    'Jump should be materially easier to find than the standard glass action controls',
  );
  assert.ok(
    mobileState.touchControlVisuals.jump.symbolAlpha
      > mobileState.touchControlVisuals.kick.symbolAlpha,
    'Jump should use a stronger icon than the standard glass action controls',
  );
  for (const [action, [x, y]] of Object.entries(authoredControlPoints)) {
    const before = (await readState(mobilePage)).touchControlVisuals[action];
    const point = await canvasPoint(mobilePage, x, y);
    await mobilePage.mouse.move(point.x, point.y);
    await mobilePage.mouse.down();
    const pressed = (await readState(mobilePage)).touchControlVisuals[action];
    assert.equal(pressed.scaleFactor, 0.9, `${action} should use the restrained press factor`);
    assert.ok(pressed.symbolWidth < before.symbolWidth, `${action} icon must shrink, not balloon, while pressed`);
    assert.ok(Math.abs(pressed.symbolWidth / before.symbolWidth - 0.9) < 0.02, `${action} icon should preserve its authored base scale`);
    if (action === 'kick') {
      await mobilePage.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').cameras.main.resetFX());
      await capture(mobilePage, `${output}/05-touch-kick-pressed.png`);
    }
    await mobilePage.mouse.up();
    const released = (await readState(mobilePage)).touchControlVisuals[action];
    assert.equal(released.scaleFactor, 1);
    assert.ok(Math.abs(released.symbolWidth - before.baseSymbolWidth) < 0.2, `${action} icon should restore its exact authored display size`);
  }

  await mobilePage.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').scene.restart());
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(mobilePage, 3100);
  await mobilePage.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(320);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1100);
    window.__SKYHEAD_DEBUG__.setBall({ x: 700, y: 420, vx: 0, vy: 0 });
  });
  mobileState = await readState(mobilePage);
  const touchStartX = mobileState.players.left.x;
  const heldRightPoint = await canvasPoint(mobilePage, 238, 630);
  await mobilePage.mouse.move(heldRightPoint.x, heldRightPoint.y);
  await mobilePage.mouse.down();
  await advance(mobilePage, 750);
  await capture(mobilePage, `${output}/05-touch-arrow-long-hold.png`);
  await mobilePage.mouse.up();
  mobileState = await readState(mobilePage);
  assert.ok(mobileState.players.left.x > touchStartX + 10, 'a long-held touch arrow should keep moving the human');
  const touchRightX = mobileState.players.left.x;
  await touchControl(mobilePage, 98, 630, 260);
  assert.ok((await readState(mobilePage)).players.left.x < touchRightX, 'touch left should reverse movement');

  await mobilePage.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(400);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    match.leftPlayer.sprite.setVelocity(0, 0);
    match.leftPlayer.dashTimer = 0;
    match.leftPlayer.dashCooldown = 0;
    match.inputController.neutralize();
  });
  await touchControl(mobilePage, 238, 630, 45);
  await advance(mobilePage, 55);
  await touchControl(mobilePage, 238, 630, 55);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.players.left.dashDirection, 1, 'double-tapping the right touch arrow should dash right');
  assert.ok(mobileState.players.left.dashTimer > 0 && mobileState.players.left.dashCooldown > 0);

  const mobileTouch = await mobile.newCDPSession(mobilePage);
  const [compactRightPoint, lowerJumpPoint] = await Promise.all([
    canvasPoint(mobilePage, 238, 630),
    canvasPoint(mobilePage, 1020, 630),
  ]);
  const compactRightTouch = {
    x: compactRightPoint.x,
    y: compactRightPoint.y,
    id: 21,
    radiusX: 8,
    radiusY: 8,
    force: 1,
  };
  const lowerJumpTouch = {
    x: lowerJumpPoint.x,
    y: lowerJumpPoint.y,
    id: 22,
    radiusX: 8,
    radiusY: 8,
    force: 1,
  };
  await mobilePage.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(400);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    match.leftPlayer.dashTimer = 0;
    match.leftPlayer.dashCooldown = 0;
    match.leftPlayer.sprite.setVelocity(0, 0);
    match.inputController.neutralize();
  });
  await mobileTouch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [compactRightTouch],
  });
  await advance(mobilePage, 50);
  const compactMoveStartX = (await readState(mobilePage)).players.left.x;
  await mobileTouch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [compactRightTouch, lowerJumpTouch],
  });
  await advance(mobilePage, 70);
  mobileState = await readState(mobilePage);
  assert.ok(mobileState.players.left.x > compactMoveStartX, 'compact Right should remain held while Jump is pressed');
  assert.ok(mobileState.players.left.vy < 0, 'the restored lower Jump should launch while Right remains held');
  assert.equal(mobileState.inputDiagnostics.touch.right, true, 'Jump must not release the movement pointer');
  await mobileTouch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [lowerJumpTouch],
  });
  await advance(mobilePage, 40);
  assert.equal((await readState(mobilePage)).inputDiagnostics.touch.right, true, 'releasing Jump must preserve held Right');
  await mobileTouch.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [compactRightTouch],
  });
  await advance(mobilePage, 40);

  await mobilePage.evaluate(() => {
    const game = window.__SKYHEAD_GAME__;
    game.registry.set('developer:footballTouchMovementMode', 'joystick');
    game.scene.getScene('Match').scene.restart();
  });
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(mobilePage, 3100);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.footballTouchMovementMode, 'joystick');
  assert.equal(mobileState.controls.move, 'analog horizontal virtual joystick');
  assert.equal(mobileState.controls.dash, 'flick from the center to the joystick edge');
  assert.equal(mobileState.touchControlVisuals.movementMode, 'joystick');
  assert.equal(mobileState.touchControlVisuals.joystick.axis, 'horizontal');
  assert.ok(mobileState.touchControlVisuals.joystick.radius > 110, 'wide-phone scaling should make the developer joystick comfortably thumb-sized');
  assert.equal(
    mobileState.touchControlVisuals.joystick.y,
    720 - mobileState.touchControlVisuals.joystick.radius - 8,
  );

  await mobilePage.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(400);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    match.leftPlayer.sprite.setVelocity(0, 0);
    match.leftPlayer.dashTimer = 0;
    match.leftPlayer.dashCooldown = 0;
    match.inputController.neutralize();
  });
  mobileState = await readState(mobilePage);
  const mobileJoystick = mobileState.touchControlVisuals.joystick;
  const touchWalkPoint = await stagePoint(
    mobilePage,
    mobileJoystick.x + mobileJoystick.radius * 0.55,
    mobileJoystick.y,
  );
  await mobilePage.mouse.move(touchWalkPoint.x, touchWalkPoint.y);
  await mobilePage.mouse.down();
  await advance(mobilePage, 520);
  mobileState = await readState(mobilePage);
  const analogWalkSpeed = mobileState.players.left.vx;
  assert.ok(Math.abs(mobileState.currentIntent.left.move - 0.55) < 0.03);
  assert.equal(mobileState.touchControlVisuals.joystick.boosted, false);
  assert.equal(mobileState.players.left.dashCooldown, 0, 'the inner joystick lane should walk without dashing');
  assert.ok(
    analogWalkSpeed > 0.8 && analogWalkSpeed < 4,
    `partial tilt should produce a deliberate walking speed below the full-run range; vx=${analogWalkSpeed}`,
  );
  await capture(mobilePage, `${output}/05-touch-analog-walk.png`);
  await mobilePage.mouse.up();
  await advance(mobilePage, 100);

  await mobilePage.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    window.__SKYHEAD_DEBUG__.setHumanPosition(400);
    match.leftPlayer.sprite.setVelocity(0, 0);
    match.leftPlayer.dashTimer = 0;
    match.leftPlayer.dashCooldown = 0;
  });
  const touchEdgePoint = await stagePoint(
    mobilePage,
    mobileJoystick.x + mobileJoystick.radius * 0.92,
    mobileJoystick.y,
  );
  await mobilePage.mouse.move(touchEdgePoint.x, touchEdgePoint.y);
  await mobilePage.mouse.down();
  await advance(mobilePage, 60);
  mobileState = await readState(mobilePage);
  assert.ok(Math.abs(mobileState.currentIntent.left.move - 0.92) < 0.03);
  assert.equal(mobileState.touchControlVisuals.joystick.boosted, true);
  assert.equal(
    mobileState.inputDiagnostics.touchDashArmed,
    false,
    `the first edge gesture should consume its dash arm; ${JSON.stringify(mobileState.inputDiagnostics)}`,
  );
  assert.equal(mobileState.players.left.dashDirection, 1, 'the center-to-edge gesture should trigger one rightward dash');
  assert.ok(mobileState.players.left.dashTimer > 0 && mobileState.players.left.dashCooldown > 0);
  assert.ok(mobileState.players.left.vx > analogWalkSpeed + 5, 'the edge dash should be decisively faster than a partial tilt');
  await capture(mobilePage, `${output}/05-touch-joystick-dash.png`);
  await advance(mobilePage, 180);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.players.left.dashTimer, 0, 'the edge dash should fall back to ordinary running after one burst');
  assert.equal(mobileState.inputDiagnostics.touchDashArmed, false, 'holding at the edge must not rearm or repeat the dash');

  const touchCenterPoint = await stagePoint(
    mobilePage,
    mobileJoystick.x,
    mobileJoystick.y,
  );
  await mobilePage.mouse.move(touchCenterPoint.x, touchCenterPoint.y);
  await advance(mobilePage, 40);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.touchControlVisuals.joystick.direction, 'neutral');
  assert.equal(mobileState.inputDiagnostics.touchDashArmed, true, 'returning to the center should rearm the edge gesture');
  await advance(mobilePage, 1400);
  await mobilePage.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(400);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
    match.leftPlayer.sprite.setVelocity(0, 0);
    match.leftPlayer.stunTimer = 0;
    match.leftPlayer.dashTimer = 0;
    match.leftPlayer.dashCooldown = 0;
  });
  await mobilePage.mouse.move(touchEdgePoint.x, touchEdgePoint.y);
  await advance(mobilePage, 60);
  mobileState = await readState(mobilePage);
  assert.equal(
    mobileState.players.left.dashDirection,
    1,
    `center-to-edge should dash again after the cooldown; ${JSON.stringify({
      player: mobileState.players.left,
      intent: mobileState.currentIntent.left,
      input: mobileState.inputDiagnostics,
      joystick: mobileState.touchControlVisuals.joystick,
    })}`,
  );
  assert.ok(mobileState.players.left.dashTimer > 0);
  await mobilePage.mouse.up();
  await advance(mobilePage, 180);

  const touchGroundY = (await readState(mobilePage)).players.left.y;
  await touchControl(mobilePage, 1020, 630, 80);
  mobileState = await readState(mobilePage);
  assert.ok(mobileState.players.left.y < touchGroundY && mobileState.players.left.vy < 0, 'touch jump should launch upward');
  await advance(mobilePage, 1050);

  mobileState = await readState(mobilePage);
  await mobilePage.evaluate(({ x }) => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(x);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
  }, mobileState.players.left);
  await touchControl(mobilePage, 1165, 610, 50);
  assert.ok((await readState(mobilePage)).players.left.kickCooldown > 0, 'touch kick should activate');
  await advance(mobilePage, 520);

  await mobilePage.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(0);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 620, y: 360, vx: 0.2, vy: -2 });
  });
  const touchChilenasBefore = (await readState(mobilePage)).players.left.chilenaSuccesses;
  await touchControl(mobilePage, 1165, 610, 17);
  assert.equal((await readState(mobilePage)).players.left.chilenaSuccesses, touchChilenasBefore, 'one touch kick must not trigger a chilena');
  await touchControl(mobilePage, 1165, 610, 17);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.players.left.chilenaSuccesses, touchChilenasBefore + 1, 'the tablet kick button should trigger the same two-tap chilena');
  assert.equal(mobileState.players.left.chilenaActive, true);
  assert.equal(mobileState.players.left.meter, 100);
  assert.equal(mobileState.powerBall.superpowerId, 'chilena');
  await advance(mobilePage, 150);
  await capture(mobilePage, `${output}/05-touch-chilena.png`);
  await advance(mobilePage, 1350);
  mobileState = await readState(mobilePage);
  for (let attempt = 0; attempt < 8 && !mobileState.players.left.grounded; attempt += 1) {
    await advance(mobilePage, 50);
    mobileState = await readState(mobilePage);
  }
  assert.equal(mobileState.players.left.chilenaActive, false);
  assert.equal(mobileState.players.left.facing, 1);
  assert.equal(mobileState.players.left.grounded, true);
  assert.ok(Math.abs(mobileState.players.left.y - 547) < 8, `tablet chilena landing should preserve Joel's ground height; got y=${mobileState.players.left.y}`);
  assert.ok(groundedVisualFrames.has(mobileState.players.left.visualFrame), `chilena landing should use a grounded pose; got frame ${mobileState.players.left.visualFrame}`);
  assert.ok(
    Math.abs(mobileState.players.left.visualGroundAnchorY - 636) < 1.5,
    `chilena landing feet should remain visually registered; got ${mobileState.players.left.visualGroundAnchorY}`,
  );

  await mobilePage.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(0);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 620, y: 360, vx: 0, vy: -1 });
  });
  await touchControl(mobilePage, 1195, 475, 17);
  await touchControl(mobilePage, 1195, 475, 17);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.powerBall.superpowerId, 'chilena-lob', 'double-tapping the tablet Lob icon should start the high chilena');
  assert.equal(mobileState.powerBall.trajectory?.phase, 'rising');
  await capture(mobilePage, `${output}/05-touch-lob-chilena-launch.png`);
  let touchLobChilenaApexY = mobileState.ball.y;
  for (let step = 0; step < 80 && mobileState.powerBall.trajectory?.phase === 'rising'; step += 1) {
    await advance(mobilePage, 1000 / 60);
    mobileState = await readState(mobilePage);
    touchLobChilenaApexY = Math.min(touchLobChilenaApexY, mobileState.ball.y);
  }
  assert.equal(mobileState.powerBall.trajectory?.phase, 'goalward');
  assert.ok(touchLobChilenaApexY >= 130 && touchLobChilenaApexY <= 165, `tablet high chilena should reach the scoreboard; got y=${touchLobChilenaApexY}`);
  assert.ok(mobileState.ball.vx > 20 && mobileState.ball.vy > 0);
  await capture(mobilePage, `${output}/05-touch-lob-chilena-redirect.png`);
  await advance(mobilePage, 1150);

  await mobilePage.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(24);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.stunOpponent(1);
    window.__SKYHEAD_DEBUG__.setBall({ x: 678, y: 537 });
  });
  for (let tap = 0; tap < 4; tap += 1) {
    await touchControl(mobilePage, 1165, 610, 30);
  }
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.lastBoostedStrike?.side, 'left', 'touch mash should produce a boosted basic kick');
  assert.ok(
    mobileState.lastBoostedStrike?.energySpent >= 8 && mobileState.lastBoostedStrike?.energySpent <= 24,
    `touch mash should apply at least one boost step; got ${mobileState.lastBoostedStrike?.energySpent}`,
  );
  assert.ok(
    mobileState.ball.vx > 16 && mobileState.ball.vx < 23,
    `touch boost should remain stronger than a basic kick and below power; got ${mobileState.ball.vx}`,
  );
  assert.ok(mobileState.meterFlash.left > 0);
  await capture(mobilePage, `${output}/05-touch-boosted-kick.png`);
  await advance(mobilePage, 520);

  mobileState = await readState(mobilePage);
  await mobilePage.evaluate(({ x, y }) => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(x);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: x + 78, y: 537 });
  }, mobileState.players.left);
  await touchControl(mobilePage, 1195, 475, 80);
  assert.ok((await readState(mobilePage)).ball.vy < -9, 'touch lob should launch the ball upward');
  await advance(mobilePage, 520);

  await touchControl(mobilePage, 118, 54, 40);
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(mobilePage, 3100);
  mobileState = await readState(mobilePage);
  await mobilePage.evaluate(({ x }) => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.grantEquippedPower('ice', 1);
    window.__SKYHEAD_DEBUG__.setHumanPosition(x);
    window.__SKYHEAD_DEBUG__.setHumanMeter(100);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(x + 220);
    window.__SKYHEAD_DEBUG__.setBall({ x: x - 160, y: 400 });
  }, mobileState.players.left);
  await touchControl(mobilePage, 930, 500, 70);
  await advance(mobilePage, 85);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.powerBall.active, false, 'tablet Freeze should not depend on striking the ball');
  assert.deepEqual(mobileState.lastInstantPower, { powerId: 'ice', target: 'right' });
  assert.equal(mobileState.players.right.frozen, true, 'tablet Freeze should immediately immobilize the opponent');
  await capture(mobilePage, `${output}/05-touch-freeze.png`);

  await capture(mobilePage, `${output}/05-touch-landscape.png`);

  await touchControl(mobilePage, 52, 54, 40);
  assert.equal((await readState(mobilePage)).mode, 'paused', 'touch pause should stop the match');
  await capture(mobilePage, `${output}/06-touch-pause.png`);
  await touchControl(mobilePage, 640, 390, 40);
  assert.equal((await readState(mobilePage)).mode, 'playing', 'touch resume should continue the match');

  await touchControl(mobilePage, 118, 54, 40);
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(mobilePage, 3100);
  await touchControl(mobilePage, 52, 54, 40);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.mode, 'paused');
  assert.deepEqual(mobileState.pauseActions, ['resume', 'restart', 'abandon match']);
  await capture(mobilePage, `${output}/06-touch-abandon-menu.png`);
  await touchControl(mobilePage, 775, 475, 40);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.modal, 'abandon-confirm', 'pause-menu abandon must require confirmation');
  assert.equal(mobileState.mode, 'paused');
  await touchControl(mobilePage, 505, 438, 40);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.modal, null, 'Stay should dismiss the confirmation');
  assert.equal(mobileState.mode, 'paused', 'Stay should return to the existing pause menu');
  await mobilePage.waitForTimeout(550);
  await touchControl(mobilePage, 775, 475, 40);
  assert.equal((await readState(mobilePage)).modal, 'abandon-confirm');
  await mobilePage.waitForTimeout(550);
  await touchControl(mobilePage, 775, 438, 40);
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  assert.equal((await readState(mobilePage)).inputMode, 'touch', 'tablet abandon should return to the touch-specific intro');
  assert.deepEqual(mobileErrors, [], `mobile browser emitted errors:\n${mobileErrors.join('\n')}`);
  await mobile.close();

  const selectorContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const selectorPage = await selectorContext.newPage();
  const selectorErrors = [];
  selectorPage.on('pageerror', (error) => selectorErrors.push(error.stack ?? error.message));
  selectorPage.on('console', (message) => {
    if (message.type() === 'error') selectorErrors.push(`console: ${message.text()}`);
  });
  await selectorPage.goto(url, { waitUntil: 'domcontentloaded' });
  await waitThroughSplash(selectorPage);
  await touchControl(selectorPage, 640, 252, 45);
  await selectorPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');

  const fieldNextPoint = await canvasPoint(selectorPage, 580, 430);
  await selectorPage.mouse.move(fieldNextPoint.x, fieldNextPoint.y);
  await selectorPage.mouse.down();
  await advance(selectorPage, 45);
  assert.equal((await readState(selectorPage)).arena.id, 'neon', 'field selector should activate once on touch-down');
  await selectorPage.mouse.up();
  assert.equal((await readState(selectorPage)).arena.id, 'neon', 'field selector release must not advance again');
  await selectorPage.waitForTimeout(60);
  await selectorPage.mouse.down();
  await advance(selectorPage, 45);
  assert.equal((await readState(selectorPage)).arena.id, 'neon', 'field compatibility press must be ignored');
  await selectorPage.mouse.up();
  await selectorPage.waitForTimeout(550);
  await selectorPage.mouse.down();
  await advance(selectorPage, 45);
  assert.equal((await readState(selectorPage)).arena.id, 'beach', 'field selector should rearm after the guard');
  await selectorPage.mouse.up();

  const ballNextPoint = await canvasPoint(selectorPage, 1155, 430);
  await selectorPage.mouse.move(ballNextPoint.x, ballNextPoint.y);
  await selectorPage.mouse.down();
  await advance(selectorPage, 45);
  assert.equal((await readState(selectorPage)).ballType.id, 'neon-ball', 'ball selector should activate once on touch-down');
  await selectorPage.mouse.up();
  assert.equal((await readState(selectorPage)).ballType.id, 'neon-ball', 'ball selector release must not advance again');
  await selectorPage.waitForTimeout(60);
  await selectorPage.mouse.down();
  await advance(selectorPage, 45);
  assert.equal((await readState(selectorPage)).ballType.id, 'neon-ball', 'ball compatibility press must be ignored');
  await selectorPage.mouse.up();
  await selectorPage.waitForTimeout(550);
  await selectorPage.mouse.down();
  await advance(selectorPage, 45);
  assert.equal((await readState(selectorPage)).ballType.id, 'balloon', 'ball selector should rearm after the guard');
  await selectorPage.mouse.up();
  await capture(selectorPage, `${output}/07-touch-football-selectors.png`);
  assert.deepEqual(selectorErrors, [], `selector browser emitted errors:\n${selectorErrors.join('\n')}`);
  await selectorContext.close();

  const tablet = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const tabletPage = await tablet.newPage();
  const tabletErrors = [];
  tabletPage.on('pageerror', (error) => tabletErrors.push(error.stack ?? error.message));
  tabletPage.on('console', (message) => {
    if (message.type() === 'error') tabletErrors.push(`console: ${message.text()}`);
  });
  await tabletPage.goto(url, { waitUntil: 'domcontentloaded' });
  await waitThroughSplash(tabletPage);
  let tabletState = await readState(tabletPage);
  assert.equal(tabletState.mode, 'intro');
  assert.deepEqual(tabletState.stageLayout, {
    extended: true,
    width: 1280,
    height: 800,
    gameplayWidth: 1280,
    gameplayHeight: 720,
    extraHeight: 80,
    bottomOffset: 80,
  });
  const tabletCanvas = await tabletPage.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const bounds = canvas.getBoundingClientRect();
    return { bitmapWidth: canvas.width, bitmapHeight: canvas.height, width: bounds.width, height: bounds.height };
  });
  assert.deepEqual(tabletCanvas, { bitmapWidth: 1280, bitmapHeight: 800, width: 1280, height: 800 });
  await capture(tabletPage, `${output}/08-extended-tablet-intro.png`);

  await touchControl(tabletPage, 430, 539, 40);
  await tabletPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'mini-games');
  await capture(tabletPage, `${output}/08-extended-tablet-mini-games.png`);
  await touchControl(tabletPage, 345, 304, 40);
  await tabletPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'minigame-setup');
  await capture(tabletPage, `${output}/08-extended-tablet-kickfall-setup.png`);
  await touchControl(tabletPage, 640, 700, 40);
  await tabletPage.waitForFunction(() => ['countdown', 'playing'].includes(JSON.parse(window.render_game_to_text()).mode));
  await tabletPage.evaluate(() => {
    window.__KICKFALL_DEBUG__.startPlaying();
    window.__KICKFALL_DEBUG__.prepareGateKick('gate-a');
  });
  await touchControl(tabletPage, 1170, 720, 80);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.minigame, 'kickfall');
  assert.equal(tabletState.gates.find((gate) => gate.id === 'gate-a').active, false, 'tablet Kick should break a Kickfall gate');
  await tabletPage.evaluate(() => window.__KICKFALL_DEBUG__.clearBalls());
  assert.equal(tabletState.controls.move, '8-way virtual joystick');
  assert.deepEqual(
    [
      tabletState.controls.joystick.x,
      tabletState.controls.joystick.y,
      tabletState.controls.joystick.radius,
      tabletState.controls.joystick.direction,
    ],
    [182, 674, 118, 'neutral'],
  );
  const tabletTouch = await tablet.newCDPSession(tabletPage);
  const joystickCenterTouch = {
    x: tabletState.controls.joystick.x,
    y: tabletState.controls.joystick.y,
    id: 1,
    radiusX: 8,
    radiusY: 8,
    force: 1,
  };
  const joystickDownRightTouch = {
    ...joystickCenterTouch,
    x: joystickCenterTouch.x + tabletState.controls.joystick.radius * 0.72,
    y: joystickCenterTouch.y + tabletState.controls.joystick.radius * 0.72,
  };
  const jumpTouch = { x: 1035, y: 705, id: 2, radiusX: 8, radiusY: 8, force: 1 };
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [joystickCenterTouch] });
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [joystickDownRightTouch] });
  await advance(tabletPage, 80);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.controls.joystick.direction, 'down-right');
  assert.ok(tabletState.player.vx > 0, 'the joystick horizontal component should move the player');
  assert.equal(tabletState.player.tierId, 'top', 'joystick Down alone must not change tiers');
  await tabletTouch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [joystickDownRightTouch, jumpTouch],
  });
  await advance(tabletPage, 40);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.controls.joystick.direction, 'down-right', 'Jump must not steal the joystick pointer');
  assert.equal(tabletState.player.tierTransfer?.targetTierId, 'upper');
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [jumpTouch] });
  await advance(tabletPage, 40);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.controls.joystick.direction, 'down-right', 'releasing Jump must keep the joystick held');
  assert.equal(tabletState.controls.joystick.pointerId, 1);
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [joystickDownRightTouch] });
  await advance(tabletPage, 320);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.controls.joystick.direction, 'neutral');
  assert.equal(tabletState.controls.joystick.pointerId, null);
  assert.equal(tabletState.player.tierId, 'upper', 'joystick Down + Jump should move to the adjacent lower tier');
  await touchControl(tabletPage, 1035, 705, 35);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.player.tierId, 'upper', 'tablet Jump should remain separate from tier direction');
  assert.ok(tabletState.player.vy < 0, 'the dedicated tablet Jump control should apply upward velocity');
  await advance(tabletPage, 700);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.player.grounded, true, 'tablet Jump should land promptly');
  assert.ok(Math.abs(tabletState.player.platformSurfaceY - tabletState.player.visualGroundAnchorY) < 3);
  const joystickRightTouch = {
    ...joystickCenterTouch,
    x: joystickCenterTouch.x + tabletState.controls.joystick.radius * 0.91,
  };
  const kickTouch = { x: 1170, y: 725, id: 2, radiusX: 8, radiusY: 8, force: 1 };
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [joystickCenterTouch] });
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [joystickRightTouch] });
  await advance(tabletPage, 60);
  tabletState = await readState(tabletPage);
  const kickJoystickPointerId = tabletState.controls.joystick.pointerId;
  assert.equal(tabletState.controls.joystick.direction, 'right');
  await tabletTouch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [joystickRightTouch, kickTouch],
  });
  await advance(tabletPage, 40);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.controls.joystick.direction, 'right', 'Kick must not steal the joystick pointer');
  assert.equal(tabletState.controls.joystick.pointerId, kickJoystickPointerId);
  assert.ok(tabletState.player.kickCooldown > 0, 'Kick should fire while the joystick remains held right');
  assert.ok(tabletState.player.vx > 0, 'rightward joystick movement must continue during Kick');
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [kickTouch] });
  await advance(tabletPage, 80);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.controls.joystick.direction, 'right', 'releasing Kick must keep the joystick held');
  assert.equal(tabletState.controls.joystick.pointerId, kickJoystickPointerId);
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [joystickRightTouch] });
  await advance(tabletPage, 40);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.controls.joystick.direction, 'neutral');
  assert.equal(tabletState.controls.joystick.pointerId, null);
  await capture(tabletPage, `${output}/08-extended-tablet-kickfall.png`);
  await touchControl(tabletPage, 92, 38, 40);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.mode, 'paused', 'the Kickfall HUD button should open pause on touch layouts');
  assert.equal(tabletState.controls.joystick.visible, false, 'pausing must hide and release the joystick');
  assert.equal(tabletState.controls.joystick.direction, 'neutral');
  assert.deepEqual(tabletState.pauseActions, ['resume', 'restart level', 'leave Kickfall']);
  await capture(tabletPage, `${output}/08-extended-tablet-kickfall-pause.png`);
  await touchControl(tabletPage, 775, 475, 40);
  assert.equal((await readState(tabletPage)).modal, 'abandon-confirm');
  await touchControl(tabletPage, 505, 478, 40);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.mode, 'paused');
  assert.equal(tabletState.modal, null, 'Stay should return tablet players to the existing pause menu');
  await tabletPage.waitForTimeout(550);
  await touchControl(tabletPage, 775, 475, 40);
  await tabletPage.waitForTimeout(550);
  await touchControl(tabletPage, 775, 478, 40);
  await tabletPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'minigame-setup');
  await touchControl(tabletPage, 82, 52, 40);
  await tabletPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'mini-games');
  await tabletPage.waitForTimeout(550);
  await touchControl(tabletPage, 82, 52, 40);
  await tabletPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');

  await touchControl(tabletPage, 1020, 539, 40);
  await tabletPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'settings');
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.stageLayout.height, 800);
  await capture(tabletPage, `${output}/08-extended-tablet-settings.png`);
  await touchControl(tabletPage, 640, 720, 40);
  await tabletPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');

  await touchControl(tabletPage, 640, 252, 40);
  await tabletPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  await capture(tabletPage, `${output}/08-extended-tablet-football-setup.png`);
  await touchControl(tabletPage, 430, 740, 40);
  await tabletPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'power-lab');
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.stageLayout.bottomOffset, 80);
  await capture(tabletPage, `${output}/08-extended-tablet-lab.png`);
  await touchControl(tabletPage, 74, 48, 40);
  await tabletPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');

  await tabletPage.evaluate(() => {
    window.__SKYHEAD_GAME__.registry.set('developer:footballTouchMovementMode', 'joystick');
  });
  await touchControl(tabletPage, 785, 740, 40);
  await tabletPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(tabletPage, 3100);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.mode, 'playing');
  assert.equal(tabletState.stageLayout.height, 800);
  assert.equal(tabletState.footballTouchMovementMode, 'joystick');
  assert.deepEqual(
    {
      axis: tabletState.touchControlVisuals.joystick.axis,
      x: tabletState.touchControlVisuals.joystick.x,
      y: tabletState.touchControlVisuals.joystick.y,
      radius: tabletState.touchControlVisuals.joystick.radius,
    },
    { axis: 'horizontal', x: 178, y: 678, radius: 114 },
  );
  assert.equal(tabletState.touchControlVisuals.joystick.boostThreshold, 0.82);
  const tabletStartX = tabletState.players.left.x;
  const tabletLeftEdgePoint = await stagePoint(
    tabletPage,
    tabletState.touchControlVisuals.joystick.x
      - tabletState.touchControlVisuals.joystick.radius * 0.92,
    tabletState.touchControlVisuals.joystick.y,
  );
  await tabletPage.mouse.move(tabletLeftEdgePoint.x, tabletLeftEdgePoint.y);
  await tabletPage.mouse.down();
  await advance(tabletPage, 70);
  tabletState = await readState(tabletPage);
  const leftEdgePointerId = tabletState.touchControlVisuals.joystick.pointerId;
  assert.equal(tabletState.touchControlVisuals.joystick.direction, 'left');
  assert.equal(tabletState.touchControlVisuals.joystick.boosted, true);
  assert.ok(tabletState.players.left.x < tabletStartX, 'extended tablet left control should move Joel');
  await tabletPage.evaluate(() => {
    window.__SKYHEAD_GAME__.scene.getScene('Match').input.emit('gameout');
  });
  await advance(tabletPage, 70);
  tabletState = await readState(tabletPage);
  assert.equal(
    tabletState.touchControlVisuals.joystick.pointerId,
    leftEdgePointerId,
    'crossing the canvas edge must preserve joystick pointer ownership',
  );
  assert.equal(
    tabletState.touchControlVisuals.joystick.direction,
    'left',
    'crossing the canvas edge must keep the joystick clamped left',
  );
  assert.ok(
    tabletState.currentIntent.left.move < -0.9,
    'left movement should remain active while the held pointer is outside the canvas',
  );
  await capture(tabletPage, `${output}/08-extended-tablet-left-edge-hold.png`);
  await tabletPage.mouse.up();
  await advance(tabletPage, 40);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.touchControlVisuals.joystick.pointerId, null);
  assert.equal(tabletState.touchControlVisuals.joystick.direction, 'neutral');
  await tabletPage.evaluate(() => {
    const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
    match.leftPlayer.dashTimer = 0;
    match.leftPlayer.dashCooldown = 0;
    match.leftPlayer.dashDirection = 0;
    match.inputController.neutralize();
  });
  const matchJoystickCenterTouch = {
    x: tabletState.touchControlVisuals.joystick.x,
    y: tabletState.touchControlVisuals.joystick.y,
    id: 3,
    radiusX: 8,
    radiusY: 8,
    force: 1,
  };
  const matchJoystickRightTouch = {
    ...matchJoystickCenterTouch,
    x: matchJoystickCenterTouch.x + tabletState.touchControlVisuals.joystick.radius * 0.92,
  };
  const matchKickTouch = { x: 1165, y: 690, id: 4, radiusX: 8, radiusY: 8, force: 1 };
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [matchJoystickCenterTouch] });
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [matchJoystickRightTouch] });
  await advance(tabletPage, 70);
  tabletState = await readState(tabletPage);
  const matchJoystickPointerId = tabletState.touchControlVisuals.joystick.pointerId;
  assert.equal(tabletState.touchControlVisuals.joystick.direction, 'right');
  assert.equal(tabletState.touchControlVisuals.joystick.boosted, true);
  assert.ok(tabletState.players.left.dashTimer > 0);
  const beforeKickAndMoveX = tabletState.players.left.x;
  await tabletTouch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [matchJoystickRightTouch, matchKickTouch],
  });
  await advance(tabletPage, 70);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.touchControlVisuals.joystick.pointerId, matchJoystickPointerId, 'Kick must not steal the Football joystick pointer');
  assert.equal(tabletState.touchControlVisuals.joystick.direction, 'right');
  assert.ok(tabletState.players.left.x > beforeKickAndMoveX, 'horizontal movement must continue while Kick is held');
  assert.ok(tabletState.players.left.kickCooldown > 0, 'Kick should fire while the horizontal joystick remains held');
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [matchKickTouch] });
  await advance(tabletPage, 40);
  assert.equal((await readState(tabletPage)).touchControlVisuals.joystick.direction, 'right', 'releasing Kick must keep Football movement held');
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [matchJoystickRightTouch] });
  await advance(tabletPage, 40);

  const matchJumpJoystickCenterTouch = { ...matchJoystickCenterTouch, id: 5 };
  const matchJumpJoystickRightTouch = { ...matchJoystickRightTouch, id: 5 };
  const matchJumpTouch = { x: 1020, y: 710, id: 6, radiusX: 8, radiusY: 8, force: 1 };
  await tabletPage.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(400);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1000);
    window.__SKYHEAD_DEBUG__.setBall({ x: 760, y: 420 });
  });
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [matchJumpJoystickCenterTouch] });
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [matchJumpJoystickRightTouch] });
  await tabletTouch.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [matchJumpJoystickRightTouch, matchJumpTouch],
  });
  await advance(tabletPage, 70);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.touchControlVisuals.joystick.direction, 'right', 'Jump must not interrupt the Football joystick');
  assert.ok(tabletState.players.left.vy < 0, 'Jump should fire while the horizontal joystick remains held');
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [matchJumpTouch] });
  await tabletTouch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [matchJumpJoystickRightTouch] });
  await advance(tabletPage, 40);
  assert.equal((await readState(tabletPage)).touchControlVisuals.joystick.direction, 'neutral');
  await capture(tabletPage, `${output}/08-extended-tablet-match.png`);
  await touchControl(tabletPage, 52, 54, 40);
  tabletState = await readState(tabletPage);
  assert.equal(tabletState.mode, 'paused');
  await capture(tabletPage, `${output}/08-extended-tablet-pause.png`);
  await touchControl(tabletPage, 640, 390, 40);
  assert.equal((await readState(tabletPage)).mode, 'playing');
  assert.deepEqual(tabletErrors, [], `extended tablet browser emitted errors:\n${tabletErrors.join('\n')}`);
  await tablet.close();

  const penaltyContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
  });
  const penaltyPage = await penaltyContext.newPage();
  const penaltyErrors = [];
  penaltyPage.on('pageerror', (error) => penaltyErrors.push(error.stack ?? error.message));
  penaltyPage.on('console', (message) => {
    if (message.type() === 'error') penaltyErrors.push(`console: ${message.text()}`);
  });
  await penaltyPage.goto(url, { waitUntil: 'domcontentloaded' });
  await waitThroughSplash(penaltyPage);
  await touchControl(penaltyPage, 1020, 493, 35);
  await penaltyPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'settings');
  await touchControl(penaltyPage, 685, 188, 30);
  await penaltyPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).language === 'es');
  await touchControl(penaltyPage, 640, 640, 35);
  await penaltyPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await capture(penaltyPage, `${output}/07-intro-es-tablet.png`);
  await touchControl(penaltyPage, 640, 252, 35);
  await penaltyPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  await touchControl(penaltyPage, 430, 660, 35);
  await penaltyPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'power-lab');
  await capture(penaltyPage, `${output}/07-power-lab-tablet.png`);
  await touchControl(penaltyPage, 805, 638, 35);
  let penaltyState = await readState(penaltyPage);
  assert.equal(penaltyState.operationMode, 'random');
  assertAgeAppropriateChallenge(penaltyState.challenge);
  await answerChallenge(penaltyPage, penaltyState.challenge, false);
  penaltyState = await readState(penaltyPage);
  assert.equal(penaltyState.challenge?.status, 'locked', 'a wrong answer should immediately close further answer attempts');
  assert.ok(penaltyState.mathLockRemainingMs > 295_000, 'a wrong answer should start a five-minute penalty');
  assert.equal(penaltyState.powers.fireball, 0, 'a wrong answer must not award a charge');
  await capture(penaltyPage, `${output}/07-math-penalty-tablet.png`);

  await penaltyPage.reload({ waitUntil: 'domcontentloaded' });
  await waitThroughSplash(penaltyPage);
  await touchControl(penaltyPage, 640, 252, 35);
  await penaltyPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  await touchControl(penaltyPage, 430, 660, 35);
  await penaltyPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'power-lab');
  penaltyState = await readState(penaltyPage);
  assert.ok(penaltyState.mathLockRemainingMs > 290_000, 'refresh must not bypass the persisted math penalty');
  await touchControl(penaltyPage, 805, 638, 35);
  assert.equal((await readState(penaltyPage)).challenge, null, 'the solve action should remain disabled during cooldown');
  assert.deepEqual(penaltyErrors, [], `penalty browser emitted errors:\n${penaltyErrors.join('\n')}`);
  await penaltyContext.close();

  const spanishDevice = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: true,
    locale: 'es-ES',
  });
  const spanishDevicePage = await spanishDevice.newPage();
  await spanishDevicePage.goto(url, { waitUntil: 'domcontentloaded' });
  await waitThroughSplash(spanishDevicePage);
  let spanishDeviceState = await readState(spanishDevicePage);
  assert.equal(spanishDeviceState.language, 'es', 'a fresh Spanish tablet should detect Spanish');
  assert.equal(spanishDeviceState.languageSource, 'device');
  await touchControl(spanishDevicePage, 1020, 539, 35);
  await spanishDevicePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'settings');
  await touchControl(spanishDevicePage, 595, 188, 30);
  await spanishDevicePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).language === 'en');
  await touchControl(spanishDevicePage, 640, 720, 30);
  await spanishDevicePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  spanishDeviceState = await readState(spanishDevicePage);
  assert.equal(spanishDeviceState.language, 'en');
  assert.equal(spanishDeviceState.languageSource, 'user', 'a language button must become a durable user choice');
  await spanishDevicePage.reload({ waitUntil: 'domcontentloaded' });
  await waitThroughSplash(spanishDevicePage);
  spanishDeviceState = await readState(spanishDevicePage);
  assert.equal(spanishDeviceState.language, 'en', 'device locale must not overwrite a saved user choice');
  assert.equal(spanishDeviceState.languageSource, 'user');
  await spanishDevice.close();

  await writeFile(`${output}/summary.json`, JSON.stringify({ passed: true, checks: 260 }, null, 2));
  process.stdout.write('Browser game checks passed: splash, Kickfall, random math, persistence, bilingual settings, whistle signals, directional dash/boost, Big Guy, full gameplay, and touch flow.\n');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
