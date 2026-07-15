import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { clearActiveScene, setActiveScene } from '../stateBridge.js';
import { createButton } from '../ui/createButton.js';
import { isTouchLayout } from '../input/isTouchLayout.js';
import { t } from '../i18n.js';
import { playerProfileStore } from '../services/PlayerProfile.js';
import { createArenaStage } from '../ui/createArenaStage.js';
import { createIconButton } from '../ui/createIconButton.js';
import { createInfoOverlay } from '../ui/createInfoOverlay.js';
import { createWebAppInfo } from '../../appMetadata.js';
import {
  CHARACTERS,
  cycleCharacter,
  getCharacter,
  getCharacterLabel,
  getCharacterName,
} from '../content/characters.js';
import { getWideStageUiScale } from '../layout/tabletStage.js';

export class IntroScene extends Phaser.Scene {
  constructor() {
    super('Intro');
  }

  create() {
    this.isTouchLayout = isTouchLayout();
    this.profile = playerProfileStore.get();
    this.language = this.profile.language;
    this.infoOverlay = null;
    arcadeAudio.setScene('menu');
    setActiveScene(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      clearActiveScene(this);
      window.removeEventListener('keydown', this.onEscapeKey);
    });

    this.stageLayout = createArenaStage(this).layout;
    const horizontalOffset = Math.max(0, this.stageLayout.width - GAME_WIDTH) / 2;
    const wideUiScale = getWideStageUiScale(this.stageLayout);
    this.wideUiScale = wideUiScale;
    const selectorDebounceMs = this.isTouchLayout ? 500 : 50;
    const wash = this.add.graphics();
    wash.fillGradientStyle(0x081229, 0x081229, 0x07101f, 0x07101f, 0.2, 0.2, 0.88, 0.88);
    wash.fillRect(-horizontalOffset, 0, this.stageLayout.width, this.stageLayout.height);

    this.playerCharacter = getCharacter(this.profile.playerCharacterId);
    this.playerPortrait = this.add.image(245, 492, this.playerCharacter.portraitTexture).setDisplaySize(255 * wideUiScale, 255 * wideUiScale).setAngle(-4)
      .setFlipX(this.playerCharacter.nativeFacing !== 1);
    this.opponent = getCharacter(this.profile.opponentId, 'bob');
    this.opponentPortrait = this.add.image(1035, 492, this.opponent.portraitTexture).setDisplaySize(255 * wideUiScale, 255 * wideUiScale).setAngle(4)
      .setFlipX(this.opponent.nativeFacing !== -1);
    this.playerNameText = this.add.text(245, 620, getCharacterLabel(this.playerCharacter, this.language), {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: `${24 * wideUiScale}px`,
      fontStyle: 'bold',
      color: Phaser.Display.Color.IntegerToColor(this.playerCharacter.accent).rgba,
      stroke: '#071426',
      strokeThickness: 6,
    }).setOrigin(0.5);
    createButton(this, {
      x: 85,
      y: 500,
      width: 54,
      height: 64,
      label: '‹',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      pointerDownDebounceMs: selectorDebounceMs,
      onPress: () => this.rotatePlayer(-1),
    });
    createButton(this, {
      x: 405,
      y: 500,
      width: 54,
      height: 64,
      label: '›',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      pointerDownDebounceMs: selectorDebounceMs,
      onPress: () => this.rotatePlayer(1),
    });
    this.opponentNameText = this.add.text(1035, 620, getCharacterLabel(this.opponent, this.language), {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: `${24 * wideUiScale}px`,
      fontStyle: 'bold',
      color: Phaser.Display.Color.IntegerToColor(this.opponent.accent).rgba,
      stroke: '#071426',
      strokeThickness: 6,
    }).setOrigin(0.5);
    createButton(this, {
      x: 875,
      y: 500,
      width: 54,
      height: 64,
      label: '‹',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      pointerDownDebounceMs: selectorDebounceMs,
      onPress: () => this.rotateOpponent(-1),
    });
    createButton(this, {
      x: 1195,
      y: 500,
      width: 54,
      height: 64,
      label: '›',
      color: 0x1a6c79,
      activateOnPointerDown: true,
      pointerDownDebounceMs: selectorDebounceMs,
      onPress: () => this.rotateOpponent(1),
    });
    createButton(this, {
      x: 640,
      y: 300,
      width: 270,
      height: 50,
      label: t(this.language, 'intro.customize'),
      color: 0xb34788,
      onPress: () => this.startCustomize(),
    });

