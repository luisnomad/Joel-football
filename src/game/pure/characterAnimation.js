export const ENHANCED_CHARACTER_FRAME_COUNT = 12;

/**
 * Horizontal travel (px) that advances the run loop by one phase. At top
 * speed (~1220 px/s) this yields about 15 displayed frames/second, keeping
 * the three authored run drawings readable instead of buzzing.
 */
export const RUN_FRAME_DISTANCE = 82;

export const CHARACTER_GROUND_ANCHOR_Y = 418;
export const CHARACTER_DISPLAY_HEIGHT = 280;
export const CHARACTER_DISPLAY_WIDTH = CHARACTER_DISPLAY_HEIGHT * (320 / 480);
export const CHARACTER_GAMEPLAY_HEIGHT = 240;

export const CHARACTER_FRAMES = Object.freeze({
  idle: 0,
  legacyRun: 1,
  jump: 2,
  legacyKick: 3,
  dash: 4,
  stun: 5,
  runContactA: 6,
  runPassing: 7,
  runContactB: 8,
  kickAnticipation: 9,
  kickContact: 10,
  kickRecovery: 11,
});

export const RUN_VISUAL_SEQUENCE = Object.freeze([
  CHARACTER_FRAMES.runContactA,
  CHARACTER_FRAMES.runPassing,
  CHARACTER_FRAMES.runContactB,
  CHARACTER_FRAMES.runPassing,
]);

export const GROUNDED_VISUAL_FRAMES = Object.freeze([
  CHARACTER_FRAMES.idle,
  CHARACTER_FRAMES.legacyRun,
  CHARACTER_FRAMES.dash,
  CHARACTER_FRAMES.stun,
  CHARACTER_FRAMES.runContactA,
  CHARACTER_FRAMES.runPassing,
  CHARACTER_FRAMES.runContactB,
  CHARACTER_FRAMES.kickAnticipation,
  CHARACTER_FRAMES.kickContact,
  CHARACTER_FRAMES.kickRecovery,
]);

export const isGroundedVisualFrame = (frame) => GROUNDED_VISUAL_FRAMES.includes(Number(frame));

const positiveModulo = (value, divisor) => ((value % divisor) + divisor) % divisor;

export const runVisualAt = (cycle = 0) => {
  const phase = positiveModulo(Math.floor(Number(cycle) || 0), RUN_VISUAL_SEQUENCE.length);
  const contact = phase % 2 === 0;
  return {
    frame: RUN_VISUAL_SEQUENCE[phase],
    phase,
    pose: contact ? 'run-contact' : 'run-stride',
    stage: ['contact-a', 'passing-a', 'contact-b', 'passing-b'][phase],
    footstep: contact,
    bob: 0,
  };
};

/**
 * Seconds the complete kick animation plays. Longer than the gameplay kick
 * (PLAYER_TUNING.kickDuration) so the boot gets a real follow-through after
 * the strike window closes.
 */
export const KICK_VISUAL_SECONDS = 0.32;
/**
 * Seconds of windup shown on the anticipation drawing. Kept short on
 * purpose: strikes connect immediately in this game, so a long windup would
 * desynchronize the boot from the actual hit.
 */
export const KICK_ANTICIPATION_SECONDS = 0.05;
/**
 * Seconds shown on the contact drawing. Matches PLAYER_TUNING.kickDuration
 * so the contact pose covers the entire gameplay strike window.
 */
export const KICK_CONTACT_SECONDS = 0.16;
/**
 * Share of the gameplay kick during which a strike may connect. Strikes open
 * immediately on kick start and close early in the follow-through.
 */
export const KICK_STRIKE_WINDOW_END = 0.86;

export const kickVisualAt = ({ remaining = 0, duration = KICK_VISUAL_SECONDS } = {}) => {
  const safeDuration = Math.max(Number(duration) || 0, Number.EPSILON);
  const elapsed = Math.min(safeDuration, Math.max(0, safeDuration - (Number(remaining) || 0)));
  const progress = elapsed / safeDuration;
  if (elapsed < KICK_ANTICIPATION_SECONDS) {
    return { frame: CHARACTER_FRAMES.kickAnticipation, stage: 'anticipation', progress };
  }
  if (elapsed < KICK_CONTACT_SECONDS) {
    return { frame: CHARACTER_FRAMES.kickContact, stage: 'contact', progress };
  }
  return { frame: CHARACTER_FRAMES.kickRecovery, stage: 'recovery', progress };
};

/** Seconds the landing squash envelope takes to settle back to neutral. */
export const LAND_SQUASH_SECONDS = 0.14;
/** Seconds the takeoff stretch envelope takes to settle back to neutral. */
export const TAKEOFF_STRETCH_SECONDS = 0.12;
/** Falling speed (px/tick) that triggers a landing squash on touchdown. */
export const LANDING_SQUASH_MIN_VELOCITY = 4;
/** Upward speed (px/tick) that triggers a takeoff stretch on leaving the ground. */
export const TAKEOFF_STRETCH_MIN_VELOCITY = -4;

