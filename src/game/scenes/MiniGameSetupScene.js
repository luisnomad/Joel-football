import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import {
  cycleCharacter,
  getCharacter,
  getCharacterLabel,
} from '../content/characters.js';
import { isTouchLayout } from '../input/isTouchLayout.js';
import { t } from '../i18n.js';
import { getSceneStageLayout } from '../layout/tabletStage.js';
import { getMiniGameEntry } from '../minigames/minigameCatalog.js';
import {
  DISC_HOCKEY_PREVIEW_TEXTURE,
  queueDiscHockeyPreview,
} from '../minigames/discHockey/discHockeyAssets.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createButton } from '../ui/createButton.js';
import { createControlIcon } from '../ui/createControlIcon.js';
import { createIconButton } from '../ui/createIconButton.js';
import { createInfoOverlay } from '../ui/createInfoOverlay.js';

const textStyle = (size, color = '#ffffff', extra = {}) => ({
  fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
  fontSize: `${size}px`,
  fontStyle: 'bold',
  color,
  ...extra,
});

export class MiniGameSetupScene extends Phaser.Scene {
  constructor() {
    super('MiniGameSetup');
  }

  init(data = {}) {
    this.gameId = data.gameId === 'discHockey' ? 'discHockey' : 'kickfall';
    this.entry = getMiniGameEntry(this.gameId);
  }

  preload() {
    if (this.gameId === 'discHockey') queueDiscHockeyPreview(this);
  }

