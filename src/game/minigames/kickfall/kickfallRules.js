export const KICKFALL_CONFIG = Object.freeze({
  ballQuota: 8,
  spawnIntervalSeconds: 3,
  countdownSeconds: 2,
  armedSeconds: 0.65,
  gateHealth: 1,
  pocketPullSeconds: 0.32,
  chargeTransferRetention: 0.9,
});

const modalElement = (id, x, y, width, height) => Object.freeze({
  id,
  x,
  y,
  width,
  height,
});

export const createKickfallPauseLayout = () => Object.freeze({
  panel: Object.freeze({ x: 640, y: 360, width: 680, height: 360 }),
  title: Object.freeze({ x: 640, y: 228, fontSize: 44 }),
  copy: Object.freeze({ x: 640, y: 292, fontSize: 19, wrapWidth: 540 }),
  buttons: Object.freeze([
    modalElement('resume', 640, 382, 260, 58),
    modalElement('restart', 520, 466, 210, 52),
    modalElement('leave', 760, 466, 210, 52),
  ]),
});

export const createKickfallResultLayout = ({ victory = false, hasNext = false } = {}) => {
  const buttons = victory && hasNext
    ? [
      modalElement('retry', 400, 490, 190, 56),
      modalElement('continue', 640, 490, 190, 56),
      modalElement('menu', 880, 490, 190, 56),
    ]
    : [
      modalElement('retry', 520, 490, 190, 56),
      modalElement('menu', 760, 490, 190, 56),
    ];
  return Object.freeze({
    panel: Object.freeze({ x: 640, y: 360, width: 720, height: 390 }),
    title: Object.freeze({ x: 640, y: 225, fontSize: 48 }),
    copy: Object.freeze({ x: 640, y: 310, fontSize: 19, wrapWidth: 580 }),
    progress: Object.freeze({ x: 640, y: 395, width: 380, height: 42, fontSize: 18 }),
    buttons: Object.freeze(buttons),
  });
};

const TIER_BLUEPRINTS = Object.freeze([
  Object.freeze({ id: 'top', left: 60, width: 1060, y: 195, height: 26, flow: 1 }),
  Object.freeze({ id: 'upper', left: 160, width: 1060, y: 350, height: 26, flow: -1 }),
  Object.freeze({ id: 'lower', left: 60, width: 1060, y: 505, height: 26, flow: 1 }),
  Object.freeze({ id: 'bottom', left: 160, width: 1060, y: 660, height: 26, flow: -1 }),
]);

export const KICKFALL_GATE_LAYOUT = Object.freeze([
  Object.freeze({ id: 'gate-a', tierId: 'top', x: 430, width: 60, height: 112 }),
  Object.freeze({ id: 'gate-b', tierId: 'upper', x: 760, width: 60, height: 112 }),
  Object.freeze({ id: 'gate-c', tierId: 'lower', x: 500, width: 60, height: 112 }),
]);

const LEVEL_TIER_MODES = Object.freeze(['downhill', 'flat', 'uphill']);
const safeTierMode = (mode) => LEVEL_TIER_MODES.includes(mode) ? mode : 'downhill';

export const createKickfallTiers = (level = {}) => TIER_BLUEPRINTS.map((blueprint, index) => {
  const mode = safeTierMode(level.tierModes?.[index]);
  const angle = mode === 'flat'
    ? 0
    : blueprint.flow * (mode === 'uphill' ? -0.026 : 0.035);
  return Object.freeze({
    ...blueprint,
    mode,
    angle,
    rollAssist: mode === 'downhill' ? 1 : mode === 'uphill' ? -0.48 : 0,
  });
});

const FLAT_ENTRY_GUIDE = Object.freeze({
  width: 168,
  height: 54,
  assistSpeed: 4.2,
  wallWidth: 12,
});

