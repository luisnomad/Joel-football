import { GAME_WIDTH } from '../constants.js';
import { getCharacter } from '../content/characters.js';
import { t } from '../i18n.js';
import { getFootballTouchMovementMode, FOOTBALL_TOUCH_MOVEMENT_MODES } from '../developerOptions.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';
import { createControlIcon } from '../ui/createControlIcon.js';
import { bindButtonInput } from '../ui/buttonInput.js';
import {
  compactBodyText,
  compactTextStyle,
  createCompactButton,
  createCompactPanel,
} from './compactUi.js';

export const COMPACT_ABOUT_LINKS = Object.freeze({
  youtube: 'https://www.youtube.com/@luisnomad',
  // Shared ARKD BOX pages (arkdbox.com, the home of the game).
  privacy: 'https://arkdbox.com/legal/',
  support: 'https://arkdbox.com/support/?game=joel-football',
});

const setButtonDepth = (button, depth) => {
  button.objects.forEach((object, index) => (
    object.setDepth(depth + index * 0.1)
  ));
  return button;
};

const destroyObjects = (objects) => objects.splice(0).forEach((object) => object?.destroy?.());

const setPanelDepth = (panel, depth) => {
  const [shadow, outer, middle, highlight] = panel.chrome;
  const objects = [shadow, outer, middle, panel, highlight];
  objects.forEach((object, index) => object.setDepth(depth + index * 0.03));
  return objects;
};

const createClose = (scene, depth, onClose) => {
  const x = 1152;
  const y = 92;
  const ring = scene.add.circle(x, y, 34, 0xffffff, 0.1)
    .setStrokeStyle(3, 0xffffff, 0.52)
    .setDepth(depth);
  const cross = scene.add.text(x, y - 1, '×', compactTextStyle(38, '#ffffff'))
    .setOrigin(0.5)
    .setDepth(depth + 0.1);
  const zone = scene.add.zone(x, y, 76, 76).setDepth(depth + 0.2).setInteractive({ useHandCursor: true });
  bindButtonInput(scene, zone, { onActivate: onClose });
  return [ring, cross, zone];
};

const ACTION_ROW_Y = Object.freeze([235, 375, 515]);

const createActionRow = (scene, objects, depth, { y, icon, label, copy }) => {
  objects.push(
    scene.add.circle(330, y, 42, 0x52d7e8, 0.1).setStrokeStyle(3, 0x8fefff, 0.42).setDepth(depth),
    createControlIcon(scene, { x: 330, y, size: 46, icon, depth: depth + 0.1, alpha: 1 }),
    scene.add.text(395, y - 24, label, compactTextStyle(26, '#ffffff', { align: 'left' }))
      .setOrigin(0, 0.5).setDepth(depth),
    scene.add.text(395, y + 4, copy, compactTextStyle(25, '#c7d8ed', {
      align: 'left',
      lineSpacing: 4,
      wordWrap: { width: 650, useAdvancedWrap: true },
    })).setOrigin(0, 0).setDepth(depth),
  );
};

