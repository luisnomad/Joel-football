import Phaser from 'phaser';
import { FIXED_STEP, GAME_HEIGHT, GAME_WIDTH } from '../../constants.js';
import { getCharacter, getCharacterName } from '../../content/characters.js';
import {
  CHARACTER_GROUND_ANCHOR_Y,
  CHARACTER_FRAMES,
  ENHANCED_CHARACTER_FRAME_COUNT,
  kickVisualAt,
  runVisualAt,
} from '../../pure/characterAnimation.js';
import { isTouchLayout } from '../../input/isTouchLayout.js';
import { getSceneStageLayout, getWideStageUiScale } from '../../layout/tabletStage.js';
import { t } from '../../i18n.js';
import { arcadeAudio } from '../../services/ArcadeAudio.js';
import { playerProfileStore } from '../../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../../stateBridge.js';
import { createButton } from '../../ui/createButton.js';
import { createConfirmationOverlay } from '../../ui/createConfirmationOverlay.js';
import { createControlIcon } from '../../ui/createControlIcon.js';
import { VirtualJoystick } from '../input/VirtualJoystick.js';
import {
  KICKFALL_CONFIG,
  KICKFALL_GATE_LAYOUT,
  KICKFALL_LEVELS,
  auditKickfallLevel,
  createKickfallLandingGuides,
  createKickfallPauseLayout,
  createKickfallResultLayout,
  createKickfallTiers,
  createKickfallProgress,
  getKickfallLevel,
  getKickfallGateHealth,
  isArmedGateHit,
  isKickfallKickContact,
  resolveKickfallBossCounterWave,
  resolveKickfallChargeTransfer,
  resolveKickfallMagnetPull,
  resolveKickfallVerticalIntent,
  resolveKickfallOutcome,
  stepKickfallFallVelocity,
  stepKickfallJumpBuffer,
  stepKickfallRunCycle,
} from './kickfallRules.js';
import { getKickfallTheme, getKickfallThemeAssets } from './kickfallThemes.js';

const assetUrl = (filename) => `${import.meta.env.BASE_URL}assets/minigames/kickfall/${filename}`;

const CATEGORY = Object.freeze({
  WORLD: 0x0010,
  PLAYER: 0x0020,
  BALL: 0x0040,
  PLAYER_BOUNDARY: 0x0080,
  BALL_BOUNDARY: 0x0100,
});

const PLAYER_HEIGHT = 82;
const PLAYER_WIDTH = 44;
const BALL_RADIUS = 18;
const KICK_DURATION = 0.18;
const KICK_COOLDOWN = 0.38;
const TIER_TRANSFER_SECONDS = 0.32;
const TIER_INPUT_BUFFER_SECONDS = 0.24;
const KICK_FOOT_FORWARD_OFFSET = PLAYER_WIDTH / 2 + 8;
const KICK_FOOT_VERTICAL_OFFSET = PLAYER_HEIGHT / 2 - 17;
const KICK_FOOT_RADIUS = 8;
const BALL_ROLL_SPEED = 7.2;
const BALL_ROLL_RESPONSE = 0.1;
const OBSTACLE_LANE_TOLERANCE = BALL_RADIUS * 1.5;

const round = (value, places = 1) => {
  const factor = 10 ** places;
  return Math.round((Number(value) || 0) * factor) / factor;
};

const tierCenterX = (tier) => tier.left + tier.width / 2;
const tierSurfaceY = (tier, x) => (
  tier.y + Math.tan(tier.angle) * (x - tierCenterX(tier)) - tier.height / 2
);

const playerCenterYOnTier = (tier, x) => tierSurfaceY(tier, x) - PLAYER_HEIGHT / 2 - 0.5;

export class KickfallScene extends Phaser.Scene {
  constructor() {
    super('Kickfall');
    this.accumulator = 0;
  }

