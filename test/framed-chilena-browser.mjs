/*
 * Browser checks for the sprite-redo roster-v2 atlas (Bob pilot): the framed
 * chilena meets the ball with the boot of its contact drawing before the shot
 * is applied, unreachable low balls stay ordinary kicks, the authored loops
 * play, and the scorer celebrates. The framed chilena is then repeated for
 * adults with much higher contact boots (Dad, Juanjo and Mum, whose boot is
 * the highest in the roster). Every chilena keeps the body within the
 * character's live ordinary jump, and a ball near the top of the screen stays
 * an ordinary kick (owner decision 2026-10-12).
 * Run: node test/framed-chilena-browser.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const output = new URL('../output/e2e-roster-v2/', import.meta.url).pathname;
// E2E_PORT lets parallel runs use separate dev servers.
const port = Number(process.env.E2E_PORT) || 4176;
const url = `http://127.0.0.1:${port}`;

// Measured chilena contact boots (source px in the 336x480 cell, from each
// atlas's player-<id>-sheet.json) and the shared contact tolerance
// (src/game/pure/chilena.js CHILENA_FORGIVE_RADIUS).
const CONTACT_BOOTS = {
  bob: { x: 210, y: 141 },
  dad: { x: 221, y: 103 },
  juanjo: { x: 202, y: 87 },
  mum: { x: 220, y: 70 },
};
const FORGIVE_RADIUS = 32;
// src/game/pure/chilena.js CHILENA_APEX_TOLERANCE: px the chilena body may
// exceed the character's ordinary jump apex.
const APEX_TOLERANCE = 2;
// A moving overhead ball inside every character's zone (head level of an
// adult is y=414, Bob's boot reaches up to y=359 on a normal jump), high
// enough that even Mum's and Juanjo's high boots need a real jump to meet it.
// The old moving case (560, 350) rising at 3 px/tick sat above Bob's reach.
const MOVING_BALL = { x: 575, y: 372, vx: 2, vy: 1 };
const ROSTER_V2 = {
  takeoff: 17,
  contact: 18,
  follow: 19,
  celebrate: [20, 21, 22, 23],
  idle: [0, 1, 2],
  sprint: [3, 6],
  hit: { impact: 14, stagger: 15, recover: 16 },
};

const readState = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const advance = (page, milliseconds) => page.evaluate((ms) => window.advanceTime(ms), milliseconds);
const settleInputEvent = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(resolve)));
const hold = async (page, key, milliseconds) => {
  await page.keyboard.up(key);
  await page.keyboard.down(key);
  await settleInputEvent(page);
  await advance(page, milliseconds);
  await page.keyboard.up(key);
};
const capture = async (page, path) => {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path });
};
const canvasPoint = (page, logicalX, logicalY) => page.evaluate(({ x, y }) => {
  const canvas = document.querySelector('canvas');
  const bounds = canvas.getBoundingClientRect();
  return { x: bounds.left + (x / 1280) * bounds.width, y: bounds.top + (y / 720) * bounds.height };
}, { x: logicalX, y: logicalY });
const touchControl = async (page, logicalX, logicalY, milliseconds = 60) => {
  const point = await canvasPoint(page, logicalX, logicalY);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await settleInputEvent(page);
  await advance(page, milliseconds);
  await page.mouse.up();
};
const waitForServer = async () => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The server is still warming up.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite did not become ready at ${url}`);
};

/** World position of the drawn contact boot and the ball, read from the live sprites. */
const readContactGeometry = (page, boot) => page.evaluate((boot) => {
  const scene = window.__SKYHEAD_GAME__.scene.getScene('Match');
  const fighter = scene.leftPlayer;
  const visual = fighter.visual;
  const radians = (visual.angle * Math.PI) / 180;
  const localX = (boot.x - visual.displayOriginX) * visual.scaleX * (visual.flipX ? -1 : 1);
  const localY = (boot.y - visual.displayOriginY) * visual.scaleY;
  const drawnBoot = {
    x: visual.x + localX * Math.cos(radians) - localY * Math.sin(radians),
    y: visual.y + localX * Math.sin(radians) + localY * Math.cos(radians),
  };
  const ball = { x: scene.ball.body.x, y: scene.ball.body.y, radius: scene.ball.radius };
  // The gameplay model's boot for the same body position and facing.
  const modelBoot = fighter.chilenaBootPosition();
  return {
    frame: Number(visual.frame.name),
    drawnBoot,
    modelBoot,
    drawnToModel: Math.hypot(drawnBoot.x - modelBoot.x, drawnBoot.y - modelBoot.y),
    ball,
    catalogBoot: fighter.chilenaContactPoint,
  };
}, boot);

