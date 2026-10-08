import { GAME_WIDTH } from '../constants.js';
import { t } from '../i18n.js';
import { createControlIcon } from './createControlIcon.js';
import { createHelpColumnLayout } from './helpLayout.js';
import { bindButtonInput } from './buttonInput.js';
import { getCharacter } from '../content/characters.js';
import {
  FOOTBALL_TOUCH_MOVEMENT_MODES,
  getFootballTouchMovementMode,
} from '../developerOptions.js';

const HELP_PANEL_WIDTH = 890;

export const ABOUT_LINKS = Object.freeze({
  youtube: 'https://www.youtube.com/@luisnomad',
  // Shared NJP games pages (the old /joel-football/legal and /support 301 here).
  privacy: 'https://notjustprompts.ai/games/legal/',
  support: 'https://notjustprompts.ai/games/support/?game=joel-football',
});

const textStyle = (size, color = '#ffffff', extra = {}) => ({
  fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
  fontSize: `${size}px`,
  color,
  align: 'center',
  ...extra,
});

const createCloseControl = (scene, x, y, depth, onClose) => {
  const ring = scene.add.circle(x, y, 25, 0xffffff, 0.08).setStrokeStyle(2, 0xffffff, 0.38).setDepth(depth);
  const cross = scene.add.graphics({ x, y }).setDepth(depth + 0.1);
  cross.lineStyle(4, 0xffffff, 0.92).lineBetween(-8, -8, 8, 8).lineBetween(8, -8, -8, 8);
  const zone = scene.add.circle(x, y, 30, 0xffffff, 0).setDepth(depth + 0.2).setInteractive({ useHandCursor: true });
  bindButtonInput(scene, zone, { onActivate: onClose });
  return [ring, cross, zone];
};

const createAboutLinkButton = (scene, {
  x,
  y,
  width,
  label,
  color,
  hoverColor,
  strokeColor,
  depth,
  onActivate,
}) => {
  const button = scene.add.rectangle(x, y, width, 50, color, 0.98)
    .setStrokeStyle(2, strokeColor, 0.76)
    .setDepth(depth)
    .setInteractive({ useHandCursor: true });
  const buttonLabel = scene.add.text(x, y, label, textStyle(15, '#ffffff', {
    fontStyle: 'bold',
  })).setOrigin(0.5).setDepth(depth + 0.1);
  bindButtonInput(scene, button, {
    onOver: () => button.setFillStyle(hoverColor, 1),
    onOut: () => button.setFillStyle(color, 0.98),
    onPress: () => button.setScale(0.98),
    onRelease: () => button.setScale(1),
    onActivate,
  });
  return [button, buttonLabel];
};

const createAboutContent = (scene, language, appInfo, depth, onOpenExternal) => {
  const buildLabel = appInfo?.build && appInfo.build !== 'web' ? ` (${appInfo.build})` : '';
  const creatorCharacter = getCharacter('dad');
  const creatorPortrait = scene.add.image(415, 398, creatorCharacter.portraitTexture)
    .setDisplaySize(235, 235)
    .setFlipX(creatorCharacter.nativeFacing !== 1)
    .setDepth(depth);
  const website = scene.add.text(720, 344, 'NotJustPrompts.ai', textStyle(20, '#7ce8ff', {
    fontStyle: 'bold',
  })).setOrigin(0.5).setDepth(depth + 0.1);
  const youtubeButton = createAboutLinkButton(scene, {
    x: 720,
    y: 505,
    width: 430,
    label: t(language, 'about.youtube'),
    color: 0xa91220,
    hoverColor: 0xd21a2a,
    strokeColor: 0xff6b73,
    depth,
    onActivate: () => onOpenExternal?.(ABOUT_LINKS.youtube),
  });
  const privacyButton = createAboutLinkButton(scene, {
    x: 614,
    y: 565,
    width: 190,
    label: t(language, 'about.privacy'),
    color: 0x12495c,
    hoverColor: 0x1c667c,
    strokeColor: 0x7ce8ff,
    depth,
    onActivate: () => onOpenExternal?.(ABOUT_LINKS.privacy),
  });
  const supportButton = createAboutLinkButton(scene, {
    x: 824,
    y: 565,
    width: 210,
    label: t(language, 'about.reportProblem'),
    color: 0x65420e,
    hoverColor: 0x815719,
    strokeColor: 0xffdc72,
    depth,
    onActivate: () => onOpenExternal?.(ABOUT_LINKS.support),
  });

  return [
    scene.add.text(640, 207, 'JOEL FOOTBALL', textStyle(43, '#ffffff', {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      stroke: '#10213e',
      strokeThickness: 8,
    })).setOrigin(0.5).setDepth(depth),
    creatorPortrait,
    scene.add.text(720, 274, t(language, 'about.credit'), textStyle(15, '#a9bdd8')).setOrigin(0.5).setDepth(depth),
    scene.add.text(720, 306, t(language, 'about.creatorCharacter'), textStyle(23, '#ffffff', {
      fontStyle: 'bold',
    })).setOrigin(0.5).setDepth(depth),
    website,
    scene.add.text(720, 389, t(language, 'about.dedication'), textStyle(18, '#ffdc72', {
      fontStyle: 'bold',
    })).setOrigin(0.5).setDepth(depth),
    scene.add.text(720, 455, t(language, 'about.support'), textStyle(15, '#d7e8f8', {
      lineSpacing: 5,
      wordWrap: { width: 430, useAdvancedWrap: true },
    })).setOrigin(0.5).setDepth(depth),
    ...youtubeButton,
    ...privacyButton,
    ...supportButton,
    scene.add.text(720, 614, `${t(language, 'about.version')} ${appInfo?.version ?? '1.6.0'}${buildLabel}`, textStyle(16, '#a9bdd8')).setOrigin(0.5).setDepth(depth),
  ];
};

