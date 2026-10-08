import { bigGuyPopProgress, fighterStatusVisual } from '../pure/fighterStatusVisual.js';

const HALO_SIZE = 128;
const haloKey = (color) => `fx-status-halo-${color.toString(16).padStart(6, '0')}`;

/** Soft coloured glow baked per colour (the Canvas renderer ignores tints and preFX). */
const ensureHaloTexture = (scene, color) => {
  const key = haloKey(color);
  if (scene.textures.exists(key)) return key;
  const canvas = scene.textures.createCanvas(key, HALO_SIZE, HALO_SIZE);
  const context = canvas.getContext();
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  const gradient = context.createRadialGradient(HALO_SIZE / 2, HALO_SIZE / 2, 0, HALO_SIZE / 2, HALO_SIZE / 2, HALO_SIZE / 2);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.95)`);
  gradient.addColorStop(0.55, `rgba(${r}, ${g}, ${b}, 0.8)`);
  gradient.addColorStop(0.8, `rgba(${r}, ${g}, ${b}, 0.35)`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, HALO_SIZE, HALO_SIZE);
  canvas.refresh();
  return key;
};

/** Points along an elliptical arc, for strokePoints (Graphics has no ellipse arc). */
const ellipseArc = (x, y, rx, ry, from, to, steps = 14) => Array.from({ length: steps + 1 }, (_, index) => {
  const angle = from + ((to - from) * index) / steps;
  return { x: x + Math.cos(angle) * rx, y: y + Math.sin(angle) * ry };
});

/**
 * Visible power states for a fighter, drawn without tints: a coloured halo
 * behind the sprite (shield, hyper, Big Guy, armed power, chilena), an ice
 * block over a frozen fighter, a shield bubble, hyper speed lines and the Big
 * Guy growth pop.
 */
export class FighterStatusEffects {
  constructor(scene, { backDepth = 17.4, frontDepth = 18.6 } = {}) {
    this.scene = scene;
    this.halo = scene.add.image(0, 0, ensureHaloTexture(scene, 0xffffff)).setDepth(backDepth).setVisible(false);
    this.back = scene.add.graphics().setDepth(backDepth);
    this.front = scene.add.graphics().setDepth(frontDepth);
    this.state = fighterStatusVisual();
    this.popProgress = null;
  }

  render({ bounds, status, clock, velocityX = 0, facing = 1, popSeconds = Infinity }) {
    const visual = fighterStatusVisual(status);
    this.state = visual;
    this.popProgress = bigGuyPopProgress(popSeconds);
    this.back.clear();
    this.front.clear();
    const width = bounds.max.x - bounds.min.x;
    const height = bounds.max.y - bounds.min.y;
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerY = (bounds.min.y + bounds.max.y) / 2;
    const pulse = 0.5 + Math.sin(clock * 6) * 0.5;

    if (visual.haloColor !== null) {
      this.halo
        .setTexture(ensureHaloTexture(this.scene, visual.haloColor))
        .setPosition(centerX, centerY)
        .setDisplaySize(width * 2.4 + 56, height * 1.22 + 48)
        .setAlpha(0.5 + pulse * 0.25)
        .setVisible(true);
    } else {
      this.halo.setVisible(false);
    }

    if (visual.speedLines) {
      const direction = Math.abs(velocityX) > 20 ? -Math.sign(velocityX) : -facing;
      this.back.lineStyle(4, 0xd8ffcc, 0.85);
      for (let index = 0; index < 5; index += 1) {
        const lineY = bounds.min.y + height * (0.2 + index * 0.15);
        const phase = (clock * 3.2 + index * 0.37) % 1;
        const length = 26 + ((index * 17) % 30);
        const start = centerX + direction * (width / 2 + 8 + phase * 26);
        this.back.lineBetween(start, lineY, start + direction * length, lineY);
      }
    }

    if (visual.iceBlock) {
      const pad = 12;
      const left = bounds.min.x - pad;
      const top = bounds.min.y - pad;
      const blockWidth = width + pad * 2;
      const blockHeight = height + pad * 2;
      this.front.fillStyle(0xbff4ff, 0.36).fillRoundedRect(left, top, blockWidth, blockHeight, 10);
      this.front.lineStyle(3, 0xeafdff, 0.95).strokeRoundedRect(left, top, blockWidth, blockHeight, 10);
      this.front.lineStyle(2, 0xffffff, 0.55)
        .lineBetween(left + 8, top + blockHeight * 0.35, left + blockWidth * 0.4, top + 8)
        .lineBetween(left + blockWidth - 10, top + blockHeight * 0.55, left + blockWidth * 0.62, top + blockHeight - 10);
      this.front.lineStyle(5, 0xffffff, 0.75)
        .lineBetween(left + 10, top + 22, left + 10, top + 22 + blockHeight * 0.3);
    }

    if (visual.shieldBubble) {
      // Bubble sits slightly high so it does not dip far below the feet.
      const rx = width / 2 + 28;
      const ry = height / 2 + 16;
      const bubbleY = centerY - 6;
      this.front.fillStyle(0x6fe8ff, 0.14).fillEllipse(centerX, bubbleY, rx * 2, ry * 2);
      this.front.lineStyle(3, 0xbdf9ff, 0.6 + pulse * 0.35).strokeEllipse(centerX, bubbleY, rx * 2, ry * 2);
      this.front.lineStyle(4, 0xffffff, 0.7).strokePoints(ellipseArc(centerX, bubbleY, rx - 8, ry - 8, Math.PI * 1.08, Math.PI * 1.42));
    }

    if (this.popProgress !== null) {
      const eased = 1 - (1 - this.popProgress) ** 2;
      const alpha = 1 - this.popProgress;
      const radius = Math.max(width, height) * (0.4 + eased * 0.45);
      this.front.lineStyle(6 * alpha + 1, 0xffd56b, alpha).strokeCircle(centerX, centerY, radius);
      this.front.fillStyle(0xfff2b8, alpha);
      for (let index = 0; index < 8; index += 1) {
        const angle = (index * Math.PI) / 4;
        this.front.fillCircle(centerX + Math.cos(angle) * radius * 1.12, centerY + Math.sin(angle) * radius * 1.12, 5 * alpha + 1);
      }
    }
  }

  clear() {
    this.back.clear();
    this.front.clear();
    this.halo.setVisible(false);
    this.state = fighterStatusVisual();
    this.popProgress = null;
  }

  debugState() {
    return {
      halo: this.state.halo,
      haloVisible: this.halo.visible,
      iceBlock: this.state.iceBlock,
      shieldBubble: this.state.shieldBubble,
      speedLines: this.state.speedLines,
      bigGuyPop: this.popProgress !== null,
    };
  }

  destroy() {
    this.halo.destroy();
    this.back.destroy();
    this.front.destroy();
  }
}
