import { BALL_RADIUS, PLAYER_TUNING } from '../constants.js';

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
// The high chilena is launched from where the boot actually met the ball so it
// peaks this many px above CHILENA_LOB_APEX_Y: it reaches the line almost at
// rest and the redirect fires there, whichever tick the contact happened on.
export const CHILENA_LOB_PEAK_MARGIN = 4;
// Matter at the 60 Hz fixed step: gravity 1.08 x scale 0.001 x (1000/60)^2.
export const MATTER_GRAVITY_PER_TICK = 1.08 * 0.001 * (1000 / 60) ** 2;

/** Rise (px) of a ball launched upward at `speed` px/tick until it stops. */
export const lobRiseDistance = ({ speed, gravityPerTick = MATTER_GRAVITY_PER_TICK, frictionAir = 0 }) => {
  let velocity = Math.max(0, Number(speed) || 0);
  let rise = 0;
  for (let tick = 0; tick < 600; tick += 1) {
    // Matter: v' = v(1 - frictionAir) + g, then the position moves by v'.
    velocity = velocity * (1 - frictionAir) - gravityPerTick;
    if (velocity <= 0) break;
    rise += velocity;
  }
  return rise;
};

/**
 * Upward launch speed (px/tick) that carries a ball from `ballY` to a peak
 * CHILENA_LOB_PEAK_MARGIN px above `apexY`, for the ball's own air friction
 * and net gravity. Clamped to [minimum, maximum].
 */
export const resolveLobChilenaRiseSpeed = ({
  ballY,
  apexY = CHILENA_LOB_APEX_Y,
  gravityPerTick = MATTER_GRAVITY_PER_TICK,
  frictionAir = 0,
  margin = CHILENA_LOB_PEAK_MARGIN,
  minimum = 4,
  maximum = CHILENA_LOB_RISE_SPEED * 1.5,
} = {}) => {
  const rise = (Number(ballY) || 0) - apexY + margin;
  if (!(gravityPerTick > 0) || rise <= 0) return minimum;
  let low = 0;
  let high = maximum;
  if (lobRiseDistance({ speed: high, gravityPerTick, frictionAir }) < rise) return maximum;
  for (let step = 0; step < 40; step += 1) {
    const middle = (low + high) / 2;
    if (lobRiseDistance({ speed: middle, gravityPerTick, frictionAir }) < rise) low = middle;
    else high = middle;
  }
  return Math.min(maximum, Math.max(minimum, high));
};