const createInstallContent = (scene, language, depth, onClose) => {
  const share = scene.add.text(640, 322, '□↑', textStyle(64, '#7ce8ff', { fontStyle: 'bold' }))
    .setOrigin(0.5).setDepth(depth);
  const body = scene.add.text(640, 408, t(language, 'install.iosBody'), textStyle(22, '#ffffff', {
    wordWrap: { width: 590 },
    lineSpacing: 7,
  })).setOrigin(0.5).setDepth(depth);
  const hint = scene.add.text(640, 477, t(language, 'install.iosHint'), textStyle(15, '#a9bdd8', {
    wordWrap: { width: 590 },
  })).setOrigin(0.5).setDepth(depth);
  const button = scene.add.rectangle(640, 552, 230, 54, 0x1596a8, 1)
    .setStrokeStyle(2, 0x8fefff, 0.55).setDepth(depth).setInteractive({ useHandCursor: true });
  const label = scene.add.text(640, 552, t(language, 'install.close'), textStyle(18, '#ffffff', { fontStyle: 'bold' }))
    .setOrigin(0.5).setDepth(depth + 0.1);
  bindButtonInput(scene, button, { onActivate: onClose });
  return [share, body, hint, button, label];
};

const createHelpRow = (scene, {
  x,
  textX,
  textWidth,
  y,
  icon,
  label,
  description,
  depth,
}) => {
  const badge = scene.add.circle(x, y, 29, 0x5be4f2, 0.08).setStrokeStyle(2, 0x8fefff, 0.28).setDepth(depth);
  const symbol = createControlIcon(scene, {
    x,
    y,
    size: 34,
    icon,
    depth: depth + 0.1,
    alpha: 0.9,
  });
  const title = scene.add.text(textX, y - 12, label, textStyle(17, '#ffffff', {
    fontStyle: 'bold',
    align: 'left',
    wordWrap: { width: textWidth, useAdvancedWrap: true },
  })).setOrigin(0, 0.5).setDepth(depth);
  const copy = scene.add.text(textX, y + 3, description, textStyle(13, '#b9cde5', {
    align: 'left',
    lineSpacing: 2,
    wordWrap: { width: textWidth, useAdvancedWrap: true },
  })).setOrigin(0, 0).setDepth(depth);
  return [badge, symbol, title, copy];
};

const createHelpContent = (scene, language, inputMode, depth, helpLayout, footballTouchMovementMode) => {
  const touch = inputMode === 'touch';
  const joystickTouch = touch
    && footballTouchMovementMode === FOOTBALL_TOUCH_MOVEMENT_MODES.JOYSTICK;
  const actions = [
    ['move', 'right'], ['jump', 'jump'], ['kick', 'kick'],
    ['lob', 'lob'], ['power', 'power'],
  ];
  const objects = [];
  actions.forEach(([action, icon], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const columnLayout = helpLayout.columns[column];
    objects.push(...createHelpRow(scene, {
      x: columnLayout.badgeX,
      textX: columnLayout.textX,
      textWidth: columnLayout.textWidth,
      y: 232 + row * 78,
      icon,
      label: t(language, `help.${action}`),
      description: t(language, `help.${touch ? joystickTouch ? 'touchJoystick' : 'touch' : 'keyboard'}.${action}`),
      depth,
    }));
  });
  objects.push(
    scene.add.rectangle(640, 493, 690, 1, 0x8fefff, 0.22).setDepth(depth),
    scene.add.text(640, 528, t(language, 'help.specialTitle'), textStyle(17, '#ffdc72', { fontStyle: 'bold' })).setOrigin(0.5).setDepth(depth),
    scene.add.text(640, 577, t(language, joystickTouch ? 'help.specialCopyJoystick' : 'help.specialCopy'), textStyle(15, '#d7e8f8', {
      lineSpacing: 7,
      wordWrap: { width: 690 },
    })).setOrigin(0.5).setDepth(depth),
  );
  return objects;
};

