import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import {
  CHARACTERS,
  cycleCharacter,
  getCharacter,
  getCharacterLabel,
  getCharacterName,
} from '../content/characters.js';
import {
  ARENA_THEMES,
  BALL_TYPES,
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
import { createButton } from '../ui/createButton.js';
import { createControlIcon } from '../ui/createControlIcon.js';
import { createIconButton } from '../ui/createIconButton.js';
import { createInfoOverlay } from '../ui/createInfoOverlay.js';

const assetUrl = (filename) => `${import.meta.env.BASE_URL}assets/${filename}`;

const textStyle = (size, color = '#ffffff', extra = {}) => ({
  fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
  fontSize: `${size}px`,
  fontStyle: 'bold',
  color,
  align: 'center',
  ...extra,
});

export class CustomizeScene extends Phaser.Scene {
  constructor() {
    super('Customize');
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

    this.arenaStage = createArenaStage(this, { themeId: this.arenaTheme.id });
    this.stageLayout = this.arenaStage.layout;
    this.add.rectangle(0, 0, this.stageLayout.width, this.stageLayout.height, 0x050a17, 0.68).setOrigin(0);

    createButton(this, {
      x: 82,
      y: 52,
      width: 130,
      height: 46,
      label: `‹  ${t(this.language, 'customize.back')}`,
      color: 0x173858,
      onPress: () => this.back(),
    });
    this.helpButton = createIconButton(this, {
      x: 1218,
      y: 52,
      radius: 28,
      icon: 'help',
      accent: 0x52d7e8,
      onPress: () => this.openHelp(),
    });
    this.add.text(GAME_WIDTH / 2, 51, t(this.language, 'hub.football'), {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: '49px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#10213e',
      strokeThickness: 9,
      shadow: { color: '#19c5dd', blur: 10, fill: true, offsetY: 4 },
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 91, t(this.language, 'customize.subtitle'), textStyle(16, '#bfefff')).setOrigin(0.5);

    this.createCharacterPanel(230, t(this.language, 'customize.player'), true);
    this.createCharacterPanel(640, t(this.language, 'customize.opponent'), false);
    this.createDifficultyPanel(1050);
    this.createArenaPanel(330);
    this.createBallPanel(930);

    createButton(this, {
      x: 430,
      y: 660 + this.stageLayout.bottomOffset,
      width: 260,
      height: 56,
      label: t(this.language, 'customize.powerLab'),
      color: 0x1596a8,
      onPress: () => this.openPowerLab(),
    });
    createButton(this, {
      x: 785,
      y: 660 + this.stageLayout.bottomOffset,
      width: 390,
      height: 62,
      label: t(this.language, 'customize.play'),
      color: 0x705cff,
      onPress: () => this.startMatch(),
    });

    this.onEscapeKey = (event) => {
      if (event.key !== 'Escape' || event.repeat) return;
      event.preventDefault();
      if (!this.closeHelp()) this.back();
    };
    window.addEventListener('keydown', this.onEscapeKey);
  }

  createCharacterPanel(x, heading, isPlayer) {
    const character = isPlayer ? this.playerCharacter : this.opponent;
    this.add.rectangle(x, 205, 360, 194, 0x09172e, 0.95)
      .setStrokeStyle(3, character.accent, 0.5);
    this.add.text(x, 126, heading, textStyle(16, '#8fefff')).setOrigin(0.5);
    const portrait = this.add.image(x, 202, character.portraitTexture)
      .setDisplaySize(126, 126)
      .setFlipX(character.nativeFacing !== (isPlayer ? 1 : -1));
    const name = this.add.text(x, 280, getCharacterLabel(character, this.language), textStyle(
      20,
      Phaser.Display.Color.IntegerToColor(character.accent).rgba,
      { stroke: '#071426', strokeThickness: 5 },
    )).setOrigin(0.5);
    createButton(this, {
      x: x - 145,
      y: 205,
      width: 48,
      height: 68,
      label: '‹',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      onPress: () => isPlayer ? this.rotatePlayer(-1) : this.rotateOpponent(-1),
    });
    createButton(this, {
      x: x + 145,
      y: 205,
      width: 48,
      height: 68,
      label: '›',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      onPress: () => isPlayer ? this.rotatePlayer(1) : this.rotateOpponent(1),
    });
    if (isPlayer) {
      this.playerPortrait = portrait;
      this.playerNameText = name;
    } else {
      this.opponentPortrait = portrait;
      this.opponentNameText = name;
    }
  }

  createDifficultyPanel(x) {
    this.add.rectangle(x, 205, 350, 194, 0x09172e, 0.95)
      .setStrokeStyle(3, 0xffc65a, 0.48);
    this.add.text(x, 126, t(this.language, 'customize.difficulty'), textStyle(16, '#ffdc72')).setOrigin(0.5);
    createControlIcon(this, {
      x,
      y: 170,
      size: 38,
      icon: 'power',
      depth: 2,
      color: 0xffdc72,
      alpha: 0.9,
    });
    this.createDifficultyButton(x - 108, 'easy');
    this.createDifficultyButton(x, 'normal');
    this.createDifficultyButton(x + 108, 'hard');
    this.difficultyHelp = this.add.text(
      x,
      276,
      t(this.language, `customize.difficultyHelp.${this.profile.difficultyByGame.football}`),
      {
        ...textStyle(12, '#b9cde5'),
        wordWrap: { width: 310 },
      },
    ).setOrigin(0.5);
  }

  createDifficultyButton(x, difficulty) {
    const active = this.profile.difficultyByGame.football === difficulty;
    createButton(this, {
      x,
      y: 224,
      width: 96,
      height: 42,
      label: t(this.language, `settings.${difficulty}`),
      color: active ? 0xf29d38 : 0x1a395c,
      onPress: () => {
        if (this.profile.difficultyByGame.football === difficulty) return;
        playerProfileStore.setGameDifficulty('football', difficulty);
        arcadeAudio.click();
        this.scene.restart();
      },
    });
  }

  createArenaPanel(x) {
    this.add.rectangle(x, 454, 570, 276, 0x09172e, 0.95)
      .setStrokeStyle(3, this.arenaTheme.accent, 0.5);
    this.add.text(x, 334, t(this.language, 'customize.field'), textStyle(17, '#8fefff')).setOrigin(0.5);
    this.arenaPreview = this.add.image(x, 428, this.arenaTheme.texture).setDisplaySize(450, 154);
    this.arenaPreviewBorder = this.add.rectangle(x, 428, 454, 158, 0x000000, 0)
      .setStrokeStyle(3, this.arenaTheme.accent, 0.9);
    createButton(this, {
      x: x - 250,
      y: 430,
      width: 52,
      height: 70,
      label: '‹',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      onPress: () => this.rotateArena(-1),
    });
    createButton(this, {
      x: x + 250,
      y: 430,
      width: 52,
      height: 70,
      label: '›',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      onPress: () => this.rotateArena(1),
    });
    this.arenaNameText = this.add.text(
      x,
      548,
      t(this.language, this.arenaTheme.nameKey),
      textStyle(24, '#ffdc72'),
    ).setOrigin(0.5);
  }

  createBallPanel(x) {
    this.add.rectangle(x, 454, 530, 276, 0x09172e, 0.95)
      .setStrokeStyle(3, this.ballType.accent ?? 0x7ce8ff, 0.5);
    this.add.text(x, 334, t(this.language, 'customize.object'), textStyle(17, '#8fefff')).setOrigin(0.5);
    this.add.circle(x, 430, 82, 0x7ce8ff, 0.04).setStrokeStyle(2, 0x7ce8ff, 0.16);
    this.previewObject = this.add.image(x, 430, this.ballType.texture)
      .setDisplaySize(this.ballType.displayWidth * 1.75, this.ballType.displayHeight * 1.75)
      .setDepth(5);
    this.animateBallPreview(this.ballType);
    createButton(this, {
      x: x - 225,
      y: 430,
      width: 52,
      height: 70,
      label: '‹',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      onPress: () => this.rotateBall(-1),
    });
    createButton(this, {
      x: x + 225,
      y: 430,
      width: 52,
      height: 70,
      label: '›',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      onPress: () => this.rotateBall(1),
    });
    this.ballNameText = this.add.text(
      x,
      530,
      t(this.language, this.ballType.nameKey),
      textStyle(24, '#ffdc72'),
    ).setOrigin(0.5);
    this.ballFeelText = this.add.text(
      x,
      570,
      t(this.language, `customize.feel.${this.ballType.family}`),
      { ...textStyle(12, '#8fefff'), wordWrap: { width: 440 } },
    ).setOrigin(0.5);
  }

  animateBallPreview(ballType) {
    this.previewTween?.stop();
    this.previewObject.setY(430).setAngle(0);
    this.previewTween = this.tweens.add({
      targets: this.previewObject,
      y: 405,
      angle: ballType.family === 'can' ? 16 : 180,
      duration: ballType.family === 'cannonball' ? 1200 : 850,
      yoyo: true,
      repeat: -1,
      ease: ballType.family === 'balloon' ? 'Sine.InOut' : 'Quad.Out',
    });
  }

  rotatePlayer(direction) {
    this.playerCharacter = cycleCharacter({
      id: this.playerCharacter.id,
      direction,
      excludedId: this.opponent.id,
    });
    this.profile = playerProfileStore.setPlayerCharacter(this.playerCharacter.id);
    this.playerPortrait
      .setTexture(this.playerCharacter.portraitTexture)
      .setDisplaySize(126, 126)
      .setFlipX(this.playerCharacter.nativeFacing !== 1);
    this.playerNameText
      .setText(getCharacterLabel(this.playerCharacter, this.language))
      .setColor(Phaser.Display.Color.IntegerToColor(this.playerCharacter.accent).rgba);
    arcadeAudio.click();
  }

  rotateOpponent(direction) {
    this.opponent = cycleCharacter({
      id: this.opponent.id,
      direction,
      excludedId: this.playerCharacter.id,
    });
    this.profile = playerProfileStore.setOpponent(this.opponent.id);
    this.opponentPortrait
      .setTexture(this.opponent.portraitTexture)
      .setDisplaySize(126, 126)
      .setFlipX(this.opponent.nativeFacing !== -1);
    this.opponentNameText
      .setText(getCharacterLabel(this.opponent, this.language))
      .setColor(Phaser.Display.Color.IntegerToColor(this.opponent.accent).rgba);
    arcadeAudio.click();
  }

  rotateArena(direction) {
    const next = cycleArenaTheme(this.arenaTheme.id, direction);
    this.profile = playerProfileStore.setArenaTheme(next.id);
    this.arenaTheme = next;
    this.arenaStage.arena.setTexture(next.texture);
    this.arenaPreview.setTexture(next.texture);
    this.arenaPreviewBorder.setStrokeStyle(3, next.accent, 0.9);
    this.arenaNameText.setText(t(this.language, next.nameKey));
    arcadeAudio.click();
  }

  rotateBall(direction) {
    const next = cycleBallType(this.ballType.id, direction);
    this.profile = playerProfileStore.setBallType(next.id);
    this.ballType = next;
    this.previewObject
      .setTexture(next.texture)
      .setDisplaySize(next.displayWidth * 1.75, next.displayHeight * 1.75);
    this.animateBallPreview(next);
    this.ballNameText.setText(t(this.language, next.nameKey));
    this.ballFeelText.setText(t(this.language, `customize.feel.${next.family}`));
    arcadeAudio.click();
  }

  openHelp() {
    if (this.infoOverlay) return;
    arcadeAudio.click();
    this.infoOverlay = createInfoOverlay(this, {
      kind: 'help',
      gameId: 'football',
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

  openPowerLab() {
    arcadeAudio.click();
    this.scene.start('PowerLab', { returnScene: 'Customize' });
  }

  startMatch() {
    arcadeAudio.unlock();
    arcadeAudio.click();
    this.scene.start('MatchLoading');
  }

  back() {
    arcadeAudio.click();
    this.scene.start('Intro');
  }

  handlePlatformBack() {
    if (this.closeHelp()) return true;
    this.back();
    return true;
  }

  serializeState() {
    return {
      mode: 'football-setup',
      language: this.language,
      difficulty: this.profile.difficultyByGame.football,
      modal: this.infoOverlay?.kind ?? null,
      coordinateSystem: `origin top-left; +x right; +y down; logical canvas ${this.stageLayout.width}x${this.stageLayout.height}`,
      playerCharacter: {
        id: this.playerCharacter.id,
        name: getCharacterName(this.playerCharacter, this.language),
        available: CHARACTERS.map((character) => ({ id: character.id, name: getCharacterName(character, this.language) })),
      },
      opponent: {
        id: this.opponent.id,
        name: getCharacterName(this.opponent, this.language),
        available: CHARACTERS.map((character) => ({ id: character.id, name: getCharacterName(character, this.language) })),
      },
      arena: {
        id: this.arenaTheme.id,
        name: t(this.language, this.arenaTheme.nameKey),
        available: ARENA_THEMES.map((item) => ({ id: item.id, name: t(this.language, item.nameKey) })),
      },
      ballType: {
        id: this.ballType.id,
        name: t(this.language, this.ballType.nameKey),
        family: this.ballType.family,
        shape: this.ballType.shape,
        restitution: this.ballType.restitution,
        frictionAir: this.ballType.frictionAir,
        density: this.ballType.density,
        speedScale: this.ballType.speedScale,
        liftScale: this.ballType.liftScale,
        available: BALL_TYPES.map((item) => ({ id: item.id, name: t(this.language, item.nameKey) })),
      },
      actions: [
        'previous player',
        'next player',
        'previous opponent',
        'next opponent',
        'previous field',
        'next field',
        'previous object',
        'next object',
        'set difficulty Easy',
        'set difficulty Normal',
        'set difficulty Hard',
        'open instructions',
        'open power lab',
        'play match',
        'back',
      ],
    };
  }

  advanceForTesting() {
    this.tweens.update(16, 16);
  }
}
