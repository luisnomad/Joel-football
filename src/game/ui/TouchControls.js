import { isTouchLayout } from '../input/isTouchLayout.js';

const GLASS_TINT = 0xdaf7ff;
const GLASS_SHADOW = 0x04101e;

export class TouchControls {
  constructor(scene, input) {
    this.scene = scene;
    this.input = input;
    this.gameplayObjects = [];
    this.systemObjects = [];
    this.visible = isTouchLayout();
    if (!this.visible) return;

    this.addSystemButton(52, 54, 'Ⅱ', () => scene.togglePause(), 0x52d7e8);
    this.addSystemButton(118, 54, '↻', () => scene.scene.restart(), 0xffc857);
    this.addSystemButton(184, 54, '⌂', () => scene.abandonMatch(), 0xff8f70);
    this.addSystemButton(1228, 54, '⛶', () => {
      if (scene.scale.isFullscreen) scene.scale.stopFullscreen();
      else scene.scale.startFullscreen();
    }, 0xc3a8ff);

    this.addHoldButton(98, 630, 64, '◀', 'left');
    this.addHoldButton(238, 630, 64, '▶', 'right');
    this.addPulseButton(1020, 630, 60, '↑', 'jump', 0x2ac7d4);
    this.addPulseButton(1165, 610, 68, 'K', 'kick', 0xff5b78);
    this.addPulseButton(1110, 505, 50, 'D', 'dash', 0x8a66ff);
    this.addPulseButton(1010, 505, 50, 'L', 'lob', 0x39d9a0);
    this.addPulseButton(1210, 485, 50, 'P', 'power', 0xffa62b);
  }

  createBase(x, y, radius, label, accent = 0xffffff, group = 'gameplay') {
    const depth = group === 'system' ? 94 : 80;
    const shadow = this.scene.add.circle(x, y + Math.max(3, radius * 0.06), radius + 2, GLASS_SHADOW, 0.12).setDepth(depth);
    const accentGlow = this.scene.add.circle(x, y, radius + 2, accent, 0.025).setDepth(depth + 0.1);
    accentGlow.setStrokeStyle(Math.max(1.5, radius * 0.035), accent, 0.16);

    const surface = this.scene.add.circle(x, y, radius, GLASS_TINT, group === 'system' ? 0.13 : 0.085).setDepth(depth + 0.2);
    surface.setStrokeStyle(Math.max(1.25, radius * 0.022), 0xf4fdff, 0.44);

    const innerRim = this.scene.add.circle(x, y, radius - Math.max(4, radius * 0.08), 0x9eeaff, 0.018).setDepth(depth + 0.3);
    innerRim.setStrokeStyle(Math.max(0.75, radius * 0.012), 0xbdefff, 0.12);

    const highlight = this.scene.add.graphics({ x, y }).setDepth(depth + 0.4);
    highlight.lineStyle(Math.max(1.25, radius * 0.03), 0xffffff, 0.32);
    highlight.beginPath();
    highlight.arc(0, 0, radius - Math.max(5, radius * 0.1), Math.PI * 1.08, Math.PI * 1.72, false);
    highlight.strokePath();

    const glint = this.scene.add.circle(
      x - radius * 0.42,
      y - radius * 0.48,
      Math.max(1.5, radius * 0.035),
      0xffffff,
      0.5,
    ).setDepth(depth + 0.5);

    const text = this.scene.add.text(x, y, label, {
      fontFamily: 'Arial Rounded MT Bold, sans-serif',
      fontSize: `${radius * 0.75}px`,
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(depth + 1).setShadow(0, 2, '#071426', 4, true, true);

    const visualObjects = [shadow, accentGlow, surface, innerRim, highlight, glint, text];
    visualObjects.forEach((item) => item.setScrollFactor(0));
    const objects = group === 'system' ? this.systemObjects : this.gameplayObjects;
    objects.push(...visualObjects);
    return {
      target: surface,
      setScale: (scale) => visualObjects.forEach((item) => item.setScale(scale)),
    };
  }

  addSystemButton(x, y, label, onPress, accent) {
    const button = this.createBase(x, y, 28, label, accent, 'system');
    button.target.setInteractive({ useHandCursor: true });
    button.target.on('pointerdown', () => button.setScale(0.9));
    button.target.on('pointerup', () => {
      button.setScale(1);
      onPress();
    });
    button.target.on('pointerout', () => button.setScale(1));
  }

  addHoldButton(x, y, radius, label, action, accent) {
    const button = this.createBase(x, y, radius, label, accent);
    button.target.setInteractive({ useHandCursor: true });
    button.target.on('pointerdown', () => {
      button.setScale(0.92);
      this.input.setTouch(action, true);
    });
    const release = () => {
      button.setScale(1);
      this.input.setTouch(action, false);
    };
    button.target.on('pointerup', release);
    button.target.on('pointerout', release);
  }

  addPulseButton(x, y, radius, label, action, accent) {
    const button = this.createBase(x, y, radius, label, accent);
    button.target.setInteractive({ useHandCursor: true });
    button.target.on('pointerdown', () => {
      button.setScale(0.9);
      this.input.setTouch(action, true);
    });
    button.target.on('pointerup', () => button.setScale(1));
    button.target.on('pointerout', () => button.setScale(1));
  }

  setVisible(visible) {
    [...this.gameplayObjects, ...this.systemObjects].forEach((item) => item.setVisible(visible && this.visible));
  }

  setGameplayVisible(visible) {
    this.gameplayObjects.forEach((item) => item.setVisible(visible && this.visible));
  }
}
