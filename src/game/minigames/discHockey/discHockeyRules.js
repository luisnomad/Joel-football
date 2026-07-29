import { getDiscHockeyCollisionMap } from './discHockeyCollisionMaps.js';

export const DISC_HOCKEY_MODES = Object.freeze(['computer', 'local']);
export const DISC_HOCKEY_THEMES = Object.freeze(['ice', 'neon']);
export const DISC_HOCKEY_MATCH_SECONDS = 3 * 60;
export const DISC_HOCKEY_PUCK_SURFACE = Object.freeze({
  damping: 0.06,
  softDamping: 1.6,
  settleSpeed: 18,
  stopSpeed: 0.8,
  wallRestitution: 0.96,
});

export const DISC_HOCKEY_HUMAN_CONTROL = Object.freeze({
  keyboardMaxSpeed: 440,
  touchMaxSpeed: 2400,
  touchResponse: 200,
});

export const getDiscHockeyHumanMotion = (touchTracking) => (
  touchTracking
    ? {
      maxSpeed: DISC_HOCKEY_HUMAN_CONTROL.touchMaxSpeed,
      response: DISC_HOCKEY_HUMAN_CONTROL.touchResponse,
      direct: true,
    }
    : {
      maxSpeed: DISC_HOCKEY_HUMAN_CONTROL.keyboardMaxSpeed,
      response: undefined,
      direct: false,
    }
);

export const DISC_HOCKEY_ARENA = Object.freeze({
  left: 100,
  right: 1180,
  top: 116,
  bottom: 650,
  centerX: 640,
  centerY: 383,
  goalTop: 292,
  goalBottom: 474,
  goalDepth: 54,
  playerRadius: 48.4,
  puckRadius: 25,
});

