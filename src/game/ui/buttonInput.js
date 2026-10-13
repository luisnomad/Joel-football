import { isTouchLayout } from '../input/isTouchLayout.js';

export const TOUCH_BUTTON_GUARD_MS = 500;
export const TOUCH_BUTTON_GUARD_RADIUS = 18;

const normalizeNumber = (value, fallback) => (
  Number.isFinite(value) ? value : fallback
);

export const createButtonActivationGate = () => {
  let recentActivations = [];

  return {
    tryActivate({
      now = globalThis.performance?.now?.() ?? Date.now(),
      x = 0,
      y = 0,
      guardMs = 0,
      radius = TOUCH_BUTTON_GUARD_RADIUS,
      source = 'mouse',
    } = {}) {
      const activationTime = normalizeNumber(now, Date.now());
      const activationX = normalizeNumber(x, 0);
      const activationY = normalizeNumber(y, 0);
      const safeGuardMs = Math.max(0, normalizeNumber(guardMs, 0));
      const safeRadius = Math.max(0, normalizeNumber(radius, TOUCH_BUTTON_GUARD_RADIUS));

      recentActivations = recentActivations.filter(({ expiresAt }) => expiresAt > activationTime);
      // A finger is always a deliberate press: only the emulated mouse press a
      // WebView sends after touchend can be a duplicate, so quick repeated taps
      // (menu arrows, answers) all register.
      const isCompatibilityPress = source !== 'touch' && recentActivations.some((activation) => (
        Math.hypot(activation.x - activationX, activation.y - activationY) <= safeRadius
      ));
      if (isCompatibilityPress) return false;

      if (safeGuardMs > 0) {
        recentActivations.push({
          x: activationX,
          y: activationY,
          expiresAt: activationTime + safeGuardMs,
        });
      }
      return true;
    },
  };
};

const activationGates = new WeakMap();

const getGameActivationGate = (game) => {
  let gate = activationGates.get(game);
  if (!gate) {
    gate = createButtonActivationGate();
    activationGates.set(game, gate);
  }
  return gate;
};

// Phaser marks pointers driven by touch events; the compatibility press arrives
// through the mouse pointer instead.
const getPointerSource = (pointer) => (pointer?.wasTouch === true ? 'touch' : 'mouse');

const getPointerPosition = (pointer, target) => ({
  x: normalizeNumber(pointer?.x, normalizeNumber(target?.x, 0)),
  y: normalizeNumber(pointer?.y, normalizeNumber(target?.y, 0)),
});

/**
 * Shared input contract for menu buttons and other one-shot pressables.
 *
 * A pointer-down reserves one accepted press. Components can activate on that
 * press when a WebView may cancel release, or use the conventional release
 * phase. On touch layouts, a game-wide spatial gate suppresses the
 * compatibility mouse press that some WebViews emit after touchend. Touch
 * presses are never suppressed, so rapid deliberate taps all register, and
 * controls at other positions remain immediately available.
 *
 * Gameplay holds, joysticks, and sliders should keep their own pointer
 * ownership and must not use this helper.
 */
export const bindButtonInput = (scene, target, {
  onActivate,
  onPress,
  onRelease,
  onOver,
  onOut,
  activateOnPointerDown = false,
  guardMs = isTouchLayout() ? TOUCH_BUTTON_GUARD_MS : 0,
  guardRadius = TOUCH_BUTTON_GUARD_RADIUS,
  haptic = 'light',
} = {}) => {
  const gate = getGameActivationGate(scene.game);
  const acceptedPresses = new Set();
  const getPointerKey = (pointer) => pointer?.id ?? 'primary';

  target.on('pointerover', (pointer) => onOver?.(pointer));
  target.on('pointerout', (pointer) => onOut?.(pointer));
  target.on('pointerdown', (pointer) => {
    const pointerKey = getPointerKey(pointer);
    const position = getPointerPosition(pointer, target);
    if (!gate.tryActivate({
      now: globalThis.performance?.now?.() ?? Date.now(),
      ...position,
      guardMs,
      radius: guardRadius,
      source: getPointerSource(pointer),
    })) {
      acceptedPresses.delete(pointerKey);
      return;
    }

    acceptedPresses.add(pointerKey);
    onPress?.(pointer);
    if (activateOnPointerDown) {
      if (haptic) scene.game.events.emit('platform:haptic', haptic);
      onActivate?.(pointer);
    }
  });
  target.on('pointerup', (pointer) => {
    const accepted = acceptedPresses.delete(getPointerKey(pointer));
    onRelease?.(pointer);
    if (!accepted || activateOnPointerDown) return;
    if (haptic) scene.game.events.emit('platform:haptic', haptic);
    onActivate?.(pointer);
  });
  target.on('pointerupoutside', (pointer) => {
    acceptedPresses.delete(getPointerKey(pointer));
    if (onOut) onOut(pointer);
    else onRelease?.(pointer);
  });

  return target;
};
