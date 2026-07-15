import { fitTextSize } from './textFit.js';
import { getWideStageUiScale } from '../layout/tabletStage.js';

export const createButton = (scene, {
  x,
  y,
  width,
  height,
  label,
  onPress,
  color = 0x7c5cff,
  activateOnPointerDown = false,
  pointerDownDebounceMs = 0,
}) => {
  const uiScale = getWideStageUiScale(scene.stageLayout);
  const scaledWidth = width * uiScale;
  const scaledHeight = height * uiScale;
  const shadow = scene.add.rectangle(x, y + 7 * uiScale, scaledWidth, scaledHeight, 0x080d1b, 0.45).setOrigin(0.5);
  const background = scene.add.rectangle(x, y, scaledWidth, scaledHeight, color, 1).setOrigin(0.5);
  background.setStrokeStyle(3, 0xffffff, 0.25);
  const baseFontSize = Math.min(34, scaledHeight * 0.38);
  const text = scene.add.text(x, y, label, {
    fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
    fontSize: `${baseFontSize}px`,
    fontStyle: 'bold',
    color: '#ffffff',
    align: 'center',
  }).setOrigin(0.5);
  const setLabel = (nextLabel) => {
    text.setText(nextLabel).setFontSize(baseFontSize);
    text.setFontSize(fitTextSize({
      measuredWidth: text.width,
      maxWidth: scaledWidth - 28 * uiScale,
      baseSize: baseFontSize,
      minSize: Math.min(14, baseFontSize),
    }));
  };
  setLabel(label);
  const zone = scene.add.zone(x, y, scaledWidth, scaledHeight).setInteractive({ useHandCursor: true });
  const setScale = (scale) => [background, text].forEach((item) => item.setScale(scale));
  let pointerDownLocked = false;
  let unlockTimer = null;
  const activate = () => {
    scene.game.events.emit('platform:haptic', 'light');
    onPress();
  };
  const lockPointerDown = () => {
    if (pointerDownDebounceMs <= 0) return true;
    if (pointerDownLocked) return false;
    pointerDownLocked = true;
    unlockTimer?.remove(false);
    unlockTimer = scene.time.delayedCall(2_000, () => { pointerDownLocked = false; });
    return true;
  };
  const releasePointerDown = () => {
    if (!activateOnPointerDown || pointerDownDebounceMs <= 0) return;
    unlockTimer?.remove(false);
    unlockTimer = scene.time.delayedCall(pointerDownDebounceMs, () => { pointerDownLocked = false; });
  };
  zone.on('pointerover', () => setScale(1.035));
  zone.on('pointerout', () => setScale(1));
  zone.on('pointerdown', () => {
    setScale(0.96);
    if (activateOnPointerDown && lockPointerDown()) activate();
  });
  zone.on('pointerup', () => {
    setScale(1.035);
    if (!activateOnPointerDown) activate();
    releasePointerDown();
  });
  zone.on('pointerupoutside', releasePointerDown);
  return {
    shadow,
    background,
    text,
    zone,
    setLabel,
    setPosition: (nextX, nextY) => {
      shadow.setPosition(nextX, nextY + 7 * uiScale);
      [background, text, zone].forEach((item) => item.setPosition(nextX, nextY));
    },
    setVisible: (visible) => {
      [shadow, background, text, zone].forEach((item) => item.setVisible(visible));
      zone.input.enabled = visible;
    },
  };
};
