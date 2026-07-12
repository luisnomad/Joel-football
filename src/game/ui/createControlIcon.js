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
  dash: 'control-run',
});

export const createControlIcon = (scene, {
  x,
  y,
  size,
  icon,
  depth = 1,
  color = 0xffffff,
  alpha = 1,
}) => {
  const authoredTexture = AUTHORED_TEXTURES[icon];
  if (authoredTexture && scene.textures.exists(authoredTexture)) {
    return scene.add.image(x, y, authoredTexture)
      .setDisplaySize(size, size)
      .setTint(color)
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
  } else if (icon === 'dash') {
    graphics.fillTriangle(s * 0.42, 0, -s * 0.2, -s * 0.34, -s * 0.2, s * 0.34);
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
