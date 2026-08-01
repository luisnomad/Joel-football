import Phaser from 'phaser';
import { GAME_WIDTH } from '../constants.js';
import { bindButtonInput } from '../ui/buttonInput.js';
import { fitTextSize } from '../ui/textFit.js';
import { arcadeAudio } from '../services/ArcadeAudio.js';

const PHONE_CHROME = Object.freeze({
  metalLight: 0x9ab8cf,
  metalBase: 0x5a748c,
  metalDark: 0x273b52,
  panel: 0x101f35,
  panelInset: 0x0a1729,
  tabInactive: 0x1a2b40,
  tabActive: 0x25567d,
  cyan: 0x20d9ff,
});

const setObjectsVisible = (objects, visible) => objects.forEach((object) => object.setVisible(visible));

const makeFittedText = (scene, x, y, label, {
  width,
  height,
  color = '#ffffff',
  size = Math.min(31, height * 0.42),
} = {}) => {
  const text = scene.add.text(x, y, label, compactTextStyle(size, color, {
    fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
    stroke: '#07111f',
    strokeThickness: 3,
  })).setOrigin(0.5);
  const setLabel = (nextLabel) => {
    text.setText(nextLabel).setFontSize(size);
    text.setFontSize(fitTextSize({
      measuredWidth: text.width,
      maxWidth: width - 28,
      baseSize: size,
      minSize: Math.min(15, size),
    }));
  };
  setLabel(label);
  return { text, setLabel };
};

export const compactTextStyle = (size = 24, color = '#ffffff', extra = {}) => ({
  fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
  fontSize: `${size}px`,
  fontStyle: 'bold',
  color,
  align: 'center',
  ...extra,
});

export const createCompactBackdrop = (scene, {
  texture = null,
  top = 0x07152d,
  bottom = 0x120b25,
  imageAlpha = 0.52,
  washTopAlpha = 0.72,
  washBottomAlpha = 0.94,
} = {}) => {
  const horizontalOffset = Math.max(0, scene.stageLayout.width - GAME_WIDTH) / 2;
  if (horizontalOffset >= 12) scene.cameras.main.setScroll(-horizontalOffset, 0);
  if (texture && scene.textures.exists(texture)) {
    scene.add.image(GAME_WIDTH / 2, scene.stageLayout.height / 2, texture)
      .setDisplaySize(scene.stageLayout.width, scene.stageLayout.height)
      .setAlpha(imageAlpha);
  }
  const wash = scene.add.graphics();
  wash.fillGradientStyle(top, top, bottom, bottom, washTopAlpha, washTopAlpha, washBottomAlpha, washBottomAlpha);
  wash.fillRect(-horizontalOffset, 0, scene.stageLayout.width, scene.stageLayout.height);
  const frame = scene.add.graphics();
  frame.lineStyle(3, PHONE_CHROME.metalLight, 0.22);
  frame.strokeRoundedRect(18, 18, GAME_WIDTH - 36, 684, 24);
};

export const createCompactButton = (scene, {
  x,
  y,
  width,
  height,
  label,
  onPress,
  color = PHONE_CHROME.tabActive,
  accent = PHONE_CHROME.cyan,
  active = false,
  activateOnPointerDown = false,
}) => {
  const shadow = scene.add.rectangle(x, y + 7, width, height, 0x020711, 0.58).setOrigin(0.5);
  const frame = scene.add.rectangle(x, y, width, height, PHONE_CHROME.metalDark, 1)
    .setStrokeStyle(2, PHONE_CHROME.metalLight, 0.74);
  const background = scene.add.rectangle(x, y, width - 8, height - 8, color, 1)
    .setStrokeStyle(1, 0xd9efff, 0.12);
  const sheen = scene.add.rectangle(x, y - (height - 12) * 0.22, width - 12, (height - 12) * 0.46, 0xffffff, 0.055);
  const rail = scene.add.rectangle(x, y - height / 2 + 3, width - 8, 4, accent, active ? 1 : 0.28);
  const { text, setLabel } = makeFittedText(scene, x, y + 1, label, { width, height });
  const zone = scene.add.zone(x, y, width, Math.max(78, height)).setInteractive({ useHandCursor: true });
  const visualObjects = [frame, background, sheen, rail, text];
  const objects = [shadow, ...visualObjects, zone];
  const setPressed = (pressed) => {
    background.setAlpha(pressed ? 0.78 : 1);
    sheen.setAlpha(pressed ? 0.025 : 0.055);
    text.setY(y + (pressed ? 3 : 1));
  };
  bindButtonInput(scene, zone, {
    onOver: () => rail.setAlpha(active ? 1 : 0.62),
    onOut: () => { rail.setAlpha(active ? 1 : 0.28); setPressed(false); },
    onPress: () => setPressed(true),
    onRelease: () => setPressed(false),
    onActivate: () => onPress?.(),
    activateOnPointerDown,
  });
  return {
    shadow,
    frame,
    background,
    sheen,
    rail,
    text,
    zone,
    objects,
    setLabel,
    setColor: (nextColor) => background.setFillStyle(nextColor, 1),
    setPosition: (nextX, nextY) => {
      const dx = nextX - x;
      const dy = nextY - y;
      objects.forEach((object) => object.setPosition(object.x + dx, object.y + dy));
    },
    setVisible: (visible) => {
      setObjectsVisible(objects, visible);
      zone.input.enabled = visible;
    },
  };
};

