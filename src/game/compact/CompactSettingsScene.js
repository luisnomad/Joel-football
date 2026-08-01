import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import { t } from '../i18n.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createArenaStage } from '../ui/createArenaStage.js';
import { createVolumeSlider } from '../ui/createVolumeSlider.js';
import {
  compactBodyText,
  compactTextStyle,
  createCompactBackdrop,
  createCompactButton,
  createCompactPanel,
  createCompactPrimaryButton,
  createCompactTabs,
} from './compactUi.js';
import { createCompactInfoOverlay } from './createCompactInfoOverlay.js';

export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('Settings');
  }

  init(data = {}) {
    this.activeTab = data.tab === 'effects' ? 'effects' : 'music';
  }

  create() {
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    this.infoOverlay = null;
    this.installState = this.game.registry.get('platformActions')?.getInstallState?.()
      ?? { available: false, installed: false, method: 'unavailable' };
    arcadeAudio.setScene('menu');
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clearActiveScene(this));
    this.stageLayout = createArenaStage(this).layout;
    createCompactBackdrop(this, { top: 0x061225, bottom: 0x07101f });
    this.add.text(GAME_WIDTH / 2, 48, 'JOEL FOOTBALL', compactTextStyle(50, '#ffffff', {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      stroke: '#10213e',
      strokeThickness: 9,
      shadow: { color: '#19c5dd', blur: 11, fill: true, offsetY: 4 },
    })).setOrigin(0.5);
    createCompactTabs(this, {
      tabs: [
        { id: 'football', label: t(this.language, 'hub.football'), color: 0x155fbd },
        { id: 'miniGames', label: t(this.language, 'hub.miniGames'), color: 0x6d2eb4 },
        { id: 'settings', label: t(this.language, 'settings.title'), color: 0x1596a8 },
      ],
      activeId: 'settings',
      y: 112,
      width: 1020,
      onSelect: (tab) => this.openTopLevel(tab),
    });
    this.settingsPanel = createCompactPanel(this, { y: 390, width: 960, height: 440, accent: 0x7ce8ff });
    this.titleText = this.add.text(640, 198, t(this.language, 'settings.language'), compactTextStyle(24, '#a8c5df')).setOrigin(0.5);
    this.createLanguageButton(575, 'EN', 'en');
    this.createLanguageButton(705, 'ES', 'es');
    createCompactTabs(this, {
      tabs: [
        { id: 'music', label: t(this.language, 'settings.music'), color: 0x2a9eb5 },
        { id: 'effects', label: t(this.language, 'settings.effects'), color: 0xb88724 },
      ],
      activeId: this.activeTab,
      y: 306,
      width: 700,
      onSelect: (tab) => this.scene.restart({ tab }),
    });
    this.createAudioPage(this.activeTab);
    if (this.installState.available) {
      createCompactPrimaryButton(this, {
        x: 640,
        y: 650,
        width: 420,
        height: 64,
        label: t(this.language, 'intro.install'),
        accent: 0x42e0b5,
        onPress: () => this.installApp(),
      });
    }
    this.input.keyboard.on('keydown-ESC', () => {
      if (!this.closeInfo()) this.openTopLevel('football');
    });
  }

  createLanguageButton(x, label, language) {
    createCompactButton(this, {
      x,
      y: 244,
      width: 108,
      height: 56,
      label,
      color: this.language === language ? 0x2ebed0 : 0x1a395c,
      accent: 0x20d9ff,
      active: this.language === language,
      onPress: () => {
        if (this.language === language) return;
        playerProfileStore.setLanguage(language);
        arcadeAudio.click();
        this.scene.restart({ tab: this.activeTab });
      },
    });
  }

  createAudioPage(key) {
    const isMusic = key === 'music';
    const label = t(this.language, isMusic ? 'settings.music' : 'settings.effects');
    const help = t(this.language, isMusic ? 'settings.musicHelp' : 'settings.effectsHelp');
    const value = this.profile.audio[`${key}Volume`];
    const muted = this.profile.audio[`${key}Muted`];
    const color = isMusic ? 0x6cebf4 : 0xffb85c;
    this.add.text(640, 370, label, compactTextStyle(34, '#ffffff')).setOrigin(0.5);
    compactBodyText(this, 640, 425, help, { width: 760, size: 28, color: '#c7d8ed' });
    const percent = this.add.text(905, 515, `${Math.round(value * 100)}%`, compactTextStyle(24, '#dffbff')).setOrigin(1, 0.5);
    const slider = createVolumeSlider(this, {
      x: 560,
      y: 515,
      width: 520,
      value,
      color,
      onChange: (next) => {
        arcadeAudio.updateSettings({ [`${key}Volume`]: next, [`${key}Muted`]: false });
        percent.setText(`${Math.round(next * 100)}%`);
        this.refreshMuteButton(key);
      },
    });
    const muteButton = createCompactButton(this, {
      x: 1015,
      y: 515,
      width: 190,
      height: 62,
      label: '',
      color: muted ? 0x168c78 : 0x374e6b,
      activateOnPointerDown: true,
      onPress: () => {
        const muteKey = `${key}Muted`;
        const currentlyMuted = arcadeAudio.diagnostics().settings[muteKey];
        arcadeAudio.updateSettings({ [muteKey]: !currentlyMuted });
        arcadeAudio.click();
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
    button.setColor(muted ? 0x168c78 : 0x374e6b);
  }

  openTopLevel(tab) {
    if (tab === 'settings') return;
    this.scene.start('Intro', { tab: tab === 'miniGames' ? 'miniGames' : 'football' });
  }

  async installApp() {
    arcadeAudio.click();
    const result = await this.game.registry.get('platformActions')?.installWebApp?.();
    if (!this.sys.isActive()) return;
    this.installState = result ?? this.installState;
    if (this.installState.method === 'instructions') {
      this.infoOverlay = createCompactInfoOverlay(this, {
        kind: 'install',
        language: this.language,
        onClose: () => this.closeInfo(),
      });
    }
  }

  closeInfo() {
    if (!this.infoOverlay) return false;
    this.infoOverlay.destroy();
    this.infoOverlay = null;
    arcadeAudio.click();
    return true;
  }

  handlePlatformBack() {
    if (!this.closeInfo()) this.openTopLevel('football');
    return true;
  }

  serializeState() {
    const profile = playerProfileStore.get();
    return {
      mode: 'settings',
      compactPhoneUi: true,
      activeTab: this.activeTab,
      topLevelTab: 'settings',
      language: this.language,
      difficultyByGame: profile.difficultyByGame,
      stageLayout: this.stageLayout,
      modal: this.infoOverlay?.kind ?? null,
      install: this.installState,
      audio: arcadeAudio.diagnostics(),
      audioControls: {
        music: {
          muted: profile.audio.musicMuted,
          visible: this.activeTab === 'music',
          label: this.musicMuteButton?.text?.text ?? '',
          enabled: this.musicMuteButton?.zone?.input?.enabled === true,
        },
        effects: {
          muted: profile.audio.effectsMuted,
          visible: this.activeTab === 'effects',
          label: this.effectsMuteButton?.text?.text ?? '',
          enabled: this.effectsMuteButton?.zone?.input?.enabled === true,
        },
      },
      actions: [
        'open Football tab',
        'open Mini-games tab',
        'set English',
        'set Spanish',
        'select Music tab',
        'select Effects tab',
        'set volume',
        'mute',
        ...(this.installState.available ? ['install app'] : []),
      ],
    };
  }

  advanceForTesting() {}
}
