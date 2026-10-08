import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import { cycleCharacter, getCharacter, getCharacterLabel } from '../content/characters.js';
import { t } from '../i18n.js';
import { getMiniGameEntry } from '../minigames/minigameCatalog.js';
import { DISC_HOCKEY_PREVIEW_TEXTURE, queueDiscHockeyPreview } from '../minigames/discHockey/discHockeyAssets.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createControlIcon } from '../ui/createControlIcon.js';
import { kickfallTotalStars } from '../pure/profile.js';
import { getSceneStageLayout } from '../layout/tabletStage.js';
import {
  compactBodyText,
  compactTextStyle,
  createCompactBackdrop,
  createCompactButton,
  createCompactHeader,
  createCompactMediaFrame,
  createCompactPanel,
  createCompactPrimaryButton,
} from './compactUi.js';
import {
  COMPACT_MINI_GAME_SETUP_TAB_IDS,
  createCompactMiniGameSetupTabs,
  normalizeCompactMiniGameSetupTab,
} from './compactMiniGameSetupTabs.js';

const MINI_GAME_SETUP_PANEL = Object.freeze({
  y: 390,
  width: 1040,
  height: 440,
  accent: 0x7ce8ff,
});

export class MiniGameSetupScene extends Phaser.Scene {
  constructor() {
    super('MiniGameSetup');
  }

  init(data = {}) {
    this.gameId = data.gameId === 'discHockey' ? 'discHockey' : 'kickfall';
    this.entry = getMiniGameEntry(this.gameId);
    this.activeTab = normalizeCompactMiniGameSetupTab(data.tab);
  }

  preload() {
    if (this.gameId === 'discHockey') queueDiscHockeyPreview(this);
  }

