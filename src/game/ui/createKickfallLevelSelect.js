import { t } from '../i18n.js';
import { kickfallLevelTiles } from '../pure/profile.js';
import { bindButtonInput } from './buttonInput.js';

const textStyle = (size, color, extra = {}) => ({
  fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
  fontSize: `${size}px`,
  fontStyle: 'bold',
  color,
  ...extra,
});

/**
 * Full-screen level picker (tablet and phone share the 1280x720 logical stage;
 * `compact` enlarges type for phones). Unlocked tiles start that level through
 * `onSelect(level)`; `onClose` dismisses. Returns { destroy }.
 */
export const createKickfallLevelSelect = (scene, {
  progress,
  language,
  stageWidth = 1280,
  stageHeight = 720,
  compact = false,
  depth = 300,
  onSelect,
  onClose,
}) => {
  const objects = [];
  const add = (object) => {
    objects.push(object);
    return object.setDepth(object.depth || depth);
  };
  const horizontalOffset = Math.max(0, stageWidth - 1280) / 2;
  const top = Math.max(0, stageHeight - 720) / 2;
  add(scene.add.rectangle(-horizontalOffset, 0, stageWidth, stageHeight, 0x030817, 0.9).setOrigin(0).setInteractive());
  add(scene.add.rectangle(640, top + 360, 1180, 660, 0x0b1930, 0.98).setStrokeStyle(3, 0x7ce8ff, 0.4));
  const tiles = kickfallLevelTiles(progress);
  const totalStars = tiles.reduce((sum, tile) => sum + tile.stars, 0);
  add(scene.add.text(640, top + 70, t(language, 'kickfall.levels.title'), textStyle(compact ? 40 : 34, '#ffffff')).setOrigin(0.5));
  add(scene.add.text(640, top + 112, t(language, 'kickfall.levels.total', { stars: totalStars, max: tiles.length * 3 }), textStyle(compact ? 24 : 19, '#ffdc72')).setOrigin(0.5));

  const columns = 5;
  const tileWidth = 200;
  const tileHeight = compact ? 112 : 104;
  const gapX = 18;
  const gapY = 16;
  const startX = 640 - ((columns - 1) * (tileWidth + gapX)) / 2;
  const startY = top + 196;
  tiles.forEach((tile, index) => {
    const x = startX + (index % columns) * (tileWidth + gapX);
    const y = startY + Math.floor(index / columns) * (tileHeight + gapY);
    const fill = !tile.unlocked ? 0x1a2433 : tile.current ? 0x2b4f7d : 0x173858;
    const box = add(scene.add.rectangle(x, y, tileWidth, tileHeight, fill, 1)
      .setStrokeStyle(tile.current ? 4 : 2, tile.current ? 0xffdc72 : 0x7ce8ff, tile.unlocked ? 0.6 : 0.15));
    add(scene.add.text(x, y - (compact ? 22 : 20), tile.unlocked ? String(tile.level) : '🔒', textStyle(
      compact ? 38 : 32,
      tile.unlocked ? '#ffffff' : '#5c6b80',
    )).setOrigin(0.5));
    const starRow = [0, 1, 2].map((slot) => (slot < tile.stars ? '★' : '☆')).join(' ');
    add(scene.add.text(x, y + (compact ? 28 : 26), starRow, textStyle(
      compact ? 28 : 24,
      tile.unlocked ? (tile.stars > 0 ? '#ffd23a' : '#58718f') : '#2f3c4f',
    )).setOrigin(0.5));
    if (!tile.unlocked) return;
    const zone = add(scene.add.zone(x, y, tileWidth, tileHeight).setInteractive({ useHandCursor: true }));
    bindButtonInput(scene, zone, {
      onOver: () => box.setScale(1.03),
      onOut: () => box.setScale(1),
      onPress: () => box.setScale(0.97),
      onRelease: () => box.setScale(1.03),
      onActivate: () => onSelect?.(tile.level),
    });
  });

  const closeBox = add(scene.add.rectangle(1150, top + 70, compact ? 150 : 130, compact ? 64 : 54, 0x1d3c60, 1)
    .setStrokeStyle(2, 0xffffff, 0.3));
  add(scene.add.text(1150, top + 70, t(language, 'kickfall.levels.close'), textStyle(compact ? 24 : 20, '#ffffff')).setOrigin(0.5));
  const closeZone = add(scene.add.zone(1150, top + 70, compact ? 150 : 130, compact ? 64 : 54).setInteractive({ useHandCursor: true }));
  bindButtonInput(scene, closeZone, {
    onPress: () => closeBox.setScale(0.97),
    onRelease: () => closeBox.setScale(1),
    onActivate: () => onClose?.(),
  });

  return {
    tiles,
    destroy: () => objects.forEach((object) => object.destroy()),
  };
};
