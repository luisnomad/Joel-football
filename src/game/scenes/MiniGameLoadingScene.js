import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants.js';
import { t } from '../i18n.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createButton } from '../ui/createButton.js';

export class MiniGameLoadingScene extends Phaser.Scene {
  constructor() {
    super('MiniGameLoading');
  }

  init(data = {}) {
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    this.requestedLevel = data.level;
    this.status = 'code';
    this.error = null;
    this.choiceObjects = [];
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clearActiveScene(this));
  }

  create() {
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x07152d, 0x07152d, 0x210d32, 0x210d32, 1);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.fillStyle(0x43d8ef, 0.1).fillCircle(210, 160, 180);
    graphics.fillStyle(0xff5e7f, 0.08).fillCircle(1080, 590, 230);

    this.add.text(GAME_WIDTH / 2, 275, 'KICKFALL', {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: '68px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#241342',
      strokeThickness: 12,
      shadow: { color: '#42dff5', blur: 16, fill: true, offsetY: 5 },
    }).setOrigin(0.5);
    this.statusText = this.add.text(GAME_WIDTH / 2, 360, t(this.language, 'kickfall.loadingCode'), {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#d6f8ff',
    }).setOrigin(0.5);
    this.spinner = this.add.arc(GAME_WIDTH / 2, 430, 30, 235, 350, false, 0xffd35c, 1);
    this.tweens.add({ targets: this.spinner, angle: 360, duration: 620, repeat: -1 });

    this.loadKickfall();
  }

  async loadKickfall() {
    try {
      const { KickfallScene } = await import('../minigames/kickfall/KickfallScene.js');
      if (!this.sys.isActive()) return;
      if (!this.game.scene.keys.Kickfall) this.game.scene.add('Kickfall', KickfallScene, false);
      if (this.requestedLevel) {
        this.startKickfall(this.requestedLevel);
      } else if (this.profile.kickfall.highestUnlockedLevel > 1) {
        this.showResumeChoice();
      } else {
        this.startKickfall(1);
      }
    } catch (error) {
      if (!this.sys.isActive()) return;
      this.status = 'error';
      this.error = error instanceof Error ? error.message : String(error);
      this.spinner.setVisible(false);
      this.statusText.setText(t(this.language, 'kickfall.loadingError')).setColor('#ffb1bd');
      this.input.keyboard.once('keydown-ESC', () => this.scene.start('Intro'));
    }
  }

  showResumeChoice() {
    this.status = 'choice';
    this.spinner.setVisible(false);
    const level = this.profile.kickfall.lastPlayedLevel;
    this.statusText.setText(t(this.language, 'kickfall.resumePrompt', { level }));
    const resume = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 430,
      width: 330,
      height: 62,
      label: t(this.language, 'kickfall.resume', { level }),
      color: 0x168f78,
      onPress: () => this.startKickfall(level),
    });
    const restart = createButton(this, {
      x: GAME_WIDTH / 2,
      y: 510,
      width: 330,
      height: 54,
      label: t(this.language, 'kickfall.fromStart'),
      color: 0x1d3c60,
      onPress: () => this.startKickfall(1),
    });
    this.choiceObjects = [resume, restart];
  }

  startKickfall(level) {
    if (!this.sys.isActive()) return;
    this.status = 'assets';
    this.statusText.setText(t(this.language, 'kickfall.loadingAssets'));
    this.choiceObjects.forEach((button) => button.setVisible(false));
    this.spinner.setVisible(true);
    this.scene.start('Kickfall', { level });
  }

  serializeState() {
    return {
      mode: 'kickfall-loading',
      phase: this.status,
      error: this.error,
      savedProgress: this.profile?.kickfall ?? null,
      coordinateSystem: 'origin top-left; +x right; +y down; logical canvas 1280x720',
      actions: this.status === 'error'
        ? ['press Escape to return to menu']
        : this.status === 'choice' ? ['continue saved level', 'start from level 1'] : [],
    };
  }

  advanceForTesting(milliseconds = 0) {
    this.tweens.update(this.time.now, Math.max(0, Number(milliseconds) || 0));
    this.game.renderer.preRender();
    this.sys.render(this.game.renderer);
    this.game.renderer.postRender();
  }
}
