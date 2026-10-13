import Phaser from 'phaser';
import {
  CATEGORIES,
  FIXED_STEP,
  GAME_HEIGHT,
  GAME_WIDTH,
  GROUND_Y,
  HUMAN_PLAYER_ID,
  PLAYER_TUNING,
} from '../constants.js';
import { createHeuristicAgentProvider } from '../ai/HeuristicAgentProvider.js';
import { Ball } from '../entities/Ball.js';
import { ballBounceStrength, resolveBallImpactProfile } from '../pure/ballImpactFeedback.js';
import { Fighter } from '../entities/Fighter.js';
import { Goal } from '../entities/Goal.js';
import {
  getCharacter,
  getCharacterKickReach,
  getCharacterLabel,
  getCharacterName,
  getCharacterVisualScale,
} from '../content/characters.js';
import { InputController } from '../input/InputController.js';
import { applyAiDifficulty, safeDecide } from '../pure/actions.js';
import { nextCountdownWhistle } from '../pure/countdownWhistle.js';
import { counterPowerVelocity } from '../pure/power.js';
import { addGoal, createScoreState, detectGoalCrossing, formatClock, tickMatchClock } from '../pure/rules.js';
import { createWorldSnapshot } from '../pure/snapshot.js';
import { clampSimulationFrameDelta } from '../pure/fixedStep.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createButton } from '../ui/createButton.js';
import { FOOTBALL_SYSTEM_CONTROL_RADIUS, TouchControls } from '../ui/TouchControls.js';
import { fitTextSize } from '../ui/textFit.js';
import { isTouchLayout } from '../input/isTouchLayout.js';
import { applySuperShot, getSuperpower, isInstantSuperpower } from '../content/superpowers.js';
import { t } from '../i18n.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { createArenaStage } from '../ui/createArenaStage.js';
import { createIconButton } from '../ui/createIconButton.js';
import { createInfoOverlay } from '../ui/createInfoOverlay.js';
import { createConfirmationOverlay } from '../ui/createConfirmationOverlay.js';
import { usesCompactPhoneUi } from '../layout/tabletStage.js';
import { resolveChilenaShot, shouldRedirectLobChilena } from '../pure/chilena.js';
import {
  directionalDashContact,
  isGoalFootPinCandidate,
  PERCH_SLIDE_SPEED,
  resolveFighterPerch,
  shouldResolvePlayerClash,
  sweepCircleAgainstBounds,
} from '../pure/gameplayPhysics.js';
import { FOOTBALL_TOUCH_MOVEMENT_MODES } from '../developerOptions.js';
import { PowerBallEffects } from '../effects/PowerBallEffects.js';
import { powerIconTextureKey } from '../ui/powerRewardBurst.js';
import { BallShadow } from '../effects/BallShadow.js';

/**
 * Seconds left on the goal celebration timer when both players resettle to
 * their kickoff spots, instead of staying frozen in their scoring pose
 * through the wait and the following countdown.
 */
const GOAL_RESETTLE_AT_SECONDS = 0.8;

const round = (value, places = 2) => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/** Scoreboard meter bars (inside the 350..930 x 20..124 scoreboard panel). */
const HUD_METER = Object.freeze({ y: 90, height: 20, width: 190, leftX: 382, rightX: 708 });
// Name + charge labels: left edge of the left label, right edge of the right one.
const HUD_NAME_INSET = Object.freeze({ left: 382, right: 898 });
const HUD_NAME_FONT = Object.freeze({ base: 21, minimum: 15 });

