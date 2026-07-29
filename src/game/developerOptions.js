export const FOOTBALL_TOUCH_MOVEMENT_MODES = Object.freeze({
  ARROWS: 'arrows',
  JOYSTICK: 'joystick',
});

export const FOOTBALL_TOUCH_MOVEMENT_REGISTRY_KEY = 'developer:footballTouchMovementMode';

export const resolveFootballTouchMovementMode = (value) => (
  value === FOOTBALL_TOUCH_MOVEMENT_MODES.JOYSTICK
    ? FOOTBALL_TOUCH_MOVEMENT_MODES.JOYSTICK
    : FOOTBALL_TOUCH_MOVEMENT_MODES.ARROWS
);

export const DEFAULT_FOOTBALL_TOUCH_MOVEMENT_MODE = resolveFootballTouchMovementMode(
  import.meta.env?.VITE_FOOTBALL_TOUCH_MOVEMENT_MODE,
);

export const getFootballTouchMovementMode = (scene) => resolveFootballTouchMovementMode(
  scene?.game?.registry?.get?.(FOOTBALL_TOUCH_MOVEMENT_REGISTRY_KEY)
    ?? DEFAULT_FOOTBALL_TOUCH_MOVEMENT_MODE,
);
