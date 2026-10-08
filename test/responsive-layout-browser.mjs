import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const output = new URL('../output/responsive-layout/', import.meta.url).pathname;
// E2E_PORT lets parallel runs use separate dev servers.
const port = Number(process.env.E2E_PORT) || 4177;
const url = `http://127.0.0.1:${port}`;

const devices = [
  { name: 'regular-tablet', width: 1280, height: 800, expected: 'tall', compact: false },
  { name: 'small-phone-16x9', width: 568, height: 320, expected: 'standard', compact: true },
  { name: 'phone-16x9', width: 732, height: 412, expected: 'standard', compact: true },
  { name: 'pixel-9a', width: 924, height: 412, expected: 'wide', compact: true },
  { name: 'long-tablet', width: 1920, height: 800, expected: 'wide', compact: false },
];

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
const waitForMode = (page, mode) => page.waitForFunction(
  (expected) => JSON.parse(window.render_game_to_text()).mode === expected,
  mode,
);
const capture = async (page, device, screen) => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
  await page.screenshot({ path: `${output}${device}-${screen}.png` });
};
const startScene = (page, key, data = {}) => page.evaluate(({ sceneKey, sceneData }) => {
  const active = window.__SKYHEAD_GAME__.scene.getScenes(true).at(-1);
  active.scene.start(sceneKey, sceneData);
}, { sceneKey: key, sceneData: data });
const advance = (page, milliseconds) => page.evaluate((ms) => window.advanceTime(ms), milliseconds);
const settleInputEvent = (page) => page.evaluate(
  () => new Promise((resolve) => requestAnimationFrame(resolve)),
);
const stagePoint = (page, stageX, stageY) => page.evaluate(({ x, y }) => {
  const canvas = document.querySelector('canvas');
  const bounds = canvas.getBoundingClientRect();
  return {
    x: bounds.left + (x / canvas.width) * bounds.width,
    y: bounds.top + (y / canvas.height) * bounds.height,
  };
}, { x: stageX, y: stageY });
const tapStageControl = async (page, stageX, stageY, milliseconds = 60) => {
  const point = await stagePoint(page, stageX, stageY);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await settleInputEvent(page);
  await advance(page, milliseconds);
  await page.mouse.up();
};
const assertCenteredCamera = ({ scrollX, offset }, label) => assert.ok(
  Math.abs(scrollX + offset) <= 1,
  `${label}: camera ${scrollX} should center offset ${offset}`,
);