  create() {
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    this.stageLayout = getSceneStageLayout(this);
    this.levelSelect = null;
    this.levelSelectLoading = false;
    arcadeAudio.setScene('menu');
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clearActiveScene(this));
    const hockey = this.gameId === 'discHockey';
    createCompactBackdrop(this, {
      texture: hockey ? DISC_HOCKEY_PREVIEW_TEXTURE : 'menu-arcade-cosmic',
      top: hockey ? 0x061018 : 0x061127,
      bottom: hockey ? 0x24120b : 0x170c2a,
      imageAlpha: hockey ? 0.58 : 0.62,
    });
    createCompactHeader(this, {
      title: this.entry.title,
      backLabel: t(this.language, 'miniGames.back'),
      onBack: () => this.back(),
      accent: hockey ? 0xffb52f : 0x42dff5,
    });
    createCompactMiniGameSetupTabs(this, {
      language: this.language,
      activeTab: this.activeTab,
      onSelect: (tab) => this.scene.restart({ gameId: this.gameId, tab }),
    });
    if (hockey) {
      if (this.activeTab === 'players') this.createHockeyPlayers();
      else if (this.activeTab === 'setup') this.createHockeySetup();
      else this.createHockeyHowToPlay();
      createCompactPrimaryButton(this, { x: 640, y: 664, width: 500, height: 64, label: t(this.language, 'discHockeySetup.play'), accent: 0xff714f, onPress: () => this.playDiscHockey() });
    } else {
      if (this.activeTab === 'players') this.createKickfallPlayers();
      else if (this.activeTab === 'setup') this.createKickfallSetup();
      else this.createKickfallHowToPlay();
      const level = this.profile.kickfall.lastPlayedLevel;
      const hasProgress = this.profile.kickfall.highestUnlockedLevel > 1;
      const canResume = hasProgress && level > 1;
      if (canResume) {
        createCompactPrimaryButton(this, {
          x: 370,
          y: 664,
          width: 410,
          height: 64,
          label: t(this.language, 'kickfall.resume', { level }),
          accent: 0xb47aff,
          onPress: () => this.playKickfall(level),
        });
        createCompactButton(this, {
          x: 770,
          y: 664,
          width: 370,
          height: 60,
          label: t(this.language, 'kickfall.fromStart'),
          color: 0x1d3c60,
          accent: 0x7ce8ff,
          onPress: () => this.playKickfall(1),
        });
      } else {
        createCompactPrimaryButton(this, {
          x: hasProgress ? 520 : 640,
          y: 664,
          width: 500,
          height: 64,
          label: t(this.language, 'kickfallSetup.play'),
          accent: 0xb47aff,
          onPress: () => this.playKickfall(1),
        });
      }
      if (hasProgress) {
        const stars = kickfallTotalStars(this.profile.kickfall);
        createCompactButton(this, {
          x: 1090,
          y: 664,
          width: 250,
          height: 60,
          label: t(this.language, 'kickfall.levels', { stars }),
          color: 0x16406a,
          accent: 0xffdc72,
          onPress: () => this.openLevelSelect(),
        });
      }
    }
    this.input.keyboard.on('keydown-ESC', () => {
      if (!this.closeLevelSelect()) this.back();
    });
  }

  createKickfallSetup() {
    createCompactPanel(this, MINI_GAME_SETUP_PANEL);
    createCompactMediaFrame(this, {
      x: 380,
      y: 350,
      width: 430,
      height: 270,
      texture: 'menu-arcade-cosmic',
      accent: 0x73e7f5,
    });
    this.add.text(890, 205, t(this.language, 'kickfallSetup.objectiveTitle'), compactTextStyle(32, '#ffdc72')).setOrigin(0.5);
    compactBodyText(this, 890, 295, t(this.language, 'kickfallSetup.objective'), {
      width: 470,
      size: 26,
      color: '#d8eaff',
      lineSpacing: 7,
    });
    this.add.text(890, 395, t(this.language, 'kickfallSetup.difficulty'), compactTextStyle(24, '#b9cde5')).setOrigin(0.5);
    ['easy', 'normal', 'hard'].forEach((difficulty, index) => this.createDifficultyButton(720 + index * 170, 445, difficulty));
    compactBodyText(this, 890, 525, t(this.language, `kickfallSetup.difficulty.${this.profile.difficultyByGame.kickfall}`), {
      width: 500,
      size: 23,
      color: '#d7e8f8',
    });
  }

  createKickfallHowToPlay() {
    createCompactPanel(this, MINI_GAME_SETUP_PANEL);
    [
      ['right', 'kickfallSetup.move', 'kickfallSetup.moveCopy'],
      ['jump', 'kickfallSetup.jump', 'kickfallSetup.jumpCopy'],
      ['kick', 'kickfallSetup.kick', 'kickfallSetup.kickCopy'],
    ].forEach(([icon, labelKey, copyKey], index) => {
      const y = 245 + index * 120;
      this.add.circle(285, y, 40, 0x5be4f2, 0.1).setStrokeStyle(3, 0x8fefff, 0.42);
      createControlIcon(this, { x: 285, y, size: 44, icon, depth: 2, alpha: 1 });
      this.add.text(350, y - 17, t(this.language, labelKey), compactTextStyle(27, '#ffffff', { align: 'left' })).setOrigin(0, 0.5);
      this.add.text(350, y + 16, t(this.language, copyKey), compactTextStyle(25, '#c7d8ed', {
        align: 'left',
        wordWrap: { width: 690, useAdvancedWrap: true },
      })).setOrigin(0, 0.5);
    });
  }

  createKickfallPlayers() {
    createCompactPanel(this, MINI_GAME_SETUP_PANEL);
    const player = getCharacter(this.profile.playerCharacterId);
    this.createCharacterSelector(
      640,
      350,
      t(this.language, 'miniGameSetup.yourPlayer'),
      player,
      () => this.rotateLineup('player', -1),
      () => this.rotateLineup('player', 1),
    );
  }

  createHockeyPlayers() {
    createCompactPanel(this, MINI_GAME_SETUP_PANEL);
    const player = getCharacter(this.profile.playerCharacterId);
    const opponent = getCharacter(this.profile.opponentId);
    const crazy = this.profile.discHockey.mode === 'crazy';
    this.createCharacterSelector(405, 350, t(this.language, 'discHockeySetup.playerOne'), player, () => this.rotateLineup('player', -1), () => this.rotateLineup('player', 1));
    if (crazy) this.createCrazyPreview(875, 350);
    else this.createCharacterSelector(875, 350, this.profile.discHockey.mode === 'local'
      ? t(this.language, 'discHockeySetup.playerTwo')
      : t(this.language, 'discHockeySetup.computer'), opponent, () => this.rotateLineup('opponent', -1), () => this.rotateLineup('opponent', 1));
  }

  createCharacterSelector(x, y, label, character, onPrevious, onNext) {
    this.add.text(x, 205, label, compactTextStyle(25, '#ffffff')).setOrigin(0.5);
    this.add.circle(x, y, 105, character.accent, 0.14).setStrokeStyle(5, character.accent, 0.68);
    this.add.image(x, y, character.portraitTexture).setDisplaySize(190, 190).setFlipX(character.nativeFacing !== 1);
    createCompactButton(this, { x: x - 155, y, width: 66, height: 96, label: '‹', color: 0x1a4555, activateOnPointerDown: true, onPress: onPrevious });
    createCompactButton(this, { x: x + 155, y, width: 66, height: 96, label: '›', color: 0x1a4555, activateOnPointerDown: true, onPress: onNext });
    this.add.text(x, 485, getCharacterLabel(character, this.language), compactTextStyle(28, '#ffffff')).setOrigin(0.5);
  }

  createCrazyPreview(x, y) {
    this.add.text(x, 205, t(this.language, 'discHockeySetup.crazyRivals'), compactTextStyle(25, '#ffb16a')).setOrigin(0.5);
    [[-62, -55], [62, -55], [-62, 70], [62, 70]].forEach(([dx, dy], index) => {
      this.add.circle(x + dx, y + dy, 48, 0x7b1c1f, 0.95).setStrokeStyle(4, index % 2 ? 0xff6f3c : 0xffc64a, 0.84);
      this.add.text(x + dx, y + dy, '?', compactTextStyle(42, '#fff3c5')).setOrigin(0.5);
    });
  }

  createHockeySetup() {
    createCompactPanel(this, MINI_GAME_SETUP_PANEL);
    const mode = this.profile.discHockey.mode;
    this.add.text(640, 192, t(this.language, 'discHockeySetup.mode'), compactTextStyle(25, '#b9cde5')).setOrigin(0.5);
    [
      ['computer', 'discHockeySetup.vsComputer'],
      ['local', 'discHockeySetup.twoPlayers'],
      ['crazy', 'discHockeySetup.crazy'],
    ].forEach(([id, key], index) => this.createChoiceButton(345 + index * 295, 248, 265, t(this.language, key), mode === id, () => this.setDiscHockeySettings({ mode: id })));
    this.add.text(640, 314, t(this.language, 'discHockeySetup.arena'), compactTextStyle(25, '#b9cde5')).setOrigin(0.5);
    this.createChoiceButton(470, 365, 300, t(this.language, 'discHockeySetup.ice'), this.profile.discHockey.themeId === 'ice', () => this.setDiscHockeySettings({ themeId: 'ice' }));
    this.createChoiceButton(810, 365, 300, t(this.language, 'discHockeySetup.neon'), this.profile.discHockey.themeId === 'neon', () => this.setDiscHockeySettings({ themeId: 'neon' }));
    if (mode === 'computer') {
      this.add.text(330, 458, t(this.language, 'kickfallSetup.difficulty'), compactTextStyle(24, '#b9cde5')).setOrigin(0.5);
      ['easy', 'normal', 'hard'].forEach((difficulty, index) => this.createDifficultyButton(555 + index * 170, 458, difficulty));
      compactBodyText(this, 640, 538, t(this.language, `discHockeySetup.difficulty.${this.profile.difficultyByGame.discHockey}`), { width: 800, size: 25 });
    } else {
      compactBodyText(this, 640, 492, t(this.language, mode === 'crazy' ? 'discHockeySetup.crazyHint' : 'discHockeySetup.localHint'), { width: 850, size: 27, color: '#ffdc72' });
    }
  }

  createHockeyHowToPlay() {
    createCompactPanel(this, MINI_GAME_SETUP_PANEL);
    const [objective, campingRule = ''] = t(this.language, 'discHockeySetup.objective').split('\n');
    const controlsKey = `discHockeySetup.controls.${this.profile.discHockey.mode}`;
    this.add.text(640, 205, t(this.language, 'miniGameSetup.objective'), compactTextStyle(31, '#ffdc72')).setOrigin(0.5);
    compactBodyText(this, 640, 285, objective, {
      width: 920,
      size: 28,
      color: '#d8eaff',
      lineSpacing: 8,
    });
    compactBodyText(this, 640, 400, campingRule, {
      width: 920,
      size: 26,
      color: '#ffcf70',
      lineSpacing: 7,
    });
    this.add.rectangle(640, 462, 820, 2, 0x8fefff, 0.22);
    compactBodyText(this, 640, 520, t(this.language, controlsKey), {
      width: 880,
      size: 26,
      color: '#d9f8ff',
      lineSpacing: 8,
    });
  }

  createChoiceButton(x, y, width, label, active, onPress) {
    createCompactButton(this, {
      x,
      y,
      width,
      height: 58,
      label,
      color: active ? 0xd44a2f : 0x1a3950,
      accent: 0xff8c63,
      active,
      onPress: () => { if (!active) { arcadeAudio.click(); onPress(); } },
    });
  }

  createDifficultyButton(x, y, difficulty) {
    const active = this.profile.difficultyByGame[this.gameId] === difficulty;
    createCompactButton(this, {
      x,
      y,
      width: 150,
      height: 56,
      label: t(this.language, `settings.${difficulty}`),
      color: active ? 0xf29d38 : 0x1a395c,
      accent: 0xffcf70,
      active,
      onPress: () => {
        if (active) return;
        playerProfileStore.setGameDifficulty(this.gameId, difficulty);
        arcadeAudio.click();
        this.scene.restart({ gameId: this.gameId, tab: this.activeTab });
      },
    });
  }

  rotateLineup(side, direction) {
    const playerSide = side === 'player';
    const currentId = playerSide ? this.profile.playerCharacterId : this.profile.opponentId;
    const next = cycleCharacter({
      id: currentId,
      direction,
      excludedId: playerSide ? this.profile.opponentId : this.profile.playerCharacterId,
    });
    if (playerSide) playerProfileStore.setPlayerCharacter(next.id);
    else playerProfileStore.setOpponent(next.id);
    arcadeAudio.click();
    this.scene.restart({ gameId: this.gameId, tab: this.activeTab });
  }

  setDiscHockeySettings(patch) {
    playerProfileStore.setDiscHockeySettings(patch);
    this.scene.restart({ gameId: 'discHockey', tab: 'setup' });
  }

  playKickfall(level) {
    arcadeAudio.menuEnter();
    this.scene.start('MiniGameLoading', { gameId: 'kickfall', level });
  }

  playDiscHockey() {
    arcadeAudio.menuEnter();
    const profile = playerProfileStore.get();
    this.scene.start('MiniGameLoading', { gameId: 'discHockey', sceneData: { ...profile.discHockey } });
  }

  back() {
    arcadeAudio.click();
    this.scene.start('Intro', { tab: 'miniGames', gameId: this.gameId });
  }

  async openLevelSelect() {
    if (this.levelSelect || this.levelSelectLoading) return;
    arcadeAudio.click();
    // Loaded on demand: Kickfall code must stay out of the opening payload.
    this.levelSelectLoading = true;
    let createKickfallLevelSelect;
    try {
      ({ createKickfallLevelSelect } = await import('../ui/createKickfallLevelSelect.js'));
    } finally {
      this.levelSelectLoading = false;
    }
    if (!this.sys.isActive()) return;
    this.levelSelect = createKickfallLevelSelect(this, {
      progress: this.profile.kickfall,
      language: this.language,
      stageWidth: this.stageLayout.width,
      stageHeight: this.stageLayout.height,
      compact: true,
      onSelect: (level) => this.playKickfall(level),
      onClose: () => this.closeLevelSelect(),
    });
  }

  closeLevelSelect() {
    if (!this.levelSelect) return false;
    this.levelSelect.destroy();
    this.levelSelect = null;
    return true;
  }

  handlePlatformBack() {
    if (this.closeLevelSelect()) return true;
    this.back();
    return true;
  }

  serializeState() {
    const profile = playerProfileStore.get();
    return {
      mode: 'minigame-setup',
      compactPhoneUi: true,
      gameId: this.gameId,
      activeTab: this.activeTab,
      tabs: [...COMPACT_MINI_GAME_SETUP_TAB_IDS],
      language: this.language,
      stageLayout: this.stageLayout,
      difficulty: profile.difficultyByGame[this.gameId],
      playMode: this.gameId === 'discHockey' ? profile.discHockey.mode : undefined,
      themeId: this.gameId === 'discHockey' ? profile.discHockey.themeId : undefined,
      playerCharacterId: profile.playerCharacterId,
      opponentId: profile.opponentId,
      modal: this.levelSelect ? 'levelSelect' : null,
      actions: ['select tab', 'change options', 'play', 'open level select', 'back'],
    };
  }

  advanceForTesting() {}
}
