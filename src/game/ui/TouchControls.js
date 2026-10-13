import { isTouchLayout } from '../input/isTouchLayout.js';
import { VirtualJoystick } from '../input/VirtualJoystick.js';
import { createControlIcon } from './createControlIcon.js';
import { getWideStageUiScale } from '../layout/tabletStage.js';
import { usesCompactPhoneUi } from '../layout/tabletStage.js';
import {
  FOOTBALL_TOUCH_MOVEMENT_MODES,
  getFootballTouchMovementMode,
} from '../developerOptions.js';

const GLASS_TINT = 0xdaf7ff;
const GLASS_SHADOW = 0x04101e;
// System buttons (pause, restart, home, fullscreen) sit over the bright sky, so
// they get a solid dark backing with an accent ring instead of faint glass.
const SYSTEM_BACKING = 0x0b1a30;
const FOOTBALL_JOYSTICK_BASE_RADIUS = 114;
const JOYSTICK_EDGE_GUTTER = 64;
// Phones need a deliberately larger, higher-contrast top row. Keep the tablet
// radius at 28 below so the proven tablet layout remains unchanged while
// ordinary 16:9 and wide-phone targets gain exactly ten percent over 36px.
export const FOOTBALL_SYSTEM_CONTROL_RADIUS = 39.6;
export const FOOTBALL_JOYSTICK_SPRINT_THRESHOLD = 0.82;
export const FOOTBALL_TOUCH_LAYOUT = Object.freeze({
  left: Object.freeze({ x: 98, y: 630, radius: 64 }),
  right: Object.freeze({ x: 238, y: 630, radius: 64 }),
  jump: Object.freeze({ x: 1020, y: 630, radius: 60 }),
  lob: Object.freeze({ x: 1195, y: 475, radius: 56 }),
  power: Object.freeze({ x: 930, y: 500, radius: 50 }),
});
/**
 * On the 1280x800 tablet stage the decorative band below the pitch has an empty
 * hexagon frame at its centre; the power button docks there (off the pitch) with
 * the player's meter as a ring around it. Stage coordinates (the band is below
 * the 720 px gameplay area).
 */
