import { clamp } from './actions.js';

const EPSILON = 0.000001;

export const sweepCircleAgainstBounds = ({ previous, current, radius = 0, bounds } = {}) => {
  if (!previous || !current || !bounds) return null;
  const safeRadius = Math.max(0, Number(radius) || 0);
  const expanded = {
    minX: Number(bounds.min?.x ?? bounds.minX) - safeRadius,
    maxX: Number(bounds.max?.x ?? bounds.maxX) + safeRadius,
    minY: Number(bounds.min?.y ?? bounds.minY) - safeRadius,
    maxY: Number(bounds.max?.y ?? bounds.maxY) + safeRadius,
  };
  if (Object.values(expanded).some((value) => !Number.isFinite(value))) return null;

  const start = { x: Number(previous.x), y: Number(previous.y) };
  const end = { x: Number(current.x), y: Number(current.y) };
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) return null;
  const startsInside = start.x >= expanded.minX && start.x <= expanded.maxX
    && start.y >= expanded.minY && start.y <= expanded.maxY;
  if (startsInside) return null;

  const delta = { x: end.x - start.x, y: end.y - start.y };
  let entry = 0;
  let exit = 1;
  let normal = { x: 0, y: 0 };
  const axes = [
    { key: 'x', min: expanded.minX, max: expanded.maxX },
    { key: 'y', min: expanded.minY, max: expanded.maxY },
  ];

  for (const axis of axes) {
    const origin = start[axis.key];
    const movement = delta[axis.key];
    if (Math.abs(movement) < EPSILON) {
      if (origin < axis.min || origin > axis.max) return null;
      continue;
    }
    const first = (axis.min - origin) / movement;
    const second = (axis.max - origin) / movement;
    const axisEntry = Math.min(first, second);
    const axisExit = Math.max(first, second);
    if (axisEntry > entry) {
      entry = axisEntry;
      normal = axis.key === 'x'
        ? { x: movement > 0 ? -1 : 1, y: 0 }
        : { x: 0, y: movement > 0 ? -1 : 1 };
    }
    exit = Math.min(exit, axisExit);
    if (entry > exit) return null;
  }

  if (entry < 0 || entry > 1) return null;
  return {
    time: entry,
    x: start.x + delta.x * entry,
    y: start.y + delta.y * entry,
    normal,
  };
};

export const resolveAdaptiveLob = ({
  ballX = 0,
  ballY = 537,
  opponentX = 0,
  opponentY = 0,
  attackDirection = 1,
} = {}) => {
  const direction = attackDirection >= 0 ? 1 : -1;
  const forwardDistance = Math.max(0, (Number(opponentX) - Number(ballX)) * direction);
  // Point-blank defenders share the same bounded maximum arc. Beyond that,
  // distance progressively trades height for horizontal reach.
  const distanceFactor = clamp((forwardDistance - 110) / 330, 0, 1);
  const airborneFactor = clamp((520 - Number(opponentY || 520)) / 150, 0, 1);
  const speed = clamp(7.3 + distanceFactor * 4.1 + airborneFactor * 0.15, 7.3, 11.55);
  const liftMagnitude = clamp(19 - distanceFactor * 4.4 + airborneFactor * 0.5, 14.6, 19.5);
  const landingLead = 140 + distanceFactor * 55;
  const rawTargetX = Number(opponentX) + direction * landingLead;
  const targetX = direction > 0
    ? clamp(Math.max(rawTargetX, Number(ballX) + 220), 100, 1180)
    : clamp(Math.min(rawTargetX, Number(ballX) - 220), 100, 1180);
  const predictedApexY = Number(ballY) - (liftMagnitude ** 2) / (2 * 0.58);
  const estimatedOpponentHeadY = Number(opponentY || 520) - 140;
  return {
    vx: direction * speed,
    vy: -liftMagnitude,
    targetX,
    opponentDistance: forwardDistance,
    distanceFactor,
    predictedApexY,
    predictedClearance: estimatedOpponentHeadY - predictedApexY,
  };
};

export const shouldResolvePlayerClash = ({ left = {}, right = {}, intents = {} } = {}) => {
  if (!left.grounded || !right.grounded || left.stunned || right.stunned) return false;
  const gap = Math.abs((Number(right.x) || 0) - (Number(left.x) || 0));
  if (gap > 112) return false;
  const leftIsLeft = (Number(left.x) || 0) <= (Number(right.x) || 0);
  const leftMove = Number(intents.left?.move) || 0;
  const rightMove = Number(intents.right?.move) || 0;
  const pushingInward = leftIsLeft
    ? leftMove > 0 && rightMove < 0
    : leftMove < 0 && rightMove > 0;
  const simultaneousKicks = (Number(left.kickTimer) || 0) > 0 && (Number(right.kickTimer) || 0) > 0;
  const relativeSpeed = Math.abs((Number(left.vx) || 0) - (Number(right.vx) || 0));
  return (pushingInward || simultaneousKicks) && relativeSpeed < 3.2;
};

export const circleIntersectsCapsule = ({ circle, radius = 0, start, end, capsuleRadius = 0 } = {}) => {
  if (!circle || !start || !end) return false;
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const lengthSquared = segmentX ** 2 + segmentY ** 2;
  const projection = lengthSquared <= EPSILON
    ? 0
    : clamp(((circle.x - start.x) * segmentX + (circle.y - start.y) * segmentY) / lengthSquared, 0, 1);
  const nearestX = start.x + segmentX * projection;
  const nearestY = start.y + segmentY * projection;
  const reach = Math.max(0, Number(radius) || 0) + Math.max(0, Number(capsuleRadius) || 0);
  return Math.hypot(circle.x - nearestX, circle.y - nearestY) <= reach;
};