export const createKickfallLandingGuides = (tiers = []) => tiers
  .filter((tier) => tier?.mode !== 'downhill' && tier.id !== 'top')
  .map((tier) => {
    const entryX = tier.flow > 0
      ? tier.left
      : tier.left + tier.width;
    const exitX = entryX + tier.flow * FLAT_ENTRY_GUIDE.width;
    const angle = tier.flow * Math.atan2(FLAT_ENTRY_GUIDE.height, FLAT_ENTRY_GUIDE.width);
    const tierCenterX = tier.left + tier.width / 2;
    const surfaceY = tier.y
      + Math.tan(tier.angle) * (exitX - tierCenterX)
      - tier.height / 2;
    return Object.freeze({
      ...FLAT_ENTRY_GUIDE,
      id: `${tier.mode}-entry-${tier.id}`,
      tierId: tier.id,
      flow: tier.flow,
      entryX,
      exitX,
      dropX: entryX + tier.flow * 100,
      centerX: (entryX + exitX) / 2,
      centerY: surfaceY - FLAT_ENTRY_GUIDE.height / 2,
      wallX: entryX - tier.flow * FLAT_ENTRY_GUIDE.wallWidth / 2,
      wallY: surfaceY - FLAT_ENTRY_GUIDE.height / 2,
      rampLength: Math.hypot(FLAT_ENTRY_GUIDE.width, FLAT_ENTRY_GUIDE.height),
      surfaceY,
      angle,
    });
  });

const obstacle = (id, type, tierId, x) => Object.freeze({
  id,
  type,
  tierId,
  x,
  captureRadius: type === 'pocket' ? 48 : 32,
});

const level = ({
  number,
  ballQuota,
  spawnIntervalSeconds,
  timerSeconds,
  tierModes = ['downhill', 'downhill', 'downhill', 'downhill'],
  gateHealth = {},
  obstacles = [],
  boss = null,
}) => Object.freeze({
  number,
  id: `level-${number}`,
  ballQuota,
  spawnIntervalSeconds,
  timerSeconds,
  tierModes: Object.freeze([...tierModes]),
  gateHealth: Object.freeze({ ...gateHealth }),
  obstacles: Object.freeze([...obstacles]),
  boss: boss ? Object.freeze({ ...boss }) : null,
});