const createKickfallHelpContent = (scene, language, inputMode, depth, helpLayout) => {
  const touch = inputMode === 'touch';
  const actions = [
    {
      icon: 'right',
      label: t(language, 'kickfallSetup.move'),
      description: touch
        ? t(language, 'kickfallSetup.moveCopy')
        : language === 'es' ? 'A/D o flechas izquierda/derecha' : 'A/D or Left/Right arrows',
    },
    {
      icon: 'up',
      label: language === 'es' ? 'CAMBIAR DE CARRIL' : 'CHANGE LANE',
      description: language === 'es'
        ? 'Toca arriba o abajo una vez'
        : 'Tap Up or Down once',
    },
    {
      icon: 'jump',
      label: t(language, 'kickfallSetup.jump'),
      description: touch
        ? t(language, 'kickfallSetup.jumpCopy')
        : language === 'es' ? 'Espacio para saltar' : 'Press Space to jump',
    },
    {
      icon: 'kick',
      label: t(language, 'kickfallSetup.kick'),
      description: touch
        ? t(language, 'kickfallSetup.kickCopy')
        : language === 'es' ? 'X o K para chutar' : 'Press X or K to kick',
    },
  ];
  const objects = [];
  actions.forEach((action, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const columnLayout = helpLayout.columns[column];
    objects.push(...createHelpRow(scene, {
      x: columnLayout.badgeX,
      textX: columnLayout.textX,
      textWidth: columnLayout.textWidth,
      y: 250 + row * 92,
      ...action,
      depth,
    }));
  });
  objects.push(
    scene.add.rectangle(640, 472, 690, 1, 0x8fefff, 0.22).setDepth(depth),
    scene.add.text(640, 510, t(language, 'kickfallSetup.objectiveTitle'), textStyle(18, '#ffdc72', {
      fontStyle: 'bold',
    })).setOrigin(0.5).setDepth(depth),
    scene.add.text(640, 558, t(language, 'kickfallSetup.objective'), textStyle(15, '#d7e8f8', {
      lineSpacing: 6,
      wordWrap: { width: 690 },
    })).setOrigin(0.5).setDepth(depth),
  );
  return objects;
};

export const createInfoOverlay = (scene, {
  kind,
  gameId = 'football',
  language,
  inputMode,
  appInfo,
  onClose,
  onOpenExternal,
}) => {
  const depth = 300;
  const height = scene.stageLayout?.height ?? 720;
  const helpLayout = kind === 'help'
    ? createHelpColumnLayout({ panelWidth: HELP_PANEL_WIDTH })
    : null;
  const footballTouchMovementMode = getFootballTouchMovementMode(scene);
  const shade = scene.add.rectangle(0, 0, GAME_WIDTH, height, 0x030712, 0.78).setOrigin(0).setDepth(depth).setInteractive();
  const panelHeight = kind === 'help' ? 590 : kind === 'install' ? 500 : 540;
  const panelY = Math.min(height / 2, 380);
  const panel = scene.add.rectangle(640, panelY, kind === 'help' ? HELP_PANEL_WIDTH : 720, panelHeight, 0x0d1b34, 0.985)
    .setStrokeStyle(3, kind === 'help' ? 0x8fefff : 0xffdc72, 0.46)
    .setDepth(depth + 0.1);
  const titleKey = kind === 'help' && gameId === 'kickfall' ? 'kickfallSetup.helpTitle' : `${kind}.title`;
  const title = scene.add.text(640, panelY - panelHeight / 2 + 54, t(language, titleKey), textStyle(34, '#ffffff', { fontStyle: 'bold' }))
    .setOrigin(0.5).setDepth(depth + 0.2);
  const closeObjects = createCloseControl(scene, 640 + (kind === 'help' ? 405 : 320), panelY - panelHeight / 2 + 42, depth + 0.3, onClose);
  const content = kind === 'help'
    ? gameId === 'kickfall'
      ? createKickfallHelpContent(scene, language, inputMode, depth + 0.2, helpLayout)
      : createHelpContent(
        scene,
        language,
        inputMode,
        depth + 0.2,
        helpLayout,
        footballTouchMovementMode,
      )
    : kind === 'install'
      ? createInstallContent(scene, language, depth + 0.2, onClose)
      : createAboutContent(scene, language, appInfo, depth + 0.2, onOpenExternal);
  const creatorCharacter = kind === 'about' ? getCharacter('dad') : null;
  const objects = [shade, panel, title, ...closeObjects, ...content];
  return {
    kind,
    appInfo: appInfo ?? null,
    externalLinks: kind === 'about' ? { ...ABOUT_LINKS } : null,
    about: kind === 'about' ? {
      creator: t(language, 'about.creatorCharacter'),
      support: t(language, 'about.support'),
      youtube: t(language, 'about.youtube'),
      privacy: t(language, 'about.privacy'),
      reportProblem: t(language, 'about.reportProblem'),
    } : null,
    creatorCharacter: creatorCharacter
      ? { id: creatorCharacter.id }
      : null,
    layout: helpLayout,
    destroy: () => objects.forEach((object) => object.destroy()),
  };
};