/** Classic trigger: the ball must be at least this share of the player height above the body centre. */
export const CHILENA_MIN_UPWARD_RATIO = 0.18;

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
  riseSpeed = CHILENA_LOB_RISE_SPEED,
} = {}) => {
  const direction = attackDirection >= 0 ? 1 : -1;
  return {
    vx: direction * 2.4,
    vy: -riseSpeed,
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
/**
 * Absolute velocity bounds (px/tick). The per-tick flight caps
 * (chilenaFlightLimits) are tighter: they keep the body inside an ordinary
 * jump's height and within half a body width of the takeoff spot.
 */
export const CHILENA_GUIDANCE_LIMITS = Object.freeze({ minVx: -6, maxVx: 6, minVy: -15, maxVy: 6 });

const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

/** World gravity per fixed tick (Matter gravity y 1.08 at scale 0.001, 60 Hz). */
export const CHILENA_WORLD_GRAVITY_PER_TICK = 1.08 * 0.001 * (1000 / 60) ** 2;

/*
 * Framed chilena zone (owner decision 2026-10-12, all characters): the move
 * only starts when the ball is overhead and close enough that an ordinary
 * jump brings the boot of the contact drawing to it. The zone is derived per
 * character from its own geometry (contact boot, head top, normal jump), and
 * the guided flight is capped to the same jump so it never rockets the
 * player toward the top of the screen.
 */

/**
 * Half the player's body width (px): the head collider's radius (43 at body
 * scale 1), the widest part of the compound. "Overhead" means the ball centre
 * is above the span from the far shoulder to the boot, widened by this much
 * on each side - i.e. within one body width of the body or the boot.
 */
export const CHILENA_BODY_HALF_WIDTH = 43;
/** Pixels the body may exceed its normal jump apex (one-tick rounding). */
export const CHILENA_APEX_TOLERANCE = 2;
/**
 * Upward speed cap model (px/tick^2): world gravity plus the fast-fall every
 * airborne fighter feels on an ordinary jump. Capping the rise speed at
 * sqrt(2 * a * headroom) means the body can never climb past the headroom,
 * even if guidance stops (after contact the fall is faster still).
 */
export const CHILENA_RISE_DECELERATION = CHILENA_WORLD_GRAVITY_PER_TICK + PLAYER_TUNING.fastFallAcceleration;
/** Post-contact fall acceleration added per tick (Fighter.updateFramedChilena). */
export const CHILENA_POST_CONTACT_FAST_FALL = PLAYER_TUNING.fastFallAcceleration * 1.55;

/**
 * Rise (px) of the body on an ordinary jump, replaying the fighter's per-tick
 * physics: launch velocity, the airborne fast-fall, then Matter's air drag and
 * world gravity. `launchVelocity` is the character's jump velocity (px/tick,
 * negative = up), e.g. PLAYER_TUNING.jumpVelocity scaled by its jump stat.
 */
export const normalJumpRise = ({
  launchVelocity = PLAYER_TUNING.jumpVelocity,
  fastFall = PLAYER_TUNING.fastFallAcceleration,
  gravity = CHILENA_WORLD_GRAVITY_PER_TICK,
  frictionAir = 0.018,
} = {}) => {
  let vy = Number(launchVelocity) || 0;
  let rise = 0;
  let apex = 0;
  for (let tick = 0; tick < 600 && vy < 0; tick += 1) {
    vy = (vy + fastFall) * (1 - frictionAir) + gravity;
    rise -= vy;
    apex = Math.max(apex, rise);
  }
  return apex;
};

/**
 * Per-character trigger zone in world px for a grounded fighter.
 *   bodyX:       body centre x
 *   bodyBottomY: body bottom (feet) y
 *   headTopY:    top of the head collider y
 *   bootOffset:  contact-drawing boot relative to (bodyX, bodyBottomY), chilena facing
 *   jumpRise:    the character's normal jump rise (normalJumpRise)
 * The ball centre must be at or above head level (`lowestBallY`), no higher
 * than the boot can touch at the normal jump apex (`highestBallY`: boot
 * apex minus ball radius and contact slop), and horizontally between `left`
 * and `right`.
 */
export const framedChilenaZone = ({
  bodyX,
  bodyBottomY,
  headTopY,
  bootOffset,
  jumpRise,
  ballRadius = BALL_RADIUS,
  bodyHalfWidth = CHILENA_BODY_HALF_WIDTH,
}) => {
  const bootX = bodyX + bootOffset.x;
  const bootY = bodyBottomY + bootOffset.y;
  return Object.freeze({
    bootX,
    bootY,
    lowestBallY: headTopY,
    highestBallY: bootY - jumpRise - (ballRadius + CHILENA_CONTACT_SLOP),
    left: Math.min(bodyX, bootX) - bodyHalfWidth,
    right: Math.max(bodyX, bootX) + bodyHalfWidth,
    maxRise: jumpRise,
    maxSideTravel: bodyHalfWidth,
  });
};

/**
 * Framed eligibility against a framedChilenaZone. Reasons match the classic
 * gate: 'ball-not-overhead' (below head level), 'ball-too-far-sideways',
 * 'ball-too-high-or-far' (beyond the boot's normal-jump reach).
 */
export const evaluateFramedChilenaEligibility = ({
  fighter = {},
  ball = {},
  kickPresses = 0,
  zone,
} = {}) => {
  const bodyX = Number(fighter.x) || 0;
  const bodyY = Number(fighter.y) || 0;
  const ballX = Number(ball.x) || 0;
  const ballY = Number(ball.y) || 0;
  const dx = Math.abs(ballX - bodyX);
  const upwardDistance = bodyY - ballY;
  let reason = 'eligible';
  if (!fighter.grounded) reason = 'airborne';
  else if (fighter.stunned) reason = 'stunned';
  else if (fighter.active) reason = 'already-active';
  else if (kickPresses < CHILENA_REQUIRED_KICK_PRESSES) reason = 'needs-second-press';
  else if (ballY > zone.lowestBallY) reason = 'ball-not-overhead';
  else if (ballX < zone.left || ballX > zone.right) reason = 'ball-too-far-sideways';
  else if (ballY < zone.highestBallY) reason = 'ball-too-high-or-far';
  return Object.freeze({
    allowed: reason === 'eligible',
    reason,
    dx,
    upwardDistance,
    distance: Math.hypot(dx, upwardDistance),
    minimumUpwardDistance: bodyY - zone.lowestBallY,
    maximumHorizontalDistance: Math.max(bodyX - zone.left, zone.right - bodyX),
    maximumDistance: bodyY - zone.highestBallY,
    // Boot rise still needed to touch the ball; drives the planned contact time.
    bootRiseNeeded: Math.max(0, zone.bootY - ballY - BALL_RADIUS),
    maxRise: zone.maxRise,
    maxSideTravel: zone.maxSideTravel,
  });
};

/**
 * Velocity bounds (px/tick) for this tick of a framed chilena. `rise` is the
 * body's height above its takeoff position and `sideOffset` its horizontal
 * travel since takeoff. The upward cap shrinks to zero at the normal jump
 * apex; the sideways cap stops the body `maxSideTravel` from takeoff.
 */
export const chilenaFlightLimits = ({
  rise = 0,
  maxRise = Infinity,
  sideOffset = 0,
  maxSideTravel = Infinity,
  limits = CHILENA_GUIDANCE_LIMITS,
} = {}) => {
  const climb = Math.sqrt(2 * CHILENA_RISE_DECELERATION * Math.max(0, maxRise - rise));
  return {
    minVx: clampValue(-maxSideTravel - sideOffset, limits.minVx, limits.maxVx),
    maxVx: clampValue(maxSideTravel - sideOffset, limits.minVx, limits.maxVx),
    minVy: climb > 0 ? Math.min(0, Math.max(limits.minVy, -climb)) : 0,
    maxVy: limits.maxVy,
  };
};

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

/**
 * Deterministic forward plan of a framed chilena, using the same controller
 * and flight caps as the game: would the contact drawing's boot meet this
 * ball? Eligibility uses it so a chilena only starts when it will connect;
 * anything else stays an ordinary kick. Positions in world px, velocities in
 * px/tick. Integration follows Matter: v = v * (1 - frictionAir) + gravity.
 *
 *   fighter: { x, y, bodyBottomOffset, vx?, frictionAir? }
 *   ball:    { x, y, vx, vy, radius, frictionAir? }
 *   bootOffset: boot point relative to (fighter.x, body bottom) for the chilena facing
 *   maxRise / maxSideTravel: flight caps (framedChilenaZone), measured from takeoff
 *
 * Also returns the body's highest rise over the whole move (`apexRise`,
 * continuing after contact with the post-contact fast fall) and its largest
 * sideways travel before contact (`sideTravel`).
 */
export const planFramedChilena = ({
  fighter,
  ball,
  bootOffset,
  groundY,
  targetSeconds,
  maxRise = Infinity,
  maxSideTravel = Infinity,
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
  const takeoff = { x: fighter.x, y: fighter.y };
  let apexRise = 0;
  let sideTravel = 0;
  const step = (moving, extraGravity = 0) => {
    moving.vx *= moving.drag;
    moving.vy = (moving.vy + extraGravity) * moving.drag + gravity;
    moving.x += moving.vx;
    moving.y += moving.vy;
  };
  // After contact the guidance stops and the body falls faster: follow it up
  // to its apex so the plan reports the full height of the move.
  const finishApex = () => {
    for (let tick = 0; tick < 120 && body.vy < 0; tick += 1) {
      step(body, CHILENA_POST_CONTACT_FAST_FALL);
      apexRise = Math.max(apexRise, takeoff.y - body.y);
    }
    return apexRise;
  };
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
        apexRise: finishApex(),
        sideTravel,
      };
    }
    previousSurfaceDistance = chilenaSurfaceDistance({ boot, ball: target, ballRadius: ball.radius });
    const next = chilenaGuidanceVelocity({
      boot,
      ball: target,
      ballVelocity: { x: target.vx, y: target.vy },
      velocity: { x: body.vx, y: body.vy },
      secondsLeft: Math.max(1 / 60, targetSeconds - elapsed),
      limits: chilenaFlightLimits({
        rise: takeoff.y - body.y,
        maxRise,
        sideOffset: body.x - takeoff.x,
        maxSideTravel,
      }),
    });
    body.vx = next.x;
    body.vy = next.y;
    step(body);
    step(target);
    if (body.y > restY) {
      body.y = restY;
      body.vy = Math.min(0, body.vy);
    }
    apexRise = Math.max(apexRise, takeoff.y - body.y);
    sideTravel = Math.max(sideTravel, Math.abs(body.x - takeoff.x));
  }
  return { reachable: false, contactSeconds: null, surfaceDistance: null, apexRise: finishApex(), sideTravel };
};
