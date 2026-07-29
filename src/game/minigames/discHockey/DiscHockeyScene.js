import Phaser from 'phaser';
import { FIXED_STEP, GAME_HEIGHT, GAME_WIDTH } from '../../constants.js';
import { getCharacter, getCharacterName } from '../../content/characters.js';
import { t } from '../../i18n.js';
import { getSceneStageLayout } from '../../layout/tabletStage.js';
import { arcadeAudio } from '../../services/ArcadeAudio.js';
import { playerProfileStore } from '../../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../../stateBridge.js';
import { createButton } from '../../ui/createButton.js';
import { getDiscHockeyCollisionMap } from './discHockeyCollisionMaps.js';
import {
  DISC_HOCKEY_ARENA,
  DISC_HOCKEY_MATCH_SECONDS,
  DISC_HOCKEY_PUCK_SURFACE,
  chooseDiscHockeyAiTarget,
  clampDiscPlayerPosition,
  closestPointOnCollisionContour,
  detectDiscHockeyGoal,
  formatDiscHockeyTime,
  getDiscHockeyAiTuning,
  getDiscHockeyHumanMotion,
  getDiscHockeyMatchResult,
  moveDiscDirectlyTowardTarget,
  moveDiscTowardTarget,
  resolvePlayerPuckCollision,
  sanitizeDiscHockeyMode,
  sanitizeDiscHockeyTheme,
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

const playerSpawn = (side) => ({
  x: side === 'left' ? 330 : 950,
  y: DISC_HOCKEY_ARENA.centerY,
  vx: 0,
  vy: 0,
  radius: DISC_HOCKEY_ARENA.playerRadius,
  side,
  target: null,
  pointerId: null,
});

const puckSpawn = () => ({
  x: DISC_HOCKEY_ARENA.centerX,
  y: DISC_HOCKEY_ARENA.centerY,
  vx: 0,
  vy: 0,
  radius: DISC_HOCKEY_ARENA.puckRadius,
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
    this.themeId = sanitizeDiscHockeyTheme(data.themeId ?? this.profile.discHockey.themeId);
    this.collisionMap = getDiscHockeyCollisionMap(this.themeId);
    this.difficulty = this.profile.difficultyByGame.discHockey;
    this.leftCharacter = getCharacter(this.profile.playerCharacterId);
    this.rightCharacter = getCharacter(this.profile.opponentId);
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
    this.rightPlayer = playerSpawn('right');
    this.puck = puckSpawn();
    this.phase = 'countdown';
    this.countdown = 2.4;
    this.goalPause = 0;
    this.pendingWinner = null;
    this.isPaused = false;
    this.suspended = false;
    this.pauseReason = null;
    this.collisionSoundCooldown = 0;
    this.aiThinkTimer = 0;
    this.aiTarget = { x: this.rightPlayer.x, y: this.rightPlayer.y };
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
    this.rightVisual = this.createDiscVisual(this.rightPlayer, this.rightCharacter);
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
    return { shadow, base, engraving };
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
    this.rightNameText = this.add.text(1020, 34, getCharacterName(this.rightCharacter, this.language).toUpperCase(), {
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
    this.touchPrompt = this.add.text(GAME_WIDTH / 2, DISC_HOCKEY_ARENA.bottom - 18, t(
      this.language,
      this.playMode === 'local'
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
    const player = side === 'left' ? this.leftPlayer : this.rightPlayer;
    player.pointerId = null;
    player.target = null;
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
    this.stepPlayers(dt);
    this.puck = stepPuck({
      puck: this.puck,
      deltaSeconds: dt,
      collisionMap: this.collisionMap,
    });
    [this.leftPlayer, this.rightPlayer].forEach((player) => {
      const collision = resolvePlayerPuckCollision({ player, puck: this.puck });
      if (!collision.collided) return;
      this.puck = this.limitPuckSpeed(collision.puck);
      if (this.collisionSoundCooldown <= 0) {
        arcadeAudio.kick(false);
        this.collisionSoundCooldown = 0.09;
      }
    });
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
    const leftTarget = this.leftPlayer.target ?? leftKeyboardTarget ?? {
      x: this.leftPlayer.x,
      y: this.leftPlayer.y,
    };
    this.leftPlayer = this.moveHumanPlayer(this.leftPlayer, leftTarget, dt);

    let rightTarget;
    if (this.playMode === 'local') {
      const keyboard = this.keyboardTarget(this.rightPlayer, {
        up: this.keys.rightUp,
        down: this.keys.rightDown,
        left: this.keys.rightLeft,
        right: this.keys.rightRight,
      });
      rightTarget = this.rightPlayer.target ?? keyboard ?? {
        x: this.rightPlayer.x,
        y: this.rightPlayer.y,
      };
      this.rightPlayer = this.moveHumanPlayer(this.rightPlayer, rightTarget, dt);
      return;
    } else {
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

  moveHumanPlayer(player, target, dt) {
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
    if (speed <= 920) return puck;
    const scale = 920 / speed;
    return { ...puck, vx: puck.vx * scale, vy: puck.vy * scale };
  }

  scoreGoal(side) {
    if (this.phase !== 'playing') return;
    this.score = { ...this.score, [side]: this.score[side] + 1 };
    this.phase = 'goal';
    this.goalPause = 1.15;
    this.announcementText
      .setText(t(this.language, 'discHockey.goal'))
      .setColor(this.themeId === 'neon' ? '#ffcf35' : '#c52920');
    arcadeAudio.goal();
    this.game.events.emit('platform:haptic', 'success');
    this.updateHud();
  }

  resetRound() {
    const left = playerSpawn('left');
    const right = playerSpawn('right');
    left.pointerId = this.leftPlayer?.pointerId ?? null;
    right.pointerId = this.rightPlayer?.pointerId ?? null;
    this.leftPlayer = left;
    this.rightPlayer = right;
    this.puck = puckSpawn();
    this.aiTarget = { x: right.x, y: right.y };
    this.aiThinkTimer = 0;
    this.pendingWinner = null;
    this.announcementText?.setColor(this.themeId === 'neon' ? '#ffcf35' : '#173d5b');
    this.updateVisuals();
  }

  restartMatch() {
    this.score = { left: 0, right: 0 };
    this.matchSecondsRemaining = DISC_HOCKEY_MATCH_SECONDS;
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
        name: getCharacterName(
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
      this.leftPlayer.pointerId = null;
      this.leftPlayer.target = null;
    }
    if (this.rightPlayer) {
      this.rightPlayer.pointerId = null;
      this.rightPlayer.target = null;
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
      [this.leftPlayer, this.leftVisual],
      [this.rightPlayer, this.rightVisual],
    ].forEach(([player, visual]) => {
      visual.shadow.setPosition(player.x + 2, player.y + 4);
      visual.base.setPosition(player.x, player.y);
      visual.engraving.setPosition(player.x, player.y);
    });
    this.puckBody
      .setPosition(this.puck.x, this.puck.y)
      .setRotation(this.puckRotation);
  }

  updateHud() {
    this.scoreText?.setText(`${this.score.left}  —  ${this.score.right}`);
    this.clockText?.setText(formatDiscHockeyTime(this.matchSecondsRemaining));
    this.touchPrompt?.setVisible(
      this.touchPromptSeconds > 0
      && !this.isPaused
      && this.phase !== 'result',
    );
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
    const playerState = (player, character, controller) => ({
      id: character.id,
      name: getCharacterName(character, this.language),
      controller,
      x: round(player.x),
      y: round(player.y),
      vx: round(player.vx, 2),
      vy: round(player.vy, 2),
      radius: player.radius,
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
    });
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
      difficulty: this.playMode === 'computer' ? this.difficulty : null,
      computerAi: this.playMode === 'computer' ? {
        target: {
          x: round(this.aiTarget.x),
          y: round(this.aiTarget.y),
        },
        tuning: {
          reactionSeconds: getDiscHockeyAiTuning(this.difficulty).reactionSeconds,
          maxSpeed: getDiscHockeyAiTuning(this.difficulty).maxSpeed,
          pressX: getDiscHockeyAiTuning(this.difficulty).pressX,
        },
      } : null,
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
        left: playerState(this.leftPlayer, this.leftCharacter, 'human'),
        right: playerState(
          this.rightPlayer,
          this.rightCharacter,
          this.playMode === 'local' ? 'human' : `computer-${this.difficulty}`,
        ),
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
        surface: {
          damping: DISC_HOCKEY_PUCK_SURFACE.damping,
          softDamping: DISC_HOCKEY_PUCK_SURFACE.softDamping,
          settleSpeed: DISC_HOCKEY_PUCK_SURFACE.settleSpeed,
          wallRestitution: DISC_HOCKEY_PUCK_SURFACE.wallRestitution,
        },
      },
      activePointers: [...this.pointerOwners.entries()].map(([id, side]) => ({ id, side })),
      keyboard: this.playMode === 'local'
        ? { playerOne: 'Arrow keys', playerTwo: 'WASD' }
        : { playerOne: 'Arrow keys', playerTwo: null },
      pauseReason: this.pauseReason,
      audio: arcadeAudio.diagnostics(),
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