  create() {
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    this.isTouchLayout = isTouchLayout();
    this.infoOverlay = null;
    this.stageLayout = getSceneStageLayout(this);
    arcadeAudio.setScene('menu');
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearActiveScene(this);
      window.removeEventListener('keydown', this.onEscapeKey);
    });

    this.createBackdrop();
    createButton(this, {
      x: 82,
      y: 52,
      width: 130,
      height: 46,
      label: `‹  ${t(this.language, 'miniGames.back')}`,
      color: 0x173858,
      onPress: () => this.back(),
    });
    this.add.text(GAME_WIDTH / 2, 60, this.entry.title, {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: this.gameId === 'discHockey' ? '52px' : '58px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: this.gameId === 'discHockey' ? '#4c150d' : '#25143f',
      strokeThickness: 11,
      shadow: {
        color: this.gameId === 'discHockey' ? '#ffb52f' : '#42dff5',
        blur: 14,
        fill: true,
        offsetY: 5,
      },
    }).setOrigin(0.5);

    if (this.gameId === 'discHockey') this.createDiscHockeySetup();
    else this.createKickfallSetup();

    this.onEscapeKey = (event) => {
      if (event.key !== 'Escape' || event.repeat) return;
      event.preventDefault();
      if (!this.closeHelp()) this.back();
    };
    window.addEventListener('keydown', this.onEscapeKey);
  }

  createBackdrop() {
    const horizontalOffset = Math.max(0, this.stageLayout.width - GAME_WIDTH) / 2;
    if (horizontalOffset >= 12) this.cameras.main.setScroll(-horizontalOffset, 0);
    this.add.image(
      GAME_WIDTH / 2,
      this.stageLayout.height / 2,
      this.gameId === 'discHockey' ? DISC_HOCKEY_PREVIEW_TEXTURE : 'menu-arcade-cosmic',
    ).setDisplaySize(this.stageLayout.width, this.stageLayout.height);
    const wash = this.add.graphics();
    if (this.gameId === 'discHockey') {
      wash.fillGradientStyle(0x061018, 0x061018, 0x24120b, 0x24120b, 0.76, 0.72, 0.9, 0.9);
    } else {
      wash.fillGradientStyle(0x061127, 0x061127, 0x170c2a, 0x170c2a, 0.8, 0.78, 0.96, 0.96);
    }
    wash.fillRect(-horizontalOffset, 0, this.stageLayout.width, this.stageLayout.height);
  }

  createKickfallSetup() {
    this.helpButton = createIconButton(this, {
      x: 1218,
      y: 52,
      radius: 28,
      icon: 'help',
      accent: 0x52d7e8,
      onPress: () => this.openHelp(),
    });
    this.add.rectangle(335, 354, 570, 430, 0x071426, 0.96)
      .setStrokeStyle(4, 0x73e7f5, 0.52);
    this.add.image(335, 312, 'menu-arcade-cosmic').setDisplaySize(540, 285);
    this.add.rectangle(335, 482, 540, 120, 0x071426, 0.9);
    this.add.text(335, 455, t(this.language, 'kickfallSetup.objectiveTitle'), textStyle(22, '#ffdc72'))
      .setOrigin(0.5);
    this.add.text(335, 502, t(this.language, 'kickfallSetup.objective'), {
      ...textStyle(16, '#d8eaff'),
      align: 'center',
      wordWrap: { width: 480 },
      lineSpacing: 5,
    }).setOrigin(0.5);
    this.add.rectangle(900, 354, 525, 430, 0x09172e, 0.96)
      .setStrokeStyle(4, 0xb47aff, 0.42);
    this.add.text(900, 165, t(this.language, 'kickfallSetup.howToPlay'), textStyle(24))
      .setOrigin(0.5);
    this.createControlRow(720, 220, 'right', t(this.language, 'kickfallSetup.move'), t(this.language, 'kickfallSetup.moveCopy'));
    this.createControlRow(720, 292, 'jump', t(this.language, 'kickfallSetup.jump'), t(this.language, 'kickfallSetup.jumpCopy'));
    this.createControlRow(720, 364, 'kick', t(this.language, 'kickfallSetup.kick'), t(this.language, 'kickfallSetup.kickCopy'));
    this.add.text(900, 431, t(this.language, 'kickfallSetup.difficulty'), textStyle(17, '#b9cde5'))
      .setOrigin(0.5);
    ['easy', 'normal', 'hard'].forEach((difficulty, index) => (
      this.createDifficultyButton(790 + index * 110, 470, difficulty)
    ));
    this.add.text(
      900,
      514,
      t(this.language, `kickfallSetup.difficulty.${this.profile.difficultyByGame.kickfall}`),
      {
        ...textStyle(14, '#c7d8ed'),
        align: 'center',
        wordWrap: { width: 430 },
      },
    ).setOrigin(0.5);

    const continueLevel = this.profile.kickfall.lastPlayedLevel;
    const hasProgress = this.profile.kickfall.highestUnlockedLevel > 1;
    createButton(this, {
      x: hasProgress ? 745 : GAME_WIDTH / 2,
      y: 620 + this.stageLayout.bottomOffset,
      width: hasProgress ? 370 : 420,
      height: 62,
      label: hasProgress
        ? t(this.language, 'kickfall.resume', { level: continueLevel })
        : t(this.language, 'kickfallSetup.play'),
      color: 0x705cff,
      onPress: () => this.playKickfall(hasProgress ? continueLevel : 1),
    });
    if (hasProgress) {
      createButton(this, {
        x: 1065,
        y: 620 + this.stageLayout.bottomOffset,
        width: 240,
        height: 54,
        label: t(this.language, 'kickfall.fromStart'),
        color: 0x1d3c60,
        onPress: () => this.playKickfall(1),
      });
    }
  }

  createDiscHockeySetup() {
    const player = getCharacter(this.profile.playerCharacterId);
    const opponent = getCharacter(this.profile.opponentId);
    const isComputerMode = this.profile.discHockey.mode === 'computer';
    const isLocalMode = this.profile.discHockey.mode === 'local';
    const isCrazyMode = this.profile.discHockey.mode === 'crazy';
    const headerLabels = {
      left: getCharacterLabel(player, this.language),
      right: isCrazyMode
        ? t(this.language, 'discHockey.crazySquad')
        : getCharacterLabel(opponent, this.language),
    };
    [
      { x: 260, label: headerLabels.left },
      { x: 1020, label: headerLabels.right },
    ].forEach(({ x, label }) => {
      this.add.rectangle(x, 34, 190, 50, 0x07131c, 0.99);
      this.add.text(x, 34, label, textStyle(21, '#ffd66b', {
        stroke: '#10161c',
        strokeThickness: 5,
      })).setOrigin(0.5);
    });
    this.add.rectangle(325, 350, 555, 450, 0x07131c, 0.96)
      .setStrokeStyle(4, 0xffc64a, 0.52);
    this.add.text(325, 145, t(this.language, 'discHockeySetup.lineup'), textStyle(23, '#ffd66b'))
      .setOrigin(0.5);
    this.createCharacterSelector({
      x: 195,
      y: 300,
      label: t(this.language, 'discHockeySetup.playerOne'),
      character: player,
      onPrevious: () => this.rotateLineup('player', -1),
      onNext: () => this.rotateLineup('player', 1),
    });
    if (isCrazyMode) {
      this.createCrazyRivalsPreview(455, 300);
    } else {
      this.createCharacterSelector({
        x: 455,
        y: 300,
        label: isLocalMode
          ? t(this.language, 'discHockeySetup.playerTwo')
          : t(this.language, 'discHockeySetup.computer'),
        character: opponent,
        onPrevious: () => this.rotateLineup('opponent', -1),
        onNext: () => this.rotateLineup('opponent', 1),
      });
    }
    this.add.text(325, 480, t(this.language, 'discHockeySetup.objective'), {
      ...textStyle(15, '#d8eaff'),
      align: 'center',
      wordWrap: { width: 485 },
      lineSpacing: 5,
    }).setOrigin(0.5);

    this.add.rectangle(935, 350, 580, 450, 0x101921, 0.96)
      .setStrokeStyle(4, 0xe0442d, 0.52);
    this.add.text(935, 135, t(this.language, 'discHockeySetup.match'), textStyle(23))
      .setOrigin(0.5);
    this.add.text(935, 176, t(this.language, 'discHockeySetup.mode'), textStyle(14, '#b9cde5'))
      .setOrigin(0.5);
    this.createChoiceButton({
      x: 750,
      y: 216,
      width: 165,
      label: t(this.language, 'discHockeySetup.vsComputer'),
      active: isComputerMode,
      onPress: () => this.setDiscHockeySettings({ mode: 'computer' }),
    });
    this.createChoiceButton({
      x: 935,
      y: 216,
      width: 165,
      label: t(this.language, 'discHockeySetup.twoPlayers'),
      active: isLocalMode,
      onPress: () => this.setDiscHockeySettings({ mode: 'local' }),
    });
    this.createChoiceButton({
      x: 1120,
      y: 216,
      width: 165,
      label: t(this.language, 'discHockeySetup.crazy'),
      active: isCrazyMode,
      onPress: () => this.setDiscHockeySettings({ mode: 'crazy' }),
    });
    this.add.text(935, 274, t(this.language, 'discHockeySetup.arena'), textStyle(14, '#b9cde5'))
      .setOrigin(0.5);
    this.createChoiceButton({
      x: 800,
      y: 314,
      width: 220,
      label: t(this.language, 'discHockeySetup.ice'),
      active: this.profile.discHockey.themeId === 'ice',
      onPress: () => this.setDiscHockeySettings({ themeId: 'ice' }),
    });
    this.createChoiceButton({
      x: 1070,
      y: 314,
      width: 220,
      label: t(this.language, 'discHockeySetup.neon'),
      active: this.profile.discHockey.themeId === 'neon',
      onPress: () => this.setDiscHockeySettings({ themeId: 'neon' }),
    });
    this.add.text(
      935,
      372,
      t(
        this.language,
        isLocalMode ? 'discHockeySetup.localReady' : 'kickfallSetup.difficulty',
      ),
      textStyle(14, '#b9cde5'),
    ).setOrigin(0.5);
    if (isCrazyMode) {
      this.add.rectangle(935, 414, 440, 48, 0x6f1718, 0.96)
        .setStrokeStyle(3, 0xff6f3c, 0.8);
      this.add.text(
        935,
        414,
        t(this.language, 'discHockeySetup.crazyLocked'),
        {
          ...textStyle(14, '#fff0c2'),
          align: 'center',
          wordWrap: { width: 410 },
        },
      ).setOrigin(0.5);
    } else if (isComputerMode) {
      ['easy', 'normal', 'hard'].forEach((difficulty, index) => (
        this.createDifficultyButton(780 + index * 155, 414, difficulty, { width: 132 })
      ));
    } else {
      this.add.rectangle(935, 414, 440, 48, 0x213d4b, 0.92)
        .setStrokeStyle(2, 0xffc64a, 0.45);
      this.add.text(
        935,
        414,
        t(this.language, 'discHockeySetup.localHint'),
        {
          ...textStyle(14, '#f5e6b5'),
          align: 'center',
          wordWrap: { width: 400 },
        },
      ).setOrigin(0.5);
    }
    this.add.text(
      935,
      466,
      isCrazyMode
        ? t(this.language, 'discHockeySetup.crazyHint')
        : isLocalMode
          ? ''
          : t(this.language, `discHockeySetup.difficulty.${this.profile.difficultyByGame.discHockey}`),
      {
        ...textStyle(14, '#c7d8ed'),
        align: 'center',
        wordWrap: { width: 500 },
        lineSpacing: 4,
      },
    ).setOrigin(0.5);
    this.add.rectangle(935, 528, 520, 58, 0x07131c, 0.88)
      .setStrokeStyle(2, 0xffc64a, 0.32);
    this.add.text(935, 528, t(
      this.language,
      isCrazyMode
        ? 'discHockeySetup.controls.crazy'
        : isComputerMode
          ? 'discHockeySetup.controls.computer'
          : 'discHockeySetup.controls.local',
    ), {
      ...textStyle(13, '#ffd66b'),
      align: 'center',
      wordWrap: { width: 480 },
    }).setOrigin(0.5);

    createButton(this, {
      x: GAME_WIDTH / 2,
      y: 626 + this.stageLayout.bottomOffset,
      width: 430,
      height: 64,
      label: t(this.language, 'discHockeySetup.play'),
      color: 0xc83b25,
      onPress: () => this.playDiscHockey(),
    });
  }

  createCrazyRivalsPreview(x, y) {
    this.add.text(
      x,
      y - 96,
      t(this.language, 'discHockeySetup.crazyRivals'),
      textStyle(16, '#ffb16a'),
    ).setOrigin(0.5);
    [
      [-42, -34],
      [42, -34],
      [-42, 42],
      [42, 42],
    ].forEach(([offsetX, offsetY], index) => {
      this.add.circle(x + offsetX, y + offsetY, 34, 0x7b1c1f, 0.94)
        .setStrokeStyle(3, index % 2 === 0 ? 0xffc64a : 0xff6f3c, 0.82);
      this.add.text(x + offsetX, y + offsetY, '?', {
        ...textStyle(33, '#fff3c5'),
        stroke: '#431014',
        strokeThickness: 5,
      }).setOrigin(0.5);
    });
  }

  createCharacterSelector({
    x,
    y,
    label,
    character,
    onPrevious,
    onNext,
  }) {
    this.add.text(x, y - 96, label, textStyle(16, '#ffffff')).setOrigin(0.5);
    this.add.circle(x, y, 64, character.accent, 0.14)
      .setStrokeStyle(4, character.accent, 0.68);
    this.add.image(x, y, character.portraitTexture)
      .setDisplaySize(116, 116)
      .setFlipX(character.nativeFacing !== 1);
    createButton(this, {
      x: x - 82,
      y,
      width: 44,
      height: 64,
      label: '‹',
      color: 0x1a4555,
      activateOnPointerDown: true,
      onPress: onPrevious,
    });
    createButton(this, {
      x: x + 82,
      y,
      width: 44,
      height: 64,
      label: '›',
      color: 0x1a4555,
      activateOnPointerDown: true,
      onPress: onNext,
    });
    this.add.text(x, y + 82, getCharacterLabel(character, this.language), textStyle(17, '#ffffff'))
      .setOrigin(0.5);
  }

  createChoiceButton({
    x,
    y,
    width,
    label,
    active,
    onPress,
  }) {
    createButton(this, {
      x,
      y,
      width,
      height: 48,
      label,
      color: active ? 0xd44a2f : 0x1a3950,
      onPress: () => {
        if (active) return;
        arcadeAudio.click();
        onPress();
      },
    });
  }

  createControlRow(x, y, icon, label, copy) {
    this.add.circle(x, y, 28, 0x5be4f2, 0.08).setStrokeStyle(2, 0x8fefff, 0.28);
    createControlIcon(this, { x, y, size: 34, icon, depth: 2, alpha: 0.9 });
    this.add.text(x + 47, y - 10, label, textStyle(17)).setOrigin(0, 0.5);
    this.add.text(x + 47, y + 14, copy, {
      fontFamily: 'Trebuchet MS, sans-serif',
      fontSize: '13px',
      color: '#b9cde5',
    }).setOrigin(0, 0.5);
  }

  createDifficultyButton(x, y, difficulty, { disabled = false, width = 102 } = {}) {
    const active = this.profile.difficultyByGame[this.gameId] === difficulty;
    createButton(this, {
      x,
      y,
      width,
      height: 46,
      label: t(this.language, `settings.${difficulty}`),
      color: disabled ? 0x26303a : active ? 0xf29d38 : 0x1a395c,
      onPress: () => {
        if (disabled || active) return;
        playerProfileStore.setGameDifficulty(this.gameId, difficulty);
        arcadeAudio.click();
        this.scene.restart({ gameId: this.gameId });
      },
    });
  }

  rotateLineup(side, direction) {
    const isPlayer = side === 'player';
    const currentId = isPlayer ? this.profile.playerCharacterId : this.profile.opponentId;
    const excludedId = isPlayer ? null : this.profile.playerCharacterId;
    const next = cycleCharacter({ id: currentId, direction, excludedId });
    if (isPlayer) playerProfileStore.setPlayerCharacter(next.id);
    else playerProfileStore.setOpponent(next.id);
    arcadeAudio.click();
    this.scene.restart({ gameId: this.gameId });
  }

  setDiscHockeySettings(patch) {
    playerProfileStore.setDiscHockeySettings(patch);
    this.scene.restart({ gameId: 'discHockey' });
  }

  openHelp() {
    if (this.gameId !== 'kickfall' || this.infoOverlay) return;
    arcadeAudio.click();
    this.infoOverlay = createInfoOverlay(this, {
      kind: 'help',
      gameId: 'kickfall',
      language: this.language,
      inputMode: this.isTouchLayout ? 'touch' : 'keyboard',
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

  playKickfall(level) {
    arcadeAudio.unlock();
    arcadeAudio.menuEnter();
    this.scene.start('MiniGameLoading', { gameId: 'kickfall', level });
  }

  playDiscHockey() {
    arcadeAudio.unlock();
    arcadeAudio.menuEnter();
    this.game.registry.get('platformActions')?.lockLandscape?.();
    const currentProfile = playerProfileStore.get();
    this.scene.start('MiniGameLoading', {
      gameId: 'discHockey',
      sceneData: { ...currentProfile.discHockey },
    });
  }

  back() {
    arcadeAudio.click();
    this.scene.start('MiniGames');
  }

  handlePlatformBack() {
    if (this.closeHelp()) return true;
    this.back();
    return true;
  }

  serializeState() {
    const profile = playerProfileStore.get();
    if (this.gameId === 'discHockey') {
      return {
        mode: 'minigame-setup',
        gameId: this.gameId,
        language: this.language,
        playMode: profile.discHockey.mode,
        themeId: profile.discHockey.themeId,
        difficulty: profile.discHockey.mode === 'crazy'
          ? 'hard'
          : profile.difficultyByGame.discHockey,
        playerCharacterId: profile.playerCharacterId,
        opponentId: profile.opponentId,
        headerLineup: {
          left: getCharacterLabel(getCharacter(profile.playerCharacterId), this.language),
          right: profile.discHockey.mode === 'crazy'
            ? t(this.language, 'discHockey.crazySquad')
            : getCharacterLabel(getCharacter(profile.opponentId), this.language),
        },
        coordinateSystem: `origin top-left; +x right; +y down; logical canvas ${this.stageLayout.width}x${this.stageLayout.height}`,
        actions: [
          'choose both players',
          'choose computer, two players, or Crazy Mode',
          'choose Ice or Neon arena',
          'set difficulty',
          'play Disc Hockey',
          'back',
        ],
      };
    }
    return {
      mode: 'minigame-setup',
      gameId: this.gameId,
      language: this.language,
      difficulty: profile.difficultyByGame.kickfall,
      mission: {
        title: t(this.language, 'kickfallSetup.objectiveTitle'),
        description: t(this.language, 'kickfallSetup.objective'),
      },
      difficultyDescription: t(
        this.language,
        `kickfallSetup.difficulty.${profile.difficultyByGame.kickfall}`,
      ),
      progress: profile.kickfall,
      modal: this.infoOverlay?.kind ?? null,
      coordinateSystem: `origin top-left; +x right; +y down; logical canvas ${this.stageLayout.width}x${this.stageLayout.height}`,
      actions: [
        'set difficulty Easy',
        'set difficulty Normal',
        'set difficulty Hard',
        'open instructions',
        'continue Kickfall',
        'start Kickfall from level 1',
        'back',
      ],
    };
  }

  advanceForTesting() {}
}
