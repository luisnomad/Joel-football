import Phaser from 'phaser';
import {
  CATEGORIES,
  FIXED_STEP,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  HUMAN_PLAYER_ID,
  HUMAN_PLAYER_NAME,
  PLAYER_TUNING,
} from '../constants.js';
import { createHeuristicAgentProvider } from '../ai/HeuristicAgentProvider.js';
import { Ball } from '../entities/Ball.js';
import { Fighter } from '../entities/Fighter.js';
import { Goal } from '../entities/Goal.js';
import { InputController } from '../input/InputController.js';
import { applyAiDifficulty, safeDecide } from '../pure/actions.js';
import { nextCountdownWhistle } from '../pure/countdownWhistle.js';
import { counterPowerVelocity } from '../pure/power.js';
import { addGoal, createScoreState, detectGoalCrossing, formatClock, tickMatchClock } from '../pure/rules.js';
import { createWorldSnapshot } from '../pure/snapshot.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createButton } from '../ui/createButton.js';
import { TouchControls } from '../ui/TouchControls.js';
import { fitTextSize } from '../ui/textFit.js';
import { isTouchLayout } from '../input/isTouchLayout.js';
import { applySuperShot, getSuperpower, isInstantSuperpower } from '../content/superpowers.js';
import { t } from '../i18n.js';
import { playerProfileStore } from '../services/PlayerProfile.js';

const round = (value, places = 2) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

const createPowerBallState = (overrides = {}) => ({
  active: false,
  owner: null,
  ttl: 0,
  counterFlash: 0,
  superpowerId: null,
  elapsed: 0,
  effectTriggered: false,
  color: null,
  ...overrides,
});

export class MatchScene extends Phaser.Scene {
  constructor() {
    super('Match');
    this.accumulator = 0;
  }

