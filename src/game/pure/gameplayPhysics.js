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

/**
 * One fighter held up by the other: airborne but barely moving vertically,
 * touching the rival with its feet at or below the rival's head top yet well
 * above the rival's own feet (balanced on the head, or wedged against the
 * head and shoulder). Returns the direction (-1 or 1) the top fighter should
 * slide off, or 0 when it is not perched. It slides the way it is already
 * moving, otherwise away from the rival's centre, and toward open pitch when
 * the rival is pressed against a goal or the side of the pitch.
 */
export const PERCH_SLIDE_SPEED = 6.5;
export const resolveFighterPerch = ({
  top = {},
  bottom = {},
  topBounds,
  bottomBounds,
  touching = true,
  minX = 142,
  maxX = 1138,
} = {}) => {
  if (!topBounds || !bottomBounds || top.grounded || !touching) return 0;
  if (Math.abs(Number(top.vy) || 0) > 3) return 0;
  const overlap = Math.min(topBounds.max.x, bottomBounds.max.x) - Math.max(topBounds.min.x, bottomBounds.min.x);
  if (overlap <= 4) return 0;
  const feet = topBounds.max.y;
  if (feet < bottomBounds.min.y - 6 || feet > bottomBounds.max.y - 30) return 0;
  const topX = Number(top.x) || 0;
  const bottomX = Number(bottom.x) || 0;
  const vx = Number(top.vx) || 0;
  const pitchCentre = (minX + maxX) / 2;
  let direction = (Math.abs(vx) > 0.3 ? Math.sign(vx) : 0)
    || Math.sign(topX - bottomX)
    || Math.sign(pitchCentre - bottomX)
    || 1;
  const width = topBounds.max.x - topBounds.min.x;
  // Blocked by a goal or the pitch edge on that side: go the other way.
  if ((direction > 0 && bottomBounds.max.x + width / 2 > maxX + 30)
    || (direction < 0 && bottomBounds.min.x - width / 2 < minX - 30)) {
    direction = -direction;
  }
  return direction;
};

export const isGoalFootPinCandidate = ({
  defender = {},
  attacker = {},
  ball = {},
  defenderBounds = {},
  defenderSide = 'left',
  attackerIntent = {},
  groundY = 636,
} = {}) => {
  if (defender.grounded || defender.stunned) return false;

  const side = defenderSide === 'right' ? 'right' : 'left';
  const goalDirection = side === 'left' ? -1 : 1;
  const pitchDirection = -goalDirection;
  const defenderX = Number(defender.x) || 0;
  const attackerX = Number(attacker.x) || 0;
  const ballX = Number(ball.x) || 0;
  const ballY = Number(ball.y) || 0;
  const ballRadius = Math.max(0, Number(ball.radius) || 0);
  const boundsMinX = Number(defenderBounds.min?.x ?? defenderBounds.minX);
  const boundsMaxX = Number(defenderBounds.max?.x ?? defenderBounds.maxX);
  const boundsMaxY = Number(defenderBounds.max?.y ?? defenderBounds.maxY);
  if (![boundsMinX, boundsMaxX, boundsMaxY].every(Number.isFinite)) return false;

  const closeToOwnGoal = side === 'left' ? defenderX <= 310 : defenderX >= 970;
  const attackerOnPitchSide = (attackerX - defenderX) * pitchDirection > 0;
  const attackerClose = Math.abs(attackerX - defenderX) <= 128;
  const pressingGoalward = (Number(attackerIntent.move) || 0) * goalDirection > 0.2
    || (Number(attacker.vx) || 0) * goalDirection > 0.6;
  const ballUnderFoot = ballX >= boundsMinX - ballRadius * 0.45
    && ballX <= boundsMaxX + ballRadius * 0.45
    && Math.abs((ballY - ballRadius) - boundsMaxY) <= 16;
  const ballOnPitch = ballY + ballRadius >= Number(groundY) - 8;
  const stalled = Math.hypot(Number(ball.vx) || 0, Number(ball.vy) || 0) < 4.5
    && Math.abs(Number(defender.vy) || 0) < 2.5;

  return closeToOwnGoal
    && attackerOnPitchSide
    && attackerClose
    && pressingGoalward
    && ballUnderFoot
    && ballOnPitch
    && stalled;
};

export const directionalDashContact = ({
  attacker = {},
  defender = {},
  direction = 1,
  padding = 14,
} = {}) => {
  const attackDirection = Math.sign(Number(direction)) || 1;
  const dx = (Number(defender.x) || 0) - (Number(attacker.x) || 0);
  if (dx * attackDirection <= 0) return false;

  const attackerWidth = Math.max(0, Number(attacker.width) || 0);
  const defenderWidth = Math.max(0, Number(defender.width) || 0);
  const attackerHeight = Math.max(0, Number(attacker.height) || 0);
  const defenderHeight = Math.max(0, Number(defender.height) || 0);
  const horizontalReach = (attackerWidth + defenderWidth) / 2
    + Math.max(0, Number(padding) || 0);
  // The former 95 px vertical window was approximately half a standard
  // fighter's body height. Derive that window from the actual scaled bodies so
  // Big Guy, Mum, and Dad do not visually collide before combat can register.
  const verticalReach = Math.max(attackerHeight, defenderHeight) / 2;
  return dx * attackDirection <= horizontalReach
    && Math.abs((Number(defender.y) || 0) - (Number(attacker.y) || 0)) <= verticalReach;
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

export const createForwardStrikeCapsule = ({
  x = 0,
  y = 0,
  facing = 1,
  startForwardOffset = 0,
  endForwardOffset = 0,
  verticalOffset = 0,
  radius = 0,
} = {}) => {
  const direction = Math.sign(Number(facing)) || 1;
  const strikeY = Number(y) + (Number(verticalOffset) || 0);
  return {
    start: {
      x: Number(x) + direction * Math.max(0, Number(startForwardOffset) || 0),
      y: strikeY,
    },
    end: {
      x: Number(x) + direction * Math.max(0, Number(endForwardOffset) || 0),
      y: strikeY,
    },
    capsuleRadius: Math.max(0, Number(radius) || 0),
  };
};