export const DISC_HOCKEY_AI = Object.freeze({
  easy: Object.freeze({
    reactionSeconds: 0.24,
    maxSpeed: 310,
    predictionSeconds: 0,
    pressX: 1000,
    centerTrackingBlend: 0.38,
    contestOffset: 0,
    attackBias: 0.58,
  }),
  normal: Object.freeze({
    reactionSeconds: 0.1,
    maxSpeed: 410,
    predictionSeconds: 0.22,
    pressX: 820,
    centerTrackingBlend: 0.16,
    contestOffset: 20,
    attackBias: 0.78,
  }),
  hard: Object.freeze({
    reactionSeconds: 0.04,
    maxSpeed: 500,
    predictionSeconds: 0.42,
    pressX: 688,
    centerTrackingBlend: 0.04,
    contestOffset: 36,
    attackBias: 0.96,
  }),
});

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const formatDiscHockeyTime = (seconds) => {
  const wholeSeconds = Math.ceil(Math.max(0, finite(seconds)));
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${String(wholeSeconds % 60).padStart(2, '0')}`;
};

export const getDiscHockeyMatchResult = (score) => {
  const left = Math.max(0, finite(score?.left));
  const right = Math.max(0, finite(score?.right));
  if (left > right) return 'left';
  if (right > left) return 'right';
  return 'draw';
};

export const sanitizeDiscHockeyMode = (value) => (
  DISC_HOCKEY_MODES.includes(value) ? value : 'computer'
);

export const sanitizeDiscHockeyTheme = (value) => (
  DISC_HOCKEY_THEMES.includes(value) ? value : 'ice'
);

export const getDiscHockeyAiTuning = (difficulty) => (
  DISC_HOCKEY_AI[difficulty] ?? DISC_HOCKEY_AI.normal
);

const pointInsideContour = (x, y, contour) => {
  let inside = false;
  for (let index = 0, previous = contour.length - 1; index < contour.length; previous = index++) {
    const start = contour[index];
    const end = contour[previous];
    const crossesScanline = (start.y > y) !== (end.y > y);
    if (!crossesScanline) continue;
    const crossingX = (end.x - start.x) * (y - start.y)
      / (end.y - start.y) + start.x;
    if (x < crossingX) inside = !inside;
  }
  return inside;
};

export const closestPointOnCollisionContour = ({
  x,
  y,
  collisionMap = getDiscHockeyCollisionMap('ice'),
}) => {
  const safeX = finite(x, DISC_HOCKEY_ARENA.centerX);
  const safeY = finite(y, DISC_HOCKEY_ARENA.centerY);
  const contour = collisionMap.contour;
  let closest = null;

  contour.forEach((start, index) => {
    const end = contour[(index + 1) % contour.length];
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const lengthSquared = segmentX ** 2 + segmentY ** 2;
    const amount = lengthSquared > 0
      ? clamp(
        ((safeX - start.x) * segmentX + (safeY - start.y) * segmentY) / lengthSquared,
        0,
        1,
      )
      : 0;
    const wallX = start.x + segmentX * amount;
    const wallY = start.y + segmentY * amount;
    const distance = Math.hypot(safeX - wallX, safeY - wallY);
    if (!closest || distance < closest.distance) {
      closest = {
        x: wallX,
        y: wallY,
        distance,
        segmentIndex: index,
        segmentX,
        segmentY,
      };
    }
  });

  return {
    ...closest,
    inside: pointInsideContour(safeX, safeY, contour),
  };
};

export const constrainDiscToCollisionMap = ({
  x,
  y,
  radius,
  collisionMap = getDiscHockeyCollisionMap('ice'),
}) => {
  const safeRadius = Math.max(1, finite(radius, DISC_HOCKEY_ARENA.puckRadius));
  let legalX = finite(x, DISC_HOCKEY_ARENA.centerX);
  let legalY = finite(y, DISC_HOCKEY_ARENA.centerY);
  let collided = false;

  for (let iteration = 0; iteration < 8; iteration += 1) {
    const wall = closestPointOnCollisionContour({
      x: legalX,
      y: legalY,
      collisionMap,
    });
    if (wall.inside && wall.distance >= safeRadius - 0.001) {
      return {
        x: legalX,
        y: legalY,
        collided,
        wallDistance: wall.distance,
      };
    }

    let inwardX;
    let inwardY;
    if (wall.distance > 0.0001) {
      const direction = wall.inside ? 1 : -1;
      inwardX = (legalX - wall.x) / wall.distance * direction;
      inwardY = (legalY - wall.y) / wall.distance * direction;
    } else {
      const segmentLength = Math.max(0.0001, Math.hypot(wall.segmentX, wall.segmentY));
      inwardX = -wall.segmentY / segmentLength;
      inwardY = wall.segmentX / segmentLength;
    }
    legalX = wall.x + inwardX * safeRadius;
    legalY = wall.y + inwardY * safeRadius;
    collided = true;
  }

  const finalWall = closestPointOnCollisionContour({
    x: legalX,
    y: legalY,
    collisionMap,
  });
  return {
    x: legalX,
    y: legalY,
    collided,
    wallDistance: finalWall.distance,
  };
};

export const clampDiscPlayerPosition = ({
  side,
  x,
  y,
  radius = DISC_HOCKEY_ARENA.playerRadius,
  arena = DISC_HOCKEY_ARENA,
  collisionMap = getDiscHockeyCollisionMap('ice'),
}) => {
  const safeRadius = Math.max(1, finite(radius, arena.playerRadius));
  const halfLimit = side === 'right'
    ? arena.centerX + safeRadius
    : arena.centerX - safeRadius;
  const mappedPosition = constrainDiscToCollisionMap({
    x: side === 'right'
      ? Math.max(finite(x, halfLimit), halfLimit)
      : Math.min(finite(x, halfLimit), halfLimit),
    y,
    radius: safeRadius,
    collisionMap,
  });
  return {
    x: side === 'right'
      ? Math.max(mappedPosition.x, halfLimit)
      : Math.min(mappedPosition.x, halfLimit),
    y: mappedPosition.y,
  };
};

export const moveDiscTowardTarget = ({
  disc,
  target,
  deltaSeconds,
  maxSpeed = 440,
  response = 12,
  side,
  arena = DISC_HOCKEY_ARENA,
  collisionMap = getDiscHockeyCollisionMap('ice'),
}) => {
  const dt = clamp(finite(deltaSeconds), 0, 0.05);
  const legalTarget = clampDiscPlayerPosition({
    side,
    x: target?.x,
    y: target?.y,
    radius: disc.radius,
    arena,
    collisionMap,
  });
  const desiredX = legalTarget.x - disc.x;
  const desiredY = legalTarget.y - disc.y;
  const distance = Math.hypot(desiredX, desiredY);
  const desiredSpeed = Math.min(maxSpeed, distance * response);
  const desiredVx = distance > 0.001 ? desiredX / distance * desiredSpeed : 0;
  const desiredVy = distance > 0.001 ? desiredY / distance * desiredSpeed : 0;
  const blend = 1 - Math.exp(-response * dt);
  const vx = finite(disc.vx) + (desiredVx - finite(disc.vx)) * blend;
  const vy = finite(disc.vy) + (desiredVy - finite(disc.vy)) * blend;
  const position = clampDiscPlayerPosition({
    side,
    x: disc.x + vx * dt,
    y: disc.y + vy * dt,
    radius: disc.radius,
    arena,
    collisionMap,
  });
  return { ...disc, ...position, vx, vy };
};

export const moveDiscDirectlyTowardTarget = ({
  disc,
  target,
  deltaSeconds,
  maxSpeed = DISC_HOCKEY_HUMAN_CONTROL.touchMaxSpeed,
  side,
  arena = DISC_HOCKEY_ARENA,
  collisionMap = getDiscHockeyCollisionMap('ice'),
}) => {
  const dt = clamp(finite(deltaSeconds), 0, 0.05);
  const legalTarget = clampDiscPlayerPosition({
    side,
    x: target?.x,
    y: target?.y,
    radius: disc.radius,
    arena,
    collisionMap,
  });
  const dx = legalTarget.x - disc.x;
  const dy = legalTarget.y - disc.y;
  const distance = Math.hypot(dx, dy);
  if (dt <= 0 || distance <= 0.001) {
    return { ...disc, vx: 0, vy: 0 };
  }
  const travel = Math.min(distance, Math.max(0, finite(maxSpeed)) * dt);
  const scale = travel / distance;
  const position = clampDiscPlayerPosition({
    side,
    x: disc.x + dx * scale,
    y: disc.y + dy * scale,
    radius: disc.radius,
    arena,
    collisionMap,
  });
  return {
    ...disc,
    ...position,
    vx: (position.x - disc.x) / dt,
    vy: (position.y - disc.y) / dt,
  };
};

export const resolvePlayerPuckCollision = ({
  player,
  puck,
  restitution = 0.92,
  pushScale = 1.08,
}) => {
  const dx = puck.x - player.x;
  const dy = puck.y - player.y;
  const minimumDistance = player.radius + puck.radius;
  const rawDistance = Math.hypot(dx, dy);
  if (rawDistance >= minimumDistance) return { collided: false, puck: { ...puck } };

  const distance = Math.max(0.0001, rawDistance);
  const nx = rawDistance > 0.0001 ? dx / distance : (player.side === 'right' ? -1 : 1);
  const ny = rawDistance > 0.0001 ? dy / distance : 0;
  const overlap = minimumDistance - rawDistance;
  const relativeNormalSpeed = (finite(puck.vx) - finite(player.vx)) * nx
    + (finite(puck.vy) - finite(player.vy)) * ny;
  const separatingSpeed = Math.max(
    90,
    -relativeNormalSpeed * restitution
      + Math.max(0, finite(player.vx) * nx + finite(player.vy) * ny) * pushScale,
  );
  return {
    collided: true,
    puck: {
      ...puck,
      x: puck.x + nx * (overlap + 0.5),
      y: puck.y + ny * (overlap + 0.5),
      vx: finite(player.vx) + nx * separatingSpeed,
      vy: finite(player.vy) + ny * separatingSpeed,
    },
  };
};

export const stepPuck = ({
  puck,
  deltaSeconds,
  arena = DISC_HOCKEY_ARENA,
  collisionMap = getDiscHockeyCollisionMap('ice'),
  damping = DISC_HOCKEY_PUCK_SURFACE.damping,
  softDamping = DISC_HOCKEY_PUCK_SURFACE.softDamping,
  settleSpeed = DISC_HOCKEY_PUCK_SURFACE.settleSpeed,
  stopSpeed = DISC_HOCKEY_PUCK_SURFACE.stopSpeed,
  restitution = DISC_HOCKEY_PUCK_SURFACE.wallRestitution,
}) => {
  const dt = clamp(finite(deltaSeconds), 0, 0.05);
  const incomingSpeed = Math.hypot(finite(puck.vx), finite(puck.vy));
  const drag = Math.exp(-(incomingSpeed < settleSpeed ? softDamping : damping) * dt);
  const nextVx = finite(puck.vx) * drag;
  const nextVy = finite(puck.vy) * drag;
  const shouldStop = Math.hypot(nextVx, nextVy) < stopSpeed;
  let next = {
    ...puck,
    x: puck.x + finite(puck.vx) * dt,
    y: puck.y + finite(puck.vy) * dt,
    vx: shouldStop ? 0 : nextVx,
    vy: shouldStop ? 0 : nextVy,
  };
  const inGoalMouth = next.y >= collisionMap.goalTop + next.radius
    && next.y <= collisionMap.goalBottom - next.radius;

  if (inGoalMouth) {
    return next;
  }

  const legal = constrainDiscToCollisionMap({
    x: next.x,
    y: next.y,
    radius: next.radius,
    collisionMap,
  });
  const correctionX = next.x - legal.x;
  const correctionY = next.y - legal.y;
  const correctionDistance = Math.hypot(correctionX, correctionY);
  if (correctionDistance <= 0.0001) return next;

  const nx = correctionX / correctionDistance;
  const ny = correctionY / correctionDistance;
  const outwardSpeed = next.vx * nx + next.vy * ny;
  return {
    ...next,
    x: legal.x,
    y: legal.y,
    vx: outwardSpeed > 0
      ? next.vx - (1 + restitution) * outwardSpeed * nx
      : next.vx,
    vy: outwardSpeed > 0
      ? next.vy - (1 + restitution) * outwardSpeed * ny
      : next.vy,
  };
};

export const detectDiscHockeyGoal = ({
  puck,
  collisionMap = getDiscHockeyCollisionMap('ice'),
}) => {
  const insideMouth = puck.y - puck.radius >= collisionMap.goalTop
    && puck.y + puck.radius <= collisionMap.goalBottom;
  if (!insideMouth) return null;
  const diameter = Math.max(2, puck.radius * 2);
  const requiredOverlap = collisionMap.goalOverlapFraction ?? 0.4;
  const leftOverlap = (collisionMap.goalLineLeft - (puck.x - puck.radius)) / diameter;
  const rightOverlap = ((puck.x + puck.radius) - collisionMap.goalLineRight) / diameter;
  if (leftOverlap >= requiredOverlap) return 'right';
  if (rightOverlap >= requiredOverlap) return 'left';
  return null;
};

export const chooseDiscHockeyAiTarget = ({
  puck,
  player,
  difficulty = 'normal',
  arena = DISC_HOCKEY_ARENA,
  collisionMap = getDiscHockeyCollisionMap('ice'),
}) => {
  const tuning = getDiscHockeyAiTuning(difficulty);
  const predictedY = clamp(
    puck.y + finite(puck.vy) * tuning.predictionSeconds,
    arena.top + player.radius,
    arena.bottom - player.radius,
  );
  const puckOnOwnSide = puck.x >= arena.centerX;
  const puckSpeed = Math.hypot(finite(puck.vx), finite(puck.vy));
  const contestedAtMidfield = Math.abs(puck.x - arena.centerX) < 92
    && puckSpeed < 160
    && tuning.contestOffset > 0;
  const contestY = contestedAtMidfield
    ? tuning.contestOffset * (puck.y >= arena.centerY ? -1 : 1)
    : 0;
  const directContactOffset = player.radius
    + finite(puck.radius, arena.puckRadius) * tuning.attackBias;
  const contactDistance = player.radius + finite(puck.radius, arena.puckRadius) - 2;
  const contactOffset = contestedAtMidfield
    ? Math.sqrt(Math.max(1, contactDistance ** 2 - contestY ** 2))
    : directContactOffset;
  const x = puckOnOwnSide
    ? clamp(
      puck.x + contactOffset,
      arena.centerX + player.radius,
      arena.right - player.radius,
    )
    : tuning.pressX;
  const y = puckOnOwnSide
    ? predictedY + contestY
    : clamp(
      predictedY
        + (arena.centerY - predictedY) * tuning.centerTrackingBlend
        + contestY,
      arena.top + player.radius,
      arena.bottom - player.radius,
    );
  return clampDiscPlayerPosition({
    side: 'right',
    x,
    y,
    radius: player.radius,
    arena,
    collisionMap,
  });
};