await mkdir(output, { recursive: true });
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let browser;
try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  for (const device of devices) {
    const context = await browser.newContext({
      viewport: { width: device.width, height: device.height },
      screen: { width: device.width, height: device.height },
      deviceScaleFactor: 1,
      hasTouch: true,
      isMobile: device.compact,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await waitForMode(page, 'splash');
    const splash = await page.evaluate(() => {
      const image = document.querySelector('#startup-splash img');
      const bounds = image.getBoundingClientRect();
      return {
        objectFit: getComputedStyle(image).objectFit,
        left: Math.round(bounds.left),
        top: Math.round(bounds.top),
        right: Math.round(bounds.right),
        bottom: Math.round(bounds.bottom),
      };
    });
    assert.equal(splash.objectFit, 'cover');
    assert.ok(
      splash.left <= 0
        && splash.top <= 0
        && splash.right >= device.width
        && splash.bottom >= device.height,
      `${device.name}: splash should cover the full viewport`,
    );
    await capture(page, device.name, '00-splash');
    await page.evaluate(() => window.advanceTime(3000));
    await waitForMode(page, 'intro');
    await page.waitForFunction(() => !document.getElementById('startup-splash'));

    let state = await readState(page);
    assert.equal(Boolean(state.compactPhoneUi), device.compact, `${device.name}: correct menu bundle should be active`);
    const menuResources = await page.evaluate(() => performance.getEntriesByType('resource').map(({ name }) => name));
    if (device.compact) {
      assert.ok(menuResources.some((name) => name.includes('/game/compact/CompactIntroScene.js')));
      assert.ok(!menuResources.some((name) => name.includes('/game/scenes/IntroScene.js')));
    } else {
      assert.ok(menuResources.some((name) => name.includes('/game/scenes/IntroScene.js')));
      assert.ok(!menuResources.some((name) => name.includes('/game/compact/CompactIntroScene.js')));
    }
    if (device.expected === 'tall') {
      assert.deepEqual(
        [state.stageLayout.width, state.stageLayout.height],
        [1280, 800],
        `${device.name}: established tablet stage must remain 1280x800`,
      );
    } else if (device.expected === 'wide') {
      assert.ok(state.stageLayout.width > 1280, `${device.name}: long display should expand horizontally`);
      assert.equal(state.stageLayout.height, 720);
    } else {
      assert.deepEqual(
        [state.stageLayout.width, state.stageLayout.height],
        [1280, 720],
        `${device.name}: conventional 16:9 phones should retain the authored stage`,
      );
    }
    const canvas = await page.locator('canvas').evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: Math.round(bounds.left),
        top: Math.round(bounds.top),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    });
    assert.deepEqual(canvas, { left: 0, top: 0, width: device.width, height: device.height });
    await capture(page, device.name, '01-intro');

    if (device.name === 'phone-16x9') {
      await startScene(page, 'Settings');
      await waitForMode(page, 'settings');
      await capture(page, device.name, '01b-settings');
    }

    await startScene(page, 'Customize');
    await waitForMode(page, 'football-setup');
    await capture(page, device.name, '02-football-setup');
    const footballSetupCamera = await page.evaluate(() => {
      const scene = window.__SKYHEAD_GAME__.scene.getScene('Customize');
      return {
        scrollX: Math.round(scene.cameras.main.scrollX),
        offset: Math.round((scene.stageLayout.width - 1280) / 2),
      };
    });
    assertCenteredCamera(footballSetupCamera, `${device.name} Football setup`);
    if (device.name === 'phone-16x9') {
      await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Customize').scene.restart({ tab: 'match' }));
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).activeTab === 'match');
      await capture(page, device.name, '02b-football-match-tab');
      await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Customize').scene.restart({ tab: 'gear' }));
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).activeTab === 'gear');
      await capture(page, device.name, '02c-football-ball-power-tab');
    }

    await startScene(page, 'MatchLoading');
    await page.waitForFunction(() => Boolean(window.__SKYHEAD_DEBUG__));
    await page.evaluate(() => window.advanceTime(3100));
    state = await readState(page);
    assert.equal(state.mode, 'playing');
    if (device.expected === 'wide') {
      const overflow = state.stageLayout.width - 1280;
      assert.deepEqual(
        {
          pauseLeftGutter: state.touchControlVisuals['system:pause'].x,
          fullscreenRightGutter: state.stageLayout.width
            - state.touchControlVisuals['system:fullscreen'].x,
          moveLeftGutter: state.touchControlVisuals.left.x,
          moveRightX: state.touchControlVisuals.right.x,
          jumpRightGutter: state.stageLayout.width - state.touchControlVisuals.jump.x,
          authoredTopRadius: state.touchControlVisuals['system:pause'].authoredRadius,
          jumpAuthoredX: state.touchControlVisuals.jump.x - overflow,
        },
        {
          pauseLeftGutter: device.compact ? 48 : 52,
          fullscreenRightGutter: 52,
          moveLeftGutter: device.compact ? 90 : 98,
          moveRightX: device.compact ? 250 : 238,
          jumpRightGutter: 260,
          authoredTopRadius: device.compact ? 39.6 : 28,
          jumpAuthoredX: 1020,
        },
        `${device.name}: Football controls must use viewport-edge anchors`,
      );
    } else if (!device.compact) {
      assert.equal(
        state.touchControlVisuals['system:pause'].x,
        52,
        `${device.name}: the established tablet top row must not move`,
      );
    } else {
      assert.equal(
        state.touchControlVisuals['system:pause'].x,
        48,
        `${device.name}: compact phone system controls should use the enlarged phone row`,
      );
    }
    if (device.compact) {
      const movementGap = state.touchControlVisuals.right.x
        - state.touchControlVisuals.right.radius
        - state.touchControlVisuals.left.x
        - state.touchControlVisuals.left.radius;
      assert.ok(movementGap >= 12, `${device.name}: Football arrows need a visible gap, got ${movementGap}`);
      if (device.height >= 400) {
        const physicalScale = device.width / state.stageLayout.width;
        for (const controlId of ['system:pause', 'system:restart', 'system:home', 'system:fullscreen', 'left', 'right', 'jump', 'kick']) {
          const control = state.touchControlVisuals[controlId];
          const physicalDiameter = control.radius * 2 * physicalScale;
          assert.ok(
            physicalDiameter >= 44,
            `${device.name}: ${controlId} needs a 44px touch target, got ${physicalDiameter.toFixed(1)}px`,
          );
        }
      }
    }
    await capture(page, device.name, '03-football');
    if (device.name === 'phone-16x9') {
      await page.evaluate(() => {
        const match = window.__SKYHEAD_GAME__.scene.getScene('Match');
        window.__SKYHEAD_DEBUG__.resumePlay();
        window.__SKYHEAD_DEBUG__.setHumanPosition(400);
        window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
        match.leftPlayer.sprite.setVelocity(0, 0);
        match.inputController.neutralize();
      });
      state = await readState(page);
      const startingX = state.players.left.x;
      const rightPoint = await stagePoint(page, state.touchControlVisuals.right.x, state.touchControlVisuals.right.y);
      await page.mouse.move(rightPoint.x, rightPoint.y);
      await page.mouse.down();
      await settleInputEvent(page);
      await advance(page, 110);
      state = await readState(page);
      assert.equal(state.inputDiagnostics.touch.right, true, '16:9 Football Right must receive the held pointer');
      assert.ok(state.players.left.x > startingX, '16:9 Football Right must move the player');
      await capture(page, device.name, '03b-football-right-held');
      await page.mouse.up();
      await advance(page, 40);
      await tapStageControl(page, state.touchControlVisuals.jump.x, state.touchControlVisuals.jump.y, 45);
      state = await readState(page);
      assert.ok(state.players.left.vy < 0, '16:9 Football Jump must be reachable');
      await tapStageControl(page, state.touchControlVisuals.kick.x, state.touchControlVisuals.kick.y, 45);
      assert.ok((await readState(page)).players.left.kickCooldown > 0, '16:9 Football Kick must be reachable');
    }

    if (device.compact) {
      await startScene(page, 'Intro', { tab: 'miniGames' });
      await waitForMode(page, 'intro');
      state = await readState(page);
      assert.equal(state.compactPhoneUi, true);
      assert.equal(state.selectedMiniGameId, 'kickfall');
      assert.deepEqual(state.miniGameBackdrop, { texture: 'menu-arcade-cosmic', opacity: 1 });
      await capture(page, device.name, '04-mini-games');
      await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Intro').selectMiniGame('discHockey'));
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).selectedMiniGameId === 'discHockey');
      state = await readState(page);
      assert.deepEqual(state.miniGameBackdrop, { texture: 'disc-hockey-arena-neon', opacity: 1 });
      await capture(page, device.name, '04b-mini-games-disc-hockey-tab');
    } else {
      await startScene(page, 'MiniGames');
      await waitForMode(page, 'mini-games');
      await capture(page, device.name, '04-mini-games');
    }

    await startScene(page, 'MiniGameSetup', { gameId: 'kickfall' });
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).gameId === 'kickfall');
    const kickfallSetup = await page.evaluate(() => {
      const scene = window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup');
      return {
        scrollX: Math.round(scene.cameras.main.scrollX),
        offset: Math.round((scene.stageLayout.width - 1280) / 2),
      };
    });
    assertCenteredCamera(kickfallSetup, `${device.name} Kickfall setup`);
    await capture(page, device.name, '05-kickfall-setup');
    if (device.compact) {
      if (device.name === 'phone-16x9') {
        await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup').scene.restart({ gameId: 'kickfall', tab: 'setup' }));
        await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).activeTab === 'setup');
        await capture(page, device.name, '05a-kickfall-setup-tab');
      }
      await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup').scene.restart({ gameId: 'kickfall', tab: 'howToPlay' }));
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).activeTab === 'howToPlay');
      await capture(page, device.name, '05b-kickfall-controls-tab');
    }

    await startScene(page, 'MiniGameLoading', { gameId: 'kickfall', level: 1 });
    await page.waitForFunction(() => Boolean(window.__KICKFALL_DEBUG__), null, { timeout: 12_000 });
    await page.evaluate(() => window.advanceTime(3100));
    const kickfallLayout = await page.evaluate(() => {
      const scene = window.__SKYHEAD_GAME__.scene.getScene('Kickfall');
      const shade = scene.pauseOverlay.list[0].getBounds();
      const offset = (scene.stageLayout.width - 1280) / 2;
      return {
        width: scene.stageLayout.width,
        scrollX: Math.round(scene.cameras.main.scrollX),
        offset: Math.round(offset),
        shadeLeft: Math.round(shade.left),
        shadeRight: Math.round(shade.right),
      };
    });
    assertCenteredCamera(kickfallLayout, `${device.name} Kickfall`);
    assert.ok(kickfallLayout.shadeLeft <= -kickfallLayout.offset + 1);
    assert.ok(kickfallLayout.shadeRight >= 1280 + kickfallLayout.offset - 1);
    state = await readState(page);
    assert.ok(state.controls.joystick, `${device.name}: Kickfall touch joystick should exist`);
    assert.ok(
      Math.abs(state.controls.joystick.x - state.controls.joystick.radius - 64) < 0.01,
      `${device.name}: Kickfall joystick must keep its 16:9 edge gutter`,
    );
    assert.ok(state.controls.buttons.kick.screenX + state.controls.buttons.kick.radius <= kickfallLayout.width - 28);
    assert.ok(state.controls.buttons.jump.screenX + state.controls.buttons.jump.radius <= kickfallLayout.width - 150);
    await capture(page, device.name, '06-kickfall');
    if (device.name === 'phone-16x9') {
      const joystick = state.controls.joystick;
      const joystickCenter = await stagePoint(page, joystick.x, joystick.y);
      const joystickRight = await stagePoint(page, joystick.x + joystick.radius * 0.82, joystick.y);
      await page.mouse.move(joystickCenter.x, joystickCenter.y);
      await page.mouse.down();
      await page.mouse.move(joystickRight.x, joystickRight.y);
      await settleInputEvent(page);
      await advance(page, 110);
      state = await readState(page);
      assert.equal(state.controls.joystick.direction, 'right', '16:9 Kickfall joystick must receive a rightward drag');
      assert.ok(state.player.vx > 0, '16:9 Kickfall joystick must move the player');
      await capture(page, device.name, '06b-kickfall-joystick-held');
      await page.mouse.up();
      await advance(page, 40);
      await tapStageControl(page, state.controls.buttons.jump.screenX, state.controls.buttons.jump.screenY, 45);
      state = await readState(page);
      assert.ok(state.player.vy < 0, '16:9 Kickfall Jump must be reachable');
      await tapStageControl(page, state.controls.buttons.kick.screenX, state.controls.buttons.kick.screenY, 45);
      assert.ok((await readState(page)).player.kickCooldown > 0, '16:9 Kickfall Kick must be reachable');
    }

    await startScene(page, 'MiniGameSetup', { gameId: 'discHockey' });
    await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).gameId === 'discHockey');
    const hockeySetup = await page.evaluate(() => {
      const scene = window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup');
      return {
        scrollX: Math.round(scene.cameras.main.scrollX),
        offset: Math.round((scene.stageLayout.width - 1280) / 2),
      };
    });
    assertCenteredCamera(hockeySetup, `${device.name} Disc Hockey setup`);
    await capture(page, device.name, '07-disc-hockey-setup');
    if (device.compact) {
      await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup').scene.restart({ gameId: 'discHockey', tab: 'setup' }));
      await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).activeTab === 'setup');
      await capture(page, device.name, '07b-disc-hockey-match-tab');
      if (device.name === 'phone-16x9') {
        await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('MiniGameSetup').scene.restart({ gameId: 'discHockey', tab: 'howToPlay' }));
        await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).activeTab === 'howToPlay');
        await capture(page, device.name, '07c-disc-hockey-how-to-play-tab');
      }
    }

    await startScene(page, 'MiniGameLoading', {
      gameId: 'discHockey',
      sceneData: { mode: 'computer', themeId: 'ice' },
    });
    await page.waitForFunction(() => Boolean(window.__DISC_HOCKEY_DEBUG__), null, { timeout: 12_000 });
    await page.evaluate(() => window.__DISC_HOCKEY_DEBUG__.startPlaying());
    const hockeyLayout = await page.evaluate(() => {
      const scene = window.__SKYHEAD_GAME__.scene.getScene('DiscHockey');
      const arena = scene.arenaArtwork.getBounds();
      const offset = (scene.stageLayout.width - 1280) / 2;
      return {
        scrollX: Math.round(scene.cameras.main.scrollX),
        offset: Math.round(offset),
        arenaLeft: Math.round(arena.left),
        arenaRight: Math.round(arena.right),
        arenaWidth: Math.round(scene.arenaArtwork.displayWidth),
        collisionLeft: Math.round(scene.collisionMap.bounds.left),
        collisionRight: Math.round(scene.collisionMap.bounds.right),
      };
    });
    assertCenteredCamera(hockeyLayout, `${device.name} Disc Hockey`);
    assert.deepEqual(
      [hockeyLayout.arenaLeft, hockeyLayout.arenaRight, hockeyLayout.arenaWidth],
      [0, 1280, 1280],
      `${device.name}: Disc Hockey artwork must stay in collision-authored coordinates`,
    );
    state = await readState(page);
    assert.equal(state.players.left.visualScale, device.compact ? 1.2 : 1);
    assert.equal(state.touchControl.mode, device.compact ? 'offset-handle' : 'direct');
    assert.equal(state.players.left.radius, 48.4, `${device.name}: visual scaling must not change pusher collision radius`);
    assert.deepEqual(
      [hockeyLayout.collisionLeft, hockeyLayout.collisionRight],
      [104, 1176],
      `${device.name}: Disc Hockey collision bounds must not scale`,
    );
    await capture(page, device.name, '08-disc-hockey');
    if (device.name === 'phone-16x9') {
      const startingPusherX = state.players.left.x;
      const dragHandle = await stagePoint(page, 440, 383);
      await page.mouse.move(dragHandle.x, dragHandle.y);
      await page.mouse.down();
      await settleInputEvent(page);
      await advance(page, 180);
      state = await readState(page);
      assert.ok(state.activePointers.length > 0, '16:9 Disc Hockey drag handle must receive the held pointer');
      assert.ok(state.players.left.x > startingPusherX, '16:9 Disc Hockey drag handle must move the pusher');
      assert.ok(
        Math.abs(state.players.left.target.appliedOffsetX - state.touchControl.nominalOffset) < 0.1,
        '16:9 Disc Hockey must apply the phone thumb offset',
      );
      await capture(page, device.name, '08b-disc-hockey-handle-held');
      await page.mouse.up();
      await advance(page, 40);
    }

    assert.deepEqual(errors, [], `${device.name} emitted browser errors:\n${errors.join('\n')}`);
    await context.close();
  }

  console.log(`Responsive layout matrix passed for ${devices.map(({ name }) => name).join(', ')}.`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
