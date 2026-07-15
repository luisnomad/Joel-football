const DIRECTION_BY_SECTOR = Object.freeze([
  'right',
  'down-right',
  'down',
  'down-left',
  'left',
  'up-left',
  'up',
  'up-right',
]);

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const resolveVirtualJoystickVector = ({
  dx = 0,
  dy = 0,
  radius = 1,
  deadZone = 0.24,
} = {}) => {
  const safeDx = Number(dx) || 0;
  const safeDy = Number(dy) || 0;
  const safeRadius = Math.max(1, Math.abs(Number(radius) || 0));
  const safeDeadZone = clamp(Number(deadZone) || 0, 0, 0.95);
  const distance = Math.hypot(safeDx, safeDy);
  const clampedDistance = Math.min(distance, safeRadius);
  const visualScale = distance > 0 ? clampedDistance / distance : 0;
  const thumbX = safeDx * visualScale;
  const thumbY = safeDy * visualScale;
  const angleRadians = Math.atan2(safeDy, safeDx);
  const active = distance > safeRadius * safeDeadZone;
  const sector = ((Math.round(angleRadians / (Math.PI / 4)) % 8) + 8) % 8;
  const direction = active ? DIRECTION_BY_SECTOR[sector] : 'neutral';

  return Object.freeze({
    active,
    direction,
    angle: angleRadians * (180 / Math.PI),
    force: clampedDistance / safeRadius,
    normalizedX: thumbX / safeRadius,
    normalizedY: thumbY / safeRadius,
    thumbX,
    thumbY,
    left: active && direction.includes('left'),
    right: active && direction.includes('right'),
    up: active && direction.includes('up'),
    down: active && direction.includes('down'),
  });
};