export const createCompactInfoOverlay = (scene, {
  kind,
  gameId = 'football',
  language,
  appInfo,
  onClose,
  onOpenExternal,
}) => {
  const depth = 300;
  const horizontalOffset = Math.max(0, scene.stageLayout.width - GAME_WIDTH) / 2;
  if (kind === 'install') {
    const panel = createCompactPanel(scene, {
      x: 640,
      y: 360,
      width: 1000,
      height: 570,
      accent: 0x7ce8ff,
    });
    const objects = [
      scene.add.rectangle(-horizontalOffset, 0, scene.stageLayout.width, scene.stageLayout.height, 0x030712, 0.84)
        .setOrigin(0).setDepth(depth).setInteractive(),
      ...setPanelDepth(panel, depth + 0.05),
      scene.add.text(640, 125, t(language, 'install.title'), compactTextStyle(38, '#ffffff'))
        .setOrigin(0.5).setDepth(depth + 0.2),
      scene.add.text(640, 230, '□↑', compactTextStyle(72, '#7ce8ff'))
        .setOrigin(0.5).setDepth(depth + 0.2),
      compactBodyText(scene, 640, 370, t(language, 'install.iosBody'), {
        width: 820,
        size: 28,
        color: '#ffffff',
      }).setDepth(depth + 0.2),
      compactBodyText(scene, 640, 480, t(language, 'install.iosHint'), {
        width: 820,
        size: 26,
        color: '#b9cde5',
      }).setDepth(depth + 0.2),
      ...createClose(scene, depth + 0.3, onClose),
    ];
    const closeButton = setButtonDepth(createCompactButton(scene, {
      x: 640,
      y: 585,
      width: 320,
      height: 68,
      label: t(language, 'install.close'),
      color: 0x1596a8,
      onPress: onClose,
    }), depth + 1);
    objects.push(...closeButton.objects);
    return { kind, appInfo: null, destroy: () => objects.forEach((object) => object.destroy()) };
  }
  if (kind === 'about') {
    const creator = getCharacter('dad');
    const fieldTexture = scene.arenaTheme?.texture;
    const panel = createCompactPanel(scene, {
      x: 640,
      y: 360,
      width: 1120,
      height: 650,
      accent: 0xffdc72,
    });
    const fieldArt = fieldTexture && scene.textures.exists(fieldTexture)
      ? scene.add.image(640, 360, fieldTexture)
        .setDisplaySize(1100, 630)
        .setTint(0x7891a8)
        .setAlpha(0.72)
        .setDepth(depth + 0.145)
      : null;
    const fieldWash = scene.add.graphics()
      .fillGradientStyle(0x0b2133, 0x0b2133, 0x020711, 0x020711, 0.56, 0.56, 0.9, 0.9)
      .fillRect(90, 45, 1100, 630)
      .setDepth(depth + 0.155);
    const fieldShade = scene.add.rectangle(640, 360, 1100, 630, 0x020812, 0.5)
      .setDepth(depth + 0.16);
    const objects = [
      scene.add.rectangle(-horizontalOffset, 0, scene.stageLayout.width, scene.stageLayout.height, 0x030712, 0.84)
        .setOrigin(0).setDepth(depth).setInteractive(),
      ...setPanelDepth(panel, depth + 0.05),
      fieldArt,
      fieldWash,
      fieldShade,
      scene.add.text(640, 76, t(language, 'about.title'), compactTextStyle(38, '#ffffff', {
        fontFamily: 'Arial Black, sans-serif',
      })).setOrigin(0.5).setDepth(depth + 0.2),
      ...createClose(scene, depth + 0.3, onClose),
      scene.add.text(340, 160, 'JOEL FOOTBALL', compactTextStyle(40, '#ffe79a', {
        fontFamily: 'Arial Black, sans-serif',
        stroke: '#261b08',
        strokeThickness: 5,
      })).setOrigin(0.5).setDepth(depth + 0.8),
      scene.add.text(340, 212, t(language, 'about.creatorCharacter'), compactTextStyle(28, '#ffdc72'))
        .setOrigin(0.5).setDepth(depth + 0.8),
      compactBodyText(scene, 340, 260, t(language, 'about.dedication'), {
        width: 420,
        size: 26,
        color: '#d7e8f8',
      }).setDepth(depth + 0.8),
      scene.add.ellipse(340, 568, 190, 34, 0x000000, 0.52).setDepth(depth + 0.78),
      scene.add.image(340, 430, creator.portraitTexture).setDisplaySize(300, 300).setDepth(depth + 0.8),
      scene.add.text(340, 610, `${t(language, 'about.version')} ${appInfo?.version ?? '1.6.0'}`, compactTextStyle(20, '#a9bdd8'))
        .setOrigin(0.5).setDepth(depth + 0.8),
      scene.add.text(850, 180, 'www.arkdbox.com', compactTextStyle(34, '#7ce8ff'))
        .setOrigin(0.5).setDepth(depth + 0.8),
    ];
    const addLinkButton = (options) => {
      const button = setButtonDepth(createCompactButton(scene, options), depth + 1);
      objects.push(...button.objects);
    };
    addLinkButton({
      x: 850,
      y: 300,
      width: 500,
      height: 72,
      label: t(language, 'about.youtube'),
      color: 0xa91220,
      accent: 0xff5f6b,
      onPress: () => onOpenExternal?.(COMPACT_ABOUT_LINKS.youtube),
    });
    addLinkButton({
      x: 710,
      y: 430,
      width: 240,
      height: 70,
      label: t(language, 'about.privacy'),
      color: 0x12495c,
      accent: 0x7ce8ff,
      onPress: () => onOpenExternal?.(COMPACT_ABOUT_LINKS.privacy),
    });
    addLinkButton({
      x: 980,
      y: 430,
      width: 260,
      height: 70,
      label: t(language, 'about.reportProblem'),
      color: 0x65420e,
      accent: 0xffdc72,
      onPress: () => onOpenExternal?.(COMPACT_ABOUT_LINKS.support),
    });
    return {
      kind,
      appInfo: appInfo ?? null,
      destroy: () => objects.forEach((object) => object?.destroy?.()),
    };
  }
  const fixedObjects = [];
  const pageObjects = [];
  const tabs = [
    { id: 'basics', label: language === 'es' ? 'CONTROLES' : 'CONTROLS' },
    { id: 'advanced', label: language === 'es' ? 'TÉCNICAS' : 'TECHNIQUES' },
  ];
  let activeTab = tabs[0].id;
  const panel = createCompactPanel(scene, {
    x: 640,
    y: 360,
    width: 1120,
    height: 650,
    accent: 0x8fefff,
  });

  fixedObjects.push(
    scene.add.rectangle(-horizontalOffset, 0, scene.stageLayout.width, scene.stageLayout.height, 0x030712, 0.84)
      .setOrigin(0).setDepth(depth).setInteractive(),
    ...setPanelDepth(panel, depth + 0.05),
    scene.add.text(640, 76, t(language, gameId === 'kickfall'
      ? 'kickfallSetup.helpTitle'
      : 'help.title'), compactTextStyle(38, '#ffffff', {
      fontFamily: 'Arial Black, sans-serif',
    })).setOrigin(0.5).setDepth(depth + 0.2),
    ...createClose(scene, depth + 0.3, onClose),
  );
  const baseObjectCount = fixedObjects.length;

  const renderTabs = () => {
    const width = 720;
    const tabWidth = 345;
    tabs.forEach((tab, index) => {
      const button = setButtonDepth(createCompactButton(scene, {
        x: 640 - width / 2 + tabWidth / 2 + index * 375,
        y: 137,
        width: tabWidth,
        height: 52,
        label: tab.label,
        color: tab.id === activeTab ? 0x2a9eb5 : 0x173858,
        onPress: () => {
          arcadeAudio.click();
          if (activeTab === tab.id) return;
          activeTab = tab.id;
          destroyObjects(pageObjects);
          destroyObjects(fixedObjects.splice(baseObjectCount));
          renderTabs();
          renderPage();
        },
      }), depth + 1);
      fixedObjects.push(...button.objects);
    });
  };

  const renderHelp = () => {
    const joystick = getFootballTouchMovementMode(scene) === FOOTBALL_TOUCH_MOVEMENT_MODES.JOYSTICK;
    if (gameId === 'kickfall') {
      if (activeTab === 'basics') {
        createActionRow(scene, pageObjects, depth + 0.8, { y: ACTION_ROW_Y[0], icon: 'right', label: t(language, 'kickfallSetup.move'), copy: t(language, 'kickfallSetup.moveCopy') });
        createActionRow(scene, pageObjects, depth + 0.8, { y: ACTION_ROW_Y[1], icon: 'jump', label: t(language, 'kickfallSetup.jump'), copy: t(language, 'kickfallSetup.jumpCopy') });
        createActionRow(scene, pageObjects, depth + 0.8, { y: ACTION_ROW_Y[2], icon: 'kick', label: t(language, 'kickfallSetup.kick'), copy: t(language, 'kickfallSetup.kickCopy') });
      } else {
        pageObjects.push(
          scene.add.text(640, 260, t(language, 'kickfallSetup.objectiveTitle'), compactTextStyle(32, '#ffdc72'))
            .setOrigin(0.5).setDepth(depth + 0.8),
          compactBodyText(scene, 640, 375, t(language, 'kickfallSetup.objective'), {
            width: 830,
            size: 27,
            color: '#d7e8f8',
          }).setDepth(depth + 0.8),
        );
      }
      return;
    }
    const actions = activeTab === 'basics'
      ? [
        ['right', 'move'],
        ['jump', 'jump'],
        ['kick', 'kick'],
      ]
      : [
        ['lob', 'lob'],
        ['power', 'power'],
      ];
    actions.forEach(([icon, action], index) => createActionRow(scene, pageObjects, depth + 0.8, {
      y: ACTION_ROW_Y[index],
      icon,
      label: t(language, `help.${action}`),
      copy: t(language, `help.${joystick ? 'touchJoystick' : 'touch'}.${action}`),
    }));
    if (activeTab === 'advanced') {
      pageObjects.push(compactBodyText(scene, 640, 535, t(language, joystick ? 'help.specialCopyJoystick' : 'help.specialCopy'), {
        width: 850,
        size: 25,
        color: '#ffdc72',
      }).setDepth(depth + 0.8));
    }
  };

  const renderPage = () => renderHelp();

  renderTabs();
  renderPage();
  return {
    kind,
    appInfo: appInfo ?? null,
    destroy: () => {
      destroyObjects(pageObjects);
      destroyObjects(fixedObjects);
    },
  };
};
