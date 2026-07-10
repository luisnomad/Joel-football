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

const advance = (page, milliseconds) => page.evaluate((ms) => window.advanceTime(ms), milliseconds);

const hold = async (page, key, milliseconds) => {
  await page.keyboard.down(key);
  await advance(page, milliseconds);
  await page.keyboard.up(key);
};

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

const answerForChallenge = ({ operation, left, right }) => {
  if (operation === 'addition') return left + right;
  if (operation === 'subtraction') return left - right;
  if (operation === 'multiplication') return left * right;
  return left / right;
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

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  let state = await readState(page);
  assert.equal(state.mode, 'intro');
  assert.equal(state.language, 'en');
  assert.equal(state.audio.settings.musicVolume, 0.15);
  assert.equal(state.audio.settings.effectsVolume, 0.2);
  assert.equal(state.audio.trackCount, 6, 'all six supplied music tracks should rotate');
  await capture(page, `${output}/01-intro.png`);

  await touchControl(page, 640, 650, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'settings');
  state = await readState(page);
  assert.equal(state.audio.musicRequested, true, 'the first user gesture should unlock menu music');
  assert.equal(state.audio.audienceRequested, false, 'crowd ambience should stay off in menus');
  await page.evaluate(() => window.__SKYHEAD_AUDIO_DEBUG__.warmAll());
  state = await readState(page);
  assert.equal(state.audio.cache.cachedCount, state.audio.cache.total, 'all audio should be reusable from Cache Storage');
  await capture(page, `${output}/01-settings.png`);

  await touchControl(page, 600, 317, 35);
  state = await readState(page);
  assert.equal(state.audio.settings.musicVolume, 0.6, 'the music slider should use touch-friendly five-percent steps');
  await touchControl(page, 935, 487, 35);
  assert.equal((await readState(page)).audio.settings.effectsMuted, true, 'effects should have an independent mute switch');
  await touchControl(page, 935, 487, 35);
  assert.equal((await readState(page)).audio.settings.effectsMuted, false);
  await touchControl(page, 510, 487, 35);
  assert.equal((await readState(page)).audio.settings.effectsVolume, 0.4);
  await touchControl(page, 685, 180, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).language === 'es');
  state = await readState(page);
  assert.equal(state.mode, 'settings');
  assert.equal(state.audio.settings.musicVolume, 0.6, 'language changes must preserve audio settings');
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
  await capture(page, `${output}/01-power-lab-es.png`);

  await touchControl(page, 765, 127, 30);
  assert.equal((await readState(page)).operation, 'multiplication');
  await touchControl(page, 805, 638, 35);
  state = await readState(page);
  assert.equal(state.challenge?.operation, 'multiplication');
  assert.ok(state.challenge.left >= 3 && state.challenge.left <= 12);
  assert.ok(state.challenge.right >= 3 && state.challenge.right <= 12);
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

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  state = await readState(page);
  assert.equal(state.language, 'es', 'language should persist across refresh');
  assert.equal(state.audio.settings.musicVolume, 0.6, 'music volume should persist across refresh');
  assert.equal(state.audio.settings.effectsVolume, 0.4, 'effects volume should persist across refresh');
  await touchControl(page, 640, 580, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'power-lab');
  state = await readState(page);
  assert.equal(state.powers.fireball, 2, 'earned charges should persist across refresh');
  assert.equal(state.equippedPowerId, 'fireball', 'equipped power should persist across refresh');
  await touchControl(page, 74, 48, 30);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');

  await page.keyboard.press('Enter');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(page, 3200);
  state = await readState(page);
  assert.equal(state.mode, 'playing');
  assert.equal(state.opponentProvider, 'heuristic-v1');
  assert.equal(state.players.left.name, 'JOEL');
  assert.equal(state.players.left.id, 'joel');
  assert.ok(state.hud.leftName.startsWith('JOEL'), `the rendered left HUD label should say Joel; got ${state.hud.leftName}`);
  assert.equal(state.audio.sceneMode, 'match');
  assert.equal(state.audio.musicRequested, true, 'music should continue into the match');
  assert.equal(state.audio.audienceRequested, true, 'audience ambience should be active only during the match');

  const startingX = state.players.left.x;
  const runPoses = new Set();
  await page.keyboard.down('d');
  for (let sample = 0; sample < 8; sample += 1) {
    await advance(page, 90);
    runPoses.add((await readState(page)).players.left.pose);
  }
  await page.keyboard.up('d');
  state = await readState(page);
  const runDistance = state.players.left.x - startingX;
  assert.ok(runDistance > 95, `20%-faster movement should cover the pitch decisively; got ${runDistance}`);
  assert.ok(runPoses.has('run-stride') && runPoses.has('run-contact'), 'running should alternate two leg poses');
  await capture(page, `${output}/02-run-cycle.png`);

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
  await hold(page, 'x', 50);
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
  await hold(page, 'x', 50);
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
  assert.ok(state.audio.ballEffectPlays > ballEffectBefore, 'a kick should trigger the supplied ball sound');

  await advance(page, 600);
  state = await readState(page);
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 678, y: 537 });
  });
  await hold(page, 'z', 60);
  state = await readState(page);
  assert.equal(state.players.left.pose, 'lob');
  assert.ok(state.ball.vy < -9 && state.ball.vx > 6, 'lob should launch upward with a slower forward component');
  const lobLaunchY = state.ball.y;
  await capture(page, `${output}/02-lob-shot.png`);
  await advance(page, 380);
  assert.ok((await readState(page)).ball.y < lobLaunchY - 30, 'lob should rise into a playable arc above a defender');

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
    window.__SKYHEAD_DEBUG__.setHumanMeter(70);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  await page.keyboard.press('v');
  await advance(page, 40);
  state = await readState(page);
  assert.ok(state.players.left.meter >= 70, 'an early power press should not consume partial meter');
  assert.equal(state.hud.announcement, 'EL PODER NECESITA 100%', 'an early press should explain why power did not activate');

  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(100);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 350, y: 400 });
  });
  await page.keyboard.press('v');
  await advance(page, 70);
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
    window.__SKYHEAD_DEBUG__.setBall({ x: 676, y: 529 });
  });
  await page.keyboard.press('v');
  await advance(page, 70);
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
    window.__SKYHEAD_DEBUG__.stunOpponent(0.4);
    window.__SKYHEAD_DEBUG__.setBall({ x: 676, y: 529 });
  });
  await page.keyboard.press('v');
  await advance(page, 320);
  state = await readState(page);
  assert.equal(
    state.powerBall.superpowerId,
    'ice',
    `Freeze should launch from a real desktop power tap; got ${JSON.stringify({ powerBall: state.powerBall, left: state.players.left, ball: state.ball, inventory: state.inventory, hud: state.hud })}`,
  );
  assert.equal(state.players.right.frozen, true, 'Freeze should visibly immobilize the opponent');
  assert.ok(state.players.right.freezeSeconds > 1, 'Freeze should last long enough to be unmistakable');
  assert.equal(state.inventory.equippedCount, 0, 'Freeze should consume one charge only after the ball is struck');
  assert.equal(state.hud.announcement, '¡VEX-9 CONGELADO!');
  await capture(page, `${output}/02-freeze-power.png`);
  await advance(page, 2200);
  assert.equal((await readState(page)).players.right.frozen, false, 'the opponent should recover after Freeze expires');

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

  const beforeGoalState = await readState(page);
  const scoreBefore = beforeGoalState.score.left;
  const goalCheerBefore = beforeGoalState.audio.goalCheerPlays;
  await page.evaluate(() => window.__SKYHEAD_DEBUG__.setBall({ x: 1185, y: 520, vx: 1 }));
  await advance(page, 40);
  state = await readState(page);
  assert.equal(state.mode, 'goal');
  assert.equal(state.score.left, scoreBefore + 1, 'fully crossing the right goal line should score for Joel');
  assert.equal(state.audio.goalCheerPlays, goalCheerBefore + 1, 'a goal should trigger the supplied audience cheer');
  await advance(page, 1800);
  state = await readState(page);
  assert.equal(state.mode, 'countdown');
  await page.waitForTimeout(220);
  await capture(page, `${output}/04-post-goal-reset.png`);
  assert.equal(state.players.left.visualFrame, 0, 'the scorer should show its initial idle frame during the countdown');
  assert.equal(state.players.right.visualFrame, 0, 'the defender should show its initial idle frame during the countdown');

  await page.evaluate(() => window.__SKYHEAD_DEBUG__.forceResult('left'));
  state = await readState(page);
  assert.equal(state.mode, 'result');
  assert.equal(state.score.winner, 'left');
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
  await mobilePage.goto(url, { waitUntil: 'networkidle' });
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.inputMode, 'touch');
  assert.equal(mobileState.controls.pause[0], 'on-screen pause');
  await capture(mobilePage, `${output}/05-touch-intro.png`);

  await touchControl(mobilePage, 640, 650, 45);
  await mobilePage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'settings');
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.audio.settings.musicVolume, 0.15);
  assert.equal(mobileState.audio.settings.effectsVolume, 0.2);
  await touchControl(mobilePage, 935, 487, 40);
  assert.equal((await readState(mobilePage)).audio.settings.effectsMuted, true, 'tablet settings should mute effects by touch');
  await touchControl(mobilePage, 935, 487, 40);
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

  const touchStartX = mobileState.players.left.x;
  await touchControl(mobilePage, 238, 630, 320);
  mobileState = await readState(mobilePage);
  assert.ok(mobileState.players.left.x > touchStartX + 10, 'touch right should move the human');
  const touchRightX = mobileState.players.left.x;
  await touchControl(mobilePage, 98, 630, 260);
  assert.ok((await readState(mobilePage)).players.left.x < touchRightX, 'touch left should reverse movement');

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

  mobileState = await readState(mobilePage);
  await mobilePage.evaluate(({ x, y }) => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(x);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: x + 78, y: 537 });
  }, mobileState.players.left);
  await touchControl(mobilePage, 1010, 505, 60);
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
    window.__SKYHEAD_DEBUG__.stunOpponent(0.4);
    window.__SKYHEAD_DEBUG__.setBall({ x: x + 76, y: 529 });
  }, mobileState.players.left);
  await touchControl(mobilePage, 1210, 485, 70);
  await advance(mobilePage, 320);
  mobileState = await readState(mobilePage);
  assert.equal(mobileState.powerBall.owner, 'left', 'touch power should empower the human shot');
  assert.equal(mobileState.powerBall.superpowerId, 'ice', 'tablet power should launch the equipped Freeze charge');
  assert.equal(mobileState.players.right.frozen, true, 'tablet Freeze should visibly immobilize the opponent');
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
  await penaltyPage.goto(url, { waitUntil: 'networkidle' });
  await penaltyPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await touchControl(penaltyPage, 1190, 34, 30);
  await penaltyPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).language === 'es');
  await capture(penaltyPage, `${output}/07-intro-es-tablet.png`);
  await touchControl(penaltyPage, 640, 580, 35);
  await penaltyPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'power-lab');
  await capture(penaltyPage, `${output}/07-power-lab-tablet.png`);
  await touchControl(penaltyPage, 805, 638, 35);
  let penaltyState = await readState(penaltyPage);
  assert.equal(penaltyState.challenge.operation, 'addition');
  assert.ok(penaltyState.challenge.left >= 10 && penaltyState.challenge.right >= 10);
  await answerChallenge(penaltyPage, penaltyState.challenge, false);
  penaltyState = await readState(penaltyPage);
  assert.equal(penaltyState.challenge?.status, 'locked', 'a wrong answer should immediately close further answer attempts');
  assert.ok(penaltyState.mathLockRemainingMs > 295_000, 'a wrong answer should start a five-minute penalty');
  assert.equal(penaltyState.powers.fireball, 0, 'a wrong answer must not award a charge');
  await capture(penaltyPage, `${output}/07-math-penalty-tablet.png`);

  await penaltyPage.reload({ waitUntil: 'networkidle' });
  await penaltyPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await touchControl(penaltyPage, 640, 580, 35);
  await penaltyPage.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'power-lab');
  penaltyState = await readState(penaltyPage);
  assert.ok(penaltyState.mathLockRemainingMs > 290_000, 'refresh must not bypass the persisted math penalty');
  await touchControl(penaltyPage, 805, 638, 35);
  assert.equal((await readState(penaltyPage)).challenge, null, 'the solve action should remain disabled during cooldown');
  assert.deepEqual(penaltyErrors, [], `penalty browser emitted errors:\n${penaltyErrors.join('\n')}`);
  await penaltyContext.close();

  await writeFile(`${output}/summary.json`, JSON.stringify({ passed: true, scenarios: 60 }, null, 2));
  process.stdout.write('Browser game checks passed: bilingual settings/audio caching, randomized math Lab, persistent earning/equipping/cooldown, enhanced power use, full gameplay, and touch system flow.\n');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