export const createCompactPrimaryButton = (scene, {
  x,
  y,
  width,
  height,
  label,
  onPress,
  accent = PHONE_CHROME.cyan,
}) => {
  const points = (offsetX = 0, offsetY = 0, inset = 0) => [
    new Phaser.Geom.Point(x - width / 2 + 28 + inset + offsetX, y - height / 2 + inset + offsetY),
    new Phaser.Geom.Point(x + width / 2 - 28 - inset + offsetX, y - height / 2 + inset + offsetY),
    new Phaser.Geom.Point(x + width / 2 - inset + offsetX, y + height / 2 - inset + offsetY),
    new Phaser.Geom.Point(x - width / 2 + inset + offsetX, y + height / 2 - inset + offsetY),
  ];
  const shadow = scene.add.graphics().fillStyle(0x020711, 0.64).fillPoints(points(0, 9), true);
  const frame = scene.add.graphics()
    .fillGradientStyle(PHONE_CHROME.metalLight, PHONE_CHROME.metalLight, PHONE_CHROME.metalDark, PHONE_CHROME.metalDark, 1)
    .fillPoints(points(), true);
  const background = scene.add.graphics()
    .fillGradientStyle(0x304761, 0x304761, 0x152235, 0x152235, 1)
    .fillPoints(points(0, 0, 6), true)
    .lineStyle(2, accent, 0.28)
    .strokePoints(points(0, 0, 7), true);
  const rail = scene.add.graphics().lineStyle(4, accent, 0.94)
    .lineBetween(x - width / 2 + 36, y - height / 2 + 7, x + width / 2 - 36, y - height / 2 + 7);
  const { text } = makeFittedText(scene, x, y + 2, label, { width: width - 55, height, size: Math.min(32, height * 0.42) });
  const zone = scene.add.zone(x, y, width, Math.max(82, height)).setInteractive({ useHandCursor: true });
  const objects = [shadow, frame, background, rail, text, zone];
  bindButtonInput(scene, zone, {
    onOver: () => rail.setAlpha(1),
    onOut: () => { rail.setAlpha(0.94); background.setAlpha(1); text.setY(y + 2); },
    onPress: () => { background.setAlpha(0.76); text.setY(y + 5); },
    onRelease: () => { background.setAlpha(1); text.setY(y + 2); },
    onActivate: () => onPress?.(),
  });
  return { shadow, frame, background, rail, text, zone, objects };
};

export const createCompactHeader = (scene, {
  title,
  subtitle = '',
  backLabel,
  onBack,
  accent = 0x7ce8ff,
}) => {
  createCompactButton(scene, {
    x: 92,
    y: 48,
    width: 150,
    height: 52,
    label: `‹  ${backLabel}`,
    color: 0x173858,
    accent,
    onPress: onBack,
  });
  scene.add.text(GAME_WIDTH / 2, 49, title, compactTextStyle(46, '#ffffff', {
    fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
    stroke: '#10213e',
    strokeThickness: 8,
    shadow: { color: Phaser.Display.Color.IntegerToColor(accent).rgba, blur: 10, fill: true, offsetY: 3 },
  })).setOrigin(0.5);
  if (subtitle) {
    scene.add.text(GAME_WIDTH / 2, 87, subtitle, compactTextStyle(22, '#d9efff', {
      stroke: '#071426',
      strokeThickness: 4,
    })).setOrigin(0.5);
  }
};

