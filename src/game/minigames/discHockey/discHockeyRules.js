import { getDiscHockeyCollisionMap } from './discHockeyCollisionMaps.js';

export const DISC_HOCKEY_MODES = Object.freeze(['computer', 'local', 'crazy']);
export const DISC_HOCKEY_THEMES = Object.freeze(['ice', 'neon']);
export const DISC_HOCKEY_MATCH_SECONDS = 3 * 60;
export const DISC_HOCKEY_PUCK_SURFACE = Object.freeze({
  damping: 0.06,
  softDamping: 1.6,
  settleSpeed: 18,
  stopSpeed: 0.8,
  wallRestitution: 0.96,
});

export const DISC_HOCKEY_STALL_REFLEX = Object.freeze({
  triggerSeconds: 3,
  maximumDrift: 90,
  escapeSpeed: 220,
  contactTolerance: 7,
  puckSpeed: 560,
  cooldownSeconds: 1.1,
  visualSeconds: 0.45,
  probeDistance: 150,
});

export const DISC_HOCKEY_HUMAN_CONTROL = Object.freeze({
  keyboardMaxSpeed: 440,
  touchMaxSpeed: 2400,
  touchResponse: 200,
});

export const DISC_HOCKEY_PHONE_THUMB_OFFSET = Object.freeze({
  radiusMultiplier: 1.25,
});

export const DISC_HOCKEY_IMPACT_AUDIO = Object.freeze({
  minimumVolumeScale: 0.5,
  fullVolumeSpeed: 900,
});

export const DISC_HOCKEY_CRAZY_POWER = Object.freeze({
  maximum: 100,
  passivePerSecond: 1,
  intentionalHitGain: 6,
  defensiveSaveGain: 14,
  intentionalClosingSpeed: 120,
  defensiveSaveMinimumSpeed: 120,
  contactCooldownSeconds: 0.32,
  rechargeDelaySeconds: 0.45,
  poweredPuckSpeed: 1450,
  poweredPuckMaximumSpeed: 1550,
  knockbackSpeed: 860,
  knockbackSeconds: 0.28,
});

export const DISC_HOCKEY_CRAZY_ROLES = Object.freeze([
  'striker',
  'interceptor',
  'defender',
  'goalkeeper',
]);