/** Second kick press on an overhead ball, then step until the boot meets it. */
const runChilena = async (page, { ball, label, boot = CONTACT_BOOTS.bob, normalJumpRise, screenshot }) => {
  await page.evaluate((setup) => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(12);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall(setup);
  }, ball);
  const before = await readState(page);
  await startApexProbe(page);
  await hold(page, 'x', 17);
  await hold(page, 'k', 17);
  let state = await readState(page);
  assert.equal(state.players.left.chilenaSuccesses, before.players.left.chilenaSuccesses + 1, `${label}: the second press should start a chilena`);
  assert.equal(state.players.left.chilenaFramed, true);
  assert.equal(state.players.left.atlasLayout, 'roster-v2');
  if (state.players.left.chilenaPending) {
    // The shot waits for the boot: nothing has been struck on the press.
    assert.notEqual(state.powerBall.superpowerId, 'chilena', `${label}: the ball must not be struck on the button press`);
    assert.equal(state.players.left.visualFrame, ROSTER_V2.takeoff, `${label}: takeoff drawing before contact`);
    assert.ok(state.players.left.vy < 0, `${label}: the chilena should lift the player off the ground`);
  }
  let geometry = null;
  for (let step = 0; step < 40 && !state.players.left.lastChilenaContact; step += 1) {
    await advance(page, 1000 / 60);
    state = await readState(page);
  }
  const contact = state.players.left.lastChilenaContact;
  assert.ok(contact, `${label}: the boot never reached the ball`);
  assert.equal(contact.outcome, 'contact', `${label}: ${JSON.stringify(contact)}`);
  assert.ok(contact.surfaceDistance <= FORGIVE_RADIUS, `${label}: contact gap ${contact.surfaceDistance}`);
  // Same tick as the contact, exactly as the game left it (no extra pose
  // update): the drawing on screen is the contact drawing and its boot is on
  // the ball; the strike has been applied now (playtest 2026-10-12: the
  // takeoff drawing used to linger for this tick).
  geometry = await readContactGeometry(page, boot);
  assert.deepEqual(geometry.catalogBoot, boot, `${label}: catalog chilenaContact must match the measured boot`);
  assert.equal(geometry.frame, ROSTER_V2.contact, `${label}: contact drawing at contact`);
  assert.equal(state.powerBall.superpowerId, 'chilena', `${label}: the shot is applied at contact`);
  assert.equal(state.lastChilenaStrike?.side, 'left');
  assert.match(state.hud.announcement, /^¡?CHILENA!$/, `${label}: announced at contact (EN or ES)`);
  // resolveChilenaShot aims at the rival goal mouth at 27 px/tick: rightward
  // and down; higher contacts are steeper, so vx alone varies with height.
  assert.ok(
    state.ball.vx > 12 && state.ball.vy > 0 && Math.hypot(state.ball.vx, state.ball.vy) > 20,
    `${label}: the chilena must drive down toward the rival goal; v=(${state.ball.vx}, ${state.ball.vy})`,
  );
  // The screenshot is the contact moment.
  if (screenshot) await capture(page, screenshot);
  // Owner decision 2026-10-12: the chilena never lifts the body above the
  // character's ordinary jump. Follow the body past contact to its apex.
  for (let step = 0; step < 60 && state.players.left.vy < 0.5; step += 1) {
    await advance(page, 1000 / 60);
    state = await readState(page);
  }
  const apexRise = before.players.left.y - (await readApexProbe(page));
  assert.ok(
    apexRise <= normalJumpRise + APEX_TOLERANCE,
    `${label}: the chilena rose ${apexRise.toFixed(1)} px, above the normal jump's ${normalJumpRise.toFixed(1)} px`,
  );
  return { contact, geometry, apexRise };
};

/**
 * Highest point (smallest y) of the left player's body over every simulation
 * tick from now on. Sampling the snapshot between test steps can miss the apex
 * (the real-time loop also advances the game), so the tick itself records it.
 */
