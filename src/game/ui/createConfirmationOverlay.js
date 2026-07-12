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
  const panel = scene.add.rectangle(640, panelY, 620, 310, 0x0d1b34, 0.99)
    .setStrokeStyle(3, 0xffb36b, 0.6)
    .setDepth(depth + 0.1);
  const titleText = scene.add.text(640, panelY - 82, title, textStyle(38, '#ffffff', { fontStyle: 'bold' }))
    .setOrigin(0.5)
    .setDepth(depth + 0.2);
  const messageText = scene.add.text(640, panelY - 20, message, textStyle(19, '#c5d7eb', {
    wordWrap: { width: 500 },
  })).setOrigin(0.5).setDepth(depth + 0.2);
  const cancelButton = createButton(scene, {
    x: 505,
    y: panelY + 78,
    width: 230,
    height: 58,
    label: cancelLabel,
    color: 0x247f98,
    onPress: onCancel,
  });
  const confirmButton = createButton(scene, {
    x: 775,
    y: panelY + 78,
    width: 230,
    height: 58,
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
  const objects = [shade, panel, titleText, messageText, ...buttonObjects];

  return {
    kind: 'abandon-confirm',
    destroy: () => objects.forEach((object) => object.destroy()),
  };
};
