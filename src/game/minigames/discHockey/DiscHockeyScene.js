import Phaser from 'phaser';
import { FIXED_STEP, GAME_HEIGHT, GAME_WIDTH } from '../../constants.js';
import {
  CHARACTERS,
  getCharacter,
  getCharacterName,
} from '../../content/characters.js';
import { t } from '../../i18n.js';
import { getSceneStageLayout } from '../../layout/tabletStage.js';
import { arcadeAudio } from '../../services/ArcadeAudio.js';
import { playerProfileStore } from '../../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../../stateBridge.js';
import { createButton } from '../../ui/createButton.js';
import { getDiscHockeyCollisionMap } from './discHockeyCollisionMaps.js';
import {
  DISC_HOCKEY_ARENA,
  DISC_HOCKEY_CRAZY_AI,
  DISC_HOCKEY_CRAZY_POWER,
  DISC_HOCKEY_CREASE_RULE,
  DISC_HOCKEY_MATCH_SECONDS,
  DISC_HOCKEY_PUCK_SURFACE,
  addDiscHockeyCrazyPower,
  chooseDiscHockeyCrazyTargets,
  chooseDiscHockeyAiTarget,
  clampDiscPlayerPosition,
  closestPointOnCollisionContour,
  createDiscHockeyCornerBankPuck,
  createDiscHockeyPoweredPuck,
  detectDiscHockeyGoal,
  evaluateDiscHockeyCrease,
  formatDiscHockeyTime,
  getDiscHockeyAiTuning,
  getDiscHockeyCrazyRoleMotion,
  getDiscHockeyEjectionVelocity,
  getDiscHockeyHumanMotion,
  getDiscHockeyImpactVolume,
  getDiscHockeyIntentionalHit,
  getDiscHockeyMatchResult,
  getDiscHockeyPoweredKnockback,
  isDiscHockeyDefensiveSave,
  moveDiscDirectlyTowardTarget,
  moveDiscTowardTarget,
  releaseDiscHockeyControl,
  resolveDiscHockeyGoalCharacterId,
  resolvePlayerPuckCollision,
  sanitizeDiscHockeyMode,
  sanitizeDiscHockeyTheme,
  selectDiscHockeyCrazyRoster,
  separateDiscHockeyPushers,
  shouldEndDiscHockeyPoweredShot,
  stepPuck,
} from './discHockeyRules.js';

const assetUrl = (filename) => (
  `${import.meta.env.BASE_URL}assets/minigames/disc-hockey/${filename}`
);
const THEME_ART = Object.freeze({
  ice: Object.freeze({
    texture: 'disc-hockey-arena-ice',
    asset: 'themes/ice-arena-v1.webp',
    pusherTexture: 'disc-hockey-pusher-ice',
    pusherAsset: 'equipment/pusher-ice-v1.webp',
    puckTexture: 'disc-hockey-puck-ice',
    puckAsset: 'equipment/puck-ice-v1.webp',
  }),
  neon: Object.freeze({
    texture: 'disc-hockey-arena-neon',
    asset: 'themes/neon-arena-v1.webp',
    pusherTexture: 'disc-hockey-pusher-neon',
    pusherAsset: 'equipment/pusher-neon-v1.webp',
    puckTexture: 'disc-hockey-puck-neon',
    puckAsset: 'equipment/puck-neon-v1.webp',
  }),
});

const PUSHER_SOURCE_SIZE = 256;
const PUSHER_ART_DIAMETER = 236;
const PUCK_ART_DIAMETER = 224;

