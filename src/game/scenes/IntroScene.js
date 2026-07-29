import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import { getCharacter, getCharacterName } from '../content/characters.js';
import { getArenaTheme } from '../content/matchCustomization.js';
import { isTouchLayout } from '../input/isTouchLayout.js';
import { t } from '../i18n.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createArenaStage } from '../ui/createArenaStage.js';
import { createButton } from '../ui/createButton.js';
import { createIconButton } from '../ui/createIconButton.js';
import { createInfoOverlay } from '../ui/createInfoOverlay.js';
import { createJourneyCard } from '../ui/createJourneyCard.js';
import { createWebAppInfo } from '../../appMetadata.js';

const titleStyle = {
  fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
  fontStyle: 'bold',
  color: '#ffffff',
  stroke: '#10213e',
  strokeThickness: 10,
  shadow: { color: '#19c5dd', blur: 12, fill: true, offsetY: 5 },
};

export class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  create() {
    this.isTouchLayout = isTouchLayout();
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    this.playerCharacter = getCharacter(this.profile.playerCharacterId);
    this.opponent = getCharacter(this.profile.opponentId, 'bob');
    this.arenaTheme = getArenaTheme(this.profile.arenaThemeId);
    this.infoOverlay = null;
    arcadeAudio.setScene('menu');
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearActiveScene(this);
      window.removeEventListener('keydown', this.onEscapeKey);
    });

    this.stageLayout = createArenaStage(this, { themeId: this.arenaTheme.id }).layout;
    const horizontalOffset = Math.max(0, this.stageLayout.width - GAME_WIDTH) / 2;
    const wash = this.add.graphics();
    wash.fillGradientStyle(0x061126, 0x061126, 0x07101f, 0x07101f, 0.34, 0.34, 0.88, 0.88);
    wash.fillRect(-horizontalOffset, 0, this.stageLayout.width, this.stageLayout.height);
    const glow = this.add.graphics();
    glow.fillStyle(0x36ddec, 0.08).fillEllipse(GAME_WIDTH / 2, 220, 980, 430);

    this.add.text(GAME_WIDTH / 2, 53, 'JOEL FOOTBALL', {
      ...titleStyle,
      fontSize: '54px',
      letterSpacing: 2,
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 104, t(this.language, 'hub.chooseJourney'), {
      fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#d9f8ff',
      stroke: '#10213e',
      strokeThickness: 4,
      letterSpacing: 1,
    }).setOrigin(0.5);

    const lowerY = 493 + this.stageLayout.bottomOffset * 0.58;
    this.footballCard = createJourneyCard(this, {
      x: GAME_WIDTH / 2,
      y: 252,
      width: 1140,
      height: 220,
      texture: this.arenaTheme.texture,
      foregroundTexture: this.playerCharacter.portraitTexture,
      foregroundX: 0.73,
      foregroundScale: 0.62,
      imageFocusX: 0.72,
      title: t(this.language, 'hub.football'),
      subtitle: t(this.language, 'hub.footballSubtitle'),
      meta: t(this.language, 'hub.footballMeta'),
      icon: 'football',
      color: 0x155fbd,
      accent: 0xffc94e,
      onPress: () => this.startMatch(),
    });
    this.miniGamesCard = createJourneyCard(this, {
      x: 430,
      y: lowerY,
      width: 720,
      height: 180,
      texture: 'menu-arcade-cosmic',
      title: t(this.language, 'hub.miniGames'),
      subtitle: t(this.language, 'hub.miniGamesSubtitle'),
      meta: t(this.language, 'hub.miniGamesMeta', {
        level: this.profile.kickfall.lastPlayedLevel,
      }),
      icon: 'minigames',
      color: 0x6d2eb4,
      accent: 0x55e5ed,
      imageFocusX: 0.76,
      titleSize: 35,
      onPress: () => this.startMiniGames(),
    });
    this.optionsCard = createJourneyCard(this, {
      x: 1020,
      y: lowerY,
      width: 380,
      height: 180,
      texture: 'menu-options-workshop',
      title: t(this.language, 'hub.options'),
      icon: 'settings',
      color: 0xc14d37,
      accent: 0xffcf54,
      imageFocusX: 0.86,
      titleSize: 28,
      onPress: () => this.startSettings(),
    });

    this.aboutButton = createIconButton(this, {
      x: 44 + horizontalOffset,
      y: 48,
      radius: 28,
      icon: 'info',
      accent: 0xffdc72,
      onPress: () => this.openInfo('about'),
    });

    this.installState = this.game.registry.get('platformActions')?.getInstallState?.()
      ?? { available: false, installed: false, method: 'unavailable' };
    if (this.isTouchLayout && this.installState.available) {
      createButton(this, {
        x: 1125,
        y: 662 + this.stageLayout.bottomOffset,
        width: 230,
        height: 42,
        label: t(this.language, 'intro.install'),
        color: 0x168e78,
        onPress: () => this.installApp(),
      });
    }

    this.input.keyboard.on('keydown-ENTER', () => this.startMatch());
    this.input.keyboard.on('keydown-SPACE', () => this.startMatch());
    this.onEscapeKey = (event) => {
      if (event.key !== 'Escape' || event.repeat || !this.infoOverlay) return;
      event.preventDefault();
      this.closeInfo();
    };
    window.addEventListener('keydown', this.onEscapeKey);
  }

  async openInfo(kind) {
    if (this.infoOverlay) return;
    arcadeAudio.unlock();
    arcadeAudio.click();
    let appInfo = createWebAppInfo();
    if (kind === 'about') {
      appInfo = await this.game.registry.get('platformActions')?.getAppInfo?.() ?? appInfo;
      if (!this.sys.isActive()) return;
    }
    this.infoOverlay = createInfoOverlay(this, {
      kind,
      language: this.language,
      inputMode: this.isTouchLayout ? 'touch' : 'keyboard',
      appInfo,
      onClose: () => this.closeInfo(),
    });
  }

  async installApp() {
    arcadeAudio.unlock();
    arcadeAudio.click();
    const result = await this.game.registry.get('platformActions')?.installWebApp?.();
    if (!this.sys.isActive()) return;
    this.installState = result ?? this.installState;
    if (this.installState?.method === 'instructions') this.openInfo('install');
  }

  closeInfo() {
    if (!this.infoOverlay) return false;
    this.infoOverlay.destroy();
    this.infoOverlay = null;
    arcadeAudio.click();
    return true;
  }

  handlePlatformBack() {
    return this.closeInfo();
  }

  startMatch() {
    arcadeAudio.unlock();
    arcadeAudio.menuEnter();
    this.scene.start('Customize');
  }

  startCustomize() {
    this.startMatch();
  }

  startMiniGames() {
    arcadeAudio.unlock();
    arcadeAudio.menuEnter();
    this.scene.start('MiniGames');
  }

  startKickfall() {
    this.startMiniGames();
  }

  startPowerLab() {
    arcadeAudio.unlock();
    arcadeAudio.menuEnter();
    this.scene.start('PowerLab');
  }

  startSettings() {
    arcadeAudio.unlock();
    arcadeAudio.menuEnter();
    this.scene.start('Settings');
  }

  serializeState() {
    return {
      mode: 'intro',
      language: this.language,
      languageSource: this.profile.languageSource,
      difficultyByGame: this.profile.difficultyByGame,
      customization: {
        arenaThemeId: this.profile.arenaThemeId,
        ballTypeId: this.profile.ballTypeId,
      },
      inputMode: this.isTouchLayout ? 'touch' : 'keyboard',
      coordinateSystem: `origin top-left; +x right; +y down; logical canvas ${this.stageLayout.width}x${this.stageLayout.height}; gameplay region 1280x720`,
      stageLayout: this.stageLayout,
      title: 'Joel Football',
      playerCharacter: {
        id: this.playerCharacter.id,
        name: getCharacterName(this.playerCharacter, this.language),
      },
      opponent: {
        id: this.opponent.id,
        name: getCharacterName(this.opponent, this.language),
      },
      journeys: [
        { id: 'football', primary: true, destination: 'football-setup' },
        { id: 'mini-games', primary: false, destination: 'mini-games' },
      ],
      install: this.installState,
      modal: this.infoOverlay?.kind ?? null,
      modalAppInfo: this.infoOverlay?.appInfo ?? null,
      modalCreatorCharacter: this.infoOverlay?.creatorCharacter ?? null,
      audio: arcadeAudio.diagnostics(),
      actions: [
        'open football setup',
        'open mini-games',
        'open settings',
        ...(this.installState?.available ? ['install app'] : []),
        'open about',
      ],
    };
  }

  advanceForTesting() {
    this.tweens.update(16, 16);
  }
}