export const KICKFALL_LEVELS = Object.freeze([
  level({ number: 1, ballQuota: 8, spawnIntervalSeconds: 3, timerSeconds: 90 }),
  level({
    number: 2,
    ballQuota: 10,
    spawnIntervalSeconds: 2.65,
    timerSeconds: 60,
    obstacles: [obstacle('pocket-a', 'pocket', 'upper', 490), obstacle('cleat-a', 'cleat', 'lower', 820)],
  }),
  level({ number: 3, ballQuota: 8, spawnIntervalSeconds: 3.1, timerSeconds: 78, tierModes: ['flat', 'downhill', 'downhill', 'downhill'] }),
  level({ number: 4, ballQuota: 9, spawnIntervalSeconds: 2.9, timerSeconds: 76, tierModes: ['downhill', 'flat', 'downhill', 'downhill'], obstacles: [obstacle('pocket-a', 'pocket', 'upper', 490)] }),
  level({ number: 5, ballQuota: 10, spawnIntervalSeconds: 2.75, timerSeconds: 76, tierModes: ['flat', 'downhill', 'flat', 'downhill'], gateHealth: { 'gate-b': 2 }, obstacles: [obstacle('cleat-a', 'cleat', 'lower', 820)] }),
  level({ number: 6, ballQuota: 8, spawnIntervalSeconds: 3.2, timerSeconds: 90, tierModes: ['uphill', 'downhill', 'downhill', 'downhill'] }),
  level({ number: 7, ballQuota: 9, spawnIntervalSeconds: 3, timerSeconds: 86, tierModes: ['downhill', 'uphill', 'downhill', 'downhill'], obstacles: [obstacle('pocket-a', 'pocket', 'upper', 490)] }),
  level({ number: 8, ballQuota: 10, spawnIntervalSeconds: 2.8, timerSeconds: 84, tierModes: ['uphill', 'downhill', 'flat', 'downhill'], gateHealth: { 'gate-a': 2 }, obstacles: [obstacle('cleat-a', 'cleat', 'lower', 820)] }),
  level({ number: 9, ballQuota: 11, spawnIntervalSeconds: 2.6, timerSeconds: 82, tierModes: ['downhill', 'uphill', 'downhill', 'flat'], gateHealth: { 'gate-a': 2, 'gate-b': 2 }, obstacles: [obstacle('pocket-a', 'pocket', 'upper', 490), obstacle('cleat-a', 'cleat', 'lower', 820)] }),
  level({ number: 10, ballQuota: 10, spawnIntervalSeconds: 2.8, timerSeconds: 95, tierModes: ['downhill', 'flat', 'downhill', 'downhill'], gateHealth: { 'gate-b': 2 }, obstacles: [obstacle('cleat-a', 'cleat', 'lower', 820)], boss: { hits: 3, startX: 455, kickIntervalSeconds: 1.45, kickSpeed: 14.5 } }),
  level({ number: 11, ballQuota: 11, spawnIntervalSeconds: 2.5, timerSeconds: 82, tierModes: ['flat', 'uphill', 'downhill', 'downhill'], gateHealth: { 'gate-a': 2, 'gate-c': 2 } }),
  level({ number: 12, ballQuota: 12, spawnIntervalSeconds: 2.35, timerSeconds: 80, tierModes: ['uphill', 'flat', 'downhill', 'downhill'], gateHealth: { 'gate-b': 2 }, obstacles: [obstacle('pocket-a', 'pocket', 'upper', 490), obstacle('cleat-a', 'cleat', 'lower', 820)] }),
  level({ number: 13, ballQuota: 12, spawnIntervalSeconds: 2.25, timerSeconds: 80, tierModes: ['uphill', 'downhill', 'uphill', 'downhill'], gateHealth: { 'gate-a': 2, 'gate-b': 2, 'gate-c': 2 }, obstacles: [obstacle('cleat-a', 'cleat', 'lower', 820)] }),
  level({ number: 14, ballQuota: 13, spawnIntervalSeconds: 2.15, timerSeconds: 78, tierModes: ['flat', 'uphill', 'flat', 'downhill'], gateHealth: { 'gate-b': 2, 'gate-c': 2 }, obstacles: [obstacle('pocket-a', 'pocket', 'upper', 490), obstacle('cleat-a', 'cleat', 'lower', 820)] }),
  level({ number: 15, ballQuota: 14, spawnIntervalSeconds: 2.05, timerSeconds: 78, tierModes: ['uphill', 'flat', 'uphill', 'downhill'], gateHealth: { 'gate-a': 2, 'gate-b': 2, 'gate-c': 2 }, obstacles: [obstacle('pocket-a', 'pocket', 'upper', 490), obstacle('cleat-a', 'cleat', 'lower', 820)] }),
  level({ number: 16, ballQuota: 14, spawnIntervalSeconds: 1.95, timerSeconds: 76, tierModes: ['uphill', 'uphill', 'flat', 'downhill'], gateHealth: { 'gate-a': 2, 'gate-b': 2, 'gate-c': 3 }, obstacles: [obstacle('pocket-a', 'pocket', 'upper', 490)] }),
  level({ number: 17, ballQuota: 15, spawnIntervalSeconds: 1.85, timerSeconds: 74, tierModes: ['flat', 'uphill', 'uphill', 'flat'], gateHealth: { 'gate-a': 2, 'gate-b': 3, 'gate-c': 2 }, obstacles: [obstacle('cleat-top', 'cleat', 'top', 680), obstacle('pocket-a', 'pocket', 'upper', 490), obstacle('cleat-a', 'cleat', 'lower', 820)] }),
  level({ number: 18, ballQuota: 16, spawnIntervalSeconds: 1.75, timerSeconds: 74, tierModes: ['uphill', 'flat', 'uphill', 'uphill'], gateHealth: { 'gate-a': 3, 'gate-b': 2, 'gate-c': 3 }, obstacles: [obstacle('pocket-a', 'pocket', 'upper', 490), obstacle('pocket-bottom', 'pocket', 'bottom', 540)] }),
  level({ number: 19, ballQuota: 16, spawnIntervalSeconds: 1.65, timerSeconds: 72, tierModes: ['uphill', 'uphill', 'flat', 'uphill'], gateHealth: { 'gate-a': 3, 'gate-b': 3, 'gate-c': 3 }, obstacles: [obstacle('cleat-top', 'cleat', 'top', 680), obstacle('pocket-a', 'pocket', 'upper', 490), obstacle('cleat-a', 'cleat', 'lower', 820)] }),
  level({ number: 20, ballQuota: 18, spawnIntervalSeconds: 1.55, timerSeconds: 110, tierModes: ['uphill', 'flat', 'uphill', 'downhill'], gateHealth: { 'gate-a': 3, 'gate-b': 3, 'gate-c': 3 }, obstacles: [obstacle('cleat-top', 'cleat', 'top', 680), obstacle('pocket-a', 'pocket', 'upper', 490), obstacle('cleat-a', 'cleat', 'lower', 820)], boss: { hits: 5, startX: 560, kickIntervalSeconds: 1.1, kickSpeed: 16 } }),
]);

