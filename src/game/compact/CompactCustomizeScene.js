import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import { cycleCharacter, getCharacter, getCharacterLabel } from '../content/characters.js';
import {
  ARENA_THEMES,
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
import { createIconButton } from '../ui/createIconButton.js';
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
import { createCompactInfoOverlay } from './createCompactInfoOverlay.js';

const assetUrl = (filename) => `${import.meta.env.BASE_URL}assets/${filename}`;
const TABS = new Set(['players', 'match', 'gear']);
const FOOTBALL_SETUP_PANEL = Object.freeze({
  y: 385,
  width: 1180,
  height: 430,
});

export class CustomizeScene extends Phaser.Scene {
  constructor() {
    super('Customize');
  }

  init(data = {}) {
    this.activeTab = TABS.has(data.tab) ? data.tab : 'players';
  }

  preload() {
    ARENA_THEMES.forEach((theme) => {
      if (!this.textures.exists(theme.texture)) this.load.image(theme.texture, assetUrl(theme.asset));
    });
  }

  create() {
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    this.playerCharacter = getCharacter(this.profile.playerCharacterId);
    this.opponent = getCharacter(this.profile.opponentId, 'bob');
    this.arenaTheme = getArenaTheme(this.profile.arenaThemeId);
    this.ballType = getBallType(this.profile.ballTypeId);
    this.infoOverlay = null;
    arcadeAudio.setScene('menu');
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearActiveScene(this);
      window.removeEventListener('keydown', this.onEscapeKey);
    });

    this.stageLayout = createArenaStage(this, { themeId: this.arenaTheme.id }).layout;
    createCompactBackdrop(this, { texture: this.arenaTheme.texture, top: 0x061126, bottom: 0x07101f, imageAlpha: 0.68 });
    createCompactHeader(this, {
      title: t(this.language, 'hub.football'),
      backLabel: t(this.language, 'customize.back'),
      onBack: () => this.back(),
      accent: 0x52d7e8,
    });
    this.helpButton = createIconButton(this, {
      x: 1218,
      y: 48,
      radius: 31,
      icon: 'help',
      accent: 0x52d7e8,
      prominent: true,
      onPress: () => this.openHelp(),
    });
    createCompactTabs(this, {
      tabs: [
        { id: 'players', label: this.language === 'es' ? 'JUGADORES' : 'PLAYERS' },
        { id: 'match', label: this.language === 'es' ? 'PARTIDO' : 'MATCH' },
        { id: 'gear', label: this.language === 'es' ? 'BALÓN Y PODER' : 'BALL & POWER' },
      ],
      activeId: this.activeTab,
      onSelect: (tab) => this.scene.restart({ tab }),
    });
    if (this.activeTab === 'players') this.createPlayersPage();
    else if (this.activeTab === 'match') this.createMatchPage();
    else this.createGearPage();

    createCompactPrimaryButton(this, {
      x: GAME_WIDTH / 2,
      y: 650,
      width: 520,
      height: 68,
      label: t(this.language, 'customize.play'),
      accent: 0xb47aff,
      onPress: () => this.startMatch(),
    });
    this.onEscapeKey = (event) => {
      if (event.key !== 'Escape' || event.repeat) return;
      event.preventDefault();
      if (!this.closeHelp()) this.back();
    };
    window.addEventListener('keydown', this.onEscapeKey);
  }

  createPlayersPage() {
    createCompactPanel(this, { ...FOOTBALL_SETUP_PANEL, accent: 0x7ce8ff });
    this.createCharacterSelector(405, t(this.language, 'customize.player'), this.playerCharacter, true);
    this.createCharacterSelector(875, t(this.language, 'customize.opponent'), this.opponent, false);
  }

  createCharacterSelector(x, label, character, isPlayer) {
    this.add.text(x, 210, label, compactTextStyle(27, '#8fefff')).setOrigin(0.5);
    this.add.circle(x, 375, 122, character.accent, 0.14).setStrokeStyle(5, character.accent, 0.68);
    this.add.image(x, 375, character.portraitTexture)
      .setDisplaySize(218, 218)
      .setFlipX(character.nativeFacing !== (isPlayer ? 1 : -1));
    createCompactButton(this, {
      x: x - 175,
      y: 375,
      width: 70,
      height: 104,
      label: '‹',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      onPress: () => this.rotateCharacter(isPlayer, -1),
    });
    createCompactButton(this, {
      x: x + 175,
      y: 375,
      width: 70,
      height: 104,
      label: '›',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      onPress: () => this.rotateCharacter(isPlayer, 1),
    });
    this.add.text(x, 545, getCharacterLabel(character, this.language), compactTextStyle(30, '#ffffff', {
      stroke: '#071426',
      strokeThickness: 6,
    })).setOrigin(0.5);
  }

  createMatchPage() {
    createCompactPanel(this, { ...FOOTBALL_SETUP_PANEL, accent: 0xffdc72 });
    const difficultyCenterX = 370;
    const arenaCenterX = 930;
    this.add.text(difficultyCenterX, 218, t(this.language, 'customize.difficulty'), compactTextStyle(28, '#ffdc72')).setOrigin(0.5);
    ['easy', 'normal', 'hard'].forEach((difficulty, index) => createCompactButton(this, {
      x: 205 + index * 165,
      y: 285,
      width: 145,
      height: 58,
      label: t(this.language, `settings.${difficulty}`),
      color: this.profile.difficultyByGame.football === difficulty ? 0xf29d38 : 0x1a395c,
      accent: 0xffcf70,
      active: this.profile.difficultyByGame.football === difficulty,
      onPress: () => this.setDifficulty(difficulty),
    }));
    compactBodyText(this, difficultyCenterX, 370, t(this.language, `customize.difficultyHelp.${this.profile.difficultyByGame.football}`), {
      width: 450,
      size: 26,
      color: '#d7e8f8',
    });

    this.add.text(arenaCenterX, 210, t(this.language, 'customize.field'), compactTextStyle(28, '#8fefff')).setOrigin(0.5);
    createCompactMediaFrame(this, {
      x: arenaCenterX,
      y: 355,
      width: 400,
      height: 225,
      texture: this.arenaTheme.texture,
      accent: this.arenaTheme.accent,
    });
    createCompactButton(this, { x: 685, y: 355, width: 64, height: 96, label: '‹', color: 0x1a6c79, activateOnPointerDown: true, onPress: () => this.rotateArena(-1) });
    createCompactButton(this, { x: 1175, y: 355, width: 64, height: 96, label: '›', color: 0x1a6c79, activateOnPointerDown: true, onPress: () => this.rotateArena(1) });
    this.add.text(arenaCenterX, 520, t(this.language, this.arenaTheme.nameKey), compactTextStyle(28, '#ffdc72')).setOrigin(0.5);
  }

  createGearPage() {
    createCompactPanel(this, { ...FOOTBALL_SETUP_PANEL, accent: 0xb47aff });
    this.add.text(405, 210, t(this.language, 'customize.object'), compactTextStyle(28, '#8fefff')).setOrigin(0.5);
    this.add.circle(405, 360, 112, 0x7ce8ff, 0.06).setStrokeStyle(3, 0x7ce8ff, 0.24);
    this.add.image(405, 360, this.ballType.texture)
      .setDisplaySize(this.ballType.displayWidth * 2.2, this.ballType.displayHeight * 2.2);
    createCompactButton(this, { x: 215, y: 360, width: 70, height: 104, label: '‹', color: 0x1a6c79, activateOnPointerDown: true, onPress: () => this.rotateBall(-1) });
    createCompactButton(this, { x: 595, y: 360, width: 70, height: 104, label: '›', color: 0x1a6c79, activateOnPointerDown: true, onPress: () => this.rotateBall(1) });
    this.add.text(405, 500, t(this.language, this.ballType.nameKey), compactTextStyle(29, '#ffdc72')).setOrigin(0.5);
    compactBodyText(this, 405, 548, t(this.language, `customize.feel.${this.ballType.family}`), {
      width: 440,
      size: 25,
      color: '#d7e8f8',
    });
    this.add.text(900, 260, t(this.language, 'lab.title'), compactTextStyle(33, '#ffffff')).setOrigin(0.5);
    compactBodyText(this, 900, 350, t(this.language, 'lab.subtitle'), { width: 480, size: 27, color: '#d7e8f8' });
    createCompactButton(this, {
      x: 900,
      y: 485,
      width: 410,
      height: 74,
      label: t(this.language, 'customize.powerLab'),
      color: 0x1596a8,
      onPress: () => this.openPowerLab(),
    });
  }

  rotateCharacter(isPlayer, direction) {
    const current = isPlayer ? this.playerCharacter : this.opponent;
    const next = cycleCharacter({
      id: current.id,
      direction,
      excludedId: isPlayer ? this.opponent.id : this.playerCharacter.id,
    });
    if (isPlayer) playerProfileStore.setPlayerCharacter(next.id);
    else playerProfileStore.setOpponent(next.id);
    arcadeAudio.click();
    this.scene.restart({ tab: this.activeTab });
  }

  setDifficulty(difficulty) {
    if (this.profile.difficultyByGame.football === difficulty) return;
    playerProfileStore.setGameDifficulty('football', difficulty);
    arcadeAudio.click();
    this.scene.restart({ tab: 'match' });
  }

  rotateArena(direction) {
    playerProfileStore.setArenaTheme(cycleArenaTheme(this.arenaTheme.id, direction).id);
    arcadeAudio.click();
    this.scene.restart({ tab: 'match' });
  }

  rotateBall(direction) {
    playerProfileStore.setBallType(cycleBallType(this.ballType.id, direction).id);
    arcadeAudio.click();
    this.scene.restart({ tab: 'gear' });
  }

  openHelp() {
    if (this.infoOverlay) return;
    arcadeAudio.click();
    this.infoOverlay = createCompactInfoOverlay(this, {
      kind: 'help',
      gameId: 'football',
      language: this.language,
      onClose: () => this.closeHelp(),
    });
  }

  closeHelp() {
    if (!this.infoOverlay) return false;
    this.infoOverlay.destroy();
    this.infoOverlay = null;
    arcadeAudio.click();
    return true;
  }

  openPowerLab() {
    arcadeAudio.menuEnter();
    this.scene.start('PowerLab', { returnScene: 'Customize' });
  }

  startMatch() {
    arcadeAudio.unlock();
    arcadeAudio.menuEnter();
    this.game.registry.get('platformActions')?.lockLandscape?.();
    this.scene.start('MatchLoading');
  }

  back() {
    arcadeAudio.click();
    this.scene.start('Intro', { tab: 'football' });
  }

  handlePlatformBack() {
    if (this.closeHelp()) return true;
    this.back();
    return true;
  }

  serializeState() {
    const profile = playerProfileStore.get();
    return {
      mode: 'football-setup',
      compactPhoneUi: true,
      activeTab: this.activeTab,
      language: this.language,
      stageLayout: this.stageLayout,
      playerCharacterId: profile.playerCharacterId,
      opponentId: profile.opponentId,
      playerCharacter: { id: profile.playerCharacterId },
      opponent: { id: profile.opponentId },
      difficulty: profile.difficultyByGame.football,
      arenaThemeId: profile.arenaThemeId,
      ballTypeId: profile.ballTypeId,
      modal: this.infoOverlay?.kind ?? null,
      actions: ['select Players tab', 'select Match tab', 'select Ball & Power tab', 'play'],
    };
  }

  advanceForTesting() {}
}
