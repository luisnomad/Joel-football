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

/**
 * Atlas layouts. `classic` is the original 4x3 sheet of 320x480 cells
 * (CHARACTER_FRAMES above). `roster-v2` is the sprite-redo atlas: 6x4 cells of
 * 336x480 cut from one generated animation per action, so every frame shares
 * one drawing scale. Both keep the feet of grounded frames on y=418 and use
 * the same 0.583 display scale (480 px cell -> 280 world px).
 */
export const CHARACTER_LAYOUTS = Object.freeze({
  classic: Object.freeze({
    id: 'classic',
    frameWidth: 320,
    frameHeight: 480,
    frameCount: ENHANCED_CHARACTER_FRAME_COUNT,
    idle: Object.freeze([CHARACTER_FRAMES.idle]),
    run: RUN_VISUAL_SEQUENCE,
    runContactPhases: Object.freeze([0, 2]),
    kick: Object.freeze([
      Object.freeze({ frame: CHARACTER_FRAMES.kickAnticipation, stage: 'anticipation', until: KICK_ANTICIPATION_SECONDS }),
      Object.freeze({ frame: CHARACTER_FRAMES.kickContact, stage: 'contact', until: KICK_CONTACT_SECONDS }),
      Object.freeze({ frame: CHARACTER_FRAMES.kickRecovery, stage: 'recovery', until: Infinity }),
    ]),
    kickContact: CHARACTER_FRAMES.kickContact,
    jump: CHARACTER_FRAMES.jump,
    dash: CHARACTER_FRAMES.dash,
    stun: CHARACTER_FRAMES.stun,
    chilena: Object.freeze({
      takeoff: CHARACTER_FRAMES.legacyKick,
      contact: CHARACTER_FRAMES.legacyKick,
      follow: CHARACTER_FRAMES.legacyKick,
    }),
    // One drawing for the whole move: the runtime spins it (chilenaRotationAt).
    chilenaFramed: false,
    celebrate: Object.freeze([CHARACTER_FRAMES.idle]),
    grounded: GROUNDED_VISUAL_FRAMES,
    // Classic timing is unchanged: the run is purely distance-driven.
    runMinDrawingsPerSecond: 0,
    runMaxDrawingsPerSecond: Infinity,
    idleFps: 6,
    celebrateFps: 8,
  }),
  'roster-v2': Object.freeze({
    id: 'roster-v2',
    frameWidth: 336,
    frameHeight: 480,
    frameCount: 24,
    idle: Object.freeze([0, 1, 2]),
    run: Object.freeze([3, 4, 5, 6, 7, 8]),
    runContactPhases: Object.freeze([0, 3]),
    // Strikes connect on kick start, so the contact drawing must be on screen
    // within a few hundredths of a second; the wind-up is a brief accent.
    kick: Object.freeze([
      Object.freeze({ frame: 9, stage: 'anticipation', until: KICK_ANTICIPATION_SECONDS }),
      Object.freeze({ frame: 10, stage: 'contact', until: KICK_CONTACT_SECONDS }),
      Object.freeze({ frame: 11, stage: 'recovery', until: 0.24 }),
      Object.freeze({ frame: 12, stage: 'recovery', until: Infinity }),
    ]),
    kickContact: 10,
    jump: 13,
    // Sprint (dash): the run loop's two opposite full strides, alternated fast
    // under a strong forward lean (see sprintVisualAt / secondaryMotionAt).
    dash: 3,
    sprint: Object.freeze([3, 6]),
    sprintFps: 16,
    sprintLeanDegrees: 9,
    // Hit reaction: impact, stagger (held, wobbling), recover.
    stun: 15,
    hit: Object.freeze({ impact: 14, stagger: 15, recover: 16 }),
    chilena: Object.freeze({ takeoff: 17, contact: 18, follow: 19 }),
    // The drawings carry the body orientation: no procedural spin.
    chilenaFramed: true,
    celebrate: Object.freeze([20, 21, 22, 23]),
    grounded: Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 20, 21, 22, 23]),
    // Owner playtest (2026-10-08): distance-only cadence drops to ~7 drawings/s at
    // mid-pitch speeds and reads choppy. Keep feet tied to ground speed near the
    // top end, but never animate a run slower than the floor or faster than the cap.
    runMinDrawingsPerSecond: 14,
    runMaxDrawingsPerSecond: 24,
    idleFps: 10,
    celebrateFps: 12,
  }),
});

export const DEFAULT_CHARACTER_LAYOUT_ID = 'classic';

export const getCharacterLayout = (character) => (
  CHARACTER_LAYOUTS[character?.atlasLayout] ?? CHARACTER_LAYOUTS[DEFAULT_CHARACTER_LAYOUT_ID]
);

/** Display width (world px) of one cell of the given layout at visual scale 1. */
export const layoutDisplayWidth = (layout) => (
  CHARACTER_DISPLAY_HEIGHT * (layout.frameWidth / layout.frameHeight)
);

export const isLayoutGroundedFrame = (layout, frame) => layout.grounded.includes(Number(frame));

export const idleVisualAt = (layout, clockSeconds = 0) => {
  const frames = layout.idle;
  if (frames.length <= 1) return { frame: frames[0], stage: 'idle' };
  // Ping-pong (0,1,2,1,...) so a short loop never snaps back to its start.
  const cycle = frames.length * 2 - 2;
  const step = positiveModulo(Math.floor((Number(clockSeconds) || 0) * layout.idleFps), cycle);
  return { frame: frames[step < frames.length ? step : cycle - step], stage: 'idle' };
};

