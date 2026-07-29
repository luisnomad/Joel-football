import Phaser from 'phaser';
import { createControlIcon } from './createControlIcon.js';
import { bindButtonInput } from './buttonInput.js';

const coverImage = (image, width, height) => {
  const source = image.texture?.getSourceImage?.();
  const sourceWidth = source?.width || image.width || width;
  const sourceHeight = source?.height || image.height || height;
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  image.setScale(scale);
  return image;
};

const createCardMask = (scene, points) => {
  const shape = scene.make.graphics({ add: false });
  shape.fillStyle(0xffffff, 1).fillPoints(points, true);
  return { shape, mask: shape.createGeometryMask() };
};

const createBadge = (scene, {
  x,
  y,
  radius,
  icon,
  accent,
  depth,
}) => {
  const shadow = scene.add.circle(x, y + 5, radius + 5, 0x020817, 0.42).setDepth(depth);
  const outer = scene.add.circle(x, y, radius + 3, 0x071426, 0.96)
    .setStrokeStyle(3, 0xffffff, 0.62)
    .setDepth(depth + 0.1);
  const inner = scene.add.circle(x, y, radius - 4, accent, 0.96)
    .setStrokeStyle(2, 0xffffff, 0.36)
    .setDepth(depth + 0.2);
  const shine = scene.add.arc(
    x - radius * 0.12,
    y - radius * 0.1,
    radius * 0.78,
    205,
    315,
    false,
    0xffffff,
    0.22,
  ).setDepth(depth + 0.3);
  const symbol = createControlIcon(scene, {
    x,
    y,
    size: radius * 1.08,
    icon,
    depth: depth + 0.4,
    alpha: 0.96,
  });
  return [shadow, outer, inner, shine, symbol];
};

