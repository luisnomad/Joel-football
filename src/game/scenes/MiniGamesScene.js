import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import {
  CHARACTERS,
  cycleCharacter,
  getCharacter,
  getCharacterLabel,
  getCharacterName,
} from '../content/characters.js';
import { t } from '../i18n.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createArenaStage } from '../ui/createArenaStage.js';
import { createButton } from '../ui/createButton.js';
import { createJourneyCard } from '../ui/createJourneyCard.js';

export class MiniGamesScene extends Phaser.Scene {
  constructor() {
    super('MiniGames');
  }

  create() {
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    this.playerCharacter = getCharacter(this.profile.playerCharacterId);
    arcadeAudio.setScene('menu');
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => clearActiveScene(this));

    this.stageLayout = createArenaStage(this).layout;
    const horizontalOffset = Math.max(0, this.stageLayout.width - GAME_WIDTH) / 2;
    const wash = this.add.graphics();
    wash.fillGradientStyle(0x09152c, 0x09152c, 0x1c0d35, 0x1c0d35, 0.78, 0.78, 0.96, 0.96);
    wash.fillRect(-horizontalOffset, 0, this.stageLayout.width, this.stageLayout.height);
    const stars = this.add.graphics();
    for (let index = 0; index < 22; index += 1) {
      const x = 35 + ((index * 163) % 1210);
      const y = 34 + ((index * 97) % 630);
      stars.fillStyle(index % 3 === 0 ? 0xffd46b : 0x7ce8ff, 0.18 + (index % 4) * 0.05)
        .fillCircle(x, y, 1.5 + (index % 3));
    }

    createButton(this, {
      x: 82,
      y: 52,
      width: 130,
      height: 46,
      label: `‹  ${t(this.language, 'miniGames.back')}`,
      color: 0x173858,
      onPress: () => this.back(),
    });
    this.add.text(GAME_WIDTH / 2, 65, t(this.language, 'miniGames.title'), {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: '56px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#181135',
      strokeThickness: 10,
      shadow: { color: '#9957ff', blur: 16, fill: true, offsetY: 5 },
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 111, t(this.language, 'miniGames.subtitle'), {
      fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
      fontSize: '17px',
      fontStyle: 'bold',
      color: '#d9e8ff',
    }).setOrigin(0.5);

    this.kickfallCard = createJourneyCard(this, {
      x: 345,
      y: 294 + this.stageLayout.bottomOffset * 0.12,
      width: 540,
      height: 270,
      texture: 'menu-arcade-cosmic',
      title: 'KICKFALL',
      subtitle: t(this.language, 'miniGames.kickfallSubtitle'),
      meta: t(this.language, 'miniGames.kickfallMeta', {
        level: this.profile.kickfall.lastPlayedLevel,
        total: 20,
      }),
      icon: 'kickfall',
      color: 0x6634a7,
      accent: 0xffb84f,
      imageFocusX: 0.72,
      titleSize: 36,
      layout: 'cinematic',
      onPress: () => this.openKickfall(),
    });
    this.discHockeyCard = createJourneyCard(this, {
      x: 935,
      y: 294 + this.stageLayout.bottomOffset * 0.12,
      width: 540,
      height: 270,
      texture: 'menu-disc-hockey',
      title: 'DISC HOCKEY',
      subtitle: t(this.language, 'miniGames.discHockeySubtitle'),
      meta: t(this.language, 'miniGames.discHockeyMeta'),
      icon: 'football',
      color: 0x9a241c,
      accent: 0xffcf4a,
      imageFocusX: 0.68,
      titleSize: 36,
      layout: 'cinematic',
      onPress: () => this.openDiscHockey(),
    });

    this.createPlayerSelector();

    this.add.text(GAME_WIDTH / 2, 681 + this.stageLayout.bottomOffset * 0.76, t(this.language, 'miniGames.moreSoon'), {
      fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#9db3d2',
      stroke: '#071426',
      strokeThickness: 4,
    }).setOrigin(0.5);

    this.input.keyboard.on('keydown-ESC', () => this.back());
  }