export const createCompactTabs = (scene, {
  tabs,
  activeId,
  y = 127,
  width = 930,
  onSelect,
}) => {
  const height = 60;
  const tabWidth = width / tabs.length;
  const startX = GAME_WIDTH / 2 - width / 2 + tabWidth / 2;
  const trackShadow = scene.add.rectangle(GAME_WIDTH / 2, y + 6, width + 8, height + 8, 0x020711, 0.58);
  const trackFrame = scene.add.rectangle(GAME_WIDTH / 2, y, width + 8, height + 8, PHONE_CHROME.metalDark, 1)
    .setStrokeStyle(2, PHONE_CHROME.metalLight, 0.78);
  const track = scene.add.rectangle(GAME_WIDTH / 2, y, width, height, PHONE_CHROME.panelInset, 1);
  const buttons = tabs.map((tab, index) => {
    const x = startX + index * tabWidth;
    const active = tab.id === activeId;
    const accent = tab.color ?? PHONE_CHROME.cyan;
    const background = scene.add.rectangle(x, y, tabWidth - 1, height - 2, active ? PHONE_CHROME.tabActive : PHONE_CHROME.tabInactive, 1)
      .setStrokeStyle(1, PHONE_CHROME.metalLight, 0.18);
    const sheen = scene.add.rectangle(x, y - 13, tabWidth - 3, 28, 0xffffff, active ? 0.08 : 0.035);
    const rail = scene.add.rectangle(x, y - height / 2 + 2, tabWidth - 4, 4, accent, active ? 1 : 0);
    const { text } = makeFittedText(scene, x, y + 1, tab.label, {
      width: tabWidth,
      height,
      color: active ? '#ffffff' : '#c8d8e8',
      size: 24,
    });
    const zone = scene.add.zone(x, y, tabWidth, 78).setInteractive({ useHandCursor: true });
    bindButtonInput(scene, zone, {
      onOver: () => { if (!active) background.setFillStyle(0x244560, 1); },
      onOut: () => { if (!active) background.setFillStyle(PHONE_CHROME.tabInactive, 1); },
      onPress: () => background.setAlpha(0.76),
      onRelease: () => background.setAlpha(1),
      onActivate: () => {
        arcadeAudio.click();
        if (!active) onSelect(tab.id);
      },
    });
    return { background, sheen, rail, text, zone, objects: [background, sheen, rail, text, zone] };
  });
  buttons.chrome = [trackShadow, trackFrame, track];
  return buttons;
};

export const createCompactPanel = (scene, {
  x = GAME_WIDTH / 2,
  y = 370,
  width = 1040,
  height = 390,
  color = 0x09172e,
  accent = 0x7ce8ff,
} = {}) => {
  const shadow = scene.add.rectangle(x, y + 13, width + 10, height + 10, 0x020711, 0.62);
  const outer = scene.add.rectangle(x, y, width + 10, height + 10, PHONE_CHROME.metalDark, 1)
    .setStrokeStyle(4, PHONE_CHROME.metalLight, 0.84);
  const middle = scene.add.rectangle(x, y, width, height, PHONE_CHROME.panel, 1)
    .setStrokeStyle(2, PHONE_CHROME.metalBase, 0.72);
  const inner = scene.add.rectangle(x, y, width - 14, height - 14, color, 0.992)
    .setStrokeStyle(2, accent, 0.2);
  const highlight = scene.add.rectangle(x, y - height / 2 + 5, width - 18, 3, accent, 0.62);
  inner.chrome = [shadow, outer, middle, highlight];
  return inner;
};

export const createCompactMediaFrame = (scene, {
  x,
  y,
  width,
  height,
  texture,
  accent = PHONE_CHROME.cyan,
  imageAlpha = 1,
} = {}) => {
  const shadow = scene.add.rectangle(x, y + 10, width + 14, height + 14, 0x020711, 0.62);
  const frame = scene.add.rectangle(x, y, width + 14, height + 14, PHONE_CHROME.metalDark, 1)
    .setStrokeStyle(3, PHONE_CHROME.metalLight, 0.76);
  const inset = scene.add.rectangle(x, y, width + 4, height + 4, PHONE_CHROME.panelInset, 1)
    .setStrokeStyle(2, accent, 0.34);
  const image = texture && scene.textures.exists(texture)
    ? scene.add.image(x, y, texture).setDisplaySize(width, height).setAlpha(imageAlpha)
    : null;
  const glare = scene.add.rectangle(x, y - height * 0.3, width - 4, height * 0.38, 0xffffff, 0.045);
  return { shadow, frame, inset, image, glare, objects: [shadow, frame, inset, image, glare].filter(Boolean) };
};

export const compactBodyText = (scene, x, y, text, {
  width = 880,
  size = 28,
  color = '#d8eaff',
  align = 'center',
  lineSpacing = 7,
  originX = 0.5,
  originY = 0.5,
} = {}) => scene.add.text(x, y, text, compactTextStyle(size, color, {
  align,
  lineSpacing,
  wordWrap: { width, useAdvancedWrap: true },
})).setOrigin(originX, originY);

export const restartCompactTab = (scene, data, tab) => {
  scene.scene.restart({ ...data, tab });
};