export const DISC_HOCKEY_CREASE_RULE = Object.freeze({
  warningSeconds: 1,
  violationSeconds: 4,
  penaltySeconds: 1.25,
  extraCreaseDepth: 36,
  puckSafetyDepth: 300,
  boundaryHysteresis: 8,
  ejectionSeconds: 0.5,
  ejectionPushSeconds: 0.32,
  ejectionSpeed: 650,
  maximumEjectionAngleDegrees: 24,
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

export const releaseDiscHockeyControl = (player = {}) => ({
  ...player,
  vx: 0,
  vy: 0,
  target: null,
  pointerId: null,
});

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

export const DISC_HOCKEY_CRAZY_AI = Object.freeze({
  reactionSeconds: 0.025,
  attack: Object.freeze({
    behindClearance: 30,
    routeClearance: 118,
    routeSafetyMargin: 12,
    alignmentTolerance: 26,
    strikeThroughDistance: 165,
    minimumShotSpeed: 680,
  }),
  midfieldRelease: Object.freeze({
    horizontalClearance: 90,
    verticalClearance: 96,
  }),
  cornerRelease: Object.freeze({
    minimumPuckSpeed: 120,
    horizontalClearance: 190,
    verticalClearance: 160,
    inwardPuckSpeed: 520,
    verticalPuckSpeed: 320,
    retreatSeconds: 0.55,
  }),
  striker: Object.freeze({
    maxSpeed: 780,
    response: 22,
    aggressive: true,
  }),
  support: Object.freeze({
    maxSpeed: DISC_HOCKEY_AI.hard.maxSpeed,
    response: 12,
    aggressive: false,
  }),
});

export const getDiscHockeyCrazyRoleMotion = (role) => (
  role === 'striker'
    ? DISC_HOCKEY_CRAZY_AI.striker
    : DISC_HOCKEY_CRAZY_AI.support
);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const createDiscHockeyCornerBankPuck = ({ puck, corner }) => {
  const verticalDirection = corner === 'bottom' ? -1 : 1;
  return {
    ...puck,
    vx: -Math.max(
      DISC_HOCKEY_CRAZY_AI.cornerRelease.inwardPuckSpeed,
      Math.abs(finite(puck?.vx)),
    ),
    vy: verticalDirection * Math.max(
      DISC_HOCKEY_CRAZY_AI.cornerRelease.verticalPuckSpeed,
      Math.abs(finite(puck?.vy)),
    ),
  };
};

export const createDiscHockeyCrazyAttackPuck = ({
  puck,
  arena = DISC_HOCKEY_ARENA,
  collisionMap = getDiscHockeyCollisionMap('ice'),
}) => {
  const targetX = collisionMap.goalLineLeft - arena.goalDepth;
  const targetY = arena.centerY;
  const dx = targetX - finite(puck?.x);
  const dy = targetY - finite(puck?.y);
  const distance = Math.max(0.0001, Math.hypot(dx, dy));
  const speed = Math.max(
    DISC_HOCKEY_CRAZY_AI.attack.minimumShotSpeed,
    Math.hypot(finite(puck?.vx), finite(puck?.vy)),
  );
  return {
    ...puck,
    vx: dx / distance * speed,
    vy: dy / distance * speed,
  };
};

export const createDiscHockeyStallReflexPuck = ({
  puck,
  player,
  arena = DISC_HOCKEY_ARENA,
  collisionMap = getDiscHockeyCollisionMap('ice'),
}) => {
  const normalize = (x, y, fallbackX = 1, fallbackY = 0) => {
    const length = Math.hypot(x, y);
    if (length <= 0.0001) return { x: fallbackX, y: fallbackY };
    return { x: x / length, y: y / length };
  };
  const away = normalize(
    finite(puck?.x) - finite(player?.x),
    finite(puck?.y) - finite(player?.y),
    player?.side === 'right' ? -1 : 1,
    0,
  );
  const towardCenter = normalize(
    arena.centerX - finite(puck?.x),
    arena.centerY - finite(puck?.y),
    -away.x,
    -away.y,
  );
  const rotate = (direction, radians) => ({
    x: direction.x * Math.cos(radians) - direction.y * Math.sin(radians),
    y: direction.x * Math.sin(radians) + direction.y * Math.cos(radians),
  });
  const candidates = [
    away,
    rotate(away, Math.PI / 4),
    rotate(away, -Math.PI / 4),
    rotate(away, Math.PI / 2),
    rotate(away, -Math.PI / 2),
    towardCenter,
  ];
  const boardDistance = Math.min(
    finite(puck?.x) - arena.left,
    arena.right - finite(puck?.x),
    finite(puck?.y) - arena.top,
    arena.bottom - finite(puck?.y),
  );
  const centerWeight = boardDistance <= finite(puck?.radius, arena.puckRadius) + 40
    ? 150
    : 20;
  const direction = candidates.reduce((best, candidate) => {
    const probe = constrainDiscToCollisionMap({
      x: finite(puck?.x) + candidate.x * DISC_HOCKEY_STALL_REFLEX.probeDistance,
      y: finite(puck?.y) + candidate.y * DISC_HOCKEY_STALL_REFLEX.probeDistance,
      radius: finite(puck?.radius, arena.puckRadius),
      collisionMap,
    });
    const legalRoom = Math.hypot(
      probe.x - finite(puck?.x),
      probe.y - finite(puck?.y),
    );
    const score = legalRoom
      + (candidate.x * away.x + candidate.y * away.y) * 60
      + (candidate.x * towardCenter.x + candidate.y * towardCenter.y) * centerWeight;
    return score > best.score ? { direction: candidate, score } : best;
  }, { direction: away, score: -Infinity }).direction;
  return {
    ...puck,
    powered: false,
    vx: direction.x * DISC_HOCKEY_STALL_REFLEX.puckSpeed,
    vy: direction.y * DISC_HOCKEY_STALL_REFLEX.puckSpeed,
  };
};

export const getDiscHockeyImpactVolume = (impactSpeed) => {
  const strength = clamp(
    Math.max(0, finite(impactSpeed)) / DISC_HOCKEY_IMPACT_AUDIO.fullVolumeSpeed,
    0,
    1,
  );
  return DISC_HOCKEY_IMPACT_AUDIO.minimumVolumeScale
    + strength * (1 - DISC_HOCKEY_IMPACT_AUDIO.minimumVolumeScale);
};

export const evaluateDiscHockeyCrease = ({
  player,
  puck,
  collisionMap = getDiscHockeyCollisionMap('ice'),
  previousSeconds = 0,
  deltaSeconds = 0,
}) => {
  const side = player?.side === 'right' ? 'right' : 'left';
  const goalLine = side === 'left'
    ? collisionMap.goalLineLeft
    : collisionMap.goalLineRight;
  const radius = Math.max(1, finite(player?.radius, DISC_HOCKEY_ARENA.playerRadius));
  const boundaryHysteresis = finite(previousSeconds) > 0
    ? DISC_HOCKEY_CREASE_RULE.boundaryHysteresis
    : 0;
  const creaseEdge = side === 'left'
    ? goalLine + radius + DISC_HOCKEY_CREASE_RULE.extraCreaseDepth + boundaryHysteresis
    : goalLine - radius - DISC_HOCKEY_CREASE_RULE.extraCreaseDepth - boundaryHysteresis;
  const playerY = finite(player?.y, DISC_HOCKEY_ARENA.centerY);
  const verticalReach = radius + boundaryHysteresis;
  const inGoalLane = playerY + verticalReach >= collisionMap.goalTop
    && playerY - verticalReach <= collisionMap.goalBottom;
  const inCrease = inGoalLane && (
    side === 'left'
      ? finite(player?.x, DISC_HOCKEY_ARENA.centerX) <= creaseEdge
      : finite(player?.x, DISC_HOCKEY_ARENA.centerX) >= creaseEdge
  );
  const puckThreatEdge = side === 'left'
    ? goalLine + DISC_HOCKEY_CREASE_RULE.puckSafetyDepth
    : goalLine - DISC_HOCKEY_CREASE_RULE.puckSafetyDepth;
  const puckThreatening = side === 'left'
    ? finite(puck?.x, DISC_HOCKEY_ARENA.centerX) <= puckThreatEdge
    : finite(puck?.x, DISC_HOCKEY_ARENA.centerX) >= puckThreatEdge;
  const camping = inCrease && !puckThreatening;
  const accumulatedSeconds = camping
    ? Math.max(0, finite(previousSeconds)) + Math.max(0, finite(deltaSeconds))
    : 0;
  const violated = accumulatedSeconds >= DISC_HOCKEY_CREASE_RULE.violationSeconds;
  const seconds = violated
    ? 0
    : Math.min(DISC_HOCKEY_CREASE_RULE.violationSeconds, accumulatedSeconds);
  return {
    side,
    inCrease,
    puckThreatening,
    camping,
    warning: camping && seconds >= DISC_HOCKEY_CREASE_RULE.warningSeconds,
    violated,
    seconds,
  };
};

export const getDiscHockeyEjectionVelocity = ({
  side = 'left',
  randomSample = 0.5,
}) => {
  const sample = clamp(finite(randomSample, 0.5), 0, 1);
  const angleDegrees = (sample * 2 - 1)
    * DISC_HOCKEY_CREASE_RULE.maximumEjectionAngleDegrees;
  const angleRadians = angleDegrees * Math.PI / 180;
  const inwardDirection = side === 'right' ? -1 : 1;
  return {
    angleDegrees,
    vx: inwardDirection * Math.cos(angleRadians) * DISC_HOCKEY_CREASE_RULE.ejectionSpeed,
    vy: Math.sin(angleRadians) * DISC_HOCKEY_CREASE_RULE.ejectionSpeed,
  };
};

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

export const resolveDiscHockeyGoalCharacterId = ({
  scoringSide,
  leftCharacterId,
  rightCharacterId,
  isCrazyMode = false,
  lastPuckTouch = null,
}) => {
  if (scoringSide === 'left') return leftCharacterId ?? null;
  if (scoringSide !== 'right') return null;
  if (!isCrazyMode) return rightCharacterId ?? null;
  return lastPuckTouch?.side === 'right'
    ? lastPuckTouch.characterId ?? null
    : null;
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

export const getDiscHockeyTouchTarget = ({
  side,
  x,
  y,
  radius = DISC_HOCKEY_ARENA.playerRadius,
  offsetEnabled = false,
  arena = DISC_HOCKEY_ARENA,
  collisionMap = getDiscHockeyCollisionMap('ice'),
}) => {
  const safeSide = side === 'right' ? 'right' : 'left';
  const handleX = finite(x, arena.centerX);
  const handleY = finite(y, arena.centerY);
  const requestedOffsetX = offsetEnabled
    ? Math.max(1, finite(radius, arena.playerRadius))
      * DISC_HOCKEY_PHONE_THUMB_OFFSET.radiusMultiplier
      * (safeSide === 'right' ? -1 : 1)
    : 0;
  const target = clampDiscPlayerPosition({
    side: safeSide,
    x: handleX + requestedOffsetX,
    y: handleY,
    radius,
    arena,
    collisionMap,
  });
  return {
    ...target,
    handleX,
    handleY,
    requestedOffsetX,
    appliedOffsetX: target.x - handleX,
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
  if (rawDistance >= minimumDistance) {
    return { collided: false, impactSpeed: 0, puck: { ...puck } };
  }

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
    impactSpeed: Math.max(0, -relativeNormalSpeed),
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

export const selectDiscHockeyCrazyRoster = ({
  candidateIds = [],
  playerId = null,
  randomSamples = [],
  count = 4,
}) => {
  const pool = [...new Set(candidateIds)].filter((id) => id && id !== playerId);
  const selected = [];
  const requestedCount = Math.min(Math.max(0, Math.floor(finite(count, 4))), pool.length);
  for (let index = 0; index < requestedCount; index += 1) {
    const sample = clamp(
      finite(randomSamples[index], (index * 0.61803398875) % 1),
      0,
      0.999999,
    );
    const poolIndex = Math.floor(sample * pool.length);
    selected.push(pool.splice(poolIndex, 1)[0]);
  }
  return selected;
};

export const getDiscHockeyIntentionalHit = ({ player, puck }) => {
  const dx = finite(puck?.x) - finite(player?.x);
  const dy = finite(puck?.y) - finite(player?.y);
  const distance = Math.max(0.0001, Math.hypot(dx, dy));
  const nx = dx / distance;
  const ny = dy / distance;
  const playerClosingSpeed = finite(player?.vx) * nx + finite(player?.vy) * ny;
  const puckAlongNormal = finite(puck?.vx) * nx + finite(puck?.vy) * ny;
  const relativeClosingSpeed = playerClosingSpeed - puckAlongNormal;
  return {
    intentional: playerClosingSpeed >= DISC_HOCKEY_CRAZY_POWER.intentionalClosingSpeed
      && relativeClosingSpeed > 0,
    playerClosingSpeed,
    relativeClosingSpeed,
    normal: { x: nx, y: ny },
  };
};

export const isDiscHockeyDefensiveSave = ({
  player,
  puck,
  intentionalHit = getDiscHockeyIntentionalHit({ player, puck }),
  arena = DISC_HOCKEY_ARENA,
}) => (
  player?.side === 'left'
  && intentionalHit.intentional
  && finite(puck?.x, arena.centerX) < arena.centerX
  && finite(puck?.vx) <= -DISC_HOCKEY_CRAZY_POWER.defensiveSaveMinimumSpeed
);

export const addDiscHockeyCrazyPower = ({
  energy = 0,
  deltaSeconds = 0,
  gain = 0,
}) => clamp(
  finite(energy)
    + Math.max(0, finite(deltaSeconds)) * DISC_HOCKEY_CRAZY_POWER.passivePerSecond
    + Math.max(0, finite(gain)),
  0,
  DISC_HOCKEY_CRAZY_POWER.maximum,
);

export const createDiscHockeyPoweredPuck = ({
  puck,
  serial = 1,
  fallbackDirection = 1,
}) => {
  const speed = Math.hypot(finite(puck?.vx), finite(puck?.vy));
  const directionX = speed > 0.001 ? finite(puck?.vx) / speed : (fallbackDirection < 0 ? -1 : 1);
  const directionY = speed > 0.001 ? finite(puck?.vy) / speed : 0;
  const poweredSpeed = Math.max(DISC_HOCKEY_CRAZY_POWER.poweredPuckSpeed, speed);
  return {
    ...puck,
    vx: directionX * poweredSpeed,
    vy: directionY * poweredSpeed,
    powered: true,
    powerSerial: Math.max(1, Math.floor(finite(serial, 1))),
  };
};

export const getDiscHockeyPoweredKnockback = ({ puck, player }) => {
  const speed = Math.max(0.0001, Math.hypot(finite(puck?.vx), finite(puck?.vy)));
  const directionX = finite(puck?.vx) / speed;
  const directionY = finite(puck?.vy) / speed;
  const radialX = finite(player?.x) - finite(puck?.x);
  const radialY = finite(player?.y) - finite(puck?.y);
  const cross = directionX * radialY - directionY * radialX;
  const side = cross === 0
    ? (finite(player?.y) >= DISC_HOCKEY_ARENA.centerY ? 1 : -1)
    : Math.sign(cross);
  const sideX = -directionY * side;
  const sideY = directionX * side;
  const combinedX = sideX * 0.9 + directionX * 0.28;
  const combinedY = sideY * 0.9 + directionY * 0.28;
  const magnitude = Math.max(0.0001, Math.hypot(combinedX, combinedY));
  return {
    vx: combinedX / magnitude * DISC_HOCKEY_CRAZY_POWER.knockbackSpeed,
    vy: combinedY / magnitude * DISC_HOCKEY_CRAZY_POWER.knockbackSpeed,
    seconds: DISC_HOCKEY_CRAZY_POWER.knockbackSeconds,
  };
};

export const shouldEndDiscHockeyPoweredShot = ({
  before,
  after,
  scorer = null,
  arena = DISC_HOCKEY_ARENA,
}) => Boolean(
  scorer
  || (
    finite(before?.x) > arena.centerX
    && finite(before?.vx) > 0
    && finite(after?.vx) <= 0
    && finite(after?.x) > arena.centerX
  )
);

const crazyRoleScore = (player, point, retainedRole) => (
  Math.hypot(finite(player.x) - point.x, finite(player.y) - point.y)
  - (player.crazyRole === retainedRole ? 72 : 0)
);

const removeBestCrazyPlayer = (available, point, role) => {
  let bestIndex = 0;
  let bestScore = Infinity;
  available.forEach((player, index) => {
    const score = crazyRoleScore(player, point, role);
    if (score < bestScore) {
      bestIndex = index;
      bestScore = score;
    }
  });
  return available.splice(bestIndex, 1)[0];
};

const avoidCrazyShotLane = ({
  target,
  role,
  puck,
  arena,
  playerRadius,
}) => {
  if (role === 'striker' || target.x >= puck.x || puck.x <= arena.centerX + 35) return target;
  const goalY = arena.centerY;
  const amount = clamp(
    (puck.x - target.x) / Math.max(1, puck.x - arena.left),
    0,
    1,
  );
  const laneY = puck.y + (goalY - puck.y) * amount;
  const clearance = playerRadius * 2.15;
  if (Math.abs(target.y - laneY) >= clearance) return target;
  const direction = target.y >= laneY ? 1 : -1;
  return {
    ...target,
    y: clamp(
      laneY + direction * clearance,
      arena.top + playerRadius,
      arena.bottom - playerRadius,
    ),
  };
};

const getCrazyCornerRecovery = ({
  puck,
  collisionMap,
  arena,
}) => {
  const puckX = finite(puck?.x);
  const puckY = finite(puck?.y);
  const nearOpponentEnd = puckX >= collisionMap.goalLineRight - 150;
  if (!nearOpponentEnd) return null;
  const puckRadius = Math.max(1, finite(puck?.radius, arena.puckRadius));
  const goalLipClearance = arena.playerRadius + puckRadius;
  if (
    puckY <= collisionMap.bounds.top + 130
    || puckY <= collisionMap.goalTop + goalLipClearance
  ) return 'top';
  if (
    puckY >= collisionMap.bounds.bottom - 130
    || puckY >= collisionMap.goalBottom - goalLipClearance
  ) return 'bottom';
  return null;
};

const chooseCrazyCornerRecoveryTarget = ({
  role,
  player,
  puck,
  corner,
  arena,
  collisionMap,
  forceRelease = false,
}) => {
  const verticalDirection = corner === 'top' ? 1 : -1;
  if (role === 'striker') {
    const puckSpeed = Math.hypot(finite(puck?.vx), finite(puck?.vy));
    if (
      forceRelease
      || puckSpeed >= DISC_HOCKEY_CRAZY_AI.cornerRelease.minimumPuckSpeed
    ) {
      return {
        x: finite(puck?.x) - DISC_HOCKEY_CRAZY_AI.cornerRelease.horizontalClearance,
        y: finite(puck?.y)
          + verticalDirection * DISC_HOCKEY_CRAZY_AI.cornerRelease.verticalClearance,
      };
    }
    const contactDistance = player.radius + finite(puck?.radius, arena.puckRadius) - 7;
    return {
      x: finite(puck?.x) - contactDistance * 0.66,
      y: finite(puck?.y) + verticalDirection * contactDistance * 0.75,
    };
  }
  if (role === 'goalkeeper') {
    return {
      x: Math.min(
        collisionMap.goalLineRight - player.radius
          - DISC_HOCKEY_CREASE_RULE.extraCreaseDepth - 34,
        finite(puck?.x) - 195,
      ),
      y: arena.centerY,
    };
  }
  if (role === 'defender') {
    return {
      x: arena.centerX + 310,
      y: arena.centerY + verticalDirection * 120,
    };
  }
  return {
    x: arena.centerX + player.radius + 70,
    y: arena.centerY + verticalDirection * 105,
  };
};

const chooseCrazyStrikerAttackTarget = ({
  player,
  puck,
  arena,
  collisionMap,
}) => {
  const puckX = finite(puck?.x, arena.centerX);
  const puckY = finite(puck?.y, arena.centerY);
  const puckRadius = Math.max(1, finite(puck?.radius, arena.puckRadius));
  const contactDistance = player.radius + puckRadius;
  const setupX = puckX + contactDistance + DISC_HOCKEY_CRAZY_AI.attack.behindClearance;
  const legalPuckY = clamp(
    puckY,
    collisionMap.bounds.top + player.radius,
    collisionMap.bounds.bottom - player.radius,
  );
  const openIceDirection = puckY <= arena.centerY ? 1 : -1;
  const routeY = puckY + openIceDirection * DISC_HOCKEY_CRAZY_AI.attack.routeClearance;
  const routeIsClear = Math.abs(finite(player?.y) - puckY)
    >= contactDistance + DISC_HOCKEY_CRAZY_AI.attack.routeSafetyMargin;
  const safelyBehind = finite(player?.x) >= puckX + contactDistance * 0.82;
  const aligned = Math.abs(finite(player?.y) - legalPuckY)
    <= DISC_HOCKEY_CRAZY_AI.attack.alignmentTolerance;

  if (!safelyBehind) {
    return {
      phase: 'route',
      target: routeIsClear
        ? { x: setupX, y: routeY }
        : { x: finite(player?.x), y: routeY },
    };
  }
  if (!aligned) {
    return {
      phase: 'align',
      target: {
        x: setupX,
        y: legalPuckY,
      },
    };
  }
  return {
    phase: 'strike',
    target: {
      x: puckX - DISC_HOCKEY_CRAZY_AI.attack.strikeThroughDistance,
      y: legalPuckY,
    },
  };
};

export const chooseDiscHockeyCrazyTargets = ({
  players = [],
  puck,
  human,
  arena = DISC_HOCKEY_ARENA,
  collisionMap = getDiscHockeyCollisionMap('ice'),
}) => {
  if (players.length === 0) return [];
  const available = [...players];
  const goalkeeperAnchor = {
    x: collisionMap.goalLineRight - arena.playerRadius - 70,
    y: arena.centerY,
  };
  const retainedCornerStrikerIndex = available.findIndex(
    (player) => finite(player?.cornerReleaseSeconds) > 0,
  );
  const striker = retainedCornerStrikerIndex >= 0
    ? available.splice(retainedCornerStrikerIndex, 1)[0]
    : removeBestCrazyPlayer(available, puck, 'striker');
  const goalkeeper = available.length > 0
    ? removeBestCrazyPlayer(available, goalkeeperAnchor, 'goalkeeper')
    : striker;
  const defender = available.length > 0
    ? removeBestCrazyPlayer(available, {
      x: Math.max(arena.centerX + 250, finite(puck?.x) + 155),
      y: finite(puck?.y, arena.centerY),
    }, 'defender')
    : goalkeeper;
  const interceptor = available[0] ?? defender;
  const roleByPlayer = new Map([
    [striker, 'striker'],
    [goalkeeper, 'goalkeeper'],
    [defender, 'defender'],
    [interceptor, 'interceptor'],
  ]);
  const predictedY = clamp(
    finite(puck?.y, arena.centerY) + finite(puck?.vy) * 0.3,
    arena.top + arena.playerRadius,
    arena.bottom - arena.playerRadius,
  );
  const puckThreatening = finite(puck?.x, arena.centerX) > arena.centerX + 90
    || finite(puck?.vx) > 150;
  const cornerRecovery = getCrazyCornerRecovery({ puck, collisionMap, arena });

  return players.map((player) => {
    const role = roleByPlayer.get(player) ?? 'interceptor';
    const retainedReleaseCorner = role === 'striker'
      && finite(player?.cornerReleaseSeconds) > 0
      ? player.cornerReleaseCorner
      : null;
    const activeCornerRecovery = retainedReleaseCorner ?? cornerRecovery;
    const releasingCorner = Boolean(retainedReleaseCorner)
      || Math.hypot(finite(puck?.vx), finite(puck?.vy))
        >= DISC_HOCKEY_CRAZY_AI.cornerRelease.minimumPuckSpeed;
    const midfieldRelease = role === 'striker'
      && !activeCornerRecovery
      && finite(puck?.x, arena.centerX) < arena.centerX;
    let attackPhase = null;
    let target;
    if (activeCornerRecovery) {
      target = chooseCrazyCornerRecoveryTarget({
        role,
        player,
        puck,
        corner: activeCornerRecovery,
        arena,
        collisionMap,
        forceRelease: Boolean(retainedReleaseCorner),
      });
    } else if (midfieldRelease) {
      const verticalDirection = finite(puck?.y, arena.centerY) <= arena.centerY ? 1 : -1;
      target = {
        x: arena.centerX + player.radius
          + DISC_HOCKEY_CRAZY_AI.midfieldRelease.horizontalClearance,
        y: finite(puck?.y, arena.centerY)
          + verticalDirection * DISC_HOCKEY_CRAZY_AI.midfieldRelease.verticalClearance,
      };
    } else if (role === 'striker') {
      const attack = chooseCrazyStrikerAttackTarget({
        puck,
        player,
        arena,
        collisionMap,
      });
      attackPhase = attack.phase;
      target = attack.target;
    } else if (role === 'goalkeeper') {
      target = {
        x: puckThreatening
          ? clamp(
            finite(puck?.x) + 185,
            collisionMap.goalLineRight - player.radius - 115,
            collisionMap.goalLineRight - player.radius - 24,
          )
          : collisionMap.goalLineRight - player.radius
            - DISC_HOCKEY_CREASE_RULE.extraCreaseDepth - 34,
        y: predictedY,
      };
    } else if (role === 'defender') {
      target = {
        x: clamp(
          finite(puck?.x) + 165,
          arena.centerX + player.radius + 210,
          collisionMap.goalLineRight - player.radius - 135,
        ),
        y: clamp(
          predictedY + (predictedY >= arena.centerY ? -82 : 82),
          arena.top + player.radius,
          arena.bottom - player.radius,
        ),
      };
    } else {
      target = {
        x: clamp(
          finite(puck?.x) + 78,
          arena.centerX + player.radius,
          arena.centerX + 205,
        ),
        y: clamp(
          (finite(puck?.y, arena.centerY) + finite(human?.y, arena.centerY)) / 2
            + (finite(puck?.y) >= arena.centerY ? -105 : 105),
          arena.top + player.radius,
          arena.bottom - player.radius,
        ),
      };
    }
    target = avoidCrazyShotLane({
      target,
      role,
      puck,
      arena,
      playerRadius: player.radius,
    });
    return {
      player,
      role,
      midfieldRelease,
      cornerRecovery: activeCornerRecovery,
      cornerPhase: role === 'striker' && activeCornerRecovery
        ? releasingCorner ? 'release' : 'jab'
        : null,
      attackPhase,
      target: clampDiscPlayerPosition({
        side: 'right',
        x: target.x,
        y: target.y,
        radius: player.radius,
        arena,
        collisionMap,
      }),
    };
  });
};

export const separateDiscHockeyPushers = ({
  players = [],
  minimumGap = 6,
  collisionMap = getDiscHockeyCollisionMap('ice'),
}) => {
  const separated = players.map((player) => ({ ...player }));
  for (let pass = 0; pass < 3; pass += 1) {
    for (let first = 0; first < separated.length; first += 1) {
      for (let second = first + 1; second < separated.length; second += 1) {
        const a = separated[first];
        const b = separated[second];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        const required = a.radius + b.radius + minimumGap;
        if (distance >= required) continue;
        const nx = distance > 0.001 ? dx / distance : 0;
        const ny = distance > 0.001 ? dy / distance : (second % 2 === 0 ? 1 : -1);
        const shift = (required - distance) / 2;
        const firstPosition = clampDiscPlayerPosition({
          side: a.side,
          x: a.x - nx * shift,
          y: a.y - ny * shift,
          radius: a.radius,
          collisionMap,
        });
        const secondPosition = clampDiscPlayerPosition({
          side: b.side,
          x: b.x + nx * shift,
          y: b.y + ny * shift,
          radius: b.radius,
          collisionMap,
        });
        separated[first] = { ...a, ...firstPosition };
        separated[second] = { ...b, ...secondPosition };
      }
    }
  }
  return separated;
};
