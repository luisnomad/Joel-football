import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../constants.js';
import { t } from '../i18n.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createButton } from '../ui/createButton.js';
import { createVolumeSlider } from '../ui/createVolumeSlider.js';

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

    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'arena').setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    const wash = this.add.graphics();
    wash.fillGradientStyle(0x061225, 0x061225, 0x07101f, 0x07101f, 0.75, 0.75, 0.93, 0.93);
    wash.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.add.rectangle(640, 375, 820, 610, 0x09172e, 0.94).setStrokeStyle(3, 0x7ce8ff, 0.28);

    this.add.text(640, 72, t(this.language, 'settings.title'), this.textStyle(46, '#ffffff')).setOrigin(0.5);
    createButton(this, {
      x: 92,
      y: 52,
      width: 145,
      height: 46,
      label: `‹  ${t(this.language, 'settings.back')}`,
      color: 0x173858,
      onPress: () => this.back(),
    });

    this.add.text(640, 132, t(this.language, 'settings.language'), this.textStyle(17, '#a8c5df')).setOrigin(0.5);
    this.createLanguageButton(595, 'EN', 'en');
    this.createLanguageButton(685, 'ES', 'es');

    this.createAudioRow({
      key: 'music',
      y: 285,
      label: t(this.language, 'settings.music'),
      help: t(this.language, 'settings.musicHelp'),
      value: this.profile.audio.musicVolume,
      muted: this.profile.audio.musicMuted,
      color: 0x6cebf4,
    });
    this.createAudioRow({
      key: 'effects',
      y: 455,
      label: t(this.language, 'settings.effects'),
      help: t(this.language, 'settings.effectsHelp'),
      value: this.profile.audio.effectsVolume,
      muted: this.profile.audio.effectsMuted,
      color: 0xffb85c,
    });

    this.cacheText = this.add.text(640, 570, '', {
      ...this.textStyle(15, '#9fc2dc'),
      align: 'center',
    }).setOrigin(0.5);
    this.refreshCacheText();
    this.time.addEvent({ delay: 350, loop: true, callback: () => this.refreshCacheText() });

    createButton(this, {
      x: 640,
      y: 640,
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
      y: 180,
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
      onPress: () => {
        const current = playerProfileStore.get().audio;
        arcadeAudio.updateSettings({ [`${key}Muted`]: !current[`${key}Muted`] });
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

  refreshCacheText() {
    const { cache } = arcadeAudio.diagnostics();
    const key = cache.cachedCount >= cache.total ? 'settings.cacheReady' : 'settings.cacheProgress';
    this.cacheText?.setText(t(this.language, key, { cached: cache.cachedCount, total: cache.total }));
  }

  back() {
    arcadeAudio.click();
    this.scene.start('Intro');
  }

  serializeState() {
    return {
      mode: 'settings',
      language: this.language,
      coordinateSystem: 'origin top-left; +x right; +y down; logical canvas 1280x720',
      audio: arcadeAudio.diagnostics(),
      actions: ['set English', 'set Spanish', 'set music volume', 'mute music', 'set effects volume', 'mute effects', 'back'],
    };
  }

  advanceForTesting() {
    this.refreshCacheText();
  }
}