  createPlayerSelector() {
    const y = 586 + this.stageLayout.bottomOffset * 0.55;
    this.playerPanel = this.add.rectangle(GAME_WIDTH / 2, y, 820, 118, 0x071426, 0.95)
      .setStrokeStyle(3, this.playerCharacter.accent, 0.62);
    this.add.text(285, y, t(this.language, 'miniGames.playAs'), {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#101b35',
      strokeThickness: 5,
    }).setOrigin(0, 0.5);

    this.playerGlow = this.add.circle(640, y, 50, this.playerCharacter.accent, 0.09)
      .setStrokeStyle(2, this.playerCharacter.accent, 0.28);
    this.playerPortrait = this.add.image(640, y, this.playerCharacter.portraitTexture)
      .setDisplaySize(96, 96)
      .setFlipX(this.playerCharacter.nativeFacing !== 1);
    createButton(this, {
      x: 535,
      y,
      width: 54,
      height: 72,
      label: '‹',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      onPress: () => this.rotatePlayer(-1),
    });
    createButton(this, {
      x: 745,
      y,
      width: 54,
      height: 72,
      label: '›',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      onPress: () => this.rotatePlayer(1),
    });
    this.playerNameText = this.add.text(865, y, getCharacterLabel(this.playerCharacter, this.language), {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: Phaser.Display.Color.IntegerToColor(this.playerCharacter.accent).rgba,
      align: 'center',
      wordWrap: { width: 205 },
      stroke: '#071426',
      strokeThickness: 5,
    }).setOrigin(0.5);
  }

  rotatePlayer(direction) {
    this.playerCharacter = cycleCharacter({
      id: this.playerCharacter.id,
      direction,
    });
    this.profile = playerProfileStore.setPlayerCharacter(this.playerCharacter.id);
    this.playerPortrait
      .setTexture(this.playerCharacter.portraitTexture)
      .setDisplaySize(96, 96)
      .setFlipX(this.playerCharacter.nativeFacing !== 1);
    this.playerNameText
      .setText(getCharacterLabel(this.playerCharacter, this.language))
      .setColor(Phaser.Display.Color.IntegerToColor(this.playerCharacter.accent).rgba);
    this.playerGlow
      .setFillStyle(this.playerCharacter.accent, 0.09)
      .setStrokeStyle(2, this.playerCharacter.accent, 0.28);
    this.playerPanel.setStrokeStyle(3, this.playerCharacter.accent, 0.62);
    arcadeAudio.click();
  }

  openKickfall() {
    arcadeAudio.unlock();
    arcadeAudio.menuEnter();
    this.scene.start('MiniGameSetup', { gameId: 'kickfall' });
  }

  openDiscHockey() {
    arcadeAudio.unlock();
    arcadeAudio.menuEnter();
    this.scene.start('MiniGameSetup', { gameId: 'discHockey' });
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
    return {
      mode: 'mini-games',
      language: this.language,
      coordinateSystem: `origin top-left; +x right; +y down; logical canvas ${this.stageLayout.width}x${this.stageLayout.height}`,
      stageLayout: this.stageLayout,
      playerCharacter: {
        id: this.playerCharacter.id,
        name: getCharacterName(this.playerCharacter, this.language),
        sharedWithFootball: true,
        available: CHARACTERS
          .map((character) => ({ id: character.id, name: getCharacterName(character, this.language) })),
      },
      games: [
        {
          id: 'kickfall',
          title: 'Kickfall',
          highestUnlockedLevel: this.profile.kickfall.highestUnlockedLevel,
          lastPlayedLevel: this.profile.kickfall.lastPlayedLevel,
          difficulty: this.profile.difficultyByGame.kickfall,
        },
        {
          id: 'discHockey',
          title: 'Disc Hockey',
          difficulty: this.profile.difficultyByGame.discHockey,
          ...this.profile.discHockey,
        },
      ],
      actions: ['previous player', 'next player', 'open Kickfall', 'open Disc Hockey', 'back'],
    };
  }

  advanceForTesting() {}
}
