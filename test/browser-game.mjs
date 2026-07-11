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
    joel: await analyze('player-nova-sheet-v2.webp'),
    vex: await analyze('player-vex-sheet-v2.webp'),
  };
});

const advance = (page, milliseconds) => page.evaluate((ms) => window.advanceTime(ms), milliseconds);

const hold = async (page, key, milliseconds) => {
  await page.keyboard.up(key);
  await page.keyboard.down(key);
  await advance(page, milliseconds);
  await page.keyboard.up(key);
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
    power: true,
    sprint: false,
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
    return {
      x: rect.left + (x / 1280) * rect.width,
      y: rect.top + (y / 720) * rect.height,
    };
  }, { x: logicalX, y: logicalY });

const touchControl = async (page, logicalX, logicalY, milliseconds = 60) => {
  const point = await canvasPoint(page, logicalX, logicalY);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await advance(page, milliseconds);
  await page.mouse.up();
};

const waitThroughSplash = async (page, screenshotPath) => {
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'splash');
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
  assert.equal(state.language, 'en');
  assert.equal(state.audio.settings.musicVolume, 0.15);
  assert.equal(state.audio.settings.effectsVolume, 0.2);
  assert.equal(state.audio.trackCount, 6, 'all six supplied music tracks should rotate');
  assert.deepEqual(state.controls.sprint, ['double-tap and hold the same direction']);
  assert.deepEqual(state.controls.kickBoost, ['repeat kick or lob during the kick animation']);
  assert.deepEqual(state.controls.chilena, ['press any kick twice under a reachable overhead ball']);
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
  await capture(page, `${output}/01-intro.png`);

  await touchControl(page, 640, 650, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'settings');
  state = await readState(page);
  assert.equal(state.audio.musicRequested, true, 'the first user gesture should unlock menu music');
  assert.equal(state.audio.audienceRequested, false, 'crowd ambience should stay off in menus');
  await page.evaluate(() => window.__SKYHEAD_AUDIO_DEBUG__.warmAll());
  state = await readState(page);
  assert.equal(state.audio.cache.cachedCount, state.audio.cache.total, 'all audio should be reusable from Cache Storage');
  assert.equal(state.difficulty, 'normal', 'Normal should be the default AI difficulty');
  await capture(page, `${output}/01-settings.png`);

  await touchControl(page, 535, 238, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).difficulty === 'easy');
  assert.equal((await readState(page)).difficulty, 'easy');
  await touchControl(page, 92, 52, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await touchControl(page, 640, 505, 35);
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
  assert.equal(state.lastAiAdvancedIntent.sprint, false, 'Easy AI must not sprint');
  assert.equal(state.lastAiAdvancedIntent.kickBoost, 0, 'Easy AI must not boost kicks');
  assert.equal(state.players.right.sprinting, false);
  await page.keyboard.press('Escape');
  await touchControl(page, 775, 475, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await touchControl(page, 640, 650, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'settings');
  assert.equal((await readState(page)).difficulty, 'easy', 'difficulty should persist after leaving a match');
  await touchControl(page, 640, 238, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).difficulty === 'normal');

  await touchControl(page, 600, 382, 35);
  state = await readState(page);
  assert.equal(state.audio.settings.musicVolume, 0.6, 'the music slider should use touch-friendly five-percent steps');
  await touchControl(page, 935, 512, 35);
  assert.equal((await readState(page)).audio.settings.effectsMuted, true, 'effects should have an independent mute switch');
  await touchControl(page, 935, 512, 35);
  assert.equal((await readState(page)).audio.settings.effectsMuted, false);
  await touchControl(page, 510, 512, 35);
  assert.equal((await readState(page)).audio.settings.effectsVolume, 0.4);
  await touchControl(page, 685, 154, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).language === 'es');
  state = await readState(page);
  assert.equal(state.mode, 'settings');
  assert.equal(state.audio.settings.musicVolume, 0.6, 'language changes must preserve audio settings');
  assert.equal(state.difficulty, 'normal', 'language changes must preserve difficulty');
  await capture(page, `${output}/01-settings-es.png`);
  await touchControl(page, 640, 640, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');

  await touchControl(page, 1190, 34, 30);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).language === 'es');
  state = await readState(page);
  assert.equal(state.language, 'es', 'the main-screen language switch should select Spanish');
  await capture(page, `${output}/01-intro-es.png`);

  await touchControl(page, 640, 580, 35);
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
  assert.equal(state.difficulty, 'normal', 'difficulty should persist across refresh');
  await touchControl(page, 640, 580, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'power-lab');
  state = await readState(page);
  assert.equal(state.powers.fireball, 2, 'earned charges should persist across refresh');
  assert.equal(state.equippedPowerId, 'fireball', 'equipped power should persist across refresh');
  await touchControl(page, 74, 48, 30);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');

  state = await readState(page);
  const countdownWhistlesBefore = state.audio.whistleRequestedPlays;
  const countdownWhistlePlaysBefore = state.audio.whistlePlays;
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  state = await readState(page);
  assert.equal(state.players.left.visualFrame, 0);
  assert.equal(state.players.right.visualFrame, 0);
  assert.ok(Math.abs(state.players.left.visualGroundAnchorY - 636) < 0.2);
  assert.ok(Math.abs(state.players.right.visualGroundAnchorY - 636) < 0.2);
  assert.equal(state.players.left.visualGroundAnchorY, state.players.right.visualGroundAnchorY);
  await advance(page, 3200);
  state = await readState(page);
  assert.equal(state.mode, 'playing');
  assert.equal(state.opponentProvider, 'heuristic-v1');
  assert.equal(state.players.left.name, 'JOEL');
  assert.equal(state.players.left.id, 'joel');
  assert.ok(Math.abs(state.players.left.visualGroundAnchorY - 636) < 0.2);
  assert.ok(Math.abs(state.players.right.visualGroundAnchorY - 636) < 0.2);
  assert.equal(state.players.left.visualGroundAnchorY, state.players.right.visualGroundAnchorY);
  await capture(page, `${output}/02-ground-baseline.png`);
  assert.ok(state.hud.leftName.startsWith('JOEL'), `the rendered left HUD label should say Joel; got ${state.hud.leftName}`);
  assert.equal(state.audio.sceneMode, 'match');
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
  assert.equal(state.controls.chilena, 'press any kick twice under a reachable overhead ball');

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(300);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 720, y: 520 });
  });
  await advance(page, 160);
  state = await readState(page);
  assert.equal(state.lastAiAdvancedIntent.sprint, true, 'Normal AI should request sprint while chasing a distant ball');
  assert.equal(state.players.right.sprinting, true, 'the shared Fighter mechanic should execute the AI sprint intent');
  await capture(page, `${output}/02-ai-sprint.png`);

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
  await advance(page, 650);
  state = await readState(page);
  assert.equal(state.players.left.sprinting, true, 'holding the second same-direction tap should start sprinting');
  assert.equal(state.players.left.sprintSpeedMultiplier, 1.5);
  assert.ok(state.players.left.x > 530, `sprint should cover more ground than the baseline run; got x=${state.players.left.x}`);
  await capture(page, `${output}/02-human-sprint.png`);
  await page.keyboard.down('Space');
  await advance(page, 65);
  await page.keyboard.up('Space');
  state = await readState(page);
  assert.equal(state.players.left.sprinting, true, 'jumping while sprinting should preserve sprint momentum');
  assert.ok(state.players.left.y < 545 && state.players.left.vy < 0);
  await page.keyboard.up('d');
  await advance(page, 20);
  assert.equal((await readState(page)).players.left.sprinting, false, 'releasing the direction should stop sprinting');

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
  assert.equal((await readState(page)).players.left.sprinting, false, 'a double-tap started in mid-air must not create a sprint');
  await page.keyboard.up('d');

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(590);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  await hold(page, 'd', 700);
  state = await readState(page);
  assert.ok(state.players.left.x > 675, 'the faster human should be able to run decisively beyond the center line');
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
    window.__SKYHEAD_DEBUG__.setBall({ x: 640, y: 300 });
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
    window.__SKYHEAD_DEBUG__.setBall({ x: 678, y: 537 });
  });
  const connectedBallEffectBefore = (await readState(page)).audio.ballEffectPlays;
  await hold(page, 'x', 17);
  state = await readState(page);
  assert.ok(state.ball.vx > 15, 'the initial basic kick should connect immediately');
  assert.equal(state.audio.ballEffectPlays, connectedBallEffectBefore + 1, 'ball contact should play one kick sound');
  for (const key of ['k', 'x', 'k']) {
    await hold(page, key, 17);
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
  assert.equal(state.players.left.chilenaActive, false, 'Joel should land even if the shot reaches the goal during his rotation');
  assert.equal(state.players.left.chilenaRotation, 0);
  assert.equal(state.players.left.facing, 1, 'Joel should face the rival goal again after landing');
  assert.equal(state.players.left.grounded, true);
  assert.ok(Math.abs(state.players.left.y - 547) < 8, `the visual-only rotation must return Joel to his normal ground height; got y=${state.players.left.y}`);
  assert.equal(state.players.left.visualFrame, 0, 'chilena landing should restore the registered idle frame');
  assert.ok(Math.abs(state.players.left.visualGroundAnchorY - 636) < 0.2, 'chilena landing should return Joel to the shared foot baseline');
  await capture(page, `${output}/02-chilena-landing.png`);

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });

  await advance(page, 820);
  await hold(page, 'c', 60);
  state = await readState(page);
  assert.ok(state.players.left.dashCooldown > 0, 'dash should start its cooldown');
  await capture(page, `${output}/02-dash-pose.png`);

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

  await page.keyboard.press('p');
  state = await readState(page);
  assert.equal(state.mode, 'paused');
  const pausedAt = state.timer.secondsLeft;
  await advance(page, 500);
  assert.equal((await readState(page)).timer.secondsLeft, pausedAt, 'pause should freeze the match clock');
  await capture(page, `${output}/03-paused.png`);
  await page.keyboard.press('p');
  assert.notEqual((await readState(page)).mode, 'paused');

  await page.keyboard.press('Escape');
  state = await readState(page);
  assert.equal(state.mode, 'paused', 'Escape should open the desktop pause menu');
  assert.deepEqual(state.pauseActions, ['resume', 'restart', 'abandon match']);
  await capture(page, `${output}/03-desktop-abandon-menu.png`);
  await touchControl(page, 775, 475, 40);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  assert.equal((await readState(page)).audio.sceneMode, 'menu', 'abandoning should return to the main menu');
  await page.keyboard.press('Enter');
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

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(500);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(900);
    window.__SKYHEAD_DEBUG__.setBall({ x: 68, y: 401 });
  });
  await advance(page, 250);
  state = await readState(page);
  assert.ok(
    state.ball.x < 148 && state.ball.y < 425,
    `fixture should reproduce a ball perched above the left goal; x=${state.ball.x}, y=${state.ball.y}`,
  );
  await capture(page, `${output}/03-goal-perch-regression.png`);
  await advance(page, 600);
  state = await readState(page);
  assert.ok(state.ball.x > 148, `a perched ball should roll back into play; x=${state.ball.x}, y=${state.ball.y}`);
  await capture(page, `${output}/03-goal-perch-released.png`);

  await page.evaluate(() => window.__SKYHEAD_DEBUG__.setBall({ x: 1212, y: 401 }));
  await advance(page, 250);
  state = await readState(page);
  assert.ok(state.ball.x > 1132 && state.ball.y < 425, 'fixture should reproduce a ball perched above the right goal');
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
  const scoreBefore = beforeGoalState.score.left;
  const goalCheerBefore = beforeGoalState.audio.goalCheerPlays;
  const goalWhistlesBefore = beforeGoalState.audio.whistleRequestedPlays;
  const goalWhistlePlaysBefore = beforeGoalState.audio.whistlePlays;
  await page.evaluate(() => window.__SKYHEAD_DEBUG__.setBall({ x: 1140, y: 520, vx: 46 }));
  await advance(page, 80);
  state = await readState(page);
  assert.equal(state.mode, 'goal');
  assert.equal(state.score.left, scoreBefore + 1, 'fully crossing the right goal line should score for Joel');
  assert.equal(state.audio.goalCheerPlays, goalCheerBefore, 'the former audience goal effect should no longer play');
  assert.equal(state.audio.whistleRequestedPlays, goalWhistlesBefore + 1, 'a goal should request one whistle');
  assert.equal(state.audio.whistlePlays, goalWhistlePlaysBefore + 1, 'the goal whistle should begin playback immediately');
  assert.deepEqual(state.audio.recentWhistles.at(-1), { label: 'goal', cutoffMs: null }, 'the goal should retain a full-length whistle');
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
  assert.equal(mobileState.controls.pause[0], 'on-screen pause');
  assert.deepEqual(mobileState.controls.sprint, ['double-tap and hold the same direction']);
  assert.deepEqual(mobileState.controls.kickBoost, ['repeat K or L during the kick animation']);
  assert.deepEqual(mobileState.controls.chilena, ['tap K or L twice under a reachable overhead ball']);
  await capture(mobilePage, `${output}/05-touch-intro.png`);

  await touchControl(mobilePage, 640, 650, 45);
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'settings');
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.audio.settings.musicVolume, 0.15);
  assert.equal(mobileState.audio.settings.effectsVolume, 0.2);
  assert.equal(mobileState.difficulty, 'normal');
  await touchControl(mobilePage, 935, 512, 40);
  assert.equal((await readState(mobilePage)).audio.settings.effectsMuted, true, 'tablet settings should mute effects by touch');
  await touchControl(mobilePage, 935, 512, 40);
  assert.equal((await readState(mobilePage)).audio.settings.effectsMuted, false);
  await capture(mobilePage, `${output}/05-touch-settings.png`);
  await touchControl(mobilePage, 92, 52, 40);
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');

  await touchControl(mobilePage, 640, 530, 50);
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(mobilePage, 3100);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.touchControls, true);
  assert.equal(mobileState.audio.audienceRequested, true, 'tablet matches should request the audience ambience');
  assert.equal(mobileState.controls.chilena, 'tap K or L twice under a reachable overhead ball');

  const touchStartX = mobileState.players.left.x;
  await touchControl(mobilePage, 238, 630, 320);
  mobileState = await readState(mobilePage);
  assert.ok(mobileState.players.left.x > touchStartX + 10, 'touch right should move the human');
  const touchRightX = mobileState.players.left.x;
  await touchControl(mobilePage, 98, 630, 260);
  assert.ok((await readState(mobilePage)).players.left.x < touchRightX, 'touch left should reverse movement');

  await mobilePage.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(400);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  await touchControl(mobilePage, 238, 630, 35);
  await advance(mobilePage, 70);
  const touchSprintPoint = await canvasPoint(mobilePage, 238, 630);
  await mobilePage.mouse.move(touchSprintPoint.x, touchSprintPoint.y);
  await mobilePage.mouse.down();
  await advance(mobilePage, 220);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.players.left.sprinting, true, 'touch double-tap-and-hold should use the same sprint mechanic');
  assert.equal(mobileState.players.left.sprintSpeedMultiplier, 1.5);
  await capture(mobilePage, `${output}/05-touch-sprint.png`);
  await mobilePage.mouse.up();
  await advance(mobilePage, 20);
  assert.equal((await readState(mobilePage)).players.left.sprinting, false);

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
  await advance(mobilePage, 1150);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.players.left.chilenaActive, false);
  assert.equal(mobileState.players.left.facing, 1);
  assert.equal(mobileState.players.left.grounded, true);
  assert.ok(Math.abs(mobileState.players.left.y - 547) < 8, `tablet chilena landing should preserve Joel's ground height; got y=${mobileState.players.left.y}`);
  assert.equal(mobileState.players.left.visualFrame, 0);
  assert.ok(Math.abs(mobileState.players.left.visualGroundAnchorY - 636) < 0.2);

  await mobilePage.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(24);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 678, y: 537 });
  });
  for (let tap = 0; tap < 4; tap += 1) {
    await touchControl(mobilePage, 1165, 610, 30);
  }
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.lastBoostedStrike?.side, 'left', 'touch mash should produce a boosted basic kick');
  assert.ok(
    mobileState.lastBoostedStrike?.energySpent >= 16 && mobileState.lastBoostedStrike?.energySpent <= 24,
    `touch mash should apply at least two boost steps; got ${mobileState.lastBoostedStrike?.energySpent}`,
  );
  assert.ok(
    mobileState.ball.vx > 18.5 && mobileState.ball.vx < 23,
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
  await touchControl(mobilePage, 1010, 505, 80);
  assert.ok((await readState(mobilePage)).ball.vy < -9, 'touch lob should launch the ball upward');
  await advance(mobilePage, 520);

  await mobilePage.evaluate(() => window.__SKYHEAD_DEBUG__.resumePlay());
  await touchControl(mobilePage, 1110, 505, 60);
  assert.ok((await readState(mobilePage)).players.left.dashCooldown > 0, 'touch dash should activate');
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
  await touchControl(mobilePage, 1210, 485, 70);
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
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  assert.equal((await readState(mobilePage)).inputMode, 'touch', 'tablet abandon should return to the touch-specific intro');
  assert.deepEqual(mobileErrors, [], `mobile browser emitted errors:\n${mobileErrors.join('\n')}`);
  await mobile.close();

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
  await touchControl(penaltyPage, 1190, 34, 30);
  await penaltyPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).language === 'es');
  await capture(penaltyPage, `${output}/07-intro-es-tablet.png`);
  await touchControl(penaltyPage, 640, 580, 35);
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
  await touchControl(penaltyPage, 640, 580, 35);
  await penaltyPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'power-lab');
  penaltyState = await readState(penaltyPage);
  assert.ok(penaltyState.mathLockRemainingMs > 290_000, 'refresh must not bypass the persisted math penalty');
  await touchControl(penaltyPage, 805, 638, 35);
  assert.equal((await readState(penaltyPage)).challenge, null, 'the solve action should remain disabled during cooldown');
  assert.deepEqual(penaltyErrors, [], `penalty browser emitted errors:\n${penaltyErrors.join('\n')}`);
  await penaltyContext.close();

  await writeFile(`${output}/summary.json`, JSON.stringify({ passed: true, checks: 225 }, null, 2));
  process.stdout.write('Browser game checks passed: splash, random math, persistence, bilingual settings, whistle signals, difficulty gating, sprint/boost, Big Guy, full gameplay, and touch flow.\n');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
