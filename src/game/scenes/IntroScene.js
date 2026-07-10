import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, HUMAN_PLAYER_NAME } from '../constants.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createButton } from '../ui/createButton.js';
import { isTouchLayout } from '../input/isTouchLayout.js';
import { t } from '../i18n.js';
import { playerProfileStore } from '../services/PlayerProfile.js';

export class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  create() {
    this.isTouchLayout = isTouchLayout();
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    arcadeAudio.setScene('menu');
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clearActiveScene(this));

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'arena').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    const wash = this.add.graphics();
    wash.fillGradientStyle(0x081229, 0x081229, 0x07101f, 0x07101f, 0.2, 0.2, 0.88, 0.88);
    wash.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.image(245, 492, 'joel').setDisplaySize(255, 255).setAngle(-4);
    this.add.image(1035, 492, 'vex').setDisplaySize(255, 255).setAngle(4);
    this.add.text(245, 620, HUMAN_PLAYER_NAME, {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#6ef4ff',
      stroke: '#071426',
      strokeThickness: 6,
    }).setOrigin(0.5);
    this.add.text(1035, 620, 'VEX-9', {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffad72',
      stroke: '#071426',
      strokeThickness: 6,
    }).setOrigin(0.5);
    const ball = this.add.image(640, 465, 'ball').setDisplaySize(78, 78);
    this.tweens.add({ targets: ball, y: 430, angle: 180, duration: 850, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.add.text(GAME_WIDTH / 2, 86, 'JOEL', {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: '92px',
      fontStyle: 'bold',
      color: '#f7fcff',
      stroke: '#12213b',
      strokeThickness: 14,
      shadow: { color: '#19c5dd', blur: 18, fill: true, offsetY: 7 },
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 165, 'FOOTBALL', {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#ffcf4a',
      stroke: '#6c2b3a',
      strokeThickness: 10,
      letterSpacing: 8,
    }).setOrigin(0.5);

    const panel = this.add.rectangle(640, 312, 590, 226, 0x0b1730, 0.82).setStrokeStyle(2, 0x7ce8ff, 0.32);
    panel.setOrigin(0.5);
    this.add.text(640, 235, t(this.language, 'intro.rule'), {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#bff8ff',
    }).setOrigin(0.5);
    const controlsCopy = this.isTouchLayout
      ? t(this.language, 'intro.touchControls')
      : t(this.language, 'intro.desktopControls');
    this.add.text(640, 297, controlsCopy, {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '17px',
      color: '#ffffff',
      align: 'center',
      lineSpacing: 8,
    }).setOrigin(0.5);
    this.add.text(640, 354, t(this.language, 'intro.advancedControls'), {
      fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
      fontSize: this.language === 'es' ? '13px' : '14px',
      fontStyle: 'bold',
      color: '#ffcf62',
      align: 'center',
      wordWrap: { width: 550 },
    }).setOrigin(0.5);
    const systemCopy = this.isTouchLayout
      ? t(this.language, 'intro.touchSystem')
      : t(this.language, 'intro.desktopSystem');
    this.add.text(640, 397, systemCopy, {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: this.isTouchLayout ? '15px' : '16px',
      color: '#a9bdd8',
      align: 'center',
      lineSpacing: 3,
      wordWrap: { width: 550 },
    }).setOrigin(0.5);

    createButton(this, {
      x: 640,
      y: 505,
      width: 320,
      height: 68,
      label: t(this.language, 'intro.play'),
      color: 0x705cff,
      onPress: () => this.startMatch(),
    });
    createButton(this, {
      x: 640,
      y: 580,
      width: 320,
      height: 58,
      label: t(this.language, 'intro.powerLab'),
      color: 0x1596a8,
      onPress: () => this.startPowerLab(),
    });
    createButton(this, {
      x: 640,
      y: 650,
      width: 220,
      height: 42,
      label: t(this.language, 'intro.settings'),
      color: 0x1a395c,
      onPress: () => this.startSettings(),
    });

    this.add.text(1072, 34, t(this.language, 'intro.language'), {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#d9ecff',
    }).setOrigin(1, 0.5);
    this.createLanguageButton(1115, 'EN', 'en');
    this.createLanguageButton(1190, 'ES', 'es');

    this.input.keyboard.on('keydown-ENTER', () => this.startMatch());
    this.input.keyboard.on('keydown-SPACE', () => this.startMatch());
  }

  startMatch() {
    arcadeAudio.unlock();
    arcadeAudio.click();
    this.scene.start('Match');
  }

  startPowerLab() {
    arcadeAudio.unlock();
    arcadeAudio.click();
    this.scene.start('PowerLab');
  }

  startSettings() {
    arcadeAudio.unlock();
    arcadeAudio.click();
    this.scene.start('Settings');
  }

  createLanguageButton(x, label, language) {
    const active = this.language === language;
    createButton(this, {
      x,
      y: 34,
      width: 64,
      height: 36,
      label,
      color: active ? 0x2ebed0 : 0x1a395c,
      onPress: () => {
        if (this.language === language) return;
        playerProfileStore.setLanguage(language);
        arcadeAudio.click();
        this.scene.restart();
      },
    });
  }

  serializeState() {
    return {
      mode: 'intro',
      language: this.language,
      difficulty: this.profile.difficulty,
      inputMode: this.isTouchLayout ? 'touch' : 'keyboard',
      coordinateSystem: 'origin top-left; +x right; +y down; logical canvas 1280x720',
      title: 'Joel Football',
      audio: arcadeAudio.diagnostics(),
      actions: ['play match', 'open power lab', 'open settings', 'set English', 'set Spanish'],
      controls: this.isTouchLayout ? {
        move: ['on-screen left', 'on-screen right'],
        sprint: ['double-tap and hold the same direction'],
        jump: ['on-screen up'],
        kick: ['on-screen K'],
        lob: ['on-screen L'],
        kickBoost: ['repeat K or L during the kick animation'],
        chilena: ['tap K or L twice under a reachable overhead ball'],
        dash: ['on-screen D'],
        power: ['on-screen P'],
        pause: ['on-screen pause'],
        restart: ['on-screen restart'],
        menu: ['on-screen menu'],
        fullscreen: ['on-screen fullscreen'],
      } : {
        move: ['A/D', 'Left/Right'],
        sprint: ['double-tap and hold the same direction'],
        jump: ['W', 'Up', 'Space'],
        kick: ['X', 'K'],
        lob: ['Z', 'I', 'Up + Kick'],
        kickBoost: ['repeat kick or lob during the kick animation'],
        chilena: ['press any kick twice under a reachable overhead ball'],
        dash: ['C', 'L'],
        power: ['V', 'J'],
        pause: ['P', 'Escape'],
        fullscreen: ['F'],
      },
    };
  }

  advanceForTesting() {
    this.tweens.update(16, 16);
  }
}
