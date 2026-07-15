import { isTouchLayout } from '../input/isTouchLayout.js';
import { createControlIcon } from './createControlIcon.js';
import { getWideStageUiScale } from '../layout/tabletStage.js';

const GLASS_TINT = 0xdaf7ff;
const GLASS_SHADOW = 0x04101e;

export class TouchControls {
  constructor(scene, input) {
    this.scene = scene;
    this.input = input;
    this.gameplayObjects = [];
    this.systemObjects = [];
    this.controlButtons = new Map();
    this.visible = isTouchLayout();
    if (!this.visible) return;
    this.gameplayYOffset = scene.stageLayout?.bottomOffset ?? 0;
    this.uiScale = getWideStageUiScale(scene.stageLayout);
    const horizontalOffset = Math.max(0, (scene.stageLayout?.width ?? 1280) - 1280) / 2;

    this.addSystemButton(52 + horizontalOffset, 54, 'pause', () => scene.togglePause(), 0x52d7e8);
    this.addSystemButton(118 + horizontalOffset, 54, 'restart', () => scene.scene.restart(), 0xffc857);
    this.addSystemButton(184 + horizontalOffset, 54, 'home', () => scene.abandonMatch(), 0xff8f70);
    this.addSystemButton(1228 + horizontalOffset, 54, 'fullscreen', () => {
      scene.game.registry.get('platformActions')?.toggleFullscreen();
    }, 0xc3a8ff);

    this.addHoldButton(80 + horizontalOffset, 630 + this.gameplayYOffset, 64, 'left', 'left');
    this.addHoldButton(260 + horizontalOffset, 630 + this.gameplayYOffset, 64, 'right', 'right');
    this.addPulseButton(930 + horizontalOffset, 500 + this.gameplayYOffset, 56, 'jump', 'jump', 0x2ac7d4);
    this.addPulseButton(1165 + horizontalOffset, 610 + this.gameplayYOffset, 68, 'kick', 'kick', 0xff5b78);
    this.addPulseButton(1035 + horizontalOffset, 610 + this.gameplayYOffset, 56, 'lob', 'lob', 0x39d9a0);
    this.addPulseButton(1195 + horizontalOffset, 475 + this.gameplayYOffset, 50, 'power', 'power', 0xffa62b);
  }

  createBase(x, y, radius, icon, accent = 0xffffff, group = 'gameplay') {
    radius *= this.uiScale;
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

    const isSystemControl = group === 'system';
    const symbol = createControlIcon(this.scene, {
      x,
      y,
      size: radius * (isSystemControl ? 0.72 : 0.7),
      icon,
      depth: depth + 1,
      alpha: isSystemControl ? 0.78 : 0.68,
    });

    const visualObjects = [shadow, accentGlow, surface, innerRim, highlight, glint, symbol];
    visualObjects.forEach((item) => item.setScrollFactor(0));
    const baseScales = visualObjects.map((item) => ({
      item,
      scaleX: item.scaleX,
      scaleY: item.scaleY,
    }));
    const baseSymbolDisplay = { width: symbol.displayWidth, height: symbol.displayHeight };
    let scaleFactor = 1;
    const objects = group === 'system' ? this.systemObjects : this.gameplayObjects;
    objects.push(...visualObjects);
    return {
      target: surface,
      setScale: (nextFactor) => {
        scaleFactor = nextFactor;
        baseScales.forEach(({ item, scaleX, scaleY }) => item.setScale(scaleX * nextFactor, scaleY * nextFactor));
      },
      diagnostics: () => ({
        scaleFactor,
        symbolScaleX: symbol.scaleX,
        symbolScaleY: symbol.scaleY,
        symbolWidth: symbol.displayWidth,
        symbolHeight: symbol.displayHeight,
        baseSymbolScaleX: baseScales.at(-1).scaleX,
        baseSymbolScaleY: baseScales.at(-1).scaleY,
        baseSymbolWidth: baseSymbolDisplay.width,
        baseSymbolHeight: baseSymbolDisplay.height,
      }),
    };
  }

  addSystemButton(x, y, icon, onPress, accent) {
    const button = this.createBase(x, y, 28, icon, accent, 'system');
    this.controlButtons.set(`system:${icon}`, button);
    button.target.setInteractive({ useHandCursor: true });
    button.target.on('pointerdown', () => button.setScale(0.9));
    button.target.on('pointerup', () => {
      button.setScale(1);
      this.scene.game.events.emit('platform:haptic', 'light');
      onPress();
    });
    button.target.on('pointerout', () => button.setScale(1));
  }

  addHoldButton(x, y, radius, icon, action, accent) {
    const button = this.createBase(x, y, radius, icon, accent);
    this.controlButtons.set(action, button);
    button.target.setInteractive({ useHandCursor: true });
    button.target.on('pointerdown', () => {
      button.setScale(0.92);
      this.scene.game.events.emit('platform:haptic', 'light');
      this.input.setTouch(action, true);
    });
    const release = () => {
      button.setScale(1);
      this.input.setTouch(action, false);
    };
    button.target.on('pointerup', release);
    button.target.on('pointerout', release);
  }

  addPulseButton(x, y, radius, icon, action, accent) {
    const button = this.createBase(x, y, radius, icon, accent);
    this.controlButtons.set(action, button);
    button.target.setInteractive({ useHandCursor: true });
    button.target.on('pointerdown', () => {
      button.setScale(0.9);
      this.scene.game.events.emit('platform:haptic', action === 'power' ? 'medium' : 'light');
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

  diagnostics() {
    return Object.fromEntries(
      [...this.controlButtons].map(([key, button]) => [key, button.diagnostics()]),
    );
  }
}