export const createJourneyCard = (scene, {
  x,
  y,
  width,
  height,
  texture,
  title,
  subtitle = '',
  meta = '',
  icon = 'football',
  color = 0x155bbd,
  accent = 0x55e9f5,
  foregroundTexture = null,
  foregroundX = 0.72,
  foregroundScale = 0.82,
  imageFocusX = 0.68,
  titleSize = Math.min(42, height * 0.25),
  layout = 'standard',
  depth = 20,
  onPress,
}) => {
  const cinematic = layout === 'cinematic';
  const left = x - width / 2;
  const right = x + width / 2;
  const top = y - height / 2;
  const bottom = y + height / 2;
  const bevel = Math.min(28, height * 0.16);
  const points = [
    new Phaser.Geom.Point(left + bevel, top),
    new Phaser.Geom.Point(right - bevel, top),
    new Phaser.Geom.Point(right, y),
    new Phaser.Geom.Point(right - bevel, bottom),
    new Phaser.Geom.Point(left, bottom),
    new Phaser.Geom.Point(left + bevel * 0.42, y),
  ];

  const shadow = scene.add.graphics().setDepth(depth);
  shadow.fillStyle(0x020817, 0.56);
  shadow.fillPoints(points.map((point) => new Phaser.Geom.Point(point.x + 5, point.y + 8)), true);

  const { shape: maskShape, mask } = createCardMask(scene, points);
  const artwork = scene.add.image(
    cinematic
      ? x + (imageFocusX - 0.5) * width * 0.1
      : left + width * imageFocusX,
    y,
    texture,
  ).setDepth(depth + 0.1);
  coverImage(artwork, cinematic ? width * 1.05 : width * 0.72, height);
  artwork.setMask(mask);

  const shade = scene.add.graphics().setDepth(depth + 0.2);
  if (cinematic) {
    shade.fillStyle(0x020817, 0.22);
  } else {
    shade.fillGradientStyle(0x020817, 0x020817, 0x061127, 0x061127, 0.08, 0.12, 0.42, 0.5);
  }
  shade.fillPoints(points, true);

  const colorEdge = cinematic ? left + 106 : left + width * 0.58;
  const colorPanel = scene.add.graphics().setDepth(depth + 0.3);
  if (cinematic) {
    const panelTop = top + 18;
    const panelBottom = bottom - 18;
    const panelRight = right - 16;
    colorPanel.fillStyle(0x020817, 0.72);
    colorPanel.fillPoints([
      new Phaser.Geom.Point(colorEdge + 12, panelTop),
      new Phaser.Geom.Point(panelRight - 10, panelTop),
      new Phaser.Geom.Point(panelRight, panelTop + 10),
      new Phaser.Geom.Point(panelRight, panelBottom - 10),
      new Phaser.Geom.Point(panelRight - 10, panelBottom),
      new Phaser.Geom.Point(colorEdge + 12, panelBottom),
      new Phaser.Geom.Point(colorEdge, panelBottom - 12),
      new Phaser.Geom.Point(colorEdge, panelTop + 12),
    ], true);
    colorPanel.lineStyle(2, 0xffffff, 0.14);
    colorPanel.strokePoints([
      new Phaser.Geom.Point(colorEdge + 12, panelTop),
      new Phaser.Geom.Point(panelRight - 10, panelTop),
      new Phaser.Geom.Point(panelRight, panelTop + 10),
      new Phaser.Geom.Point(panelRight, panelBottom - 10),
      new Phaser.Geom.Point(panelRight - 10, panelBottom),
      new Phaser.Geom.Point(colorEdge + 12, panelBottom),
      new Phaser.Geom.Point(colorEdge, panelBottom - 12),
      new Phaser.Geom.Point(colorEdge, panelTop + 12),
    ], true);
    colorPanel.fillStyle(color, 0.96);
    colorPanel.fillRect(colorEdge + 12, panelTop + 16, 5, panelBottom - panelTop - 32);
  } else {
    colorPanel.fillGradientStyle(color, color, Phaser.Display.Color.ValueToColor(color).darken(18).color, color, 0.98);
    colorPanel.fillPoints([
      new Phaser.Geom.Point(left + bevel, top),
      new Phaser.Geom.Point(colorEdge + bevel, top),
      new Phaser.Geom.Point(colorEdge - bevel, bottom),
      new Phaser.Geom.Point(left, bottom),
      new Phaser.Geom.Point(left + bevel * 0.42, y),
    ], true);
  }

  const seam = scene.add.graphics().setDepth(depth + 0.4);
  if (!cinematic) {
    seam.lineStyle(4, 0xffffff, 0.24);
    seam.lineBetween(colorEdge + bevel, top + 2, colorEdge - bevel, bottom - 2);
  }

  let foreground = null;
  if (foregroundTexture) {
    foreground = scene.add.image(left + width * foregroundX, y + height * 0.06, foregroundTexture)
      .setDepth(depth + 0.45)
      .setScale(foregroundScale);
    const maxHeight = height * 0.95;
    if (foreground.displayHeight > maxHeight) {
      foreground.setScale(foreground.scaleX * (maxHeight / foreground.displayHeight));
    }
    foreground.setMask(mask);
  }

  const outline = scene.add.graphics().setDepth(depth + 0.8);
  outline.lineStyle(5, 0x071426, 0.96);
  outline.strokePoints(points, true);
  outline.lineStyle(2, 0xffffff, 0.45);
  outline.strokePoints(points.map((point) => new Phaser.Geom.Point(
    point.x + (point.x < x ? 3 : -3),
    point.y + (point.y < y ? 3 : -3),
  )), true);

  const badgeRadius = cinematic ? Math.min(43, height * 0.27) : Math.min(48, height * 0.3);
  const badgeX = cinematic
    ? left + 65
    : left + bevel + badgeRadius + 18;
  const badgeObjects = createBadge(scene, {
    x: badgeX,
    y,
    radius: badgeRadius,
    icon,
    accent,
    depth: depth + 1,
  });

  const copyX = cinematic
    ? left + 132
    : badgeX + badgeRadius + 24;
  const effectiveTitleSize = cinematic ? Math.min(titleSize, 36) : titleSize;
  const titleY = cinematic ? top + 54 : y - height * 0.18;
  const subtitleY = cinematic ? top + 126 : y + height * 0.09;
  const metaY = cinematic ? bottom - 40 : y + height * 0.31;
  const copyWidth = cinematic ? right - copyX - 28 : undefined;
  const titleText = scene.add.text(copyX, titleY, title, {
    fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
    fontSize: `${effectiveTitleSize}px`,
    fontStyle: 'bold',
    color: '#ffffff',
    stroke: '#071426',
    strokeThickness: Math.max(4, effectiveTitleSize * 0.13),
    shadow: { color: '#071426', blur: 2, fill: true, offsetY: 3 },
  }).setOrigin(0, 0.5).setDepth(depth + 1.1);
  const subtitleText = scene.add.text(copyX, subtitleY, subtitle, {
    fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
    fontSize: `${cinematic ? 17 : Math.max(14, titleSize * 0.43)}px`,
    fontStyle: 'bold',
    color: cinematic ? '#ffffff' : '#d9f8ff',
    stroke: '#071426',
    strokeThickness: cinematic ? 2 : 3,
    ...(copyWidth ? { wordWrap: { width: copyWidth, useAdvancedWrap: true } } : {}),
  }).setOrigin(0, 0.5).setDepth(depth + 1.1);
  const metaText = scene.add.text(copyX, metaY, meta, {
    fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
    fontSize: `${cinematic ? 14 : Math.max(12, titleSize * 0.34)}px`,
    fontStyle: 'bold',
    color: '#ffdc72',
    stroke: '#071426',
    strokeThickness: cinematic ? 2 : 3,
    ...(copyWidth ? { wordWrap: { width: copyWidth, useAdvancedWrap: true } } : {}),
  }).setOrigin(0, 0.5).setDepth(depth + 1.1);

  const arrowX = cinematic ? right - 48 : right - bevel - 22;
  const arrowY = cinematic ? top + 54 : y;
  const arrow = scene.add.circle(arrowX, arrowY, Math.min(28, height * 0.18), 0x071426, 0.9)
    .setStrokeStyle(2, 0xffffff, 0.46)
    .setDepth(depth + 1.1);
  const arrowIcon = createControlIcon(scene, {
    x: arrowX + 1,
    y: arrowY,
    size: Math.min(28, height * 0.2),
    icon: 'right',
    depth: depth + 1.2,
    alpha: 0.92,
  });

  const zone = scene.add.zone(x, y, width, height)
    .setDepth(depth + 2)
    .setInteractive({ useHandCursor: true });
  bindButtonInput(scene, zone, {
    onOver: () => outline.setAlpha(1),
    onOut: () => outline.setAlpha(0.88),
    onPress: () => outline.setAlpha(0.68),
    onRelease: () => outline.setAlpha(1),
    onActivate: () => onPress?.(),
  });

  const objects = [
    shadow,
    artwork,
    shade,
    colorPanel,
    seam,
    ...(foreground ? [foreground] : []),
    outline,
    ...badgeObjects,
    titleText,
    subtitleText,
    metaText,
    arrow,
    arrowIcon,
    zone,
  ];

  return {
    objects,
    zone,
    setVisible: (visible) => objects.forEach((object) => object.setVisible(visible)),
    destroy: () => {
      objects.forEach((object) => object.destroy());
      mask.destroy();
      maskShape.destroy();
    },
  };
};