export const getKickfallLevel = (number = 1) => {
  const requested = Math.max(1, Math.floor(Number(number) || 1));
  return KICKFALL_LEVELS.find((level) => level.number === requested)
    ?? KICKFALL_LEVELS[KICKFALL_LEVELS.length - 1];
};

export const getKickfallGateHealth = (levelConfig, gateId) => Math.max(
  1,
  Math.floor(Number(levelConfig?.gateHealth?.[gateId]) || KICKFALL_CONFIG.gateHealth),
);

const ROUTE_AUDIT = Object.freeze({
  ballRadius: 18,
  playerHalfWidth: 22,
  playerStrikeCenterOffset: 52,
  minimumReceiverWidth: 122,
  minimumFinishWindowSeconds: 30,
  topSpawnX: 220,
  playerWorldLeft: 58,
  playerWorldRight: 1222,
});

const routeExitX = (tier) => tier.flow > 0 ? tier.left + tier.width : tier.left;
const insidePlayerReach = (tier, x) => (
  x >= Math.max(ROUTE_AUDIT.playerWorldLeft, tier.left + ROUTE_AUDIT.playerHalfWidth)
  && x <= Math.min(ROUTE_AUDIT.playerWorldRight, tier.left + tier.width - ROUTE_AUDIT.playerHalfWidth)
);