const round = (value, places = 1) => {
  const factor = 10 ** places;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const setButtonDepth = (button, depth) => {
  button.shadow.setDepth(depth);
  button.background.setDepth(depth + 0.1);
  button.text.setDepth(depth + 0.2);
  button.zone.setDepth(depth + 0.3);
  return button;
};

const CRAZY_SPAWNS = Object.freeze([
  Object.freeze({ x: 735, y: DISC_HOCKEY_ARENA.centerY }),
  Object.freeze({ x: 865, y: 235 }),
  Object.freeze({ x: 930, y: 520 }),
  Object.freeze({ x: 1070, y: DISC_HOCKEY_ARENA.centerY }),
]);

const playerSpawn = (side, options = {}) => ({
  x: options.x ?? (side === 'left' ? 330 : 950),
  y: options.y ?? DISC_HOCKEY_ARENA.centerY,
  vx: 0,
  vy: 0,
  radius: DISC_HOCKEY_ARENA.playerRadius,
  side,
  target: null,
  pointerId: null,
  creaseSeconds: 0,
  penaltySeconds: 0,
  ejectionSeconds: 0,
  ejectionVx: 0,
  ejectionVy: 0,
  ejectionOriginY: DISC_HOCKEY_ARENA.centerY,
  crazyRole: options.crazyRole ?? null,
  cornerReleaseSeconds: 0,
  cornerReleaseCorner: null,
  knockbackSeconds: 0,
  knockbackVx: 0,
  knockbackVy: 0,
  lastPoweredHitSerial: 0,
});

const puckSpawn = () => ({
  x: DISC_HOCKEY_ARENA.centerX,
  y: DISC_HOCKEY_ARENA.centerY,
  vx: 0,
  vy: 0,
  radius: DISC_HOCKEY_ARENA.puckRadius,
  powered: false,
  powerSerial: 0,
});

export class DiscHockeyScene extends Phaser.Scene {
  constructor() {
    super('DiscHockey');
    this.accumulator = 0;
  }

  init(data = {}) {
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    this.playMode = sanitizeDiscHockeyMode(data.mode ?? this.profile.discHockey.mode);
    this.isCrazyMode = this.playMode === 'crazy';
    this.themeId = sanitizeDiscHockeyTheme(data.themeId ?? this.profile.discHockey.themeId);
    this.collisionMap = getDiscHockeyCollisionMap(this.themeId);
    this.difficulty = this.isCrazyMode
      ? 'hard'
      : this.profile.difficultyByGame.discHockey;
    this.leftCharacter = getCharacter(this.profile.playerCharacterId);
    this.rightCharacters = this.isCrazyMode
      ? selectDiscHockeyCrazyRoster({
        candidateIds: CHARACTERS.map(({ id }) => id),
        playerId: this.leftCharacter.id,
        randomSamples: Array.from({ length: 4 }, () => Phaser.Math.RND.frac()),
      }).map((id) => getCharacter(id))
      : [getCharacter(this.profile.opponentId)];
    this.rightCharacter = this.rightCharacters[0];
    this.phase = 'loading';
    this.accumulator = 0;
    this.pointerOwners = new Map();
    this.puckRotation = 0;
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearActiveScene(this);
      this.unbindInput();
      delete window.__DISC_HOCKEY_DEBUG__;
    });
  }

  preload() {
    const themeArt = THEME_ART[this.themeId];
    [
      [themeArt.texture, themeArt.asset],
      [themeArt.pusherTexture, themeArt.pusherAsset],
      [themeArt.puckTexture, themeArt.puckAsset],
    ].forEach(([texture, asset]) => {
      if (!this.textures.exists(texture)) this.load.image(texture, assetUrl(asset));
    });
  }

  create() {
    this.stageLayout = getSceneStageLayout(this);
    this.simulationSeconds = 0;
    this.score = { left: 0, right: 0 };
    this.matchSecondsRemaining = DISC_HOCKEY_MATCH_SECONDS;
    this.leftPlayer = playerSpawn('left');
    this.rightPlayers = this.isCrazyMode
      ? CRAZY_SPAWNS.map((position, index) => playerSpawn('right', {
        ...position,
        crazyRole: ['striker', 'interceptor', 'defender', 'goalkeeper'][index],
      }))
      : [playerSpawn('right')];
    this.rightPlayer = this.rightPlayers[0];
    this.puck = puckSpawn();
    this.phase = 'countdown';
    this.countdown = 2.4;
    this.goalPause = 0;
    this.pendingWinner = null;
    this.isPaused = false;
    this.suspended = false;
    this.pauseReason = null;
    this.collisionSoundCooldown = 0;
    this.lastCollisionSound = null;
    this.lastPuckTouch = null;
    this.creaseViolations = { left: 0, right: 0 };
    this.lastCreaseViolation = null;
    this.creaseNoticeSeconds = 0;
    this.rightTeamCreaseSeconds = 0;
    this.aiThinkTimer = 0;
    this.aiTarget = { x: this.rightPlayer.x, y: this.rightPlayer.y };
    this.aiTargets = this.rightPlayers.map(({ x, y }) => ({ x, y }));
    this.crazyPower = {
      energy: 0,
      armed: false,
      contactCooldownSeconds: 0,
      rechargeDelaySeconds: 0,
      lastGain: null,
      lastDrain: null,
      shotSerial: 0,
    };
    this.touchPromptSeconds = 5;
    this.matter.world.setGravity(0, 0);
    this.game.registry.get('platformActions')?.lockLandscape?.();
    arcadeAudio.setScene('discHockey');

    this.createArena();
    this.createPlayerVisuals();
    this.createPuckVisual();
    this.createHud();
    this.createPauseOverlay();
    this.createResultOverlay();
    this.bindInput();
    this.resetRound();
    this.installDebugHelpers();
    this.updateHud();
    this.updateVisuals();
  }

  createArena() {
    const arena = DISC_HOCKEY_ARENA;
    const neon = this.themeId === 'neon';
    const themeArt = THEME_ART[this.themeId];
    this.cameras.main.setBackgroundColor(neon ? '#050b0f' : '#dceef3');
    this.arenaArtwork = this.add.image(
      GAME_WIDTH / 2,
      GAME_HEIGHT / 2,
      themeArt.texture,
    )
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
      .setDepth(-40);
    const background = this.add.graphics().setDepth(-30);
    background.fillStyle(neon ? 0x050b0f : 0x203d58, 0.93)
      .fillRect(0, 0, this.stageLayout.width, 70);
    if (this.stageLayout.height > GAME_HEIGHT) {
      background.fillStyle(neon ? 0x090f12 : 0x19334b, 1)
        .fillRect(0, GAME_HEIGHT, this.stageLayout.width, this.stageLayout.height - GAME_HEIGHT);
    }

    const rink = this.add.graphics().setDepth(-20);
    if (neon) {
      this.glowLine(rink, 0xffc928, [
        [
          'line',
          arena.centerX,
          this.collisionMap.bounds.top,
          arena.centerX,
          this.collisionMap.bounds.bottom,
        ],
        ['circle', arena.centerX, arena.centerY, 94],
      ], 0.8);
    } else {
      rink.lineStyle(5, 0x2c7eaf, 0.78).lineBetween(
        arena.centerX,
        this.collisionMap.bounds.top,
        arena.centerX,
        this.collisionMap.bounds.bottom,
      );
      rink.strokeCircle(arena.centerX, arena.centerY, 94);
    }

    this.add.circle(arena.centerX, arena.centerY, 8, neon ? 0xffc928 : 0xc72f2f, 1).setDepth(-18);
  }

  glowLine(graphics, color, shapes, alpha = 1) {
    [
      [18, 0.06 * alpha],
      [10, 0.12 * alpha],
      [5, 0.42 * alpha],
      [2, 0.98 * alpha],
    ].forEach(([width, lineAlpha]) => {
      graphics.lineStyle(width, color, lineAlpha);
      shapes.forEach(([kind, ...values]) => {
        if (kind === 'line') graphics.lineBetween(...values);
        if (kind === 'circle') graphics.strokeCircle(...values);
      });
    });
  }

  createPlayerVisuals() {
    this.leftVisual = this.createDiscVisual(this.leftPlayer, this.leftCharacter);
    this.rightVisuals = this.rightPlayers.map((player, index) => (
      this.createDiscVisual(player, this.rightCharacters[index] ?? this.rightCharacter)
    ));
    this.rightVisual = this.rightVisuals[0];
  }

  createDiscVisual(player, character) {
    const neon = this.themeId === 'neon';
    const shadow = this.add.circle(
      player.x + 2,
      player.y + 4,
      player.radius + 2,
      0x000000,
      neon ? 0.42 : 0.16,
    )
      .setDepth(3.1);
    const displaySize = player.radius * 2 * PUSHER_SOURCE_SIZE / PUSHER_ART_DIAMETER;
    const base = this.add.image(
      player.x,
      player.y,
      THEME_ART[this.themeId].pusherTexture,
    )
      .setDisplaySize(displaySize, displaySize)
      .setDepth(3.2);
    const engraving = this.add.image(
      player.x,
      player.y,
      this.createEngravingTexture(character, player.side),
    )
      .setDisplaySize(displaySize, displaySize)
      .setDepth(3.3);
    return { shadow, base, engraving, displaySize };
  }

  createEngravingTexture(character, side) {
    const key = `disc-hockey-engraving-${this.themeId}-${character.id}-${side}`;
    if (this.textures.exists(key)) return key;

    const texture = this.textures.createCanvas(key, PUSHER_SOURCE_SIZE, PUSHER_SOURCE_SIZE);
    const context = texture.getContext();
    const source = this.textures.get(character.portraitTexture).getSourceImage();
    const sourceWidth = source.naturalWidth || source.width;
    const sourceHeight = source.naturalHeight || source.height;
    const cropWidth = sourceWidth * 0.64;
    const cropHeight = sourceHeight * 0.66;
    const cropX = (sourceWidth - cropWidth) / 2;
    const destination = {
      x: 50,
      y: 45,
      width: 156,
      height: 174,
    };
    const shouldFlip = character.nativeFacing !== (side === 'left' ? 1 : -1);
    const neon = this.themeId === 'neon';

    const drawLayer = ({
      xOffset = 0,
      yOffset = 0,
      alpha,
      composite,
      filter,
    }) => {
      context.save();
      context.beginPath();
      context.arc(128, 128, 72, 0, Math.PI * 2);
      context.clip();
      context.globalAlpha = alpha;
      context.globalCompositeOperation = composite;
      context.filter = filter;
      if (shouldFlip) {
        context.translate(PUSHER_SOURCE_SIZE, 0);
        context.scale(-1, 1);
      }
      const mirroredX = shouldFlip
        ? PUSHER_SOURCE_SIZE - destination.x - destination.width
        : destination.x;
      context.drawImage(
        source,
        cropX,
        0,
        cropWidth,
        cropHeight,
        mirroredX + xOffset,
        destination.y + yOffset,
        destination.width,
        destination.height,
      );
      context.restore();
    };

    context.clearRect(0, 0, PUSHER_SOURCE_SIZE, PUSHER_SOURCE_SIZE);
    drawLayer({
      xOffset: 3,
      yOffset: 3,
      alpha: neon ? 0.72 : 0.58,
      composite: 'multiply',
      filter: 'grayscale(1) contrast(1.55) brightness(0.42)',
    });
    drawLayer({
      xOffset: -2,
      yOffset: -2,
      alpha: neon ? 0.55 : 0.42,
      composite: 'screen',
      filter: neon
        ? 'grayscale(1) sepia(1) saturate(2.4) brightness(1.45)'
        : 'grayscale(1) contrast(1.4) brightness(1.45)',
    });
    drawLayer({
      alpha: neon ? 0.32 : 0.48,
      composite: neon ? 'screen' : 'multiply',
      filter: neon
        ? 'grayscale(1) sepia(1) saturate(2) brightness(0.9)'
        : 'grayscale(1) contrast(1.5) brightness(0.72)',
    });
    texture.refresh();
    return key;
  }

  createPuckVisual() {
    const displaySize = this.puck.radius * 2 * PUSHER_SOURCE_SIZE / PUCK_ART_DIAMETER;
    this.puckBody = this.add.image(
      this.puck.x,
      this.puck.y,
      THEME_ART[this.themeId].puckTexture,
    )
      .setDisplaySize(displaySize, displaySize)
      .setDepth(4.1);
  }

  createHud() {
    const neon = this.themeId === 'neon';
    const scoreColor = neon ? '#ffcf35' : '#ffffff';
    this.leftNameText = this.add.text(260, 34, getCharacterName(this.leftCharacter, this.language).toUpperCase(), {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: '21px',
      color: scoreColor,
    }).setOrigin(0.5);
    this.rightNameText = this.add.text(1020, 34, (
      this.isCrazyMode
        ? t(this.language, 'discHockey.crazySquad')
        : getCharacterName(this.rightCharacter, this.language).toUpperCase()
    ), {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: '21px',
      color: scoreColor,
    }).setOrigin(0.5);
    this.scoreText = this.add.text(GAME_WIDTH / 2, 31, '0  —  0', {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: '38px',
      color: '#ffffff',
      stroke: neon ? '#8c2416' : '#102438',
      strokeThickness: 6,
    }).setOrigin(0.5);
    this.clockText = this.add.text(
      GAME_WIDTH / 2,
      59,
      formatDiscHockeyTime(this.matchSecondsRemaining),
      {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: neon ? '#ffcf35' : '#a9cfe0',
      },
    ).setOrigin(0.5);
    this.pauseButton = setButtonDepth(createButton(this, {
      x: 67,
      y: 35,
      width: 92,
      height: 42,
      label: t(this.language, 'discHockey.pause'),
      color: neon ? 0x8a2819 : 0x235976,
      onPress: () => this.pauseGame('manual'),
    }), 30);
    this.announcementText = this.add.text(GAME_WIDTH / 2, DISC_HOCKEY_ARENA.centerY, '', {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: '70px',
      color: neon ? '#ffcf35' : '#173d5b',
      stroke: neon ? '#a22616' : '#ffffff',
      strokeThickness: 10,
      align: 'center',
    }).setOrigin(0.5).setDepth(20);
    this.creaseWarningGraphics = this.add.graphics().setDepth(14);
    this.creasePenaltyGraphics = this.add.graphics().setDepth(16);
    const creaseWarningStyle = {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: '18px',
      color: '#fff4a6',
      stroke: '#7c160f',
      strokeThickness: 6,
      align: 'center',
    };
    this.creaseWarningTexts = {
      left: this.add.text(0, 0, '', creaseWarningStyle).setOrigin(0.5).setDepth(15).setVisible(false),
      right: this.add.text(0, 0, '', creaseWarningStyle).setOrigin(0.5).setDepth(15).setVisible(false),
    };
    this.creaseNoticeText = this.add.text(
      GAME_WIDTH / 2,
      170,
      '',
      {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '34px',
        color: '#ffcf55',
        stroke: '#8b160f',
        strokeThickness: 8,
        align: 'center',
      },
    ).setOrigin(0.5).setDepth(21).setVisible(false);
    this.crazyEffectsGraphics = this.add.graphics().setDepth(13);
    this.crazyPowerHudGraphics = this.add.graphics().setDepth(25);
    this.crazyPowerText = this.add.text(
      GAME_WIDTH / 2,
      662,
      '',
      {
        fontFamily: 'Arial Black, sans-serif',
        fontSize: '14px',
        color: '#ffd4a1',
        stroke: '#4a0f12',
        strokeThickness: 5,
      },
    ).setOrigin(0.5).setDepth(26).setVisible(this.isCrazyMode);
    this.touchPrompt = this.add.text(GAME_WIDTH / 2, DISC_HOCKEY_ARENA.bottom - 18, t(
      this.language,
      this.isCrazyMode
        ? 'discHockeySetup.controls.crazy'
        : this.playMode === 'local'
          ? 'discHockeySetup.controls.local'
          : 'discHockeySetup.controls.computer',
    ), {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: '14px',
      color: neon ? '#ffcf35' : '#234c68',
      backgroundColor: neon ? '#071216cc' : '#ffffffbb',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5, 1).setDepth(12);
  }

  createPauseOverlay() {
    this.pauseShade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02070a, 0.78)
      .setDepth(80)
      .setVisible(false);
    this.pausePanel = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 560, 390, 0x0b1820, 0.98)
      .setStrokeStyle(4, this.themeId === 'neon' ? 0xffc928 : 0x67c6e3, 0.76)
      .setDepth(81)
      .setVisible(false);
    this.pauseTitle = this.add.text(GAME_WIDTH / 2, 235, t(this.language, 'discHockey.paused'), {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: '40px',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(82).setVisible(false);
    this.pauseButtons = [
      setButtonDepth(createButton(this, {
        x: GAME_WIDTH / 2,
        y: 325,
        width: 330,
        height: 58,
        label: t(this.language, 'discHockey.resume'),
        color: 0x238e69,
        onPress: () => this.resumeGame(),
      }), 82),
      setButtonDepth(createButton(this, {
        x: GAME_WIDTH / 2,
        y: 400,
        width: 330,
        height: 54,
        label: t(this.language, 'discHockey.restart'),
        color: 0xb88724,
        onPress: () => this.restartMatch(),
      }), 82),
      setButtonDepth(createButton(this, {
        x: GAME_WIDTH / 2,
        y: 470,
        width: 330,
        height: 54,
        label: t(this.language, 'discHockey.leave'),
        color: 0x9e3024,
        onPress: () => this.leaveToSetup(),
      }), 82),
    ];
    this.pauseButtons.forEach((button) => button.setVisible(false));
  }

  createResultOverlay() {
    this.resultShade = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x02070a, 0.8)
      .setDepth(90)
      .setVisible(false);
    this.resultPanel = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 650, 360, 0x0b1820, 0.98)
      .setStrokeStyle(5, this.themeId === 'neon' ? 0xffc928 : 0x67c6e3, 0.82)
      .setDepth(91)
      .setVisible(false);
    this.resultTitle = this.add.text(GAME_WIDTH / 2, 275, '', {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: '48px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5).setDepth(92).setVisible(false);
    this.resultScore = this.add.text(GAME_WIDTH / 2, 340, '', {
      fontFamily: 'Arial Black, sans-serif',
      fontSize: '34px',
      color: this.themeId === 'neon' ? '#ffcf35' : '#8fe8ff',
    }).setOrigin(0.5).setDepth(92).setVisible(false);
    this.resultButtons = [
      setButtonDepth(createButton(this, {
        x: 500,
        y: 445,
        width: 240,
        height: 58,
        label: t(this.language, 'discHockey.rematch'),
        color: 0x238e69,
        onPress: () => this.rematch(),
      }), 92),
      setButtonDepth(createButton(this, {
        x: 780,
        y: 445,
        width: 240,
        height: 58,
        label: t(this.language, 'discHockey.setup'),
        color: 0x9e3024,
        onPress: () => this.leaveToSetup(),
      }), 92),
    ];
    this.resultButtons.forEach((button) => button.setVisible(false));
  }

  bindInput() {
    this.keys = this.input.keyboard.addKeys({
      leftUp: 'UP',
      leftDown: 'DOWN',
      leftLeft: 'LEFT',
      leftRight: 'RIGHT',
      rightUp: 'W',
      rightDown: 'S',
      rightLeft: 'A',
      rightRight: 'D',
    });
    this.onPointerDown = (pointer) => this.claimPointer(pointer);
    this.onPointerMove = (pointer) => this.movePointer(pointer);
    this.onPointerUp = (pointer) => this.releasePointer(pointer);
    this.input.on('pointerdown', this.onPointerDown);
    this.input.on('pointermove', this.onPointerMove);
    this.input.on('pointerup', this.onPointerUp);
    this.input.on('pointerupoutside', this.onPointerUp);
    this.onPauseKey = (event) => {
      if (event.repeat) return;
      if (this.isPaused) this.resumeGame();
      else this.pauseGame('manual');
    };
    this.onRestartKey = (event) => {
      if (!event.repeat) this.restartMatch();
    };
    this.onFullscreenKey = (event) => {
      if (!event.repeat) this.game.registry.get('platformActions')?.toggleFullscreen?.();
    };
    this.input.keyboard.on('keydown-P', this.onPauseKey);
    this.input.keyboard.on('keydown-ESC', this.onPauseKey);
    this.input.keyboard.on('keydown-R', this.onRestartKey);
    this.input.keyboard.on('keydown-F', this.onFullscreenKey);
  }

  unbindInput() {
    if (!this.input) return;
    this.input.off('pointerdown', this.onPointerDown);
    this.input.off('pointermove', this.onPointerMove);
    this.input.off('pointerup', this.onPointerUp);
    this.input.off('pointerupoutside', this.onPointerUp);
    this.input.keyboard?.off('keydown-P', this.onPauseKey);
    this.input.keyboard?.off('keydown-ESC', this.onPauseKey);
    this.input.keyboard?.off('keydown-R', this.onRestartKey);
    this.input.keyboard?.off('keydown-F', this.onFullscreenKey);
    this.pointerOwners?.clear();
  }

  pointerWorld(pointer) {
    return {
      x: Number.isFinite(pointer.worldX) ? pointer.worldX : pointer.x,
      y: Number.isFinite(pointer.worldY) ? pointer.worldY : pointer.y,
    };
  }

  claimPointer(pointer) {
    if (!['countdown', 'playing'].includes(this.phase) || this.isPaused || this.suspended) return;
    const point = this.pointerWorld(pointer);
    if (point.y < DISC_HOCKEY_ARENA.top || point.y > DISC_HOCKEY_ARENA.bottom) return;
    const side = point.x < DISC_HOCKEY_ARENA.centerX ? 'left' : 'right';
    if (side === 'right' && this.playMode !== 'local') return;
    const player = side === 'left' ? this.leftPlayer : this.rightPlayer;
    if (player.pointerId !== null) return;
    player.pointerId = pointer.id;
    player.target = clampDiscPlayerPosition({
      side,
      x: point.x,
      y: point.y,
      radius: player.radius,
      collisionMap: this.collisionMap,
    });
    this.pointerOwners.set(pointer.id, side);
    this.touchPromptSeconds = 0;
  }

  movePointer(pointer) {
    const side = this.pointerOwners.get(pointer.id);
    if (!side) return;
    const player = side === 'left' ? this.leftPlayer : this.rightPlayer;
    const point = this.pointerWorld(pointer);
    player.target = clampDiscPlayerPosition({
      side,
      x: point.x,
      y: point.y,
      radius: player.radius,
      collisionMap: this.collisionMap,
    });
  }

  releasePointer(pointer) {
    const side = this.pointerOwners.get(pointer.id);
    if (!side) return;
    if (side === 'left') {
      this.leftPlayer = releaseDiscHockeyControl(this.leftPlayer);
    } else {
      this.rightPlayer = releaseDiscHockeyControl(this.rightPlayer);
      this.rightPlayers = [this.rightPlayer];
    }
    this.pointerOwners.delete(pointer.id);
  }

  keyboardTarget(player, keys) {
    const xAxis = Number(keys.right.isDown) - Number(keys.left.isDown);
    const yAxis = Number(keys.down.isDown) - Number(keys.up.isDown);
    if (xAxis === 0 && yAxis === 0) return null;
    return clampDiscPlayerPosition({
      side: player.side,
      x: player.x + xAxis * 95,
      y: player.y + yAxis * 95,
      radius: player.radius,
      collisionMap: this.collisionMap,
    });
  }

  update(_time, deltaMilliseconds) {
    const dt = Math.min(0.05, Math.max(0, deltaMilliseconds / 1000));
    this.accumulator += dt;
    while (this.accumulator >= FIXED_STEP) {
      this.stepGame(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
    this.updateVisuals();
    this.updateHud();
  }

  stepGame(dt) {
    if (this.suspended || this.isPaused || this.phase === 'result' || !this.keys) return;
    this.simulationSeconds += dt;
    this.collisionSoundCooldown = Math.max(0, this.collisionSoundCooldown - dt);
    this.touchPromptSeconds = Math.max(0, this.touchPromptSeconds - dt);
    this.creaseNoticeSeconds = Math.max(0, this.creaseNoticeSeconds - dt);
    if (this.creaseNoticeSeconds <= 0) this.creaseNoticeText?.setVisible(false);

    if (this.phase === 'countdown') {
      this.countdown = Math.max(0, this.countdown - dt);
      this.announcementText.setText(String(Math.max(1, Math.ceil(this.countdown))));
      if (this.countdown <= 0) {
        this.phase = 'playing';
        this.announcementText.setText(t(this.language, 'discHockey.go'));
        this.time.delayedCall(420, () => {
          if (this.phase === 'playing') this.announcementText.setText('');
        });
        arcadeAudio.whistle(1, { label: 'disc-hockey-start', cutoffMs: 420 });
      }
      return;
    }

    if (this.phase === 'goal') {
      this.goalPause = Math.max(0, this.goalPause - dt);
      if (this.goalPause <= 0) {
        if (this.matchSecondsRemaining <= 0) this.finishMatch();
        else {
          this.resetRound();
          this.phase = 'countdown';
          this.countdown = 1.45;
        }
      }
      return;
    }

    if (this.phase !== 'playing') return;
    this.updateCrazyPower(dt);
    this.stepPlayers(dt);
    this.updateCreaseRule(dt);
    const puckBeforeBoards = this.puck;
    this.puck = stepPuck({
      puck: this.puck,
      deltaSeconds: dt,
      collisionMap: this.collisionMap,
    });
    if (this.puck.powered) {
      if (shouldEndDiscHockeyPoweredShot({
        before: puckBeforeBoards,
        after: this.puck,
      })) {
        this.puck = { ...this.puck, powered: false };
      } else {
        const speed = Math.max(0.0001, Math.hypot(this.puck.vx, this.puck.vy));
        const maintainedSpeed = Math.max(speed, DISC_HOCKEY_CRAZY_POWER.poweredPuckSpeed);
        this.puck = {
          ...this.puck,
          vx: this.puck.vx / speed * maintainedSpeed,
          vy: this.puck.vy / speed * maintainedSpeed,
        };
      }
    }
    this.resolvePuckContacts();
    this.puck = this.limitPuckSpeed(this.puck);
    const signedSpeed = Math.sign(this.puck.vx || this.puck.vy)
      * Math.hypot(this.puck.vx, this.puck.vy);
    this.puckRotation += signedSpeed * dt / 42;
    const scorer = detectDiscHockeyGoal({
      puck: this.puck,
      collisionMap: this.collisionMap,
    });
    if (scorer) this.scoreGoal(scorer);
    this.matchSecondsRemaining = Math.max(0, this.matchSecondsRemaining - dt);
    if (this.matchSecondsRemaining <= 0 && this.phase === 'playing') this.finishMatch();
  }

  stepPlayers(dt) {
    const leftKeyboardTarget = this.keyboardTarget(this.leftPlayer, {
      up: this.keys.leftUp,
      down: this.keys.leftDown,
      left: this.keys.leftLeft,
      right: this.keys.leftRight,
    });
    const leftTarget = this.leftPlayer.target ?? leftKeyboardTarget;
    this.leftPlayer = leftTarget
      ? this.moveHumanPlayer(this.leftPlayer, leftTarget, dt)
      : { ...this.leftPlayer, vx: 0, vy: 0 };

    if (this.isCrazyMode) {
      this.aiThinkTimer -= dt;
      if (this.aiThinkTimer <= 0) {
        const assignments = chooseDiscHockeyCrazyTargets({
          players: this.rightPlayers,
          puck: this.puck,
          human: this.leftPlayer,
          collisionMap: this.collisionMap,
        });
        this.rightPlayers = assignments.map(({
          player,
          role,
          target,
          cornerRecovery,
          cornerPhase,
        }) => ({
          ...player,
          crazyRole: role,
          cornerRecovery,
          cornerPhase,
          aiTarget: target,
        }));
        this.aiTargets = assignments.map(({
          role,
          target,
          cornerRecovery,
          cornerPhase,
        }) => ({
          role,
          cornerRecovery,
          cornerPhase,
          ...target,
        }));
        this.aiThinkTimer = DISC_HOCKEY_CRAZY_AI.reactionSeconds;
      }
      this.rightPlayers = this.rightPlayers.map((player) => {
        const activePlayer = {
          ...player,
          cornerReleaseSeconds: Math.max(
            0,
            (Number(player.cornerReleaseSeconds) || 0) - dt,
          ),
        };
        if (player.knockbackSeconds > 0) {
          const position = clampDiscPlayerPosition({
            side: 'right',
            x: player.x + player.knockbackVx * dt,
            y: player.y + player.knockbackVy * dt,
            radius: player.radius,
            collisionMap: this.collisionMap,
          });
          return {
            ...activePlayer,
            ...position,
            vx: player.knockbackVx,
            vy: player.knockbackVy,
            knockbackSeconds: Math.max(0, player.knockbackSeconds - dt),
          };
        }
        if (player.penaltySeconds > 0) return { ...activePlayer, vx: 0, vy: 0 };
        const motion = getDiscHockeyCrazyRoleMotion(player.crazyRole);
        return moveDiscTowardTarget({
          disc: activePlayer,
          target: player.aiTarget ?? { x: player.x, y: player.y },
          deltaSeconds: dt,
          maxSpeed: motion.maxSpeed,
          response: motion.response,
          side: 'right',
          collisionMap: this.collisionMap,
        });
      });
      this.rightPlayers = separateDiscHockeyPushers({
        players: this.rightPlayers,
        collisionMap: this.collisionMap,
      });
      this.rightPlayer = this.rightPlayers[0];
      this.aiTarget = this.aiTargets[0] ?? { x: this.rightPlayer.x, y: this.rightPlayer.y };
      return;
    }

    let rightTarget;
    if (this.playMode === 'local') {
      const keyboard = this.keyboardTarget(this.rightPlayer, {
        up: this.keys.rightUp,
        down: this.keys.rightDown,
        left: this.keys.rightLeft,
        right: this.keys.rightRight,
      });
      rightTarget = this.rightPlayer.target ?? keyboard;
      this.rightPlayer = rightTarget
        ? this.moveHumanPlayer(this.rightPlayer, rightTarget, dt)
        : { ...this.rightPlayer, vx: 0, vy: 0 };
      return;
    } else {
      if (this.rightPlayer.penaltySeconds > 0) {
        this.rightPlayer = { ...this.rightPlayer, vx: 0, vy: 0 };
        return;
      }
      const tuning = getDiscHockeyAiTuning(this.difficulty);
      this.aiThinkTimer -= dt;
      if (this.aiThinkTimer <= 0) {
        this.aiTarget = chooseDiscHockeyAiTarget({
          puck: this.puck,
          player: this.rightPlayer,
          difficulty: this.difficulty,
          collisionMap: this.collisionMap,
        });
        this.aiThinkTimer = tuning.reactionSeconds;
      }
      rightTarget = this.aiTarget;
      this.rightPlayer = moveDiscTowardTarget({
        disc: this.rightPlayer,
        target: rightTarget,
        deltaSeconds: dt,
        maxSpeed: tuning.maxSpeed,
        side: 'right',
        collisionMap: this.collisionMap,
      });
    }
  }

  resolvePuckContacts() {
    [this.leftPlayer, ...this.rightPlayers].forEach((player, playerIndex) => {
      if (player.ejectionSeconds > 0 || player.penaltySeconds > 0) return;
      const puckBeforeContact = this.puck;
      const collision = resolvePlayerPuckCollision({
        player,
        puck: puckBeforeContact,
      });
      if (!collision.collided) return;

      if (this.isCrazyMode && puckBeforeContact.powered && player.side === 'right') {
        if (player.lastPoweredHitSerial === puckBeforeContact.powerSerial) return;
        const knockback = getDiscHockeyPoweredKnockback({
          puck: puckBeforeContact,
          player,
        });
        const rightIndex = playerIndex - 1;
        this.rightPlayers[rightIndex] = {
          ...player,
          knockbackSeconds: knockback.seconds,
          knockbackVx: knockback.vx,
          knockbackVy: knockback.vy,
          lastPoweredHitSerial: puckBeforeContact.powerSerial,
        };
        this.rightPlayer = this.rightPlayers[0];
        this.game.events.emit('platform:haptic', 'medium');
        return;
      }

      const intentionalHit = getDiscHockeyIntentionalHit({
        player,
        puck: puckBeforeContact,
      });
      this.puck = this.limitPuckSpeed(collision.puck);
      if (
        this.isCrazyMode
        && player.side === 'right'
        && player.crazyRole === 'striker'
        && player.cornerRecovery
      ) {
        const rightIndex = playerIndex - 1;
        this.puck = this.limitPuckSpeed(createDiscHockeyCornerBankPuck({
          puck: this.puck,
          corner: player.cornerRecovery,
        }));
        this.rightPlayers[rightIndex] = {
          ...this.rightPlayers[rightIndex],
          cornerReleaseSeconds: DISC_HOCKEY_CRAZY_AI.cornerRelease.retreatSeconds,
          cornerReleaseCorner: player.cornerRecovery,
        };
      }
      this.lastPuckTouch = {
        side: player.side,
        characterId: player.side === 'left'
          ? this.leftCharacter.id
          : this.rightCharacters[playerIndex - 1]?.id ?? null,
      };
      let poweredActivation = false;
      if (this.isCrazyMode && player.side === 'left' && intentionalHit.intentional) {
        if (this.crazyPower.armed) {
          const shotSerial = this.crazyPower.shotSerial + 1;
          this.puck = createDiscHockeyPoweredPuck({
            puck: collision.puck,
            serial: shotSerial,
            fallbackDirection: 1,
          });
          this.crazyPower = {
            ...this.crazyPower,
            energy: 0,
            armed: false,
            contactCooldownSeconds: DISC_HOCKEY_CRAZY_POWER.contactCooldownSeconds,
            rechargeDelaySeconds: DISC_HOCKEY_CRAZY_POWER.rechargeDelaySeconds,
            lastDrain: 'powered-shot',
            shotSerial,
          };
          arcadeAudio.poweredShot();
          this.game.events.emit('platform:haptic', 'heavy');
          poweredActivation = true;
        } else if (this.crazyPower.contactCooldownSeconds <= 0) {
          const defensiveSave = isDiscHockeyDefensiveSave({
            player,
            puck: puckBeforeContact,
            intentionalHit,
          });
          this.gainCrazyPower(
            defensiveSave
              ? DISC_HOCKEY_CRAZY_POWER.defensiveSaveGain
              : DISC_HOCKEY_CRAZY_POWER.intentionalHitGain,
            defensiveSave ? 'defensive-save' : 'intentional-hit',
          );
        }
      }
      if (!poweredActivation && this.collisionSoundCooldown <= 0) {
        const volumeScale = getDiscHockeyImpactVolume(collision.impactSpeed);
        arcadeAudio.hockeyShot(this.themeId, volumeScale);
        this.lastCollisionSound = {
          impactSpeed: round(collision.impactSpeed, 2),
          volumeScale: round(volumeScale, 3),
        };
        this.collisionSoundCooldown = 0.28;
      }
    });
  }

  updateCrazyPower(dt) {
    if (!this.isCrazyMode) return;
    this.crazyPower.contactCooldownSeconds = Math.max(
      0,
      this.crazyPower.contactCooldownSeconds - dt,
    );
    this.crazyPower.rechargeDelaySeconds = Math.max(
      0,
      this.crazyPower.rechargeDelaySeconds - dt,
    );
    if (
      this.crazyPower.armed
      || this.crazyPower.rechargeDelaySeconds > 0
      || this.leftPlayer.penaltySeconds > 0
    ) return;
    const energy = addDiscHockeyCrazyPower({
      energy: this.crazyPower.energy,
      deltaSeconds: dt,
    });
    this.setCrazyPowerEnergy(energy, 'passive');
  }

  gainCrazyPower(gain, source) {
    if (!this.isCrazyMode || this.crazyPower.armed) return;
    const energy = addDiscHockeyCrazyPower({
      energy: this.crazyPower.energy,
      gain,
    });
    this.crazyPower.lastGain = {
      source,
      amount: gain,
      atSeconds: round(this.simulationSeconds, 2),
    };
    this.setCrazyPowerEnergy(energy, source);
  }

  setCrazyPowerEnergy(energy, source) {
    if (!this.isCrazyMode) return;
    const wasArmed = this.crazyPower.armed;
    const nextEnergy = Phaser.Math.Clamp(
      energy,
      0,
      DISC_HOCKEY_CRAZY_POWER.maximum,
    );
    this.crazyPower.energy = nextEnergy;
    this.crazyPower.armed = nextEnergy >= DISC_HOCKEY_CRAZY_POWER.maximum;
    if (!wasArmed && this.crazyPower.armed) {
      arcadeAudio.powerUp();
      this.game.events.emit('platform:haptic', 'success');
    }
  }

  drainCrazyPower(reason) {
    if (!this.isCrazyMode) return;
    this.crazyPower = {
      ...this.crazyPower,
      energy: 0,
      armed: false,
      rechargeDelaySeconds: reason === 'crease-violation'
        ? DISC_HOCKEY_CREASE_RULE.penaltySeconds
        : DISC_HOCKEY_CRAZY_POWER.rechargeDelaySeconds,
      lastDrain: reason,
    };
  }

  moveHumanPlayer(player, target, dt) {
    if (player.penaltySeconds > 0) return { ...player, vx: 0, vy: 0 };
    const motion = getDiscHockeyHumanMotion(player.pointerId !== null);
    if (motion.direct) {
      return moveDiscDirectlyTowardTarget({
        disc: player,
        target,
        deltaSeconds: dt,
        maxSpeed: motion.maxSpeed,
        side: player.side,
        collisionMap: this.collisionMap,
      });
    }
    return moveDiscTowardTarget({
      disc: player,
      target,
      deltaSeconds: dt,
      maxSpeed: motion.maxSpeed,
      response: motion.response,
      side: player.side,
      collisionMap: this.collisionMap,
    });
  }

  limitPuckSpeed(puck) {
    const speed = Math.hypot(puck.vx, puck.vy);
    const maximumSpeed = puck.powered
      ? DISC_HOCKEY_CRAZY_POWER.poweredPuckMaximumSpeed
      : 920;
    if (speed <= maximumSpeed) return puck;
    const scale = maximumSpeed / speed;
    return { ...puck, vx: puck.vx * scale, vy: puck.vy * scale };
  }

  updateCreaseRule(dt) {
    this.leftPlayer = this.updateSingleCreasePlayer(this.leftPlayer, 'left', dt);

    if (!this.isCrazyMode) {
      this.rightPlayer = this.updateSingleCreasePlayer(this.rightPlayer, 'right', dt);
      this.rightPlayers = [this.rightPlayer];
      return;
    }

    this.rightPlayers = this.rightPlayers.map((player) => (
      player.penaltySeconds > 0
        ? this.advanceCreasePenalty(player, 'right', dt)
        : player
    ));
    const occupancy = this.rightPlayers.map((player) => ({
      player,
      rule: evaluateDiscHockeyCrease({
        player,
        puck: this.puck,
        collisionMap: this.collisionMap,
      }),
    }));
    const campers = occupancy.filter(({ player, rule }) => (
      player.penaltySeconds <= 0 && rule.inCrease
    ));
    const puckThreatening = occupancy.some(({ rule }) => rule.puckThreatening);
    this.rightTeamCreaseSeconds = campers.length > 0 && !puckThreatening
      ? this.rightTeamCreaseSeconds + dt
      : 0;
    this.rightPlayers = this.rightPlayers.map((player) => ({
      ...player,
      creaseSeconds: campers.some(({ player: camper }) => camper === player)
        ? this.rightTeamCreaseSeconds
        : 0,
    }));
    if (this.rightTeamCreaseSeconds >= DISC_HOCKEY_CREASE_RULE.violationSeconds) {
      const camperIndices = occupancy
        .map(({ player }, index) => (
          campers.some(({ player: camper }) => camper === player) ? index : -1
        ))
        .filter((index) => index >= 0);
      const offenderIndex = camperIndices.reduce((deepestIndex, index) => (
        this.rightPlayers[index].x > this.rightPlayers[deepestIndex].x
          ? index
          : deepestIndex
      ), camperIndices[0]);
      this.rightPlayers[offenderIndex] = this.penalizeCreasePlayer(
        this.rightPlayers[offenderIndex],
        'right',
      );
      this.rightTeamCreaseSeconds = 0;
      this.rightPlayers = this.rightPlayers.map((player) => ({
        ...player,
        creaseSeconds: 0,
      }));
    }
    this.rightPlayer = this.rightPlayers[0];
  }

  updateSingleCreasePlayer(player, side, dt) {
    if (player.penaltySeconds > 0) {
      return this.advanceCreasePenalty(player, side, dt);
    }
    const rule = evaluateDiscHockeyCrease({
      player,
      puck: this.puck,
      collisionMap: this.collisionMap,
      previousSeconds: player.creaseSeconds,
      deltaSeconds: dt,
    });
    const updated = { ...player, creaseSeconds: rule.seconds };
    return rule.violated
      ? this.penalizeCreasePlayer(updated, side)
      : updated;
  }

  advanceCreasePenalty(player, side, dt) {
    const ejectionSeconds = Math.max(0, player.ejectionSeconds - dt);
    const isPushing = player.ejectionSeconds > (
      DISC_HOCKEY_CREASE_RULE.ejectionSeconds
        - DISC_HOCKEY_CREASE_RULE.ejectionPushSeconds
    );
    const position = isPushing
      ? clampDiscPlayerPosition({
        side,
        x: player.x + player.ejectionVx * dt,
        y: player.y + player.ejectionVy * dt,
        radius: player.radius,
        collisionMap: this.collisionMap,
      })
      : { x: player.x, y: player.y };
    return {
      ...player,
      ...position,
      vx: isPushing ? player.ejectionVx : 0,
      vy: isPushing ? player.ejectionVy : 0,
      creaseSeconds: 0,
      penaltySeconds: Math.max(0, player.penaltySeconds - dt),
      ejectionSeconds,
    };
  }

  penalizeCreasePlayer(player, side) {
    const ejection = getDiscHockeyEjectionVelocity({
      side,
      randomSample: Phaser.Math.RND.frac(),
    });
    this.creaseViolations[side] += 1;
    if (side === 'left') this.drainCrazyPower('crease-violation');
    this.lastCreaseViolation = {
      side,
      atSeconds: round(this.simulationSeconds, 2),
      penaltySeconds: DISC_HOCKEY_CREASE_RULE.penaltySeconds,
      ejectionAngleDegrees: round(ejection.angleDegrees, 2),
      energyEmptied: side === 'left' && this.isCrazyMode,
    };
    this.creaseNoticeSeconds = 1.15;
    this.creaseNoticeText
      ?.setText(t(this.language, 'discHockey.creaseViolation'))
      .setVisible(true);
    this.game.events.emit('platform:haptic', 'heavy');
    arcadeAudio.impact();
    return {
      ...player,
      vx: 0,
      vy: 0,
      creaseSeconds: 0,
      penaltySeconds: DISC_HOCKEY_CREASE_RULE.penaltySeconds,
      ejectionSeconds: DISC_HOCKEY_CREASE_RULE.ejectionSeconds,
      ejectionVx: ejection.vx,
      ejectionVy: ejection.vy,
      ejectionOriginY: player.y,
    };
  }

  scoreGoal(side) {
    if (this.phase !== 'playing') return;
    if (this.puck.powered) this.puck = { ...this.puck, powered: false };
    if (this.isCrazyMode && side === 'left' && this.crazyPower.armed) {
      this.drainCrazyPower('player-goal');
    }
    this.score = { ...this.score, [side]: this.score[side] + 1 };
    this.phase = 'goal';
    this.goalPause = 1.15;
    this.announcementText
      .setText(t(this.language, 'discHockey.goal'))
      .setColor(this.themeId === 'neon' ? '#ffcf35' : '#c52920');
    arcadeAudio.goal(resolveDiscHockeyGoalCharacterId({
      scoringSide: side,
      leftCharacterId: this.leftCharacter.id,
      rightCharacterId: this.rightCharacter.id,
      isCrazyMode: this.isCrazyMode,
      lastPuckTouch: this.lastPuckTouch,
    }));
    this.game.events.emit('platform:haptic', 'success');
    this.updateHud();
  }

  resetRound() {
    const left = playerSpawn('left');
    left.pointerId = this.leftPlayer?.pointerId ?? null;
    this.leftPlayer = left;
    this.rightPlayers = this.isCrazyMode
      ? CRAZY_SPAWNS.map((position, index) => playerSpawn('right', {
        ...position,
        crazyRole: ['striker', 'interceptor', 'defender', 'goalkeeper'][index],
      }))
      : [playerSpawn('right')];
    if (!this.isCrazyMode) {
      this.rightPlayers[0].pointerId = this.rightPlayer?.pointerId ?? null;
    }
    this.rightPlayer = this.rightPlayers[0];
    this.puck = puckSpawn();
    this.lastPuckTouch = null;
    this.aiTarget = { x: this.rightPlayer.x, y: this.rightPlayer.y };
    this.aiTargets = this.rightPlayers.map(({ x, y, crazyRole: role }) => ({ x, y, role }));
    this.aiThinkTimer = 0;
    this.rightTeamCreaseSeconds = 0;
    this.pendingWinner = null;
    this.announcementText?.setColor(this.themeId === 'neon' ? '#ffcf35' : '#173d5b');
    this.updateVisuals();
  }

  restartMatch() {
    this.score = { left: 0, right: 0 };
    this.creaseViolations = { left: 0, right: 0 };
    this.lastCreaseViolation = null;
    this.creaseNoticeSeconds = 0;
    this.rightTeamCreaseSeconds = 0;
    this.creaseNoticeText?.setVisible(false);
    this.matchSecondsRemaining = DISC_HOCKEY_MATCH_SECONDS;
    this.crazyPower = {
      energy: 0,
      armed: false,
      contactCooldownSeconds: 0,
      rechargeDelaySeconds: 0,
      lastGain: null,
      lastDrain: null,
      shotSerial: 0,
    };
    this.hidePause();
    this.hideResult();
    this.isPaused = false;
    this.pauseReason = null;
    this.phase = 'countdown';
    this.countdown = 2.0;
    this.resetRound();
    this.releaseAllPointers();
    arcadeAudio.click();
    this.updateHud();
  }

  rematch() {
    this.restartMatch();
  }

  pauseGame(reason = 'manual') {
    if (this.phase === 'result' || this.isPaused) return;
    this.isPaused = true;
    this.pauseReason = reason;
    this.releaseAllPointers();
    this.pauseShade.setVisible(true);
    this.pausePanel.setVisible(true);
    this.pauseTitle.setVisible(true);
    this.pauseButtons.forEach((button) => button.setVisible(true));
    arcadeAudio.click();
  }

  resumeGame() {
    if (!this.isPaused || this.suspended) return;
    this.isPaused = false;
    this.pauseReason = null;
    this.hidePause();
    arcadeAudio.click();
  }

  hidePause() {
    this.pauseShade?.setVisible(false);
    this.pausePanel?.setVisible(false);
    this.pauseTitle?.setVisible(false);
    this.pauseButtons?.forEach((button) => button.setVisible(false));
  }

  showResult(winner) {
    this.phase = 'result';
    this.pendingWinner = winner;
    this.releaseAllPointers();
    this.announcementText.setText('');
    const resultTitle = winner === 'draw'
      ? t(this.language, 'discHockey.draw')
      : t(this.language, 'discHockey.wins', {
        name: winner === 'right' && this.isCrazyMode
          ? t(this.language, 'discHockey.crazySquad')
          : getCharacterName(
            winner === 'left' ? this.leftCharacter : this.rightCharacter,
            this.language,
          ).toUpperCase(),
      });
    this.resultTitle
      .setText(resultTitle)
      .setVisible(true);
    this.resultScore.setText(`${this.score.left}  —  ${this.score.right}`).setVisible(true);
    this.resultShade.setVisible(true);
    this.resultPanel.setVisible(true);
    this.resultButtons.forEach((button) => button.setVisible(true));
    arcadeAudio.success();
  }

  finishMatch() {
    if (this.phase === 'result') return;
    this.matchSecondsRemaining = 0;
    this.showResult(getDiscHockeyMatchResult(this.score));
  }

  hideResult() {
    this.resultShade?.setVisible(false);
    this.resultPanel?.setVisible(false);
    this.resultTitle?.setVisible(false);
    this.resultScore?.setVisible(false);
    this.resultButtons?.forEach((button) => button.setVisible(false));
  }

  releaseAllPointers() {
    this.pointerOwners.clear();
    if (this.leftPlayer) {
      this.leftPlayer = releaseDiscHockeyControl(this.leftPlayer);
    }
    if (this.rightPlayer) {
      this.rightPlayer = releaseDiscHockeyControl(this.rightPlayer);
      if (!this.isCrazyMode) this.rightPlayers = [this.rightPlayer];
    }
  }

  leaveToSetup() {
    arcadeAudio.click();
    this.scene.start('MiniGameSetup', { gameId: 'discHockey' });
  }

  handlePlatformBack() {
    if (this.phase === 'result') {
      this.leaveToSetup();
      return true;
    }
    if (this.isPaused) this.resumeGame();
    else this.pauseGame('back');
    return true;
  }

  handlePlatformActiveChange(isActive) {
    this.suspended = !isActive;
    if (!isActive && !this.isPaused && this.phase !== 'result') this.pauseGame('lifecycle');
  }

  updateVisuals() {
    if (!this.leftVisual || !this.rightVisual || !this.puckBody) return;
    [
      [this.leftPlayer, this.leftVisual, true],
      ...this.rightPlayers.map((player, index) => [
        player,
        this.rightVisuals[index],
        false,
      ]),
    ].forEach(([player, visual, isHuman]) => {
      if (!visual) return;
      visual.shadow.setPosition(player.x + 2, player.y + 4);
      visual.base.setPosition(player.x, player.y);
      visual.engraving.setPosition(player.x, player.y);
      const frozen = player.penaltySeconds > 0 && player.ejectionSeconds <= 0;
      const penaltyAlpha = frozen ? 0.38 : 1;
      const armed = this.isCrazyMode && isHuman && this.crazyPower.armed && !frozen;
      const armedScale = armed
        ? 1 + Math.sin(this.simulationSeconds * 9) * 0.025
        : 1;
      visual.shadow.setAlpha(penaltyAlpha);
      visual.base.setAlpha(penaltyAlpha);
      visual.engraving.setAlpha(penaltyAlpha);
      visual.base.setDisplaySize(
        visual.displaySize * armedScale,
        visual.displaySize * armedScale,
      );
      visual.engraving.setDisplaySize(
        visual.displaySize * armedScale,
        visual.displaySize * armedScale,
      );
      if (frozen) {
        const tint = this.themeId === 'neon' ? 0xb9efff : 0xd8f5ff;
        visual.base.setTint(tint);
        visual.engraving.setTint(tint);
      } else if (armed) {
        visual.base.setTint(0xff7059);
        visual.engraving.setTint(0xffb09a);
      } else {
        visual.base.clearTint();
        visual.engraving.clearTint();
      }
    });
    this.puckBody
      .setPosition(this.puck.x, this.puck.y)
      .setRotation(this.puckRotation);
    if (this.puck.powered) this.puckBody.setTint(0xff3d24);
    else this.puckBody.clearTint();
    this.renderCreaseWarnings();
    this.renderCreasePenaltyHardware();
    this.renderCrazyPowerEffects();
  }

  renderCreaseWarnings() {
    if (!this.creaseWarningGraphics || !this.creaseWarningTexts) return;
    this.creaseWarningGraphics.clear();
    Object.values(this.creaseWarningTexts).forEach((text) => text.setVisible(false));
    if (this.phase !== 'playing' || this.isPaused) return;
    ['left', 'right'].forEach((side) => {
      const candidates = side === 'left' ? [this.leftPlayer] : this.rightPlayers;
      const player = candidates.reduce((mostUrgent, candidate) => (
        candidate.creaseSeconds > (mostUrgent?.creaseSeconds ?? 0)
          ? candidate
          : mostUrgent
      ), null);
      if (!player) return;
      if (player.creaseSeconds < DISC_HOCKEY_CREASE_RULE.warningSeconds) return;
      const progress = Phaser.Math.Clamp(
        (player.creaseSeconds - DISC_HOCKEY_CREASE_RULE.warningSeconds)
          / (DISC_HOCKEY_CREASE_RULE.violationSeconds - DISC_HOCKEY_CREASE_RULE.warningSeconds),
        0,
        1,
      );
      const color = this.themeId === 'neon' ? 0xff4b2f : 0xd62f28;
      const ringRadius = player.radius + 10;
      this.creaseWarningGraphics
        .lineStyle(3, color, 0.28)
        .strokeCircle(player.x, player.y, ringRadius)
        .lineStyle(7, color, 0.96)
        .beginPath()
        .arc(
          player.x,
          player.y,
          ringRadius,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * progress,
          false,
        )
        .strokePath();
      const remaining = Math.max(
        1,
        Math.ceil(DISC_HOCKEY_CREASE_RULE.violationSeconds - player.creaseSeconds),
      );
      this.creaseWarningTexts[side]
        .setText(`${t(this.language, 'discHockey.creaseMove')}  ${remaining}`)
        .setPosition(player.x, player.y - player.radius - 31)
        .setVisible(true);
    });
  }

  renderCreasePenaltyHardware() {
    if (!this.creasePenaltyGraphics) return;
    const graphics = this.creasePenaltyGraphics;
    graphics.clear();
    if (this.phase !== 'playing' || this.isPaused) return;
    [this.leftPlayer, ...this.rightPlayers].forEach((player) => {
      if (player.ejectionSeconds > 0) {
        this.drawGoalPiston(graphics, player);
      }
    });
  }

  drawGoalPiston(graphics, player) {
    const side = player.side;
    const goalLine = side === 'left'
      ? this.collisionMap.goalLineLeft
      : this.collisionMap.goalLineRight;
    const originX = goalLine + (side === 'left' ? -50 : 50);
    const originY = player.ejectionOriginY;
    const progress = Phaser.Math.Clamp(
      1 - player.ejectionSeconds / DISC_HOCKEY_CREASE_RULE.ejectionSeconds,
      0,
      1,
    );
    const pushRatio = DISC_HOCKEY_CREASE_RULE.ejectionPushSeconds
      / DISC_HOCKEY_CREASE_RULE.ejectionSeconds;
    const extension = progress <= pushRatio
      ? Phaser.Math.Easing.Cubic.Out(progress / pushRatio)
      : 1 - Phaser.Math.Easing.Cubic.In((progress - pushRatio) / (1 - pushRatio));
    const inwardDirection = side === 'left' ? 1 : -1;
    const contactX = player.x - inwardDirection * (player.radius + 7);
    const contactY = player.y;
    const headX = Phaser.Math.Linear(originX, contactX, extension);
    const headY = Phaser.Math.Linear(originY, contactY, extension);

    graphics
      .fillStyle(0x202a30, 1)
      .fillCircle(originX, originY, 23)
      .lineStyle(4, 0xc7d7de, 0.95)
      .strokeCircle(originX, originY, 20)
      .fillStyle(0x73828a, 1)
      .fillCircle(originX, originY, 13)
      .fillStyle(0x172128, 1)
      .fillCircle(originX, originY, 6);

    if (extension <= 0.015) return;
    graphics
      .lineStyle(28, 0x1b2429, 1)
      .lineBetween(originX, originY, headX, headY)
      .lineStyle(20, 0x8b9ba3, 1)
      .lineBetween(originX, originY, headX, headY)
      .lineStyle(8, 0xdce9ee, 0.92)
      .lineBetween(originX, originY - 2, headX, headY - 2);

    [0.34, 0.67].forEach((amount) => {
      const x = Phaser.Math.Linear(originX, headX, amount);
      const y = Phaser.Math.Linear(originY, headY, amount);
      graphics
        .fillStyle(0x263239, 1)
        .fillCircle(x, y, 12)
        .lineStyle(3, 0xb8c8cf, 0.9)
        .strokeCircle(x, y, 9);
    });
    graphics
      .fillStyle(0x202a30, 1)
      .fillCircle(headX, headY, 22)
      .lineStyle(5, 0xe2edf1, 1)
      .strokeCircle(headX, headY, 17)
      .fillStyle(0x77878f, 1)
      .fillCircle(headX, headY, 12);
  }

  renderCrazyPowerEffects() {
    if (!this.crazyEffectsGraphics) return;
    const graphics = this.crazyEffectsGraphics;
    graphics.clear();
    if (!this.isCrazyMode || this.isPaused || this.phase === 'result') return;
    const striker = this.rightPlayers.find(({ crazyRole }) => crazyRole === 'striker');
    if (striker) {
      const markerY = striker.y - striker.radius - 11;
      graphics
        .lineStyle(5, 0x4a1110, 0.9)
        .lineBetween(striker.x - 11, markerY - 9, striker.x, markerY)
        .lineBetween(striker.x, markerY, striker.x + 11, markerY - 9)
        .lineStyle(3, 0xff6a2b, 1)
        .lineBetween(striker.x - 10, markerY - 11, striker.x, markerY - 2)
        .lineBetween(striker.x, markerY - 2, striker.x + 10, markerY - 11);
    }
    if (this.crazyPower.armed) {
      const pulse = 0.58 + Math.sin(this.simulationSeconds * 10) * 0.22;
      graphics
        .lineStyle(12, 0xff2f25, 0.12 + pulse * 0.12)
        .strokeCircle(this.leftPlayer.x, this.leftPlayer.y, this.leftPlayer.radius + 14)
        .lineStyle(5, 0xff7845, 0.74 + pulse * 0.2)
        .strokeCircle(this.leftPlayer.x, this.leftPlayer.y, this.leftPlayer.radius + 9)
        .lineStyle(2, 0xffe0a3, 0.9)
        .strokeCircle(this.leftPlayer.x, this.leftPlayer.y, this.leftPlayer.radius + 4);
    }
    if (this.puck.powered) {
      const speed = Math.max(1, Math.hypot(this.puck.vx, this.puck.vy));
      const directionX = this.puck.vx / speed;
      const directionY = this.puck.vy / speed;
      graphics
        .lineStyle(18, 0xff241d, 0.18)
        .lineBetween(
          this.puck.x,
          this.puck.y,
          this.puck.x - directionX * 145,
          this.puck.y - directionY * 145,
        )
        .lineStyle(8, 0xff7a2e, 0.62)
        .lineBetween(
          this.puck.x,
          this.puck.y,
          this.puck.x - directionX * 105,
          this.puck.y - directionY * 105,
        )
        .fillStyle(0xffd35a, 0.92)
        .fillCircle(
          this.puck.x - directionX * 38,
          this.puck.y - directionY * 38,
          7,
        );
    }
  }

  updateHud() {
    this.scoreText?.setText(`${this.score.left}  —  ${this.score.right}`);
    this.clockText?.setText(formatDiscHockeyTime(this.matchSecondsRemaining));
    this.touchPrompt?.setVisible(
      this.touchPromptSeconds > 0
      && !this.isPaused
      && this.phase !== 'result',
    );
    this.renderCrazyPowerHud();
  }

  renderCrazyPowerHud() {
    if (!this.crazyPowerHudGraphics || !this.crazyPowerText) return;
    const graphics = this.crazyPowerHudGraphics;
    graphics.clear();
    this.crazyPowerText.setVisible(this.isCrazyMode);
    if (!this.isCrazyMode) return;
    const ratio = Phaser.Math.Clamp(
      this.crazyPower.energy / DISC_HOCKEY_CRAZY_POWER.maximum,
      0,
      1,
    );
    const pulse = this.crazyPower.armed
      ? 0.82 + Math.sin(this.simulationSeconds * 9) * 0.18
      : 0.72;
    const x = GAME_WIDTH / 2 - 220;
    const y = 678;
    graphics
      .fillStyle(0x10090b, 0.9)
      .fillRoundedRect(x - 8, y - 8, 456, 34, 11)
      .lineStyle(3, this.crazyPower.armed ? 0xffd05b : 0x8d3029, pulse)
      .strokeRoundedRect(x - 8, y - 8, 456, 34, 11)
      .fillStyle(0x321419, 0.96)
      .fillRoundedRect(x, y, 440, 18, 7);
    if (ratio > 0) {
      graphics
        .fillStyle(this.crazyPower.armed ? 0xff5a2d : 0xd9272f, 0.96)
        .fillRoundedRect(x, y, Math.max(12, 440 * ratio), 18, 7)
        .fillStyle(0xffbd42, this.crazyPower.armed ? 0.9 : 0.58)
        .fillRoundedRect(x + 3, y + 3, Math.max(6, 434 * ratio), 5, 3);
    }
    this.crazyPowerText
      .setText(
        this.crazyPower.armed
          ? t(this.language, 'discHockey.superShot')
          : `${t(this.language, 'discHockey.crazyPower')}  ${Math.floor(this.crazyPower.energy)}%`,
      )
      .setColor(this.crazyPower.armed ? '#fff0a8' : '#ffd4a1');
  }

  installDebugHelpers() {
    window.__DISC_HOCKEY_DEBUG__ = {
      startPlaying: () => {
        this.phase = 'playing';
        this.countdown = 0;
        this.announcementText.setText('');
      },
      setPuck: (patch = {}) => {
        this.puck = this.limitPuckSpeed({ ...this.puck, ...patch });
        this.updateVisuals();
      },
      setScore: (left = 0, right = 0) => {
        this.score = {
          left: Math.max(0, Math.floor(Number(left) || 0)),
          right: Math.max(0, Math.floor(Number(right) || 0)),
        };
        this.updateHud();
      },
      setTime: (seconds = DISC_HOCKEY_MATCH_SECONDS) => {
        this.matchSecondsRemaining = Math.max(0, Number(seconds) || 0);
        this.updateHud();
      },
      setCrazyPower: (energy = 0) => {
        this.setCrazyPowerEnergy(
          Phaser.Math.Clamp(Number(energy) || 0, 0, DISC_HOCKEY_CRAZY_POWER.maximum),
          'debug',
        );
        this.updateVisuals();
        this.updateHud();
      },
      finishMatch: () => this.finishMatch(),
      score: (side = 'left') => {
        this.phase = 'playing';
        this.scoreGoal(side === 'right' ? 'right' : 'left');
      },
      claimPointer: (id, x, y) => this.claimPointer({ id, worldX: x, worldY: y }),
      movePointer: (id, x, y) => this.movePointer({ id, worldX: x, worldY: y }),
      releasePointer: (id) => this.releasePointer({ id }),
      restart: () => this.restartMatch(),
    };
  }

  serializeState() {
    const collisionMapState = {
      id: this.collisionMap.id,
      visible: this.collisionMap.visible,
      contourPointCount: this.collisionMap.contour.length,
      bounds: { ...this.collisionMap.bounds },
      goal: {
        visible: this.collisionMap.goalVisible,
        left: this.collisionMap.goalLineLeft,
        right: this.collisionMap.goalLineRight,
        top: this.collisionMap.goalTop,
        bottom: this.collisionMap.goalBottom,
        requiredPuckOverlap: this.collisionMap.goalOverlapFraction,
      },
    };
    if (!this.leftPlayer || !this.rightPlayer || !this.puck) {
      return {
        mode: 'disc-hockey-loading',
        minigame: 'discHockey',
        theme: this.themeId,
        themeArtwork: {
          texture: THEME_ART[this.themeId].texture,
          pusherTexture: THEME_ART[this.themeId].pusherTexture,
          puckTexture: THEME_ART[this.themeId].puckTexture,
          selectedOnly: true,
        },
        collisionMap: collisionMapState,
        coordinateSystem: 'origin top-left; +x right; +y down; logical landscape canvas 1280x720',
        actions: [],
      };
    }
    const wallDistance = ({ x, y }) => round(closestPointOnCollisionContour({
      x,
      y,
      collisionMap: this.collisionMap,
    }).distance);
    const playerState = (player, character, controller, visual) => {
      const crease = evaluateDiscHockeyCrease({
        player,
        puck: this.puck,
        collisionMap: this.collisionMap,
        previousSeconds: player.creaseSeconds,
      });
      return {
        id: character.id,
        name: getCharacterName(character, this.language),
        controller,
        x: round(player.x),
        y: round(player.y),
        vx: round(player.vx, 2),
        vy: round(player.vy, 2),
        radius: player.radius,
        visualDiameter: round(visual?.base?.displayWidth ?? 0),
        pointerId: player.pointerId,
        target: player.target ? {
          x: round(player.target.x),
          y: round(player.target.y),
          wallClearance: wallDistance(player.target),
        } : null,
        wallClearance: wallDistance(player),
        legalHalf: player.side === 'left'
          ? { left: this.collisionMap.bounds.left, right: DISC_HOCKEY_ARENA.centerX }
          : { left: DISC_HOCKEY_ARENA.centerX, right: this.collisionMap.bounds.right },
        crease: {
          inCrease: crease.inCrease,
          puckThreatening: crease.puckThreatening,
          camping: crease.camping,
          warning: crease.warning,
          seconds: round(player.creaseSeconds, 2),
          penaltySeconds: round(player.penaltySeconds, 2),
          ejectionSeconds: round(player.ejectionSeconds, 2),
          ejecting: player.ejectionSeconds > 0,
          frozen: player.penaltySeconds > 0 && player.ejectionSeconds <= 0,
          ejectionVelocity: {
            x: round(player.ejectionVx, 2),
            y: round(player.ejectionVy, 2),
          },
        },
      };
    };
    return {
      mode: this.isPaused ? 'paused' : this.phase,
      minigame: 'discHockey',
      playMode: this.playMode,
      theme: this.themeId,
      themeArtwork: {
        texture: THEME_ART[this.themeId].texture,
        pusherTexture: THEME_ART[this.themeId].pusherTexture,
        puckTexture: THEME_ART[this.themeId].puckTexture,
        selectedOnly: true,
      },
      collisionMap: collisionMapState,
      difficulty: this.playMode === 'local' ? null : this.difficulty,
      computerAi: this.playMode === 'local' ? null : {
        target: {
          x: round(this.aiTarget.x),
          y: round(this.aiTarget.y),
        },
        tuning: {
          reactionSeconds: getDiscHockeyAiTuning(this.difficulty).reactionSeconds,
          maxSpeed: getDiscHockeyAiTuning(this.difficulty).maxSpeed,
          pressX: getDiscHockeyAiTuning(this.difficulty).pressX,
        },
        squad: this.isCrazyMode
          ? this.rightPlayers.map((player, index) => ({
            ...getDiscHockeyCrazyRoleMotion(player.crazyRole),
            id: this.rightCharacters[index]?.id,
            role: player.crazyRole,
            cornerRecovery: player.cornerRecovery ?? null,
            cornerPhase: player.cornerPhase ?? null,
            cornerReleaseSeconds: round(player.cornerReleaseSeconds, 2),
            target: player.aiTarget ? {
              x: round(player.aiTarget.x),
              y: round(player.aiTarget.y),
            } : null,
            knockbackSeconds: round(player.knockbackSeconds, 2),
          }))
          : null,
      },
      coordinateSystem: 'origin top-left; +x right; +y down; logical landscape canvas 1280x720',
      orientation: {
        requested: 'landscape',
        logicalLocked: true,
      },
      score: { ...this.score },
      match: {
        durationSeconds: DISC_HOCKEY_MATCH_SECONDS,
        remainingSeconds: round(this.matchSecondsRemaining, 2),
        clock: formatDiscHockeyTime(this.matchSecondsRemaining),
      },
      winner: this.phase === 'result' ? this.pendingWinner : null,
      arena: {
        ...DISC_HOCKEY_ARENA,
        audience: { top: [70, 116], bottom: [654, 720], static: true },
        scoreboardPaddingPercent: 5,
      },
      players: {
        left: playerState(this.leftPlayer, this.leftCharacter, 'human', this.leftVisual),
        right: playerState(
          this.rightPlayer,
          this.rightCharacter,
          this.playMode === 'local' ? 'human' : `computer-${this.difficulty}`,
          this.rightVisual,
        ),
        rightSquad: this.isCrazyMode
          ? this.rightPlayers.map((player, index) => playerState(
            player,
            this.rightCharacters[index],
            `computer-hard-${player.crazyRole}`,
            this.rightVisuals[index],
          ))
          : null,
      },
      puck: {
        x: round(this.puck.x),
        y: round(this.puck.y),
        vx: round(this.puck.vx, 2),
        vy: round(this.puck.vy, 2),
        speed: round(Math.hypot(this.puck.vx, this.puck.vy), 2),
        radius: this.puck.radius,
        color: 'red',
        sprite: THEME_ART[this.themeId].puckTexture,
        powered: this.puck.powered === true,
        powerSerial: this.puck.powerSerial ?? 0,
        surface: {
          damping: DISC_HOCKEY_PUCK_SURFACE.damping,
          softDamping: DISC_HOCKEY_PUCK_SURFACE.softDamping,
          settleSpeed: DISC_HOCKEY_PUCK_SURFACE.settleSpeed,
          wallRestitution: DISC_HOCKEY_PUCK_SURFACE.wallRestitution,
        },
      },
      activePointers: [...this.pointerOwners.entries()].map(([id, side]) => ({ id, side })),
      antiCamping: {
        warningSeconds: DISC_HOCKEY_CREASE_RULE.warningSeconds,
        violationSeconds: DISC_HOCKEY_CREASE_RULE.violationSeconds,
        penaltySeconds: DISC_HOCKEY_CREASE_RULE.penaltySeconds,
        boundaryHysteresis: DISC_HOCKEY_CREASE_RULE.boundaryHysteresis,
        ejectionSeconds: DISC_HOCKEY_CREASE_RULE.ejectionSeconds,
        ejectionPushSeconds: DISC_HOCKEY_CREASE_RULE.ejectionPushSeconds,
        ejectionSpeed: DISC_HOCKEY_CREASE_RULE.ejectionSpeed,
        maximumEjectionAngleDegrees:
          DISC_HOCKEY_CREASE_RULE.maximumEjectionAngleDegrees,
        rightTeamSeconds: round(this.rightTeamCreaseSeconds, 2),
        violations: { ...this.creaseViolations },
        lastViolation: this.lastCreaseViolation
          ? { ...this.lastCreaseViolation }
          : null,
      },
      keyboard: this.playMode === 'local'
        ? { playerOne: 'Arrow keys', playerTwo: 'WASD' }
        : { playerOne: 'Arrow keys', playerTwo: null },
      pauseReason: this.pauseReason,
      audio: arcadeAudio.diagnostics(),
      lastCollisionSound: this.lastCollisionSound
        ? { ...this.lastCollisionSound }
        : null,
      crazyPower: this.isCrazyMode ? {
        energy: round(this.crazyPower.energy, 2),
        armed: this.crazyPower.armed,
        contactCooldownSeconds: round(this.crazyPower.contactCooldownSeconds, 2),
        rechargeDelaySeconds: round(this.crazyPower.rechargeDelaySeconds, 2),
        lastGain: this.crazyPower.lastGain ? { ...this.crazyPower.lastGain } : null,
        lastDrain: this.crazyPower.lastDrain,
        shotSerial: this.crazyPower.shotSerial,
        charging: {
          passivePerSecond: DISC_HOCKEY_CRAZY_POWER.passivePerSecond,
          intentionalHitGain: DISC_HOCKEY_CRAZY_POWER.intentionalHitGain,
          defensiveSaveGain: DISC_HOCKEY_CRAZY_POWER.defensiveSaveGain,
        },
      } : null,
      actions: this.phase === 'result'
        ? ['rematch', 'match setup']
        : this.isPaused ? ['resume', 'restart match', 'leave Disc Hockey'] : [
          'drag on left half',
          ...(this.playMode === 'local' ? ['drag independently on right half'] : []),
          'pause',
        ],
    };
  }

  advanceForTesting(milliseconds = 0) {
    const steps = Math.max(
      1,
      Math.round(Math.max(0, Number(milliseconds) || 0) / (FIXED_STEP * 1000)),
    );
    for (let index = 0; index < steps; index += 1) this.stepGame(FIXED_STEP);
    this.updateVisuals();
    this.updateHud();
    this.game.renderer.preRender();
    this.sys.render(this.game.renderer);
    this.game.renderer.postRender();
  }
}