  init(data = {}) {
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    this.character = getCharacter(this.profile.playerCharacterId);
    this.rivalCharacter = getCharacter(this.profile.opponentId);
    this.level = getKickfallLevel(data.level ?? this.profile.kickfall.lastPlayedLevel);
    this.levelNumber = this.level.number;
    this.tiers = createKickfallTiers(this.level);
    this.levelAudit = auditKickfallLevel(this.level);
    this.theme = getKickfallTheme(data.themeId ?? this.profile.kickfall?.themeId);
    this.themeId = this.theme.id;
    this.hasNextLevel = this.levelNumber < KICKFALL_LEVELS.length;
    playerProfileStore.setKickfallLastPlayed(this.levelNumber);
    this.loadProgress = 0;
    this.phase = 'assets-loading';
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearActiveScene(this);
      this.matter?.world?.off('collisionactive', this.onCollisionActive, this);
      this.movementJoystick?.destroy();
      this.movementJoystick = null;
      this.unbindKeyboard();
      delete window.__KICKFALL_DEBUG__;
    });
  }

  preload() {
    const background = this.add.graphics();
    background.fillGradientStyle(0x07152d, 0x07152d, 0x210d32, 0x210d32, 1);
    background.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const title = this.add.text(GAME_WIDTH / 2, 280, 'KICKFALL', {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: '66px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#241342',
      strokeThickness: 12,
    }).setOrigin(0.5);
    const track = this.add.rectangle(GAME_WIDTH / 2, 400, 420, 24, 0x061021, 0.82)
      .setStrokeStyle(2, 0x8eeeff, 0.5);
    const fill = this.add.rectangle(GAME_WIDTH / 2 - 204, 400, 0, 14, 0x4adff1, 1).setOrigin(0, 0.5);
    const status = this.add.text(GAME_WIDTH / 2, 446, t(this.language, 'kickfall.loadingAssets'), {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#d6f8ff',
    }).setOrigin(0.5);
    this.loadingObjects = [background, title, track, fill, status];
    this.load.on('progress', (progress) => {
      this.loadProgress = progress;
      fill.width = 408 * progress;
      status.setText(`${t(this.language, 'kickfall.loadingAssets')} ${Math.round(progress * 100)}%`);
    });

    getKickfallThemeAssets(this.themeId).forEach((asset) => {
      if (this.textures.exists(asset.key)) return;
      if (asset.loader === 'svg') {
        this.load.svg(asset.key, assetUrl(asset.asset), { width: asset.width, height: asset.height });
      } else {
        this.load.image(asset.key, assetUrl(asset.asset));
      }
    });
    if (!this.textures.exists('kickfall-ball')) {
      this.load.svg('kickfall-ball', assetUrl('kickfall-ball.svg'), { width: 96, height: 96 });
    }
    if (!this.textures.exists(this.character.sheetTexture)) {
      this.load.spritesheet(this.character.sheetTexture, `${import.meta.env.BASE_URL}assets/${this.character.sheetAsset}`, {
        frameWidth: 320,
        frameHeight: 480,
      });
    }
    if (this.level.boss && !this.textures.exists(this.rivalCharacter.sheetTexture)) {
      this.load.spritesheet(this.rivalCharacter.sheetTexture, `${import.meta.env.BASE_URL}assets/${this.rivalCharacter.sheetAsset}`, {
        frameWidth: 320,
        frameHeight: 480,
      });
    }
  }

  create() {
    this.loadingObjects?.forEach((item) => item.destroy());
    this.loadingObjects = [];
    this.stageLayout = getSceneStageLayout(this);
    this.isTouchLayout = isTouchLayout();
    this.simulationSeconds = 0;
    this.accumulator = 0;
    this.progress = createKickfallProgress();
    this.levelTimeRemaining = this.level.timerSeconds;
    this.countdown = KICKFALL_CONFIG.countdownSeconds;
    this.spawnTimer = 0;
    this.spawnBlocked = false;
    this.goBannerSeconds = 0;
    this.phase = 'countdown';
    this.balls = [];
    this.nextBallId = 1;
    this.gates = [];
    this.obstacles = [];
    this.landingGuides = [];
    this.boss = null;
    this.effects = [];
    this.kickTimer = 0;
    this.kickCooldown = 0;
    this.kickSerial = 0;
    this.lastKickedBallId = null;
    this.facing = 1;
    this.groundedUntil = 0;
    this.runCycle = 0;
    this.visualFrame = CHARACTER_FRAMES.idle;
    this.animationPose = 'idle';
    this.currentTierId = 'top';
    this.tierTransfer = null;
    this.tierDirectionBuffer = 0;
    this.tierDirectionBufferSeconds = 0;
    this.jumpBufferSeconds = 0;
    this.touch = { left: false, right: false, up: false, down: false };
    this.touchPulses = { jump: false, kick: false };
    this.touchObjects = [];
    this.movementJoystick = null;
    this.suspended = false;
    this.isPaused = false;
    this.pauseReason = null;
    this.abandonConfirmation = null;
    this.abandonResumeOnCancel = false;
    this.abandonPreviousPauseReason = null;

    this.matter.world.setGravity(0, 1.55);
    arcadeAudio.setScene('match');
    this.createBackdrop();
    this.createWorld();
    this.createPlayer();
    this.createBoss();
    this.createInput();
    this.createHud();
    this.createTouchControls();
    this.createPauseOverlay();
    this.createResultOverlay();
    this.bindKeyboard();
    this.matter.world.on('collisionactive', this.onCollisionActive, this);
    this.updateHud();
    this.updatePlayerVisual();
    this.installDebugHelpers();
  }

  createBackdrop() {
    const horizontalOverflow = Math.max(0, this.stageLayout.width - GAME_WIDTH);
    const horizontalOffset = horizontalOverflow / 2;
    if (horizontalOverflow >= 24) this.cameras.main.setScroll(-horizontalOffset, 0);
    const backdrop = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, this.theme.textureKeys.backdrop)
      .setDisplaySize(GAME_WIDTH + horizontalOverflow, GAME_HEIGHT)
      .setDepth(-40);
    this.themeLayers = { backdrop, milkyWay: null, moon: null, stars: [] };

    if (this.theme.textureKeys.milkyWay) {
      this.themeLayers.milkyWay = this.add.image(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 + 8,
        this.theme.textureKeys.milkyWay,
      )
        .setDisplaySize(1536 + horizontalOverflow, 864)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.34)
        .setDepth(-38);
    }
    if (this.theme.textureKeys.moon) {
      this.themeLayers.moon = this.add.image(1030, 172, this.theme.textureKeys.moon)
        .setDisplaySize(278, 278)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.62)
        .setDepth(-35);
    }

    if (this.themeId === 'cosmic') {
      const starPositions = [
        [120, 168], [278, 294], [392, 118], [548, 414], [690, 248],
        [842, 506], [1014, 372], [1164, 156], [1222, 452], [748, 96],
      ];
      this.themeLayers.stars = starPositions.map(([x, y], index) => this.add.circle(
        x,
        y,
        index % 3 === 0 ? 2.4 : 1.5,
        index % 2 === 0 ? 0x7cecff : 0xc99bff,
        0.24,
      ).setDepth(-33));
      this.themeFrame = this.add.graphics().setDepth(-3);
      const frameLeft = -horizontalOffset + 18;
      const frameWidth = GAME_WIDTH + horizontalOverflow - 36;
      this.themeFrame.lineStyle(8, this.theme.palette.frameAlt, 0.08);
      this.themeFrame.strokeRoundedRect(frameLeft, 14, frameWidth, GAME_HEIGHT - 28, 34);
      this.themeFrame.lineStyle(2, this.theme.palette.frame, 0.48);
      this.themeFrame.strokeRoundedRect(frameLeft, 14, frameWidth, GAME_HEIGHT - 28, 34);
      this.themeFrame.lineStyle(1, 0xffffff, 0.18);
      this.themeFrame.strokeRoundedRect(frameLeft + 5, 19, frameWidth - 10, GAME_HEIGHT - 38, 30);
    }

    if (this.stageLayout.extraHeight > 0) {
      this.add.rectangle(
        GAME_WIDTH / 2,
        GAME_HEIGHT + this.stageLayout.extraHeight / 2,
        GAME_WIDTH + horizontalOverflow,
        this.stageLayout.extraHeight,
        this.theme.palette.lowerVoid,
        1,
      ).setDepth(-40);
    }
    this.updateThemeMotion();
  }

  updateThemeMotion() {
    if (!this.themeLayers) return;
    const seconds = this.simulationSeconds ?? 0;
    const milkyCycle = this.theme.motion.milkyWayCycleSeconds;
    if (this.themeLayers.milkyWay && milkyCycle > 0) {
      this.themeLayers.milkyWay
        .setRotation((seconds / milkyCycle) * Math.PI * 2)
        .setAlpha(0.32 + Math.sin(seconds * 0.22) * 0.035);
    }
    if (this.themeLayers.moon) {
      const progress = this.level.timerSeconds === null
        ? (1 - Math.cos((seconds / this.theme.motion.moonTravelSeconds) * Math.PI * 2)) / 2
        : Phaser.Math.Clamp(1 - this.levelTimeRemaining / this.level.timerSeconds, 0, 1);
      this.themeLayers.moon
        .setPosition(
          Phaser.Math.Linear(1040, 250, progress),
          178 - Math.sin(progress * Math.PI) * 48,
        )
        .setRotation(Math.sin(progress * Math.PI * 2) * 0.035);
    }
    this.themeLayers.stars.forEach((star, index) => {
      star.setAlpha(0.16 + (Math.sin(seconds * 1.3 + index * 0.77) + 1) * 0.1);
    });
  }

  createWorld() {
    this.tiers.forEach((tier) => {
      const platform = this.matter.add.image(
        tierCenterX(tier),
        tier.y,
        this.theme.textureKeys.platform,
      );
      platform.setDisplaySize(tier.width, this.themeId === 'cosmic' ? 46 : 34);
      platform.setRectangle(tier.width, tier.height);
      platform.setStatic(true);
      platform.setRotation(tier.angle);
      platform.setFriction(0.72, 0, 0);
      platform.setCollisionCategory(CATEGORY.WORLD);
      platform.setCollidesWith([CATEGORY.PLAYER, CATEGORY.BALL]);
      platform.body.label = `kickfall-platform:${tier.id}`;
      platform.setDepth(10);
    });
    this.createLandingGuides();

    this.createBoundary(24, GAME_HEIGHT / 2, 48, GAME_HEIGHT, CATEGORY.WORLD, [CATEGORY.PLAYER, CATEGORY.BALL]);
    this.createBoundary(GAME_WIDTH - 24, GAME_HEIGHT / 2, 48, GAME_HEIGHT, CATEGORY.WORLD, [CATEGORY.PLAYER, CATEGORY.BALL]);
    this.createBoundary(GAME_WIDTH / 2, 8, GAME_WIDTH, 16, CATEGORY.WORLD, [CATEGORY.PLAYER, CATEGORY.BALL]);
    this.createBoundary(138, 674, 24, 96, CATEGORY.PLAYER_BOUNDARY, [CATEGORY.PLAYER]);
    this.createBoundary(175, 130, 14, 104, CATEGORY.BALL_BOUNDARY, [CATEGORY.BALL]);
    this.add.rectangle(175, 130, 10, 104, 0x6eeafa, 0.18)
      .setStrokeStyle(2, 0xbaf8ff, 0.46)
      .setDepth(12);

    KICKFALL_GATE_LAYOUT.forEach((gateLayout) => {
      const tier = this.getTier(gateLayout.tierId);
      const floorY = tierSurfaceY(tier, gateLayout.x);
      const health = getKickfallGateHealth(this.level, gateLayout.id);
      const image = this.matter.add.image(
        gateLayout.x,
        floorY - gateLayout.height / 2,
        this.theme.textureKeys.gate,
      );
      image.setDisplaySize(
        gateLayout.width + (this.themeId === 'cosmic' ? 8 : 0),
        gateLayout.height + (this.themeId === 'cosmic' ? 6 : 0),
      );
      image.setRectangle(gateLayout.width, gateLayout.height);
      image.setStatic(true);
      image.setCollisionCategory(CATEGORY.WORLD);
      image.setCollidesWith([CATEGORY.PLAYER, CATEGORY.BALL]);
      image.body.label = `kickfall-gate:${gateLayout.id}`;
      image.setDepth(18);
      this.gates.push({
        ...gateLayout,
        x: gateLayout.x,
        y: floorY - gateLayout.height / 2,
        health,
        maxHealth: health,
        active: true,
        image,
        healthPips: this.createGateHealthPips(gateLayout.x, floorY - gateLayout.height - 8, health),
      });
    });

    this.level.obstacles.forEach((obstacleLayout) => this.createObstacle(obstacleLayout));
  }

  createLandingGuides() {
    this.landingGuides = createKickfallLandingGuides(this.tiers).map((guide) => {
      const visual = this.add.graphics().setDepth(13);
      visual.fillStyle(this.theme.palette.platformBody, 0.98);
      visual.fillTriangle(
        guide.entryX,
        guide.surfaceY - guide.height,
        guide.entryX,
        guide.surfaceY,
        guide.exitX,
        guide.surfaceY,
      );
      visual.lineStyle(2, this.theme.palette.platformAccent, 0.9);
      visual.strokeTriangle(
        guide.entryX,
        guide.surfaceY - guide.height,
        guide.entryX,
        guide.surfaceY,
        guide.exitX,
        guide.surfaceY,
      );
      if (this.themeId === 'cosmic') {
        visual.lineStyle(1, this.theme.palette.platformAccent, 0.42);
        for (let row = 1; row <= 3; row += 1) {
          const progress = row / 4;
          const y = guide.surfaceY - guide.height + guide.height * progress;
          const slopeX = guide.entryX + guide.flow * guide.width * progress;
          visual.lineBetween(guide.entryX, y, slopeX, y);
        }
      }
      visual.lineStyle(3, this.theme.palette.platformEdge, 0.72);
      visual.lineBetween(
        guide.entryX,
        guide.surfaceY - guide.height,
        guide.exitX,
        guide.surfaceY,
      );
      const body = this.matter.add.rectangle(
        guide.centerX,
        guide.centerY,
        guide.rampLength,
        12,
        {
          isStatic: true,
          angle: guide.angle,
          friction: 0.28,
          label: `kickfall-flat-entry:${guide.tierId}`,
        },
      );
      body.collisionFilter.category = CATEGORY.WORLD;
      body.collisionFilter.mask = CATEGORY.BALL;
      const wallBody = this.matter.add.rectangle(
        guide.wallX,
        guide.wallY,
        guide.wallWidth,
        guide.height,
        {
          isStatic: true,
          friction: 0.28,
          label: `kickfall-flat-entry-wall:${guide.tierId}`,
        },
      );
      wallBody.collisionFilter.category = CATEGORY.WORLD;
      wallBody.collisionFilter.mask = CATEGORY.BALL;
      return { ...guide, visual, body, wallBody };
    });
  }

  getTier(id) {
    return this.tiers.find((tier) => tier.id === id);
  }

  createGateHealthPips(x, y, health) {
    if (health <= 1) return [];
    const spacing = 14;
    return Array.from({ length: health }, (_, index) => this.add.circle(
      x + (index - (health - 1) / 2) * spacing,
      y,
      4,
      this.theme.palette.gateEnergy,
      0.95,
    ).setStrokeStyle(1, this.theme.palette.void, 0.9).setDepth(19));
  }

  createObstacle(layout) {
    const tier = this.getTier(layout.tierId);
    const surfaceY = tierSurfaceY(tier, layout.x);
    const visualObjects = [];
    if (layout.type === 'pocket') {
      const catchRail = this.add.image(layout.x, surfaceY + 11.5, this.theme.textureKeys.catchRail)
        .setDisplaySize(144, 36)
        .setRotation(tier.angle)
        .setDepth(18);
      const label = this.add.text(layout.x, surfaceY - 54, t(this.language, 'kickfall.obstaclePocket'), {
        fontFamily: 'Arial Rounded MT Bold, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#8ff8ff',
        stroke: '#071426',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(19);
      visualObjects.push(catchRail, label);
    } else {
      const glow = this.add.ellipse(layout.x, surfaceY - 5, 88, 22, this.theme.palette.cleat, 0.12)
        .setRotation(tier.angle)
        .setDepth(16);
      const bumper = this.add.image(layout.x, surfaceY - 12, this.theme.textureKeys.cleat)
        .setDisplaySize(82, 29)
        .setRotation(tier.angle)
        .setDepth(18);
      visualObjects.push(glow, bumper);
      visualObjects.push(this.add.text(layout.x, surfaceY - 50, t(this.language, 'kickfall.obstacleKick'), {
        fontFamily: 'Arial Rounded MT Bold, sans-serif',
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#ffe58b',
        stroke: '#301208',
        strokeThickness: 4,
      }).setOrigin(0.5).setDepth(19));
    }
    this.obstacles.push({
      ...layout,
      flow: tier.flow,
      holdX: layout.type === 'pocket'
        ? layout.x
        : layout.x - tier.flow * (BALL_RADIUS + 15),
      holdY: surfaceY - BALL_RADIUS - 1,
      visualObjects,
      releasedBalls: 0,
      stalledBallId: null,
    });
  }

  createBoundary(x, y, width, height, category, collidesWith) {
    const boundary = this.matter.add.rectangle(x, y, width, height, {
      isStatic: true,
      label: category === CATEGORY.PLAYER_BOUNDARY ? 'kickfall-player-boundary' : 'kickfall-boundary',
    });
    boundary.collisionFilter.category = category;
    boundary.collisionFilter.mask = collidesWith.reduce((mask, value) => mask | value, 0);
    return boundary;
  }

  createPlayer() {
    const topTier = this.getTier('top');
    const x = 92;
    const y = playerCenterYOnTier(topTier, x);
    this.player = this.matter.add.sprite(x, y, this.character.sheetTexture, 0);
    this.player.setDisplaySize(84, 126);
    this.player.setRectangle(PLAYER_WIDTH, PLAYER_HEIGHT, { chamfer: { radius: 13 } });
    this.player.setOrigin(0.5, 0.5);
    this.player.setDisplayOrigin(
      this.player.width / 2,
      CHARACTER_GROUND_ANCHOR_Y - (PLAYER_HEIGHT / 2) / this.player.scaleY,
    );
    this.player.setFixedRotation();
    this.player.setFriction(0.36, 0.02, 0);
    this.player.setFrictionAir(0.016);
    this.player.setBounce(0.01);
    this.player.setCollisionCategory(CATEGORY.PLAYER);
    this.player.setCollidesWith([CATEGORY.WORLD, CATEGORY.BALL, CATEGORY.PLAYER_BOUNDARY]);
    this.player.body.label = 'kickfall-player';
    this.player.setDepth(24);
    this.playerHasEnhancedSheet = this.player.texture.frameTotal >= ENHANCED_CHARACTER_FRAME_COUNT;
    this.setFacing(1);
  }

  createBoss() {
    if (!this.level.boss) return;
    const tier = this.getTier('bottom');
    const x = this.level.boss.startX;
    const y = playerCenterYOnTier(tier, x);
    const sprite = this.matter.add.sprite(x, y, this.rivalCharacter.sheetTexture, CHARACTER_FRAMES.idle);
    sprite.setDisplaySize(84, 126);
    sprite.setRectangle(PLAYER_WIDTH, PLAYER_HEIGHT, { chamfer: { radius: 13 } });
    sprite.setOrigin(0.5, 0.5);
    sprite.setDisplayOrigin(
      sprite.width / 2,
      CHARACTER_GROUND_ANCHOR_Y - (PLAYER_HEIGHT / 2) / sprite.scaleY,
    );
    sprite.setFixedRotation();
    sprite.setStatic(true);
    sprite.setCollisionCategory(CATEGORY.WORLD);
    sprite.setCollidesWith([CATEGORY.PLAYER, CATEGORY.BALL]);
    sprite.body.label = 'kickfall-boss';
    sprite.setFlipX(-tier.flow !== this.rivalCharacter.nativeFacing);
    sprite.setDepth(25);
    this.boss = {
      sprite,
      health: this.level.boss.hits,
      maxHealth: this.level.boss.hits,
      active: true,
      defeated: false,
      kickCooldown: this.level.boss.kickIntervalSeconds * 0.55,
      kickTimer: 0,
      pushDistance: (x - 185) / this.level.boss.hits,
    };
  }

  createInput() {
    this.keys = this.input.keyboard.addKeys({
      leftA: 'A',
      leftArrow: 'LEFT',
      rightD: 'D',
      rightArrow: 'RIGHT',
      tierUpW: 'W',
      tierUpArrow: 'UP',
      tierDownS: 'S',
      tierDownArrow: 'DOWN',
      jumpSpace: 'SPACE',
      kickX: 'X',
      kickK: 'K',
    });
  }

  createHud() {
    this.add.rectangle(0, 0, GAME_WIDTH, 76, this.theme.palette.hud, 0.88).setOrigin(0).setDepth(60);
    this.add.text(GAME_WIDTH / 2, 28, 'KICKFALL', {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: this.themeId === 'cosmic' ? '#25143f' : '#40204f',
      strokeThickness: 7,
    }).setOrigin(0.5).setDepth(62);
    this.progressText = this.add.text(1055, 28, '', {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: '19px',
      fontStyle: 'bold',
      color: '#dffaff',
      align: 'right',
    }).setOrigin(1, 0.5).setDepth(62);
    this.gatesText = this.add.text(1080, 53, '', {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#ffc86e',
      align: 'right',
    }).setOrigin(1, 0.5).setDepth(62);
    this.levelText = this.add.text(182, 26, '', {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: this.themeId === 'cosmic' ? '#ffc76f' : '#ffdb72',
    }).setOrigin(0, 0.5).setDepth(62);
    this.timerText = this.add.text(182, 52, '', {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: '19px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#351227',
      strokeThickness: 4,
    }).setOrigin(0, 0.5).setDepth(62);
    this.bossText = this.add.text(830, 53, '', {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: '13px',
      fontStyle: 'bold',
      color: this.themeId === 'cosmic' ? '#ffad7b' : '#ff9eb3',
      stroke: '#351227',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(62).setVisible(Boolean(this.boss));
    this.pauseButton = createButton(this, {
      x: 92,
      y: 38,
      width: 142,
      height: 46,
      label: t(this.language, 'kickfall.pause'),
      color: this.themeId === 'cosmic' ? 0x173d65 : 0x1a4868,
      onPress: () => this.togglePause(),
    });
    [this.pauseButton.shadow, this.pauseButton.background, this.pauseButton.text, this.pauseButton.zone]
      .forEach((item) => item.setDepth(64));

    this.announcementText = this.add.text(GAME_WIDTH / 2, 126, '', {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: '56px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#172544',
      strokeThickness: 10,
      align: 'center',
    }).setOrigin(0.5).setDepth(70);
  }

  createTouchControls() {
    if (!this.isTouchLayout) return;
    const horizontalOffset = Math.max(0, this.stageLayout.width - GAME_WIDTH) / 2;
    const bottomOffset = this.stageLayout.bottomOffset;
    const uiScale = getWideStageUiScale(this.stageLayout);
    this.movementJoystick = new VirtualJoystick(this, {
      x: 160 + horizontalOffset,
      y: 635 + bottomOffset,
      radius: 82 * uiScale,
      thumbRadius: 32 * uiScale,
      interactionRadius: 110 * uiScale,
      deadZone: 0.24,
      accent: 0x50d8ef,
      onChange: ({ left, right, up, down }) => {
        Object.assign(this.touch, { left, right, up, down });
      },
    });
    this.addTouchButton(1035 + horizontalOffset, 625 + bottomOffset, 50, 'jump', 'jump', 'pulse', 0x36d7c2);
    this.addTouchButton(1170 + horizontalOffset, 645 + bottomOffset, 60, 'kick', 'kick', 'pulse', 0xff5b78);
  }

  addTouchButton(x, y, radius, icon, action, behavior, accent) {
    const uiScale = getWideStageUiScale(this.stageLayout);
    radius *= uiScale;
    const shadow = this.add.circle(x, y + 5, radius + 3, 0x04101e, 0.2).setDepth(85);
    const surface = this.add.circle(x, y, radius, 0xdaf7ff, 0.12)
      .setStrokeStyle(2, accent, 0.48)
      .setDepth(86);
    const rim = this.add.circle(x, y, radius - 6, accent, 0.035)
      .setStrokeStyle(1, 0xffffff, 0.22)
      .setDepth(86.5);
    const symbol = createControlIcon(this, {
      x,
      y,
      size: radius * 0.72,
      icon,
      depth: 87,
      alpha: 0.78,
    });
    const zone = this.add.zone(x, y, radius * 2, radius * 2).setDepth(88).setInteractive({ useHandCursor: true });
    const visuals = [shadow, surface, rim, symbol, zone];
    this.touchObjects.push(...visuals);
    const scalableObjects = [surface, rim, symbol].map((item) => ({
      item,
      scaleX: item.scaleX,
      scaleY: item.scaleY,
    }));
    const setScale = (scale) => scalableObjects.forEach(({ item, scaleX, scaleY }) => {
      item.setScale(scaleX * scale, scaleY * scale);
    });
    const release = () => {
      setScale(1);
      if (behavior === 'hold') this.touch[action] = false;
    };
    zone.on('pointerdown', () => {
      setScale(0.92);
      this.game.events.emit('platform:haptic', 'light');
      if (behavior === 'hold') this.touch[action] = true;
      else this.touchPulses[action] = true;
    });
    zone.on('pointerup', release);
    zone.on('pointerout', release);
    zone.on('pointerupoutside', release);
  }

  createPauseOverlay() {
    const layout = createKickfallPauseLayout();
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, this.stageLayout.height, 0x030713, 0.7)
      .setOrigin(0)
      .setInteractive();
    const panelShadow = this.add.rectangle(
      layout.panel.x,
      layout.panel.y + 10,
      layout.panel.width,
      layout.panel.height,
      0x020711,
      0.62,
    );
    const panel = this.add.rectangle(
      layout.panel.x,
      layout.panel.y,
      layout.panel.width,
      layout.panel.height,
      0x0b1930,
      0.98,
    ).setStrokeStyle(2, 0x79eaf8, 0.58);
    const accent = this.add.rectangle(
      layout.panel.x,
      layout.panel.y - layout.panel.height / 2,
      176,
      4,
      0x79eaf8,
      0.9,
    );
    const title = this.add.text(layout.title.x, layout.title.y, t(this.language, 'kickfall.paused'), {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: `${layout.title.fontSize}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#23163c',
      strokeThickness: 6,
    }).setOrigin(0.5);
    const copy = this.add.text(layout.copy.x, layout.copy.y, t(this.language, 'kickfall.pauseCopy'), {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: `${layout.copy.fontSize}px`,
      fontStyle: 'bold',
      color: '#bdd9ee',
      align: 'center',
      wordWrap: { width: layout.copy.wrapWidth, useAdvancedWrap: true },
    }).setOrigin(0.5);
    this.pauseOverlay = this.add.container(0, 0, [shade, panelShadow, panel, accent, title, copy])
      .setDepth(100)
      .setVisible(false);
    const buttonLayout = Object.fromEntries(layout.buttons.map((button) => [button.id, button]));
    this.pauseMenuButtons = [
      createButton(this, {
        ...buttonLayout.resume,
        label: t(this.language, 'kickfall.resumeGame'),
        color: 0x2a9eb5,
        onPress: () => this.togglePause(),
      }),
      createButton(this, {
        ...buttonLayout.restart,
        label: t(this.language, 'kickfall.restartLevel'),
        color: 0x705cff,
        onPress: () => this.restartLevel(),
      }),
      createButton(this, {
        ...buttonLayout.leave,
        label: t(this.language, 'kickfall.leave'),
        color: 0xa34457,
        onPress: () => this.abandonKickfall(),
      }),
    ];
    this.pauseMenuButtons.forEach((button) => {
      [button.shadow, button.background, button.text, button.zone].forEach((item) => item.setDepth(101));
      button.setVisible(false);
    });
  }

  createResultOverlay() {
    const layout = createKickfallResultLayout({ victory: true, hasNext: true });
    const shade = this.add.rectangle(0, 0, GAME_WIDTH, this.stageLayout.height, 0x030713, 0.8)
      .setOrigin(0)
      .setDepth(110)
      .setInteractive();
    const panelShadow = this.add.rectangle(
      layout.panel.x,
      layout.panel.y + 12,
      layout.panel.width,
      layout.panel.height,
      0x020711,
      0.68,
    ).setDepth(111);
    this.resultPanel = this.add.rectangle(
      layout.panel.x,
      layout.panel.y,
      layout.panel.width,
      layout.panel.height,
      0x0b1930,
      0.98,
    )
      .setStrokeStyle(2, 0x79eaf8, 0.62)
      .setDepth(111);
    const accent = this.add.rectangle(
      layout.panel.x,
      layout.panel.y - layout.panel.height / 2,
      190,
      4,
      0x79eaf8,
      0.92,
    ).setDepth(112);
    this.resultTitle = this.add.text(layout.title.x, layout.title.y, '', {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: `${layout.title.fontSize}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#23163c',
      strokeThickness: 7,
    }).setOrigin(0.5).setDepth(112);
    this.resultCopy = this.add.text(layout.copy.x, layout.copy.y, '', {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: `${layout.copy.fontSize}px`,
      fontStyle: 'bold',
      color: '#d7efff',
      align: 'center',
      lineSpacing: 7,
      wordWrap: { width: layout.copy.wrapWidth, useAdvancedWrap: true },
    }).setOrigin(0.5).setDepth(112);
    const progressPlate = this.add.rectangle(
      layout.progress.x,
      layout.progress.y,
      layout.progress.width,
      layout.progress.height,
      0x061226,
      0.86,
    ).setStrokeStyle(1, 0xffcf70, 0.32).setDepth(112);
    this.resultProgress = this.add.text(layout.progress.x, layout.progress.y, '', {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: `${layout.progress.fontSize}px`,
      fontStyle: 'bold',
      color: '#ffcf70',
    }).setOrigin(0.5).setDepth(113);
    this.resultObjects = [
      shade,
      panelShadow,
      this.resultPanel,
      accent,
      this.resultTitle,
      this.resultCopy,
      progressPlate,
      this.resultProgress,
    ];
    this.resultObjects.forEach((item) => item.setVisible(false));
    const buttonLayout = Object.fromEntries(layout.buttons.map((button) => [button.id, button]));
    this.retryButton = createButton(this, {
      ...buttonLayout.retry,
      label: t(this.language, 'kickfall.retry'),
      color: 0x705cff,
      onPress: () => this.restartLevel(),
    });
    this.continueButton = createButton(this, {
      ...buttonLayout.continue,
      label: t(this.language, 'kickfall.continue'),
      color: 0x168f78,
      onPress: () => this.continueLevel(),
    });
    this.resultMenuButton = createButton(this, {
      ...buttonLayout.menu,
      label: t(this.language, 'kickfall.mainMenu'),
      color: 0x1d3c60,
      onPress: () => this.leaveKickfall(),
    });
    [this.retryButton, this.continueButton, this.resultMenuButton].forEach((button) => {
      [button.shadow, button.background, button.text, button.zone].forEach((item) => item.setDepth(114));
      button.setVisible(false);
    });
  }

  bindKeyboard() {
    this.onEscapeKey = (event) => {
      if (event?.key !== 'Escape' || event.repeat) return;
      event.preventDefault();
      if (this.abandonConfirmation) {
        this.closeAbandonConfirmation();
        return;
      }
      if (this.phase === 'victory' || this.phase === 'defeat') this.leaveKickfall();
      else this.togglePause();
    };
    this.onPauseKey = (event) => {
      if (event?.key?.toLowerCase() !== 'p' || event.repeat) return;
      event.preventDefault();
      this.togglePause();
    };
    this.onRestartKey = (event) => {
      if (event.repeat) return;
      event.preventDefault();
      if (this.abandonConfirmation) return;
      this.restartLevel();
    };
    window.addEventListener('keydown', this.onEscapeKey);
    window.addEventListener('keydown', this.onPauseKey);
    this.input.keyboard.on('keydown-R', this.onRestartKey);
  }

  unbindKeyboard() {
    window.removeEventListener('keydown', this.onEscapeKey);
    window.removeEventListener('keydown', this.onPauseKey);
    if (!this.input?.keyboard) return;
    if (this.onRestartKey) this.input.keyboard.off('keydown-R', this.onRestartKey);
  }

  togglePause() {
    if (this.abandonConfirmation) {
      this.closeAbandonConfirmation();
      return;
    }
    this.setPaused(!this.isPaused);
  }

  setPaused(paused, { playSound = true, reason = 'manual' } = {}) {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    this.isPaused = Boolean(paused);
    this.pauseReason = this.isPaused ? reason : null;
    this.pauseOverlay.setVisible(this.isPaused);
    this.setPauseMenuButtonsVisible(this.isPaused);
    this.setTouchControlsVisible(!this.isPaused);
    if (this.isPaused) this.matter.world.pause();
    else if (!this.suspended) this.matter.world.resume();
    if (playSound) arcadeAudio.click();
  }

  setPauseMenuButtonsVisible(visible) {
    this.pauseMenuButtons?.forEach((button) => button.setVisible(visible));
  }

  abandonKickfall() {
    if (this.phase === 'victory' || this.phase === 'defeat') {
      this.leaveKickfall();
      return;
    }
    if (this.abandonConfirmation) return;
    this.abandonResumeOnCancel = !this.isPaused;
    this.abandonPreviousPauseReason = this.pauseReason;
    if (this.abandonResumeOnCancel) {
      this.isPaused = true;
      this.pauseReason = 'abandon-confirm';
      this.matter.world.pause();
    }
    this.pauseOverlay.setVisible(false);
    this.setPauseMenuButtonsVisible(false);
    this.setTouchControlsVisible(false);
    this.abandonConfirmation = createConfirmationOverlay(this, {
      title: t(this.language, 'kickfall.leaveConfirmTitle'),
      message: t(this.language, 'kickfall.leaveConfirmCopy'),
      cancelLabel: t(this.language, 'kickfall.leaveStay'),
      confirmLabel: t(this.language, 'kickfall.leaveConfirm'),
      onCancel: () => this.closeAbandonConfirmation(),
      onConfirm: () => this.leaveKickfall(),
    });
    arcadeAudio.click();
  }

  closeAbandonConfirmation() {
    if (!this.abandonConfirmation) return false;
    this.abandonConfirmation.destroy();
    this.abandonConfirmation = null;
    if (this.abandonResumeOnCancel) {
      this.isPaused = false;
      this.pauseReason = null;
      if (!this.suspended) this.matter.world.resume();
    } else {
      this.pauseReason = this.abandonPreviousPauseReason;
    }
    this.abandonResumeOnCancel = false;
    this.abandonPreviousPauseReason = null;
    const showPauseMenu = this.isPaused && this.phase !== 'victory' && this.phase !== 'defeat';
    this.pauseOverlay.setVisible(showPauseMenu);
    this.setPauseMenuButtonsVisible(showPauseMenu);
    this.setTouchControlsVisible(!this.isPaused && !this.suspended);
    arcadeAudio.click();
    return true;
  }

  onCollisionActive(event) {
    if (!this.player?.body) return;
    event.pairs.forEach((pair) => {
      const playerIsA = pair.bodyA === this.player.body || pair.bodyA.parent === this.player.body;
      const playerIsB = pair.bodyB === this.player.body || pair.bodyB.parent === this.player.body;
      if (!playerIsA && !playerIsB) return;
      const other = playerIsA ? pair.bodyB : pair.bodyA;
      const label = other.label || other.parent?.label || '';
      if (!label.startsWith('kickfall-platform:')) return;
      if (this.player.y <= other.bounds.min.y + 24 && this.player.body.velocity.y >= -1.2) {
        this.groundedUntil = this.simulationSeconds + 0.11;
        this.currentTierId = label.split(':')[1] || this.currentTierId;
      }
    });
  }

  update(_time, deltaMilliseconds) {
    const dt = Math.min(0.05, deltaMilliseconds / 1000);
    this.accumulator += dt;
    while (this.accumulator >= FIXED_STEP) {
      this.stepGame(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
    this.updateHud();
  }

  stepGame(dt) {
    if (
      this.suspended
      || this.isPaused
      || this.phase === 'assets-loading'
      || !this.keys
      || !this.player
      || this.phase === 'victory'
      || this.phase === 'defeat'
    ) return;
    this.simulationSeconds += dt;
    this.updateThemeMotion();
    this.kickTimer = Math.max(0, this.kickTimer - dt);
    this.kickCooldown = Math.max(0, this.kickCooldown - dt);
    this.stepPlayer(dt);
    this.updateEffects(dt);

    if (this.phase === 'countdown') {
      this.countdown = Math.max(0, this.countdown - dt);
      this.announcementText.setText(String(Math.max(1, Math.ceil(this.countdown))));
      if (this.countdown <= 0) {
        this.phase = 'playing';
        this.goBannerSeconds = 0.65;
        this.announcementText.setText(t(this.language, 'kickfall.go'));
        this.spawnTimer = 0;
      }
      this.updatePlayerVisual(dt);
      return;
    }

    if (this.goBannerSeconds > 0) {
      this.goBannerSeconds = Math.max(0, this.goBannerSeconds - dt);
      if (this.goBannerSeconds === 0) this.announcementText.setText('');
    }

    if (this.level.timerSeconds !== null) {
      this.levelTimeRemaining = Math.max(0, this.levelTimeRemaining - dt);
    }

    this.stepSpawner(dt);
    this.stepBalls(dt);
    this.stepLandingGuides();
    this.stepObstacles(dt);
    this.stepBallChargeTransfers();
    this.stepGateContacts();
    this.stepBoss(dt);
    this.updatePlayerVisual(dt);

    const outcome = resolveKickfallOutcome({
      spawned: this.progress.spawned,
      quota: this.level.ballQuota,
      drained: this.progress.drained,
      activeBalls: this.balls.length,
      timeRemaining: this.levelTimeRemaining,
      bossRequired: Boolean(this.level.boss),
      bossDefeated: this.boss?.defeated ?? true,
    });
    if (outcome) this.finishRun(outcome);
  }

  sampleInput() {
    const { JustDown } = Phaser.Input.Keyboard;
    const left = this.keys.leftA.isDown || this.keys.leftArrow.isDown || this.touch.left;
    const right = this.keys.rightD.isDown || this.keys.rightArrow.isDown || this.touch.right;
    const upHeld = this.keys.tierUpW.isDown || this.keys.tierUpArrow.isDown || this.touch.up;
    const downHeld = this.keys.tierDownS.isDown || this.keys.tierDownArrow.isDown || this.touch.down;
    const jumpPressed = JustDown(this.keys.jumpSpace) || this.consumeTouchPulse('jump');
    const kick = JustDown(this.keys.kickX)
      || JustDown(this.keys.kickK)
      || this.consumeTouchPulse('kick');
    const verticalIntent = resolveKickfallVerticalIntent({ jumpPressed, upHeld, downHeld });
    return {
      move: Number(right) - Number(left),
      jumpPressed,
      ...verticalIntent,
      kick,
    };
  }

  consumeTouchPulse(action) {
    const value = this.touchPulses[action];
    this.touchPulses[action] = false;
    return value;
  }

  stepPlayer(dt) {
    const input = this.sampleInput();
    if (this.tierTransfer) {
      this.stepTierTransfer(dt);
      return;
    }
    this.jumpBufferSeconds = stepKickfallJumpBuffer({
      seconds: this.jumpBufferSeconds,
      jumpPressed: input.jumpPressed,
      dt,
    });
    if (input.tierDirection) {
      this.tierDirectionBuffer = input.tierDirection;
      this.tierDirectionBufferSeconds = TIER_INPUT_BUFFER_SECONDS;
    } else {
      this.tierDirectionBufferSeconds = Math.max(0, this.tierDirectionBufferSeconds - dt);
      if (this.tierDirectionBufferSeconds === 0) this.tierDirectionBuffer = 0;
    }
    const grounded = this.isPlayerGrounded();
    if (this.tierDirectionBuffer && grounded) {
      if (this.requestTierTransfer(this.tierDirectionBuffer)) {
        this.tierDirectionBuffer = 0;
        this.tierDirectionBufferSeconds = 0;
        this.jumpBufferSeconds = 0;
        return;
      }
      this.tierDirectionBuffer = 0;
      this.tierDirectionBufferSeconds = 0;
    }

    if (input.move) {
      this.setFacing(input.move);
      const maxSpeed = 12.5 * this.character.stats.speed;
      const response = grounded ? 0.34 : 0.2;
      this.player.setVelocityX(Phaser.Math.Linear(
        this.player.body.velocity.x,
        input.move * maxSpeed,
        response,
      ));
    } else if (grounded) {
      this.player.setVelocityX(this.player.body.velocity.x * 0.7);
    }

    if (this.jumpBufferSeconds > 0 && grounded) {
      this.player.setVelocityY(-10.4 * (0.9 + this.character.stats.jump * 0.1));
      this.groundedUntil = 0;
      this.jumpBufferSeconds = 0;
      this.game.events.emit('platform:haptic', 'light');
    }
    if (!grounded && this.player.body.velocity.y > -2.5) {
      this.player.setVelocityY(stepKickfallFallVelocity({
        velocityY: this.player.body.velocity.y,
      }));
    }
    if (input.kick && this.kickCooldown <= 0) this.startKick();

    if (this.player.x < 58) {
      this.player.setX(58);
      this.player.setVelocityX(Math.max(0, this.player.body.velocity.x));
    } else if (this.player.x > GAME_WIDTH - 58) {
      this.player.setX(GAME_WIDTH - 58);
      this.player.setVelocityX(Math.min(0, this.player.body.velocity.x));
    }
    if (this.player.y > GAME_HEIGHT + 80) this.recoverPlayer();

    if (Math.abs(this.player.body.velocity.x) > 0.55 && grounded) {
      this.runCycle = stepKickfallRunCycle({
        cycle: this.runCycle,
        dt,
        speed: this.player.body.velocity.x,
        maxSpeed: 12.5 * this.character.stats.speed,
      });
    } else if (!grounded) {
      this.runCycle = 0;
    }
  }

  requestTierTransfer(direction) {
    const currentIndex = this.tiers.findIndex((tier) => tier.id === this.currentTierId);
    const targetIndex = currentIndex + Math.sign(direction);
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= this.tiers.length) return false;
    const targetTier = this.tiers[targetIndex];
    const edgePadding = PLAYER_WIDTH / 2 + 14;
    const baseTargetX = Phaser.Math.Clamp(
      this.player.x,
      targetTier.left + edgePadding,
      targetTier.left + targetTier.width - edgePadding,
    );
    const candidateXs = [0, -72, 72, -132, 132]
      .map((offset) => Phaser.Math.Clamp(
        baseTargetX + offset,
        targetTier.left + edgePadding,
        targetTier.left + targetTier.width - edgePadding,
      ))
      .filter((x, index, values) => values.indexOf(x) === index);
    const landing = candidateXs
      .map((x) => ({ x, y: playerCenterYOnTier(targetTier, x) }))
      .find(({ x, y }) => this.isTierTransferCorridorClear(x, y));
    if (!landing) {
      this.cameras.main.shake(80, 0.002);
      return false;
    }
    const targetX = landing.x;
    const targetY = landing.y;

    this.tierTransfer = {
      elapsed: 0,
      duration: TIER_TRANSFER_SECONDS,
      fromX: this.player.x,
      fromY: this.player.y,
      toX: targetX,
      toY: targetY,
      targetTierId: targetTier.id,
      direction: Math.sign(direction),
    };
    this.player.setVelocity(0, 0);
    this.player.setStatic(true);
    this.player.setSensor(true);
    this.groundedUntil = 0;
    this.game.events.emit('platform:haptic', 'light');
    return true;
  }

  isTierTransferCorridorClear(targetX, targetY) {
    const corridorMinY = Math.min(this.player.y, targetY) - PLAYER_HEIGHT / 2;
    const corridorMaxY = Math.max(this.player.y, targetY) + PLAYER_HEIGHT / 2;
    const blockedByGate = this.gates.some((gate) => (
      gate.active
      && Math.abs(gate.x - targetX) <= gate.width / 2 + PLAYER_WIDTH / 2 + 6
      && gate.y + gate.height / 2 >= corridorMinY
      && gate.y - gate.height / 2 <= corridorMaxY
    ));
    const blockedByBall = this.balls.some((ball) => (
      Math.abs(ball.body.x - targetX) <= ball.radius + PLAYER_WIDTH / 2 + 4
      && ball.body.y + ball.radius >= corridorMinY
      && ball.body.y - ball.radius <= corridorMaxY
    ));
    return !blockedByGate && !blockedByBall;
  }

  stepTierTransfer(dt) {
    const transfer = this.tierTransfer;
    if (!transfer) return;
    transfer.elapsed = Math.min(transfer.duration, transfer.elapsed + dt);
    const progress = transfer.elapsed / transfer.duration;
    const eased = Phaser.Math.Easing.Sine.InOut(progress);
    const arc = Math.sin(progress * Math.PI) * 24;
    this.player.setPosition(
      Phaser.Math.Linear(transfer.fromX, transfer.toX, eased),
      Phaser.Math.Linear(transfer.fromY, transfer.toY, eased) - arc,
    );
    if (progress < 1) return;

    this.player.setSensor(false);
    this.player.setStatic(false);
    this.player.setFixedRotation();
    this.player.setVelocity(0, 0);
    this.currentTierId = transfer.targetTierId;
    this.groundedUntil = this.simulationSeconds + 0.16;
    this.tierTransfer = null;
  }

  recoverPlayer() {
    const bottom = this.getTier('bottom');
    const x = 240;
    this.player.setPosition(x, playerCenterYOnTier(bottom, x));
    this.player.setVelocity(0, 0);
    this.currentTierId = 'bottom';
  }

  startKick() {
    this.kickTimer = KICK_DURATION;
    this.kickCooldown = KICK_COOLDOWN;
    this.kickSerial += 1;
    this.lastKickedBallId = null;
    const candidates = this.balls
      .map((ball) => ({
        ball,
        distance: Math.hypot(ball.body.x - this.player.x, ball.body.y - this.player.y),
      }))
      .filter(({ ball }) => isKickfallKickContact({
        playerX: this.player.x,
        playerY: this.player.y,
        facing: this.facing,
        ballX: ball.body.x,
        ballY: ball.body.y,
        ballRadius: ball.radius,
        footForwardOffset: KICK_FOOT_FORWARD_OFFSET,
        footVerticalOffset: KICK_FOOT_VERTICAL_OFFSET,
        footRadius: KICK_FOOT_RADIUS,
      }))
      .sort((a, b) => Number(Boolean(b.ball.stalledObstacleId))
        - Number(Boolean(a.ball.stalledObstacleId))
        || a.distance - b.distance);
    const target = candidates[0]?.ball;
    if (!target) return false;
    const kickScale = 0.9 + this.character.stats.kick * 0.1;
    if (target.body.body.isStatic) target.body.setStatic(false);
    target.body.setVelocity(this.facing * 14.2 * kickScale, -2.5);
    target.body.setAngularVelocity(this.facing * 0.22);
    target.armedUntil = this.simulationSeconds + KICKFALL_CONFIG.armedSeconds;
    target.impactPower = 1;
    target.kickSerial = this.kickSerial;
    target.damagedGateIds = [];
    target.damagedBoss = false;
    this.lastKickedBallId = target.id;
    arcadeAudio.kick(false);
    this.spawnImpact(target.body.x, target.body.y, 0xffd26d, 8);
    this.cameras.main.shake(90, 0.003);
    return true;
  }

  stepSpawner(dt) {
    if (this.progress.spawned >= this.level.ballQuota) {
      this.spawnBlocked = false;
      return;
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    const spawnClear = this.balls.every((ball) => Math.hypot(ball.body.x - 220, ball.body.y - 94) > BALL_RADIUS * 2.35);
    if (!spawnClear) {
      this.spawnBlocked = true;
      this.spawnTimer = 0.15;
      return;
    }
    this.spawnBlocked = false;
    this.spawnBall();
    this.spawnTimer += this.level.spawnIntervalSeconds;
  }

  spawnBall({ x = 220, y = 94, vx = 0.25, vy = 0 } = {}) {
    const image = this.matter.add.image(x, y, 'kickfall-ball');
    image.setDisplaySize(BALL_RADIUS * 2.15, BALL_RADIUS * 2.15);
    image.setCircle(BALL_RADIUS);
    image.setBounce(0.18);
    image.setFriction(0.025, 0.003, 0.0015);
    image.setFrictionAir(0.003);
    image.setDensity(0.0012);
    image.setCollisionCategory(CATEGORY.BALL);
    image.setCollidesWith([CATEGORY.WORLD, CATEGORY.PLAYER, CATEGORY.BALL, CATEGORY.BALL_BOUNDARY]);
    const id = this.nextBallId;
    this.nextBallId += 1;
    image.body.label = `kickfall-ball:${id}`;
    image.setDepth(21);
    image.setVelocity(vx, vy);
    const ball = {
      id,
      body: image,
      radius: BALL_RADIUS,
      spawnedAt: this.simulationSeconds,
      armedUntil: 0,
      impactPower: 0,
      kickSerial: 0,
      damagedGateIds: [],
      damagedBoss: false,
      bossCounterUntil: 0,
      passedObstacleIds: [],
      passedLandingGuideIds: [],
      landingGuideId: null,
      stalledObstacleId: null,
      magnetCapture: null,
    };
    this.balls.push(ball);
    this.progress.spawned += 1;
    return ball;
  }

  stepBalls() {
    const drained = [];
    this.balls.forEach((ball) => {
      const tier = this.tierForBall(ball);
      if (
        tier
        && tier.rollAssist !== 0
        && ball.bossCounterUntil <= this.simulationSeconds
        && Math.abs(ball.body.body.velocity.x) < BALL_ROLL_SPEED * 1.25
      ) {
        ball.body.setVelocityX(Phaser.Math.Linear(
          ball.body.body.velocity.x,
          tier.flow * BALL_ROLL_SPEED * tier.rollAssist,
          BALL_ROLL_RESPONSE,
        ));
      }
      const velocity = ball.body.body.velocity;
      const speed = Math.hypot(velocity.x, velocity.y);
      if (speed > 16) {
        const ratio = 16 / speed;
        ball.body.setVelocity(velocity.x * ratio, velocity.y * ratio);
      }
      if (ball.body.y > GAME_HEIGHT + 42) {
        const bottom = this.getTier('bottom');
        const reachedDrain = bottom.flow > 0 ? ball.body.x >= 1060 : ball.body.x <= 220;
        if (reachedDrain) drained.push(ball);
        else {
          const recoveryX = bottom.flow > 0 ? bottom.left + 40 : bottom.left + bottom.width - 40;
          ball.body.setPosition(recoveryX, tierSurfaceY(bottom, recoveryX) - BALL_RADIUS - 8);
          ball.body.setVelocity(-bottom.flow * 2.4, -1);
        }
      }
    });
    drained.forEach((ball) => this.drainBall(ball));
  }

  stepLandingGuides() {
    this.landingGuides.forEach((guide) => {
      this.balls.forEach((ball) => {
        if (ball.passedLandingGuideIds.includes(guide.id)) return;
        const progress = (ball.body.x - guide.entryX) * guide.flow;
        const captured = ball.landingGuideId === guide.id;
        const clampedProgress = Phaser.Math.Clamp(progress, 0, guide.width);
        const rampSurfaceY = guide.surfaceY
          - guide.height * (1 - clampedProgress / guide.width);
        const withinRamp = progress >= -BALL_RADIUS
          && progress <= guide.width + BALL_RADIUS;
        const touchingRamp = withinRamp
          && ball.body.y + BALL_RADIUS >= rampSurfaceY - 10
          && ball.body.y <= rampSurfaceY + BALL_RADIUS;

        if (!captured && !touchingRamp) return;

        if (progress >= guide.width - 2) {
          ball.passedLandingGuideIds.push(guide.id);
          ball.landingGuideId = null;
          ball.body.setBounce(0.18);
          ball.body.setVelocityX(guide.flow * Math.max(
            guide.assistSpeed,
            Math.abs(ball.body.body.velocity.x),
          ));
          return;
        }

        ball.landingGuideId = guide.id;
        ball.body.setBounce(0.04);
        const restingY = rampSurfaceY - BALL_RADIUS - 1;
        if (Math.abs(ball.body.y - restingY) > 1.5) {
          ball.body.setPosition(ball.body.x, restingY);
        }
        ball.body.setVelocity(guide.flow * guide.assistSpeed, 0.72);
        ball.body.setAngularVelocity(guide.flow * 0.1);
      });
    });
  }

  stepObstacles(dt) {
    if (!this.obstacles.length) return;
    this.obstacles.forEach((obstacle) => {
      if (obstacle.stalledBallId !== null
        && !this.balls.some((ball) => ball.id === obstacle.stalledBallId)) {
        obstacle.stalledBallId = null;
      }
      this.balls.forEach((ball) => {
        if (ball.passedObstacleIds.includes(obstacle.id)) return;
        if (obstacle.stalledBallId !== null && obstacle.stalledBallId !== ball.id) return;
        const ballTier = this.tierForBall(ball);
        const isOnObstacleLane = ballTier?.id === obstacle.tierId
          && Math.abs(ball.body.y - obstacle.holdY) <= OBSTACLE_LANE_TOLERANCE;
        const distanceAlongFlow = (ball.body.x - obstacle.x) * obstacle.flow;
        const insideCapture = isOnObstacleLane
          && Math.abs(distanceAlongFlow) <= obstacle.captureRadius;
        const captureOwned = ball.stalledObstacleId === obstacle.id
          || ball.magnetCapture?.obstacleId === obstacle.id;
        const kickedThrough = ball.armedUntil > this.simulationSeconds
          && ball.body.body.velocity.x * obstacle.flow >= 4
          && (insideCapture || captureOwned);
        if (kickedThrough) {
          ball.passedObstacleIds.push(obstacle.id);
          ball.stalledObstacleId = null;
          this.clearBallMagnetCapture(ball);
          obstacle.stalledBallId = null;
          obstacle.releasedBalls += 1;
          this.progress.obstacleClears += 1;
          this.spawnImpact(ball.body.x, ball.body.y, obstacle.type === 'pocket' ? 0x61edf2 : 0xffcf55, 6);
          return;
        }
        if (obstacle.type === 'pocket' && captureOwned) {
          obstacle.stalledBallId = ball.id;
          ball.stalledObstacleId = obstacle.id;
          if (!ball.magnetCapture) this.holdPocketBall(ball, obstacle);
          this.stepPocketCapture(ball, obstacle, dt);
          return;
        }
        if (!isOnObstacleLane) return;
        if (!insideCapture && ball.stalledObstacleId !== obstacle.id) return;
        const alreadyStalled = ball.stalledObstacleId === obstacle.id;
        obstacle.stalledBallId = ball.id;
        ball.stalledObstacleId = obstacle.id;
        if (obstacle.type === 'pocket') {
          if (!ball.magnetCapture) {
            if (alreadyStalled) this.holdPocketBall(ball, obstacle);
            else this.beginPocketCapture(ball, obstacle);
          }
          this.stepPocketCapture(ball, obstacle, dt);
          return;
        }
        ball.body.setPosition(obstacle.holdX, obstacle.holdY);
        ball.body.setVelocity(0, 0);
        ball.body.setAngularVelocity(0);
        if (!ball.body.body.isStatic) ball.body.setStatic(true);
      });
    });
  }

  beginPocketCapture(ball, obstacle) {
    const beam = this.add.graphics().setDepth(20);
    ball.magnetCapture = {
      phase: 'attracting',
      obstacleId: obstacle.id,
      elapsed: 0,
      duration: KICKFALL_CONFIG.pocketPullSeconds,
      startX: ball.body.x,
      startY: ball.body.y,
      targetX: obstacle.holdX,
      targetY: obstacle.holdY,
      startRotation: ball.body.rotation,
      baseScaleX: ball.body.scaleX,
      baseScaleY: ball.body.scaleY,
      beam,
    };
    ball.body.setVelocity(0, 0);
    ball.body.setAngularVelocity(0);
    if (!ball.body.body.isStatic) ball.body.setStatic(true);
    ball.body.setTint(0xc9fbff);
  }

  holdPocketBall(ball, obstacle) {
    const baseScaleX = ball.magnetCapture?.baseScaleX ?? ball.body.scaleX;
    const baseScaleY = ball.magnetCapture?.baseScaleY ?? ball.body.scaleY;
    ball.magnetCapture?.beam?.destroy();
    ball.magnetCapture = {
      phase: 'held',
      obstacleId: obstacle.id,
      elapsed: KICKFALL_CONFIG.pocketPullSeconds,
      duration: KICKFALL_CONFIG.pocketPullSeconds,
      startX: ball.body.x,
      startY: ball.body.y,
      targetX: obstacle.holdX,
      targetY: obstacle.holdY,
      startRotation: ball.body.rotation,
      baseScaleX,
      baseScaleY,
      beam: null,
    };
    ball.body.setPosition(obstacle.holdX, obstacle.holdY);
    ball.body.setVelocity(0, 0);
    ball.body.setAngularVelocity(0);
    if (!ball.body.body.isStatic) ball.body.setStatic(true);
    ball.body.setScale(baseScaleX, baseScaleY);
    ball.body.clearTint();
  }

  stepPocketCapture(ball, obstacle, dt) {
    const capture = ball.magnetCapture;
    if (!capture || capture.obstacleId !== obstacle.id) return;
    if (capture.phase === 'held') {
      ball.body.setPosition(obstacle.holdX, obstacle.holdY);
      ball.body.setVelocity(0, 0);
      return;
    }
    capture.elapsed = Math.min(capture.duration, capture.elapsed + Math.max(0, dt));
    const pull = resolveKickfallMagnetPull(capture);
    ball.body.setPosition(pull.x, pull.y);
    ball.body.setRotation(capture.startRotation + obstacle.flow * pull.turnRadians);
    ball.body.setScale(capture.baseScaleX * pull.scale, capture.baseScaleY * pull.scale);
    capture.beam.clear();
    const pulse = 0.42 + Math.sin(pull.progress * Math.PI * 5) * 0.12;
    capture.beam.lineStyle(2, this.theme.palette.pocket, pulse);
    capture.beam.lineBetween(obstacle.holdX, obstacle.holdY + 8, pull.x, pull.y + 8);
    capture.beam.fillStyle(this.theme.palette.pocket, 0.2 + pull.progress * 0.22);
    capture.beam.fillCircle(pull.x, pull.y, BALL_RADIUS + 5 - pull.progress * 3);
    if (pull.complete) this.holdPocketBall(ball, obstacle);
  }

  clearBallMagnetCapture(ball) {
    const capture = ball?.magnetCapture;
    if (!capture) return;
    capture.beam?.destroy();
    if (ball.body?.active) {
      ball.body.setScale(capture.baseScaleX, capture.baseScaleY);
      ball.body.clearTint();
    }
    ball.magnetCapture = null;
  }

  tierForBall(ball) {
    return this.tiers.find((tier, index) => {
      const nextTier = this.tiers[index + 1];
      const lowerBound = nextTier ? (tier.y + nextTier.y) / 2 : GAME_HEIGHT + 40;
      const insideHorizontalReach = tier.flow > 0
        ? ball.body.x <= tier.left + tier.width + 25
        : ball.body.x >= tier.left - 25;
      return ball.body.y < lowerBound && insideHorizontalReach;
    }) ?? null;
  }

  drainBall(ball) {
    const index = this.balls.indexOf(ball);
    if (index < 0) return false;
    this.balls.splice(index, 1);
    this.progress.drained += 1;
    this.spawnImpact(118, 686, 0x64f4cf, 10);
    this.clearBallMagnetCapture(ball);
    ball.body.destroy();
    this.game.events.emit('platform:haptic', 'light');
    return true;
  }

  stepBallChargeTransfers() {
    for (let pass = 0; pass < this.balls.length; pass += 1) {
      let transferred = false;
      const chargedBalls = this.balls.filter((ball) => ball.armedUntil > this.simulationSeconds);
      chargedBalls.forEach((source) => {
        const sourceTier = this.tierForBall(source);
        if (!sourceTier) return;
        const direction = Math.sign(source.body.body.velocity.x);
        const target = this.balls
          .filter((candidate) => (
            candidate !== source
            && !candidate.stalledObstacleId
            && this.tierForBall(candidate)?.id === sourceTier.id
            && (candidate.body.x - source.body.x) * direction > 0
          ))
          .sort((a, b) => Math.abs(a.body.x - source.body.x) - Math.abs(b.body.x - source.body.x))[0];
        if (!target) return;
        const result = resolveKickfallChargeTransfer({
          sourceX: source.body.x,
          sourceY: source.body.y,
          sourceVx: source.body.body.velocity.x,
          sourceArmedUntil: source.armedUntil,
          sourceImpactPower: source.impactPower,
          targetX: target.body.x,
          targetY: target.body.y,
          targetVx: target.body.body.velocity.x,
          targetArmedUntil: target.armedUntil,
          now: this.simulationSeconds,
          contactDistance: source.radius + target.radius + 4,
        });
        if (!result) return;
        source.armedUntil = result.sourceArmedUntil;
        source.impactPower = result.sourceImpactPower;
        target.armedUntil = result.targetArmedUntil;
        target.impactPower = result.targetImpactPower;
        target.kickSerial = source.kickSerial;
        target.damagedGateIds = [];
        target.damagedBoss = false;
        if (target.body.body.isStatic) target.body.setStatic(false);
        target.body.setVelocity(result.targetVelocityX, target.body.body.velocity.y);
        target.body.setAngularVelocity(result.direction * 0.18);
        this.spawnImpact(target.body.x, target.body.y, this.theme.palette.gateEnergy, 3);
        transferred = true;
      });
      if (!transferred) break;
    }
  }

  stepGateContacts() {
    this.gates.filter((gate) => gate.active).forEach((gate) => {
      this.balls.forEach((ball) => {
        const touching = Math.abs(ball.body.x - gate.x) <= gate.width / 2 + ball.radius + 7
          && Math.abs(ball.body.y - gate.y) <= gate.height / 2 + ball.radius;
        if (!touching || !isArmedGateHit({
          armedUntil: ball.armedUntil,
          now: this.simulationSeconds,
          gateId: gate.id,
          damagedGateIds: ball.damagedGateIds,
        })) return;
        ball.damagedGateIds.push(gate.id);
        const impactPower = Phaser.Math.Clamp(
          Number.isFinite(ball.impactPower) ? ball.impactPower : 1,
          0,
          1,
        );
        gate.health = Math.max(0, gate.health - impactPower);
        ball.armedUntil = 0;
        ball.impactPower = 0;
        gate.healthPips.forEach((pip, index) => pip.setAlpha(index < Math.ceil(gate.health) ? 0.95 : 0.16));
        if (gate.health <= 0) {
          this.breakGate(gate);
        } else {
          gate.image.setTint(0xffc7a0).setAlpha(0.86);
          this.spawnImpact(ball.body.x, ball.body.y, this.theme.palette.gateEnergy, 5);
          this.cameras.main.shake(90, 0.003);
        }
      });
    });
  }

  stepBoss(dt) {
    const boss = this.boss;
    if (!boss?.sprite) return;
    boss.kickCooldown = Math.max(0, boss.kickCooldown - dt);
    boss.kickTimer = Math.max(0, boss.kickTimer - dt);

    if (!boss.active) {
      if (boss.sprite.y > GAME_HEIGHT + 70) {
        boss.sprite.destroy();
        boss.sprite = null;
      }
      return;
    }

    const tier = this.getTier('bottom');
    const touchingBall = this.balls.find((ball) => (
      !ball.damagedBoss
      && ball.armedUntil > this.simulationSeconds
      && this.tierForBall(ball)?.id === tier.id
      && Math.abs(ball.body.x - boss.sprite.x) <= PLAYER_WIDTH / 2 + ball.radius + 7
      && Math.abs(ball.body.y - boss.sprite.y) <= PLAYER_HEIGHT / 2 + ball.radius
    ));
    if (touchingBall) {
      this.damageBoss(touchingBall);
      return;
    }

    if (boss.kickCooldown <= 0) {
      const target = this.balls
        .filter((ball) => this.tierForBall(ball)?.id === tier.id && ball.armedUntil <= this.simulationSeconds)
        .map((ball) => ({
          ball,
          approach: (ball.body.x - boss.sprite.x) * -tier.flow,
          vertical: Math.abs(ball.body.y - boss.sprite.y),
        }))
        .filter(({ approach, vertical }) => approach >= 25 && approach <= 78 && vertical <= 48)
        .sort((a, b) => a.approach - b.approach)[0]?.ball;
      if (target) {
        const counterWave = resolveKickfallBossCounterWave({
          targetId: target.id,
          balls: this.balls
            .filter((ball) => this.tierForBall(ball)?.id === tier.id)
            .map((ball) => ({ id: ball.id, x: ball.body.x, radius: ball.radius })),
          direction: -tier.flow,
          kickSpeed: this.level.boss.kickSpeed,
        });
        counterWave.forEach((counter, index) => {
          const ball = this.balls.find((candidate) => candidate.id === counter.id);
          if (!ball) return;
          if (ball.body.body.isStatic) ball.body.setStatic(false);
          ball.body.setVelocity(counter.velocityX, counter.velocityY);
          ball.body.setAngularVelocity(-tier.flow * (0.2 + index * 0.025));
          ball.bossCounterUntil = this.simulationSeconds + counter.suppressAssistSeconds;
          ball.armedUntil = 0;
          ball.impactPower = 0;
          ball.damagedGateIds = [];
          ball.damagedBoss = false;
        });
        boss.kickTimer = KICK_DURATION;
        boss.kickCooldown = this.level.boss.kickIntervalSeconds;
        arcadeAudio.kick(false);
        this.spawnImpact(target.body.x, target.body.y, 0xff7e9d, 10);
        this.cameras.main.shake(100, 0.004);
      }
    }

    const frame = boss.kickTimer > 0
      ? kickVisualAt({ remaining: boss.kickTimer, duration: KICK_DURATION }).frame
      : CHARACTER_FRAMES.idle;
    if (frame < boss.sprite.texture.frameTotal) boss.sprite.setFrame(frame);
  }

  damageBoss(ball) {
    const boss = this.boss;
    if (!boss?.active || !ball) return false;
    const tier = this.getTier('bottom');
    ball.damagedBoss = true;
    ball.armedUntil = 0;
    boss.health -= 1;
    const nextX = boss.health <= 0 ? 150 : boss.sprite.x + tier.flow * boss.pushDistance;
    boss.sprite.setPosition(nextX, playerCenterYOnTier(tier, Math.max(tier.left, nextX)));
    this.spawnImpact(boss.sprite.x, boss.sprite.y, 0xff8ca5, 12);
    this.cameras.main.shake(180, 0.007);
    this.game.events.emit('platform:haptic', 'heavy');
    if (boss.health <= 0) {
      boss.active = false;
      boss.defeated = true;
      boss.sprite.setStatic(false);
      boss.sprite.setSensor(true);
      boss.sprite.setCollidesWith([]);
      boss.sprite.setVelocity(tier.flow * 5.5, 2);
      this.announcementText.setText(t(this.language, 'kickfall.bossDown')).setColor('#75f6cc');
      arcadeAudio.goal();
    } else {
      this.announcementText.setText(t(this.language, 'kickfall.bossHit')).setColor('#ff9db1');
      boss.kickCooldown = Math.max(boss.kickCooldown, 0.6);
      arcadeAudio.impact();
    }
    this.goBannerSeconds = 0.55;
    return true;
  }

  breakGate(gate) {
    if (!gate?.active) return false;
    gate.active = false;
    this.progress.gatesBroken += 1;
    const { x, y } = gate;
    gate.image.destroy();
    gate.healthPips.forEach((pip) => pip.destroy());
    this.spawnBrickBurst(x, y, gate.height);
    arcadeAudio.impact();
    this.game.events.emit('platform:haptic', 'heavy');
    this.cameras.main.shake(220, 0.009);
    this.announcementText.setText(t(this.language, 'kickfall.gateBroken')).setColor('#ffdb75');
    this.goBannerSeconds = 0.55;
    return true;
  }

  isPlayerGrounded() {
    if (this.simulationSeconds <= this.groundedUntil) return true;
    const tier = this.getTier(this.currentTierId);
    if (!tier || this.player.x < tier.left - 8 || this.player.x > tier.left + tier.width + 8) return false;
    const surfaceY = tierSurfaceY(tier, this.player.x);
    const bodyBottom = this.player.y + PLAYER_HEIGHT / 2;
    return Math.abs(surfaceY - bodyBottom) <= 6 && Math.abs(this.player.body.velocity.y) <= 2.4;
  }

  setFacing(direction) {
    if (!direction) return;
    this.facing = direction > 0 ? 1 : -1;
    this.player?.setFlipX(this.facing !== this.character.nativeFacing);
  }

  updatePlayerVisual(dt = 0) {
    if (!this.player?.texture) return;
    let frame = CHARACTER_FRAMES.idle;
    let pose = 'idle';
    if (this.kickTimer > 0) {
      const kickVisual = kickVisualAt({ remaining: this.kickTimer, duration: KICK_DURATION });
      frame = this.playerHasEnhancedSheet ? kickVisual.frame : CHARACTER_FRAMES.legacyKick;
      pose = `kick-${kickVisual.stage}`;
    } else if (this.tierTransfer) {
      frame = CHARACTER_FRAMES.jump;
      pose = this.tierTransfer.direction < 0 ? 'tier-up' : 'tier-down';
    } else if (!this.isPlayerGrounded()) {
      frame = CHARACTER_FRAMES.jump;
      pose = 'jump';
    } else if (Math.abs(this.player.body.velocity.x) > 0.55) {
      const runVisual = runVisualAt(this.runCycle);
      frame = this.playerHasEnhancedSheet ? runVisual.frame : CHARACTER_FRAMES.legacyRun;
      pose = runVisual.pose;
    }
    if (frame < this.player.texture.frameTotal) this.player.setFrame(frame);
    this.visualFrame = frame;
    this.animationPose = pose;
    if (dt > 0 && this.kickTimer <= 0 && this.goBannerSeconds <= 0 && this.phase === 'playing') {
      this.announcementText.setColor('#ffffff');
    }
  }

  spawnImpact(x, y, color, count) {
    for (let index = 0; index < count; index += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed = Phaser.Math.FloatBetween(38, 128);
      const item = this.add.circle(x, y, Phaser.Math.Between(2, 5), color, 0.9).setDepth(48);
      this.effects.push({
        item,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: Phaser.Math.FloatBetween(0.22, 0.46),
        maxLife: 0.46,
        gravity: 160,
        spin: 0,
      });
    }
  }

  spawnBrickBurst(x, y, height) {
    const textureKey = this.theme.textureKeys.gate;
    const textureSource = this.textures.get(textureKey).getSourceImage();
    const cosmicCrop = this.themeId === 'cosmic';
    for (let index = 0; index < 16; index += 1) {
      const row = index % 5;
      const column = index % 2;
      const item = this.add.image(
        x + Phaser.Math.Between(-22, 22),
        y + Phaser.Math.Between(-Math.floor(height / 2), Math.floor(height / 2)),
        textureKey,
      )
        .setCrop(
          cosmicCrop
            ? Phaser.Math.Between(0, Math.max(0, textureSource.width - 42))
            : 18 + column * 82,
          cosmicCrop
            ? Phaser.Math.Between(0, Math.max(0, textureSource.height - 42))
            : 38 + row * 63,
          cosmicCrop ? 42 : 72,
          cosmicCrop ? 42 : 49,
        )
        .setDisplaySize(Phaser.Math.Between(12, 21), Phaser.Math.Between(9, 16))
        .setDepth(48);
      this.effects.push({
        item,
        vx: Phaser.Math.FloatBetween(-150, 150),
        vy: Phaser.Math.FloatBetween(-210, -45),
        life: Phaser.Math.FloatBetween(0.45, 0.82),
        maxLife: 0.82,
        gravity: 420,
        spin: Phaser.Math.FloatBetween(-420, 420),
      });
    }
  }

  updateEffects(dt) {
    this.effects = this.effects.filter((effect) => {
      effect.life -= dt;
      if (effect.life <= 0) {
        effect.item.destroy();
        return false;
      }
      effect.vy += effect.gravity * dt;
      effect.item.x += effect.vx * dt;
      effect.item.y += effect.vy * dt;
      effect.item.angle += effect.spin * dt;
      effect.item.setAlpha(Math.min(1, effect.life / Math.max(0.01, effect.maxLife * 0.45)));
      return true;
    });
  }

  updateHud() {
    if (!this.progressText) return;
    this.progressText.setText(t(this.language, 'kickfall.drained', {
      drained: this.progress.drained,
      quota: this.level.ballQuota,
    }));
    this.gatesText.setText(t(this.language, 'kickfall.gates', {
      broken: this.progress.gatesBroken,
      total: this.gates.length,
    }));
    this.levelText.setText(t(this.language, 'kickfall.level', { level: this.levelNumber }));
    if (this.level.timerSeconds === null) {
      this.timerText.setText('').setVisible(false);
    } else {
      this.timerText
        .setVisible(true)
        .setText(t(this.language, 'kickfall.timer', { seconds: Math.ceil(this.levelTimeRemaining) }))
        .setColor(this.levelTimeRemaining <= 10 ? '#ff6f86' : '#ffffff');
    }
    if (this.boss) {
      this.bossText
        .setVisible(true)
        .setText(t(this.language, 'kickfall.boss', { health: this.boss.health, max: this.boss.maxHealth }));
    } else {
      this.bossText.setVisible(false);
    }
  }

  finishRun(outcome, defeatReason = null) {
    if (this.phase === 'victory' || this.phase === 'defeat') return;
    this.phase = outcome;
    this.matter.world.pause();
    this.setTouchControlsVisible(false);
    const victory = outcome === 'victory';
    const resultLayout = createKickfallResultLayout({ victory, hasNext: this.hasNextLevel });
    const buttonLayout = Object.fromEntries(resultLayout.buttons.map((button) => [button.id, button]));
    this.defeatReason = victory
      ? null
      : defeatReason ?? 'timeout';
    this.resultTitle
      .setText(t(this.language, victory
        ? 'kickfall.victory'
        : this.defeatReason === 'timeout' ? 'kickfall.timeout' : 'kickfall.defeat'))
      .setColor(victory ? '#75f6cc' : '#ff8298');
    this.resultCopy.setText(t(this.language, victory
      ? 'kickfall.victoryCopy'
      : this.defeatReason === 'timeout' ? 'kickfall.timeoutCopy' : 'kickfall.defeatCopy'));
    this.resultProgress.setText(t(this.language, 'kickfall.resultProgress', {
      drained: this.progress.drained,
      quota: this.level.ballQuota,
      gates: this.progress.gatesBroken,
    }));
    this.retryButton.setLabel(t(this.language, 'kickfall.retry'));
    this.continueButton.setLabel(t(this.language, 'kickfall.continue'));
    this.resultMenuButton.setLabel(t(this.language, 'kickfall.mainMenu'));
    this.retryButton.setPosition(buttonLayout.retry.x, buttonLayout.retry.y);
    this.resultMenuButton.setPosition(buttonLayout.menu.x, buttonLayout.menu.y);
    if (buttonLayout.continue) {
      this.continueButton.setPosition(buttonLayout.continue.x, buttonLayout.continue.y);
    }
    this.resultObjects.forEach((item) => item.setVisible(true));
    if (victory) {
      if (this.hasNextLevel) playerProfileStore.unlockKickfallLevel(this.levelNumber + 1);
      this.retryButton.setVisible(true);
      this.continueButton.setVisible(this.hasNextLevel);
      arcadeAudio.goal();
    } else {
      this.retryButton.setVisible(true);
      this.continueButton.setVisible(false);
      arcadeAudio.impact();
    }
    this.resultMenuButton.setVisible(true);
  }

  restartLevel() {
    if (!this.sys.isActive()) return;
    this.matter.world.resume();
    this.scene.restart({ level: this.levelNumber });
  }

  continueLevel() {
    if (!this.sys.isActive() || !this.hasNextLevel) return;
    this.matter.world.resume();
    this.scene.restart({ level: this.levelNumber + 1 });
  }

  setTouchControlsVisible(visible) {
    this.movementJoystick?.setVisible(visible);
    this.touchObjects.forEach((item) => {
      item.setVisible(visible);
      if (item.input) item.input.enabled = visible;
    });
    if (!visible) {
      this.touch.left = false;
      this.touch.right = false;
      this.touch.up = false;
      this.touch.down = false;
      this.touchPulses.jump = false;
      this.touchPulses.kick = false;
    }
  }

  leaveKickfall() {
    if (!this.sys.isActive()) return;
    this.abandonConfirmation?.destroy();
    this.abandonConfirmation = null;
    this.isPaused = false;
    this.pauseReason = null;
    this.matter.world.resume();
    arcadeAudio.click();
    this.scene.start('Intro');
  }

  handlePlatformBack() {
    if (this.abandonConfirmation) this.closeAbandonConfirmation();
    else if (this.phase === 'victory' || this.phase === 'defeat') this.leaveKickfall();
    else this.togglePause();
    return true;
  }

  handlePlatformActiveChange(isActive) {
    this.suspended = !isActive;
    if (!isActive) {
      if (this.phase !== 'victory' && this.phase !== 'defeat' && !this.isPaused) {
        this.setPaused(true, { playSound: false, reason: 'lifecycle' });
      } else {
        this.matter.world.pause();
      }
    } else if (!this.isPaused && this.phase !== 'victory' && this.phase !== 'defeat') {
      this.matter.world.resume();
    }
  }

  installDebugHelpers() {
    window.__KICKFALL_DEBUG__ = {
      startPlaying: () => {
        this.phase = 'playing';
        this.countdown = 0;
        this.spawnTimer = this.level.spawnIntervalSeconds;
        this.announcementText.setText('');
        this.matter.world.resume();
      },
      clearBalls: () => {
        this.clearBalls();
      },
      prepareFlowBall: (tierId = 'top') => this.prepareFlowBall(tierId),
      prepareLandingGuideDrop: (tierId = 'top') => this.prepareLandingGuideDrop(tierId),
      prepareLandingGuidePlayerDrop: (tierId = 'upper') => this.prepareLandingGuidePlayerDrop(tierId),
      prepareBufferedJump: (tierId = 'upper') => this.prepareBufferedJump(tierId),
      prepareObstacleKick: (obstacleId) => this.prepareObstacleKick(obstacleId),
      prepareGateKick: (gateId = 'gate-a') => this.prepareGateKick(gateId),
      prepareGateQueue: (gateId = 'gate-a', count = 6) => this.prepareGateQueue(gateId, count),
      prepareBossHit: () => this.prepareBossHit(),
      prepareDrain: () => this.prepareDrain(),
      forceBossDefeat: () => this.forceBossDefeat(),
      forceVictory: () => {
        this.gates.filter((gate) => gate.active).forEach((gate) => this.breakGate(gate));
        this.forceBossDefeat();
        this.clearBalls();
        this.progress.spawned = this.level.ballQuota;
        this.progress.drained = this.level.ballQuota;
        this.finishRun('victory');
      },
      forceTimeout: () => {
        if (this.level.timerSeconds === null) return false;
        this.phase = 'playing';
        this.levelTimeRemaining = FIXED_STEP;
        this.matter.world.resume();
        return true;
      },
      state: () => JSON.parse(this.serializeState()),
    };
  }

  clearBalls() {
    this.balls.forEach((ball) => {
      this.clearBallMagnetCapture(ball);
      ball.body.destroy();
    });
    this.balls = [];
    this.obstacles.forEach((obstacle) => {
      obstacle.stalledBallId = null;
    });
  }

  prepareGateKick(gateId) {
    const gate = this.gates.find((candidate) => candidate.id === gateId && candidate.active);
    if (!gate) return false;
    this.clearBalls();
    this.phase = 'playing';
    this.spawnTimer = this.level.spawnIntervalSeconds;
    this.announcementText.setText('');
    const tier = this.getTier(gate.tierId);
    const flow = tier.flow;
    const ballX = gate.x - flow * (gate.width / 2 + BALL_RADIUS + 2);
    const ballY = tierSurfaceY(tier, ballX) - BALL_RADIUS - 3;
    const ball = this.spawnBall({ x: ballX, y: ballY, vx: 0, vy: 0 });
    ball.spawnedAt = this.simulationSeconds;
    const playerX = ballX - flow * 52;
    this.player.setPosition(playerX, playerCenterYOnTier(tier, playerX));
    this.player.setVelocity(0, 0);
    this.currentTierId = tier.id;
    this.tierTransfer = null;
    this.setFacing(flow);
    this.groundedUntil = this.simulationSeconds + 1;
    this.kickCooldown = 0;
    return true;
  }

  prepareGateQueue(gateId, count = 6) {
    const gate = this.gates.find((candidate) => candidate.id === gateId && candidate.active);
    if (!gate) return false;
    this.clearBalls();
    this.phase = 'playing';
    this.spawnTimer = this.level.spawnIntervalSeconds;
    this.announcementText.setText('');
    const tier = this.getTier(gate.tierId);
    const flow = tier.flow;
    const safeCount = Phaser.Math.Clamp(Math.floor(Number(count) || 0), 2, 10);
    const spacing = BALL_RADIUS * 2 + 2;
    const frontX = gate.x - flow * (gate.width / 2 + BALL_RADIUS + 2);
    const balls = Array.from({ length: safeCount }, (_, index) => {
      const x = frontX - flow * spacing * index;
      const y = tierSurfaceY(tier, x) - BALL_RADIUS - 3;
      const ball = this.spawnBall({ x, y, vx: 0, vy: 0 });
      ball.spawnedAt = this.simulationSeconds;
      return ball;
    });
    const rearBall = balls[balls.length - 1];
    const playerX = rearBall.body.x - flow * 46;
    this.player.setPosition(playerX, playerCenterYOnTier(tier, playerX));
    this.player.setVelocity(0, 0);
    this.currentTierId = tier.id;
    this.tierTransfer = null;
    this.setFacing(flow);
    this.groundedUntil = this.simulationSeconds + 1;
    this.kickCooldown = 0;
    return balls.map((ball) => ball.id);
  }

  prepareObstacleKick(obstacleId) {
    const obstacle = this.obstacles.find((candidate) => candidate.id === obstacleId);
    if (!obstacle) return false;
    this.clearBalls();
    this.phase = 'playing';
    this.spawnTimer = this.level.spawnIntervalSeconds;
    this.announcementText.setText('');
    const tier = this.getTier(obstacle.tierId);
    const ball = this.spawnBall({ x: obstacle.holdX, y: obstacle.holdY, vx: 0, vy: 0 });
    ball.spawnedAt = this.simulationSeconds;
    ball.stalledObstacleId = obstacle.id;
    obstacle.stalledBallId = ball.id;
    const playerX = obstacle.holdX - obstacle.flow * 52;
    this.player.setPosition(playerX, playerCenterYOnTier(tier, playerX));
    this.player.setVelocity(0, 0);
    this.currentTierId = tier.id;
    this.tierTransfer = null;
    this.setFacing(obstacle.flow);
    this.groundedUntil = this.simulationSeconds + 1;
    this.kickCooldown = 0;
    return ball.id;
  }

  prepareBossHit() {
    if (!this.boss?.active || !this.boss.sprite) return false;
    this.clearBalls();
    this.phase = 'playing';
    this.spawnTimer = this.level.spawnIntervalSeconds;
    this.announcementText.setText('');
    const tier = this.getTier('bottom');
    const ballX = this.boss.sprite.x - tier.flow * (PLAYER_WIDTH / 2 + BALL_RADIUS + 2);
    const ballY = tierSurfaceY(tier, ballX) - BALL_RADIUS - 3;
    const ball = this.spawnBall({ x: ballX, y: ballY, vx: 0, vy: 0 });
    ball.spawnedAt = this.simulationSeconds;
    const playerX = ballX - tier.flow * 52;
    this.player.setPosition(playerX, playerCenterYOnTier(tier, playerX));
    this.player.setVelocity(0, 0);
    this.currentTierId = tier.id;
    this.tierTransfer = null;
    this.setFacing(tier.flow);
    this.groundedUntil = this.simulationSeconds + 1;
    this.kickCooldown = 0;
    return ball.id;
  }

  forceBossDefeat() {
    if (!this.boss?.active) return false;
    this.boss.health = 1;
    return this.damageBoss({ damagedBoss: false, armedUntil: this.simulationSeconds + 1 });
  }

  prepareFlowBall(tierId = 'top') {
    const tier = this.getTier(tierId) ?? this.getTier('top');
    this.clearBalls();
    this.phase = 'playing';
    this.spawnTimer = this.level.spawnIntervalSeconds;
    this.announcementText.setText('');
    const landingGuide = this.landingGuides.find((guide) => guide.tierId === tier.id);
    const x = landingGuide
      ? landingGuide.exitX + tier.flow * (BALL_RADIUS + 6)
      : tier.flow > 0 ? tier.left + 150 : tier.left + tier.width - 150;
    const ball = this.spawnBall({
      x,
      y: tierSurfaceY(tier, x) - BALL_RADIUS - 1,
      vx: 0,
      vy: 0,
    });
    ball.spawnedAt = this.simulationSeconds;
    return ball.id;
  }

  prepareLandingGuideDrop(tierId = 'top') {
    const guide = this.landingGuides.find((candidate) => candidate.tierId === tierId);
    if (!guide) return false;
    this.clearBalls();
    this.phase = 'playing';
    this.spawnTimer = this.level.spawnIntervalSeconds;
    this.announcementText.setText('');
    const tier = this.getTier(guide.tierId);
    const ball = this.spawnBall({
      x: guide.dropX,
      y: tier.y - 100,
      vx: 0,
      vy: 0,
    });
    ball.spawnedAt = this.simulationSeconds;
    return ball.id;
  }

  prepareLandingGuidePlayerDrop(tierId = 'upper') {
    const guide = this.landingGuides.find((candidate) => candidate.tierId === tierId);
    if (!guide) return false;
    this.clearBalls();
    this.phase = 'playing';
    this.spawnTimer = this.level.spawnIntervalSeconds;
    this.announcementText.setText('');
    const tier = this.getTier(guide.tierId);
    const tierIndex = this.tiers.findIndex((candidate) => candidate.id === tier.id);
    const x = guide.entryX + guide.flow * 72;
    const expectedLandingY = playerCenterYOnTier(tier, x);
    const startY = guide.surfaceY - guide.height - PLAYER_HEIGHT / 2 - 8;
    this.player.setSensor(false);
    this.player.setStatic(false);
    this.player.setFixedRotation();
    this.player.setPosition(x, startY);
    this.player.setVelocity(0, 0);
    this.currentTierId = this.tiers[Math.max(0, tierIndex - 1)]?.id ?? tier.id;
    this.tierTransfer = null;
    this.groundedUntil = 0;
    return { startY, expectedLandingY };
  }

  prepareBufferedJump(tierId = 'upper') {
    const tier = this.getTier(tierId) ?? this.getTier('upper');
    this.clearBalls();
    this.phase = 'playing';
    this.spawnTimer = this.level.spawnIntervalSeconds;
    this.announcementText.setText('');
    const x = tier.left + tier.width * 0.7;
    const expectedLandingY = playerCenterYOnTier(tier, x);
    this.player.setSensor(false);
    this.player.setStatic(false);
    this.player.setFixedRotation();
    this.player.setPosition(x, expectedLandingY - 8);
    this.player.setVelocity(0, 4);
    this.currentTierId = tier.id;
    this.tierTransfer = null;
    this.groundedUntil = 0;
    this.jumpBufferSeconds = 0;
    return { expectedLandingY };
  }

  prepareDrain() {
    this.clearBalls();
    this.phase = 'playing';
    this.spawnTimer = this.level.spawnIntervalSeconds;
    this.announcementText.setText('');
    const bottom = this.getTier('bottom');
    const x = 190;
    const ball = this.spawnBall({
      x,
      y: tierSurfaceY(bottom, x) - BALL_RADIUS - 3,
      vx: -5.6,
      vy: 0,
    });
    ball.spawnedAt = this.simulationSeconds;
    return ball.id;
  }

  serializeState() {
    if (this.phase === 'assets-loading') {
      return {
        mode: 'kickfall-loading',
        phase: 'assets',
        progress: round(this.loadProgress, 2),
        coordinateSystem: 'origin top-left; +x right; +y down; logical canvas 1280x720',
        actions: [],
      };
    }
    const now = this.simulationSeconds;
    return {
      mode: this.isPaused ? 'paused' : this.phase,
      pauseReason: this.pauseReason,
      modal: this.abandonConfirmation?.kind ?? null,
      minigame: 'kickfall',
      theme: {
        id: this.themeId,
        name: this.theme.name,
        textureKeys: { ...this.theme.textureKeys },
        layers: {
          backdrop: Boolean(this.themeLayers?.backdrop),
          milkyWay: Boolean(this.themeLayers?.milkyWay),
          moon: Boolean(this.themeLayers?.moon),
          stars: this.themeLayers?.stars?.length ?? 0,
        },
        motion: {
          milkyWayAngle: round(this.themeLayers?.milkyWay?.rotation ?? 0, 3),
          moonX: this.themeLayers?.moon ? round(this.themeLayers.moon.x) : null,
          moonY: this.themeLayers?.moon ? round(this.themeLayers.moon.y) : null,
        },
      },
      coordinateSystem: 'origin top-left; +x right; +y down; logical gameplay canvas 1280x720',
      selectedCharacter: {
        id: this.character.id,
        name: getCharacterName(this.character, this.language),
      },
      level: {
        number: this.levelNumber,
        maxLevel: KICKFALL_LEVELS.length,
        hasNext: this.hasNextLevel,
        tierModes: [...this.level.tierModes],
      },
      routeAudit: {
        valid: this.levelAudit.valid,
        issues: [...this.levelAudit.issues],
        finishWindowSeconds: round(this.levelAudit.finishWindowSeconds, 2),
        receivers: this.levelAudit.tiers
          .filter(({ requiresReceiver }) => requiresReceiver)
          .map(({ tierId, guideId, receiverClear }) => ({ tierId, guideId, receiverClear })),
      },
      campaign: playerProfileStore.get().kickfall,
      timer: {
        enabled: this.level.timerSeconds !== null,
        totalSeconds: this.level.timerSeconds,
        remainingSeconds: this.levelTimeRemaining === null ? null : round(this.levelTimeRemaining, 2),
      },
      defeatReason: this.phase === 'defeat' ? this.defeatReason : null,
      player: this.player ? {
        x: round(this.player.x),
        y: round(this.player.y),
        vx: round(this.player.body.velocity.x, 2),
        vy: round(this.player.body.velocity.y, 2),
        facing: this.facing,
        grounded: this.isPlayerGrounded(),
        tierId: this.currentTierId,
        tierTransfer: this.tierTransfer ? {
          targetTierId: this.tierTransfer.targetTierId,
          direction: this.tierTransfer.direction < 0 ? 'up' : 'down',
          progress: round(this.tierTransfer.elapsed / this.tierTransfer.duration, 2),
        } : null,
        visualFrame: this.visualFrame,
        animationPose: this.animationPose,
        platformSurfaceY: round(tierSurfaceY(this.getTier(this.currentTierId), this.player.x), 2),
        visualGroundAnchorY: round(
          this.player.y
            + (CHARACTER_GROUND_ANCHOR_Y - this.player.displayOriginY) * this.player.scaleY,
          2,
        ),
        kickCooldown: round(this.kickCooldown, 2),
        lastKickedBallId: this.lastKickedBallId,
      } : null,
      progress: {
        ...this.progress,
        quota: this.level.ballQuota,
      },
      spawn: {
        intervalSeconds: this.level.spawnIntervalSeconds,
        nextInSeconds: round(Math.max(0, this.spawnTimer), 2),
        blocked: this.spawnBlocked,
      },
      boss: this.boss ? {
        characterId: this.rivalCharacter.id,
        active: this.boss.active,
        defeated: this.boss.defeated,
        health: this.boss.health,
        maxHealth: this.boss.maxHealth,
        x: this.boss.sprite ? round(this.boss.sprite.x) : null,
        y: this.boss.sprite ? round(this.boss.sprite.y) : null,
        kickCooldown: round(this.boss.kickCooldown, 2),
      } : null,
      gates: this.gates?.map((gate) => ({
        id: gate.id,
        tierId: gate.tierId,
        x: gate.x,
        y: round(gate.y),
        health: gate.health,
        maxHealth: gate.maxHealth,
        active: gate.active,
      })) ?? [],
      lanes: this.tiers?.map((tier) => ({
        id: tier.id,
        mode: tier.mode,
        flow: tier.flow,
        angle: round(tier.angle, 3),
        rollAssist: tier.rollAssist,
      })) ?? [],
      obstacles: this.obstacles?.map((obstacle) => ({
        id: obstacle.id,
        type: obstacle.type,
        tierId: obstacle.tierId,
        x: obstacle.x,
        releasedBalls: obstacle.releasedBalls,
        stalledBallId: obstacle.stalledBallId,
      })) ?? [],
      landingGuides: this.landingGuides?.map((guide) => ({
        id: guide.id,
        tierId: guide.tierId,
        flow: guide.flow,
        entryX: round(guide.entryX),
        exitX: round(guide.exitX),
        width: guide.width,
        height: guide.height,
        assistSpeed: guide.assistSpeed,
      })) ?? [],
      balls: this.balls?.map((ball) => ({
        id: ball.id,
        x: round(ball.body.x),
        y: round(ball.body.y),
        vx: round(ball.body.body.velocity.x, 2),
        vy: round(ball.body.body.velocity.y, 2),
        armedSeconds: round(Math.max(0, ball.armedUntil - now), 2),
        impactPower: round(ball.impactPower, 2),
        damagedBoss: ball.damagedBoss,
        bossCounterSeconds: round(Math.max(0, ball.bossCounterUntil - now), 2),
        stalledObstacleId: ball.stalledObstacleId,
        magnetCapture: ball.magnetCapture ? {
          phase: ball.magnetCapture.phase,
          progress: round(ball.magnetCapture.elapsed / ball.magnetCapture.duration, 2),
        } : null,
        landingGuideId: ball.landingGuideId,
        passedObstacleIds: [...ball.passedObstacleIds],
        passedLandingGuideIds: [...ball.passedLandingGuideIds],
      })) ?? [],
      actions: this.phase === 'victory'
        ? ['retry', ...(this.hasNextLevel ? ['continue'] : []), 'main menu']
        : this.phase === 'defeat'
          ? ['retry', 'main menu']
          : this.isPaused
            ? ['resume', 'restart level', 'leave Kickfall']
            : ['move left', 'move right', 'jump + up one tier', 'jump + down one tier', 'jump', 'kick', 'pause', 'restart'],
      pauseActions: this.isPaused ? ['resume', 'restart level', 'leave Kickfall'] : [],
      confirmationActions: this.abandonConfirmation ? ['stay', 'leave Kickfall'] : [],
      controls: this.isTouchLayout ? {
        move: '8-way virtual joystick',
        tiers: 'hold joystick up/down + tap jump',
        jump: 'tap jump without up/down',
        kick: 'on-screen kick',
        pause: 'on-screen pause',
        joystick: this.movementJoystick?.diagnostics() ?? null,
      } : {
        move: 'A/D or Left/Right',
        tiers: 'Space + W/Up or S/Down',
        jump: 'Space without up/down',
        kick: 'X/K',
        restart: 'R',
        pause: 'P/Escape',
      },
    };
  }

  advanceForTesting(milliseconds = 0) {
    if (this.phase === 'assets-loading' || !this.keys || !this.player) {
      this.game.renderer.preRender();
      this.sys.render(this.game.renderer);
      this.game.renderer.postRender();
      return;
    }
    const steps = Math.max(1, Math.round(Math.max(0, Number(milliseconds) || 0) / (FIXED_STEP * 1000)));
    for (let index = 0; index < steps; index += 1) {
      this.stepGame(FIXED_STEP);
      if (!this.suspended && !this.isPaused && this.phase !== 'victory' && this.phase !== 'defeat') {
        this.matter.world.step(FIXED_STEP * 1000);
      }
    }
    this.updateHud();
    this.game.renderer.preRender();
    this.sys.render(this.game.renderer);
    this.game.renderer.postRender();
  }
}
