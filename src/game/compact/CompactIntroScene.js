import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import { getCharacter, getCharacterName } from '../content/characters.js';
import { getArenaTheme } from '../content/matchCustomization.js';
import { t } from '../i18n.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createArenaStage } from '../ui/createArenaStage.js';
import { createIconButton } from '../ui/createIconButton.js';
import { getSceneStageLayout } from '../layout/tabletStage.js';
import {
  DISC_HOCKEY_PREVIEW_TEXTURE,
  queueDiscHockeyPreview,
} from '../minigames/discHockey/discHockeyAssets.js';
import {
  compactBodyText,
  compactTextStyle,
  createCompactBackdrop,
  createCompactMediaFrame,
  createCompactPanel,
  createCompactPrimaryButton,
  createCompactTabs,
} from './compactUi.js';
import { createCompactInfoOverlay } from './createCompactInfoOverlay.js';
import { createWebAppInfo } from '../../appMetadata.js';

const TAB_IDS = new Set(['football', 'miniGames']);

export class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  init(data = {}) {
    this.activeTab = TAB_IDS.has(data.tab) ? data.tab : 'football';
    this.selectedMiniGameId = data.gameId === 'discHockey' ? 'discHockey' : 'kickfall';
  }

  preload() {
    if (this.activeTab === 'miniGames') queueDiscHockeyPreview(this);
  }

  create() {
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

    this.stageLayout = this.activeTab === 'miniGames'
      ? getSceneStageLayout(this)
      : createArenaStage(this, { themeId: this.arenaTheme.id }).layout;
    if (this.activeTab === 'miniGames') {
      const discHockey = this.selectedMiniGameId === 'discHockey';
      this.miniGameBackdropTexture = discHockey ? DISC_HOCKEY_PREVIEW_TEXTURE : 'menu-arcade-cosmic';
      createCompactBackdrop(this, {
        texture: this.miniGameBackdropTexture,
        top: discHockey ? 0x061018 : 0x061127,
        bottom: discHockey ? 0x1b0c08 : 0x10051f,
        imageAlpha: 1,
        washTopAlpha: 0.34,
        washBottomAlpha: 0.72,
      });
    } else {
      createCompactBackdrop(this, {
        texture: this.arenaTheme.texture,
        top: 0x061126,
        bottom: 0x07101f,
        imageAlpha: 0.7,
      });
    }
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
      activeId: this.activeTab,
      y: 112,
      width: 1020,
      onSelect: (tab) => {
        if (tab === 'settings') this.startSettings();
        else this.scene.restart({ tab, gameId: this.selectedMiniGameId });
      },
    });

    if (this.activeTab === 'football') this.createFootballPage();
    else this.createMiniGamesPage();

    this.aboutButton = createIconButton(this, {
      x: 1218,
      y: 48,
      radius: 31,
      icon: 'info',
      accent: 0xffdc72,
      prominent: true,
      onPress: () => this.openInfo(),
    });

    this.onEscapeKey = (event) => {
      if (event.key !== 'Escape' || event.repeat || !this.infoOverlay) return;
      event.preventDefault();
      this.closeInfo();
    };
    window.addEventListener('keydown', this.onEscapeKey);
  }

  createFootballPage() {
    createCompactPanel(this, { y: 365, width: 1060, height: 430, accent: 0x55e9f5 });
    createCompactMediaFrame(this, {
      x: 870,
      y: 350,
      width: 460,
      height: 260,
      texture: this.arenaTheme.texture,
      accent: 0x55e9f5,
    });
    this.add.text(345, 260, t(this.language, 'hub.football'), compactTextStyle(43, '#ffffff', {
      fontFamily: 'Arial Black, sans-serif',
    })).setOrigin(0.5);
    compactBodyText(this, 345, 338, t(this.language, 'hub.footballSubtitle'), {
      width: 390,
      size: 28,
      color: '#d9f8ff',
    });
    compactBodyText(this, 345, 410, t(this.language, 'hub.footballMeta'), {
      width: 390,
      size: 26,
      color: '#ffdc72',
    });
    createCompactPrimaryButton(this, {
      x: GAME_WIDTH / 2,
      y: 620,
      width: 520,
      height: 68,
      label: t(this.language, 'hub.start'),
      accent: 0x55e9f5,
      onPress: () => this.startMatch(),
    });
  }

  createMiniGamesPage() {
    createCompactPanel(this, { y: 375, width: 1060, height: 440, accent: 0xb47aff });
    this.add.text(640, 190, t(this.language, 'hub.chooseGame'), compactTextStyle(28, '#ffffff'))
      .setOrigin(0.5);
    const games = [
      {
        id: 'kickfall',
        title: 'KICKFALL',
        texture: 'menu-arcade-cosmic',
        subtitle: t(this.language, 'miniGames.kickfallSubtitle'),
        accent: 0xb47aff,
      },
      {
        id: 'discHockey',
        title: 'DISC HOCKEY',
        texture: this.textures.exists('menu-disc-hockey-card') ? 'menu-disc-hockey-card' : DISC_HOCKEY_PREVIEW_TEXTURE,
        subtitle: t(this.language, 'miniGames.discHockeySubtitle'),
        accent: 0xffb52f,
      },
    ];
    const cardCenters = [395, 885];
    this.miniGameCardContainers = games.map((game, index) => {
      const selected = game.id === this.selectedMiniGameId;
      const container = this.add.container(cardCenters[index], 380);
      const shadow = this.add.rectangle(0, 10, 462, 310, 0x020711, 0.62);
      const frame = this.add.rectangle(0, 0, 462, 310, 0x273b52, 1)
        .setStrokeStyle(selected ? 4 : 3, selected ? game.accent : 0x9ab8cf, selected ? 1 : 0.7);
      const card = this.add.rectangle(0, 0, 448, 296, 0x0a1729, 1)
        .setStrokeStyle(2, game.accent, selected ? 0.42 : 0.14);
      const art = this.add.image(0, -51, game.texture).setDisplaySize(436, 186);
      const glare = this.add.rectangle(0, -99, 432, 82, 0xffffff, 0.045);
      const veil = this.add.rectangle(0, 94, 436, 100, 0x061226, 1);
      const rail = this.add.rectangle(0, -150, 444, 4, game.accent, selected ? 1 : 0.15);
      const title = this.add.text(0, 67, game.title, compactTextStyle(31, selected ? '#ffffff' : '#d7e8f8', {
        fontFamily: 'Arial Black, sans-serif',
      })).setOrigin(0.5);
      const subtitle = this.add.text(0, 113, game.subtitle, compactTextStyle(22, selected ? '#ffdc72' : '#a9bdd8', {
        wordWrap: { width: 410, useAdvancedWrap: true },
      })).setOrigin(0.5);
      container.add([shadow, frame, card, art, glare, veil, rail, title, subtitle]);
      return container;
    });
    this.createMiniGameShelfInput(games, cardCenters);
    const selected = games.find((game) => game.id === this.selectedMiniGameId);
    createCompactPrimaryButton(this, {
      x: GAME_WIDTH / 2,
      y: 620,
      width: 520,
      height: 68,
      label: t(this.language, 'hub.start'),
      accent: selected.accent,
      onPress: () => this.startSelectedMiniGame(),
    });
  }

  createMiniGameShelfInput(games, cardCenters) {
    const zone = this.add.zone(640, 380, 1000, 330).setInteractive({ useHandCursor: true });
    let startX = null;
    let lastX = null;
    const resetCards = () => this.miniGameCardContainers.forEach((container, index) => {
      container.x = cardCenters[index];
    });
    zone.on('pointerdown', (pointer) => {
      startX = pointer.worldX;
      lastX = startX;
    });
    zone.on('pointermove', (pointer) => {
      if (startX == null || !pointer.isDown) return;
      lastX = pointer.worldX;
      const drag = Phaser.Math.Clamp(lastX - startX, -70, 70);
      this.miniGameCardContainers.forEach((container, index) => {
        container.x = cardCenters[index] + drag;
      });
    });
    const finish = (pointer) => {
      if (startX == null) return;
      lastX = pointer.worldX;
      const drag = lastX - startX;
      startX = null;
      resetCards();
      if (drag <= -45) this.selectMiniGame('discHockey');
      else if (drag >= 45) this.selectMiniGame('kickfall');
      else this.selectMiniGame(lastX < 640 ? games[0].id : games[1].id);
    };
    zone.on('pointerup', finish);
    zone.on('pointerupoutside', finish);
  }

  selectMiniGame(gameId) {
    if (gameId === this.selectedMiniGameId) return;
    arcadeAudio.click();
    this.scene.restart({ tab: 'miniGames', gameId });
  }

  async openInfo() {
    if (this.infoOverlay) return;
    arcadeAudio.click();
    const appInfo = await this.game.registry.get('platformActions')?.getAppInfo?.() ?? createWebAppInfo();
    if (!this.sys.isActive()) return;
    this.infoOverlay = createCompactInfoOverlay(this, {
      kind: 'about',
      language: this.language,
      appInfo,
      onClose: () => this.closeInfo(),
      onOpenExternal: (url) => this.game.registry.get('platformActions')?.openExternalUrl?.(url),
    });
  }

  closeInfo() {
    if (!this.infoOverlay) return false;
    this.infoOverlay.destroy();
    this.infoOverlay = null;
    arcadeAudio.click();
    return true;
  }

  startMatch() {
    arcadeAudio.menuEnter();
    this.scene.start('Customize');
  }

  startSelectedMiniGame() {
    arcadeAudio.menuEnter();
    this.scene.start('MiniGameSetup', { gameId: this.selectedMiniGameId });
  }

  startSettings() {
    this.scene.start('Settings');
  }

  handlePlatformBack() {
    return this.closeInfo();
  }

  serializeState() {
    return {
      mode: 'intro',
      compactPhoneUi: true,
      activeTab: this.activeTab,
      selectedMiniGameId: this.activeTab === 'miniGames' ? this.selectedMiniGameId : null,
      miniGameBackdrop: this.activeTab === 'miniGames'
        ? { texture: this.miniGameBackdropTexture, opacity: 1 }
        : null,
      language: this.language,
      inputMode: 'touch',
      stageLayout: this.stageLayout,
      title: 'Joel Football',
      playerCharacter: { id: this.playerCharacter.id, name: getCharacterName(this.playerCharacter, this.language) },
      opponent: { id: this.opponent.id, name: getCharacterName(this.opponent, this.language) },
      modal: this.infoOverlay?.kind ?? null,
      journeys: [
        { id: 'football', primary: true, destination: 'football-setup' },
        { id: 'mini-games', primary: false, destination: 'mini-games' },
        { id: 'settings', primary: false, destination: 'settings' },
      ],
      actions: [
        'select Football tab',
        'select Mini-games tab',
        ...(this.activeTab === 'miniGames' ? ['swipe game cards', 'start selected mini-game'] : []),
        'open Settings tab',
        'open about',
      ],
    };
  }

  advanceForTesting() {}
}
