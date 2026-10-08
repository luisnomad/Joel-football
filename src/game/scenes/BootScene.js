import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants.js';
import { t } from '../i18n.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { CHARACTERS, getCharacter, getCharacterSheetFrameConfig } from '../content/characters.js';
import { getArenaTheme } from '../content/matchCustomization.js';

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

    const arenaTheme = getArenaTheme(playerProfileStore.get().arenaThemeId);
    this.load.image(arenaTheme.texture, assetUrl(arenaTheme.asset));
    CHARACTERS.forEach((character) => {
      this.load.image(character.portraitTexture, assetUrl(character.portraitAsset));
    });
    const profile = playerProfileStore.get();
    const lineup = [
      getCharacter(profile.playerCharacterId),
      getCharacter(profile.opponentId, 'bob'),
    ];
    [...new Map(lineup.map((character) => [character.sheetTexture, character])).values()]
      .forEach((character) => {
        this.load.spritesheet(
          character.sheetTexture,
          assetUrl(character.sheetAsset),
          getCharacterSheetFrameConfig(character),
        );
      });
    // Painted balls (sprite redo). Each PNG fills the old vector art's load box
    // at 2x, so the per-type display sizes and colliders are unchanged.
    this.load.image('ball', assetUrl('ball-classic-v2.png'));
    this.load.image('ball-neon', assetUrl('ball-neon-v2.png'));
    this.load.image('ball-balloon', assetUrl('ball-balloon-v2.png'));
    this.load.image('ball-rugby', assetUrl('ball-rugby-v2.png'));
    this.load.image('ball-soda-can', assetUrl('ball-soda-can-v2.png'));
    this.load.image('ball-cannonball', assetUrl('ball-cannonball-v2.png'));
    this.load.svg('goal-frame', assetUrl('goal-frame.svg'), { width: 180, height: 320 });
    // Painted power badges (power-icon-<id>, see ui/powerRewardBurst.js).
    ['fireball', 'ice', 'big', 'shield', 'hyper'].forEach((id) => {
      this.load.image(`power-icon-${id}`, assetUrl(`power-icon-${id}.png`));
    });
    this.load.svg('control-high-kick', assetUrl('icons/high-kick.svg'), { width: 128, height: 128 });
    this.load.svg('control-kick', assetUrl('icons/kick.svg'), { width: 128, height: 128 });
    this.load.svg('control-jump', assetUrl('icons/jump.svg'), { width: 128, height: 128 });
    // v3: the v2 level screenshot without the old Joel sprite baked into its top-left corner,
    // which sat behind the BACK button on the full-screen Kickfall menus.
    this.load.image('menu-arcade-cosmic', assetUrl('menu/arcade-cosmic-card-v3.webp'));
    // A real neon-rink frame (rink lines, puck, both pushers) for the Disc Hockey
    // card; the arena backdrop alone read as an empty dark rink on phones.
    this.load.image('menu-disc-hockey-card', assetUrl('menu/disc-hockey-card-v1.webp'));
    this.load.image('menu-options-workshop', assetUrl('menu/options-workshop-v1.webp'));
  }

  create() {
    this.ensureFallbackTextures();
    this.scene.start('Splash');
  }

  ensureFallbackTextures() {
    const arenaTheme = getArenaTheme(playerProfileStore.get().arenaThemeId);
    if (!this.textures.exists(arenaTheme.texture)) this.createArenaFallback(arenaTheme.texture);
    if (!this.textures.exists('joel')) this.createFighterFallback('joel', 0x22cfe5, 0xffd7b5);
    if (!this.textures.exists('bob')) this.createFighterFallback('bob', 0xff6b66, 0xc98765);
    if (!this.textures.exists('lucia')) this.createFighterFallback('lucia', 0x16bfb5, 0xf2b079);
    if (!this.textures.exists('luna')) this.createFighterFallback('luna', 0x9559e8, 0xf0b27e);
    if (!this.textures.exists('juan')) this.createFighterFallback('juan', 0x23344e, 0xc98765);
    if (!this.textures.exists('dad')) this.createFighterFallback('dad', 0x244c78, 0xd6a27e);
    if (!this.textures.exists('mum')) this.createFighterFallback('mum', 0x1f6fd1, 0xc9855c);
    if (!this.textures.exists('juanjo')) this.createFighterFallback('juanjo', 0x4b3038, 0xc98765);
    if (!this.textures.exists('ball')) this.createBallFallback();
    if (!this.textures.exists('goal-frame')) this.createGoalFallback();
  }

  createArenaFallback(textureKey = 'arena-skycourt') {
    const graphics = this.make.graphics({ add: false });
    graphics.fillGradientStyle(0x5fd6ff, 0x5fd6ff, 0xa8efff, 0xa8efff, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(0x3e5673, 1).fillRect(0, 255, GAME_WIDTH, 185);
    graphics.fillStyle(0x1f304a, 1).fillRect(0, 285, GAME_WIDTH, 28);
    graphics.fillStyle(0x40a654, 1).fillRect(0, 440, GAME_WIDTH, 280);
    graphics.fillStyle(0x24823c, 1).fillRect(0, 585, GAME_WIDTH, 135);
    graphics.lineStyle(5, 0xe9fff0, 0.7).strokeLineShape(new Phaser.Geom.Line(0, 635, GAME_WIDTH, 635));
    graphics.generateTexture(textureKey, GAME_WIDTH, GAME_HEIGHT);
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

  createGoalFallback() {
    const graphics = this.make.graphics({ add: false });
    graphics.lineStyle(3, 0xbce9ef, 0.45);
    for (let x = 28; x <= 220; x += 24) graphics.strokeLineShape(new Phaser.Geom.Line(x, 55, x * 0.9, 275));
    for (let y = 70; y <= 270; y += 25) graphics.strokeLineShape(new Phaser.Geom.Line(25, y, 225, y));
    graphics.lineStyle(12, 0xf4fbff, 1);
    graphics.strokeLineShape(new Phaser.Geom.Line(24, 48, 232, 48));
    graphics.strokeLineShape(new Phaser.Geom.Line(24, 48, 24, 286));
    graphics.lineStyle(8, 0xd3eaf0, 1).strokeLineShape(new Phaser.Geom.Line(24, 286, 226, 286));
    graphics.generateTexture('goal-frame', 256, 320);
    graphics.destroy();
  }
}
