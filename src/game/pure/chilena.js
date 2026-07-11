export const CHILENA_FIRE_COLOR = 0xff5a24;
export const CHILENA_REQUIRED_KICK_PRESSES = 2;
export const CHILENA_ROTATION_SECONDS = 0.58;
export const CHILENA_MIN_AIRTIME_SECONDS = 0.46;
export const CHILENA_MAX_SECONDS = 1.1;
export const CHILENA_TAKEOFF_VELOCITY = -10.8;

export const canStartChilena = ({ fighter = {}, ball = {}, kickPresses = 0 } = {}) => {
  const height = Math.max(1, Number(fighter.height) || 0);
  const dx = Math.abs((Number(ball.x) || 0) - (Number(fighter.x) || 0));
  const upwardDistance = (Number(fighter.y) || 0) - (Number(ball.y) || 0);
  const distance = Math.hypot(dx, upwardDistance);
  return Boolean(
    fighter.grounded
    && !fighter.stunned
    && !fighter.active
    && kickPresses >= CHILENA_REQUIRED_KICK_PRESSES
    && upwardDistance >= height * 0.18
    && dx <= height * 0.45
    && distance <= height
  );
};

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

export const chilenaRotationAt = (elapsedSeconds = 0) => {
  const progress = Math.min(1, Math.max(0, Number(elapsedSeconds) || 0) / CHILENA_ROTATION_SECONDS);
  return Math.round(progress * 3600) / 10;
};