/**
 * Run phase for a layout. `cycle` advances by one per RUN_FRAME_DISTANCE of
 * travel in the classic 4-phase loop; longer authored loops advance by the same
 * distance per *stride*, so the feet keep matching the ground speed.
 */
export const layoutRunVisualAt = (layout, cycle = 0) => {
  if (layout.id === 'classic') return runVisualAt(cycle);
  const frames = layout.run;
  const phases = frames.length;
  const scaledCycle = (Number(cycle) || 0) * (phases / RUN_VISUAL_SEQUENCE.length);
  const phase = positiveModulo(Math.floor(scaledCycle), phases);
  const footstep = layout.runContactPhases.includes(phase);
  return {
    frame: frames[phase],
    phase,
    pose: footstep ? 'run-contact' : 'run-stride',
    stage: `run-${phase}`,
    footstep,
    bob: 0,
  };
};

/**
 * How far the run cycle advances this step, in classic phases (one phase =
 * RUN_FRAME_DISTANCE of travel). Classic layouts stay purely distance-driven;
 * layouts with a cadence floor/cap clamp the resulting drawings per second.
 */
export const runCycleAdvance = (layout, { travelled = 0, dt = 0 } = {}) => {
  const distancePhases = Math.max(0, Number(travelled) || 0) / RUN_FRAME_DISTANCE;
  if (!(layout.runMinDrawingsPerSecond > 0) && !Number.isFinite(layout.runMaxDrawingsPerSecond)) {
    return distancePhases;
  }
  const drawingsPerPhase = layout.run.length / RUN_VISUAL_SEQUENCE.length;
  const seconds = Math.max(0, Number(dt) || 0);
  const floor = (seconds * layout.runMinDrawingsPerSecond) / drawingsPerPhase;
  const cap = (seconds * layout.runMaxDrawingsPerSecond) / drawingsPerPhase;
  return Math.min(cap, Math.max(floor, distancePhases));
};

export const layoutKickVisualAt = (layout, { remaining = 0, duration = KICK_VISUAL_SECONDS } = {}) => {
  const safeDuration = Math.max(Number(duration) || 0, Number.EPSILON);
  const elapsed = Math.min(safeDuration, Math.max(0, safeDuration - (Number(remaining) || 0)));
  const progress = elapsed / safeDuration;
  const step = layout.kick.find((entry) => elapsed < entry.until) ?? layout.kick[layout.kick.length - 1];
  return { frame: step.frame, stage: step.stage, progress };
};

/**
 * Chilena drawing for the current stage. Before contact the takeoff drawing
 * plays; the contact drawing is held for CHILENA_CONTACT_HOLD_SECONDS from the
 * moment the boot meets the ball; the follow-through plays until landing.
 */
/** Sprint (dash) stride for layouts that author one; null keeps the single dash drawing. */
export const sprintVisualAt = (layout, elapsedSeconds = 0) => {
  if (!layout.sprint) return null;
  const step = positiveModulo(Math.floor((Number(elapsedSeconds) || 0) * layout.sprintFps), layout.sprint.length);
  return { frame: layout.sprint[step], stage: 'sprint' };
};

/** Seconds of the hit impact drawing, and of the recover drawing before the stun ends. */
export const HIT_IMPACT_SECONDS = 0.14;
export const HIT_RECOVER_SECONDS = 0.2;

/**
 * Hit reaction for layouts that author one: impact on the blow, stagger while
 * stunned, recover just before the stun ends. Classic layouts hold `stun`.
 */
export const hitVisualAt = (layout, { elapsed = 0, remaining = 0 } = {}) => {
  if (!layout.hit) return { frame: layout.stun, stage: 'stun' };
  if (elapsed < HIT_IMPACT_SECONDS) return { frame: layout.hit.impact, stage: 'hit-impact' };
  if (remaining <= HIT_RECOVER_SECONDS) return { frame: layout.hit.recover, stage: 'hit-recover' };
  return { frame: layout.hit.stagger, stage: 'hit-stagger' };
};

export const CHILENA_CONTACT_HOLD_SECONDS = 0.12;

export const chilenaVisualAt = (layout, { contactAt = null, elapsed = 0, contactReady = false } = {}) => {
  const frames = layout.chilena;
  if (contactAt === null) {
    return { frame: contactReady ? frames.contact : frames.takeoff, stage: contactReady ? 'contact' : 'takeoff' };
  }
  const sinceContact = (Number(elapsed) || 0) - contactAt;
  if (sinceContact < CHILENA_CONTACT_HOLD_SECONDS) return { frame: frames.contact, stage: 'contact' };
  return { frame: frames.follow, stage: 'follow' };
};

export const celebrateVisualAt = (layout, clockSeconds = 0) => {
  const frames = layout.celebrate;
  const step = positiveModulo(Math.floor((Number(clockSeconds) || 0) * layout.celebrateFps), frames.length);
  return { frame: frames[step], stage: 'celebrate' };
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
  dashLeanDegrees = null,
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
    angle = (dashLeanDegrees ?? DASH_LEAN_DEGREES) * (Math.sign(dashDirection) || 0);
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