const startApexProbe = (page) => page.evaluate(() => {
  const scene = window.__SKYHEAD_GAME__.scene.getScene('Match');
  if (!scene.__apexProbeOriginalStep) {
    scene.__apexProbeOriginalStep = scene.stepGame;
    scene.stepGame = function stepGameWithApexProbe(...args) {
      const result = scene.__apexProbeOriginalStep.apply(this, args);
      scene.__apexProbeMinY = Math.min(scene.__apexProbeMinY, scene.leftPlayer.sprite.y);
      return result;
    };
  }
  scene.__apexProbeMinY = scene.leftPlayer.sprite.y;
});
const readApexProbe = (page) => page.evaluate(() => (
  window.__SKYHEAD_GAME__.scene.getScene('Match').__apexProbeMinY
));

/** Live rise (px) of an ordinary jump from the ground, ball out of the way. */
const measureNormalJump = async (page) => {
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 300, y: 200, vx: 0, vy: 0 });
  });
  await advance(page, 200);
  let state = await readState(page);
  assert.equal(state.players.left.grounded, true, 'the jump measurement starts on the ground');
  const groundY = state.players.left.y;
  // Deterministic: the real-time loop sleeps and each advance() is exactly one
  // game tick plus one physics step; the human input reports Jump for one tick.
  await page.evaluate(() => {
    const game = window.__SKYHEAD_GAME__;
    const scene = game.scene.getScene('Match');
    game.loop.sleep();
    scene.__jumpProbeDecide = scene.humanProvider.decide;
    let pending = true;
    scene.humanProvider.decide = (snapshot) => {
      const intent = scene.__jumpProbeDecide(snapshot);
      if (!pending) return intent;
      pending = false;
      return { ...intent, jump: true };
    };
  });
  await startApexProbe(page);
  for (let tick = 0; tick < 50; tick += 1) await advance(page, 1000 / 60);
  await page.evaluate(() => {
    const game = window.__SKYHEAD_GAME__;
    const scene = game.scene.getScene('Match');
    scene.humanProvider.decide = scene.__jumpProbeDecide;
    game.loop.wake();
  });
  state = await readState(page);
  assert.equal(state.players.left.grounded, true, 'the measured jump lands');
  const rise = groundY - (await readApexProbe(page));
  assert.ok(rise > 60, `the jump probe should have jumped; rose ${rise} px`);
  await advance(page, 300);
  return { rise, modelRise: state.players.left.normalJumpRise };
};

/**
 * A ball hanging near the top of the screen above the player: the double
 * press stays an ordinary kick, and the player does not leave the ground for
 * a chilena (owner decision 2026-10-12).
 */
const refuseHighBall = async (page, label) => {
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(12);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    window.__SKYHEAD_DEBUG__.setBall({ x: 600, y: 170, vx: 0, vy: 0 });
  });
  const before = await readState(page);
  await hold(page, 'x', 17);
  await hold(page, 'k', 17);
  let state = await readState(page);
  assert.equal(state.players.left.chilenaSuccesses, before.players.left.chilenaSuccesses, `${label}: a ball near the top of the screen must not start a chilena`);
  assert.equal(state.players.left.chilenaActive, false, `${label}: no chilena in flight`);
  assert.equal(state.players.left.lastChilenaAttempt?.reason, 'ball-too-high-or-far', `${label}: ${JSON.stringify(state.players.left.lastChilenaAttempt)}`);
  let lowestY = state.players.left.y;
  for (let step = 0; step < 20; step += 1) {
    await advance(page, 1000 / 60);
    state = await readState(page);
    lowestY = Math.min(lowestY, state.players.left.y);
  }
  assert.ok(before.players.left.y - lowestY < 2, `${label}: the player must stay on the ground; rose ${before.players.left.y - lowestY} px`);
  assert.notEqual(state.powerBall.superpowerId, 'chilena', `${label}: no chilena strike`);
  await advance(page, 900);
};

