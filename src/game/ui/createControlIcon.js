import { bakeTintedTexture } from '../effects/bakedTint.js';

const drawBall = (graphics, x, y, radius) => {
  graphics.lineStyle(Math.max(2, radius * 0.12), 0xffffff, 0.95);
  graphics.strokeCircle(x, y, radius);
  graphics.fillStyle(0xffffff, 0.95).fillCircle(x, y, radius * 0.25);
  for (let index = 0; index < 5; index += 1) {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
    graphics.lineBetween(
      x + Math.cos(angle) * radius * 0.28,
      y + Math.sin(angle) * radius * 0.28,
      x + Math.cos(angle) * radius * 0.86,
      y + Math.sin(angle) * radius * 0.86,
    );
  }
};

const AUTHORED_TEXTURES = Object.freeze({
  jump: 'control-jump',
  kick: 'control-kick',
  lob: 'control-high-kick',
});

export const createControlIcon = (scene, {
  x,
  y,
  size,
  icon,
  depth = 1,
  color: requestedColor = 0xffffff,
  alpha = 1,
}) => {
  // Accept CSS hex strings too ('#b9cde5'), as some callers pass them.
  const parsed = typeof requestedColor === 'string'
    ? Number.parseInt(requestedColor.replace('#', ''), 16)
    : Number(requestedColor);
  const color = Number.isFinite(parsed) ? parsed : 0xffffff;
  const authoredTexture = AUTHORED_TEXTURES[icon];
  if (authoredTexture && scene.textures.exists(authoredTexture)) {
    // Canvas ignores setTint: colour the authored art by baking a copy.
    const texture = (color & 0xffffff) === 0xffffff
      ? authoredTexture
      : bakeTintedTexture(scene, authoredTexture, color, { mode: 'multiply' });
    return scene.add.image(x, y, texture)
      .setDisplaySize(size, size)
      .setAlpha(alpha)
      .setDepth(depth);
  }

  const graphics = scene.add.graphics({ x, y }).setDepth(depth);
  const s = size;
  graphics.fillStyle(color, 1);
  graphics.lineStyle(Math.max(2, s * 0.075), color, 1);

  if (icon === 'left' || icon === 'right') {
    const direction = icon === 'right' ? 1 : -1;
    graphics.fillTriangle(direction * s * 0.42, 0, direction * -s * 0.22, -s * 0.34, direction * -s * 0.22, s * 0.34);
  } else if (icon === 'up' || icon === 'down') {
    const direction = icon === 'down' ? 1 : -1;
    graphics.fillTriangle(0, direction * s * 0.42, -s * 0.34, direction * -s * 0.22, s * 0.34, direction * -s * 0.22);
  } else if (icon === 'jump') {
    graphics.fillCircle(0, -s * 0.3, s * 0.1);
    graphics.lineBetween(0, -s * 0.18, 0, s * 0.12);
    graphics.lineBetween(0, -s * 0.08, -s * 0.25, s * 0.02);
    graphics.lineBetween(0, -s * 0.08, s * 0.25, s * 0.02);
    graphics.lineBetween(0, s * 0.1, -s * 0.22, s * 0.34);
    graphics.lineBetween(0, s * 0.1, s * 0.22, s * 0.34);
    graphics.lineStyle(Math.max(2, s * 0.055), color, 0.52);
    graphics.lineBetween(-s * 0.34, -s * 0.42, 0, -s * 0.58);
    graphics.lineBetween(0, -s * 0.58, s * 0.34, -s * 0.42);
  } else if (icon === 'kick') {
    drawBall(graphics, s * 0.27, s * 0.12, s * 0.23);
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(-s * 0.46, s * 0.02, s * 0.48, s * 0.22, s * 0.07);
    graphics.fillTriangle(-s * 0.05, s * 0.02, s * 0.13, -s * 0.24, s * 0.18, s * 0.08);
  } else if (icon === 'lob') {
    drawBall(graphics, -s * 0.28, s * 0.24, s * 0.18);
    let previous = { x: -s * 0.18, y: s * 0.02 };
    for (let step = 1; step <= 8; step += 1) {
      const ratio = step / 8;
      const inverse = 1 - ratio;
      const next = {
        x: inverse * inverse * (-s * 0.18) + 2 * inverse * ratio * (s * 0.02) + ratio * ratio * (s * 0.43),
        y: inverse * inverse * (s * 0.02) + 2 * inverse * ratio * (-s * 0.48) + ratio * ratio * (-s * 0.2),
      };
      graphics.lineBetween(previous.x, previous.y, next.x, next.y);
      previous = next;
    }
    graphics.fillStyle(color, 1).fillTriangle(s * 0.46, -s * 0.18, s * 0.24, -s * 0.18, s * 0.39, s * 0.01);
  } else if (icon === 'power') {
    graphics.lineStyle(Math.max(2, s * 0.055), color, 0.55).strokeCircle(0, 0, s * 0.43);
    graphics.fillStyle(color, 1).fillPoints([
      { x: s * 0.08, y: -s * 0.46 },
      { x: -s * 0.22, y: s * 0.02 },
      { x: -s * 0.02, y: s * 0.02 },
      { x: -s * 0.12, y: s * 0.44 },
      { x: s * 0.28, y: -s * 0.1 },
      { x: s * 0.05, y: -s * 0.1 },
    ], true);
  } else if (icon === 'football') {
    graphics.lineStyle(Math.max(2, s * 0.07), color, 0.98);
    graphics.strokeCircle(0, 0, s * 0.39);
    graphics.fillStyle(color, 1).fillPoints([
      { x: 0, y: -s * 0.16 },
      { x: s * 0.15, y: -s * 0.05 },
      { x: s * 0.09, y: s * 0.14 },
      { x: -s * 0.09, y: s * 0.14 },
      { x: -s * 0.15, y: -s * 0.05 },
    ], true);
    for (let index = 0; index < 5; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
      graphics.lineBetween(
        Math.cos(angle) * s * 0.17,
        Math.sin(angle) * s * 0.17,
        Math.cos(angle) * s * 0.37,
        Math.sin(angle) * s * 0.37,
      );
    }
  } else if (icon === 'minigames') {
    graphics.fillRoundedRect(-s * 0.42, s * 0.04, s * 0.84, s * 0.28, s * 0.08);
    graphics.fillRoundedRect(-s * 0.07, -s * 0.24, s * 0.14, s * 0.35, s * 0.06);
    graphics.fillCircle(0, -s * 0.31, s * 0.15);
    graphics.fillCircle(s * 0.23, s * 0.17, s * 0.055);
    graphics.lineStyle(Math.max(2, s * 0.065), color, 1);
    graphics.lineBetween(-s * 0.28, s * 0.17, -s * 0.12, s * 0.17);
    graphics.lineBetween(-s * 0.2, s * 0.09, -s * 0.2, s * 0.25);
  } else if (icon === 'kickfall') {
    drawBall(graphics, 0, -s * 0.16, s * 0.21);
    graphics.lineStyle(Math.max(2, s * 0.055), color, 0.72);
    graphics.lineBetween(-s * 0.3, -s * 0.05, -s * 0.16, s * 0.23);
    graphics.lineBetween(0, s * 0.09, 0, s * 0.39);
    graphics.lineBetween(s * 0.3, -s * 0.05, s * 0.16, s * 0.23);
    graphics.fillTriangle(-s * 0.1, s * 0.29, s * 0.1, s * 0.29, 0, s * 0.45);
  } else if (icon === 'settings') {
    graphics.lineStyle(Math.max(2, s * 0.085), color, 1);
    graphics.strokeCircle(0, 0, s * 0.22);
    graphics.strokeCircle(0, 0, s * 0.42);
    for (let index = 0; index < 8; index += 1) {
      const angle = index * Math.PI / 4;
      graphics.lineBetween(
        Math.cos(angle) * s * 0.39,
        Math.sin(angle) * s * 0.39,
        Math.cos(angle) * s * 0.5,
        Math.sin(angle) * s * 0.5,
      );
    }
  } else if (icon === 'pause') {
    graphics.fillRoundedRect(-s * 0.28, -s * 0.38, s * 0.18, s * 0.76, s * 0.04);
    graphics.fillRoundedRect(s * 0.1, -s * 0.38, s * 0.18, s * 0.76, s * 0.04);
  } else if (icon === 'restart') {
    graphics.beginPath();
    graphics.arc(0, 0, s * 0.34, Math.PI * 0.02, Math.PI * 1.63, false);
    graphics.strokePath();
    graphics.fillTriangle(-s * 0.42, -s * 0.2, -s * 0.08, -s * 0.26, -s * 0.25, s * 0.03);
  } else if (icon === 'home') {
    graphics.beginPath();
    graphics.moveTo(-s * 0.42, -s * 0.02);
    graphics.lineTo(0, -s * 0.4);
    graphics.lineTo(s * 0.42, -s * 0.02);
    graphics.strokePath();
    graphics.strokeRoundedRect(-s * 0.3, -s * 0.02, s * 0.6, s * 0.4, s * 0.05);
  } else if (icon === 'fullscreen') {
    const a = s * 0.38;
    const b = s * 0.12;
    graphics.lineBetween(-a, -b, -a, -a); graphics.lineBetween(-a, -a, -b, -a);
    graphics.lineBetween(a, -b, a, -a); graphics.lineBetween(a, -a, b, -a);
    graphics.lineBetween(-a, b, -a, a); graphics.lineBetween(-a, a, -b, a);
    graphics.lineBetween(a, b, a, a); graphics.lineBetween(a, a, b, a);
  } else {
    graphics.destroy();
    return scene.add.text(x, y, icon === 'info' ? 'i' : '?', {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: `${s * 0.92}px`,
      fontStyle: 'bold',
      color: '#ffffff',
    }).setOrigin(0.5).setDepth(depth).setAlpha(alpha).setShadow(0, 2, '#071426', 3, true, true);
  }

  return graphics.setAlpha(alpha);
};