export const auditKickfallLevel = (levelConfig) => {
  const level = levelConfig ?? KICKFALL_LEVELS[0];
  const tiers = createKickfallTiers(level);
  const guides = createKickfallLandingGuides(tiers);
  const issues = [];
  const tierAudits = tiers.map((tier, index) => {
    const guide = guides.find((candidate) => candidate.tierId === tier.id) ?? null;
    const requiresReceiver = index > 0 && tier.mode !== 'downhill';
    const receiverClear = !requiresReceiver || Boolean(
      guide && guide.width >= ROUTE_AUDIT.minimumReceiverWidth,
    );
    if (!receiverClear) issues.push(`${tier.id}: missing inward receiver for ${tier.mode} entry`);
    return {
      tierId: tier.id,
      mode: tier.mode,
      requiresReceiver,
      receiverClear,
      guideId: guide?.id ?? null,
      receiverWidth: guide?.width ?? 0,
    };
  });

  const gateAudits = KICKFALL_GATE_LAYOUT.map((gate) => {
    const tier = tiers.find((candidate) => candidate.id === gate.tierId);
    const guide = guides.find((candidate) => candidate.tierId === gate.tierId);
    const routeEntryX = tier.id === 'top'
      ? ROUTE_AUDIT.topSpawnX
      : guide?.exitX ?? (tier.flow > 0 ? tier.left : tier.left + tier.width);
    const upstreamBallX = gate.x - tier.flow * (gate.width / 2 + ROUTE_AUDIT.ballRadius + 2);
    const playerX = upstreamBallX - tier.flow * ROUTE_AUDIT.playerStrikeCenterOffset;
    const approachClear = insidePlayerReach(tier, playerX);
    const orderedAfterEntry = (gate.x - routeEntryX) * tier.flow
      > gate.width / 2 + ROUTE_AUDIT.ballRadius;
    const exitClear = (routeExitX(tier) - gate.x) * tier.flow
      > gate.width / 2 + ROUTE_AUDIT.ballRadius;
    if (!approachClear) issues.push(`${gate.id}: no player standing point behind the strike ball`);
    if (!orderedAfterEntry) issues.push(`${gate.id}: overlaps or precedes its lane entry`);
    if (!exitClear) issues.push(`${gate.id}: leaves no downstream exit clearance`);
    return {
      gateId: gate.id,
      tierId: gate.tierId,
      health: getKickfallGateHealth(level, gate.id),
      approachClear,
      orderedAfterEntry,
      exitClear,
    };
  });

  const obstacleAudits = level.obstacles.map((obstacleConfig) => {
    const tier = tiers.find((candidate) => candidate.id === obstacleConfig.tierId);
    const gate = KICKFALL_GATE_LAYOUT.find((candidate) => candidate.tierId === tier.id);
    const playerX = obstacleConfig.x - tier.flow * ROUTE_AUDIT.playerStrikeCenterOffset;
    const approachClear = insidePlayerReach(tier, playerX);
    const orderedAfterGate = !gate || (obstacleConfig.x - gate.x) * tier.flow
      > gate.width / 2 + obstacleConfig.captureRadius;
    const exitClear = (routeExitX(tier) - obstacleConfig.x) * tier.flow
      > obstacleConfig.captureRadius + ROUTE_AUDIT.ballRadius;
    if (!approachClear) issues.push(`${obstacleConfig.id}: no player standing point behind the captive ball`);
    if (!orderedAfterGate) issues.push(`${obstacleConfig.id}: blocks the lane before its gate can be approached`);
    if (!exitClear) issues.push(`${obstacleConfig.id}: leaves no downstream exit clearance`);
    return {
      obstacleId: obstacleConfig.id,
      tierId: obstacleConfig.tierId,
      approachClear,
      orderedAfterGate,
      exitClear,
    };
  });

  const latestSpawnSeconds = Math.max(0, level.ballQuota - 1) * level.spawnIntervalSeconds;
  const finishWindowSeconds = level.timerSeconds - latestSpawnSeconds;
  if (finishWindowSeconds < ROUTE_AUDIT.minimumFinishWindowSeconds) {
    issues.push(`clock: only ${finishWindowSeconds.toFixed(2)}s remain after the last scheduled ball`);
  }
  const topStrikeX = ROUTE_AUDIT.topSpawnX - ROUTE_AUDIT.playerStrikeCenterOffset;
  if (topStrikeX < ROUTE_AUDIT.playerWorldLeft) {
    issues.push('top: the intake rail leaves no legal standing point behind a spawned ball');
  }
  const maximumRequiredHits = Math.max(
    ...gateAudits.map(({ health }) => health),
    level.boss?.hits ?? 0,
  );
  if (level.ballQuota < maximumRequiredHits) {
    issues.push('quota: fewer balls than the strongest required gate or rival hit count');
  }
  const bossAudit = level.boss ? {
    hits: level.boss.hits,
    approachClear: insidePlayerReach(
      tiers[3],
      level.boss.startX - tiers[3].flow * (
        ROUTE_AUDIT.playerStrikeCenterOffset + ROUTE_AUDIT.ballRadius
      ),
    ),
  } : null;
  if (bossAudit && !bossAudit.approachClear) {
    issues.push('boss: no legal standing point behind the final-lane strike ball');
  }

  return {
    levelNumber: level.number,
    valid: issues.length === 0,
    issues,
    latestSpawnSeconds,
    finishWindowSeconds,
    tiers: tierAudits,
    gates: gateAudits,
    obstacles: obstacleAudits,
    boss: bossAudit,
  };
};

export const auditKickfallCampaign = () => KICKFALL_LEVELS.map(auditKickfallLevel);

export const isArmedGateHit = ({
  armedUntil = 0,
  now = 0,
  gateId = '',
  damagedGateIds = [],
} = {}) => (
  Number(armedUntil) > Number(now)
  && Boolean(gateId)
  && !damagedGateIds.includes(gateId)
);

