import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants.js';
import { t } from '../i18n.js';
import { playerProfileStore } from '../services/PlayerProfile.js';

const assetUrl = (filename) => `${import.meta.env.BASE_URL}assets/${filename}`;

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    const language = playerProfileStore.get().language;
    const loading = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, t(language, 'boot.loading'), {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: '28px',
      color: '#dffbff',
    }).setOrigin(0.5);
    this.load.on('progress', (progress) => loading.setText(`${t(language, 'boot.loading')} ${Math.round(progress * 100)}%`));

    this.load.image('arena', assetUrl('arena-skycourt.png'));
    this.load.image('joel-football-splash', assetUrl('splash/joel-football-option-a.webp'));
    this.load.image('joel', assetUrl('player-nova.png'));
    this.load.image('vex', assetUrl('player-vex.png'));
    this.load.image('lucia', assetUrl('player-lucia-portrait.png'));
    this.load.image('luna', assetUrl('player-luna-portrait.png'));
    this.load.image('juan', assetUrl('player-juan-portrait.png'));
    this.load.image('juanjo', assetUrl('player-juanjo-portrait.png'));
    this.load.spritesheet('joel-sheet', assetUrl('player-nova-sheet-v2.webp'), { frameWidth: 320, frameHeight: 480 });
    this.load.spritesheet('vex-sheet', assetUrl('player-vex-sheet-v2.webp'), { frameWidth: 320, frameHeight: 480 });
    this.load.spritesheet('lucia-sheet', assetUrl('player-lucia-sheet-v2.webp'), { frameWidth: 320, frameHeight: 480 });
    this.load.spritesheet('luna-sheet', assetUrl('player-luna-sheet-v2.webp'), { frameWidth: 320, frameHeight: 480 });
    this.load.spritesheet('juan-sheet', assetUrl('player-juan-sheet-v3.webp'), { frameWidth: 320, frameHeight: 480 });
    this.load.spritesheet('juanjo-sheet', assetUrl('player-juanjo-sheet-v1.webp'), { frameWidth: 320, frameHeight: 480 });
    this.load.image('ball', assetUrl('ball.png'));
    this.load.image('flare', assetUrl('power-flare.png'));
    this.load.svg('goal-side', assetUrl('goal-side.svg'), { width: 180, height: 320 });
    this.load.svg('control-run', assetUrl('icons/run.svg'), { width: 128, height: 128 });
    this.load.svg('control-high-kick', assetUrl('icons/high-kick.svg'), { width: 128, height: 128 });
    this.load.svg('control-kick', assetUrl('icons/kick.svg'), { width: 128, height: 128 });
    this.load.svg('control-jump', assetUrl('icons/jump.svg'), { width: 128, height: 128 });
  }

  create() {
    this.ensureFallbackTextures();
    this.scene.start('Splash');
  }

  ensureFallbackTextures() {
    if (!this.textures.exists('arena')) this.createArenaFallback();
    if (!this.textures.exists('joel')) this.createFighterFallback('joel', 0x22cfe5, 0xffd7b5);
    if (!this.textures.exists('vex')) this.createFighterFallback('vex', 0xff6b66, 0xc98765);
    if (!this.textures.exists('lucia')) this.createFighterFallback('lucia', 0x16bfb5, 0xf2b079);
    if (!this.textures.exists('luna')) this.createFighterFallback('luna', 0x9559e8, 0xf0b27e);
    if (!this.textures.exists('juan')) this.createFighterFallback('juan', 0x23344e, 0xc98765);
    if (!this.textures.exists('juanjo')) this.createFighterFallback('juanjo', 0x4b3038, 0xc98765);
    if (!this.textures.exists('ball')) this.createBallFallback();
    if (!this.textures.exists('flare')) this.createFlareFallback();
    if (!this.textures.exists('goal-side')) this.createGoalFallback();
  }

  createArenaFallback() {
    const graphics = this.make.graphics({ add: false });
    graphics.fillGradientStyle(0x5fd6ff, 0x5fd6ff, 0xa8efff, 0xa8efff, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(0x3e5673, 1).fillRect(0, 255, GAME_WIDTH, 185);
    graphics.fillStyle(0x1f304a, 1).fillRect(0, 285, GAME_WIDTH, 28);
    graphics.fillStyle(0x40a654, 1).fillRect(0, 440, GAME_WIDTH, 280);
    graphics.fillStyle(0x24823c, 1).fillRect(0, 585, GAME_WIDTH, 135);
    graphics.lineStyle(5, 0xe9fff0, 0.7).strokeLineShape(new Phaser.Geom.Line(0, 635, GAME_WIDTH, 635));
    graphics.generateTexture('arena', GAME_WIDTH, GAME_HEIGHT);
    graphics.destroy();
  }

  createFighterFallback(key, shirt, skin) {
    const graphics = this.make.graphics({ add: false });
    graphics.fillStyle(0x000000, 0.22).fillEllipse(75, 165, 82, 14);
    graphics.fillStyle(shirt, 1).fillRoundedRect(42, 91, 66, 60, 18);
    graphics.fillStyle(0x12233d, 1).fillRoundedRect(42, 138, 30, 22, 8).fillRoundedRect(79, 138, 30, 22, 8);
    graphics.fillStyle(skin, 1).fillCircle(75, 64, 54);
    graphics.fillStyle(0x172238, 1).fillEllipse(75, 33, 90, 38);
    graphics.fillStyle(0xffffff, 1).fillEllipse(57, 63, 16, 12).fillEllipse(91, 63, 16, 12);
    graphics.fillStyle(0x172238, 1).fillCircle(60, 64, 4).fillCircle(88, 64, 4);
    graphics.lineStyle(4, 0x7d3c35, 1).strokeLineShape(new Phaser.Geom.Line(60, 83, 91, 82));
    graphics.generateTexture(key, 150, 178);
    graphics.destroy();
  }

  createBallFallback() {
    const graphics = this.make.graphics({ add: false });
    graphics.fillStyle(0xf8fbff, 1).fillCircle(26, 26, 23);
    graphics.lineStyle(3, 0x25334c, 1).strokeCircle(26, 26, 22);
    graphics.fillStyle(0x25334c, 1).fillPoints([
      new Phaser.Geom.Point(26, 13),
      new Phaser.Geom.Point(35, 20),
      new Phaser.Geom.Point(32, 31),
      new Phaser.Geom.Point(20, 31),
      new Phaser.Geom.Point(17, 20),
    ], true);
    graphics.generateTexture('ball', 52, 52);
    graphics.destroy();
  }

  createFlareFallback() {
    const graphics = this.make.graphics({ add: false });
    graphics.fillStyle(0xffba38, 0.25).fillCircle(64, 64, 62);
    graphics.fillStyle(0xff6b29, 0.55).fillCircle(64, 64, 46);
    graphics.fillStyle(0xfff49b, 0.95).fillCircle(64, 64, 26);
    graphics.generateTexture('flare', 128, 128);
    graphics.destroy();
  }

  createGoalFallback() {
    const graphics = this.make.graphics({ add: false });
    graphics.lineStyle(3, 0xbce9ef, 0.45);
    for (let x = 28; x <= 220; x += 24) graphics.strokeLineShape(new Phaser.Geom.Line(x, 55, x * 0.9, 275));
    for (let y = 70; y <= 270; y += 25) graphics.strokeLineShape(new Phaser.Geom.Line(25, y, 225, y));
    graphics.lineStyle(12, 0xf4fbff, 1);
    graphics.strokeLineShape(new Phaser.Geom.Line(24, 48, 232, 48));
    graphics.strokeLineShape(new Phaser.Geom.Line(24, 48, 24, 286));
    graphics.lineStyle(8, 0xd3eaf0, 1).strokeLineShape(new Phaser.Geom.Line(24, 286, 226, 286));
    graphics.generateTexture('goal-side', 256, 320);
    graphics.destroy();
  }
}
