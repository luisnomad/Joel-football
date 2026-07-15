import { GAME_WIDTH } from '../constants.js';
import { t } from '../i18n.js';
import { createControlIcon } from './createControlIcon.js';

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
  zone.on('pointerup', onClose);
  return [ring, cross, zone];
};

const createAboutContent = (scene, language, appInfo, depth) => {
  const buildLabel = appInfo?.build && appInfo.build !== 'web' ? ` (${appInfo.build})` : '';
  return [
    scene.add.text(640, 274, 'JOEL FOOTBALL', textStyle(48, '#ffffff', {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      stroke: '#10213e',
      strokeThickness: 8,
    })).setOrigin(0.5).setDepth(depth),
    scene.add.text(640, 354, t(language, 'about.credit'), textStyle(22, '#bff8ff')).setOrigin(0.5).setDepth(depth),
    scene.add.text(640, 411, t(language, 'about.dedication'), textStyle(25, '#ffdc72', { fontStyle: 'bold' })).setOrigin(0.5).setDepth(depth),
    scene.add.text(640, 492, `${t(language, 'about.version')} ${appInfo?.version ?? '1.0.0'}${buildLabel}`, textStyle(18, '#a9bdd8')).setOrigin(0.5).setDepth(depth),
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
  button.on('pointerup', onClose);
  return [share, body, hint, button, label];
};

const createHelpRow = (scene, { x, y, icon, label, description, depth }) => {
  const badge = scene.add.circle(x, y, 29, 0x5be4f2, 0.08).setStrokeStyle(2, 0x8fefff, 0.28).setDepth(depth);
  const symbol = createControlIcon(scene, {
    x,
    y,
    size: 34,
    icon,
    depth: depth + 0.1,
    alpha: 0.9,
  });
  const title = scene.add.text(x + 48, y - 12, label, textStyle(17, '#ffffff', { fontStyle: 'bold', align: 'left' })).setOrigin(0, 0.5).setDepth(depth);
  const copy = scene.add.text(x + 48, y + 13, description, textStyle(13, '#b9cde5', { align: 'left' })).setOrigin(0, 0.5).setDepth(depth);
  return [badge, symbol, title, copy];
};

const createHelpContent = (scene, language, inputMode, depth) => {
  const touch = inputMode === 'touch';
  const actions = [
    ['move', 'right'], ['jump', 'jump'], ['kick', 'kick'],
    ['lob', 'lob'], ['power', 'power'],
  ];
  const objects = [];
  actions.forEach(([action, icon], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    objects.push(...createHelpRow(scene, {
      x: 350 + column * 390,
      y: 232 + row * 78,
      icon,
      label: t(language, `help.${action}`),
      description: t(language, `help.${touch ? 'touch' : 'keyboard'}.${action}`),
      depth,
    }));
  });
  objects.push(
    scene.add.rectangle(640, 493, 690, 1, 0x8fefff, 0.22).setDepth(depth),
    scene.add.text(640, 528, t(language, 'help.specialTitle'), textStyle(17, '#ffdc72', { fontStyle: 'bold' })).setOrigin(0.5).setDepth(depth),
    scene.add.text(640, 577, t(language, 'help.specialCopy'), textStyle(15, '#d7e8f8', {
      lineSpacing: 7,
      wordWrap: { width: 690 },
    })).setOrigin(0.5).setDepth(depth),
  );
  return objects;
};

export const createInfoOverlay = (scene, {
  kind,
  language,
  inputMode,
  appInfo,
  onClose,
}) => {
  const depth = 300;
  const height = scene.stageLayout?.height ?? 720;
  const shade = scene.add.rectangle(0, 0, GAME_WIDTH, height, 0x030712, 0.78).setOrigin(0).setDepth(depth).setInteractive();
  const panelHeight = kind === 'help' ? 590 : kind === 'install' ? 500 : 430;
  const panelY = Math.min(height / 2, 380);
  const panel = scene.add.rectangle(640, panelY, kind === 'help' ? 890 : 720, panelHeight, 0x0d1b34, 0.985)
    .setStrokeStyle(3, kind === 'help' ? 0x8fefff : 0xffdc72, 0.46)
    .setDepth(depth + 0.1);
  const title = scene.add.text(640, panelY - panelHeight / 2 + 54, t(language, `${kind}.title`), textStyle(34, '#ffffff', { fontStyle: 'bold' }))
    .setOrigin(0.5).setDepth(depth + 0.2);
  const closeObjects = createCloseControl(scene, 640 + (kind === 'help' ? 405 : 320), panelY - panelHeight / 2 + 42, depth + 0.3, onClose);
  const content = kind === 'help'
    ? createHelpContent(scene, language, inputMode, depth + 0.2)
    : kind === 'install'
      ? createInstallContent(scene, language, depth + 0.2, onClose)
      : createAboutContent(scene, language, appInfo, depth + 0.2);
  const objects = [shade, panel, title, ...closeObjects, ...content];
  return {
    kind,
    appInfo: appInfo ?? null,
    destroy: () => objects.forEach((object) => object.destroy()),
  };
};