export const FOOTBALL_POWER_DOCK = Object.freeze({ x: 640, y: 718, radius: 40, ringRadius: 47 });

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
    const stageWidth = scene.stageLayout?.width ?? 1280;
    const horizontalOverflow = Math.max(0, stageWidth - 1280);
    this.compactPhoneUi = usesCompactPhoneUi(scene);
    this.widePhoneUi = stageWidth >= 1280 + 24;

    const systemX = this.compactPhoneUi ? [48, 132, 216] : [52, 118, 184];
    this.addSystemButton(systemX[0], 54, 'pause', () => scene.togglePause(), 0x52d7e8);
    this.addSystemButton(systemX[1], 54, 'restart', () => scene.requestRestart(), 0xffc857);
    this.addSystemButton(systemX[2], 54, 'home', () => scene.abandonMatch(), 0xff8f70);
    this.addSystemButton(1228 + horizontalOverflow, 54, 'fullscreen', () => {
      scene.game.registry.get('platformActions')?.toggleFullscreen();
    }, 0xc3a8ff);

    if (this.movementMode === FOOTBALL_TOUCH_MOVEMENT_MODES.JOYSTICK) {
      const joystickRadius = FOOTBALL_JOYSTICK_BASE_RADIUS * this.uiScale;
      this.joystickState = { boosted: false };
      this.movementJoystick = new VirtualJoystick(scene, {
        x: joystickRadius + JOYSTICK_EDGE_GUTTER,
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
      const left = this.compactPhoneUi ? { ...FOOTBALL_TOUCH_LAYOUT.left, x: 90 } : FOOTBALL_TOUCH_LAYOUT.left;
      const right = this.compactPhoneUi ? { ...FOOTBALL_TOUCH_LAYOUT.right, x: 250 } : FOOTBALL_TOUCH_LAYOUT.right;
      this.addHoldButton(
        left.x,
        left.y + this.gameplayYOffset,
        left.radius,
        'left',
        'left',
        0x50d8ef,
      );
      this.addHoldButton(
        right.x,
        right.y + this.gameplayYOffset,
        right.radius,
        'right',
        'right',
        0x50d8ef,
      );
    }
    const { jump, lob, power } = FOOTBALL_TOUCH_LAYOUT;
    // The band exists only on the tall tablet stage (80 extra logical px below
    // the pitch); long tablets and phones keep the power button where it was.
    this.powerDocked = !this.compactPhoneUi && !this.widePhoneUi && this.gameplayYOffset >= 60;
    this.addPulseButton(
      jump.x + horizontalOverflow,
      jump.y + this.gameplayYOffset,
      jump.radius,
      'jump',
      'jump',
      0x2ac7d4,
      { emphasized: true },
    );
    this.addPulseButton(1165 + horizontalOverflow, 610 + this.gameplayYOffset, 68, 'kick', 'kick', 0xff5b78);
    this.addPulseButton(
      lob.x + horizontalOverflow,
      lob.y + this.gameplayYOffset,
      lob.radius,
      'lob',
      'lob',
      0x39d9a0,
    );
    if (this.powerDocked) {
      this.addPulseButton(
        FOOTBALL_POWER_DOCK.x,
        FOOTBALL_POWER_DOCK.y,
        FOOTBALL_POWER_DOCK.radius,
        'power',
        'power',
        0xffa62b,
        { emphasized: true, solid: true },
      );
      this.powerRing = this.scene.add.graphics().setDepth(80.6).setScrollFactor(0);
      this.gameplayObjects.push(this.powerRing);
      this.setPowerMeter(0);
    } else {
      this.addPulseButton(
        power.x + horizontalOverflow,
        power.y + this.gameplayYOffset,
        power.radius,
        'power',
        'power',
        0xffa62b,
      );
    }
  }

  /**
   * Meter ring around the docked power button (tablet). `ratio` 0..1; at 1 the
   * ring turns gold and pulses with `clockSeconds`. No-op when not docked.
   */
  setPowerMeter(ratio = 0, clockSeconds = 0) {
    if (!this.powerRing) return;
    const value = Math.min(1, Math.max(0, Number(ratio) || 0));
    const ready = value >= 1;
    const { x, y, ringRadius } = FOOTBALL_POWER_DOCK;
    const ring = this.powerRing;
    ring.clear();
    ring.lineStyle(8, 0x071426, 0.82).strokeCircle(x, y, ringRadius);
    if (value > 0) {
      ring.lineStyle(6, ready ? 0xffd94f : 0xffa62b, 1);
      ring.beginPath();
      ring.arc(x, y, ringRadius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * value, false);
      ring.strokePath();
    }
    if (ready) {
      const pulse = 0.35 + 0.3 * (0.5 + 0.5 * Math.sin(clockSeconds * 7));
      ring.lineStyle(4, 0xfff1a8, pulse).strokeCircle(x, y, ringRadius + 6);
    }
    this.powerMeterState = { ratio: value, ready };
  }

  createBase(x, y, radius, icon, accent = 0xffffff, group = 'gameplay', {
    emphasized = false,
    solid = false,
  } = {}) {
    const authoredRadius = radius;
    radius *= this.uiScale;
    const depth = group === 'system' ? 94 : 80;
    const highContrastSystem = group === 'system' && this.compactPhoneUi;
    const shadow = this.scene.add.circle(
      x,
      y + Math.max(3, radius * 0.06),
      radius + 2,
      GLASS_SHADOW,
      highContrastSystem ? 0.24 : 0.12,
    ).setDepth(depth);
    const accentGlow = this.scene.add.circle(
      x,
      y,
      radius + 2,
      accent,
      highContrastSystem ? 0.08 : emphasized ? 0.06 : 0.025,
    ).setDepth(depth + 0.1);
    accentGlow.setStrokeStyle(
      Math.max(1.5, radius * 0.035),
      accent,
      highContrastSystem ? 0.42 : emphasized ? 0.32 : 0.16,
    );

    // Solid: dark backing + accent ring (system buttons, and the docked power
    // button, which sits on the busy band art rather than the pitch).
    const isSystem = group === 'system' || solid;
    // Phones draw these controls at roughly half size over a busy pitch: a more
    // opaque glass and rim keep them findable (tablet values are unchanged).
    const phoneGameplay = !isSystem && this.compactPhoneUi;
    const surface = this.scene.add.circle(
      x,
      y,
      radius,
      isSystem ? SYSTEM_BACKING : GLASS_TINT,
      isSystem ? 0.88 : phoneGameplay ? emphasized ? 0.44 : 0.2 : emphasized ? 0.18 : 0.085,
    ).setDepth(depth + 0.2);
    surface.setStrokeStyle(
      Math.max(isSystem ? 2 : phoneGameplay ? 2 : 1.25, radius * (isSystem ? 0.06 : phoneGameplay ? 0.035 : 0.022)),
      isSystem ? accent : 0xf4fdff,
      isSystem ? 0.9 : phoneGameplay ? 0.78 : emphasized ? 0.62 : 0.44,
    );

    const innerRim = this.scene.add.circle(
      x,
      y,
      radius - Math.max(4, radius * 0.08),
      0x9eeaff,
      highContrastSystem ? 0.05 : emphasized ? 0.035 : 0.018,
    ).setDepth(depth + 0.3);
    innerRim.setStrokeStyle(
      Math.max(0.75, radius * 0.012),
      0xbdefff,
      highContrastSystem ? 0.36 : emphasized ? 0.24 : 0.12,
    );

    const highlight = this.scene.add.graphics({ x, y }).setDepth(depth + 0.4);
    highlight.lineStyle(
      Math.max(1.25, radius * 0.03),
      0xffffff,
      highContrastSystem ? 0.62 : emphasized ? 0.48 : 0.32,
    );
    highlight.beginPath();
    highlight.arc(0, 0, radius - Math.max(5, radius * 0.1), Math.PI * 1.08, Math.PI * 1.72, false);
    highlight.strokePath();

    const glint = this.scene.add.circle(
      x - radius * 0.42,
      y - radius * 0.48,
      Math.max(1.5, radius * 0.035),
      0xffffff,
      highContrastSystem ? 0.82 : emphasized ? 0.7 : 0.5,
    ).setDepth(depth + 0.5);

    const isSystemControl = group === 'system';
    const symbol = createControlIcon(this.scene, {
      x,
      y,
      size: radius * (isSystemControl ? highContrastSystem ? 0.76 : 0.72 : 0.7),
      icon,
      depth: depth + 1,
      alpha: isSystemControl || solid ? 1 : phoneGameplay ? emphasized ? 1 : 0.92 : emphasized ? 0.88 : 0.68,
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
    const radius = this.compactPhoneUi ? FOOTBALL_SYSTEM_CONTROL_RADIUS : 28;
    const button = this.createBase(x, y, radius, icon, accent, 'system');
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
      powerDocked: Boolean(this.powerDocked),
      powerMeter: this.powerMeterState ?? null,
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