export const isKickfallKickContact = ({
  playerX = 0,
  playerY = 0,
  facing = 1,
  ballX = 0,
  ballY = 0,
  ballRadius = 0,
  footForwardOffset = 0,
  footVerticalOffset = 0,
  footRadius = 0,
} = {}) => {
  const direction = Math.sign(Number(facing)) || 1;
  const footX = Number(playerX) + direction * Math.max(0, Number(footForwardOffset) || 0);
  const footY = Number(playerY) + (Number(footVerticalOffset) || 0);
  const contactRadius = Math.max(0, Number(ballRadius) || 0) + Math.max(0, Number(footRadius) || 0);
  return Math.hypot(Number(ballX) - footX, Number(ballY) - footY) <= contactRadius;
};

export const resolveKickfallVerticalIntent = ({
  jumpPressed = false,
  upHeld = false,
  downHeld = false,
} = {}) => {
  const verticalDirection = Number(Boolean(downHeld)) - Number(Boolean(upHeld));
  const tierDirection = jumpPressed ? verticalDirection : 0;
  return {
    tierDirection,
    jump: Boolean(jumpPressed) && tierDirection === 0,
  };
};

export const stepKickfallJumpBuffer = ({
  seconds = 0,
  jumpPressed = false,
  dt = 0,
  bufferSeconds = 0.14,
} = {}) => (
  jumpPressed
    ? Math.max(0, Number(bufferSeconds) || 0)
    : Math.max(0, (Number(seconds) || 0) - Math.max(0, Number(dt) || 0))
);

export const stepKickfallRunCycle = ({
  cycle = 0,
  dt = 0,
  speed = 0,
  maxSpeed = 12.5,
  minFramesPerSecond = 6,
  maxFramesPerSecond = 9,
} = {}) => {
  const absoluteSpeed = Math.abs(Number(speed) || 0);
  if (absoluteSpeed <= 0) return Number(cycle) || 0;
  const speedRatio = Math.min(1, absoluteSpeed / Math.max(0.01, Number(maxSpeed) || 0.01));
  const minimumCadence = Math.max(0, Number(minFramesPerSecond) || 0);
  const maximumCadence = Math.max(minimumCadence, Number(maxFramesPerSecond) || 0);
  const framesPerSecond = minimumCadence + (maximumCadence - minimumCadence) * speedRatio;
  return (Number(cycle) || 0) + Math.max(0, Number(dt) || 0) * framesPerSecond;
};

export const resolveKickfallChargeTransfer = ({
  sourceX = 0,
  sourceY = 0,
  sourceVx = 0,
  sourceArmedUntil = 0,
  sourceImpactPower = 1,
  targetX = 0,
  targetY = 0,
  targetVx = 0,
  targetArmedUntil = 0,
  now = 0,
  contactDistance = 40,
  laneTolerance = 28,
  minimumSpeed = 4,
  chargeRetention = KICKFALL_CONFIG.chargeTransferRetention,
} = {}) => {
  const velocityX = Number(sourceVx) || 0;
  const direction = Math.sign(velocityX);
  const horizontalDistance = Math.abs((Number(targetX) || 0) - (Number(sourceX) || 0));
  const verticalDistance = Math.abs((Number(targetY) || 0) - (Number(sourceY) || 0));
  const targetAhead = ((Number(targetX) || 0) - (Number(sourceX) || 0)) * direction > 0;
  if (
    !direction
    || Math.abs(velocityX) < Math.max(0, Number(minimumSpeed) || 0)
    || Number(sourceArmedUntil) <= Number(now)
    || Number(targetArmedUntil) >= Number(sourceArmedUntil)
    || !targetAhead
    || horizontalDistance > Math.max(0, Number(contactDistance) || 0)
    || verticalDistance > Math.max(0, Number(laneTolerance) || 0)
  ) return null;
  return {
    direction,
    sourceArmedUntil: 0,
    sourceImpactPower: 0,
    targetArmedUntil: Number(sourceArmedUntil),
    targetImpactPower: Math.max(0, Number(sourceImpactPower) || 0)
      * Math.min(1, Math.max(0, Number(chargeRetention) || 0)),
    targetVelocityX: direction * Math.max(
      5.5,
      Math.abs(velocityX) * 0.84,
      Math.abs(Number(targetVx) || 0),
    ),
  };
};