  create() {
    this.isTouchLayout = isTouchLayout();
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    arcadeAudio.setScene('match');
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearActiveScene(this);
      this.matter?.world?.off('collisionstart', this.onCollisionStart, this);
      this.inputController?.destroy();
      this.unbindKeyboard();
      delete window.__SKYHEAD_DEBUG__;
    });

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'arena').setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setDepth(0);
    this.createPitchDetails();
    this.createWorldPhysics();
    this.matter.world.setBounds(0, -24, GAME_WIDTH, GAME_HEIGHT + 24, 28, true, true, true, false);

    this.inputController = new InputController(this);
    this.humanProvider = {
      id: 'keyboard-touch',
      type: 'human',
      decide: (snapshot) => this.inputController.sample(snapshot.players.left),
    };
    this.opponentProvider = this.registry.get('agentProvider')
      ?? createHeuristicAgentProvider('right', { difficulty: this.profile.difficulty });
    this.currentIntents = { left: null, right: null };
    this.lastAiAdvancedIntent = { sprint: false, kickBoost: 0 };
    this.aiThinkTimer = 0;

    this.leftPlayer = new Fighter(this, {
      id: HUMAN_PLAYER_ID,
      side: 'left',
      x: 340,
      texture: this.textures.exists('joel-sheet') ? 'joel-sheet' : 'joel',
      name: HUMAN_PLAYER_NAME,
      stats: { speed: 1.08, jump: 1.04, kick: 1, dash: 1, power: 1 },
    });
    this.rightPlayer = new Fighter(this, {
      id: 'vex',
      side: 'right',
      x: 940,
      texture: this.textures.exists('vex-sheet') ? 'vex-sheet' : 'vex',
      name: 'VEX-9',
      stats: { speed: 1, jump: 1.08, kick: 1.04, dash: 1, power: 1.05 },
    });
    this.players = { left: this.leftPlayer, right: this.rightPlayer };
    this.ball = new Ball(this, GAME_WIDTH / 2, 336);
    this.previousBallPosition = { x: this.ball.body.x, y: this.ball.body.y };
    this.powerBall = createPowerBallState();
    this.trail = [];
    this.fx = [];
    this.trailGraphics = this.add.graphics().setDepth(14);
    this.fxGraphics = this.add.graphics().setDepth(42);
    this.powerFlare = this.add.image(this.ball.body.x, this.ball.body.y, 'flare')
      .setDisplaySize(250, 125)
      .setOrigin(0.78, 0.5)
      .setDepth(15)
      .setVisible(false);

    this.score = createScoreState();
    this.phase = 'countdown';
    this.countdown = 2.7;
    this.lastCountdownSecond = 0;
    this.goalTimer = 0;
    this.bannerTimer = 0;
    this.meterFlash = { left: 0, right: 0 };
    this.lastBoostedStrike = null;
    this.lastChilenaStrike = null;
    this.lastInstantPower = null;
    this.goalLatch = false;
    this.isPaused = false;
    this.createHud();
    this.createOverlays();
    this.touchControls = new TouchControls(this, this.inputController);
    this.bindEvents();
    this.bindKeyboard();
    this.matter.world.on('collisionstart', this.onCollisionStart, this);
    this.ball.freeze();
    this.updateHud();

    window.__SKYHEAD_DEBUG__ = {
      resumePlay: () => {
        this.phase = 'playing';
        this.isPaused = false;
        this.goalLatch = false;
        this.goalTimer = 0;
        this.score = { ...this.score, winner: null };
        this.matter.world.resume();
        this.cameras.main.resetFX();
        this.pauseOverlay.setVisible(false);
        this.setPauseMenuButtonsVisible(false);
        this.announcementText.setText('').setColor('#ffffff').setFontSize(82);
      },
      setHumanMeter: (meter = 100) => {
        this.leftPlayer.meter = Phaser.Math.Clamp(meter, 0, 100);
        this.leftPlayer.powerArmed = 0;
      },
      grantEquippedPower: (powerId = 'fireball', count = 1) => {
        playerProfileStore.earn(powerId, count);
        playerProfileStore.equip(powerId);
        this.profile = playerProfileStore.get();
      },
      getProfile: () => playerProfileStore.get(),
      setBall: ({ x, y, vx = 0, vy = 0 }) => {
        this.ball.body.setStatic(false);
        this.ball.body.setPosition(x, y);
        this.ball.body.setVelocity(vx, vy);
        this.ball.body.setAngularVelocity(0);
        this.previousBallPosition = { x, y };
        this.powerBall = createPowerBallState();
      },
      setIncomingPower: ({ owner = 'right', x, y, vx, vy = 0 }) => {
        this.ball.body.setStatic(false);
        this.ball.body.setPosition(x, y);
        this.ball.body.setVelocity(vx, vy);
        this.previousBallPosition = { x, y };
        this.powerBall = createPowerBallState({ active: true, owner, ttl: PLAYER_TUNING.powerDuration });
      },
      setOpponentPosition: (x = 1040) => {
        this.rightPlayer.finishChilena();
        this.rightPlayer.sprite.setPosition(Phaser.Math.Clamp(x, 142, 1138), GROUND_Y - 89);
        this.rightPlayer.sprite.setVelocity(0, 0);
        this.rightPlayer.setFacing(-1);
        this.rightPlayer.stunTimer = 0;
        this.rightPlayer.stunProtection = 0;
        this.rightPlayer.stopSprint(false);
        this.rightPlayer.kickTimer = 0;
        this.rightPlayer.kickBoostTaps = 0;
        this.rightPlayer.kickBoostAppliedTaps = 0;
        this.rightPlayer.kickBoostAppliedStrength = 0;
        this.rightPlayer.lastStrikePowered = false;
        this.aiThinkTimer = 0;
        this.currentIntents.right = null;
        this.meterFlash.right = 0;
        this.lastBoostedStrike = null;
      },
      setOpponentMeter: (meter = 100) => { this.rightPlayer.meter = Phaser.Math.Clamp(meter, 0, 100); },
      stunOpponent: (seconds = 0.4) => {
        this.rightPlayer.kickTimer = 0;
        this.rightPlayer.kickCooldown = 0;
        this.rightPlayer.stunTimer = Math.max(0, seconds);
        this.rightPlayer.stunProtection = Math.max(0, seconds);
      },
      setHumanPosition: (x = 360) => {
        this.leftPlayer.finishChilena();
        this.leftPlayer.sprite.setPosition(Phaser.Math.Clamp(x, 142, 1138), GROUND_Y - 89);
        this.leftPlayer.sprite.setVelocity(0, 0);
        this.leftPlayer.setFacing(1);
        this.leftPlayer.kickCooldown = 0;
        this.leftPlayer.kickTimer = 0;
        this.leftPlayer.kickBoostTaps = 0;
        this.leftPlayer.kickBoostAppliedTaps = 0;
        this.leftPlayer.kickBoostAppliedStrength = 0;
        this.leftPlayer.lastKickBoostSpent = 0;
        this.leftPlayer.lastStrikePowered = false;
        this.leftPlayer.stunTimer = 0;
        this.leftPlayer.stunProtection = 0;
        this.leftPlayer.stopSprint(false);
        this.inputController.resetAdvancedInput();
        this.meterFlash.left = 0;
        this.lastBoostedStrike = null;
      },
      humanKick: () => {
        this.leftPlayer.kickCooldown = 0;
        this.leftPlayer.startKick();
      },
      scoreFor: (side) => this.registerGoal(side === 'left' ? 'left' : 'right'),
      endClock: () => { this.score = tickMatchClock({ ...this.score, secondsLeft: 0.01 }, 0.02); },
      forceResult: (side = 'left') => {
        this.score = { ...this.score, winner: side === 'right' ? 'right' : 'left' };
        this.showResult();
      },
      snapshot: () => JSON.parse(this.serializeStateString()),
    };
  }

  createPitchDetails() {
    const graphics = this.add.graphics().setDepth(2);
    graphics.fillStyle(0x0c2740, 0.15).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.lineStyle(5, 0xe9fff3, 0.74);
    graphics.strokeLineShape(new Phaser.Geom.Line(0, GROUND_Y, GAME_WIDTH, GROUND_Y));
  }

  createWorldPhysics() {
    this.goals = [new Goal(this, 'left'), new Goal(this, 'right')];
    this.matter.add.rectangle(GAME_WIDTH / 2, GROUND_Y + 28, GAME_WIDTH, 56, {
      isStatic: true,
      label: 'pitch-ground',
      restitution: 0.34,
      friction: 0.72,
      collisionFilter: {
        category: CATEGORIES.WORLD,
        mask: CATEGORIES.BALL | CATEGORIES.PLAYER,
      },
    });
  }

  createHud() {
    this.hud = this.add.graphics().setDepth(60);
    this.hud.fillStyle(0x071426, 0.88).fillRoundedRect(350, 20, 580, 104, 24);
    this.hud.lineStyle(3, 0xffffff, 0.17).strokeRoundedRect(350, 20, 580, 104, 24);
    this.leftNameText = this.add.text(382, 42, HUMAN_PLAYER_NAME, this.hudTextStyle(21, '#6ef4ff')).setDepth(61);
    this.rightNameText = this.add.text(898, 42, 'VEX-9', this.hudTextStyle(21, '#ffad72')).setOrigin(1, 0).setDepth(61);
    this.scoreText = this.add.text(640, 33, '0  :  0', this.hudTextStyle(42, '#ffffff')).setOrigin(0.5, 0).setDepth(61);
    this.clockText = this.add.text(640, 85, '1:30', this.hudTextStyle(21, '#d8e7ff')).setOrigin(0.5).setDepth(61);
    this.suddenDeathText = this.add.text(640, 113, '', this.hudTextStyle(14, '#ffda55')).setOrigin(0.5).setDepth(61);
    this.meterGraphics = this.add.graphics().setDepth(61);
    this.superPowerPill = this.add.rectangle(640, 145, 310, 34, 0x071426, 0.8)
      .setStrokeStyle(2, 0xffffff, 0.14)
      .setDepth(60);
    this.superPowerText = this.add.text(640, 145, '', this.hudTextStyle(14, '#d9ecff')).setOrigin(0.5).setDepth(61);
    this.announcementText = this.add.text(640, 238, '3', {
      ...this.hudTextStyle(82, '#ffffff'),
      stroke: '#10213e',
      strokeThickness: 12,
      shadow: { color: '#42d9ef', blur: 20, fill: true },
    }).setOrigin(0.5).setDepth(65);
  }

  hudTextStyle(size, color) {
    return {
      fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
    };
  }

  createOverlays() {
    const pauseShade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050914, 0.65).setOrigin(0).setInteractive();
    const pausePanel = this.add.rectangle(640, 352, 620, 390, 0x0d1b34, 0.96).setStrokeStyle(3, 0x8fefff, 0.42);
    const pauseTitle = this.add.text(640, 230, t(this.language, 'match.paused'), this.hudTextStyle(54, '#ffffff')).setOrigin(0.5);
    const pauseCopy = this.add.text(640, 305, t(this.language, 'match.chooseOption'), {
      ...this.hudTextStyle(21, '#bcd1eb'),
      align: 'center',
      lineSpacing: 9,
    }).setOrigin(0.5);
    this.pauseOverlay = this.add.container(0, 0, [pauseShade, pausePanel, pauseTitle, pauseCopy]).setDepth(100).setVisible(false);
    this.pauseMenuButtons = [
      createButton(this, { x: 640, y: 390, width: 280, height: 62, label: t(this.language, 'match.resume'), color: 0x2a9eb5, onPress: () => this.togglePause() }),
      createButton(this, { x: 505, y: 475, width: 230, height: 54, label: t(this.language, 'match.restart'), color: 0x705cff, onPress: () => this.scene.restart() }),
      createButton(this, { x: 775, y: 475, width: 230, height: 54, label: t(this.language, 'match.abandon'), color: 0xa34457, onPress: () => this.abandonMatch() }),
    ];
    this.pauseMenuButtons.forEach((button) => {
      [button.shadow, button.background, button.text, button.zone].forEach((item) => item.setDepth(101));
      button.setVisible(false);
    });

    const resultShade = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x050914, 0.76).setOrigin(0).setInteractive();
    const resultPanel = this.add.rectangle(640, 340, 610, 390, 0x0d1b34, 0.98).setStrokeStyle(4, 0xffdc63, 0.55);
    this.resultTitle = this.add.text(640, 225, t(this.language, 'match.joelWins'), this.hudTextStyle(54, '#ffffff')).setOrigin(0.5);
    this.resultScore = this.add.text(640, 300, '1  :  0', this.hudTextStyle(48, '#ffda55')).setOrigin(0.5);
    this.resultCopy = this.add.text(640, 354, t(this.language, 'match.winCopy'), this.hudTextStyle(19, '#bbcee6')).setOrigin(0.5);
    this.resultOverlay = this.add.container(0, 0, [resultShade, resultPanel, this.resultTitle, this.resultScore, this.resultCopy]).setDepth(110).setVisible(false);
    this.rematchButton = createButton(this, { x: 640, y: 435, width: 310, height: 68, label: t(this.language, 'match.rematch'), color: 0x705cff, onPress: () => this.scene.restart() });
    this.menuButton = createButton(this, { x: 640, y: 509, width: 250, height: 52, label: t(this.language, 'match.mainMenu'), color: 0x1d3c60, onPress: () => this.scene.start('Intro') });
    [this.rematchButton, this.menuButton].forEach((button) => {
      [button.shadow, button.background, button.text, button.zone].forEach((item) => item.setDepth(111));
      button.setVisible(false);
    });
  }

  bindEvents() {
    [
      'fighter-jump',
      'fighter-kick',
      'fighter-power-armed',
      'fighter-power-denied',
      'fighter-dash',
      'fighter-sprint-start',
      'fighter-step',
      'fighter-kick-boost-charged',
      'fighter-chilena',
      'fighter-shield-block',
    ].forEach((eventName) => this.events.off(eventName));
    this.events.on('fighter-jump', () => arcadeAudio.jump());
    this.events.on('fighter-power-armed', (fighter) => this.showPowerArmed(fighter));
    this.events.on('fighter-power-denied', (fighter) => this.showPowerDenied(fighter));
    this.events.on('fighter-dash', (fighter) => this.spawnImpact(fighter.sprite.x - fighter.facing * 26, fighter.sprite.y + 58, 0xb79aff, 4));
    this.events.on('fighter-sprint-start', (fighter) => {
      this.spawnImpact(fighter.sprite.x - fighter.facing * 24, GROUND_Y - 8, 0xdffbff, 10);
    });
    this.events.on('fighter-step', (fighter) => this.spawnImpact(
      fighter.sprite.x - fighter.facing * 18,
      GROUND_Y - 5,
      fighter.sprinting ? 0xbdefff : 0xd8f5dd,
      fighter.sprinting ? 5 : 2,
    ));
    this.events.on('fighter-kick-boost-charged', (fighter, taps) => {
      this.spawnImpact(fighter.sprite.x + fighter.facing * 58, fighter.sprite.y + 40, 0xffdc62, 2 + taps * 2);
      const postStrikeBoost = fighter.applyPostStrikeBoost(this.ball);
      if (postStrikeBoost) this.showBoostedStrike(fighter, postStrikeBoost);
    });
    this.events.on('fighter-chilena', () => arcadeAudio.kick(true));
    this.events.on('fighter-shield-block', (fighter) => {
      this.spawnImpact(fighter.sprite.x, fighter.sprite.y - 35, 0x7df7ff, 16);
      this.cameras.main.shake(70, 0.003);
    });
  }

  showPowerArmed(fighter) {
    if (fighter.side !== 'left') return;
    const profile = playerProfileStore.get();
    const equipped = profile.powers[profile.equippedPowerId] > 0
      ? getSuperpower(profile.equippedPowerId)
      : null;
    if (equipped && isInstantSuperpower(equipped.id)) {
      const consumedPowerId = playerProfileStore.consumeEquipped();
      if (consumedPowerId) {
        fighter.powerArmed = 0;
        fighter.meter = 0;
        if (consumedPowerId === 'ice') this.rightPlayer.applyFreeze(0, 2);
        if (consumedPowerId === 'shield') fighter.grantShield();
        if (consumedPowerId === 'hyper') fighter.activateHyper();
        this.lastInstantPower = { powerId: consumedPowerId, target: consumedPowerId === 'ice' ? 'right' : 'left' };
        this.setAnnouncement(
          t(this.language, equipped.activationKey).toUpperCase(),
          Phaser.Display.Color.IntegerToColor(equipped.color).rgba,
          56,
          760,
        );
        this.bannerTimer = 1.25;
        const target = consumedPowerId === 'ice' ? this.rightPlayer : fighter;
        this.spawnImpact(target.sprite.x, target.sprite.y - 35, equipped.color, 20);
        arcadeAudio.success();
        return;
      }
    }
    const powerName = equipped ? t(this.language, equipped.nameKey) : t(this.language, 'match.standardPower');
    this.setAnnouncement(
      t(this.language, 'match.powerArmed', { power: powerName }).toUpperCase(),
      equipped ? Phaser.Display.Color.IntegerToColor(equipped.color).rgba : '#fff1a6',
      46,
      800,
    );
    this.bannerTimer = 1.25;
    this.spawnImpact(fighter.sprite.x, fighter.sprite.y - 35, equipped?.color ?? 0xffe56c, 14);
    arcadeAudio.success();
  }

  showPowerDenied(fighter) {
    if (fighter.side !== 'left') return;
    this.announcementText.setText(t(this.language, 'match.powerNeedsFull')).setColor('#ffb59f').setFontSize(58);
    this.bannerTimer = 0.85;
    arcadeAudio.impact();
  }

  setAnnouncement(text, color = '#ffffff', baseSize = 64, maxWidth = 900) {
    this.announcementText.setText(text).setColor(color).setFontSize(baseSize);
    const fittedSize = fitTextSize({
      measuredWidth: this.announcementText.width,
      maxWidth,
      baseSize,
      minSize: 30,
    });
    this.announcementText.setFontSize(fittedSize);
    return this.announcementText;
  }

  bindKeyboard() {
    this.onPauseKey = () => this.togglePause();
    this.onEscapeKey = (event) => {
      if (event?.key !== 'Escape' || event.repeat) return;
      event.preventDefault();
      if (this.phase === 'result') this.abandonMatch();
      else this.togglePause();
    };
    this.onMenuKey = () => {
      if (this.isPaused) this.abandonMatch();
    };
    this.onRestartKey = () => this.scene.restart();
    this.onEnterKey = () => {
      if (this.phase === 'result') this.scene.restart();
    };
    this.input.keyboard.on('keydown-P', this.onPauseKey);
    window.addEventListener('keydown', this.onEscapeKey);
    this.input.keyboard.on('keydown-M', this.onMenuKey);
    this.input.keyboard.on('keydown-R', this.onRestartKey);
    this.input.keyboard.on('keydown-ENTER', this.onEnterKey);
  }

  unbindKeyboard() {
    window.removeEventListener('keydown', this.onEscapeKey);
    if (!this.input?.keyboard) return;
    this.input.keyboard.off('keydown-P', this.onPauseKey);
    this.input.keyboard.off('keydown-M', this.onMenuKey);
    this.input.keyboard.off('keydown-R', this.onRestartKey);
    this.input.keyboard.off('keydown-ENTER', this.onEnterKey);
  }

  togglePause() {
    if (this.phase === 'result') return;
    this.isPaused = !this.isPaused;
    this.pauseOverlay.setVisible(this.isPaused);
    this.touchControls.setGameplayVisible(!this.isPaused);
    this.setPauseMenuButtonsVisible(this.isPaused);
    if (this.isPaused) this.matter.world.pause();
    else this.matter.world.resume();
    arcadeAudio.click();
  }

  setPauseMenuButtonsVisible(visible) {
    this.pauseMenuButtons?.forEach((button) => button.setVisible(visible));
  }

  abandonMatch() {
    this.isPaused = false;
    arcadeAudio.click();
    this.scene.start('Intro');
  }

  update(_time, deltaMilliseconds) {
    const dt = Math.min(0.05, deltaMilliseconds / 1000);
    this.accumulator += dt;
    while (this.accumulator >= FIXED_STEP) {
      this.stepGame(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
    this.updateVisuals(dt);
  }

  stepGame(dt) {
    if (this.isPaused || this.phase === 'result') return;

    if (this.phase === 'countdown') {
      this.countdown = Math.max(0, this.countdown - dt);
      const countdownSignal = nextCountdownWhistle(this.lastCountdownSecond, this.countdown);
      this.lastCountdownSecond = countdownSignal.second;
      if (countdownSignal.shouldWhistle) {
        arcadeAudio.whistle(1, {
          cutoffMs: countdownSignal.cutoffMs,
          label: `countdown-${countdownSignal.style}`,
        });
      }
      this.announcementText
        .setFontSize(82)
        .setText(countdownSignal.second > 0 ? String(countdownSignal.second) : t(this.language, 'match.go'));
      if (this.countdown <= 0) {
        this.phase = 'playing';
        this.lastCountdownSecond = 0;
        this.ball.body.setStatic(false);
        this.ball.body.setVelocity(Phaser.Math.FloatBetween(-0.8, 0.8), -0.2);
        this.bannerTimer = 0.52;
      }
      return;
    }

    if (this.phase === 'goal') {
      this.goalTimer -= dt;
      this.leftPlayer.continueChilenaAnimation(dt);
      this.rightPlayer.continueChilenaAnimation(dt);
      this.updateEffects(dt);
      if (this.goalTimer <= 0) {
        if (this.score.winner) this.showResult();
        else this.resetRound();
      }
      return;
    }

    const snapshot = this.createSnapshot();
    this.meterFlash.left = Math.max(0, this.meterFlash.left - dt);
    this.meterFlash.right = Math.max(0, this.meterFlash.right - dt);
    if (this.bannerTimer > 0) {
      this.bannerTimer = Math.max(0, this.bannerTimer - dt);
      if (this.bannerTimer === 0) this.announcementText.setText('').setColor('#ffffff');
    }
    const leftIntent = safeDecide(this.humanProvider, snapshot);
    this.aiThinkTimer -= dt;
    if (this.aiThinkTimer <= 0 || !this.currentIntents.right) {
      const proposedIntent = safeDecide(this.opponentProvider, snapshot);
      this.currentIntents.right = this.opponentProvider.type === 'human'
        ? proposedIntent
        : applyAiDifficulty(proposedIntent, this.profile.difficulty);
      this.lastAiAdvancedIntent = {
        sprint: this.currentIntents.right.sprint,
        kickBoost: this.currentIntents.right.kickBoost,
      };
      this.aiThinkTimer = 0.075;
    }
    this.currentIntents.left = leftIntent;

    this.leftPlayer.update(leftIntent, dt, this.rightPlayer.sprite.x);
    this.rightPlayer.update(this.currentIntents.right, dt, this.leftPlayer.sprite.x);
    if (this.currentIntents.right.kickBoost > 0) {
      this.currentIntents.right = { ...this.currentIntents.right, kickBoost: 0 };
    }
    this.handleStrikes();
    this.handleCombat();
    this.ball.clampVelocity(this.powerBall.active ? (this.powerBall.counterFlash > 0 ? 46 : 29) : 25);
    this.ball.releaseGoalPerch(dt);
    this.updatePowerBall(dt);
    this.updateEffects(dt);
    this.score = tickMatchClock(this.score, dt);
    if (this.score.winner) {
      this.showResult();
      return;
    }
    this.checkGoal();
  }

  handleStrikes() {
    for (const fighter of [this.leftPlayer, this.rightPlayer]) {
      const chilenaStrike = fighter.attemptChilena(this.ball);
      if (chilenaStrike) {
        this.activateChilenaStrike(fighter, chilenaStrike);
        continue;
      }
      const incomingPowerVelocity = this.powerBall.active && this.powerBall.owner !== fighter.side
        ? { ...this.ball.body.body.velocity }
        : null;
      const strike = fighter.attemptBallStrike(this.ball);
      if (!strike) continue;
      arcadeAudio.kick(strike.powered);
      if (strike.boosted) this.showBoostedStrike(fighter, strike);
      if (incomingPowerVelocity) {
        this.counterPower(fighter, incomingPowerVelocity);
      } else if (strike.powered) {
        let superShot = null;
        if (fighter.side === 'left') {
          const profile = playerProfileStore.get();
          const equippedPowerId = profile.equippedPowerId;
          if (equippedPowerId && profile.powers[equippedPowerId] > 0) {
            const consumedPowerId = playerProfileStore.consumeEquipped();
            if (consumedPowerId) {
              superShot = applySuperShot(consumedPowerId, {
                direction: fighter.facing,
                baseSpeed: PLAYER_TUNING.powerShotSpeed,
              });
              this.ball.body.setVelocity(superShot.vx, superShot.vy);
              this.ball.body.setAngularVelocity(superShot.spin);
              if (superShot.effect === 'big') fighter.activateBigGuy();
              const power = getSuperpower(consumedPowerId);
              this.setAnnouncement(t(this.language, power.nameKey).toUpperCase(), '#ffffff', 64, 800);
              this.bannerTimer = 0.7;
              if (superShot.effect === 'big') {
                this.spawnImpact(fighter.sprite.x, fighter.sprite.y - 30, superShot.color, 26);
                this.cameras.main.shake(220, 0.008);
              }
            }
          }
        }
        const impactColor = superShot?.color ?? (fighter.side === 'left' ? 0x6af4ff : 0xff943d);
        this.powerBall = createPowerBallState({
          active: true,
          owner: fighter.side,
          ttl: PLAYER_TUNING.powerDuration,
          counterFlash: 0.32,
          superpowerId: superShot?.powerId ?? null,
          color: impactColor,
        });
        this.spawnImpact(this.ball.body.x, this.ball.body.y, impactColor, 14);
        this.cameras.main.shake(150, 0.006);
      }
    }
  }

  activateChilenaStrike(fighter, strike) {
    this.powerBall = createPowerBallState({
      active: true,
      owner: fighter.side,
      ttl: PLAYER_TUNING.powerDuration,
      counterFlash: 0.32,
      superpowerId: 'chilena',
      color: strike.color,
    });
    this.trail.length = 0;
    this.lastChilenaStrike = {
      side: fighter.side,
      meterAfter: strike.meterAfter,
      fireColor: strike.color,
    };
    this.announcementText.setText(t(this.language, 'match.chilena')).setColor('#ffb14d').setFontSize(70);
    this.bannerTimer = 0.8;
    this.spawnImpact(this.ball.body.x, this.ball.body.y, strike.color, 28);
    this.spawnImpact(fighter.sprite.x, fighter.sprite.y - 30, strike.color, 18);
    this.cameras.main.shake(190, 0.009);
  }

  showBoostedStrike(fighter, strike) {
    this.meterFlash[fighter.side] = 0.34;
    this.lastBoostedStrike = {
      side: fighter.side,
      shotType: strike.shotType,
      strength: strike.boostStrength,
      energySpent: strike.energySpent,
    };
    this.spawnImpact(this.ball.body.x, this.ball.body.y, 0xffdc62, 12 + Math.round(strike.boostStrength * 12));
    this.cameras.main.shake(110, 0.004 + strike.boostStrength * 0.003);
  }

  handleCombat() {
    const pairs = [
      [this.leftPlayer, this.rightPlayer],
      [this.rightPlayer, this.leftPlayer],
    ];
    pairs.forEach(([attacker, defender]) => {
      const dx = defender.sprite.x - attacker.sprite.x;
      const dy = Math.abs(defender.sprite.y - attacker.sprite.y);
      const dashHit = attacker.dashTimer > 0 && dx * attacker.facing > 0 && dx * attacker.facing < 100 && dy < 95;
      if (attacker.canHitOpponent(defender) || dashHit) {
        const shieldBefore = defender.superShield;
        if (defender.applyStun(attacker.facing, dashHit)) {
          attacker.markCombatHit();
          arcadeAudio.impact();
          this.spawnImpact(defender.sprite.x, defender.sprite.y - 24, 0xffe271, dashHit ? 12 : 8);
          this.cameras.main.shake(90, 0.004);
        } else if (shieldBefore > defender.superShield) {
          attacker.markCombatHit();
        }
      }
    });
  }

  updatePowerBall(dt) {
    if (!this.powerBall.active) return;
    this.powerBall.ttl = Math.max(0, this.powerBall.ttl - dt);
    this.powerBall.counterFlash = Math.max(0, this.powerBall.counterFlash - dt);
    this.powerBall.elapsed = (this.powerBall.elapsed ?? 0) + dt;
    if (this.powerBall.ttl <= 0) {
      this.powerBall = createPowerBallState();
      this.trail.length = 0;
      return;
    }
    this.trail.unshift({ x: this.ball.body.x, y: this.ball.body.y });
    this.trail.length = Math.min(this.trail.length, 14);
  }

  counterPower(fighter, incomingVelocity = this.ball.body.body.velocity) {
    const velocity = { ...incomingVelocity };
    const counter = counterPowerVelocity({ incomingX: velocity.x, incomingY: velocity.y, facing: fighter.facing });
    this.ball.body.setVelocity(counter.x, counter.y);
    this.powerBall = createPowerBallState({
      active: true,
      owner: fighter.side,
      ttl: PLAYER_TUNING.powerDuration,
      counterFlash: 0.42,
    });
    this.trail.length = 0;
    fighter.onBallContact(true);
    arcadeAudio.counter();
    this.announcementText.setText(t(this.language, 'match.counter')).setColor('#fff1a6').setFontSize(82);
    this.bannerTimer = 0.52;
    this.spawnImpact(this.ball.body.x, this.ball.body.y, 0xffffff, 20);
    this.cameras.main.shake(210, 0.011);
  }

  onCollisionStart(event) {
    event.pairs.forEach((pair) => {
      const labels = [pair.bodyA.label, pair.bodyB.label];
      const ballIndex = labels.indexOf('ball');
      if (ballIndex < 0) return;
      const otherLabel = labels[1 - ballIndex] ?? '';
      const [fighterId, part] = otherLabel.split(':');
      const fighter = fighterId === HUMAN_PLAYER_ID ? this.leftPlayer : fighterId === 'vex' ? this.rightPlayer : null;
      if (!fighter) {
        if (otherLabel.includes('crossbar')) {
          this.spawnImpact(this.ball.body.x, this.ball.body.y, 0xc7f8ff, 5);
          arcadeAudio.impact();
        }
        return;
      }

      const defendingPower = this.powerBall.active && this.powerBall.owner !== fighter.side;
      fighter.onBallContact(defendingPower);
      this.spawnImpact(this.ball.body.x, this.ball.body.y, fighter.side === 'left' ? 0x78f5ff : 0xffa062, part === 'head' ? 6 : 3);

      const canCounter = defendingPower && (fighter.kickTimer > 0 || (part === 'head' && fighter.jumpCounterWindow > 0));
      if (canCounter) {
        this.counterPower(fighter);
      }
    });
  }

  checkGoal() {
    if (this.goalLatch) return;
    const current = { x: this.ball.body.x, y: this.ball.body.y };
    const scoringSide = detectGoalCrossing({ previous: this.previousBallPosition, current });
    if (scoringSide) {
      this.registerGoal(scoringSide);
      return;
    }
    this.ball.recoverOutOfBounds();
    this.previousBallPosition = { x: this.ball.body.x, y: this.ball.body.y };
  }

  registerGoal(scoringSide) {
    if (this.phase === 'goal' || this.phase === 'result') return;
    this.goalLatch = true;
    this.score = addGoal(this.score, scoringSide);
    this.phase = 'goal';
    this.goalTimer = 1.65;
    this.ball.freeze();
    this.announcementText.setText(t(this.language, 'match.goal')).setColor(scoringSide === 'left' ? '#7bf7ff' : '#ffbd79').setFontSize(82);
    this.spawnImpact(this.ball.body.x, this.ball.body.y, scoringSide === 'left' ? 0x63efff : 0xff7a43, 36);
    arcadeAudio.goal();
    this.cameras.main.flash(180, 255, 255, 255, false, undefined, this);
    this.cameras.main.shake(280, 0.012);
    this.updateHud();
  }

  resetRound() {
    this.phase = 'countdown';
    this.countdown = this.score.suddenDeath ? 1.9 : 2.4;
    this.lastCountdownSecond = 0;
    this.goalLatch = false;
    this.powerBall = createPowerBallState();
    this.trail.length = 0;
    this.meterFlash = { left: 0, right: 0 };
    this.lastBoostedStrike = null;
    this.lastChilenaStrike = null;
    this.inputController.resetAdvancedInput();
    this.leftPlayer.reset(340);
    this.rightPlayer.reset(940);
    this.ball.reset(GAME_WIDTH / 2, 336);
    this.previousBallPosition = { x: this.ball.body.x, y: this.ball.body.y };
    this.ball.freeze();
    this.announcementText.setColor('#ffffff').setFontSize(82).setText(this.score.suddenDeath ? t(this.language, 'match.goldenGoal') : '3');
  }

  showResult() {
    if (this.phase === 'result') return;
    this.phase = 'result';
    this.leftPlayer.finishChilena();
    this.rightPlayer.finishChilena();
    arcadeAudio.whistle(3, { label: 'final' });
    this.isPaused = false;
    this.ball.freeze();
    this.cameras.main.resetFX();
    this.matter.world.pause();
    this.touchControls.setVisible(false);
    this.setPauseMenuButtonsVisible(false);
    const humanWon = this.score.winner === 'left';
    this.resultTitle.setText(humanWon ? t(this.language, 'match.joelWins') : t(this.language, 'match.vexWins')).setColor(humanWon ? '#7bf7ff' : '#ffad72');
    this.resultScore.setText(`${this.score.left}  :  ${this.score.right}`);
    this.resultCopy.setText(humanWon ? t(this.language, 'match.winCopy') : t(this.language, 'match.loseCopy'));
    this.resultOverlay.setVisible(true);
    this.rematchButton.setVisible(true);
    this.menuButton.setVisible(true);
    this.announcementText.setText('');
  }

  createSnapshot() {
    return createWorldSnapshot({
      score: this.score,
      ball: this.ball.snapshot(),
      left: this.leftPlayer.snapshot(),
      right: this.rightPlayer.snapshot(),
      powerBall: {
        active: this.powerBall.active,
        owner: this.powerBall.owner,
        ttl: round(this.powerBall.ttl),
      },
    });
  }

  spawnImpact(x, y, color, count) {
    for (let index = 0; index < count; index += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(70, 240);
      this.fx.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: Phaser.Math.FloatBetween(0.18, 0.48),
        maxLife: 0.48,
        color,
        radius: Phaser.Math.FloatBetween(2, 6),
      });
    }
  }

  updateEffects(dt) {
    this.fx.forEach((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 420 * dt;
      particle.vx *= 0.985;
    });
    this.fx = this.fx.filter((particle) => particle.life > 0);
  }

  updateVisuals(dt) {
    this.updateHud();
    this.trailGraphics.clear();
    if (this.powerBall.active) {
      const color = this.powerBall.color ?? (this.powerBall.owner === 'left' ? 0x65efff : 0xff793e);
      [...this.trail].reverse().forEach((point, index) => {
        const ratio = (index + 1) / Math.max(1, this.trail.length);
        this.trailGraphics.fillStyle(color, ratio * 0.42).fillCircle(point.x, point.y, 9 + ratio * 22);
      });
      const travelingLeft = this.ball.body.body.velocity.x < 0;
      this.powerFlare
        .setVisible(true)
        .setPosition(this.ball.body.x, this.ball.body.y)
        .setFlipX(travelingLeft)
        .setOrigin(travelingLeft ? 0.22 : 0.78, 0.5)
        .setAngle(0)
        .setTint(color);
      this.powerFlare.setAlpha(0.68 + Math.sin(this.time.now * 0.02) * 0.12);
      this.ball.body.setTint(color);
    } else {
      this.powerFlare.setVisible(false);
      this.ball.body.clearTint();
    }

    this.fxGraphics.clear();
    this.fx.forEach((particle) => {
      this.fxGraphics.fillStyle(particle.color, Math.min(1, particle.life / particle.maxLife));
      this.fxGraphics.fillCircle(particle.x, particle.y, particle.radius);
    });
  }

  updateHud() {
    if (!this.score || !this.leftPlayer) return;
    this.scoreText.setText(`${this.score.left}  :  ${this.score.right}`);
    this.clockText.setText(formatClock(this.score.secondsLeft, false));
    this.suddenDeathText.setText(this.score.suddenDeath ? t(this.language, 'match.goldenGoal') : '');
    const leftMeter = this.leftPlayer.meter / 100;
    const rightMeter = this.rightPlayer.meter / 100;
    this.meterGraphics.clear();
    this.meterGraphics.fillStyle(0x162842, 1).fillRoundedRect(382, 92, 190, 15, 7).fillRoundedRect(708, 92, 190, 15, 7);
    this.meterGraphics.fillStyle(leftMeter >= 1 ? 0xffd94f : 0x41dced, 1).fillRoundedRect(382, 92, 190 * leftMeter, 15, 7);
    this.meterGraphics.fillStyle(rightMeter >= 1 ? 0xffd94f : 0xff7b56, 1).fillRoundedRect(898 - 190 * rightMeter, 92, 190 * rightMeter, 15, 7);
    this.meterGraphics.lineStyle(2, 0xffffff, 0.25).strokeRoundedRect(382, 92, 190, 15, 7).strokeRoundedRect(708, 92, 190, 15, 7);
    if (this.meterFlash.left > 0) {
      this.meterGraphics.fillStyle(0xffef9b, Math.min(0.5, this.meterFlash.left * 1.4)).fillRoundedRect(382, 92, 190, 15, 7);
      this.meterGraphics.lineStyle(3, 0xffdc62, 0.9).strokeRoundedRect(382, 92, 190, 15, 7);
    }
    if (this.meterFlash.right > 0) {
      this.meterGraphics.fillStyle(0xffef9b, Math.min(0.5, this.meterFlash.right * 1.4)).fillRoundedRect(708, 92, 190, 15, 7);
      this.meterGraphics.lineStyle(3, 0xffdc62, 0.9).strokeRoundedRect(708, 92, 190, 15, 7);
    }
    this.leftNameText.setText(`${HUMAN_PLAYER_NAME}  ${Math.floor(this.leftPlayer.meter)}%`);
    this.rightNameText.setText(`${Math.floor(this.rightPlayer.meter)}%  VEX-9`);
    this.profile = playerProfileStore.get();
    const equipped = getSuperpower(this.profile.equippedPowerId);
    if (equipped) {
      const count = this.profile.powers[equipped.id];
      this.superPowerText
        .setText(`${equipped.icon}  ${t(this.language, 'match.powerReady', { power: t(this.language, equipped.nameKey), count })}`)
        .setColor(Phaser.Display.Color.IntegerToColor(equipped.color).rgba);
      this.superPowerPill.setStrokeStyle(2, equipped.color, 0.45);
    } else {
      this.superPowerText.setText(t(this.language, 'match.noPower')).setColor('#9eb2cb');
      this.superPowerPill.setStrokeStyle(2, 0xffffff, 0.14);
    }
  }

  serializeStateString() {
    return JSON.stringify(this.serializeState());
  }

  serializeState() {
    const left = this.leftPlayer?.snapshot?.() ?? null;
    const right = this.rightPlayer?.snapshot?.() ?? null;
    return {
      mode: this.isPaused ? 'paused' : this.phase,
      coordinateSystem: 'origin top-left; +x right; +y down; logical canvas 1280x720; ground y=636; goal lines x=126 and x=1154',
      timer: {
        secondsLeft: round(this.score?.secondsLeft ?? 0),
        label: this.score ? formatClock(this.score.secondsLeft, this.score.suddenDeath) : '',
        suddenDeath: this.score?.suddenDeath ?? false,
      },
      score: { left: this.score?.left ?? 0, right: this.score?.right ?? 0, winner: this.score?.winner ?? null },
      ball: this.ball?.snapshot?.() ?? null,
      players: { left, right },
      hud: {
        leftName: this.leftNameText?.text ?? '',
        rightName: this.rightNameText?.text ?? '',
        announcement: this.announcementText?.text ?? '',
        announcementWidth: round(this.announcementText?.width ?? 0),
        announcementFontSize: Number.parseFloat(this.announcementText?.style?.fontSize ?? 0) || 0,
      },
      powerBall: {
        active: this.powerBall?.active ?? false,
        owner: this.powerBall?.owner ?? null,
        ttl: round(this.powerBall?.ttl ?? 0),
        superpowerId: this.powerBall?.superpowerId ?? null,
        effectTriggered: this.powerBall?.effectTriggered ?? false,
        counterRule: 'kick or jumping head contact at impact',
      },
      language: this.language,
      difficulty: this.profile?.difficulty ?? 'normal',
      audio: arcadeAudio.diagnostics(),
      inventory: {
        equippedPowerId: this.profile?.equippedPowerId ?? null,
        equippedCount: this.profile?.equippedPowerId ? this.profile.powers[this.profile.equippedPowerId] : 0,
      },
      opponentProvider: this.opponentProvider?.id ?? 'unknown',
      aiAdvancedMechanicsEnabled: (this.profile?.difficulty ?? 'normal') !== 'easy',
      lastAiAdvancedIntent: this.lastAiAdvancedIntent,
      meterFlash: {
        left: round(this.meterFlash?.left ?? 0),
        right: round(this.meterFlash?.right ?? 0),
      },
      lastBoostedStrike: this.lastBoostedStrike,
      lastChilenaStrike: this.lastChilenaStrike,
      lastInstantPower: this.lastInstantPower,
      touchControls: this.touchControls?.visible ?? false,
      inputMode: this.isTouchLayout ? 'touch' : 'keyboard',
      currentIntent: this.currentIntents,
      controls: this.isTouchLayout ? {
        move: 'on-screen left/right',
        sprint: 'double-tap and hold the same direction',
        jump: 'on-screen up',
        kick: 'on-screen K',
        lob: 'on-screen L',
        kickBoost: 'repeat K or L during the kick animation',
        chilena: 'tap K or L twice under a reachable overhead ball',
        dash: 'on-screen D',
        power: 'on-screen P at 100%',
        pause: 'on-screen pause',
        restart: 'on-screen restart',
        menu: 'on-screen menu',
        fullscreen: 'on-screen fullscreen',
      } : {
        move: 'A/D or Left/Right',
        sprint: 'double-tap and hold the same direction',
        jump: 'W/Up/Space',
        kick: 'X/K',
        lob: 'Z/I or Up + Kick',
        kickBoost: 'repeat kick or lob during the kick animation',
        chilena: 'press any kick twice under a reachable overhead ball',
        dash: 'C/L',
        power: 'V/J at 100%',
        pause: 'P/Escape',
        fullscreen: 'F',
      },
      pauseActions: ['resume', 'restart', 'abandon match'],
    };
  }

  advanceForTesting(milliseconds) {
    const steps = Math.max(1, Math.round(milliseconds / (FIXED_STEP * 1000)));
    for (let index = 0; index < steps; index += 1) {
      this.stepGame(FIXED_STEP);
      if (!this.isPaused && this.phase !== 'result') this.matter.world.step(FIXED_STEP * 1000);
    }
    this.updateVisuals(milliseconds / 1000);
    this.game.renderer.preRender();
    this.sys.render(this.game.renderer);
    this.game.renderer.postRender();
  }
}
