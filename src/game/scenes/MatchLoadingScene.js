import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants.js';
import { getCharacter } from '../content/characters.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { getArenaTheme } from '../content/matchCustomization.js';
import { getSceneStageLayout } from '../layout/tabletStage.js';

const assetUrl = (filename) => `${import.meta.env.BASE_URL}assets/${filename}`;

export class MatchLoadingScene extends Phaser.Scene {
  constructor() {
    super('MatchLoading');
  }

  init() {
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clearActiveScene(this));
  }

  preload() {
    this.stageLayout = getSceneStageLayout(this);
    const horizontalOffset = Math.max(0, this.stageLayout.width - GAME_WIDTH) / 2;
    if (horizontalOffset >= 12) this.cameras.main.setScroll(-horizontalOffset, 0);
    const arenaTheme = getArenaTheme(playerProfileStore.get().arenaThemeId);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, arenaTheme.texture)
      .setDisplaySize(this.stageLayout.width, GAME_HEIGHT);
    this.add.rectangle(
      -horizontalOffset,
      0,
      this.stageLayout.width,
      this.stageLayout.height,
      0x071426,
      0.34,
    ).setOrigin(0);
    this.add.circle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 34, 0xffffff, 0.12)
      .setStrokeStyle(5, 0x74efff, 0.9);
    this.spinner = this.add.arc(GAME_WIDTH / 2, GAME_HEIGHT / 2, 34, 250, 355, false, 0xffd45f, 1);
    this.tweens.add({ targets: this.spinner, angle: 360, duration: 620, repeat: -1 });

    const profile = playerProfileStore.get();
    const lineup = [
      getCharacter(profile.playerCharacterId),
      getCharacter(profile.opponentId, 'bob'),
    ];
    this.pendingCharacters = [...new Map(lineup.map((character) => [character.sheetTexture, character])).values()]
      .filter((character) => !this.textures.exists(character.sheetTexture));
    this.pendingCharacters.forEach((character) => {
      this.load.spritesheet(character.sheetTexture, assetUrl(character.sheetAsset), {
        frameWidth: 320,
        frameHeight: 480,
      });
    });
  }

  create() {
    this.time.delayedCall(this.pendingCharacters.length > 0 ? 120 : 0, () => this.scene.start('Match'));
  }

  serializeState() {
    return {
      mode: 'match-loading',
      pendingTextures: this.pendingCharacters?.map((character) => character.sheetTexture) ?? [],
      coordinateSystem: `origin top-left; +x right; +y down; logical canvas ${this.stageLayout?.width ?? GAME_WIDTH}x${this.stageLayout?.height ?? GAME_HEIGHT}`,
      actions: [],
    };
  }

  advanceForTesting(milliseconds = 0) {
    this.tweens.update(this.time.now, Math.max(0, Number(milliseconds) || 0));
    this.game.renderer.preRender();
    this.sys.render(this.game.renderer);
    this.game.renderer.postRender();
  }
}
