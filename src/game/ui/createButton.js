import { fitTextSize } from './textFit.js';

export const createButton = (scene, { x, y, width, height, label, onPress, color = 0x7c5cff }) => {
  const shadow = scene.add.rectangle(x, y + 7, width, height, 0x080d1b, 0.45).setOrigin(0.5);
  const background = scene.add.rectangle(x, y, width, height, color, 1).setOrigin(0.5);
  background.setStrokeStyle(3, 0xffffff, 0.25);
  const baseFontSize = Math.min(30, height * 0.38);
  const text = scene.add.text(x, y, label, {
    fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
    fontSize: `${baseFontSize}px`,
    fontStyle: 'bold',
    color: '#ffffff',
    align: 'center',
  }).setOrigin(0.5);
  text.setFontSize(fitTextSize({
    measuredWidth: text.width,
    maxWidth: width - 28,
    baseSize: baseFontSize,
    minSize: Math.min(14, baseFontSize),
  }));
  const zone = scene.add.zone(x, y, width, height).setInteractive({ useHandCursor: true });
  const setScale = (scale) => [background, text].forEach((item) => item.setScale(scale));
  zone.on('pointerover', () => setScale(1.035));
  zone.on('pointerout', () => setScale(1));
  zone.on('pointerdown', () => setScale(0.96));
  zone.on('pointerup', () => {
    setScale(1.035);
    onPress();
  });
  return {
    shadow,
    background,
    text,
    zone,
    setVisible: (visible) => {
      [shadow, background, text, zone].forEach((item) => item.setVisible(visible));
      zone.input.enabled = visible;
    },
  };
};
