import { totalKickfallStars } from '../pure/profile.js';
import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import { CHARACTERS, cycleCharacter, getCharacter, getCharacterLabel, getCharacterName } from '../content/characters.js';
import { t } from '../i18n.js';
import { DISC_HOCKEY_PREVIEW_TEXTURE, queueDiscHockeyPreview } from '../minigames/discHockey/discHockeyAssets.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createArenaStage } from '../ui/createArenaStage.js';
import {
  compactBodyText,
  compactTextStyle,
  createCompactBackdrop,
  createCompactButton,
  createCompactHeader,
  createCompactMediaFrame,
  createCompactPanel,
  createCompactPrimaryButton,
  createCompactTabs,
} from './compactUi.js';

export class MiniGamesScene extends Phaser.Scene {
  constructor() {
    super('MiniGames');
  }

  init(data = {}) {
    this.activeTab = data.tab === 'discHockey' ? 'discHockey' : 'kickfall';
  }

  preload() {
    queueDiscHockeyPreview(this);
  }

  create() {
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    this.playerCharacter = getCharacter(this.profile.playerCharacterId);
    arcadeAudio.setScene('menu');
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clearActiveScene(this));
    this.stageLayout = createArenaStage(this).layout;
    createCompactBackdrop(this, {
      texture: this.activeTab === 'kickfall' ? 'menu-arcade-cosmic' : DISC_HOCKEY_PREVIEW_TEXTURE,
      top: 0x07152d,
      bottom: 0x170c2a,
      imageAlpha: 0.6,
    });
    createCompactHeader(this, {
      title: t(this.language, 'miniGames.title'),
      backLabel: t(this.language, 'miniGames.back'),
      onBack: () => this.back(),
      accent: 0xb47aff,
    });
    createCompactTabs(this, {
      tabs: [
        { id: 'kickfall', label: 'KICKFALL', color: 0x6634a7 },
        { id: 'discHockey', label: 'DISC HOCKEY', color: 0x9a241c },
      ],
      activeId: this.activeTab,
      width: 820,
      onSelect: (tab) => this.scene.restart({ tab }),
    });
    this.createGamePage();
    this.input.keyboard.on('keydown-ESC', () => this.back());
  }

  createGamePage() {
    const kickfall = this.activeTab === 'kickfall';
    const accent = kickfall ? 0xb47aff : 0xffcf4a;
    createCompactPanel(this, { y: 350, width: 1040, height: 350, accent });
    const discHockeyCard = this.textures.exists('menu-disc-hockey-card') ? 'menu-disc-hockey-card' : DISC_HOCKEY_PREVIEW_TEXTURE;
    const texture = kickfall ? 'menu-arcade-cosmic' : discHockeyCard;
    createCompactMediaFrame(this, { x: 420, y: 350, width: 490, height: 290, texture, accent });
    const title = kickfall ? 'KICKFALL' : 'DISC HOCKEY';
    const subtitle = t(this.language, kickfall ? 'miniGames.kickfallSubtitle' : 'miniGames.discHockeySubtitle');
    const meta = kickfall
      ? t(this.language, 'miniGames.kickfallMeta', {
        level: this.profile.kickfall.lastPlayedLevel,
        total: 20,
        stars: totalKickfallStars(this.profile.kickfall),
        maxStars: 60,
      })
      : t(this.language, 'miniGames.discHockeyMeta');
    this.add.text(900, 250, title, compactTextStyle(42, '#ffffff', { fontFamily: 'Arial Black, sans-serif' })).setOrigin(0.5);
    compactBodyText(this, 900, 344, subtitle, { width: 430, size: 26, color: '#d9f8ff' });
    compactBodyText(this, 900, 430, meta, { width: 430, size: 25, color: '#ffdc72' });
    createCompactPrimaryButton(this, {
      x: 900,
      y: 505,
      width: 390,
      height: 64,
      label: kickfall ? t(this.language, 'kickfallSetup.play') : t(this.language, 'discHockeySetup.play'),
      accent,
      onPress: () => kickfall ? this.openKickfall() : this.openDiscHockey(),
    });
  }

  createPlayerSelector() {
    const y = 605;
    this.add.rectangle(640, y, 820, 92, 0x071426, 0.98).setStrokeStyle(3, this.playerCharacter.accent, 0.62);
    this.add.text(325, y, t(this.language, 'miniGames.playAs'), compactTextStyle(25, '#ffffff')).setOrigin(0.5);
    this.add.circle(640, y, 42, this.playerCharacter.accent, 0.12).setStrokeStyle(2, this.playerCharacter.accent, 0.4);
    this.add.image(640, y, this.playerCharacter.portraitTexture)
      .setDisplaySize(82, 82)
      .setFlipX(this.playerCharacter.nativeFacing !== 1);
    createCompactButton(this, { x: 535, y, width: 58, height: 68, label: '‹', color: 0x1a6c79, activateOnPointerDown: true, onPress: () => this.rotatePlayer(-1) });
    createCompactButton(this, { x: 745, y, width: 58, height: 68, label: '›', color: 0x1a6c79, activateOnPointerDown: true, onPress: () => this.rotatePlayer(1) });
    this.add.text(955, y, getCharacterLabel(this.playerCharacter, this.language), compactTextStyle(25, Phaser.Display.Color.IntegerToColor(this.playerCharacter.accent).rgba)).setOrigin(0.5);
  }

  rotatePlayer(direction) {
    const next = cycleCharacter({ id: this.playerCharacter.id, direction });
    playerProfileStore.setPlayerCharacter(next.id);
    arcadeAudio.click();
    this.scene.restart({ tab: this.activeTab });
  }

  openKickfall() {
    arcadeAudio.menuEnter();
    this.scene.start('MiniGameSetup', { gameId: 'kickfall' });
  }

  openDiscHockey() {
    arcadeAudio.menuEnter();
    this.scene.start('MiniGameSetup', { gameId: 'discHockey' });
  }

  back() {
    arcadeAudio.click();
    this.scene.start('Intro', { tab: 'miniGames' });
  }

  handlePlatformBack() {
    this.back();
    return true;
  }

  serializeState() {
    return {
      mode: 'mini-games',
      compactPhoneUi: true,
      activeTab: this.activeTab,
      language: this.language,
      stageLayout: this.stageLayout,
      playerCharacter: {
        id: this.playerCharacter.id,
        name: getCharacterName(this.playerCharacter, this.language),
        available: CHARACTERS.map(({ id }) => id),
      },
      games: ['kickfall', 'discHockey'],
      actions: ['select Kickfall tab', 'select Disc Hockey tab', 'previous player', 'next player', 'play'],
    };
  }

  advanceForTesting() {}
}
