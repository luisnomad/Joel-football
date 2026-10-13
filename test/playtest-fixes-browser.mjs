/*
 * Regressions from the 2026-10-12 pre-release playtest
 * (output/playtest-2026-10-12 in the main checkout):
 *   - fighters perching on each other's heads,
 *   - quick repeated taps dropped on touch menus,
 *   - HUD names overlapping the score,
 *   - restart confirmation,
 *   - home card, Power Lab and result-screen layout.
 * Captures go to output/release-fixes/.
 *   E2E_PORT=4405 node test/playtest-fixes-browser.mjs
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const port = Number(process.env.E2E_PORT) || 4405;
const url = `http://127.0.0.1:${port}`;
const output = new URL('../output/release-fixes/', import.meta.url).pathname;
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const enabled = (name) => !only || only.has(name);

const DEVICES = {
  tablet: { width: 1280, height: 800, isMobile: false },
  phone: { width: 732, height: 412, isMobile: true },
  desktop: { width: 1280, height: 720, isMobile: false, hasTouch: false },
};

const readState = (page) => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const nextFrames = (page) => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const capture = async (page, name) => {
  // Scenes fade in from white; capture what the player sees once it settles.
  await page.waitForFunction(() => window.__SKYHEAD_GAME__.scene.getScenes(true)
    .every((scene) => !scene.cameras.main.fadeEffect.isRunning && !scene.cameras.main.flashEffect.isRunning), null, { timeout: 5_000 })
    .catch(() => {});
  await nextFrames(page);
  await page.screenshot({ path: `${output}${name}.png` });
};

const openGame = async (browser, deviceName, { language = 'en', playerCharacterId = 'joel', opponentId = 'bob' } = {}) => {
  const device = DEVICES[deviceName];
  const context = await browser.newContext({
    viewport: { width: device.width, height: device.height },
    screen: { width: device.width, height: device.height },
    hasTouch: device.hasTouch ?? true,
    isMobile: device.isMobile,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__SKYHEAD_GAME__ && typeof window.render_game_to_text === 'function', null, { timeout: 30_000 });
  await page.evaluate(async ({ language: lang, playerCharacterId: player, opponentId: rival }) => {
    const { playerProfileStore } = await import('/src/game/services/PlayerProfile.js');
    playerProfileStore.setLanguage(lang);
    playerProfileStore.setPlayerCharacter(player);
    playerProfileStore.setOpponent(rival);
    playerProfileStore.setAudio({ musicMuted: true, effectsMuted: true });
  }, { language, playerCharacterId, opponentId });
  for (let attempt = 0; attempt < 40 && (await readState(page)).mode === 'splash'; attempt += 1) {
    await page.evaluate(() => window.advanceTime(500));
  }
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'intro', null, { timeout: 20_000 });
  // The HTML splash fades through white over the menu before it is removed.
  await page.waitForFunction(() => !document.getElementById('startup-splash'), null, { timeout: 10_000 });
  return { context, page, errors };
};

const worldToPage = (page, sceneKey, x, y) => page.evaluate(([key, worldX, worldY]) => {
  const game = window.__SKYHEAD_GAME__;
  const camera = game.scene.getScene(key).cameras.main;
  const rect = game.canvas.getBoundingClientRect();
  return {
    x: rect.left + ((worldX - camera.scrollX) * camera.zoom + camera.x) * (rect.width / game.scale.width),
    y: rect.top + ((worldY - camera.scrollY) * camera.zoom + camera.y) * (rect.height / game.scale.height),
  };
}, [sceneKey, x, y]);

/** Real pointer press at a world point of an active scene (camera-aware). */
const clickWorld = async (page, sceneKey, x, y) => {
  const point = await page.evaluate(([key, worldX, worldY]) => {
    const game = window.__SKYHEAD_GAME__;
    const camera = game.scene.getScene(key).cameras.main;
    const rect = game.canvas.getBoundingClientRect();
    const screenX = (worldX - camera.scrollX) * camera.zoom + camera.x;
    const screenY = (worldY - camera.scrollY) * camera.zoom + camera.y;
    return {
      x: rect.left + screenX * (rect.width / game.scale.width),
      y: rect.top + screenY * (rect.height / game.scale.height),
    };
  }, [sceneKey, x, y]);
  await page.mouse.click(point.x, point.y);
  await nextFrames(page);
};

