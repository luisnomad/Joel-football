import { createButton } from './createButton.js';

const textStyle = (size, color = '#ffffff', extra = {}) => ({
  fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
  fontSize: `${size}px`,
  color,
  align: 'center',
  ...extra,
});

export const createConfirmationOverlay = (scene, {
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}) => {
  const depth = 320;
  const height = scene.stageLayout?.height ?? 720;
  const panelY = height / 2;
  const shade = scene.add.rectangle(0, 0, 1280, height, 0x030712, 0.8)
    .setOrigin(0)
    .setDepth(depth)
    .setInteractive();
  const panelShadow = scene.add.rectangle(640, panelY + 10, 640, 300, 0x020711, 0.66)
    .setDepth(depth + 0.1);
  const panel = scene.add.rectangle(640, panelY, 640, 300, 0x0d1b34, 0.99)
    .setStrokeStyle(2, 0xffb36b, 0.66)
    .setDepth(depth + 0.1);
  const accent = scene.add.rectangle(640, panelY - 150, 170, 4, 0xffb36b, 0.92)
    .setDepth(depth + 0.2);
  const titleText = scene.add.text(640, panelY - 78, title, textStyle(34, '#ffffff', { fontStyle: 'bold' }))
    .setOrigin(0.5)
    .setDepth(depth + 0.2);
  const messageText = scene.add.text(640, panelY - 18, message, textStyle(18, '#c5d7eb', {
    wordWrap: { width: 520, useAdvancedWrap: true },
  })).setOrigin(0.5).setDepth(depth + 0.2);
  const cancelButton = createButton(scene, {
    x: 520,
    y: panelY + 76,
    width: 210,
    height: 54,
    label: cancelLabel,
    color: 0x247f98,
    onPress: onCancel,
  });
  const confirmButton = createButton(scene, {
    x: 760,
    y: panelY + 76,
    width: 210,
    height: 54,
    label: confirmLabel,
    color: 0xa34457,
    onPress: onConfirm,
  });
  const buttonObjects = [cancelButton, confirmButton].flatMap((button) => [
    button.shadow,
    button.background,
    button.text,
    button.zone,
  ]);
  buttonObjects.forEach((object) => object.setDepth(depth + 0.3));
  const objects = [shade, panelShadow, panel, accent, titleText, messageText, ...buttonObjects];

  return {
    kind: 'abandon-confirm',
    destroy: () => objects.forEach((object) => object.destroy()),
  };
};
