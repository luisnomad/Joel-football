import { isTouchLayout } from '../input/isTouchLayout.js';
import { VirtualJoystick } from '../input/VirtualJoystick.js';
import { createControlIcon } from './createControlIcon.js';
import { getWideStageUiScale } from '../layout/tabletStage.js';
import {
  FOOTBALL_TOUCH_MOVEMENT_MODES,
  getFootballTouchMovementMode,
} from '../developerOptions.js';

const GLASS_TINT = 0xdaf7ff;
const GLASS_SHADOW = 0x04101e;
const FOOTBALL_JOYSTICK_BASE_RADIUS = 114;
const JOYSTICK_EDGE_GUTTER = 64;
export const FOOTBALL_JOYSTICK_SPRINT_THRESHOLD = 0.82;
export const FOOTBALL_TOUCH_LAYOUT = Object.freeze({
  left: Object.freeze({ x: 98, y: 630, radius: 64 }),
  right: Object.freeze({ x: 238, y: 630, radius: 64 }),
  jump: Object.freeze({ x: 1020, y: 630, radius: 60 }),
  lob: Object.freeze({ x: 1195, y: 475, radius: 56 }),
  power: Object.freeze({ x: 930, y: 500, radius: 50 }),
});

export class TouchControls {
  constructor(scene, input) {
    this.scene = scene;
    this.input = input;
    this.gameplayObjects = [];
    this.systemObjects = [];
    this.controlButtons = new Map();
    this.movementMode = getFootballTouchMovementMode(scene);
    this.movementJoystick = null;
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

    if (this.movementMode === FOOTBALL_TOUCH_MOVEMENT_MODES.JOYSTICK) {
      const joystickRadius = FOOTBALL_JOYSTICK_BASE_RADIUS * this.uiScale;
      this.joystickState = { boosted: false };
      this.movementJoystick = new VirtualJoystick(scene, {
        x: horizontalOffset + joystickRadius + JOYSTICK_EDGE_GUTTER,
        y: 720 + this.gameplayYOffset - joystickRadius - 8,
        radius: joystickRadius,
        thumbRadius: joystickRadius * 0.4,
        interactionRadius: joystickRadius * 1.42,
        deadZone: 0.24,
        axis: 'horizontal',
        boostThreshold: FOOTBALL_JOYSTICK_SPRINT_THRESHOLD,
        accent: 0x50d8ef,
        depth: 80,
        onChange: ({ active, normalizedX, boosted }) => {
          if (boosted && !this.joystickState.boosted) {
            this.scene.game.events.emit('platform:haptic', 'medium');
          }
          this.input.setTouchMovement(active ? normalizedX : 0, { active, boosted });
          this.joystickState = { boosted };
        },
      });
    } else {
      const { left, right } = FOOTBALL_TOUCH_LAYOUT;
      this.addHoldButton(
        left.x + horizontalOffset,
        left.y + this.gameplayYOffset,
        left.radius,
        'left',
        'left',
        0x50d8ef,
      );
      this.addHoldButton(
        right.x + horizontalOffset,
        right.y + this.gameplayYOffset,
        right.radius,
        'right',
        'right',
        0x50d8ef,
      );
    }
    const { jump, lob, power } = FOOTBALL_TOUCH_LAYOUT;
    this.addPulseButton(
      jump.x + horizontalOffset,
      jump.y + this.gameplayYOffset,
      jump.radius,
      'jump',
      'jump',
      0x2ac7d4,
      { emphasized: true },
    );
    this.addPulseButton(1165 + horizontalOffset, 610 + this.gameplayYOffset, 68, 'kick', 'kick', 0xff5b78);
    this.addPulseButton(
      lob.x + horizontalOffset,
      lob.y + this.gameplayYOffset,
      lob.radius,
      'lob',
      'lob',
      0x39d9a0,
    );
    this.addPulseButton(
      power.x + horizontalOffset,
      power.y + this.gameplayYOffset,
      power.radius,
      'power',
      'power',
      0xffa62b,
    );
  }

  createBase(x, y, radius, icon, accent = 0xffffff, group = 'gameplay', {
    emphasized = false,
  } = {}) {
    const authoredRadius = radius;
    radius *= this.uiScale;
    const depth = group === 'system' ? 94 : 80;
    const shadow = this.scene.add.circle(x, y + Math.max(3, radius * 0.06), radius + 2, GLASS_SHADOW, 0.12).setDepth(depth);
    const accentGlow = this.scene.add.circle(
      x,
      y,
      radius + 2,
      accent,
      emphasized ? 0.06 : 0.025,
    ).setDepth(depth + 0.1);
    accentGlow.setStrokeStyle(
      Math.max(1.5, radius * 0.035),
      accent,
      emphasized ? 0.32 : 0.16,
    );

    const surface = this.scene.add.circle(
      x,
      y,
      radius,
      GLASS_TINT,
      group === 'system' ? 0.13 : emphasized ? 0.18 : 0.085,
    ).setDepth(depth + 0.2);
    surface.setStrokeStyle(
      Math.max(1.25, radius * 0.022),
      0xf4fdff,
      emphasized ? 0.62 : 0.44,
    );

    const innerRim = this.scene.add.circle(
      x,
      y,
      radius - Math.max(4, radius * 0.08),
      0x9eeaff,
      emphasized ? 0.035 : 0.018,
    ).setDepth(depth + 0.3);
    innerRim.setStrokeStyle(
      Math.max(0.75, radius * 0.012),
      0xbdefff,
      emphasized ? 0.24 : 0.12,
    );

    const highlight = this.scene.add.graphics({ x, y }).setDepth(depth + 0.4);
    highlight.lineStyle(
      Math.max(1.25, radius * 0.03),
      0xffffff,
      emphasized ? 0.48 : 0.32,
    );
    highlight.beginPath();
    highlight.arc(0, 0, radius - Math.max(5, radius * 0.1), Math.PI * 1.08, Math.PI * 1.72, false);
    highlight.strokePath();

    const glint = this.scene.add.circle(
      x - radius * 0.42,
      y - radius * 0.48,
      Math.max(1.5, radius * 0.035),
      0xffffff,
      emphasized ? 0.7 : 0.5,
    ).setDepth(depth + 0.5);

    const isSystemControl = group === 'system';
    const symbol = createControlIcon(this.scene, {
      x,
      y,
      size: radius * (isSystemControl ? 0.72 : 0.7),
      icon,
      depth: depth + 1,
      alpha: isSystemControl ? 0.78 : emphasized ? 0.88 : 0.68,
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
        x,
        y,
        radius,
        authoredRadius,
        scaleFactor,
        emphasized,
        surfaceFillAlpha: surface.fillAlpha,
        accentFillAlpha: accentGlow.fillAlpha,
        symbolAlpha: symbol.alpha,
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

  addPulseButton(x, y, radius, icon, action, accent, visualOptions) {
    const button = this.createBase(x, y, radius, icon, accent, 'gameplay', visualOptions);
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
    this.movementJoystick?.setVisible(visible && this.visible);
  }

  setGameplayVisible(visible) {
    this.gameplayObjects.forEach((item) => item.setVisible(visible && this.visible));
    this.movementJoystick?.setVisible(visible && this.visible);
  }

  diagnostics() {
    return {
      movementMode: this.movementMode,
      joystick: this.movementJoystick?.diagnostics?.() ?? null,
      ...Object.fromEntries(
      [...this.controlButtons].map(([key, button]) => [key, button.diagnostics()]),
      ),
    };
  }

  destroy() {
    this.movementJoystick?.destroy();
    this.movementJoystick = null;
  }
}
