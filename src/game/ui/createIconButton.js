import { createControlIcon } from './createControlIcon.js';
import { getWideStageUiScale } from '../layout/tabletStage.js';
import { bindButtonInput } from './buttonInput.js';

export const createIconButton = (scene, {
  x,
  y,
  radius = 28,
  icon,
  accent = 0x52d7e8,
  depth = 90,
  prominent = false,
  caption = null,
  onPress,
}) => {
  radius *= getWideStageUiScale(scene.stageLayout);
  const shadow = scene.add.circle(
    x,
    y + 3,
    radius + 2,
    0x04101e,
    prominent ? 0.46 : 0.16,
  ).setDepth(depth);
  const surface = scene.add.circle(
    x,
    y,
    radius,
    prominent ? 0x0d2039 : 0xdaf7ff,
    prominent ? 0.94 : 0.11,
  ).setDepth(depth + 0.1)
    .setStrokeStyle(
      Math.max(prominent ? 2.5 : 1.5, radius * 0.045),
      prominent ? accent : 0xffffff,
      prominent ? 0.92 : 0.42,
    );
  const rim = scene.add.circle(
    x,
    y,
    radius - 4,
    accent,
    prominent ? 0.16 : 0.025,
  ).setDepth(depth + 0.2)
    .setStrokeStyle(prominent ? 1.5 : 1, accent, prominent ? 0.7 : 0.2);
  const symbol = createControlIcon(scene, { x, y, size: radius * 0.88, icon, depth: depth + 0.3 });
  const zone = scene.add.circle(x, y, radius, 0xffffff, 0).setDepth(depth + 0.4).setInteractive({ useHandCursor: true });
  const captionText = caption
    ? scene.add.text(x, y + radius + 9, caption, {
      fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
      fontSize: `${Math.max(11, Math.round(radius * 0.38))}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#071427',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(depth + 0.3)
    : null;
  const visuals = [shadow, surface, rim, symbol, captionText].filter(Boolean);
  const setScale = (scale) => visuals.forEach((item) => item.setScale(scale));
  bindButtonInput(scene, zone, {
    onPress: () => setScale(0.9),
    onRelease: () => setScale(1),
    onOut: () => setScale(1),
    onActivate: () => onPress?.(),
  });
  return {
    visuals,
    zone,
    setVisible: (visible) => {
      [...visuals, zone].forEach((item) => item.setVisible(visible));
      if (zone.input) zone.input.enabled = visible;
    },
    destroy: () => [...visuals, zone].forEach((item) => item.destroy()),
  };
};
