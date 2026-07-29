import { fitTextSize } from './textFit.js';
import { getWideStageUiScale } from '../layout/tabletStage.js';
import { bindButtonInput } from './buttonInput.js';

export const createButton = (scene, {
  x,
  y,
  width,
  height,
  label,
  onPress,
  color = 0x7c5cff,
  activateOnPointerDown = false,
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
  bindButtonInput(scene, zone, {
    onOver: () => setScale(1.035),
    onOut: () => setScale(1),
    onPress: () => setScale(0.96),
    onRelease: () => setScale(1.035),
    onActivate: () => onPress?.(),
    activateOnPointerDown,
  });
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