const startScene = async (page, key, data) => {
  await page.evaluate(([sceneKey, sceneData]) => {
    const game = window.__SKYHEAD_GAME__;
    for (const scene of game.scene.getScenes(true)) game.scene.stop(scene.sys.settings.key);
    game.scene.start(sceneKey, sceneData);
  }, [key, data]);
  await page.waitForFunction((sceneKey) => window.__SKYHEAD_GAME__.scene.isActive(sceneKey), key, { timeout: 20_000 });
  await nextFrames(page);
};

// ---------------------------------------------------------------------------
// 4. Fighters must not perch on each other's heads.
// ---------------------------------------------------------------------------
const perchScenario = async (browser, playerCharacterId, opponentId) => {
  const { context, page, errors } = await openGame(browser, 'desktop', { playerCharacterId, opponentId });
  await startScene(page, 'Match');
  const result = await page.evaluate(() => {
    const game = window.__SKYHEAD_GAME__;
    game.loop.sleep();
    const scene = game.scene.getScene('Match');
    const debug = window.__SKYHEAD_DEBUG__;
    const step = () => window.advanceTime(1000 / 60);
    const onHead = () => {
      const top = scene.leftPlayer.sprite.body.bounds;
      const bottom = scene.rightPlayer.sprite.body.bounds;
      const overlap = Math.min(top.max.x, bottom.max.x) - Math.max(top.min.x, bottom.min.x);
      return !scene.leftPlayer.grounded
        && overlap > 8
        && top.max.y <= bottom.min.y + 45
        && top.max.y >= bottom.min.y - 12
        && Math.abs(scene.leftPlayer.sprite.body.velocity.y) < 3;
    };
    const trials = [];
    let intent = {};
    scene.humanProvider = { id: 'test', type: 'human', decide: () => intent };
    for (let trial = 0; trial < 3; trial += 1) {
      debug.resumePlay();
      debug.setHumanPosition(850);
      debug.setOpponentPosition(1090);
      debug.setBall({ x: 1185 + trial * 15, y: 300 });
      let streak = 0;
      let longest = 0;
      let airborne = 0;
      let longestAirborne = 0;
      // Hold toward the rival and keep jumping, as the playtest did.
      for (let frame = 0; frame < 60 * 7; frame += 1) {
        if (scene.phase !== 'playing') break;
        const grounded = scene.leftPlayer.grounded;
        intent = { move: 1, jump: grounded && frame % 9 === 0 };
        step();
        streak = onHead() ? streak + 1 : 0;
        longest = Math.max(longest, streak);
        airborne = scene.leftPlayer.grounded ? 0 : airborne + 1;
        longestAirborne = Math.max(longestAirborne, airborne);
      }
      trials.push({ longestOnHeadSeconds: Number((longest / 60).toFixed(2)), longestAirborneSeconds: Number((longestAirborne / 60).toFixed(2)) });
    }

    // Direct case: drop the player onto the rival's head next to the goal.
    debug.resumePlay();
    debug.setOpponentPosition(1100);
    debug.setHumanPosition(1060);
    debug.setBall({ x: 400, y: 300 });
    const rivalTop = scene.rightPlayer.sprite.body.bounds.min.y;
    const bottomOffset = scene.leftPlayer.sprite.body.bounds.max.y - scene.leftPlayer.sprite.y;
    scene.leftPlayer.sprite.setPosition(scene.rightPlayer.sprite.x - 6, rivalTop - bottomOffset - 2);
    scene.leftPlayer.sprite.setVelocity(0, 0);
    let streak = 0;
    let longest = 0;
    let landedAfter = null;
    for (let frame = 0; frame < 60 * 3; frame += 1) {
      intent = { move: 1 };
      scene.currentIntents.right = { move: 0 };
      scene.aiThinkTimer = 1;
      step();
      streak = onHead() ? streak + 1 : 0;
      longest = Math.max(longest, streak);
      if (landedAfter === null && scene.leftPlayer.grounded) landedAfter = frame / 60;
    }
    const gap = Math.abs(scene.leftPlayer.sprite.x - scene.rightPlayer.sprite.x);
    return {
      trials,
      dropped: { longestOnHeadSeconds: Number((longest / 60).toFixed(2)), landedAfter, gap: Math.round(gap) },
    };
  });
  await capture(page, `perch-${playerCharacterId}-${opponentId}`);
  await context.close();
  return { ...result, errors };
};

