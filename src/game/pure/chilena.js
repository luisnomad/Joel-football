export const CHILENA_FIRE_COLOR = 0xff5a24;
export const CHILENA_REQUIRED_KICK_PRESSES = 2;
export const CHILENA_ROTATION_SECONDS = 0.58;
export const CHILENA_MIN_AIRTIME_SECONDS = 0.46;
export const CHILENA_MAX_SECONDS = 1.1;
export const CHILENA_TAKEOFF_VELOCITY = -10.8;
export const CHILENA_LOB_APEX_Y = 150;
// A touch player's second tap arrives while the ball is still falling. This
// launch reaches the declared scoreboard apex from the bottom of the legal
// chilena trigger zone instead of relying on frame-perfect input.
export const CHILENA_LOB_RISE_SPEED = 17;

export const evaluateChilenaEligibility = ({ fighter = {}, ball = {}, kickPresses = 0 } = {}) => {
  const height = Math.max(1, Number(fighter.height) || 0);
  const dx = Math.abs((Number(ball.x) || 0) - (Number(fighter.x) || 0));
  const upwardDistance = (Number(fighter.y) || 0) - (Number(ball.y) || 0);
  const distance = Math.hypot(dx, upwardDistance);
  const minimumUpwardDistance = height * 0.18;
  const maximumHorizontalDistance = height * 0.45;
  let reason = 'eligible';
  if (!fighter.grounded) reason = 'airborne';
  else if (fighter.stunned) reason = 'stunned';
  else if (fighter.active) reason = 'already-active';
  else if (kickPresses < CHILENA_REQUIRED_KICK_PRESSES) reason = 'needs-second-press';
  else if (upwardDistance < minimumUpwardDistance) reason = 'ball-not-overhead';
  else if (dx > maximumHorizontalDistance) reason = 'ball-too-far-sideways';
  else if (distance > height) reason = 'ball-too-high-or-far';
  return Object.freeze({
    allowed: reason === 'eligible',
    reason,
    dx,
    upwardDistance,
    distance,
    minimumUpwardDistance,
    maximumHorizontalDistance,
    maximumDistance: height,
  });
};

export const canStartChilena = (options = {}) => evaluateChilenaEligibility(options).allowed;

export const CHILENA_SHOT_SPEED = 27;

export const resolveChilenaShot = ({
  attackDirection = 1,
  ballX = 0,
  ballY = 0,
  targetX,
  targetY,
} = {}) => {
  const direction = attackDirection >= 0 ? 1 : -1;
  const safeTargetX = Number.isFinite(targetX) ? targetX : ballX + direction * 500;
  const safeTargetY = Number.isFinite(targetY) ? targetY : ballY;
  const dx = Math.max(60, Math.abs(safeTargetX - ballX)) * direction;
  const dy = safeTargetY - ballY;
  const length = Math.max(1, Math.hypot(dx, dy));
  return {
    vx: dx / length * CHILENA_SHOT_SPEED,
    vy: dy / length * CHILENA_SHOT_SPEED,
    spin: direction * 0.56,
    color: CHILENA_FIRE_COLOR,
    meterAfter: 100,
  };
};

export const resolveLobChilenaLaunch = ({
  attackDirection = 1,
  targetX,
  targetY,
  apexY = CHILENA_LOB_APEX_Y,
} = {}) => {
  const direction = attackDirection >= 0 ? 1 : -1;
  return {
    vx: direction * 2.4,
    vy: -CHILENA_LOB_RISE_SPEED,
    spin: direction * 0.42,
    color: CHILENA_FIRE_COLOR,
    meterAfter: 100,
    trajectory: {
      type: 'lob-chilena',
      phase: 'rising',
      apexY,
      targetX,
      targetY,
    },
  };
};

export const shouldRedirectLobChilena = ({ ballY, velocityY, apexY = CHILENA_LOB_APEX_Y } = {}) =>
  (Number(ballY) || 0) <= apexY || (Number(velocityY) || 0) >= 0;

export const chilenaRotationAt = (elapsedSeconds = 0, attackDirection = 1) => {
  const progress = Math.min(1, Math.max(0, Number(elapsedSeconds) || 0) / CHILENA_ROTATION_SECONDS);
  // Phaser's positive screen-space rotation is clockwise. The fighter has
  // already turned their back to the attacked goal, so leaning backward moves
  // their head toward that goal: left-side attackers spin clockwise and
  // right-side attackers counter-clockwise.
  const direction = Number(attackDirection) >= 0 ? 1 : -1;
  const rotation = Math.round(progress * direction * 3600) / 10;
  return rotation || 0;
};