export const resolveKickfallBossCounterWave = ({
  targetId = null,
  balls = [],
  direction = 1,
  kickSpeed = 14,
  maximumGap = 8,
  suppressAssistSeconds = 0.9,
} = {}) => {
  const counterDirection = Math.sign(Number(direction) || 0) || 1;
  const target = balls.find((ball) => ball?.id === targetId);
  if (!target) return [];
  const ordered = balls
    .filter((ball) => ball && (Number(ball.x) - Number(target.x)) * counterDirection >= 0)
    .sort((a, b) => (
      (Number(a.x) - Number(target.x)) * counterDirection
      - (Number(b.x) - Number(target.x)) * counterDirection
    ));
  const wave = [];
  let previous = null;
  for (const ball of ordered) {
    if (previous) {
      const centerDistance = (Number(ball.x) - Number(previous.x)) * counterDirection;
      const contactDistance = Math.max(0, Number(ball.radius) || 0)
        + Math.max(0, Number(previous.radius) || 0);
      if (centerDistance - contactDistance > Math.max(0, Number(maximumGap) || 0)) break;
    }
    const attenuation = Math.max(0.72, 1 - wave.length * 0.04);
    wave.push({
      id: ball.id,
      velocityX: counterDirection * Math.max(0, Number(kickSpeed) || 0) * attenuation,
      velocityY: -2.2,
      suppressAssistSeconds: Math.max(0, Number(suppressAssistSeconds) || 0),
    });
    previous = ball;
  }
  return wave;
};

export const stepKickfallFallVelocity = ({
  velocityY = 0,
  acceleration = 0.5,
  maxVelocity = 15,
} = {}) => Math.min(
  Math.max(0, Number(maxVelocity) || 0),
  (Number(velocityY) || 0) + Math.max(0, Number(acceleration) || 0),
);

export const resolveKickfallMagnetPull = ({
  startX = 0,
  startY = 0,
  targetX = 0,
  targetY = 0,
  elapsed = 0,
  duration = KICKFALL_CONFIG.pocketPullSeconds,
  arcHeight = 10,
} = {}) => {
  const safeDuration = Math.max(Number.EPSILON, Number(duration) || 0);
  const progress = Math.min(1, Math.max(0, (Number(elapsed) || 0) / safeDuration));
  if (progress >= 1) {
    return {
      x: Number(targetX) || 0,
      y: Number(targetY) || 0,
      progress: 1,
      scale: 1,
      turnRadians: Math.PI * 1.25,
      complete: true,
    };
  }
  const eased = progress * progress * (3 - 2 * progress);
  const lift = Math.sin(progress * Math.PI) * Math.max(0, Number(arcHeight) || 0);
  return {
    x: (Number(startX) || 0) + ((Number(targetX) || 0) - (Number(startX) || 0)) * eased,
    y: (Number(startY) || 0) + ((Number(targetY) || 0) - (Number(startY) || 0)) * eased - lift,
    progress,
    scale: 1 - Math.sin(progress * Math.PI) * 0.08,
    turnRadians: eased * Math.PI * 1.25,
    complete: false,
  };
};

export const resolveKickfallOutcome = ({
  spawned = 0,
  quota = KICKFALL_CONFIG.ballQuota,
  drained = 0,
  activeBalls = 0,
  timeRemaining = null,
  bossRequired = false,
  bossDefeated = true,
} = {}) => {
  if (Number.isFinite(timeRemaining) && timeRemaining <= 0) return 'defeat';
  if (spawned >= quota && drained >= quota && activeBalls === 0 && (!bossRequired || bossDefeated)) return 'victory';
  return null;
};

export const createKickfallProgress = (overrides = {}) => ({
  spawned: 0,
  drained: 0,
  gatesBroken: 0,
  obstacleClears: 0,
  ...overrides,
});