/** Horizontal widening (added to scaleX) at the strongest point of a landing squash. */
export const LAND_SQUASH_SCALE_X = 0.055;
/** Vertical flattening (subtracted from scaleY) at the strongest point of a landing squash. */
export const LAND_SQUASH_SCALE_Y = 0.09;
/** Horizontal narrowing (subtracted from scaleX) at the strongest point of a takeoff stretch. */
export const TAKEOFF_STRETCH_SCALE_X = 0.035;
/** Vertical elongation (added to scaleY) at the strongest point of a takeoff stretch. */
export const TAKEOFF_STRETCH_SCALE_Y = 0.06;

/** Peak vertical scale wobble of the idle breathing cycle. */
export const IDLE_BREATH_SCALE_Y = 0.014;
/** Horizontal counter-scale of the breathing cycle, as a fraction of the vertical wobble. */
export const IDLE_BREATH_SCALE_X_RATIO = 0.5;
/** Full breathing cycles per second while idling. */
export const IDLE_BREATH_CYCLES_PER_SECOND = 0.5;
/**
 * Master switch for the idle breathing accent. Disabled for now: the scale
 * wobble reads as a weird shimmer on the standing artwork. Kept for a later
 * pass — likely needs a subtler amplitude or a dedicated idle drawing.
 */
export const IDLE_BREATH_ENABLED = false;

/** Peak vertical dip while a foot is planted during the run cycle. */
export const RUN_PLANT_SCALE_Y = 0.022;
/** Horizontal counter-scale while a foot is planted during the run cycle. */
export const RUN_PLANT_SCALE_X = 0.011;

/** Forward lean (degrees) toward the dash direction. */
export const DASH_LEAN_DEGREES = 3.5;
/** Horizontal stretch (scaleX multiplier) while dashing. */
export const DASH_STRETCH_SCALE_X = 1.04;
/** Vertical compression (scaleY multiplier) while dashing. */
export const DASH_SQUASH_SCALE_Y = 0.98;

/** Wobble speed of a stunned fighter, radians per second. */
export const STUN_WOBBLE_RADIANS_PER_SECOND = 22;
/** Wobble amplitude of a stunned fighter, degrees. */
export const STUN_WOBBLE_DEGREES = 2.5;

/** Crouch (scaleY multiplier) shown during kick anticipation. */
export const KICK_ANTICIPATION_SCALE_Y = 0.95;
/** Horizontal counter-scale (scaleX multiplier) during kick anticipation. */
export const KICK_ANTICIPATION_SCALE_X = 1.03;
/** Horizontal stretch (scaleX multiplier) at ball contact during a kick. */
export const KICK_CONTACT_SCALE_X = 1.05;
/** Vertical compression (scaleY multiplier) at ball contact during a kick. */
export const KICK_CONTACT_SCALE_Y = 0.98;

/**
 * Procedural accent motion layered on top of the authored frames. Returns
 * multiplicative scale factors and an additive angle (degrees) for the
 * visual-only sprite; the physics body is never touched. Scaling happens
 * around the ground anchor, so planted feet stay planted.
 *
 * `landSquash` and `takeoffStretch` are 1 → 0 envelopes driven by the caller.
 */
export const secondaryMotionAt = ({
  pose = 'idle',
  stage = 'idle',
  runCycle = 0,
  clockSeconds = 0,
  landSquash = 0,
  takeoffStretch = 0,
  dashDirection = 0,
  chilena = false,
} = {}) => {
  let scaleX = 1 - TAKEOFF_STRETCH_SCALE_X * takeoffStretch + LAND_SQUASH_SCALE_X * landSquash;
  let scaleY = 1 + TAKEOFF_STRETCH_SCALE_Y * takeoffStretch - LAND_SQUASH_SCALE_Y * landSquash;
  let angle = 0;
  if (chilena) return { scaleX, scaleY, angle };

  if (pose === 'idle' && IDLE_BREATH_ENABLED) {
    const breath = Math.sin(clockSeconds * 2 * Math.PI * IDLE_BREATH_CYCLES_PER_SECOND)
      * IDLE_BREATH_SCALE_Y;
    scaleY *= 1 + breath;
    scaleX *= 1 - breath * IDLE_BREATH_SCALE_X_RATIO;
  } else if (pose === 'run-contact' || pose === 'run-stride') {
    // Weight dip on each planted contact, synced to the distance-driven cycle.
    const plant = Math.abs(Math.cos(Math.PI * (Number(runCycle) || 0)));
    scaleY *= 1 - RUN_PLANT_SCALE_Y * plant;
    scaleX *= 1 + RUN_PLANT_SCALE_X * plant;
  } else if (pose === 'dash') {
    angle = DASH_LEAN_DEGREES * (Math.sign(dashDirection) || 0);
    scaleX *= DASH_STRETCH_SCALE_X;
    scaleY *= DASH_SQUASH_SCALE_Y;
  } else if (pose === 'stun') {
    angle = Math.sin(clockSeconds * STUN_WOBBLE_RADIANS_PER_SECOND) * STUN_WOBBLE_DEGREES;
  } else if (pose === 'kick' || pose === 'lob') {
    if (stage === 'anticipation') {
      scaleY *= KICK_ANTICIPATION_SCALE_Y;
      scaleX *= KICK_ANTICIPATION_SCALE_X;
    } else if (stage === 'contact') {
      scaleX *= KICK_CONTACT_SCALE_X;
      scaleY *= KICK_CONTACT_SCALE_Y;
    }
  }
  return { scaleX, scaleY, angle };
};
