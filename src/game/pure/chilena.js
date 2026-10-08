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

/** Classic trigger: the ball must be at least this share of the player height above the body centre. */
export const CHILENA_MIN_UPWARD_RATIO = 0.18;
/**
 * Framed (roster-v2) trigger. The contact drawing's boot sits well above the
 * head, so balls below about 76 px over the body centre cannot be met by it
 * (test/sprite-redo.test.js reachability sweep: every still ball from 76 px up
 * connects). 0.32 x 240 = 76.8 px, scaled with the player like the classic zone.
 */
export const CHILENA_FRAMED_MIN_UPWARD_RATIO = 0.32;

export const evaluateChilenaEligibility = ({
  fighter = {},
  ball = {},
  kickPresses = 0,
  minimumUpwardRatio = CHILENA_MIN_UPWARD_RATIO,
} = {}) => {
  const height = Math.max(1, Number(fighter.height) || 0);
  const dx = Math.abs((Number(ball.x) || 0) - (Number(fighter.x) || 0));
  const upwardDistance = (Number(fighter.y) || 0) - (Number(ball.y) || 0);
  const distance = Math.hypot(dx, upwardDistance);
  const minimumUpwardDistance = height * minimumUpwardRatio;
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

// Redirect at the apex height, or one tick early when the next step would
// cross it: framed chilenas meet the ball higher (at boot contact), so the
// lob reaches the apex line faster and would otherwise overshoot by a tick.
export const shouldRedirectLobChilena = ({ ballY, velocityY, apexY = CHILENA_LOB_APEX_Y } = {}) => {
  const y = Number(ballY) || 0;
  const vy = Number(velocityY) || 0;
  return y + Math.min(0, vy) <= apexY || vy >= 0;
};

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

/*
 * Framed chilena (sprite-redo atlases). The move adapts to the ball: the jump
 * is steered so the boot on the authored contact drawing meets the ball, and
 * the shot is applied at that moment instead of on the button press. The ball
 * and the fighter share the world gravity, so the gravity terms cancel in their
 * relative motion; a closed loop re-aims every tick to absorb air friction,
 * gravity assists and the clamped velocities.
 */

/** Earliest and latest planned contact after takeoff (seconds). */
export const CHILENA_CONTACT_MIN_SECONDS = 0.14;
export const CHILENA_CONTACT_MAX_SECONDS = 0.3;
/** After this long without contact the ball has clearly left: no strike. */
export const CHILENA_GUIDE_MAX_SECONDS = 0.42;
/** Boot-to-ball-surface distance (px) that counts as touching. */
export const CHILENA_CONTACT_SLOP = 12;
/**
 * A ball this close to the boot (surface gap, px) is struck at the planned
 * contact time, or at its closest approach if it is already moving away.
 * About 1.5 ball radii: the boot visibly touches the ball.
 */
export const CHILENA_FORGIVE_RADIUS = 32;
/** Share of the velocity error corrected per tick. */
export const CHILENA_GUIDANCE_GAIN = 0.55;
export const CHILENA_GUIDANCE_LIMITS = Object.freeze({ minVx: -8, maxVx: 8, minVy: -15, maxVy: 6 });

const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

/** Planned contact time: higher balls are met later, as the player rises. */
export const chilenaContactTargetSeconds = ({ upwardDistance = 0, height = 1 } = {}) => {
  const reach = Math.max(0, Number(upwardDistance) || 0) / Math.max(1, Number(height) || 1);
  return clampValue(
    CHILENA_CONTACT_MIN_SECONDS + reach * 0.16,
    CHILENA_CONTACT_MIN_SECONDS,
    CHILENA_CONTACT_MAX_SECONDS,
  );
};

/**
 * Next fighter velocity (px/tick) that brings the boot to the ball in the
 * remaining time. `boot`, `ball` in world px; velocities in px/tick.
 */
export const chilenaGuidanceVelocity = ({
  boot,
  ball,
  ballVelocity = { x: 0, y: 0 },
  velocity = { x: 0, y: 0 },
  secondsLeft = 0,
  gain = CHILENA_GUIDANCE_GAIN,
  limits = CHILENA_GUIDANCE_LIMITS,
} = {}) => {
  const ticks = Math.max(1, (Number(secondsLeft) || 0) * 60);
  const required = {
    x: (ball.x - boot.x) / ticks + (Number(ballVelocity.x) || 0),
    y: (ball.y - boot.y) / ticks + (Number(ballVelocity.y) || 0),
  };
  return {
    x: clampValue(velocity.x + (required.x - velocity.x) * gain, limits.minVx, limits.maxVx),
    y: clampValue(velocity.y + (required.y - velocity.y) * gain, limits.minVy, limits.maxVy),
  };
};

export const chilenaSurfaceDistance = ({ boot, ball, ballRadius = 22 }) => (
  Math.hypot(ball.x - boot.x, ball.y - boot.y) - ballRadius
);

/**
 * 'contact' | 'pending' | 'missed' for this tick. `previousSurfaceDistance`
 * (null on the first tick) lets a ball that is already moving away be struck
 * at its closest approach instead of waiting for the planned time.
 */
export const resolveChilenaContact = ({
  boot,
  ball,
  ballRadius = 22,
  elapsed = 0,
  targetSeconds = CHILENA_CONTACT_MIN_SECONDS,
  previousSurfaceDistance = null,
} = {}) => {
  const surfaceDistance = chilenaSurfaceDistance({ boot, ball, ballRadius });
  if (surfaceDistance <= CHILENA_CONTACT_SLOP) return 'contact';
  if (surfaceDistance <= CHILENA_FORGIVE_RADIUS) {
    const recedingSince = previousSurfaceDistance !== null && surfaceDistance > previousSurfaceDistance + 0.5;
    if (elapsed >= targetSeconds || recedingSince) return 'contact';
  }
  if (elapsed >= CHILENA_GUIDE_MAX_SECONDS) return 'missed';
  return 'pending';
};

/** World gravity per fixed tick (Matter gravity y 1.08 at scale 0.001, 60 Hz). */
export const CHILENA_WORLD_GRAVITY_PER_TICK = 1.08 * 0.001 * (1000 / 60) ** 2;

/**
 * Deterministic forward plan of a framed chilena, using the same controller
 * as the game: would the contact drawing's boot meet this ball? Eligibility
 * uses it so a chilena only starts when it will connect; anything else stays
 * an ordinary kick. Positions in world px, velocities in px/tick.
 *
 *   fighter: { x, y, bodyBottomOffset, vx?, frictionAir? }
 *   ball:    { x, y, vx, vy, radius, frictionAir? }
 *   bootOffset: boot point relative to (fighter.x, body bottom) for the chilena facing
 */
export const planFramedChilena = ({
  fighter,
  ball,
  bootOffset,
  groundY,
  targetSeconds,
  takeoffVelocityY = CHILENA_TAKEOFF_VELOCITY,
  gravity = CHILENA_WORLD_GRAVITY_PER_TICK,
} = {}) => {
  const body = {
    x: fighter.x,
    y: fighter.y,
    vx: Number(fighter.vx) || 0,
    vy: takeoffVelocityY,
    drag: 1 - (Number(fighter.frictionAir) || 0.018),
  };
  const target = {
    x: ball.x,
    y: ball.y,
    vx: Number(ball.vx) || 0,
    vy: Number(ball.vy) || 0,
    drag: 1 - (Number(ball.frictionAir) || 0.012),
  };
  const restY = groundY - fighter.bodyBottomOffset;
  let previousSurfaceDistance = null;
  for (let tick = 0; tick <= Math.ceil(CHILENA_GUIDE_MAX_SECONDS * 60) + 1; tick += 1) {
    const elapsed = tick / 60;
    const boot = { x: body.x + bootOffset.x, y: body.y + fighter.bodyBottomOffset + bootOffset.y };
    const outcome = resolveChilenaContact({
      boot,
      ball: target,
      ballRadius: ball.radius,
      elapsed,
      targetSeconds,
      previousSurfaceDistance,
    });
    if (outcome !== 'pending') {
      return {
        reachable: outcome === 'contact',
        contactSeconds: outcome === 'contact' ? elapsed : null,
        surfaceDistance: chilenaSurfaceDistance({ boot, ball: target, ballRadius: ball.radius }),
      };
    }
    previousSurfaceDistance = chilenaSurfaceDistance({ boot, ball: target, ballRadius: ball.radius });
    const next = chilenaGuidanceVelocity({
      boot,
      ball: target,
      ballVelocity: { x: target.vx, y: target.vy },
      velocity: { x: body.vx, y: body.vy },
      secondsLeft: Math.max(1 / 60, targetSeconds - elapsed),
    });
    body.vx = next.x;
    body.vy = next.y;
    for (const moving of [body, target]) {
      moving.vy += gravity;
      moving.vx *= moving.drag;
      moving.vy *= moving.drag;
      moving.x += moving.vx;
      moving.y += moving.vy;
    }
    if (body.y > restY) {
      body.y = restY;
      body.vy = Math.min(0, body.vy);
    }
  }
  return { reachable: false, contactSeconds: null, surfaceDistance: null };
};
