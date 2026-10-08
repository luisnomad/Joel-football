import Phaser from 'phaser';

/** Texture key for a power's painted icon, when one has been loaded. */
export const powerIconTextureKey = (powerId) => `power-icon-${powerId}`;

/**
 * Draws a power's icon: the painted texture when `power-icon-<id>` is loaded,
 * otherwise the glyph fallback. Returns the display object.
 */
export const createPowerIcon = (scene, { x, y, power, size = 56, depth = 0 }) => {
  const key = powerIconTextureKey(power.id);
  if (scene.textures.exists(key)) {
    return scene.add.image(x, y, key).setDisplaySize(size, size).setDepth(depth);
  }
  return scene.add.text(x, y, power.icon, {
    fontFamily: 'Arial Rounded MT Bold, Trebuchet MS, sans-serif',
    fontSize: `${Math.round(size * 0.55)}px`,
    fontStyle: 'bold',
    color: '#ffffff',
  }).setOrigin(0.5).setDepth(depth);
};

/**
 * Correct-answer celebration: the earned power flies from the challenge to its
 * slot with a sparkle trail and pops there. A streak bonus adds a second token
 * and a "+1 BONUS" badge. Canvas-safe (colours are baked into fills, no tints).
 * Returns every created object so the caller can clean up on scene exit.
 */
export const playPowerRewardBurst = (scene, {
  fromX,
  fromY,
  toX,
  toY,
  power,
  bonus = false,
  bonusLabel = '+1 BONUS',
  depth = 260,
  onArrive = null,
}) => {
  const created = [];
  const tokens = bonus ? 2 : 1;
  for (let index = 0; index < tokens; index += 1) {
    const delay = index * 180;
    const disc = scene.add.circle(fromX, fromY, 34, power.color, 1)
      .setStrokeStyle(4, 0xffffff, 0.9)
      .setDepth(depth)
      .setScale(0.2);
    const glyph = createPowerIcon(scene, { x: fromX, y: fromY, power, size: 54, depth: depth + 0.1 }).setScale(0.2);
    created.push(disc, glyph);
    const path = { t: 0 };
    const lift = 140 + index * 40;
    scene.tweens.add({ targets: [disc, glyph], scale: 1, duration: 160, delay, ease: 'Back.Out' });
    scene.tweens.add({
      targets: path,
      t: 1,
      delay: delay + 140,
      duration: 620,
      ease: 'Sine.InOut',
      onUpdate: () => {
        const t = path.t;
        // Quadratic arc that rises above both ends.
        const cx = (fromX + toX) / 2;
        const cy = Math.min(fromY, toY) - lift;
        const x = (1 - t) ** 2 * fromX + 2 * (1 - t) * t * cx + t ** 2 * toX;
        const y = (1 - t) ** 2 * fromY + 2 * (1 - t) * t * cy + t ** 2 * toY;
        disc.setPosition(x, y).setScale(1 - t * 0.45);
        glyph.setPosition(x, y).setScale(1 - t * 0.45);
        if (Math.random() < 0.7) {
          const spark = scene.add.circle(
            x + Phaser.Math.Between(-14, 14),
            y + Phaser.Math.Between(-14, 14),
            Phaser.Math.Between(3, 6),
            Math.random() < 0.5 ? 0xffffff : power.color,
            1,
          ).setDepth(depth - 0.1);
          created.push(spark);
          scene.tweens.add({
            targets: spark,
            alpha: 0,
            scale: 0.2,
            y: spark.y + Phaser.Math.Between(10, 34),
            duration: 420,
            onComplete: () => spark.destroy(),
          });
        }
      },
      onComplete: () => {
        scene.tweens.add({
          targets: [disc, glyph],
          scale: 0.9,
          alpha: 0,
          duration: 260,
          onComplete: () => {
            disc.destroy();
            glyph.destroy();
          },
        });
        const ring = scene.add.circle(toX, toY, 20, 0xffffff, 0).setStrokeStyle(5, power.color, 1).setDepth(depth);
        created.push(ring);
        scene.tweens.add({
          targets: ring,
          scale: 3,
          alpha: 0,
          duration: 420,
          ease: 'Quad.Out',
          onComplete: () => ring.destroy(),
        });
        if (index === tokens - 1) onArrive?.();
      },
    });
  }
  if (bonus) {
    const badge = scene.add.text(toX, toY - 64, bonusLabel, {
      fontFamily: 'Arial Black, Arial Rounded MT Bold, sans-serif',
      fontSize: '30px',
      color: '#ffdc72',
      stroke: '#3a1f00',
      strokeThickness: 7,
    }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0).setScale(0.6);
    created.push(badge);
    scene.tweens.add({
      targets: badge,
      alpha: 1,
      scale: 1,
      y: toY - 92,
      delay: 900,
      duration: 260,
      ease: 'Back.Out',
      hold: 900,
      yoyo: false,
      onComplete: () => scene.tweens.add({ targets: badge, alpha: 0, duration: 400, delay: 700, onComplete: () => badge.destroy() }),
    });
  }
  return created;
};