// ---------------------------------------------------------------------------
// 6. HUD names and charge never overlap the score.
// ---------------------------------------------------------------------------
const hudLayout = async (browser, deviceName, language, scores) => {
  const { context, page, errors } = await openGame(browser, deviceName, { language, playerCharacterId: 'juanjo', opponentId: 'juan' });
  await startScene(page, 'Match');
  const results = [];
  for (const [left, right] of scores) {
    const layout = await page.evaluate(([leftScore, rightScore]) => {
      const scene = window.__SKYHEAD_GAME__.scene.getScene('Match');
      window.__SKYHEAD_DEBUG__.resumePlay();
      window.__SKYHEAD_DEBUG__.setHumanMeter(100);
      window.__SKYHEAD_DEBUG__.setOpponentMeter(100);
      scene.score = { ...scene.score, left: leftScore, right: rightScore };
      scene.updateHud(true);
      const box = (text) => {
        const bounds = text.getBounds();
        return { left: bounds.left, right: bounds.right, text: text.text, fontSize: Number.parseFloat(text.style.fontSize) };
      };
      return { leftName: box(scene.leftNameText), rightName: box(scene.rightNameText), score: box(scene.scoreText) };
    }, [left, right]);
    results.push(layout);
  }
  // Let the kickoff fade finish so the capture shows the scoreboard as played.
  await page.waitForTimeout(1200);
  await capture(page, `hud-${deviceName}-${language}`);
  await context.close();
  return { results, errors };
};