/** A fresh 1280x720 page with a saved `<playerId>` vs Joel lineup, in a running match. */
const openMatchAs = async (browser, playerId) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await context.addInitScript((id) => {
    window.localStorage.setItem('skyhead-showdown.player-profile.v2', JSON.stringify({
      playerCharacterId: id,
      opponentId: 'joel',
    }));
  }, playerId);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && typeof window.advanceTime === 'function');
  for (let attempt = 0; attempt < 20 && (await readState(page)).mode === 'splash'; attempt += 1) {
    await advance(page, 500);
  }
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');
  await touchControl(page, 640, 252, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  assert.equal((await readState(page)).playerCharacter.id, playerId);
  await touchControl(page, 785, 660, 40);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(page, 3100);
  return { context, page, errors };
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  // Bob is the default opponent, and the selector skips the opponent: seed a
  // saved lineup with Bob as the player instead (the profile is sanitized on load).
  await context.addInitScript(() => {
    window.localStorage.setItem('skyhead-showdown.player-profile.v2', JSON.stringify({
      playerCharacterId: 'bob',
      opponentId: 'joel',
    }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.render_game_to_text === 'function' && typeof window.advanceTime === 'function');
  for (let attempt = 0; attempt < 20 && (await readState(page)).mode === 'splash'; attempt += 1) {
    await advance(page, 500);
  }
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro');

  // Football setup with the seeded Bob-vs-Joel lineup, then start a match.
  await touchControl(page, 640, 252, 35);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'football-setup');
  let state = await readState(page);
  assert.equal(state.playerCharacter.id, 'bob');
  await touchControl(page, 785, 660, 40);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown');
  await advance(page, 3100);
  state = await readState(page);
  assert.equal(state.players.left.atlasLayout, 'roster-v2');
  assert.equal(state.players.left.collisionProfile, 'kid');
  assert.ok(ROSTER_V2.idle.includes(state.players.left.visualFrame), `idle loop frame; got ${state.players.left.visualFrame}`);
  assert.ok(Math.abs(state.players.left.displayWidth - 196) < 0.5, `336 px cells draw 196 px wide; got ${state.players.left.displayWidth}`);
  await capture(page, `${output}/00-bob-idle.png`);

  // Bob's ordinary jump, live: the chilena flight must stay within it, and
  // the pure model (normalJumpRise) must match the game's physics.
  const bobJump = await measureNormalJump(page);
  assert.ok(Math.abs(bobJump.rise - bobJump.modelRise) < 1.5, `Bob jump: live ${bobJump.rise} vs model ${bobJump.modelRise}`);
  // A high ball near the top of the screen: ordinary kick, Bob stays down.
  await refuseHighBall(page, 'bob high ball');

  const still = await runChilena(page, {
    ball: { x: 610, y: 380, vx: 0, vy: 0 },
    label: 'still high ball',
    normalJumpRise: bobJump.rise,
    screenshot: `${output}/01-bob-chilena-contact.png`,
  });
  // The drawn boot and the gameplay boot are the same point, so the contact gap
  // the game measured is the gap the player sees.
  assert.ok(still.geometry.drawnToModel < 2, `drawn vs model boot ${JSON.stringify(still.geometry)}`);
  // Land and recover the grounded pose.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await advance(page, 50);
    state = await readState(page);
    if (!state.players.left.chilenaActive && state.players.left.grounded) break;
  }
  assert.equal(state.players.left.chilenaActive, false, 'Bob should land after the chilena');
  assert.equal(state.players.left.facing, 1, 'Bob should face the rival goal again after landing');
  assert.ok(Math.abs(state.players.left.visualGroundAnchorY - 636) < 0.2, 'landing returns to the shared foot baseline');
  await advance(page, 600);

  const moving = await runChilena(page, {
    ball: MOVING_BALL,
    label: 'moving ball',
    normalJumpRise: bobJump.rise,
    screenshot: `${output}/02-bob-chilena-moving-contact.png`,
  });
  assert.ok(moving.geometry.drawnToModel < 2, `moving: drawn vs model boot ${JSON.stringify(moving.geometry)}`);
  await advance(page, 2000);

  // A ball popped up to the top of Bob's zone (it peaks near y=357, where his
  // boot only reaches at the top of a normal jump): it still connects, and the
  // body climbs about one ordinary jump, no more.
  const topOfZone = await runChilena(page, {
    ball: { x: 590, y: 372, vx: 0, vy: -3 },
    label: 'top of the zone',
    normalJumpRise: bobJump.rise,
    screenshot: `${output}/02-bob-chilena-top-of-zone-contact.png`,
  });
  assert.ok(topOfZone.apexRise > 60, `the top-of-zone chilena should be a real jump; rose ${topOfZone.apexRise} px`);
  assert.ok(topOfZone.geometry.drawnToModel < 2, `top of zone: drawn vs model boot ${JSON.stringify(topOfZone.geometry)}`);
  await advance(page, 2000);

  // A chest-high ball is "overhead" by the old trigger but no overhead boot can
  // meet it: no chilena, the press stays an ordinary kick.
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(600);
    window.__SKYHEAD_DEBUG__.setHumanMeter(12);
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1080);
    // Chest high (about 58 px above the 547 body centre), past the boot side, drifting away.
    window.__SKYHEAD_DEBUG__.setBall({ x: 688, y: 488, vx: 2, vy: 0 });
  });
  const beforeLow = await readState(page);
  await hold(page, 'x', 17);
  await hold(page, 'k', 17);
  state = await readState(page);
  assert.equal(state.players.left.chilenaSuccesses, beforeLow.players.left.chilenaSuccesses, 'an unreachable low ball must not start a chilena');
  // The framed trigger zone starts at head level (Bob: 193 px above his
  // feet), so a chest-high ball is rejected up front instead of by the planner.
  assert.equal(state.players.left.lastChilenaAttempt?.reason, 'ball-not-overhead');
  await advance(page, 1500);

  // Sprint and hit are sampled tick by tick: pause Phaser's real-time loop so
  // only advanceTime() steps the game (otherwise real frames between calls can
  // run a short stun out before it is sampled).
  await page.evaluate(() => window.__SKYHEAD_GAME__.loop.sleep());
  // Sprint: the dash alternates the run's two opposite strides under a lean.
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(400);
    // Hold the AI through the sprint and hit samples: otherwise it can play
    // the loose ball into a goal, and the goal-phase reset cuts a sample short.
    window.__SKYHEAD_DEBUG__.setOpponentPosition(1100);
    window.__SKYHEAD_DEBUG__.stunOpponent(4);
    window.__SKYHEAD_DEBUG__.setBall({ x: 1000, y: 200 });
  });
  await advance(page, 300);
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer.startDash(1));
  const sprintFrames = [];
  let sprintAngle = 0;
  for (let step = 0; step < 10; step += 1) {
    await advance(page, 1000 / 60);
    state = await readState(page);
    if (state.players.left.pose === 'dash') {
      sprintFrames.push(state.players.left.visualFrame);
      sprintAngle = Math.max(sprintAngle, await page.evaluate(() => (
        Math.abs(window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer.visual.angle)
      )));
    }
  }
  assert.ok(sprintFrames.length >= 3, `the dash should last several ticks; got ${sprintFrames}`);
  assert.ok(sprintFrames.every((frame) => ROSTER_V2.sprint.includes(frame)), `sprint frames ${sprintFrames}`);
  assert.equal(new Set(sprintFrames).size, 2, `the sprint should alternate both strides; got ${sprintFrames}`);
  assert.ok(sprintAngle > 6, `the sprint should lean forward; got ${sprintAngle} degrees`);
  await advance(page, 600);

  // React when hit: impact, stagger, then recover before the stun ends.
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').leftPlayer.applyStun(-1));
  const hitStages = [];
  for (let step = 0; step < 120; step += 1) {
    await advance(page, 1000 / 60);
    state = await readState(page);
    if (!state.players.left.stunned) break;
    if (hitStages.at(-1) !== state.players.left.visualFrame) hitStages.push(state.players.left.visualFrame);
  }
  assert.deepEqual(hitStages, [ROSTER_V2.hit.impact, ROSTER_V2.hit.stagger, ROSTER_V2.hit.recover], `hit reaction order; got ${hitStages}`);
  await page.evaluate(() => window.__SKYHEAD_GAME__.loop.wake());
  await advance(page, 600);

  // Goal: the scorer plays the celebrate loop.
  await page.evaluate(() => {
    window.__SKYHEAD_DEBUG__.resumePlay();
    window.__SKYHEAD_DEBUG__.setHumanPosition(500);
    window.__SKYHEAD_DEBUG__.setBall({ x: 640, y: 200 });
  });
  await advance(page, 400);
  await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').registerGoal('left'));
  const celebrateFrames = new Set();
  for (let step = 0; step < 12; step += 1) {
    await advance(page, 60);
    state = await readState(page);
    if (state.players.left.celebrating) celebrateFrames.add(state.players.left.visualFrame);
  }
  assert.ok(
    [...celebrateFrames].filter((frame) => ROSTER_V2.celebrate.includes(frame)).length >= 2,
    `the scorer should cycle the celebrate loop; got ${[...celebrateFrames]}`,
  );
  await capture(page, `${output}/03-bob-celebrate.png`);

  assert.deepEqual(errors, [], `browser emitted errors:\n${errors.join('\n')}`);
  await context.close();

  // Adults: standard size (Dad and Mum are no longer scaled up) and much higher
  // contact boots than Bob's. Every still ball at or above the standing boot
  // connects (test/sprite-redo.test.js); check the live game agrees for a still
  // and a moving overhead ball, and that the drawn boot is the gameplay boot.
  const adultResults = [];
  for (const id of ['dad', 'juanjo', 'mum']) {
    const adult = await openMatchAs(browser, id);
    let adultState = await readState(adult.page);
    assert.equal(adultState.players.left.atlasLayout, 'roster-v2', `${id} atlas`);
    assert.equal(adultState.players.left.collisionProfile, 'standard', `${id} collision profile`);
    assert.equal(adultState.players.left.visualScale, 1, `${id} visual scale`);
    assert.equal(adultState.players.left.displayHeight, 280, `${id} display height`);
    assert.ok(Math.abs(adultState.players.left.visualGroundAnchorY - 636) < 0.2, `${id} stands on the pitch`);
    const adultJump = await measureNormalJump(adult.page);
    assert.ok(Math.abs(adultJump.rise - adultJump.modelRise) < 1.5, `${id} jump: live ${adultJump.rise} vs model ${adultJump.modelRise}`);
    await refuseHighBall(adult.page, `${id} high ball`);
    const adultStill = await runChilena(adult.page, {
      ball: { x: 610, y: 380, vx: 0, vy: 0 },
      label: `${id} still high ball`,
      boot: CONTACT_BOOTS[id],
      normalJumpRise: adultJump.rise,
      screenshot: `${output}/10-${id}-chilena-contact.png`,
    });
    assert.ok(adultStill.geometry.drawnToModel < 2, `${id}: drawn vs model boot ${JSON.stringify(adultStill.geometry)}`);
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await advance(adult.page, 50);
      adultState = await readState(adult.page);
      if (!adultState.players.left.chilenaActive && adultState.players.left.grounded) break;
    }
    assert.equal(adultState.players.left.chilenaActive, false, `${id} should land after the chilena`);
    assert.ok(Math.abs(adultState.players.left.visualGroundAnchorY - 636) < 0.2, `${id}: landing returns to the foot baseline`);
    await advance(adult.page, 600);
    const adultMoving = await runChilena(adult.page, {
      ball: MOVING_BALL,
      label: `${id} moving ball`,
      boot: CONTACT_BOOTS[id],
      normalJumpRise: adultJump.rise,
    });
    assert.ok(adultMoving.geometry.drawnToModel < 2, `${id} moving: drawn vs model boot ${JSON.stringify(adultMoving.geometry)}`);
    assert.deepEqual(adult.errors, [], `${id} browser emitted errors:\n${adult.errors.join('\n')}`);
    adultResults.push(`${id} ${adultStill.contact.surfaceDistance}/${adultMoving.contact.surfaceDistance} px, `
      + `apex ${adultStill.apexRise.toFixed(1)}/${adultMoving.apexRise.toFixed(1)} vs jump ${adultJump.rise.toFixed(1)} px`);
    await adult.context.close();
  }

  console.log(`Adult framed chilenas connected (still/moving contact gap, body apex): ${adultResults.join('; ')}.`);
  console.log(`Bob chilena apex ${still.apexRise.toFixed(1)}/${moving.apexRise.toFixed(1)}/${topOfZone.apexRise.toFixed(1)} px (still/moving/top of zone) vs normal jump ${bobJump.rise.toFixed(1)} px `
    + `(model ${bobJump.modelRise} px); high balls near the top of the screen refused for Bob, Dad, Juanjo and Mum.`);
  console.log(`Roster-v2 checks passed: still contact gap ${still.contact.surfaceDistance} px at ${still.contact.seconds}s, `
    + `moving contact gap ${moving.contact.surfaceDistance} px at ${moving.contact.seconds}s, drawn-vs-model boot `
    + `${still.geometry.drawnToModel.toFixed(2)} / ${moving.geometry.drawnToModel.toFixed(2)} px, sprint ${sprintFrames} `
    + `(lean ${sprintAngle.toFixed(1)} deg), hit ${hitStages}, celebrate frames ${[...celebrateFrames]}.`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
