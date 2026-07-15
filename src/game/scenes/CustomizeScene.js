import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import {
  ARENA_THEMES,
  BALL_TYPES,
  cycleArenaTheme,
  cycleBallType,
  getArenaTheme,
  getBallType,
} from '../content/matchCustomization.js';
import { t } from '../i18n.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createArenaStage } from '../ui/createArenaStage.js';
import { createButton } from '../ui/createButton.js';

const assetUrl = (filename) => `${import.meta.env.BASE_URL}assets/${filename}`;

const textStyle = (size, color = '#ffffff') => ({
  fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
  fontSize: `${size}px`,
  fontStyle: 'bold',
  color,
  align: 'center',
});

export class CustomizeScene extends Phaser.Scene {
  constructor() {
    super('Customize');
  }

  preload() {
    ARENA_THEMES.forEach((theme) => {
      if (!this.textures.exists(theme.texture)) this.load.image(theme.texture, assetUrl(theme.asset));
    });
  }

  create() {
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    this.arenaTheme = getArenaTheme(this.profile.arenaThemeId);
    this.ballType = getBallType(this.profile.ballTypeId);
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearActiveScene(this);
      window.removeEventListener('keydown', this.onEscapeKey);
    });

    this.arenaStage = createArenaStage(this, { themeId: this.arenaTheme.id });
    this.stageLayout = this.arenaStage.layout;
    this.add.rectangle(0, 0, this.stageLayout.width, this.stageLayout.height, 0x050a17, 0.52).setOrigin(0);
    this.add.text(GAME_WIDTH / 2, 58, t(this.language, 'customize.title'), textStyle(48, '#ffffff')).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 100, t(this.language, 'customize.subtitle'), textStyle(17, '#bfefff')).setOrigin(0.5);

    this.createPanel(340, t(this.language, 'customize.field'), this.arenaTheme, true);
    this.createPanel(940, t(this.language, 'customize.object'), this.ballType, false);

    createButton(this, {
      x: 72,
      y: 52,
      width: 110,
      height: 48,
      label: `‹ ${t(this.language, 'customize.back')}`,
      color: 0x1a395c,
      onPress: () => this.scene.start('Intro'),
    });
    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 660 + this.stageLayout.bottomOffset,
      width: 340,
      height: 62,
      label: t(this.language, 'customize.play'),
      color: 0x705cff,
      onPress: () => this.scene.start('MatchLoading'),
    });

    this.onEscapeKey = (event) => {
      if (event.key !== 'Escape' || event.repeat) return;
      event.preventDefault();
      this.scene.start('Intro');
    };
    window.addEventListener('keydown', this.onEscapeKey);
  }

  createPanel(x, heading, item, isArena) {
    this.add.rectangle(x, 368, 520, 470, 0x0a1730, 0.94)
      .setStrokeStyle(3, item.accent ?? 0x7ce8ff, 0.55);
    this.add.text(x, 160, heading, textStyle(18, '#7ce8ff')).setOrigin(0.5);

    if (isArena) this.createArenaPreview(x, item);
    else this.createBallPreview(x, item);

    createButton(this, {
      x: x - 205,
      y: 320,
      width: 60,
      height: 70,
      label: '‹',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      onPress: () => isArena ? this.rotateArena(-1) : this.rotateBall(-1),
    });
    createButton(this, {
      x: x + 205,
      y: 320,
      width: 60,
      height: 70,
      label: '›',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      onPress: () => isArena ? this.rotateArena(1) : this.rotateBall(1),
    });
    const nameText = this.add.text(x, 440, t(this.language, item.nameKey), textStyle(30, '#ffdc72')).setOrigin(0.5);
    const descriptionText = this.add.text(x, 485, t(this.language, item.descriptionKey), {
      ...textStyle(17, '#d7e6f8'),
      wordWrap: { width: 430 },
      lineSpacing: 5,
    }).setOrigin(0.5, 0);
    if (!isArena) {
      const feel = t(this.language, `customize.feel.${item.family}`);
      this.ballFeelText = this.add.text(x, 572, feel, {
        ...textStyle(15, '#8fefff'),
        wordWrap: { width: 430 },
      }).setOrigin(0.5);
      this.ballNameText = nameText;
      this.ballDescriptionText = descriptionText;
    } else {
      this.arenaNameText = nameText;
      this.arenaDescriptionText = descriptionText;
    }
  }

  createArenaPreview(x, theme) {
    this.arenaPreview = this.add.image(x, 305, theme.texture).setDisplaySize(300, 169);
    this.arenaPreviewBorder = this.add.rectangle(x, 305, 304, 173, 0x000000, 0)
      .setStrokeStyle(4, theme.accent, 0.9);
  }

  createBallPreview(x, ballType) {
    this.previewObject = this.add.image(x, 305, ballType.texture)
      .setDisplaySize(ballType.displayWidth * 2.05, ballType.displayHeight * 2.05)
      .setDepth(5);
    this.animateBallPreview(ballType);
  }

  animateBallPreview(ballType) {
    this.previewTween?.stop();
    this.previewObject.setY(305).setAngle(0);
    this.previewTween = this.tweens.add({
      targets: this.previewObject,
      y: 280,
      angle: ballType.family === 'can' ? 16 : 180,
      duration: ballType.family === 'cannonball' ? 1200 : 850,
      yoyo: true,
      repeat: -1,
      ease: ballType.family === 'balloon' ? 'Sine.InOut' : 'Quad.Out',
    });
  }

  rotateArena(direction) {
    const next = cycleArenaTheme(this.arenaTheme.id, direction);
    this.profile = playerProfileStore.setArenaTheme(next.id);
    this.arenaTheme = next;
    this.arenaStage.arena.setTexture(next.texture);
    this.arenaPreview.setTexture(next.texture);
    this.arenaPreviewBorder.setStrokeStyle(4, next.accent, 0.9);
    this.arenaNameText.setText(t(this.language, next.nameKey));
    this.arenaDescriptionText.setText(t(this.language, next.descriptionKey));
    arcadeAudio.click();
  }

  rotateBall(direction) {
    const next = cycleBallType(this.ballType.id, direction);
    this.profile = playerProfileStore.setBallType(next.id);
    this.ballType = next;
    this.previewObject
      .setTexture(next.texture)
      .setDisplaySize(next.displayWidth * 2.05, next.displayHeight * 2.05);
    this.animateBallPreview(next);
    this.ballNameText.setText(t(this.language, next.nameKey));
    this.ballDescriptionText.setText(t(this.language, next.descriptionKey));
    this.ballFeelText.setText(t(this.language, `customize.feel.${next.family}`));
    arcadeAudio.click();
  }

  serializeState() {
    return {
      mode: 'customize',
      language: this.language,
      coordinateSystem: `origin top-left; +x right; +y down; logical canvas ${this.stageLayout.width}x${this.stageLayout.height}`,
      arena: {
        id: this.arenaTheme.id,
        name: t(this.language, this.arenaTheme.nameKey),
        available: ARENA_THEMES.map((item) => ({ id: item.id, name: t(this.language, item.nameKey) })),
      },
      ballType: {
        id: this.ballType.id,
        name: t(this.language, this.ballType.nameKey),
        family: this.ballType.family,
        shape: this.ballType.shape,
        restitution: this.ballType.restitution,
        frictionAir: this.ballType.frictionAir,
        density: this.ballType.density,
        speedScale: this.ballType.speedScale,
        liftScale: this.ballType.liftScale,
        available: BALL_TYPES.map((item) => ({ id: item.id, name: t(this.language, item.nameKey) })),
      },
      actions: ['previous field', 'next field', 'previous object', 'next object', 'play match', 'back'],
    };
  }

  advanceForTesting() {
    this.tweens.update(16, 16);
  }
}