    this.add.text(GAME_WIDTH / 2, 86, 'JOEL', {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: '92px',
      fontStyle: 'bold',
      color: '#f7fcff',
      stroke: '#12213b',
      strokeThickness: 14,
      shadow: { color: '#19c5dd', blur: 18, fill: true, offsetY: 7 },
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 165, 'FOOTBALL', {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#ffcf4a',
      stroke: '#6c2b3a',
      strokeThickness: 10,
      letterSpacing: 8,
    }).setOrigin(0.5);

    createButton(this, {
      x: 640,
      y: 370 + this.stageLayout.bottomOffset,
      width: 320,
      height: 62,
      label: t(this.language, 'intro.play'),
      color: 0x705cff,
      onPress: () => this.startMatch(),
    });
    createButton(this, {
      x: 535,
      y: 438 + this.stageLayout.bottomOffset,
      width: 190,
      height: 52,
      label: t(this.language, 'intro.kickfall'),
      color: 0xc3476f,
      onPress: () => this.startKickfall(),
    });
    createButton(this, {
      x: 740,
      y: 438 + this.stageLayout.bottomOffset,
      width: 220,
      height: 52,
      label: t(this.language, 'intro.powerLab'),
      color: 0x1596a8,
      onPress: () => this.startPowerLab(),
    });
    this.installState = this.game.registry.get('platformActions')?.getInstallState?.()
      ?? { available: false, installed: false, method: 'unavailable' };
    const showInstallButton = this.isTouchLayout && this.installState.available;
    createButton(this, {
      x: 640,
      y: 500 + this.stageLayout.bottomOffset,
      width: 220,
      height: 42,
      label: t(this.language, 'intro.settings'),
      color: 0x1a395c,
      onPress: () => this.startSettings(),
    });
    if (showInstallButton) {
      createButton(this, {
        x: 640,
        y: 550 + this.stageLayout.bottomOffset,
        width: 220,
        height: 34,
        label: t(this.language, 'intro.install'),
        color: 0x168e78,
        onPress: () => this.installApp(),
      });
    }

    this.add.text(1072, 34, t(this.language, 'intro.language'), {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#d9ecff',
    }).setOrigin(1, 0.5);
    this.createLanguageButton(1115, 'EN', 'en');
    this.createLanguageButton(1190, 'ES', 'es');

    this.aboutButton = createIconButton(this, {
      x: 44,
      y: 42,
      radius: 28,
      icon: 'info',
      accent: 0xffdc72,
      onPress: () => this.openInfo('about'),
    });
    this.helpButton = createIconButton(this, {
      x: 108,
      y: 42,
      radius: 28,
      icon: 'help',
      accent: 0x52d7e8,
      onPress: () => this.openInfo('help'),
    });

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
    arcadeAudio.click();
    this.scene.start('MatchLoading');
  }

  startPowerLab() {
    arcadeAudio.unlock();
    arcadeAudio.click();
    this.scene.start('PowerLab');
  }

  startKickfall() {
    arcadeAudio.unlock();
    arcadeAudio.click();
    this.scene.start('MiniGameLoading');
  }

  startSettings() {
    arcadeAudio.unlock();
    arcadeAudio.click();
    this.scene.start('Settings');
  }

  startCustomize() {
    arcadeAudio.unlock();
    arcadeAudio.click();
    this.scene.start('Customize');
  }