const createPowerBallState = (overrides = {}) => ({
  active: false,
  owner: null,
  ttl: 0,
  counterFlash: 0,
  superpowerId: null,
  elapsed: 0,
  effectTriggered: false,
  color: null,
  trajectory: null,
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
    this.playerCharacter = getCharacter(this.profile.playerCharacterId);
    this.opponent = getCharacter(this.profile.opponentId, 'bob');
    this.language = this.profile.language;
    arcadeAudio.setScene('football');
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearActiveScene(this);
      this.matter?.world?.off('collisionstart', this.onCollisionStart, this);
      this.touchControls?.destroy();
      this.inputController?.destroy();
      this.unbindKeyboard();
      delete window.__SKYHEAD_DEBUG__;
    });

    this.stageLayout = createArenaStage(this).layout;
    this.createPitchDetails();
    this.createWorldPhysics();
    this.matter.world.setBounds(0, -24, GAME_WIDTH, GAME_HEIGHT + 24, 28, true, true, true, false);

    this.inputController = new InputController(this);
    this.humanProvider = {
      id: 'keyboard-touch',
      type: 'human',
      decide: (snapshot) => this.inputController.sample(snapshot.players.left, {
        attackDirection: 1,
        opponent: snapshot.players.right,
        ball: snapshot.ball,
      }),
    };
    this.opponentProvider = this.registry.get('agentProvider')
      ?? createHeuristicAgentProvider('right', { difficulty: this.profile.difficultyByGame.football });
    this.currentIntents = { left: null, right: null };
    this.lastAiAdvancedIntent = { dashDirection: 0, kickBoost: 0 };
    this.aiThinkTimer = 0;

    this.leftPlayer = new Fighter(this, {
      id: this.playerCharacter.id,
      side: 'left',
      x: 340,
      texture: this.textures.exists(this.playerCharacter.sheetTexture) ? this.playerCharacter.sheetTexture : this.playerCharacter.portraitTexture,
      textureFacing: this.playerCharacter.nativeFacing,
      name: getCharacterName(this.playerCharacter, this.language),
      stats: this.playerCharacter.stats,
      visualScale: getCharacterVisualScale(this.playerCharacter),
      kickReach: getCharacterKickReach(this.playerCharacter),
      frameScales: this.playerCharacter.frameScales ?? null,
      character: this.playerCharacter,
    });
    this.rightPlayer = new Fighter(this, {
      id: this.opponent.id,
      side: 'right',
      x: 940,
      texture: this.textures.exists(this.opponent.sheetTexture) ? this.opponent.sheetTexture : this.opponent.portraitTexture,
      textureFacing: this.opponent.nativeFacing,
      name: getCharacterName(this.opponent, this.language),
      stats: this.opponent.stats,
      visualScale: getCharacterVisualScale(this.opponent),
      kickReach: getCharacterKickReach(this.opponent),
      frameScales: this.opponent.frameScales ?? null,
      character: this.opponent,
    });
    this.players = { left: this.leftPlayer, right: this.rightPlayer };
    this.ball = new Ball(this, GAME_WIDTH / 2, 336, this.profile.ballTypeId);
    this.previousBallPosition = { x: this.ball.body.x, y: this.ball.body.y };
    this.powerBall = createPowerBallState();
    this.fx = [];
    this.ballImpact = resolveBallImpactProfile(this.ball.type);
    this.sinceBallBounce = Infinity;
    this.lastBallImpact = null;
    this.fxGraphics = this.add.graphics().setDepth(42);
    // Glow, tapered streak and per-type particles for empowered balls.
    this.powerBallEffects = new PowerBallEffects(this);
    // Ground shadow: shows how high the ball is (headers, jumps, chilenas).
    this.ballShadow = new BallShadow(this, { groundY: GROUND_Y });

    this.score = createScoreState();
    this.phase = 'countdown';
    this.countdown = 2.7;
    this.lastCountdownSecond = 0;
    this.goalTimer = 0;
    this.bannerTimer = 0;
    this.meterFlash = { left: 0, right: 0 };
    this.lastBoostedStrike = null;
    this.lastLobStrike = null;
    this.lastChilenaStrike = null;
    this.goalScorer = null;
    this.lastInstantPower = null;
    this.sweptPlayerSaves = 0;
    this.clashTimer = 0;
    this.clashCooldown = 0;
    this.clashCount = 0;
    this.lastClashPoppedBall = false;
    this.goalFootPinTimers = { left: 0, right: 0 };
    this.fighterPerchTimers = { left: 0, right: 0 };
    this.fighterPerchSlide = { left: null, right: null };
    this.fighterPerchSlides = 0;
    this.lastFighterPerch = null;
    this.goalFootPinCooldown = 0;
    this.goalFootPinReleases = 0;
    this.lastGoalFootPinSide = null;
    this.lastGoalFootPinRelease = null;
    this.hudSignature = null;
    this.goalLatch = false;
    this.playersResettled = false;
    this.isPaused = false;
    this.pauseReason = null;
    this.helpOverlay = null;
    this.helpResumeOnClose = false;
    this.abandonConfirmation = null;
    this.abandonResumeOnCancel = false;
    this.abandonPreviousPauseReason = null;
    this.createHud();
    this.createOverlays();
    this.touchControls = new TouchControls(this, this.inputController);
    const useWidePhoneControls = this.isTouchLayout && this.stageLayout.width >= GAME_WIDTH + 24;
    const widePhoneCameraOffset = useWidePhoneControls
      ? (this.stageLayout.width - GAME_WIDTH) / 2
      : 0;
    this.helpButton = createIconButton(this, {
      // Unlike TouchControls, createIconButton follows the world camera. Add
      // one camera offset here so its visible edge gutter matches 16:9 too.
      x: useWidePhoneControls ? 1144 + widePhoneCameraOffset : this.isTouchLayout ? 1162 : 1228,
      y: 54,
      radius: useWidePhoneControls ? FOOTBALL_SYSTEM_CONTROL_RADIUS : 28,
      icon: 'help',
      accent: 0x52d7e8,
      depth: 94,
      // Solid backing on every touch layout: faint glass is lost over the sky.
      prominent: this.isTouchLayout,
      onPress: () => this.openHelp(),
    });
    this.bindEvents();
    this.bindKeyboard();
    this.matter.world.on('collisionstart', this.onCollisionStart, this);
    this.ball.freeze();
    this.updateHud();

    // Test and debug API: development builds only (audit I6).
    if (import.meta.env.DEV) {
      window.__SKYHEAD_DEBUG__ = {
        resumePlay: () => {
          this.phase = 'playing';
          this.isPaused = false;
          this.pauseReason = null;
          this.goalLatch = false;
          this.goalTimer = 0;
          this.releaseGoalCaptures();
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
          this.rightPlayer.placeOnGround(Phaser.Math.Clamp(x, 142, 1138));
          this.rightPlayer.setFacing(-1);
          this.rightPlayer.stunTimer = 0;
          this.rightPlayer.stunProtection = 0;
          this.rightPlayer.dashTimer = 0;
          this.rightPlayer.dashCooldown = 0;
          this.rightPlayer.dashDirection = 0;
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
          this.leftPlayer.placeOnGround(Phaser.Math.Clamp(x, 142, 1138));
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
          this.leftPlayer.dashTimer = 0;
          this.leftPlayer.dashCooldown = 0;
          this.leftPlayer.dashDirection = 0;
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
  }

  createPitchDetails() {
    const graphics = this.add.graphics().setDepth(2);
    const horizontalOffset = Math.max(0, this.stageLayout.width - GAME_WIDTH) / 2;
    graphics.fillStyle(0x0c2740, 0.15).fillRect(-horizontalOffset, 0, this.stageLayout.width, this.stageLayout.height);
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
    this.leftNameText = this.add.text(HUD_NAME_INSET.left, 42, getCharacterLabel(this.playerCharacter, this.language), this.hudTextStyle(21, Phaser.Display.Color.IntegerToColor(this.playerCharacter.accent).rgba)).setDepth(61);
    this.rightNameText = this.add.text(HUD_NAME_INSET.right, 42, getCharacterLabel(this.opponent, this.language), this.hudTextStyle(21, Phaser.Display.Color.IntegerToColor(this.opponent.accent).rgba)).setOrigin(1, 0).setDepth(61);
    this.scoreText = this.add.text(640, 33, '0  :  0', this.hudTextStyle(42, '#ffffff')).setOrigin(0.5, 0).setDepth(61);
    this.clockText = this.add.text(640, 85, '1:30', this.hudTextStyle(21, '#d8e7ff')).setOrigin(0.5).setDepth(61);
    this.suddenDeathText = this.add.text(640, 113, '', this.hudTextStyle(14, '#ffda55')).setOrigin(0.5).setDepth(61);
    this.meterGraphics = this.add.graphics().setDepth(61);
    // Equipped-power chip under the scoreboard; hidden when nothing is equipped.
    this.superPowerPill = this.add.rectangle(640, 145, 220, 34, 0x071426, 0.9)
      .setStrokeStyle(2, 0xffffff, 0.14)
      .setDepth(60);
    this.superPowerBadge = this.add.circle(0, 145, 13, 0xffffff, 1).setDepth(61);
    this.superPowerIcon = this.add.text(0, 145, '', this.hudTextStyle(14, '#071426')).setOrigin(0.5).setDepth(62);
    // Painted power icon (power-icon-<id>); the badge + glyph remain the fallback.
    this.superPowerImage = this.add.image(0, 145, '__DEFAULT').setDepth(62).setVisible(false);
    this.superPowerText = this.add.text(640, 145, '', this.hudTextStyle(15, '#d9ecff')).setOrigin(0, 0.5).setDepth(61);
    this.meterReadyGraphics = this.add.graphics().setDepth(61);
    this.announcementText = this.add.text(640, 238, '3', {
      ...this.hudTextStyle(82, '#ffffff'),
      stroke: '#10213e',
      strokeThickness: 12,
      shadow: { color: '#42d9ef', blur: 20, fill: true },
    }).setOrigin(0.5).setDepth(65);
  }

  /**
   * Name and charge on each side of the score. Long names (UNCLE JUANJO,
   * TÍO JUANJO) with a full charge used to run under the score: shrink to
   * fit the room left by the current score, then shorten the name, keeping
   * the charge readable.
   */
  fitHudNames(leftMeterValue, rightMeterValue) {
    const scoreHalfWidth = this.scoreText.width / 2;
    const gap = 16;
    this.fitHudName(this.leftNameText, {
      name: getCharacterLabel(this.playerCharacter, this.language),
      charge: `${leftMeterValue}%`,
      side: 'left',
      maxWidth: (this.scoreText.x - scoreHalfWidth - gap) - HUD_NAME_INSET.left,
    });
    this.fitHudName(this.rightNameText, {
      name: getCharacterLabel(this.opponent, this.language),
      charge: `${rightMeterValue}%`,
      side: 'right',
      maxWidth: HUD_NAME_INSET.right - (this.scoreText.x + scoreHalfWidth + gap),
    });
  }

  fitHudName(text, { name, charge, side, maxWidth }) {
    const compose = (label) => (side === 'left' ? `${label}  ${charge}` : `${charge}  ${label}`);
    text.setFontSize(HUD_NAME_FONT.base).setText(compose(name));
    if (text.width <= maxWidth) return;
    text.setFontSize(fitTextSize({
      measuredWidth: text.width,
      maxWidth,
      baseSize: HUD_NAME_FONT.base,
      minSize: HUD_NAME_FONT.minimum,
    }));
    // Still too wide: drop the title first (UNCLE JUANJO -> JUANJO keeps it
    // distinct from UNCLE JUAN), then shorten with an ellipsis.
    const shortName = name.includes(' ') ? name.slice(name.indexOf(' ') + 1) : name;
    if (text.width > maxWidth && shortName !== name) text.setText(compose(shortName));
    for (let length = shortName.length - 1; text.width > maxWidth && length > 1; length -= 1) {
      text.setText(compose(`${shortName.slice(0, length).trimEnd()}…`));
    }
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
    const compactPhoneUi = usesCompactPhoneUi(this);
    const pauseShade = this.add.rectangle(0, 0, GAME_WIDTH, this.stageLayout.height, 0x050914, 0.65).setOrigin(0).setInteractive();
    const pausePanel = this.add.rectangle(640, 352, 620, 390, 0x0d1b34, 0.96).setStrokeStyle(3, 0x8fefff, 0.42);
    const pauseTitle = this.add.text(640, 230, t(this.language, 'match.paused'), this.hudTextStyle(54, '#ffffff')).setOrigin(0.5);
    const pauseCopy = this.add.text(640, 305, t(this.language, 'match.chooseOption'), {
      ...this.hudTextStyle(compactPhoneUi ? 27 : 21, '#bcd1eb'),
      align: 'center',
      lineSpacing: 9,
    }).setOrigin(0.5);
    this.pauseOverlay = this.add.container(0, 0, [pauseShade, pausePanel, pauseTitle, pauseCopy]).setDepth(100).setVisible(false);
    this.pauseMenuButtons = [
      createButton(this, { x: 640, y: 390, width: 280, height: 62, label: t(this.language, 'match.resume'), color: 0x2a9eb5, onPress: () => this.togglePause() }),
      createButton(this, { x: 505, y: 475, width: 230, height: 54, label: t(this.language, 'match.restart'), color: 0x705cff, onPress: () => this.requestRestart() }),
      createButton(this, { x: 775, y: 475, width: 230, height: 54, label: t(this.language, 'match.abandon'), color: 0xa34457, onPress: () => this.abandonMatch() }),
    ];
    this.pauseMenuButtons.forEach((button) => {
      [button.shadow, button.background, button.text, button.zone].forEach((item) => item.setDepth(101));
      button.setVisible(false);
    });

    const resultShade = this.add.rectangle(0, 0, GAME_WIDTH, this.stageLayout.height, 0x050914, 0.76).setOrigin(0).setInteractive();
    // Tall enough that MAIN MENU (and its shadow) clears the bottom border.
    const resultPanel = this.add.rectangle(640, 357, 610, 430, 0x0d1b34, 0.98).setStrokeStyle(4, 0xffdc63, 0.55);
    this.resultTitle = this.add.text(640, 225, t(this.language, 'match.characterWins', { name: getCharacterLabel(this.playerCharacter, this.language) }), this.hudTextStyle(54, '#ffffff')).setOrigin(0.5);
    this.resultScore = this.add.text(640, 300, '1  :  0', this.hudTextStyle(48, '#ffda55')).setOrigin(0.5);
    this.resultCopy = this.add.text(
      640,
      354,
      t(this.language, 'match.winCopy'),
      this.hudTextStyle(compactPhoneUi ? 26 : 19, '#bbcee6'),
    ).setOrigin(0.5);
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
      'fighter-step',
      'fighter-kick-boost-charged',
      'fighter-chilena',
      'fighter-shield-block',
    ].forEach((eventName) => this.events.off(eventName));
    this.events.on('fighter-jump', () => arcadeAudio.jump());
    this.events.on('fighter-power-armed', (fighter) => this.showPowerArmed(fighter));
    this.events.on('fighter-power-denied', (fighter) => this.showPowerDenied(fighter));
    this.events.on('fighter-dash', (fighter) => this.spawnImpact(fighter.sprite.x - fighter.dashDirection * 26, fighter.sprite.y + 58, 0xb79aff, 8));
    this.events.on('fighter-step', (fighter) => this.spawnImpact(
      fighter.sprite.x - fighter.facing * 18,
      GROUND_Y - 5,
      0xd8f5dd,
      2,
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
        this.profile = playerProfileStore.get();
        fighter.powerArmed = 0;
        fighter.meter = 0;
        if (consumedPowerId === 'ice') this.rightPlayer.applyFreeze(0, equipped.durationSeconds);
        if (consumedPowerId === 'shield') fighter.grantShield(equipped.durationSeconds);
        if (consumedPowerId === 'hyper') fighter.activateHyper(equipped.durationSeconds);
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
        arcadeAudio.powerUp();
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
      if (this.helpOverlay) {
        this.closeHelp();
        return;
      }
      if (this.abandonConfirmation) {
        this.closeAbandonConfirmation();
        return;
      }
      if (this.phase === 'result') this.leaveMatch();
      else this.togglePause();
    };
    this.onMenuKey = () => {
      if (this.isPaused) this.abandonMatch();
    };
    // Same rule as the on-screen Restart: ask first during a match (owner
    // decision 2026-10-13); straight to the rematch on the result screen.
    this.onRestartKey = (event) => {
      if (event?.repeat) return;
      this.requestRestart();
    };
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
    if (this.helpOverlay) {
      this.closeHelp();
      return;
    }
    if (this.abandonConfirmation) {
      this.closeAbandonConfirmation();
      return;
    }
    this.setPaused(!this.isPaused);
  }

  setPaused(paused, { playSound = true, reason = 'manual' } = {}) {
    if (this.phase === 'result') return;
    this.isPaused = Boolean(paused);
    this.pauseReason = this.isPaused ? reason : null;
    this.pauseOverlay.setVisible(this.isPaused);
    this.touchControls.setGameplayVisible(!this.isPaused);
    this.setPauseMenuButtonsVisible(this.isPaused);
    if (this.isPaused) this.matter.world.pause();
    else this.matter.world.resume();
    if (playSound) arcadeAudio.click();
  }

  handlePlatformActiveChange(isActive) {
    this.inputController?.neutralize();
    this.accumulator = 0;
    if (!isActive && this.helpOverlay && this.phase !== 'result') {
      this.helpResumeOnClose = false;
      this.isPaused = true;
      this.pauseReason = 'lifecycle';
      this.matter.world.pause();
      return;
    }
    if (!isActive && this.abandonConfirmation && this.phase !== 'result') {
      this.abandonResumeOnCancel = false;
      this.abandonPreviousPauseReason = 'lifecycle';
      this.isPaused = true;
      this.pauseReason = 'lifecycle';
      this.matter.world.pause();
      return;
    }
    if (!isActive && this.phase !== 'result' && !this.isPaused) {
      this.setPaused(true, { playSound: false, reason: 'lifecycle' });
    }
  }

  handlePlatformBack() {
    this.inputController?.neutralize();
    if (this.helpOverlay) {
      this.closeHelp();
      return true;
    }
    if (this.abandonConfirmation) {
      this.closeAbandonConfirmation();
      return true;
    }
    if (this.phase === 'result') this.leaveMatch();
    else this.togglePause();
    return true;
  }

  async openHelp() {
    if (this.helpOverlay || this.helpOverlayLoading || this.abandonConfirmation) return;
    this.helpOverlayLoading = true;
    this.inputController?.neutralize();
    this.helpResumeOnClose = this.phase !== 'result' && !this.isPaused;
    if (this.helpResumeOnClose) {
      this.isPaused = true;
      this.pauseReason = 'help';
      this.matter.world.pause();
    }
    this.pauseOverlay.setVisible(false);
    this.setPauseMenuButtonsVisible(false);
    this.touchControls.setVisible(false);
    this.helpButton.setVisible(false);
    const overlayFactory = usesCompactPhoneUi(this)
      ? (await import('../compact/createCompactInfoOverlay.js')).createCompactInfoOverlay
      : createInfoOverlay;
    if (!this.sys.isActive()) {
      this.helpOverlayLoading = false;
      return;
    }
    this.helpOverlay = overlayFactory(this, {
      kind: 'help',
      gameId: 'football',
      language: this.language,
      inputMode: this.isTouchLayout ? 'touch' : 'keyboard',
      onClose: () => this.closeHelp(),
    });
    this.helpOverlayLoading = false;
    arcadeAudio.click();
  }

  closeHelp() {
    if (!this.helpOverlay) return false;
    this.helpOverlay.destroy();
    this.helpOverlay = null;
    this.helpButton.setVisible(true);
    this.touchControls.setVisible(true);
    if (this.helpResumeOnClose) {
      this.isPaused = false;
      this.pauseReason = null;
      this.matter.world.resume();
    }
    this.helpResumeOnClose = false;
    const showPauseMenu = this.isPaused && this.phase !== 'result';
    this.pauseOverlay.setVisible(showPauseMenu);
    this.setPauseMenuButtonsVisible(showPauseMenu);
    this.touchControls.setGameplayVisible(!this.isPaused && this.phase !== 'result');
    arcadeAudio.click();
    return true;
  }

  setPauseMenuButtonsVisible(visible) {
    this.pauseMenuButtons?.forEach((button) => button.setVisible(visible));
  }

  abandonMatch() {
    if (this.phase === 'result') {
      this.leaveMatch();
      return;
    }
    this.openMatchConfirmation('abandon');
  }

  // The on-screen Restart (touch bar and pause menu) asks first, like Home:
  // one stray tap must not throw away a match in progress.
  requestRestart() {
    if (this.phase === 'result') {
      this.scene.restart();
      return;
    }
    this.openMatchConfirmation('restart');
  }

  openMatchConfirmation(action) {
    if (this.abandonConfirmation) return;
    this.inputController?.neutralize();
    this.abandonResumeOnCancel = !this.isPaused;
    this.abandonPreviousPauseReason = this.pauseReason;
    if (this.abandonResumeOnCancel) {
      this.isPaused = true;
      this.pauseReason = 'abandon-confirm';
      this.matter.world.pause();
    }
    this.pauseOverlay.setVisible(false);
    this.setPauseMenuButtonsVisible(false);
    this.touchControls.setVisible(false);
    this.helpButton.setVisible(false);
    const restart = action === 'restart';
    this.abandonConfirmation = createConfirmationOverlay(this, {
      title: t(this.language, restart ? 'match.restartConfirmTitle' : 'match.abandonConfirmTitle'),
      message: t(this.language, 'match.abandonConfirmCopy'),
      cancelLabel: t(this.language, 'match.abandonStay'),
      confirmLabel: t(this.language, restart ? 'match.restart' : 'match.abandonLeave'),
      onCancel: () => this.closeAbandonConfirmation(),
      onConfirm: () => (restart ? this.confirmRestart() : this.leaveMatch()),
    });
    this.abandonConfirmation.kind = restart ? 'restart-confirm' : 'abandon-confirm';
    arcadeAudio.click();
  }

  closeAbandonConfirmation() {
    if (!this.abandonConfirmation) return false;
    this.abandonConfirmation.destroy();
    this.abandonConfirmation = null;
    this.helpButton.setVisible(true);
    this.touchControls.setVisible(true);
    if (this.abandonResumeOnCancel) {
      this.isPaused = false;
      this.pauseReason = null;
      this.matter.world.resume();
    } else {
      this.pauseReason = this.abandonPreviousPauseReason;
    }
    this.abandonResumeOnCancel = false;
    this.abandonPreviousPauseReason = null;
    const showPauseMenu = this.isPaused && this.phase !== 'result';
    this.pauseOverlay.setVisible(showPauseMenu);
    this.setPauseMenuButtonsVisible(showPauseMenu);
    this.touchControls.setGameplayVisible(!this.isPaused && this.phase !== 'result');
    arcadeAudio.click();
    return true;
  }

  confirmRestart() {
    this.abandonConfirmation?.destroy();
    this.abandonConfirmation = null;
    this.isPaused = false;
    this.pauseReason = null;
    arcadeAudio.click();
    this.scene.restart();
  }

  leaveMatch() {
    this.abandonConfirmation?.destroy();
    this.abandonConfirmation = null;
    this.isPaused = false;
    this.pauseReason = null;
    arcadeAudio.click();
    this.scene.start('Intro');
  }

  update(_time, deltaMilliseconds) {
    const dt = clampSimulationFrameDelta(deltaMilliseconds);
    this.accumulator += dt;
    while (this.accumulator >= FIXED_STEP) {
      this.stepGame(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
    this.updateVisuals(dt);
    if (this.phase === 'result') {
      // Physics is paused on the result screen; only the winner's loop plays.
      for (const fighter of [this.leftPlayer, this.rightPlayer]) {
        if (fighter.celebrating) fighter.updatePose(dt);
      }
    }
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
      this.stepGoals(dt);
      if (!this.playersResettled && this.goalTimer <= GOAL_RESETTLE_AT_SECONDS) {
        // Let the goal flash land, then walk both players back to kickoff so
        // they are not frozen mid-action through the wait and the countdown.
        this.playersResettled = true;
        this.leftPlayer.reset(340, { preservePowerEffects: true });
        this.rightPlayer.reset(940, { preservePowerEffects: true });
        // The scorer keeps celebrating at the kickoff spot until the countdown.
        this.goalScorer?.setCelebrating(true);
      }
      this.leftPlayer.continueChilenaAnimation(dt);
      this.rightPlayer.continueChilenaAnimation(dt);
      // Standing players leave their frozen action pose: the scorer plays the
      // celebrate loop (layouts that author one), everyone else idles.
      for (const fighter of [this.leftPlayer, this.rightPlayer]) {
        if (!fighter.chilenaActive) fighter.updatePose(dt);
      }
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
        : applyAiDifficulty(proposedIntent, this.profile.difficultyByGame.football);
      this.lastAiAdvancedIntent = {
        dashDirection: this.currentIntents.right.dashDirection,
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
    this.handleGoalFootPin(dt);
    this.handleFighterPerch(dt);
    this.handleStrikes();
    this.handleSweptPowerContact();
    const clashResolved = this.handlePlayerClash(dt);
    if (!clashResolved) this.handleCombat();
    this.ball.applyMaterialForces();
    this.ball.clampVelocity(this.powerBall.active ? (this.powerBall.counterFlash > 0 ? 46 : 29) : undefined);
    this.ball.releaseGoalPerch(dt);
    this.updatePowerBall(dt);
    this.updateEffects(dt);
    this.score = tickMatchClock(this.score, dt);
    if (this.score.winner) {
      this.showResult();
      return;
    }
    this.stepGoals(dt);
    this.checkGoal();
  }

  handleStrikes() {
    for (const fighter of [this.leftPlayer, this.rightPlayer]) {
      const opponent = fighter.side === 'left' ? this.rightPlayer : this.leftPlayer;
      const chilenaStrike = fighter.attemptChilena(this.ball);
      if (chilenaStrike) {
        this.activateChilenaStrike(fighter, chilenaStrike);
        continue;
      }
      // A failed chilena eligibility check must not consume the button press.
      // Restart the real kick/contact cycle immediately, even if its previous
      // animation or cooldown is still active.
      fighter.restartPendingShot();
      const incomingPowerVelocity = this.powerBall.active && this.powerBall.owner !== fighter.side
        ? { ...this.ball.body.body.velocity }
        : null;
      const strike = fighter.attemptBallStrike(this.ball, opponent);
      if (!strike) continue;
      if (strike.shotType === 'lob') {
        this.lastLobStrike = {
          side: fighter.side,
          opponentX: opponent.sprite.x,
          opponentDistance: round(strike.opponentDistance),
          targetX: strike.targetX,
          predictedApexY: round(strike.predictedApexY),
          predictedClearance: round(strike.predictedClearance),
          vx: round(this.ball.body.body.velocity.x),
          vy: round(this.ball.body.body.velocity.y),
        };
      }
      arcadeAudio.kick(strike.powered);
      this.playBallImpact('kick', strike.powered ? 1 : 0.7);
      if (strike.powered) arcadeAudio.powerUp();
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
              this.profile = playerProfileStore.get();
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

  handleSweptPowerContact() {
    if (!this.powerBall.active || !this.previousBallPosition) return false;
    const defender = this.powerBall.owner === 'left' ? this.rightPlayer : this.leftPlayer;
    const current = { x: this.ball.body.x, y: this.ball.body.y };
    const hit = sweepCircleAgainstBounds({
      previous: this.previousBallPosition,
      current,
      radius: this.ball.snapshot().radius,
      bounds: defender.sprite.body.bounds,
    });
    if (!hit) return false;
    const velocity = { ...this.ball.body.body.velocity };
    const approachingSpeed = velocity.x * hit.normal.x + velocity.y * hit.normal.y;
    if (approachingSpeed >= 0) return false;

    this.ball.body.setPosition(hit.x + hit.normal.x * 0.8, hit.y + hit.normal.y * 0.8);
    this.sweptPlayerSaves += 1;
    if (defender.isKickContactActive()) {
      this.counterPower(defender, velocity);
      return true;
    }

    const restitution = 0.58;
    this.ball.body.setVelocity(
      velocity.x - (1 + restitution) * approachingSpeed * hit.normal.x,
      velocity.y - (1 + restitution) * approachingSpeed * hit.normal.y,
    );
    defender.onBallContact(true);
    this.spawnImpact(hit.x, hit.y, defender.side === 'left' ? 0x78f5ff : 0xffa062, 10);
    arcadeAudio.impact();
    return true;
  }

  handlePlayerClash(dt) {
    this.clashCooldown = Math.max(0, this.clashCooldown - dt);
    const left = this.leftPlayer.snapshot();
    const right = this.rightPlayer.snapshot();
    const clashing = shouldResolvePlayerClash({
      left,
      right,
      intents: this.currentIntents,
    });
    this.clashTimer = clashing ? this.clashTimer + dt : Math.max(0, this.clashTimer - dt * 2);
    const simultaneousKicks = left.kickTimer > 0 && right.kickTimer > 0;
    const threshold = simultaneousKicks ? 0.05 : 0.2;
    if (!clashing || this.clashCooldown > 0 || this.clashTimer < threshold) return false;

    const leftIsLeft = this.leftPlayer.sprite.x <= this.rightPlayer.sprite.x;
    const leftDirection = leftIsLeft ? -1 : 1;
    this.leftPlayer.sprite.setVelocityX(leftDirection * 4.2);
    this.rightPlayer.sprite.setVelocityX(-leftDirection * 4.2);
    this.leftPlayer.kickTimer = 0;
    this.rightPlayer.kickTimer = 0;
    this.leftPlayer.kickCooldown = Math.max(this.leftPlayer.kickCooldown, 0.3);
    this.rightPlayer.kickCooldown = Math.max(this.rightPlayer.kickCooldown, 0.3);

    const minX = Math.min(this.leftPlayer.sprite.x, this.rightPlayer.sprite.x) - 10;
    const maxX = Math.max(this.leftPlayer.sprite.x, this.rightPlayer.sprite.x) + 10;
    const ballVelocity = this.ball.body.body.velocity;
    const trappedBall = !this.powerBall.active
      && this.ball.body.x >= minX
      && this.ball.body.x <= maxX
      && this.ball.body.y > Math.min(this.leftPlayer.sprite.y, this.rightPlayer.sprite.y) - 35
      && Math.hypot(ballVelocity.x, ballVelocity.y) < 12;
    if (trappedBall) {
      const midpoint = (this.leftPlayer.sprite.x + this.rightPlayer.sprite.x) / 2;
      const horizontal = Math.sign(this.ball.body.x - midpoint) || (this.clashCount % 2 === 0 ? 1 : -1);
      this.ball.body.setVelocity(horizontal * 3.4, -9.4);
    }
    this.lastClashPoppedBall = trappedBall;
    this.clashCount += 1;
    this.clashTimer = 0;
    this.clashCooldown = 0.48;
    this.spawnImpact(
      (this.leftPlayer.sprite.x + this.rightPlayer.sprite.x) / 2,
      (this.leftPlayer.sprite.y + this.rightPlayer.sprite.y) / 2 + 20,
      0xffdc72,
      14,
    );
    this.game.events.emit('platform:haptic', 'medium');
    return true;
  }

  // Round heads let a fighter balance on the other's head (playtest: up to
  // 4 s with the sprites overlapping). After a brief grace, slide the top
  // fighter off toward open pitch; its own movement resumes once it is clear.
  handleFighterPerch(dt) {
    for (const [top, bottom] of [
      [this.leftPlayer, this.rightPlayer],
      [this.rightPlayer, this.leftPlayer],
    ]) {
      const topBody = top.sprite.body;
      const bottomBody = bottom.sprite.body;
      const direction = resolveFighterPerch({
        top: { x: top.sprite.x, vx: topBody.velocity.x, vy: topBody.velocity.y, grounded: top.grounded },
        bottom: { x: bottom.sprite.x },
        topBounds: topBody.bounds,
        bottomBounds: bottomBody.bounds,
        // Matter reports resting contact only with some penetration; feet
        // flush with the head top (also held by a crossbar) count as well.
        touching: Math.abs(topBody.bounds.max.y - bottomBody.bounds.min.y) <= 4
          || Phaser.Physics.Matter.Matter.Query.collides(topBody, [bottomBody]).length > 0,
      });
      this.fighterPerchTimers[top.side] = direction ? this.fighterPerchTimers[top.side] + dt : 0;
      if (direction && this.fighterPerchTimers[top.side] >= 0.05 && !this.fighterPerchSlide[top.side]) {
        // Commit to the slide until the fighter lands (capped at a second):
        // held input toward the rival would otherwise climb straight back on.
        this.fighterPerchSlide[top.side] = { direction, seconds: 1 };
        this.fighterPerchSlides += 1;
        this.lastFighterPerch = { side: top.side, direction };
      }
      const slide = this.fighterPerchSlide[top.side];
      if (!slide) continue;
      slide.seconds -= dt;
      if (slide.seconds <= 0 || top.grounded) {
        this.fighterPerchSlide[top.side] = null;
        continue;
      }
      top.sprite.setVelocityX(slide.direction * PERCH_SLIDE_SPEED);
    }
  }

  handleGoalFootPin(dt) {
    this.goalFootPinCooldown = Math.max(0, this.goalFootPinCooldown - dt);
    const ball = this.ball.snapshot();
    let released = false;
    for (const [side, defender, attacker] of [
      ['left', this.leftPlayer, this.rightPlayer],
      ['right', this.rightPlayer, this.leftPlayer],
    ]) {
      const attackerIntent = this.currentIntents[attacker.side] ?? {};
      const defenderBounds = defender.sprite.body.bounds;
      const candidate = isGoalFootPinCandidate({
        defender: defender.snapshot(),
        attacker: attacker.snapshot(),
        ball,
        defenderBounds,
        defenderSide: side,
        attackerIntent,
        groundY: GROUND_Y,
      });
      this.goalFootPinTimers[side] = candidate
        ? this.goalFootPinTimers[side] + dt
        : Math.max(0, this.goalFootPinTimers[side] - dt * 3);
      if (!candidate || this.goalFootPinCooldown > 0 || this.goalFootPinTimers[side] < 0.16) continue;

      const pitchDirection = side === 'left' ? 1 : -1;
      const releaseX = pitchDirection > 0
        ? defenderBounds.max.x + ball.radius + 3
        : defenderBounds.min.x - ball.radius - 3;
      attacker.sprite.setPosition(attacker.sprite.x + pitchDirection * 18, attacker.sprite.y);
      const releaseY = Math.min(
        defenderBounds.min.y,
        attacker.sprite.body.bounds.min.y,
      ) - ball.radius - 4;
      attacker.sprite.setVelocityX(pitchDirection * 5.2);
      defender.sprite.setVelocity(pitchDirection * 2.2, -3.4);
      // A horizontal nudge alone can rebound off the same two bodies and head
      // into the trapped player's goal. Pop above the collision sandwich first
      // so the ball has a clean, goal-safe route back toward the pitch.
      this.ball.body.setPosition(releaseX, releaseY);
      this.ball.body.setVelocity(pitchDirection * 8.6, -5.8);
      this.ball.body.setAngularVelocity(pitchDirection * 0.14);
      this.previousBallPosition = { x: releaseX, y: releaseY };
      this.lastGoalFootPinRelease = {
        side,
        ballVx: pitchDirection * 8.6,
        ballVy: -5.8,
        attackerVx: pitchDirection * 5.2,
        releaseX,
        releaseY,
      };
      this.goalFootPinTimers[side] = 0;
      this.goalFootPinCooldown = 0.65;
      this.goalFootPinReleases += 1;
      this.lastGoalFootPinSide = side;
      this.spawnImpact(this.ball.body.x, this.ball.body.y, 0xffd45a, 12);
      released = true;
      break;
    }
    return released;
  }

  activateChilenaStrike(fighter, strike) {
    this.powerBall = createPowerBallState({
      active: true,
      owner: fighter.side,
      ttl: PLAYER_TUNING.powerDuration,
      counterFlash: 0.32,
      color: strike.color,
      superpowerId: strike.shotType,
      trajectory: strike.trajectory,
    });
    this.powerBallEffects.clear();
    this.lastChilenaStrike = {
      side: fighter.side,
      variant: strike.chilenaVariant,
      meterAfter: strike.meterAfter,
      fireColor: strike.color,
    };
    const announcementKey = strike.chilenaVariant === 'lob' ? 'match.lobChilena' : 'match.chilena';
    this.announcementText.setText(t(this.language, announcementKey)).setColor('#ffb14d').setFontSize(70);
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
      // Record the boost impulse at the event boundary. Reading the live ball
      // later can instead observe an ensuing player/goal collision, especially
      // after deliberately slow 30 ms touch-test pulses.
      vx: round(this.ball.body.body.velocity.x),
      vy: round(this.ball.body.body.velocity.y),
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
      const dashDirection = attacker.dashDirection || attacker.facing;
      const attackerBounds = attacker.sprite.body.bounds;
      const defenderBounds = defender.sprite.body.bounds;
      const dashHit = attacker.dashTimer > 0 && directionalDashContact({
        attacker: {
          x: attacker.sprite.x,
          y: attacker.sprite.y,
          width: attackerBounds.max.x - attackerBounds.min.x,
          height: attackerBounds.max.y - attackerBounds.min.y,
        },
        defender: {
          x: defender.sprite.x,
          y: defender.sprite.y,
          width: defenderBounds.max.x - defenderBounds.min.x,
          height: defenderBounds.max.y - defenderBounds.min.y,
        },
        direction: dashDirection,
      });
      if (attacker.canHitOpponent(defender) || dashHit) {
        const shieldWasActive = defender.shieldTimer > 0;
        if (defender.applyStun(dashDirection, dashHit)) {
          attacker.markCombatHit();
          arcadeAudio.impact();
          this.spawnImpact(defender.sprite.x, defender.sprite.y - 24, 0xffe271, dashHit ? 12 : 8);
          this.cameras.main.shake(90, 0.004);
        } else if (shieldWasActive) {
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
      // The effects fade out on their own once the power ends.
      this.powerBall = createPowerBallState();
      return;
    }
    const trajectory = this.powerBall.trajectory;
    if (trajectory?.type === 'lob-chilena' && trajectory.phase === 'rising' && shouldRedirectLobChilena({
      ballY: this.ball.body.y,
      velocityY: this.ball.body.body.velocity.y,
      apexY: trajectory.apexY,
    })) {
      const redirected = resolveChilenaShot({
        attackDirection: this.powerBall.owner === 'left' ? 1 : -1,
        ballX: this.ball.body.x,
        ballY: this.ball.body.y,
        targetX: trajectory.targetX,
        targetY: trajectory.targetY,
      });
      this.ball.body.setVelocity(redirected.vx, redirected.vy);
      this.ball.body.setAngularVelocity(redirected.spin);
      this.powerBall.trajectory = {
        ...trajectory,
        phase: 'goalward',
        redirectedX: this.ball.body.x,
        redirectedY: this.ball.body.y,
      };
      this.powerBall.effectTriggered = true;
      this.spawnImpact(this.ball.body.x, this.ball.body.y, this.powerBall.color, 22);
      this.cameras.main.shake(110, 0.005);
    }
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
    this.powerBallEffects.clear();
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
      this.ball.onSurfaceCollision(otherLabel);
      const [fighterId, part] = otherLabel.split(':');
      const fighter = [this.leftPlayer, this.rightPlayer]
        .find((candidate) => candidate.id === fighterId) ?? null;
      if (!fighter) {
        if (otherLabel === 'pitch-ground') {
          const strength = ballBounceStrength({
            downwardSpeed: this.ball.body.body.velocity.y,
            sinceLastBounce: this.sinceBallBounce,
          });
          if (strength > 0) this.playBallImpact('bounce', strength);
        }
        if (otherLabel.includes('crossbar')) {
          this.spawnImpact(this.ball.body.x, this.ball.body.y, 0xc7f8ff, 5);
          arcadeAudio.impact();
          const velocity = this.ball.body.body.velocity;
          this.goals.find((goal) => otherLabel.startsWith(`${goal.side}-`))?.onCrossbarHit({
            x: this.ball.body.x,
            y: this.ball.body.y,
            speed: Math.hypot(velocity.x, velocity.y),
          });
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

  /** Goal nets: cloth, frame shudder, and the captured ball during a goal. */
  stepGoals(dt) {
    // The net only carries the ball through the goal phase; a capture that
    // outlives it (any path back to play) is released so it cannot pin the ball.
    if (this.phase !== 'goal' && this.goals.some((goal) => goal.captured)) this.releaseGoalCaptures();
    this.goals.forEach((goal) => {
      const captured = goal.update(dt);
      if (!captured) return;
      this.ball.body.setPosition(captured.x, captured.y);
      this.ball.body.setRotation(this.ball.body.rotation + captured.spin);
    });
  }

  releaseGoalCaptures() {
    this.goals.forEach((goal) => goal.endCapture());
    this.ball.body.setDepth(20);
  }

  checkGoal() {
    if (this.goalLatch) return;
    const current = { x: this.ball.body.x, y: this.ball.body.y };
    const scoringSide = detectGoalCrossing({
      previous: this.previousBallPosition,
      current,
      radius: this.ball.radius,
    });
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
    this.playersResettled = false;
    this.score = addGoal(this.score, scoringSide);
    this.phase = 'goal';
    this.goalScorer = scoringSide === 'left' ? this.leftPlayer : this.rightPlayer;
    this.goalScorer.setCelebrating(true);
    this.goalTimer = 1.65;
    // The ball body freezes (scoring and physics are settled), but its motion
    // carries on into the net, which catches and settles it during the goal phase.
    const entryVelocity = { ...this.ball.body.body.velocity };
    this.ball.freeze();
    const scoredGoal = this.goals[scoringSide === 'left' ? 1 : 0];
    scoredGoal.startCapture({
      x: this.ball.body.x,
      y: this.ball.body.y,
      vx: entryVelocity.x,
      vy: entryVelocity.y,
      radius: this.ball.radius,
    });
    // Between the netting (9) and the frame (10): the ball reads as inside the goal.
    this.ball.body.setDepth(9.5);
    this.announcementText.setText(t(this.language, 'match.goal')).setColor(scoringSide === 'left' ? '#7bf7ff' : '#ffbd79').setFontSize(82);
    this.spawnImpact(this.ball.body.x, this.ball.body.y, scoringSide === 'left' ? 0x63efff : 0xff7a43, 36);
    this.game.events.emit('platform:haptic', scoringSide === 'left' ? 'success' : 'heavy');
    arcadeAudio.goal(
      scoringSide === 'left' ? this.playerCharacter.id : this.opponent.id,
    );
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
    this.powerBallEffects.reset();
    this.meterFlash = { left: 0, right: 0 };
    this.lastBoostedStrike = null;
    this.lastLobStrike = null;
    this.lastChilenaStrike = null;
    this.inputController.resetAdvancedInput();
    this.leftPlayer.reset(340, { preservePowerEffects: true });
    this.rightPlayer.reset(940, { preservePowerEffects: true });
    this.releaseGoalCaptures();
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
    const winnerFighter = this.score.winner === 'left' ? this.leftPlayer : this.rightPlayer;
    this.leftPlayer.setCelebrating(winnerFighter === this.leftPlayer);
    this.rightPlayer.setCelebrating(winnerFighter === this.rightPlayer);
    arcadeAudio.whistle(3, { label: 'final' });
    this.isPaused = false;
    this.pauseReason = null;
    this.ball.freeze();
    this.cameras.main.resetFX();
    this.matter.world.pause();
    this.touchControls.setVisible(false);
    this.setPauseMenuButtonsVisible(false);
    const humanWon = this.score.winner === 'left';
    const winnerCharacter = humanWon ? this.playerCharacter : this.opponent;
    this.resultTitle
      .setText(t(this.language, 'match.characterWins', { name: getCharacterLabel(winnerCharacter, this.language) }))
      .setColor(Phaser.Display.Color.IntegerToColor(winnerCharacter.accent).rgba);
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

  /**
   * Per-ball impact feedback (audit F3): particles and a tone layer that depend
   * on the ball type. Bounces burst upward from the grass; kicks burst around
   * the ball.
   */
  playBallImpact(kind, strength = 1) {
    const profile = this.ballImpact;
    const bounce = kind === 'bounce';
    if (bounce) this.sinceBallBounce = 0;
    const { colors, count, speed, radius, gravity } = profile.particles;
    const total = Math.max(2, Math.round(count * (bounce ? strength : 0.6)));
    const x = this.ball.body.x;
    const y = bounce ? this.ball.body.y + this.ball.radius * 0.8 : this.ball.body.y;
    for (let index = 0; index < total; index += 1) {
      const angle = bounce
        ? Phaser.Math.FloatBetween(Math.PI * 1.08, Math.PI * 1.92)
        : Phaser.Math.FloatBetween(0, Math.PI * 2);
      const particleSpeed = speed * Phaser.Math.FloatBetween(0.45, 1) * (0.6 + strength * 0.4);
      this.fx.push({
        x: x + Phaser.Math.FloatBetween(-0.6, 0.6) * this.ball.radius,
        y,
        vx: Math.cos(angle) * particleSpeed,
        vy: Math.sin(angle) * particleSpeed,
        life: Phaser.Math.FloatBetween(0.28, 0.5),
        maxLife: 0.5,
        color: colors[index % colors.length],
        radius: radius * Phaser.Math.FloatBetween(1, 1.6),
        gravity,
      });
    }
    arcadeAudio.ballTone(bounce ? profile.bounceTone : profile.kickTone, strength);
    if (bounce && profile.shake > 0 && strength > 0.5) this.cameras.main.shake(120, profile.shake * strength);
    this.lastBallImpact = { kind, profile: profile.id, strength: round(strength, 2), particles: total };
  }

  updateEffects(dt) {
    this.sinceBallBounce += dt;
    this.fx.forEach((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += (particle.gravity ?? 420) * dt;
      particle.vx *= 0.985;
    });
    this.fx = this.fx.filter((particle) => particle.life > 0);
  }

  updateVisuals(dt) {
    this.updateHud();
    this.updateHudAccents();
    this.ballShadow.update({ x: this.ball.body.x, y: this.ball.body.y, radius: this.ball.radius });
    this.powerBallEffects.update(dt, {
      powerBall: this.powerBall,
      ballX: this.ball.body.x,
      ballY: this.ball.body.y,
      velocity: this.ball.body.body.velocity,
    });

    this.fxGraphics.clear();
    this.fx.forEach((particle) => {
      this.fxGraphics.fillStyle(particle.color, Math.min(1, particle.life / particle.maxLife));
      this.fxGraphics.fillCircle(particle.x, particle.y, particle.radius);
    });
  }

  updateHud(force = false) {
    if (!this.score || !this.leftPlayer) return;
    const leftMeterValue = Math.floor(this.leftPlayer.meter);
    const rightMeterValue = Math.floor(this.rightPlayer.meter);
    const profile = this.profile;
    const equipped = getSuperpower(profile.equippedPowerId);
    const equippedCount = equipped ? profile.powers[equipped.id] : 0;
    const signature = [
      this.score.left,
      this.score.right,
      Math.ceil(this.score.secondsLeft),
      this.score.suddenDeath,
      leftMeterValue,
      rightMeterValue,
      Math.ceil(this.meterFlash.left * 20),
      Math.ceil(this.meterFlash.right * 20),
      equipped?.id ?? '',
      equippedCount,
    ].join('|');
    if (!force && signature === this.hudSignature) return;
    this.hudSignature = signature;
    this.scoreText.setText(`${this.score.left}  :  ${this.score.right}`);
    this.clockText.setText(formatClock(this.score.secondsLeft, false));
    this.suddenDeathText.setText(this.score.suddenDeath ? t(this.language, 'match.goldenGoal') : '');
    const leftMeter = leftMeterValue / 100;
    const rightMeter = rightMeterValue / 100;
    // Chunkier meters (20 px) with a highlight stripe; gold when full (the
    // pulsing "ready" outline is drawn per frame in updateVisuals).
    const { y: meterY, height: meterHeight, width: meterWidth, leftX, rightX } = HUD_METER;
    const radius = meterHeight / 2;
    this.meterGraphics.clear();
    this.meterGraphics.fillStyle(0x0e1d33, 1)
      .fillRoundedRect(leftX, meterY, meterWidth, meterHeight, radius)
      .fillRoundedRect(rightX, meterY, meterWidth, meterHeight, radius);
    const drawFill = (x, width, color) => {
      if (width < 1) return;
      const r = Math.min(radius, width / 2);
      this.meterGraphics.fillStyle(color, 1).fillRoundedRect(x, meterY, width, meterHeight, r);
      this.meterGraphics.fillStyle(0xffffff, 0.28).fillRoundedRect(x + 3, meterY + 3, Math.max(0, width - 6), meterHeight * 0.3, r / 2);
    };
    drawFill(leftX, meterWidth * leftMeter, leftMeter >= 1 ? 0xffd94f : 0x41dced);
    drawFill(rightX + meterWidth * (1 - rightMeter), meterWidth * rightMeter, rightMeter >= 1 ? 0xffd94f : 0xff7b56);
    this.meterGraphics.lineStyle(2, 0xffffff, 0.3)
      .strokeRoundedRect(leftX, meterY, meterWidth, meterHeight, radius)
      .strokeRoundedRect(rightX, meterY, meterWidth, meterHeight, radius);
    if (this.meterFlash.left > 0) {
      this.meterGraphics.fillStyle(0xffef9b, Math.min(0.5, this.meterFlash.left * 1.4)).fillRoundedRect(leftX, meterY, meterWidth, meterHeight, radius);
      this.meterGraphics.lineStyle(3, 0xffdc62, 0.9).strokeRoundedRect(leftX, meterY, meterWidth, meterHeight, radius);
    }
    if (this.meterFlash.right > 0) {
      this.meterGraphics.fillStyle(0xffef9b, Math.min(0.5, this.meterFlash.right * 1.4)).fillRoundedRect(rightX, meterY, meterWidth, meterHeight, radius);
      this.meterGraphics.lineStyle(3, 0xffdc62, 0.9).strokeRoundedRect(rightX, meterY, meterWidth, meterHeight, radius);
    }
    this.fitHudNames(leftMeterValue, rightMeterValue);
    const showChip = Boolean(equipped) && equippedCount > 0;
    [this.superPowerPill, this.superPowerBadge, this.superPowerIcon, this.superPowerText]
      .forEach((item) => item.setVisible(showChip));
    this.superPowerImage.setVisible(false);
    if (showChip) {
      this.superPowerText
        .setText(t(this.language, 'match.powerReady', { power: t(this.language, equipped.nameKey), count: equippedCount }))
        .setColor(Phaser.Display.Color.IntegerToColor(equipped.color).rgba);
      const chipWidth = this.superPowerText.width + 58;
      const left = 640 - chipWidth / 2;
      this.superPowerPill.setSize(chipWidth, 34).setStrokeStyle(2, equipped.color, 0.7);
      this.superPowerPill.setPosition(640, 145);
      this.superPowerBadge.setPosition(left + 21, 145).setFillStyle(equipped.color, 1);
      this.superPowerIcon.setPosition(left + 21, 145).setText(equipped.icon);
      const iconKey = powerIconTextureKey(equipped.id);
      if (this.textures.exists(iconKey)) {
        this.superPowerImage.setTexture(iconKey).setDisplaySize(30, 30).setPosition(left + 21, 145).setVisible(true);
        this.superPowerBadge.setVisible(false);
        this.superPowerIcon.setVisible(false);
      }
      this.superPowerText.setPosition(left + 42, 145);
    }
  }

  /** Per-frame HUD accents: pulsing "ready" outlines on full meters and the docked power ring. */
  updateHudAccents() {
    if (!this.leftPlayer) return;
    const clock = this.time.now / 1000;
    const { y, height, width, leftX, rightX } = HUD_METER;
    const pulse = 0.45 + 0.45 * (0.5 + 0.5 * Math.sin(clock * 7));
    this.meterReadyGraphics.clear();
    if (this.leftPlayer.meter >= 100) {
      this.meterReadyGraphics.lineStyle(3, 0xfff1a8, pulse).strokeRoundedRect(leftX - 3, y - 3, width + 6, height + 6, height / 2 + 3);
    }
    if (this.rightPlayer.meter >= 100) {
      this.meterReadyGraphics.lineStyle(3, 0xfff1a8, pulse).strokeRoundedRect(rightX - 3, y - 3, width + 6, height + 6, height / 2 + 3);
    }
    this.touchControls?.setPowerMeter(this.leftPlayer.meter / 100, clock);
  }

  serializeStateString() {
    return JSON.stringify(this.serializeState());
  }

  serializeState() {
    const left = this.leftPlayer?.snapshot?.() ?? null;
    const right = this.rightPlayer?.snapshot?.() ?? null;
    const footballTouchMovementMode = this.touchControls?.movementMode
      ?? FOOTBALL_TOUCH_MOVEMENT_MODES.ARROWS;
    return {
      mode: this.isPaused ? 'paused' : this.phase,
      pauseReason: this.pauseReason,
      modal: this.helpOverlay?.kind ?? this.abandonConfirmation?.kind ?? null,
      coordinateSystem: `origin top-left; +x right; +y down; logical canvas ${this.stageLayout.width}x${this.stageLayout.height}; gameplay region 1280x720; ground y=636; goal lines x=126 and x=1154`,
      stageLayout: this.stageLayout,
      timer: {
        secondsLeft: round(this.score?.secondsLeft ?? 0),
        label: this.score ? formatClock(this.score.secondsLeft, this.score.suddenDeath) : '',
        suddenDeath: this.score?.suddenDeath ?? false,
      },
      score: { left: this.score?.left ?? 0, right: this.score?.right ?? 0, winner: this.score?.winner ?? null },
      ball: this.ball?.snapshot?.() ?? null,
      ballShadow: this.ballShadow?.debugState() ?? null,
      players: { left, right },
      hud: {
        leftName: this.leftNameText?.text ?? '',
        rightName: this.rightNameText?.text ?? '',
        announcement: this.announcementText?.text ?? '',
        announcementWidth: round(this.announcementText?.width ?? 0),
        announcementFontSize: Number.parseFloat(this.announcementText?.style?.fontSize ?? 0) || 0,
        powerChip: this.superPowerText?.visible ? this.superPowerText.text : null,
      },
      goalNets: this.goals
        ? { left: this.goals[0].debugState(), right: this.goals[1].debugState() }
        : null,
      powerBall: {
        active: this.powerBall?.active ?? false,
        owner: this.powerBall?.owner ?? null,
        ttl: round(this.powerBall?.ttl ?? 0),
        superpowerId: this.powerBall?.superpowerId ?? null,
        effectTriggered: this.powerBall?.effectTriggered ?? false,
        visuals: this.powerBallEffects?.debugState() ?? null,
        trajectory: this.powerBall?.trajectory ? {
          ...this.powerBall.trajectory,
          redirectedX: Number.isFinite(this.powerBall.trajectory.redirectedX)
            ? round(this.powerBall.trajectory.redirectedX)
            : null,
          redirectedY: Number.isFinite(this.powerBall.trajectory.redirectedY)
            ? round(this.powerBall.trajectory.redirectedY)
            : null,
        } : null,
        counterRule: 'kick or jumping head contact at impact',
      },
      language: this.language,
      difficulty: this.profile?.difficultyByGame?.football ?? 'normal',
      customization: {
        arenaThemeId: this.profile?.arenaThemeId ?? 'skycourt',
        ballTypeId: this.ball?.type?.id ?? 'classic',
      },
      ballImpact: {
        profile: this.ballImpact?.id ?? 'football',
        last: this.lastBallImpact,
      },
      playerCharacter: { id: this.playerCharacter.id, name: getCharacterName(this.playerCharacter, this.language) },
      opponent: { id: this.opponent.id, name: getCharacterName(this.opponent, this.language) },
      audio: arcadeAudio.diagnostics(),
      inventory: {
        equippedPowerId: this.profile?.equippedPowerId ?? null,
        equippedCount: this.profile?.equippedPowerId ? this.profile.powers[this.profile.equippedPowerId] : 0,
      },
      opponentProvider: this.opponentProvider?.id ?? 'unknown',
      aiAdvancedMechanicsEnabled: (this.profile?.difficultyByGame?.football ?? 'normal') !== 'easy',
      lastAiAdvancedIntent: this.lastAiAdvancedIntent,
      meterFlash: {
        left: round(this.meterFlash?.left ?? 0),
        right: round(this.meterFlash?.right ?? 0),
      },
      lastBoostedStrike: this.lastBoostedStrike,
      lastLobStrike: this.lastLobStrike,
      lastChilenaStrike: this.lastChilenaStrike,
      lastInstantPower: this.lastInstantPower,
      physicsPolish: {
        sweptPlayerSaves: this.sweptPlayerSaves,
        clashCount: this.clashCount,
        clashCooldown: round(this.clashCooldown),
        lastClashPoppedBall: this.lastClashPoppedBall,
        goalFootPinReleases: this.goalFootPinReleases,
        fighterPerchSlides: this.fighterPerchSlides,
        lastFighterPerch: this.lastFighterPerch,
        lastGoalFootPinRelease: this.lastGoalFootPinRelease
          ? { ...this.lastGoalFootPinRelease }
          : null,
        goalFootPinCooldown: round(this.goalFootPinCooldown),
        goalFootPinTimers: {
          left: round(this.goalFootPinTimers.left),
          right: round(this.goalFootPinTimers.right),
        },
        lastGoalFootPinSide: this.lastGoalFootPinSide,
      },
      touchControls: this.touchControls?.visible ?? false,
      touchControlVisuals: this.touchControls?.diagnostics?.() ?? {},
      footballTouchMovementMode,
      inputMode: this.isTouchLayout ? 'touch' : 'keyboard',
      inputDiagnostics: this.inputController?.diagnostics?.() ?? null,
      currentIntent: this.currentIntents,
      humanDashResolution: this.inputController?.lastDashResolution ?? { direction: 0, purpose: 'none' },
      controls: this.isTouchLayout ? {
        move: footballTouchMovementMode === FOOTBALL_TOUCH_MOVEMENT_MODES.JOYSTICK
          ? 'analog horizontal virtual joystick'
          : 'on-screen left/right arrows',
        dash: footballTouchMovementMode === FOOTBALL_TOUCH_MOVEMENT_MODES.JOYSTICK
          ? 'flick from the center to the joystick edge'
          : 'double-tap the left/right arrow',
        jump: 'on-screen up',
        kick: 'on-screen kick icon',
        lob: 'on-screen lob icon',
        kickBoost: 'repeat the kick or lob icon during the kick animation',
        chilena: 'double kick: direct; double lob: high arc',
        power: 'on-screen power icon at 100%',
        pause: 'on-screen pause',
        restart: 'on-screen restart',
        menu: 'on-screen menu',
        fullscreen: 'on-screen fullscreen',
      } : {
        move: 'A/D or Left/Right',
        dash: 'double-tap A/D or Left/Right',
        jump: 'W/Up/Space',
        kick: 'X/K',
        lob: 'Z/I or Up + Kick',
        kickBoost: 'repeat kick or lob during the kick animation',
        chilena: 'double kick: direct; double lob: high arc',
        power: 'V/J at 100%',
        pause: 'P/Escape',
        fullscreen: 'F',
      },
      pauseActions: ['resume', 'restart', 'abandon match'],
      confirmationActions: this.abandonConfirmation
        ? ['stay', this.abandonConfirmation.kind === 'restart-confirm' ? 'restart match' : 'leave match']
        : [],
    };
  }

  advanceForTesting(milliseconds) {
    const steps = Math.max(1, Math.round(milliseconds / (FIXED_STEP * 1000)));
    for (let index = 0; index < steps; index += 1) {
      this.stepGame(FIXED_STEP);
      if (!this.isPaused && this.phase !== 'result') this.matter.world.step(FIXED_STEP * 1000);
    }
    // Manual Matter stepping does not emit Phaser's POST_UPDATE event. Mirror
    // the production post-physics visual pin explicitly so deterministic
    // chilena captures cannot trail the body by one simulation tick.
    this.leftPlayer?.postPhysicsVisualSync?.();
    this.rightPlayer?.postPhysicsVisualSync?.();
    this.updateVisuals(milliseconds / 1000);
    this.game.renderer.preRender();
    this.sys.render(this.game.renderer);
    this.game.renderer.postRender();
  }
}