await mkdir(output, { recursive: true });
const server = spawn(
  process.execPath,
  [`${root}node_modules/vite/bin/vite.js`, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: 'ignore' },
);
let browser;
try {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try { if ((await fetch(url)).ok) break; } catch { /* warming up */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  browser = await chromium.launch({ headless: true });

  if (enabled('perch')) {
    for (const [player, rival] of [['juanjo', 'juan'], ['joel', 'bob'], ['dad', 'mum']]) {
      const result = await perchScenario(browser, player, rival);
      console.log(`perch ${player} on ${rival}: ${JSON.stringify(result.trials)} dropped ${JSON.stringify(result.dropped)}`);
      assert.deepEqual(result.errors, [], `${player} vs ${rival} page errors`);
      result.trials.forEach((trial) => assert.ok(
        trial.longestOnHeadSeconds <= 0.35,
        `${player} rested on ${rival}'s head for ${trial.longestOnHeadSeconds}s`,
      ));
      assert.ok(result.dropped.longestOnHeadSeconds <= 0.35, `${player} dropped on ${rival} stayed perched ${JSON.stringify(result.dropped)}`);
      assert.ok(result.dropped.landedAfter !== null && result.dropped.landedAfter <= 0.8, `${player} must slide off ${rival} promptly ${JSON.stringify(result.dropped)}`);
    }
  }
  if (enabled('hud')) {
    for (const deviceName of ['tablet', 'phone', 'desktop']) {
      for (const language of ['en', 'es']) {
        const { results, errors } = await hudLayout(browser, deviceName, language, [[3, 6], [10, 10]]);
        assert.deepEqual(errors, [], `${deviceName} ${language} HUD page errors`);
        for (const { leftName, rightName, score } of results) {
          const detail = `${deviceName} ${language}: ${JSON.stringify({ leftName, rightName, score })}`;
          assert.ok(leftName.right + 8 <= score.left, `left name must clear the score; ${detail}`);
          assert.ok(rightName.left - 8 >= score.right, `right name must clear the score; ${detail}`);
          assert.ok(leftName.left >= 360 && rightName.right <= 920, `names must stay on the scoreboard; ${detail}`);
          assert.match(leftName.text, /100%$/, `the left charge stays visible; ${detail}`);
          assert.match(rightName.text, /^100%/, `the right charge stays visible; ${detail}`);
          assert.ok(leftName.fontSize >= 14 && rightName.fontSize >= 14, `names stay legible; ${detail}`);
        }
        console.log(`hud ${deviceName} ${language}: ${results.map(({ leftName, rightName, score }) => `"${leftName.text}" ${leftName.fontSize}px | ${score.text} | "${rightName.text}" ${rightName.fontSize}px`).join(' ; ')}`);
      }
    }
  }
  if (enabled('home')) {
    for (const language of ['en', 'es']) {
      // 8a. Tablet home cards: titles never run under the play icon.
      const tablet = await openGame(browser, 'tablet', { language });
      const cards = await tablet.page.evaluate(() => {
        const scene = window.__SKYHEAD_GAME__.scene.getScene('Intro');
        return ['footballCard', 'miniGamesCard', 'optionsCard'].map((key) => {
          const card = scene[key];
          const { titleText: title, arrow } = card;
          return {
            key,
            title: title.text,
            titleRight: Math.round(title.getBounds().right),
            arrowLeft: Math.round(arrow.x - arrow.radius),
          };
        });
      });
      await capture(tablet.page, `home-tablet-${language}`);
      assert.deepEqual(tablet.errors, []);
      await tablet.context.close();
      cards.forEach((card) => assert.ok(
        card.titleRight + 8 <= card.arrowLeft,
        `tablet ${language} ${card.key} title "${card.title}" runs into the play icon: ${JSON.stringify(card)}`,
      ));
      console.log(`home tablet ${language}: ${cards.map(({ title, titleRight, arrowLeft }) => `${title} ${titleRight}<${arrowLeft}`).join(', ')}`);

      // 8b. Phone home card: the meta line breaks between phrases, never mid-phrase.
      const phone = await openGame(browser, 'phone', { language });
      const meta = await phone.page.evaluate(async () => {
        const { t } = await import('/src/game/i18n.js');
        const scene = window.__SKYHEAD_GAME__.scene.getScene('CompactIntro') ?? window.__SKYHEAD_GAME__.scene.getScenes(true).at(-1);
        const phrases = t(scene.language, 'hub.footballMeta').split('•').map((part) => part.trim());
        const text = scene.children.list.find((child) => child.type === 'Text' && phrases.every((phrase) => child.text.includes(phrase)));
        return { phrases, lines: text.getWrappedText().map((line) => line.trim()).filter(Boolean) };
      });
      await capture(phone.page, `home-phone-${language}`);
      assert.deepEqual(phone.errors, []);
      await phone.context.close();
      meta.lines.forEach((line) => assert.ok(
        meta.phrases.some((phrase) => line.replace(/\s*•\s*$/, '').split(/\s*•\s*/).every((part) => meta.phrases.includes(part))),
        `phone ${language} meta line "${line}" splits a phrase: ${JSON.stringify(meta)}`,
      ));
      console.log(`home phone ${language}: ${JSON.stringify(meta.lines)}`);
    }
  }
  if (enabled('powerlab')) {
    for (const deviceName of ['tablet', 'phone']) {
      for (const language of ['en', 'es']) {
        const { context, page, errors } = await openGame(browser, deviceName, { language });
        await startScene(page, 'PowerLab', { returnScene: 'Intro', selectedPowerId: 'fireball' });
        await page.evaluate(() => window.__SKYHEAD_LAB_DEBUG__.openChallenge());
        await nextFrames(page);
        const modal = await page.evaluate(async () => {
          const { t } = await import('/src/game/i18n.js');
          const scene = window.__SKYHEAD_GAME__.scene.getScene('PowerLab');
          const visible = scene.challengeObjects.filter((object) => object.visible && object.active);
          const close = scene.closeChallengeButton;
          const panelBounds = scene.challengePanelBounds?.() ?? null;
          return {
            closeLabel: close?.text?.text ?? null,
            expectedClose: t(scene.language, 'lab.close'),
            closeCenter: close ? { x: close.background.x, y: close.background.y, bottom: close.background.getBounds().bottom } : null,
            powerIcon: visible.some((object) => object.type === 'Image' && object.texture.key === 'power-icon-fireball'),
            fallbackLetter: visible.some((object) => object.type === 'Text' && /^[A-Z]\s{2}/.test(object.text)),
            panelBottom: panelBounds?.bottom ?? null,
          };
        });
        await capture(page, `powerlab-challenge-${deviceName}-${language}`);
        const detail = `${deviceName} ${language}: ${JSON.stringify(modal)}`;
        assert.equal(modal.closeLabel, modal.expectedClose, `the challenge needs a close button; ${detail}`);
        if (deviceName === 'tablet') {
          assert.equal(modal.powerIcon, true, `the painted power icon must head the challenge; ${detail}`);
          assert.equal(modal.fallbackLetter, false, `no fallback letter next to the power name; ${detail}`);
          assert.ok(modal.panelBottom !== null && modal.panelBottom - modal.closeCenter.bottom <= 40, `no empty lower half while answering; ${detail}`);
        }
        await clickWorld(page, 'PowerLab', modal.closeCenter.x, modal.closeCenter.y);
        await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).challenge === null, null, { timeout: 5_000 })
          .catch(() => assert.fail(`Close must dismiss the challenge; ${detail}`));
        // After a wrong answer the panel grows for the explanation and its buttons.
        await page.evaluate(() => window.__SKYHEAD_LAB_DEBUG__.openChallenge());
        await nextFrames(page);
        const answered = await page.evaluate(() => {
          const scene = window.__SKYHEAD_GAME__.scene.getScene('PowerLab');
          const { answer } = scene.challenge.problem;
          window.__SKYHEAD_LAB_DEBUG__.answer(scene.challenge.choices.find((choice) => choice !== answer));
          const lowest = Math.max(...[scene.newProblemButton, scene.continueButton]
            .filter((button) => button?.background?.visible)
            .map((button) => button.background.getBounds().bottom));
          return {
            closeVisible: Boolean(scene.closeChallengeButton?.background?.visible),
            panelBottom: scene.challengePanelBounds?.().bottom ?? null,
            lowestButton: lowest,
          };
        });
        await capture(page, `powerlab-explained-${deviceName}-${language}`);
        assert.equal(answered.closeVisible, false, `Close gives way to Continue once answered; ${JSON.stringify(answered)}`);
        if (deviceName === 'tablet') {
          assert.ok(answered.panelBottom >= answered.lowestButton + 10, `the panel must contain the answer buttons; ${JSON.stringify(answered)}`);
        }
        assert.deepEqual(errors, [], `${deviceName} ${language} Power Lab errors`);
        await context.close();
        console.log(`powerlab ${deviceName} ${language}: ${JSON.stringify(modal)} ${JSON.stringify(answered)}`);
      }
    }
  }
  if (enabled('result')) {
    for (const deviceName of ['tablet', 'phone']) {
      for (const language of ['en', 'es']) {
        // 8d. The result buttons sit inside the result panel, clear of its border.
        const { context, page, errors } = await openGame(browser, deviceName, { language, playerCharacterId: 'juanjo', opponentId: 'juan' });
        await startScene(page, 'Match');
        const layout = await page.evaluate(() => {
          const scene = window.__SKYHEAD_GAME__.scene.getScene('Match');
          window.__SKYHEAD_DEBUG__.resumePlay();
          scene.score = { ...scene.score, left: 2, right: 5 };
          window.__SKYHEAD_DEBUG__.forceResult('right');
          const panel = scene.resultOverlay.list.find((child) => child.type === 'Rectangle' && child.width < 1000).getBounds();
          const bottomOf = (button) => Math.max(button.background.getBounds().bottom, button.shadow.getBounds().bottom);
          return {
            panelTop: panel.top,
            panelBottom: panel.bottom,
            menuBottom: bottomOf(scene.menuButton),
            rematchBottom: bottomOf(scene.rematchButton),
            copyBottom: scene.resultCopy.getBounds().bottom,
            rematchTop: scene.rematchButton.background.getBounds().top,
            hudBottom: 124,
          };
        });
        await capture(page, `result-${deviceName}-${language}`);
        assert.deepEqual(errors, []);
        await context.close();
        const detail = `${deviceName} ${language}: ${JSON.stringify(layout)}`;
        assert.ok(layout.menuBottom + 14 <= layout.panelBottom, `MAIN MENU must sit inside the panel, clear of its border; ${detail}`);
        assert.ok(layout.copyBottom + 8 <= layout.rematchTop, `the copy must clear REMATCH; ${detail}`);
        assert.ok(layout.panelTop >= layout.hudBottom, `the panel must not cover the scoreboard; ${detail}`);
        console.log(`result ${deviceName} ${language}: ${JSON.stringify(layout)}`);
      }
    }
  }
  if (enabled('taps')) {
    // 3. Quick real taps on the setup arrows all register; the WebView's
    // compatibility mouse press right after a tap still does not.
    const { context, page, errors } = await openGame(browser, 'tablet');
    await startScene(page, 'Customize');
    const arrow = await worldToPage(page, 'Customize', 375, 210);
    const results = {};
    for (const gap of [150, 250, 400]) {
      let changes = 0;
      let previous = (await readState(page)).playerCharacter.id;
      for (let tap = 0; tap < 6; tap += 1) {
        await page.touchscreen.tap(arrow.x, arrow.y);
        await page.waitForTimeout(gap);
        const current = (await readState(page)).playerCharacter.id;
        if (current !== previous) changes += 1;
        previous = current;
      }
      results[gap] = changes;
      await page.waitForTimeout(700);
    }
    const beforeGhost = (await readState(page)).playerCharacter.id;
    await page.touchscreen.tap(arrow.x, arrow.y);
    await page.waitForTimeout(60);
    const afterTap = (await readState(page)).playerCharacter.id;
    await page.mouse.click(arrow.x, arrow.y);
    await nextFrames(page);
    const afterGhost = (await readState(page)).playerCharacter.id;
    await page.waitForTimeout(600);
    await page.mouse.click(arrow.x, arrow.y);
    await nextFrames(page);
    const afterDeliberateClick = (await readState(page)).playerCharacter.id;
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`taps registered of 6 by gap (ms): ${JSON.stringify(results)}`);
    Object.entries(results).forEach(([gap, changes]) => assert.equal(changes, 6, `taps ${gap} ms apart: ${changes}/6 registered`));
    assert.notEqual(afterTap, beforeGhost, 'the tap itself must register');
    assert.equal(afterGhost, afterTap, 'the compatibility mouse press right after a tap must be ignored');
    assert.notEqual(afterDeliberateClick, afterGhost, 'a later deliberate press must work');
  }

  if (enabled('confirm')) {
    // 7. Restart asks first (pause menu and touch bar); Disc Hockey Leave asks first.
    for (const deviceName of ['tablet', 'phone']) {
      for (const language of ['en', 'es']) {
        const { context, page, errors } = await openGame(browser, deviceName, { language });
        await startScene(page, 'Match');
        await page.evaluate(() => window.__SKYHEAD_DEBUG__.resumePlay());
        const touchRestart = await page.evaluate(() => {
          const visual = JSON.parse(window.render_game_to_text()).touchControlVisuals?.['system:restart'];
          return visual ? { x: visual.x, y: visual.y } : null;
        });
        assert.ok(touchRestart, `${deviceName}: the touch bar shows Restart`);
        // Touch-bar Restart (screen-fixed control: stage coordinates).
        const restartPoint = await page.evaluate(({ x, y }) => {
          const game = window.__SKYHEAD_GAME__;
          const rect = game.canvas.getBoundingClientRect();
          return { x: rect.left + x * (rect.width / game.scale.width), y: rect.top + y * (rect.height / game.scale.height) };
        }, touchRestart);
        await page.touchscreen.tap(restartPoint.x, restartPoint.y);
        await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).modal === 'restart-confirm', null, { timeout: 5_000 })
          .catch(() => assert.fail(`${deviceName} ${language}: touch Restart must ask first`));
        let state = await readState(page);
        assert.equal(state.mode, 'paused');
        assert.deepEqual(state.confirmationActions, ['stay', 'restart match']);
        await capture(page, `confirm-restart-${deviceName}-${language}`);
        await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').closeAbandonConfirmation());
        state = await readState(page);
        assert.equal(state.mode, 'playing', 'Stay resumes the match');
        // Pause-menu Restart.
        await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').togglePause());
        await nextFrames(page);
        await clickWorld(page, 'Match', 505, 475);
        await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).modal === 'restart-confirm', null, { timeout: 5_000 })
          .catch(() => assert.fail(`${deviceName} ${language}: pause-menu Restart must ask first`));
        await page.evaluate(() => window.__SKYHEAD_GAME__.scene.getScene('Match').confirmRestart());
        await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'countdown', null, { timeout: 5_000 });

        await startScene(page, 'MiniGameLoading', { gameId: 'discHockey', sceneData: {} });
        await page.waitForFunction(() => window.__SKYHEAD_GAME__.scene.isActive('DiscHockey'), null, { timeout: 20_000 });
        await page.evaluate(() => {
          window.__DISC_HOCKEY_DEBUG__.startPlaying();
          window.__SKYHEAD_GAME__.scene.getScene('DiscHockey').pauseGame('manual');
        });
        await nextFrames(page);
        await clickWorld(page, 'DiscHockey', 640, 470);
        await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).modal === 'leave-confirm', null, { timeout: 5_000 })
          .catch(() => assert.fail(`${deviceName} ${language}: Disc Hockey Leave must ask first`));
        await capture(page, `confirm-disc-hockey-leave-${deviceName}-${language}`);
        assert.deepEqual(errors, [], `${deviceName} ${language} confirmation errors`);
        await context.close();
        console.log(`confirm ${deviceName} ${language}: restart and leave ask first`);
      }
    }
  }
  console.log('Playtest fixes browser checks passed.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
