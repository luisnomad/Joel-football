import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants.js';
import { t } from '../i18n.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createButton } from '../ui/createButton.js';
import { createVolumeSlider } from '../ui/createVolumeSlider.js';
import { createArenaStage } from '../ui/createArenaStage.js';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  create() {
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    arcadeAudio.setScene('menu');
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clearActiveScene(this));

    this.stageLayout = createArenaStage(this).layout;
    const horizontalOffset = Math.max(0, this.stageLayout.width - GAME_WIDTH) / 2;
    const wash = this.add.graphics();
    wash.fillGradientStyle(0x061225, 0x061225, 0x07101f, 0x07101f, 0.75, 0.75, 0.93, 0.93);
    wash.fillRect(-horizontalOffset, 0, this.stageLayout.width, this.stageLayout.height);
    this.settingsPanel = this.add.rectangle(
      640,
      375 + this.stageLayout.extraHeight / 2,
      820,
      610 + this.stageLayout.extraHeight,
      0x09172e,
      0.94,
    ).setStrokeStyle(3, 0x7ce8ff, 0.28);

    this.titleText = this.add.text(640, 108, t(this.language, 'settings.title'), this.textStyle(46, '#ffffff')).setOrigin(0.5);
    createButton(this, {
      x: 92,
      y: 52,
      width: 145,
      height: 46,
      label: `‹  ${t(this.language, 'settings.back')}`,
      color: 0x173858,
      onPress: () => this.back(),
    });

    this.add.text(640, 150, t(this.language, 'settings.language'), this.textStyle(16, '#a8c5df')).setOrigin(0.5);
    this.createLanguageButton(595, 'EN', 'en');
    this.createLanguageButton(685, 'ES', 'es');

    this.add.text(640, 232, t(this.language, 'settings.difficulty'), this.textStyle(16, '#a8c5df')).setOrigin(0.5);
    this.createDifficultyButton(535, 'easy');
    this.createDifficultyButton(640, 'normal');
    this.createDifficultyButton(745, 'hard');
    this.add.text(640, 310, t(this.language, 'settings.difficultyHelp'), {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '14px',
      color: '#a9bdd8',
    }).setOrigin(0.5);

    this.createAudioRow({
      key: 'music',
      y: 395,
      label: t(this.language, 'settings.music'),
      help: t(this.language, 'settings.musicHelp'),
      value: this.profile.audio.musicVolume,
      muted: this.profile.audio.musicMuted,
      color: 0x6cebf4,
    });
    this.createAudioRow({
      key: 'effects',
      y: 525,
      label: t(this.language, 'settings.effects'),
      help: t(this.language, 'settings.effectsHelp'),
      value: this.profile.audio.effectsVolume,
      muted: this.profile.audio.effectsMuted,
      color: 0xffb85c,
    });

    createButton(this, {
      x: 640,
      y: 640 + this.stageLayout.bottomOffset,
      width: 260,
      height: 56,
      label: t(this.language, 'settings.done'),
      color: 0x705cff,
      onPress: () => this.back(),
    });

    this.input.keyboard.on('keydown-ESC', () => this.back());
  }

  textStyle(size, color = '#ffffff') {
    return {
      fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
    };
  }

  createLanguageButton(x, label, language) {
    const active = this.language === language;
    createButton(this, {
      x,
      y: 188,
      width: 78,
      height: 44,
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

  createDifficultyButton(x, difficulty) {
    const active = this.profile.difficulty === difficulty;
    createButton(this, {
      x,
      y: 270,
      width: 96,
      height: 46,
      label: t(this.language, `settings.${difficulty}`),
      color: active ? 0xf29d38 : 0x1a395c,
      onPress: () => {
        if (this.profile.difficulty === difficulty) return;
        playerProfileStore.setDifficulty(difficulty);
        arcadeAudio.click();
        this.scene.restart();
      },
    });
  }

  createAudioRow({ key, y, label, help, value, muted, color }) {
    this.add.text(300, y - 46, label, this.textStyle(27, '#ffffff'));
    this.add.text(300, y - 11, help, {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '15px',
      color: '#a9bdd8',
    });
    const percent = this.add.text(820, y + 32, `${Math.round(value * 100)}%`, this.textStyle(18, '#dffbff')).setOrigin(1, 0.5);
    const slider = createVolumeSlider(this, {
      x: 555,
      y: y + 32,
      width: 450,
      value,
      color,
      onChange: (next) => {
        arcadeAudio.updateSettings({
          [`${key}Volume`]: next,
          [`${key}Muted`]: false,
        });
        percent.setText(`${Math.round(next * 100)}%`);
        this.refreshMuteButton(key);
      },
    });
    const muteButton = createButton(this, {
      x: 935,
      y: y + 32,
      width: 170,
      height: 48,
      label: '',
      color: muted ? 0x168c78 : 0x374e6b,
      activateOnPointerDown: true,
      onPress: () => {
        const muteKey = `${key}Muted`;
        const currentlyMuted = arcadeAudio.diagnostics().settings[muteKey];
        if (!currentlyMuted) arcadeAudio.click();
        arcadeAudio.updateSettings({ [muteKey]: !currentlyMuted });
        if (currentlyMuted) arcadeAudio.click();
        this.refreshMuteButton(key);
      },
    });
    this[`${key}Slider`] = slider;
    this[`${key}Percent`] = percent;
    this[`${key}MuteButton`] = muteButton;
    this.refreshMuteButton(key);
  }

  refreshMuteButton(key) {
    const button = this[`${key}MuteButton`];
    if (!button) return;
    const muted = playerProfileStore.get().audio[`${key}Muted`];
    button.text.setText(t(this.language, muted ? 'settings.turnOn' : 'settings.mute'));
    button.background.setFillStyle(muted ? 0x168c78 : 0x374e6b, 1);
  }

  back() {
    arcadeAudio.click();
    this.scene.start('Intro');
  }

  handlePlatformBack() {
    this.back();
    return true;
  }

  serializeState() {
    const profile = playerProfileStore.get();
    const panelBounds = this.settingsPanel.getBounds();
    const titleBounds = this.titleText.getBounds();
    return {
      mode: 'settings',
      language: this.language,
      difficulty: profile.difficulty,
      coordinateSystem: `origin top-left; +x right; +y down; logical canvas ${this.stageLayout.width}x${this.stageLayout.height}; gameplay region 1280x720`,
      stageLayout: this.stageLayout,
      settingsLayout: {
        panelTop: Math.round(panelBounds.top * 10) / 10,
        panelBottom: Math.round(panelBounds.bottom * 10) / 10,
        titleTop: Math.round(titleBounds.top * 10) / 10,
        titleBottom: Math.round(titleBounds.bottom * 10) / 10,
        titleInsidePanel: titleBounds.top >= panelBounds.top + 8 && titleBounds.bottom <= panelBounds.bottom - 8,
      },
      technicalAudioCacheVisible: false,
      audio: arcadeAudio.diagnostics(),
      audioControls: {
        music: {
          muted: profile.audio.musicMuted,
          label: this.musicMuteButton?.text?.text ?? '',
          enabled: this.musicMuteButton?.zone?.input?.enabled === true,
        },
        effects: {
          muted: profile.audio.effectsMuted,
          label: this.effectsMuteButton?.text?.text ?? '',
          enabled: this.effectsMuteButton?.zone?.input?.enabled === true,
        },
      },
      actions: ['set English', 'set Spanish', 'set difficulty Easy', 'set difficulty Normal', 'set difficulty Hard', 'set music volume', 'mute music', 'set effects volume', 'mute effects', 'back'],
    };
  }

  advanceForTesting() {}
}
