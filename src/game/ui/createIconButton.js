import { createControlIcon } from './createControlIcon.js';
import { getWideStageUiScale } from '../layout/tabletStage.js';

export const createIconButton = (scene, {
  x,
  y,
  radius = 28,
  icon,
  accent = 0x52d7e8,
  depth = 90,
  onPress,
}) => {
  radius *= getWideStageUiScale(scene.stageLayout);
  const shadow = scene.add.circle(x, y + 3, radius + 2, 0x04101e, 0.16).setDepth(depth);
  const surface = scene.add.circle(x, y, radius, 0xdaf7ff, 0.11).setDepth(depth + 0.1)
    .setStrokeStyle(Math.max(1.5, radius * 0.045), 0xffffff, 0.42);
  const rim = scene.add.circle(x, y, radius - 4, accent, 0.025).setDepth(depth + 0.2)
    .setStrokeStyle(1, accent, 0.2);
  const symbol = createControlIcon(scene, { x, y, size: radius * 0.88, icon, depth: depth + 0.3 });
  const zone = scene.add.circle(x, y, radius, 0xffffff, 0).setDepth(depth + 0.4).setInteractive({ useHandCursor: true });
  const visuals = [shadow, surface, rim, symbol];
  const setScale = (scale) => visuals.forEach((item) => item.setScale(scale));
  zone.on('pointerdown', () => setScale(0.9));
  zone.on('pointerout', () => setScale(1));
  zone.on('pointerup', () => {
    setScale(1);
    scene.game.events.emit('platform:haptic', 'light');
    onPress?.();
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
