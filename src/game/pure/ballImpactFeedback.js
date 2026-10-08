/**
 * Per-ball impact feedback (audit F3): what a ground bounce and a kick look and
 * sound like for each ball. Colours are baked hex values (Canvas renderer) and
 * sounds are short synthesized tones layered on the shared kick and impact
 * sounds, so no new audio assets are needed.
 *
 * Speeds are Matter velocities in px per step (balls are capped near 25).
 */
const FOOTBALL = Object.freeze({
  id: 'football',
  // Grass and dust kicked up by the bounce.
  particles: Object.freeze({ colors: Object.freeze([0x9fd86a, 0xe8dfb8]), count: 7, speed: 150, radius: 3, gravity: 520 }),
  bounceTone: Object.freeze({ frequency: 120, endFrequency: 70, duration: 0.07, type: 'triangle', gain: 0.03 }),
  kickTone: null,
  shake: 0,
});

export const BALL_IMPACT_PROFILES = Object.freeze({
  football: FOOTBALL,
  'neon-ball': Object.freeze({
    ...FOOTBALL,
    id: 'neon-ball',
    // Light sparks instead of dust, and a bright zap on the kick.
    particles: Object.freeze({ colors: Object.freeze([0x7df7ff, 0xff5ce1, 0xffffff]), count: 9, speed: 210, radius: 2.5, gravity: 300 }),
    bounceTone: Object.freeze({ frequency: 520, endFrequency: 260, duration: 0.07, type: 'sine', gain: 0.022 }),
    kickTone: Object.freeze({ frequency: 680, endFrequency: 1180, duration: 0.08, type: 'sine', gain: 0.018 }),
  }),
  balloon: Object.freeze({
    id: 'balloon',
    // Soft rubbery boing and a few light puffs.
    particles: Object.freeze({ colors: Object.freeze([0xffc2df, 0xffffff]), count: 4, speed: 90, radius: 4, gravity: 160 }),
    bounceTone: Object.freeze({ frequency: 260, endFrequency: 430, duration: 0.12, type: 'sine', gain: 0.026 }),
    kickTone: Object.freeze({ frequency: 330, endFrequency: 560, duration: 0.11, type: 'sine', gain: 0.022 }),
    shake: 0,
  }),
  rugby: Object.freeze({
    id: 'rugby',
    // Clods of turf and a dull leather thud.
    particles: Object.freeze({ colors: Object.freeze([0x7a5230, 0x5f9a3c]), count: 8, speed: 170, radius: 3.5, gravity: 640 }),
    bounceTone: Object.freeze({ frequency: 90, endFrequency: 52, duration: 0.09, type: 'triangle', gain: 0.034 }),
    kickTone: Object.freeze({ frequency: 150, endFrequency: 90, duration: 0.07, type: 'triangle', gain: 0.02 }),
    shake: 0,
  }),
  can: Object.freeze({
    id: 'can',
    // Metal clink with bright sparks.
    particles: Object.freeze({ colors: Object.freeze([0xfff1a8, 0xd9e2ec]), count: 8, speed: 230, radius: 2, gravity: 700 }),
    bounceTone: Object.freeze({ frequency: 1500, endFrequency: 1100, duration: 0.06, type: 'triangle', gain: 0.02 }),
    kickTone: Object.freeze({ frequency: 1250, endFrequency: 1900, duration: 0.05, type: 'square', gain: 0.012 }),
    shake: 0,
  }),
  cannonball: Object.freeze({
    id: 'cannonball',
    // Heavy dust cloud, a deep thump and a small camera jolt.
    particles: Object.freeze({ colors: Object.freeze([0x8f8a80, 0xc9bfa8, 0x5e5a54]), count: 14, speed: 170, radius: 4.5, gravity: 420 }),
    bounceTone: Object.freeze({ frequency: 62, endFrequency: 32, duration: 0.16, type: 'square', gain: 0.04 }),
    kickTone: Object.freeze({ frequency: 70, endFrequency: 45, duration: 0.12, type: 'square', gain: 0.03 }),
    shake: 0.004,
  }),
});

/** Below this downward speed a ground contact is a roll, not a bounce. */
export const BALL_BOUNCE_MIN_SPEED = 4;
/** Speed at which bounce feedback reaches full strength. */
export const BALL_BOUNCE_FULL_SPEED = 16;
/** Minimum seconds between two bounce effects (stops rattling spam). */
export const BALL_BOUNCE_COOLDOWN = 0.12;

/** Profile for a ball type: by id first (Neon), then by family; unknown balls get the football. */
export const resolveBallImpactProfile = (ballType) => (
  BALL_IMPACT_PROFILES[ballType?.id]
  ?? BALL_IMPACT_PROFILES[ballType?.family]
  ?? FOOTBALL
);

/**
 * Strength 0..1 of a ground bounce from the ball's downward speed, or 0 when it
 * is too soft or too soon after the last one.
 */
export const ballBounceStrength = ({ downwardSpeed, sinceLastBounce = Infinity }) => {
  const speed = Number(downwardSpeed);
  if (!Number.isFinite(speed) || speed < BALL_BOUNCE_MIN_SPEED) return 0;
  if (!(sinceLastBounce >= BALL_BOUNCE_COOLDOWN)) return 0;
  const strength = (speed - BALL_BOUNCE_MIN_SPEED) / (BALL_BOUNCE_FULL_SPEED - BALL_BOUNCE_MIN_SPEED);
  return Math.min(1, Math.max(0.25, strength));
};