  rotateOpponent(direction) {
    this.opponent = cycleCharacter({ id: this.opponent.id, direction, excludedId: this.playerCharacter.id });
    this.profile = playerProfileStore.setOpponent(this.opponent.id);
    this.opponentPortrait.setTexture(this.opponent.portraitTexture).setDisplaySize(255 * this.wideUiScale, 255 * this.wideUiScale);
    this.opponentPortrait.setFlipX(this.opponent.nativeFacing !== -1);
    this.opponentNameText.setText(getCharacterLabel(this.opponent, this.language)).setColor(Phaser.Display.Color.IntegerToColor(this.opponent.accent).rgba);
    arcadeAudio.click();
  }

  rotatePlayer(direction) {
    this.playerCharacter = cycleCharacter({ id: this.playerCharacter.id, direction, excludedId: this.opponent.id });
    this.profile = playerProfileStore.setPlayerCharacter(this.playerCharacter.id);
    this.playerPortrait.setTexture(this.playerCharacter.portraitTexture).setDisplaySize(255 * this.wideUiScale, 255 * this.wideUiScale);
    this.playerPortrait.setFlipX(this.playerCharacter.nativeFacing !== 1);
    this.playerNameText.setText(getCharacterLabel(this.playerCharacter, this.language)).setColor(Phaser.Display.Color.IntegerToColor(this.playerCharacter.accent).rgba);
    arcadeAudio.click();
  }

  createLanguageButton(x, label, language) {
    const active = this.language === language;
    createButton(this, {
      x,
      y: 34,
      width: 64,
      height: 36,
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

  serializeState() {
    return {
      mode: 'intro',
      language: this.language,
      languageSource: this.profile.languageSource,
      difficulty: this.profile.difficulty,
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
        facing: 'right',
        mirrored: this.playerPortrait.flipX,
        displaySize: { width: Math.round(this.playerPortrait.displayWidth), height: Math.round(this.playerPortrait.displayHeight) },
      },
      opponent: {
        id: this.opponent.id,
        name: getCharacterName(this.opponent, this.language),
        facing: 'left',
        mirrored: this.opponentPortrait.flipX,
        displaySize: { width: Math.round(this.opponentPortrait.displayWidth), height: Math.round(this.opponentPortrait.displayHeight) },
        available: CHARACTERS.map((character) => ({ id: character.id, name: getCharacterName(character, this.language) })),
      },
      install: this.installState,
      modal: this.infoOverlay?.kind ?? null,
      modalAppInfo: this.infoOverlay?.appInfo ?? null,
      audio: arcadeAudio.diagnostics(),
      actions: ['play match', 'play kickfall', 'customize field and ball', 'previous player', 'next player', 'previous opponent', 'next opponent', 'open power lab', 'open settings', ...(this.installState?.available ? ['install app'] : []), 'open about', 'open help', 'set English', 'set Spanish'],
      controls: this.isTouchLayout ? {
        move: ['on-screen left', 'on-screen right'],
        dash: ['double-tap either direction arrow'],
        jump: ['on-screen up'],
        kick: ['on-screen kick icon'],
        lob: ['on-screen lob icon'],
        kickBoost: ['repeat the kick or lob icon during the kick animation'],
        chilena: ['double kick: direct; double lob: high arc'],
        power: ['on-screen power icon'],
        pause: ['on-screen pause'],
        restart: ['on-screen restart'],
        menu: ['on-screen menu'],
        fullscreen: ['on-screen fullscreen'],
      } : {
        move: ['A/D', 'Left/Right'],
        dash: ['double-tap A/D or Left/Right'],
        jump: ['W', 'Up', 'Space'],
        kick: ['X', 'K'],
        lob: ['Z', 'I', 'Up + Kick'],
        kickBoost: ['repeat kick or lob during the kick animation'],
        chilena: ['double kick: direct; double lob: high arc'],
        power: ['V', 'J'],
        pause: ['P', 'Escape'],
        fullscreen: ['F'],
      },
    };
  }

  advanceForTesting() {
    this.tweens.update(16, 16);
  }
}
