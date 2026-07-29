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
  axis = 'both',
  boostThreshold = null,
} = {}) => {
  const safeDx = Number(dx) || 0;
  const safeDy = Number(dy) || 0;
  const safeRadius = Math.max(1, Math.abs(Number(radius) || 0));
  const safeDeadZone = clamp(Number(deadZone) || 0, 0, 0.95);
  const safeAxis = axis === 'horizontal' ? 'horizontal' : 'both';
  const safeBoostThreshold = Number.isFinite(boostThreshold)
    ? clamp(Number(boostThreshold), safeDeadZone, 1)
    : null;
  const projectedDx = safeDx;
  const projectedDy = safeAxis === 'horizontal' ? 0 : safeDy;
  const distance = Math.hypot(projectedDx, projectedDy);
  const clampedDistance = Math.min(distance, safeRadius);
  const visualScale = distance > 0 ? clampedDistance / distance : 0;
  const thumbX = projectedDx * visualScale;
  const thumbY = projectedDy * visualScale;
  const angleRadians = Math.atan2(projectedDy, projectedDx);
  const active = distance > safeRadius * safeDeadZone;
  const sector = ((Math.round(angleRadians / (Math.PI / 4)) % 8) + 8) % 8;
  const direction = active
    ? safeAxis === 'horizontal'
      ? projectedDx < 0 ? 'left' : 'right'
      : DIRECTION_BY_SECTOR[sector]
    : 'neutral';
  const force = clampedDistance / safeRadius;

  return Object.freeze({
    axis: safeAxis,
    active,
    direction,
    angle: angleRadians * (180 / Math.PI),
    force,
    boostThreshold: safeBoostThreshold,
    boosted: active && safeBoostThreshold !== null && force >= safeBoostThreshold,
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

export const resolveJoystickDashGesture = ({
  armed = true,
  active = false,
  boosted = false,
  move = 0,
} = {}) => {
  if (!active) {
    return Object.freeze({ armed: true, triggeredDirection: 0 });
  }
  const direction = Math.sign(Number(move) || 0);
  if (armed && boosted && direction !== 0) {
    return Object.freeze({ armed: false, triggeredDirection: direction });
  }
  return Object.freeze({ armed: Boolean(armed), triggeredDirection: 0 });
};
